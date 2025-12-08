"""
Interview Scheduling Models
===========================
Pydantic models for interview scheduling and booking.

Author: NeuraLeap Engineering
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
    PENDING = "pending"         # Slot selected, awaiting confirmation
    CONFIRMED = "confirmed"     # Confirmed by system
    REMINDER_SENT = "reminder_sent"  # Reminder sent to candidate
    IN_PROGRESS = "in_progress"  # Interview happening now
    COMPLETED = "completed"     # Interview finished
    CANCELLED = "cancelled"     # Cancelled by either party
    RESCHEDULED = "rescheduled"  # Moved to new time
    NO_SHOW = "no_show"         # Candidate didn't show up
    TECHNICAL_ISSUE = "technical_issue"  # Call failed due to tech issues


class RescheduleReason(str, Enum):
    """Reason for rescheduling."""
    CANDIDATE_REQUEST = "candidate_request"
    INTERVIEWER_UNAVAILABLE = "interviewer_unavailable"
    TECHNICAL_ISSUE = "technical_issue"
    EMERGENCY = "emergency"
    OTHER = "other"


class TimeSlotType(str, Enum):
    """Type of time slot."""
    AVAILABLE = "available"
    BOOKED = "booked"
    BLOCKED = "blocked"
    PAST = "past"


# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

def generate_schedule_id() -> str:
    """Generate unique schedule ID."""
    return f"sched-{uuid.uuid4().hex[:10]}"


def get_current_timestamp() -> str:
    """Get current UTC timestamp."""
    return datetime.utcnow().isoformat()


# ===================================================================
# SUB-MODELS
# ===================================================================

class TimeSlot(BaseModel):
    """A single time slot for scheduling."""
    slot_id: str = Field(default_factory=lambda: f"slot-{uuid.uuid4().hex[:8]}")
    
    # Time
    start_datetime: str  # ISO format
    end_datetime: str    # ISO format
    duration_minutes: int = 30
    timezone: str = "Asia/Kolkata"
    
    # Status
    slot_type: TimeSlotType = TimeSlotType.AVAILABLE
    
    # If booked
    booked_by_candidate_id: Optional[str] = None
    booked_at: Optional[str] = None


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
    buffer_minutes: int = 15  # Gap between slots
    
    # Active dates
    valid_from: Optional[str] = None  # ISO date
    valid_until: Optional[str] = None  # ISO date
    
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
    hours_before: int  # How many hours before interview
    
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
        start = datetime.fromisoformat(self.scheduled_datetime)
        end = start + timedelta(minutes=self.duration_minutes)
        return end.isoformat()
    
    # Status
    status: ScheduleStatus = ScheduleStatus.CONFIRMED
    
    # Interview execution
    interview_session_id: Optional[str] = None  # From VapiInterviewService
    call_initiated_at: Optional[str] = None
    call_answered_at: Optional[str] = None
    call_ended_at: Optional[str] = None
    actual_duration_seconds: Optional[float] = None
    
    # Outcome
    interview_completed: bool = False
    completion_status: Optional[str] = None  # "completed" | "no_answer" | "failed" | "voicemail"
    
    # Reschedule history
    reschedule_history: List[RescheduleRecord] = Field(default_factory=list)
    reschedule_count: int = 0
    original_scheduled_datetime: Optional[str] = None
    
    # Reminders
    reminders_sent: List[InterviewReminder] = Field(default_factory=list)
    
    # Candidate-provided info during booking
    candidate_preferred_time: Optional[str] = None  # "morning" | "afternoon" | "evening"
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
        # Save original if first reschedule
        if not self.original_scheduled_datetime:
            self.original_scheduled_datetime = self.scheduled_datetime
        
        # Create reschedule record
        record = RescheduleRecord(
            original_datetime=self.scheduled_datetime,
            new_datetime=new_datetime,
            reason=reason,
            reason_details=reason_details,
            initiated_by=initiated_by
        )
        self.reschedule_history.append(record)
        
        # Update schedule
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
    pipeline_id: Optional[str] = None  # If None, global config
    username: str
    
    # Availability windows
    availability_windows: List[AvailabilityWindow] = Field(default_factory=list)
    
    # Blocked dates
    blocked_dates: List[str] = Field(default_factory=list)  # ISO dates
    
    # Settings
    timezone: str = "Asia/Kolkata"
    min_notice_hours: int = 2  # Minimum hours before interview
    max_advance_days: int = 14  # Maximum days in advance
    slot_duration_minutes: int = 30
    buffer_between_slots_minutes: int = 15
    
    # Daily limits
    max_interviews_per_day: int = 10
    
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
        Generate available time slots for a date range.
        
        Args:
            from_date: Start of range
            to_date: End of range
            existing_bookings: Already booked schedules to exclude
            
        Returns:
            List of available TimeSlot objects
        """
        slots = []
        existing_bookings = existing_bookings or []
        
        # Get booked times
        booked_times = set()
        for booking in existing_bookings:
            if booking.status not in [ScheduleStatus.CANCELLED, ScheduleStatus.RESCHEDULED]:
                booked_times.add(booking.scheduled_datetime)
        
        current_date = from_date.date()
        end_date = to_date.date()
        
        while current_date <= end_date:
            # Check if date is blocked
            if current_date.isoformat() in self.blocked_dates:
                current_date += timedelta(days=1)
                continue
            
            # Check day of week
            day_of_week = current_date.weekday()
            
            for window in self.availability_windows:
                if not window.is_active:
                    continue
                if day_of_week not in window.days_of_week:
                    continue
                
                # Parse start and end times
                start_hour, start_min = map(int, window.start_time.split(":"))
                end_hour, end_min = map(int, window.end_time.split(":"))
                
                slot_start = datetime.combine(current_date, datetime.min.time().replace(
                    hour=start_hour, minute=start_min
                ))
                window_end = datetime.combine(current_date, datetime.min.time().replace(
                    hour=end_hour, minute=end_min
                ))
                
                # Generate slots within window
                while slot_start + timedelta(minutes=self.slot_duration_minutes) <= window_end:
                    slot_end = slot_start + timedelta(minutes=self.slot_duration_minutes)
                    
                    # Check if slot is in the past
                    if slot_start < datetime.utcnow() + timedelta(hours=self.min_notice_hours):
                        slot_start = slot_end + timedelta(minutes=self.buffer_between_slots_minutes)
                        continue
                    
                    # Check if slot is booked
                    slot_datetime_str = slot_start.isoformat()
                    slot_type = TimeSlotType.AVAILABLE
                    
                    if slot_datetime_str in booked_times:
                        slot_type = TimeSlotType.BOOKED
                    
                    slots.append(TimeSlot(
                        start_datetime=slot_datetime_str,
                        end_datetime=slot_end.isoformat(),
                        duration_minutes=self.slot_duration_minutes,
                        timezone=self.timezone,
                        slot_type=slot_type
                    ))
                    
                    slot_start = slot_end + timedelta(minutes=self.buffer_between_slots_minutes)
            
            current_date += timedelta(days=1)
        
        return slots


# ===================================================================
# API REQUEST/RESPONSE MODELS
# ===================================================================

class GetAvailableSlotsRequest(BaseModel):
    """Request to get available slots."""
    scheduling_token: str
    from_date: Optional[str] = None  # ISO date, defaults to today
    to_date: Optional[str] = None    # ISO date, defaults to 14 days from now
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
    preferred_time: Optional[str] = None  # "morning" | "afternoon" | "evening"
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
    "TimeSlotType",
    
    # Helper functions
    "generate_schedule_id",
    "get_current_timestamp",
    
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