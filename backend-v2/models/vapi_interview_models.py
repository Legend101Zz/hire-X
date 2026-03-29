"""
Vapi Voice Interview Models V3
==============================
Pydantic models for the Vapi-powered voice interview system.

Features:
- Vapi assistant configuration
- Interview session management with call tracking
- Webhook event handling
- Recording & clip management with timestamps
- Multi-language support (English + Hindi/Hinglish)
- Comprehensive analysis and scoring

Author: Hire-X Engineering
Version: 3.0 - Vapi Integration Edition
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

# ===================================================================
# ENUMS
# ===================================================================

class InterviewStatus(str, Enum):
    """Status of an interview session."""
    PENDING = "pending"              # Created but call not started
    SCHEDULED = "scheduled"          # Scheduled for future
    CALLING = "calling"              # Outbound call in progress
    RINGING = "ringing"              # Phone is ringing
    IN_PROGRESS = "in_progress"      # Active interview
    COMPLETED = "completed"          # Successfully completed
    CANCELLED = "cancelled"          # Cancelled by system or user
    FAILED = "failed"                # Call failed
    NO_ANSWER = "no_answer"          # Candidate didn't answer
    VOICEMAIL = "voicemail"          # Reached voicemail


class QuestionType(str, Enum):
    """Types of interview questions."""
    INTRODUCTION = "introduction"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    SITUATIONAL = "situational"
    EXPERIENCE = "experience"
    CULTURE_FIT = "culture_fit"
    CLOSING = "closing"
    FOLLOW_UP = "follow_up"


class ResponseLanguage(str, Enum):
    """Detected language of candidate response."""
    ENGLISH = "en"
    HINDI = "hi"
    HINGLISH = "hinglish"
    UNKNOWN = "unknown"


class ConfidenceLevel(str, Enum):
    """Confidence level assessment."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCERTAIN = "uncertain"


class VapiEventType(str, Enum):
    """Vapi webhook event types."""
    ASSISTANT_REQUEST = "assistant-request"
    FUNCTION_CALL = "function-call"
    STATUS_UPDATE = "status-update"
    END_OF_CALL_REPORT = "end-of-call-report"
    HANG = "hang"
    SPEECH_UPDATE = "speech-update"
    TRANSCRIPT = "transcript"
    TOOL_CALLS = "tool-calls"


class CallEndReason(str, Enum):
    """Why a call ended."""
    COMPLETED = "completed"
    HANGUP_CANDIDATE = "hangup-by-candidate"
    HANGUP_SYSTEM = "hangup-by-system"
    SILENCE_TIMEOUT = "silence-timeout"
    MAX_DURATION = "max-duration-reached"
    ERROR = "error"
    VOICEMAIL = "voicemail-detected"
    NO_ANSWER = "no-answer"
    BUSY = "busy"
    TECHNICAL_ERROR = "technical-error"
    NETWORK_ERROR = "network-error"


# ===================================================================
# VAPI CONFIGURATION MODELS
# ===================================================================

class VapiVoiceConfig(BaseModel):
    """
    Configuration for Vapi voice synthesis.
    Uses Cartesia Sonic 3 as the TTS provider.
    """
    provider: str = Field(default="cartesia", description="TTS provider")
    voice_id: str = Field(
        default="cbaf8084-f009-4838-a096-07ee2e6612b1",  # Default Sonic voice
        description="Cartesia voice ID"
    )
    model: str = Field(default="sonic-3", description="Cartesia model")
    language: str = Field(default="en", description="Primary language")
    
    # Sonic 3 generation controls
    speed: Optional[float] = Field(default=1.0, ge=0.6, le=1.5, description="Speech speed (0.6-1.5)")
    volume: Optional[float] = Field(default=0.9, ge=0.5, le=2.0, description="Speech volume (0.5-2.0)")
    emotion: Optional[List[str]] = Field(default=None, description="Emotion tags: ['positivity:high']")
    
    class Config:
        json_schema_extra = {
            "example": {
                "provider": "cartesia",
                "voice_id": "cbaf8084-f009-4838-a096-07ee2e6612b1",
                "model": "sonic-3",
                "language": "en",
                "speed": 1.0,
                "volume": 0.9
            }
        }

