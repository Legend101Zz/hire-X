const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

// Types
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

// API Functions
export const getDashboard = async (token: string): Promise<DashboardData> => {
  const response = await fetch(`${API_BASE}/dashboard`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get dashboard");
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
