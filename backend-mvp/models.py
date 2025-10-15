"""
Pydantic models for API requests and responses.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


class PromptRequest(BaseModel):
    prompt: str


class SessionResponse(BaseModel):
    session_id: str
    message: str
    status: str = "processing"

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
    
    
# ===== V2 API Models =====

class PreflightCheckResult(BaseModel):
    """Preflight check results."""
    viable: bool
    results_count: int
    failed_filters: Dict[str, Any] = {}
    filter_details: Dict[str, Any] = {}


class QueryRefinementRequest(BaseModel):
    """User refinements for failed filters."""
    refinements: Dict[str, str]  # {"Industry": "Financial Services", "Location": "Mumbai"}


class ProgressUpdate(BaseModel):
    """Real-time progress update."""
    status: str  # "parsing", "preflight", "searching", "scoring", "ai_ranking", "completed", "error"
    message: str
    progress: int  # 0-100
    data: Optional[Any] = None
    timestamp: str


class ProfileSummary(BaseModel):
    """Lightweight profile summary."""
    profile_id: str
    pre_score: float
    name: str
    title: str
    location: str
    industry: str


class AISummary(BaseModel):
    """AI-generated summary for a profile."""
    final_score: int
    summary: str
    generated_at: datetime


class SearchResultsV2(BaseModel):
    """V2 search results with lazy summaries."""
    session_id: str
    prompt: str
    total_matches: int
    results: List[Dict[str, Any]]  # Profiles with AI summaries
    summary_generation: Dict[str, Any]
    preflight_check: PreflightCheckResult


class LoadMoreResponse(BaseModel):
    """Response for load-more request."""
    summaries: Dict[str, AISummary]
    total_generated: int
    total_profiles: int
    has_more: bool


class FullProfile(BaseModel):
    """Full profile with all details."""
    profile_id: str
    first_name: str
    last_name: str
    title: str
    location: str
    city: Optional[str]
    state: Optional[str]
    country: str
    current_industry: str
    expertise: str
    education: List[Dict[str, Any]]
    experience: List[Dict[str, Any]]
    certifications: Optional[List[Dict[str, Any]]] = []
    awards: Optional[List[str]] = []
    publications: Optional[List[Dict[str, Any]]] = []
    linkedin_url: Optional[str]
    
    
# ===== Scorecard Workflow Models =====

class ScorecardStartRequest(BaseModel):
    """Request to start a new scorecard building session."""
    query: str = Field(..., min_length=3, description="User's natural language query")


class ScorecardStartResponse(BaseModel):
    """Response when starting a new scorecard session."""
    session_id: str
    prompt_id: str
    scorecard_id: str
    scorecard: Dict[str, Any]
    message: str
    phase: str


class ScorecardMessageRequest(BaseModel):
    """Request to send a message in scorecard refinement."""
    message: str = Field(..., min_length=1, description="User's feedback message")


class ScorecardMessageResponse(BaseModel):
    """Response after processing user feedback."""
    scorecard: Dict[str, Any]
    message: str
    phase: str
    ready: bool = False


class ScorecardGetResponse(BaseModel):
    """Response when getting current scorecard."""
    scorecard: Dict[str, Any]
    conversation: List[Dict[str, str]]
    phase: str


class SampleCandidate(BaseModel):
    """A sample candidate with score."""
    profile: Dict[str, Any]
    score: float
    max_score: float
    score_breakdown: List[Dict[str, Any]]


class FindSamplesResponse(BaseModel):
    """Response when finding sample candidates."""
    candidates: List[SampleCandidate]
    total_matches: int
    phase: str


class ApproveSamplesResponse(BaseModel):
    """Response when approving sample candidates."""
    message: str
    phase: str


class RejectSamplesRequest(BaseModel):
    """Request when rejecting sample candidates."""
    feedback: str = Field(..., min_length=5, description="Reason for rejection")


class RejectSamplesResponse(BaseModel):
    """Response when rejecting samples."""
    scorecard: Dict[str, Any]
    message: str
    phase: str


class Prompt(BaseModel):
    """Full prompt document model."""
    prompt_id: str
    session_id: str
    username: str
    prompt: str
    scorecard_id: Optional[str] = None
    status: str = "draft"
    created_at: str
    updated_at: str


class Scorecard(BaseModel):
    """Full scorecard document model."""
    scorecard_id: str
    session_id: str
    prompt_id: Optional[str] = None
    username: str
    status: str = "draft"
    mustHaveFilters: List[Dict[str, Any]] = []
    scoringCriteria: List[Dict[str, Any]] = []
    expansions: Dict[str, List[str]] = {}
    threshold: int = 50
    metadata: Dict[str, Any] = {}
    created_at: str
    updated_at: str
    
    
PromptHistoryResponse.update_forward_refs()
PromptSearchResponse.update_forward_refs()