class VapiTranscriberConfig(BaseModel):
    """
    Configuration for Vapi speech-to-text.
    Uses Deepgram for multi-language support including Hindi.
    """
    provider: str = Field(default="deepgram", description="STT provider")
    model: str = Field(default="nova-2", description="Deepgram model")
    language: str = Field(default="multi", description="Language: 'multi' for auto-detect")
    
    # Advanced settings
    smart_format: bool = Field(default=True, description="Enable smart formatting")
    keywords: List[str] = Field(default_factory=list, description="Keywords to boost recognition")
    endpointing: int = Field(default=400, ge=100, le=1000, description="Silence before response (ms)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "provider": "deepgram",
                "model": "nova-2",
                "language": "multi",
                "endpointing": 400
            }
        }


class VapiModelConfig(BaseModel):
    """
    Configuration for Vapi LLM.
    Uses OpenRouter for model flexibility.
    """
    provider: str = Field(default="openrouter", description="LLM provider")
    model: str = Field(default="anthropic/claude-sonnet-4.5", description="Model name")
    temperature: float = Field(default=0.7, ge=0, le=1, description="Temperature")
    max_tokens: int = Field(default=80, description="Max response tokens (keep concise)")
    
    # System prompt (will be generated dynamically)
    system_prompt: Optional[str] = Field(None, description="System prompt for interview")
    
    # Tool definitions
    tools: List[Dict[str, Any]] = Field(default_factory=list, description="Function tools")
    
    class Config:
        json_schema_extra = {
            "example": {
                "provider": "openrouter",
                "model": "anthropic/claude-sonnet-4.5",
                "temperature": 0.7,
                "max_tokens": 80
            }
        }


class VapiAssistantConfig(BaseModel):
    """
    Complete Vapi assistant configuration.
    """
    name: str = Field(..., description="Assistant name")
    first_message: str = Field(..., description="Opening message with SSML")
    
    # Component configs
    voice: VapiVoiceConfig = Field(default_factory=VapiVoiceConfig)
    transcriber: VapiTranscriberConfig = Field(default_factory=VapiTranscriberConfig)
    model: VapiModelConfig = Field(default_factory=VapiModelConfig)
    
    # Call settings
    silence_timeout_seconds: int = Field(default=20, description="Hang up after N seconds silence")
    max_duration_seconds: int = Field(default=600, description="Max call duration (10 min)")
    end_call_message: Optional[str] = Field(None, description="Message before hanging up")
    
    # Webhook
    server_url: Optional[str] = Field(None, description="Webhook URL for events")
    
    # Recording
    recording_enabled: bool = Field(default=True, description="Enable call recording")
    
    # Advanced
    background_sound: Optional[str] = Field(default="office", description="Background ambience")
    barge_in_enabled: bool = Field(default=True, description="Allow interruption")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Neura - Hire-X Interviewer",
                "first_message": "Hello! This is Neura from Hire-X...",
                "max_duration_seconds": 600
            }
        }


# ===================================================================
# CANDIDATE & JOB CONTEXT
# ===================================================================

