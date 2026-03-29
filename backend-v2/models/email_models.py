"""
Email Models
============
Pydantic models for email templates and outreach.

Author: Hire-X Engineering
Version: 2.0
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ===================================================================
# ENUMS
# ===================================================================

class EmailTemplateType(str, Enum):
    """Type of email template."""
    INITIAL_OUTREACH = "initial_outreach"
    REMINDER = "reminder"
    SECOND_REMINDER = "second_reminder"
    BOOKING_CONFIRMATION = "booking_confirmation"
    INTERVIEW_REMINDER = "interview_reminder"
    RESCHEDULE_CONFIRMATION = "reschedule_confirmation"
    CANCELLATION = "cancellation"
    POST_INTERVIEW = "post_interview"
    REJECTION = "rejection"
    OFFER = "offer"
    CUSTOM = "custom"


class EmailProviderStatus(str, Enum):
    """Status from email provider."""
    ACCEPTED = "accepted"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    CLICKED = "clicked"
    BOUNCED = "bounced"
    DROPPED = "dropped"
    SPAM_REPORT = "spam_report"
    UNSUBSCRIBED = "unsubscribed"
    FAILED = "failed"


# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

def generate_template_id() -> str:
    """Generate unique template ID."""
    return f"tmpl-{uuid.uuid4().hex[:8]}"


def generate_email_id() -> str:
    """Generate unique email ID."""
    return f"email-{uuid.uuid4().hex[:10]}"


def get_current_timestamp() -> str:
    """Get current UTC timestamp."""
    return datetime.utcnow().isoformat()


# ===================================================================
# TEMPLATE MODELS
# ===================================================================

class EmailPlaceholder(BaseModel):
    """Definition of a placeholder in an email template."""
    key: str = Field(..., description="Placeholder key (e.g., 'candidate_name')")
    description: str = Field(..., description="What this placeholder represents")
    example: str = Field(..., description="Example value")
    required: bool = True
    default_value: Optional[str] = None


class EmailTemplate(BaseModel):
    """
    Email template for outreach.
    
    Supports placeholders like {candidate_name}, {job_title}, etc.
    """
    # Identity
    template_id: str = Field(default_factory=generate_template_id)
    
    # Ownership
    username: str  # "system" for default templates
    organization_id: Optional[str] = None
    
    # Template info
    name: str = Field(..., description="Template name")
    description: Optional[str] = None
    template_type: EmailTemplateType
    
    # Content
    subject_template: str = Field(..., description="Email subject with placeholders")
    body_template: str = Field(..., description="Plain text body with placeholders")
    body_html_template: Optional[str] = Field(None, description="HTML body with placeholders")
    
    # Placeholders
    placeholders: List[EmailPlaceholder] = Field(default_factory=list)
    
    # Settings
    is_active: bool = True
    is_default: bool = False
    
    # Stats
    times_used: int = 0
    total_opens: int = 0
    total_clicks: int = 0
    open_rate: Optional[float] = None  # Calculated
    click_rate: Optional[float] = None  # Calculated
    
    # Timestamps
    created_at: str = Field(default_factory=get_current_timestamp)
    updated_at: str = Field(default_factory=get_current_timestamp)
    
    def render(self, context: Dict[str, Any]) -> Dict[str, str]:
        """
        Render template with context.
        
        Args:
            context: Dict with placeholder values
            
        Returns:
            Dict with rendered subject, body, body_html
        """
        subject = self.subject_template
        body = self.body_template
        body_html = self.body_html_template or ""
        
        for placeholder in self.placeholders:
            key = placeholder.key
            value = context.get(key, placeholder.default_value or f"[{key}]")
            
            subject = subject.replace(f"{{{key}}}", str(value))
            body = body.replace(f"{{{key}}}", str(value))
            body_html = body_html.replace(f"{{{key}}}", str(value))
        
        return {
            "subject": subject,
            "body": body,
            "body_html": body_html
        }
    
    def validate_context(self, context: Dict[str, Any]) -> List[str]:
        """
        Validate that all required placeholders have values.
        
        Returns:
            List of missing placeholder keys
        """
        missing = []
        for placeholder in self.placeholders:
            if placeholder.required:
                if placeholder.key not in context or not context[placeholder.key]:
                    if not placeholder.default_value:
                        missing.append(placeholder.key)
        return missing


# ===================================================================
# EMAIL RECORD MODELS
# ===================================================================

class EmailRecipient(BaseModel):
    """Email recipient info."""
    email: str
    name: Optional[str] = None
    type: str = "to"  # to | cc | bcc


class EmailAttachment(BaseModel):
    """Email attachment info."""
    filename: str
    content_type: str
    size_bytes: int
    file_path: Optional[str] = None
    content_base64: Optional[str] = None


class EmailTrackingEvent(BaseModel):
    """Tracking event from email provider."""
    event_type: EmailProviderStatus
    timestamp: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    location: Optional[str] = None
    link_url: Optional[str] = None  # For click events


class SentEmail(BaseModel):
    """
    Record of a sent email.
    
    Tracks delivery and engagement.
    """
    # Identity
    email_id: str = Field(default_factory=generate_email_id)
    
    # Links
    pipeline_id: Optional[str] = None
    candidate_id: Optional[str] = None
    outreach_id: Optional[str] = None
    template_id: Optional[str] = None
    
    # Recipients
    from_email: str
    from_name: Optional[str] = None
    recipients: List[EmailRecipient]
    reply_to: Optional[str] = None
    
    # Content
    subject: str
    body_plain: str
    body_html: Optional[str] = None
    
    # Attachments
    attachments: List[EmailAttachment] = Field(default_factory=list)
    
    # Provider info
    provider: str = "sendgrid"  # sendgrid | mailgun | ses | smtp
    provider_message_id: Optional[str] = None
    
    # Status
    status: EmailProviderStatus = EmailProviderStatus.QUEUED
    
    # Tracking
    tracking_events: List[EmailTrackingEvent] = Field(default_factory=list)
    
    # Timestamps
    created_at: str = Field(default_factory=get_current_timestamp)
    queued_at: Optional[str] = None
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    first_opened_at: Optional[str] = None
    first_clicked_at: Optional[str] = None
    
    # Errors
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    bounce_type: Optional[str] = None  # hard | soft
    
    # Stats
    open_count: int = 0
    click_count: int = 0
    
    def add_tracking_event(self, event: EmailTrackingEvent):
        """Add a tracking event."""
        self.tracking_events.append(event)
        
        # Update status and timestamps
        if event.event_type == EmailProviderStatus.DELIVERED:
            self.status = EmailProviderStatus.DELIVERED
            if not self.delivered_at:
                self.delivered_at = event.timestamp
                
        elif event.event_type == EmailProviderStatus.OPENED:
            self.status = EmailProviderStatus.OPENED
            self.open_count += 1
            if not self.first_opened_at:
                self.first_opened_at = event.timestamp
                
        elif event.event_type == EmailProviderStatus.CLICKED:
            self.status = EmailProviderStatus.CLICKED
            self.click_count += 1
            if not self.first_clicked_at:
                self.first_clicked_at = event.timestamp
                
        elif event.event_type == EmailProviderStatus.BOUNCED:
            self.status = EmailProviderStatus.BOUNCED
            
        elif event.event_type == EmailProviderStatus.SPAM_REPORT:
            self.status = EmailProviderStatus.SPAM_REPORT


# ===================================================================
# AI-GENERATED EMAIL MODELS
# ===================================================================

class GeneratedEmailContent(BaseModel):
    """AI-generated email content."""
    subject: str
    body_plain: str
    body_html: str
    
    # Personalization info
    personalization_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="How personalized (0=template, 1=fully custom)"
    )
    
    # Generation metadata
    model_used: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    generation_time_ms: Optional[int] = None
    generated_at: str = Field(default_factory=get_current_timestamp)


class GenerateOutreachEmailRequest(BaseModel):
    """Request to generate an outreach email."""
    # Candidate info
    candidate_name: str
    candidate_title: Optional[str] = None
    candidate_company: Optional[str] = None
    candidate_skills: List[str] = Field(default_factory=list)
    
    # Job info
    job_title: str
    company_name: Optional[str] = None
    job_highlights: List[str] = Field(default_factory=list)
    
    # Match info
    fit_reasons: List[str] = Field(default_factory=list)
    match_score: Optional[float] = None
    
    # CTA
    scheduling_link: str
    
    # Style preferences
    tone: str = "warm_professional"  # warm_professional | casual | formal
    max_words: int = 150
    
    # Template to base on (optional)
    base_template_id: Optional[str] = None


class GenerateOutreachEmailResponse(BaseModel):
    """Response with generated email."""
    success: bool
    content: Optional[GeneratedEmailContent] = None
    error: Optional[str] = None


# ===================================================================
# DEFAULT TEMPLATES
# ===================================================================

def get_default_templates() -> List[EmailTemplate]:
    """Get default system email templates."""
    
    # Common placeholders
    common_placeholders = [
        EmailPlaceholder(
            key="candidate_name",
            description="Candidate's full name",
            example="John Doe",
            required=True
        ),
        EmailPlaceholder(
            key="candidate_first_name",
            description="Candidate's first name",
            example="John",
            required=True
        ),
        EmailPlaceholder(
            key="job_title",
            description="Job title",
            example="Senior Software Engineer",
            required=True
        ),
        EmailPlaceholder(
            key="company_name",
            description="Hiring company name",
            example="TechCorp",
            required=False,
            default_value="our company"
        ),
        EmailPlaceholder(
            key="scheduling_link",
            description="Link to schedule interview",
            example="https://Hire-X.shop/schedule/abc123",
            required=True
        ),
    ]
    
    return [
        # Initial Outreach
        EmailTemplate(
            template_id="tmpl-default-initial",
            username="system",
            name="Default Initial Outreach",
            description="First contact email to candidates",
            template_type=EmailTemplateType.INITIAL_OUTREACH,
            subject_template="Quick question about {job_title} role",
            body_template="""Hi {candidate_first_name},

