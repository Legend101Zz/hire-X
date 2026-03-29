
"""
Webhook Handlers
================
Handle incoming webhooks from external services.

Supported Webhooks:
1. SendGrid - Email tracking (opens, clicks, bounces)
2. Vapi - Interview call events
3. Stripe - Payment events (future)

Security:
- SendGrid webhooks are verified via signature
- Vapi webhooks use API key authentication
- All webhooks are logged for debugging

How Webhooks Work:
------------------
1. External service (SendGrid/Vapi) sends POST request to our endpoint
2. We verify the request authenticity
3. We process the event and update our database
4. We return 200 OK to acknowledge receipt

Setting Up SendGrid Webhooks:
-----------------------------
1. Go to SendGrid Dashboard → Settings → Mail Settings → Event Webhook
2. Set HTTP POST URL: https://Hire-X.shop/api/v1/webhooks/email/sendgrid
3. Select events: Delivered, Opened, Clicked, Bounced, Spam Report
4. Enable the webhook

Author: Hire-X Engineering
Version: 2.0
"""

import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, Header,
                     HTTPException, Request)
from pydantic import BaseModel

from core.config import settings
from core.dependencies import get_pipeline_service
from core.logging_config import get_logger
from models.pipeline_models import CandidateStage, get_current_timestamp
from models.scheduling_models import ScheduleStatus
from services.pipeline_service import PipelineService

logger = get_logger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


# ============================================================================
# SENDGRID EMAIL WEBHOOKS
# ============================================================================

class SendGridEvent(BaseModel):
    """SendGrid webhook event structure."""
    email: str
    timestamp: int
    event: str  # delivered, open, click, bounce, spamreport, etc.
    sg_message_id: Optional[str] = None
    sg_event_id: Optional[str] = None
    url: Optional[str] = None  # For click events
    ip: Optional[str] = None
    useragent: Optional[str] = None
    reason: Optional[str] = None  # For bounce events
    type: Optional[str] = None  # For bounce: bounce, blocked, expired
    
    class Config:
        extra = "allow"  # Allow extra fields


