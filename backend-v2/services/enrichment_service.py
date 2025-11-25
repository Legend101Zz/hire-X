"""
Enhanced Enrichment Service with Recruiter Summaries
====================================================
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from models.enrichment_models import (EnrichedCandidate, EnrichmentProgress,
                                      RecruiterSummary, WebIntelligence)
from services.availability_checker import AvailabilityChecker
from services.model_config_manager import ModelConfigManager
from services.response_likelihood_scorer import ResponseLikelihoodScorer
from services.salary_estimator import SalaryEstimator
from services.skill_validator import SkillValidator
from services.web_search_wrapper import WebSearchWrapper

logger = get_logger(__name__)


class EnrichmentService:
    """Enhanced enrichment orchestrator with recruiter summaries."""
    
    def __init__(
        self,
        salary_estimator: SalaryEstimator,
        response_scorer: ResponseLikelihoodScorer,
        skill_validator: SkillValidator,
        availability_checker: AvailabilityChecker,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager,
        web_search: WebSearchWrapper
    ):
        self.salary = salary_estimator
        self.response = response_scorer
        self.skills = skill_validator
        self.availability = availability_checker
        self.db = mongodb
        self.redis = redis_cache
        self.model_manager = model_config_manager
        self.web_search = web_search
        
        logger.info("EnrichmentService initialized with full capabilities")
    
    async def enrich_candidates(
        self,
        session_id: str,
        candidates: List[Dict],
        enrichment_types: List[str] = None,
        username: Optional[str] = None
    ) -> List[EnrichedCandidate]:
        """
        Enrich multiple candidates with ALL data including recruiter summaries.
        """
        
        if enrichment_types is None:
            enrichment_types = [
                "salary", "response_likelihood", "skills", 
                "availability", "web_intelligence", "recruiter_summary"
            ]
        
        total = len(candidates)
        enriched_list = []
        
        # Initialize progress
        await self._update_progress(
            session_id, 0, total, "Starting enrichment..."
        )
        
        # Enrich each candidate
        for idx, candidate in enumerate(candidates, 1):
            try:
                # Extract candidate info safely
                candidate_dict = candidate.get("candidate", candidate)
                candidate_name = f"{candidate_dict.get('first_name', '')} {candidate_dict.get('last_name', '')}".strip()
                if not candidate_name:
                    candidate_name = "Unknown"
                
                logger.info(f"Enriching {idx}/{total}: {candidate_name}")
                
                await self._update_progress(
                    session_id, idx - 1, total,
                    f"Enriching {candidate_name}..."
                )
                
                enriched = await self._enrich_single_candidate(
                    candidate_dict, session_id, enrichment_types, username
                )
                enriched_list.append(enriched)
                
            except Exception as e:
                logger.error(f"Failed to enrich candidate {idx}: {e}", exc_info=True)
                # Add failed candidate
                enriched_list.append(self._create_failed_candidate(
                    candidate.get("candidate", candidate), str(e)
                ))
        
        # Mark complete
        await self._update_progress(
            session_id, total, total, "Enrichment complete!"
        )
        
        return enriched_list
    
    async def _enrich_single_candidate(
        self,
        candidate: Dict,
        session_id: str,
        enrichment_types: List[str],
        username: Optional[str]
    ) -> EnrichedCandidate:
        """Enrich a single candidate with all requested data."""
        
        # Create base enriched candidate
        candidate_id = str(candidate.get("_id", candidate.get("profile_id", "")))
        first_name = candidate.get("first_name", "")
        last_name = candidate.get("last_name", "")
        
        enriched = EnrichedCandidate(
            candidate_id=candidate_id,
            first_name=first_name,
            last_name=last_name,
            title=candidate.get("title", "Not specified"),
            company=candidate.get("current_company", "Not specified"),
            location=candidate.get("location", "Not specified"),
            linkedin_url=candidate.get("linkedin_url"),
            email=candidate.get("email"),
            phone=candidate.get("phone"),
            match_label=candidate.get("match_label", "Good Match"),
            match_reason=candidate.get("match_reason", "Matches search criteria"),
            match_score=candidate.get("match_score", 75),
            enrichment_status="in_progress"
        )
        
        try:
            # Run all enrichments in parallel
            tasks = []
            
            if "salary" in enrichment_types:
                tasks.append(("salary", self.salary.estimate_career_progression(candidate, session_id)))
            
            if "response_likelihood" in enrichment_types:
                tasks.append(("response", self.response.calculate_response_likelihood(candidate, session_id)))
            
            if "skills" in enrichment_types:
                tasks.append(("skills", self.skills.validate_skills(candidate, session_id)))
            
            if "availability" in enrichment_types:
                # ✅ FIX: Properly await the async method
                tasks.append(("availability", self.availability.check_availability(candidate)))
            
            if "web_intelligence" in enrichment_types:
                tasks.append(("web_intel", self._gather_web_intelligence(candidate, session_id)))
            
            # Execute all
            if tasks:
                task_names, task_coroutines = zip(*tasks)
                results = await asyncio.gather(*task_coroutines, return_exceptions=True)
                
                # Assign results
                for task_name, result in zip(task_names, results):
                    if isinstance(result, Exception):
                        logger.error(f"Failed {task_name}: {result}")
                    else:
                        if task_name == "salary":
                            enriched.salary_enrichment = result
                        elif task_name == "response":
                            enriched.response_likelihood = result
                        elif task_name == "skills":
                            enriched.skill_validation = result
                        elif task_name == "availability":
                            enriched.availability = result
                        elif task_name == "web_intel":
                            enriched.web_intelligence = result
            
            # Generate recruiter summary AFTER all enrichments
            if "recruiter_summary" in enrichment_types:
                enriched.recruiter_summary = await self._generate_recruiter_summary(
                    enriched, username
                )
            
            enriched.enrichment_status = "completed"
            enriched.enriched_at = datetime.utcnow().isoformat()
            
        except Exception as e:
            logger.error(f"Enrichment failed: {e}", exc_info=True)
            enriched.enrichment_status = "failed"
            enriched.enrichment_error = str(e)
        
        return enriched
    
    async def _gather_web_intelligence(
        self,
        candidate: Dict,
        session_id: str
    ) -> WebIntelligence:
        """Gather comprehensive web intelligence about candidate."""
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip()
        if not name:
            name = "Unknown"
        
        # Search for GitHub
        github_stats = None
        try:
            github_query = f"{name} site:github.com"
            github_result = await self.web_search.search(github_query, session_id)
            
            if github_result.get("sources"):
                github_url = next(
                    (s for s in github_result["sources"] if "github.com" in s),
                    None
                )
                if github_url:
                    github_stats = {
                        "profile_url": github_url,
                        "activity": "Found GitHub profile"
                    }
        except Exception as e:
            logger.error(f"GitHub search failed: {e}")
        
        # Search for press mentions
        press_mentions = []
        try:
            press_query = f"{name} interview OR featured OR award OR speaking"
            # ✅ FIX: Remove max_results parameter
            press_result = await self.web_search.search(press_query, session_id)
            
            for source in press_result.get("sources", [])[:3]:
                if not any(x in source for x in ["linkedin.com", "naukri.com", "indeed.com"]):
                    press_mentions.append({
                        "url": source,
                        "description": "Press mention or feature"
                    })
        except Exception as e:
            logger.error(f"Press search failed: {e}")
        
        # Detect risk flags
        risk_flags = []
        experience = candidate.get("experience", [])
        if len(experience) > 5:
            avg_tenure = sum(
                self._calculate_tenure(exp) for exp in experience
            ) / len(experience)
            if avg_tenure < 1.5:
                risk_flags.append("Frequent job changes (avg tenure < 1.5 years)")
        
        return WebIntelligence(
            github_stats=github_stats,
            online_presence=["LinkedIn"] + (["GitHub"] if github_stats else []),
            press_mentions=press_mentions,
            social_signals=[],
            risk_flags=risk_flags,
            last_updated=datetime.utcnow().isoformat()
        )
    
    def _calculate_tenure(self, exp: Dict) -> float:
        """Calculate tenure in years for an experience entry."""
        try:
            start = datetime.fromisoformat(exp.get("start_date", "").replace("Z", "+00:00"))
            end_str = exp.get("end_date")
            end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else datetime.now()
            return (end - start).days / 365
        except:
            return 1.0
    
    async def _generate_recruiter_summary(
        self,
        enriched: EnrichedCandidate,
        username: Optional[str]
    ) -> RecruiterSummary:
        """Generate AI-powered recruiter summary."""
        
        # Build context from all enrichment data
        context = self._build_context_for_summary(enriched)
        
        prompt = f"""You are an expert recruiter analyzing a candidate.