I came across your profile and was impressed by your background.

We're looking for a {job_title} at {company_name} and I think you could be a great fit.

Would you be open to a quick chat? No pressure - just wanted to see if there might be mutual interest.

Here's a link to pick a time that works: {scheduling_link}

Best,
The Hire-X Team""",
            body_html_template="""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {candidate_first_name},</p>

<p>I came across your profile and was impressed by your background.</p>

<p>We're looking for a <strong>{job_title}</strong> at {company_name} and I think you could be a great fit.</p>

<p>Would you be open to a quick chat? No pressure - just wanted to see if there might be mutual interest.</p>

<p><a href="{scheduling_link}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Schedule a Chat →</a></p>

<p>Best,<br>The Hire-X Team</p>
</body>
</html>""",
            placeholders=common_placeholders,
            is_active=True,
            is_default=True
        ),
        
        # Reminder
        EmailTemplate(
            template_id="tmpl-default-reminder",
            username="system",
            name="Default Reminder",
            description="Follow-up reminder email",
            template_type=EmailTemplateType.REMINDER,
            subject_template="Quick follow-up: {job_title}",
            body_template="""Hi {candidate_first_name},

Just wanted to follow up on my earlier email about the {job_title} role.

I know you're probably busy, but if you're at all interested in exploring this, I'd love to chat.

