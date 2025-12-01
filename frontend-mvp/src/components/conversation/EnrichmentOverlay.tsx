"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Brain,
    Check,
    X,
    Loader2,
    Activity,
    DollarSign,
    Target,
    Search,
    User,
    Sparkles
} from "lucide-react";

interface EnrichmentProgress {
    status: string;
    phase: string;
    total: number;
    completed: number;
    failed: number;
    progress_percentage: number;
    current_candidate: string;
    message: string;
    candidates: Record<string, { name: string; status: string; error?: string }>;
}

interface EnrichmentOverlayProps {
    progress: EnrichmentProgress;
}

export default function EnrichmentOverlay({ progress }: EnrichmentOverlayProps) {
    const { total, completed, failed, progress_percentage, current_candidate, message, candidates, phase } = progress;

    const candidateList = Object.entries(candidates || {});

    // Animation variants for the list items to slide in smoothly
    const listVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.05, duration: 0.2 }
        })
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full max-w-md bg-[#1F1F1F] border border-[#333] rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans"
            >
                {/* Header Section */}
                <div className="p-6 border-b border-[#333] bg-[#252525]">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-[#2F2F2F] rounded-md border border-[#3F3F3F]">
                            {phase === "complete" ? (
                                <Sparkles className="w-5 h-5 text-amber-200" />
                            ) : (
                                <Brain className="w-5 h-5 text-blue-400" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-neutral-100 leading-tight">
                                {phase === "complete" ? "Enrichment Complete" : "Deep Analysis"}
                            </h2>
                            <p className="text-xs text-neutral-400 font-medium">
                                {phase === "complete"
                                    ? "All profiles processed successfully"
                                    : "AI is evaluating candidate fit & salary"
                                }
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar - Minimalist */}
                    <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-neutral-500 font-medium">Progress</span>
                            <span className="text-neutral-300 font-mono">{progress_percentage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#333] rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress_percentage}%` }}
                                transition={{ type: "spring", stiffness: 50, damping: 20 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Candidate List Container */}
                <div className="flex-1 max-h-[240px] overflow-y-auto bg-[#1F1F1F] p-2 custom-scrollbar">
                    {candidateList.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-2 min-h-[150px]">
                            <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                            <span className="text-sm">Initializing queue...</span>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <AnimatePresence initial={false}>
                                {candidateList.map(([id, candidate], index) => (
                                    <motion.div
                                        key={id}
                                        layout
                                        variants={listVariants}
                                        initial="hidden"
                                        animate="visible"
                                        custom={index}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm border transition-colors ${candidate.status === "analyzing"
                                                ? "bg-[#2A2A2A] border-[#333]"
                                                : "border-transparent hover:bg-[#252525]"
                                            }`}
                                    >
                                        {/* Status Icon */}
                                        <div className="shrink-0">
                                            {candidate.status === "completed" ? (
                                                <div className="bg-green-900/30 p-1 rounded-sm">
                                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                                </div>
                                            ) : candidate.status === "failed" ? (
                                                <div className="bg-red-900/30 p-1 rounded-sm">
                                                    <X className="w-3.5 h-3.5 text-red-400" />
                                                </div>
                                            ) : candidate.status === "analyzing" ? (
                                                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-sm border border-neutral-700 bg-neutral-800" />
                                            )}
                                        </div>

                                        {/* Name */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <span className={`truncate font-medium ${candidate.status === "analyzing" ? "text-blue-100" : "text-neutral-300"
                                                }`}>
                                                {candidate.name}
                                            </span>
                                            {candidate.error && (
                                                <span className="text-[10px] text-red-400 truncate leading-tight">
                                                    {candidate.error}
                                                </span>
                                            )}
                                        </div>

                                        {/* Active Indicator */}
                                        {candidate.status === "analyzing" && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center gap-1.5"
                                            >
                                                <span className="text-[10px] text-blue-400 font-medium">Processing</span>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Footer / Status Bar */}
                <div className="p-3 bg-[#252525] border-t border-[#333] flex justify-between items-center text-xs">
                    <div className="text-neutral-500 flex items-center gap-2">
                        {phase === "deep_analysis" ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <span>Complete</span>
                        )}
                    </div>
                    <div className="flex gap-3 text-neutral-500">
                        <span className={completed > 0 ? "text-neutral-300" : ""}>{completed} Done</span>
                        <span className={failed > 0 ? "text-red-400" : ""}>{failed} Failed</span>
                    </div>
                </div>

                {/* Analysis Capabilities Grid - Only show during active analysis */}
                {phase === "deep_analysis" && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="bg-[#1a1a1a] border-t border-[#333] grid grid-cols-4 divide-x divide-[#333]"
                    >
                        {[
                            { icon: DollarSign, label: "Salary" },
                            { icon: Target, label: "Score" },
                            { icon: Activity, label: "Skills" },
                            { icon: Search, label: "Verify" },
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col items-center justify-center py-3 gap-1.5">
                                <item.icon className="w-3.5 h-3.5 text-neutral-500" />
                                <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
}