/**
 * Conversation API functions for backend-v2 (Donna AI)
 */

import { apiCall, handleApiResponse } from "../api";
import type {
  StartConversationRequest,
  StartConversationResponse,
  SendMessageRequest,
  SendMessageResponse,
  ConversationState,
  IdealProfileCard,
} from "@/types";

/**
 * Start a new conversation with Donna
 */
export const startConversation = async (
  token: string,
  data?: StartConversationRequest
): Promise<StartConversationResponse> => {
  const response = await apiCall("/conversation/start", {
    method: "POST",
    body: JSON.stringify(data || {}),
    token,
  });

  return handleApiResponse(response);
};

/**
 * Send a message in an ongoing conversation
 */
export const sendMessage = async (
  sessionId: string,
  token: string,
  data: SendMessageRequest
): Promise<SendMessageResponse> => {
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
