"""
Conversation API Routes
======================
FastAPI routes for the conversational interface with Donna.
"""

import base64
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, HTTPException,
                     UploadFile)

from core.dependencies import (get_conversation_manager, get_current_username,
                               get_enrichment_service, get_jd_generator,
                               get_jd_parser, get_mongodb,
                               get_parallel_enrichment_service, get_workflow)
from core.logging_config import get_logger
from data.mongodb import MongoDB
from models.conversation_models import (ConversationFinalizeRequest,
                                        ConversationFinalizeResponse,
                                        ConversationMessageRequest,
                                        ConversationMessageResponse,
                                        ConversationStartRequest,
                                        ConversationStartResponse,
                                        FeedbackRequest, FeedbackResponse,
                                        GenerateJDRequest, GenerateJDResponse,
                                        RefineJDRequest, RefineJDResponse,
                                        RefineSearchRequest)
from services.conversation_manager import ConversationManager
from services.enrichment_service import EnrichmentService
from services.jd_generator import JDGeneratorService
from services.jd_parser import JDParser
from services.parallel_enrichment_service import ParallelEnrichmentService
from services.scorecard_workflow import ScorecardWorkflow

# ================================================================
# ROUTER SETUP
# ================================================================

router = APIRouter(prefix="/conversation", tags=["Conversation"])
logger = get_logger(__name__)


# ================================================================
# START CONVERSATION
# ================================================================

