export type CandidateStage =
  | "sourced"
  | "shortlisted"
  | "enriching"
  | "enriched"
  | "enrichment_failed"
  | "outreach_pending"
  | "outreach_sent"
  | "outreach_reminder"
  | "outreach_failed"
  | "no_response"
  | "scheduling"
  | "scheduled"
  | "rescheduling"
  | "interview_pending"
  | "interview_calling"
  | "interview_completed"
  | "interview_failed"
  | "interview_no_show"
  | "evaluating"
  | "evaluated"
  | "offer_pending"
  | "offer_sent"
  | "offer_accepted"
  | "offer_rejected"
  | "hired"
  | "rejected"
  | "withdrawn"
  | "on_hold";

export interface StageMetadata {
  value: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export interface ContactInfo {
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface EnrichmentSummary {
  is_enriched: boolean;
  enriched_at: string | null;
  match_score: number | null;
  match_label: string | null;
  top_strengths: string[];
  concerns: string[];
  verified_skills: string[];
}

export interface OutreachRecord {
  scheduling_token: string;
  scheduling_link: string;
  initial_email_sent_at: string | null;
  reminder_count: number;
  total_opens: number;
  total_clicks: number;
  first_opened_at: string | null;
  first_clicked_at: string | null;
  candidate_responded: boolean;
  response_type: string | null;
}

export interface InterviewInfo {
  scheduled_datetime: string | null;
  timezone: string;
  duration_minutes: number;
  interview_session_id: string | null;
  call_duration_seconds: number | null;
  recording_url: string | null;
  transcript_available: boolean;
  assessment_ready: boolean;
  overall_score: number | null;
  recommendation: string | null;
}

export interface PipelineCandidate {
  candidate_id: string;
  linkedin_url: string;
  name: string;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  experience_years: number | null;
  skills: string[];
  profile_picture_url: string | null;
  stage: CandidateStage;
  stage_label: string;
  stage_icon: string;
  stage_color: string;
  stage_description: string;
  stage_updated_at: string;
  contact: ContactInfo;
  enrichment: EnrichmentSummary;
  outreach: OutreachRecord | null;
  interview: InterviewInfo;
  is_favorite: boolean;
  priority: number;
  tags: string[];
  added_at: string;
  match_score: number | null;
  match_label: string | null;
  has_email: boolean;
  has_phone: boolean;
  email: string | null;
  outreach_sent_at: string | null;
  outreach_opened: boolean;
  outreach_clicked: boolean;
  reminder_sent: boolean;
  interview_scheduled_at: string | null;
  interview_score: number | null;
  interview_recommendation: string | null;
  final_decision: string | null;
}

export interface PipelineStats {
  total_sourced: number;
  total_shortlisted: number;
  total_enriched: number;
  total_contacted: number;
  total_opened: number;
  total_clicked: number;
  total_responded: number;
  total_scheduled: number;
  total_interviewed: number;
  total_evaluated: number;
  total_offers: number;
  total_hired: number;
  total_rejected: number;
  total_withdrawn: number;
  total_no_response: number;
  response_rate: number;
  schedule_rate: number;
  interview_completion_rate: number;
  offer_rate: number;
  acceptance_rate: number;
}

export interface PipelineStage {
  key: string;
  label: string;
  icon: string;
  count: number;
  color: string;
}

export interface JobContext {
  job_id: string;
  job_title: string;
  company_name: string | null;
  required_skills: string[];
  nice_to_have_skills: string[];
  experience_required: string | null;
  location_requirements: string[];
}

export interface PipelineSettings {
  auto_send_outreach: boolean;
  reminder_delay_hours: number;
  max_reminders: number;
  no_response_timeout_hours: number;
  auto_enrich_on_shortlist: boolean;
}

export interface Pipeline {
  pipeline_id: string;
  name: string;
  job_title: string;
  company_name: string | null;
  source: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats: PipelineStats;
  candidates: PipelineCandidate[];
  total_candidates: number;
  stage_distribution: Record<string, number>;
  pipeline_stages: PipelineStage[];
  funnel: Record<string, number>;
  settings: PipelineSettings;
  job: JobContext;
}

export interface PipelineListItem {
  pipeline_id: string;
  name: string;
  job_title: string;
  company_name: string | null;
  source: string;
  status: string;
  stats: PipelineStats;
  created_at: string;
  updated_at: string;
}
