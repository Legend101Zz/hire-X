"use client";

import { motion } from "framer-motion";
import { Briefcase, TrendingUp, DollarSign } from "lucide-react";
import type { CareerProgressionItem } from "@/types";

interface CareerTimelineProps {
    progression: CareerProgressionItem[];
    currentCTC: string;
    growthRate: string;
}

export default function CareerTimeline({
    progression,
    currentCTC,
    growthRate,
}: CareerTimelineProps) {
    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <span className="text-sm text-slate-400">Current CTC</span>
                    </div>
                    <p className="text-2xl font-bold text-white">₹{currentCTC}L</p>
                </div>

                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        <span className="text-sm text-slate-400">Avg Growth</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{growthRate}</p>
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-500 via-purple-500 to-pink-500" />

                {/* Timeline Items */}
                <div className="space-y-6">
                    {progression.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative pl-16"
                        >
                            {/* Timeline Dot */}
                            <motion.div
                                className="absolute left-4 top-3 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 border-4 border-slate-900 z-10"
                                whileHover={{ scale: 1.2 }}
                            />

                            {/* Content Card */}
                            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-violet-500/50 transition-all duration-300">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-semibold text-white text-lg mb-1">
                                            {item.role}
                                        </h4>
                                        <p className="text-sm text-slate-400">{item.company}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-green-400">
                                            ₹{item.estimated_ctc_range}L
                                        </p>
                                        <p className="text-xs text-slate-500">{item.experience_level}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                                    <Briefcase className="w-4 h-4" />
                                    <span>{item.duration}</span>
                                </div>

                                <p className="text-sm text-slate-300 mb-3">{item.rationale}</p>

                                {item.sources.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {item.sources.slice(0, 2).map((source, idx) => (
                                            <a
                                                key={idx}
                                                href={source}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:text-blue-300 underline"
                                            >
                                                Source {idx + 1}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div >
    );
}