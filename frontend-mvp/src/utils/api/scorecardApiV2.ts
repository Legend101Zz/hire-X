/**
 * Scorecard API functions for backend-v2 (Legacy Scorecard Flow)
 */

import { apiCall, handleApiResponse } from "../api";
import type { ScorecardStatusResponse, EnrichedCandidate } from "@/types";

/**
 * Start new scorecard workflow (asynchronous processing)
 */
export const parsePrompt = async (
  prompt: string,
  token: string
): Promise<{
  session_id: string;
  status: string;
  message: string;
}> => {
  const response = await apiCall("/scorecard/parse-prompt", {
    method: "POST",
    body: JSON.stringify({ prompt }),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get real-time workflow progress
 */
export const getScorecardStatus = async (
  sessionId: string,
  token: string
): Promise<ScorecardStatusResponse> => {
  const response = await apiCall(`/scorecard/session/${sessionId}/status`, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get paginated scorecard results
 */
export const getScorecardResults = async (
  sessionId: string,
  token: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{
  session_id: string;
  status: string;
  candidates: EnrichedCandidate[];
  summary: {
    total_candidates: number;
    average_score: number;
    top_score: number;
    distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  };
  pagination: {
    page: number;
    page_size: number;
    total_pages: number;
    total_candidates: number;
    has_next: boolean;
    has_prev: boolean;
  };
}> => {
  const response = await apiCall(
    `/scorecard/results/${sessionId}?page=${page}&page_size=${pageSize}`,
    {
      method: "GET",
      token,
    }
  );

  return handleApiResponse(response);
};

/**
 * Submit follow-up answers to refine results
 */
export const submitFollowUp = async (
  sessionId: string,
  token: string,
  answers: Record<string, unknown>
): Promise<{
  session_id: string;
  status: string;
  message: string;
}> => {
  const response = await apiCall(`/scorecard/session/${sessionId}/followup`, {
    method: "POST",
    body: JSON.stringify({ answers }),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get user's scorecard history
 */
export const getMyScorecards = async (
  token: string,
  limit: number = 10,
  skip: number = 0
): Promise<{
  scorecards: Array<{
    session_id: string;
    prompt: string;
    created_at: string;
    summary: Record<string, unknown>;
  }>;
  total: number;
  limit: number;
  skip: number;
}> => {
  const response = await apiCall(
    `/scorecard/my-scorecards?limit=${limit}&skip=${skip}`,
    {
      method: "GET",
      token,
    }
  );

  return handleApiResponse(response);
};

/**
 * Delete a scorecard
 */
export const deleteScorecard = async (
  sessionId: string,
  token: string
): Promise<{ message: string }> => {
  const response = await apiCall(`/scorecard/session/${sessionId}`, {
    method: "DELETE",
    token,
  });

  return handleApiResponse(response);
};