@router.post("/email/sendgrid", summary="SendGrid Webhook")
async def sendgrid_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Handle SendGrid email tracking webhooks.
    
    Events processed:
    - delivered: Email was delivered to recipient's server
    - open: Recipient opened the email
    - click: Recipient clicked a link
    - bounce: Email bounced (hard or soft)
    - spamreport: Recipient marked as spam
    - unsubscribe: Recipient unsubscribed
    
    How it works:
    1. SendGrid sends batch of events as JSON array
    2. We parse each event and match to candidate by email
    3. We update candidate's outreach tracking
    4. For clicks on scheduling links, we may trigger stage updates
    
    Setup in SendGrid:
    - URL: https://Hire-X.shop/api/v1/webhooks/email/sendgrid
    - Events: Select all tracking events
    """
    try:
        # Get raw body for signature verification
        body = await request.body()
        
        # Verify signature (optional but recommended)
        signature = request.headers.get("X-Twilio-Email-Event-Webhook-Signature")
        if signature and hasattr(settings, 'SENDGRID_WEBHOOK_KEY'):
            if not verify_sendgrid_signature(body, signature, settings.SENDGRID_WEBHOOK_KEY):
                logger.warning("Invalid SendGrid webhook signature")
                raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse events
        events = json.loads(body)
        
        if not isinstance(events, list):
            events = [events]
        
        logger.info(f"📧 Received {len(events)} SendGrid events")
        
        # Process events in background
        background_tasks.add_task(
            process_sendgrid_events,
            events,
            pipeline_service
        )
        
        # Return immediately to acknowledge receipt
        return {"status": "ok", "events_received": len(events)}
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON in SendGrid webhook")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    except Exception as e:
        logger.error(f"SendGrid webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def verify_sendgrid_signature(payload: bytes, signature: str, key: str) -> bool:
    """Verify SendGrid webhook signature."""
    try:
        expected = hmac.new(
            key.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)
    except Exception:
        return False


async def process_sendgrid_events(events: List[Dict], pipeline_service: PipelineService):
    """
    Process SendGrid events and update candidate tracking.
    
    This runs in background to not block the webhook response.
    """
    for event_data in events:
        try:
            event = SendGridEvent(**event_data)
            
            logger.info(f"   Processing: {event.event} for {event.email}")
            
            # Find candidate by email
            pipeline_doc = await pipeline_service.pipelines_collection.find_one({
                "candidates.contact.email": event.email,
                "status": "active"
            })
            
            if not pipeline_doc:
                logger.debug(f"   No active pipeline found for {event.email}")
                continue
            
            # Load pipeline
            from models.pipeline_models import RecruitmentPipeline
            pipeline_doc.pop("_id", None)
            pipeline = RecruitmentPipeline(**pipeline_doc)
            
            # Find candidate
            candidate = None
            for c in pipeline.candidates:
                if c.contact.email == event.email:
                    candidate = c
                    break
            
            if not candidate or not candidate.outreach:
                continue
            
            # Update based on event type
            event_time = datetime.utcfromtimestamp(event.timestamp).isoformat()
            
            if event.event == "delivered":
                # Email was delivered
                for email_record in candidate.outreach.emails:
                    if not email_record.delivered_at:
                        email_record.delivered_at = event_time
                        email_record.status = "delivered"
                        break
                        
            elif event.event == "open":
                # Email was opened
                candidate.outreach.total_opens += 1
                if not candidate.outreach.first_opened_at:
                    candidate.outreach.first_opened_at = event_time
                    logger.info(f"   ✅ First open by {candidate.display_name}")
                
                for email_record in candidate.outreach.emails:
                    if not email_record.opened_at:
                        email_record.opened_at = event_time
                        email_record.status = "opened"
                        break
                        
            elif event.event == "click":
                # Link was clicked
                candidate.outreach.total_clicks += 1
                if not candidate.outreach.first_clicked_at:
                    candidate.outreach.first_clicked_at = event_time
                    candidate.outreach.candidate_responded = True
                    candidate.outreach.response_received_at = event_time
                    logger.info(f"   ✅ First click by {candidate.display_name}")
                    
                    # Update stage to scheduling if they clicked scheduling link
                    if event.url and "/schedule/" in event.url:
                        if candidate.stage in [CandidateStage.OUTREACH_SENT, CandidateStage.OUTREACH_REMINDER]:
                            candidate.update_stage(
                                CandidateStage.SCHEDULING,
                                triggered_by="candidate",
                                notes="Clicked scheduling link"
                            )
                
                for email_record in candidate.outreach.emails:
                    if not email_record.clicked_at:
                        email_record.clicked_at = event_time
                        email_record.status = "clicked"
                        break
                        
            elif event.event == "bounce":
                # Email bounced
                bounce_type = event.type or "unknown"
                logger.warning(f"   ⚠️ Bounce for {candidate.display_name}: {bounce_type}")
                
                for email_record in candidate.outreach.emails:
                    email_record.status = "bounced"
                    email_record.bounce_type = bounce_type
                    email_record.error_message = event.reason
                    break
                
                # Update stage to failed if hard bounce
                if bounce_type == "bounce":
                    candidate.update_stage(
                        CandidateStage.OUTREACH_FAILED,
                        triggered_by="system",
                        notes=f"Email bounced: {event.reason}"
                    )
                    
            elif event.event == "spamreport":
                # Marked as spam
                logger.warning(f"   ⚠️ Spam report from {candidate.display_name}")
                
                for email_record in candidate.outreach.emails:
                    email_record.status = "spam"
                    break
                
                # Don't contact this candidate again
                candidate.update_stage(
                    CandidateStage.REJECTED,
                    triggered_by="system",
                    notes="Marked email as spam"
                )
                candidate.final_decision = "rejected"
                candidate.rejection_reason = "Marked as spam"
                
            elif event.event == "unsubscribe":
                # Unsubscribed
                logger.info(f"   📭 Unsubscribe from {candidate.display_name}")
                
                candidate.update_stage(
                    CandidateStage.WITHDRAWN,
                    triggered_by="candidate",
                    notes="Unsubscribed from emails"
                )
                candidate.final_decision = "withdrawn"
            
            # Save updated pipeline
            pipeline.update_candidate(candidate)
            await pipeline_service._save_pipeline(pipeline)
            
        except Exception as e:
            logger.error(f"   Error processing event: {e}")


# ============================================================================
# VAPI INTERVIEW WEBHOOKS
# ============================================================================

class VapiCallEvent(BaseModel):
    """Vapi webhook event structure."""
    type: str  # call.started, call.ended, transcript.update, etc.
    call_id: str
    assistant_id: Optional[str] = None
    customer_number: Optional[str] = None
    timestamp: Optional[str] = None
    
    # Call ended specific
    end_reason: Optional[str] = None
    duration_seconds: Optional[float] = None
    recording_url: Optional[str] = None
    transcript: Optional[str] = None
    
    # Custom metadata we sent
    metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        extra = "allow"


@router.post("/vapi/call", summary="Vapi Call Webhook")
async def vapi_call_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_vapi_secret: Optional[str] = Header(None),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Handle Vapi interview call webhooks.
    
    Events processed:
    - call.started: Interview call started
    - call.ended: Interview call ended
    - transcript.complete: Full transcript available
    
    How it works:
    1. Vapi sends event when call status changes
    2. We match call to interview schedule via metadata
    3. We update interview status and candidate stage
    4. For call.ended, we trigger assessment generation
    
    Setup in Vapi:
    - Webhook URL: https://Hire-X.shop/api/v1/webhooks/vapi/call
    - Set webhook secret for authentication
    """
    try:
        # Verify Vapi webhook secret
        expected_secret = getattr(settings, 'VAPI_WEBHOOK_SECRET', None)
        if expected_secret and x_vapi_secret != expected_secret:
            logger.warning("Invalid Vapi webhook secret")
            raise HTTPException(status_code=401, detail="Invalid secret")
        
        body = await request.json()
        event = VapiCallEvent(**body)
        
        logger.info(f"📞 Vapi webhook: {event.type} for call {event.call_id}")
        
        # Process in background
        background_tasks.add_task(
            process_vapi_event,
            event,
            pipeline_service
        )
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Vapi webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_vapi_event(event: VapiCallEvent, pipeline_service: PipelineService):
    """
    Process Vapi call event and update interview tracking.
    """
    try:
        # Get interview session from metadata
        metadata = event.metadata or {}
        schedule_id = metadata.get("schedule_id")
        pipeline_id = metadata.get("pipeline_id")
        candidate_id = metadata.get("candidate_id")
        
        if not schedule_id:
            # Try to find by call_id
            schedule_doc = await pipeline_service.schedules_collection.find_one({
                "interview_session_id": event.call_id
            })
            if schedule_doc:
                schedule_id = schedule_doc.get("schedule_id")
                pipeline_id = schedule_doc.get("pipeline_id")
                candidate_id = schedule_doc.get("candidate_id")
        
        if not schedule_id:
            logger.warning(f"Could not find schedule for call {event.call_id}")
            return
        
        # Process based on event type
        if event.type == "call.started":
            logger.info(f"   🎤 Interview started: {schedule_id}")
            
            await pipeline_service.schedules_collection.update_one(
                {"schedule_id": schedule_id},
                {
                    "$set": {
                        "status": ScheduleStatus.IN_PROGRESS.value,
                        "call_initiated_at": event.timestamp or get_current_timestamp(),
                        "interview_session_id": event.call_id
                    }
                }
            )
            
            # Update candidate stage
            if pipeline_id and candidate_id:
                pipeline = await pipeline_service.get_pipeline(pipeline_id)
                if pipeline:
                    candidate = pipeline.get_candidate(candidate_id)
                    if candidate:
                        candidate.interview.call_initiated_at = event.timestamp
                        candidate.interview.interview_session_id = event.call_id
                        candidate.update_stage(CandidateStage.INTERVIEW_CALLING, triggered_by="system")
                        pipeline.update_candidate(candidate)
                        await pipeline_service._save_pipeline(pipeline)
                        
        elif event.type == "call.ended":
            logger.info(f"   🎤 Interview ended: {schedule_id} ({event.end_reason})")
            
            # Determine completion status
            completion_status = "completed"
            if event.end_reason in ["no-answer", "busy", "failed"]:
                completion_status = event.end_reason
            elif event.end_reason == "voicemail":
                completion_status = "voicemail"
            
            # Update schedule
            await pipeline_service.schedules_collection.update_one(
                {"schedule_id": schedule_id},
                {
                    "$set": {
                        "status": ScheduleStatus.COMPLETED.value if completion_status == "completed" else ScheduleStatus.TECHNICAL_ISSUE.value,
                        "call_ended_at": event.timestamp or get_current_timestamp(),
                        "actual_duration_seconds": event.duration_seconds,
                        "recording_url": event.recording_url,
                        "interview_completed": completion_status == "completed",
                        "completion_status": completion_status
                    }
                }
            )
            
            # Update candidate
            if pipeline_id and candidate_id:
                pipeline = await pipeline_service.get_pipeline(pipeline_id)
                if pipeline:
                    candidate = pipeline.get_candidate(candidate_id)
                    if candidate:
                        candidate.interview.call_ended_at = event.timestamp
                        candidate.interview.call_duration_seconds = event.duration_seconds
                        candidate.interview.recording_url = event.recording_url
                        
                        if completion_status == "completed":
                            candidate.update_stage(CandidateStage.INTERVIEW_COMPLETED, triggered_by="system")
                        elif completion_status in ["no-answer", "busy"]:
                            candidate.update_stage(CandidateStage.INTERVIEW_NO_SHOW, triggered_by="system")
                        else:
                            candidate.update_stage(
                                CandidateStage.INTERVIEW_FAILED,
                                triggered_by="system",
                                notes=f"Call ended: {event.end_reason}"
                            )
                        
                        pipeline.update_candidate(candidate)
                        await pipeline_service._save_pipeline(pipeline)
            
            # Trigger assessment generation if interview completed
            if completion_status == "completed" and event.transcript:
                logger.info(f"   📊 Triggering assessment generation...")
                # This would call your assessment generation service
                # await generate_interview_assessment(schedule_id, event.transcript)
                
        elif event.type == "transcript.complete":
            logger.info(f"   📝 Transcript received for {schedule_id}")
            
            # Store transcript
            await pipeline_service.schedules_collection.update_one(
                {"schedule_id": schedule_id},
                {
                    "$set": {
                        "transcript": event.transcript,
                        "transcript_available": True
                    }
                }
            )
            
            # Update candidate
            if pipeline_id and candidate_id:
                pipeline = await pipeline_service.get_pipeline(pipeline_id)
                if pipeline:
                    candidate = pipeline.get_candidate(candidate_id)
                    if candidate:
                        candidate.interview.transcript_available = True
                        pipeline.update_candidate(candidate)
                        await pipeline_service._save_pipeline(pipeline)
                        
    except Exception as e:
        logger.error(f"Error processing Vapi event: {e}")


