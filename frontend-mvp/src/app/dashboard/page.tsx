// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Users,
    Sparkles,
    Plus,
    ChevronRight,
    Star,
    Trash2,
    Briefcase,
    Clock,
    Calendar,
    LogOut,
    User,
    Settings,
    HelpCircle,
    Zap,
    MessageCircle,
    Phone,
    Mail,
    Bell,
    Inbox,
    Send,
    Play,
    Reply,
    TrendingUp,
    FileText,
    UserCheck,
    CheckCircle2,
    X,
    Timer,
    BarChart3,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import * as dashboardApi from "@/utils/api/dashboardApi";
import type {
    EnhancedDashboardData,
    SearchSummary,
    DeepDiveSummary,
    InboxItem,
    UpcomingInterview,
    CandidateQuickView,
    PipelineStageStats,
    DonnaTip,
} from "@/utils/api/dashboardApi";
import { cn } from "@/lib/utils";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

// ================================================================
// DONNA MASCOT COMPONENT - Professional Version
// ================================================================

const DonnaAvatar = ({
    size = "md",
    animate = true,
}: {
    size?: "sm" | "md" | "lg";
    animate?: boolean;
}) => {
    const sizes = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-14 w-14",
    };

    const iconSizes = {
        sm: "h-4 w-4",
        md: "h-5 w-5",
        lg: "h-7 w-7",
    };

    return (
        <motion.div
            className={cn(
                sizes[size],
                "rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20"
            )}
            animate={
                animate
                    ? {
                        scale: [1, 1.02, 1],
                    }
                    : {}
            }
            transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
            }}
        >
            <Sparkles className={cn(iconSizes[size], "text-white")} />
        </motion.div>
    );
};

// Donna's insight card
const DonnaInsight = ({
    tip,
    onAction,
    onDismiss,
}: {
    tip: DonnaTip;
    onAction?: () => void;
    onDismiss?: () => void;
}) => {
    const variants = {
        default:
            "from-indigo-500/10 via-purple-500/5 to-transparent border-indigo-500/20",
        celebration:
            "from-emerald-500/10 via-green-500/5 to-transparent border-emerald-500/20",
        tip: "from-blue-500/10 via-cyan-500/5 to-transparent border-blue-500/20",
        urgent:
            "from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/20",
    };

    const icons = {
        default: <Sparkles className="h-4 w-4 text-indigo-400" />,
        celebration: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
        tip: <Zap className="h-4 w-4 text-blue-400" />,
        urgent: <Bell className="h-4 w-4 text-amber-400" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                "relative flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-r backdrop-blur-sm",
                variants[tip.variant]
            )}
        >
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/5 border border-white/10">
                {icons[tip.variant]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 leading-relaxed">{tip.message}</p>
            </div>
            {tip.action_label && (
                <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 bg-white/10 hover:bg-white/20 border-0"
                    onClick={onAction}
                >
                    {tip.action_label}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
            )}
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </motion.div>
    );
};

// ================================================================
// STAT CARD - Clean and Professional
// ================================================================

