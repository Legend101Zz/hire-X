/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {

    SlidersHorizontal,
    Download,
    Share2,

} from 'lucide-react';
import ProfileCard from './ProfileCard';
import ProfileModal from './ProfileModal';
import LoadMoreButton from './LoadMoreButton';

interface ResultsListProps {
    results: any;
    sessionId: string;
    onLoadMore: () => void;
    isLoadingMore: boolean;
}

export default function ResultsList({
    results,
    sessionId,
    onLoadMore,
    isLoadingMore
}: ResultsListProps) {
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
    const [filterIndustry, setFilterIndustry] = useState<string>('all');

    const profiles = results.results || [];
    const totalMatches = results.total_matches || 0;
    const summaryGeneration = results.summary_generation || {};

    // Get unique industries for filter
    const industries = Array.from(
        new Set(profiles.map((p: any) => p.industry || p.current_industry).filter(Boolean))
    );

    // Sort profiles
    const sortedProfiles = [...profiles].sort((a, b) => {
        if (sortBy === 'score') {
            return (b.final_score || b.pre_score || 0) - (a.final_score || a.pre_score || 0);
        } else {
            return (a.first_name || '').localeCompare(b.first_name || '');
        }
    });

    // Filter profiles
    const filteredProfiles = sortedProfiles.filter((p: any) => {
        if (filterIndustry === 'all') return true;
        return (p.industry || p.current_industry) === filterIndustry;
    });

    const hasMore = summaryGeneration.summaries_generated < summaryGeneration.total_profiles;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Search Results
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Found {totalMatches.toLocaleString()} matching candidates
                            {summaryGeneration.summaries_generated > 0 && (
                                <span className="text-blue-600 ml-2">
                                    • {summaryGeneration.summaries_generated} AI analyzed
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Search Query */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <span className="text-sm text-blue-900 font-medium">Your Query:</span>
                    <p className="text-gray-700 mt-1">{results.prompt}</p>
                </div>
            </div>

            {/* Filters & Sort */}
            <div className="flex flex-wrap gap-4 mb-6">
                {/* Sort */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'score' | 'name')}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="score">Sort by Match Score</option>
                    <option value="name">Sort by Name</option>
                </select>

                {/* Industry Filter */}
                <select
                    value={filterIndustry}
                    onChange={(e) => setFilterIndustry(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Industries</option>
                    {industries.map((industry: string) => (
                        <option key={industry} value={industry}>
                            {industry}
                        </option>
                    ))}
                </select>

                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4" />
                    More Filters
                </button>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <AnimatePresence>
                    {filteredProfiles.map((profile: any, index: number) => (
                        <ProfileCard
                            key={profile.profile_id || profile._id || index}
                            profile={profile}
                            rank={index + 1}
                            onClick={() => setSelectedProfile(profile)}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Load More */}
            {hasMore && (
                <LoadMoreButton
                    onLoadMore={onLoadMore}
                    isLoading={isLoadingMore}
                    remaining={summaryGeneration.total_profiles - summaryGeneration.summaries_generated}
                />
            )}

            {/* Profile Modal */}
            <AnimatePresence>
                {selectedProfile && (
                    <ProfileModal
                        profile={selectedProfile}
                        onClose={() => setSelectedProfile(null)}
                        sessionId={sessionId}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}