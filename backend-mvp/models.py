"""
Pydantic models for API requests and responses.
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class PromptRequest(BaseModel):
    prompt: str


class SessionResponse(BaseModel):
    session_id: str
    message: str


class PromptResponse(BaseModel):
    location: List[str]
    role: List[str]
    experience: List[str]
    industry: List[str]
    skills: List[str]


# Authentication models
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    email: Optional[str] = None


class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    hashed_password: str
    created_at: Optional[str] = None
    last_login: Optional[str] = None
    prompts: Optional[List[str]] = []  # Array of prompt_ids created by this user


class IncidentLog(BaseModel):
    username: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    incident_type: str  # "failed_login", "invalid_credentials", etc.
    timestamp: str
    details: Optional[str] = None

class HatchContactRequest(BaseModel):
    """Request model for single contact lookup using profile MongoDB ID."""
    profile_id: str = Field(..., description="MongoDB _id from mydatabase/profiles collection")
    session_id: Optional[str] = Field(None, description="Session ID for Redis caching")

class HatchBulkContactRequest(BaseModel):
    """Request model for bulk contact lookup (max 5)."""
    profile_ids: List[str] = Field(..., max_items=5, description="List of MongoDB _ids from mydatabase/profiles (max 5)")
    session_id: Optional[str] = Field(None, description="Session ID for caching")

class HatchContactResponse(BaseModel):
    """Response model for contact information."""
    success: bool
    profile_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[str] = Field(None, description="'cache' or 'api'")
    message: Optional[str] = None
    error: Optional[str] = None
    cached_at: Optional[str] = None
    
class PromptHistoryResponse(BaseModel):
    """Response model for prompt history with pagination."""
    prompts: List['PromptHistoryItem']
    total: int
    limit: int
    offset: int
    has_more: bool

class PromptHistoryItem(BaseModel):
    """Individual prompt history item."""
    prompt_id: str
    session_id: str
    prompt: str
    created_at: Optional[str] = None
    status: Optional[str] = "completed"

class PromptSearchResponse(BaseModel):
    """Response model for prompt search."""
    results: List['PromptSearchItem']
    total: int
    query: str

class PromptSearchItem(BaseModel):
    """Individual search result with highlighted text."""
    prompt_id: str
    session_id: str
    prompt: str
    created_at: Optional[str] = None
    highlight: Optional[str] = None  # Text with search term markers
    
class ProfileReference(BaseModel):
    """Reference to a profile in mydatabase/profiles"""
    profile_id: str = Field(..., description="MongoDB _id from mydatabase/profiles")
    match_score: Optional[float] = Field(None, description="Match score for this profile")
    match_reasons: Optional[List[str]] = Field(None, description="Reasons for the match")

class PaginatedResultsResponse(BaseModel):
    """Response model for paginated results."""
    session_id: str
    status: str
    profiles: List[Dict[str, Any]]  # Actual profile data
    summary: Dict[str, Any]
    total_profiles_found: int
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of profiles per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there's a next page")
    has_prev: bool = Field(..., description="Whether there's a previous page")    
    
    
PromptHistoryResponse.update_forward_refs()
PromptSearchResponse.update_forward_refs()