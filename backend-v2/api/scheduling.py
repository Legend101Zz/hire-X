
"""
Scheduling API
==============
Public API endpoints for candidate interview scheduling.

These endpoints are accessed by candidates via scheduling links in emails.
No authentication required - uses scheduling tokens.
"""

from typing import Optional

from core.dependencies import get_pipeline_service
from core.logging_config import get_logger
from fastapi import APIRouter, Depends, HTTPException, Query
from models.scheduling_models import RescheduleReason
from pydantic import BaseModel, Field
from services.pipeline_service import PipelineService

logger = get_logger(__name__)

router = APIRouter(prefix="/schedule", tags=["Scheduling"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class BookSlotRequest(BaseModel):
    """Request to book an interview slot."""
    scheduled_datetime: str = Field(..., description="Selected slot (ISO format)")
    timezone: str = Field("Asia/Kolkata", description="Candidate's timezone")
    preferred_time: Optional[str] = Field(None, description="morning/afternoon/evening")
    special_requirements: Optional[str] = Field(None, description="Any special needs")
    candidate_notes: Optional[str] = Field(None, description="Additional notes")


class RescheduleRequest(BaseModel):
    """Request to reschedule an interview."""
    new_datetime: str = Field(..., description="New slot (ISO format)")
    reason: RescheduleReason = Field(RescheduleReason.CANDIDATE_REQUEST)
    reason_details: Optional[str] = Field(None, description="Additional details")


# ============================================================================
# PUBLIC SCHEDULING ENDPOINTS
# ============================================================================

@router.get(
    "/{scheduling_token}",
    summary="Get Scheduling Info",
    description="Get available slots and candidate info for scheduling"
)
async def get_scheduling_info(
    scheduling_token: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Get scheduling page data when candidate clicks the link.
    
    This is the first endpoint called when a candidate opens
    the scheduling link from their email.
    
    No authentication required - uses scheduling token.
    """
    try:
        result = await pipeline_service.handle_scheduling_click(scheduling_token)
        
        if not result.get("valid"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Invalid scheduling link")
            )
        
        return {
            "success": True,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scheduling info failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load scheduling info")


@router.post(
    "/{scheduling_token}/book",
    summary="Book Interview Slot",
    description="Book an interview time slot"
)
async def book_interview_slot(
    scheduling_token: str,
    request: BookSlotRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Book an interview slot for the candidate.
    
    After booking:
    1. Creates InterviewSchedule record
    2. Updates candidate stage to SCHEDULED
    3. Sends confirmation email
    """
    try:
        result = await pipeline_service.book_interview(
            scheduling_token=scheduling_token,
            scheduled_datetime=request.scheduled_datetime,
            timezone=request.timezone,
            preferred_time=request.preferred_time,
            special_requirements=request.special_requirements,
            candidate_notes=request.candidate_notes
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Booking failed")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Booking failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to book interview")


@router.get(
    "/{scheduling_token}/slots",
    summary="Get Available Slots",
    description="Get available time slots for booking"
)
async def get_available_slots(
    scheduling_token: str,
    days_ahead: int = Query(14, ge=1, le=30, description="Days to look ahead"),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Get available time slots for a specific date range."""
    try:
        # First validate the token
        result = await pipeline_service.handle_scheduling_click(scheduling_token)
        
        if not result.get("valid"):
            raise HTTPException(status_code=400, detail="Invalid scheduling token")
        
        return {
            "success": True,
            "slots": result.get("available_slots", []),
            "timezone": result.get("timezone", "Asia/Kolkata")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get slots failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get available slots")


@router.post(
    "/{scheduling_token}/reschedule",
    summary="Reschedule Interview",
    description="Request to reschedule an existing interview"
)
async def reschedule_interview(
    scheduling_token: str,
    request: RescheduleRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Reschedule an existing interview.
    
    Updates the schedule and sends notification.
    """
    try:
        # Find schedule
        pipeline, candidate = await pipeline_service._find_by_scheduling_token(
            scheduling_token
        )
        
        if not pipeline or not candidate:
            raise HTTPException(status_code=400, detail="Invalid scheduling token")
        
        if not candidate.interview.scheduled_datetime:
            raise HTTPException(status_code=400, detail="No existing interview to reschedule")
        
        # Get schedule from database
        schedule_doc = await pipeline_service.schedules_collection.find_one({
            "scheduling_token": scheduling_token
        })
        
        if not schedule_doc:
            raise HTTPException(status_code=400, detail="Interview schedule not found")
        
        from models.scheduling_models import InterviewSchedule
        schedule = InterviewSchedule(**schedule_doc)
        
        # Reschedule
        schedule.reschedule(
            new_datetime=request.new_datetime,
            reason=request.reason,
            initiated_by="candidate",
            reason_details=request.reason_details
        )
        
        # Update database
        await pipeline_service.schedules_collection.update_one(
            {"schedule_id": schedule.schedule_id},
            {"$set": schedule.model_dump()}
        )
        
        # Update candidate
        candidate.interview.scheduled_datetime = request.new_datetime
        candidate.interview.reschedule_count += 1
        candidate.update_stage(CandidateStage.RESCHEDULING, triggered_by="candidate")
        
        pipeline.update_candidate(candidate)
        await pipeline_service._save_pipeline(pipeline)
        
        # TODO: Send reschedule notification email
        
        return {
            "success": True,
            "message": "Interview rescheduled",
            "old_datetime": schedule.reschedule_history[-1].original_datetime,
            "new_datetime": request.new_datetime
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reschedule failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reschedule")


@router.post(
    "/{scheduling_token}/cancel",
    summary="Cancel Interview",
    description="Cancel a scheduled interview"
)
async def cancel_interview(
    scheduling_token: str,
    reason: Optional[str] = None,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Cancel a scheduled interview."""
    try:
        pipeline, candidate = await pipeline_service._find_by_scheduling_token(
            scheduling_token
        )
        
        if not pipeline or not candidate:
            raise HTTPException(status_code=400, detail="Invalid scheduling token")
        
        # Update schedule status
        from models.scheduling_models import ScheduleStatus
        
        await pipeline_service.schedules_collection.update_one(
            {"scheduling_token": scheduling_token},
            {
                "$set": {
                    "status": ScheduleStatus.CANCELLED.value,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        # Update candidate
        candidate.interview.scheduled_datetime = None
        candidate.update_stage(
            CandidateStage.WITHDRAWN,
            triggered_by="candidate",
            notes=reason or "Candidate cancelled"
        )
        candidate.final_decision = "withdrawn"
        
        pipeline.update_candidate(candidate)
        await pipeline_service._save_pipeline(pipeline)
        
        return {
            "success": True,
            "message": "Interview cancelled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel")


# ============================================================================
# IMPORT FIX
# ============================================================================

from datetime import datetime

from models.pipeline_models import CandidateStage

# ============================================================================
# EXPORT
# ============================================================================

__all__ = ["router"]
