
"""
Scheduling API
==============
Public API endpoints for candidate interview scheduling.

These endpoints are accessed by candidates via scheduling links in emails.
No authentication required - uses scheduling tokens.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.params import Body
from pydantic import BaseModel, Field

from core.dependencies import get_pipeline_service, get_scheduler
from core.logging_config import get_logger
from models.scheduling_models import RescheduleReason
from services.pipeline_service import PipelineService
from services.scheduler import BackgroundScheduler

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
    phone_number: Optional[str] = None

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
    test_mode: bool = Query(False, description="Enable test mode with immediate slots"),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Get scheduling page data when candidate clicks the link.
    """
    try:
        logger.info(f"📅 Scheduling info request: token={scheduling_token}, test_mode={test_mode}")
        
        result = await pipeline_service.handle_scheduling_click(
            scheduling_token,
            test_mode=test_mode  # PASS TEST MODE HERE
        )
        
        if not result.get("valid"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Invalid scheduling link")
            )
        
        logger.info(f"   ✅ Found {len(result.get('available_slots', []))} available slots")
        
        return {
            "success": True,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Scheduling info failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to load scheduling info: {str(e)}")


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
            candidate_notes=request.candidate_notes,
            phone_number=request.phone_number  
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
        logger.error(f"Booking failed: {e}", exc_info=True)
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

@router.get(
    "/admin/scheduler-status",
    summary="Get Scheduler Status",
    description="Get current status of background scheduler"
)
async def get_scheduler_status(
    scheduler: BackgroundScheduler = Depends(get_scheduler)  # ✅ Use dependency
):
    """Get scheduler status and job information."""
    return {
        "success": True,
        **scheduler.get_status()
    }


@router.post(
    "/admin/trigger-now",
    summary="Manual Interview Trigger (Testing)",
    description="Manually trigger interview check - for testing only"
)
async def manual_trigger_interviews(
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Manually trigger the interview scheduling check."""
    try:
        result = await pipeline_service.trigger_scheduled_interviews()
        return {
            "success": True,
            "triggered": result.get("triggered", 0),
            "message": "Interview trigger completed"
        }
    except Exception as e:
        logger.error(f"Manual trigger failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/admin/pending-interviews",
    summary="Get Pending Interviews",
    description="Get all interviews that are scheduled but not yet triggered"
)
async def get_pending_interviews(
    include_past: bool = Query(True, description="Include past scheduled interviews"),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Get all pending interviews (scheduled but not triggered).
    Useful for finding missed interviews.
    """
    try:
        from datetime import datetime
        from datetime import timezone as dt_timezone

        from models.scheduling_models import ScheduleStatus

        # Find all confirmed schedules without interview_session_id
        query = {
            "status": ScheduleStatus.CONFIRMED.value,
            "interview_session_id": None
        }
        
        cursor = pipeline_service.schedules_collection.find(query)
        schedules = await cursor.to_list(length=100)
        
        now = datetime.now(dt_timezone.utc)
        pending = []
        past_due = []
        upcoming = []
        
        for schedule_doc in schedules:
            scheduled_str = schedule_doc.get("scheduled_datetime")
            if not scheduled_str:
                continue
            
            try:
                scheduled_dt = datetime.fromisoformat(scheduled_str.replace('Z', '+00:00'))
                
                schedule_info = {
                    "schedule_id": schedule_doc.get("schedule_id"),
                    "pipeline_id": schedule_doc.get("pipeline_id"),
                    "candidate_name": schedule_doc.get("candidate_name"),
                    "candidate_phone": schedule_doc.get("candidate_phone"),
                    "scheduled_datetime": scheduled_str,
                    "timezone": schedule_doc.get("timezone"),
                    "time_diff_minutes": int((scheduled_dt - now).total_seconds() / 60),
                    "is_past": scheduled_dt < now
                }
                
                if scheduled_dt < now:
                    past_due.append(schedule_info)
                else:
                    upcoming.append(schedule_info)
                    
                pending.append(schedule_info)
                
            except Exception as e:
                logger.error(f"Error parsing schedule {schedule_doc.get('schedule_id')}: {e}")
        
        return {
            "success": True,
            "total_pending": len(pending),
            "past_due": len(past_due),
            "upcoming": len(upcoming),
            "schedules": {
                "past_due": past_due,
                "upcoming": upcoming,
                "all": pending if include_past else upcoming
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get pending interviews: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/admin/trigger-interview/{schedule_id}",
    summary="Trigger Specific Interview",
    description="Manually trigger a specific interview by schedule ID"
)
async def trigger_specific_interview(
    schedule_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Trigger a specific interview immediately.
    Useful for retrying failed triggers or triggering past-due interviews.
    """
    try:
        # Find the schedule
        schedule_doc = await pipeline_service.schedules_collection.find_one({
            "schedule_id": schedule_id
        })
        
        if not schedule_doc:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Check if already triggered
        if schedule_doc.get("interview_session_id"):
            return {
                "success": False,
                "message": "Interview already triggered",
                "interview_session_id": schedule_doc.get("interview_session_id")
            }
        
        # Trigger the interview
        logger.info(f"🎯 Manually triggering interview: {schedule_id}")
        await pipeline_service._trigger_single_interview(schedule_doc)
        
        return {
            "success": True,
            "message": f"Interview triggered for {schedule_doc.get('candidate_name')}",
            "schedule_id": schedule_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger interview {schedule_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/admin/trigger-all-pending",
    summary="Trigger All Pending Interviews",
    description="Trigger all pending interviews (including past-due)"
)
async def trigger_all_pending_interviews(
    include_past: bool = Query(True, description="Include past-due interviews"),
    max_count: int = Query(10, ge=1, le=50, description="Max interviews to trigger"),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Trigger all pending interviews.
    BE CAREFUL: This will call all candidates immediately.
    """
    try:
        from datetime import datetime
        from datetime import timezone as dt_timezone

        from models.scheduling_models import ScheduleStatus

        # Find pending schedules
        query = {
            "status": ScheduleStatus.CONFIRMED.value,
            "interview_session_id": None
        }
        
        cursor = pipeline_service.schedules_collection.find(query).limit(max_count)
        schedules = await cursor.to_list(length=max_count)
        
        now = datetime.now(dt_timezone.utc)
        triggered = []
        skipped = []
        errors = []
        
        for schedule_doc in schedules:
            schedule_id = schedule_doc.get("schedule_id")
            candidate_name = schedule_doc.get("candidate_name")
            scheduled_str = schedule_doc.get("scheduled_datetime")
            
            try:
                # Check if past
                if scheduled_str:
                    scheduled_dt = datetime.fromisoformat(scheduled_str.replace('Z', '+00:00'))
                    is_past = scheduled_dt < now
                    
                    if is_past and not include_past:
                        skipped.append({
                            "schedule_id": schedule_id,
                            "candidate_name": candidate_name,
                            "reason": "Past-due (not included)"
                        })
                        continue
                
                # Trigger
                logger.info(f"🎯 Triggering interview: {candidate_name}")
                await pipeline_service._trigger_single_interview(schedule_doc)
                
                triggered.append({
                    "schedule_id": schedule_id,
                    "candidate_name": candidate_name,
                    "scheduled_datetime": scheduled_str
                })
                
                # Rate limiting between calls
                import asyncio
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Failed to trigger {schedule_id}: {e}")
                errors.append({
                    "schedule_id": schedule_id,
                    "candidate_name": candidate_name,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "triggered": len(triggered),
            "skipped": len(skipped),
            "errors": len(errors),
            "details": {
                "triggered": triggered,
                "skipped": skipped,
                "errors": errors
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger pending interviews: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/admin/clear-stale-schedules",
    summary="Clear Stale Schedules",
    description="Mark old past-due schedules as expired"
)
async def clear_stale_schedules(
    hours_old: int = Query(24, ge=1, description="Mark schedules older than X hours as expired"),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Clean up old schedules that are past-due and will never be triggered.
    Marks them as EXPIRED instead of CONFIRMED.
    """
    try:
        from datetime import datetime, timedelta
        from datetime import timezone as dt_timezone

        from models.scheduling_models import ScheduleStatus
        
        cutoff = datetime.now(dt_timezone.utc) - timedelta(hours=hours_old)
        cutoff_str = cutoff.isoformat()
        
        # Find old confirmed schedules
        result = await pipeline_service.schedules_collection.update_many(
            {
                "status": ScheduleStatus.CONFIRMED.value,
                "scheduled_datetime": {"$lt": cutoff_str},
                "interview_session_id": None
            },
            {
                "$set": {
                    "status": ScheduleStatus.EXPIRED.value,
                    "updated_at": datetime.now(dt_timezone.utc).isoformat(),
                    "expired_reason": f"Past-due by {hours_old}+ hours"
                }
            }
        )
        
        return {
            "success": True,
            "marked_expired": result.modified_count,
            "cutoff_datetime": cutoff_str
        }
        
    except Exception as e:
        logger.error(f"Failed to clear stale schedules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/admin/update-phone/{schedule_id}",
    summary="Update Phone Number",
    description="Update candidate phone number and retry interview"
)
async def update_phone_and_retry(
    schedule_id: str,
    phone_number: str = Body(..., embed=True, description="Phone in E.164 format (e.g., +918580732070)"),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Update phone number for a scheduled interview and optionally retry.
    
    Phone must be in E.164 format: +[country_code][number]
    Examples:
    - India: +918580732070
    - US: +14155552671
    """
    try:
        from datetime import timezone as dt_timezone

        from models.scheduling_models import ScheduleStatus

        # Validate E.164 format
        if not phone_number.startswith('+'):
            raise HTTPException(
                status_code=400,
                detail="Phone must start with + and country code (E.164 format)"
            )
        
        if not phone_number[1:].isdigit():
            raise HTTPException(
                status_code=400,
                detail="Phone must contain only digits after the +"
            )
        
        # Find the schedule
        schedule_doc = await pipeline_service.schedules_collection.find_one({
            "schedule_id": schedule_id
        })
        
        if not schedule_doc:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Get pipeline and candidate
        pipeline = await pipeline_service.get_pipeline(schedule_doc["pipeline_id"])
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        candidate = pipeline.get_candidate(schedule_doc["candidate_id"])
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Update phone in schedule
        await pipeline_service.schedules_collection.update_one(
            {"schedule_id": schedule_id},
            {
                "$set": {
                    "candidate_phone": phone_number,
                    "updated_at": datetime.now(dt_timezone.utc).isoformat()
                }
            }
        )
        
        # Update phone in candidate
        from models.pipeline_models import ContactFetchSource
        candidate.contact.phone = phone_number
        candidate.contact.phone_source = ContactFetchSource.MANUAL_INPUT
        candidate.contact.phone_fetched_at = datetime.now(dt_timezone.utc).isoformat()
        
        pipeline.update_candidate(candidate)
        await pipeline_service._save_pipeline(pipeline)
        
        logger.info(f"📞 Updated phone for {candidate.display_name}: {phone_number}")
        
        return {
            "success": True,
            "message": "Phone number updated successfully",
            "schedule_id": schedule_id,
            "candidate_name": schedule_doc["candidate_name"],
            "new_phone": phone_number,
            "can_retry": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update phone: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/admin/retry-interview/{schedule_id}",
    summary="Retry Failed Interview",
    description="Retry triggering an interview that failed"
)
async def retry_interview(
    schedule_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Retry triggering an interview.
    Use this after fixing issues like phone number format.
    """
    try:
        from datetime import timezone as dt_timezone

        from models.scheduling_models import ScheduleStatus

        # Find the schedule
        schedule_doc = await pipeline_service.schedules_collection.find_one({
            "schedule_id": schedule_id
        })
        
        if not schedule_doc:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Reset status if it was failed
        if schedule_doc.get("status") in [
            ScheduleStatus.TECHNICAL_ISSUE.value,
            ScheduleStatus.IN_PROGRESS.value
        ]:
            await pipeline_service.schedules_collection.update_one(
                {"schedule_id": schedule_id},
                {
                    "$set": {
                        "status": ScheduleStatus.CONFIRMED.value,
                        "interview_session_id": None,
                        "call_initiated_at": None,
                        "updated_at": datetime.now(dt_timezone.utc).isoformat()
                    }
                }
            )
            
            # Refresh the schedule doc
            schedule_doc = await pipeline_service.schedules_collection.find_one({
                "schedule_id": schedule_id
            })
        
        # Trigger the interview
        logger.info(f"🔄 Retrying interview: {schedule_id}")
        await pipeline_service._trigger_single_interview(schedule_doc)
        
        return {
            "success": True,
            "message": f"Interview retry initiated for {schedule_doc.get('candidate_name')}",
            "schedule_id": schedule_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retry interview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
# ============================================================================
# IMPORT FIX
# ============================================================================

from datetime import datetime

from models.pipeline_models import CandidateStage

# ============================================================================
# EXPORT
# ============================================================================

__all__ = ["router"]