class InterviewCandidateContext(BaseModel):
    """
    Candidate information for the interview.
    Populated from Hire-X enrichment data.
    """
    candidate_id: str = Field(..., description="MongoDB profile ID")
    name: str = Field(..., description="Candidate full name")
    phone_number: str = Field(..., description="Phone number with country code")
    
    # Professional info
    current_title: str = Field(..., description="Current job title")
    current_company: Optional[str] = Field(None, description="Current company")
    experience_years: float = Field(..., description="Total years of experience")
    
    # Skills & background
    skills: List[str] = Field(default_factory=list, description="Key skills from profile")
    location: Optional[str] = Field(None, description="Current location")
    education: Optional[str] = Field(None, description="Highest education")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    
    # From enrichment (optional but important for personalization)
    enrichment_summary: Optional[str] = Field(None, description="Summary from deep dive")
    salary_estimate: Optional[Dict[str, Any]] = Field(None, description="Salary estimation")
    skill_validations: Optional[Dict[str, Any]] = Field(None, description="Skill validation results")
    response_likelihood: Optional[float] = Field(None, description="Response likelihood score (0-100)")
    
    # Professional footprint (from enrichment)
    professional_footprint: Optional[Dict[str, Any]] = Field(None, description="Professional presence data")
    
    # Interview-specific
    preferred_language: str = Field(default="en", description="Preferred interview language")
    timezone: str = Field(default="Asia/Kolkata", description="Candidate timezone")
    
    class Config:
        json_schema_extra = {
            "example": {
                "candidate_id": "507f1f77bcf86cd799439011",
                "name": "Rahul Sharma",
                "phone_number": "+919876543210",
                "current_title": "Senior Software Engineer",
                "current_company": "Tech Corp India",
                "experience_years": 6,
                "skills": ["Python", "Django", "PostgreSQL", "AWS", "Docker"],
                "location": "Bangalore, India",
                "enrichment_summary": "Strong backend engineer with microservices experience...",
                "response_likelihood": 75
            }
        }


class InterviewJobContext(BaseModel):
    """
    Job/role context for tailoring interview questions.
    From the search/JD used to find this candidate.
    """
    job_id: Optional[str] = Field(None, description="Job/search ID")
    job_title: str = Field(..., description="Target job title")
    company_name: Optional[str] = Field(None, description="Hiring company name")
    
    # Requirements
    required_skills: List[str] = Field(default_factory=list, description="Must-have skills")
    nice_to_have_skills: List[str] = Field(default_factory=list, description="Good-to-have skills")
    experience_required: str = Field(..., description="Required experience level")
    
    # Job details
    job_description_summary: Optional[str] = Field(None, description="Brief JD summary")
    key_responsibilities: List[str] = Field(default_factory=list, description="Main responsibilities")
    
    # Evaluation focus
    evaluation_criteria: List[str] = Field(default_factory=list, description="What to evaluate")
    deal_breakers: List[str] = Field(default_factory=list, description="Red flags to watch for")
    
    class Config:
        json_schema_extra = {
            "example": {
                "job_title": "Senior Python Developer",
                "company_name": "Hire-X",
                "required_skills": ["Python", "FastAPI", "MongoDB"],
                "experience_required": "5+ years",
                "key_responsibilities": ["Backend development", "API design", "Team mentoring"]
            }
        }



# ===================================================================
# INTERVIEW PLAN
# ===================================================================
class InterviewPlanQuestion(BaseModel):
    """
    A planned interview question with evaluation criteria.
    """
    question_id: str = Field(..., description="Unique question ID")
    question_text: str = Field(..., description="The question to ask")
    question_type: QuestionType = Field(..., description="Type of question")
    order: int = Field(..., ge=0, description="Question order")
    
    # Evaluation
    expected_topics: List[str] = Field(default_factory=list, description="Topics candidate should cover")
    skill_tags: List[str] = Field(default_factory=list, description="Skills being evaluated")
    
    # Scoring
    weight: float = Field(default=1.0, ge=0.0, le=5.0, description="Question weight")
    time_limit_seconds: int = Field(default=90, description="Expected response time")
    
    # Adaptive
    follow_up_prompts: List[str] = Field(default_factory=list, description="Potential follow-ups")
    skip_conditions: Optional[str] = Field(None, description="When to skip this question")


