"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Briefcase,
    Users,
    Mail,
    ChevronRight,
    Sparkles,
    Plus,
    Search,
    Zap,
    CheckCircle2,
    MessageSquare,
    Calendar,
    Send,
    ArrowRight,
    Loader2,
    RefreshCw,
    Filter,
    Bot,
    BrainCircuit,
    Lightbulb,
    Hand,
    AlertTriangle,
    Clock
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedBackground from "@/components/auth/AnimatedBackground";
import { getPipelineSessions } from "@/utils/api/conversationApiV2";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface PipelineSession {
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
// MASCOT COMPONENT - Donna (Icon-based, No Emojis)
// ============================================================================

const DonnaMascot = ({
    mood = "happy",
    size = "md",
    className
}: {
    mood?: "happy" | "thinking" | "excited" | "waving" | "waiting";
    size?: "sm" | "md" | "lg";
    className?: string;
}) => {
    const sizeConfig = {
        sm: { box: "w-8 h-8", icon: "w-5 h-5" },
        md: { box: "w-12 h-12", icon: "w-7 h-7" },
        lg: { box: "w-24 h-24", icon: "w-12 h-12" }
    };

    const moodConfig = {
        happy: {
            icon: Bot,
            bg: "from-indigo-500 to-purple-600",
            animation: { y: [0, -4, 0] },
            duration: 2
        },
        thinking: {
            icon: BrainCircuit,
            bg: "from-blue-500 to-cyan-500",
            animation: { scale: [1, 1.05, 1] },
            duration: 3
        },
        excited: {
            icon: Sparkles,
            bg: "from-amber-400 to-orange-500",
            animation: { rotate: [0, 15, -15, 0] },
            duration: 0.5
        },
        waving: {
            icon: Hand,
            bg: "from-emerald-500 to-green-600",
            animation: { rotate: [0, 20, -20, 0] },
            duration: 1.5
        },
        waiting: {
            icon: Clock,
            bg: "from-zinc-500 to-zinc-600",
            animation: { opacity: [0.6, 1, 0.6] },
            duration: 2
        }
    };

    const config = moodConfig[mood];
    const Icon = config.icon;

    return (
        <motion.div
            className={cn(
                "rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-xl shadow-black/20 border border-white/10 relative z-10",
                config.bg,
                sizeConfig[size].box,
                className
            )}
            animate={config.animation}
            transition={{ duration: config.duration, repeat: Infinity, ease: "easeInOut" }}
        >
            <Icon className={cn(sizeConfig[size].icon, "drop-shadow-md")} strokeWidth={1.5} />

            {/* Glossy overlay effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
        </motion.div>
    );
};

// ============================================================================
// PIPELINE PROGRESS TIMELINE
// ============================================================================

const PipelineTimeline = ({ session }: { session: PipelineSession }) => {
    const stats = session.status_counts;
    const total = session.total_candidates || 1;

    // Define Metro Stops
    const stages = [
        {
            id: "enriched",
            label: "Enriched",
            count: stats.enriched + stats.outreach_sent + stats.responded + stats.interview_scheduled,
            color: "bg-blue-500",
            textColor: "text-blue-400",
            icon: Zap,
            desc: "Profiles analyzed"
        },
        {
            id: "contacted",
            label: "Contacted",
            count: stats.outreach_sent + stats.responded + stats.interview_scheduled,
            color: "bg-purple-500",
            textColor: "text-purple-400",
            icon: Mail,
            desc: "Emails sent"
        },
        {
            id: "responded",
            label: "Replied",
            count: stats.responded + stats.interview_scheduled,
            color: "bg-emerald-500",
            textColor: "text-emerald-400",
            icon: MessageSquare,
            desc: "Candidates interested"
        },
        {
            id: "scheduled",
            label: "Interview",
            count: stats.interview_scheduled + stats.interview_completed,
            color: "bg-amber-500",
            textColor: "text-amber-400",
            icon: Calendar,
            desc: "Meetings booked"
        }
    ];

    return (
        <div className="w-full mt-8">
            {/* Visual Bar */}
            <div className="flex h-2 w-full rounded-full bg-zinc-800/50 overflow-hidden relative">
                {stages.map((stage, i) => {
                    const pct = Math.min((stage.count / total) * 100, 100);
                    return (
                        <motion.div
                            key={stage.id}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                            className={cn("absolute top-0 left-0 h-full opacity-90 backdrop-blur-sm", stage.color)}
                            style={{ zIndex: stages.length - i }}
                        />
                    );
                })}
            </div>

            {/* Legend / Metrics */}
            <div className="flex justify-between px-1 mt-3">
                {stages.map((stage) => {
                    const isActive = stage.count > 0;
                    return (
                        <TooltipProvider key={stage.id}>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger>
                                    <div className={cn(
                                        "flex flex-col items-center sm:flex-row sm:gap-2 text-xs transition-colors duration-300",
                                        isActive ? "opacity-100" : "opacity-30 grayscale"
                                    )}>
                                        <div className={cn(
                                            "w-6 h-6 rounded-md flex items-center justify-center mb-1 sm:mb-0 bg-zinc-800 border border-zinc-700",
                                            isActive && stage.textColor.replace('text-', 'border-')
                                        )}>
                                            <stage.icon className={cn("w-3.5 h-3.5", isActive ? stage.textColor : "text-zinc-500")} />
                                        </div>
                                        <div className="flex flex-col items-center sm:items-start leading-tight">
                                            <span className={cn("font-bold text-sm", isActive ? "text-zinc-200" : "text-zinc-600")}>
                                                {stage.count}
                                            </span>
                                            <span className="hidden sm:inline text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{stage.label}</span>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                    <p>{stage.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )
                })}
            </div>
        </div>
    );
};

// ============================================================================
// PRIMARY ACTION BUTTON (The "Big" Button)
// ============================================================================

const PrimaryActionButton = ({ session }: { session: PipelineSession }) => {
    const router = useRouter();
    const needs = session.needs_action;
    const stats = session.status_counts;

    // Logic to determine the single most important action
    let action = {
        type: "view",
        label: "View Pipeline",
        subtext: "Track progress",
        icon: ArrowRight,
        color: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700",
        mood: "happy" as const,
        url: `/pipeline/${session.session_id}`,
        mascotText: "Everything looks good so far!"
    };

    if (needs.needs_review > 0) {
        action = {
            type: "review",
            label: `Review ${needs.needs_review} Repl${needs.needs_review > 1 ? 'ies' : 'y'}`,
            subtext: "Candidates are waiting",
            icon: MessageSquare,
            color: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 border-emerald-500/50",
            mood: "excited",
            url: `/pipeline/${session.session_id}?action=review`,
            mascotText: "Wow! Candidates are interested!"
        };
    } else if (needs.needs_outreach_start > 0) {
        action = {
            type: "outreach",
            label: `Contact ${needs.needs_outreach_start} Candidates`,
            subtext: "Drafts are ready",
            icon: Send,
            color: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 border-indigo-500/50",
            mood: "waving",
            url: `/pipeline/${session.session_id}?action=outreach`,
            mascotText: "I've written some emails for you."
        };
    } else if (needs.needs_email_input > 0) {
        action = {
            type: "email",
            label: `Add ${needs.needs_email_input} Missing Emails`,
            subtext: "Unblock outreach",
            icon: AlertTriangle,
            color: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 border-amber-500/50",
            mood: "thinking",
            url: `/pipeline/${session.session_id}?action=email`,
            mascotText: "I couldn't find these emails."
        };
    } else if (stats.enriching > 0) {
        action = {
            type: "waiting",
            label: "Enriching...",
            subtext: "Donna is working",
            icon: Loader2,
            color: "bg-zinc-800 text-zinc-400 cursor-not-allowed border-zinc-700",
            mood: "waiting",
            url: "#",
            mascotText: "Gathering data from the web..."
        };
    }

    const Icon = action.icon;

    return (
        <div className="flex items-center gap-5">
            {/* Mascot Guidance */}
            <div className="hidden xl:flex items-center gap-3 text-right group/mascot">
                <div className="flex flex-col items-end">
                    <span className="text-xs font-medium text-zinc-300 bg-zinc-800/80 px-2 py-1 rounded-lg border border-zinc-700/50">
                        {action.mascotText}
                    </span>
                </div>
                <DonnaMascot mood={action.mood} size="sm" />
            </div>

            {/* The Button */}
            <Button
                onClick={(e) => {
                    e.stopPropagation();
                    if (action.url !== "#") router.push(action.url);
                }}
                className={cn(
                    "h-12 px-5 rounded-xl font-semibold transition-all duration-300 min-w-[220px] flex items-center justify-between border group shadow-xl",
                    action.color
                )}
            >
                <div className="flex flex-col items-start mr-2">
                    <span className="text-sm leading-none mb-1">{action.label}</span>
                    <span className="text-[10px] opacity-80 font-normal leading-none">{action.subtext}</span>
                </div>
                <div className="bg-black/20 rounded-lg p-1.5 group-hover:bg-black/30 transition-colors">
                    <Icon className={cn("w-4 h-4", action.type === 'waiting' && "animate-spin")} />
                </div>
            </Button>
        </div>
    );
};

// ============================================================================
// SESSION CARD
// ============================================================================

const PipelineSessionCard = ({ session, index }: { session: PipelineSession; index: number }) => {
    const router = useRouter();
    const total = session.total_candidates;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => router.push(`/pipeline/${session.session_id}`)}
            className="group relative bg-zinc-900/40 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-6 hover:bg-zinc-900/60 hover:border-zinc-700 hover:shadow-2xl hover:shadow-black/50 transition-all duration-300 cursor-pointer overflow-hidden"
        >
            {/* Hover Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* LEFT: Context */}
                    <div className="flex items-start gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 group-hover:bg-zinc-800 group-hover:scale-105 transition-all duration-300 shadow-inner">
                            <Briefcase className="w-7 h-7" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-zinc-100 group-hover:text-white transition-colors tracking-tight">
                                {session.job_title}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1.5">
                                <Badge variant="secondary" className="bg-zinc-800/50 text-zinc-400 border-zinc-700/50 rounded-md px-2 py-0.5 h-6 font-medium">
                                    <Users className="w-3 h-3 mr-1.5" />
                                    {total} Candidates
                                </Badge>
                                <span className="text-zinc-700 text-xs flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(session.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Action */}
                    <div className="flex-shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-zinc-800/50 lg:border-none">
                        <PrimaryActionButton session={session} />
                    </div>
                </div>

                {/* BOTTOM: Timeline */}
                <PipelineTimeline session={session} />
            </div>
        </motion.div>
    );
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PipelineListPage() {
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const [sessions, setSessions] = useState<PipelineSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) router.push("/login");
        else if (token) loadSessions();
    }, [isAuthenticated, token, router]);

    const loadSessions = async () => {
        if (!token) return;
        try {
            const data = await getPipelineSessions(token);
            setSessions(data.sessions || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <DonnaMascot mood="thinking" size="lg" />
                    <p className="text-zinc-500 mt-6 font-medium animate-pulse">Organizing your workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans relative selection:bg-indigo-500/30">
            <AnimatedBackground />

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">My Pipelines</h1>
                        <p className="text-zinc-400 text-lg">Your command center for active recruitment campaigns.</p>
                    </div>
                    <Button
                        onClick={() => router.push("/search")}
                        className="bg-white text-black hover:bg-zinc-200 hover:scale-105 rounded-full px-8 h-12 font-bold shadow-xl shadow-white/5 transition-all duration-300"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Start New Search
                    </Button>
                </div>

                {/* Content */}
                {sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 backdrop-blur-sm">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                            <DonnaMascot mood="waving" size="lg" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">It's quiet in here</h3>
                        <p className="text-zinc-500 mb-8 max-w-md text-center">
                            I'm ready to help you find your next hire. Start a search and I'll build a pipeline for you.
                        </p>
                        <Button onClick={() => router.push("/search")} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-11 px-8 rounded-full">
                            <Search className="w-4 h-4 mr-2" /> Find Candidates
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {sessions.map((session, i) => (
                            <PipelineSessionCard key={session.session_id} session={session} index={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}