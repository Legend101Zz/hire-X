"""
Sample Profile Generator V3 - CrewAI Integration
=================================================
Uses intelligent multi-agent system for candidate discovery.
"""

from typing import Any, Dict, List

from core.logging_config import get_logger
from services.intelligent_search_crew import IntelligentSearchCrew

logger = get_logger(__name__)


class SampleProfileGeneratorV3:
    """
    V3 sample generator using CrewAI for intelligent search.
    """
    
    def __init__(
        self,
        profiles_collection,
        openrouter_api_key: str,
        model_name: str = "anthropic/claude-4.5-sonnet"
    ):
        """Initialize V3 generator."""
        self.profiles = profiles_collection
        
        # Initialize the intelligent search crew
        self.search_crew = IntelligentSearchCrew(
            profiles_collection=profiles_collection,
            openrouter_api_key=openrouter_api_key,
            model_name=model_name
        )
        
        logger.info("✅ SampleProfileGeneratorV3 initialized with CrewAI")
    
    async def generate_samples(
        self,
        ideal_profile: Dict[str, Any],
        count: int = 5
    ) -> Dict[str, Any]:
        """
        Generate sample candidates using intelligent multi-agent system.
        
        Args:
            ideal_profile: Parsed JD requirements
            count: Number of samples to generate
            
        Returns:
            Dict with candidates and search metadata
        """
        logger.info(f"🚀 Generating {count} samples using CrewAI agents...")
        
        # Execute intelligent search
        result = self.search_crew.search(
            ideal_profile=ideal_profile,
            target_count=count
        )
        
        if result["success"]:
            logger.info(
                f"✅ Found {len(result['candidates'])} candidates in "
                f"{result['iterations']} iterations"
            )
        else:
            logger.error(f"❌ Search failed: {result.get('error')}")
        
        return result
    
    async def refine_search(
        self,
        ideal_profile: Dict[str, Any],
        user_feedback: str,
        previous_query: Dict[str, Any],
        count: int = 5
    ) -> Dict[str, Any]:
        """
        Refine search based on user feedback.
        
        This re-runs the crew with updated context about what the user wants.
        """
        logger.info(f"🔄 Refining search based on feedback: {user_feedback}")
        
        # Add user feedback to ideal profile
        ideal_profile["user_feedback"] = user_feedback
        ideal_profile["previous_query"] = previous_query
        
        # Re-run the search with feedback context
        result = self.search_crew.search(
            ideal_profile=ideal_profile,
            target_count=count
        )
        
        return result