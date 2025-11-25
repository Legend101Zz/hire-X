import { apiCall, handleApiResponse } from "../api";
import type {
  EnrichedCandidate,
  GetCandidatesResponse,
  ResultsOverview,
  ProgressResponse,
} from "@/types";

/**
 * Get enrichment progress (for polling)
 */
export const getProgress = async (
  sessionId: string,
  token: string
): Promise<ProgressResponse> => {
  const response = await apiCall(`/results/${sessionId}/progress`, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get results overview
 */
export const getResultsOverview = async (
  sessionId: string,
  token: string
): Promise<ResultsOverview> => {
  const response = await apiCall(`/results/${sessionId}`, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get enriched candidates (paginated)
 */
export const getCandidates = async (
  sessionId: string,
  token: string,
  options?: {
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    filter_match_label?: string;
  }
): Promise<GetCandidatesResponse> => {
  const params = new URLSearchParams({
    page: String(options?.page || 1),
    page_size: String(options?.page_size || 20),
    sort_by: options?.sort_by || "match_score",
    sort_order: options?.sort_order || "desc",
  });

  if (options?.filter_match_label) {
    params.append("filter_match_label", options.filter_match_label);
  }

  const response = await apiCall(
    `/results/${sessionId}/candidates?${params.toString()}`,
    {
      method: "GET",
      token,
    }
  );

  return handleApiResponse(response);
};

/**
 * Get single candidate details
 */
export const getSingleCandidate = async (
  sessionId: string,
  candidateId: string,
  token: string
): Promise<EnrichedCandidate> => {
  const response = await apiCall(
    `/results/${sessionId}/candidate/${candidateId}`,
    {
      method: "GET",
      token,
    }
  );

  return handleApiResponse(response);
};

/**
 * Export results to CSV/Excel
 */
export const exportResults = async (
  sessionId: string,
  token: string,
  format: "csv" | "excel" = "csv",
  includeEnrichment: boolean = true
): Promise<Blob> => {
  const params = new URLSearchParams({
    format,
    include_enrichment: String(includeEnrichment),
  });

  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_API_BASE_URL
    }/results/${sessionId}/export?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to export results");
  }

  return response.blob();
};
