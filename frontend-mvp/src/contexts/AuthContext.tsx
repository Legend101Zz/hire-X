"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import * as authApi from "@/utils/api/authApi";
import type { User } from "@/types";

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    email: string,
    password: string,
    fullName: string
  ) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");

    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Failed to parse saved user data:", err);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(username, password);

      // Store user data and token
      const userData: User = {
        username: response.username,
        email: "", // Will be fetched separately if needed
        full_name: "",
      };

      setUser(userData);
      setToken(response.access_token);
      setIsAuthenticated(true);

      // Persist to localStorage
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", response.access_token);

      setIsLoading(false);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      console.error("Login error:", err);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    fullName: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await authApi.register({
        username,
        email,
        password,
        full_name: fullName,
      });

      // Auto-login after successful registration
      const success = await login(username, password);
      return success;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);
      console.error("Registration error:", err);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setError(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const value = {
    isAuthenticated,
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
