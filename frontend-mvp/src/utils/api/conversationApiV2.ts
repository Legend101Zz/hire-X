/**
 * Conversation API functions for backend-v2 (Donna AI)
 */

import { apiCall, handleApiResponse } from "../api";
import type {
  StartConversationRequest,
  StartConversationResponse,
  SendMessageRequest,
  SampleProfile,
  ConversationState,
  IdealProfileCard,
} from "@/types";

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

export const sendMessage = async (
  sessionId: string,
  token: string,
  data: SendMessageRequest
): Promise<{
  donna_response: string;
  updated_ideal_profile: IdealProfileCard;
  sample_profile: SampleProfile | null;
  stage: string;
  ready_to_search: boolean;
  suggested_next_steps: string[];
}> => {
  const response = await apiCall(`/conversation/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Get current conversation state
 */
export const getConversationState = async (
  sessionId: string,
  token: string
): Promise<ConversationState> => {
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
    headers: {}, // Let browser set Content-Type for FormData
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
