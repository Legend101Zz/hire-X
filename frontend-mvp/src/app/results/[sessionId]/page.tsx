'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet, handleApiResponse } from '@/utils/api';
import ProfileCards from '@/components/ui/profile-cards';
import Sidebar from '@/components/ui/sidebar';
import Header from '@/components/ui/header';

interface Profile {
  first_name: string;
  last_name: string;
  title: string;
  location: string;
  country: string;
  seniority_level: string;
  current_industry: string;
  experience: Array<{
    title: string;
    company: string;
    current: number;
    startDate: string;
    endDate: string;
    summary?: string;
    country?: string;
    companyLinkedinUrl?: string;
    companyUrl_cleaned?: string;
    industry?: string;
    companyUrl?: string;
    sequenceNo?: number;
    maxEmployeeSize?: string;
    minEmployeeSize?: string;
    location?: string;
  }>;
  education: Array<{
    major: string;
    universityUrl: string;
    campus: string;
    startDate: string;
    endDate: string;
    sequenceNo?: number;
    universityLinkedInUrl?: string;
    specialization?: string;
  }>;
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

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { token, logout } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!token) {
          setError('Authentication required');
          return;
        }
        
        const response = await apiGet(`/session/${sessionId}/results`, token);
        const data = await handleApiResponse(response, () => {
          logout();
          setError('Authentication expired. Please log in again.');
        });
        
        if (data.status === 'processing') {
          setIsProcessing(true);
          setError('Results are still being processed. Please check back later.');
          return;
        }
        
        if (data.status === 'completed' && (!data.profiles || data.profiles.length === 0)) {
          setError('No profiles found for this session.');
          return;
        }
        
        if (data.profiles && Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
          setIsProcessing(false);
        } else {
          setError('No profiles found in results');
        }
        
      } catch (err) {
        setError('Failed to fetch results. Please check if the backend server is running.');
        console.error('Error fetching results:', err);
      } finally {
        setLoading(false);
      }
    };

    if (sessionId && token) {
      fetchResults();
    }
  }, [sessionId, retryCount, token, logout]);

  // WebSocket connection for real-time updates
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
        console.log('📨 WebSocket message received on results page:', messageData);
        
        switch (messageData.action) {
          case 'progress_update':
            console.log('📊 Progress update received:', messageData.data);
            const { message, progress: progressValue } = messageData.data;
            setProgressMessage(message);
            setProgress(progressValue);
            break;
          case 'direct_profiles':
            console.log('📊 Direct profiles received:', messageData.data);
            if (messageData.data.profiles && Array.isArray(messageData.data.profiles)) {
              setProfiles(messageData.data.profiles);
              setIsProcessing(false);
            }
            break;
          case 'final_results':
            console.log('📊 Final results received:', messageData.data);
            if (messageData.data.profiles && Array.isArray(messageData.data.profiles)) {
              setProfiles(messageData.data.profiles);
              setIsProcessing(false);
            }
            break;
          case 'workflow_status':
            console.log('📊 Workflow status update:', messageData.data);
            if (messageData.data === 'completed') {
              setIsProcessing(false);
              setProgressMessage('✅ Workflow completed!');
              setProgress(100);
            }
            break;
          default:
            console.log('🤷 Unknown action type on results page:', messageData.action);
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message on results page:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected for results page, session:', sessionId);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error on results page:', error);
    };

    return () => {
      ws.close();
    };
  }, [sessionId, token]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-violet-700 font-medium">Loading results...</p>
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
            <div className="text-center max-w-md mx-auto">
              <div className="animate-pulse">
                <div className="h-16 w-16 bg-violet-200 rounded-full mx-auto mb-4"></div>
                <div className="h-4 bg-violet-200 rounded w-3/4 mx-auto mb-2"></div>
                <div className="h-4 bg-violet-200 rounded w-1/2 mx-auto"></div>
              </div>
              
              {/* Progress Bar */}
              {progress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-violet-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
              
              {/* Progress Message */}
              {progressMessage && (
                <p className="text-violet-700 font-medium mt-4 mb-2">{progressMessage}</p>
              )}
              
              <p className="text-gray-600 text-sm mt-2">This may take a few minutes. Please keep this page open.</p>
              <button 
                onClick={handleRetry}
                className="mt-4 bg-violet-600 text-white px-4 py-2 rounded hover:bg-violet-700 transition-colors"
              >
                Check Again
              </button>
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
                onClick={handleRetry}
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

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                <p className="font-medium">Invalid Session</p>
                <p>No session ID provided</p>
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
        <div className="flex-1 overflow-hidden">
          <ProfileCards profiles={profiles} />
        </div>
      </div>
      <Sidebar />
    </div>
  );
}
