"""
Deep Dive API V2
================
API endpoints for intelligent candidate enrichment with sharing capabilities.

Endpoints:
- POST /deep-dive/analyze - Full candidate analysis
- GET /deep-dive/results/{result_id} - Get shared result
- GET /deep-dive/export/{result_id} - Export as CSV

Author: NeuraLeap Engineering
"""

import csv
import io
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.dependencies import (get_current_username, get_deep_dive_service,
                               get_mongodb, get_redis)
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from services.intelligent_enrichment_orchestrator import \
    IntelligentEnrichmentOrchestrator

router = APIRouter(prefix="/deep-dive", tags=["Deep Dive"])
logger = get_logger(__name__)


# ==========================================================================
# REQUEST/RESPONSE MODELS
# ==========================================================================

class DeepDiveRequest(BaseModel):
    """Request for candidate deep dive."""
    linkedin_url: str = Field(..., description="LinkedIn profile URL")
    job_description: str = Field(..., min_length=50, description="Job description (min 50 chars)")
    force_scrape: bool = Field(False, description="Force fresh scrape, skip database")


class DeepDiveResponse(BaseModel):
    """Response wrapper for deep dive results."""
    success: bool
    data: dict
    message: str
    result_id: Optional[str] = None  # For shareable link
    share_url: Optional[str] = None


class SharedResultResponse(BaseModel):
    """Response for shared result lookup."""
    success: bool
    data: dict
    created_at: str
    expires_at: Optional[str] = None


# ==========================================================================
# HELPER FUNCTIONS
# ==========================================================================

