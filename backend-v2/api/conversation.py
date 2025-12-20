"""
Conversation API Routes
======================
FastAPI routes for the conversational interface with Donna.
"""

import asyncio
import base64
import uuid
from datetime import datetime
from typing import Dict, List

from fastapi import (APIRouter, BackgroundTasks, Depends, File, HTTPException,
                     UploadFile)
from fastapi.params import Body

from core.dependencies import (get_conversation_manager, get_current_username,
                               get_jd_generator, get_jd_parser, get_mongodb,
                               get_pipeline_service)
from core.logging_config import get_logger
from data.mongodb import MongoDB
from models.conversation_models import (ConversationFinalizeRequest,
                                        ConversationFinalizeResponse,
                                        ConversationMessageRequest,
                                        ConversationMessageResponse,
                                        ConversationStartRequest,
                                        ConversationStartResponse,
                                        CreatePipelineRequest, FeedbackRequest,
                                        FeedbackResponse, GenerateJDRequest,
                                        GenerateJDResponse,
                                        ManualImportRequest, RefineJDRequest,
                                        RefineJDResponse, RefineSearchRequest)
from models.pipeline_models import CandidateStage, ContactFetchSource
from models.scheduling_models import get_current_timestamp
from services.conversation_manager import ConversationManager
from services.jd_generator import JDGeneratorService
from services.jd_parser import JDParser
from services.pipeline_service import PipelineService

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

# ================================================================
# FINALIZE CONVERSATION - SIMPLIFIED RANKING
# ================================================================

