"""
Dashboard API - Enhanced for HR-Friendly UX
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.dependencies import get_current_username, get_mongodb, get_redis
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
logger = get_logger(__name__)


# ===============================================================
# RESPONSE MODELS
# ===============================================================

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
    
class PipelineStageStats(BaseModel):
    """Stats for each stage of the hiring journey"""
    sourced: int = 0          # Found
    enriched: int = 0         # Analyzed
    outreach_sent: int = 0    # Contacted
    outreach_opened: int = 0  # Opened email
    outreach_clicked: int = 0 # Clicked link
    responded: int = 0        # Replied
    scheduled: int = 0        # Interview scheduled
    interviewed: int = 0      # Interview completed
    offered: int = 0          # Offer made
    hired: int = 0            # Hired


class InboxItemType(str):
    RESPONSE = "response"
    INTERVIEW = "interview"
    REMINDER = "reminder"
    MILESTONE = "milestone"


class InboxItem(BaseModel):
    """Notification/activity item for the inbox"""
    id: str
    type: str  # response, interview, reminder, milestone
    title: str
    subtitle: str
    time: str
    timestamp: datetime
    is_unread: bool = True
    is_urgent: bool = False
    candidate_id: Optional[str] = None
    pipeline_id: Optional[str] = None
    action_url: Optional[str] = None
    metadata: Dict[str, Any] = {}


class UpcomingInterview(BaseModel):
    """Scheduled interview details"""
    schedule_id: str
    candidate_id: str
    candidate_name: str
    candidate_title: Optional[str] = None
    job_title: str
    scheduled_datetime: datetime
    timezone: str = "Asia/Kolkata"
    duration_minutes: int = 30
    time_until: str = ""
    is_today: bool = False
    status: str = "scheduled"
    interview_session_id: Optional[str] = None


class CandidateQuickView(BaseModel):
    """Simplified candidate view for dashboard"""
    candidate_id: str
    name: str
    title: Optional[str] = None
    stage: str
    stage_label: str
    match_score: Optional[int] = None
    last_activity: str
    pipeline_id: Optional[str] = None
    has_responded: bool = False
    is_favorite: bool = False
    contact_email: Optional[str] = None


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
    source: Optional[str] = None
    pipeline_id: Optional[str] = None
    pipeline_created_at: Optional[str] = None


class DeepDiveSummary(BaseModel):
    result_id: str
    candidate_name: str = ""
    candidate_title: str = ""
    linkedin_url: str = ""
    match_score: Optional[float] = None
    created_at: str = ""


class EnhancedDashboardResponse(BaseModel):
    """Enhanced dashboard with all the data HR users need"""
    metrics: DashboardMetrics
    pipeline_stats: PipelineStageStats
    inbox_items: List[InboxItem]
    upcoming_interviews: List[UpcomingInterview]
    recent_candidates: List[CandidateQuickView]
    recent_searches: List[SearchSummary]
    recent_deep_dives: List[DeepDiveSummary]
    user: dict
    donna_tip: Optional[dict] = None  # Smart tip from Donna

class InterviewScheduleView(BaseModel):
    """Interview schedule for dashboard view"""
    schedule_id: str
    pipeline_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    job_title: str
    company_name: Optional[str] = None
    scheduled_datetime: datetime
    timezone: str = "Asia/Kolkata"
    duration_minutes: int = 30
    status: str  # scheduled, confirmed, in_progress, completed, cancelled, no_show
    interview_session_id: Optional[str] = None
    interview_completed: bool = False
    completion_status: Optional[str] = None
    booked_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    call_initiated_at: Optional[datetime] = None
    call_ended_at: Optional[datetime] = None
    actual_duration_seconds: Optional[int] = None
    candidate_notes: Optional[str] = None
    # Computed fields
    time_until: str = ""
    is_today: bool = False
    is_past: bool = False
    can_start: bool = False


class InterviewsResponse(BaseModel):
    """Response for interviews endpoint"""
    upcoming: List[InterviewScheduleView]
    today: List[InterviewScheduleView]
    completed: List[InterviewScheduleView]
    cancelled: List[InterviewScheduleView]
    stats: dict

# ================================================================
# ENHANCED ENDPOINTS
# ================================================================

@router.get("/enhanced", response_model=EnhancedDashboardResponse)
async def get_enhanced_dashboard(
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get the full enhanced dashboard with all data HR users need.
    This is the main endpoint for the new dashboard design.
    """
    try:
        user = await mongodb.get_user(username)
        user_info = {
            "username": username,
            "email": user.get("email", username) if user else username,
            "created_at": user.get("created_at", "") if user else "",
            "plan": user.get("plan", "free") if user else "free"
        }
        
        # Gather all data in parallel for better performance
        metrics = await _calculate_metrics(username, mongodb)
        pipeline_stats = await _get_pipeline_stats(username, mongodb)
        inbox_items = await _get_inbox_items(username, mongodb, limit=10)
        upcoming_interviews = await _get_upcoming_interviews(username, mongodb)
        recent_candidates = await _get_recent_candidates(username, mongodb, limit=6)
        recent_searches = await _get_recent_searches(username, mongodb, limit=4)
        recent_deep_dives = await _get_recent_deep_dives(username, mongodb, limit=4)
        
        # Generate smart tip based on data
        donna_tip = _generate_donna_tip(metrics, pipeline_stats, inbox_items, upcoming_interviews)
        
        return EnhancedDashboardResponse(
            metrics=metrics,
            pipeline_stats=pipeline_stats,
            inbox_items=inbox_items,
            upcoming_interviews=upcoming_interviews,
            recent_candidates=recent_candidates,
            recent_searches=recent_searches,
            recent_deep_dives=recent_deep_dives,
            user=user_info,
            donna_tip=donna_tip
        )
    except Exception as e:
        logger.error(f"Error getting enhanced dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pipeline-stats", response_model=PipelineStageStats)
