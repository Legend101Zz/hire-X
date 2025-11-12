"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type {
  IdealProfileCard,
  SearchFilters,
  EnrichedCandidate,
  PaginationInfo,
  ResultsOverview,
} from "@/types";

interface SearchContextType {
  // Search state
  sessionId: string | null;
  idealProfile: IdealProfileCard | null;
  isSearching: boolean;
  searchError: string | null;

  // Results state
  candidates: EnrichedCandidate[];
  resultsOverview: ResultsOverview | null;
  pagination: PaginationInfo | null;
  filters: SearchFilters;
  sortBy: "match_score" | "salary" | "response_likelihood";
  sortOrder: "asc" | "desc";
  isLoadingResults: boolean;

  // Progress state
  progress: number; // 0-100
  progressMessage: string;

  // Actions
  setSessionId: (sessionId: string | null) => void;
  setIdealProfile: (profile: IdealProfileCard | null) => void;
  setIsSearching: (isSearching: boolean) => void;
  setSearchError: (error: string | null) => void;
  setCandidates: (candidates: EnrichedCandidate[]) => void;
  setResultsOverview: (overview: ResultsOverview | null) => void;
  setPagination: (pagination: PaginationInfo | null) => void;
  setFilters: (filters: SearchFilters) => void;
  setSortBy: (sortBy: "match_score" | "salary" | "response_likelihood") => void;
  setSortOrder: (sortOrder: "asc" | "desc") => void;
  setIsLoadingResults: (isLoading: boolean) => void;
  setProgress: (progress: number) => void;
  setProgressMessage: (message: string) => void;
  resetSearch: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
};

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Search state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [idealProfile, setIdealProfile] = useState<IdealProfileCard | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Results state
  const [candidates, setCandidates] = useState<EnrichedCandidate[]>([]);
  const [resultsOverview, setResultsOverview] = useState<ResultsOverview | null>(
    null
  );
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sortBy, setSortBy] = useState<
    "match_score" | "salary" | "response_likelihood"
  >("match_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // Progress state
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // Reset all search state
  const resetSearch = useCallback(() => {
    setSessionId(null);
    setIdealProfile(null);
    setIsSearching(false);
    setSearchError(null);
    setCandidates([]);
    setResultsOverview(null);
    setPagination(null);
    setFilters({});
    setSortBy("match_score");
    setSortOrder("desc");
    setIsLoadingResults(false);
    setProgress(0);
    setProgressMessage("");
  }, []);

  const value = {
    sessionId,
    idealProfile,
    isSearching,
    searchError,
    candidates,
    resultsOverview,
    pagination,
    filters,
    sortBy,
    sortOrder,
    isLoadingResults,
    progress,
    progressMessage,
    setSessionId,
    setIdealProfile,
    setIsSearching,
    setSearchError,
    setCandidates,
    setResultsOverview,
    setPagination,
    setFilters,
    setSortBy,
    setSortOrder,
    setIsLoadingResults,
    setProgress,
    setProgressMessage,
    resetSearch,
  };

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
};
