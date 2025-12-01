"""
Dashboard API
=============
API endpoints for user dashboard, metrics, and history.

Endpoints:
- GET /dashboard - Get dashboard overview with metrics
- GET /dashboard/searches - List all searches with pagination
- GET /dashboard/deep-dives - List deep dive analyses
- GET /dashboard/activity - Recent activity feed
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.dependencies import get_current_username, get_mongodb, get_redis
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = get_logger(__name__)


# ================================================================
# RESPONSE MODELS
# ================================================================

class DashboardMetrics(BaseModel):
    """Dashboard metrics summary."""
    total_searches: int = 0
    total_candidates_analyzed: int = 0
    total_candidates_shortlisted: int = 0
    total_deep_dives: int = 0
    credits_remaining: int = 100  # Dummy for now
    credits_used: int = 0
    searches_this_month: int = 0
    avg_match_score: float = 0.0


class SearchSummary(BaseModel):
    """Summary of a search session."""
    session_id: str
    conversation_session_id: Optional[str] = None
    role_title: str = ""
    skills: List[str] = []
    locations: List[str] = []
    total_candidates: int = 0
    enriched_count: int = 0
    shortlisted_count: int = 0
    status: str = "completed"
    created_at: str = ""
    avg_match_score: Optional[float] = None


class DeepDiveSummary(BaseModel):
    """Summary of a deep dive analysis."""
    result_id: str
    candidate_name: str = ""
    candidate_title: str = ""
    linkedin_url: str = ""
    match_score: Optional[float] = None
    created_at: str = ""


class DashboardResponse(BaseModel):
    """Full dashboard response."""
    metrics: DashboardMetrics
    recent_searches: List[SearchSummary]
    recent_deep_dives: List[DeepDiveSummary]
    user: dict


# ================================================================
# ENDPOINTS
# ================================================================

@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get dashboard overview with metrics and recent activity.
    """
    try:
        # Get user info
        user = await mongodb.get_user(username)
        user_info = {
            "username": username,
            "email": user.get("email", username) if user else username,
            "created_at": user.get("created_at", "") if user else "",
            "plan": user.get("plan", "free") if user else "free"
        }
        
        # Calculate metrics
        metrics = await _calculate_metrics(username, mongodb)
        
        # Get recent searches (last 5)
        recent_searches = await _get_recent_searches(username, mongodb, limit=5)
        
        # Get recent deep dives (last 5)
        recent_deep_dives = await _get_recent_deep_dives(username, mongodb, limit=5)
        
        return DashboardResponse(
            metrics=metrics,
            recent_searches=recent_searches,
            recent_deep_dives=recent_deep_dives,
            user=user_info
        )
        
    except Exception as e:
        logger.error(f"Error getting dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/searches")
