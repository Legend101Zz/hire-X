"""
Enriched Results API - V3.1
===========================
Supports lookup by both enrichment session_id AND conversation_session_id
"""

import csv
import io
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from core.dependencies import get_current_username, get_mongodb, get_redis
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache

router = APIRouter(prefix="/results", tags=["Results"])
logger = get_logger(__name__)


# ================================================================
# HELPER: Find results by session_id OR conversation_session_id
# ================================================================

async def find_results(
    session_id: str, 
    mongodb: MongoDB
) -> Optional[dict]:
    """
    Find results by either session_id or conversation_session_id.
    This handles the case where frontend uses conv_xxx but backend stored with enrichment_xxx.
    """
    # Try direct lookup first
    results = await mongodb.get_enriched_results(session_id)
    
    if not results:
        # Try lookup by conversation_session_id
        results = await mongodb.enriched_results_collection.find_one({
            "conversation_session_id": session_id
        })
    
    return results


# ================================================================
# GET RESULTS OVERVIEW
# ================================================================

@router.get("/{session_id}")
async def get_results(
    session_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get results overview for a session."""
    
    try:
        results = await find_results(session_id, mongodb)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "session_id": results.get("session_id"),
            "conversation_session_id": results.get("conversation_session_id"),
            "ideal_profile": results.get("ideal_profile"),
            "total_found": results.get("total_found"),
            "enriched_count": results.get("enriched_count"),
            "created_at": results.get("created_at"),
            "status": results.get("status")
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting results: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET PAGINATED CANDIDATES - with structure normalization
# ================================================================

@router.get("/{session_id}/candidates")
async def get_candidates(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("match_score"),
    sort_order: str = Query("desc"),
    filter_match_label: Optional[str] = Query(None),
    filter_shortlisted: Optional[bool] = Query(None),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get paginated enriched candidates with normalized structure."""
    
    try:
        results = await find_results(session_id, mongodb)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        raw_candidates = results.get("candidates", [])
        
        # Normalize each candidate's structure
        candidates = [normalize_candidate_structure(c) for c in raw_candidates]
        
        # Apply filters
        if filter_match_label:
            candidates = [
                c for c in candidates 
                if c.get("match_analysis", {}).get("match_label") == filter_match_label
            ]
        
        if filter_shortlisted is not None:
            candidates = [
                c for c in candidates 
                if c.get("is_shortlisted", False) == filter_shortlisted
            ]
        
        # Sort
        reverse = sort_order == "desc"
        if sort_by == "match_score":
            candidates.sort(
                key=lambda c: c.get("match_analysis", {}).get("overall_match_score", 0),
                reverse=reverse
            )
        elif sort_by == "salary":
            candidates.sort(
                key=lambda c: c.get("salary_estimation", {}).get("current_estimated_ctc", {}).get("most_likely", 0),
                reverse=reverse
            )
        elif sort_by == "response_likelihood":
            candidates.sort(
                key=lambda c: c.get("response_likelihood", {}).get("overall_score", 0),
                reverse=reverse
            )
        
        # Paginate
        total = len(candidates)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = candidates[start:end]
        
        return {
            "candidates": paginated,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting candidates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def normalize_candidate_structure(raw: Dict) -> Dict:
    """
    Normalize candidate structure to ensure frontend compatibility.
    
    Handles both:
    - Old structure: {candidate_id, status, candidate, enrichment: {...}}
    - New structure: {candidate_id, candidate, match_analysis, salary_estimation, ...}
    """
    # Check if data is nested under 'enrichment'
    enrichment = raw.get("enrichment", {})
    
    # Get candidate data
    candidate_data = raw.get("candidate", {})
    if enrichment.get("candidate"):
        # Merge enriched candidate data
        candidate_data = {**candidate_data, **enrichment.get("candidate", {})}
    
    # Determine candidate ID
    candidate_id = (
        raw.get("candidate_id") or 
        raw.get("profile_id") or 
        candidate_data.get("profile_id") or
        candidate_data.get("linkedin_id") or
        candidate_data.get("_id") or
        "unknown"
    )
    
    # Build normalized structure
    normalized = {
        "candidate_id": str(candidate_id),
        "profile_id": str(candidate_id),
        "status": raw.get("status", "completed"),
        "enrichment_status": raw.get("enrichment_status", raw.get("status", "completed")),
        "is_shortlisted": raw.get("is_shortlisted", False),
        "shortlisted_at": raw.get("shortlisted_at"),
        "enriched_at": raw.get("enriched_at"),
        
        # Candidate basic info
        "candidate": {
            "profile_id": str(candidate_id),
            "linkedin_id": str(candidate_id),
            "first_name": candidate_data.get("first_name", ""),
            "last_name": candidate_data.get("last_name", ""),
            "full_name": candidate_data.get("full_name") or f"{candidate_data.get('first_name', '')} {candidate_data.get('last_name', '')}".strip(),
            "title": candidate_data.get("title") or candidate_data.get("headline", ""),
            "headline": candidate_data.get("headline") or candidate_data.get("title", ""),
            "location": candidate_data.get("location", "Unknown"),
            "current_company": candidate_data.get("current_company") or candidate_data.get("company", ""),
            "linkedin_url": candidate_data.get("linkedin_url", ""),
            "experience_years": candidate_data.get("experience_years") or candidate_data.get("total_experience_years"),
            "expertise": candidate_data.get("expertise", ""),
            "summary": candidate_data.get("summary", ""),
        },
        
        # Match Analysis - check both locations
        "match_analysis": (
            raw.get("match_analysis") or 
            enrichment.get("match_analysis") or 
            {
                "overall_match_score": 0,
                "match_label": "Not Analyzed",
                "strengths": [],
                "concerns": []
            }
        ),
        
        # Salary - check both locations and normalize field names
        "salary_estimation": _extract_salary(raw, enrichment),
        
        # Skills
        "skill_validation": (
            raw.get("skill_validation") or 
            enrichment.get("skill_validation") or 
            {
                "overall_confidence": 0,
                "validated_skills": [],
                "evidence": []
            }
        ),
        
        # Response Likelihood
        "response_likelihood": (
            raw.get("response_likelihood") or 
            enrichment.get("response_likelihood") or 
            {
                "overall_score": 0,
                "likelihood_label": "Unknown",
                "factors": [],
                "recommended_approach": {"should_reach_out": False, "best_channel": "email"}
            }
        ),
        
        # Availability
        "availability": _extract_availability(raw, enrichment),
        
        # Professional Footprint
        "professional_footprint": (
            raw.get("professional_footprint") or 
            enrichment.get("professional_footprint") or 
            {
                "verified_profiles": [],
                "overall_footprint_assessment": {"presence_level": "Unknown", "notable_findings": []}
            }
        ),
    }
    
    return normalized


def _extract_salary(raw: Dict, enrichment: Dict) -> Dict:
    """Extract and normalize salary data from various possible locations."""
    # Try different locations
    salary = (
        raw.get("salary_estimation") or 
        raw.get("salary_timeline") or
        enrichment.get("salary_estimation") or 
        enrichment.get("salary_timeline") or
        {}
    )
    
    if not salary:
        return {
            "current_estimated_ctc": {"low": 0, "most_likely": 0, "high": 0},
            "career_progression": []
        }
    
    # Extract CTC - handle different field names
    ctc = salary.get("current_estimated_ctc") or salary.get("estimated_ctc", {})
    if isinstance(ctc, (int, float)):
        ctc = {"low": ctc * 0.8, "most_likely": ctc, "high": ctc * 1.2}
    
    return {
        "current_estimated_ctc": {
            "low": ctc.get("low", 0),
            "most_likely": ctc.get("most_likely", ctc.get("mid", 0)),
            "high": ctc.get("high", 0)
        },
        "career_progression": salary.get("career_progression", [])
    }


def _extract_availability(raw: Dict, enrichment: Dict) -> Dict:
    """Extract and normalize availability/notice period data."""
    # Try different locations
    avail = (
        raw.get("availability") or 
        raw.get("notice_period") or
        enrichment.get("availability") or 
        enrichment.get("notice_period") or
        {}
    )
    
    if not avail:
        return {
            "notice_period_days": None,
            "estimated_notice_days": {"likely": None},
            "earliest_possible_start": None
        }
    
    # Handle different structures
    estimated_days = avail.get("estimated_notice_days", {})
    if isinstance(estimated_days, (int, float)):
        estimated_days = {"likely": int(estimated_days)}
    
    likely_days = (
        avail.get("notice_period_days") or 
        estimated_days.get("likely") or
        avail.get("likely_notice_days")
    )
    
    return {
        "notice_period_days": likely_days,
        "estimated_notice_days": {"likely": likely_days},
        "earliest_possible_start": avail.get("earliest_possible_start")
    }
    
# ================================================================
# GET PROGRESS - Updated to check both session IDs
# ================================================================

@router.get("/{session_id}/progress")
async def get_progress(
    session_id: str,
    username: str = Depends(get_current_username),
    redis: RedisCache = Depends(get_redis),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get current enrichment progress."""
    
    try:
        # Try direct progress lookup
        progress = await redis.get_session_data(session_id, "enrichment_progress")
        
        if progress:
            return progress
        
        # Try to find the actual enrichment session from MongoDB
        results = await find_results(session_id, mongodb)
        
        if results:
            # Results exist - enrichment is complete
            return {
                "status": "completed",
                "total_candidates": results.get("total_found", 0),
                "enriched_count": results.get("enriched_count", 0),
                "failed_count": 0,
                "progress_percentage": 100,
                "message": "Enrichment completed!"
            }
        
        # Check if there's an in-progress enrichment linked to this conversation
        # Look up by conversation_session_id in Redis
        # This handles the case where conv_xxx is passed but enrichment stored under different ID
        
        # For now, return not found
        raise HTTPException(status_code=404, detail="Progress not found. Enrichment may not have started.")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# SHORTLIST CANDIDATE
# ================================================================

@router.post("/{session_id}/shortlist/{candidate_id}")
async def toggle_shortlist(
    session_id: str,
    candidate_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Toggle shortlist status for a candidate."""
    
    try:
        results = await find_results(session_id, mongodb)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Find and toggle candidate
        candidates = results.get("candidates", [])
        found = False
        new_status = False
        
        for c in candidates:
            cid = c.get("candidate_id") or c.get("profile_id") or c.get("candidate", {}).get("linkedin_id")
            if cid == candidate_id:
                new_status = not c.get("is_shortlisted", False)
                c["is_shortlisted"] = new_status
                c["shortlisted_at"] = datetime.utcnow().isoformat() if new_status else None
                found = True
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Update MongoDB
        await mongodb.enriched_results_collection.update_one(
            {"session_id": results.get("session_id")},
            {"$set": {"candidates": candidates}}
        )
        
        return {
            "success": True,
            "candidate_id": candidate_id,
            "is_shortlisted": new_status
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling shortlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET SHORTLISTED CANDIDATES
# ================================================================

@router.get("/{session_id}/shortlist")
async def get_shortlisted(
    session_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get all shortlisted candidates."""
    
    try:
        results = await find_results(session_id, mongodb)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidates = results.get("candidates", [])
        shortlisted = [c for c in candidates if c.get("is_shortlisted", False)]
        
        return {
            "shortlisted_count": len(shortlisted),
            "candidates": shortlisted
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shortlist: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET SINGLE CANDIDATE
# ================================================================

@router.get("/{session_id}/candidate/{candidate_id}")
async def get_candidate(
    session_id: str,
    candidate_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Get detailed information for a single candidate."""
    
    try:
        results = await find_results(session_id, mongodb)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidates = results.get("candidates", [])
        candidate = next(
            (c for c in candidates 
             if (c.get("candidate_id") or c.get("profile_id") or c.get("candidate", {}).get("linkedin_id")) == candidate_id),
            None
        )
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        return candidate
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET CONVERSATION HISTORY
# ================================================================

@router.get("/{session_id}/conversation")
async def get_conversation_history(
    session_id: str,
    username: str = Depends(get_current_username),
    redis: RedisCache = Depends(get_redis)
):
    """Get the conversation history that led to this result."""
    
    try:
        results = await find_results(session_id, get_mongodb())
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        conv_session_id = results.get("conversation_session_id", session_id)
        
        # Load conversation state from Redis
        conv_state = await redis.get_session_data(conv_session_id, "conversation_state")
        
        if conv_state:
            return {
                "session_id": conv_session_id,
                "ideal_profile": conv_state.get("ideal_profile"),
                "messages": conv_state.get("messages", []),
                "stage": conv_state.get("stage"),
                "turn_count": conv_state.get("turn_count")
            }
        
        # Fallback to stored ideal_profile
        return {
            "session_id": conv_session_id,
            "ideal_profile": results.get("ideal_profile"),
            "messages": [],
            "stage": "completed"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# EXPORT TO CSV
# ================================================================

@router.get("/{session_id}/export")
async def export_results(
    session_id: str,
    format: str = Query("csv"),
    include_enrichment: bool = Query(True),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """Export results to CSV."""
    
    try:
        results = await find_results(session_id, mongodb)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        candidates = results.get("candidates", [])
        
        if format != "csv":
            raise HTTPException(status_code=400, detail="Only CSV export is currently supported")
        
        output = io.StringIO()
        fieldnames = [
            "name", "title", "company", "location", "linkedin_url",
            "match_score", "match_label", "experience_years"
        ]
        
        if include_enrichment:
            fieldnames.extend([
                "estimated_salary_lpa", "response_likelihood", 
                "notice_period_days", "validated_skills", "is_shortlisted"
            ])
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for candidate in candidates:
            c = candidate.get("candidate", candidate)
            row = {
                "name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or c.get('full_name', ''),
                "title": c.get("title") or c.get("headline", ""),
                "company": c.get("current_company", ""),
                "location": c.get("location", ""),
                "linkedin_url": c.get("linkedin_url", ""),
                "match_score": candidate.get("match_analysis", {}).get("overall_match_score", 0),
                "match_label": candidate.get("match_analysis", {}).get("match_label", ""),
                "experience_years": c.get("experience_years", 0)
            }
            
            if include_enrichment:
                salary = candidate.get("salary_estimation", {}).get("current_estimated_ctc", {})
                row["estimated_salary_lpa"] = salary.get("most_likely", "")
                row["response_likelihood"] = candidate.get("response_likelihood", {}).get("overall_score", 0)
                row["notice_period_days"] = candidate.get("availability", {}).get("notice_period_days", "")
                
                skills = candidate.get("skill_validation", {}).get("validated_skills", [])
                row["validated_skills"] = ", ".join(skills) if skills else ""
                row["is_shortlisted"] = "Yes" if candidate.get("is_shortlisted") else "No"
            
            writer.writerow(row)
        
        csv_content = output.getvalue()
        output.close()
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=candidates_{session_id}.csv"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# LIST USER'S PAST RESULTS
# ================================================================

@router.get("/")
async def list_results(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """List all enrichment results for the current user."""
    
    try:
        cursor = mongodb.enriched_results_collection.find(
            {"username": username}
        ).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
        
        results = []
        async for doc in cursor:
            results.append({
                "session_id": doc.get("session_id"),
                "conversation_session_id": doc.get("conversation_session_id"),
                "ideal_profile": {
                    "role_title": doc.get("ideal_profile", {}).get("role_title", ""),
                    "must_have_skills": doc.get("ideal_profile", {}).get("must_have_skills", [])[:3]
                },
                "total_found": doc.get("total_found", 0),
                "enriched_count": doc.get("enriched_count", 0),
                "created_at": doc.get("created_at"),
                "status": doc.get("status")
            })
        
        total = await mongodb.enriched_results_collection.count_documents({"username": username})
        
        return {
            "results": results,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        }
    
    except Exception as e:
        logger.error(f"Error listing results: {e}")
        raise HTTPException(status_code=500, detail=str(e))