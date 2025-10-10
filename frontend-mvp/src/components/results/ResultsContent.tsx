/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    TrendingUp,
    RefreshCw,
    Filter,
    Download,
    Users,
    ChevronDown,
    ChevronUp,
    Award,
    Target
} from 'lucide-react';
import CandidateCard from './CandidateCard';
import ProfileDetailModal from './ProfileDetailModal';

interface ResultsContentProps {
    sessionId: string;
}

export default function ResultsContent({ sessionId }: ResultsContentProps) {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isRanking, setIsRanking] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
    const [showUnranked, setShowUnranked] = useState(false);

    useEffect(() => {
        fetchResults();
    }, [sessionId]);

    const fetchResults = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/results`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('res', results)
                setResults(data);
            }
        } catch (error) {
            console.error('Error fetching results:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRankMore = async () => {
        setIsRanking(true);
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
                await fetchResults(); // Refresh to get new summaries
            }
        } catch (error) {
            console.error('Error ranking more:', error);
        } finally {
            setIsRanking(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading results...</p>
                </div>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-gray-600">No results found</p>
                </div>
            </div>
        );
    }

    // Separate AI-ranked and unranked profiles
    const aiRanked = results.matched_profiles
        .filter((p: any) => results.ai_summaries[p.profile_id])
        .map((p: any) => ({
            ...p,
            ...results.ai_summaries[p.profile_id]
        }))
        .sort((a: any, b: any) => (b.final_score || 0) - (a.final_score || 0));

    const unranked = results.matched_profiles.filter(
        (p: any) => !results.ai_summaries[p.profile_id]
    );

    const canRankMore = unranked.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header Section */}
            <div className="mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100"
                >
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Search Results
                            </h1>
                            <p className="text-gray-600">{results.prompt}</p>
                        </div>
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard
                            icon={<Users className="w-5 h-5" />}
                            label="Total Matches"
                            value={results.summary_generation.total_profiles}
                            color="blue"
                        />
                        <StatCard
                            icon={<Sparkles className="w-5 h-5" />}
                            label="AI Ranked"
                            value={results.summary_generation.summaries_generated}
                            color="purple"
                        />
                        <StatCard
                            icon={<Award className="w-5 h-5" />}
                            label="Top Score"
                            value={aiRanked[0]?.final_score ? `${aiRanked[0].final_score}%` : 'N/A'}
                            color="green"
                        />
                        <StatCard
                            icon={<Target className="w-5 h-5" />}
                            label="Avg Pre-Score"
                            value={`${(results.matched_profiles.reduce((sum: number, p: any) => sum + p.pre_score, 0) / results.matched_profiles.length).toFixed(1)}`}
                            color="orange"
                        />
                    </div>
                </motion.div>
            </div>

            {/* AI-Ranked Candidates */}
            {aiRanked.length > 0 && (
                <section className="mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Sparkles className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                AI-Ranked Candidates
                            </h2>
                            <p className="text-sm text-gray-600">
                                Top {aiRanked.length} candidates with detailed AI analysis
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {aiRanked.map((profile: any, index: number) => (
                            <CandidateCard
                                key={profile.profile_id}
                                profile={profile}
                                rank={index + 1}
                                isAIRanked={true}
                                onClick={() => setSelectedProfile(profile.profile_id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Rank More Button */}
            {canRankMore && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 p-6 text-center">
                        <div className="mb-4">
                            <TrendingUp className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                Want More AI Insights?
                            </h3>
                            <p className="text-gray-600 mb-1">
                                {unranked.length} more candidates available for AI ranking
                            </p>
                            <p className="text-sm text-gray-500">
                                Get detailed AI analysis for the next 10 candidates
                            </p>
                        </div>
                        <button
                            onClick={handleRankMore}
                            disabled={isRanking}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                        >
                            {isRanking ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Ranking Next 10...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Rank Next 10 Candidates
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Unranked Candidates */}
            {unranked.length > 0 && (
                <section>
                    <button
                        onClick={() => setShowUnranked(!showUnranked)}
                        className="flex items-center gap-3 mb-6 w-full group"
                    >
                        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                            {showUnranked ? (
                                <ChevronUp className="w-6 h-6 text-gray-600" />
                            ) : (
                                <ChevronDown className="w-6 h-6 text-gray-600" />
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <h2 className="text-2xl font-bold text-gray-900">
                                Other Matches
                            </h2>
                            <p className="text-sm text-gray-600">
                                {unranked.length} candidates with pre-scoring only
                            </p>
                        </div>
                    </button>

                    <AnimatePresence>
                        {showUnranked && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4"
                            >
                                {unranked.map((profile: any, index: number) => (
                                    <CandidateCard
                                        key={profile.profile_id}
                                        profile={profile}
                                        rank={aiRanked.length + index + 1}
                                        isAIRanked={false}
                                        onClick={() => setSelectedProfile(profile.profile_id)}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            )}

            {/* Profile Detail Modal */}
            {selectedProfile && (
                <ProfileDetailModal
                    profileId={selectedProfile}
                    onClose={() => setSelectedProfile(null)}
                />
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color }: any) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 border-blue-200',
        purple: 'bg-purple-50 text-purple-600 border-purple-200',
        green: 'bg-green-50 text-green-600 border-green-200',
        orange: 'bg-orange-50 text-orange-600 border-orange-200',
    };

    return (
        <div className={`p-4 rounded-xl border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
            <div className="flex items-center gap-3">
                <div>{icon}</div>
                <div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-sm font-medium opacity-75">{label}</div>
                </div>
            </div>
        </div>
    );
}