"""
Single Candidate Enrichment Service
====================================
Orchestrates full enrichment for a single candidate from LinkedIn URL + JD.

Flow:
1. Check internal DB for candidate
2. If not found, scrape from LinkedIn via Brightdata
3. Parse JD to extract requirements
4. Run all enrichment services:
   - Salary timeline estimation
   - Skills validation
   - Response likelihood scoring
   - Availability checking
5. Generate recruiter summary
6. Return comprehensive enrichment package
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from models.enrichment_models import (AvailabilityData, EnrichedCandidate,
                                      RecruiterSummary,
                                      ResponseLikelihoodAnalysis,
                                      SalaryEnrichment, SkillValidation,
                                      WebIntelligence)
from services.availability_checker import AvailabilityChecker
from services.jd_parser import JDParser
from services.linkedin_scraper import LinkedInScraperService
from services.model_config_manager import ModelConfigManager
from services.response_likelihood_scorer import ResponseLikelihoodScorer
from services.salary_estimator import SalaryEstimator
from services.skill_validator import SkillValidator
from services.web_search_wrapper import WebSearchWrapper

logger = get_logger(__name__)


class SingleCandidateEnrichmentService:
    """
    Enriches a single candidate with all available data.
    
    This service combines:
    - LinkedIn scraping (if profile not in DB)
    - JD parsing
    - All enrichment pipelines (salary, skills, response, availability)
    - Recruiter summary generation
    """
    
    def __init__(
        self,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        linkedin_scraper: LinkedInScraperService,
        jd_parser: JDParser,
        salary_estimator: SalaryEstimator,
        response_scorer: ResponseLikelihoodScorer,
        skill_validator: SkillValidator,
        availability_checker: AvailabilityChecker,
        web_search: WebSearchWrapper,
        model_config_manager: ModelConfigManager
    ):
        self.db = mongodb
        self.redis = redis_cache
        self.linkedin = linkedin_scraper
        self.jd_parser = jd_parser
        self.salary = salary_estimator
        self.response = response_scorer
        self.skills = skill_validator
        self.availability = availability_checker
        self.web_search = web_search
        self.model_manager = model_config_manager
        
        logger.info("SingleCandidateEnrichmentService initialized")
    
    async def lookup_candidate(
        self,
        linkedin_url: str,
        force_scrape: bool = False
    ) -> Dict[str, Any]:
        """
        Look up a candidate by LinkedIn URL.
        
        1. First checks internal MongoDB database
        2. If not found or force_scrape=True, scrapes from LinkedIn
        
        Args:
            linkedin_url: LinkedIn profile URL
            force_scrape: Force fresh scrape even if in DB
            
        Returns:
            Candidate data dict with source indicator
        """
        
        logger.info(f"Looking up candidate: {linkedin_url}")
        
        # Normalize URL
        linkedin_url = linkedin_url.strip().lower()
        
        # Handle relative paths (e.g., "/in/username")
        if linkedin_url.startswith("/"):
            linkedin_url = "https://www.linkedin.com" + linkedin_url
        
        if not linkedin_url.startswith("http"):
            linkedin_url = "https://" + linkedin_url
        
        # Check internal database first
        if not force_scrape:
            db_candidate = await self._find_in_database(linkedin_url)
            
            if db_candidate:
                logger.info(f"Found candidate in database: {db_candidate.get('_id')}")
                return {
                    "found": True,
                    "source": "database",
                    "candidate": self._normalize_db_candidate(db_candidate),
                    "message": "Candidate found in our database"
                }
        
        # Scrape from LinkedIn
        logger.info("Candidate not in DB, scraping from LinkedIn...")
        
        scraped = await self.linkedin.scrape_profile(
            linkedin_url,
            force_refresh=force_scrape
        )
        
        if "error" in scraped:
            return {
                "found": False,
                "source": "scrape_failed",
                "error": scraped["error"],
                "message": f"Could not scrape profile: {scraped['error']}"
            }
        
        return {
            "found": True,
            "source": "linkedin_scrape",
            "candidate": scraped,
            "message": "Profile scraped from LinkedIn"
        }
    
    async def enrich_candidate(
        self,
        candidate_data: Dict[str, Any],
        jd_text: str,
        session_id: Optional[str] = None,
        enrichment_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Fully enrich a candidate against a job description.
        
        Args:
            candidate_data: Candidate profile data (from DB or scrape)
            jd_text: Job description text
            session_id: Optional session ID for progress tracking
            enrichment_types: List of enrichment types to run
                            (default: all - salary, skills, response, availability)
        
        Returns:
            Comprehensive enrichment result
        """
        
        logger.info(f"Starting full enrichment for: {candidate_data.get('full_name', 'Unknown')}")
        
        # Default to all enrichment types
        if enrichment_types is None:
            enrichment_types = ["salary", "skills", "response", "availability", "web_intelligence"]
        
        # Parse JD
        jd_data = await self._parse_job_description(jd_text)
        
        # Run enrichments in parallel
        enrichment_tasks = {}
        
        if "salary" in enrichment_types:
            enrichment_tasks["salary"] = self._enrich_salary(candidate_data, session_id)
        
        if "skills" in enrichment_types:
            enrichment_tasks["skills"] = self._validate_skills(
                candidate_data,
                jd_data.get("required_skills", []),
                session_id
            )
        
        if "response" in enrichment_types:
            enrichment_tasks["response"] = self._score_response_likelihood(
                candidate_data,
                session_id
            )
        
        if "availability" in enrichment_types:
            enrichment_tasks["availability"] = self._check_availability(
                candidate_data,
                session_id
            )
        
        if "web_intelligence" in enrichment_types:
            enrichment_tasks["web_intelligence"] = self._gather_web_intelligence(
                candidate_data,
                session_id
            )
        
        # Execute all tasks in parallel
        results = {}
        if enrichment_tasks:
            task_names = list(enrichment_tasks.keys())
            task_coros = list(enrichment_tasks.values())
            
            task_results = await asyncio.gather(*task_coros, return_exceptions=True)
            
            for name, result in zip(task_names, task_results):
                if isinstance(result, Exception):
                    logger.error(f"Enrichment {name} failed: {result}")
                    results[name] = None
                else:
                    results[name] = result
        
        # Calculate match score
        match_info = self._calculate_match(candidate_data, jd_data, results)
        
        # Generate recruiter summary
        recruiter_summary = await self._generate_recruiter_summary(
            candidate_data,
            jd_data,
            results,
            match_info
        )
        
        # Build final response
        enriched_result = {
            "candidate": {
                "profile_id": candidate_data.get("_id", candidate_data.get("linkedin_id", "")),
                "first_name": candidate_data.get("first_name", ""),
                "last_name": candidate_data.get("last_name", ""),
                "full_name": candidate_data.get("full_name", ""),
                "title": candidate_data.get("title", candidate_data.get("headline", "")),
                "company": candidate_data.get("current_company", ""),
                "location": candidate_data.get("location", ""),
                "linkedin_url": candidate_data.get("linkedin_url", ""),
                "summary": candidate_data.get("summary", ""),
                "experience": candidate_data.get("experience", []),
                "education": candidate_data.get("education", []),
                "skills": candidate_data.get("skills", []),
                "total_experience_years": candidate_data.get("total_experience_years", 0)
            },
            "job_requirements": {
                "role_title": jd_data.get("role_title", ""),
                "required_skills": jd_data.get("required_skills", []),
                "nice_to_have_skills": jd_data.get("nice_to_have_skills", []),
                "experience_required": jd_data.get("experience_years", ""),
                "location_requirements": jd_data.get("location", "")
            },
            "match": match_info,
            "enrichment": {
                "salary": results.get("salary"),
                "skills_validation": results.get("skills"),
                "response_likelihood": results.get("response"),
                "availability": results.get("availability"),
                "web_intelligence": results.get("web_intelligence")
            },
            "recruiter_summary": recruiter_summary,
            "metadata": {
                "enriched_at": datetime.utcnow().isoformat(),
                "enrichment_types": enrichment_types,
                "data_source": candidate_data.get("_source", "database")
            }
        }
        
        return enriched_result

    async def _find_in_database(self, linkedin_url: str) -> Optional[Dict]:
            """
            Search for candidate in MongoDB by LinkedIn URL.
            Logic: Extracts the relative path (e.g., '/in/username/') to match DB format.
            """
            
            # 1. Clean the input URL
            clean_url = linkedin_url.strip().lower()
            
            # 2. Extract the identifier path (everything after the domain)
            # If the URL contains '/in/', we split there to get the relative path.
            if "/in/" in clean_url:
                # This handles "https://www.linkedin.com/in/foo" -> "/in/foo"
                path_part = "/in/" + clean_url.split("/in/")[1]
            else:
                # Handle edge cases where input might just be the username or path
                path_part = clean_url if clean_url.startswith("/") else f"/in/{clean_url}"

            # 3. Clean up query parameters (remove ?ref=..., etc.)
            path_part = path_part.split("?")[0]
            
            # 4. Create variations (Database has trailing slash '/in/foo/', but input might be '/in/foo')
            # We search for both to be safe.
            search_variations = [
                path_part if path_part.endswith("/") else f"{path_part}/", # Format: /in/name/
                path_part.rstrip("/")                                      # Format: /in/name
            ]
            
            # 5. Execute single query using $in operator (more efficient than loop)
            candidate = await self.db.profiles_collection.find_one(
                {"linkedin_url": {"$in": search_variations}}
            )
            
            if candidate:
                return candidate
                
            return None

    def _normalize_db_candidate(self, db_record: Dict) -> Dict:
        """Normalize database record to standard format."""
        
        # Parse experience from DB format
        experience = []
        for exp in db_record.get("experience", []):
            if isinstance(exp, dict):
                experience.append(exp)
            elif isinstance(exp, str):
                # Handle string format
                experience.append({"description": exp})
                
        # Fix URL output to ensure it is absolute
        raw_url = db_record.get("linkedin_url", "")
        if raw_url and raw_url.startswith("/"):
            full_url = f"https://www.linkedin.com{raw_url}"
        else:
            full_url = raw_url  
        
        return {
            "_id": str(db_record.get("_id", "")),
            "linkedin_id": full_url,
            "linkedin_url": db_record.get("linkedin_url", ""),
            "first_name": db_record.get("first_name", ""),
            "last_name": db_record.get("last_name", ""),
            "full_name": f"{db_record.get('first_name', '')} {db_record.get('last_name', '')}".strip(),
            "headline": db_record.get("title", ""),
            "title": db_record.get("title", ""),
            "location": db_record.get("location", ""),
            "summary": db_record.get("summary", ""),
            "current_company": db_record.get("company", db_record.get("current_company", "")),
            "industry": db_record.get("current_industry", ""),
            "experience": experience,
            "education": db_record.get("education", []),
            "skills": db_record.get("expertise", "").split(",") if isinstance(db_record.get("expertise"), str) else db_record.get("skills", []),
            "expertise": db_record.get("expertise", ""),
            "total_experience_years": db_record.get("experience_years", 0),
            "seniority_level": db_record.get("seniority_level", ""),
            "_source": "database"
        }
    
    async def _parse_job_description(self, jd_text: str) -> Dict[str, Any]:
        """Parse JD using JDParser service."""
        
        try:
            parsed = await self.jd_parser.parse_jd(jd_text)
            return parsed
        except Exception as e:
            logger.error(f"Error parsing JD: {e}")
            # Return basic structure
            return {
                "role_title": "Unknown Role",
                "required_skills": [],
                "nice_to_have_skills": [],
                "experience_years": "",
                "location": ""
            }
    
    async def _enrich_salary(
        self,
        candidate: Dict,
        session_id: Optional[str]
    ) -> Optional[Dict]:
        """Run salary estimation."""
        
        try:
            result = await self.salary.estimate_career_progression(
                candidate,
                session_id=session_id
            )
            
            if isinstance(result, SalaryEnrichment):
                return result.model_dump()
            return result
            
        except Exception as e:
            logger.error(f"Salary enrichment error: {e}")
            return None
    
    async def _validate_skills(
        self,
        candidate: Dict,
        required_skills: List[str],
        session_id: Optional[str]
    ) -> Optional[Dict]:
        """Run skills validation."""
        
        try:
            # Add required skills to candidate for validation
            candidate_with_skills = {**candidate}
            candidate_with_skills["skills_to_validate"] = required_skills
            
            result = await self.skills.validate_skills(
                candidate_with_skills,
                session_id=session_id
            )
            
            if isinstance(result, SkillValidation):
                return result.model_dump()
            return result
            
        except Exception as e:
            logger.error(f"Skills validation error: {e}")
            return None
    
    async def _score_response_likelihood(
        self,
        candidate: Dict,
        session_id: Optional[str]
    ) -> Optional[Dict]:
        """Calculate response likelihood score."""
        
        try:
            result = await self.response.calculate_response_likelihood(
                candidate,
                session_id=session_id
            )
            
            if isinstance(result, ResponseLikelihoodAnalysis):
                return result.model_dump()
            return result
            
        except Exception as e:
            logger.error(f"Response likelihood error: {e}")
            return None
    
    async def _check_availability(
        self,
        candidate: Dict,
        session_id: Optional[str]
    ) -> Optional[Dict]:
        """Check candidate availability."""
        
        try:
            result = await self.availability.check_availability(
                candidate,
                session_id=session_id
            )
            
            if isinstance(result, AvailabilityData):
                return result.model_dump()
            return result
            
        except Exception as e:
            logger.error(f"Availability check error: {e}")
            return None
    
    async def _gather_web_intelligence(
        self,
        candidate: Dict,
        session_id: Optional[str]
    ) -> Optional[Dict]:
        """Gather additional web intelligence."""
        
        name = candidate.get("full_name", "")
        company = candidate.get("current_company", "")
        
        if not name:
            return None
        
        try:
            intelligence = {
                "github_stats": None,
                "online_presence": [],
                "press_mentions": [],
                "social_signals": [],
                "risk_flags": [],
                "last_updated": datetime.utcnow().isoformat()
            }
            
            # Search for GitHub profile
            github_query = f"{name} site:github.com"
            github_result = await self.web_search.search(github_query, session_id=session_id)
            
            if github_result.get("sources"):
                github_urls = [s for s in github_result["sources"] if "github.com" in s]
                if github_urls:
                    intelligence["online_presence"].append(f"GitHub: {github_urls[0]}")
            
            # Search for press mentions
            press_query = f'"{name}" {company} news OR interview OR announcement'
            press_result = await self.web_search.search(press_query, session_id=session_id)
            
            if press_result.get("sources"):
                for source in press_result["sources"][:3]:
                    intelligence["press_mentions"].append({
                        "url": source,
                        "snippet": press_result.get("answer", "")[:200]
                    })
            
            return intelligence
            
        except Exception as e:
            logger.error(f"Web intelligence error: {e}")
            return None
    
    def _calculate_match(
        self,
        candidate: Dict,
        jd_data: Dict,
        enrichment_results: Dict
    ) -> Dict[str, Any]:
        """Calculate match score and label."""
        
        score = 0
        reasons = []
        
        # Skills match (40 points)
        required_skills = set(s.lower() for s in jd_data.get("required_skills", []))
        candidate_skills = set(
            s.lower() for s in candidate.get("skills", [])
        )
        
        if candidate.get("expertise"):
            candidate_skills.update(
                s.strip().lower() for s in candidate["expertise"].split(",")
            )
        
        if required_skills:
            matched_skills = required_skills.intersection(candidate_skills)
            skills_ratio = len(matched_skills) / len(required_skills)
            score += int(skills_ratio * 40)
            
            if skills_ratio >= 0.7:
                reasons.append(f"Strong skills match ({len(matched_skills)}/{len(required_skills)} required skills)")
            elif skills_ratio >= 0.4:
                reasons.append(f"Partial skills match ({len(matched_skills)}/{len(required_skills)} required skills)")
        
        # Experience match (30 points)
        exp_required = jd_data.get("experience_years", "")
        exp_actual = candidate.get("total_experience_years", 0)
        
        if exp_required and exp_actual:
            try:
                # Extract number from requirement
                import re
                match = re.search(r'(\d+)', str(exp_required))
                if match:
                    req_years = int(match.group(1))
                    
                    if exp_actual >= req_years:
                        score += 30
                        reasons.append(f"Meets experience requirement ({exp_actual} years vs {req_years}+ required)")
                    elif exp_actual >= req_years * 0.7:
                        score += 20
                        reasons.append(f"Close to experience requirement ({exp_actual} years vs {req_years}+ required)")
            except:
                pass
        
        # Response likelihood (15 points)
        response_data = enrichment_results.get("response")
        if response_data and response_data.get("overall_score"):
            response_score = response_data["overall_score"]
            score += int((response_score / 100) * 15)
            
            if response_score >= 70:
                reasons.append("High likelihood to respond to outreach")
        
        # Availability (15 points)
        availability_data = enrichment_results.get("availability")
        if availability_data and availability_data.get("urgency_score"):
            urgency = availability_data["urgency_score"]
            score += int((urgency / 10) * 15)
            
            if urgency >= 7:
                reasons.append("Shows signs of being open to new opportunities")
        
        # Determine label
        if score >= 80:
            label = "Excellent Match"
        elif score >= 65:
            label = "Great Match"
        elif score >= 50:
            label = "Good Match"
        else:
            label = "Fair Match"
        
        return {
            "score": min(score, 100),
            "label": label,
            "reasons": reasons,
            "summary": " | ".join(reasons) if reasons else "Basic criteria evaluated"
        }
    
    async def _generate_recruiter_summary(
        self,
        candidate: Dict,
        jd_data: Dict,
        enrichment_results: Dict,
        match_info: Dict
    ) -> Dict[str, Any]:
        """Generate recruiter-friendly summary using LLM."""
        
        try:
            model_config = await self.model_manager.get_model_config(task="summary")
            
            prompt = f"""Generate a concise recruiter summary for this candidate.

CANDIDATE:
- Name: {candidate.get('full_name', 'Unknown')}
- Current Role: {candidate.get('title', 'Unknown')}
- Company: {candidate.get('current_company', 'Unknown')}
- Location: {candidate.get('location', 'Unknown')}
- Experience: {candidate.get('total_experience_years', 0)} years
- Skills: {', '.join(candidate.get('skills', [])[:10])}

JOB REQUIREMENTS:
- Role: {jd_data.get('role_title', 'Unknown')}
- Required Skills: {', '.join(jd_data.get('required_skills', [])[:10])}
- Experience: {jd_data.get('experience_years', 'Not specified')}

MATCH INFO:
- Score: {match_info['score']}/100
- Label: {match_info['label']}
- Key Points: {match_info['summary']}

Provide:
1. why_shortlist: 2-3 sentences on why this candidate stands out
2. why_reject: 2-3 sentences on potential concerns
3. fit_summary: Overall assessment for hiring manager
4. overall_recommendation: "Strong Yes" | "Yes" | "Maybe" | "No"

Respond in JSON format."""

            # Use web search wrapper for LLM call
            result = await self.web_search.search(
                f"summary: {candidate.get('full_name', '')} {candidate.get('title', '')}",
                session_id=None
            )
            
            # Build summary from available data
            return {
                "why_shortlist": f"{candidate.get('full_name', 'Candidate')} brings {candidate.get('total_experience_years', 0)} years of experience as {candidate.get('title', 'a professional')}. {match_info.get('summary', '')}",
                "why_reject": "Limited public information available. May need to verify skills during interview.",
                "fit_summary": f"{match_info['label']} with {match_info['score']}% alignment to role requirements.",
                "standout_achievements": [],
                "red_flags": [],
                "interesting_findings": [],
                "overall_recommendation": "Yes" if match_info['score'] >= 65 else "Maybe",
                "confidence_level": min(match_info['score'] + 10, 100)
            }
            
        except Exception as e:
            logger.error(f"Error generating recruiter summary: {e}")
            return {
                "why_shortlist": "Unable to generate detailed summary",
                "why_reject": "N/A",
                "fit_summary": match_info.get("summary", ""),
                "overall_recommendation": "Review Required",
                "confidence_level": 50
            }