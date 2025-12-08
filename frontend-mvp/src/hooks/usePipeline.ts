import { useState, useCallback } from "react";
import {
  Pipeline,
  PipelineListItem,
  PipelineCandidate,
} from "@/types/pipeline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
}

// List pipelines
export function usePipelineList() {
  const [pipelines, setPipelines] = useState<PipelineListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const data = await fetchWithAuth(`/pipeline/list?${params}`);
      setPipelines(data.pipelines);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { pipelines, loading, error, fetchPipelines };
}

// Single pipeline dashboard
export function usePipelineDashboard(pipelineId: string) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`/pipeline/${pipelineId}/dashboard`);
      setPipeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  return { pipeline, loading, error, fetchDashboard, setPipeline };
}

// Pipeline actions
export function usePipelineActions(pipelineId: string) {
  const [loading, setLoading] = useState(false);

  const shortlistCandidates = async (candidateIds: string[]) => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/pipeline/${pipelineId}/shortlist`, {
        method: "POST",
        body: JSON.stringify({ candidate_ids: candidateIds }),
      });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const startEnrichment = async (candidateIds?: string[]) => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/pipeline/${pipelineId}/enrich`, {
        method: "POST",
        body: JSON.stringify({
          candidate_ids: candidateIds,
          include_contact_fetch: true,
        }),
      });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const startOutreach = async (candidateIds?: string[]) => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/pipeline/${pipelineId}/outreach`, {
        method: "POST",
        body: JSON.stringify({ candidate_ids: candidateIds }),
      });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const updateCandidateStage = async (
    candidateId: string,
    newStage: string,
    notes?: string
  ) => {
    const data = await fetchWithAuth(
      `/pipeline/${pipelineId}/candidates/${candidateId}/stage`,
      {
        method: "PUT",
        body: JSON.stringify({ new_stage: newStage, notes }),
      }
    );
    return data;
  };

  const toggleFavorite = async (candidateId: string) => {
    const data = await fetchWithAuth(
      `/pipeline/${pipelineId}/candidates/${candidateId}/favorite`,
      {
        method: "POST",
      }
    );
    return data;
  };

  const rejectCandidate = async (
    candidateId: string,
    reason: string,
    feedback?: string
  ) => {
    const data = await fetchWithAuth(
      `/pipeline/${pipelineId}/candidates/${candidateId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason, feedback }),
      }
    );
    return data;
  };

  const bulkAction = async (
    candidateIds: string[],
    action: string,
    reason?: string
  ) => {
    const data = await fetchWithAuth(`/pipeline/${pipelineId}/bulk-action`, {
      method: "POST",
      body: JSON.stringify({ candidate_ids: candidateIds, action, reason }),
    });
    return data;
  };

  return {
    loading,
    shortlistCandidates,
    startEnrichment,
    startOutreach,
    updateCandidateStage,
    toggleFavorite,
    rejectCandidate,
    bulkAction,
  };
}
