"""
Deep Dive API
=============
API endpoints for intelligent candidate enrichment.

Endpoints:
- POST /deep-dive/analyze - Full candidate analysis

Author: NeuraLeap Engineering
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.dependencies import get_current_username, get_deep_dive_service
from core.logging_config import get_logger
from services.intelligent_enrichment_orchestrator import \
    IntelligentEnrichmentOrchestrator

router = APIRouter(prefix="/deep-dive", tags=["Deep Dive"])
logger = get_logger(__name__)


# ==========================================================================
# REQUEST/RESPONSE MODELS
# ==========================================================================

class DeepDiveRequest(BaseModel):
    """Request for candidate deep dive."""
    linkedin_url: str = Field(..., description="LinkedIn profile URL")
    job_description: str = Field(..., min_length=50, description="Job description (min 50 chars)")
    force_scrape: bool = Field(False, description="Force fresh scrape, skip database")


class DeepDiveResponse(BaseModel):
    """Response wrapper for deep dive results."""
    success: bool
    data: dict
    message: str


# ==========================================================================
# ENDPOINTS
# ==========================================================================

@router.post("/analyze", response_model=DeepDiveResponse)
async def analyze_candidate(
    request: DeepDiveRequest,
    username: str = Depends(get_current_username),
    service: IntelligentEnrichmentOrchestrator = Depends(get_deep_dive_service)
):
    """
    Perform comprehensive candidate analysis.
    
    This endpoint:
    1. Analyzes the JD to create a role-specific enrichment plan
    2. Looks up candidate in DB or scrapes from LinkedIn
    3. Validates skills using web search
    4. Estimates salary timeline from experience
    5. Calculates response likelihood
    6. Estimates notice period
    7. Synthesizes match analysis
    
    Returns comprehensive enrichment data.
    
    **Data Sources (in priority order):**
    - MongoDB database (56M+ profiles)
    - Brightdata LinkedIn Dataset API
    - Brightdata Web Unlocker
    - Perplexity Web Search
    """
    logger.info(f"Deep dive request from {username}: {request.linkedin_url}")
    
    try:
        result = await service.deep_dive_candidate(
            linkedin_url=request.linkedin_url,
            job_description=request.job_description,
            force_scrape=request.force_scrape
        )
        
        return DeepDiveResponse(
            success=True,
            data=result.model_dump(),
            message=f"Analysis complete in {result.processing_time_seconds:.1f}s using {result.data_source}"
        )
        
    except ValueError as e:
        # Candidate not found
        raise HTTPException(status_code=404, detail=str(e))
        
    except Exception as e:
        logger.error(f"Deep dive failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check for deep dive service."""
    return {"status": "healthy", "service": "deep-dive"}