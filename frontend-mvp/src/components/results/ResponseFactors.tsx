"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import type { ResponseFactor } from "@/types";

interface ResponseFactorsProps {
    factors: ResponseFactor[];
    overallScore: number;
    recommendedApproach: string;
}

export default function ResponseFactors({
    factors,
    overallScore,
    recommendedApproach,
}: ResponseFactorsProps) {
    const getScoreColor = (score: number) => {
        if (score >= 8) return "text-green-400 bg-green-500/20 border-green-500/30";
        if (score >= 5) return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
        return "text-red-400 bg-red-500/20 border-red-500/30";
    };

    const getScoreIcon = (score: number) => {
        if (score >= 8) return <CheckCircle2 className="w-5 h-5" />;
        if (score >= 5) return <Info className="w-5 h-5" />;
        return <AlertCircle className="w-5 h-5" />;
    };

    return (
        <div className="space-y-6">
            {/* Overall Score */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-6 border border-indigo-500/20">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-semibold text-white">Response Likelihood</h4>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-white">{overallScore}/100</p>
                    </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 mb-4">
                    <motion.div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${overallScore}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                    />
                </div>
                <p className="text-sm text-slate-300">{recommendedApproach}</p>
            </div>

            {/* Factors Breakdown */}
            <div className="space-y-3">
                {factors.map((factor, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30"
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${getScoreColor(factor.score)}`}>
                                {getScoreIcon(factor.score)}
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-white">{factor.factor}</h5>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-400">{factor.weight}%</span>
                                        <span className={`font-bold ${getScoreColor(factor.score)}`}>
                                            {factor.score}/10
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400">{factor.notes}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}