const StatCard = ({
    icon: Icon,
    value,
    label,
    sublabel,
    trend,
    onClick,
    variant = "default",
}: {
    icon: React.ElementType;
    value: number | string;
    label: string;
    sublabel?: string;
    trend?: { value: number; label: string };
    onClick?: () => void;
    variant?: "default" | "primary" | "success" | "warning";
}) => {
    const variants = {
        default: {
            bg: "bg-slate-800/50",
            border: "border-slate-700/50",
            iconBg: "bg-slate-700/50",
            iconColor: "text-slate-400",
        },
        primary: {
            bg: "bg-indigo-500/10",
            border: "border-indigo-500/20",
            iconBg: "bg-indigo-500/20",
            iconColor: "text-indigo-400",
        },
        success: {
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            iconBg: "bg-emerald-500/20",
            iconColor: "text-emerald-400",
        },
        warning: {
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            iconBg: "bg-amber-500/20",
            iconColor: "text-amber-400",
        },
    };

    const v = variants[variant];

    return (
        <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={cn(
                "relative p-5 rounded-2xl border transition-all duration-200 backdrop-blur-md",
                v.bg,
                v.border,
                onClick && "cursor-pointer hover:border-indigo-500/30"
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2.5 rounded-xl", v.iconBg)}>
                    <Icon className={cn("h-5 w-5", v.iconColor)} />
                </div>
                {trend && (
                    <div
                        className={cn(
                            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                            trend.value >= 0
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                        )}
                    >
                        <TrendingUp
                            className={cn("h-3 w-3", trend.value < 0 && "rotate-180")}
                        />
                        {Math.abs(trend.value)}%
                    </div>
                )}
            </div>
            <div className="text-3xl font-bold text-white mb-1">
                {typeof value === "number" ? value.toLocaleString() : value}
            </div>
            <div className="text-sm font-medium text-slate-300">{label}</div>
            {sublabel && (
                <div className="text-xs text-slate-500 mt-1">{sublabel}</div>
            )}
        </motion.div>
    );
};

// ================================================================
// PIPELINE PROGRESS - Visual Journey
// ================================================================

const PipelineProgress = ({
    stats,
    onStageClick,
}: {
    stats: PipelineStageStats;
    onStageClick?: (stage: string) => void;
}) => {
    const stages = [
        {
            key: "sourced",
            label: "Sourced",
            count: stats.sourced,
            icon: Search,
            color: "indigo",
        },
        {
            key: "enriched",
            label: "Analyzed",
            count: stats.enriched,
            icon: FileText,
            color: "blue",
        },
        {
            key: "outreach_sent",
            label: "Contacted",
            count: stats.outreach_sent,
            icon: Send,
            color: "cyan",
        },
        {
            key: "responded",
            label: "Responded",
            count: stats.responded,
            icon: Reply,
            color: "emerald",
        },
        {
            key: "scheduled",
            label: "Scheduled",
            count: stats.scheduled,
            icon: Calendar,
            color: "violet",
        },
        {
            key: "interviewed",
            label: "Interviewed",
            count: stats.interviewed,
            icon: UserCheck,
            color: "purple",
        },
        {
            key: "hired",
            label: "Hired",
            count: stats.hired,
            icon: CheckCircle2,
            color: "green",
        },
    ];

    const colorMap: Record<string, string> = {
        indigo: "from-indigo-500 to-indigo-600",
        blue: "from-blue-500 to-blue-600",
        cyan: "from-cyan-500 to-cyan-600",
        emerald: "from-emerald-500 to-emerald-600",
        violet: "from-violet-500 to-violet-600",
        purple: "from-purple-500 to-purple-600",
        green: "from-green-500 to-green-600",
    };

    const total = stages.reduce((sum, s) => sum + s.count, 0) || 1;

    return (
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white">Hiring Pipeline</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Track candidates through each stage
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white"
                    onClick={() => onStageClick?.("all")}
                >
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 rounded-full bg-slate-700/50 mb-6 overflow-hidden">
                <div className="absolute inset-0 flex">
                    {stages.map((stage, i) => {
                        const width = (stage.count / total) * 100;
                        return (
                            <motion.div
                                key={stage.key}
                                initial={{ width: 0 }}
                                animate={{ width: `${width}%` }}
                                transition={{ delay: i * 0.1, duration: 0.5 }}
                                className={cn(
                                    "h-full bg-gradient-to-r",
                                    colorMap[stage.color],
                                    i > 0 && "border-l-2 border-slate-800"
                                )}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Stage Cards */}
            <div className="grid grid-cols-7 gap-2">
                {stages.map((stage, i) => (
                    <motion.button
                        key={stage.key}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onStageClick?.(stage.key)}
                        className={cn(
                            "relative p-3 rounded-xl text-center transition-all",
                            "bg-slate-800/50 border border-slate-700/50",
                            "hover:border-indigo-500/30 hover:bg-slate-800"
                        )}
                    >
                        <div
                            className={cn(
                                "mx-auto w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                                `bg-gradient-to-br ${colorMap[stage.color]} bg-opacity-20`
                            )}
                        >
                            <stage.icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="text-lg font-bold text-white">{stage.count}</div>
                        <div className="text-xs text-slate-400 truncate">{stage.label}</div>

                        {/* Connector */}
                        {i < stages.length - 1 && (
                            <div className="absolute top-1/2 -right-1 w-2 h-px bg-slate-600 hidden lg:block" />
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

// ================================================================
// INBOX ITEM - Clean notification style
// ================================================================

const InboxListItem = ({
    item,
    onClick,
    onAction,
}: {
    item: InboxItem;
    onClick?: () => void;
    onAction?: () => void;
}) => {
    const typeConfig = {
        response: {
            icon: Reply,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
        },
        interview: {
            icon: Phone,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
        },
        reminder: {
            icon: Bell,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
        },
        milestone: {
            icon: Star,
            color: "text-purple-400",
            bg: "bg-purple-500/10",
        },
    };

    const config = typeConfig[item.type] || typeConfig.reminder;
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ x: 4 }}
            onClick={onClick}
            className={cn(
                "flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer backdrop-blur-sm",
                "border border-transparent",
                item.is_unread
                    ? "bg-slate-800/70 hover:bg-slate-800"
                    : "bg-slate-800/30 hover:bg-slate-800/50",
                item.is_urgent && "border-l-2 border-l-amber-500"
            )}
        >
            <div
                className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
                    config.bg
                )}
            >
                <Icon className={cn("h-5 w-5", config.color)} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "font-medium truncate",
                            item.is_unread ? "text-white" : "text-slate-300"
                        )}
                    >
                        {item.title}
                    </span>
                    {item.is_unread && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                </div>
                <p className="text-sm text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-slate-500">{item.time}</span>
                {onAction && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction();
                        }}
                    >
                        View
                    </Button>
                )}
            </div>
        </motion.div>
    );
};

// ================================================================
// INTERVIEW CARD - Upcoming interviews
// ================================================================

const InterviewCard = ({
    interview,
    onStart,
    onViewProfile,
}: {
    interview: UpcomingInterview;
    onStart?: () => void;
    onViewProfile?: () => void;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "p-5 rounded-2xl border transition-all backdrop-blur-md",
                interview.is_today
                    ? "bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border-indigo-500/30"
                    : "bg-slate-800/30 border-slate-700/50"
            )}
        >
            <div className="flex items-center justify-between mb-4">
                {interview.is_today ? (
                    <Badge
                        variant="secondary"
                        className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    >
                        <Zap className="h-3 w-3 mr-1" />
                        Today
                    </Badge>
                ) : (
                    <Badge
                        variant="secondary"
                        className="bg-slate-700/50 text-slate-300 border-slate-600/50"
                    >
                        Upcoming
                    </Badge>
                )}
                <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Timer className="h-4 w-4" />
                    {interview.time_until}
                </div>
            </div>

            <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-semibold text-white truncate">
                        {interview.candidate_name}
                    </h4>
                    <p className="text-sm text-slate-400 truncate">
                        {interview.job_title}
                    </p>
                    <p className="text-sm text-indigo-400 font-medium mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(interview.scheduled_datetime).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        })}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {interview.is_today && onStart && (
                    <Button
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                        onClick={onStart}
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Start Interview
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 hover:bg-slate-800"
                    onClick={onViewProfile}
                >
                    <User className="h-4 w-4 mr-1.5" />
                    Profile
                </Button>
            </div>
        </motion.div>
    );
};

