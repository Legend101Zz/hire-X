"""
Dashboard API
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
    total_searches: int = 0
    total_candidates_analyzed: int = 0
    total_candidates_shortlisted: int = 0
    total_deep_dives: int = 0
    credits_remaining: int = 100
    credits_used: int = 0
    searches_this_month: int = 0
    avg_match_score: float = 0.0


class SearchSummary(BaseModel):
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
    source: Optional[str] = None  # donna_search or manual_import
    pipeline_id: Optional[str] = None
    pipeline_created_at: Optional[str] = None


class DeepDiveSummary(BaseModel):
    result_id: str
    candidate_name: str = ""
    candidate_title: str = ""
    linkedin_url: str = ""
    match_score: Optional[float] = None
    created_at: str = ""


class DashboardResponse(BaseModel):
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
    """Get dashboard overview with metrics and recent activity."""
    try:
        user = await mongodb.get_user(username)
        user_info = {
            "username": username,
            "email": user.get("email", username) if user else username,
            "created_at": user.get("created_at", "") if user else "",
            "plan": user.get("plan", "free") if user else "free"
        }
        
        metrics = await _calculate_metrics(username, mongodb)
        recent_searches = await _get_recent_searches(username, mongodb, limit=5)
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
    status: Optional[str] = Query(None),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get paginated list of all searches from conversation_sessions."""
    try:
        skip = (page - 1) * page_size
        
        # Query conversation_sessions collection
        query = {"username": username}
        if status:
            query["status"] = status
        
        total = await mongodb.conversation_sessions_collection.count_documents(query)
        
        cursor = mongodb.conversation_sessions_collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
        
        searches = []
        async for doc in cursor:
            searches.append(_session_to_summary(doc))
        
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
    """Get paginated list of deep dive analyses."""
    try:
        skip = (page - 1) * page_size
        collection = mongodb.main_db.deep_dive_results
        
        total = await collection.count_documents({"created_by": username})
        cursor = collection.find({"created_by": username}).sort("created_at", -1).skip(skip).limit(page_size)
        
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


@router.delete("/searches/{session_id}")
async def delete_search(
    session_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Delete a search result."""
    try:
        result = await mongodb.conversation_sessions_collection.find_one({
            "session_id": session_id,
            "username": username
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Search not found")
        
        await mongodb.conversation_sessions_collection.delete_one({"session_id": session_id})
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
    """Calculate dashboard metrics from conversation_sessions."""
    
    total_searches = await mongodb.conversation_sessions_collection.count_documents(
        {"username": username}
    )
    
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1).isoformat()
    
    searches_this_month = await mongodb.conversation_sessions_collection.count_documents({
        "username": username,
        "created_at": {"$gte": month_start}
    })
    
    total_deep_dives = await mongodb.main_db.deep_dive_results.count_documents(
        {"created_by": username}
    )
    
    # Aggregate candidate stats from conversation_sessions
    pipeline = [
        {"$match": {"username": username}},
        {"$project": {
            "total_candidates": 1,
            "candidates": {"$ifNull": [
                "$search_results", 
                {"$ifNull": ["$sample_candidates", "$candidates"]}
            ]},
            "selected_ids": "$selected_candidate_ids"
        }},
        {"$group": {
            "_id": None,
            "total_analyzed": {"$sum": "$total_candidates"},
            "total_shortlisted": {"$sum": {"$size": {"$ifNull": ["$selected_ids", []]}}},
            "all_candidates": {"$push": "$candidates"}
        }}
    ]
    
    try:
        result = await mongodb.conversation_sessions_collection.aggregate(pipeline).to_list(1)
        stats = result[0] if result else {}
        
        # Calculate avg score
        all_cands = stats.get("all_candidates", [])
        scores = []
        for cand_list in all_cands:
            if isinstance(cand_list, list):
                for c in cand_list:
                    score = (c.get("match_score") or 
                            c.get("match_analysis", {}).get("overall_match_score") or 
                            c.get("candidate", {}).get("match_score"))
                    if score:
                        scores.append(score)
        
        avg_score = sum(scores) / len(scores) if scores else 0
    except Exception as e:
        logger.error(f"Metrics calculation error: {e}")
        stats = {}
        avg_score = 0
    
    credits_used = total_searches * 5 + total_deep_dives * 10
    credits_remaining = max(0, 100 - credits_used)
    
    return DashboardMetrics(
        total_searches=total_searches,
        total_candidates_analyzed=stats.get("total_analyzed", 0),
        total_candidates_shortlisted=stats.get("total_shortlisted", 0),
        total_deep_dives=total_deep_dives,
        credits_remaining=credits_remaining,
        credits_used=credits_used,
        searches_this_month=searches_this_month,
        avg_match_score=round(avg_score, 1)
    )


def _session_to_summary(doc: dict) -> SearchSummary:
    """Convert conversation_session document to SearchSummary."""
    profile = doc.get("ideal_profile", {})
    
    # Get candidates from various possible fields
    candidates = (
        doc.get("search_results") or 
        doc.get("sample_candidates") or 
        doc.get("candidates") or 
        []
    )
    
    # Count selected
    selected_ids = set(doc.get("selected_candidate_ids", []))
    shortlisted_count = len(selected_ids)
    
    # Calculate avg score
    scores = []
    for c in candidates:
        score = (c.get("match_score") or 
                c.get("match_analysis", {}).get("overall_match_score") or 
                c.get("candidate", {}).get("match_score"))
        if score:
            scores.append(score)
    
    avg_score = sum(scores) / len(scores) if scores else None
    
    return SearchSummary(
        session_id=doc.get("session_id", ""),
        conversation_session_id=doc.get("conversation_session_id"),
        role_title=profile.get("role_title", "Untitled Search"),
        skills=profile.get("must_have_skills", [])[:5],
        locations=profile.get("locations", []),
        total_candidates=doc.get("total_candidates", len(candidates)),
        enriched_count=len(candidates),
        shortlisted_count=shortlisted_count,
        status=doc.get("status", "ready"),
        created_at=doc.get("created_at", ""),
        avg_match_score=round(avg_score, 1) if avg_score else None,
        source=doc.get("source", "donna_search"),
        pipeline_id=doc.get("pipeline_id"),
        pipeline_created_at=doc.get("pipeline_created_at")
    )


async def _get_recent_searches(username: str, mongodb: MongoDB, limit: int = 5) -> List[SearchSummary]:
    """Get recent searches from conversation_sessions."""
    cursor = mongodb.conversation_sessions_collection.find(
        {"username": username}
    ).sort("created_at", -1).limit(limit)
    
    searches = []
    async for doc in cursor:
        searches.append(_session_to_summary(doc))
    
    return searches


async def _get_recent_deep_dives(username: str, mongodb: MongoDB, limit: int = 5) -> List[DeepDiveSummary]:
    """Get recent deep dives."""
    collection = mongodb.main_db.deep_dive_results
    cursor = collection.find({"created_by": username}).sort("created_at", -1).limit(limit)
    
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