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
import FiltersPanel from '@/components/ui/filters-panel';
import BulkActionsBar from '@/components/ui/bulk-actions-bar';

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

interface CacheEntry {
  data: PaginatedResults;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000;
const CACHE_KEY_PREFIX = 'results_cache_';

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { token, logout } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [results, setResults] = useState<PaginatedResults | null>(null);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  // Bulk selection
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());

  // Cache helpers remain the same...
  const getCacheKey = (page: number) => `${CACHE_KEY_PREFIX}${sessionId}_${page}`;

  const getFromCache = (page: number): PaginatedResults | null => {
    try {
      const cached = localStorage.getItem(getCacheKey(page));
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);
      const now = Date.now();

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
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        clearOldCache();
      }
    }
  };

  const clearOldCache = () => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));

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

  const prefetchPage = useCallback(async (page: number) => {
    if (!token || !sessionId || getFromCache(page)) return;

    try {
      const response = await apiGet(
        `/session/${sessionId}/results?page=${page}&page_size=10`,
        token
      );
      const data = await handleApiResponse(response, () => logout());

      if (data.status === 'completed') {
        saveToCache(page, data);
      }
    } catch (err) {
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

      const cachedData = getFromCache(page);
      if (cachedData) {
        console.log(`Using cached data for page ${page}`);
        setResults(cachedData);
        setFilteredProfiles(cachedData.profiles);
        setIsProcessing(false);
        setLoading(false);

        if (cachedData.has_next) prefetchPage(page + 1);
        if (cachedData.has_prev) prefetchPage(page - 1);
        return;
      }

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
        setError('Results are still being processed.');
        return;
      }

      if (data.status === 'completed') {
        setResults(data);
        setFilteredProfiles(data.profiles);
        setIsProcessing(false);

        saveToCache(page, data);

        if (data.has_next) prefetchPage(page + 1);
        if (data.has_prev) prefetchPage(page - 1);
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

  useEffect(() => {
    if (sessionId && token) {
      fetchResults(currentPage);
    }
  }, [sessionId, token, currentPage, fetchResults]);

  // WebSocket connection (keep as is)
  useEffect(() => {
    if (!sessionId || !token) return;

    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';
    const ws = new WebSocket(`${wsBaseUrl}/session/${sessionId}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => console.log('WebSocket connected');

    ws.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data);

        switch (messageData.action) {
          case 'progress_update':
            setProgressMessage(messageData.data.message);
            setProgress(messageData.data.progress);
            break;
          case 'direct_profiles':
          case 'final_results':
            setIsProcessing(false);
            clearOldCache();
            if (currentPage === 1) {
              fetchResults(1);
            } else {
              setCurrentPage(1);
            }
            break;
          case 'workflow_status':
            if (messageData.data === 'completed') {
              setIsProcessing(false);
              setProgressMessage('Workflow completed!');
              clearOldCache();
              fetchResults(currentPage);
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    return () => ws.close();
  }, [sessionId, token]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSelectedProfiles(new Set()); // Clear selection on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (filtered: Profile[]) => {
    setFilteredProfiles(filtered);
  };

  const handleSelectProfile = (profileId: string) => {
    const newSet = new Set(selectedProfiles);
    if (newSet.has(profileId)) {
      newSet.delete(profileId);
    } else {
      newSet.add(profileId);
    }
    setSelectedProfiles(newSet);
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredProfiles.map(p => p._id));
    setSelectedProfiles(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedProfiles(new Set());
  };

  const handleBulkShortlist = () => {
    try {
      const existingShortlist = JSON.parse(localStorage.getItem('shortlistedProfiles') || '[]');
      const selectedProfilesData = filteredProfiles.filter(p => selectedProfiles.has(p._id));

      // Add selected profiles to shortlist (avoid duplicates)
      const existingIds = new Set(existingShortlist.map((p: any) => p._id));
      const newProfiles = selectedProfilesData.filter(p => !existingIds.has(p._id));

      const updatedShortlist = [...existingShortlist, ...newProfiles];
      localStorage.setItem('shortlistedProfiles', JSON.stringify(updatedShortlist));

      // Dispatch event
      window.dispatchEvent(new CustomEvent('shortlistUpdated', {
        detail: { count: updatedShortlist.length }
      }));

      // Clear selection
      setSelectedProfiles(new Set());

      alert(`Added ${newProfiles.length} profile(s) to shortlist!`);
    } catch (error) {
      console.error('Error adding to shortlist:', error);
      alert('Failed to add profiles to shortlist');
    }
  };

  const handleBulkExport = () => {
    const selectedProfilesData = filteredProfiles.filter(p => selectedProfiles.has(p._id));
    const csv = generateCSV(selectedProfilesData);
    downloadCSV(csv, `profiles-${sessionId}-export.csv`);
  };

  const generateCSV = (profiles: Profile[]) => {
    const headers = ['First Name', 'Last Name', 'Title', 'Location', 'Industry', 'LinkedIn URL'];
    const rows = profiles.map(p => [
      p.first_name || '',
      p.last_name || '',
      p.title || '',
      p.location || '',
      p.current_industry || '',
      p.linkedin_url || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Loading states remain the same...
  if (loading && !results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Loading results...</p>
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
              <p className="text-lg font-semibold text-gray-900 mb-2">Processing Your Request</p>
              {progressMessage && <p className="text-sm text-gray-600 mb-2">{progressMessage}</p>}
              {progress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div className="bg-violet-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                </div>
              )}
              <p className="text-xs text-gray-500">Please keep this page open.</p>
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
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-4">
                <p className="font-medium mb-1">Error</p>
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={() => fetchResults(currentPage)}
                className="bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
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
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg">
                <p className="font-medium mb-1">No Results Found</p>
                <p className="text-sm">No profiles match your search criteria.</p>
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
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Results Header */}
          <div className="bg-white px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {filteredProfiles.length}
                  <span className="text-base font-normal text-gray-500 ml-2">
                    {filteredProfiles.length === 1 ? 'profile' : 'profiles'}
                  </span>
                </h1>
                {filteredProfiles.length !== results.total_profiles_found && (
                  <span className="text-sm text-gray-500">
                    from {results.total_profiles_found} total
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Page {currentPage} of {results.total_pages}
              </p>
            </div>
            {results.summary && results.summary.average_score > 0 && (
              <div className="text-right">
                <div className="inline-flex flex-col items-end bg-violet-50 px-4 py-3 rounded-lg border border-violet-200">
                  <p className="text-xs text-violet-600 font-semibold uppercase tracking-wide">
                    Avg Match
                  </p>
                  <p className="text-3xl font-bold text-violet-700">
                    {(results.summary.average_score * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          {results.profiles.length > 0 && (
            <FiltersPanel
              profiles={results.profiles}
              onFilterChange={handleFilterChange}
            />
          )}

          {/* Bulk Actions */}
          <BulkActionsBar
            selectedCount={selectedProfiles.size}
            totalCount={filteredProfiles.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onShortlist={handleBulkShortlist}
            onExport={handleBulkExport}
          />

          {/* Profile Cards */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <ProfileCards
              profiles={filteredProfiles}
              selectedProfiles={selectedProfiles}
              onSelectProfile={handleSelectProfile}
            />
          </div>

          {/* Pagination */}
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