class InterviewPlan(BaseModel):
    """
    Complete interview plan generated based on candidate + job context.
    Optimized for 5-10 minute interviews.
    """
    plan_id: str = Field(..., description="Unique plan ID")
    
    # Context references
    candidate_id: str = Field(..., description="Candidate ID")
    job_id: Optional[str] = Field(None, description="Job/search ID")
    
    # Plan details
    interview_focus: str = Field(..., description="Main focus areas for this interview")
    questions: List[InterviewPlanQuestion] = Field(..., description="Ordered questions (max 5)")
    
    # Personality & tone
    interviewer_personality: str = Field(
        default="warm_professional",
        description="Interviewer style: warm_professional, direct, casual"
    )
    opening_context: str = Field(..., description="Context for opening the interview")
    closing_notes: str = Field(..., description="Notes for closing")
    
    # Adaptive rules
    skip_introduction_if: Optional[str] = Field(None, description="Condition to skip intro")
    time_pressure_mode: bool = Field(default=False, description="Rush through if running late")
    
    # Metadata
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    generated_by: str = Field(default="llm", description="How plan was generated")
    
    class Config:
        json_schema_extra = {
            "example": {
                "plan_id": "plan-abc123",
                "interview_focus": "Python backend expertise and team collaboration",
                "questions": []
            }
        }



# ===================================================================
# INTERVIEW SESSION
# ===================================================================
class InterviewSession(BaseModel):
    """
    Complete interview session record.
    Links candidate, job, plan, and call data.
    """
    session_id: str = Field(..., description="Unique session ID")
    
    # References
    candidate: InterviewCandidateContext = Field(..., description="Candidate info")
    job: InterviewJobContext = Field(..., description="Job requirements")
    plan: Optional[InterviewPlan] = Field(None, description="Interview plan")
    
    # Vapi configuration
    vapi_assistant_id: Optional[str] = Field(None, description="Vapi assistant ID")
    vapi_assistant_config: Optional[VapiAssistantConfig] = Field(None, description="Assistant config")
    vapi_call_id: Optional[str] = Field(None, description="Active Vapi call ID")
    vapi_phone_number_id: Optional[str] = Field(None, description="Vapi phone number used")
    
    # Call info
    phone_number_called: str = Field(..., description="Phone number called")
    scheduled_at: Optional[str] = Field(None, description="Scheduled time (if scheduled)")
    
    # Status
    status: InterviewStatus = Field(default=InterviewStatus.PENDING, description="Session status")
    call_start_time: Optional[str] = Field(None, description="When call started")
    call_end_time: Optional[str] = Field(None, description="When call ended")
    call_duration_seconds: Optional[float] = Field(None, description="Call duration")
    call_end_reason: Optional[CallEndReason] = Field(None, description="Why call ended")
    
    # Recording (from Vapi)
    recording_url: Optional[str] = Field(None, description="Recording URL from Vapi")
    recording_local_path: Optional[str] = Field(None, description="Local recording path")
    stereo_recording_url: Optional[str] = Field(None, description="Stereo recording URL")
    
    # Transcript
    full_transcript: List[Dict[str, Any]] = Field(default_factory=list, description="Full conversation")
    
    # Analysis
    clips: List["InterviewClip"] = Field(default_factory=list, description="Interview clips")
    final_assessment: Optional["InterviewAssessment"] = Field(None, description="Final evaluation")
    
    # Metadata
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    created_by: str = Field(..., description="Username who created")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "interview-abc123",
                "status": "pending",
                "phone_number_called": "+919876543210"
            }
        }

# ===================================================================
# TRANSCRIPT & CLIPS
# ===================================================================
class TranscriptEntry(BaseModel):
    """
    Single entry in the conversation transcript.
    """
    role: str = Field(..., description="speaker: 'assistant' or 'user'")
    content: str = Field(..., description="What was said")
    timestamp: Optional[float] = Field(None, description="Timestamp in seconds from call start")
    duration: Optional[float] = Field(None, description="Duration of this segment")
    
    # Analysis
    detected_language: Optional[ResponseLanguage] = Field(None, description="Detected language")
    sentiment: Optional[str] = Field(None, description="Sentiment: positive/neutral/negative")
    is_question: bool = Field(default=False, description="Is this a question?")


