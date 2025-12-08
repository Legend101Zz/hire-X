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

export function useSchedulingInfo(token: string) {
  const [info, setInfo] = useState<SchedulingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchApi(`/schedule/${token}`);
      setInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { info, loading, error, fetchInfo };
}

export function useBooking(token: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(
    null
  );

  const bookSlot = async (
    booking: BookingRequest
  ): Promise<BookingConfirmation> => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchApi(`/schedule/${token}/book`, {
        method: "POST",
        body: JSON.stringify(booking),
      });

      setConfirmation(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reschedule = async (
    newDatetime: string,
    reason: string,
    details?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchApi(`/schedule/${token}/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          new_datetime: newDatetime,
          reason,
          reason_details: details,
        }),
      });
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancel = async (reason?: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchApi(
        `/schedule/${token}/cancel?reason=${encodeURIComponent(reason || "")}`,
        {
          method: "POST",
        }
      );
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, confirmation, bookSlot, reschedule, cancel };
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
