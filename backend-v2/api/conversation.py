"""
Conversation API Routes
======================
FastAPI routes for the conversational interface with Donna.

Endpoints:
- POST /conversation/start - Start new conversation
- POST /conversation/{session_id}/message - Send message
- GET /conversation/{session_id} - Get conversation state
- POST /conversation/{session_id}/finalize - Finalize and search
- POST /conversation/{session_id}/upload-jd - Upload JD file
"""

import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from models.conversation_models import (ConversationFinalizeRequest,
                                        ConversationFinalizeResponse,
                                        ConversationMessageRequest,
                                        ConversationMessageResponse,
                                        ConversationStartRequest,
                                        ConversationStartResponse,
                                        ConversationState)
from services.conversation_manager import ConversationManager
from services.jd_parser import JDParser

# ================================================================
# ROUTER SETUP
# ================================================================

router = APIRouter(prefix="/conversation", tags=["Conversation"])


# ================================================================
# DEPENDENCIES
# ================================================================

def get_conversation_manager() -> ConversationManager:
    """Dependency to get conversation manager."""
    # This will be injected by the main app
    # For now, we'll mark it as a placeholder
    raise NotImplementedError("Inject conversation_manager dependency")


def get_jd_parser() -> JDParser:
    """Dependency to get JD parser."""
    raise NotImplementedError("Inject jd_parser dependency")


def get_current_user():
    """Dependency to get current authenticated user."""
    # Will be injected from auth system
    raise NotImplementedError("Inject auth dependency")


# ================================================================
# START CONVERSATION
# ================================================================

@router.post("/start", response_model=ConversationStartResponse)
async def start_conversation(
    request: ConversationStartRequest,
    current_user: Dict = Depends(get_current_user),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    jd_parser: JDParser = Depends(get_jd_parser)
):
    """
    Start a new conversation with Donna.
    
    Can optionally include:
    - Initial message
    - Uploaded JD file (base64 encoded)
    
    Returns:
        Donna's greeting and initial profile card
    """
    
    try:
        # Generate session ID
        session_id = f"conv_{uuid.uuid4().hex}"
        username = current_user.get("username")
        
        # Parse JD if provided
        jd_data = None
        if request.jd_file_content and request.jd_file_name:
            jd_data = await jd_parser.parse_jd(
                file_content=request.jd_file_content,
                file_name=request.jd_file_name,
                username=username
            )
        
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
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# SEND MESSAGE
# ================================================================

@router.post("/{session_id}/message", response_model=ConversationMessageResponse)
async def send_message(
    session_id: str,
    request: ConversationMessageRequest,
    current_user: Dict = Depends(get_current_user),
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
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET CONVERSATION STATE
# ================================================================

@router.get("/{session_id}")
async def get_conversation(
    session_id: str,
    current_user: Dict = Depends(get_current_user),
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
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# FINALIZE CONVERSATION
# ================================================================

@router.post("/{session_id}/finalize", response_model=ConversationFinalizeResponse)
async def finalize_conversation(
    session_id: str,
    request: ConversationFinalizeRequest,
    current_user: Dict = Depends(get_current_user),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Finalize conversation and trigger search.
    
    This endpoint:
    1. Validates the ideal profile
    2. Triggers the actual candidate search
    3. Returns search session info
    
    Args:
        session_id: Conversation session ID
        request: Final adjustments and model config
    
    Returns:
        Search status
    """
    
    try:
        # Load conversation state
        state = await conversation_manager._load_state(session_id)
        
        if not state:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Apply final adjustments if provided
        if request.final_profile_adjustments:
            state.ideal_profile = request.final_profile_adjustments
        
        # Validate profile
        if not state.ideal_profile.role_title:
            raise HTTPException(status_code=400, detail="Role title is required")
        
        if len(state.ideal_profile.must_have_skills) < 3:
            raise HTTPException(status_code=400, detail="At least 3 must-have skills required")
        
        # Mark as ready
        state.ready_to_search = True
        state.stage = "ready"
        await conversation_manager._save_state(state)
        
        # TODO: Trigger actual search workflow
        # This will be integrated with the existing search system
        
        return ConversationFinalizeResponse(
            session_id=session_id,
            search_triggered=True,
            message="Search initiated! This will take about 30 seconds.",
            estimated_candidates=None  # Will be filled by search system
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# UPLOAD JD (ALTERNATIVE ENDPOINT)
# ================================================================

@router.post("/{session_id}/upload-jd")
async def upload_jd(
    session_id: str,
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user),
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
        import base64
        file_content_b64 = base64.b64encode(file_content).decode('utf-8')
        
        # Parse JD
        username = current_user.get("username")
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
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# RESET CONVERSATION
# ================================================================

@router.delete("/{session_id}")
async def reset_conversation(
    session_id: str,
    current_user: Dict = Depends(get_current_user),
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
        
        return {"message": "Conversation reset successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))