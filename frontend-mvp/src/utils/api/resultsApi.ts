const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

export const resultsApi = {
  async getResults(sessionId: string, page = 1, pageSize = 20) {
    const response = await fetch(
      `${API_BASE}/results/${sessionId}/candidates?page=${page}&page_size=${pageSize}`,
      { headers: getHeaders() }
    );
    if (!response.ok) throw new Error("Failed to get results");
    return response.json();
  },

  async getSingleCandidate(sessionId: string, candidateId: string) {
    const response = await fetch(
      `${API_BASE}/results/${sessionId}/candidate/${candidateId}`,
      { headers: getHeaders() }
    );
    if (!response.ok) throw new Error("Failed to get candidate");
    return response.json();
  },

  async exportResults(
    sessionId: string,
    format = "csv",
    includeEnrichment = true
  ) {
    const response = await fetch(
      `${API_BASE}/results/${sessionId}/export?format=${format}&include_enrichment=${includeEnrichment}`,
      { headers: getHeaders() }
    );
    if (!response.ok) throw new Error("Failed to export");
    return response.blob();
  },

  async getProgress(sessionId: string) {
    const response = await fetch(`${API_BASE}/results/${sessionId}/progress`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error("Failed to get progress");
    return response.json();
  },
};
