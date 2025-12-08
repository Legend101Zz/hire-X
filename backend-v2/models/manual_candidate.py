
"""
Manual Candidate Entry Models
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ManualCandidateEntry(BaseModel):
    """Single candidate entry from manual import."""
    linkedin_url: str
    expected_salary: Optional[str] = None  # "25 LPA", "30-35 LPA"
    current_salary: Optional[str] = None
    notice_period: Optional[str] = None  # "30 days", "Immediate", "2 months"
    preferred_location: Optional[str] = None
    notes: Optional[str] = None
    resume_base64: Optional[str] = None  # Base64 encoded resume
    resume_filename: Optional[str] = None
    

class ManualImportRequest(BaseModel):
    """Request to create search from manual import."""
    jd_text: Optional[str] = None  # Either JD text or ideal_profile required
    ideal_profile: Optional[dict] = None  # From Donna conversation
    candidates: List[ManualCandidateEntry] = Field(..., min_length=1)
    pipeline_name: Optional[str] = None
    auto_scrape: bool = True  # Whether to scrape LinkedIn profiles


class ManualImportResponse(BaseModel):
    """Response from manual import."""
    success: bool
    session_id: str
    search_id: str
    candidates_count: int
    message: str