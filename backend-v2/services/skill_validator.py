"""
Skill Validator Service - Enhanced with Caching
================================================
Validates candidate skills through web search evidence with intelligent caching.

This service:
- Searches for evidence of skills (GitHub, StackOverflow, blogs, etc.)
- Different strategies for different role types (dev vs sales vs marketing)
- Returns validated skills with evidence links
- Calculates confidence scores
- CACHES results to avoid repeated expensive searches

Output: Skill validation with evidence!
"""

import asyncio
import hashlib
from typing import Dict, List, Optional

from core.logging_config import get_logger
from models.enrichment_models import SkillEvidence, SkillValidation
from services.model_config_manager import ModelConfigManager
from services.web_search_wrapper import WebSearchWrapper

logger = get_logger(__name__)


class SkillValidator:
    """
    Validates candidate skills through web search with intelligent caching.
    
    Different strategies for different roles:
    - Developers: GitHub, StackOverflow, tech blogs
    - Sales: LinkedIn posts, case studies, testimonials
    - Marketing: Published content, campaigns, thought leadership
    
    Caching Strategy:
    - Cache key: candidate_id + skills_hash
    - TTL: 7 days (skills don't change frequently)
    - Reduces expensive web searches
    """
    
    def __init__(
        self,
        web_search: WebSearchWrapper,
        redis_cache,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize skill validator.
        
        Args:
            web_search: Web search wrapper
            redis_cache: Redis cache for caching validation results
            model_config_manager: For getting configured models
        """
        self.web_search = web_search
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        logger.info("SkillValidator initialized with caching")
    
    async def validate_skills(
        self,
        candidate: Dict,
        session_id: Optional[str] = None
    ) -> SkillValidation:
        """
        Validate candidate's skills through web evidence with caching.
        
        Args:
            candidate: Candidate profile
            session_id: Optional session ID
            
        Returns:
            SkillValidation with evidence
        
        Example candidate dict:
            {
                "_id": "12345",
                "first_name": "John",
                "last_name": "Doe",
                "skills": ["Python", "React", "AWS", "Docker"],
                "current_role": "Senior Developer",
                "github_url": "https://github.com/johndoe",
                "linkedin_url": "https://linkedin.com/in/johndoe"
            }
        """
        
        skills = candidate.get("skills", [])
        
        if not skills:
            logger.warning(f"No skills listed for candidate {candidate.get('_id')}")
            return self._empty_result()
        
        # Check cache first
        cache_key = self._generate_cache_key(candidate)
        cached_result = await self.redis.get_cached_data(cache_key)
        
        if cached_result:
            logger.info(f"Using cached skill validation for candidate {candidate.get('_id')}")
            return SkillValidation(**cached_result)
        
        logger.info(f"Validating {len(skills)} skills for candidate {candidate.get('_id')}")
        
        # Determine role type for validation strategy
        current_role = candidate.get("current_role", "").lower()
        role_type = self._determine_role_type(current_role)
        
        # Validate skills based on role type
        if role_type == "developer":
            evidence = await self._validate_dev_skills(candidate, skills, session_id)
        elif role_type == "sales":
            evidence = await self._validate_sales_skills(candidate, skills, session_id)
        elif role_type == "marketing":
            evidence = await self._validate_marketing_skills(candidate, skills, session_id)
        else:
            evidence = await self._validate_general_skills(candidate, skills, session_id)
        
        # Categorize skills
        validated_skills = [e.skill for e in evidence]
        unvalidated_skills = [s for s in skills if s not in validated_skills]
        
        # Calculate overall confidence
        if len(skills) > 0:
            overall_confidence = int((len(validated_skills) / len(skills)) * 100)
        else:
            overall_confidence = 0
        
        result = SkillValidation(
            validated_skills=validated_skills,
            unvalidated_skills=unvalidated_skills,
            evidence=evidence,
            overall_confidence=overall_confidence,
            notes=self._generate_notes(role_type, len(validated_skills), len(skills))
        )
        
        # Cache result for 7 days (skills don't change frequently)
        await self.redis.cache_data(cache_key, result.dict(), ttl=604800)
        
        return result
    
    def _generate_cache_key(self, candidate: Dict) -> str:
        """
        Generate cache key based on candidate ID and skills.
        
        Args:
            candidate: Candidate dict
            
        Returns:
            Cache key string
        """
        candidate_id = str(candidate.get("_id", ""))
        skills = candidate.get("skills", [])
        
        # Create hash of skills (order-independent)
        skills_hash = hashlib.md5(
            "".join(sorted(skills)).encode()
        ).hexdigest()[:8]
        
        return f"skill_validation:{candidate_id}:{skills_hash}"
    
    def _determine_role_type(self, role: str) -> str:
        """Determine role type from title."""
        if any(keyword in role for keyword in ["developer", "engineer", "programmer", "devops", "sre", "architect"]):
            return "developer"
        elif any(keyword in role for keyword in ["sales", "account", "business development", "bd", "relationship"]):
            return "sales"
        elif any(keyword in role for keyword in ["marketing", "content", "seo", "social media", "growth", "brand"]):
            return "marketing"
        else:
            return "general"
    
    async def _validate_dev_skills(
        self,
        candidate: Dict,
        skills: List[str],
        session_id: Optional[str]
    ) -> List[SkillEvidence]:
        """
        Validate developer skills via GitHub, StackOverflow, etc.
        
        Strategy:
        1. GitHub repos (highest confidence)
        2. StackOverflow contributions
        3. Tech blog posts
        """
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}"
        github_url = candidate.get("github_url", "")
        
        evidence_list = []
        
        # Search for GitHub projects (prioritize top 5 technical skills)
        # Filter out soft skills
        technical_skills = [
            s for s in skills 
            if not any(soft in s.lower() for soft in ["leadership", "communication", "teamwork", "agile"])
        ][:5]
        
        # Process skills in parallel (batches of 3 to avoid rate limits)
        skill_batches = [technical_skills[i:i+3] for i in range(0, len(technical_skills), 3)]
        
        for batch in skill_batches:
            tasks = [
                self._validate_single_dev_skill(candidate, skill, session_id)
                for skill in batch
            ]
            
            batch_evidence = await asyncio.gather(*tasks, return_exceptions=True)
            
            for evidence in batch_evidence:
                if isinstance(evidence, SkillEvidence):
                    evidence_list.append(evidence)
                elif isinstance(evidence, Exception):
                    logger.error(f"Skill validation error: {evidence}")
            
            # Small delay between batches
            if len(skill_batches) > 1:
                await asyncio.sleep(0.5)
        
        return evidence_list
    
    async def _validate_single_dev_skill(
        self,
        candidate: Dict,
        skill: str,
        session_id: Optional[str]
    ) -> Optional[SkillEvidence]:
        """Validate a single developer skill."""
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}"
        github_url = candidate.get("github_url", "")
        
        # Try GitHub first (highest confidence)
        if github_url:
            github_username = github_url.split('github.com/')[-1].strip('/')
            search_query = f"site:github.com/{github_username} {skill} language OR project"
        else:
            search_query = f"{name} {skill} project site:github.com"
        
        try:
            result = await self.web_search.search(search_query, session_id=session_id, max_results=3)
            
            answer = result.get("answer", "")
            sources = result.get("sources", [])
            
            # Check if we found evidence
            if skill.lower() in answer.lower() and sources:
                # Find GitHub URLs
                github_sources = [s for s in sources if "github.com" in s]
                
                if github_sources:
                    return SkillEvidence(
                        skill=skill,
                        evidence_type="GitHub Repository",
                        url=github_sources[0],
                        description=self._extract_description(answer, skill),
                        confidence=9 if github_url else 7
                    )
        except Exception as e:
            logger.error(f"GitHub search failed for {skill}: {e}")
        
        # Try StackOverflow
        try:
            so_query = f"{name} {skill} site:stackoverflow.com"
            so_result = await self.web_search.search(so_query, session_id=session_id, max_results=2)
            so_sources = [s for s in so_result.get("sources", []) if "stackoverflow.com" in s]
            
            if so_sources:
                return SkillEvidence(
                    skill=skill,
                    evidence_type="StackOverflow",
                    url=so_sources[0],
                    description=f"Active on StackOverflow with {skill}-related contributions",
                    confidence=7
                )
        except Exception as e:
            logger.error(f"StackOverflow search failed for {skill}: {e}")
        
        # Try tech blog posts
        try:
            blog_query = f"{name} {skill} blog OR tutorial OR article"
            blog_result = await self.web_search.search(blog_query, session_id=session_id, max_results=2)
            blog_sources = blog_result.get("sources", [])
            
            # Filter out job boards and LinkedIn
            clean_sources = [
                s for s in blog_sources 
                if not any(domain in s for domain in ["linkedin.com", "indeed.com", "naukri.com"])
            ]
            
            if clean_sources:
                return SkillEvidence(
                    skill=skill,
                    evidence_type="Technical Blog",
                    url=clean_sources[0],
                    description=self._extract_description(blog_result.get("answer", ""), skill),
                    confidence=6
                )
        except Exception as e:
            logger.error(f"Blog search failed for {skill}: {e}")
        
        return None
    
    async def _validate_sales_skills(
        self,
        candidate: Dict,
        skills: List[str],
        session_id: Optional[str]
    ) -> List[SkillEvidence]:
        """
        Validate sales skills via LinkedIn posts, case studies, etc.
        """
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}"
        linkedin_url = candidate.get("linkedin_url", "")
        
        evidence_list = []
        
        # For sales, look for achievements and posts
        for skill in skills[:5]:  # Top 5 skills
            try:
                # Search for LinkedIn posts about the skill
                if linkedin_url:
                    search_query = f"site:linkedin.com {name} {skill} achievement OR success OR closed"
                else:
                    search_query = f"{name} {skill} sales achievement OR quota OR deal"
                
                result = await self.web_search.search(search_query, session_id=session_id, max_results=3)
                
                sources = result.get("sources", [])
                answer = result.get("answer", "")
                
                if sources and skill.lower() in answer.lower():
                    evidence_list.append(SkillEvidence(
                        skill=skill,
                        evidence_type="LinkedIn Post",
                        url=sources[0],
                        description=self._extract_description(answer, skill),
                        confidence=6
                    ))
                
                # Small delay to avoid rate limits
                await asyncio.sleep(0.3)
                
            except Exception as e:
                logger.error(f"Sales skill validation failed for {skill}: {e}")
        
        return evidence_list
    
    async def _validate_marketing_skills(
        self,
        candidate: Dict,
        skills: List[str],
        session_id: Optional[str]
    ) -> List[SkillEvidence]:
        """
        Validate marketing skills via published content, campaigns, etc.
        """
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}"
        
        evidence_list = []
        
        # For marketing, look for published content
        for skill in skills[:5]:
            try:
                search_query = f"{name} {skill} marketing campaign OR article OR content OR case study"
                
                result = await self.web_search.search(search_query, session_id=session_id, max_results=3)
                
                sources = result.get("sources", [])
                answer = result.get("answer", "")
                
                if sources and skill.lower() in answer.lower():
                    evidence_list.append(SkillEvidence(
                        skill=skill,
                        evidence_type="Published Content",
                        url=sources[0],
                        description=self._extract_description(answer, skill),
                        confidence=6
                    ))
                
                # Small delay to avoid rate limits
                await asyncio.sleep(0.3)
                
            except Exception as e:
                logger.error(f"Marketing skill validation failed for {skill}: {e}")
        
        return evidence_list
    
    async def _validate_general_skills(
        self,
        candidate: Dict,
        skills: List[str],
        session_id: Optional[str]
    ) -> List[SkillEvidence]:
        """
        Validate skills for general roles via LinkedIn, blog posts, etc.
        """
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}"
        linkedin_url = candidate.get("linkedin_url", "")
        
        evidence_list = []
        
        # Generic search for evidence
        for skill in skills[:5]:
            try:
                if linkedin_url:
                    search_query = f"site:linkedin.com {name} {skill}"
                else:
                    search_query = f"{name} {skill} professional experience OR expertise"
                
                result = await self.web_search.search(search_query, session_id=session_id, max_results=2)
                
                sources = result.get("sources", [])
                answer = result.get("answer", "")
                
                if sources and skill.lower() in answer.lower():
                    evidence_list.append(SkillEvidence(
                        skill=skill,
                        evidence_type="LinkedIn",
                        url=sources[0],
                        description=f"Listed and referenced in professional profile",
                        confidence=5
                    ))
                
                # Small delay to avoid rate limits
                await asyncio.sleep(0.3)
                
            except Exception as e:
                logger.error(f"General skill validation failed for {skill}: {e}")
        
        return evidence_list
    
    def _extract_description(self, answer: str, skill: str) -> str:
        """
        Extract a brief description about the skill from search answer.
        """
        
        # Find sentences mentioning the skill
        sentences = answer.split(".")
        relevant = [s.strip() for s in sentences if skill.lower() in s.lower()]
        
        if relevant:
            # Return first relevant sentence, truncated if too long
            desc = relevant[0]
            if len(desc) > 100:
                desc = desc[:97] + "..."
            return desc
        
        return f"Evidence of {skill} usage found"
    
    def _generate_notes(self, role_type: str, validated: int, total: int) -> str:
        """Generate summary notes."""
        
        if validated == 0:
            return f"No public evidence found for skills. This is common for {role_type} roles where work is private/proprietary."
        
        percentage = int((validated / total) * 100)
        
        if percentage >= 80:
            return f"✅ Strong evidence found for {validated}/{total} skills ({percentage}%). High confidence in skill claims."
        elif percentage >= 50:
            return f"🟡 Moderate evidence for {validated}/{total} skills ({percentage}%). Some skills have public validation."
        else:
            return f"⚠️ Limited evidence for {validated}/{total} skills ({percentage}%). Most work may be private or not publicly documented."
    
    def _empty_result(self) -> SkillValidation:
        """Return empty result."""
        return SkillValidation(
            validated_skills=[],
            unvalidated_skills=[],
            evidence=[],
            overall_confidence=0,
            notes="No skills listed to validate"
        )