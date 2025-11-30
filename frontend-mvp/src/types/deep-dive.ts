/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ExperienceItem {
  title: string;
  company: string;
  experience_type: string;
  company_status: string;
  is_paid: boolean;
  counts_as_experience: boolean;
  duration_months: number;
  duration?: string;
  start_date?: string;
  end_date?: string;
  reasoning?: string;
}

export interface EnrichmentPlan {
  role_type: string;
  role_title: string;
  seniority_level: string;
  extracted_requirements: {
    must_have_skills: string[];
    nice_to_have_skills: string[];
    years_experience_min: number;
    years_experience_max: number;
  };
}

export interface SkillValidation {
  validated_skills: string[];
  unvalidated_skills: string[];
  evidence: any[];
  overall_confidence: number;
  assessment: string;
  skill_gaps?: {
    critical_gaps?: string[];
    gap_severity?: string;
  };
  bonus_skills?: Array<{ skill: string }>;
}

export interface SalaryTimeline {
  career_progression: any[];
  current_estimated_ctc: {
    low: number;
    high: number;
    most_likely: number;
    note?: string;
  };
  growth_analysis: {
    average_annual_growth_percent: number;
    trajectory: string;
    note?: string;
  };
  confidence_score: number;
  confidence_factors: string[];
}

export interface ResponseLikelihood {
  overall_score: number;
  likelihood_label: string;
  factors: any[];
  recommended_approach: any;
  activity_signals?: {
    overall_activity?: string;
  };
  reachability?: {
    best_channels?: string[];
  };
}

export interface NoticePeriod {
  estimated_notice_days: {
    minimum: number;
    likely: number;
    maximum: number;
  };
  earliest_possible_start: string;
  most_likely_start: string;
  negotiation_tips?: string[];
  confidence?: number;
}

export interface MatchAnalysis {
  overall_match_score: number;
  match_label: string;
  score_breakdown?: Record<string, any>;
  strengths: Array<string | { strength: string; evidence: string }>;
  concerns: Array<string | { concern: string; severity: string }>;
  gaps: Array<string | { gap: string; importance: string }>;
  hiring_recommendation: {
    action: string;
    reasoning: string;
    alternative_suggestion?: string;
  };
  recruiter_summary?: {
    one_liner?: string;
  };
  experience_assessment?: any;
}

export interface Candidate {
  full_name: string;
  headline: string;
  current_company: string;
  location: string;
  linkedin_url: string;
  about?: string;
  experience: ExperienceItem[];
  experience_summary: {
    total_roles: number;
    professional_roles: number;
    internships: number;
    other_activities: number;
    real_experience_years: number;
    has_industry_experience: boolean;
  };
  education: any[];
  skills: string[];
  profile_links: Record<string, string>;
  connections?: number;
  open_to_work?: boolean;
  _data_source: string;
  _data_freshness: string;
}

export interface DeepDiveResult {
  candidate: Candidate;
  job_requirements: Record<string, any>;
  enrichment_plan: EnrichmentPlan;
  skill_validation: SkillValidation | null;
  salary_timeline: SalaryTimeline | null;
  response_likelihood: ResponseLikelihood | null;
  notice_period: NoticePeriod | null;
  match_analysis: MatchAnalysis | null;
  professional_footprint?: any;
  data_source: string;
  processing_time_seconds: number;
  enriched_at: string;
}

export interface DeepDiveApiResponse {
  success: boolean;
  data: DeepDiveResult;
  message: string;
  result_id?: string;
  share_url?: string;
}

export interface HistoryItem {
  id: string;
  candidate_name: string;
  headline: string;
  linkedin_url: string;
  match_score: number;
  match_label: string;
  data_source: string;
  created_at: string;
  view_count: number;
}