async def get_pipeline_stats(
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get aggregated stats for each pipeline stage"""
    return await _get_pipeline_stats(username, mongodb)


@router.get("/inbox")
async def get_inbox(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    filter_type: Optional[str] = Query(None),  # response, interview, reminder, milestone
    unread_only: bool = Query(False),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get paginated inbox items with filters"""
    try:
        skip = (page - 1) * page_size
        items = await _get_inbox_items(
            username, mongodb, 
            limit=page_size, 
            skip=skip,
            filter_type=filter_type,
            unread_only=unread_only
        )
        
        # Get total count for pagination
        total = await _count_inbox_items(username, mongodb, filter_type, unread_only)
        
        return {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
                "has_more": (page * page_size) < total
            },
            "unread_count": await _count_inbox_items(username, mongodb, None, True)
        }
    except Exception as e:
        logger.error(f"Error getting inbox: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inbox/{item_id}/mark-read")
async def mark_inbox_item_read(
    item_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Mark an inbox item as read"""
    # Implementation depends on how we store read status
    # Could be in a separate collection or as a field
    return {"success": True}


@router.get("/upcoming-interviews", response_model=List[UpcomingInterview])
async def get_upcoming_interviews(
    days_ahead: int = Query(7, ge=1, le=30),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get upcoming interviews for the next N days"""
    return await _get_upcoming_interviews(username, mongodb, days_ahead=days_ahead)


@router.get("/candidates/quick-view")
async def get_candidates_quick_view(
    stage: Optional[str] = Query(None),
    favorites_only: bool = Query(False),
    responded_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get quick view of candidates with filters"""
    return await _get_recent_candidates(
        username, mongodb, 
        limit=limit,
        stage=stage,
        favorites_only=favorites_only,
        responded_only=responded_only
    )


@router.get("/interviews")
async def get_all_interviews(
    status_filter: Optional[str] = Query(None),  # upcoming, today, completed, cancelled, all
    days_back: int = Query(30, ge=1, le=90),
    days_ahead: int = Query(14, ge=1, le=60),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get all interviews for the user with filtering options.
    Returns categorized interviews: upcoming, today, completed, cancelled.
    """
    try:
        schedules_collection = mongodb.main_db.interview_schedules
        pipelines_collection = mongodb.main_db.recruitment_pipelines
        
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        today_end = today_start + timedelta(days=1)
        past_limit = now - timedelta(days=days_back)
        future_limit = now + timedelta(days=days_ahead)
        
        # Get user's pipeline IDs first
        user_pipelines = await pipelines_collection.find(
            {"username": username, "is_active": True},
            {"pipeline_id": 1}
        ).to_list(length=1000)
        
        pipeline_ids = [p["pipeline_id"] for p in user_pipelines]
        
        if not pipeline_ids:
            return InterviewsResponse(
                upcoming=[],
                today=[],
                completed=[],
                cancelled=[],
                stats={
                    "total_scheduled": 0,
                    "total_completed": 0,
                    "total_cancelled": 0,
                    "total_no_show": 0,
                    "completion_rate": 0
                }
            )
        
        # Query all relevant schedules
        query = {
            "pipeline_id": {"$in": pipeline_ids}
        }
        
        schedules = await schedules_collection.find(query).sort("scheduled_datetime", -1).to_list(length=500)
        
        # Categorize interviews
        upcoming = []
        today = []
        completed = []
        cancelled = []
        
        for schedule in schedules:
            scheduled_dt = schedule.get("scheduled_datetime")
            if isinstance(scheduled_dt, str):
                try:
                    scheduled_dt = datetime.fromisoformat(scheduled_dt.replace("Z", "+00:00"))
                    if scheduled_dt.tzinfo:
                        scheduled_dt = scheduled_dt.replace(tzinfo=None)
                except:
                    scheduled_dt = now
            
            is_today = today_start <= scheduled_dt < today_end if scheduled_dt else False
            is_past = scheduled_dt < now if scheduled_dt else False
            is_upcoming = scheduled_dt >= now if scheduled_dt else False
            
            # Can start if it's within 15 minutes of scheduled time
            can_start = False
            if scheduled_dt:
                time_diff = (scheduled_dt - now).total_seconds()
                can_start = -900 <= time_diff <= 3600  # 15 min before to 1 hour after
            
            interview_view = InterviewScheduleView(
                schedule_id=schedule.get("schedule_id", ""),
                pipeline_id=schedule.get("pipeline_id", ""),
                candidate_id=schedule.get("candidate_id", ""),
                candidate_name=schedule.get("candidate_name", "Unknown"),
                candidate_email=schedule.get("candidate_email"),
                candidate_phone=schedule.get("candidate_phone"),
                linkedin_url=schedule.get("linkedin_url"),
                job_title=schedule.get("job_title", ""),
                company_name=schedule.get("company_name"),
                scheduled_datetime=scheduled_dt or now,
                timezone=schedule.get("timezone", "Asia/Kolkata"),
                duration_minutes=schedule.get("duration_minutes", 30),
                status=schedule.get("status", "scheduled"),
                interview_session_id=schedule.get("interview_session_id"),
                interview_completed=schedule.get("interview_completed", False),
                completion_status=schedule.get("completion_status"),
                booked_at=schedule.get("booked_at"),
                confirmed_at=schedule.get("confirmed_at"),
                call_initiated_at=schedule.get("call_initiated_at"),
                call_ended_at=schedule.get("call_ended_at"),
                actual_duration_seconds=schedule.get("actual_duration_seconds"),
                candidate_notes=schedule.get("candidate_notes"),
                time_until=_format_time_until(scheduled_dt) if scheduled_dt else "Unknown",
                is_today=is_today,
                is_past=is_past,
                can_start=can_start
            )
            
            status = schedule.get("status", "scheduled")
            
            if status in ["cancelled", "no_show"]:
                cancelled.append(interview_view)
            elif schedule.get("interview_completed", False) or status == "completed":
                completed.append(interview_view)
            elif is_today and is_upcoming:
                today.append(interview_view)
            elif is_upcoming:
                upcoming.append(interview_view)
            elif is_past and not schedule.get("interview_completed", False):
                # Past but not marked complete - might be no-show or needs attention
                completed.append(interview_view)
        
        # Sort appropriately
        upcoming.sort(key=lambda x: x.scheduled_datetime)
        today.sort(key=lambda x: x.scheduled_datetime)
        completed.sort(key=lambda x: x.scheduled_datetime, reverse=True)
        cancelled.sort(key=lambda x: x.scheduled_datetime, reverse=True)
        
        # Calculate stats
        total_scheduled = len(upcoming) + len(today) + len(completed) + len(cancelled)
        total_completed = len([i for i in completed if i.interview_completed])
        total_cancelled = len([i for i in cancelled if i.status == "cancelled"])
        total_no_show = len([i for i in cancelled if i.status == "no_show"])
        
        completion_rate = (total_completed / (total_scheduled - total_cancelled)) * 100 if (total_scheduled - total_cancelled) > 0 else 0
        
        return {
            "upcoming": upcoming,
            "today": today,
            "completed": completed,
            "cancelled": cancelled,
            "stats": {
                "total_scheduled": total_scheduled,
                "total_completed": total_completed,
                "total_cancelled": total_cancelled,
                "total_no_show": total_no_show,
                "completion_rate": round(completion_rate, 1),
                "upcoming_count": len(upcoming),
                "today_count": len(today)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting interviews: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



# ================================================================
# HELPER FUNCTIONS - Pipeline Stats
# ================================================================

def _format_time_until(dt: datetime) -> str:
    """Format time until interview"""
    if not dt:
        return "Unknown"
    
    now = datetime.utcnow()
    if dt.tzinfo:
        dt = dt.replace(tzinfo=None)
    
    diff = dt - now
    total_seconds = diff.total_seconds()
    
    if total_seconds < 0:
        # Past
        abs_seconds = abs(total_seconds)
        if abs_seconds < 3600:
            mins = int(abs_seconds / 60)
            return f"{mins}m ago"
        elif abs_seconds < 86400:
            hours = int(abs_seconds / 3600)
            return f"{hours}h ago"
        else:
            days = int(abs_seconds / 86400)
            return f"{days}d ago"
    else:
        # Future
        if total_seconds < 3600:
            mins = int(total_seconds / 60)
            return f"in {mins}m"
        elif total_seconds < 86400:
            hours = int(total_seconds / 3600)
            return f"in {hours}h"
        else:
            days = int(total_seconds / 86400)
            return f"in {days}d"

async def _get_pipeline_stats(username: str, mongodb: MongoDB) -> PipelineStageStats:
    """Aggregate stats across all pipelines for a user"""
    try:
        pipelines_collection = mongodb.main_db.recruitment_pipelines
        
        # Aggregate across all pipelines
        pipeline = [
            {"$match": {"username": username, "is_active": True}},
            {"$unwind": {"path": "$candidates", "preserveNullAndEmptyArrays": True}},
            {"$group": {
                "_id": "$candidates.stage",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = await pipelines_collection.aggregate(pipeline)
        results = await cursor.to_list(length=100)
        
        # Map stages to stats
        stage_map = {doc["_id"]: doc["count"] for doc in results if doc["_id"]}
        
        # Also get response/open/click data from outreach
        outreach_pipeline = [
            {"$match": {"username": username, "is_active": True}},
            {"$unwind": "$candidates"},
            {"$project": {
                "outreach": "$candidates.outreach",
                "stage": "$candidates.stage"
            }},
            {"$group": {
                "_id": None,
                "total_opens": {"$sum": {"$ifNull": ["$outreach.total_opens", 0]}},
                "total_clicks": {"$sum": {"$ifNull": ["$outreach.total_clicks", 0]}},
                "responded": {"$sum": {"$cond": [{"$eq": ["$outreach.candidate_responded", True]}, 1, 0]}}
            }}
        ]
        
        outreach_cursor = await pipelines_collection.aggregate(outreach_pipeline)
        outreach_results = await outreach_cursor.to_list(length=1)
        outreach_data = outreach_results[0] if outreach_results else {}
        
        return PipelineStageStats(
            sourced=stage_map.get("sourced", 0),
            enriched=stage_map.get("enriched", 0),
            outreach_sent=stage_map.get("outreach_sent", 0),
            outreach_opened=outreach_data.get("total_opens", 0),
            outreach_clicked=outreach_data.get("total_clicks", 0),
            responded=outreach_data.get("responded", 0),
            scheduled=stage_map.get("scheduled", 0) + stage_map.get("interview_scheduled", 0),
            interviewed=stage_map.get("interviewed", 0) + stage_map.get("interview_completed", 0),
            offered=stage_map.get("offered", 0),
            hired=stage_map.get("hired", 0)
        )
    except Exception as e:
        logger.error(f"Error getting pipeline stats: {e}", exc_info=True)
        return PipelineStageStats()


# ================================================================
# HELPER FUNCTIONS - Inbox
# ================================================================

async def _get_inbox_items(
    username: str, 
    mongodb: MongoDB, 
    limit: int = 10,
    skip: int = 0,
    filter_type: Optional[str] = None,
    unread_only: bool = False
) -> List[InboxItem]:
    """
    Generate inbox items from various sources:
    - Candidate responses (from outreach)
    - Interview schedules
    - Milestones (first hire, 10 candidates, etc.)
    """
    items = []
    now = datetime.utcnow()
    
    try:
        pipelines_collection = mongodb.main_db.recruitment_pipelines
        schedules_collection = mongodb.main_db.interview_schedules
        
        # 1. Get candidate responses
        if not filter_type or filter_type == "response":
            response_pipeline = [
                {"$match": {"username": username, "is_active": True}},
                {"$unwind": "$candidates"},
                {"$match": {"candidates.outreach.candidate_responded": True}},
                {"$sort": {"candidates.outreach.response_received_at": -1}},
                {"$limit": limit}
            ]
            
            cursor = await pipelines_collection.aggregate(response_pipeline)
            responses = await cursor.to_list(length=limit)
            
            for doc in responses:
                candidate = doc.get("candidates", {})
                outreach = candidate.get("outreach", {}) or {}
                response_time = outreach.get("response_received_at")
                
                items.append(InboxItem(
                    id=f"response-{candidate.get('candidate_id')}",
                    type="response",
                    title=f"{candidate.get('name', 'A candidate')} replied!",
                    subtitle="Click to view their response",
                    time=_format_relative_time(response_time) if response_time else "Recently",
                    timestamp=response_time or now,
                    is_unread=True,  # Would track separately
                    is_urgent=False,
                    candidate_id=candidate.get("candidate_id"),
                    pipeline_id=doc.get("pipeline_id"),
                    metadata={
                        "response_type": outreach.get("response_type"),
                        "candidate_name": candidate.get("name")
                    }
                ))
        
        # 2. Get interview schedules
        if not filter_type or filter_type == "interview":
            schedule_query = {
                "username": username if hasattr(mongodb.main_db, "interview_schedules") else None,
                "status": {"$in": ["scheduled", "confirmed"]},
                "scheduled_datetime": {"$gte": now.isoformat()}
            }
            # Clean query
            schedule_query = {k: v for k, v in schedule_query.items() if v is not None}
            
            schedules = await schedules_collection.find(schedule_query).sort("scheduled_datetime", 1).limit(limit).to_list(length=limit)
            
            for schedule in schedules:
                scheduled_dt = schedule.get("scheduled_datetime")
                if isinstance(scheduled_dt, str):
                    scheduled_dt = datetime.fromisoformat(scheduled_dt.replace("Z", "+00:00"))
                
                is_today = scheduled_dt.date() == now.date() if scheduled_dt else False
                
                items.append(InboxItem(
                    id=f"interview-{schedule.get('schedule_id')}",
                    type="interview",
                    title=f"Interview {'today' if is_today else 'scheduled'}",
                    subtitle=f"{schedule.get('candidate_name')} - {schedule.get('job_title')}",
                    time=_format_relative_time(schedule.get("booked_at")),
                    timestamp=schedule.get("booked_at") or now,
                    is_unread=is_today,
                    is_urgent=is_today,
                    candidate_id=schedule.get("candidate_id"),
                    pipeline_id=schedule.get("pipeline_id"),
                    metadata={
                        "scheduled_datetime": str(scheduled_dt),
                        "duration_minutes": schedule.get("duration_minutes", 30)
                    }
                ))
        
        # Sort by timestamp and apply pagination
        items.sort(key=lambda x: x.timestamp, reverse=True)
        
        return items[skip:skip + limit]
        
    except Exception as e:
        logger.error(f"Error getting inbox items: {e}", exc_info=True)
        return []


async def _count_inbox_items(
    username: str, 
    mongodb: MongoDB,
    filter_type: Optional[str] = None,
    unread_only: bool = False
) -> int:
    """Count total inbox items for pagination"""
    # Simplified count - in production, would be more accurate
    return 10


# ================================================================
# HELPER FUNCTIONS - Interviews
# ================================================================

async def _get_upcoming_interviews(
    username: str, 
    mongodb: MongoDB,
    days_ahead: int = 7
) -> List[UpcomingInterview]:
    """Get upcoming scheduled interviews"""
    try:
        schedules_collection = mongodb.main_db.interview_schedules
        now = datetime.utcnow()
        future_limit = now + timedelta(days=days_ahead)
        
        query = {
            "status": {"$in": ["scheduled", "confirmed", "in_progress"]},
            "scheduled_datetime": {
                "$gte": now.isoformat(),
                "$lte": future_limit.isoformat()
            }
        }
        
        schedules = await schedules_collection.find(query).sort("scheduled_datetime", 1).to_list(length=20)
        
        interviews = []
        for schedule in schedules:
            scheduled_dt = schedule.get("scheduled_datetime")
            if isinstance(scheduled_dt, str):
                try:
                    scheduled_dt = datetime.fromisoformat(scheduled_dt.replace("Z", "+00:00"))
                except:
                    scheduled_dt = now
            
            is_today = scheduled_dt.date() == now.date() if scheduled_dt else False
            time_until = _format_time_until(scheduled_dt) if scheduled_dt else "Soon"
            
            interviews.append(UpcomingInterview(
                schedule_id=schedule.get("schedule_id", ""),
                candidate_id=schedule.get("candidate_id", ""),
                candidate_name=schedule.get("candidate_name", "Unknown"),
                candidate_title=None,  # Could fetch from pipeline
                job_title=schedule.get("job_title", ""),
                scheduled_datetime=scheduled_dt or now,
                timezone=schedule.get("timezone", "Asia/Kolkata"),
                duration_minutes=schedule.get("duration_minutes", 30),
                time_until=time_until,
                is_today=is_today,
                status=schedule.get("status", "scheduled"),
                interview_session_id=schedule.get("interview_session_id")
            ))
        
        return interviews
        
    except Exception as e:
        logger.error(f"Error getting upcoming interviews: {e}", exc_info=True)
        return []


# ================================================================
# HELPER FUNCTIONS - Candidates
# ================================================================

async def _get_recent_candidates(
    username: str, 
    mongodb: MongoDB, 
    limit: int = 6,
    stage: Optional[str] = None,
    favorites_only: bool = False,
    responded_only: bool = False
) -> List[CandidateQuickView]:
    """Get recent candidates with quick view info"""
    try:
        pipelines_collection = mongodb.main_db.recruitment_pipelines
        
        # Build match conditions
        match_conditions = {"username": username, "is_active": True}
        
        # Unwind and filter
        pipeline_stages = [
            {"$match": match_conditions},
            {"$unwind": "$candidates"},
        ]
        
        # Add filters
        if stage:
            pipeline_stages.append({"$match": {"candidates.stage": stage}})
        if favorites_only:
            pipeline_stages.append({"$match": {"candidates.is_favorite": True}})
        if responded_only:
            pipeline_stages.append({"$match": {"candidates.outreach.candidate_responded": True}})
        
        pipeline_stages.extend([
            {"$sort": {"candidates.updated_at": -1}},
            {"$limit": limit} 
        ])
        
        cursor = await pipelines_collection.aggregate(pipeline_stages)
        results = await cursor.to_list(length=limit)
        
        candidates = []
        for doc in results:
            candidate = doc.get("candidates", {})
            outreach = candidate.get("outreach", {}) or {}
            
            # Determine stage label (user-friendly)
            stage_labels = {
                "sourced": "Found",
                "enriching": "Analyzing...",
                "enriched": "Analyzed",
                "outreach_sent": "Email sent",
                "outreach_opened": "Opened email",
                "outreach_clicked": "Clicked link",
                "responded": "Replied!",
                "scheduled": "Interview scheduled",
                "interview_scheduled": "Interview scheduled",
                "interviewed": "Interviewed",
                "interview_completed": "Interview done",
                "offered": "Offer made",
                "hired": "Hired! 🎉",
                "rejected": "Not a fit",
                "withdrawn": "Withdrew"
            }
            
            candidates.append(CandidateQuickView(
                candidate_id=candidate.get("candidate_id", ""),
                name=candidate.get("name", "Unknown"),
                title=candidate.get("current_title") or candidate.get("headline"),
                stage=candidate.get("stage", "sourced"),
                stage_label=stage_labels.get(candidate.get("stage", ""), "In progress"),
                match_score=candidate.get("enrichment", {}).get("match_score"),
                last_activity=_format_relative_time(candidate.get("updated_at")),
                pipeline_id=doc.get("pipeline_id"),
                has_responded=outreach.get("candidate_responded", False),
                is_favorite=candidate.get("is_favorite", False),
                contact_email=candidate.get("contact", {}).get("email")
            ))
        
        return candidates
        
    except Exception as e:
        logger.error(f"Error getting recent candidates: {e}", exc_info=True)
        return []
    
# ===============================================================
# HELPER FUNCTIONS - Donna's Smart Tips
# ===============================================================
def _generate_donna_tip(
metrics: DashboardMetrics,
pipeline_stats: PipelineStageStats,
inbox_items: List[InboxItem],
upcoming_interviews: List[UpcomingInterview]
) -> Optional[dict]:
    """Generate contextual tips based on user's current state"""
    # Priority 1: Upcoming interviews today
    today_interviews = [i for i in upcoming_interviews if i.is_today]
    if today_interviews:
        return {
            "message": f"You have {len(today_interviews)} interview{'s' if len(today_interviews) > 1 else ''} today! I'll help you prepare. 🎤",
            "variant": "urgent",
            "action_label": "View interviews",
            "action_type": "navigate",
            "action_target": "/interviews"
        }

    # Priority 2: Unread responses
    unread_responses = [i for i in inbox_items if i.type == "response" and i.is_unread]
    if unread_responses:
        return {
            "message": f"Great news! {len(unread_responses)} candidate{'s' if len(unread_responses) > 1 else ''} replied to you! Don't keep them waiting. 💬",
            "variant": "celebration",
            "action_label": "View responses",
            "action_type": "navigate",
            "action_target": "/inbox?filter=response"
        }

    # Priority 3: Candidates waiting for outreach
    if pipeline_stats.enriched > 0 and pipeline_stats.outreach_sent == 0:
        return {
            "message": f"You have {pipeline_stats.enriched} analyzed candidates ready to contact. Time to reach out! 📧",
            "variant": "tip",
            "action_label": "Start outreach",
            "action_type": "navigate",
            "action_target": "/pipeline?stage=enriched"
        }

    # Priority 4: No searches yet
    if metrics.total_searches == 0:
        return {
            "message": "Ready to find your first amazing candidate? I'll guide you through it! 🚀",
            "variant": "default",
            "action_label": "Start searching",
            "action_type": "navigate",
            "action_target": "/search"
        }

    # Priority 5: General encouragement
    if metrics.total_candidates_analyzed > 0:
        return {
            "message": f"You've found {metrics.total_candidates_analyzed} potential candidates! Keep up the great work. 💪",
            "variant": "celebration"
        }

    return None

# ===============================================================
# UTILITY FUNCTIONS
# ===============================================================
def _format_relative_time(dt) -> str:
    """Format datetime as relative time string"""
    if not dt:
        return "Recently"
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except:
            return "Recently"

    now = datetime.utcnow()
    if dt.tzinfo:
        dt = dt.replace(tzinfo=None)

    diff = now - dt
    seconds = diff.total_seconds()

    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        mins = int(seconds / 60)
        return f"{mins}m ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours}h ago"
    elif seconds < 172800:
        return "Yesterday"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"{days} days ago"
    else:
        return dt.strftime("%b %d")\


# ================================================================
# Legacy ENDPOINTS
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
        cursor = await mongodb.conversation_sessions_collection.aggregate(pipeline)
        result = await cursor.to_list(length=1)
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
        logger.error(f"Metrics calculation error: {e}", exc_info=True)
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