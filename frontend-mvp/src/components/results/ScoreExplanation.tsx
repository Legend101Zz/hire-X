/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    AlertCircle,
    TrendingUp,
    Zap,
    Award
} from 'lucide-react';

interface ScoreExplanationProps {
    profile: any;
}

export default function ScoreExplanation({ profile }: ScoreExplanationProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const finalScore = profile.final_score || profile.pre_score || 0;
    const preScore = profile.pre_score || 0;

    // Calculate score breakdown
    const scoreBreakdown = calculateScoreBreakdown(profile);

    // Determine score tier
    const getScoreTier = (score: number) => {
        if (score >= 80) return { label: 'Excellent Match', color: 'green', icon: Award };
        if (score >= 60) return { label: 'Good Match', color: 'blue', icon: CheckCircle2 };
        if (score >= 40) return { label: 'Fair Match', color: 'yellow', icon: AlertCircle };
        return { label: 'Poor Match', color: 'red', icon: XCircle };
    };

    const tier = getScoreTier(finalScore);
    const TierIcon = tier.icon;

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header - Always Visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 bg-${tier.color}-100 rounded-lg`}>
                        <TierIcon className={`w-6 h-6 text-${tier.color}-600`} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-lg text-gray-900">
                            Match Score: {finalScore}/100
                        </h3>
                        <p className={`text-sm text-${tier.color}-600 font-medium`}>
                            {tier.label}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* AI Badge */}
                    {profile.summary && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 rounded-full">
                            <Zap className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-medium text-purple-600">AI Analyzed</span>
                        </div>
                    )}

                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </button>

            {/* Expanded Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-gray-200"
                    >
                        <div className="p-6 space-y-6">
                            {/* Score Evolution */}
                            {profile.summary && (
                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-gray-700">Score Evolution</span>
                                        <TrendingUp className="w-4 h-4 text-blue-600" />
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="text-2xl font-bold text-gray-400">{preScore}</div>
                                            <div className="text-xs text-gray-500">Keyword Match</div>
                                        </div>

                                        <div className="flex-1 h-1 bg-gradient-to-r from-gray-300 to-blue-600 rounded-full" />

                                        <div>
                                            <div className="text-2xl font-bold text-blue-600">{finalScore}</div>
                                            <div className="text-xs text-blue-600">AI Analyzed</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Score Breakdown */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-3">Score Breakdown</h4>
                                <div className="space-y-3">
                                    {scoreBreakdown.map((item, idx) => (
                                        <ScoreItem key={idx} {...item} />
                                    ))}
                                </div>
                            </div>

                            {/* Matched Criteria */}
                            <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-3">Matched Criteria</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {profile.matched_filters?.map((filter: string, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 rounded-lg p-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            {filter}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* How to Improve (for lower scores) */}
                            {finalScore < 70 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex items-start gap-2 mb-2">
                                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-semibold text-sm text-yellow-900 mb-1">
                                                Areas for Improvement
                                            </h4>
                                            <ul className="text-sm text-yellow-800 space-y-1">
                                                {finalScore < 50 && (
                                                    <li>• Limited relevant experience in target industry</li>
                                                )}
                                                {!profile.education || profile.education[0] === 'NA' && (
                                                    <li>• No formal education information available</li>
                                                )}
                                                {!profile.certifications || profile.certifications[0] === 'NA' && (
                                                    <li>• No relevant certifications listed</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper component for score items
function ScoreItem({
    label,
    score,
    maxScore,
    matched
}: {
    label: string;
    score: number;
    maxScore: number;
    matched: boolean;
}) {
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">{label}</span>
                <span className="text-sm font-medium text-gray-900">
                    {score}/{maxScore}
                </span>
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className={`absolute inset-y-0 left-0 rounded-full ${matched
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500'
                        }`}
                />
            </div>
        </div>
    );
}

// Helper function to calculate score breakdown
function calculateScoreBreakdown(profile: any) {
    const breakdown = [];

    // Skills
    const skillsCount = profile.expertise ? profile.expertise.split(',').length : 0;
    breakdown.push({
        label: 'Skills Match',
        score: Math.min(skillsCount * 5, 30),
        maxScore: 30,
        matched: skillsCount > 3,
    });

    // Experience
    const hasExperience = profile.experience && profile.experience.length > 0 && profile.experience[0] !== 'NA';
    breakdown.push({
        label: 'Experience',
        score: hasExperience ? 25 : 5,
        maxScore: 25,
        matched: hasExperience,
    });

    // Education
    const hasEducation = profile.education && profile.education.length > 0 && profile.education[0] !== 'NA';
    breakdown.push({
        label: 'Education',
        score: hasEducation ? 15 : 0,
        maxScore: 15,
        matched: hasEducation,
    });

    // Industry
    const matchesIndustry = profile.current_industry && profile.current_industry !== 'NA';
    breakdown.push({
        label: 'Industry Fit',
        score: matchesIndustry ? 20 : 5,
        maxScore: 20,
        matched: matchesIndustry,
    });

    // Location
    const hasLocation = profile.location && profile.location !== 'NA';
    breakdown.push({
        label: 'Location',
        score: hasLocation ? 10 : 0,
        maxScore: 10,
        matched: hasLocation,
    });

    return breakdown;
}