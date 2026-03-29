/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Briefcase,
    Users,
    Mail,
    Search,
    MessageSquare,
    Calendar,
    Send,
    ArrowRight,
    Loader2,
    AlertCircle,
    Bot,
    Hand,
    ExternalLink,
    Home,
    Plus,
    FileText,
    Sparkles,
    TrendingUp,
    Eye,
    Zap,
    Phone,
    CheckCheck,
    Circle,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getPipelineSessions } from "@/utils/api/conversationApiV2";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface Campaign {
    session_id: string;
    batch_id: string;
    source: "donna_search" | "manual_import";
    job_title: string;
    total_candidates: number;
    status_counts: {
        pending: number;
        enriching: number;
        enriched: number;
        outreach_sent: number;
        responded: number;
        interview_scheduled: number;
        interview_completed: number;
        failed: number;
    };
    needs_action: {
        needs_email_input: number;
        needs_outreach_start: number;
        needs_review: number;
    };
    created_at: string;
    last_updated: string;
}

// ============================================================================
// ENHANCED VERCEL-STYLE GRID BACKGROUND (MORE VISIBLE)
// ============================================================================

const VercelGrid = () => (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Fine grid - more visible */}
        <div
            className="absolute inset-0"
            style={{
                backgroundImage: `
                    linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
                `,
                backgroundSize: "64px 64px",
            }}
        />

        {/* Medium grid */}
        <div
            className="absolute inset-0"
            style={{
                backgroundImage: `
                    linear-gradient(to right, rgba(139, 92, 246, 0.12) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(139, 92, 246, 0.12) 1px, transparent 1px)
                `,
                backgroundSize: "256px 256px",
            }}
        />

        {/* Large accent grid */}
        <div
            className="absolute inset-0"
            style={{
                backgroundImage: `
                    linear-gradient(to right, rgba(139, 92, 246, 0.2) 2px, transparent 2px),
                    linear-gradient(to bottom, rgba(139, 92, 246, 0.2) 2px, transparent 2px)
                `,
                backgroundSize: "512px 512px",
            }}
        />

        {/* Radial gradient overlay - center glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),rgba(10,10,10,0)_50%)]" />

        {/* Top fade to hide grid at top */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />

        {/* Subtle animated scanline effect */}
        <motion.div
            className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"
            animate={{
                top: ["0%", "100%"],
            }}
            transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
            }}
        />
    </div>
);

// ============================================================================
// DONNA MASCOT
// ============================================================================

const DonnaMascot = ({
    mood = "happy",
    size = "md",
    message,
}: {
    mood?: "happy" | "thinking" | "excited" | "waving";
    size?: "sm" | "md" | "lg";
    message?: string;
}) => {
    const sizeConfig = {
        sm: { box: "w-10 h-10", icon: "w-5 h-5" },
        md: { box: "w-12 h-12", icon: "w-6 h-6" },
        lg: { box: "w-20 h-20", icon: "w-10 h-10" },
    };

    const moodConfig = {
        happy: {
            icon: Bot,
            bg: "from-violet-500 to-purple-600",
            animation: { y: [0, -4, 0] },
        },
        thinking: {
            icon: Bot,
            bg: "from-blue-500 to-cyan-500",
            animation: { rotate: [-5, 5, -5] },
        },
        excited: {
            icon: Sparkles,
            bg: "from-amber-400 to-orange-500",
            animation: { scale: [1, 1.1, 1] },
        },
        waving: {
            icon: Hand,
            bg: "from-emerald-500 to-green-600",
            animation: { rotate: [0, 15, -15, 0] },
        },
    };

    const config = moodConfig[mood];
    const Icon = config.icon;

    return (
        <TooltipProvider>
            <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                    <motion.div
                        className={cn(
                            "rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg border border-white/20 relative cursor-help",
                            config.bg,
                            sizeConfig[size].box
                        )}
                        animate={config.animation}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Icon className={sizeConfig[size].icon} strokeWidth={2} />
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/30 to-transparent" />
                    </motion.div>
                </TooltipTrigger>
                {message && (
                    <TooltipContent
                        side="right"
                        className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-xs"
                    >
                        <p className="text-sm">{message}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
};

// ============================================================================
// NAVIGATION BAR
// ============================================================================

const NavigationBar = () => {
    const router = useRouter();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/[0.08]">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <button
                        onClick={() => router.push("/")}
                        className="flex items-center gap-3 group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-white group-hover:text-violet-400 transition-colors">
                            Hire-X
                        </span>
                    </button>

                    <div className="hidden md:flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/dashboard")}
                            className="text-zinc-400 hover:text-white hover:bg-white/5"
                        >
                            <Home className="w-4 h-4 mr-2" />
                            Dashboard
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white bg-white/10 hover:bg-white/15"
                        >
                            <Briefcase className="w-4 h-4 mr-2" />
                            My Searches
                        </Button>
                    </div>
                </div>

                <Button
                    onClick={() => router.push("/search")}
                    className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 h-9 shadow-lg shadow-violet-900/30"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Search
                </Button>
            </div>
        </nav>
    );
};

