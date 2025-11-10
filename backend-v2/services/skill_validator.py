"""
Skill Validator Service
=======================
Validates candidate skills through web search evidence.

This service:
- Searches for evidence of skills (GitHub, StackOverflow, blogs, etc.)
- Different strategies for different role types (dev vs sales vs marketing)
- Returns validated skills with evidence links
- Calculates confidence scores

Output: Skill validation with evidence!
"""

import asyncio
from typing import Dict, List, Optional

from core.logging_config import get_logger
from models.enrichment_models import SkillEvidence, SkillValidation
from services.model_config_manager import ModelConfigManager
from services.web_search_wrapper import WebSearchWrapper

logger = get_logger(__name__)


class SkillValidator:
    """
    Validates candidate skills through web search.
    
    Different strategies for different roles:
    - Developers: GitHub, StackOverflow, tech blogs
    - Sales: LinkedIn posts, case studies, testimonials
    - Marketing: Published content, campaigns, thought leadership
    """
    
    def __init__(
        self,
        web_search: WebSearchWrapper,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize skill validator.
        
        Args:
            web_search: Web search wrapper
            model_config_manager: For getting configured models
        """
        self.web_search = web_search
        self.model_manager = model_config_manager
        
        logger.info("SkillValidator initialized")
    
    async def validate_skills(
        self,
        candidate: Dict,
        session_id: Optional[str] = None
    ) -> SkillValidation:
        """
        Validate candidate's skills through web evidence.
        
        Args:
            candidate: Candidate profile
            session_id: Optional session ID
            
        Returns:
            SkillValidation with evidence
        
        Example candidate dict:
            {
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
        
        return SkillValidation(
            validated_skills=validated_skills,
            unvalidated_skills=unvalidated_skills,
            evidence=evidence,
            overall_confidence=overall_confidence,
            notes=self._generate_notes(role_type, len(validated_skills), len(skills))
        )
    
    def _determine_role_type(self, role: str) -> str:
        """Determine role type from title."""
        if any(keyword in role for keyword in ["developer", "engineer", "programmer", "devops", "sre"]):
            return "developer"
        elif any(keyword in role for keyword in ["sales", "account", "business development", "bd"]):
            return "sales"
        elif any(keyword in role for keyword in ["marketing", "content", "seo", "social media", "growth"]):
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
        """
        
        name = f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}"
        github_url = candidate.get("github_url", "")
        
        evidence_list = []
        
        # Search for GitHub projects (prioritize top 5 skills)
        priority_skills = skills[:5]
        
        for skill in priority_skills:
            # Search for GitHub projects
            if github_url:
                search_query = f"site:github.com {github_url.split('github.com/')[-1]} {skill} project"
            else:
                search_query = f"{name} {skill} project GitHub"
            
            result = await self.web_search.search(search_query, session_id=session_id)
            
            # Parse result for evidence
            answer = result.get("answer", "")
            sources = result.get("sources", [])
            
            # Check if we found evidence
            if skill.lower() in answer.lower() and sources:
                # Find GitHub URLs
                github_sources = [s for s in sources if "github.com" in s]
                
                if github_sources:
                    evidence_list.append(SkillEvidence(
                        skill=skill,
                        evidence_type="GitHub",
                        url=github_sources[0],
                        description=self._extract_description(answer, skill),
                        confidence=8 if github_url else 6
                    ))
                    continue
            
            # Try StackOverflow
            so_query = f"{name} {skill} site:stackoverflow.com"
            so_result = await self.web_search.search(so_query, session_id=session_id)
            so_sources = [s for s in so_result.get("sources", []) if "stackoverflow.com" in s]
            
            if so_sources:
                evidence_list.append(SkillEvidence(
                    skill=skill,
                    evidence_type="StackOverflow",
                    url=so_sources[0],
                    description=f"Active on StackOverflow for {skill}",
                    confidence=7
                ))
        
        return evidence_list
    
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
            # Search for LinkedIn posts about the skill
            if linkedin_url:
                search_query = f"site:linkedin.com {name} {skill}"
            else:
                search_query = f"{name} {skill} sales achievement"
            
            result = await self.web_search.search(search_query, session_id=session_id)
            
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
            search_query = f"{name} {skill} marketing campaign OR article OR content"
            
            result = await self.web_search.search(search_query, session_id=session_id)
            
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
            if linkedin_url:
                search_query = f"site:linkedin.com {name} {skill}"
            else:
                search_query = f"{name} {skill} professional experience"
            
            result = await self.web_search.search(search_query, session_id=session_id)
            
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
            return f"Strong evidence found for {validated}/{total} skills ({percentage}%). High confidence in skill claims."
        elif percentage >= 50:
            return f"Moderate evidence for {validated}/{total} skills ({percentage}%). Some skills have public validation."
        else:
            return f"Limited evidence for {validated}/{total} skills ({percentage}%). Most work may be private or not publicly documented."
    
    def _empty_result(self) -> SkillValidation:
        """Return empty result."""
        return SkillValidation(
            validated_skills=[],
            unvalidated_skills=[],
            evidence=[],
            overall_confidence=0,
            notes="No skills listed to validate"
        )