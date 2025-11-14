"""
Enriched Results API
===================
FastAPI routes for viewing and exporting enriched candidate results.

Endpoints:
- GET /results/{session_id} - Get enriched results
- GET /results/{session_id}/candidates - Paginated candidates
- GET /results/{session_id}/export - Export to CSV/Excel
- GET /results/{session_id}/candidate/{candidate_id} - Single candidate details
"""

import csv
import io
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from core.dependencies import get_current_username, get_mongodb, get_redis
from data.mongodb import MongoDB
from data.redis_cache import RedisCache

router = APIRouter(prefix="/results", tags=["Results"])


# ================================================================
# GET RESULTS OVERVIEW
# ================================================================

@router.get("/{session_id}")
async def get_results(
    session_id: str,
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get results overview for a session.
    
    Returns:
        Summary including total candidates, enriched count, ideal profile
    """
    
    try:
        # Get results from MongoDB
        results = await mongodb.get_enriched_results(session_id)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        # Verify ownership
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Return overview
        return {
            "session_id": session_id,
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
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET PAGINATED CANDIDATES
# ================================================================

@router.get("/{session_id}/candidates")
async def get_candidates(
    session_id: str,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: str = Query("match_score", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    filter_match_label: Optional[str] = Query(None, description="Filter by match label"),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get paginated enriched candidates.
    
    Query params:
        - page: Page number (1-indexed)
        - page_size: Items per page (default 20, max 100)
        - sort_by: Field to sort by (match_score, salary, response_likelihood)
        - sort_order: asc or desc
        - filter_match_label: Filter by match label (optional)
    
    Returns:
        Paginated candidates with enrichment data
    """
    
    try:
        # Get results
        results = await mongodb.get_enriched_results(session_id)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        # Verify ownership
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get candidates
        candidates = results.get("candidates", [])
        
        # Apply filters
        if filter_match_label:
            candidates = [
                c for c in candidates
                if c.get("match_label") == filter_match_label
            ]
        
        # Sort
        reverse = (sort_order == "desc")
        
        if sort_by == "match_score":
            candidates.sort(key=lambda x: x.get("match_score", 0), reverse=reverse)
        elif sort_by == "salary":
            candidates.sort(
                key=lambda x: x.get("salary_enrichment", {}).get("estimated_current_ctc", 0),
                reverse=reverse
            )
        elif sort_by == "response_likelihood":
            candidates.sort(
                key=lambda x: x.get("response_likelihood", {}).get("overall_score", 0),
                reverse=reverse
            )
        
        # Paginate
        total = len(candidates)
        start = (page - 1) * page_size
        end = start + page_size
        
        paginated = candidates[start:end]
        
        return {
            "session_id": session_id,
            "candidates": paginated,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
                "has_next": end < total,
                "has_prev": page > 1
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
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
    """
    Get detailed information for a single candidate.
    
    Returns:
        Full candidate data including all enrichment
    """
    
    try:
        # Get results
        results = await mongodb.get_enriched_results(session_id)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        # Verify ownership
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Find candidate
        candidates = results.get("candidates", [])
        candidate = next(
            (c for c in candidates if c.get("profile_id") == candidate_id),
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
# EXPORT TO CSV/EXCEL
# ================================================================

@router.get("/{session_id}/export")
async def export_results(
    session_id: str,
    format: str = Query("csv", description="Export format (csv or excel)"),
    include_enrichment: bool = Query(True, description="Include enrichment data"),
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Export results to CSV or Excel.
    
    Query params:
        - format: "csv" or "excel"
        - include_enrichment: Include enrichment columns (default true)
    
    Returns:
        File download
    """
    
    try:
        # Get results
        results = await mongodb.get_enriched_results(session_id)
        
        if not results:
            raise HTTPException(status_code=404, detail="Results not found")
        
        # Verify ownership
        if results.get("username") != username:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get candidates
        candidates = results.get("candidates", [])
        
        if format == "csv":
            # Generate CSV
            output = io.StringIO()
            
            # Define columns
            if include_enrichment:
                fieldnames = [
                    "name",
                    "title",
                    "location",
                    "match_label",
                    "match_score",
                    "current_company",
                    "total_experience",
                    "estimated_salary",
                    "response_likelihood",
                    "notice_period",
                    "validated_skills",
                    "email",
                    "phone"
                ]
            else:
                fieldnames = [
                    "name",
                    "title",
                    "location",
                    "match_label",
                    "match_score",
                    "email",
                    "phone"
                ]
            
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            
            # Write rows
            for candidate in candidates:
                row = {
                    "name": candidate.get("name", ""),
                    "title": candidate.get("title", ""),
                    "location": candidate.get("location", ""),
                    "match_label": candidate.get("match_label", ""),
                    "match_score": candidate.get("match_score", 0)
                }
                
                if include_enrichment:
                    # Add enrichment data
                    salary_data = candidate.get("salary_enrichment", {})
                    row["current_company"] = salary_data.get("current_company", "")
                    row["total_experience"] = salary_data.get("total_experience_years", 0)
                    row["estimated_salary"] = salary_data.get("estimated_current_ctc", "")
                    
                    response_data = candidate.get("response_likelihood", {})
                    row["response_likelihood"] = response_data.get("overall_score", 0)
                    
                    avail_data = candidate.get("availability", {})
                    row["notice_period"] = avail_data.get("notice_period", "")
                    
                    skill_data = candidate.get("skill_validation", {})
                    row["validated_skills"] = ", ".join(skill_data.get("validated_skills", []))
                
                # Contact info
                contact = candidate.get("contact_info", {})
                row["email"] = contact.get("email", "")
                row["phone"] = contact.get("phone", "")
                
                writer.writerow(row)
            
            # Return CSV
            csv_content = output.getvalue()
            output.close()
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=candidates_{session_id}.csv"
                }
            )
        
        elif format == "excel":
            # Excel export would require openpyxl
            raise HTTPException(
                status_code=501,
                detail="Excel export not implemented yet. Use CSV for now."
            )
        
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'excel'")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ================================================================
# GET PROGRESS
# ================================================================

@router.get("/{session_id}/progress")
async def get_progress(
    session_id: str,
    username: str = Depends(get_current_username),
    redis: RedisCache = Depends(get_redis)
):
    """
    Get current workflow progress.
    
    Returns:
        Progress data (status, percentage, message)
    """
    
    try:
        # Get progress from Redis
        progress = await redis.get_session_data(session_id, "workflow_progress")
        
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        return progress
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))