// ============================================
// BACKEND-V2 API TYPE DEFINITIONS
// ============================================

// --------------------------------------------
// Authentication Types
// --------------------------------------------

export interface User {
  username: string;
  email: string;
  full_name: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
}

// --------------------------------------------
// Ideal Profile Card (Conversation)
// --------------------------------------------

export interface IdealProfileCard {
  role_title: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  seniority: string; // Junior/Mid/Senior/Lead
  experience_years: string; // e.g., "5+", "3-5"
  industries: string[];
  company_size: string[];
  locations: string[];
  additional_requirements: string;
  created_at?: string;
  updated_at?: string;
}

// --------------------------------------------
// Sample Profile
// --------------------------------------------

export interface SampleProfile {
  profile_id: string;
  name: string;
  title: string;
  skills: string[];
  experience_years: number;
  current_company: string;
  location: string;
  industry: string;
  match_score: number; // 0-100
}

// --------------------------------------------
// Conversation Types
// --------------------------------------------

export interface ConversationMessage {
  role: "user" | "assistant" | "donna";
  content: string;
  timestamp: string;
}

export interface ConversationState {
  session_id: string;
  stage: string;
  ideal_profile: IdealProfileCard;
  sample_profile?: SampleProfile;
  messages: ConversationMessage[];
  ready_to_search: boolean;
  turn_count: number;
}

export interface StartConversationRequest {
  initial_message?: string;
  jd_file_content?: string;
  jd_file_name?: string;
  model_configuration?: Record<string, string>;
}

export interface StartConversationResponse {
  session_id: string;
  donna_greeting: string;
  ideal_profile: IdealProfileCard;
  sample_profile?: SampleProfile;
  suggested_next_steps: string[];
  stage: string;
}

export interface SendMessageRequest {
  message: string;
  action?: "update_card" | "ready_to_search" | "show_sample";
}

export interface SendMessageResponse {
  donna_reply: string;
  updated_ideal_profile: IdealProfileCard;
  updated_sample_profile?: SampleProfile;
  stage: string;
  ready_to_search: boolean;
  suggestions: string[];
}

// --------------------------------------------
// Enrichment Data Types
// --------------------------------------------

export interface CareerProgressionItem {
  role: string;
  company: string;
  duration: string;
  experience_level: string;
  estimated_ctc_range: string; // "25.0 – 35.0" in Lakhs INR
  rationale: string;
  sources: string[];
}

export interface SalaryEnrichment {
  career_progression: CareerProgressionItem[];
  current_estimated_ctc: string;
  growth_trajectory: string;
  average_annual_growth: string;
  next_expected_range: string;
  confidence_score: number; // 0-100
}

export interface ResponseFactor {
  factor: string;
  weight: number; // Percentage
  score: number; // 0-10
  notes: string;
}

export interface ResponseLikelihood {
  overall_score: number; // 0-100
  likelihood_label: string; // "Low" | "Low-Moderate" | "Moderate" | "High" | "Very High"
  factors: ResponseFactor[];
  recommended_approach: string;
  estimated_response_time: string;
  best_contact_days?: string[];
  best_contact_time?: string;
}

export interface SkillEvidence {
  skill: string;
  evidence_type: string; // "GitHub" | "StackOverflow" | "Blog" | "LinkedIn Post"
  url: string;
  description: string;
  confidence: number; // 0-10
}

export interface SkillValidation {
  validated_skills: string[];
  unvalidated_skills: string[];
  evidence: SkillEvidence[];
  overall_confidence: number; // 0-100
}

export interface Availability {
  notice_period: string; // "30 days" | "Immediate" | "60+ days"
  last_profile_update?: string;
  job_search_signals: string[];
  estimated_availability: string;
  urgency_score: number; // 0-10
}

// --------------------------------------------
// Enriched Candidate Type
// --------------------------------------------

export interface EnrichedCandidate {
  // Basic Info
  candidate_id: string;
  first_name: string;
  last_name: string;
  title: string;
  company?: string;
  location: string;
  linkedin_url?: string;
  email?: string;
  phone?: string;

  // Match Information
  match_label: string; // "Excellent Match" | "Great Match" | "Good Match" | "Fair Match"
  match_reason: string;
  match_score: number; // 0-100

  // Enrichment Data
  salary_enrichment?: SalaryEnrichment;
  response_likelihood?: ResponseLikelihood;
  skill_validation?: SkillValidation;
  availability?: Availability;
  recruiter_summary?: RecruiterSummary;
  web_intelligence?: WebIntelligence;

  // Metadata
  enrichment_status: "pending" | "in_progress" | "completed" | "failed";
  enriched_at?: string;
  enrichment_error?: string;
}

// --------------------------------------------
// Pagination Types
// --------------------------------------------

export interface PaginationInfo {
  page: number;
  page_size: number;
  total_pages: number;
  total_candidates: number;
  has_next: boolean;
  has_prev: boolean;
}

