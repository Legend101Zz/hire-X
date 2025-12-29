const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

// ===============================================================
// TYPES
// ===============================================================

export interface DashboardMetrics {
  total_searches: number;
  total_candidates_analyzed: number;
  total_candidates_shortlisted: number;
  total_deep_dives: number;
  credits_remaining: number;
  credits_used: number;
  searches_this_month: number;
  avg_match_score: number;
}

export interface PipelineStageStats {
  sourced: number;
  enriched: number;
  outreach_sent: number;
  outreach_opened: number;
  outreach_clicked: number;
  responded: number;
  scheduled: number;
  interviewed: number;
  offered: number;
  hired: number;
}

export interface InboxItem {
  id: string;
  type: "response" | "interview" | "reminder" | "milestone";
  title: string;
  subtitle: string;
  time: string;
  timestamp: string;
  is_unread: boolean;
  is_urgent: boolean;
  candidate_id?: string;
  pipeline_id?: string;
  action_url?: string;
  metadata: Record<string, any>;
}

export interface UpcomingInterview {
  schedule_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_title?: string;
  job_title: string;
  scheduled_datetime: string;
  timezone: string;
  duration_minutes: number;
  time_until: string;
  is_today: boolean;
  status: string;
  interview_session_id?: string;
}

export interface CandidateQuickView {
  candidate_id: string;
  name: string;
  title?: string;
  stage: string;
  stage_label: string;
  match_score?: number;
  last_activity: string;
  pipeline_id?: string;
  has_responded: boolean;
  is_favorite: boolean;
  contact_email?: string;
}

export interface SearchSummary {
  session_id: string;
  conversation_session_id?: string;
  role_title: string;
  skills: string[];
  locations: string[];
  total_candidates: number;
  enriched_count: number;
  shortlisted_count: number;
  status: string;
  created_at: string;
  avg_match_score?: number;
  source?: string;
  pipeline_id?: string;
  pipeline_created_at?: string;
}

export interface DeepDiveSummary {
  result_id: string;
  candidate_name: string;
  candidate_title: string;
  linkedin_url: string;
  match_score?: number;
  created_at: string;
}

export interface DonnaTip {
  message: string;
  variant: "default" | "celebration" | "tip" | "urgent";
  action_label?: string;
  action_type?: string;
  action_target?: string;
}

export interface EnhancedDashboardData {
  metrics: DashboardMetrics;
  pipeline_stats: PipelineStageStats;
  inbox_items: InboxItem[];
  upcoming_interviews: UpcomingInterview[];
  recent_candidates: CandidateQuickView[];
  recent_searches: SearchSummary[];
  recent_deep_dives: DeepDiveSummary[];
  user: {
    username: string;
    email: string;
    created_at: string;
    plan: string;
  };
  donna_tip?: DonnaTip;
}

// Legacy types
export interface DashboardData {
  metrics: DashboardMetrics;
  recent_searches: SearchSummary[];
  recent_deep_dives: DeepDiveSummary[];
  user: {
    username: string;
    email: string;
    plan: string;
  };
}