// ================================================================
// CANDIDATE CARD - Quick view
// ================================================================

const CandidateCard = ({
    candidate,
    onClick,
}: {
    candidate: CandidateQuickView;
    onClick?: () => void;
}) => {
    const stageColors: Record<string, { bg: string; text: string }> = {
        sourced: { bg: "bg-slate-500/20", text: "text-slate-300" },
        enriched: { bg: "bg-blue-500/20", text: "text-blue-300" },
        outreach_sent: { bg: "bg-cyan-500/20", text: "text-cyan-300" },
        responded: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
        scheduled: { bg: "bg-violet-500/20", text: "text-violet-300" },
        interviewed: { bg: "bg-purple-500/20", text: "text-purple-300" },
        hired: { bg: "bg-green-500/20", text: "text-green-300" },
    };

    const colors = stageColors[candidate.stage] || stageColors.sourced;
    const initials = candidate.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            onClick={onClick}
            className={cn(
                "p-4 rounded-xl transition-all cursor-pointer backdrop-blur-sm",
                "bg-slate-800/30 border border-slate-700/50",
                "hover:bg-slate-800/50 hover:border-indigo-500/30"
            )}
        >
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/30 flex items-center justify-center font-semibold text-indigo-300 text-sm">
                    {initials}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white truncate">
                            {candidate.name}
                        </h4>
                        {candidate.is_favorite && (
                            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-sm text-slate-400 truncate mb-2">
                        {candidate.title || "No title"}
                    </p>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="secondary"
                            className={cn(
                                "text-xs font-medium border-0",
                                colors.bg,
                                colors.text
                            )}
                        >
                            {candidate.stage_label}
                        </Badge>
                        <span className="text-xs text-slate-500">
                            {candidate.last_activity}
                        </span>
                    </div>
                </div>

                {candidate.match_score && (
                    <div
                        className={cn(
                            "px-2.5 py-1 rounded-lg text-sm font-bold",
                            candidate.match_score >= 80
                                ? "bg-emerald-500/20 text-emerald-400"
                                : candidate.match_score >= 60
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-slate-600/50 text-slate-300"
                        )}
                    >
                        {candidate.match_score}%
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ================================================================
// SEARCH CARD - Recent searches
// ================================================================

const SearchCard = ({
    search,
    onView,
    onDelete,
}: {
    search: SearchSummary;
    onView: () => void;
    onDelete: () => void;
}) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Recently";
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / 86400000);

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
        });
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            onClick={onView}
            className={cn(
                "group p-5 rounded-xl transition-all cursor-pointer backdrop-blur-sm",
                "bg-slate-800/30 border border-slate-700/50",
                "hover:bg-slate-800/50 hover:border-indigo-500/30"
            )}
        >
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5 text-indigo-400" />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors mb-1 line-clamp-1">
                {search.role_title || "Untitled Search"}
            </h3>

            <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(search.created_at)}
            </div>

            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-white">
                        {search.enriched_count}
                    </span>
                    <span className="text-slate-400">found</span>
                </div>
                {search.shortlisted_count > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        <span className="font-medium text-white">
                            {search.shortlisted_count}
                        </span>
                        <span className="text-slate-400">saved</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// ================================================================
// DEEP DIVE CARD
// ================================================================

const DeepDiveCard = ({
    deepDive,
    onClick,
}: {
    deepDive: DeepDiveSummary;
    onClick: () => void;
}) => {
    const initials = deepDive.candidate_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Recently";
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
        });
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            onClick={onClick}
            className={cn(
                "group p-4 rounded-xl transition-all cursor-pointer backdrop-blur-sm",
                "bg-slate-800/30 border border-slate-700/50",
                "hover:bg-slate-800/50 hover:border-emerald-500/30"
            )}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center font-semibold text-emerald-300 text-sm flex-shrink-0">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate group-hover:text-emerald-400 transition-colors">
                        {deepDive.candidate_name}
                    </h4>
                    <p className="text-sm text-slate-400 truncate">
                        {deepDive.candidate_title || "Profile analyzed"}
                    </p>
                </div>
                {deepDive.match_score && (
                    <Badge
                        variant="secondary"
                        className={cn(
                            "flex-shrink-0",
                            deepDive.match_score >= 80
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-600/50 text-slate-300"
                        )}
                    >
                        {deepDive.match_score}% match
                    </Badge>
                )}
                <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatDate(deepDive.created_at)}
                </span>
            </div>
        </motion.div>
    );
};

