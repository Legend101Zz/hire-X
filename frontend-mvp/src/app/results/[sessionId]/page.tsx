/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, handleApiResponse } from '@/utils/api';
import ProfileCards from '@/components/ui/profile-cards';
import Sidebar from '@/components/ui/sidebar';
import Header from '@/components/ui/header';
import PaginationControls from '@/components/ui/pagination-controls';

interface Profile {
  _id: string;
  first_name: string;
  last_name: string;
  title: string;
  location: string;
  country: string;
  seniority_level: string;
  current_industry: string;
  followup_match_score?: number;
  match_reasons?: string[];
  experience: Array<any>;
  education: Array<any>;
  linkedin_url: string;
  summary: string;
  expertise: string;
  functional_area: string;
  departments: string[];
  languages: string[];
  certifications: string[];
  publications: string[];
  patents: string[];
  awards: string[];
  memberships: string[];
  prior_industries: string[];
  organization_id: string;
  profile_picture: string;
  state: string;
  city: string;
}

interface PaginatedResults {
  session_id: string;
  status: string;
  profiles: Profile[];
  summary: any;
  total_profiles_found: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Cache management
interface CacheEntry {
  data: PaginatedResults;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'results_cache_';

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { token, logout } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [results, setResults] = useState<PaginatedResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  // Cache helpers
  const getCacheKey = (page: number) => `${CACHE_KEY_PREFIX}${sessionId}_${page}`;

  const getFromCache = (page: number): PaginatedResults | null => {
    try {
      const cached = localStorage.getItem(getCacheKey(page));
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(getCacheKey(page));
        return null;
      }

      return entry.data;
    } catch (e) {
      console.error('Error reading from cache:', e);
      return null;
    }
  };

  const saveToCache = (page: number, data: PaginatedResults) => {
    try {
      const entry: CacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(getCacheKey(page), JSON.stringify(entry));
    } catch (e) {
      console.error('Error saving to cache:', e);
      // If localStorage is full, clear old cache entries
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        clearOldCache();
      }
    }
  };

  const clearOldCache = () => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));

      // Remove entries older than cache duration
      const now = Date.now();
      cacheKeys.forEach(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const entry: CacheEntry = JSON.parse(cached);
            if (now - entry.timestamp > CACHE_DURATION) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.error('Error clearing old cache:', e);
    }
  };

  // Prefetch adjacent pages
  const prefetchPage = useCallback(async (page: number) => {
    if (!token || !sessionId) return;

    // Check if already in cache
    if (getFromCache(page)) {
      return;
    }

    try {
      const response = await apiGet(
        `/session/${sessionId}/results?page=${page}&page_size=10`,
        token
      );
      const data = await handleApiResponse(response, () => {
        logout();
      });

      if (data.status === 'completed') {
        saveToCache(page, data);
      }
    } catch (err) {
      // Silent fail for prefetch
      console.log(`Prefetch failed for page ${page}:`, err);
    }
  }, [sessionId, token, logout]);

  const fetchResults = useCallback(async (page: number) => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        setError('Authentication required');
        return;
      }

      // Check cache first
      const cachedData = getFromCache(page);
      if (cachedData) {
        console.log(`📦 Using cached data for page ${page}`);
        setResults(cachedData);
        setIsProcessing(false);
        setLoading(false);

        // Prefetch adjacent pages in background
        if (cachedData.has_next) {
          prefetchPage(page + 1);
        }
        if (cachedData.has_prev) {
          prefetchPage(page - 1);
        }
        return;
      }

      // Fetch from API
      const response = await apiGet(
        `/session/${sessionId}/results?page=${page}&page_size=10`,
        token
      );
      const data = await handleApiResponse(response, () => {
        logout();
        setError('Authentication expired. Please log in again.');
      });

      if (data.status === 'processing') {
        setIsProcessing(true);
        setError('Results are still being processed. Please check back later.');
        return;
      }

      if (data.status === 'completed') {
        setResults(data);
        setIsProcessing(false);

        // Save to cache
        saveToCache(page, data);

        // Prefetch adjacent pages
        if (data.has_next) {
          prefetchPage(page + 1);
        }
        if (data.has_prev) {
          prefetchPage(page - 1);
        }
      } else {
        setError('No profiles found for this session.');
      }

    } catch (err) {
      setError('Failed to fetch results. Please try again.');
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, token, logout, prefetchPage]);

  // Fetch results when page changes
  useEffect(() => {
    if (sessionId && token) {
      fetchResults(currentPage);
    }
  }, [sessionId, token, currentPage, fetchResults]);

  // WebSocket connection for real-time updates (only connects once)
  useEffect(() => {
    if (!sessionId || !token) return;

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';
    const ws = new WebSocket(`${wsBaseUrl}/session/${sessionId}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      console.log('🔌 WebSocket connected for results page, session:', sessionId);
    };

    ws.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', messageData);

        switch (messageData.action) {
          case 'progress_update':
            const { message, progress: progressValue } = messageData.data;
            setProgressMessage(message);
            setProgress(progressValue);
            break;

          case 'direct_profiles':
          case 'final_results':
            console.log('📊 Results ready - refetching page 1');
            setIsProcessing(false);
            // Clear cache and refetch page 1
            clearOldCache();
            if (currentPage === 1) {
              fetchResults(1);
            } else {
              setCurrentPage(1); // This will trigger fetchResults via useEffect
            }
            break;

          case 'workflow_status':
            if (messageData.data === 'completed') {
              setIsProcessing(false);
              setProgressMessage('✅ Workflow completed!');
              clearOldCache();
              fetchResults(currentPage);
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [sessionId, token]); // Only depend on sessionId and token, not currentPage

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && !results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading results...</p>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-900 mb-2">Processing Your Request</p>
              {progressMessage && (
                <p className="text-gray-600 mb-2">{progressMessage}</p>
              )}
              {progress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div
                    className="bg-violet-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
              <p className="text-sm text-gray-500">Please keep this page open.</p>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
              <button
                onClick={() => fetchResults(currentPage)}
                className="bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    );
  }

  if (!results || !results.profiles || results.profiles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                <p className="font-medium">No Results Found</p>
                <p>No profiles match your search criteria.</p>
              </div>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col overflow-hidden pl-64">
        <Header />
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Results summary */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Search Results
                </h2>
                <p className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, results.total_profiles_found)} of {results.total_profiles_found} profiles
                </p>
              </div>
              {results.summary && results.summary.average_score > 0 && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Average Match Score</p>
                  <p className="text-2xl font-bold text-violet-600">
                    {(results.summary.average_score * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Profile cards */}
          <div className="flex-1 overflow-y-auto">
            <ProfileCards profiles={results.profiles} />
          </div>

          {/* Pagination controls */}
          <div className="bg-white border-t border-gray-200">
            <PaginationControls
              currentPage={currentPage}
              totalPages={results.total_pages}
              hasNext={results.has_next}
              hasPrev={results.has_prev}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </div>
        </div>
      </div>
      <Sidebar />
    </div>
  );
}