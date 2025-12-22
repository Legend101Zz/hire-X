"""
Pipeline API
============
REST API endpoints for the recruitment pipeline.

Endpoints:
- Pipeline CRUD
- Candidate management
- Shortlisting
- Enrichment
- Outreach
- Dashboard

Author: NeuraLeap Engineering
Version: 2.0
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import (APIRouter, BackgroundTasks, Body, Depends, HTTPException,
                     Query)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from core.dependencies import (get_current_username, get_email_service,
                               get_pipeline_service)
from core.logging_config import get_logger
from models.pipeline_models import (STAGE_METADATA, CandidateStage,
                                    ContactFetchSource, JobContext,
                                    PipelineCandidate, PipelineSettings,
                                    RecruitmentPipeline)
from models.scheduling_models import get_current_timestamp
from services.email_outreach_service import EmailOutreachService
from services.pipeline_service import PipelineService

logger = get_logger(__name__)

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class CreatePipelineFromSearchRequest(BaseModel):
    """Create pipeline from Donna search results."""
    conversation_session_id: str = Field(..., description="Donna/manual conversation session ID")
    search_session_id: str = Field(..., description="Search results session ID")
    job_data: Dict[str, Any] = Field(..., description="Ideal profile / job requirements")
    candidates: List[Dict[str, Any]] = Field(..., description="Search result candidates")
    pipeline_name: Optional[str] = Field(None, description="Custom pipeline name")
    auto_shortlist: bool = Field(False, description="Auto-shortlist all candidates")
    
    class Config:
        json_schema_extra = {
            "example": {
                "conversation_session_id": "conv-abc123",
                "search_session_id": "search-xyz789",
                "job_data": {
                    "role_title": "Senior Backend Engineer",
                    "must_have_skills": ["Python", "FastAPI", "MongoDB"],
                    "experience_years": "5+ years",
                    "locations": ["Bangalore", "Remote"]
                },
                "candidates": [
                    {
                        "linkedin_url": "https://linkedin.com/in/johndoe",
                        "name": "John Doe",
                        "title": "Backend Engineer",
                        "current_company": "Google",
                        "experience_years": 6,
                        "skills": ["Python", "Django", "PostgreSQL"]
                    }
                ],
                "pipeline_name": "Backend Engineer - Dec 2024",
                "auto_shortlist": False
            }
        }


class CreatePipelineFromImportRequest(BaseModel):
    """Create pipeline from CSV import."""
    jd_text: str = Field(..., min_length=50, description="Job description text")
    candidates_csv: str = Field(..., description="CSV content with LinkedIn URLs")
    pipeline_name: Optional[str] = Field(None, description="Custom pipeline name")
    
    class Config:
        json_schema_extra = {
            "example": {
                "jd_text": "We are looking for a Senior Backend Engineer with 5+ years of experience in Python...",
                "candidates_csv": "linkedin_url,expected_salary,notice_period\nhttps://linkedin.com/in/johndoe,25 LPA,30 days\nhttps://linkedin.com/in/janedoe,28 LPA,60 days",
                "pipeline_name": "Backend Import - Dec 2024"
            }
        }


class PipelineResponse(BaseModel):
    """Standard pipeline response."""
    success: bool
    pipeline_id: str
    message: str
    data: Optional[Dict[str, Any]] = None


class ShortlistRequest(BaseModel):
    """Request to shortlist candidates."""
    candidate_ids: List[str] = Field(..., min_length=1, description="Candidate IDs to shortlist")


class EnrichmentRequest(BaseModel):
    """Request to start enrichment."""
    candidate_ids: Optional[List[str]] = Field(None, description="Specific candidates (None = all shortlisted)")
    include_contact_fetch: bool = Field(True, description="Fetch contact info via Hatch")


class OutreachRequest(BaseModel):
    """Request to start outreach."""
    candidate_ids: Optional[List[str]] = Field(None, description="Specific candidates (None = all enriched)")


class UpdateStageRequest(BaseModel):
    """Request to update candidate stage."""
    new_stage: CandidateStage
    notes: Optional[str] = Field(None, description="Notes for stage change")


class AddNoteRequest(BaseModel):
    """Request to add a note."""
    note: str = Field(..., min_length=1, max_length=2000)


class RejectCandidateRequest(BaseModel):
    """Request to reject a candidate."""
    reason: str = Field(..., min_length=1, description="Rejection reason")
    feedback: Optional[str] = Field(None, description="Detailed feedback")


class UpdateSettingsRequest(BaseModel):
    """Request to update pipeline settings."""
    auto_send_outreach: Optional[bool] = None
    outreach_delay_hours: Optional[int] = None
    reminder_delay_hours: Optional[int] = None
    max_reminders: Optional[int] = None
    no_response_timeout_hours: Optional[int] = None
    auto_enrich_on_shortlist: Optional[bool] = None
    notify_on_response: Optional[bool] = None
    notify_on_schedule: Optional[bool] = None
    notification_email: Optional[str] = None


class BulkActionRequest(BaseModel):
    """Request for bulk actions."""
    candidate_ids: List[str] = Field(..., min_length=1)
    action: str = Field(..., description="Action: shortlist, remove, reject, favorite")
    reason: Optional[str] = Field(None, description="Reason (for reject)")

class EmailPreviewRequest(BaseModel):
    """Request to preview email before sending."""
    custom_subject: Optional[str] = None
    custom_greeting: Optional[str] = None
    custom_body: Optional[str] = None
    custom_closing: Optional[str] = None
    tone: str = "professional"  # professional, friendly, casual

class EmailPreviewResponse(BaseModel):
    """Email preview with editable sections."""
    subject: str
    greeting: str
    body: str
    closing: str
    signature: str
    scheduling_link: str
    full_preview_html: str
    full_preview_text: str
    placeholders_used: List[str]

class StartFlowRequest(BaseModel):
    """Request to start the complete hiring flow."""
    skip_enrichment: bool = False
    auto_send_email: bool = False
    email_customization: Optional[EmailPreviewRequest] = None


# ============================================================================
# PIPELINE CRUD ENDPOINTS
# ============================================================================

@router.post(
    "/create/from-search",
    response_model=PipelineResponse,
    summary="Create Pipeline from Search",
    description="Create a new recruitment pipeline from Donna search results"
)
async def create_pipeline_from_search(
    conversation_session_id: str = Body(...),
    search_session_id: str = Body(...),
    job_data: Dict[str, Any] = Body(...),
    candidate_ids: List[str] = Body(..., description="Selected candidate IDs"),
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: str = Depends(get_current_username)
):
    """
    Create individual pipelines for selected candidates.
    Each candidate gets their own pipeline.
    """
    try:
        pipeline_ids = await pipeline_service.create_pipelines_from_search(
            username=current_user,
            conversation_session_id=conversation_session_id,
            search_session_id=search_session_id,
            job_data=job_data,
            candidate_ids=candidate_ids
        )
        
        return {
            "success": True,
            "message": f"Created {len(pipeline_ids)} pipelines",
            "pipeline_ids": pipeline_ids
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/create/from-import",
    response_model=PipelineResponse,
    summary="Create Pipeline from Import",
    description="Create a new recruitment pipeline from CSV import"
)
async def create_pipeline_from_import(
    request: CreatePipelineFromImportRequest,
    background_tasks: BackgroundTasks,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """
    Create a recruitment pipeline from manual CSV import.
    
    CSV format should have columns:
    - linkedin_url (required)
    - expected_salary (optional)
    - notice_period (optional)
    - preferred_location (optional)
    - notes (optional)
    """
    try:
        pipeline = await pipeline_service.create_pipeline_from_import(
            username=current_user,
            jd_text=request.jd_text,
            candidates_csv=request.candidates_csv,
            pipeline_name=request.pipeline_name
        )
        
        return PipelineResponse(
            success=True,
            pipeline_id=pipeline.pipeline_id,
            message=f"Pipeline created with {len(pipeline.candidates)} candidates",
            data={
                "name": pipeline.display_name,
                "total_candidates": len(pipeline.candidates),
                "job_title": pipeline.job.job_title
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Pipeline import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_pipelines(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: str = Depends(get_current_username)
):
    """List all pipelines with single-candidate format."""
    try:
        query = {"username": current_user}
        if status:
            query["status"] = status
        
        total = await pipeline_service.pipelines_collection.count_documents(query)
        cursor = pipeline_service.pipelines_collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
        pipeline_docs = await cursor.to_list(length=limit)
        
        pipelines = []
        for doc in pipeline_docs:
            doc.pop("_id", None)
            candidate = doc.get("candidate", {})
            job = doc.get("job", {})
            
            pipelines.append({
                "pipeline_id": doc.get("pipeline_id"),
                "name": f"{candidate.get('name', 'Unknown')} - {job.get('job_title', 'Position')}",
                "source": "donna_search",  # or doc.get("source", "donna_search")
                "status": doc.get("status", "active"),
                "conversation_session_id": doc.get("conversation_session_id"),
                "stage": candidate.get("stage", "enriching"),
                "stage_label": STAGE_METADATA.get(
                    CandidateStage(candidate.get("stage", "enriching")), {}
                ).get("label", "Unknown"),
                "candidate": {
                    "candidate_id": candidate.get("candidate_id"),
                    "name": candidate.get("name", "Unknown"),
                    "headline": candidate.get("headline"),
                    "current_title": candidate.get("current_title"),
                    "current_company": candidate.get("current_company"),
                    "location": candidate.get("location"),
                    "linkedin_url": candidate.get("linkedin_url"),
                    "profile_picture_url": candidate.get("profile_picture_url"),
                    "enrichment": {
                        "match_score": candidate.get("enrichment", {}).get("match_score")
                    }
                },
                "job": {
                    "job_title": job.get("job_title"),
                    "company_name": job.get("company_name")
                },
                "stats": {
                    "total_sourced": 1,
                    "total_responded": 1 if candidate.get("stage") in ["outreach_sent", "scheduled"] else 0,
                    "total_scheduled": 1 if candidate.get("stage") == "scheduled" else 0,
                    "total_hired": 1 if candidate.get("stage") == "hired" else 0,
                    "total_contacted": 1 if candidate.get("stage") in ["outreach_sent", "scheduled"] else 0,
                },
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at")
            })
        
        return {
            "success": True,
            "pipelines": pipelines,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(pipelines) < total
        }
        
    except Exception as e:
        logger.error(f"Failed to list pipelines: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get(
    "/{pipeline_id}",
    summary="Get Pipeline",
    description="Get pipeline details"
)
async def get_pipeline(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Get full pipeline details including all candidates."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "success": True,
            "pipeline": pipeline.model_dump()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{pipeline_id}/dashboard",
    summary="Get Pipeline Dashboard",
    description="Get visual dashboard data for pipeline tracking"
)
async def get_pipeline_dashboard(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """
    Get dashboard data for visual pipeline tracking.
    
    Returns structured data for the pipeline tracking UI,
    similar to order delivery status tracking.
    """
    try:
        dashboard = await pipeline_service.get_dashboard(
            pipeline_id=pipeline_id,
            username=current_user
        )
        
        return {
            "success": True,
            **dashboard
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{pipeline_id}/settings",
    summary="Update Pipeline Settings",
    description="Update pipeline configuration settings"
)
async def update_pipeline_settings(
    pipeline_id: str,
    request: UpdateSettingsRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Update pipeline settings."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update settings
        updates = request.model_dump(exclude_none=True)
        for key, value in updates.items():
            if hasattr(pipeline.settings, key):
                setattr(pipeline.settings, key, value)
        
        await pipeline_service._save_pipeline(pipeline)
        
        return {
            "success": True,
            "message": "Settings updated",
            "settings": pipeline.settings.model_dump()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/{pipeline_id}",
    summary="Archive Pipeline",
    description="Archive a pipeline (soft delete)"
)
async def archive_pipeline(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Archive a pipeline (soft delete)."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        pipeline.status = "archived"
        pipeline.is_active = False
        pipeline.archived_at = datetime.utcnow().isoformat()
        
        await pipeline_service._save_pipeline(pipeline)
        
        return {
            "success": True,
            "message": "Pipeline archived"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to archive pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SHORTLISTING ENDPOINTS
# ============================================================================

@router.post(
    "/{pipeline_id}/shortlist",
    summary="Shortlist Candidates",
    description="Move candidates to shortlist stage"
)
async def shortlist_candidates(
    pipeline_id: str,
    request: ShortlistRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """
    Shortlist candidates for enrichment and outreach.
    
    This is the gateway to Phase 2 - once shortlisted, candidates
    can be enriched and contacted.
    """
    try:
        pipeline, count = await pipeline_service.shortlist_candidates(
            pipeline_id=pipeline_id,
            candidate_ids=request.candidate_ids,
            username=current_user
        )
        
        return {
            "success": True,
            "message": f"Shortlisted {count} candidates",
            "shortlisted_count": count,
            "stats": pipeline.stats.model_dump()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Shortlisting failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{pipeline_id}/remove-from-shortlist",
    summary="Remove from Shortlist",
    description="Move candidates back to sourced stage"
)
async def remove_from_shortlist(
    pipeline_id: str,
    request: ShortlistRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Remove candidates from shortlist (move back to sourced)."""
    try:
        pipeline, count = await pipeline_service.remove_from_shortlist(
            pipeline_id=pipeline_id,
            candidate_ids=request.candidate_ids,
            username=current_user
        )
        
        return {
            "success": True,
            "message": f"Removed {count} candidates from shortlist",
            "removed_count": count
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Remove from shortlist failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENRICHMENT ENDPOINTS
# ============================================================================

@router.get("/{pipeline_id}/enriched")
async def get_enriched_view(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: str = Depends(get_current_username)
):
    """Get enriched dashboard for single candidate."""
    try:
        dashboard = await pipeline_service.get_enriched_dashboard(
            pipeline_id=pipeline_id,
            username=current_user
        )
        return {"success": True, **dashboard}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get enriched view: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/enrich")
async def start_enrichment(
    pipeline_id: str,
    include_contact_fetch: bool = Body(True, embed=True),
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: str = Depends(get_current_username)
):
    """Start enrichment for single candidate."""
    try:
        result = await pipeline_service.start_enrichment(
            pipeline_id=pipeline_id,
            username=current_user,
            include_contact_fetch=include_contact_fetch
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Enrichment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{pipeline_id}/enrichment-status",
    summary="Get Enrichment Status",
    description="Get status of ongoing enrichment"
)
async def get_enrichment_status(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Get current enrichment status for all candidates."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build enrichment status
        status = {
            "enriching": [],
            "enriched": [],
            "failed": [],
            "pending": []
        }
        
        for c in pipeline.candidates:
            candidate_info = {
                "candidate_id": c.candidate_id,
                "name": c.display_name,
                "stage": c.stage.value
            }
            
            if c.stage == CandidateStage.ENRICHING:
                status["enriching"].append(candidate_info)
            elif c.stage == CandidateStage.ENRICHED:
                candidate_info["match_score"] = c.enrichment.match_score
                candidate_info["has_email"] = bool(c.contact.email)
                status["enriched"].append(candidate_info)
            elif c.stage == CandidateStage.ENRICHMENT_FAILED:
                candidate_info["error"] = c.enrichment.enrichment_error
                status["failed"].append(candidate_info)
            elif c.stage == CandidateStage.SHORTLISTED:
                status["pending"].append(candidate_info)
        
        return {
            "success": True,
            "pipeline_id": pipeline_id,
            "status": status,
            "summary": {
                "enriching": len(status["enriching"]),
                "enriched": len(status["enriched"]),
                "failed": len(status["failed"]),
                "pending": len(status["pending"])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get enrichment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# OUTREACH ENDPOINTS
# ============================================================================

@router.post(
    "/{pipeline_id}/outreach",
    summary="Start Outreach",
    description="Send personalized emails to enriched candidates"
)
async def start_outreach(
    pipeline_id: str,
    request: OutreachRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """
    Start email outreach for enriched candidates.
    
    This:
    1. Generates personalized emails using AI
    2. Sends emails with scheduling links
    3. Tracks delivery and engagement
    """
    try:
        result = await pipeline_service.start_outreach(
            pipeline_id=pipeline_id,
            username=current_user,
            candidate_ids=request.candidate_ids
        )
        
        return {
            "success": True,
            **result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Outreach start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{pipeline_id}/send-reminders",
    summary="Send Reminder Emails",
    description="Send reminder emails to non-responders"
)
async def send_reminders(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Send reminder emails to candidates who haven't responded."""
    try:
        # Verify ownership first
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        result = await pipeline_service.send_reminder_emails(pipeline_id)
        
        return {
            "success": True,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send reminders failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{pipeline_id}/outreach-status",
    summary="Get Outreach Status",
    description="Get email engagement status"
)
async def get_outreach_status(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Get outreach status and engagement metrics."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        outreach_data = []
        
        for c in pipeline.candidates:
            if c.outreach:
                outreach_data.append({
                    "candidate_id": c.candidate_id,
                    "name": c.display_name,
                    "email": c.contact.email,
                    "stage": c.stage.value,
                    "initial_sent_at": c.outreach.initial_email_sent_at,
                    "reminder_count": c.outreach.reminder_count,
                    "last_reminder_at": c.outreach.last_reminder_sent_at,
                    "opens": c.outreach.total_opens,
                    "clicks": c.outreach.total_clicks,
                    "first_opened_at": c.outreach.first_opened_at,
                    "first_clicked_at": c.outreach.first_clicked_at,
                    "responded": c.outreach.candidate_responded,
                    "response_type": c.outreach.response_type
                })
        
        return {
            "success": True,
            "pipeline_id": pipeline_id,
            "outreach": outreach_data,
            "summary": {
                "total_contacted": pipeline.stats.total_contacted,
                "total_opened": pipeline.stats.total_opened,
                "total_clicked": pipeline.stats.total_clicked,
                "total_responded": pipeline.stats.total_responded,
                "response_rate": pipeline.stats.response_rate
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get outreach status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CANDIDATE MANAGEMENT ENDPOINTS
# ============================================================================

@router.get(
    "/{pipeline_id}/candidates",
    summary="List Candidates",
    description="List all candidates in a pipeline"
)
async def list_candidates(
    pipeline_id: str,
    stage: Optional[str] = Query(None, description="Filter by stage"),
    search: Optional[str] = Query(None, description="Search by name"),
    sort_by: str = Query("added_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """List candidates with filtering, searching, and pagination."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Filter candidates
        candidates = pipeline.get_active_candidates()
        
        # Filter by stage
        if stage:
            try:
                stage_enum = CandidateStage(stage)
                candidates = [c for c in candidates if c.stage == stage_enum]
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}")
        
        # Search by name
        if search:
            search_lower = search.lower()
            candidates = [
                c for c in candidates 
                if search_lower in c.display_name.lower() or
                   (c.current_company and search_lower in c.current_company.lower()) or
                   (c.current_title and search_lower in c.current_title.lower())
            ]
        
        # Sort
        reverse = sort_order == "desc"
        if sort_by == "added_at":
            candidates.sort(key=lambda c: c.added_at, reverse=reverse)
        elif sort_by == "name":
            candidates.sort(key=lambda c: c.display_name.lower(), reverse=reverse)
        elif sort_by == "match_score":
            candidates.sort(key=lambda c: c.enrichment.match_score or 0, reverse=reverse)
        elif sort_by == "stage":
            candidates.sort(key=lambda c: c.stage.value, reverse=reverse)
        
        # Paginate
        total = len(candidates)
        candidates = candidates[offset:offset + limit]
        
        # Build response
        candidates_data = []
        for c in candidates:
            stage_meta = c.get_stage_metadata()
            candidates_data.append({
                "candidate_id": c.candidate_id,
                "name": c.display_name,
                "headline": c.headline,
                "current_title": c.current_title,
                "current_company": c.current_company,
                "location": c.location,
                "experience_years": c.experience_years,
                "linkedin_url": c.linkedin_url,
                "profile_picture_url": c.profile_picture_url,
                "stage": c.stage.value,
                "stage_label": stage_meta.get("label"),
                "stage_icon": stage_meta.get("icon"),
                "stage_color": stage_meta.get("color"),
                "match_score": c.enrichment.match_score,
                "match_label": c.enrichment.match_label,
                "has_email": bool(c.contact.email),
                "has_phone": bool(c.contact.phone),
                "is_favorite": c.is_favorite,
                "priority": c.priority,
                "tags": c.tags,
                "added_at": c.added_at
            })
        
        return {
            "success": True,
            "candidates": candidates_data,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(candidates_data) < total
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{pipeline_id}/candidates/{candidate_id}",
    summary="Get Candidate Detail",
    description="Get full candidate details"
)
async def get_candidate_detail(
    pipeline_id: str,
    candidate_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Get complete candidate details including enrichment and timeline."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.get_candidate(candidate_id)
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Build timeline from stage history
        timeline = []
        for entry in candidate.stage_history:
            stage_meta = STAGE_METADATA.get(CandidateStage(entry.to_stage), {})
            timeline.append({
                "from_stage": entry.from_stage,
                "to_stage": entry.to_stage,
                "stage_label": stage_meta.get("label", entry.to_stage),
                "stage_icon": stage_meta.get("icon", "•"),
                "timestamp": entry.transitioned_at,
                "triggered_by": entry.triggered_by,
                "notes": entry.notes
            })
        
        # Add outreach events to timeline
        if candidate.outreach:
            if candidate.outreach.initial_email_sent_at:
                timeline.append({
                    "event": "email_sent",
                    "label": "Initial Email Sent",
                    "icon": "📧",
                    "timestamp": candidate.outreach.initial_email_sent_at
                })
            if candidate.outreach.first_opened_at:
                timeline.append({
                    "event": "email_opened",
                    "label": "Email Opened",
                    "icon": "👀",
                    "timestamp": candidate.outreach.first_opened_at
                })
            if candidate.outreach.first_clicked_at:
                timeline.append({
                    "event": "link_clicked",
                    "label": "Scheduling Link Clicked",
                    "icon": "🔗",
                    "timestamp": candidate.outreach.first_clicked_at
                })
        
        # Add interview events
        if candidate.interview.scheduled_datetime:
            timeline.append({
                "event": "interview_scheduled",
                "label": "Interview Scheduled",
                "icon": "📅",
                "timestamp": candidate.interview.scheduled_datetime
            })
        if candidate.interview.call_ended_at:
            timeline.append({
                "event": "interview_completed",
                "label": "Interview Completed",
                "icon": "🎤",
                "timestamp": candidate.interview.call_ended_at
            })
        
        # Sort timeline by timestamp
        timeline.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return {
            "success": True,
            "candidate": candidate.model_dump(),
            "stage_metadata": candidate.get_stage_metadata(),
            "job_context": pipeline.job.model_dump(),
            "timeline": timeline
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get candidate detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/{pipeline_id}/candidates/{candidate_id}/stage",
    summary="Update Candidate Stage",
    description="Manually update candidate stage"
)
async def update_candidate_stage(
    pipeline_id: str,
    candidate_id: str,
    request: UpdateStageRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Manually update a candidate's stage."""
    try:
        candidate = await pipeline_service.update_candidate_stage(
            pipeline_id=pipeline_id,
            candidate_id=candidate_id,
            new_stage=request.new_stage,
            username=current_user,
            notes=request.notes
        )
        
        return {
            "success": True,
            "message": f"Stage updated to {request.new_stage.value}",
            "candidate_id": candidate.candidate_id,
            "new_stage": candidate.stage.value
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update stage: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{pipeline_id}/candidates/{candidate_id}/notes",
    summary="Add Note",
    description="Add a note to a candidate"
)
async def add_candidate_note(
    pipeline_id: str,
    candidate_id: str,
    request: AddNoteRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Add a recruiter note to a candidate."""
    try:
        candidate = await pipeline_service.add_candidate_note(
            pipeline_id=pipeline_id,
            candidate_id=candidate_id,
            note=request.note,
            username=current_user
        )
        
        return {
            "success": True,
            "message": "Note added",
            "notes_count": len(candidate.recruiter_notes)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to add note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{pipeline_id}/candidates/{candidate_id}/favorite",
    summary="Toggle Favorite",
    description="Toggle favorite status"
)
async def toggle_favorite(
    pipeline_id: str,
    candidate_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Toggle favorite status for a candidate."""
    try:
        is_favorite = await pipeline_service.toggle_candidate_favorite(
            pipeline_id=pipeline_id,
            candidate_id=candidate_id,
            username=current_user
        )
        
        return {
            "success": True,
            "is_favorite": is_favorite
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to toggle favorite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{pipeline_id}/candidates/{candidate_id}/reject",
    summary="Reject Candidate",
    description="Reject a candidate with reason"
)
async def reject_candidate(
    pipeline_id: str,
    candidate_id: str,
    request: RejectCandidateRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Reject a candidate with reason and optional feedback."""
    try:
        candidate = await pipeline_service.reject_candidate(
            pipeline_id=pipeline_id,
            candidate_id=candidate_id,
            username=current_user,
            reason=request.reason,
            feedback=request.feedback
        )
        
        return {
            "success": True,
            "message": "Candidate rejected",
            "candidate_id": candidate.candidate_id
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to reject candidate: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# BULK ACTIONS
# ============================================================================

@router.post(
    "/{pipeline_id}/bulk-action",
    summary="Bulk Action",
    description="Perform bulk actions on multiple candidates"
)
async def bulk_action(
    pipeline_id: str,
    request: BulkActionRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """
    Perform bulk actions on multiple candidates.
    
    Actions:
    - shortlist: Move to shortlist stage
    - remove: Remove from pipeline (soft delete)
    - reject: Reject with reason
    - favorite: Toggle favorite
    """
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        action = request.action.lower()
        affected_count = 0
        errors = []
        
        for candidate_id in request.candidate_ids:
            try:
                candidate = pipeline.get_candidate(candidate_id)
                if not candidate:
                    errors.append(f"{candidate_id}: not found")
                    continue
                
                if action == "shortlist":
                    if candidate.stage == CandidateStage.SOURCED:
                        candidate.update_stage(CandidateStage.SHORTLISTED, triggered_by="user")
                        affected_count += 1
                
                elif action == "remove":
                    candidate.is_removed = True
                    candidate.removed_at = datetime.utcnow().isoformat()
                    candidate.removed_reason = request.reason
                    affected_count += 1
                
                elif action == "reject":
                    if not request.reason:
                        errors.append(f"{candidate_id}: reason required for rejection")
                        continue
                    candidate.update_stage(CandidateStage.REJECTED, triggered_by="user")
                    candidate.final_decision = "rejected"
                    candidate.rejection_reason = request.reason
                    affected_count += 1
                
                elif action == "favorite":
                    candidate.is_favorite = not candidate.is_favorite
                    affected_count += 1
                
                else:
                    raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
                
                pipeline.update_candidate(candidate)
                
            except Exception as e:
                errors.append(f"{candidate_id}: {str(e)}")
        
        pipeline.recalculate_stats()
        await pipeline_service._save_pipeline(pipeline)
        
        return {
            "success": True,
            "action": action,
            "affected_count": affected_count,
            "errors": errors if errors else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk action failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@router.get(
    "/{pipeline_id}/analytics",
    summary="Get Analytics",
    description="Get detailed pipeline analytics"
)
async def get_pipeline_analytics(
    pipeline_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    current_user: Dict = Depends(get_current_username)
):
    """Get detailed analytics for a pipeline."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="Pipeline not found")
        
        if pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Recalculate stats
        pipeline.recalculate_stats()
        
        # Stage distribution
        stage_distribution = {}
        for c in pipeline.get_active_candidates():
            stage = c.stage.value
            stage_distribution[stage] = stage_distribution.get(stage, 0) + 1
        
        # Score distribution
        score_buckets = {
            "excellent (85-100)": 0,
            "great (70-84)": 0,
            "good (55-69)": 0,
            "fair (40-54)": 0,
            "below (<40)": 0,
            "not scored": 0
        }
        
        for c in pipeline.get_active_candidates():
            score = c.enrichment.match_score
            if score is None:
                score_buckets["not scored"] += 1
            elif score >= 85:
                score_buckets["excellent (85-100)"] += 1
            elif score >= 70:
                score_buckets["great (70-84)"] += 1
            elif score >= 55:
                score_buckets["good (55-69)"] += 1
            elif score >= 40:
                score_buckets["fair (40-54)"] += 1
            else:
                score_buckets["below (<40)"] += 1
        
        # Email engagement
        email_stats = {
            "sent": 0,
            "delivered": 0,
            "opened": 0,
            "clicked": 0,
            "responded": 0
        }
        
        for c in pipeline.candidates:
            if c.outreach:
                if c.outreach.initial_email_sent_at:
                    email_stats["sent"] += 1
                if c.outreach.total_opens > 0:
                    email_stats["opened"] += 1
                if c.outreach.total_clicks > 0:
                    email_stats["clicked"] += 1
                if c.outreach.candidate_responded:
                    email_stats["responded"] += 1
        
        # Conversion funnel
        funnel = [
            {"stage": "Sourced", "count": pipeline.stats.total_sourced},
            {"stage": "Shortlisted", "count": pipeline.stats.total_shortlisted},
            {"stage": "Enriched", "count": pipeline.stats.total_enriched},
            {"stage": "Contacted", "count": pipeline.stats.total_contacted},
            {"stage": "Responded", "count": pipeline.stats.total_responded},
            {"stage": "Scheduled", "count": pipeline.stats.total_scheduled},
            {"stage": "Interviewed", "count": pipeline.stats.total_interviewed},
            {"stage": "Hired", "count": pipeline.stats.total_hired}
        ]
        
        return {
            "success": True,
            "pipeline_id": pipeline_id,
            "stats": pipeline.stats.model_dump(),
            "stage_distribution": stage_distribution,
            "score_distribution": score_buckets,
            "email_engagement": email_stats,
            "conversion_funnel": funnel,
            "calculated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STAGE METADATA ENDPOINT
# ============================================================================

@router.get(
    "/stages/metadata",
    summary="Get Stage Metadata",
    description="Get metadata for all pipeline stages"
)
async def get_stage_metadata():
    """Get metadata for all pipeline stages (icons, colors, labels)."""
    stages = []
    
    for stage in CandidateStage:
        meta = STAGE_METADATA.get(stage, {})
        stages.append({
            "value": stage.value,
            "label": meta.get("label", stage.value),
            "icon": meta.get("icon", "•"),
            "color": meta.get("color", "gray"),
            "description": meta.get("description", "")
        })
    
    return {
        "success": True,
        "stages": stages
    }

    
@router.post("/{pipeline_id}/manual-contact")
async def provide_manual_contact(
    pipeline_id: str,
    request: dict = Body(...),  # {email: str, phone?: str}
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Allow user to manually provide contact info if fetch failed."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        
        # Update contact info
        if request.get("email"):
            candidate.contact.email = request["email"]
            candidate.contact.email_verified = False
            candidate.contact.email_source = ContactFetchSource.MANUAL_INPUT
            candidate.contact.email_fetched_at = get_current_timestamp()
        
        if request.get("phone"):
            candidate.contact.phone = request["phone"]
            candidate.contact.phone_source = ContactFetchSource.MANUAL_INPUT
            candidate.contact.phone_fetched_at = get_current_timestamp()
        
        # Update stage if was failed
        if candidate.stage == CandidateStage.ENRICHMENT_FAILED:
            candidate.update_stage(CandidateStage.ENRICHED, triggered_by="user")
        
        await pipeline_service._save_pipeline(pipeline)
        
        return {
            "success": True,
            "message": "Contact information updated",
            "has_email": bool(candidate.contact.email),
            "has_phone": bool(candidate.contact.phone)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manual contact update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get(
    "/health",
    summary="Health Check",
    description="Check pipeline service health"
)
async def health_check(
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    email_service: EmailOutreachService = Depends(get_email_service)
):
    """Check health of pipeline and email services."""
    try:
        # Check email service
        email_health = await email_service.check_health()
        
        return {
            "success": True,
            "pipeline_service": "healthy",
            "email_service": email_health
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/{pipeline_id}/enrich-with-status")
async def enrich_with_status(
    pipeline_id: str,
    auto_outreach: bool = Body(False, embed=True),
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Enrich single candidate with detailed status response.
    Returns full enrichment result instead of just triggering background task.
    """
    try:
        result = await pipeline_service.enrich_candidate_with_status(
            pipeline_id=pipeline_id,
            username=current_user,
            include_contact_fetch=True,
            auto_outreach=auto_outreach
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Enrichment failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/provide-email")
async def provide_email_and_outreach(
    pipeline_id: str,
    request: dict = Body(...),  # {email: str, phone?: str, auto_outreach?: bool}
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Accept manual email input and optionally auto-trigger outreach.
    """
    try:
        result = await pipeline_service.provide_manual_email_and_outreach(
            pipeline_id=pipeline_id,
            email=request.get("email"),
            phone=request.get("phone"),
            username=current_user,
            auto_send_outreach=request.get("auto_outreach", True)
        )
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Manual email failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/candidate-timeline")
async def get_candidate_timeline(
    pipeline_id: str,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Get detailed timeline for candidate journey visualization.
    """
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        
        # Build timeline events
        timeline = []
        
        # Stage history
        for entry in candidate.stage_history:
            stage_meta = STAGE_METADATA.get(CandidateStage(entry.to_stage), {})
            timeline.append({
                "type": "stage_change",
                "stage": entry.to_stage,
                "label": stage_meta.get("label", entry.to_stage),
                "icon": stage_meta.get("icon", "•"),
                "color": stage_meta.get("color", "gray"),
                "timestamp": entry.transitioned_at,
                "triggered_by": entry.triggered_by,
                "notes": entry.notes
            })
        
        # Email events
        if candidate.contact.email_fetched_at:
            timeline.append({
                "type": "email_found",
                "label": f"Email found via {candidate.contact.email_source.value if candidate.contact.email_source else 'unknown'}",
                "icon": "📧",
                "color": "green",
                "timestamp": candidate.contact.email_fetched_at,
                "details": {"email": candidate.contact.email}
            })
        
        # Outreach events
        if candidate.outreach:
            if candidate.outreach.initial_email_sent_at:
                timeline.append({
                    "type": "outreach_sent",
                    "label": "Outreach email sent",
                    "icon": "📤",
                    "color": "purple",
                    "timestamp": candidate.outreach.initial_email_sent_at
                })
            
            if candidate.outreach.first_opened_at:
                timeline.append({
                    "type": "email_opened",
                    "label": f"Email opened ({candidate.outreach.total_opens} times)",
                    "icon": "👀",
                    "color": "blue",
                    "timestamp": candidate.outreach.first_opened_at
                })
            
            if candidate.outreach.first_clicked_at:
                timeline.append({
                    "type": "link_clicked",
                    "label": "Scheduling link clicked",
                    "icon": "🔗",
                    "color": "indigo",
                    "timestamp": candidate.outreach.first_clicked_at
                })
            
            for i in range(candidate.outreach.reminder_count):
                if candidate.outreach.last_reminder_sent_at:
                    timeline.append({
                        "type": "reminder_sent",
                        "label": f"Reminder #{i+1} sent",
                        "icon": "🔔",
                        "color": "amber",
                        "timestamp": candidate.outreach.last_reminder_sent_at
                    })
        
        # Interview events
        if candidate.interview.scheduled_datetime:
            timeline.append({
                "type": "interview_scheduled",
                "label": "Interview scheduled",
                "icon": "📅",
                "color": "teal",
                "timestamp": candidate.interview.scheduled_datetime
            })
        
        if candidate.interview.call_initiated_at:
            timeline.append({
                "type": "interview_started",
                "label": "Interview call started",
                "icon": "📞",
                "color": "cyan",
                "timestamp": candidate.interview.call_initiated_at
            })
        
        if candidate.interview.call_ended_at:
            timeline.append({
                "type": "interview_completed",
                "label": "Interview completed",
                "icon": "✅",
                "color": "green",
                "timestamp": candidate.interview.call_ended_at,
                "details": {
                    "duration_seconds": candidate.interview.call_duration_seconds,
                    "score": candidate.interview.overall_score,
                    "recommendation": candidate.interview.recommendation
                }
            })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return {
            "success": True,
            "pipeline_id": pipeline_id,
            "candidate": {
                "id": candidate.candidate_id,
                "name": candidate.display_name,
                "current_stage": candidate.stage.value,
                "current_stage_label": candidate.get_stage_metadata().get("label")
            },
            "timeline": timeline
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Timeline fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/{pipeline_id}/journey")
async def get_candidate_journey(
    pipeline_id: str,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Get complete candidate journey with all phases for timeline view.
    Optimized for HR-friendly display.
    """
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        job = pipeline.job
        
        # Build journey phases
        journey = {
            "pipeline_id": pipeline_id,
            "candidate": {
                "id": candidate.candidate_id,
                "name": candidate.display_name,
                "headline": candidate.headline,
                "current_title": candidate.current_title,
                "current_company": candidate.current_company,
                "location": candidate.location,
                "linkedin_url": candidate.linkedin_url,
                "profile_picture_url": candidate.profile_picture_url,
                "experience_years": candidate.experience_years
            },
            "job": {
                "title": job.job_title,
                "company": job.company_name,
                "required_skills": job.required_skills[:5]
            },
            "current_stage": candidate.stage.value,
            "phases": []
        }
        
        # Phase 1: Sourcing
        journey["phases"].append({
            "id": "sourced",
            "name": "Candidate Found",
            "icon": "search",
            "status": "completed",
            "completed_at": candidate.added_at,
            "summary": f"Added to pipeline for {job.job_title}",
            "expandable": False
        })
        
        # Phase 2: Enrichment
        enrichment_phase = {
            "id": "enrichment",
            "name": "Deep Analysis",
            "icon": "brain",
            "status": "completed" if candidate.enrichment.is_enriched else (
                "in_progress" if candidate.stage.value == "enriching" else "pending"
            ),
            "completed_at": candidate.enrichment.enriched_at,
            "expandable": True,
            "data": None
        }
        
        if candidate.enrichment.is_enriched:
            enrichment_data = candidate.enrichment.full_enrichment_data or {}
            match_analysis = enrichment_data.get("match_analysis", {})
            
            enrichment_phase["summary"] = f"Match Score: {candidate.enrichment.match_score or 0}%"
            enrichment_phase["data"] = {
                "match_score": candidate.enrichment.match_score,
                "match_label": candidate.enrichment.match_label,
                "strengths": candidate.enrichment.top_strengths[:3],
                "concerns": candidate.enrichment.concerns[:3],
                "recommendation": match_analysis.get("hiring_recommendation", {}),
                "executive_summary": match_analysis.get("recruiter_summary", {}).get("elevator_pitch"),
                "experience_assessment": match_analysis.get("experience_assessment", {}),
                "skill_validation": enrichment_data.get("skill_validation", {}),
                "salary_estimate": enrichment_data.get("salary_timeline", {}),
                "response_likelihood": enrichment_data.get("response_likelihood", {})
            }
        else:
            enrichment_phase["summary"] = "Pending analysis"
            
        journey["phases"].append(enrichment_phase)
        
        # Phase 3: Contact & Outreach
        outreach_phase = {
            "id": "outreach",
            "name": "Email Outreach",
            "icon": "mail",
            "status": "pending",
            "expandable": True,
            "data": None
        }
        
        if candidate.contact.email:
            outreach_phase["status"] = "ready" if not candidate.outreach else "completed"
            
        if candidate.outreach:
            outreach_phase["status"] = "completed"
            outreach_phase["completed_at"] = candidate.outreach.initial_email_sent_at
            outreach_phase["summary"] = "Email delivered"
            
            # Get email content from outreach record
            emails = candidate.outreach.emails if hasattr(candidate.outreach, 'emails') else []
            initial_email = next((e for e in emails if e.email_type.value == "initial"), None)
            
            outreach_phase["data"] = {
                "email_address": candidate.contact.email,
                "sent_at": candidate.outreach.initial_email_sent_at,
                "subject": initial_email.subject if initial_email else "Interview Invitation",
                "body": initial_email.body_plain if initial_email else None,
                "opened": candidate.outreach.total_opens > 0,
                "opened_at": candidate.outreach.first_opened_at,
                "open_count": candidate.outreach.total_opens,
                "clicked": candidate.outreach.total_clicks > 0,
                "clicked_at": candidate.outreach.first_clicked_at,
                "click_count": candidate.outreach.total_clicks,
                "responded": candidate.outreach.candidate_responded,
                "response_type": candidate.outreach.response_type,
                "scheduling_link": candidate.outreach.scheduling_link
            }
        else:
            outreach_phase["summary"] = "Email ready" if candidate.contact.email else "Missing email"
            outreach_phase["data"] = {
                "email_address": candidate.contact.email,
                "email_missing": not bool(candidate.contact.email),
                "email_source": candidate.contact.email_source.value if candidate.contact.email_source else None
            }
            
        journey["phases"].append(outreach_phase)
        
        # Phase 4: Scheduling
        scheduling_phase = {
            "id": "scheduling",
            "name": "Interview Scheduled",
            "icon": "calendar",
            "status": "pending",
            "expandable": True,
            "data": None
        }
        
        if candidate.interview.scheduled_datetime:
            scheduling_phase["status"] = "completed"
            scheduling_phase["completed_at"] = candidate.interview.scheduled_datetime
            scheduling_phase["summary"] = f"Scheduled for {candidate.interview.scheduled_datetime}"
            scheduling_phase["data"] = {
                "scheduled_datetime": candidate.interview.scheduled_datetime,
                "timezone": candidate.interview.timezone,
                "duration_minutes": candidate.interview.duration_minutes,
                "phone_number": candidate.contact.phone
            }
        elif candidate.outreach and candidate.outreach.first_clicked_at:
            scheduling_phase["status"] = "in_progress"
            scheduling_phase["summary"] = "Candidate is choosing a time"
            
        journey["phases"].append(scheduling_phase)
        
        # Phase 5: Interview
        interview_phase = {
            "id": "interview",
            "name": "AI Interview",
            "icon": "phone",
            "status": "pending",
            "expandable": True,
            "data": None
        }
        
        if candidate.interview.interview_session_id:
            # Fetch interview data from Vapi service
            interview_data = await pipeline_service._get_interview_details(
                candidate.interview.interview_session_id
            )
            
            if candidate.interview.call_ended_at:
                interview_phase["status"] = "completed"
                interview_phase["completed_at"] = candidate.interview.call_ended_at
                duration_mins = (candidate.interview.call_duration_seconds or 0) / 60
                interview_phase["summary"] = f"{duration_mins:.0f} min interview completed"
            else:
                interview_phase["status"] = "in_progress"
                interview_phase["summary"] = "Call in progress..."
            
            interview_phase["data"] = {
                "session_id": candidate.interview.interview_session_id,
                "duration_seconds": candidate.interview.call_duration_seconds,
                "recording_url": candidate.interview.recording_url,
                "transcript_available": candidate.interview.transcript_available,
                "assessment": interview_data.get("assessment") if interview_data else None,
                "clips": interview_data.get("clips", []) if interview_data else [],
                "transcript": interview_data.get("transcript", []) if interview_data else [],
                "call_quality": interview_data.get("call_quality") if interview_data else None
            }
            
        journey["phases"].append(interview_phase)
        
        # Phase 6: Final Decision
        decision_phase = {
            "id": "decision",
            "name": "Hiring Decision",
            "icon": "award",
            "status": "pending",
            "expandable": True,
            "data": None
        }
        
        if candidate.final_decision:
            decision_phase["status"] = "completed"
            decision_phase["completed_at"] = candidate.final_decision_at
            decision_phase["summary"] = candidate.final_decision.title()
            decision_phase["data"] = {
                "decision": candidate.final_decision,
                "decided_by": candidate.final_decision_by,
                "reason": candidate.rejection_reason if candidate.final_decision == "rejected" else None
            }
        elif candidate.interview.assessment_ready:
            decision_phase["status"] = "ready"
            decision_phase["summary"] = "Ready for your decision"
            decision_phase["data"] = {
                "recommendation": candidate.interview.recommendation,
                "score": candidate.interview.overall_score,
                "assessment": candidate.interview.assessment_data
            }
            
        journey["phases"].append(decision_phase)
        
        return {"success": True, "journey": journey}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Journey fetch failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/interview-details")
async def get_interview_details(
    pipeline_id: str,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Get detailed interview data including clips and transcript."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        
        if not candidate.interview.interview_session_id:
            return {"success": False, "error": "No interview found"}
        
        interview_data = await pipeline_service._get_interview_details(
            candidate.interview.interview_session_id
        )
        
        if not interview_data:
            return {"success": False, "error": "Interview data not available"}
        
        return {
            "success": True,
            "interview": interview_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Interview details fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/decision")
async def make_hiring_decision(
    pipeline_id: str,
    decision: str = Body(..., embed=True),  # "hire", "reject", "hold"
    reason: str = Body(None, embed=True),
    notes: str = Body(None, embed=True),
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """Record final hiring decision."""
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        
        candidate.final_decision = decision
        candidate.final_decision_at = get_current_timestamp()
        candidate.final_decision_by = current_user
        
        if decision == "reject":
            candidate.rejection_reason = reason
            candidate.update_stage(CandidateStage.REJECTED, triggered_by="user", notes=notes)
        elif decision == "hire":
            candidate.update_stage(CandidateStage.HIRED, triggered_by="user", notes=notes)
        elif decision == "hold":
            candidate.update_stage(CandidateStage.ON_HOLD, triggered_by="user", notes=notes)
        
        pipeline.recalculate_stats()
        await pipeline_service._save_pipeline(pipeline)
        
        return {
            "success": True,
            "decision": decision,
            "message": f"Candidate marked as {decision}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decision recording failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/email-preview")
async def get_email_preview(
    pipeline_id: str,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Generate email preview for candidate.
    Shows exactly what the email will look like before sending.
    """
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        job = pipeline.job
        
        # Check if email exists
        if not candidate.contact.email:
            return {
                "success": False,
                "error": "no_email",
                "message": "No email address found for this candidate"
            }
        
        # Generate email content using AI
        email_content = await pipeline_service.generate_email_preview(
            candidate=candidate,
            job=job,
            tone="professional"
        )
        
        return {
            "success": True,
            "preview": email_content,
            "candidate": {
                "name": candidate.display_name,
                "email": candidate.contact.email,
                "first_name": candidate.display_name.split()[0]
            },
            "can_edit": True,
            "tips": [
                "Keep the subject line short and personal",
                "Mention something specific about their background",
                "Keep the email under 150 words for best response rates",
                "Always include your scheduling link"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email preview failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/email-preview")
async def update_email_preview(
    pipeline_id: str,
    request: EmailPreviewRequest,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Update email preview with custom content.
    Regenerates the full email with user's changes.
    """
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        job = pipeline.job
        
        # Generate updated email with customizations
        email_content = await pipeline_service.generate_email_preview(
            candidate=candidate,
            job=job,
            tone=request.tone,
            custom_subject=request.custom_subject,
            custom_greeting=request.custom_greeting,
            custom_body=request.custom_body,
            custom_closing=request.custom_closing
        )
        
        return {
            "success": True,
            "preview": email_content
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email preview update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/send-email")
async def send_outreach_email(
    pipeline_id: str,
    subject: str = Body(...),
    body: str = Body(...),
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Send the outreach email with the final content.
    """
    try:
        result = await pipeline_service.send_custom_outreach_email(
            pipeline_id=pipeline_id,
            username=current_user,
            subject=subject,
            body=body
        )
        
        return result
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{pipeline_id}/start-flow")
async def start_hiring_flow(
    pipeline_id: str,
    request: StartFlowRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Start the complete hiring flow for a candidate.
    This orchestrates: Enrichment -> Email Preview -> (optional auto-send)
    
    Returns current step status and next actions.
    """
    try:
        pipeline = await pipeline_service.get_pipeline(pipeline_id)
        if not pipeline or pipeline.username != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidate = pipeline.candidate
        
        # Determine current state and next step
        flow_state = {
            "pipeline_id": pipeline_id,
            "current_step": None,
            "completed_steps": [],
            "next_step": None,
            "can_proceed": True,
            "blocker": None,
            "steps": []
        }
        
        # Step 1: Enrichment
        step_enrichment = {
            "id": "enrichment",
            "name": "Candidate Analysis",
            "description": "We analyze the candidate's background, skills, and fit for your role",
            "status": "pending",
            "duration_estimate": "30-60 seconds",
            "what_happens": [
                "We scan their LinkedIn profile and work history",
                "We validate their skills against your requirements",
                "We estimate their salary expectations",
                "We calculate a match score"
            ]
        }
        
        if candidate.enrichment.is_enriched:
            step_enrichment["status"] = "completed"
            step_enrichment["result"] = {
                "match_score": candidate.enrichment.match_score,
                "match_label": candidate.enrichment.match_label
            }
            flow_state["completed_steps"].append("enrichment")
        elif candidate.stage.value == "enriching":
            step_enrichment["status"] = "in_progress"
            flow_state["current_step"] = "enrichment"
        else:
            step_enrichment["status"] = "pending"
            if not flow_state["current_step"]:
                flow_state["next_step"] = "enrichment"
        
        flow_state["steps"].append(step_enrichment)
        
        # Step 2: Contact Discovery
        step_contact = {
            "id": "contact",
            "name": "Find Contact Info",
            "description": "We find the candidate's email and phone number",
            "status": "pending",
            "duration_estimate": "10-20 seconds",
            "what_happens": [
                "We search professional databases",
                "We verify email deliverability",
                "We find phone numbers if available"
            ]
        }
        
        if candidate.contact.email:
            step_contact["status"] = "completed"
            step_contact["result"] = {
                "email": candidate.contact.email,
                "phone": candidate.contact.phone,
                "source": candidate.contact.email_source.value if candidate.contact.email_source else None
            }
            flow_state["completed_steps"].append("contact")
        elif candidate.enrichment.is_enriched:
            step_contact["status"] = "failed"
            step_contact["blocker"] = "Could not find email automatically"
            step_contact["action_needed"] = "manual_email"
            flow_state["blocker"] = "missing_email"
            flow_state["can_proceed"] = False
        
        flow_state["steps"].append(step_contact)
        
        # Step 3: Email Composition
        step_email = {
            "id": "email_compose",
            "name": "Compose Email",
            "description": "We craft a personalized email to grab their attention",
            "status": "pending",
            "duration_estimate": "Review and customize",
            "what_happens": [
                "We write a personalized subject line",
                "We mention relevant details from their background",
                "We include your interview scheduling link",
                "You can review and edit before sending"
            ]
        }
        
        if candidate.contact.email and "contact" in flow_state["completed_steps"]:
            if not candidate.outreach or not candidate.outreach.initial_email_sent_at:
                step_email["status"] = "ready"
                if not flow_state["current_step"] and not flow_state["blocker"]:
                    flow_state["next_step"] = "email_compose"
            else:
                step_email["status"] = "completed"
                flow_state["completed_steps"].append("email_compose")
        
        flow_state["steps"].append(step_email)
        
        # Step 4: Email Sent
        step_send = {
            "id": "email_send",
            "name": "Send Email",
            "description": "We deliver the email and track when they open it",
            "status": "pending",
            "duration_estimate": "Instant",
            "what_happens": [
                "Email is delivered to their inbox",
                "We track when they open it",
                "We track when they click the scheduling link",
                "We send reminders if they don't respond"
            ]
        }
        
        if candidate.outreach and candidate.outreach.initial_email_sent_at:
            step_send["status"] = "completed"
            step_send["result"] = {
                "sent_at": candidate.outreach.initial_email_sent_at,
                "opened": candidate.outreach.total_opens > 0,
                "clicked": candidate.outreach.total_clicks > 0
            }
            flow_state["completed_steps"].append("email_send")
        
        flow_state["steps"].append(step_send)
        
        # Step 5: Scheduling
        step_schedule = {
            "id": "scheduling",
            "name": "Interview Scheduled",
            "description": "The candidate picks a time for their interview",
            "status": "pending",
            "duration_estimate": "Waiting for candidate",
            "what_happens": [
                "Candidate clicks your scheduling link",
                "They pick a convenient time slot",
                "Both of you get calendar invites",
                "Our AI interviewer prepares for the call"
            ]
        }
        
        if candidate.interview.scheduled_datetime:
            step_schedule["status"] = "completed"
            step_schedule["result"] = {
                "scheduled_datetime": candidate.interview.scheduled_datetime,
                "timezone": candidate.interview.timezone
            }
            flow_state["completed_steps"].append("scheduling")
        elif candidate.outreach and candidate.outreach.first_clicked_at:
            step_schedule["status"] = "in_progress"
            flow_state["current_step"] = "scheduling"
        
        flow_state["steps"].append(step_schedule)
        
        # Step 6: Interview
        step_interview = {
            "id": "interview",
            "name": "AI Interview",
            "description": "Our AI conducts a professional phone interview",
            "status": "pending",
            "duration_estimate": "5-10 minutes",
            "what_happens": [
                "We call the candidate at the scheduled time",
                "Neura (our AI) asks relevant questions",
                "We record and transcribe the conversation",
                "We analyze their responses and give you a report"
            ]
        }
        
        if candidate.interview.call_ended_at:
            step_interview["status"] = "completed"
            step_interview["result"] = {
                "duration_seconds": candidate.interview.call_duration_seconds,
                "score": candidate.interview.overall_score,
                "recommendation": candidate.interview.recommendation
            }
            flow_state["completed_steps"].append("interview")
        elif candidate.interview.call_initiated_at:
            step_interview["status"] = "in_progress"
            flow_state["current_step"] = "interview"
        
        flow_state["steps"].append(step_interview)
        
        # Step 7: Decision
        step_decision = {
            "id": "decision",
            "name": "Your Decision",
            "description": "Review the interview and make your hiring decision",
            "status": "pending",
            "duration_estimate": "Your call",
            "what_happens": [
                "Review the interview recording and transcript",
                "See our AI's assessment and recommendation",
                "Make your final Hire, Hold, or Pass decision",
                "Optionally send feedback to the candidate"
            ]
        }
        
        if candidate.final_decision:
            step_decision["status"] = "completed"
            step_decision["result"] = {
                "decision": candidate.final_decision
            }
            flow_state["completed_steps"].append("decision")
        elif candidate.interview.call_ended_at:
            step_decision["status"] = "ready"
            if not flow_state["current_step"]:
                flow_state["next_step"] = "decision"
        
        flow_state["steps"].append(step_decision)
        
        # Calculate progress
        total_steps = len(flow_state["steps"])
        completed_count = len(flow_state["completed_steps"])
        flow_state["progress"] = {
            "completed": completed_count,
            "total": total_steps,
            "percentage": round((completed_count / total_steps) * 100)
        }
        
        # Trigger next step if requested
        if not request.skip_enrichment and flow_state["next_step"] == "enrichment":
            # Start enrichment in background
            background_tasks.add_task(
                pipeline_service.enrich_candidate_background,
                pipeline_id,
                current_user
            )
            flow_state["steps"][0]["status"] = "in_progress"
            flow_state["current_step"] = "enrichment"
            flow_state["next_step"] = None
            flow_state["message"] = "Analysis started! This usually takes about 30-60 seconds."
        
        return {
            "success": True,
            "flow": flow_state
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Start flow failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{pipeline_id}/flow-status")
async def get_flow_status(
    pipeline_id: str,
    current_user: str = Depends(get_current_username),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    """
    Get current flow status without triggering any actions.
    Used for polling during async operations.
    """
    # Reuse start_flow logic but don't trigger anything
    return await start_hiring_flow(
        pipeline_id=pipeline_id,
        request=StartFlowRequest(skip_enrichment=True),
        background_tasks=BackgroundTasks(),
        current_user=current_user,
        pipeline_service=pipeline_service
    )


@router.get("/{pipeline_id}/explain/{step_id}")
async def get_step_explanation(
    pipeline_id: str,
    step_id: str,
    current_user: str = Depends(get_current_username)
):
    """
    Get detailed explanation for a specific step.
    Used for help tooltips and educational content.
    """
    explanations = {
        "enrichment": {
            "title": "What is Candidate Analysis?",
            "simple": "We look at the candidate's work history and skills to see if they're a good fit for your job.",
            "detailed": [
                "We scan their LinkedIn profile to understand their career path",
                "We check if their skills match what you're looking for",
                "We estimate their current salary based on their role and experience",
                "We give you a match score so you can quickly see how well they fit"
            ],
            "why_important": "This saves you hours of manual resume screening",
            "faq": [
                {
                    "q": "Where does the data come from?",
                    "a": "We use publicly available professional data from LinkedIn and other business databases."
                },
                {
                    "q": "How accurate is the match score?",
                    "a": "Our match scores have about 85% correlation with recruiter assessments."
                }
            ]
        },
        "contact": {
            "title": "How do we find contact info?",
            "simple": "We search professional databases to find the candidate's email and phone number.",
            "detailed": [
                "We search multiple professional data providers",
                "We verify that email addresses are valid and deliverable",
                "We prioritize work emails over personal emails",
                "Phone numbers are found when available"
            ],
            "why_important": "You can't reach candidates without their contact info",
            "faq": [
                {
                    "q": "What if you can't find their email?",
                    "a": "You can add their email manually if you have it from another source."
                },
                {
                    "q": "Is this legal?",
                    "a": "Yes, we only use publicly available professional data that complies with privacy regulations."
                }
            ]
        },
        "email_compose": {
            "title": "How are emails written?",
            "simple": "We write a personalized email that mentions details from their background to grab their attention.",
            "detailed": [
                "We craft a subject line that gets opened",
                "We mention specific things from their work history",
                "We explain why you're reaching out",
                "We include a link where they can schedule an interview",
                "You can review and edit everything before we send"
            ],
            "why_important": "Personalized emails get 2-3x more responses than generic templates",
            "faq": [
                {
                    "q": "Can I change the email?",
                    "a": "Absolutely! You have full control to edit the subject line, body, and tone."
                },
                {
                    "q": "What's the best email length?",
                    "a": "Keep it under 150 words. Busy professionals skim emails quickly."
                }
            ]
        },
        "email_send": {
            "title": "What happens after we send?",
            "simple": "We deliver the email and track when they open it or click your scheduling link.",
            "detailed": [
                "The email goes directly to their inbox (not spam)",
                "We track when they open the email",
                "We track when they click the scheduling link",
                "If they don't respond, we can send polite reminders"
            ],
            "why_important": "Tracking helps you know who's interested and who needs a follow-up",
            "faq": [
                {
                    "q": "How do you track opens?",
                    "a": "We use a small invisible image that loads when they open the email."
                },
                {
                    "q": "Do you send reminders automatically?",
                    "a": "Not automatically - you decide when to send follow-ups."
                }
            ]
        },
        "scheduling": {
            "title": "How does scheduling work?",
            "simple": "Candidates click a link in the email and pick a time that works for them.",
            "detailed": [
                "They see available time slots on a calendar",
                "They pick a slot that fits their schedule",
                "Both of you get calendar invites automatically",
                "They enter their phone number for the interview call"
            ],
            "why_important": "Self-service scheduling eliminates back-and-forth emails",
            "faq": [
                {
                    "q": "What time slots are available?",
                    "a": "We show slots during business hours in the candidate's timezone."
                },
                {
                    "q": "Can candidates reschedule?",
                    "a": "Yes, they can reschedule up to 1 hour before the interview."
                }
            ]
        },
        "interview": {
            "title": "How does the AI interview work?",
            "simple": "Our AI assistant Neura calls the candidate and has a professional conversation about their experience.",
            "detailed": [
                "We call at the exact scheduled time",
                "Neura introduces herself as an AI interviewer",
                "She asks relevant questions based on your job requirements",
                "The call typically lasts 5-10 minutes",
                "We record and transcribe everything",
                "We analyze their responses and provide a detailed report"
            ],
            "why_important": "You get detailed insights without spending your own time on initial screens",
            "faq": [
                {
                    "q": "Is the AI interview as good as a human?",
                    "a": "For initial screening, yes! We focus on understanding their experience and availability."
                },
                {
                    "q": "What questions does she ask?",
                    "a": "Questions about their current role, relevant experience, availability, and salary expectations."
                }
            ]
        },
        "decision": {
            "title": "Making your final decision",
            "simple": "Review everything and decide whether to hire, hold, or pass on this candidate.",
            "detailed": [
                "Listen to the interview recording or read the transcript",
                "Review our AI's assessment and recommendation",
                "See their strengths and any concerns",
                "Make your final decision with confidence"
            ],
            "why_important": "This is where you take action based on all the information gathered",
            "faq": [
                {
                    "q": "What if I'm not sure?",
                    "a": "Use 'Hold' to keep them in your pipeline while you review other candidates."
                },
                {
                    "q": "Should I send feedback to rejected candidates?",
                    "a": "It's good practice, but entirely optional. We can help you craft a polite response."
                }
            ]
        }
    }
    
    if step_id not in explanations:
        raise HTTPException(status_code=404, detail=f"Unknown step: {step_id}")
    
    return {
        "success": True,
        "step_id": step_id,
        "explanation": explanations[step_id]
    }
# ============================================================================
# EXPORT
# ============================================================================

__all__ = ["router"]