// ================================================================
// EMPTY STATE
// ================================================================

const EmptyState = ({
    icon: Icon,
    title,
    message,
    actionLabel,
    onAction,
}: {
    icon: React.ElementType;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 px-6 text-center backdrop-blur-sm"
        >
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
                <Icon className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-slate-400 max-w-sm mb-6">{message}</p>
            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {actionLabel}
                </Button>
            )}
        </motion.div>
    );
};

// ================================================================
// QUICK ACTION BUTTON
// ================================================================

const QuickAction = ({
    icon: Icon,
    label,
    description,
    onClick,
    variant = "default",
}: {
    icon: React.ElementType;
    label: string;
    description: string;
    onClick: () => void;
    variant?: "default" | "primary";
}) => {
    return (
        <motion.button
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={cn(
                "w-full p-5 rounded-2xl text-left transition-all backdrop-blur-sm",
                "border group",
                variant === "primary"
                    ? "bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/30 hover:border-indigo-400/50"
                    : "bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/30 hover:bg-slate-800/50"
            )}
        >
            <div
                className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                    variant === "primary"
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                        : "bg-slate-700/50 group-hover:bg-indigo-500/20"
                )}
            >
                <Icon
                    className={cn(
                        "h-6 w-6",
                        variant === "primary"
                            ? "text-white"
                            : "text-slate-400 group-hover:text-indigo-400"
                    )}
                />
            </div>
            <h3
                className={cn(
                    "text-lg font-semibold mb-1 transition-colors",
                    variant === "primary"
                        ? "text-white"
                        : "text-white group-hover:text-indigo-400"
                )}
            >
                {label}
            </h3>
            <p className="text-sm text-slate-400">{description}</p>
        </motion.button>
    );
};

// ================================================================
// SECTION HEADER
// ================================================================

const SectionHeader = ({
    title,
    subtitle,
    action,
    actionLabel,
}: {
    title: string;
    subtitle?: string;
    action?: () => void;
    actionLabel?: string;
}) => {
    return (
        <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                {subtitle && (
                    <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
                )}
            </div>
            {action && actionLabel && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white"
                    onClick={action}
                >
                    {actionLabel}
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            )}
        </div>
    );
};

