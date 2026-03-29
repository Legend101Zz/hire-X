# backend-v2/api/jobs.py
"""
Jobs API
========
API endpoints for managing and triggering background jobs.

Author: Hire-X Engineering
Version: 2.0
"""

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_current_user
from core.logging_config import get_logger
from jobs.pipeline_jobs import get_scheduler_status, trigger_job

logger = get_logger(__name__)
router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/status", summary="Get Scheduler Status")
async def get_jobs_status(
    current_user: dict = Depends(get_current_user)
):
    """Get background job scheduler status."""
    return get_scheduler_status()


@router.post("/trigger/{job_name}", summary="Trigger Job")
async def trigger_background_job(
    job_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger a background job.
    
    Available jobs:
    - check_due_interviews
    - send_outreach_reminders
    - mark_no_responses
    - send_interview_reminders
    - cleanup_expired
    - recalculate_stats
    """
    result = await trigger_job(job_name)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


__all__ = ["router"]