def flatten_dict(d: dict, parent_key: str = '', sep: str = '_') -> dict:
    """Flatten nested dictionary for CSV export."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            if v and isinstance(v[0], dict):
                # For list of dicts, just count or join names
                items.append((new_key + '_count', len(v)))
                if 'name' in v[0] or 'skill' in v[0]:
                    names = [item.get('name') or item.get('skill', '') for item in v]
                    items.append((new_key, ', '.join(filter(None, names))))
            else:
                items.append((new_key, ', '.join(str(x) for x in v)))
        else:
            items.append((new_key, v))
    return dict(items)

def generate_csv_content(result: dict) -> str:
    """Generate CSV content from deep dive result - V2."""
    output = io.StringIO()
    rows = []
    
    candidate = result.get('candidate', {})
    match = result.get('match_analysis', {})
    salary = result.get('salary_timeline', {})
    response = result.get('response_likelihood', {})
    notice = result.get('notice_period', {})
    skills = result.get('skill_validation', {})
    footprint = result.get('professional_footprint', {})  # NEW
    
    # Candidate Info
    rows.append(['CANDIDATE INFORMATION', ''])
    rows.append(['Full Name', candidate.get('full_name', '')])
    rows.append(['Headline', candidate.get('headline', '')])
    rows.append(['Current Company', candidate.get('current_company', '')])
    rows.append(['Location', candidate.get('location', '')])
    rows.append(['LinkedIn URL', candidate.get('linkedin_url', '')])
    rows.append(['Total Experience (Years)', candidate.get('experience_summary', {}).get('real_experience_years', '')])
    rows.append(['Professional Roles', candidate.get('experience_summary', {}).get('professional_roles', '')])
    rows.append(['', ''])
    
    # Professional Footprint (NEW)
    rows.append(['PROFESSIONAL FOOTPRINT', ''])
    footprint_assessment = footprint.get('overall_footprint_assessment', {})
    rows.append(['Digital Presence Score', f"{footprint_assessment.get('digital_presence_score', 0)}/100"])
    rows.append(['Presence Level', footprint_assessment.get('presence_level', '')])
    rows.append(['Verified Profiles', ', '.join([p.get('platform', '') for p in footprint.get('verified_profiles', [])])])
    rows.append(['Evidence Items Found', len(footprint.get('evidence_found', []))])
    rows.append(['Identity Confidence', f"{footprint.get('identity_verification', {}).get('overall_confidence', 0)}%"])
    rows.append(['Notable Findings', ', '.join(footprint_assessment.get('notable_findings', []))])
    rows.append(['Red Flags', ', '.join(footprint_assessment.get('red_flags', []))])
    rows.append(['', ''])
    
    # Match Analysis with Score Breakdown (ENHANCED)
    rows.append(['MATCH ANALYSIS', ''])
    rows.append(['Overall Match Score', f"{match.get('overall_match_score', 0)}%"])
    rows.append(['Match Label', match.get('match_label', '')])
    
    # Score breakdown
    score_breakdown = match.get('score_breakdown', {})
    for component, data in score_breakdown.items():
        if isinstance(data, dict):
            rows.append([f'  {component.replace("_", " ").title()}', f"{data.get('score', 0)}% (weight: {data.get('weight', 0)}%)"])
    
    rows.append(['Hiring Recommendation', match.get('hiring_recommendation', {}).get('action', '')])
    rows.append(['Recommendation Reasoning', match.get('hiring_recommendation', {}).get('reasoning', '')])
    
    # Strengths with evidence
    strengths = match.get('strengths', [])
    strength_strs = []
    for s in strengths:
        if isinstance(s, dict):
            strength_strs.append(f"{s.get('strength', '')}: {s.get('evidence', '')}")
        else:
            strength_strs.append(str(s))
    rows.append(['Strengths', '; '.join(strength_strs)])
    
    # Concerns with severity
    concerns = match.get('concerns', [])
    concern_strs = []
    for c in concerns:
        if isinstance(c, dict):
            concern_strs.append(f"[{c.get('severity', 'unknown')}] {c.get('concern', '')}")
        else:
            concern_strs.append(str(c))
    rows.append(['Concerns', '; '.join(concern_strs)])
    
    # Gaps
    gaps = match.get('gaps', [])
    gap_strs = []
    for g in gaps:
        if isinstance(g, dict):
            gap_strs.append(f"{g.get('gap', '')} ({g.get('importance', '')})")
        else:
            gap_strs.append(str(g))
    rows.append(['Gaps', '; '.join(gap_strs)])
    rows.append(['', ''])
    
    # Skills (ENHANCED)
    rows.append(['SKILL VALIDATION', ''])
    rows.append(['Overall Confidence', f"{skills.get('overall_confidence', 0)}%"])
    rows.append(['Validated Skills', ', '.join(skills.get('validated_skills', []))])
    rows.append(['Unvalidated Skills', ', '.join(skills.get('unvalidated_skills', []))])
    
    # Skill gaps
    skill_gaps = skills.get('skill_gaps', {})
    rows.append(['Critical Skill Gaps', ', '.join(skill_gaps.get('critical_gaps', []))])
    rows.append(['Gap Severity', skill_gaps.get('gap_severity', '')])
    
    # Bonus skills
    bonus = skills.get('bonus_skills', [])
    bonus_strs = [b.get('skill', '') for b in bonus if isinstance(b, dict)]
    rows.append(['Bonus Skills Discovered', ', '.join(bonus_strs)])
    rows.append(['Assessment', skills.get('assessment', '')])
    rows.append(['', ''])
    
    # Response Likelihood (ENHANCED)
    rows.append(['RESPONSE LIKELIHOOD', ''])
    rows.append(['Overall Score', f"{response.get('overall_score', 0)}%"])
    rows.append(['Likelihood Label', response.get('likelihood_label', '')])
    
    activity = response.get('activity_signals', {})
    rows.append(['Overall Activity', activity.get('overall_activity', '')])
    
    reachability = response.get('reachability', {})
    rows.append(['Best Contact Channels', ', '.join(reachability.get('best_channels', []))])
    
    approach = response.get('recommended_approach', {})
    rows.append(['Should Reach Out', 'Yes' if approach.get('should_reach_out') else 'No'])
    rows.append(['Primary Channel', approach.get('primary_channel', '')])
    rows.append(['Message Focus', approach.get('message_focus', '')])
    rows.append(['Personalization Hooks', ', '.join(approach.get('personalization_hooks', []))])
    rows.append(['', ''])
    
    # Salary Information
    rows.append(['SALARY ESTIMATION', ''])
    ctc = salary.get('current_estimated_ctc', {})
    rows.append(['Current CTC (Low)', f"₹{ctc.get('low', 0)}L"])
    rows.append(['Current CTC (Most Likely)', f"₹{ctc.get('most_likely', 0)}L"])
    rows.append(['Current CTC (High)', f"₹{ctc.get('high', 0)}L"])
    rows.append(['Confidence Score', f"{salary.get('confidence_score', 0)}%"])
    rows.append(['', ''])
    
    # Notice Period
    rows.append(['NOTICE PERIOD', ''])
    notice_days = notice.get('estimated_notice_days', {})
    rows.append(['Minimum Days', notice_days.get('minimum', '')])
    rows.append(['Most Likely Days', notice_days.get('likely', '')])
    rows.append(['Maximum Days', notice_days.get('maximum', '')])
    rows.append(['Earliest Start', notice.get('earliest_possible_start', '')])
    rows.append(['', ''])
    
    # Metadata
    rows.append(['METADATA', ''])
    rows.append(['Data Source', result.get('data_source', '')])
    rows.append(['Processing Time', f"{result.get('processing_time_seconds', 0):.1f}s"])
    rows.append(['Enriched At', result.get('enriched_at', '')])
    
    # Write to CSV
    writer = csv.writer(output)
    writer.writerows(rows)
    
    return output.getvalue()



# ==========================================================================
# ENDPOINTS
# ==========================================================================

@router.post("/analyze", response_model=DeepDiveResponse)
async def analyze_candidate(
    request: DeepDiveRequest,
    username: str = Depends(get_current_username),
    service: IntelligentEnrichmentOrchestrator = Depends(get_deep_dive_service),
    mongodb: MongoDB = Depends(get_mongodb),
    redis: RedisCache = Depends(get_redis)
):
    """
    Perform comprehensive candidate analysis.
    
    This endpoint:
    1. Analyzes the JD to create a role-specific enrichment plan
    2. Looks up candidate in DB or scrapes from LinkedIn
    3. Validates skills using web search
    4. Estimates salary timeline from experience
    5. Calculates response likelihood
    6. Estimates notice period
    7. Synthesizes match analysis
    8. Saves result for sharing
    
    Returns comprehensive enrichment data with shareable link.
    """
    logger.info(f"Deep dive request from {username}: {request.linkedin_url}")
    
    try:
        result = await service.deep_dive_candidate(
            linkedin_url=request.linkedin_url,
            job_description=request.job_description,
            force_scrape=request.force_scrape
        )
        
        result_dict = result.model_dump()
        
        # Generate unique ID for sharing
        result_id = str(uuid.uuid4())[:12]
        
        # Save to MongoDB for persistent sharing
        await mongodb.main_db.deep_dive_results.insert_one({
            "_id": result_id,
            "result": result_dict,
            "job_description": request.job_description,
            "linkedin_url": request.linkedin_url,
            "created_by": username,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(days=30),  # 30 day expiry
            "view_count": 0
        })
        
        # Also cache in Redis for fast access (24 hours)
        await redis.set(
            f"deep_dive:{result_id}",
            json.dumps(result_dict),
            ex=86400
        )
        
        logger.info(f"Deep dive result saved with ID: {result_id}")
        
        return DeepDiveResponse(
            success=True,
            data=result_dict,
            message=f"Analysis complete in {result.processing_time_seconds:.1f}s using {result.data_source}",
            result_id=result_id,
            share_url=f"/deep-dive/shared/{result_id}"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
        
    except Exception as e:
        logger.error(f"Deep dive failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/results/{result_id}")
async def get_shared_result(
    result_id: str,
    mongodb: MongoDB = Depends(get_mongodb),
    redis: RedisCache = Depends(get_redis)
):
    """
    Get a shared deep dive result by ID.
    
    Results are cached in Redis and stored in MongoDB.
    Expired results (>30 days) are not returned.
    """
    # Try Redis cache first
    cached = await redis.get(f"deep_dive:{result_id}")
    if cached:
        cached = json.loads(cached)
        # Increment view count in background
        await mongodb.main_db.deep_dive_results.update_one(
            {"_id": result_id},
            {"$inc": {"view_count": 1}}
        )
        
        # Handle both String (standard Redis) and Dict (if auto-deserialized)
        if isinstance(cached, dict):
            result_data = cached
        else:
            result_data = json.loads(cached)
            
        return SharedResultResponse(
            success=True,
            data=result_data,
            created_at=datetime.utcnow().isoformat()
        )
    
    # Fallback to MongoDB
    doc = await mongodb.main_db.deep_dive_results.find_one({"_id": result_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Result not found or expired")
    
    # Check expiry
    if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Result has expired")
    
    # Increment view count
    await mongodb.main_db.deep_dive_results.update_one(
        {"_id": result_id},
        {"$inc": {"view_count": 1}}
    )
    
    # Re-cache in Redis
    await redis.set(
        f"deep_dive:{result_id}", 
        json.dumps(doc["result"]), 
        ex=86400
    )
    
    return SharedResultResponse(
        success=True,
        data=doc["result"],
        created_at=doc["created_at"].isoformat(),
        expires_at=doc.get("expires_at", "").isoformat() if doc.get("expires_at") else None
    )


@router.get("/export/{result_id}")
async def export_result_csv(
    result_id: str,
    mongodb: MongoDB = Depends(get_mongodb),
    redis: RedisCache = Depends(get_redis)
):
    """
    Export a deep dive result as CSV.
    """
    # Get result
    cached = await redis.get(f"deep_dive:{result_id}")
    if cached:
        result = cached
    else:
        doc = await mongodb.main_db.deep_dive_results.find_one({"_id": result_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Result not found")
        result = doc["result"]
    
    # Generate CSV
    csv_content = generate_csv_content(result)
    
    # Get candidate name for filename
    candidate_name = result.get('candidate', {}).get('full_name', 'candidate')
    safe_name = "".join(c for c in candidate_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')
    
    # Return as streaming response
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=deep_dive_{safe_name}_{result_id}.csv"
        }
    )


@router.get("/my-results")
async def get_my_results(
    limit: int = 20,
    skip: int = 0,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get current user's deep dive history.
    """
    cursor = mongodb.main_db.deep_dive_results.find(
        {"created_by": username},
        {
            "_id": 1,
            "result.candidate.full_name": 1,
            "result.candidate.headline": 1,
            "result.candidate.linkedin_url": 1,
            "result.match_analysis.overall_match_score": 1,
            "result.match_analysis.match_label": 1,
            "result.data_source": 1,
            "created_at": 1,
            "view_count": 1
        }
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    results = []
    async for doc in cursor:
        results.append({
            "id": doc["_id"],
            "candidate_name": doc.get("result", {}).get("candidate", {}).get("full_name", "Unknown"),
            "headline": doc.get("result", {}).get("candidate", {}).get("headline", ""),
            "linkedin_url": doc.get("result", {}).get("candidate", {}).get("linkedin_url", ""),
            "match_score": doc.get("result", {}).get("match_analysis", {}).get("overall_match_score", 0),
            "match_label": doc.get("result", {}).get("match_analysis", {}).get("match_label", ""),
            "data_source": doc.get("result", {}).get("data_source", ""),
            "created_at": doc.get("created_at", "").isoformat() if doc.get("created_at") else "",
            "view_count": doc.get("view_count", 0)
        })
    
    total = await mongodb.main_db.deep_dive_results.count_documents({"created_by": username})
    
    return {
        "results": results,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.delete("/results/{result_id}")
async def delete_result(
    result_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb),
    redis: RedisCache = Depends(get_redis)
):
    """
    Delete a deep dive result.
    """
    # Check ownership
    doc = await mongodb.main_db.deep_dive_results.find_one({"_id": result_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Result not found")
    if doc.get("created_by") != username:
        raise HTTPException(status_code=403, detail="Not authorized to delete this result")
    
    # Delete from MongoDB and Redis
    await mongodb.main_db.deep_dive_results.delete_one({"_id": result_id})
    await redis.delete(f"deep_dive:{result_id}")
    
    return {"success": True, "message": "Result deleted"}


@router.get("/health")
async def health_check():
    """Health check for deep dive service."""
    return {"status": "healthy", "service": "deep-dive"}