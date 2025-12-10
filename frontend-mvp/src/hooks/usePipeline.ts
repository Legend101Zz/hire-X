"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Pipeline, PipelineListItem } from "@/types/pipeline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Internal hook to handle authenticated requests.
 * It automatically injects the token from AuthContext and handles 401 logouts.
 */
function useAuthenticatedFetch() {
  const { token, logout } = useAuth();

  const authenticatedFetch = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      // 1. Ensure we have a token before making the request
      if (!token) {
        throw new Error("No authentication token available");
      }

      // 2. Prepare headers
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      };

      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
        });

        // 3. Handle 401 Unauthorized globally
        if (response.status === 401) {
          logout();
          throw new Error("Session expired. Please login again.");
        }

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ detail: "Request failed" }));
          throw new Error(errorData.detail || `Error: ${response.status}`);
        }

        return response.json();
      } catch (error) {
        throw error;
      }
    },
    [token, logout]
  );

  return authenticatedFetch;
}

// ==========================================
// List Pipelines Hook
// ==========================================
export function usePipelineList() {
  const [pipelines, setPipelines] = useState<PipelineListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authFetch = useAuthenticatedFetch();

  const fetchPipelines = useCallback(
    async (status?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);

        const data = await authFetch(`/pipeline/list?${params}`);
        setPipelines(data.pipelines);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch]
  );

  return { pipelines, loading, error, fetchPipelines };
}

// ==========================================
// Single Pipeline Dashboard Hook
// ==========================================
export function usePipelineDashboard(pipelineId: string) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authFetch = useAuthenticatedFetch();

  const fetchDashboard = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    setError(null);
    try {
      // Now calls /enriched endpoint for full analysis
      const data = await authFetch(`/pipeline/${pipelineId}/enriched`);
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, authFetch]);

  return { pipeline, loading, error, fetchDashboard };
}

// ==========================================
// Pipeline Actions Hook
// ==========================================
export function usePipelineActions(pipelineId: string) {
  const [loading, setLoading] = useState(false);
  const authFetch = useAuthenticatedFetch();

  const startEnrichment = async () => {
    setLoading(true);
    try {
      return await authFetch(`/pipeline/${pipelineId}/enrich`, {
        method: "POST",
        body: JSON.stringify({ include_contact_fetch: true }),
      });
    } finally {
      setLoading(false);
    }
  };

  const startOutreach = async () => {
    setLoading(true);
    try {
      return await authFetch(`/pipeline/${pipelineId}/outreach`, {
        method: "POST",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStage = async (newStage: string, notes?: string) => {
    return await authFetch(`/pipeline/${pipelineId}/stage`, {
      method: "PUT",
      body: JSON.stringify({ new_stage: newStage, notes }),
    });
  };

  const rejectCandidate = async (reason: string, feedback?: string) => {
    return await authFetch(`/pipeline/${pipelineId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason, feedback }),
    });
  };

  return {
    loading,
    startEnrichment,
    startOutreach,
    updateStage,
    rejectCandidate,
  };
}
