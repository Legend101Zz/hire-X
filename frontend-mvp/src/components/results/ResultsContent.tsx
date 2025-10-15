'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Sparkles,
    Download,
    Users,
    Award,
    Target,
    Loader2,
    LayoutGrid,
    Table as TableIcon
} from 'lucide-react';
import ResultsTableView from './ResultsTableView';
import CandidateCard from './CandidateCard';
import ProfileDetailModal from './ProfileDetailModal';

interface ResultsContentProps {
    sessionId: string;
}

export default function ResultsContent({ sessionId }: ResultsContentProps) {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table'); // Default to table view

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

    const avgScore = results.results.length > 0
        ? (results.results.reduce((sum: number, p: any) => sum + (p.total_score || 0), 0) / results.results.length).toFixed(1)
        : '0';

    return (
        <div className="max-w-[1600px] mx-auto px-6 py-8">
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
                        <div className="flex items-center gap-3">
                            {/* View Mode Toggle */}
                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-2 rounded-md transition-all ${viewMode === 'table'
                                            ? 'bg-white shadow-sm text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    <TableIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`px-3 py-2 rounded-md transition-all ${viewMode === 'cards'
                                            ? 'bg-white shadow-sm text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={() => alert('Export feature coming soon!')}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard
                            icon={<Users className="w-5 h-5" />}
                            label="Total Candidates"
                            value={results.total_matches}
                            color="blue"
                        />
                        <StatCard
                            icon={<Sparkles className="w-5 h-5" />}
                            label="Approved Samples"
                            value={results.results.length}
                            color="purple"
                        />
                        <StatCard
                            icon={<Award className="w-5 h-5" />}
                            label="Avg Score"
                            value={avgScore}
                            color="green"
                        />
                    </div>
                </motion.div>
            </div>

            {/* Results View */}
            {viewMode === 'table' ? (
                <ResultsTableView
                    results={results}
                    onProfileClick={setSelectedProfile}
                />
            ) : (
                <div className="space-y-4">
                    {results.results.map((profile: any, index: number) => (
                        <CandidateCard
                            key={profile.profile_id}
                            profile={profile}
                            rank={index + 1}
                            isAIRanked={true}
                            onClick={() => setSelectedProfile(profile.profile_id)}
                        />
                    ))}
                </div>
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