**Candidate Profile:**
{context}

Generate a recruiter-friendly summary with:

1. **Why Shortlist** (2-3 sentences): Key strengths and why they're a great fit
2. **Why Reject** (2-3 sentences): Any concerns or gaps
3. **Fit Summary** (for hiring manager, 2-3 sentences): Overall assessment
4. **Standout Achievements** (list 3-5 bullet points)
5. **Red Flags** (list any concerns, or empty array if none)
6. **Interesting Findings** (press mentions, certifications, unique experiences)
7. **Overall Recommendation**: "Strong Yes" | "Yes" | "Maybe" | "No"
8. **Confidence Level** (0-100): How confident you are in this assessment

Return as JSON:
```json
{{
"why_shortlist": "...",
"why_reject": "...",
"fit_summary": "...",
"standout_achievements": ["...", "..."],
"red_flags": [],
"interesting_findings": ["...", "..."],
"overall_recommendation": "Yes",
"confidence_level": 75
}} 
"""
        try:
            model_config = await self.model_manager.get_user_config(username)
            response = await self.model_manager.call_model(
                model_config=model_config,
                model_purpose="analysis",
                system_prompt="You are an expert recruiter providing concise, actionable summaries.",
                user_message=prompt,
                temperature=0.4,
                username=username
            )
            
            import json

            # Clean response if needed
            response_clean = response.strip()
            if response_clean.startswith("```json"):
                response_clean = response_clean[7:]
            if response_clean.endswith("```"):
                response_clean = response_clean[:-3]
            
            summary_data = json.loads(response_clean)
            return RecruiterSummary(**summary_data)
            
        except Exception as e:
            logger.error(f"Failed to generate recruiter summary: {e}", exc_info=True)
            return RecruiterSummary(
                why_shortlist="Strong technical background with relevant experience",
                why_reject="Limited public validation of some skills",
                fit_summary="Candidate shows promise but requires deeper evaluation",
                standout_achievements=["Relevant experience in similar roles"],
                red_flags=[],
                interesting_findings=[],
                overall_recommendation="Maybe",
                confidence_level=50
            )
    
    def _build_context_for_summary(self, enriched: EnrichedCandidate) -> str:
        """Build context string from enriched data."""
        
        parts = []
        parts.append(f"Name: {enriched.first_name} {enriched.last_name}")
        parts.append(f"Title: {enriched.title}")
        parts.append(f"Company: {enriched.company}")
        parts.append(f"Location: {enriched.location}")
        parts.append(f"Match Score: {enriched.match_score}/100 ({enriched.match_label})")
        
        if enriched.salary_enrichment:
            parts.append(f"\nSalary: ₹{enriched.salary_enrichment.current_estimated_ctc}L")
            parts.append(f"Growth: {enriched.salary_enrichment.average_annual_growth}")
        
        if enriched.skill_validation:
            parts.append(f"\nValidated Skills: {', '.join(enriched.skill_validation.validated_skills[:5])}")
        
        if enriched.response_likelihood:
            parts.append(f"\nResponse Likelihood: {enriched.response_likelihood.overall_score}/100 ({enriched.response_likelihood.likelihood_label})")
        
        # ✅ FIX: Check if availability is not a coroutine
        if enriched.availability and hasattr(enriched.availability, 'notice_period'):
            parts.append(f"\nNotice Period: {enriched.availability.notice_period}")
        
        if enriched.web_intelligence:
            if enriched.web_intelligence.press_mentions:
                parts.append(f"\nPress Mentions: {len(enriched.web_intelligence.press_mentions)} found")
            if enriched.web_intelligence.risk_flags:
                parts.append(f"\nRisk Flags: {', '.join(enriched.web_intelligence.risk_flags)}")
        
        return "\n".join(parts)
    
    def _create_failed_candidate(self, candidate: Dict, error: str) -> EnrichedCandidate:
        """Create enriched candidate object for failed enrichment."""
        return EnrichedCandidate(
            candidate_id=str(candidate.get("_id", candidate.get("profile_id", "unknown"))),
            first_name=candidate.get("first_name", ""),
            last_name=candidate.get("last_name", ""),
            title=candidate.get("title", ""),
            location=candidate.get("location", ""),
            match_label="Unknown",
            match_reason="Enrichment failed",
            match_score=0,
            enrichment_status="failed",
            enrichment_error=error
        )
    
    async def _update_progress(
        self,
        session_id: str,
        enriched_count: int,
        total: int,
        message: str
    ):
        """Update progress in Redis."""
        progress = {
            "status": "enriching" if enriched_count < total else "completed",
            "total_candidates": total,
            "enriched_count": enriched_count,
            "progress_percentage": int((enriched_count / total) * 100) if total > 0 else 0,
            "message": message,
            "current_candidate": message if enriched_count < total else None
        }
        
        await self.redis.store_session_data(
            session_id,
            "enrichment_progress",
            progress,
            expire_seconds=3600
        )