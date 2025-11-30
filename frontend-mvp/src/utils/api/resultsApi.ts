const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

export const getProgress = async (sessionId: string, token: string) => {
  // We use the conversation's enrichment status endpoint because
  // that's where the parallel service stores progress
  const response = await fetch(
    `${API_BASE}/conversation/${sessionId}/enrichment-status`,
    {
      headers: getHeaders(token),
    }
  );
  if (!response.ok) throw new Error("Failed to get progress");
  return response.json();
};

export const getResults = async (sessionId: string, token: string) => {
  // This gets the overview
  const response = await fetch(`${API_BASE}/results/${sessionId}`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get results");
  return response.json();
};

export const getCandidates = async (sessionId: string, token: string) => {
  // This gets the actual list
  const response = await fetch(`${API_BASE}/results/${sessionId}/candidates`, {
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error("Failed to get candidates");
  return response.json();
};

export const exportResults = async (
  sessionId: string,
  token: string,
  format = "csv"
) => {
  const response = await fetch(
    `${API_BASE}/results/${sessionId}/export?format=${format}`,
    { headers: getHeaders(token) }
  );
  if (!response.ok) throw new Error("Failed to export");
  return response.blob();
};