class InterviewClip(BaseModel):
    """
    A clip from the interview for review.
    Allows recruiters to jump to specific moments.
    """
    clip_id: str = Field(..., description="Unique clip ID")
    session_id: str = Field(..., description="Parent session ID")
    
    # Timing
    start_time_seconds: float = Field(default=0, description="Start time in recording")
    end_time_seconds: float = Field(default=0, description="End time in recording")
    duration_seconds: float = Field(default=0, description="Clip duration")
    
    # Content
    question_asked: str = Field(..., description="Question that prompted this response")
    question_type: QuestionType = Field(..., description="Type of question")
    candidate_response: str = Field(..., description="Transcript of candidate's response")
    
    # Analysis
    analysis: Optional["ResponseAnalysis"] = Field(None, description="Response analysis")
    
    # File info (generated on demand)
    clip_file_path: Optional[str] = Field(None, description="Path to extracted clip")
    clip_url: Optional[str] = Field(None, description="URL to stream clip")
    
    # Highlights
    is_highlight: bool = Field(default=False, description="Marked as a highlight")
    highlight_reason: Optional[str] = Field(None, description="Why this is highlighted")
    
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ===================================================================
# ANALYSIS MODELS
# ===================================================================

class ResponseAnalysis(BaseModel):
    """
    LLM-powered analysis of a single candidate response.
    """
    # Content analysis
    key_points_covered: List[str] = Field(default_factory=list, description="Main points made")
    topics_mentioned: List[str] = Field(default_factory=list, description="Topics discussed")
    skills_demonstrated: List[str] = Field(default_factory=list, description="Skills shown")
    
    # Quality scores (0-100)
    relevance_score: float = Field(default=50, ge=0, le=100, description="How relevant to question")
    depth_score: float = Field(default=50, ge=0, le=100, description="Depth of answer")
    clarity_score: float = Field(default=50, ge=0, le=100, description="Communication clarity")
    overall_score: float = Field(default=50, ge=0, le=100, description="Overall response score")
    
    # Assessment
    confidence_assessment: ConfidenceLevel = Field(default=ConfidenceLevel.MEDIUM, description="Candidate's confidence")
    
    # Feedback
    strengths: List[str] = Field(default_factory=list, description="What was good")
    areas_for_improvement: List[str] = Field(default_factory=list, description="What could be better")
    red_flags: List[str] = Field(default_factory=list, description="Concerning patterns")
    
    # Summary
    brief_summary: str = Field(default="", description="One-line summary")
    detailed_notes: str = Field(default="", description="Detailed notes for recruiter")