Here's the link again: {scheduling_link}

Either way, hope you're doing well!

Best,
The Hire-X Team""",
            body_html_template="""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {candidate_first_name},</p>

<p>Just wanted to follow up on my earlier email about the <strong>{job_title}</strong> role.</p>

<p>I know you're probably busy, but if you're at all interested in exploring this, I'd love to chat.</p>

<p><a href="{scheduling_link}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Schedule a Chat →</a></p>

<p>Either way, hope you're doing well!</p>

<p>Best,<br>The Hire-X Team</p>
</body>
</html>""",
            placeholders=common_placeholders,
            is_active=True,
            is_default=True
        ),
        
        # Booking Confirmation
        EmailTemplate(
            template_id="tmpl-default-booking",
            username="system",
            name="Default Booking Confirmation",
            description="Confirmation email after booking",
            template_type=EmailTemplateType.BOOKING_CONFIRMATION,
            subject_template="Interview Confirmed: {job_title}",
            body_template="""Hi {candidate_first_name},

Great news - your interview is confirmed for:

📅 {interview_datetime}

You'll receive a call from our AI interviewer, Neura, at the scheduled time. The interview typically takes about 20-25 minutes.

A few tips:
- Find a quiet place with good phone reception
- Have your resume handy for reference
- Relax and be yourself!