@router.post("/start", response_model=ConversationStartResponse)
async def start_conversation(
    request: ConversationStartRequest,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    jd_parser: JDParser = Depends(get_jd_parser)
):
    """
    Start a new conversation with Donna.
    
    Can optionally include:
    - initial_message (free text)
    - jd_file_content (uploaded file, base64)
    - jd_text (generated/edited JD text) 
    
    Returns:
        Donna's greeting and initial profile card
    """
    
    try:
        # Generate session ID
        session_id = f"conv_{uuid.uuid4().hex}"
        
        logger.info(f"Starting conversation for {username}, session: {session_id}")
        
        # Parse JD if provided
        jd_data = None
        
        if request.jd_file_content and request.jd_file_name:
            jd_data = await jd_parser.parse_jd(
                file_content=request.jd_file_content,
                file_name=request.jd_file_name,
                username=username
            )
            logger.debug(f'JD data from file: {jd_data}')
        elif request.jd_text:  
            # Generated/edited JD text
            jd_data = await jd_parser.parse_jd_text(
                jd_text=request.jd_text,
                username=username
            )
            logger.debug(f'JD data from text: {jd_data}')
        
        # Start conversation
        donna_reply, ideal_profile, sample_profile, stage = await conversation_manager.start_conversation(
            session_id=session_id,
            username=username,
            initial_message=request.initial_message,
            jd_data=jd_data
        )
        
        # Get suggestions
        suggestions = conversation_manager._get_suggestions(stage, ideal_profile)
        
        return ConversationStartResponse(
            session_id=session_id,
            donna_greeting=donna_reply,
            ideal_profile=ideal_profile,
            sample_profile=sample_profile,
            suggested_next_steps=suggestions,
            stage=stage
        )
    
    except Exception as e:
        logger.error(f"Error starting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# SEND MESSAGE
# ================================================================

@router.post("/{session_id}/message", response_model=ConversationMessageResponse)
async def send_message(
    session_id: str,
    request: ConversationMessageRequest,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Send a message in the conversation.
    
    Args:
        session_id: Conversation session ID
        request: User's message and optional action
    
    Returns: 
        Donna's response and updated profile
    """
    
    try:
        # Process message
        (
            donna_reply,
            updated_profile,
            sample_profile,
            stage,
            ready_to_search,
            suggestions
        ) = await conversation_manager.process_message(
            session_id=session_id,
            user_message=request.message,
            action=request.action
        )
        
        return ConversationMessageResponse(
            donna_reply=donna_reply,
            updated_ideal_profile=updated_profile,
            updated_sample_profile=sample_profile,
            stage=stage,
            ready_to_search=ready_to_search,
            suggestions=suggestions
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET CONVERSATION STATE
# ================================================================

@router.get("/{session_id}")
async def get_conversation(
    session_id: str,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Get current conversation state.
    
    Args:
        session_id: Conversation session ID
    
    Returns:
        Full conversation state
    """
    
    try:
        # Load state
        state = await conversation_manager._load_state(session_id)
        
        if not state:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "session_id": state.session_id,
            "stage": state.stage,
            "ideal_profile": state.ideal_profile,
            "sample_profile": state.sample_profile,
            "messages": state.messages,
            "ready_to_search": state.ready_to_search,
            "turn_count": state.turn_count,
            "sample_candidates": state.sample_candidates
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# FINALIZE CONVERSATION 
# ================================================================

@router.post("/{session_id}/finalize", response_model=ConversationFinalizeResponse)
async def finalize_conversation(
    session_id: str,
    request: ConversationFinalizeRequest,
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    enrichment_service: EnrichmentService = Depends(get_enrichment_service),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Finalize conversation and enrich top 5 candidates with FULL enrichment.
    
    This triggers comprehensive enrichment including:
    - Salary estimation (career progression with web search)
    - Skills validation (GitHub, StackOverflow, blogs)
    - Response likelihood (detailed factor analysis)
    - Availability checking (company health, urgency)
    - Web intelligence (press mentions, online presence)
    - Recruiter summary (AI-generated actionable insights)
    """
    
    try:
        logger.info(f"🎯 Finalizing conversation {session_id} for {username}")
        
        # Load conversation state
        state = await conversation_manager._load_state(session_id)
        
        if not state:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Apply final adjustments if provided
        if request.final_profile_adjustments:
            adjustments_dict = request.final_profile_adjustments.dict(exclude_unset=True)
            for key, value in adjustments_dict.items():
                setattr(state.ideal_profile, key, value)
        
        # Validation
        if not state.ideal_profile.role_title:
            raise HTTPException(status_code=400, detail="Role title is required")
        
        if not state.ideal_profile.must_have_skills or len(state.ideal_profile.must_have_skills) < 2:
            raise HTTPException(status_code=400, detail="At least 2 must-have skills required")
        
        # Get sample candidates
        sample_candidates = getattr(state, 'sample_candidates', [])
        
        if not sample_candidates:
            raise HTTPException(
                status_code=400,
                detail="No sample candidates found. Please review candidates first."
            )
        
        # Take top 5 candidates
        top_5 = sample_candidates[:5]
        
        logger.info(f"✅ Enriching {len(top_5)} candidates with FULL enrichment")
        
        # Generate enrichment session ID
        enrichment_session_id = str(uuid.uuid4())
        
        # Trigger enrichment in background
        background_tasks.add_task(
            _enrich_and_store_results,
            enrichment_session_id=enrichment_session_id,
            conversation_session_id=session_id,
            username=username,
            ideal_profile=state.ideal_profile.dict(),
            candidates=top_5,
            enrichment_service=enrichment_service,
            mongodb=mongodb
        )
        
        return ConversationFinalizeResponse(
            session_id=enrichment_session_id,
            search_triggered=True,
            message="Enriching top 5 candidates with salary, skills, response likelihood, availability, and recruiter insights!",
            estimated_candidates=len(top_5)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finalizing conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _enrich_and_store_results(
    enrichment_session_id: str,
    conversation_session_id: str,
    username: str,
    ideal_profile: Dict,
    candidates: List[Dict],
    enrichment_service: EnrichmentService,
    mongodb: MongoDB
):
    """Background task for comprehensive enrichment."""
    
    try:
        logger.info(f"🚀 Starting FULL enrichment for {enrichment_session_id}")
        
        # Initialize progress
        await enrichment_service.redis.store_session_data(
            enrichment_session_id,
            "enrichment_progress",
            {
                "status": "enriching",
                "total_candidates": len(candidates),
                "enriched_count": 0,
                "progress_percentage": 0,
                "message": "Starting comprehensive enrichment..."
            },
            expire_seconds=3600
        )
        
        # Run FULL enrichment (all types including recruiter summary)
        enriched_candidates = await enrichment_service.enrich_candidates(
            session_id=enrichment_session_id,
            candidates=candidates,
            enrichment_types=[
                "salary", "response_likelihood", "skills", 
                "availability", "web_intelligence", "recruiter_summary"
            ],
            username=username
        )
        
        # ✅ FIX: Store results using the save_enriched_results method
        results_doc = {
            "session_id": enrichment_session_id,
            "conversation_session_id": conversation_session_id,
            "username": username,
            "ideal_profile": ideal_profile,
            "total_found": len(enriched_candidates),
            "enriched_count": len([c for c in enriched_candidates if c.enrichment_status == "completed"]),
            "candidates": [c.dict() for c in enriched_candidates],
            "created_at": datetime.utcnow().isoformat(),
            "status": "completed"
        }
        
        # ✅ Use the proper MongoDB method
        await mongodb.save_enriched_results(results_doc)
        
        logger.info(f"✅ Enrichment completed for {enrichment_session_id}")
        
        # Update progress to completed
        await enrichment_service.redis.store_session_data(
            enrichment_session_id,
            "enrichment_progress",
            {
                "status": "completed",
                "total_candidates": len(candidates),
                "enriched_count": len([c for c in enriched_candidates if c.enrichment_status == "completed"]),
                "progress_percentage": 100,
                "message": "Enrichment complete! View your results now."
            },
            expire_seconds=3600
        )
        
    except Exception as e:
        logger.error(f"❌ Enrichment failed for {enrichment_session_id}: {e}", exc_info=True)
        
        await enrichment_service.redis.store_session_data(
            enrichment_session_id,
            "enrichment_progress",
            {
                "status": "failed",
                "total_candidates": len(candidates),
                "enriched_count": 0,
                "progress_percentage": 0,
                "message": f"Enrichment failed: {str(e)}"
            },
            expire_seconds=3600
        )

# ================================================================
# UPLOAD JD (ALTERNATIVE ENDPOINT)
# ================================================================

@router.post("/{session_id}/upload-jd")
async def upload_jd(
    session_id: str,
    file: UploadFile = File(...),
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    jd_parser: JDParser = Depends(get_jd_parser)
):
    """
    Upload JD file to existing conversation.
    
    This allows uploading JD mid-conversation.
    
    Args:
        session_id: Conversation session ID
        file: Uploaded JD file
    
    Returns:
        Parsed JD data and updated profile
    """
    
    try:
        # Load conversation state
        state = await conversation_manager._load_state(session_id)
        
        if not state:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Read file
        file_content = await file.read()
        
        # Convert to base64
        file_content_b64 = base64.b64encode(file_content).decode('utf-8')
        
        # Parse JD
        jd_data = await jd_parser.parse_jd(
            file_content=file_content_b64,
            file_name=file.filename,
            username=username
        )
        
        # Update profile with JD data
        jd_profile = conversation_manager._jd_to_profile(jd_data)
        
        # Merge with existing profile
        state.ideal_profile = conversation_manager._merge_profiles(
            state.ideal_profile,
            jd_profile
        )
        
        state.jd_uploaded = True
        state.jd_file_name = file.filename
        
        # Generate Donna's response
        donna_reply = "Perfect! I've analyzed your JD. Let me show you what I found. 📋"
        
        state.messages.append({
            "role": "assistant",
            "content": donna_reply,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Save state
        await conversation_manager._save_state(state)
        
        return {
            "message": donna_reply,
            "jd_data": jd_data,
            "updated_profile": state.ideal_profile
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading JD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GENERATE JD FROM SEARCH QUERY 
# ================================================================

@router.post("/generate-jd", response_model=GenerateJDResponse)
async def generate_jd(
    request: GenerateJDRequest,
    username: str = Depends(get_current_username),
    jd_generator: JDGeneratorService = Depends(get_jd_generator),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Generate a JD from user's search query.
    
    This is called when user enters text search (not uploading JD).
    LLM generates a comprehensive JD that user can review/edit.
    """
    
    try:
        logger.info(f"Generating JD for query: {request.search_query[:50]}...")
        
        # Generate session ID for tracking this JD generation
        session_id = f"jdgen_{uuid.uuid4().hex}"
        
        # Generate JD
        jd_text = await jd_generator.generate_jd(
            search_query=request.search_query,
            username=username
        )
        
        # Store in Redis for refinement tracking
        await conversation_manager.redis.store_session_data(
            session_id,
            "jd_generation",
            {
                "original_query": request.search_query,
                "current_jd": jd_text,
                "retry_count": 0,
                "username": username
            },
            expire_seconds=1800  # 30 minutes
        )
        
        return GenerateJDResponse(
            jd_text=jd_text,
            session_id=session_id
        )
    
    except Exception as e:
        logger.error(f"Error generating JD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# REFINE JD BASED ON FEEDBACK 
# ================================================================

@router.post("/refine-jd", response_model=RefineJDResponse)
async def refine_jd(
    request: RefineJDRequest,
    username: str = Depends(get_current_username),
    jd_generator: JDGeneratorService = Depends(get_jd_generator),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Refine JD based on user feedback.
    
    User can refine up to 2 times. After that, we proceed with what we have.
    """
    
    try:
        # Load JD generation session
        jd_data = await conversation_manager.redis.get_session_data(
            request.session_id,
            "jd_generation"
        )
        
        if not jd_data:
            raise HTTPException(status_code=404, detail="JD generation session not found")
        
        # Check retry count
        current_retry = jd_data.get("retry_count", 0)
        
        if current_retry >= JDGeneratorService.MAX_RETRIES:
            return RefineJDResponse(
                jd_text=jd_data["current_jd"],
                retry_count=current_retry,
                max_retries_reached=True
            )
        
        logger.info(f"Refining JD (attempt {current_retry + 1}/{JDGeneratorService.MAX_RETRIES})")
        
        # Refine JD
        refined_jd, max_reached = await jd_generator.refine_jd(
            original_query=jd_data["original_query"],
            previous_jd=request.previous_jd,
            feedback=request.feedback,
            retry_count=current_retry,
            username=username
        )
        
        # Update session data
        jd_data["current_jd"] = refined_jd
        jd_data["retry_count"] = current_retry + 1
        
        await conversation_manager.redis.store_session_data(
            request.session_id,
            "jd_generation",
            jd_data,
            expire_seconds=1800
        )
        
        return RefineJDResponse(
            jd_text=refined_jd,
            retry_count=current_retry + 1,
            max_retries_reached=max_reached
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refining JD: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/refine")
async def refine_search(
    session_id: str,
    request: RefineSearchRequest,
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    username: str = Depends(get_current_username)
):
    """
    Refine search based on HR feedback.
    
    Allows HR to iteratively adjust search criteria.
    """
    try:
        # Load current state
        state = await conversation_manager._load_state(session_id)
        if not state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Apply refinement
        filters = conversation_manager.refinement.apply_refinement(
            session_id=session_id,
            original_jd={
                "role_title": state.ideal_profile.role_title,
                "required_skills": state.ideal_profile.must_have_skills,
                "industries": state.ideal_profile.industries,
                "seniority": state.ideal_profile.seniority
            },
            refinement_action=request.action,
            refinement_data=request.data
        )
        
        # Store filters in state
        state.search_filters = filters
        
        # Re-run search with new filters
        donna_reply, suggestions = await conversation_manager._generate_sample_with_smart_search(state)
        
        # Save state
        await conversation_manager._save_state(state)
        
        return {
            "donna_reply": donna_reply,
            "updated_filters": filters,
            "sample_profile": state.sample_profile,
            "suggestions": suggestions
        }
        
    except Exception as e:
        logger.error(f"Refinement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# PROVIDE FEEDBACK ON SAMPLES
# ================================================================

@router.post("/{session_id}/feedback", response_model=FeedbackResponse)
async def provide_feedback(
    session_id: str,
    request: FeedbackRequest,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Provide feedback on sample candidates.
    
    Feedback types:
    - too_junior: Candidates are too junior
    - need_more_skill: Need more of a specific skill
    - wrong_industry: Wrong industries shown
    - perfect: These are great, search for more
    
    Returns:
        Updated samples based on feedback
    """
    
    try:
        logger.info(f"Feedback from {username}: {request.feedback_type}")
        
        # Process feedback
        donna_reply, updated_samples = await conversation_manager.process_feedback(
            session_id=session_id,
            feedback_type=request.feedback_type,
            feedback_data=request.feedback_data
        )
        
        return FeedbackResponse(
            donna_reply=donna_reply,
            updated_samples=updated_samples,
            feedback_applied=True
        )
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET SAMPLE CANDIDATES (REFRESH)
# ================================================================

@router.get("/{session_id}/samples")
async def get_sample_candidates(
    session_id: str,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Get/refresh sample candidates.
    
    Returns current samples or generates new ones.
    """
    
    try:
        # Load state
        state = await conversation_manager._load_state(session_id)
        
        if not state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Generate samples if not exists
        if not hasattr(state, 'sample_candidates') or not state.sample_candidates:
            samples = await conversation_manager._generate_sample_candidates(state)
            state.sample_candidates = samples
            await conversation_manager._save_state(state)
        else:
            samples = state.sample_candidates
        
        return {
            "samples": samples,
            "count": len(samples)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting samples: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# RESET CONVERSATION
# ================================================================

@router.delete("/{session_id}")
async def reset_conversation(
    session_id: str,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Reset/delete conversation.
    
    Args:
        session_id: Conversation session ID
    
    Returns:
        Success message
    """
    
    try:
        # Delete from Redis
        await conversation_manager.redis.delete_session_data(
            session_id,
            "conversation_state"
        )
        
        logger.info(f"Conversation {session_id} reset for {username}")
        
        return {"message": "Conversation reset successfully"}
    
    except Exception as e:
        logger.error(f"Error resetting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# ================================================================
# ENRICH SINGLE CANDIDATE (Called when user accepts)
# ================================================================

@router.post("/{session_id}/enrich-candidate")
async def enrich_candidate(
    session_id: str,
    request: dict,  # {candidate_id: str, candidate: dict}
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    parallel_service: ParallelEnrichmentService = Depends(get_parallel_enrichment_service)
):
    """
    Enrich a single candidate when user accepts them.
    
    Runs in background and returns immediately.
    Poll /enrichment-status/{candidate_id} for progress.
    """
    try:
        # Load conversation state for ideal profile
        state = await conversation_manager._load_state(session_id)
        if not state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        candidate = request.get("candidate")
        candidate_id = request.get("candidate_id")
        
        if not candidate:
            raise HTTPException(status_code=400, detail="Candidate data required")
        
        logger.info(f"🔄 Queuing enrichment for candidate {candidate_id}")
        
        # Add to background tasks
        background_tasks.add_task(
            parallel_service.enrich_single_candidate,
            session_id=session_id,
            candidate=candidate,
            ideal_profile=state.ideal_profile.dict(),
            enrichment_types=["salary", "response_likelihood", "skills", "availability"]
        )
        
        return {
            "status": "queued",
            "candidate_id": candidate_id,
            "message": "Enrichment started in background"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error queueing enrichment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET ENRICHMENT STATUS
# ================================================================

@router.get("/{session_id}/enrichment-status")
async def get_enrichment_status(
    session_id: str,
    candidate_id: Optional[str] = None,
    username: str = Depends(get_current_username),
    parallel_service: ParallelEnrichmentService = Depends(get_parallel_enrichment_service)
):
    """
    Get enrichment progress.
    
    If candidate_id provided, returns status for that candidate.
    Otherwise returns overall session progress.
    """
    try:
        if candidate_id:
            result = await parallel_service.get_candidate_enrichment(
                session_id, candidate_id
            )
            return result or {"status": "not_found"}
        else:
            return await parallel_service.get_enrichment_progress(session_id)
            
    except Exception as e:
        logger.error(f"Error getting enrichment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# PROCESS REJECTION FEEDBACK (LLM-powered)
# ================================================================

@router.post("/{session_id}/rejection-feedback")
async def process_rejection_feedback(
    session_id: str,
    request: dict,  # {candidate: dict, reason: str, detailed_feedback: str}
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Process rejection feedback and refine search criteria.
    
    Uses LLM to understand why candidate was rejected and adjust search.
    """
    try:
        state = await conversation_manager._load_state(session_id)
        if not state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        candidate = request.get("candidate", {})
        reason = request.get("reason", "")
        detailed_feedback = request.get("detailed_feedback", "")
        
        logger.info(f"📝 Processing rejection feedback: {reason}")
        
        # Use LLM to understand and refine
        refinement_result = await conversation_manager._process_rejection_with_llm(
            state=state,
            rejected_candidate=candidate,
            rejection_reason=reason,
            detailed_feedback=detailed_feedback
        )
        
        # Apply refinements to profile
        if refinement_result.get("profile_updates"):
            for key, value in refinement_result["profile_updates"].items():
                if value and hasattr(state.ideal_profile, key):
                    setattr(state.ideal_profile, key, value)
        
        # Apply to feedback state
        if state.feedback is None:
            state.feedback = {}
        
        if refinement_result.get("feedback_adjustments"):
            state.feedback.update(refinement_result["feedback_adjustments"])
        
        # Save state
        await conversation_manager._save_state(state)
        
        # Generate new samples with refined criteria
        new_samples = await conversation_manager._generate_sample_candidates(state)
        
        # Update sample candidates in state
        state.sample_candidates = new_samples
        await conversation_manager._save_state(state)
        
        return {
            "donna_reply": refinement_result.get("donna_response", "Got it! Let me find better matches."),
            "refinements_applied": refinement_result.get("refinements_applied", []),
            "new_samples": new_samples[:3],  # Return top 3 new candidates
            "updated_profile": state.ideal_profile.dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing rejection feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# BATCH ENRICH ACCEPTED CANDIDATES
# ================================================================

@router.post("/{session_id}/enrich-accepted")
async def enrich_accepted_candidates(
    session_id: str,
    request: dict,  # {accepted_candidates: List[dict]}
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    parallel_service: ParallelEnrichmentService = Depends(get_parallel_enrichment_service),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Start deep analysis of accepted candidates (capped at 5).
    
    This triggers comprehensive enrichment:
    - Match analysis with strengths/concerns
    - Salary estimation with career progression
    - Skills validation with evidence
    - Response likelihood with factors
    - Notice period estimation
    """
    try:
        state = await conversation_manager._load_state(session_id)
        if not state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        accepted_candidates = request.get("accepted_candidates", [])
        
        if not accepted_candidates:
            raise HTTPException(status_code=400, detail="No candidates to analyze")
        
        # Cap at 5 candidates
        candidates_to_enrich = accepted_candidates[:5]
        
        logger.info(f"🚀 Starting deep analysis for {len(candidates_to_enrich)} candidates (session: {session_id})")
        
        # Initialize progress immediately so frontend can start polling
        await parallel_service.redis.store_session_data(
            session_id,
            "enrichment_progress",
            {
                "status": "starting",
                "phase": "initializing",
                "total": len(candidates_to_enrich),
                "completed": 0,
                "failed": 0,
                "progress_percentage": 0,
                "current_candidate": "",
                "message": f"Preparing deep analysis for {len(candidates_to_enrich)} candidates...",
                "candidates": {},
                "started_at": datetime.utcnow().isoformat()
            },
            expire_seconds=3600
        )
        
        # Inject MongoDB into parallel service if not already set
        if not parallel_service.mongodb:
            parallel_service.mongodb = mongodb
        
        # Start enrichment in background
        background_tasks.add_task(
            parallel_service.enrich_candidates_parallel,
            session_id=session_id,
            candidates=candidates_to_enrich,
            ideal_profile=state.ideal_profile.dict(),
            username=username
        )
        
        return {
            "status": "started",
            "session_id": session_id,
            "total_candidates": len(candidates_to_enrich),
            "message": f"Deep analysis started for {len(candidates_to_enrich)} candidates. This may take 1-2 minutes."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting batch enrichment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET ENRICHMENT STATUS 
# ================================================================

@router.get("/{session_id}/enrichment-status")
async def get_enrichment_status(
    session_id: str,
    username: str = Depends(get_current_username),
    parallel_service: ParallelEnrichmentService = Depends(get_parallel_enrichment_service)
):
    """
    Get current enrichment progress.
    
    Returns:
        - status: starting | in_progress | completed | failed
        - phase: initializing | deep_analysis | complete
        - total: total candidates being enriched
        - completed: number completed
        - failed: number failed
        - progress_percentage: 0-100
        - current_candidate: name of candidate currently being analyzed
        - message: human-readable status message
        - candidates: dict of candidate statuses
    """
    try:
        progress = await parallel_service.get_enrichment_progress(session_id)
        return progress
        
    except Exception as e:
        logger.error(f"Error getting enrichment status: {e}")
        return {
            "status": "error",
            "message": str(e),
            "total": 0,
            "completed": 0,
            "failed": 0,
            "progress_percentage": 0
        }