async def get_searches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get paginated list of all searches.
    Supports infinite scroll.
    """
    try:
        skip = (page - 1) * page_size
        
        # Build query
        query = {"username": username}
        if status:
            query["status"] = status
        
        # Get total count
        total = await mongodb.enriched_results_collection.count_documents(query)
        
        # Get searches
        cursor = mongodb.enriched_results_collection.find(
            query,
            {
                "session_id": 1,
                "conversation_session_id": 1,
                "ideal_profile": 1,
                "total_found": 1,
                "enriched_count": 1,
                "candidates": 1,  # Need this for shortlist count
                "status": 1,
                "created_at": 1
            }
        ).sort("created_at", -1).skip(skip).limit(page_size)
        
        searches = []
        async for doc in cursor:
            # Count shortlisted
            candidates = doc.get("candidates", [])
            shortlisted = sum(1 for c in candidates if c.get("is_shortlisted"))
            
            # Calculate avg match score
            scores = [
                c.get("match_analysis", {}).get("overall_match_score", 0) 
                for c in candidates
            ]
            avg_score = sum(scores) / len(scores) if scores else 0
            
            profile = doc.get("ideal_profile", {})
            
            searches.append(SearchSummary(
                session_id=doc.get("session_id", ""),
                conversation_session_id=doc.get("conversation_session_id"),
                role_title=profile.get("role_title", "Untitled Search"),
                skills=profile.get("must_have_skills", [])[:5],
                locations=profile.get("locations", []),
                total_candidates=doc.get("total_found", 0),
                enriched_count=doc.get("enriched_count", 0),
                shortlisted_count=shortlisted,
                status=doc.get("status", "completed"),
                created_at=doc.get("created_at", ""),
                avg_match_score=round(avg_score, 1)
            ))
        
        return {
            "searches": searches,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
                "has_more": (page * page_size) < total
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting searches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/deep-dives")
async def get_deep_dives(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get paginated list of deep dive analyses.
    """
    try:
        skip = (page - 1) * page_size
        
        collection = mongodb.main_db.deep_dive_results
        
        # Get total
        total = await collection.count_documents({"created_by": username})
        
        # Get deep dives
        cursor = collection.find(
            {"created_by": username}
        ).sort("created_at", -1).skip(skip).limit(page_size)
        
        deep_dives = []
        async for doc in cursor:
            result = doc.get("result", {})
            candidate = result.get("candidate", {})
            match = result.get("match_analysis", {})
            
            deep_dives.append(DeepDiveSummary(
                result_id=str(doc.get("_id", "")),
                candidate_name=candidate.get("full_name", "Unknown"),
                candidate_title=candidate.get("headline", candidate.get("title", "")),
                linkedin_url=doc.get("linkedin_url", ""),
                match_score=match.get("overall_match_score"),
                created_at=doc.get("created_at", datetime.utcnow()).isoformat() if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at", ""))
            ))
        
        return {
            "deep_dives": deep_dives,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
                "has_more": (page * page_size) < total
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting deep dives: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity")
async def get_activity(
    limit: int = Query(20, ge=1, le=100),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get recent activity feed.
    """
    try:
        # Get recent logs
        cursor = mongodb.logs_collection.find(
            {"username": username}
        ).sort("timestamp", -1).limit(limit)
        
        activities = []
        async for log in cursor:
            activities.append({
                "action": log.get("action", ""),
                "details": log.get("details", {}),
                "timestamp": log.get("timestamp", datetime.utcnow()).isoformat() if isinstance(log.get("timestamp"), datetime) else str(log.get("timestamp", ""))
            })
        
        return {"activities": activities}
        
    except Exception as e:
        logger.error(f"Error getting activity: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/searches/{session_id}")
async def delete_search(
    session_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Delete a search result.
    """
    try:
        # Verify ownership
        result = await mongodb.enriched_results_collection.find_one({
            "session_id": session_id,
            "username": username
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Search not found")
        
        # Delete
        await mongodb.enriched_results_collection.delete_one({"session_id": session_id})
        
        return {"success": True, "message": "Search deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting search: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# HELPER FUNCTIONS
# ================================================================

async def _calculate_metrics(username: str, mongodb: MongoDB) -> DashboardMetrics:
    """Calculate dashboard metrics for a user."""
    
    # Count total searches
    total_searches = await mongodb.enriched_results_collection.count_documents(
        {"username": username}
    )
    
    # Get this month's start
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    
    # Count searches this month
    searches_this_month = await mongodb.enriched_results_collection.count_documents({
        "username": username,
        "created_at": {"$gte": month_start.isoformat()}
    })
    
    # Count deep dives
    total_deep_dives = await mongodb.main_db.deep_dive_results.count_documents(
        {"created_by": username}
    )
    
    # Aggregate candidate stats
    pipeline = [
        {"$match": {"username": username}},
        {"$project": {
            "total_found": 1,
            "enriched_count": 1,
            "candidates": 1
        }},
        {"$unwind": {"path": "$candidates", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": None,
            "total_candidates": {"$sum": "$total_found"},
            "total_enriched": {"$sum": "$enriched_count"},
            "total_shortlisted": {
                "$sum": {"$cond": [{"$eq": ["$candidates.is_shortlisted", True]}, 1, 0]}
            },
            "avg_score": {
                "$avg": "$candidates.match_analysis.overall_match_score"
            }
        }}
    ]
    
    try:
        result = await mongodb.enriched_results_collection.aggregate(pipeline).to_list(1)
        stats = result[0] if result else {}
    except:
        stats = {}
    
    # Dummy credits calculation (replace with real logic later)
    credits_used = total_searches * 5 + total_deep_dives * 10
    credits_remaining = max(0, 100 - credits_used)
    
    return DashboardMetrics(
        total_searches=total_searches,
        total_candidates_analyzed=stats.get("total_enriched", 0),
        total_candidates_shortlisted=stats.get("total_shortlisted", 0),
        total_deep_dives=total_deep_dives,
        credits_remaining=credits_remaining,
        credits_used=credits_used,
        searches_this_month=searches_this_month,
        avg_match_score=round(stats.get("avg_score", 0) or 0, 1)
    )


async def _get_recent_searches(username: str, mongodb: MongoDB, limit: int = 5) -> List[SearchSummary]:
    """Get recent searches for a user."""
    
    cursor = mongodb.enriched_results_collection.find(
        {"username": username}
    ).sort("created_at", -1).limit(limit)
    
    searches = []
    async for doc in cursor:
        candidates = doc.get("candidates", [])
        shortlisted = sum(1 for c in candidates if c.get("is_shortlisted"))
        
        scores = [
            c.get("match_analysis", {}).get("overall_match_score", 0) 
            for c in candidates
        ]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        profile = doc.get("ideal_profile", {})
        
        searches.append(SearchSummary(
            session_id=doc.get("session_id", ""),
            conversation_session_id=doc.get("conversation_session_id"),
            role_title=profile.get("role_title", "Untitled Search"),
            skills=profile.get("must_have_skills", [])[:5],
            locations=profile.get("locations", []),
            total_candidates=doc.get("total_found", 0),
            enriched_count=doc.get("enriched_count", 0),
            shortlisted_count=shortlisted,
            status=doc.get("status", "completed"),
            created_at=doc.get("created_at", ""),
            avg_match_score=round(avg_score, 1)
        ))
    
    return searches


async def _get_recent_deep_dives(username: str, mongodb: MongoDB, limit: int = 5) -> List[DeepDiveSummary]:
    """Get recent deep dives for a user."""
    
    collection = mongodb.main_db.deep_dive_results
    cursor = collection.find(
        {"created_by": username}
    ).sort("created_at", -1).limit(limit)
    
    deep_dives = []
    async for doc in cursor:
        result = doc.get("result", {})
        candidate = result.get("candidate", {})
        match = result.get("match_analysis", {})
        
        created_at = doc.get("created_at")
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        
        deep_dives.append(DeepDiveSummary(
            result_id=str(doc.get("_id", "")),
            candidate_name=candidate.get("full_name", "Unknown"),
            candidate_title=candidate.get("headline", candidate.get("title", "")),
            linkedin_url=doc.get("linkedin_url", ""),
            match_score=match.get("overall_match_score"),
            created_at=str(created_at) if created_at else ""
        ))
    
    return deep_dives