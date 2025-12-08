"""
Voice Interview Models
======================
Pydantic models for the AI-powered voice interview system.

Features:
- Interview session management
- Question and response tracking
- Recording clip management with timestamps
- Multi-language support (English + Hindi)
- Analysis and scoring

"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ===================================================================
# ENUMS
# ===================================================================

class InterviewStatus(str, Enum):
    """Status of an interview session."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class QuestionType(str, Enum):
    """Types of interview questions."""
    INTRODUCTION = "introduction"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    SITUATIONAL = "situational"
    EXPERIENCE = "experience"
    CULTURE_FIT = "culture_fit"
    CLOSING = "closing"


class ResponseLanguage(str, Enum):
    """Detected language of candidate response."""
    ENGLISH = "en"
    HINDI = "hi"
    HINGLISH = "hinglish"  # Mixed Hindi-English
    UNKNOWN = "unknown"


class ConfidenceLevel(str, Enum):
    """Confidence level assessment."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCERTAIN = "uncertain"


# ===================================================================
# VOICE CONFIGURATION
# ===================================================================

class CartesiaVoiceConfig(BaseModel):
    """
    Configuration for Cartesia Sonic 3 voice.
    
    Voices optimized for Indian demographic:
    - Professional English with Indian accent options
    - Hindi/Hinglish capable voices
    """
    voice_id: str = Field(
        default="f786b574-daa5-4673-aa0c-cbe3e8534c02",  # Katie - stable, realistic
        description="Cartesia voice ID"
    )
    voice_name: str = Field(default="Katie", description="Human-readable voice name")
    language: str = Field(default="en", description="Primary language (en, hi)")
    speed: float = Field(default=0.0, ge=-1.0, le=1.0, description="Speech speed (-1 to 1)")
    emotion: Optional[str] = Field(default=None, description="Emotion: positivity, surprise, etc.")
    emotion_level: Optional[str] = Field(default=None, description="Emotion level: low, medium, high")
    
    class Config:
        json_schema_extra = {
            "example": {
                "voice_id": "f786b574-daa5-4673-aa0c-cbe3e8534c02",
                "voice_name": "Katie",
                "language": "en",
                "speed": 0.0,
                "emotion": "positivity",
                "emotion_level": "medium"
            }
        }


# ===================================================================
# CANDIDATE CONTEXT
# ===================================================================

class CandidateContext(BaseModel):
    """
    Candidate information fed into the interview.
    Populated from NeuraLeap search results.
    """
    candidate_id: str = Field(..., description="MongoDB profile ID")
    name: str = Field(..., description="Candidate name")
    current_title: str = Field(..., description="Current job title")
    current_company: Optional[str] = Field(None, description="Current company")
    experience_years: int = Field(..., description="Total years of experience")
    skills: List[str] = Field(default_factory=list, description="Key skills from profile")
    location: Optional[str] = Field(None, description="Current location")
    education: Optional[str] = Field(None, description="Highest education")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")
    
    # From enrichment
    salary_estimate: Optional[Dict[str, Any]] = Field(None, description="Salary estimation data")
    skill_validations: Optional[Dict[str, Any]] = Field(None, description="Skill validation results")
    response_likelihood: Optional[float] = Field(None, description="Response likelihood score")
    
    class Config:
        json_schema_extra = {
            "example": {
                "candidate_id": "507f1f77bcf86cd799439011",
                "name": "Rahul Sharma",
                "current_title": "Senior Software Engineer",
                "current_company": "Tech Corp India",
                "experience_years": 6,
                "skills": ["Python", "Django", "PostgreSQL", "AWS", "Docker"],
                "location": "Bangalore, India"
            }
        }


class JobContext(BaseModel):
    """
    Job/role context for tailoring interview questions.
    """
    job_title: str = Field(..., description="Target job title")
    company_name: Optional[str] = Field(None, description="Hiring company name")
    required_skills: List[str] = Field(default_factory=list, description="Must-have skills")
    nice_to_have_skills: List[str] = Field(default_factory=list, description="Good-to-have skills")
    experience_required: str = Field(..., description="Required experience level")
    job_description_summary: Optional[str] = Field(None, description="Brief JD summary")
    key_responsibilities: List[str] = Field(default_factory=list, description="Main responsibilities")
    evaluation_criteria: List[str] = Field(default_factory=list, description="What to evaluate")
    
    class Config:
        json_schema_extra = {
            "example": {
                "job_title": "Senior Python Developer",
                "company_name": "NeuraLeap",
                "required_skills": ["Python", "FastAPI", "MongoDB"],
                "experience_required": "5+ years",
                "key_responsibilities": ["Backend development", "API design", "Team mentoring"]
            }
        }


# ===================================================================
# INTERVIEW QUESTIONS
# ===================================================================

class InterviewQuestion(BaseModel):
    """
    A single interview question with metadata.
    """
    question_id: str = Field(..., description="Unique question identifier")
    question_text: str = Field(..., description="The question to ask")
    question_type: QuestionType = Field(..., description="Type of question")
    order: int = Field(..., ge=1, description="Question order in interview")
    
    # Evaluation criteria
    expected_topics: List[str] = Field(default_factory=list, description="Topics candidate should cover")
    time_limit_seconds: int = Field(default=120, description="Expected response time")
    follow_up_prompts: List[str] = Field(default_factory=list, description="Potential follow-ups")
    
    # Scoring weights
    weight: float = Field(default=1.0, ge=0.0, le=5.0, description="Question weight for scoring")
    skill_tags: List[str] = Field(default_factory=list, description="Skills being evaluated")
    
    class Config:
        json_schema_extra = {
            "example": {
                "question_id": "q1",
                "question_text": "Tell me about a challenging Python project you've worked on recently.",
                "question_type": "technical",
                "order": 1,
                "expected_topics": ["problem description", "approach", "technologies", "outcome"],
                "time_limit_seconds": 180,
                "weight": 1.5,
                "skill_tags": ["Python", "Problem Solving"]
            }
        }


# ===================================================================
# CANDIDATE RESPONSES
# ===================================================================

class TranscriptionResult(BaseModel):
    """
    Result from Cartesia Ink-Whisper STT.
    """
    text: str = Field(..., description="Transcribed text")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Transcription confidence")
    duration_seconds: float = Field(..., description="Audio duration")
    detected_language: ResponseLanguage = Field(..., description="Detected language")
    
    # Word-level timestamps for clip extraction
    words: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Word-level timestamps: [{word, start, end}, ...]"
    )
    
    # Hindi-specific
    hindi_words_detected: int = Field(default=0, description="Count of Hindi words detected")
    english_words_detected: int = Field(default=0, description="Count of English words detected")


class ResponseAnalysis(BaseModel):
    """
    LLM-powered analysis of candidate's response.
    """
    # Content analysis
    key_points_covered: List[str] = Field(default_factory=list, description="Main points made")
    topics_mentioned: List[str] = Field(default_factory=list, description="Topics discussed")
    skills_demonstrated: List[str] = Field(default_factory=list, description="Skills shown")
    
    # Quality assessment
    relevance_score: float = Field(..., ge=0.0, le=100.0, description="How relevant to question")
    depth_score: float = Field(..., ge=0.0, le=100.0, description="Depth of answer")
    clarity_score: float = Field(..., ge=0.0, le=100.0, description="Communication clarity")
    
    # Overall
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Overall response score")
    confidence_assessment: ConfidenceLevel = Field(..., description="Candidate's confidence")
    
    # Feedback
    strengths: List[str] = Field(default_factory=list, description="What was good")
    areas_for_improvement: List[str] = Field(default_factory=list, description="What could be better")
    red_flags: List[str] = Field(default_factory=list, description="Concerning patterns")
    
    # Summary
    brief_summary: str = Field(..., description="One-line summary of response")
    detailed_notes: str = Field(default="", description="Detailed analysis notes")


class CandidateResponse(BaseModel):
    """
    Complete response record for a question.
    """
    response_id: str = Field(..., description="Unique response identifier")
    question_id: str = Field(..., description="Associated question ID")
    
    # Audio data
    audio_file_path: str = Field(..., description="Path to recorded audio")
    audio_duration_seconds: float = Field(..., description="Recording duration")
    
    # Transcription
    transcription: TranscriptionResult = Field(..., description="STT result")
    
    # Analysis
    analysis: Optional[ResponseAnalysis] = Field(None, description="AI analysis")
    
    # Timestamps
    started_at: str = Field(..., description="When recording started")
    ended_at: str = Field(..., description="When recording ended")
    
    # Interviewer's follow-up (if any)
    follow_up_asked: Optional[str] = Field(None, description="Follow-up question asked")
    follow_up_response: Optional["CandidateResponse"] = Field(None, description="Follow-up response")


# ===================================================================
# RECORDING CLIPS
# ===================================================================

class InterviewClip(BaseModel):
    """
    A clip from the interview recording for review.
    """
    clip_id: str = Field(..., description="Unique clip identifier")
    interview_id: str = Field(..., description="Parent interview ID")
    question_id: str = Field(..., description="Associated question")
    
    # File info
    clip_file_path: str = Field(..., description="Path to clip audio file")
    duration_seconds: float = Field(..., description="Clip duration")
    
    # Position in full recording
    start_offset_seconds: float = Field(..., description="Start position in full recording")
    end_offset_seconds: float = Field(..., description="End position in full recording")
    
    # Content
    clip_type: str = Field(..., description="question | response | follow_up")
    transcription: Optional[str] = Field(None, description="Clip transcription")
    speaker: str = Field(..., description="interviewer | candidate")
    
    # Analysis summary for this clip
    clip_summary: Optional[str] = Field(None, description="Brief summary of this clip")
    key_moments: List[str] = Field(default_factory=list, description="Notable moments")
    
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ===================================================================
# INTERVIEW SESSION
# ===================================================================

class InterviewSession(BaseModel):
    """
    Complete interview session record.
    """
    session_id: str = Field(..., description="Unique session identifier")
    
    # Context
    candidate: CandidateContext = Field(..., description="Candidate info")
    job: JobContext = Field(..., description="Job requirements")
    
    # Configuration
    voice_config: CartesiaVoiceConfig = Field(
        default_factory=CartesiaVoiceConfig,
        description="Voice settings"
    )
    max_questions: int = Field(default=8, ge=3, le=15, description="Number of questions")
    max_duration_minutes: int = Field(default=30, ge=10, le=60, description="Max interview length")
    
    # Questions and responses
    questions: List[InterviewQuestion] = Field(default_factory=list, description="Interview questions")
    responses: List[CandidateResponse] = Field(default_factory=list, description="Candidate responses")
    
    # Full recording
    full_recording_path: Optional[str] = Field(None, description="Path to full interview recording")
    clips: List[InterviewClip] = Field(default_factory=list, description="Interview clips")
    
    # Status
    status: InterviewStatus = Field(default=InterviewStatus.PENDING, description="Session status")
    current_question_index: int = Field(default=0, description="Current question being asked")
    
    # Timestamps
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = Field(None, description="When interview started")
    completed_at: Optional[str] = Field(None, description="When interview ended")
    
    # Final assessment
    final_assessment: Optional["InterviewAssessment"] = Field(None, description="Final evaluation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "interview-abc123",
                "status": "in_progress",
                "current_question_index": 3,
                "max_questions": 8
            }
        }


class InterviewAssessment(BaseModel):
    """
    Final assessment after interview completion.
    """
    # Overall scores
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Overall candidate score")
    technical_score: float = Field(..., ge=0.0, le=100.0, description="Technical competency")
    communication_score: float = Field(..., ge=0.0, le=100.0, description="Communication skills")
    culture_fit_score: float = Field(..., ge=0.0, le=100.0, description="Culture fit assessment")
    
    # Recommendation
    recommendation: str = Field(..., description="strong_hire | hire | maybe | no_hire")
    recommendation_confidence: ConfidenceLevel = Field(..., description="Confidence in recommendation")
    
    # Detailed breakdown
    skill_scores: Dict[str, float] = Field(default_factory=dict, description="Score per skill")
    question_scores: Dict[str, float] = Field(default_factory=dict, description="Score per question")
    
    # Insights
    top_strengths: List[str] = Field(default_factory=list, description="Top 3 strengths")
    concerns: List[str] = Field(default_factory=list, description="Areas of concern")
    notable_moments: List[str] = Field(default_factory=list, description="Standout moments")
    
    # Comparison context
    percentile_estimate: Optional[float] = Field(None, description="Estimated percentile vs similar candidates")
    
    # Summary for hiring manager
    executive_summary: str = Field(..., description="2-3 sentence summary for hiring manager")
    detailed_report: str = Field(default="", description="Full interview report")
    
    # Language insights (India-specific)
    language_proficiency: Dict[str, str] = Field(
        default_factory=dict,
        description="Proficiency in English, Hindi if applicable"
    )
    
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ===================================================================
# API REQUEST/RESPONSE MODELS
# ===================================================================

class StartInterviewRequest(BaseModel):
    """Request to start a voice interview."""
    candidate: CandidateContext
    job: JobContext
    voice_config: Optional[CartesiaVoiceConfig] = None
    max_questions: int = Field(default=8, ge=3, le=15)
    custom_questions: List[str] = Field(default_factory=list, description="Optional custom questions")


class StartInterviewResponse(BaseModel):
    """Response when interview is initialized."""
    session_id: str
    status: InterviewStatus
    questions: List[InterviewQuestion]
    first_question_audio_url: str
    message: str


class SubmitResponseRequest(BaseModel):
    """Submit candidate's audio response."""
    audio_data: str = Field(..., description="Base64 encoded audio")
    audio_format: str = Field(default="wav", description="Audio format")
    question_id: str


class SubmitResponseResponse(BaseModel):
    """Response after processing candidate answer."""
    transcription: str
    detected_language: ResponseLanguage
    analysis_summary: str
    next_question: Optional[InterviewQuestion]
    next_question_audio_url: Optional[str]
    is_complete: bool
    progress_percentage: float


class GetInterviewResultsResponse(BaseModel):
    """Complete interview results."""
    session_id: str
    status: InterviewStatus
    candidate_name: str
    job_title: str
    duration_minutes: float
    assessment: InterviewAssessment
    clips: List[InterviewClip]
    full_recording_url: str
    responses_summary: List[Dict[str, Any]]


# Update forward references
CandidateResponse.model_rebuild()
InterviewSession.model_rebuild()