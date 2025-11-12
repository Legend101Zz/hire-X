/**
 * Results API functions for backend-v2 (Enriched Results)
 */

import { apiCall, handleApiResponse } from "../api";
import type {
  ResultsOverview,
  GetCandidatesResponse,
  EnrichedCandidate,
  ProgressResponse,
} from "@/types";

/**
 * Get results overview for a session
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
 * Get paginated enriched candidates
 */
export const getCandidates = async (
  sessionId: string,
  token: string,
  params: {
    page?: number;
    page_size?: number;
    sort_by?: "match_score" | "salary" | "response_likelihood";
    sort_order?: "asc" | "desc";
    filter_match_label?: string;
  } = {}
): Promise<GetCandidatesResponse> => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page.toString());
  if (params.page_size)
    queryParams.append("page_size", params.page_size.toString());
  if (params.sort_by) queryParams.append("sort_by", params.sort_by);
  if (params.sort_order) queryParams.append("sort_order", params.sort_order);
  if (params.filter_match_label)
    queryParams.append("filter_match_label", params.filter_match_label);

  const queryString = queryParams.toString();
  const endpoint = `/results/${sessionId}/candidates${
    queryString ? `?${queryString}` : ""
  }`;

  const response = await apiCall(endpoint, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get detailed single candidate information
 */
export const getCandidate = async (
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
  const queryParams = new URLSearchParams({
    format,
    include_enrichment: includeEnrichment.toString(),
  });

  const response = await apiCall(
    `/results/${sessionId}/export?${queryParams.toString()}`,
    {
      method: "GET",
      token,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to export results");
  }

  return response.blob();
};

/**
 * Get workflow progress
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
