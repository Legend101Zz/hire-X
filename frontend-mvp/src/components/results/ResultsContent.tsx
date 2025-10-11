/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    TrendingUp,
    RefreshCw,
    Download,
    Users,
    Award,
    Target,
    Loader2,
    Heart,
    CheckSquare,
    Square
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
    const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

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
                await fetchResults();
            }
        } catch (error) {
            console.error('Error ranking more:', error);
        } finally {
            setIsRanking(false);
        }
    };

    const toggleBulkSelect = (profileId: string) => {
        const newSet = new Set(selectedForBulk);
        if (newSet.has(profileId)) {
            newSet.delete(profileId);
        } else {
            newSet.add(profileId);
        }
        setSelectedForBulk(newSet);
    };

    const selectAllVisible = () => {
        if (!results?.results) return;

        const aiRanked = results.results.filter((p: any) => p.final_score !== undefined && p.summary);

        if (selectedForBulk.size === aiRanked.length) {
            setSelectedForBulk(new Set());
        } else {
            const allIds = new Set(aiRanked.map((p: any) => p.profile_id));
            setSelectedForBulk(allIds);
        }
    };

    const handleBulkShortlist = () => {
        try {
            const existingShortlist = JSON.parse(localStorage.getItem('shortlistedProfiles') || '[]');
            const selectedProfiles = results.results.filter((p: any) => selectedForBulk.has(p.profile_id));

            // Add selected profiles to shortlist (avoid duplicates)
            const existingIds = new Set(existingShortlist.map((p: any) => p.profile_id));
            const newProfiles = selectedProfiles.filter((p: any) => !existingIds.has(p.profile_id));

            const profilesToAdd = newProfiles.map((p: any) => ({
                ...p,
                ...p.profile_summary,
                shortlistedAt: new Date().toISOString()
            }));

            const updatedShortlist = [...existingShortlist, ...profilesToAdd];
            localStorage.setItem('shortlistedProfiles', JSON.stringify(updatedShortlist));

            // Dispatch event
            window.dispatchEvent(new CustomEvent('shortlistUpdated', {
                detail: { count: updatedShortlist.length }
            }));

            // Clear selection
            setSelectedForBulk(new Set());

            alert(`Added ${newProfiles.length} candidate(s) to shortlist!`);
        } catch (error) {
            console.error('Error adding to shortlist:', error);
            alert('Failed to add candidates to shortlist');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading results...</p>
                </div>
            </div>
        );
    }

    if (!results || !results.results) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-gray-600">No results found</p>
                </div>
            </div>
        );
    }

    const aiRanked = results.results
        .filter((p: any) => p.final_score !== undefined && p.summary)
        .sort((a: any, b: any) => (b.final_score || 0) - (a.final_score || 0));

    const totalProfiles = results.summary_generation?.total_profiles || results.total_matches || 0;
    const summariesGenerated = results.summary_generation?.summaries_generated || aiRanked.length;
    const unrankedCount = totalProfiles - summariesGenerated;
    const canRankMore = unrankedCount > 0;

    const avgPreScore = results.results.length > 0
        ? (results.results.reduce((sum: number, p: any) => sum + (p.pre_score || 0), 0) / results.results.length).toFixed(1)
        : '0';

    const avgFinalScore = aiRanked.length > 0
        ? (aiRanked.reduce((sum: number, p: any) => sum + (p.final_score || 0), 0) / aiRanked.length).toFixed(1)
        : '0';

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
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Search Results
                            </h1>
                            <p className="text-gray-600 text-lg">{results.prompt}</p>
                        </div>
                        <button
                            onClick={() => alert('Export feature coming soon!')}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>

                    {/* Applied Filters */}
                    {results.preflight_check?.refined_filters && (
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Applied Filters:</h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(results.preflight_check.refined_filters).map(([key, values]: [string, any]) => {
                                    if (!Array.isArray(values) || values.length === 0) return null;
                                    return values.map((value: string, idx: number) => (
                                        <span
                                            key={`${key}-${idx}`}
                                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-200"
                                        >
                                            {key.replace(/_/g, ' ')}: {value}
                                        </span>
                                    ));
                                })}
                            </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard icon={<Users className="w-5 h-5" />} label="Total Matches" value={totalProfiles} color="blue" />
                        <StatCard icon={<Sparkles className="w-5 h-5" />} label="AI Ranked" value={summariesGenerated} color="purple" />
                        <StatCard icon={<Award className="w-5 h-5" />} label="Avg AI Score" value={aiRanked.length > 0 ? `${avgFinalScore}` : 'N/A'} color="green" />
                        <StatCard icon={<Target className="w-5 h-5" />} label="Avg Pre-Score" value={avgPreScore} color="orange" />
                    </div>
                </motion.div>
            </div>

            {/* Bulk Actions Bar */}
            <AnimatePresence>
                {selectedForBulk.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-2xl p-4"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckSquare className="w-5 h-5 text-blue-600" />
                                <span className="font-semibold text-blue-900">
                                    {selectedForBulk.size} candidate{selectedForBulk.size !== 1 ? 's' : ''} selected
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleBulkShortlist}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                    <Heart className="w-4 h-4" />
                                    Add to Shortlist
                                </button>
                                <button
                                    onClick={() => setSelectedForBulk(new Set())}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI-Ranked Candidates */}
            {aiRanked.length > 0 && (
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
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

                        <button
                            onClick={selectAllVisible}
                            className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-medium"
                        >
                            {selectedForBulk.size === aiRanked.length ? (
                                <>
                                    <CheckSquare className="w-4 h-4" />
                                    Deselect All
                                </>
                            ) : (
                                <>
                                    <Square className="w-4 h-4" />
                                    Select All
                                </>
                            )}
                        </button>
                    </div>

                    <div className="space-y-4">
                        {aiRanked.map((profile: any, index: number) => (
                            <div key={profile.profile_id} className="relative">
                                {/* Selection Checkbox */}
                                <div className="absolute left-4 top-8 z-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedForBulk.has(profile.profile_id)}
                                        onChange={() => toggleBulkSelect(profile.profile_id)}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                </div>
                                <div className="ml-8">
                                    <CandidateCard
                                        profile={profile}
                                        rank={index + 1}
                                        isAIRanked={true}
                                        onClick={() => setSelectedProfile(profile.profile_id)}
                                    />
                                </div>
                            </div>
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
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 p-8 text-center">
                        <div className="mb-4">
                            <TrendingUp className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                Want More AI Insights?
                            </h3>
                            <p className="text-gray-600 mb-2 text-lg">
                                <span className="font-bold text-blue-600">{unrankedCount}</span> more candidates available for AI ranking
                            </p>
                            <p className="text-sm text-gray-500">
                                Get detailed AI analysis for the next 10 candidates
                            </p>
                        </div>
                        <button
                            onClick={handleRankMore}
                            disabled={isRanking}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            {isRanking ? (
                                <>
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                    Ranking Next 10...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-6 h-6" />
                                    Rank Next 10 Candidates
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
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
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            className={`p-4 rounded-xl border-2 ${colorClasses[color as keyof typeof colorClasses]} transition-transform`}
        >
            <div className="flex items-center gap-3">
                <div>{icon}</div>
                <div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-sm font-medium opacity-75">{label}</div>
                </div>
            </div>
        </motion.div>
    );
}