@router.post("/{session_id}/finalize", response_model=ConversationFinalizeResponse)
async def finalize_conversation(
    session_id: str,
    request: ConversationFinalizeRequest,
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Finalize conversation and rank candidates using LLM.
    
    This triggers simple ranking based on:
    - Skills match
    - Experience fit
    - Location match
    - Industry relevance
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
                if value:
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
        
        logger.info(f"✅ Ranking {len(sample_candidates)} candidates using LLM")
        
        # Store immediately in MongoDB with "processing" status
        results_session_id = f"results_{uuid.uuid4().hex[:12]}"
        
        results_doc = {
            "session_id": results_session_id,
            "conversation_session_id": session_id,
            "username": username,
            "ideal_profile": state.ideal_profile.dict(),
            "total_found": len(sample_candidates),
            "candidates": sample_candidates,  # for backward compat
            "search_results": sample_candidates,  # matches manual import
            "selected_candidate_ids": [],
            "source": "donna_search", 
            "created_at": datetime.utcnow().isoformat(),
            "status": "processing"
        }
        
        await mongodb.main_db["conversation_sessions"].insert_one(results_doc)
        
        # Trigger ranking in background
        background_tasks.add_task(
            _rank_and_update_results,
            results_session_id=results_session_id,
            conversation_session_id=session_id,
            username=username,
            ideal_profile=state.ideal_profile.dict(),
            candidates=sample_candidates,
            conversation_manager=conversation_manager,
            mongodb=mongodb
        )
        
        return ConversationFinalizeResponse(
            session_id=results_session_id,
            search_triggered=True,
            message=f"Ranking {len(sample_candidates)} candidates using AI! This will take ~30 seconds.",
            estimated_candidates=len(sample_candidates)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finalizing conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _rank_and_update_results(
    results_session_id: str,
    conversation_session_id: str,
    username: str,
    ideal_profile: Dict,
    candidates: List[Dict],
    conversation_manager: ConversationManager,
    mongodb: MongoDB
):
    """Background task for LLM-based ranking."""
    
    try:
        logger.info(f"🚀 Starting LLM ranking for {results_session_id}")
        
        # Rank candidates using LLM
        ranked_candidates = await _rank_candidates_with_llm(
            candidates=candidates,
            ideal_profile=ideal_profile,
            conversation_manager=conversation_manager,
            username=username
        )
        
        # Update results in MongoDB
        await mongodb.main_db["conversation_sessions"].update_one(
            {"session_id": results_session_id},
            {
                "$set": {
                    "candidates": ranked_candidates,
                    "status": "ready",
                    "ranked_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        logger.info(f"✅ Ranking completed for {results_session_id}")
        
    except Exception as e:
        logger.error(f"❌ Ranking failed for {results_session_id}: {e}", exc_info=True)
        
        # Update status to failed
        await mongodb.main_db["conversation_sessions"].update_one(
            {"session_id": results_session_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(e),
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )

async def _rank_manual_import_candidates(
    session_id: str,
    username: str,
    ideal_profile: Dict,
    conversation_manager: ConversationManager,
    mongodb: MongoDB
):
    """Rank manual import candidates."""
    try:
        session = await mongodb.main_db["conversation_sessions"].find_one(
            {"session_id": session_id}
        )
        
        if not session:
            return
        
        candidates = session.get("search_results", [])
        
        # Rank using same logic as Donna
        ranked = await _rank_candidates_with_llm(
            candidates=candidates,
            ideal_profile=ideal_profile,
            conversation_manager=conversation_manager,
            username=username
        )
        
        # Update with ranked results
        await mongodb.main_db["conversation_sessions"].update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "search_results": ranked,
                    "sample_candidates": ranked,
                    "status": "ready",
                    "ranked_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        logger.info(f"✅ Ranked {len(ranked)} manual import candidates")
        
    except Exception as e:
        logger.error(f"❌ Manual import ranking failed: {e}")

async def _rank_candidates_with_llm(
    candidates: List[Dict],
    ideal_profile: Dict,
    conversation_manager: ConversationManager,
    username: str
) -> List[Dict]:
    """
    Use LLM to rank candidates based on fit.
    
    Returns candidates sorted by relevance with match scores.
    """
    
    import json

    # Prepare candidate summaries for LLM
    candidate_summaries = []
    for idx, c in enumerate(candidates):
        candidate_info = c.get("candidate", {})
        
        summary = {
            "id": idx,
            "name": f"{candidate_info.get('first_name', '')} {candidate_info.get('last_name', '')}".strip(),
            "title": candidate_info.get("title", "Unknown"),
            "location": candidate_info.get("location", "Unknown"),
            "company": candidate_info.get("current_company", "Unknown"),
            "experience_years": candidate_info.get("experience_years", 0),
            "skills": candidate_info.get("expertise", "").split(",")[:10] if candidate_info.get("expertise") else [],
            "industry": candidate_info.get("current_industry", "Unknown")
        }
        candidate_summaries.append(summary)
    
    # Build prompt for LLM
    system_prompt = """You are an expert recruiter analyzing candidate fit for a job position.

Your task is to rank candidates from best to worst based on how well they match the ideal profile.

Consider:
1. **Skills Match**: Do they have the required technical skills?
2. **Experience Level**: Does their seniority match the requirement?
3. **Industry Fit**: Do they have relevant industry experience?
4. **Location**: Are they in preferred locations?

For each candidate, provide:
- overall_match_score: 0-100 (higher = better fit)
- match_label: "Excellent Match" | "Great Match" | "Good Match" | "Fair Match" | "Below Target"
- strengths: List of 2-3 key strengths
- concerns: List of 1-2 concerns (if any)
- summary: 1-2 sentence explanation of fit

Return JSON array sorted by match score (highest first):
[
  {
    "id": 0,
    "overall_match_score": 85,
    "match_label": "Excellent Match",
    "summary": "Strong skills in React and Node.js with 7+ years experience",
    "strengths": ["Expert in React", "7 years experience", "SaaS background"],
    "concerns": ["Location not ideal"]
  },
  ...
]

Be objective and specific. Only give high scores (80+) to truly excellent matches."""

    user_prompt = f"""IDEAL PROFILE:
Role: {ideal_profile.get('role_title', 'Unknown')}
Required Skills: {', '.join(ideal_profile.get('must_have_skills', []))}
Preferred Skills: {', '.join(ideal_profile.get('nice_to_have_skills', []))}
Seniority: {ideal_profile.get('seniority', 'Not specified')}
Experience: {ideal_profile.get('experience_years', 'Not specified')}
Industries: {', '.join(ideal_profile.get('industries', []))}
Locations: {', '.join(ideal_profile.get('locations', []))}

CANDIDATES TO RANK:
{json.dumps(candidate_summaries, indent=2)}

Rank these candidates from best to worst fit. Return ONLY the JSON array."""

    try:
        model_config = await conversation_manager.model_config.get_user_config(username)
        
        response = await conversation_manager.model_config.call_model(
            model_config=model_config,
            model_purpose="json_extraction",  # Use JSON model
            system_prompt=system_prompt,
            user_message=user_prompt,
            temperature=0.3,
            username=username
        )
        
        # Parse JSON response
        response_text = response.strip()
        
        # Handle markdown code blocks
        if "```" in response_text:
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.split("```")[0]
        
        rankings = json.loads(response_text)
        
        # Apply rankings to original candidates
        ranked_candidates = []
        for rank in rankings:
            candidate_idx = rank["id"]
            if candidate_idx < len(candidates):
                candidate = candidates[candidate_idx].copy()
                
                # Add match analysis
                candidate["match_analysis"] = {
                    "overall_match_score": rank["overall_match_score"],
                    "match_label": rank["match_label"],
                    "summary": rank["summary"],
                    "strengths": [{"strength": s} for s in rank.get("strengths", [])],
                    "concerns": [{"concern": c} for c in rank.get("concerns", [])]
                }
                
                # Backward compatibility
                candidate["match_score"] = rank["overall_match_score"]
                candidate["score"] = rank["overall_match_score"]
                
                ranked_candidates.append(candidate)
        
        logger.info(f"✅ LLM ranked {len(ranked_candidates)} candidates")
        return ranked_candidates
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Failed to parse LLM ranking response: {e}")
        logger.error(f"   Raw response: {response[:500]}")
        
        # Fallback: return candidates with default scores
        return [
            {
                **c,
                "match_score": 50,
                "match_analysis": {
                    "overall_match_score": 50,
                    "match_label": "Needs Review",
                    "summary": "Unable to rank automatically. Please review manually.",
                    "strengths": [],
                    "concerns": []
                }
            }
            for c in candidates
        ]
        
    except Exception as e:
        logger.error(f"❌ LLM ranking failed: {e}", exc_info=True)
        # Return original candidates unchanged
        return candidates

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
        
        # Store in Redis for re`fin`ement tracking
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
    request: dict,
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    mongodb: MongoDB = Depends(get_mongodb)
):
    try:
        state = await conversation_manager._load_state(session_id)
        if not state:
            raise HTTPException(status_code=404, detail="Session not found")
        
        accepted = request.get("accepted_candidates", [])
        candidates = [a.get("candidate") for a in accepted if a.get("candidate")]
        
        # Trigger ranking
        await conversation_manager.rank_and_save_candidates(
            session_id=session_id,  # Same session
            username=username,
            ideal_profile=state.ideal_profile.dict(),
            candidates=candidates,
            mongodb=mongodb
        )
        
        return {
            "status": "started",
            "session_id": session_id,  # Return original session_id
            "total_candidates": len(candidates),
            "message": "Ranking candidates..."
        }
    except Exception as e:
        logger.error(f"Error starting ranking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# Manual Import
# ================================================================

@router.post("/manual-import")
async def create_manual_import(
    request: ManualImportRequest,
    current_user: dict = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    mongodb: MongoDB = Depends(get_mongodb),
    jd_parser: JDParser = Depends(get_jd_parser)
):
    """
    Create a conversation session from manual candidate import.
    
    This allows HR to:
    1. Paste/upload JD or provide ideal profile
    2. Add candidates manually with LinkedIn URLs + extra info
    3. Creates a session that shows in results page
    4. Optionally scrapes LinkedIn profiles in background
    """
    try:
        # Parse JD if only jd_text provided
        ideal_profile = request.ideal_profile
        if request.jd_text and not ideal_profile:
            parsed_jd = await jd_parser.parse_jd_text(
                jd_text=request.jd_text,
                username=current_user
            )
            ideal_profile = parsed_jd  # Now we have structured data
            
        result = await conversation_manager.create_manual_import(
            username=current_user,
            jd_text=request.jd_text,
            ideal_profile=ideal_profile,
            candidates=[c.model_dump() for c in request.candidates],
            pipeline_name=request.pipeline_name
        )
        
        session_id = result["session_id"]
        print('result',result,ideal_profile)
        # Background scrape if enabled
        if request.auto_scrape:
            logger.info(f"Waiting for candidate lookup for session {result['session_id']}...")
            await conversation_manager.scrape_manual_candidates(result["session_id"])
            if ideal_profile: 
                await _rank_manual_import_candidates(                                    session_id=session_id,
                    username=current_user,
                    ideal_profile=ideal_profile,
                    conversation_manager=conversation_manager,
                    mongodb=mongodb)
        
        
        return {
            "success": True,
            "session_id": result["session_id"],
            "candidates_count": len(request.candidates),
            "message": f"Created import with {len(request.candidates)} candidates",
            "status": "ready"
        }
        
    except Exception as e:
        logger.error(f"Manual import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# Results page api's
# ================================================================

@router.post("/{session_id}/create-pipeline")
async def create_pipeline_from_session(
    session_id: str,
    request: CreatePipelineRequest,
    current_user: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Create individual pipelines for selected candidates from session."""
    try:
        session = await conversation_manager.get_session(session_id)
        if not session or session.get("username") != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Extract valid candidate IDs
        all_candidates = session.get("search_results") or session.get("sample_candidates") or []
        valid_ids = {
            str(c.get("candidate_id") or c.get("candidate", {}).get("candidate_id"))
            for c in all_candidates if c.get("candidate_id")
        }
        
        selected_ids = [cid for cid in request.shortlisted_candidate_ids if cid in valid_ids]
        if not selected_ids:
            raise HTTPException(status_code=400, detail="No valid candidates selected")
        
        # Create pipelines
        job_data = session.get("ideal_profile", {})
        pipeline_ids = await pipeline_service.create_pipelines_from_search(
            username=current_user,
            conversation_session_id=session_id,
            search_session_id=session_id,
            job_data=job_data,
            candidate_ids=selected_ids
        )
        
        # Create mapping
        candidate_pipeline_mapping = {
            selected_ids[i]: pipeline_ids[i] 
            for i in range(len(selected_ids))
        }
        
        # Link pipelines to session
        batch_id = await conversation_manager.create_pipeline_batch(
            session_id=session_id,
            pipeline_ids=pipeline_ids,
            candidate_pipeline_mapping=candidate_pipeline_mapping
        )
        
        return {
            "success": True,
            "batch_id": batch_id,
            "pipeline_ids": pipeline_ids,
            "count": len(pipeline_ids),
            "message": f"Created {len(pipeline_ids)} pipelines"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/results")
async def get_session_results(
    session_id: str,
    current_user: dict = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """
    Get session results for the results page.
    
    Returns candidates from either:
    - Donna search (search_results)
    - Manual import (sample_candidates with manual_data)
    """
    try:
        session = await conversation_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if session.get("username") != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get candidates from appropriate field
        candidates = (
            session.get("search_results") or 
            session.get("sample_candidates") or 
            session.get("candidates") or 
            []
        )
        # Get selected IDs
        selected_ids = set(session.get("selected_candidate_ids", []))
        
        normalized = []
        for c in candidates:
            # Handle nested structure (Donna) vs flat structure (manual import)
            candidate_data = c.get("candidate", c)  # Extract nested data or use as-is
            
            candidate_id = str(
                candidate_data.get("candidate_id") or 
                candidate_data.get("_id") or 
                c.get("candidate_id") or  # Check wrapper too
                ""
            )
            
            normalized.append({
                "candidate_id": candidate_id,
                "linkedin_url": candidate_data.get("linkedin_url", ""),
                "name": (
                    candidate_data.get("name") or 
                    candidate_data.get("full_name") or 
                    f"{candidate_data.get('first_name', '')} {candidate_data.get('last_name', '')}".strip() or 
                    "Unknown"
                ),
                "headline": candidate_data.get("headline") or candidate_data.get("title"),
                "current_company": candidate_data.get("current_company"),
                "current_title": candidate_data.get("current_title") or candidate_data.get("title"),
                "location": candidate_data.get("location"),
                "experience_years": candidate_data.get("experience_years") or candidate_data.get("total_experience_years"),
                "skills": candidate_data.get("skills", [])[:15],
                "match_score": c.get("match_score") or c.get("score"),  # Score on wrapper
                "match_label": c.get("match_label"),  # Label on wrapper
                "match_analysis": c.get("match_analysis"),
                "profile_picture_url": candidate_data.get("profile_picture_url"),
                "is_selected": candidate_id in selected_ids,
                "manual_data": candidate_data.get("manual_data"),
                "source": c.get("source", "donna_search"),
                "profile_id": str(candidate_data.get("_id", "")),
            })
        
        return {
            "success": True,
            "session_id": session_id,
            "source": session.get("source", "donna_search"),
            "status": session.get("status", "ready"),
            "candidates": normalized,
            "selected_candidate_ids": list(selected_ids),
            "total_candidates": len(normalized),
            "ideal_profile": session.get("ideal_profile", {}),
            "pipeline_id": session.get("pipeline_id"),
            "pipeline_created_at": session.get("pipeline_created_at"),
            "created_at": session.get("created_at"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get results failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/select-candidates")
async def select_candidates(
    session_id: str,
    request: dict,  # {candidate_ids: List[str], selected: bool}
    current_user: dict = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """Mark candidates as selected/unselected."""
    try:
        result = await conversation_manager.mark_candidates_selected(
            session_id=session_id,
            candidate_ids=request.get("candidate_ids", []),
            selected=request.get("selected", True)
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Selection update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/selected")
async def get_selected_candidates(
    session_id: str,
    current_user: dict = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager)
):
    """Get selected candidate IDs."""
    try:
        selected_ids = await conversation_manager.get_selected_candidates(session_id)
        return {"selected_candidate_ids": selected_ids}
        
    except Exception as e:
        logger.error(f"Get selected failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    
@router.get("/list/pipeline-sessions")
async def list_pipeline_sessions(
    current_user: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """List all conversation sessions that have pipelines created with detailed status."""
    try:
        sessions = await conversation_manager.conversation_sessions.find({
            "username": current_user,
            "pipelines_created": True
        }).sort("pipeline_created_at", -1).to_list(length=50)
        logger.info(f'sessions: {sessions}')
        session_summaries = []
        for s in sessions:
            s.pop("_id", None)
            
            pipeline_ids = s.get("pipeline_ids", [])
            candidate_pipeline_mapping = s.get("candidate_pipeline_mapping", {})
            
            # Initialize counts
            status_counts = {
                "pending": 0,
                "enriching": 0,
                "enriched": 0,
                "outreach_sent": 0,
                "responded": 0,
                "interview_scheduled": 0,
                "interview_completed": 0,
                "failed": 0
            }
            
            # Action flags
            needs_action = {
                "needs_email_input": 0,
                "needs_outreach_start": 0,
                "needs_review": 0
            }
            
            # Fetch actual pipeline statuses
            for pipeline_id in pipeline_ids:
                try:
                    pipeline = await pipeline_service.get_pipeline(pipeline_id)
                    if not pipeline or not pipeline.candidate:
                        continue
                    
                    candidate = pipeline.candidate
                    stage = candidate.stage.value
                    
                    # Count by stage
                    if stage == "sourced" or stage == "shortlisted":
                        status_counts["pending"] += 1
                    elif stage == "enriching":
                        status_counts["enriching"] += 1
                    elif stage == "enriched":
                        status_counts["enriched"] += 1
                        # Check if needs outreach
                        if candidate.contact.email and not candidate.outreach:
                            needs_action["needs_outreach_start"] += 1
                    elif stage == "outreach_sent":
                        status_counts["outreach_sent"] += 1
                    elif stage == "responded":
                        status_counts["responded"] += 1
                        needs_action["needs_review"] += 1
                    elif stage == "scheduled":
                        status_counts["interview_scheduled"] += 1
                    elif stage == "interviewed":
                        status_counts["interview_completed"] += 1
                    elif stage == "enrichment_failed":
                        status_counts["failed"] += 1
                        # Check if email is missing
                        if not candidate.contact.email:
                            needs_action["needs_email_input"] += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to get pipeline {pipeline_id}: {e}")
                    continue
            
            session_summaries.append({
                "session_id": s["session_id"],
                "batch_id": s.get("pipeline_batch_id"),
                "source": s.get("source", "donna_search"),
                "job_title": s.get("ideal_profile", {}).get("role_title", "Untitled Position"),
                "total_candidates": len(pipeline_ids),
                "status_counts": status_counts,
                "needs_action": needs_action,
                "created_at": s.get("pipeline_created_at"),
                "last_updated": s.get("updated_at")
            })
        
        return {
            "success": True,
            "sessions": session_summaries,
            "total": len(session_summaries)
        }
        
    except Exception as e:
        logger.error(f"Failed to list pipeline sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/{session_id}/pipeline-status")
async def get_pipeline_batch_status(
    session_id: str,
    current_user: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Get detailed status of all pipelines in a session."""
    try:
        session = await conversation_manager.get_session(session_id)
        if not session or session.get("username") != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        pipeline_ids = session.get("pipeline_ids", [])
        candidates = session.get("search_results") or session.get("sample_candidates") or []
        
        # Fetch pipeline statuses
        candidate_statuses = []
        for candidate in candidates:
            pipeline_id = candidate.get("pipeline_id")
            if not pipeline_id:
                continue
            
            # Get pipeline
            pipeline = await pipeline_service.get_pipeline(pipeline_id)
            if not pipeline:
                continue
            
            pipe_candidate = pipeline.candidate
            
            candidate_statuses.append({
                "candidate_id": candidate.get("candidate_id"),
                "pipeline_id": pipeline_id,
                "name": pipe_candidate.display_name,
                "headline": pipe_candidate.headline,
                "location": pipe_candidate.location,
                "linkedin_url": pipe_candidate.linkedin_url,
                "profile_picture_url": pipe_candidate.profile_picture_url,
                
                # Status
                "stage": pipe_candidate.stage.value,
                "stage_label": pipeline.get_stage_label(),
                "stage_updated_at": pipe_candidate.stage_updated_at,
                
                # Enrichment
                "is_enriched": pipe_candidate.enrichment.is_enriched,
                "match_score": pipe_candidate.enrichment.match_score,
                "match_label": pipe_candidate.enrichment.match_label,
                "has_email": bool(pipe_candidate.contact.email),
                "enrichment_error": pipe_candidate.enrichment.enrichment_error,
                
                # Outreach
                "outreach_sent": bool(pipe_candidate.outreach),
                "outreach_opened": pipe_candidate.outreach.total_opens > 0 if pipe_candidate.outreach else False,
                "outreach_clicked": pipe_candidate.outreach.total_clicks > 0 if pipe_candidate.outreach else False,
                
                # Manual data (if manual import)
                "manual_data": candidate.get("manual_data")
            })
        
        return {
            "success": True,
            "session_id": session_id,
            "batch_id": session.get("pipeline_batch_id"),
            "job_title": session.get("ideal_profile", {}).get("role_title"),
            "jd_text": session.get("jd_text"),
            "candidates": candidate_statuses,
            "total": len(candidate_statuses)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get batch status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/batch-enrich")
async def start_batch_enrichment(
    session_id: str,
    background_tasks: BackgroundTasks,
    request: dict = Body(...),  # {pipeline_ids: List[str]}
    current_user: str = Depends(get_current_username),
    conversation_manager: ConversationManager = Depends(get_conversation_manager),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Start enrichment for multiple candidates in parallel."""
    try:
        session = await conversation_manager.get_session(session_id)
        if not session or session.get("username") != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        pipeline_ids = request.get("pipeline_ids", [])
        if not pipeline_ids:
            raise HTTPException(status_code=400, detail="No pipelines selected")
        
        # Validate pipeline ownership and check enrichment status
        pipelines_to_enrich = []
        already_enriched = []
        
        for pipeline_id in pipeline_ids:
            pipeline = await pipeline_service.get_pipeline(pipeline_id)
            if not pipeline or pipeline.username != current_user:
                raise HTTPException(status_code=403, detail=f"Access denied to {pipeline_id}")
            
            # Check if already enriched
            if pipeline.candidate and pipeline.candidate.enrichment.is_enriched:
                already_enriched.append(pipeline_id)
                logger.info(f"⏭️  Skipping {pipeline_id} - already enriched")
            else:
                pipelines_to_enrich.append(pipeline_id)
        
        if not pipelines_to_enrich:
            return {
                "success": True,
                "message": "All selected candidates are already enriched",
                "already_enriched": len(already_enriched),
                "pipeline_ids": pipeline_ids
            }
        
        # Start enrichment in background only for non-enriched pipelines
        background_tasks.add_task(
            _batch_enrich_pipelines,
            session_id=session_id,
            pipeline_ids=pipelines_to_enrich,
            pipeline_service=pipeline_service,
            conversation_manager=conversation_manager
        )
        
        # Update session status
        await conversation_manager.conversation_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "enrichment_started_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Started enrichment for {len(pipelines_to_enrich)} candidates",
            "enriching": len(pipelines_to_enrich),
            "already_enriched": len(already_enriched),
            "pipeline_ids": pipelines_to_enrich,
            "skipped_pipeline_ids": already_enriched
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch enrichment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _batch_enrich_pipelines(
    session_id: str,
    pipeline_ids: List[str],
    pipeline_service: PipelineService,
    conversation_manager: ConversationManager
):
    """Background task to enrich multiple pipelines."""
    logger.info(f"🚀 Starting batch enrichment for {len(pipeline_ids)} pipelines")
    
    enriched_count = 0
    failed_count = 0
    skipped_count = 0
    
    for pipeline_id in pipeline_ids:
        try:
            # Double-check if already enriched (in case status changed)
            pipeline = await pipeline_service.get_pipeline(pipeline_id)
            if not pipeline:
                logger.warning(f"⚠️  Pipeline {pipeline_id} not found")
                continue
            
            # Skip if already enriched
            if pipeline.candidate and pipeline.candidate.enrichment.is_enriched:
                logger.info(f"⏭️  Skipping {pipeline_id} - already enriched")
                skipped_count += 1
                
                # Ensure status is set correctly in session
                await conversation_manager.conversation_sessions.update_one(
                    {
                        "session_id": session_id,
                        "$or": [
                            {"sample_candidates.pipeline_id": pipeline_id},
                            {"search_results.pipeline_id": pipeline_id}
                        ]
                    },
                    {
                        "$set": {
                            "sample_candidates.$[elem].enrichment_status": "enriched",
                            "search_results.$[elem].enrichment_status": "enriched"
                        }
                    },
                    array_filters=[{"elem.pipeline_id": pipeline_id}]
                )
                continue
            
            # Update candidate status to enriching
            await conversation_manager.conversation_sessions.update_one(
                {
                    "session_id": session_id,
                    "$or": [
                        {"sample_candidates.pipeline_id": pipeline_id},
                        {"search_results.pipeline_id": pipeline_id}
                    ]
                },
                {
                    "$set": {
                        "sample_candidates.$[elem].enrichment_status": "enriching",
                        "search_results.$[elem].enrichment_status": "enriching"
                    }
                },
                array_filters=[{"elem.pipeline_id": pipeline_id}]
            )
            
            # Start enrichment
            await pipeline_service._run_single_enrichment(
                pipeline_id=pipeline_id,
                include_contact_fetch=True
            )
            
            # Update status based on result
            pipeline = await pipeline_service.get_pipeline(pipeline_id)
            if pipeline.candidate.enrichment.is_enriched:
                final_status = "enriched"
                enriched_count += 1
                logger.info(f"✅ Enriched {pipeline_id}")
            else:
                final_status = "failed"
                failed_count += 1
                logger.warning(f"⚠️  Enrichment failed for {pipeline_id}")
            
            await conversation_manager.conversation_sessions.update_one(
                {
                    "session_id": session_id,
                    "$or": [
                        {"sample_candidates.pipeline_id": pipeline_id},
                        {"search_results.pipeline_id": pipeline_id}
                    ]
                },
                {
                    "$set": {
                        "sample_candidates.$[elem].enrichment_status": final_status,
                        "search_results.$[elem].enrichment_status": final_status
                    }
                },
                array_filters=[{"elem.pipeline_id": pipeline_id}]
            )
            
            # Rate limiting (only between actual API calls)
            if enriched_count + failed_count < len(pipeline_ids) - skipped_count:
                await asyncio.sleep(3)
            
        except Exception as e:
            logger.error(f"❌ Enrichment failed for {pipeline_id}: {e}", exc_info=True)
            failed_count += 1
            
            await conversation_manager.conversation_sessions.update_one(
                {
                    "session_id": session_id,
                    "$or": [
                        {"sample_candidates.pipeline_id": pipeline_id},
                        {"search_results.pipeline_id": pipeline_id}
                    ]
                },
                {
                    "$set": {
                        "sample_candidates.$[elem].enrichment_status": "failed",
                        "search_results.$[elem].enrichment_status": "failed",
                        "sample_candidates.$[elem].enrichment_error": str(e)[:200],
                        "search_results.$[elem].enrichment_error": str(e)[:200]
                    }
                },
                array_filters=[{"elem.pipeline_id": pipeline_id}]
            )
    
    # Final summary
    logger.info(f"✅ Batch enrichment completed for session {session_id}")
    logger.info(f"   📊 Stats: {enriched_count} enriched, {skipped_count} skipped, {failed_count} failed")
    
    # Update session with completion status
    await conversation_manager.conversation_sessions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "enrichment_completed_at": datetime.utcnow().isoformat(),
                "enrichment_stats": {
                    "enriched": enriched_count,
                    "skipped": skipped_count,
                    "failed": failed_count,
                    "total": len(pipeline_ids)
                },
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )