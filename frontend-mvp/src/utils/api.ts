/**
 * Utility functions for making authenticated API calls to the backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

interface ApiOptions extends RequestInit {
  token?: string;
}

/**
 * Make an authenticated API call to the backend
 */
export const apiCall = async (endpoint: string, options: ApiOptions = {}) => {
  const { token, ...fetchOptions } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  return response;
};

/**
 * Handle API response and check for authentication errors
 */
export const handleApiResponse = async (
  response: Response,
  onAuthError?: () => void
) => {
  if (!response.ok) {
    if (response.status === 401 && onAuthError) {
      onAuthError();
      throw new Error('Authentication expired. Please log in again.');
    }
    
    const errorText = await response.text();
    let errorMessage = `HTTP error! status: ${response.status}`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // If response is not JSON, use the text or default message
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
};

/**
 * Make a GET request with authentication
 */
export const apiGet = async (endpoint: string, token: string) => {
  const response = await apiCall(endpoint, {
    method: 'GET',
    token,
  });
  
  return response;
};

/**
 * Make a POST request with authentication
 */
export const apiPost = async (endpoint: string, data: unknown, token: string) => {
  const response = await apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
  
  return response;
};

/**
 * Make a PUT request with authentication
 */
export const apiPut = async (endpoint: string, data: unknown, token: string) => {
  const response = await apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
    token,
  });
  
  return response;
};

/**
 * Make a DELETE request with authentication
 */
export const apiDelete = async (endpoint: string, token: string) => {
  const response = await apiCall(endpoint, {
    method: 'DELETE',
    token,
  });
  
  return response;
};
