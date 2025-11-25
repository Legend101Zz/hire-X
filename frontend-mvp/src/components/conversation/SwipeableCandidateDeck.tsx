// components/conversation/SwipeableCandidateDeck.tsx (FIXED)
"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { ThumbsDown, ThumbsUp, X, MapPin, Briefcase, TrendingUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Candidate {
    candidate: {
        profile_id: string;
        first_name: string;
        last_name: string;
        title: string;
        location: string;
        current_industry: string;
        seniority_level: string;
        expertise?: string;
        summary?: string;
    };
    score: number;
    skill_match_count: number;
    matched_skills: string[];
    match_details: string[];
}

interface SwipeableCandidateDeckProps {
    candidates: Candidate[];
    onAccept: (candidate: Candidate) => void;
    onReject: (candidate: Candidate, reason?: string) => void;
    onComplete: () => void;
    onDonnaSpeak?: (message: string, expression: "happy" | "thinking" | "excited") => void;
}

const REJECTION_REASONS = [
    { id: "too_junior", label: "Too Junior", icon: "📉" },
    { id: "wrong_skills", label: "Wrong Skills", icon: "🛠️" },
    { id: "wrong_location", label: "Wrong Location", icon: "📍" },
    { id: "wrong_industry", label: "Wrong Industry", icon: "🏢" },
    { id: "other", label: "Other Reason", icon: "💭" },
];

