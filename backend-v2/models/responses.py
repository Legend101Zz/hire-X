"""
Response Models (Pydantic Schemas)
==================================
These define the structure of API responses.

They ensure consistent response formats and automatic documentation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    """
    JWT token response after successful login.
    
    Example:
        {
            "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "token_type": "bearer",
            "username": "john@company.com"
        }
    """
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    username: str = Field(..., description="Username")


class UserResponse(BaseModel):
    """
    User information response.
    
    Example:
        {
            "username": "john@company.com",
            "email": "john@company.com",
            "full_name": "John Doe",
            "message": "User retrieved successfully"
        }
    """
    username: str = Field(..., description="Username")
    email: Optional[str] = Field(None, description="Email address")
    full_name: Optional[str] = Field(None, description="Full name")
    message: str = Field(default="Success", description="Response message")


class ParsePromptResponse(BaseModel):
    """
    Response after starting a scorecard workflow.
    
    Example:
        {
            "session_id": "abc-123-def-456",
            "status": "processing",
            "message": "Workflow started successfully"
        }
    """
    session_id: str = Field(..., description="Unique session identifier")
    status: str = Field(..., description="Workflow status")
    message: str = Field(..., description="Human-readable message")


class ScorecardStatusResponse(BaseModel):
    """
    Workflow status response.
    
    Example (in progress):
        {
            "session_id": "abc-123",
            "status": "searching",
            "progress": 40,
            "message": "Searching database for candidates...",
            "updated_at": "1234567890"
        }
    
    Example (completed):
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
    session_id: str = Field(..., description="Session identifier")
    status: str = Field(..., description="Current status (parsing, searching, scoring, completed, error)")
    progress: int = Field(..., ge=0, le=100, description="Progress percentage (0-100)")
    message: str = Field(..., description="Human-readable status message")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")
    scorecard: Optional[Dict[str, Any]] = Field(None, description="Completed scorecard (only when status=completed)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "abc-123-def-456",
                "status": "searching",
                "progress": 40,
                "message": "Searching database for candidates...",
                "updated_at": "1234567890"
            }
        }


class CandidateSummary(BaseModel):
    """
    Summary information for a candidate (for list views).
    
    Example:
        {
            "profile_id": "507f1f77bcf86cd799439011",
            "first_name": "John",
            "last_name": "Doe",
            "title": "Senior Python Developer",
            "location": "San Francisco, CA",
            "score": 85.5,
            "match_reason": "Excellent match • Industry: Technology • Level: Senior"
        }
    """
    profile_id: str = Field(..., description="Profile ID")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    title: str = Field(..., description="Job title")
    location: Optional[str] = Field(None, description="Location")
    score: float = Field(..., description="Match score (0-100)")
    match_reason: str = Field(..., description="Why this candidate matches")


class ScorecardSummary(BaseModel):
    """
    Summary statistics for a scorecard.
    
    Example:
        {
            "total_candidates": 150,
            "average_score": 72.5,
            "top_score": 95.0,
            "distribution": {
                "excellent": 25,
                "good": 75,
                "fair": 40,
                "poor": 10
            }
        }
    """
    total_candidates: int = Field(..., description="Total number of candidates found")
    average_score: float = Field(..., description="Average match score")
    top_score: float = Field(..., description="Highest match score")
    distribution: Dict[str, int] = Field(
        ...,
        description="Score distribution (excellent: 80+, good: 60-79, fair: 40-59, poor: 0-39)"
    )


class ScorecardListItem(BaseModel):
    """
    Scorecard item for list views (user's scorecard history).
    
    Example:
        {
            "session_id": "abc-123",
            "prompt": "Find Senior Python Developer in SF",
            "created_at": "2025-01-01T00:00:00",
            "total_candidates": 150,
            "top_score": 95.0
        }
    """
    session_id: str = Field(..., description="Session identifier")
    prompt: str = Field(..., description="Original job requirements")
    created_at: datetime = Field(..., description="When the scorecard was created")
    total_candidates: int = Field(..., description="Number of candidates found")
    top_score: float = Field(..., description="Highest match score")