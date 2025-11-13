"""
Scorecard API Endpoints
=======================
These are the HTTP endpoints that your frontend calls.

All the business logic is in services/ - these endpoints just handle HTTP.
"""

import uuid
from typing import Optional

# Import dependencies
from core.dependencies import (get_current_username, get_mongodb,
                               get_optional_username, get_workflow)
from core.logging_config import get_logger
from data.mongodb import MongoDB
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
# Import models (request/response schemas)
from models.requests import FollowupAnswersRequest, ParsePromptRequest
from models.responses import ParsePromptResponse, ScorecardStatusResponse
from services.scorecard_workflow import ScorecardWorkflow

# Create router
router = APIRouter(prefix="/scorecard")

# Get the logger for this module
logger = get_logger(__name__)

@router.post("/parse-prompt", response_model=ParsePromptResponse, tags=["Scorecard"])
async def parse_prompt(
    request: ParsePromptRequest,
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    workflow: ScorecardWorkflow = Depends(get_workflow)
):
    """
    Start a new scorecard workflow.
    
    This endpoint:
    1. Creates a unique session ID
    2. Starts the workflow in the background
    3. Returns immediately with the session ID
    4. Client can poll /session/{session_id}/status for progress
    
    The actual workflow (parsing, searching, scoring) happens asynchronously.
    
    Example request:
        POST /parse-prompt
        {
            "prompt": "Find a Senior Python Developer in San Francisco with 5+ years experience"
        }
    
    Example response:
        {
            "session_id": "abc-123-def-456",
            "status": "processing",
            "message": "Workflow started successfully"
        }
    """
    
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    logger.debug(f"\nNew scorecard request from {username}")
    logger.debug(f"   Session: {session_id}")
    logger.debug(f"   Prompt: {request.prompt[:80]}...")
    
    # Start workflow in background
    # This allows us to return immediately while processing continues
    background_tasks.add_task(
        workflow.execute,
        session_id=session_id,
        prompt=request.prompt,
        username=username
    )
    
    return ParsePromptResponse(
        session_id=session_id,
        status="processing",
        message="Workflow started successfully. Use session_id to check status."
    )


@router.get("/session/{session_id}/status", response_model=ScorecardStatusResponse, tags=["Scorecard"])
async def get_session_status(
    session_id: str,
    workflow: ScorecardWorkflow = Depends(get_workflow)
):
    """
    Get the current status of a scorecard workflow.
    
    This endpoint is polled by the frontend to show real-time progress.
    
    Example request:
        GET /session/abc-123/status
    
    Example response (in progress):
        {
            "session_id": "abc-123",
            "status": "searching",
            "progress": 40,
            "message": "Searching database for candidates..."
        }
    
    Example response (completed):
        {
            "session_id": "abc-123",
            "status": "completed",
            "progress": 100,
            "message": "Done!",
            "scorecard": {
                "candidates": [...],
                "summary": {...}
            }
        }
    """
    
    # Get workflow status from cache
    status = await workflow.cache.get_workflow_status(session_id)
    
    if not status:
        # No status found - might be expired or invalid session
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found or expired"
        )
    
    response_data = {
        "session_id": session_id,
        **status
    }
    
    # If completed, include the scorecard
    if status.get("status") == "completed":
        scorecard = await workflow.get_scorecard_by_session(session_id)
        if scorecard:
            response_data["scorecard"] = scorecard
    
    return response_data


