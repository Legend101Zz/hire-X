/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchProgress from '@/components/progress/SearchProgress';
import QueryRefinement from '@/components/search/QueryRefinement';
import ResultsList from '@/components/results/ResultsList';

export default function SearchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session');

    const [status, setStatus] = useState<'processing' | 'refinement' | 'completed' | 'error'>('processing');
    const [results, setResults] = useState<any>(null);
    const [preflightResults, setPreflightResults] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Redirect if no session
    useEffect(() => {
        if (!sessionId) {
            router.push('/');
        }
    }, [sessionId, router]);

    const handleSearchComplete = (searchResults: any) => {
        setResults(searchResults);
        setStatus('completed');
    };

    const handleNeedsRefinement = (preflight: any) => {
        setPreflightResults(preflight);
        setStatus('refinement');
    };

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
        setStatus('error');
    };

    const handleRefine = async (refinements: { [key: string]: string }) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/refine`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ refinements }),
                }
            );

            if (response.ok) {
                // Restart the progress monitoring
                setStatus('processing');
                setPreflightResults(null);
            }
        } catch (error) {
            console.error('Error refining query:', error);
        }
    };

    const handleCancelRefinement = () => {
        router.push('/');
    };

    const handleLoadMore = async () => {
        if (!sessionId || isLoadingMore) return;

        setIsLoadingMore(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/load-more`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ batch_size: 10 }),
                }
            );

            if (response.ok) {
                const data = await response.json();

                // Merge new summaries into existing results
                const updatedResults = { ...results };

                // Update matched_profiles with new AI summaries
                data.summaries.forEach((summary: any, profileId: string) => {
                    const profileIndex = updatedResults.results.findIndex(
                        (p: any) => (p.profile_id || p._id) === profileId
                    );

                    if (profileIndex !== -1) {
                        updatedResults.results[profileIndex] = {
                            ...updatedResults.results[profileIndex],
                            ...summary,
                        };
                    }
                });

                // Update summary_generation stats
                updatedResults.summary_generation = {
                    ...updatedResults.summary_generation,
                    summaries_generated: data.total_generated,
                };

                setResults(updatedResults);
            }
        } catch (error) {
            console.error('Error loading more:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    if (!sessionId) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Processing */}
            {status === 'processing' && (
                <SearchProgress
                    sessionId={sessionId}
                    onComplete={handleSearchComplete}
                    onNeedsRefinement={handleNeedsRefinement}
                    onError={handleError}
                />
            )}

            {/* Refinement Needed */}
            {status === 'refinement' && preflightResults && (
                <QueryRefinement
                    preflightResults={preflightResults}
                    onRefine={handleRefine}
                    onCancel={handleCancelRefinement}
                />
            )}

            {/* Error */}
            {status === 'error' && (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">❌</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Search Failed</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Start New Search
                        </button>
                    </div>
                </div>
            )}

            {/* Results */}
            {status === 'completed' && results && (
                <ResultsList
                    results={results}
                    sessionId={sessionId}
                    onLoadMore={handleLoadMore}
                    isLoadingMore={isLoadingMore}
                />
            )}
        </div>
    );
}