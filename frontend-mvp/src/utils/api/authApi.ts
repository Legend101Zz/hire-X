/**
 * Authentication API functions for backend-v2
 */

import { apiCall, handleApiResponse } from "../api";
import type { LoginResponse, User, RegisterRequest } from "@/types";

/**
 * Login with username/email and password
 */
export const login = async (
  username: string,
  password: string
): Promise<LoginResponse> => {
  const response = await apiCall("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  return handleApiResponse(response);
};

/**
 * Register a new user account
 */
export const register = async (
  data: RegisterRequest
): Promise<{ username: string; email: string; full_name: string; message: string }> => {
  const response = await apiCall("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

  return handleApiResponse(response);
};

/**
 * Get current user information
 */
export const getCurrentUser = async (token: string): Promise<User> => {
  const response = await apiCall("/auth/me", {
    method: "GET",
    token,
  });

  return handleApiResponse(response);
};

/**
 * Logout (client-side token deletion)
 */
export const logout = async (): Promise<{ message: string }> => {
  const response = await apiCall("/auth/logout", {
    method: "POST",
  });

  return handleApiResponse(response);
};
