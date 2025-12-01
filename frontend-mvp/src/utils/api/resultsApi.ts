const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

// ================================================================
// Progress & Status
// ================================================================

export const getProgress = async (sessionId: string, token: string) => {
  const response = await fetch(`${API_BASE}/results/${sessionId}/progress`, {
    headers: getHeaders(token),
  });

  if (!response.ok) {
    // Fallback: Check conversation enrichment status
    const convResponse = await fetch(
      `${API_BASE}/conversation/${sessionId}/enrichment-status`,
      { headers: getHeaders(token) }
    );
    if (convResponse.ok) {
      return convResponse.json();
    }
    throw new Error("Failed to get progress");
  }
  return response.json();
};

// ================================================================
// Results Overview
// ================================================================

export const getResults = async (sessionId: string, token: string) => {
  const response = await fetch(`${API_BASE}/results/${sessionId}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get results");
  return response.json();
};

// ================================================================
// Candidates
// ================================================================

export interface GetCandidatesOptions {
  page?: number;
  pageSize?: number;
  sortBy?: "match_score" | "salary" | "response_likelihood";
  sortOrder?: "asc" | "desc";
  filterMatchLabel?: string;
  filterShortlisted?: boolean;
}

export const getCandidates = async (
  sessionId: string,
  token: string,
  options?: GetCandidatesOptions
) => {
  const params = new URLSearchParams();
  if (options?.page) params.append("page", String(options.page));
  if (options?.pageSize) params.append("page_size", String(options.pageSize));
  if (options?.sortBy) params.append("sort_by", options.sortBy);
  if (options?.sortOrder) params.append("sort_order", options.sortOrder);
  if (options?.filterMatchLabel)
    params.append("filter_match_label", options.filterMatchLabel);
  if (options?.filterShortlisted !== undefined) {
    params.append("filter_shortlisted", String(options.filterShortlisted));
  }

  const response = await fetch(
    `${API_BASE}/results/${sessionId}/candidates?${params.toString()}`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error("Failed to get candidates");
  return response.json();
};

export const getSingleCandidate = async (
  sessionId: string,
  candidateId: string,
  token: string
) => {
  const response = await fetch(
    `${API_BASE}/results/${sessionId}/candidate/${candidateId}`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error("Failed to get candidate");
  return response.json();
};

// ================================================================
// Shortlist
// ================================================================

export const toggleShortlist = async (
  sessionId: string,
  candidateId: string,
  token: string
) => {
  const response = await fetch(
    `${API_BASE}/results/${sessionId}/shortlist/${candidateId}`,
    {
      method: "POST",
      headers: getHeaders(token),
    }
  );
  if (!response.ok) throw new Error("Failed to toggle shortlist");
  return response.json();
};

export const getShortlisted = async (sessionId: string, token: string) => {
  const response = await fetch(`${API_BASE}/results/${sessionId}/shortlist`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get shortlist");
  return response.json();
};

// ================================================================
// Conversation History
// ================================================================

export const getConversationHistory = async (
  sessionId: string,
  token: string
) => {
  const response = await fetch(
    `${API_BASE}/results/${sessionId}/conversation`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error("Failed to get conversation");
  return response.json();
};

// ================================================================
// Export
// ================================================================

export const exportResults = async (
  sessionId: string,
  token: string,
  format: "csv" | "excel" = "csv",
  includeEnrichment: boolean = true
) => {
  const params = new URLSearchParams({
    format,
    include_enrichment: String(includeEnrichment),
  });

  const response = await fetch(
    `${API_BASE}/results/${sessionId}/export?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) throw new Error("Failed to export");
  return response.blob();
};

// ================================================================
// List Past Results
// ================================================================

export const listResults = async (
  token: string,
  page: number = 1,
  pageSize: number = 10
) => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  const response = await fetch(`${API_BASE}/results/?${params.toString()}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to list results");
  return response.json();
};