If you need to reschedule, just reply to this email.

Looking forward to speaking with you!

Best,
The Hire-X Team""",
            body_html_template="""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {candidate_first_name},</p>

<p>Great news - your interview is confirmed!</p>

<div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
    <h2 style="margin: 0; color: #0369a1;">📅 {interview_datetime}</h2>
</div>

<p>You'll receive a call from our AI interviewer, <strong>Neura</strong>, at the scheduled time. The interview typically takes about 20-25 minutes.</p>

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <strong>A few tips:</strong>
    <ul>
        <li>Find a quiet place with good phone reception</li>
        <li>Have your resume handy for reference</li>
        <li>Relax and be yourself!</li>
    </ul>
</div>

<p>If you need to reschedule, just reply to this email.</p>

<p>Looking forward to speaking with you!</p>

<p>Best,<br>The Hire-X Team</p>
</body>
</html>""",
            placeholders=common_placeholders + [
                EmailPlaceholder(
                    key="interview_datetime",
                    description="Formatted interview date and time",
                    example="Tuesday, January 21 at 10:00 AM IST",
                    required=True
                )
            ],
            is_active=True,
            is_default=True
        ),
        
        # Interview Reminder
        EmailTemplate(
            template_id="tmpl-default-interview-reminder",
            username="system",
            name="Default Interview Reminder",
            description="Reminder before interview",
            template_type=EmailTemplateType.INTERVIEW_REMINDER,
            subject_template="Reminder: Interview in {hours_until} hours",
            body_template="""Hi {candidate_first_name},

Just a friendly reminder that your interview for the {job_title} role is coming up:

📅 {interview_datetime}

Make sure you're in a quiet place with good phone reception. You'll receive a call from Neura, our AI interviewer.

See you soon!

Best,
The Hire-X Team""",
            body_html_template="""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Hi {candidate_first_name},</p>

<p>Just a friendly reminder that your interview for the <strong>{job_title}</strong> role is coming up:</p>

<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
    <h2 style="margin: 0; color: #b45309;">📅 {interview_datetime}</h2>
</div>

<p>Make sure you're in a quiet place with good phone reception. You'll receive a call from <strong>Neura</strong>, our AI interviewer.</p>

<p>See you soon!</p>

<p>Best,<br>The Hire-X Team</p>
</body>
</html>""",
            placeholders=common_placeholders + [
                EmailPlaceholder(
                    key="interview_datetime",
                    description="Formatted interview date and time",
                    example="Tuesday, January 21 at 10:00 AM IST",
                    required=True
                ),
                EmailPlaceholder(
                    key="hours_until",
                    description="Hours until interview",
                    example="2",
                    required=True
                )
            ],
            is_active=True,
            is_default=True
        ),
    ]


# ===================================================================
# EXPORT
# ===================================================================

__all__ = [
    # Enums
    "EmailTemplateType",
    "EmailProviderStatus",
    
    # Helper functions
    "generate_template_id",
    "generate_email_id",
    "get_current_timestamp",
    "get_default_templates",
    
    # Template models
    "EmailPlaceholder",
    "EmailTemplate",
    
    # Email record models
    "EmailRecipient",
    "EmailAttachment",
    "EmailTrackingEvent",
    "SentEmail",
    
    # AI generation models
    "GeneratedEmailContent",
    "GenerateOutreachEmailRequest",
    "GenerateOutreachEmailResponse",
]