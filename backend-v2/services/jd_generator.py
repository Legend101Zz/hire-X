"""
JD Generator Service
===================
Generates and refines job descriptions from search queries.
"""

from typing import Tuple

from core.logging_config import get_logger
from services.model_config_manager import ModelConfigManager

logger = get_logger(__name__)


class JDGeneratorService:
    """Generates JDs from search queries and refines based on feedback."""
    
    MAX_RETRIES = 2
    
    def __init__(self, model_config_manager: ModelConfigManager):
        self.model_config = model_config_manager
    
    async def generate_jd(
        self,
        search_query: str,
        username: str
    ) -> str:
        """
        Generate a job description from search query.
        
        Args:
            search_query: User's search query
            username: Username for model config
        
        Returns:
            Generated JD text
        """
        
        system_prompt = """You are an expert recruiter and JD writer. 
Generate a comprehensive, professional job description based on the user's search query.

Include:
- Role Title
- Key Responsibilities (5-7 bullets)
- Must-Have Skills (technical + soft skills)
- Nice-to-Have Skills
- Experience Level / Seniority
- Qualifications
- Industry preferences (if mentioned)

Keep it concise, professional, and ATS-friendly.
Format as plain text with clear sections."""

        user_prompt = f"""Generate a job description for this search query:

"{search_query}"

Provide a complete, professional JD."""
        
        model_config = await self.model_config.get_user_config(username)
        
        jd_text = await self.model_config.call_model(
            model_config=model_config,
            model_purpose="extraction",
            system_prompt=system_prompt,
            user_message=user_prompt,
            temperature=0.7,
            username=username
        )
        
        logger.info(f"Generated JD for query: {search_query[:50]}...")
        return jd_text.strip()
    
    async def refine_jd(
        self,
        original_query: str,
        previous_jd: str,
        feedback: str,
        retry_count: int,
        username: str
    ) -> Tuple[str, bool]:
        """
        Refine JD based on user feedback.
        
        Args:
            original_query: Original search query
            previous_jd: Previous JD version
            feedback: User's feedback on what's wrong
            retry_count: Current retry count
            username: Username for model config
        
        Returns:
            Tuple of (refined_jd, max_retries_reached)
        """
        
        if retry_count >= self.MAX_RETRIES:
            logger.warning(f"Max retries reached for JD refinement")
            return previous_jd, True
        
        system_prompt = """You are an expert recruiter refining a job description.
The user has provided feedback on what's not good about the current JD.

Your task:
1. Understand their feedback
2. Refine the JD to address their concerns
3. Keep the good parts, improve the problematic parts
4. Maintain professional tone and structure

Return ONLY the refined JD, no explanations."""

        user_prompt = f"""Original Search Query:
"{original_query}"

Previous Job Description:
{previous_jd}

User Feedback (what's not good):
"{feedback}"

Refine the JD to address their concerns. Return the improved version."""
        
        model_config = await self.model_config.get_user_config(username)
        
        refined_jd = await self.model_config.call_model(
            model_config=model_config,
            model_purpose="extraction",
            system_prompt=system_prompt,
            user_message=user_prompt,
            temperature=0.7,
            username=username
        )
        
        logger.info(f"Refined JD (attempt {retry_count + 1}/{self.MAX_RETRIES})")
        
        max_reached = (retry_count + 1) >= self.MAX_RETRIES
        return refined_jd.strip(), max_reached