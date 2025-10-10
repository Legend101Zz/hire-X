/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { motion } from 'framer-motion';
import {
    MapPin,
    Building2,
    Sparkles,
    TrendingUp,
    ChevronRight,
    Star,
    Award
} from 'lucide-react';

interface CandidateCardProps {
    profile: any;
    rank: number;
    isAIRanked: boolean;
    onClick: () => void;
}

export default function CandidateCard({ profile, rank, isAIRanked, onClick }: CandidateCardProps) {
    const score = isAIRanked ? profile.final_score : profile.pre_score;
    const summary = profile.profile_summary;

    // Score color
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'from-green-500 to-emerald-500';
        if (score >= 60) return 'from-blue-500 to-cyan-500';
        if (score >= 40) return 'from-yellow-500 to-orange-500';
        return 'from-gray-500 to-gray-600';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
            onClick={onClick}
            className="bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-300 p-6 cursor-pointer transition-all group"
        >
            <div className="flex items-start gap-4">
                {/* Rank Badge */}
                <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl ${rank <= 3
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                            : 'bg-gray-100'
                        } flex items-center justify-center font-bold text-lg ${rank <= 3 ? 'text-white' : 'text-gray-600'
                        }`}>
                        {rank}
                    </div>
                </div>

                {/* Profile Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                {summary.name}
                            </h3>
                            <p className="text-gray-600 mb-2">{summary.title}</p>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {summary.location}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Building2 className="w-4 h-4" />
                                    {summary.industry}
                                </div>
                            </div>
                        </div>

                        {/* Score Badge */}
                        <div className={`ml-4 flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r ${getScoreColor(score)} text-white shadow-lg`}>
                            <div className="text-center">
                                <div className="text-2xl font-bold">{score}</div>
                                <div className="text-xs opacity-90">
                                    {isAIRanked ? 'AI Score' : 'Pre-Score'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Summary */}
                    {isAIRanked && profile.summary && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                            <div className="flex items-start gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        {profile.summary}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View Details Button */}
                    <div className="mt-4 flex items-center justify-end">
                        <div className="flex items-center gap-2 text-blue-600 font-medium text-sm group-hover:gap-3 transition-all">
                            View Full Profile
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Ranked Badge */}
            {isAIRanked && (
                <div className="absolute top-4 right-4">
                    <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                        <Star className="w-3 h-3" />
                        AI ANALYZED
                    </div>
                </div>
            )}
        </motion.div>
    );
}