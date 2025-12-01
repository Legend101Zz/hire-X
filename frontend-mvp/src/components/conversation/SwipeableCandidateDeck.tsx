/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
    User, MapPin, Building2, Code, ThumbsUp, ThumbsDown,
    Loader2, CheckCircle, DollarSign, MessageCircle, Sparkles,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CandidateCardProps {
    candidate: any;
    enrichmentStatus?: {
        status: string;
        progress?: number;
        enriched_data?: any;
    };
    onAccept: () => void;
    onReject: (reason: string) => void;
    isTop: boolean;
}

// Rejection reasons
const REJECTION_REASONS = [
    { id: "too_junior", label: "Too Junior", icon: "👶" },
    { id: "wrong_location", label: "Wrong Location", icon: "📍" },
    { id: "missing_skills", label: "Missing Skills", icon: "🔧" },
    { id: "wrong_industry", label: "Wrong Industry", icon: "🏢" },
    { id: "other", label: "Other", icon: "❓" },
];

function CandidateCard({
    candidate,
    enrichmentStatus,
    onAccept,
    onReject,
    isTop
}: CandidateCardProps) {
    const [showRejectOptions, setShowRejectOptions] = useState(false);
    const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);

    const candidateData = candidate.candidate || candidate;
    const matchedSkills = candidate.matched_skills || [];
    const score = candidate.score || 0;

    // Enriched data (if available)
    const enrichedData = enrichmentStatus?.enriched_data;
    const isEnriching = enrichmentStatus?.status === "enriching";
    const isEnriched = enrichmentStatus?.status === "completed";

    const handleDragEnd = (event: any, info: PanInfo) => {
        const threshold = 100;

        if (info.offset.x > threshold) {
            onAccept();
        } else if (info.offset.x < -threshold) {
            setShowRejectOptions(true);
        }

        setDragDirection(null);
    };

    const handleDrag = (event: any, info: PanInfo) => {
        if (info.offset.x > 50) {
            setDragDirection("right");
        } else if (info.offset.x < -50) {
            setDragDirection("left");
        } else {
            setDragDirection(null);
        }
    };

    const handleRejectWithReason = (reason: string) => {
        setShowRejectOptions(false);
        onReject(reason);
    };

    return (
        <motion.div
            className={`absolute inset-0 ${isTop ? "z-10" : "z-0"}`}
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.5 }}
            animate={{
                scale: isTop ? 1 : 0.95,
                opacity: isTop ? 1 : 0.5,
                y: isTop ? 0 : 10
            }}
            exit={{
                x: dragDirection === "right" ? 300 : -300,
                opacity: 0,
                rotate: dragDirection === "right" ? 20 : -20
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            {/* Swipe indicators */}
            <AnimatePresence>
                {dragDirection === "right" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute top-4 left-4 z-20 bg-green-500 text-white px-4 py-2 rounded-full font-bold"
                    >
                        LIKE 👍
                    </motion.div>
                )}
                {dragDirection === "left" && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute top-4 right-4 z-20 bg-red-500 text-white px-4 py-2 rounded-full font-bold"
                    >
                        PASS 👎
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden h-full">
                {/* Header with score */}
                <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-amber-500/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                                {candidateData.first_name?.[0]}{candidateData.last_name?.[0]}
                            </div>
                            <div>
                                <h3 className="text-white font-bold">
                                    {candidateData.first_name} {candidateData.last_name}
                                </h3>
                                <p className="text-slate-400 text-sm">{candidateData.title || "N/A"}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Enrichment status indicator */}
                            {isEnriching && (
                                <div className="flex items-center gap-1 text-amber-400 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Enriching...</span>
                                </div>
                            )}
                            {isEnriched && (
                                <div className="flex items-center gap-1 text-green-400 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Enriched</span>
                                </div>
                            )}

                            {/* Score badge */}
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${score >= 80 ? "bg-green-500/20 text-green-400" :
                                score >= 60 ? "bg-amber-500/20 text-amber-400" :
                                    "bg-slate-500/20 text-slate-400"
                                }`}>
                                {Math.round(score)}% Match
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-slate-400">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm">{candidateData.location || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Building2 className="w-4 h-4" />
                            <span className="text-sm">{candidateData.current_industry || "N/A"}</span>
                        </div>
                    </div>

                    {/* Skills */}
                    {matchedSkills.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                                <Code className="w-3 h-3" />
                                Matched Skills
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {matchedSkills.slice(0, 6).map((skill: string, idx: number) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Enriched Data (if available) */}
                    {isEnriched && enrichedData && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/30 space-y-2"
                        >
                            <p className="text-xs text-amber-400 font-medium flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                AI Insights
                            </p>

                            {enrichedData.salary_estimation && (
                                <div className="flex items-center gap-2 text-sm">
                                    <DollarSign className="w-4 h-4 text-green-400" />
                                    <span className="text-slate-300">
                                        Est. Salary: {enrichedData.salary_estimation.estimated_range || "N/A"}
                                    </span>
                                </div>
                            )}

                            {enrichedData.response_likelihood && (
                                <div className="flex items-center gap-2 text-sm">
                                    <MessageCircle className="w-4 h-4 text-blue-400" />
                                    <span className="text-slate-300">
                                        Response: {enrichedData.response_likelihood.likelihood || "N/A"}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Match reasons */}
                    {candidate.match_reasons && candidate.match_reasons.length > 0 && (
                        <div className="text-xs text-slate-500">
                            {candidate.match_reasons.slice(0, 2).map((reason: string, idx: number) => (
                                <p key={idx}>• {reason}</p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="p-4 border-t border-slate-700/50">
                    <AnimatePresence mode="wait">
                        {showRejectOptions ? (
                            <motion.div
                                key="reject-options"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-2"
                            >
                                <p className="text-sm text-slate-400 mb-2">Why are you passing?</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {REJECTION_REASONS.map((reason) => (
                                        <button
                                            key={reason.id}
                                            onClick={() => handleRejectWithReason(reason.label)}
                                            className="px-3 py-2 bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/50 rounded-lg text-sm text-slate-300 hover:text-red-300 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <span>{reason.icon}</span>
                                            <span>{reason.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowRejectOptions(false)}
                                    className="w-full text-slate-500 text-sm mt-2 hover:text-slate-300"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="swipe-hint"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center justify-center gap-8"
                            >
                                <Button
                                    onClick={() => setShowRejectOptions(true)}
                                    variant="outline"
                                    className="rounded-full w-14 h-14 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                >
                                    <ThumbsDown className="w-6 h-6" />
                                </Button>

                                <p className="text-slate-500 text-sm">← Swipe →</p>

                                <Button
                                    onClick={onAccept}
                                    className="rounded-full w-14 h-14 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"
                                >
                                    <ThumbsUp className="w-6 h-6" />
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

interface SwipeableCandidateDeckProps {
    candidates: any[];
    enrichmentStatus?: Record<string, any>;
    onAccept: (candidate: any) => void;
    onReject: (candidate: any, reason: string) => void;
    onComplete: () => void;
    onDonnaSpeak: (message: string, expression: any) => void;
}

export default function SwipeableCandidateDeck({
    candidates,
    enrichmentStatus = {},
    onAccept,
    onReject,
    onComplete,
    onDonnaSpeak,
}: SwipeableCandidateDeckProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [exitingIndex, setExitingIndex] = useState<number | null>(null);

    const handleAccept = () => {
        const candidate = candidates[currentIndex];
        setExitingIndex(currentIndex);
        onAccept(candidate);

        setTimeout(() => {
            if (currentIndex >= candidates.length - 1) {
                onComplete();
            } else {
                setCurrentIndex((prev) => prev + 1);
                setExitingIndex(null);
            }
        }, 300);
    };

    const handleReject = (reason: string) => {
        const candidate = candidates[currentIndex];
        setExitingIndex(currentIndex);
        onReject(candidate, reason);

        setTimeout(() => {
            if (currentIndex >= candidates.length - 1) {
                onComplete();
            } else {
                setCurrentIndex((prev) => prev + 1);
                setExitingIndex(null);
            }
        }, 300);
    };

    // Get enrichment status for current candidate
    const getCurrentEnrichmentStatus = (candidate: any) => {
        const id = candidate.candidate?.profile_id || candidate.candidate?._id;
        return enrichmentStatus[id];
    };

    return (
        <div className="relative h-[520px]">
            {/* Progress indicator */}
            <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2">
                {candidates.map((_, idx) => (
                    <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full transition-colors ${idx < currentIndex ? "bg-purple-500" :
                            idx === currentIndex ? "bg-amber-500" :
                                "bg-slate-700"
                            }`}
                    />
                ))}
            </div>

            {/* Cards stack */}
            <div className="relative h-full pt-4">
                <AnimatePresence>
                    {candidates.slice(currentIndex, currentIndex + 2).map((candidate, idx) => (
                        <CandidateCard
                            key={candidate.candidate?.profile_id || idx}
                            candidate={candidate}
                            enrichmentStatus={getCurrentEnrichmentStatus(candidate)}
                            onAccept={handleAccept}
                            onReject={handleReject}
                            isTop={idx === 0}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Counter */}
            <div className="absolute bottom-2 left-0 right-0 text-center">
                <span className="text-slate-500 text-sm">
                    {currentIndex + 1} / {candidates.length}
                </span>
            </div>
        </div>
    );
}