// ================================================================
// MAIN DASHBOARD PAGE
// ================================================================

export default function DashboardPage() {
    const router = useRouter();
    const { token, isAuthenticated, logout } = useAuth();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dashboardData, setDashboardData] =
        useState<EnhancedDashboardData | null>(null);

    // UI State
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [showDonnaTip, setShowDonnaTip] = useState(true);
    const [activeTab, setActiveTab] = useState<
        "overview" | "inbox" | "candidates" | "searches" | "deepdives"
    >("overview");

    const menuRef = useRef<HTMLDivElement>(null);

    // Get time-based greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        if (hour < 21) return "Good evening";
        return "Good night";
    };

    // Authentication check
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    // Click outside handler for menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsUserMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load dashboard data
    const loadDashboard = async (showRefresh = false) => {
        if (!token) return;

        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const data = await dashboardApi.getEnhancedDashboard(token);
            setDashboardData(data);
        } catch (error) {
            console.error("Failed to load dashboard:", error);
            // Fallback to legacy endpoint
            try {
                const legacyData = await dashboardApi.getDashboard(token);
                setDashboardData({
                    ...legacyData,
                    pipeline_stats: {
                        sourced: legacyData.metrics.total_candidates_analyzed,
                        enriched: 0,
                        outreach_sent: 0,
                        outreach_opened: 0,
                        outreach_clicked: 0,
                        responded: 0,
                        scheduled: 0,
                        interviewed: 0,
                        offered: 0,
                        hired: 0,
                    },
                    inbox_items: [],
                    upcoming_interviews: [],
                    recent_candidates: [],
                    donna_tip: undefined,
                });
            } catch (e) {
                console.error("Failed to load legacy dashboard:", e);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [token]);

    // Handlers
    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const handleDeleteSearch = async (sessionId: string) => {
        if (!token || !confirm("Archive this search?")) return;
        try {
            await dashboardApi.deleteSearch(sessionId, token);
            loadDashboard(true);
        } catch (error) {
            console.error("Failed to delete search:", error);
        }
    };

    const handleDonnaTipAction = () => {
        if (!dashboardData?.donna_tip?.action_target) return;
        router.push(dashboardData.donna_tip.action_target);
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen relative overflow-hidden bg-slate-950 flex flex-col items-center justify-center gap-4">
                {/* Animated Background for Loading Screen */}
                <AnimatedBackground />

                <div className="relative z-10 flex flex-col items-center gap-4">
                    <DonnaAvatar size="lg" />
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-center"
                    >
                        <p className="text-lg font-medium text-white">
                            Getting things ready
                        </p>
                        <p className="text-sm text-slate-400 mt-1">Just a moment...</p>
                    </motion.div>
                </div>
            </div>
        );
    }

    const metrics = dashboardData?.metrics;
    const pipelineStats = dashboardData?.pipeline_stats;
    const firstName = dashboardData?.user?.username?.split("@")[0] || "there";
    const unreadCount =
        dashboardData?.inbox_items?.filter((i) => i.is_unread).length || 0;

    return (
        <TooltipProvider>
            <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white">
                {/* Enhanced Animated Background */}
                <AnimatedBackground />

                {/* Content Wrapper to ensure it sits above background */}
                <div className="relative z-10">
                    {/* ===== HEADER ===== */}
                    <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50">
                        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                            {/* Logo */}
                            <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => router.push("/dashboard")}
                            >
                                <DonnaAvatar size="sm" animate={false} />
                                <span className="font-bold text-xl tracking-tight">
                                    NeuraLeap
                                </span>
                            </div>

                            {/* Center Navigation */}
                            <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                                {[
                                    { id: "overview", label: "Overview", icon: BarChart3 },
                                    {
                                        id: "inbox",
                                        label: "Inbox",
                                        icon: Inbox,
                                        badge: unreadCount,
                                    },
                                    { id: "candidates", label: "Candidates", icon: Users },
                                    { id: "searches", label: "Searches", icon: Search },
                                    { id: "deepdives", label: "Deep Dives", icon: FileText },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id as typeof activeTab)}
                                        className={cn(
                                            "relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                            activeTab === item.id
                                                ? "bg-slate-700/50 text-white"
                                                : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                                        )}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                        {item.badge && item.badge > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                {item.badge}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </nav>

                            {/* Right Side */}
                            <div className="flex items-center gap-3">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-slate-400 hover:text-white"
                                            onClick={() => loadDashboard(true)}
                                            disabled={isRefreshing}
                                        >
                                            <RefreshCw
                                                className={cn(
                                                    "h-5 w-5",
                                                    isRefreshing && "animate-spin"
                                                )}
                                            />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Refresh</TooltipContent>
                                </Tooltip>

                                <Button
                                    onClick={() => router.push("/search")}
                                    size="sm"
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Find Talent
                                </Button>

                                {/* User Menu */}
                                <div className="relative" ref={menuRef}>
                                    <button
                                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                        className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/30 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all"
                                    >
                                        <span className="text-white font-bold text-sm">
                                            {firstName.substring(0, 2).toUpperCase()}
                                        </span>
                                    </button>

                                    <AnimatePresence>
                                        {isUserMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute right-0 mt-2 w-56 bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-50 overflow-hidden"
                                            >
                                                <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-indigo-500/10 to-transparent">
                                                    <p className="font-semibold text-sm text-white truncate">
                                                        Hey {firstName}!
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Let&apos;s find great talent
                                                    </p>
                                                </div>
                                                <div className="p-1.5 space-y-0.5">
                                                    <MenuButton icon={User} label="My Profile" />
                                                    <MenuButton icon={Settings} label="Settings" />
                                                    <MenuButton
                                                        icon={HelpCircle}
                                                        label="Help & Support"
                                                    />
                                                    <Separator className="my-1 bg-slate-700/50" />
                                                    <button
                                                        onClick={handleLogout}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors font-medium"
                                                    >
                                                        <LogOut className="h-4 w-4" /> Sign Out
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ===== MAIN CONTENT ===== */}
                    <main className="max-w-7xl mx-auto px-6 py-8">
                        {/* ===== HERO SECTION ===== */}
                        <section className="mb-8">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start justify-between gap-6"
                            >
                                <div>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                                        {getGreeting()}, {firstName}
                                    </h1>
                                    <p className="text-lg text-slate-400">
                                        Here&apos;s what&apos;s happening with your hiring
                                    </p>
                                </div>

                                {/* Quick Stats */}
                                <div className="hidden lg:flex items-center gap-6 bg-slate-800/30 border border-slate-700/50 rounded-2xl px-6 py-4 backdrop-blur-md">
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-white">
                                                    {metrics?.total_candidates_analyzed || 0}
                                                </div>
                                                <div className="text-xs text-slate-400">Found</div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>Total candidates found</TooltipContent>
                                    </Tooltip>
                                    <Separator
                                        orientation="vertical"
                                        className="h-10 bg-slate-700"
                                    />
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-amber-400">
                                                    {pipelineStats?.outreach_sent || 0}
                                                </div>
                                                <div className="text-xs text-slate-400">Contacted</div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Candidates you&apos;ve reached out to
                                        </TooltipContent>
                                    </Tooltip>
                                    <Separator
                                        orientation="vertical"
                                        className="h-10 bg-slate-700"
                                    />
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-emerald-400">
                                                    {pipelineStats?.responded || 0}
                                                </div>
                                                <div className="text-xs text-slate-400">Replied</div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>Candidates who responded</TooltipContent>
                                    </Tooltip>
                                </div>
                            </motion.div>
                        </section>

                        {/* ===== DONNA'S TIP ===== */}
                        <AnimatePresence>
                            {showDonnaTip && dashboardData?.donna_tip && (
                                <motion.section
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-8"
                                >
                                    <DonnaInsight
                                        tip={dashboardData.donna_tip}
                                        onAction={handleDonnaTipAction}
                                        onDismiss={() => setShowDonnaTip(false)}
                                    />
                                </motion.section>
                            )}
                        </AnimatePresence>

                        {/* ===== TAB CONTENT ===== */}
                        <AnimatePresence mode="wait">
                            {/* OVERVIEW TAB */}
                            {activeTab === "overview" && (
                                <motion.div
                                    key="overview"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-8"
                                >
                                    {/* Quick Actions */}
                                    <section>
                                        <SectionHeader title="Quick Actions" />
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <QuickAction
                                                icon={Search}
                                                label="Find New Talent"
                                                description="Start a new search and discover candidates"
                                                onClick={() => router.push("/search")}
                                                variant="primary"
                                            />
                                            <QuickAction
                                                icon={Users}
                                                label="View Candidates"
                                                description="See everyone in your pipeline"
                                                onClick={() => router.push("/pipeline")}
                                            />
                                            <QuickAction
                                                icon={FileText}
                                                label="Analyze Profile"
                                                description="Deep dive into any candidate"
                                                onClick={() => router.push("/deep-dive")}
                                            />
                                        </div>
                                    </section>

                                    {/* Pipeline Progress */}
                                    {pipelineStats && (
                                        <section>
                                            <PipelineProgress
                                                stats={pipelineStats}
                                                onStageClick={(stage) =>
                                                    router.push(`/pipeline?stage=${stage}`)
                                                }
                                            />
                                        </section>
                                    )}

                                    {/* Two Column Layout */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Upcoming Interviews */}
                                        <section>
                                            <SectionHeader
                                                title="Upcoming Interviews"
                                                action={() => setActiveTab("inbox")}
                                                actionLabel="View all"
                                            />
                                            {dashboardData?.upcoming_interviews &&
                                                dashboardData.upcoming_interviews.length > 0 ? (
                                                <div className="space-y-4">
                                                    {dashboardData.upcoming_interviews
                                                        .slice(0, 2)
                                                        .map((interview) => (
                                                            <InterviewCard
                                                                key={interview.schedule_id}
                                                                interview={interview}
                                                                onStart={() =>
                                                                    router.push(
                                                                        `/interview/${interview.interview_session_id}`
                                                                    )
                                                                }
                                                                onViewProfile={() =>
                                                                    router.push(
                                                                        `/candidate/${interview.candidate_id}`
                                                                    )
                                                                }
                                                            />
                                                        ))}
                                                </div>
                                            ) : (
                                                <div className="p-8 rounded-2xl bg-slate-800/30 border border-slate-700/50 text-center backdrop-blur-md">
                                                    <Calendar className="h-8 w-8 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-slate-400 text-sm">
                                                        No interviews scheduled
                                                    </p>
                                                </div>
                                            )}
                                        </section>

                                        {/* Recent Updates */}
                                        <section>
                                            <SectionHeader
                                                title="Recent Updates"
                                                subtitle={
                                                    unreadCount > 0 ? `${unreadCount} new` : undefined
                                                }
                                                action={() => setActiveTab("inbox")}
                                                actionLabel="View all"
                                            />
                                            {dashboardData?.inbox_items &&
                                                dashboardData.inbox_items.length > 0 ? (
                                                <div className="space-y-2 bg-slate-800/20 rounded-2xl border border-slate-700/50 p-2 backdrop-blur-md">
                                                    {dashboardData.inbox_items
                                                        .slice(0, 3)
                                                        .map((item) => (
                                                            <InboxListItem
                                                                key={item.id}
                                                                item={item}
                                                                onClick={() =>
                                                                    console.log("View item", item.id)
                                                                }
                                                                onAction={() =>
                                                                    console.log("Action", item.id)
                                                                }
                                                            />
                                                        ))}
                                                </div>
                                            ) : (
                                                <div className="p-8 rounded-2xl bg-slate-800/30 border border-slate-700/50 text-center backdrop-blur-md">
                                                    <Inbox className="h-8 w-8 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-slate-400 text-sm">
                                                        No new updates
                                                    </p>
                                                </div>
                                            )}
                                        </section>
                                    </div>

                                    {/* Stats Grid */}
                                    <section>
                                        <SectionHeader title="Your Progress" />
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <StatCard
                                                icon={Search}
                                                value={metrics?.total_searches || 0}
                                                label="Searches"
                                                sublabel="Jobs you're hiring for"
                                                variant="primary"
                                                onClick={() => setActiveTab("searches")}
                                            />
                                            <StatCard
                                                icon={Users}
                                                value={metrics?.total_candidates_analyzed || 0}
                                                label="Candidates Found"
                                                sublabel="People you've discovered"
                                                onClick={() => router.push("/pipeline")}
                                            />
                                            <StatCard
                                                icon={Star}
                                                value={metrics?.total_candidates_shortlisted || 0}
                                                label="Favorites"
                                                sublabel="Your top picks"
                                                variant="warning"
                                                onClick={() =>
                                                    router.push("/pipeline?filter=favorites")
                                                }
                                            />
                                            <StatCard
                                                icon={FileText}
                                                value={metrics?.total_deep_dives || 0}
                                                label="Deep Dives"
                                                sublabel="Detailed analyses"
                                                variant="success"
                                                onClick={() => setActiveTab("deepdives")}
                                            />
                                        </div>
                                    </section>
                                </motion.div>
                            )}

                            {/* INBOX TAB */}
                            {activeTab === "inbox" && (
                                <motion.div
                                    key="inbox"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <SectionHeader
                                        title="Inbox"
                                        subtitle="All your notifications and candidate responses"
                                    />
                                    {dashboardData?.inbox_items &&
                                        dashboardData.inbox_items.length > 0 ? (
                                        <div className="space-y-2 bg-slate-800/20 rounded-2xl border border-slate-700/50 p-3 backdrop-blur-md">
                                            {dashboardData.inbox_items.map((item) => (
                                                <InboxListItem
                                                    key={item.id}
                                                    item={item}
                                                    onClick={() => console.log("View item", item.id)}
                                                    onAction={() => console.log("Action", item.id)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={Inbox}
                                            title="Your inbox is empty"
                                            message="When candidates respond or you have notifications, they'll appear here"
                                        />
                                    )}
                                </motion.div>
                            )}

                            {/* CANDIDATES TAB */}
                            {activeTab === "candidates" && (
                                <motion.div
                                    key="candidates"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <SectionHeader
                                        title="Recent Candidates"
                                        subtitle="Everyone you've found across all searches"
                                        action={() => router.push("/pipeline")}
                                        actionLabel="Open Pipeline"
                                    />
                                    {dashboardData?.recent_candidates &&
                                        dashboardData.recent_candidates.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {dashboardData.recent_candidates.map((candidate) => (
                                                <CandidateCard
                                                    key={candidate.candidate_id}
                                                    candidate={candidate}
                                                    onClick={() =>
                                                        router.push(
                                                            `/candidate/${candidate.candidate_id}`
                                                        )
                                                    }
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={Users}
                                            title="No candidates yet"
                                            message="Start a search to find amazing candidates"
                                            actionLabel="Start Searching"
                                            onAction={() => router.push("/search")}
                                        />
                                    )}
                                </motion.div>
                            )}

                            {/* SEARCHES TAB */}
                            {activeTab === "searches" && (
                                <motion.div
                                    key="searches"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <SectionHeader
                                        title="All Searches"
                                        subtitle="Your saved searches and their results"
                                    />
                                    {dashboardData?.recent_searches &&
                                        dashboardData.recent_searches.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {dashboardData.recent_searches.map((search) => (
                                                <SearchCard
                                                    key={search.session_id}
                                                    search={search}
                                                    onView={() =>
                                                        router.push(`/results/${search.session_id}`)
                                                    }
                                                    onDelete={() =>
                                                        handleDeleteSearch(search.session_id)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={Search}
                                            title="No searches yet"
                                            message="Start your first search to find amazing candidates"
                                            actionLabel="Start Searching"
                                            onAction={() => router.push("/search")}
                                        />
                                    )}
                                </motion.div>
                            )}

                            {/* DEEP DIVES TAB */}
                            {activeTab === "deepdives" && (
                                <motion.div
                                    key="deepdives"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <SectionHeader
                                        title="Deep Dive Analyses"
                                        subtitle="Detailed candidate analyses you've performed"
                                    />
                                    {dashboardData?.recent_deep_dives &&
                                        dashboardData.recent_deep_dives.length > 0 ? (
                                        <div className="space-y-3 bg-slate-800/20 rounded-2xl border border-slate-700/50 p-4 backdrop-blur-md">
                                            {dashboardData.recent_deep_dives.map((deepDive) => (
                                                <DeepDiveCard
                                                    key={deepDive.result_id}
                                                    deepDive={deepDive}
                                                    onClick={() =>
                                                        router.push(`/deep-dive/${deepDive.result_id}`)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={FileText}
                                            title="No deep dives yet"
                                            message="Analyze a candidate to get detailed insights"
                                            actionLabel="Analyze Profile"
                                            onAction={() => router.push("/deep-dive")}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </main>

                    {/* ===== FOOTER ===== */}
                    <footer className="border-t border-slate-800/50 bg-slate-900/50 py-6 mt-12 backdrop-blur-md">
                        <div className="max-w-7xl mx-auto px-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <DonnaAvatar size="sm" animate={false} />
                                    <p className="text-sm text-slate-400">
                                        Need help? I&apos;m always here for you
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <MessageCircle className="h-4 w-4 mr-2" />
                                        Chat
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <Mail className="h-4 w-4 mr-2" />
                                        Email
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <HelpCircle className="h-4 w-4 mr-2" />
                                        Help
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </TooltipProvider>
    );
}

// ================================================================
// HELPER COMPONENTS
// ================================================================

function MenuButton({
    icon: Icon,
    label,
}: {
    icon: React.ElementType;
    label: string;
}) {
    return (
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all group">
            <Icon className="h-4 w-4 group-hover:text-indigo-400 transition-colors" />
            {label}
        </button>
    );
}