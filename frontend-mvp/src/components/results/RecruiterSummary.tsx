"use client";

import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Star, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecruiterSummary as RecruiterSummaryType } from "@/types";

interface RecruiterSummaryProps {
    summary: RecruiterSummaryType;
}

export default function RecruiterSummary({ summary }: RecruiterSummaryProps) {
    const getRecommendationColor = (rec: string) => {
        switch (rec) {
            case "Strong Yes":
                return "from-green-500 to-emerald-500";
            case "Yes":
                return "from-blue-500 to-indigo-500";
            case "Maybe":
                return "from-yellow-500 to-orange-500";
            case "No":
                return "from-red-500 to-pink-500";
            default:
                return "from-slate-500 to-slate-600";
        }
    };

    return (
        <div className="space-y-6">
            {/* Overall Recommendation */}
            <div
                className={`bg-gradient-to-br ${getRecommendationColor(
                    summary.overall_recommendation
                )}/10 rounded-xl p-6 border ${getRecommendationColor(
                    summary.overall_recommendation
                )}/20`}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRecommendationColor(
                                summary.overall_recommendation
                            )} flex items-center justify-center`}
                        >
                            <Star className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400">Recommendation</p>
                            <p className="text-2xl font-bold text-white">
                                {summary.overall_recommendation}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-400">Confidence</p>
                        <p className="text-2xl font-bold text-white">{summary.confidence_level}%</p>
                    </div>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2">
                    <motion.div
                        className={`bg-gradient-to-r ${getRecommendationColor(
                            summary.overall_recommendation
                        )} h-2 rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${summary.confidence_level}%` }}
                        transition={{ duration: 1 }}
                    />
                </div>
            </div>

            {/* Why Shortlist */}
            <div className="bg-green-500/10 rounded-xl p-5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp className="w-5 h-5 text-green-400" />
                    <h5 className="font-semibold text-white">Why Shortlist</h5>
                </div>
                <p className="text-slate-300 leading-relaxed">{summary.why_shortlist}</p>
            </div>

            {/* Why Reject */}
            {summary.why_reject && (
                <div className="bg-red-500/10 rounded-xl p-5 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-3">
                        <ThumbsDown className="w-5 h-5 text-red-400" />
                        <h5 className="font-semibold text-white">Potential Concerns</h5>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{summary.why_reject}</p>
                </div>
            )}

            {/* Fit Summary */}
            <div className="bg-blue-500/10 rounded-xl p-5 border border-blue-500/20">
                <h5 className="font-semibold text-white mb-3">For Hiring Manager</h5>
                <p className="text-slate-300 leading-relaxed">{summary.fit_summary}</p>
            </div>

            {/* Standout Achievements */}
            {summary.standout_achievements.length > 0 && (
                <div>
                    <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        Standout Achievements
                    </h5>
                    <ul className="space-y-2">
                        {summary.standout_achievements.map((achievement, index) => (
                            <motion.li
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start gap-3 text-slate-300"
                            >
                                <span className="text-amber-400 mt-1">•</span>
                                <span>{achievement}</span>
                            </motion.li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Red Flags */}
            {summary.red_flags.length > 0 && (
                <div>
                    <h5 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        Red Flags
                    </h5>
                    <div className="space-y-2">
                        {summary.red_flags.map((flag, index) => (
                            <Badge
                                key={index}
                                className="bg-red-500/20 text-red-400 border-red-500/30 mr-2"
                            >
                                {flag}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Interesting Findings */}
            {summary.interesting_findings.length > 0 && (
                <div>
                    <h5 className="font-semibold text-white mb-3">Interesting Findings</h5>
                    <ul className="space-y-2">
                        {summary.interesting_findings.map((finding, index) => (
                            <li key={index} className="text-sm text-slate-400">
                                • {finding}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}