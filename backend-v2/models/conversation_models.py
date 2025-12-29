"""
Conversation Models
==================
Pydantic models for the conversational interface (Donna).

These models define the structure of:
- Conversation state (what stage are we at?)
- Ideal profile card (what are we building?)
- Sample profiles (what results will look like?)
- Messages (back and forth between user and Donna)
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ===================================================================
# IDEAL PROFILE CARD
# ===================================================================

class IdealProfileCard(BaseModel):
    role_title: str = ""
    must_have_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    seniority: str = ""
    experience_years: str = ""
    industries: List[str] = Field(default_factory=list)
    company_size: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    additional_requirements: str = ""
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())



# ===================================================================
# SAMPLE PROFILE
# ===================================================================

class SampleProfile(BaseModel):
    """
    A preview profile showing "if we find someone like THIS, would that work?"
    
    This is fetched from the actual database based on the current
    ideal profile card.
    
    Example:
        {
            "profile_id": "507f1f77bcf86cd799439011",
            "name": "John Doe",
            "title": "Senior React Developer",
            "skills": ["React", "TypeScript", "Node.js", "AWS"],
            "experience_years": 6,
            "current_company": "Tech Startup Inc.",
            "location": "Mumbai",
            "industry": "Technology",
            "match_score": 87.5
        }
    """
    profile_id: str = Field(..., description="MongoDB profile ID")
    name: str = Field(..., description="Candidate name")
    title: str = Field(..., description="Current job title")
    skills: List[str] = Field(default_factory=list, description="Skills from profile")
    experience_years: int = Field(..., description="Total years of experience")
    current_company: str = Field(..., description="Current company")
    location: str = Field(..., description="Current location")
    industry: str = Field(..., description="Industry")
    match_score: float = Field(..., description="How well they match (0-100)")


# ===================================================================
# CONVERSATION STATE
# ===================================================================

class ConversationStage(str):
    """
    The different stages of conversation flow.
    
    greeting → skills → experience → preferences → review → ready
    """
    GREETING = "greeting"
    SKILLS = "skills"
    EXPERIENCE = "experience"
    PREFERENCES = "preferences"
    REVIEW = "review"
    READY = "ready"


class ConversationMessage(BaseModel):
    """
    A single message in the conversation.
    
    Example:
        {
            "role": "assistant",
            "content": "Great! What are the must-have skills?",
            "timestamp": "2025-01-15T10:30:00",
            "metadata": {"stage": "skills"}
        }
    """
    role: str = Field(..., description="'user' or 'assistant' (Donna)")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: Dict = Field(default_factory=dict, description="Additional context")


class ConversationState(BaseModel):
    """
    Complete state of the conversation.
    
    This is stored in Redis and tracks:
    - Where are we in the conversation?
    - What have we built so far?
    - What's the message history?
    - What sample profile are we showing?
    """
    session_id: str = Field(..., description="Unique session ID")
    username: str = Field(..., description="Logged-in user")
    
    # Flow control
    stage: str = Field(default=ConversationStage.GREETING, description="Current conversation stage")
    turn_count: int = Field(default=0, description="Number of conversation turns")
    stage_turn_count: int = Field(default=0, description="Turns in current stage")
    
    # Core data
    ideal_profile: IdealProfileCard = Field(default_factory=IdealProfileCard)
    sample_profile: Optional[SampleProfile] = Field(None, description="Current sample profile")
    sample_candidates: List[Dict[str, Any]] = Field(default_factory=list)  
    
    # History
    messages: List[ConversationMessage] = Field(default_factory=list)
    feedback: Optional[Dict[str, Any]] = None 
    # Metadata
    last_search_metadata: Optional[Dict[str, Any]] = None  
    jd_uploaded: bool = Field(default=False, description="Did user upload a JD?")
    jd_file_name: Optional[str] = Field(None, description="Uploaded JD filename")
    ready_to_search: bool = Field(default=False, description="Ready to trigger search?")
    
    sample_candidates: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="List of sample candidates for feedback"
    )
    last_search_metadata: Optional[Dict[str, Any]] = Field(
        None, 
        description="Metadata from last search (total_found, tier_distribution, etc.)"
    )
    feedback: Optional[Dict[str, Any]] = Field(
        None,
        description="User feedback for refining searches (min_years, skill_weights, etc.)"
    )
    
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# ===================================================================
# API REQUEST/RESPONSE MODELS
# ===================================================================

class ConversationStartRequest(BaseModel):
    """
    Request to start a new conversation with Donna.
    
    Can optionally include:
    - Initial message from user
    - Uploaded JD file (as base64)
    - Generated JD text 
    """
    initial_message: Optional[str] = Field(None, description="Initial user message")
    jd_file_content: Optional[str] = Field(None, description="Base64 encoded PDF/DOCX")
    jd_file_name: Optional[str] = Field(None, description="Filename of uploaded JD")
    jd_text: Optional[str] = Field(None, description="Generated/edited JD text")
    model_configuration: Optional[Dict[str, str]] = Field(None, description="Optional model config")


class ConversationStartResponse(BaseModel):
    """
    Response when starting a conversation.
    """
    session_id: str = Field(..., description="Unique session ID")
    donna_greeting: str = Field(..., description="Donna's first message")
    ideal_profile: IdealProfileCard = Field(..., description="Initial (empty) profile card")
    sample_profile: Optional[SampleProfile] = Field(None, description="Optional sample profile")
    suggested_next_steps: List[str] = Field(default_factory=list, description="Suggestions for user")
    stage: str = Field(..., description="Current conversation stage")


class ConversationMessageRequest(BaseModel):
    """
    User's message in an ongoing conversation.
    """
    message: str = Field(..., description="User's message to Donna")
    action: Optional[str] = Field(None, description="Special actions: 'update_card', 'ready_to_search', 'show_sample'")


class ConversationMessageResponse(BaseModel):
    """
    Donna's response to user's message.
    """
    donna_reply: str = Field(..., description="Donna's response")
    updated_ideal_profile: IdealProfileCard = Field(..., description="Updated profile card")
    updated_sample_profile: Optional[SampleProfile] = Field(None, description="Updated sample")
    stage: str = Field(..., description="Current stage")
    ready_to_search: bool = Field(default=False, description="Can we search now?")
    suggestions: List[str] = Field(default_factory=list, description="Quick reply options")


class ConversationFinalizeRequest(BaseModel):
    """
    Request to finalize conversation and start search.
    """
    final_profile_adjustments: Optional[IdealProfileCard] = Field(None, description="Final tweaks")
    model_configuration: Optional[Dict[str, str]] = Field(None, description="Model config for search")


class ConversationFinalizeResponse(BaseModel):
    """
    Response when finalizing - triggers the actual search.
    """
    session_id: str = Field(..., description="Session ID")
    search_triggered: bool = Field(..., description="Was search triggered?")
    message: str = Field(..., description="Status message")
    estimated_candidates: Optional[int] = Field(None, description="Estimated result count")
    
class GenerateJDRequest(BaseModel):
    """Request to generate JD from search query"""
    search_query: str = Field(..., min_length=10, description="User's search query")


class GenerateJDResponse(BaseModel):
    """Generated JD response"""
    jd_text: str = Field(..., description="Generated job description text")
    session_id: str = Field(..., description="JD generation session ID for tracking")


class RefineJDRequest(BaseModel):
    """Request to refine JD based on feedback"""
    session_id: str = Field(..., description="JD generation session ID")
    original_query: str = Field(..., description="Original search query")
    previous_jd: str = Field(..., description="Previous JD version")
    feedback: str = Field(..., min_length=10, description="User's feedback on what's wrong")
    retry_count: int = Field(ge=0, le=2, description="Current retry count")


class RefineJDResponse(BaseModel):
    """Refined JD response"""
    jd_text: str = Field(..., description="Refined job description text")
    retry_count: int = Field(..., description="Updated retry count")
    max_retries_reached: bool = Field(..., description="Have we hit max retries?")
    
class RefineSearchRequest(BaseModel):
    """Request to refine search."""
    action: str = Field(..., description="Refinement action")
    data: Dict[str, Any] = Field(..., description="Refinement data")
    
class FeedbackRequest(BaseModel):
    """Request for feedback on samples."""
    feedback_type: str = Field(..., description="Type: too_junior, need_more_skill, wrong_industry, perfect")
    feedback_data: Optional[Dict[str, Any]] = Field(None, description="Additional data for feedback")


class FeedbackResponse(BaseModel):
    """Response after feedback."""
    donna_reply: str
    updated_samples: List[Dict[str, Any]]
    feedback_applied: bool
    

class EnrichCandidateRequest(BaseModel):
    candidate_id: str
    candidate: Dict[str, Any]


class EnrichCandidateResponse(BaseModel):
    status: str
    candidate_id: str
    message: str


class RejectionFeedbackRequest(BaseModel):
    candidate: Dict[str, Any]
    reason: str
    detailed_feedback: Optional[str] = ""


class RejectionFeedbackResponse(BaseModel):
    donna_reply: str
    refinements_applied: List[str]
    new_samples: List[Dict[str, Any]]
    updated_profile: Dict[str, Any]


class EnrichmentProgressResponse(BaseModel):
    status: str
    total: int
    completed: int
    failed: int
    candidates: Dict[str, Any] = Field(default_factory=dict)


class BatchEnrichRequest(BaseModel):
    accepted_candidates: List[Dict[str, Any]]


class BatchEnrichResponse(BaseModel):
    status: str
    total_candidates: int
    message: str
    
# ============================================================================
# REQUEST/RESPONSE MODELS FOR MANUAL IMPORT
# ============================================================================

class ManualCandidateEntry(BaseModel):
    """Single candidate entry from manual import."""
    linkedin_url: str
    expected_salary: Optional[str] = None
    current_salary: Optional[str] = None
    notice_period: Optional[str] = None
    preferred_location: Optional[str] = None
    notes: Optional[str] = None
    resume_base64: Optional[str] = None
    resume_filename: Optional[str] = None


class ManualImportRequest(BaseModel):
    """Request to create session from manual import."""
    jd_text: Optional[str] = None
    ideal_profile: Optional[dict] = None
    candidates: List[ManualCandidateEntry] = Field(..., min_length=1)
    pipeline_name: Optional[str] = None
    auto_scrape: bool = True


class CreatePipelineRequest(BaseModel):
    """Request to create pipeline from session."""
    shortlisted_candidate_ids: List[str] = Field(..., min_length=1)
    pipeline_name: Optional[str] = None
    
class AddCandidateRequest(BaseModel):
    linkedin_url: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    expected_salary: Optional[str] = None
    notice_period: Optional[str] = None
    notes: Optional[str] = None
