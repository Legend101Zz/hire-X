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
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

# ===================================================================
# IDEAL PROFILE CARD
# ===================================================================

class IdealProfileCard(BaseModel):
    """
    The "living document" that builds up during conversation.
    
    This is what the user sees being built in real-time as they
    chat with Donna.
    
    Example:
        {
            "role_title": "Senior React Developer",
            "must_have_skills": ["React", "TypeScript", "Node.js"],
            "nice_to_have_skills": ["Next.js", "GraphQL"],
            "seniority": "Senior",
            "experience_years": "5+",
            "industries": ["Technology", "Fintech"],
            "company_size": ["Startup", "Mid-size"],
            "locations": ["Mumbai", "Bangalore"],
            "additional_requirements": "Must have experience with microservices"
        }
    """
    # Core requirements
    role_title: str = Field(default="", description="Job title (e.g. 'Senior React Developer')")
    must_have_skills: List[str] = Field(default_factory=list, description="Required skills")
    nice_to_have_skills: List[str] = Field(default_factory=list, description="Preferred skills")
    
    # Experience
    seniority: str = Field(default="", description="Seniority level (Junior/Mid/Senior/Lead)")
    experience_years: str = Field(default="", description="Years of experience (e.g. '5+', '3-5')")
    
    # Context
    industries: List[str] = Field(default_factory=list, description="Target industries")
    company_size: List[str] = Field(default_factory=list, description="Company size preferences")
    locations: List[str] = Field(default_factory=list, description="Acceptable locations")
    
    # Additional
    additional_requirements: str = Field(default="", description="Any other requirements")
    
    # Metadata
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
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
    
    Example:
        {
            "session_id": "abc-123-def-456",
            "username": "recruiter@company.com",
            "stage": "skills",
            "turn_count": 3,
            "ideal_profile": {...},
            "sample_profile": {...},
            "messages": [...],
            "jd_uploaded": false,
            "ready_to_search": false
        }
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
    
    # History
    messages: List[ConversationMessage] = Field(default_factory=list)
    
    # Metadata
    jd_uploaded: bool = Field(default=False, description="Did user upload a JD?")
    jd_file_name: Optional[str] = Field(None, description="Uploaded JD filename")
    ready_to_search: bool = Field(default=False, description="Ready to trigger search?")
    
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
    """
    initial_message: Optional[str] = Field(None, description="Initial user message")
    jd_file_content: Optional[str] = Field(None, description="Base64 encoded PDF/DOCX")
    jd_file_name: Optional[str] = Field(None, description="Filename of uploaded JD")
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