export default function SwipeableCandidateDeck({
    candidates,
    onAccept,
    onReject,
    onComplete,
    onDonnaSpeak,
}: SwipeableCandidateDeckProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showRejectionReasons, setShowRejectionReasons] = useState(false);
    const [pendingRejectCandidate, setPendingRejectCandidate] = useState<Candidate | null>(null);
    const [customReason, setCustomReason] = useState("");
    const [direction, setDirection] = useState<"left" | "right" | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    const currentCandidate = candidates[currentIndex];
    const remainingCount = candidates.length - currentIndex;

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (isAnimating) return;

        const swipeThreshold = 100;
        const swipeVelocityThreshold = 500;

        const isHardSwipe = Math.abs(info.velocity.x) > swipeVelocityThreshold;
        const isSwipeRight = info.offset.x > swipeThreshold || (isHardSwipe && info.velocity.x > 0);
        const isSwipeLeft = info.offset.x < -swipeThreshold || (isHardSwipe && info.velocity.x < 0);

        if (isSwipeRight) {
            handleAccept(currentCandidate);
        } else if (isSwipeLeft) {
            handleRejectStart(currentCandidate);
        }
    };

    const handleAccept = (candidate: Candidate) => {
        if (isAnimating) return;

        setIsAnimating(true);
        setDirection("right");

        onDonnaSpeak?.(
            `Great choice! ${candidate.candidate.first_name} looks promising! 🎯`,
            "excited"
        );
        onAccept(candidate);

        // Wait for exit animation to complete
        setTimeout(() => {
            moveToNext();
        }, 400);
    };

    const handleRejectStart = (candidate: Candidate) => {
        if (isAnimating) return;

        setIsAnimating(true);
        setDirection("left");
        setPendingRejectCandidate(candidate);

        // Show rejection reasons immediately
        setTimeout(() => {
            setShowRejectionReasons(true);
            onDonnaSpeak?.("What didn't work about this candidate? 🤔", "thinking");
        }, 200);
    };

    const handleRejectConfirm = (reason: string, customText?: string) => {
        if (pendingRejectCandidate) {
            const fullReason = customText || reason;
            onReject(pendingRejectCandidate, fullReason);
            onDonnaSpeak?.("Thanks! I'll find better matches based on this feedback! 💡", "happy");

            setShowRejectionReasons(false);
            setPendingRejectCandidate(null);
            setCustomReason("");

            // Wait a bit before moving to next
            setTimeout(() => {
                moveToNext();
            }, 300);
        }
    };

    const moveToNext = () => {
        if (currentIndex < candidates.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setDirection(null);
            setIsAnimating(false);
        } else {
            // All cards reviewed
            setIsAnimating(false);
            onComplete();
        }
    };

    if (!currentCandidate) {
        return (
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-12 border border-slate-700/50 shadow-2xl flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-300 text-lg">All candidates reviewed!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-400">Reviewing candidates</p>
                    <p className="text-sm font-semibold text-amber-400">{remainingCount} remaining</p>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        animate={{
                            width: `${(remainingCount / candidates.length) * 100}%`,
                        }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* Card Deck */}
            <div className="relative h-[550px] flex items-center justify-center">
                {/* Stack of background cards */}
                {candidates.slice(currentIndex + 1, currentIndex + 3).map((_, idx) => (
                    <motion.div
                        key={`bg-${currentIndex + idx + 1}`}
                        className="absolute w-full max-w-md"
                        initial={false}
                        animate={{
                            scale: 1 - (idx + 1) * 0.05,
                            y: (idx + 1) * -10,
                            opacity: 1 - (idx + 1) * 0.2,
                        }}
                        transition={{ duration: 0.3 }}
                        style={{ zIndex: 10 - idx }}
                    >
                        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/30 backdrop-blur-sm h-[500px]" />
                    </motion.div>
                ))}

                {/* Current Card */}
                <AnimatePresence mode="wait" initial={false}>
                    <DraggableCard
                        key={currentCandidate.candidate.profile_id}
                        candidate={currentCandidate}
                        onDragEnd={handleDragEnd}
                        direction={direction}
                        onAccept={() => handleAccept(currentCandidate)}
                        onReject={() => handleRejectStart(currentCandidate)}
                        isAnimating={isAnimating}
                    />
                </AnimatePresence>
            </div>

            {/* Rejection Reasons Modal */}
            <AnimatePresence>
                {showRejectionReasons && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => {
                            setShowRejectionReasons(false);
                            setPendingRejectCandidate(null);
                            moveToNext();
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700/50 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">
                                What didn't work about this candidate?
                            </h3>

                            <div className="space-y-3 mb-6">
                                {REJECTION_REASONS.map((reason) => (
                                    <button
                                        key={reason.id}
                                        onClick={() => handleRejectConfirm(reason.label)}
                                        className="w-full p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-all text-left group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{reason.icon}</span>
                                            <span className="text-slate-300 group-hover:text-white font-medium">
                                                {reason.label}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <Input
                                    type="text"
                                    placeholder="Or type your own reason..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-300 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter" && customReason.trim()) {
                                            handleRejectConfirm("other", customReason);
                                        }
                                    }}
                                />
                                {customReason.trim() && (
                                    <Button
                                        onClick={() => handleRejectConfirm("other", customReason)}
                                        className="w-full mt-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                                    >
                                        Submit Feedback
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Separate component for the draggable card
function DraggableCard({
    candidate,
    onDragEnd,
    direction,
    onAccept,
    onReject,
    isAnimating,
}: {
    candidate: Candidate;
    onDragEnd: (event: any, info: PanInfo) => void;
    direction: "left" | "right" | null;
    onAccept: () => void;
    onReject: () => void;
    isAnimating: boolean;
}) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

    return (
        <motion.div
            className="absolute w-full max-w-md cursor-grab active:cursor-grabbing"
            style={{
                x,
                rotate,
                zIndex: 20,
            }}
            drag={isAnimating ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={onDragEnd}
            initial={{ scale: 1, opacity: 1 }}
            exit={{
                x: direction === "right" ? 400 : direction === "left" ? -400 : 0,
                opacity: 0,
                scale: 0.8,
                rotate: direction === "right" ? 30 : direction === "left" ? -30 : 0,
                transition: { duration: 0.4, ease: "easeOut" },
            }}
            whileTap={{ scale: 1.02 }}
        >
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                {/* Score Badge */}
                <div className="absolute top-4 right-4 z-10">
                    <motion.div
                        className="bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 rounded-full shadow-lg"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <p className="text-white font-bold text-sm">{candidate.score} Match</p>
                    </motion.div>
                </div>

                {/* Swipe Indicators */}
                <motion.div
                    className="absolute top-1/2 left-8 -translate-y-1/2 z-10"
                    style={{ opacity: useTransform(x, [-150, 0], [1, 0]) }}
                >
                    <div className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-xl rotate-[-25deg] border-4 border-white shadow-lg">
                        PASS
                    </div>
                </motion.div>

                <motion.div
                    className="absolute top-1/2 right-8 -translate-y-1/2 z-10"
                    style={{ opacity: useTransform(x, [0, 150], [0, 1]) }}
                >
                    <div className="bg-green-500 text-white px-6 py-3 rounded-full font-bold text-xl rotate-[25deg] border-4 border-white shadow-lg">
                        LIKE
                    </div>
                </motion.div>

                {/* Card Content */}
                <div className="p-6">
                    {/* Name & Title */}
                    <div className="mb-4">
                        <h3 className="text-2xl font-bold text-white mb-1">
                            {candidate.candidate.first_name} {candidate.candidate.last_name}
                        </h3>
                        <p className="text-lg text-slate-300">{candidate.candidate.title}</p>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{candidate.candidate.location || "Location N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Briefcase className="w-4 h-4" />
                            <span className="truncate">{candidate.candidate.current_industry || "Industry N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="truncate">{candidate.candidate.seniority_level || "Level N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Sparkles className="w-4 h-4" />
                            <span>{candidate.skill_match_count} skills</span>
                        </div>
                    </div>

                    {/* Match Details */}
                    {candidate.match_details.length > 0 && (
                        <div className="mb-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <p className="text-xs font-semibold text-blue-400 mb-2">Why this match?</p>
                            <ul className="space-y-1">
                                {candidate.match_details.slice(0, 3).map((detail, idx) => (
                                    <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                                        <span className="text-blue-400 mt-0.5">•</span>
                                        <span>{detail}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Skills */}
                    {candidate.matched_skills.length > 0 && (
                        <div className="mb-6">
                            <p className="text-xs font-semibold text-slate-400 mb-3">Matched Skills</p>
                            <div className="flex flex-wrap gap-2">
                                {candidate.matched_skills.slice(0, 8).map((skill, idx) => (
                                    <Badge
                                        key={idx}
                                        variant="outline"
                                        className="bg-purple-500/10 text-purple-300 border-purple-500/30"
                                    >
                                        {skill}
                                    </Badge>
                                ))}
                                {candidate.matched_skills.length > 8 && (
                                    <Badge variant="outline" className="bg-slate-800 text-slate-400">
                                        +{candidate.matched_skills.length - 8} more
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-slate-800">
                        <Button
                            onClick={onReject}
                            disabled={isAnimating}
                            className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white h-14 rounded-xl shadow-lg disabled:opacity-50"
                        >
                            <X className="w-5 h-5 mr-2" />
                            Pass
                        </Button>
                        <Button
                            onClick={onAccept}
                            disabled={isAnimating}
                            className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white h-14 rounded-xl shadow-lg disabled:opacity-50"
                        >
                            <ThumbsUp className="w-5 h-5 mr-2" />
                            Like
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}