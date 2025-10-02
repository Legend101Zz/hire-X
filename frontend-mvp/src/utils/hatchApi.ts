/**
 * Hatch API service for fetching candidate contact information
 */
import { apiPost } from "./api";

export interface HatchContactResult {
  success: boolean;
  profile_id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  source?: "cache" | "api";
  message?: string;
  error?: string;
  cached_at?: string;
  errors?: {
    phone?: string;
    email?: string;
  };
}

export interface HatchBulkContactResponse {
  success: boolean;
  count: number;
  results: HatchContactResult[];
}

/**
 * Fetch contact info for a single candidate
 */
export const fetchSingleContact = async (
  profileId: string,
  sessionId: string,
  token: string
): Promise<HatchContactResult> => {
  try {
    const response = await apiPost(
      "/hatch/contact",
      {
        profile_id: profileId,
        session_id: sessionId,
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to fetch contact: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching single contact:", error);
    throw error;
  }
};

/**
 * Fetch contact info for multiple candidates (max 5)
 */
export const fetchBulkContacts = async (
  profileIds: string[],
  sessionId: string,
  token: string
): Promise<HatchBulkContactResponse> => {
  if (profileIds.length > 5) {
    throw new Error("Maximum 5 profiles allowed per bulk request");
  }

  try {
    const response = await apiPost(
      "/hatch/bulk-contact",
      {
        profile_ids: profileIds,
        session_id: sessionId,
      },
      token
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to fetch contacts: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching bulk contacts:", error);
    throw error;
  }
};