@router.get("/results/{session_id}", tags=["Scorecard"])
async def get_results(
    session_id: str,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Results per page"),
    username: str = Depends(get_optional_username),
    workflow: ScorecardWorkflow = Depends(get_workflow)
):
    """
    Get scorecard results with pagination.
    
    This returns the actual candidate results.
    
    Example request:
        GET /results/abc-123?page=1&page_size=20
    
    Example response:
        {
            "session_id": "abc-123",
            "status": "completed",
            "candidates": [...],  // Top 20 candidates
            "summary": {
                "total_candidates": 150,
                "average_score": 72.5,
                "top_score": 95.0
            },
            "pagination": {
                "page": 1,
                "page_size": 20,
                "total_pages": 8,
                "has_next": true
            }
        }
    """
    
    # Get scorecard from database
    scorecard = await workflow.db.get_scorecard_by_session(session_id)
    
    if not scorecard:
        raise HTTPException(
            status_code=404,
            detail=f"Results for session {session_id} not found"
        )
    
    # Get all candidates
    all_candidates = scorecard.get("candidates", [])
    total_candidates = len(all_candidates)
    
    # Calculate pagination
    total_pages = (total_candidates + page_size - 1) // page_size
    start_idx = (page - 1) * page_size
    end_idx = min(start_idx + page_size, total_candidates)
    
    # Get candidates for this page
    page_candidates = all_candidates[start_idx:end_idx]
    
    return {
        "session_id": session_id,
        "status": scorecard.get("status", "completed"),
        "candidates": page_candidates,
        "summary": scorecard.get("summary", {}),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "total_candidates": total_candidates,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@router.post("/session/{session_id}/followup", tags=["Scorecard"])
async def submit_followup_answers(
    session_id: str,
    request: FollowupAnswersRequest,
    background_tasks: BackgroundTasks,
    username: str = Depends(get_current_username),
    workflow: ScorecardWorkflow = Depends(get_workflow)
):
    """
    Submit follow-up answers to refine the scorecard.
    
    This allows users to provide additional preferences after seeing initial results.
    The system will re-score candidates based on these preferences.
    
    Example request:
        POST /session/abc-123/followup
        {
            "answers": {
                "preferred_industries": ["Technology", "Finance"],
                "must_have_skills": ["Python", "Machine Learning"],
                "deal_breakers": ["No remote work"]
            }
        }
    
    Example response:
        {
            "session_id": "abc-123",
            "status": "processing",
            "message": "Re-scoring candidates with your preferences..."
        }
    """
    
    logger.debug(f"\nFollow-up answers submitted for session: {session_id}")
    
    # Start re-scoring in background
    background_tasks.add_task(
        workflow.resume_after_followup,
        session_id=session_id,
        followup_answers=request.answers
    )
    
    return {
        "session_id": session_id,
        "status": "processing",
        "message": "Re-scoring candidates with your preferences. Check status endpoint for updates."
    }


@router.get("/my-scorecards", tags=["Scorecard"])
async def get_my_scorecards(
    limit: int = Query(10, ge=1, le=50, description="Number of scorecards to return"),
    skip: int = Query(0, ge=0, description="Number of scorecards to skip"),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get all scorecards for the current user.
    
    This returns a history of all scorecards created by the user.
    
    Example request:
        GET /my-scorecards?limit=10&skip=0
    
    Example response:
        {
            "scorecards": [
                {
                    "session_id": "abc-123",
                    "prompt": "Find Senior Python Developer",
                    "created_at": "2025-01-01T00:00:00",
                    "summary": {...}
                },
                ...
            ],
            "total": 25
        }
    """
    
    # Get user's scorecards from database
    scorecards = await mongodb.get_user_scorecards(
        username=username,
        limit=limit,
        skip=skip
    )
    
    # Count total scorecards for pagination
    # In production, you'd want to cache this
    total_count = await mongodb.prompts_collection.count_documents({"username": username})
    
    return {
        "scorecards": scorecards,
        "total": total_count,
        "limit": limit,
        "skip": skip
    }


@router.delete("/session/{session_id}", tags=["Scorecard"])
async def delete_scorecard(
    session_id: str,
    username: str = Depends(get_current_username),
    workflow: ScorecardWorkflow = Depends(get_workflow)
):
    """
    Delete a scorecard.
    
    This removes the scorecard from the database and clears cached data.
    
    Example request:
        DELETE /session/abc-123
    
    Example response:
        {
            "message": "Scorecard deleted successfully",
            "session_id": "abc-123"
        }
    """
    
    # Get scorecard to verify ownership
    scorecard = await workflow.db.get_scorecard_by_session(session_id)
    
    if not scorecard:
        raise HTTPException(status_code=404, detail="Scorecard not found")
    
    # Verify user owns this scorecard
    if scorecard.get("username") != username:
        raise HTTPException(status_code=403, detail="Not authorized to delete this scorecard")
    
    # Delete from database
    workflow.db.prompts_collection.delete_one({"session_id": session_id})
    
    # Clear cached data
    await workflow.cache.delete_session_data(session_id)
    
    return {
        "message": "Scorecard deleted successfully",
        "session_id": session_id
    }