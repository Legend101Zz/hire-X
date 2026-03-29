"""
Interview Scheduling Models
===========================
Pydantic models for interview scheduling and booking.

Author: Hire-X Engineering
Version: 2.0
"""

import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

# ===================================================================
# ENUMS
# ===================================================================

class ScheduleStatus(str, Enum):
    """Status of an interview schedule."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REMINDER_SENT = "reminder_sent"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    NO_SHOW = "no_show"
    TECHNICAL_ISSUE = "technical_issue"
    EXPIRED = "expired"  # Added for old unconfirmed slots


class RescheduleReason(str, Enum):
    """Reason for rescheduling."""
    CANDIDATE_REQUEST = "candidate_request"
    INTERVIEWER_UNAVAILABLE = "interviewer_unavailable"
    TECHNICAL_ISSUE = "technical_issue"
    EMERGENCY = "emergency"
    OTHER = "other"


# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

def generate_schedule_id() -> str:
    """Generate unique schedule ID."""
    return f"sched-{uuid.uuid4().hex[:10]}"


def get_current_timestamp() -> str:
    """Get current UTC timestamp."""
    return datetime.utcnow().isoformat()


def get_slot_type_from_hour(hour: int) -> str:
    """Determine time of day category from hour."""
    if hour < 12:
        return "morning"
    elif hour < 17:
        return "afternoon"
    else:
        return "evening"


# ===================================================================
# SUB-MODELS
# ===================================================================

class TimeSlot(BaseModel):
    """Represents an available interview time slot."""
    slot_id: str = Field(default_factory=lambda: f"slot-{uuid.uuid4().hex[:8]}")
    
    # Date/Time components (for frontend display)
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    start_time: str = Field(..., description="Start time in HH:MM format")
    end_time: str = Field(..., description="End time in HH:MM format")
    
    # Full datetime (for backend logic)
    datetime: str = Field(..., description="Full datetime in ISO format")
    
    # Metadata
    timezone: str = Field(default="Asia/Kolkata")
    is_available: bool = Field(default=True, description="Whether slot can be booked")
    slot_type: str = Field(
        default="morning",
        description="Time of day: morning/afternoon/evening"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "slot_id": "slot-abc123",
                "date": "2024-12-15",
                "start_time": "14:00",
                "end_time": "14:30",
                "datetime": "2024-12-15T14:00:00Z",
                "timezone": "Asia/Kolkata",
                "is_available": True,
                "slot_type": "afternoon"
            }
        }


class AvailabilityWindow(BaseModel):
    """A window of availability (e.g., 10am-12pm on weekdays)."""
    window_id: str = Field(default_factory=lambda: f"win-{uuid.uuid4().hex[:8]}")
    
    # Time range
    start_time: str  # HH:MM format (e.g., "10:00")
    end_time: str    # HH:MM format (e.g., "12:00")
    
    # Days
    days_of_week: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])  # 0=Mon, 6=Sun
    
    # Duration
    slot_duration_minutes: int = 30
    buffer_minutes: int = 15
    
    # Active dates
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    
    # Status
    is_active: bool = True


class RescheduleRecord(BaseModel):
    """Record of a reschedule event."""
    reschedule_id: str = Field(default_factory=lambda: f"resched-{uuid.uuid4().hex[:8]}")
    
    # Times
    original_datetime: str
    new_datetime: str
    
    # Reason
    reason: RescheduleReason
    reason_details: Optional[str] = None
    
    # Who initiated
    initiated_by: str  # "candidate" | "system" | "recruiter"
    
    # Timestamp
    rescheduled_at: str = Field(default_factory=get_current_timestamp)


class InterviewReminder(BaseModel):
    """Record of a reminder sent."""
    reminder_id: str = Field(default_factory=lambda: f"rem-{uuid.uuid4().hex[:8]}")
    
    # Type
    reminder_type: str  # "email" | "sms" | "whatsapp"
    hours_before: int
    
    # Status
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    opened_at: Optional[str] = None
    
    # Error
    error: Optional[str] = None


# ===================================================================
# MAIN MODELS
# ===================================================================

class InterviewSchedule(BaseModel):
    """
    Complete interview schedule record.
    
    Links candidate, pipeline, and interview session.
    """
    # Identity
    schedule_id: str = Field(default_factory=generate_schedule_id)
    
    # Links
    pipeline_id: str = Field(..., description="Parent pipeline")
    candidate_id: str = Field(..., description="Candidate being interviewed")
    scheduling_token: str = Field(..., description="Token from outreach email")
    
    # Candidate info (denormalized for quick access)
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    
    # Job info (denormalized)
    job_title: str
    company_name: Optional[str] = None
    
    # Schedule details
    scheduled_datetime: str = Field(..., description="Interview time (ISO format)")
    timezone: str = "Asia/Kolkata"
    duration_minutes: int = 30
    
    # Computed end time
    @property
    def scheduled_end_datetime(self) -> str:
        """Calculate end time."""
        start = datetime.fromisoformat(self.scheduled_datetime.replace('Z', '+00:00'))
        end = start + timedelta(minutes=self.duration_minutes)
        return end.isoformat()
    
    # Status
    status: ScheduleStatus = ScheduleStatus.CONFIRMED
    
    # Interview execution
    interview_session_id: Optional[str] = None
    call_initiated_at: Optional[str] = None
    call_answered_at: Optional[str] = None
    call_ended_at: Optional[str] = None
    actual_duration_seconds: Optional[float] = None
    
    # Outcome
    interview_completed: bool = False
    completion_status: Optional[str] = None
    
    # Reschedule history
    reschedule_history: List[RescheduleRecord] = Field(default_factory=list)
    reschedule_count: int = 0
    original_scheduled_datetime: Optional[str] = None
    
    # Reminders
    reminders_sent: List[InterviewReminder] = Field(default_factory=list)
    
    # Candidate-provided info during booking
    candidate_preferred_time: Optional[str] = None
    candidate_special_requirements: Optional[str] = None
    candidate_notes: Optional[str] = None
    
    # Timestamps
    booked_at: str = Field(default_factory=get_current_timestamp)
    confirmed_at: Optional[str] = None
    updated_at: str = Field(default_factory=get_current_timestamp)
    
    # Methods
    def reschedule(
        self,
        new_datetime: str,
        reason: RescheduleReason,
        initiated_by: str,
        reason_details: Optional[str] = None
    ):
        """Reschedule the interview."""
        if not self.original_scheduled_datetime:
            self.original_scheduled_datetime = self.scheduled_datetime
        
        record = RescheduleRecord(
            original_datetime=self.scheduled_datetime,
            new_datetime=new_datetime,
            reason=reason,
            reason_details=reason_details,
            initiated_by=initiated_by
        )
        self.reschedule_history.append(record)
        
        self.scheduled_datetime = new_datetime
        self.reschedule_count += 1
        self.status = ScheduleStatus.RESCHEDULED
        self.updated_at = get_current_timestamp()
    
    def mark_completed(
        self,
        interview_session_id: str,
        duration_seconds: float,
        completion_status: str = "completed"
    ):
        """Mark interview as completed."""
        self.interview_session_id = interview_session_id
        self.actual_duration_seconds = duration_seconds
        self.interview_completed = True
        self.completion_status = completion_status
        self.status = ScheduleStatus.COMPLETED
        self.call_ended_at = get_current_timestamp()
        self.updated_at = get_current_timestamp()
    
    def mark_no_show(self):
        """Mark candidate as no-show."""
        self.status = ScheduleStatus.NO_SHOW
        self.interview_completed = False
        self.completion_status = "no_show"
        self.updated_at = get_current_timestamp()


class SchedulingConfiguration(BaseModel):
    """
    Configuration for scheduling availability.
    Can be set per-pipeline or globally.
    """
    config_id: str = Field(default_factory=lambda: f"schedcfg-{uuid.uuid4().hex[:8]}")
    
    # Owner
    pipeline_id: Optional[str] = None
    username: str
    
    # Availability windows (optional - for restricted scheduling)
    availability_windows: List[AvailabilityWindow] = Field(default_factory=list)
    
    # Blocked dates
    blocked_dates: List[str] = Field(default_factory=list)
    
    # Settings
    timezone: str = "Asia/Kolkata"
    min_notice_hours: int = 1  # Changed to 1 hour minimum
    max_advance_days: int = 14
    slot_duration_minutes: int = 30
    buffer_between_slots_minutes: int = 0  # No buffer for AI interviews
    
    # Daily limits (optional)
    max_interviews_per_day: Optional[int] = None
    
    # Reminders
    send_confirmation_email: bool = True
    reminder_hours_before: List[int] = Field(default_factory=lambda: [24, 2])
    
    # Timestamps
    created_at: str = Field(default_factory=get_current_timestamp)
    updated_at: str = Field(default_factory=get_current_timestamp)
    
    def generate_available_slots(
        self,
        from_date: datetime,
        to_date: datetime,
        existing_bookings: List[InterviewSchedule] = None
    ) -> List[TimeSlot]:
        """
        Generate available time slots.
        
        NEW LOGIC: Since AI conducts interviews 24/7, generate slots for any time
        that is:
        1. At least min_notice_hours from now
        2. Not in the past
        3. Not conflicting with existing bookings
        
        Args:
            from_date: Start of range
            to_date: End of range
            existing_bookings: Already booked schedules to exclude
            
        Returns:
            List of available TimeSlot objects
        """
        slots = []
        existing_bookings = existing_bookings or []
        
        # Get booked datetime strings to avoid conflicts
        booked_times = set()
        for booking in existing_bookings:
            if booking.status not in [
                ScheduleStatus.CANCELLED,
                ScheduleStatus.RESCHEDULED,
                ScheduleStatus.COMPLETED,
                ScheduleStatus.EXPIRED
            ]:
                booked_times.add(booking.scheduled_datetime)
        
        # Start generating slots
        current_time = from_date
        
        # Generate slots every 30 minutes
        while current_time < to_date:
            # Skip if date is blocked
            if current_time.date().isoformat() in self.blocked_dates:
                current_time += timedelta(days=1)
                current_time = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
                continue
            
            # Skip if too soon
            min_notice_cutoff = datetime.utcnow() + timedelta(hours=self.min_notice_hours)
            if current_time < min_notice_cutoff:
                current_time += timedelta(minutes=self.slot_duration_minutes)
                continue
            
            # Check if slot is already booked
            slot_datetime_str = current_time.isoformat()
            if slot_datetime_str in booked_times:
                current_time += timedelta(minutes=self.slot_duration_minutes)
                continue
            
            # Calculate end time
            slot_end = current_time + timedelta(minutes=self.slot_duration_minutes)
            
            # Determine time of day
            slot_type = get_slot_type_from_hour(current_time.hour)
            
            # Create slot with CORRECT field names
            slots.append(TimeSlot(
                date=current_time.strftime("%Y-%m-%d"),
                start_time=current_time.strftime("%H:%M"),
                end_time=slot_end.strftime("%H:%M"),
                datetime=slot_datetime_str,
                timezone=self.timezone,
                is_available=True,
                slot_type=slot_type
            ))
            
            # Move to next slot
            current_time += timedelta(minutes=self.slot_duration_minutes)
        
        return slots


# ===================================================================
# API REQUEST/RESPONSE MODELS
# ===================================================================

class GetAvailableSlotsRequest(BaseModel):
    """Request to get available slots."""
    scheduling_token: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    timezone: str = "Asia/Kolkata"


class GetAvailableSlotsResponse(BaseModel):
    """Response with available slots."""
    valid: bool
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    slots: List[TimeSlot] = Field(default_factory=list)
    timezone: str
    min_notice_hours: int
    error: Optional[str] = None


class BookSlotRequest(BaseModel):
    """Request to book a slot."""
    scheduling_token: str
    scheduled_datetime: str = Field(..., description="Selected slot (ISO format)")
    timezone: str = "Asia/Kolkata"
    preferred_time: Optional[str] = None
    special_requirements: Optional[str] = None
    candidate_notes: Optional[str] = None


class BookSlotResponse(BaseModel):
    """Response after booking."""
    success: bool
    schedule_id: Optional[str] = None
    scheduled_datetime: Optional[str] = None
    timezone: Optional[str] = None
    duration_minutes: Optional[int] = None
    confirmation_sent: bool = False
    message: str
    error: Optional[str] = None


class RescheduleRequest(BaseModel):
    """Request to reschedule."""
    scheduling_token: str
    new_datetime: str
    reason: RescheduleReason = RescheduleReason.CANDIDATE_REQUEST
    reason_details: Optional[str] = None


class RescheduleResponse(BaseModel):
    """Response after rescheduling."""
    success: bool
    schedule_id: Optional[str] = None
    old_datetime: Optional[str] = None
    new_datetime: Optional[str] = None
    message: str
    error: Optional[str] = None


class CancelScheduleRequest(BaseModel):
    """Request to cancel a schedule."""
    scheduling_token: str
    reason: Optional[str] = None


class CancelScheduleResponse(BaseModel):
    """Response after cancellation."""
    success: bool
    message: str
    error: Optional[str] = None


# ===================================================================
# EXPORT
# ===================================================================

__all__ = [
    # Enums
    "ScheduleStatus",
    "RescheduleReason",
    
    # Helper functions
    "generate_schedule_id",
    "get_current_timestamp",
    "get_slot_type_from_hour",
    
    # Sub-models
    "TimeSlot",
    "AvailabilityWindow",
    "RescheduleRecord",
    "InterviewReminder",
    
    # Main models
    "InterviewSchedule",
    "SchedulingConfiguration",
    
    # API models
    "GetAvailableSlotsRequest",
    "GetAvailableSlotsResponse",
    "BookSlotRequest",
    "BookSlotResponse",
    "RescheduleRequest",
    "RescheduleResponse",
    "CancelScheduleRequest",
    "CancelScheduleResponse",
]