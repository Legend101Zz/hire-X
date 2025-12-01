/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Conversation API functions for backend-v2 (Donna AI)
 */

import { apiCall, handleApiResponse } from "../api";
import type {
  StartConversationRequest,
  SendMessageRequest,
  SampleProfile,
  ConversationState,
  IdealProfileCard,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const getHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
});

/**
 * Start a new conversation with Donna
 */
export const startConversation = async (
  token: string,
  data?: StartConversationRequest
): Promise<{
  session_id: string;
  donna_greeting: string;
  ideal_profile: IdealProfileCard;
  sample_profile: SampleProfile | null;
  suggested_next_steps: string[];
  stage: string;
}> => {
  const response = await apiCall("/conversation/start", {
    method: "POST",
    body: JSON.stringify(data || {}),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Send message - FIXED field names
 */
export const sendMessage = async (
  sessionId: string,
  token: string,
  data: SendMessageRequest
): Promise<{
  donna_reply: string;
  updated_ideal_profile: IdealProfileCard;
  updated_sample_profile: SampleProfile | null;
  stage: string;
  ready_to_search: boolean;
  suggestions: string[];
}> => {
  const response = await apiCall(`/conversation/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });

  const result = await handleApiResponse(response);

  // Normalize field names (backend might return different names)
  return {
    donna_reply: result.donna_reply || result.donna_response || "",
    updated_ideal_profile: result.updated_ideal_profile || result.ideal_profile,
    updated_sample_profile:
      result.updated_sample_profile || result.sample_profile || null,
    stage: result.stage || "review",
    ready_to_search: result.ready_to_search || false,
    suggestions: result.suggestions || result.suggested_next_steps || [],
  };
};

/**
 * Get current conversation state - FIXED to include sample_candidates
 */
export const getConversationState = async (
  sessionId: string,
  token: string
): Promise<ConversationState & { sample_candidates?: any[] }> => {
  const response = await apiCall(`/conversation/${sessionId}`, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Finalize conversation and trigger search
 */
export const finalizeConversation = async (
  sessionId: string,
  token: string,
  finalProfileAdjustments?: Partial<IdealProfileCard>
): Promise<{
  session_id: string;
  search_triggered: boolean;
  message: string;
  estimated_candidates?: number;
}> => {
  const response = await apiCall(`/conversation/${sessionId}/finalize`, {
    method: "POST",
    body: JSON.stringify({
      final_profile_adjustments: finalProfileAdjustments || {},
    }),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Upload JD file to existing conversation
 */
export const uploadJD = async (
  sessionId: string,
  token: string,
  file: File
): Promise<{
  message: string;
  updated_ideal_profile: IdealProfileCard;
}> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiCall(`/conversation/${sessionId}/upload-jd`, {
    method: "POST",
    body: formData,
    headers: {},
    token,
  });

  return handleApiResponse(response);
};

/**
 * Generate JD from search query
 */
export const generateJD = async (
  token: string,
  searchQuery: string
): Promise<{
  jd_text: string;
  session_id: string;
}> => {
  const response = await apiCall("/conversation/generate-jd", {
    method: "POST",
    body: JSON.stringify({ search_query: searchQuery }),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Refine JD based on feedback
 */
export const refineJD = async (
  token: string,
  data: {
    session_id: string;
    original_query: string;
    previous_jd: string;
    feedback: string;
    retry_count: number;
  }
): Promise<{
  jd_text: string;
  retry_count: number;
  max_retries_reached: boolean;
}> => {
  const response = await apiCall("/conversation/refine-jd", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Start conversation with generated JD text
 */
export const startConversationWithJD = async (
  token: string,
  jdText: string
): Promise<{
  session_id: string;
  donna_greeting: string;
  ideal_profile: IdealProfileCard;
  sample_profile: SampleProfile | null;
  suggested_next_steps: string[];
  stage: string;
}> => {
  const response = await apiCall("/conversation/start", {
    method: "POST",
    body: JSON.stringify({ jd_text: jdText }),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Delete/reset conversation
 */
export const deleteConversation = async (
  sessionId: string,
  token: string
): Promise<{ message: string }> => {
  const response = await apiCall(`/conversation/${sessionId}`, {
    method: "DELETE",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Provide feedback on sample candidates
 */
export const provideFeedback = async (
  sessionId: string,
  token: string,
  feedbackType: "too_junior" | "need_more_skill" | "wrong_industry" | "perfect",
  feedbackData?: Record<string, any>
): Promise<{
  donna_reply: string;
  updated_samples: any[];
  feedback_applied: boolean;
}> => {
  const response = await apiCall(`/conversation/${sessionId}/feedback`, {
    method: "POST",
    body: JSON.stringify({
      feedback_type: feedbackType,
      feedback_data: feedbackData || {},
    }),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get/refresh sample candidates
 */
export const getSampleCandidates = async (
  sessionId: string,
  token: string
): Promise<{
  samples: any[];
  count: number;
}> => {
  const response = await apiCall(`/conversation/${sessionId}/samples`, {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Enrich a single candidate (background)
 */
export const enrichCandidate = async (
  sessionId: string,
  token: string,
  candidateId: string,
  candidate: any
): Promise<{
  status: string;
  candidate_id: string;
  message: string;
}> => {
  const response = await apiCall(
    `/conversation/${sessionId}/enrich-candidate`,
    {
      method: "POST",
      body: JSON.stringify({ candidate_id: candidateId, candidate }),
      token,
    }
  );

  return handleApiResponse(response);
};

/**
 * Get enrichment progress
 */
export interface EnrichmentProgress {
  status:
    | "not_started"
    | "starting"
    | "in_progress"
    | "completed"
    | "failed"
    | "error";
  phase: "idle" | "initializing" | "deep_analysis" | "complete";
  total: number;
  completed: number;
  failed: number;
  progress_percentage: number;
  current_candidate: string;
  message: string;
  candidates: Record<
    string,
    {
      name: string;
      status: string;
      error?: string;
    }
  >;
  started_at?: string;
  completed_at?: string;
}

export const getEnrichmentStatus = async (
  sessionId: string,
  token: string
): Promise<EnrichmentProgress> => {
  const response = await fetch(
    `${API_BASE}/conversation/${sessionId}/enrichment-status`,
    {
      headers: getHeaders(token),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get enrichment status");
  }

  return response.json();
};

/**
 * Process rejection feedback with LLM
 */
export const processRejectionFeedback = async (
  sessionId: string,
  token: string,
  candidate: any,
  reason: string,
  detailedFeedback?: string
): Promise<{
  donna_reply: string;
  refinements_applied: string[];
  new_samples: any[];
  updated_profile: any;
}> => {
  const response = await apiCall(
    `/conversation/${sessionId}/rejection-feedback`,
    {
      method: "POST",
      body: JSON.stringify({
        candidate,
        reason,
        detailed_feedback: detailedFeedback || "",
      }),
      token,
    }
  );

  return handleApiResponse(response);
};

/**
 * Start deep analysis of accepted candidates
 */
export const enrichAcceptedCandidates = async (
  sessionId: string,
  token: string,
  acceptedCandidates: Array<{ candidate: any }>
): Promise<{
  status: string;
  session_id: string;
  total_candidates: number;
  message: string;
}> => {
  const response = await fetch(
    `${API_BASE}/conversation/${sessionId}/enrich-accepted`,
    {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ accepted_candidates: acceptedCandidates }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to start enrichment");
  }

  return response.json();
};