# ============================================================================
# WEBHOOK STATUS & TESTING
# ============================================================================

@router.get("/status", summary="Webhook Status")
async def webhook_status():
    """Get webhook configuration status."""
    return {
        "sendgrid": {
            "endpoint": "/api/v1/webhooks/email/sendgrid",
            "signature_verification": hasattr(settings, 'SENDGRID_WEBHOOK_KEY'),
            "events_supported": [
                "delivered", "open", "click", "bounce", 
                "spamreport", "unsubscribe"
            ]
        },
        "vapi": {
            "endpoint": "/api/v1/webhooks/vapi/call",
            "secret_configured": hasattr(settings, 'VAPI_WEBHOOK_SECRET'),
            "events_supported": [
                "call.started", "call.ended", "transcript.complete"
            ]
        }
    }


@router.post("/test/sendgrid", summary="Test SendGrid Webhook")
async def test_sendgrid_webhook(
    email: str,
    event_type: str = "open",
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Test SendGrid webhook processing (development only).
    
    Usage:
        POST /api/v1/webhooks/test/sendgrid?email=test@example.com&event_type=open
    """
    if not getattr(settings, 'DEBUG', False):
        raise HTTPException(status_code=403, detail="Only available in debug mode")
    
    test_events = [{
        "email": email,
        "timestamp": int(datetime.utcnow().timestamp()),
        "event": event_type,
        "sg_message_id": "test-message-id"
    }]
    
    await process_sendgrid_events(test_events, pipeline_service)
    
    return {"status": "processed", "event_type": event_type, "email": email}


# ============================================================================
# EXPORT
# ============================================================================

__all__ = ["router"]