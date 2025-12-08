"""
Voice Interview API V3
======================
FastAPI endpoints for the Vapi-powered voice interview system.

Endpoints:
- POST /voice-interview/create - Create new interview
- POST /voice-interview/{session_id}/start - Start the call
- GET /voice-interview/{session_id} - Get interview status/results
- GET /voice-interview/list - List all interviews
- POST /voice-interview/webhook - Vapi webhook handler

"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from core.dependencies import (get_current_username, get_mongodb, get_redis,
                               get_vapi_interview_service)
from core.logging_config import get_logger
from models.vapi_interview_models import (CreateInterviewRequest,
                                          CreateInterviewResponse,
                                          GetInterviewResultsResponse,
                                          InterviewStatus,
                                          ListInterviewsRequest,
                                          ListInterviewsResponse,
                                          StartCallRequest, StartCallResponse,
                                          VapiWebhookEvent)
from services.vapi_interview_service import VapiInterviewService

router = APIRouter(prefix="/voice-interview", tags=["Voice Interview V3"])
logger = get_logger(__name__)



# ==========================================================================
# CREATE & START INTERVIEWS
# ==========================================================================

@router.post("/create", response_model=CreateInterviewResponse)
async def create_interview(
    request: CreateInterviewRequest,
    username: str = Depends(get_current_username),
    service: VapiInterviewService = Depends(get_vapi_interview_service)
):
    """
    Create a new voice interview session.
    
    This will:
    1. Generate an interview plan based on candidate + job context
    2. Create a Vapi assistant with custom prompts
    3. Optionally start the call immediately (if auto_call=True)
    
    The interview will use Cartesia Sonic 3 for TTS and Deepgram for STT,
    with multi-language support (English + Hindi/Hinglish).
    """
    try:
        response = await service.create_interview(request, username)
        return response
    except Exception as e:
        logger.error(f"Failed to create interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/start", response_model=StartCallResponse)
async def start_interview_call(
    session_id: str,
    username: str = Depends(get_current_username),
    service: VapiInterviewService = Depends(get_vapi_interview_service)
):
    """
    Start the outbound call for an existing interview session.
    
    The call will be placed via Twilio (through Vapi) to the candidate's
    phone number. The AI interviewer (Neura) will conduct the interview
    following the generated plan.
    """
    try:
        response = await service.start_call(session_id)
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start call: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================================================
# GET INTERVIEW DATA
# ==========================================================================

@router.get("/{session_id}")
async def get_interview(
    session_id: str,
    username: str = Depends(get_current_username),
    service: VapiInterviewService = Depends(get_vapi_interview_service)
):
    """
    Get interview status and results.
    
    Returns:
    - Session status (pending, calling, in_progress, completed, etc.)
    - Recording URL (when available)
    - Clips with Q&A pairs and analysis
    - Final assessment with scores and recommendation
    - Full transcript
    """
    result = await service.get_interview_results(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Interview not found")
    return result


@router.get("/list", response_model=ListInterviewsResponse)
async def list_interviews(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    username: str = Depends(get_current_username),
    service: VapiInterviewService = Depends(get_vapi_interview_service)
):
    """
    List all interviews for the current user.
    
    Optional filters:
    - status: Filter by interview status
    """
    try:
        status_enum = InterviewStatus(status) if status else None
        interviews, total = await service.list_interviews(
            username, status_enum, limit, offset
        )
        return ListInterviewsResponse(
            interviews=interviews,
            total=total,
            limit=limit,
            offset=offset
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")


# ==========================================================================
# VAPI WEBHOOK
# ==========================================================================

@router.post("/webhook")
async def vapi_webhook(request: Request, service: VapiInterviewService = Depends(get_vapi_interview_service)):
    """
    Handle Vapi webhook events.
    
    Events handled:
    - function-call: Tool invocations from the LLM
    - status-update: Call status changes
    - end-of-call-report: Final report with recordings
    - transcript: Real-time transcript updates
    """
    try:
        body = await request.json()
        
        # Parse event
        event = VapiWebhookEvent(
            type=body.get("message", {}).get("type", body.get("type", "")),
            call=body.get("message", {}).get("call", body.get("call")),
            timestamp=body.get("timestamp"),
            function_call=body.get("message", {}).get("functionCall"),
            transcript=body.get("message", {}).get("transcript"),
            recording_url=body.get("message", {}).get("recordingUrl"),
            stereo_recording_url=body.get("message", {}).get("stereoRecordingUrl"),
            status=body.get("message", {}).get("status"),
            ended_reason=body.get("message", {}).get("endedReason")
        )
        
        result = await service.handle_webhook(event, body)
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Webhook handling failed: {e}")
        # Return 200 to prevent Vapi retries
        return JSONResponse(content={"error": str(e)}, status_code=200)


# ==========================================================================
# CLIP ENDPOINTS
# ==========================================================================

@router.get("/{session_id}/clips/{clip_id}")
async def get_clip(
    session_id: str,
    clip_id: str,
    username: str = Depends(get_current_username),
    service: VapiInterviewService = Depends(get_vapi_interview_service)
):
    """
    Get a specific clip from an interview.
    
    Returns clip details including:
    - Question asked
    - Candidate's response
    - Analysis scores
    - Audio URL (if extracted)
    """
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    clip = next((c for c in session.clips if c.clip_id == clip_id), None)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    return {
        "clip_id": clip.clip_id,
        "question": clip.question_asked,
        "question_type": clip.question_type.value,
        "response": clip.candidate_response,
        "duration_seconds": clip.duration_seconds,
        "analysis": clip.analysis.model_dump() if clip.analysis else None,
        "is_highlight": clip.is_highlight,
        "audio_url": clip.clip_url
    }


@router.post("/{session_id}/clips/{clip_id}/highlight")
async def toggle_clip_highlight(
    session_id: str,
    clip_id: str,
    highlight: bool = True,
    reason: Optional[str] = None,
    username: str = Depends(get_current_username),
    service: VapiInterviewService = Depends(get_vapi_interview_service)
):
    """
    Mark a clip as a highlight (or remove highlight).
    
    Highlights are shown prominently in the interview summary.
    """
    session = await service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    for clip in session.clips:
        if clip.clip_id == clip_id:
            clip.is_highlight = highlight
            clip.highlight_reason = reason
            await service._store_session(session)
            return {"status": "updated", "is_highlight": highlight}
    
    raise HTTPException(status_code=404, detail="Clip not found")