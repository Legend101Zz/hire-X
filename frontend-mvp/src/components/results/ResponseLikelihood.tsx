'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, TrendingUp, CheckCircle2 } from 'lucide-react';

interface ResponseFactor {
    factor: string;
    score: number; // 0-10
    notes: string;
}

interface ResponseLikelihoodProps {
    overallScore: number; // 0-100
    factors: ResponseFactor[];
    recommendations?: string[];
}

export default function ResponseLikelihood({
    overallScore,
    factors,
    recommendations
}: ResponseLikelihoodProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getScoreColor = (score: number) => {
        if (score >= 70) return { bg: 'bg-green-100', text: 'text-green-700', label: 'High' };
        if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Moderate' };
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Low' };
    };

    const scoreColor = getScoreColor(overallScore);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${scoreColor.bg} flex items-center justify-center`}>
                        <TrendingUp className={`w-4 h-4 ${scoreColor.text}`} />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">Response Likelihood</p>
                        <p className={`text-xs font-medium ${scoreColor.text}`}>
                            {overallScore}% • {scoreColor.label}
                        </p>
                    </div>
                </div>

                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-200"
                    >
                        <div className="p-4 space-y-4">
                            {/* Overall Score Gauge */}
                            <div className="relative p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                                <div className="text-center">
                                    <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${scoreColor.bg} border-4 border-white shadow-lg`}>
                                        <span className={`text-3xl font-bold ${scoreColor.text}`}>{overallScore}</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-700 mt-3">Overall Response Score</p>
                                    <p className={`text-xs font-semibold ${scoreColor.text} uppercase tracking-wide mt-1`}>
                                        {scoreColor.label} Likelihood
                                    </p>
                                </div>
                            </div>

                            {/* Factor Breakdown */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                    6-Factor Breakdown
                                </p>

                                {factors.map((factor, index) => {
                                    const normalizedScore = (factor.score / 10) * 100;
                                    const factorColor = getScoreColor(normalizedScore);

                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                            {/* Factor Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-900">{factor.factor}</span>
                                                <span className={`text-sm font-bold ${factorColor.text}`}>
                                                    {factor.score}/10
                                                </span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(factor.score / 10) * 100}%` }}
                                                    transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                                                    className={`h-full ${factor.score >= 7
                                                            ? 'bg-green-500'
                                                            : factor.score >= 4
                                                                ? 'bg-yellow-500'
                                                                : 'bg-red-500'
                                                        }`}
                                                />
                                            </div>

                                            {/* Notes */}
                                            <p className="text-xs text-gray-700">{factor.notes}</p>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Recommendations */}
                            {recommendations && recommendations.length > 0 && (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                        <p className="text-sm font-semibold text-blue-900">Outreach Recommendations</p>
                                    </div>
                                    <ul className="space-y-1.5">
                                        {recommendations.map((rec, index) => (
                                            <li key={index} className="text-xs text-blue-800 flex items-start gap-2">
                                                <span className="text-blue-600 mt-0.5">•</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}