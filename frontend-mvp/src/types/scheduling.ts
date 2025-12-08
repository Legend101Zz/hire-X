export interface TimeSlot {
  slot_id: string;
  datetime: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  is_available: boolean;
  slot_type: "morning" | "afternoon" | "evening";
}

export interface SchedulingInfo {
  valid: boolean;
  error?: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  company_name: string | null;
  pipeline_id: string;
  candidate_id: string;
  interview_duration_minutes: number;
  available_slots: TimeSlot[];
  timezone: string;
}

export interface BookingRequest {
  scheduled_datetime: string;
  timezone: string;
  preferred_time?: string;
  special_requirements?: string;
  candidate_notes?: string;
}

export interface BookingConfirmation {
  success: boolean;
  schedule_id: string;
  scheduled_datetime: string;
  formatted_time: string;
  timezone: string;
  duration_minutes: number;
  message: string;
}

export interface ExistingBooking {
  schedule_id: string;
  scheduled_datetime: string;
  timezone: string;
  duration_minutes: number;
  status: string;
  job_title: string;
  company_name: string | null;
}