// ============================================================================
// JOURNEY TIMELINE WITH WAVE ANIMATION
// ============================================================================

interface TimelineStage {
    id: string;
    label: string;
    subtitle: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    count: number;
    subStages?: {
        label: string;
        count: number;
        color: string;
    }[];
}

const JourneyTimeline = ({ campaign }: { campaign: Campaign }) => {
    const stats = campaign.status_counts;
    const total = campaign.total_candidates;

    const stages: TimelineStage[] = [
        {
            id: "enrichment",
            label: "Found Profiles",
            subtitle: "Analyzing candidates",
            icon: Zap,
            color: "text-blue-400",
            bgColor: "bg-blue-500/20",
            borderColor: "border-blue-500/30",
            count: stats.enriched + stats.outreach_sent + stats.responded + stats.interview_scheduled + stats.interview_completed,
        },
        {
            id: "outreach",
            label: "Sent Emails",
            subtitle: "Waiting for replies",
            icon: Mail,
            color: "text-purple-400",
            bgColor: "bg-purple-500/20",
            borderColor: "border-purple-500/30",
            count: stats.outreach_sent + stats.responded + stats.interview_scheduled + stats.interview_completed,
        },
        {
            id: "response",
            label: "Got Replies",
            subtitle: "Candidates interested",
            icon: MessageSquare,
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/20",
            borderColor: "border-emerald-500/30",
            count: stats.responded + stats.interview_scheduled + stats.interview_completed,
        },
        {
            id: "interview",
            label: "Interviews",
            subtitle: "Meeting candidates",
            icon: Phone,
            color: "text-amber-400",
            bgColor: "bg-amber-500/20",
            borderColor: "border-amber-500/30",
            count: stats.interview_scheduled + stats.interview_completed,
            subStages: [
                {
                    label: "Scheduled",
                    count: stats.interview_scheduled,
                    color: "text-amber-300",
                },
                {
                    label: "Done",
                    count: stats.interview_completed,
                    color: "text-emerald-400",
                },
            ],
        },
    ];

    return (
        <div className="relative">
            {/* Desktop Timeline */}
            <div className="hidden lg:block">
                <div className="flex items-center justify-between gap-2">
                    {stages.map((stage, index) => {
                        const Icon = stage.icon;
                        const isActive = stage.count > 0;
                        const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;
                        const isComplete = percentage === 100;
                        const hasNext = index < stages.length - 1;
                        const nextIsActive = hasNext && stages[index + 1].count > 0;

                        return (
                            <div key={stage.id} className="flex items-center flex-1">
                                {/* Stage Card */}
                                <TooltipProvider>
                                    <Tooltip delayDuration={100}>
                                        <TooltipTrigger asChild>
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.1 }}
                                                className={cn(
                                                    "relative flex-1 rounded-xl border-2 p-4 transition-all duration-300 cursor-help",
                                                    isActive
                                                        ? `${stage.bgColor} ${stage.borderColor} shadow-lg`
                                                        : "bg-white/[0.02] border-white/[0.06] opacity-40"
                                                )}
                                            >
                                                {/* Icon Badge */}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-lg flex items-center justify-center mb-3 border-2 relative",
                                                    isActive ? `${stage.bgColor} ${stage.borderColor}` : "bg-white/5 border-white/10"
                                                )}>
                                                    <Icon className={cn("w-5 h-5", isActive ? stage.color : "text-zinc-600")} strokeWidth={2} />
                                                    {isComplete && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#0A0A0A]"
                                                        >
                                                            <CheckCheck className="w-3 h-3 text-white" strokeWidth={3} />
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* Label */}
                                                <div className="mb-2">
                                                    <div className={cn(
                                                        "text-sm font-bold mb-0.5",
                                                        isActive ? "text-white" : "text-zinc-600"
                                                    )}>
                                                        {stage.label}
                                                    </div>
                                                    <div className={cn(
                                                        "text-xs mb-2",
                                                        isActive ? "text-zinc-400" : "text-zinc-700"
                                                    )}>
                                                        {stage.subtitle}
                                                    </div>
                                                    <div className={cn(
                                                        "text-2xl font-bold",
                                                        isActive ? "text-white" : "text-zinc-700"
                                                    )}>
                                                        {stage.count}
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                {isActive && (
                                                    <div className="space-y-1">
                                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${percentage}%` }}
                                                                transition={{ duration: 1, delay: index * 0.15 }}
                                                                className={cn(
                                                                    "h-full rounded-full",
                                                                    stage.id === "enrichment" && "bg-blue-500",
                                                                    stage.id === "outreach" && "bg-purple-500",
                                                                    stage.id === "response" && "bg-emerald-500",
                                                                    stage.id === "interview" && "bg-amber-500"
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="text-xs text-zinc-500 font-medium">
                                                            {percentage}% of all
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Sub-stages for Interview */}
                                                {stage.subStages && isActive && (
                                                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-3">
                                                        {stage.subStages.map((sub) => (
                                                            <div key={sub.label} className="flex items-center gap-1.5">
                                                                <Circle className={cn("w-2 h-2", sub.color)} fill="currentColor" />
                                                                <span className="text-xs text-zinc-400">
                                                                    {sub.label}: <span className="font-semibold text-white">{sub.count}</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </motion.div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-zinc-900 border-zinc-800">
                                            <p className="text-xs font-medium">
                                                {stage.count} out of {total} candidates
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {/* Animated Connector with Wave */}
                                {hasNext && (
                                    <div className="relative flex items-center justify-center px-3">
                                        {/* Static Arrow */}
                                        <ArrowRight
                                            className={cn(
                                                "w-6 h-6 transition-all relative z-10",
                                                nextIsActive ? "text-violet-400 opacity-100" : "text-zinc-700 opacity-30"
                                            )}
                                            strokeWidth={2}
                                        />

                                        {/* Animated Wave/Pulse */}
                                        {nextIsActive && (
                                            <>
                                                <motion.div
                                                    className="absolute inset-0 flex items-center justify-center"
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{
                                                        opacity: [0, 0.5, 0],
                                                        scale: [0.8, 1.5, 1.8],
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: "easeOut",
                                                    }}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-violet-500/30" />
                                                </motion.div>
                                                <motion.div
                                                    className="absolute inset-0 flex items-center justify-center"
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{
                                                        opacity: [0, 0.3, 0],
                                                        scale: [0.8, 1.3, 1.6],
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: "easeOut",
                                                        delay: 0.5,
                                                    }}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-violet-500/30" />
                                                </motion.div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Timeline (Stacked) */}
            <div className="lg:hidden space-y-3">
                {stages.map((stage, index) => {
                    const Icon = stage.icon;
                    const isActive = stage.count > 0;
                    const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0;

                    return (
                        <motion.div
                            key={stage.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                                "rounded-xl border-2 p-4 flex items-center gap-4",
                                isActive
                                    ? `${stage.bgColor} ${stage.borderColor}`
                                    : "bg-white/[0.02] border-white/[0.06] opacity-40"
                            )}
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center border-2 shrink-0",
                                isActive ? `${stage.bgColor} ${stage.borderColor}` : "bg-white/5 border-white/10"
                            )}>
                                <Icon className={cn("w-6 h-6", isActive ? stage.color : "text-zinc-600")} strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-baseline justify-between mb-1">
                                    <div>
                                        <span className={cn("text-sm font-bold block", isActive ? "text-white" : "text-zinc-600")}>
                                            {stage.label}
                                        </span>
                                        <span className={cn("text-xs", isActive ? "text-zinc-400" : "text-zinc-700")}>
                                            {stage.subtitle}
                                        </span>
                                    </div>
                                    <span className={cn("text-xl font-bold", isActive ? "text-white" : "text-zinc-700")}>
                                        {stage.count}
                                    </span>
                                </div>
                                {isActive && (
                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            className={cn(
                                                "h-full rounded-full",
                                                stage.id === "enrichment" && "bg-blue-500",
                                                stage.id === "outreach" && "bg-purple-500",
                                                stage.id === "response" && "bg-emerald-500",
                                                stage.id === "interview" && "bg-amber-500"
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

// ============================================================================
// CAMPAIGN CARD (Simplified - Click goes directly to pipeline)
// ============================================================================

const CampaignCard = ({
    campaign,
    index,
}: {
    campaign: Campaign;
    index: number;
}) => {
    const router = useRouter();
    const stats = campaign.status_counts;
    const needs = campaign.needs_action;
    const total = campaign.total_candidates;

    // Determine primary action
    let primaryAction = {
        label: "View Details",
        icon: Eye,
        color: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200",
        url: `/pipeline/${campaign.session_id}`,
        urgent: false,
    };

    if (stats.interview_completed > 0) {
        primaryAction = {
            label: `${stats.interview_completed} Interview${stats.interview_completed === 1 ? "" : "s"} Done`,
            icon: CheckCheck,
            color: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30",
            url: `/pipeline/${campaign.session_id}?tab=completed`,
            urgent: true,
        };
    } else if (needs.needs_review > 0) {
        primaryAction = {
            label: `${needs.needs_review} New ${needs.needs_review === 1 ? "Reply" : "Replies"}`,
            icon: MessageSquare,
            color: "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30",
            url: `/pipeline/${campaign.session_id}?tab=responses`,
            urgent: true,
        };
    } else if (needs.needs_outreach_start > 0) {
        primaryAction = {
            label: `Ready to Email ${needs.needs_outreach_start} ${needs.needs_outreach_start === 1 ? "Person" : "People"}`,
            icon: Send,
            color: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30",
            url: `/pipeline/${campaign.session_id}?tab=outreach`,
            urgent: true,
        };
    } else if (needs.needs_email_input > 0) {
        primaryAction = {
            label: `${needs.needs_email_input} Missing Contact${needs.needs_email_input === 1 ? "" : "s"}`,
            icon: AlertCircle,
            color: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30",
            url: `/pipeline/${campaign.session_id}?tab=missing`,
            urgent: true,
        };
    }

    const ActionIcon = primaryAction.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            onClick={() => router.push(`/pipeline/${campaign.session_id}`)}
            className="group relative bg-[#0A0A0A]/60 backdrop-blur-sm border border-white/[0.08] rounded-2xl p-6 lg:p-8 hover:bg-[#0A0A0A]/80 hover:border-white/[0.12] transition-all duration-300 shadow-xl shadow-black/20 cursor-pointer"
        >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                                <Briefcase className="w-6 h-6 text-violet-400" strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg lg:text-xl font-bold text-white truncate group-hover:text-violet-200 transition-colors">
                                    {campaign.job_title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 lg:gap-3 mt-1">
                                    <span className="text-xs lg:text-sm text-zinc-500 flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" />
                                        {new Date(campaign.created_at).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                        })}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                    <span className="text-xs lg:text-sm text-zinc-500 flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {total} {total === 1 ? "candidate" : "candidates"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions Row */}
                        <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(primaryAction.url);
                                }}
                                className={cn(
                                    "h-9 px-3 lg:px-4 rounded-lg font-medium transition-all duration-200 text-xs lg:text-sm",
                                    primaryAction.color
                                )}
                            >
                                <ActionIcon className="w-4 h-4 mr-2" />
                                {primaryAction.label}
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/results/${campaign.session_id}`);
                                }}
                                className="h-9 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg text-xs lg:text-sm"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                <span className="hidden sm:inline">View Original Search</span>
                                <span className="sm:hidden">Original</span>
                                <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                            </Button>
                        </div>
                    </div>

                    {primaryAction.urgent && (
                        <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="hidden sm:block"
                        >
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                                Needs Attention
                            </Badge>
                        </motion.div>
                    )}
                </div>

                {/* Journey Timeline */}
                <JourneyTimeline campaign={campaign} />
            </div>
        </motion.div>
    );
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CampaignsPage() {
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        } else if (token) {
            loadCampaigns();
        }
    }, [isAuthenticated, token, router]);

    const loadCampaigns = async () => {
        if (!token) return;
        try {
            const data = await getPipelineSessions(token);
            setCampaigns(data.sessions || []);
        } catch (err) {
            console.error("Failed to load campaigns:", err);
        } finally {
            setLoading(false);
        }
    };

    // Filter and sort campaigns
    const filteredCampaigns = campaigns
        .filter((campaign) => {
            if (!searchQuery) return true;
            return campaign.job_title.toLowerCase().includes(searchQuery.toLowerCase());
        })
        .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortBy === "newest" ? dateB - dateA : dateA - dateB;
        });

    // Pagination
    const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
    const paginatedCampaigns = filteredCampaigns.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats
    const totalCandidates = campaigns.reduce((sum, c) => sum + c.total_candidates, 0);
    const totalReplies = campaigns.reduce(
        (sum, c) => sum + c.status_counts.responded + c.status_counts.interview_scheduled + c.status_counts.interview_completed,
        0
    );
    const totalInterviews = campaigns.reduce(
        (sum, c) => sum + c.status_counts.interview_completed,
        0
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <VercelGrid />
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <DonnaMascot mood="thinking" size="lg" />
                    <div className="text-center">
                        <div className="flex items-center gap-2 text-violet-400 mb-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="font-medium">Loading your searches...</span>
                        </div>
                        <p className="text-sm text-zinc-500">This will just take a moment</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white relative">
            <VercelGrid />
            <NavigationBar />

            <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6 pt-24 pb-20">
                {/* Hero Header */}
                <div className="mb-8 lg:mb-12">
                    <div className="flex items-center gap-4 mb-4">
                        <DonnaMascot
                            mood={campaigns.length > 0 ? "happy" : "waving"}
                            size="md"
                            message={
                                campaigns.length > 0
                                    ? "Looking good! Click on any search to see full details."
                                    : "Hi! I'm Donna. Let's find great candidates together!"
                            }
                        />
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-2">
                                Your Candidate Searches
                            </h1>
                            <p className="text-base lg:text-lg text-zinc-400">
                                {campaigns.length === 0
                                    ? "Start your first search and I'll help you connect with candidates"
                                    : `You have ${campaigns.length} active ${campaigns.length === 1 ? "search" : "searches"}`}
                            </p>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    {campaigns.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mt-6 lg:mt-8">
                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 lg:p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl lg:text-2xl font-bold text-white">{totalCandidates}</div>
                                        <div className="text-xs text-zinc-500 font-medium">Total People</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 lg:p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                        <MessageSquare className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl lg:text-2xl font-bold text-white">{totalReplies}</div>
                                        <div className="text-xs text-zinc-500 font-medium">Interested</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 lg:p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl lg:text-2xl font-bold text-white">{totalInterviews}</div>
                                        <div className="text-xs text-zinc-500 font-medium">Interviewed</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 lg:p-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <div className="text-xl lg:text-2xl font-bold text-white">
                                            {totalCandidates > 0
                                                ? Math.round((totalReplies / totalCandidates) * 100)
                                                : 0}
                                            %
                                        </div>
                                        <div className="text-xs text-zinc-500 font-medium">Interest Rate</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Search & Filter Bar */}
                {campaigns.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <Input
                                type="text"
                                placeholder="Search by job title..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="h-11 pl-10 bg-white/[0.03] border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
                            />
                        </div>
                        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                            <SelectTrigger className="w-full sm:w-[180px] h-11 bg-white/[0.03] border-white/10 rounded-lg text-white">
                                <ArrowUpDown className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Campaigns List */}
                {campaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 lg:py-24 border-2 border-dashed border-white/[0.08] rounded-3xl bg-white/[0.01]">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full" />
                            <DonnaMascot mood="waving" size="lg" />
                        </div>
                        <h3 className="text-xl lg:text-2xl font-bold text-white mb-3">No Searches Yet</h3>
                        <p className="text-sm lg:text-base text-zinc-400 mb-8 max-w-md text-center leading-relaxed px-4">
                            Start by searching for candidates. I&apos;ll find them, reach out, and let you know who&apos;s interested!
                        </p>
                        <Button
                            onClick={() => router.push("/search")}
                            className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-6 h-11 shadow-lg shadow-violet-900/30 group"
                        >
                            <Search className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                            Start Your First Search
                        </Button>
                    </div>
                ) : filteredCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-white/[0.08] rounded-2xl bg-white/[0.01]">
                        <Search className="w-12 h-12 text-zinc-600 mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">No matches found</h3>
                        <p className="text-sm text-zinc-500">Try a different search term</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4 lg:space-y-6">
                            {paginatedCampaigns.map((campaign, index) => (
                                <CampaignCard
                                    key={campaign.session_id}
                                    campaign={campaign}
                                    index={index}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="mt-8 flex items-center justify-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-10 w-10 rounded-lg bg-white/[0.03] border-white/10 hover:bg-white/[0.08] disabled:opacity-30"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <Button
                                        key={page}
                                        variant={currentPage === page ? "default" : "outline"}
                                        size="icon"
                                        onClick={() => setCurrentPage(page)}
                                        className={cn(
                                            "h-10 w-10 rounded-lg",
                                            currentPage === page
                                                ? "bg-violet-600 hover:bg-violet-500 text-white"
                                                : "bg-white/[0.03] border-white/10 hover:bg-white/[0.08]"
                                        )}
                                    >
                                        {page}
                                    </Button>
                                ))}

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-10 w-10 rounded-lg bg-white/[0.03] border-white/10 hover:bg-white/[0.08] disabled:opacity-30"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}