class InterviewAssessment(BaseModel):
    """
    Final comprehensive assessment after interview completion.
    """
    # Overall scores (0-100)
    overall_score: float = Field(default=50, ge=0, le=100, description="Overall candidate score")
    technical_score: float = Field(default=50, ge=0, le=100, description="Technical competency")
    communication_score: float = Field(default=50, ge=0, le=100, description="Communication skills")
    culture_fit_score: float = Field(default=50, ge=0, le=100, description="Culture fit assessment")
    
    # Recommendation
    recommendation: str = Field(default="maybe", description="strong_hire | hire | maybe | no_hire")
    recommendation_confidence: ConfidenceLevel = Field(default=ConfidenceLevel.MEDIUM, description="Confidence level")
    
    # Detailed breakdown
    skill_scores: Dict[str, float] = Field(default_factory=dict, description="Score per skill")
    question_scores: Dict[str, float] = Field(default_factory=dict, description="Score per question")
    
    # Insights
    top_strengths: List[str] = Field(default_factory=list, description="Top 3 strengths")
    concerns: List[str] = Field(default_factory=list, description="Areas of concern")
    notable_moments: List[str] = Field(default_factory=list, description="Standout moments")
    
    # Highlights (clip references)
    highlight_clips: List[str] = Field(default_factory=list, description="Clip IDs worth reviewing")
    red_flag_clips: List[str] = Field(default_factory=list, description="Concerning clip IDs")
    
    # Summary for hiring manager
    executive_summary: str = Field(default="", description="2-3 sentence summary")
    detailed_report: str = Field(default="", description="Full interview report")
    
    # Language insights
    language_proficiency: Dict[str, str] = Field(
        default_factory=dict,
        description="English: excellent/good/fair/poor, Hindi: if used"
    )
    
    # Comparison
    percentile_estimate: Optional[float] = Field(None, description="Percentile vs similar candidates")
    
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ===================================================================
# WEBHOOK EVENT MODELS
# ===================================================================
class VapiWebhookEvent(BaseModel):
    """
    Incoming webhook event from Vapi.
    """
    type: str = Field(..., description="Event type")
    call: Optional[Dict[str, Any]] = Field(None, description="Call object")
    timestamp: Optional[Union[str, int]] = Field(None, description="Event timestamp")
    
    # Event-specific data
    function_call: Optional[Dict[str, Any]] = Field(None, description="For function-call events")
    transcript: Optional[List[Dict[str, Any]]] = Field(None, description="Transcript entries")
    recording_url: Optional[str] = Field(None, description="Recording URL")
    stereo_recording_url: Optional[str] = Field(None, description="Stereo recording")
    summary: Optional[str] = Field(None, description="Call summary")
    
    # Status updates
    status: Optional[str] = Field(None, description="Call status")
    ended_reason: Optional[str] = Field(None, description="Why call ended")

class VapiFunctionCallRequest(BaseModel):
    """
    Function call request from Vapi.
    """
    name: str = Field(..., description="Function name")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Function parameters")


class VapiFunctionCallResponse(BaseModel):
    """
    Response to a Vapi function call.
    """
    result: Any = Field(..., description="Function result")

# ===================================================================
# API REQUEST/RESPONSE MODELS
# ===================================================================

class CreateInterviewRequest(BaseModel):
    """Request to create and optionally start an interview."""
    candidate: InterviewCandidateContext
    job: InterviewJobContext
    
    # Options
    auto_call: bool = Field(default=False, description="Immediately place the call")
    scheduled_at: Optional[str] = Field(None, description="Schedule for later (ISO datetime)")
    custom_questions: List[str] = Field(default_factory=list, description="Custom questions to include")
    
    # Voice config override
    voice_config: Optional[VapiVoiceConfig] = Field(None, description="Custom voice settings")


class CreateInterviewResponse(BaseModel):
    """Response when creating an interview."""
    session_id: str
    status: InterviewStatus
    vapi_assistant_id: Optional[str]
    plan: Optional[InterviewPlan]
    message: str
    call_id: Optional[str] = None  # If auto_call=True


class StartCallRequest(BaseModel):
    """Request to start a call for an existing session."""
    session_id: str


class StartCallResponse(BaseModel):
    """Response when starting a call."""
    session_id: str
    call_id: str
    status: InterviewStatus
    message: str


class GetInterviewResultsResponse(BaseModel):
    """Complete interview results."""
    session_id: str
    status: InterviewStatus
    candidate_name: str
    job_title: str
    duration_minutes: Optional[float]
    
    # Results
    assessment: Optional[InterviewAssessment]
    clips: List[InterviewClip]
    transcript: List[TranscriptEntry]
    
    # Recordings
    recording_url: Optional[str]
    
    # Metadata
    created_at: str
    completed_at: Optional[str]


class ListInterviewsRequest(BaseModel):
    """Request to list interviews."""
    status: Optional[InterviewStatus] = None
    candidate_id: Optional[str] = None
    job_id: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ListInterviewsResponse(BaseModel):
    """Response listing interviews."""
    interviews: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int


# Update forward references
InterviewSession.model_rebuild()
InterviewClip.model_rebuild()