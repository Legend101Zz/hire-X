/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Configuration API Client
 *
 * Handles all API calls related to model configuration, presets, and user preferences
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Model options for different tasks
 */
export interface ModelOption {
  model_id: string;
  display_name: string;
  provider: string;
  context_window: number;
  cost_per_1k_tokens: number;
  recommended_for?: string[];
  description?: string;
}

/**
 * Model configuration for a specific task
 */
export interface ModelConfig {
  task: "parsing" | "scoring" | "conversation" | "enrichment";
  model_id: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Preset configuration
 */
export interface ModelPreset {
  preset_id: string;
  name: string;
  description: string;
  configs: ModelConfig[];
  estimated_cost_per_search?: number;
  recommended_for?: string;
}

/**
 * User's model configuration
 */
export interface UserModelConfig {
  user_id: string;
  configs: ModelConfig[];
  active_preset?: string;
  updated_at: string;
}

/**
 * Response from applying a preset
 */
export interface ApplyPresetResponse {
  success: boolean;
  message: string;
  applied_configs: ModelConfig[];
}

/**
 * Get available model options
 */
export async function getModelOptions(token: string): Promise<ModelOption[]> {
  const response = await fetch(`${API_BASE_URL}/api/config/models/options`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch model options");
  }

  const data = await response.json();
  return data.models || [];
}

/**
 * Get available presets
 */
export async function getPresets(token: string): Promise<ModelPreset[]> {
  const response = await fetch(`${API_BASE_URL}/api/config/models/presets`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch presets");
  }

  const data = await response.json();
  return data.presets || [];
}

/**
 * Apply a preset to a session
 */
export async function applyPreset(
  sessionId: string,
  presetId: string,
  token: string
): Promise<ApplyPresetResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/config/session/${sessionId}/preset`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ preset_id: presetId }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to apply preset");
  }

  return await response.json();
}

/**
 * Get user's current model configuration
 */
export async function getUserConfig(token: string): Promise<UserModelConfig> {
  const response = await fetch(`${API_BASE_URL}/api/config/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user configuration");
  }

  return await response.json();
}

/**
 * Update user's model configuration
 */
export async function updateUserConfig(
  configs: ModelConfig[],
  token: string
): Promise<UserModelConfig> {
  const response = await fetch(`${API_BASE_URL}/api/config/user`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ configs }),
  });

  if (!response.ok) {
    throw new Error("Failed to update user configuration");
  }

  return await response.json();
}

/**
 * Get configuration for a specific session
 */
export async function getSessionConfig(
  sessionId: string,
  token: string
): Promise<ModelConfig[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/config/session/${sessionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch session configuration");
  }

  const data = await response.json();
  return data.configs || [];
}

/**
 * Update configuration for a specific session
 */
export async function updateSessionConfig(
  sessionId: string,
  configs: ModelConfig[],
  token: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/config/session/${sessionId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ configs }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update session configuration");
  }

  return await response.json();
}

/**
 * Calculate estimated cost for a configuration
 */
export async function calculateEstimatedCost(
  configs: ModelConfig[],
  candidateCount: number,
  token: string
): Promise<{
  total_cost: number;
  breakdown: Array<{
    task: string;
    model: string;
    cost: number;
  }>;
}> {
  const response = await fetch(`${API_BASE_URL}/api/config/estimate-cost`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      configs,
      candidate_count: candidateCount,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to calculate cost estimate");
  }

  return await response.json();
}

/**
 * Get model recommendations based on search criteria
 */
export async function getModelRecommendations(
  searchCriteria: {
    role?: string;
    complexity?: "simple" | "moderate" | "complex";
    candidate_count?: number;
    budget?: "low" | "medium" | "high";
  },
  token: string
): Promise<{
  recommended_preset: string;
  reasoning: string;
  alternatives: string[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/config/recommendations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchCriteria),
  });

  if (!response.ok) {
    throw new Error("Failed to get recommendations");
  }

  return await response.json();
}

// Type guards
export function isValidModelConfig(config: any): config is ModelConfig {
  return (
    config &&
    typeof config === "object" &&
    typeof config.task === "string" &&
    typeof config.model_id === "string"
  );
}

export function isValidPreset(preset: any): preset is ModelPreset {
  return (
    preset &&
    typeof preset === "object" &&
    typeof preset.preset_id === "string" &&
    typeof preset.name === "string" &&
    Array.isArray(preset.configs)
  );
}

// Export a default object with all functions
export default {
  getModelOptions,
  getPresets,
  applyPreset,
  getUserConfig,
  updateUserConfig,
  getSessionConfig,
  updateSessionConfig,
  calculateEstimatedCost,
  getModelRecommendations,
};
