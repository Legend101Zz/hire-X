'use client';

import { motion } from 'framer-motion';
import { Filter, Star, Target, TrendingUp } from 'lucide-react';

interface Scorecard {
    mustHaveFilters: any[];
    scoringCriteria: any[];
    expansions: any;
    threshold: number;
    metadata: any;
}

interface ScorecardSimpleViewProps {
    scorecard: Scorecard;
}

export default function ScorecardSimpleView({ scorecard }: ScorecardSimpleViewProps) {
    const totalPoints = scorecard.scoringCriteria.reduce((sum, c) => sum + (c.points || 0), 0);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    Search Criteria
                </h2>
                <p className="text-sm text-gray-500">
                    Live view of your refined search parameters
                </p>
            </div>

            {/* Must-Have Filters */}
            {scorecard.mustHaveFilters && scorecard.mustHaveFilters.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <Filter className="w-4 h-4 text-red-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                            Must-Have Requirements
                        </h3>
                    </div>

                    <div className="space-y-2">
                        {scorecard.mustHaveFilters.map((filter, index) => (
                            <div
                                key={index}
                                className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"
                            >
                                <p className="text-sm font-medium text-gray-900">
                                    {filter.description || `${filter.field} ${filter.operator} ${filter.value}`}
                                </p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Scoring Criteria */}
            {scorecard.scoringCriteria && scorecard.scoringCriteria.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Star className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                            Scoring Factors
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {scorecard.scoringCriteria.map((criteria, index) => {
                            const percentage = totalPoints > 0 ? (criteria.points / totalPoints) * 100 : 0;

                            return (
                                <div key={index} className="space-y-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">
                                                {criteria.description}
                                            </p>
                                            {criteria.keywords && criteria.keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {criteria.keywords.slice(0, 3).map((keyword: string, i: number) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                                        >
                                                            {keyword}
                                                        </span>
                                                    ))}
                                                    {criteria.keywords.length > 3 && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                                            +{criteria.keywords.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-sm font-semibold text-blue-600 ml-3">
                                            {criteria.points} pts
                                        </span>
                                    </div>

                                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 0.5, delay: index * 0.1 }}
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Threshold */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-green-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">
                        Minimum Score
                    </h3>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                            Threshold
                        </span>
                        <span className="text-lg font-bold text-green-600">
                            {scorecard.threshold} / {totalPoints}
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                        Candidates must score at least {scorecard.threshold} points to be included
                    </p>
                </div>
            </motion.div>

            {/* Expansions Preview */}
            {scorecard.expansions && Object.keys(scorecard.expansions).length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-purple-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                            Smart Expansions
                        </h3>
                    </div>

                    <div className="space-y-2">
                        {Object.entries(scorecard.expansions).map(([key, values]: [string, any]) => {
                            if (!values || values.length === 0) return null;

                            return (
                                <div key={key} className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                                    <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide mb-1.5">
                                        {key}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {values.slice(0, 4).map((value: string, i: number) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white text-purple-800"
                                            >
                                                {value}
                                            </span>
                                        ))}
                                        {values.length > 4 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-white text-gray-600">
                                                +{values.length - 4}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </div>
    );
}