// --------------------------------------------
// Results Types
// --------------------------------------------

export interface ResultsOverview {
  session_id: string;
  conversation_session_id?: string;
  ideal_profile: IdealProfileCard;
  total_found: number;
  enriched_count: number;
  created_at: string;
  status: string;
}

export interface GetCandidatesResponse {
  session_id: string;
  candidates: EnrichedCandidate[];
  pagination: PaginationInfo;
}

export interface ProgressResponse {
  session_id: string;
  total_candidates: number;
  enriched_count: number;
  failed_count: number;
  current_candidate?: string;
  progress_percentage: number; // 0-100
}

// --------------------------------------------
// Scorecard Types (Legacy)
// --------------------------------------------

export interface ScorecardSummary {
  total_candidates: number;
  average_score: number;
  top_score: number;
  distribution: {
    excellent: number; // 80+
    good: number; // 60-79
    fair: number; // 40-59
    poor: number; // 0-39
  };
}

export interface ScorecardStatusResponse {
  session_id: string;
  status: "parsing" | "searching" | "scoring" | "processing" | "completed";
  progress: number; // 0-100
  message: string;
  updated_at?: string;
  scorecard?: {
    candidates: EnrichedCandidate[];
    summary: ScorecardSummary;
  };
}

// --------------------------------------------
// Configuration Types
// --------------------------------------------

export interface ModelOption {
  id: string; // e.g., "claude-sonnet-4-5"
  name: string; // Display name
  cost: string; // "Very Low" | "Low" | "Medium" | "High"
  quality: string; // "Good" | "Very Good" | "Excellent"
  description: string;
}

export interface ModelConfiguration {
  conversation: string;
  jd_parsing: string;
  web_search: string;
  salary_estimation: string;
  skill_validation: string;
  response_likelihood: string;
  match_scoring: string;
}

export interface ModelPreset {
  name: string;
  description: string;
  configuration: ModelConfiguration;
  estimated_cost_per_50_candidates: number; // in INR
}

// --------------------------------------------
// Filter Types
// --------------------------------------------

export interface SearchFilters {
  location?: string[];
  seniority?: string[];
  industries?: string[];
  match_label?: string; // For results filtering
  skills?: string[];
  experience_years?: {
    min?: number;
    max?: number;
  };
}

// --------------------------------------------
// UI State Types
// --------------------------------------------

export interface SearchState {
  isSearching: boolean;
  sessionId: string | null;
  idealProfile: IdealProfileCard | null;
  error: string | null;
}

export interface ResultsState {
  candidates: EnrichedCandidate[];
  pagination: PaginationInfo | null;
  filters: SearchFilters;
  sortBy: "match_score" | "salary" | "response_likelihood";
  sortOrder: "asc" | "desc";
  isLoading: boolean;
}

// --------------------------------------------
// Export Legacy Profile Type (Backward Compatibility)
// --------------------------------------------

export interface Profile {
  _id?: string;
  first_name: string;
  last_name: string;
  title: string;
  location: string;
  country: string;
  seniority_level: string;
  current_industry: string;
  experience: Array<{
    title: string;
    company: string;
    current: number;
    startDate: string;
    endDate: string;
    summary?: string;
    country?: string;
    companyLinkedinUrl?: string;
    companyUrl_cleaned?: string;
    industry?: string;
    companyUrl?: string;
    sequenceNo?: number;
    maxEmployeeSize?: string;
    minEmployeeSize?: string;
    location?: string;
  }>;
  education: Array<{
    major: string;
    universityUrl: string;
    campus: string;
    startDate: string;
    endDate: string;
    sequenceNo?: number;
    universityLinkedInUrl?: string;
    specialization?: string;
  }>;
  linkedin_url: string;
  summary: string;
  expertise: string;
  functional_area: string;
  departments: string[];
  languages: string[];
  certifications: string[];
  publications: string[];
  patents: string[];
  awards: string[];
  memberships: string[];
  prior_industries: string[];
  organization_id: string;
  profile_picture: string;
  state: string;
  city: string;
  shortlistedAt?: string;
  sessionId?: string;
}

export interface RecruiterSummary {
  why_shortlist: string;
  why_reject: string;
  fit_summary: string;
  standout_achievements: string[];
  red_flags: string[];
  interesting_findings: string[];
  overall_recommendation: "Strong Yes" | "Yes" | "Maybe" | "No";
  confidence_level: number;
}

export interface WebIntelligence {
  github_stats?: {
    profile_url: string;
    activity: string;
  };
  online_presence: string[];
  press_mentions: Array<{
    url: string;
    description: string;
  }>;
  social_signals: string[];
  risk_flags: string[];
  last_updated: string;
}

export interface PipelineSession {
    session_id: string;
    batch_id: string;
    source: string;
    job_title: string;
    total_candidates: number;
    status_counts: {
        pending: number;
        enriching: number;
        enriched: number;
        outreach_sent: number;
        failed: number;
    };
    created_at: string;
    last_updated: string;
}