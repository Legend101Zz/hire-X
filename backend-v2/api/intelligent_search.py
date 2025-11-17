"""
Intelligent Search API
======================
CrewAI-powered search endpoints.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.dependencies import get_current_username, get_sample_generator_v3
from core.logging_config import get_logger
from services.sample_profile_generator_v3 import SampleProfileGeneratorV3

router = APIRouter(prefix="/intelligent-search", tags=["Intelligent Search"])
logger = get_logger(__name__)


class IntelligentSearchRequest(BaseModel):
    """Request to generate samples using CrewAI."""
    ideal_profile: Dict[str, Any] = Field(..., description="Parsed JD requirements")
    count: int = Field(5, description="Number of samples", ge=1, le=20)


class RefineSearchRequest(BaseModel):
    """Request to refine search based on feedback."""
    ideal_profile: Dict[str, Any]
    user_feedback: str = Field(..., description="User's feedback on previous results")
    previous_query: Dict[str, Any]
    count: int = Field(5, ge=1, le=20)


@router.post("/generate-samples")
async def generate_samples(
    request: IntelligentSearchRequest,
    generator: SampleProfileGeneratorV3 = Depends(get_sample_generator_v3),
    username: str = Depends(get_current_username)
):
    """
    Generate sample candidates using CrewAI intelligent search.
    
    This uses a multi-agent system to:
    1. Analyze JD requirements deeply
    2. Build optimal MongoDB queries
    3. Validate and iterate on results
    """
    try:
        logger.info(f"User {username} requesting intelligent search")
        
        result = await generator.generate_samples(
            ideal_profile=request.ideal_profile,
            count=request.count
        )
        
        return {
            "success": result["success"],
            "candidates": result["candidates"],
            "metadata": {
                "iterations": result.get("iterations", 0),
                "final_query": result.get("final_query", {}),
                "crew_output": result.get("crew_output", "")
            }
        }
        
    except Exception as e:
        logger.error(f"Intelligent search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refine-search")
async def refine_search(
    request: RefineSearchRequest,
    generator: SampleProfileGeneratorV3 = Depends(get_sample_generator_v3),
    username: str = Depends(get_current_username)
):
    """
    Refine search based on user feedback.
    
    The agents will analyze the feedback and adjust the query strategy.
    """
    try:
        logger.info(f"User {username} refining search with feedback")
        
        result = await generator.refine_search(
            ideal_profile=request.ideal_profile,
            user_feedback=request.user_feedback,
            previous_query=request.previous_query,
            count=request.count
        )
        
        return {
            "success": result["success"],
            "candidates": result["candidates"],
            "metadata": {
                "iterations": result.get("iterations", 0),
                "final_query": result.get("final_query", {}),
                "refinement_applied": True
            }
        }
        
    except Exception as e:
        logger.error(f"Search refinement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))