export interface PaginatedSearches {
  searches: SearchSummary[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

export interface PaginatedDeepDives {
  deep_dives: DeepDiveSummary[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

export interface InboxResponse {
  items: InboxItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
  unread_count: number;
}

export interface InterviewScheduleView {
  schedule_id: string;
  pipeline_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  linkedin_url?: string;
  job_title: string;
  company_name?: string;
  scheduled_datetime: string;
  timezone: string;
  duration_minutes: number;
  status: string;
  interview_session_id?: string;
  interview_completed: boolean;
  completion_status?: string;
  booked_at?: string;
  confirmed_at?: string;
  call_initiated_at?: string;
  call_ended_at?: string;
  actual_duration_seconds?: number;
  candidate_notes?: string;
  time_until: string;
  is_today: boolean;
  is_past: boolean;
  can_start: boolean;
}

export interface InterviewsResponse {
  upcoming: InterviewScheduleView[];
  today: InterviewScheduleView[];
  completed: InterviewScheduleView[];
  cancelled: InterviewScheduleView[];
  stats: {
    total_scheduled: number;
    total_completed: number;
    total_cancelled: number;
    total_no_show: number;
    completion_rate: number;
    upcoming_count: number;
    today_count: number;
  };
}

// ===============================================================
// API FUNCTIONS
// ===============================================================

export const getEnhancedDashboard = async (
  token: string
): Promise<EnhancedDashboardData> => {
  const response = await fetch(`${API_BASE}/dashboard/enhanced`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get enhanced dashboard");
  return response.json();
};

export const getDashboard = async (token: string): Promise<DashboardData> => {
  const response = await fetch(`${API_BASE}/dashboard`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get dashboard");
  return response.json();
};

export const getPipelineStats = async (
  token: string
): Promise<PipelineStageStats> => {
  const response = await fetch(`${API_BASE}/dashboard/pipeline-stats`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get pipeline stats");
  return response.json();
};

export const getInbox = async (
  token: string,
  page: number = 1,
  pageSize: number = 20,
  filterType?: string,
  unreadOnly: boolean = false
): Promise<InboxResponse> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    unread_only: String(unreadOnly),
  });
  if (filterType) params.append("filter_type", filterType);

  const response = await fetch(`${API_BASE}/dashboard/inbox?${params}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get inbox");
  return response.json();
};

export const markInboxItemRead = async (
  itemId: string,
  token: string
): Promise<{ success: boolean }> => {
  const response = await fetch(
    `${API_BASE}/dashboard/inbox/${itemId}/mark-read`,
    {
      method: "POST",
      headers: getHeaders(token),
    }
  );
  if (!response.ok) throw new Error("Failed to mark item as read");
  return response.json();
};

export const getUpcomingInterviews = async (
  token: string,
  daysAhead: number = 7
): Promise<UpcomingInterview[]> => {
  const params = new URLSearchParams({ days_ahead: String(daysAhead) });
  const response = await fetch(
    `${API_BASE}/dashboard/upcoming-interviews?${params}`,
    {
      headers: getHeaders(token),
    }
  );
  if (!response.ok) throw new Error("Failed to get upcoming interviews");
  return response.json();
};

export const getCandidatesQuickView = async (
  token: string,
  stage?: string,
  favoritesOnly: boolean = false,
  respondedOnly: boolean = false,
  limit: number = 20
): Promise<CandidateQuickView[]> => {
  const params = new URLSearchParams({
    limit: String(limit),
    favorites_only: String(favoritesOnly),
    responded_only: String(respondedOnly),
  });
  if (stage) params.append("stage", stage);

  const response = await fetch(
    `${API_BASE}/dashboard/candidates/quick-view?${params}`,
    {
      headers: getHeaders(token),
    }
  );
  if (!response.ok) throw new Error("Failed to get candidates");
  return response.json();
};

export const getSearches = async (
  token: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedSearches> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  const response = await fetch(`${API_BASE}/dashboard/searches?${params}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get searches");
  return response.json();
};

export const getDeepDives = async (
  token: string,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedDeepDives> => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  const response = await fetch(`${API_BASE}/dashboard/deep-dives?${params}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get deep dives");
  return response.json();
};

export const deleteSearch = async (
  sessionId: string,
  token: string
): Promise<{ success: boolean }> => {
  const response = await fetch(`${API_BASE}/dashboard/searches/${sessionId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to delete search");
  return response.json();
};

export const getAllInterviews = async (
  token: string,
  statusFilter?: string,
  daysBack: number = 30,
  daysAhead: number = 14
): Promise<InterviewsResponse> => {
  const params = new URLSearchParams({
    days_back: String(daysBack),
    days_ahead: String(daysAhead),
  });
  if (statusFilter) params.append("status_filter", statusFilter);

  const response = await fetch(`${API_BASE}/dashboard/interviews?${params}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get interviews");
  return response.json();
};
