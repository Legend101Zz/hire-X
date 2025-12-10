"use client";

import { useState, useCallback } from "react";
import {
  SchedulingInfo,
  BookingRequest,
  BookingConfirmation,
  TimeSlot,
} from "@/types/scheduling";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }

  return data;
}

// src/hooks/useScheduling.ts

export function useSchedulingInfo(token: string, testMode: boolean = true) {
  const [info, setInfo] = useState<SchedulingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const queryParams = testMode ? "?test_mode=true" : "";

      // --- FIX STARTS HERE ---
      // 1. Use API_BASE to point to the backend (localhost:8000)
      // 2. Remove '/api' if your backend endpoints start directly with /schedule
      const url = `${API_BASE}/schedule/${token}${queryParams}`;

      const response = await fetch(url);
      // --- FIX ENDS HERE ---

      // Check for HTTP errors (like 404 or 500 from the backend)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.valid) {
        throw new Error(data.error || "Invalid scheduling link");
      }

      setInfo(data);
    } catch (err: any) {
      console.error("Fetch error:", err); // Log for debugging
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, testMode]);

  return { info, loading, error, fetchInfo };
}

export function useBooking(token: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookSlot = async (data: {
    scheduled_datetime: string;
    timezone: string;
    candidate_notes?: string;
    special_requirements?: string;
    phone_number?: string; // ADD THIS
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/schedule/${token}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.error || "Booking failed");
      }

      if (!result.success) {
        throw new Error(result.error || "Booking failed");
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { bookSlot, loading, error };
}

export function useAvailableSlots(token: string) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSlots = useCallback(
    async (daysAhead: number = 14) => {
      setLoading(true);
      try {
        const data = await fetchApi(
          `/schedule/${token}/slots?days_ahead=${daysAhead}`
        );
        setSlots(data.slots || []);
      } catch (err) {
        console.error("Failed to fetch slots:", err);
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return { slots, loading, fetchSlots };
}
