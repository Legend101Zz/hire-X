"""
Conversation API Routes
======================
FastAPI routes for the conversational interface with Donna.
"""

import base64
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, HTTPException,
                     UploadFile)

from core.dependencies import (get_conversation_manager, get_current_username,
                               get_jd_generator, get_jd_parser, get_workflow)
from core.logging_config import get_logger
from models.conversation_models import (ConversationFinalizeRequest,
                                        ConversationFinalizeResponse,
                                        ConversationMessageRequest,
                                        ConversationMessageResponse,
                                        ConversationStartRequest,
                                        ConversationStartResponse,
                                        GenerateJDRequest, GenerateJDResponse,
                                        RefineJDRequest, RefineJDResponse)
from services.conversation_manager import ConversationManager
from services.jd_generator import JDGeneratorService
from services.jd_parser import JDParser
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
            "turn_count": state.turn_count
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
    workflow: ScorecardWorkflow = Depends(get_workflow) 
):
    """
    Finalize conversation and trigger search.
    
    This endpoint:
    1. Validates the ideal profile
    2. Generates a new search session ID
    3. Triggers the V3 workflow in background
    4. Returns search session info for progress tracking
    
    Args:
        session_id: Conversation session ID
        request: Final adjustments and model config
    
    Returns:
        Search session ID and status
    """
    
    try:
        logger.info(f"Finalizing conversation {session_id} for {username}")
        
        # Load conversation state
        state = await conversation_manager._load_state(session_id)
        
        if not state:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Apply final adjustments if provided
        if request.final_profile_adjustments:
            state.ideal_profile = request.final_profile_adjustments
        
        # VALIDATE PROFILE
        if not state.ideal_profile.role_title:
            raise HTTPException(status_code=400, detail="Role title is required")
        
        if not state.ideal_profile.must_have_skills or len(state.ideal_profile.must_have_skills) < 3:
            raise HTTPException(
                status_code=400, 
                detail="At least 3 must-have skills required"
            )
        
        # Mark conversation as ready
        state.ready_to_search = True
        state.stage = "ready"
        await conversation_manager._save_state(state)
        
        # ✅ GENERATE SEARCH SESSION ID (different from conversation session)
        search_session_id = str(uuid.uuid4())
        
        logger.info(f"Triggering V3 workflow:")
        logger.info(f"  - Conversation session: {session_id}")
        logger.info(f"  - Search session: {search_session_id}")
        logger.info(f"  - Profile: {state.ideal_profile.role_title}")
        
        # ✅ TRIGGER V3 WORKFLOW IN BACKGROUND
        # This runs: conversation → ideal profile → search → score → enrich
        background_tasks.add_task(
            workflow.execute,
            session_id=search_session_id,  # Search workflow session ID
            username=username,
            conversation_session_id=session_id,  # Link to conversation
            mode="v3"  # Use V3 mode with enrichment
        )
        
        logger.info(f"✅ V3 workflow started in background for {search_session_id}")
        
        # ✅ RETURN IMMEDIATELY (workflow runs in background)
        return ConversationFinalizeResponse(
            session_id=search_session_id,  # Return the SEARCH session ID for polling
            search_triggered=True,
            message="Search initiated! Poll /session/{session_id}/status for progress.",
            estimated_candidates=None  # Will be filled after search completes
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finalizing conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
