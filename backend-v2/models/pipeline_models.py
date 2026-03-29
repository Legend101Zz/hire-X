"""
Pipeline Models
===============
Pydantic models for the complete recruitment pipeline flow.

This module defines:
- Pipeline stages and statuses
- Candidate tracking through the pipeline
- Outreach and email tracking
- Job context and requirements

Author: Hire-X Engineering
Version: 2.0
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, ValidationError, field_validator

# ===================================================================
# ENUMS - Pipeline Stages & Statuses
# ===================================================================

class PipelineSource(str, Enum):
    """How candidates were sourced into the pipeline."""
    DONNA_SEARCH = "donna_search"       # Via Donna conversation + DB search
    MANUAL_IMPORT = "manual_import"     # Via CSV/manual upload
    LINKEDIN_IMPORT = "linkedin_import" # Direct LinkedIn import
    REFERRAL = "referral"               # Internal referral
    CAREER_PAGE = "career_page"         # Applied via career page


class CandidateStage(str, Enum):
    """
    Stage of a candidate in the recruitment pipeline.
    
    Flow:
    SOURCED → SHORTLISTED → ENRICHING → ENRICHED → OUTREACH_PENDING →
    OUTREACH_SENT → (OUTREACH_REMINDER) → SCHEDULING → SCHEDULED →
    INTERVIEW_CALLING → INTERVIEW_COMPLETED → EVALUATED → HIRED/REJECTED
    """
    # Phase 1: Sourcing
    SOURCED = "sourced"                     # Added to pipeline
    SHORTLISTED = "shortlisted"             # HR marked for outreach
    
    # Phase 2: Enrichment
    ENRICHING = "enriching"                 # Deep analysis in progress
    ENRICHED = "enriched"                   # Analysis complete
    ENRICHMENT_FAILED = "enrichment_failed" # Analysis failed
    
    # Phase 2: Outreach
    OUTREACH_PENDING = "outreach_pending"   # Ready for email
    OUTREACH_SENT = "outreach_sent"         # Initial email sent
    OUTREACH_REMINDER = "outreach_reminder" # Reminder sent
    OUTREACH_FAILED = "outreach_failed"     # Email delivery failed
    NO_RESPONSE = "no_response"             # No reply after reminders
    
    # Phase 3: Scheduling
    SCHEDULING = "scheduling"               # Candidate clicked, scheduling
    SCHEDULED = "scheduled"                 # Interview scheduled
    RESCHEDULING = "rescheduling"           # Candidate requested reschedule
    
    # Phase 3: Interview
    INTERVIEW_PENDING = "interview_pending" # Waiting for call time
    INTERVIEW_CALLING = "interview_calling" # Call in progress
    INTERVIEW_COMPLETED = "interview_completed"  # Interview done
    INTERVIEW_FAILED = "interview_failed"   # Call failed (no answer, etc.)
    INTERVIEW_NO_SHOW = "interview_no_show" # Candidate didn't answer
    
    # Phase 3: Evaluation
    EVALUATING = "evaluating"               # AI analyzing interview
    EVALUATED = "evaluated"                 # Assessment ready
    
    # Final Stages
    OFFER_PENDING = "offer_pending"         # Offer being prepared
    OFFER_SENT = "offer_sent"               # Offer sent to candidate
    OFFER_ACCEPTED = "offer_accepted"       # Candidate accepted
    OFFER_REJECTED = "offer_rejected"       # Candidate rejected offer
    HIRED = "hired"                         # Final: Hired
    REJECTED = "rejected"                   # Final: Rejected by company
    WITHDRAWN = "withdrawn"                 # Final: Candidate withdrew
    ON_HOLD = "on_hold"                     # Paused


class OutreachStatus(str, Enum):
    """Email outreach delivery and engagement status."""
    PENDING = "pending"         # Not yet sent
    QUEUED = "queued"           # In send queue
    SENT = "sent"               # Sent successfully
    DELIVERED = "delivered"     # Confirmed delivery
    OPENED = "opened"           # Email opened
    CLICKED = "clicked"         # Link clicked
    REPLIED = "replied"         # Candidate replied
    BOUNCED = "bounced"         # Email bounced
    SPAM = "spam"               # Marked as spam
    FAILED = "failed"           # Send failed
    UNSUBSCRIBED = "unsubscribed"  # Candidate unsubscribed


class OutreachType(str, Enum):
    """Type of outreach email."""
    INITIAL = "initial"         # First contact
    REMINDER = "reminder"       # Follow-up reminder
    CONFIRMATION = "confirmation"  # Booking confirmation
    RESCHEDULE = "reschedule"   # Reschedule notification
    CANCELLATION = "cancellation"  # Cancellation notice
    REJECTION = "rejection"     # Rejection email
    OFFER = "offer"             # Offer letter


class ContactFetchSource(str, Enum):
    """Source of contact information."""
class ContactFetchSource(str, Enum):
    HATCH_API = "hatch_api"
    BRIGHTDATA_SCRAPE = "brightdata_scrape"
    MANUAL_INPUT = "manual_input"
    LINKEDIN_SCRAPE = "linkedin_scrape"
    RESUME_PARSE = "resume_parse"
    UNKNOWN = "unknown"


# ===================================================================
# STAGE METADATA - For UI Display
# ===================================================================

STAGE_METADATA: Dict[CandidateStage, Dict[str, Any]] = {
    CandidateStage.SOURCED: {
        "label": "Added to Pipeline",
        "icon": "📋",
        "color": "gray",
        "description": "Candidate added to the pipeline"
    },
    CandidateStage.SHORTLISTED: {
        "label": "Shortlisted",
        "icon": "⭐",
        "color": "blue",
        "description": "Selected for outreach"
    },
    CandidateStage.ENRICHING: {
        "label": "Analyzing...",
        "icon": "🔍",
        "color": "yellow",
        "description": "Running deep analysis"
    },
    CandidateStage.ENRICHED: {
        "label": "Analysis Complete",
        "icon": "✅",
        "color": "green",
        "description": "Deep analysis completed"
    },
    CandidateStage.ENRICHMENT_FAILED: {
        "label": "Analysis Failed",
        "icon": "⚠️",
        "color": "red",
        "description": "Could not complete analysis"
    },
    CandidateStage.OUTREACH_PENDING: {
        "label": "Ready for Outreach",
        "icon": "📧",
        "color": "purple",
        "description": "Waiting to send email"
    },
    CandidateStage.OUTREACH_SENT: {
        "label": "Email Sent",
        "icon": "📤",
        "color": "purple",
        "description": "Initial outreach sent"
    },
    CandidateStage.OUTREACH_REMINDER: {
        "label": "Reminder Sent",
        "icon": "🔔",
        "color": "orange",
        "description": "Follow-up reminder sent"
    },
    CandidateStage.OUTREACH_FAILED: {
        "label": "Email Failed",
        "icon": "❌",
        "color": "red",
        "description": "Email could not be delivered"
    },
    CandidateStage.NO_RESPONSE: {
        "label": "No Response",
        "icon": "😶",
        "color": "gray",
        "description": "Did not respond to outreach"
    },
    CandidateStage.SCHEDULING: {
        "label": "Scheduling",
        "icon": "📅",
        "color": "indigo",
        "description": "Candidate is booking interview"
    },
    CandidateStage.SCHEDULED: {
        "label": "Interview Scheduled",
        "icon": "🗓️",
        "color": "indigo",
        "description": "Interview time confirmed"
    },
    CandidateStage.RESCHEDULING: {
        "label": "Rescheduling",
        "icon": "🔄",
        "color": "orange",
        "description": "Candidate requested new time"
    },
    CandidateStage.INTERVIEW_PENDING: {
        "label": "Awaiting Interview",
        "icon": "⏳",
        "color": "indigo",
        "description": "Waiting for interview time"
    },
    CandidateStage.INTERVIEW_CALLING: {
        "label": "Interview in Progress",
        "icon": "📞",
        "color": "teal",
        "description": "AI interviewer calling"
    },
    CandidateStage.INTERVIEW_COMPLETED: {
        "label": "Interview Complete",
        "icon": "🎤",
        "color": "teal",
        "description": "Interview finished"
    },
    CandidateStage.INTERVIEW_FAILED: {
        "label": "Interview Failed",
        "icon": "📵",
        "color": "red",
        "description": "Call could not be completed"
    },
    CandidateStage.INTERVIEW_NO_SHOW: {
        "label": "No Show",
        "icon": "🚫",
        "color": "red",
        "description": "Candidate didn't answer"
    },
    CandidateStage.EVALUATING: {
        "label": "Evaluating...",
        "icon": "🧠",
        "color": "cyan",
        "description": "Generating assessment"
    },
    CandidateStage.EVALUATED: {
        "label": "Evaluation Ready",
        "icon": "📊",
        "color": "cyan",
        "description": "Assessment complete"
    },
    CandidateStage.OFFER_PENDING: {
        "label": "Preparing Offer",
        "icon": "📝",
        "color": "emerald",
        "description": "Offer being prepared"
    },
    CandidateStage.OFFER_SENT: {
        "label": "Offer Sent",
        "icon": "💌",
        "color": "emerald",
        "description": "Offer sent to candidate"
    },
    CandidateStage.OFFER_ACCEPTED: {
        "label": "Offer Accepted",
        "icon": "🎉",
        "color": "emerald",
        "description": "Candidate accepted offer"
    },
    CandidateStage.OFFER_REJECTED: {
        "label": "Offer Declined",
        "icon": "💔",
        "color": "red",
        "description": "Candidate declined offer"
    },
    CandidateStage.HIRED: {
        "label": "Hired",
        "icon": "🎉",
        "color": "emerald",
        "description": "Successfully hired"
    },
    CandidateStage.REJECTED: {
        "label": "Rejected",
        "icon": "❌",
        "color": "red",
        "description": "Not moving forward"
    },
    CandidateStage.WITHDRAWN: {
        "label": "Withdrawn",
        "icon": "🚪",
        "color": "gray",
        "description": "Candidate withdrew"
    },
    CandidateStage.ON_HOLD: {
        "label": "On Hold",
        "icon": "⏸️",
        "color": "gray",
        "description": "Pipeline paused"
    },
}


# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

def generate_pipeline_id() -> str:
    """Generate unique pipeline ID."""
    return f"pipe-{uuid.uuid4().hex[:12]}"


def generate_candidate_id() -> str:
    """Generate unique candidate ID."""
    return f"cand-{uuid.uuid4().hex[:12]}"


def generate_outreach_id() -> str:
    """Generate unique outreach ID."""
    return f"out-{uuid.uuid4().hex[:8]}"


def generate_scheduling_token() -> str:
    """Generate unique scheduling token for candidate."""
    return f"sched-{uuid.uuid4().hex[:16]}"


def get_current_timestamp() -> str:
    """Get current UTC timestamp as ISO string."""
    return datetime.utcnow().isoformat()


# ===================================================================
# SUB-MODELS
# ===================================================================

class StageHistoryEntry(BaseModel):
    """Record of a stage transition."""
    from_stage: str
    to_stage: str
    transitioned_at: str = Field(default_factory=get_current_timestamp)
    triggered_by: str = "system"  # "system" | "user" | "candidate"
    notes: Optional[str] = None


class ContactInfo(BaseModel):
    """Contact information for a candidate."""
    email: Optional[str] = None
    email_verified: bool = False
    email_source: Optional[ContactFetchSource] = None
    email_fetched_at: Optional[str] = None
    
    phone: Optional[str] = None
    phone_verified: bool = False
    phone_source: Optional[ContactFetchSource] = None
    phone_fetched_at: Optional[str] = None
    
    # Alternative contacts
    secondary_email: Optional[str] = None
    secondary_phone: Optional[str] = None
    
    # Fetch errors
    email_fetch_error: Optional[str] = None
    phone_fetch_error: Optional[str] = None
    
    # Preferences
    preferred_contact_method: str = "email"  # email | phone | whatsapp
    best_time_to_contact: Optional[str] = None
    timezone: str = "Asia/Kolkata"


class ManualCandidateInput(BaseModel):
    """
    Data provided during manual candidate import.
    This captures additional info from CSV upload or manual entry.
    """
    # Required
    linkedin_url: str = Field(..., description="LinkedIn profile URL")
    
    # Resume
    resume_file_path: Optional[str] = Field(None, description="Path to uploaded resume")
    resume_file_name: Optional[str] = Field(None, description="Original filename")
    resume_text: Optional[str] = Field(None, description="Extracted resume text")
    resume_parsed_data: Optional[Dict[str, Any]] = Field(None, description="Parsed resume data")
    
    # Candidate-provided info
    expected_salary: Optional[str] = Field(None, description="Expected CTC")
    current_salary: Optional[str] = Field(None, description="Current CTC")
    notice_period: Optional[str] = Field(None, description="Notice period (e.g., '30 days')")
    preferred_location: Optional[str] = Field(None, description="Preferred work location")
    willing_to_relocate: Optional[bool] = Field(None, description="Open to relocation")
    
    # Additional context
    source_notes: Optional[str] = Field(None, description="How candidate was found")
    referrer_name: Optional[str] = Field(None, description="Who referred them")
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="Any custom data")
    
    # Timestamps
    imported_at: str = Field(default_factory=get_current_timestamp)


class OutreachEmailRecord(BaseModel):
    """Record of a single outreach email."""
    email_id: str = Field(default_factory=lambda: f"email-{uuid.uuid4().hex[:8]}")
    email_type: OutreachType
    
    # Content
    subject: str
    body_plain: str
    body_html: Optional[str] = None
    
    # Tracking
    status: OutreachStatus = OutreachStatus.PENDING
    
    # Timestamps
    created_at: str = Field(default_factory=get_current_timestamp)
    queued_at: Optional[str] = None
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    opened_at: Optional[str] = None
    clicked_at: Optional[str] = None
    replied_at: Optional[str] = None
    
    # Delivery info
    message_id: Optional[str] = None  # From email provider
    error_message: Optional[str] = None
    bounce_type: Optional[str] = None  # hard | soft


class OutreachRecord(BaseModel):
    """
    Complete outreach tracking for a candidate.
    Includes scheduling link and all emails sent.
    """
    outreach_id: str = Field(default_factory=generate_outreach_id)
    
    # Scheduling
    scheduling_token: str = Field(default_factory=generate_scheduling_token)
    scheduling_link: str = ""  # Will be set by service
    scheduling_link_expires_at: Optional[str] = None
    
    # Emails sent
    emails: List[OutreachEmailRecord] = Field(default_factory=list)
    
    # Summary status
    initial_email_sent_at: Optional[str] = None
    reminder_count: int = 0
    last_reminder_sent_at: Optional[str] = None
    
    # Engagement tracking
    total_opens: int = 0
    total_clicks: int = 0
    first_opened_at: Optional[str] = None
    first_clicked_at: Optional[str] = None
    
    # Response
    candidate_responded: bool = False
    response_received_at: Optional[str] = None
    response_type: Optional[str] = None  # "scheduled" | "replied" | "declined"
    
    # Settings
    max_reminders: int = 2
    reminder_interval_hours: int = 24
    
    # Timestamps
    created_at: str = Field(default_factory=get_current_timestamp)
    updated_at: str = Field(default_factory=get_current_timestamp)
    
    def add_email(self, email: OutreachEmailRecord):
        """Add an email to the outreach record."""
        self.emails.append(email)
        self.updated_at = get_current_timestamp()
        
        if email.email_type == OutreachType.INITIAL and email.sent_at:
            self.initial_email_sent_at = email.sent_at
        elif email.email_type == OutreachType.REMINDER and email.sent_at:
            self.reminder_count += 1
            self.last_reminder_sent_at = email.sent_at


class InterviewTrackingInfo(BaseModel):
    """Interview-related tracking for a candidate."""
    # Schedule
    scheduled_datetime: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    duration_minutes: int = 30
    
    # Interview session
    interview_session_id: Optional[str] = None  # From VapiInterviewService
    interview_plan_id: Optional[str] = None
    
    # Call tracking
    call_initiated_at: Optional[str] = None
    call_answered_at: Optional[str] = None
    call_ended_at: Optional[str] = None
    call_duration_seconds: Optional[float] = None
    call_end_reason: Optional[str] = None
    
    # Recording
    recording_url: Optional[str] = None
    transcript_available: bool = False
    
    # Assessment
    assessment_ready: bool = False
    assessment_data: Optional[Dict[str, Any]] = None
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None  # strong_hire | hire | maybe | no_hire
    
    # Reschedule tracking
    reschedule_count: int = 0
    reschedule_reason: Optional[str] = None
    original_scheduled_datetime: Optional[str] = None


class EnrichmentSummary(BaseModel):
    """Summary of enrichment data for a candidate."""
    is_enriched: bool = False
    enriched_at: Optional[str] = None
    enrichment_source: Optional[str] = None  # "deep_dive" | "basic"
    
    # Match analysis
    match_score: Optional[float] = None
    match_label: Optional[str] = None  # "Excellent" | "Great" | "Good" | "Fair"
    top_strengths: List[str] = Field(default_factory=list)
    concerns: List[str] = Field(default_factory=list)
    
    # Key insights
    verified_skills: List[str] = Field(default_factory=list)
    experience_summary: Optional[str] = None
    salary_estimate: Optional[Dict[str, Any]] = None
    notice_period_estimate: Optional[Dict[str, Any]] = None
    response_likelihood: Optional[Dict[str, Any]] = None
    
    # Full enrichment data reference
    enrichment_result_id: Optional[str] = None
    full_enrichment_data: Optional[Dict[str, Any]] = None
    
    # Errors
    enrichment_error: Optional[str] = None
    
    @field_validator('concerns', 'top_strengths', mode='before')
    @classmethod
    def normalize_list_items(cls, v):
        """Fixes data where strings were saved as dicts (e.g. {'concern': '...'})"""
        if not v:
            return []
        
        normalized = []
        for item in v:
            if isinstance(item, dict):
                # Extract text from common keys or just take the first value
                if 'concern' in item:
                    normalized.append(str(item['concern']))
                elif 'strength' in item:
                    normalized.append(str(item['strength']))
                else:
                    # Fallback: grab the first available value
                    normalized.append(str(next(iter(item.values()), "")))
            else:
                normalized.append(str(item))
        return normalized


# ===================================================================
# MAIN MODELS
# ===================================================================

class PipelineCandidate(BaseModel):
    """
    A candidate within the recruitment pipeline.
    
    This is the core model that tracks a candidate's journey
    from sourcing through hiring.
    """
    # Identity
    candidate_id: str = Field(default_factory=generate_candidate_id)
    
    # Source references
    profile_id: Optional[str] = Field(None, description="MongoDB _id from profiles collection")
    linkedin_url: str = Field(..., description="LinkedIn profile URL")
    linkedin_id: Optional[str] = Field(None, description="LinkedIn member ID")
    
    # Manual import data (if applicable)
    manual_input: Optional[ManualCandidateInput] = None
    
    # Basic info (populated from search or scrape)
    name: str = Field(default="", description="Full name")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    headline: Optional[str] = Field(None, description="LinkedIn headline")
    current_title: Optional[str] = Field(None, description="Current job title")
    current_company: Optional[str] = Field(None, description="Current company")
    location: Optional[str] = Field(None, description="Location")
    experience_years: Optional[float] = Field(None, description="Total years of experience")
    skills: List[str] = Field(default_factory=list, description="Key skills")
    profile_picture_url: Optional[str] = None
    
    # Contact information
    contact: ContactInfo = Field(default_factory=ContactInfo)
    
    # Pipeline stage
    stage: CandidateStage = Field(default=CandidateStage.SOURCED)
    stage_updated_at: str = Field(default_factory=get_current_timestamp)
    stage_history: List[StageHistoryEntry] = Field(default_factory=list)
    
    # Enrichment summary
    enrichment: EnrichmentSummary = Field(default_factory=EnrichmentSummary)
    
    # Outreach tracking
    outreach: Optional[OutreachRecord] = None
    
    # Interview tracking
    interview: InterviewTrackingInfo = Field(default_factory=InterviewTrackingInfo)
    
    # Final outcome
    final_decision: Optional[str] = None  # "hired" | "rejected" | "withdrawn"
    final_decision_at: Optional[str] = None
    final_decision_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    rejection_feedback: Optional[str] = None
    
    # Notes and tags
    recruiter_notes: List[Dict[str, Any]] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    is_favorite: bool = False
    priority: int = 0  # 0=normal, 1=high, 2=urgent
    
    # Timestamps
    added_at: str = Field(default_factory=get_current_timestamp)
    updated_at: str = Field(default_factory=get_current_timestamp)
    
    # Soft delete
    is_removed: bool = False
    removed_at: Optional[str] = None
    removed_reason: Optional[str] = None
    
    # Validators
    @field_validator('linkedin_url')
    @classmethod
    def normalize_linkedin_url(cls, v: str) -> str:
        """Normalize LinkedIn URL to standard format."""
        import re
        v = v.strip()
        
        if not v:
            return v
        
        # If already a complete URL
        if v.startswith("http://") or v.startswith("https://"):
            v = re.sub(r"/in/--+", "/in/", v)
            v = re.sub(r"--+/", "/", v)
            return v.rstrip("/") + "/"
        
        # Partial URL
        v = v.lstrip("/")
        v = re.sub(r"in/--+", "in/", v)
        v = re.sub(r"--+/", "/", v)
        
        if not v.startswith("in/"):
            if "linkedin.com/in/" in v:
                v = v.split("linkedin.com/in/")[-1]
            v = f"in/{v}"
        
        full_url = f"https://www.linkedin.com/{v}"
        return full_url.rstrip("/") + "/"
    
    def update_stage(
        self,
        new_stage: CandidateStage,
        triggered_by: str = "system",
        notes: Optional[str] = None
    ):
        """Update candidate stage with history tracking."""
        if new_stage == self.stage:
            return
        
        # Add to history
        history_entry = StageHistoryEntry(
            from_stage=self.stage.value,
            to_stage=new_stage.value,
            triggered_by=triggered_by,
            notes=notes
        )
        self.stage_history.append(history_entry)
        
        # Update stage
        self.stage = new_stage
        self.stage_updated_at = get_current_timestamp()
        self.updated_at = get_current_timestamp()
    
    def add_note(self, note: str, author: str):
        """Add a recruiter note."""
        self.recruiter_notes.append({
            "note": note,
            "author": author,
            "created_at": get_current_timestamp()
        })
        self.updated_at = get_current_timestamp()
    
    def get_stage_metadata(self) -> Dict[str, Any]:
        """Get UI metadata for current stage."""
        return STAGE_METADATA.get(self.stage, {
            "label": self.stage.value,
            "icon": "•",
            "color": "gray",
            "description": ""
        })
    
    # ADD THIS VALIDATOR BLOCK TEMPORARILY
    @field_validator('outreach', mode='before')
    @classmethod
    def debug_outreach_validation(cls, v):
        if v is None:
            return v
            
        # If it's already a model, return it
        if isinstance(v, OutreachRecord):
            return v
            
        # If it's a dict (from Mongo), try to validate it manually to see the error
        try:
            OutreachRecord(**v)
        except ValidationError as e:
            print("------------ OUTREACH VALIDATION FAILED ------------")
            print(f"Data causing error: {v}")
            print("Specific Validation Errors:")
            print(e.json())
            print("----------------------------------------------------")
            # We explicitly return None so the app doesn't crash, 
            # but now you will see the error in your server logs.
            return None
            
        return v    

    @property
    def display_name(self) -> str:
        """Get display name, falling back to various sources."""
        if self.name:
            return self.name
        if self.first_name or self.last_name:
            return f"{self.first_name or ''} {self.last_name or ''}".strip()
        return "Unknown Candidate"
    
    @property
    def primary_email(self) -> Optional[str]:
        """Get primary contact email."""
        return self.contact.email
    
    @property
    def primary_phone(self) -> Optional[str]:
        """Get primary contact phone."""
        return self.contact.phone


class JobContext(BaseModel):
    """
    Job description and requirements context for the pipeline.
    This defines what we're hiring for.
    """
    # Identity
    job_id: str = Field(default_factory=lambda: f"job-{uuid.uuid4().hex[:8]}")
    
    # Basic info
    job_title: str = Field(..., description="Job title")
    company_name: Optional[str] = Field(None, description="Hiring company")
    department: Optional[str] = None
    
    # Requirements
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    experience_required: Optional[str] = Field(None, description="e.g., '5+ years'")
    experience_min_years: Optional[int] = None
    experience_max_years: Optional[int] = None
    education_requirements: List[str] = Field(default_factory=list)
    
    # Location
    location_requirements: List[str] = Field(default_factory=list)
    remote_policy: str = "hybrid"  # remote | hybrid | onsite
    willing_to_relocate_required: bool = False
    
    # Compensation
    salary_range_min: Optional[int] = None
    salary_range_max: Optional[int] = None
    salary_currency: str = "INR"
    
    # Full JD
    jd_text: Optional[str] = Field(None, description="Full job description text")
    jd_file_path: Optional[str] = None
    jd_parsed_at: Optional[str] = None
    
    # Interview configuration
    interview_focus_areas: List[str] = Field(default_factory=list)
    key_evaluation_criteria: List[str] = Field(default_factory=list)
    custom_interview_questions: List[str] = Field(default_factory=list)
    interview_duration_minutes: int = 30
    
    # Metadata
    created_at: str = Field(default_factory=get_current_timestamp)
    updated_at: str = Field(default_factory=get_current_timestamp)
    
    def get_jd_summary(self) -> str:
        """Get a summary of the JD for prompts."""
        parts = [
            f"Job Title: {self.job_title}",
            f"Company: {self.company_name or 'Our client'}",
        ]
        
        if self.required_skills:
            parts.append(f"Required Skills: {', '.join(self.required_skills)}")
        
        if self.nice_to_have_skills:
            parts.append(f"Nice to Have: {', '.join(self.nice_to_have_skills)}")
        
        if self.experience_required:
            parts.append(f"Experience: {self.experience_required}")
        
        if self.location_requirements:
            parts.append(f"Location: {', '.join(self.location_requirements)}")
        
        return "\n".join(parts)


class PipelineSettings(BaseModel):
    """Configuration settings for a pipeline."""
    # Outreach settings
    auto_send_outreach: bool = False  # Auto-send after enrichment
    outreach_delay_hours: int = 0  # Wait before sending
    reminder_delay_hours: int = 24  # Wait before reminder
    max_reminders: int = 1
    no_response_timeout_hours: int = 72  # Mark as no-response after
    
    # Interview settings
    interview_auto_trigger: bool = True  # Auto-trigger at scheduled time
    interview_reminder_hours: int = 2  # Remind candidate before interview
    
    # Enrichment settings
    auto_enrich_on_shortlist: bool = True
    enrichment_depth: str = "deep"  # basic | deep
    
    # Notification settings
    notify_on_response: bool = True
    notify_on_schedule: bool = True
    notify_on_interview_complete: bool = True
    notification_email: Optional[str] = None
    
    # Scheduling settings
    scheduling_link_expiry_days: int = 7
    available_time_slots: List[str] = Field(default_factory=list)  # e.g., ["10:00-12:00", "14:00-17:00"]
    timezone: str = "Asia/Kolkata"


class PipelineStats(BaseModel):
    """Aggregated statistics for a pipeline."""
    total_sourced: int = 0
    total_shortlisted: int = 0
    total_enriched: int = 0
    total_contacted: int = 0
    total_opened: int = 0  # Email opens
    total_clicked: int = 0  # Link clicks
    total_responded: int = 0
    total_scheduled: int = 0
    total_interviewed: int = 0
    total_evaluated: int = 0
    total_offers: int = 0
    total_hired: int = 0
    total_rejected: int = 0
    total_withdrawn: int = 0
    total_no_response: int = 0
    
    # Rates
    response_rate: float = 0.0  # responded / contacted
    schedule_rate: float = 0.0  # scheduled / responded
    interview_completion_rate: float = 0.0  # completed / scheduled
    offer_rate: float = 0.0  # offers / interviewed
    acceptance_rate: float = 0.0  # hired / offers
    
    # Last updated
    calculated_at: str = Field(default_factory=get_current_timestamp)
    
    def recalculate(self, candidates: List[PipelineCandidate]):
        """Recalculate stats from candidate list."""
        self.total_sourced = len(candidates)
        self.total_shortlisted = sum(1 for c in candidates if c.stage.value not in ["sourced"])
        self.total_enriched = sum(1 for c in candidates if c.enrichment.is_enriched)
        self.total_contacted = sum(1 for c in candidates if c.outreach and c.outreach.initial_email_sent_at)
        self.total_opened = sum(1 for c in candidates if c.outreach and c.outreach.total_opens > 0)
        self.total_clicked = sum(1 for c in candidates if c.outreach and c.outreach.total_clicks > 0)
        self.total_responded = sum(1 for c in candidates if c.outreach and c.outreach.candidate_responded)
        self.total_scheduled = sum(1 for c in candidates if c.interview.scheduled_datetime)
        self.total_interviewed = sum(1 for c in candidates if c.stage in [
            CandidateStage.INTERVIEW_COMPLETED, CandidateStage.EVALUATING,
            CandidateStage.EVALUATED, CandidateStage.OFFER_PENDING,
            CandidateStage.OFFER_SENT, CandidateStage.OFFER_ACCEPTED,
            CandidateStage.HIRED
        ])
        self.total_evaluated = sum(1 for c in candidates if c.interview.assessment_ready)
        self.total_offers = sum(1 for c in candidates if c.stage in [
            CandidateStage.OFFER_SENT, CandidateStage.OFFER_ACCEPTED,
            CandidateStage.OFFER_REJECTED, CandidateStage.HIRED
        ])
        self.total_hired = sum(1 for c in candidates if c.stage == CandidateStage.HIRED)
        self.total_rejected = sum(1 for c in candidates if c.stage == CandidateStage.REJECTED)
        self.total_withdrawn = sum(1 for c in candidates if c.stage == CandidateStage.WITHDRAWN)
        self.total_no_response = sum(1 for c in candidates if c.stage == CandidateStage.NO_RESPONSE)
        
        # Calculate rates
        if self.total_contacted > 0:
            self.response_rate = round(self.total_responded / self.total_contacted * 100, 1)
        if self.total_responded > 0:
            self.schedule_rate = round(self.total_scheduled / self.total_responded * 100, 1)
        if self.total_scheduled > 0:
            self.interview_completion_rate = round(self.total_interviewed / self.total_scheduled * 100, 1)
        if self.total_interviewed > 0:
            self.offer_rate = round(self.total_offers / self.total_interviewed * 100, 1)
        if self.total_offers > 0:
            self.acceptance_rate = round(self.total_hired / self.total_offers * 100, 1)
        
        self.calculated_at = get_current_timestamp()


class RecruitmentPipeline(BaseModel):
    """
    Main recruitment pipeline document.
    
    This is the top-level model that contains:
    - Job requirements
    - All candidates
    - Pipeline settings
    - Statistics
    
    One pipeline = One job/search = Many candidates
    """
    # Identity
    pipeline_id: str = Field(default_factory=generate_pipeline_id)
    
    # Ownership
    username: str = Field(..., description="User who created the pipeline")
    organization_id: Optional[str] = None  # For multi-tenant
    
    # Pipeline name/title
    name: Optional[str] = Field(None, description="Custom pipeline name")
    description: Optional[str] = None
    
    # Source tracking
    source: PipelineSource = Field(default=PipelineSource.DONNA_SEARCH)
    conversation_session_id: str  # Link back to Donna conversation
    search_session_id: Optional[str] = None  # Linked search results
    
    # Job context
    job: JobContext
    
    # Candidates
    candidates: List[PipelineCandidate] = Field(default_factory=list)
    
    # Settings
    settings: PipelineSettings = Field(default_factory=PipelineSettings)
    
    # Statistics
    stats: PipelineStats = Field(default_factory=PipelineStats)
    
    # Status
    is_active: bool = True
    status: str = "active"  # active | paused | completed | archived
    
    # Timestamps
    created_at: str = Field(default_factory=get_current_timestamp)
    updated_at: str = Field(default_factory=get_current_timestamp)
    archived_at: Optional[str] = None
    
    def get_stage_label(self) -> str:
        """Get friendly stage label."""
        return STAGE_METADATA.get(self.candidate.stage, {}).get("label", self.candidate.stage.value)
    
    @property
    def candidate(self) -> Optional[PipelineCandidate]:
        """Get the single candidate (for single-candidate pipelines)."""
        return self.candidates[0] if self.candidates else None
    
    @property
    def display_name(self) -> str:
        """Get display name for the pipeline."""
        if self.name:
            return self.name
        return f"{self.job.job_title} Pipeline"
    
    # Methods
    def add_candidate(self, candidate: PipelineCandidate) -> PipelineCandidate:
        """Add a candidate to the pipeline."""
        self.candidates.append(candidate)
        self.updated_at = get_current_timestamp()
        self.stats.recalculate(self.candidates)
        return candidate
    
    def get_candidate(self, candidate_id: str) -> Optional[PipelineCandidate]:
        """Get a candidate by ID."""
        for c in self.candidates:
            if c.candidate_id == candidate_id:
                return c
        return None
    
    def update_candidate(self, candidate: PipelineCandidate):
        """Update a candidate in the pipeline."""
        for i, c in enumerate(self.candidates):
            if c.candidate_id == candidate.candidate_id:
                self.candidates[i] = candidate
                self.updated_at = get_current_timestamp()
                self.stats.recalculate(self.candidates)
                return
    
    def get_candidates_by_stage(self, stage: CandidateStage) -> List[PipelineCandidate]:
        """Get all candidates in a specific stage."""
        return [c for c in self.candidates if c.stage == stage and not c.is_removed]
    
    def get_active_candidates(self) -> List[PipelineCandidate]:
        """Get all non-removed candidates."""
        return [c for c in self.candidates if not c.is_removed]
    
    def recalculate_stats(self):
        """Recalculate pipeline statistics."""
        self.stats.recalculate(self.get_active_candidates())
        
    
    @property
    def display_name(self) -> str:
        """Get display name for the pipeline."""
        if self.name:
            return self.name
        return f"{self.job.job_title} Pipeline"


# ===================================================================
# API REQUEST/RESPONSE MODELS 
# ===================================================================

class CreatePipelineFromSearchRequest(BaseModel):
    """Request to create pipeline from Donna search."""
    conversation_session_id: str = Field(..., description="Donna conversation session ID")
    search_session_id: str = Field(..., description="Search results session ID")
    pipeline_name: Optional[str] = None
    auto_shortlist_all: bool = False


class CreatePipelineFromImportRequest(BaseModel):
    """Request to create pipeline from manual import."""
    jd_text: str = Field(..., min_length=50, description="Job description text")
    candidates_csv: str = Field(..., description="CSV content with candidates")
    pipeline_name: Optional[str] = None


class CreatePipelineResponse(BaseModel):
    """Response when creating a pipeline."""
    success: bool
    pipeline_id: str
    total_candidates: int
    message: str
    warnings: List[str] = Field(default_factory=list)


class ShortlistCandidatesRequest(BaseModel):
    """Request to shortlist candidates."""
    candidate_ids: List[str] = Field(..., min_length=1)


class StartEnrichmentRequest(BaseModel):
    """Request to start enrichment."""
    candidate_ids: Optional[List[str]] = None  # None = all shortlisted


class StartOutreachRequest(BaseModel):
    """Request to start outreach."""
    candidate_ids: Optional[List[str]] = None  # None = all enriched with email


class UpdateCandidateStageRequest(BaseModel):
    """Request to manually update candidate stage."""
    new_stage: CandidateStage
    notes: Optional[str] = None


class AddCandidateNoteRequest(BaseModel):
    """Request to add a note to a candidate."""
    note: str = Field(..., min_length=1)


class PipelineDashboardResponse(BaseModel):
    """Response for pipeline dashboard."""
    pipeline_id: str
    name: str
    job_title: str
    company_name: Optional[str]
    source: str
    status: str
    created_at: str
    
    stats: PipelineStats
    candidates: List[Dict[str, Any]]  # Simplified candidate data for UI
    stage_distribution: Dict[str, int]
    
    # Visual pipeline stages
    stages: List[Dict[str, Any]]


class CandidateDetailResponse(BaseModel):
    """Detailed candidate response."""
    candidate: PipelineCandidate
    stage_metadata: Dict[str, Any]
    job_context: JobContext
    timeline: List[Dict[str, Any]]  # Stage history + events
    
class AddCandidateToPipelineRequest(BaseModel):
    linkedin_url: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    expected_salary: Optional[str] = None
    notice_period: Optional[str] = None
    notes: Optional[str] = None


# ===================================================================
# EXPORT
# ===================================================================

__all__ = [
    # Enums
    "PipelineSource",
    "CandidateStage",
    "OutreachStatus",
    "OutreachType",
    "ContactFetchSource",
    
    # Metadata
    "STAGE_METADATA",
    
    # Helper functions
    "generate_pipeline_id",
    "generate_candidate_id",
    "generate_outreach_id",
    "generate_scheduling_token",
    "get_current_timestamp",
    
    # Sub-models
    "StageHistoryEntry",
    "ContactInfo",
    "ManualCandidateInput",
    "OutreachEmailRecord",
    "OutreachRecord",
    "InterviewTrackingInfo",
    "EnrichmentSummary",
    
    # Main models
    "PipelineCandidate",
    "JobContext",
    "PipelineSettings",
    "PipelineStats",
    "RecruitmentPipeline",
    
    # API models
    "CreatePipelineFromSearchRequest",
    "CreatePipelineFromImportRequest",
    "CreatePipelineResponse",
    "ShortlistCandidatesRequest",
    "StartEnrichmentRequest",
    "StartOutreachRequest",
    "UpdateCandidateStageRequest",
    "AddCandidateNoteRequest",
    "PipelineDashboardResponse",
    "CandidateDetailResponse",
    "AddCandidateToPipelineRequest"
]