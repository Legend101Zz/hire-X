"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    ArrowRight,
    ExternalLink,
    Loader2,
    Briefcase,
    MapPin,
    Mail,
    Phone,
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Sparkles,
    Zap,
    TrendingUp,
    Play,
    Pause,
    Send,
    Eye,
    MousePointer,
    Video,
    FileText,
    User,
    Building,
    DollarSign,
    Award,
    MessageSquare,
    RefreshCw,
    Lock,
    Target,
    Globe,
    XCircle,
    BrainCircuit,
    Ban,
    ThumbsDown,
    ThumbsUp,
    GitBranch,
    Rocket,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Search,
    Volume2,
    VolumeX,
    SkipBack,
    SkipForward,
    Mic,
    UserCircle2,
    Bot,
    Star,
    Quote,
    BarChart3,
    PieChart,
    Copy,
    Check,
    Heart,
    Share2,
    Download,
    Headphones,
    PhoneCall,
    PhoneOff,
    Timer,
    Bookmark,
    Flag,
    MoreVertical,
    HelpCircle,
    Info,
    Lightbulb,
    Shield,
    CircleDot,
    Circle,
    Edit3,
    Wand2,
    Pencil,
    RotateCcw,
    X,
    ChevronLeft,
    Plus,
    Minus,
    AlertOctagon,
    Maximize2,
    Minimize2,
    Trash2,
    Paperclip,
    Image,
    Link,
    Bold,
    Italic,
    Underline,
    List,
    MoreHorizontal,
    AtSign,
    Smile,
    type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// TYPES
// ============================================================================

interface FlowStep {
    id: string;
    name: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "ready" | "failed";
    duration_estimate?: string;
    what_happens?: string[];
    result?: any;
    data?: any;
    blocker?: string;
    action_needed?: string;
    completed_at?: string;
    summary?: string;
}

interface EmailPreview {
    subject: string;
    greeting: string;
    body: string;
    closing: string;
    signature: string;
    scheduling_link: string;
    full_preview_html: string;
    full_preview_text: string;
    word_count: number;
}

// ============================================================================
// DONNA MASCOT COMPONENT
// ============================================================================

interface DonnaProps {
    message: string;
    mood?: "happy" | "thinking" | "excited" | "helpful" | "concerned";
    size?: "sm" | "md" | "lg";
    animate?: boolean;
}

const Donna = ({
    message,
    mood = "helpful",
    size = "md",
    animate = true
}: DonnaProps) => {
    const sizeClasses = {
        sm: "w-10 h-10",
        md: "w-14 h-14",
        lg: "w-20 h-20"
    };

    const textSizes = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base"
    };

    const moodColors = {
        happy: "from-emerald-400 to-teal-500",
        thinking: "from-blue-400 to-indigo-500",
        excited: "from-amber-400 to-orange-500",
        helpful: "from-violet-400 to-purple-500",
        concerned: "from-rose-400 to-pink-500"
    };

    const moodExpressions = {
        happy: "^_^",
        thinking: "o.o",
        excited: ">w<",
        helpful: "._.",
        concerned: "o_o"
    };

    return (
        <div className="flex items-start gap-3">
            <motion.div
                className={cn(
                    "relative rounded-2xl flex items-center justify-center shrink-0",
                    "bg-gradient-to-br shadow-lg",
                    sizeClasses[size],
                    moodColors[mood]
                )}
                animate={animate ? {
                    y: [0, -3, 0],
                } : {}}
                transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    repeatType: "loop",
                    ease: "easeInOut"
                }}
            >
                <div className="text-white font-mono select-none">
                    {moodExpressions[mood]}
                </div>

                <motion.div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2"
                    animate={{ rotate: [-8, 8, -8] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    <div className="w-0.5 h-2 bg-white/80 rounded-full" />
                    <div className="w-1.5 h-1.5 bg-white rounded-full -mt-0.5 mx-auto" />
                </motion.div>

                <motion.div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                />
            </motion.div>

            {message && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-sm py-3 px-4 shadow-md border border-zinc-100 dark:border-zinc-700 max-w-sm"
                >
                    <div className="absolute left-0 top-3 -translate-x-1/2 w-2 h-2 bg-white dark:bg-zinc-800 border-l border-b border-zinc-100 dark:border-zinc-700 rotate-45" />
                    <p className={cn("text-zinc-600 dark:text-zinc-300 leading-relaxed", textSizes[size])}>
                        {message}
                    </p>
                </motion.div>
            )}
        </div>
    );
};

// ============================================================================
// STEP EXPLANATION POPOVER
// ============================================================================

const StepExplainer = ({ stepId, children }: { stepId: string; children: React.ReactNode }) => {
    const explanations: Record<string, any> = {
        enrichment: {
            title: "What is Candidate Analysis?",
            simple: "We look at the candidate's work history and skills to see if they match your job requirements.",
            points: [
                "Scan their LinkedIn profile and work history",
                "Validate their skills against your requirements",
                "Estimate their current salary range",
                "Calculate a match score (0-100)"
            ],
            tip: "This saves you hours of manual resume screening"
        },
        contact: {
            title: "How do we find contact info?",
            simple: "We search professional databases to find their email and phone number.",
            points: [
                "Search multiple professional data providers",
                "Verify email addresses are valid",
                "Prioritize work emails over personal",
                "Find phone numbers when available"
            ],
            tip: "If we cannot find it, you can add it manually"
        },
        outreach: {
            title: "How does email outreach work?",
            simple: "We write a personalized email mentioning details from their background.",
            points: [
                "Craft a subject line that gets opened",
                "Mention specific things from their work",
                "Include your interview scheduling link",
                "You review and edit before sending"
            ],
            tip: "Personalized emails get 2-3x more responses"
        },
        scheduling: {
            title: "How does scheduling work?",
            simple: "Candidates click a link and pick a time that works for them.",
            points: [
                "They see available time slots",
                "They pick a convenient time",
                "Both of you get calendar invites",
                "They enter their phone number"
            ],
            tip: "Self-service scheduling eliminates back-and-forth"
        },
        interview: {
            title: "How does the AI interview work?",
            simple: "Our AI assistant Neura calls and has a professional conversation about their experience.",
            points: [
                "Calls at the exact scheduled time",
                "Asks relevant questions for your role",
                "Records and transcribes everything",
                "Provides a detailed assessment report"
            ],
            tip: "Get detailed insights without spending your time"
        },
        decision: {
            title: "Making your final decision",
            simple: "Review everything and decide whether to hire, hold, or pass.",
            points: [
                "Listen to the interview recording",
                "Read the transcript and assessment",
                "See strengths and concerns",
                "Make your decision with confidence"
            ],
            tip: "Use 'Hold' if you want to compare with other candidates"
        }
    };

    const info = explanations[stepId];
    if (!info) return <>{children}</>;

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                side="right"
                align="start"
            >
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h4 className="font-semibold text-zinc-900 dark:text-white">
                        {info.title}
                    </h4>
                    <p className="text-sm text-zinc-500 mt-1">
                        {info.simple}
                    </p>
                </div>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                        What happens:
                    </p>
                    <ul className="space-y-1.5">
                        {info.points.map((point: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border-t border-indigo-100 dark:border-indigo-900">
                    <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-indigo-700 dark:text-indigo-300">
                            {info.tip}
                        </p>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

// ============================================================================
// PHASE ICON COMPONENT
// ============================================================================

const PhaseIcon = ({
    icon,
    status,
    size = "md"
}: {
    icon: string;
    status: string;
    size?: "sm" | "md" | "lg"
}) => {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-12 h-12",
        lg: "w-16 h-16"
    };

    const iconSizes = {
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-7 h-7"
    };

    const icons: Record<string, LucideIcon> = {
        search: Search,
        brain: BrainCircuit,
        mail: Mail,
        calendar: Calendar,
        phone: PhoneCall,
        award: Award,
        user: User,
        contact: UserCircle2
    };

    const Icon = icons[icon] || CircleDot;

    const statusStyles = {
        pending: "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400",
        in_progress: "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-500 animate-pulse",
        completed: "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20",
        ready: "bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 text-white shadow-lg shadow-amber-500/20",
        failed: "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-700 text-red-500"
    };

    return (
        <motion.div
            className={cn(
                "rounded-full border-2 flex items-center justify-center transition-all",
                sizeClasses[size],
                statusStyles[status as keyof typeof statusStyles]
            )}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
        >
            {status === "completed" ? (
                <CheckCircle2 className={iconSizes[size]} />
            ) : status === "in_progress" ? (
                <Loader2 className={cn(iconSizes[size], "animate-spin")} />
            ) : (
                <Icon className={iconSizes[size]} />
            )}
        </motion.div>
    );
};

// ============================================================================
// ENRICHMENT EXPANDED CONTENT
// ============================================================================

const EnrichmentExpandedContent = ({ data }: { data: any }) => {
    if (!data) return null;

    const score = data.match_score || 0;
    const recommendation = data.recommendation || {};

    const getScoreColor = (s: number) => {
        if (s >= 80) return "text-emerald-500";
        if (s >= 60) return "text-green-500";
        if (s >= 40) return "text-amber-500";
        return "text-red-500";
    };

    const getScoreLabel = (s: number) => {
        if (s >= 80) return "Excellent Match";
        if (s >= 60) return "Good Match";
        if (s >= 40) return "Fair Match";
        return "Below Requirements";
    };

    const getScoreBg = (s: number) => {
        if (s >= 80) return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
        if (s >= 60) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
        if (s >= 40) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
        return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    };

    return (
        <div className="space-y-6">
            {/* Score Overview */}
            <div className="grid md:grid-cols-3 gap-4">
                {/* Main Score */}
                <div className={cn("rounded-xl p-5 text-center border", getScoreBg(score))}>
                    <div className={cn("text-5xl font-black", getScoreColor(score))}>
                        {score}
                    </div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider mt-1">
                        Match Score
                    </div>
                    <div className={cn("text-sm font-medium mt-2", getScoreColor(score))}>
                        {getScoreLabel(score)}
                    </div>
                </div>

                {/* Experience */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                        <Briefcase className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Experience</span>
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {data.experience_assessment?.actual_years || 0} years
                    </div>
                    {data.experience_assessment?.meets_requirement !== undefined && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "mt-2 text-xs",
                                data.experience_assessment.meets_requirement
                                    ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                    : "border-red-300 text-red-700 bg-red-50"
                            )}
                        >
                            {data.experience_assessment.meets_requirement ? "Meets requirement" : "Below requirement"}
                        </Badge>
                    )}
                </div>

                {/* Salary Estimate */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 text-zinc-500 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Est. CTC</span>
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {data.salary_estimate?.current_estimated_ctc?.most_likely
                            ? `${data.salary_estimate.current_estimated_ctc.most_likely}L`
                            : "Unknown"}
                    </div>
                    {data.salary_estimate?.current_estimated_ctc?.range && (
                        <div className="text-xs text-zinc-500 mt-1">
                            Range: {data.salary_estimate.current_estimated_ctc.range}
                        </div>
                    )}
                </div>
            </div>

            {/* AI Summary */}
            {data.executive_summary && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            Donna's Assessment
                        </span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {data.executive_summary}
                    </p>
                </div>
            )}

            {/* Strengths & Concerns */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ThumbsUp className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                            Key Strengths
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {(data.strengths || []).map((strength: any, i: number) => {
                            const text = typeof strength === 'string' ? strength : strength.strength;
                            return (
                                <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    {text}
                                </li>
                            );
                        })}
                        {(!data.strengths || data.strengths.length === 0) && (
                            <li className="text-sm text-zinc-500 italic">No specific strengths highlighted</li>
                        )}
                    </ul>
                </div>

                {/* Concerns */}
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                            Concerns to Explore
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {(data.concerns || []).map((concern: any, i: number) => {
                            const text = typeof concern === 'string' ? concern : concern.concern;
                            return (
                                <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    {text}
                                </li>
                            );
                        })}
                        {(!data.concerns || data.concerns.length === 0) && (
                            <li className="text-sm text-zinc-500 italic">No major concerns identified</li>
                        )}
                    </ul>
                </div>
            </div>

            {/* Recommendation */}
            {recommendation.action && (
                <div className={cn(
                    "rounded-xl p-5 border",
                    recommendation.action === "Pass" || recommendation.action === "No Hire"
                        ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                        : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                )}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                {recommendation.action === "Pass" || recommendation.action === "No Hire" ? (
                                    <Ban className="w-5 h-5 text-red-500" />
                                ) : (
                                    <Rocket className="w-5 h-5 text-emerald-500" />
                                )}
                                <span className={cn(
                                    "text-lg font-bold",
                                    recommendation.action === "Pass" || recommendation.action === "No Hire"
                                        ? "text-red-700 dark:text-red-400"
                                        : "text-emerald-700 dark:text-emerald-400"
                                )}>
                                    {recommendation.action === "Proceed" ? "Recommended to Proceed" : "Not Recommended"}
                                </span>
                            </div>
                            {recommendation.reasoning && (
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-xl">
                                    {recommendation.reasoning}
                                </p>
                            )}
                        </div>
                        {recommendation.confidence && (
                            <Badge variant="outline" className="border-zinc-300 text-zinc-600">
                                {recommendation.confidence}% confidence
                            </Badge>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// OUTREACH/EMAIL EXPANDED CONTENT
// ============================================================================

const OutreachExpandedContent = ({
    data,
    onComposeEmail,
    hasEmail
}: {
    data: any;
    onComposeEmail: () => void;
    hasEmail: boolean;
}) => {
    if (!hasEmail) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-amber-500" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                    Email Not Found
                </h4>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mb-4">
                    We could not find this candidate's email automatically.
                    You can add it manually to send an outreach email.
                </p>
            </div>
        );
    }

    if (!data || !data.sent_at) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-indigo-500" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                    Ready to Reach Out
                </h4>
                <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
                    We have their email address. Compose a personalized email to grab their attention.
                </p>
                <Button
                    onClick={onComposeEmail}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Compose Email
                </Button>
            </div>
        );
    }

    // Email has been sent - show engagement tracker
    const engagementSteps = [
        {
            id: "sent",
            label: "Sent",
            icon: Send,
            active: true,
            time: data.sent_at
        },
        {
            id: "delivered",
            label: "Delivered",
            icon: CheckCircle2,
            active: true,
            time: data.sent_at
        },
        {
            id: "opened",
            label: `Opened${data.open_count > 1 ? ` (${data.open_count}x)` : ''}`,
            icon: Eye,
            active: data.opened,
            time: data.opened_at
        },
        {
            id: "clicked",
            label: "Link Clicked",
            icon: MousePointer,
            active: data.clicked,
            time: data.clicked_at
        },
        {
            id: "responded",
            label: "Scheduled",
            icon: Calendar,
            active: data.responded,
            time: null
        }
    ];

    return (
        <div className="space-y-6">
            {/* Engagement Tracker */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 border border-zinc-200 dark:border-zinc-700">
                <h4 className="text-sm font-medium text-zinc-500 mb-4">Email Engagement</h4>
                <div className="flex items-center justify-between gap-2">
                    {engagementSteps.map((step, index) => {
                        const Icon = step.icon;
                        const isLast = index === engagementSteps.length - 1;

                        return (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center gap-2 flex-1">
                                    <motion.div
                                        className={cn(
                                            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                            step.active
                                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-400"
                                        )}
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: step.active ? 1 : 0.9 }}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </motion.div>
                                    <span className={cn(
                                        "text-xs font-medium text-center",
                                        step.active ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"
                                    )}>
                                        {step.label}
                                    </span>
                                    {step.time && (
                                        <span className="text-[10px] text-zinc-400">
                                            {new Date(step.time).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    )}
                                </div>
                                {!isLast && (
                                    <div className={cn(
                                        "flex-1 h-0.5 max-w-16 -mt-8",
                                        step.active && engagementSteps[index + 1]?.active
                                            ? "bg-emerald-500"
                                            : step.active
                                                ? "bg-gradient-to-r from-emerald-500 to-zinc-300 dark:to-zinc-600"
                                                : "bg-zinc-200 dark:bg-zinc-700"
                                    )} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Email Preview */}
            {data.subject && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                    N
                                </div>
                                <div>
                                    <div className="font-medium text-zinc-900 dark:text-white">NeuraLeap</div>
                                    <div className="text-xs text-zinc-500">to {data.email_address}</div>
                                </div>
                            </div>
                            <div className="text-xs text-zinc-400">
                                {data.sent_at && new Date(data.sent_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                        </div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {data.subject}
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                            {data.body || "Email content preview not available"}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// SCHEDULING EXPANDED CONTENT
// ============================================================================

const SchedulingExpandedContent = ({ data }: { data: any }) => {
    if (!data?.scheduled_datetime) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-pink-500" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                    Awaiting Response
                </h4>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                    The candidate is choosing their preferred interview time.
                    We will notify you when they schedule.
                </p>
            </div>
        );
    }

    const scheduledDate = new Date(data.scheduled_datetime);
    const isUpcoming = scheduledDate > new Date();

    return (
        <div className="space-y-4">
            <div className={cn(
                "rounded-xl p-6 text-center border",
                isUpcoming
                    ? "bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border-pink-200 dark:border-pink-800"
                    : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700"
            )}>
                <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4",
                    isUpcoming ? "bg-pink-500" : "bg-zinc-400"
                )}>
                    <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                    {scheduledDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                </div>
                <div className="text-lg text-zinc-600 dark:text-zinc-400">
                    {scheduledDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {data.duration_minutes || 15} min
                    </span>
                    <span className="flex items-center gap-1">
                        <Globe className="w-4 h-4" />
                        {data.timezone || "IST"}
                    </span>
                </div>
                {data.phone_number && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <Phone className="w-4 h-4" />
                        {data.phone_number}
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// INTERVIEW EXPANDED CONTENT
// ============================================================================

const InterviewExpandedContent = ({ data }: { data: any }) => {
    const [showTranscript, setShowTranscript] = useState(false);

    if (!data?.session_id) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-4">
                    <PhoneCall className="w-8 h-8 text-teal-500" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                    Interview Not Started
                </h4>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                    The AI interview will begin at the scheduled time.
                    Neura will call the candidate automatically.
                </p>
            </div>
        );
    }

    const assessment = data.assessment || {};
    const clips = data.clips || [];
    const transcript = data.transcript || [];
    const durationMins = data.duration_seconds ? Math.floor(data.duration_seconds / 60) : 0;

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-200 dark:border-zinc-700">
                    <Timer className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                    <div className="text-xl font-bold text-zinc-900 dark:text-white">
                        {durationMins}:{String(Math.floor((data.duration_seconds || 0) % 60)).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-zinc-500">Duration</div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-200 dark:border-zinc-700">
                    <MessageSquare className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                    <div className="text-xl font-bold text-zinc-900 dark:text-white">{clips.length}</div>
                    <div className="text-xs text-zinc-500">Questions</div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-200 dark:border-zinc-700">
                    <Star className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                    <div className="text-xl font-bold text-zinc-900 dark:text-white">
                        {clips.filter((c: any) => c.is_highlight).length}
                    </div>
                    <div className="text-xs text-zinc-500">Highlights</div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-200 dark:border-zinc-700">
                    <Award className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
                    <div className={cn(
                        "text-xl font-bold",
                        (assessment.overall_score || 0) >= 70 ? "text-emerald-500" :
                            (assessment.overall_score || 0) >= 50 ? "text-amber-500" : "text-red-500"
                    )}>
                        {assessment.overall_score || '--'}
                    </div>
                    <div className="text-xs text-zinc-500">Score</div>
                </div>
            </div>

            {/* Recording Player */}
            {data.recording_url && (
                <div className="bg-zinc-900 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                        <Button
                            size="icon"
                            className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500"
                        >
                            <Play className="w-5 h-5 ml-0.5" />
                        </Button>
                        <div className="flex-1">
                            <div className="h-2 bg-zinc-700 rounded-full">
                                <div className="h-full w-0 bg-indigo-500 rounded-full" />
                            </div>
                            <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                <span>0:00</span>
                                <span>{durationMins}:{String(Math.floor((data.duration_seconds || 0) % 60)).padStart(2, '0')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs for Highlights / Transcript */}
            <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
                <button
                    onClick={() => setShowTranscript(false)}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        !showTranscript
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    Highlights ({clips.filter((c: any) => c.is_highlight).length})
                </button>
                <button
                    onClick={() => setShowTranscript(true)}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        showTranscript
                            ? "border-indigo-500 text-indigo-600"
                            : "border-transparent text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    Full Transcript
                </button>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {showTranscript ? (
                    <motion.div
                        key="transcript"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 max-h-96 overflow-auto border border-zinc-200 dark:border-zinc-700"
                    >
                        <div className="space-y-4">
                            {transcript.length > 0 ? transcript.map((entry: any, index: number) => (
                                <div key={index} className="flex gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                        entry.role === "assistant"
                                            ? "bg-indigo-100 dark:bg-indigo-900/50"
                                            : "bg-emerald-100 dark:bg-emerald-900/50"
                                    )}>
                                        {entry.role === "assistant" ? (
                                            <Bot className="w-4 h-4 text-indigo-600" />
                                        ) : (
                                            <UserCircle2 className="w-4 h-4 text-emerald-600" />
                                        )}
                                    </div>
                                    <div>
                                        <div className={cn(
                                            "text-xs font-medium mb-1",
                                            entry.role === "assistant" ? "text-indigo-600" : "text-emerald-600"
                                        )}>
                                            {entry.role === "assistant" ? "Neura (AI)" : "Candidate"}
                                        </div>
                                        <p className="text-sm text-zinc-700 dark:text-zinc-300">{entry.content}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-zinc-500">
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    Transcript not available yet
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="clips"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                    >
                        {clips.filter((c: any) => c.is_highlight).map((clip: any, index: number) => (
                            <div
                                key={clip.clip_id}
                                className="bg-white dark:bg-zinc-800 rounded-xl border border-amber-200 dark:border-amber-800 p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                                        <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Bot className="w-3.5 h-3.5 text-indigo-500" />
                                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{clip.question}</p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <UserCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{clip.response}</p>
                                        </div>
                                    </div>
                                    {clip.score !== undefined && (
                                        <div className={cn(
                                            "text-lg font-bold shrink-0",
                                            clip.score >= 80 ? "text-emerald-500" :
                                                clip.score >= 60 ? "text-green-500" :
                                                    clip.score >= 40 ? "text-amber-500" : "text-red-500"
                                        )}>
                                            {clip.score}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {clips.filter((c: any) => c.is_highlight).length === 0 && (
                            <div className="text-center py-8 text-zinc-500">
                                No highlights yet
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Assessment Summary */}
            {assessment.executive_summary && (
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Bot className="w-5 h-5 text-indigo-500" />
                        <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            Interview Analysis
                        </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {assessment.executive_summary}
                    </p>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// DECISION EXPANDED CONTENT
// ============================================================================

const DecisionExpandedContent = ({
    data,
    onMakeDecision,
    isLoading
}: {
    data: any;
    onMakeDecision: (decision: string, reason?: string) => void;
    isLoading: boolean;
}) => {
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState("");

    if (data?.decision) {
        const decisionStyles: Record<string, { bg: string; icon: LucideIcon; label: string; color: string }> = {
            hire: { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2, label: "Hired", color: "text-emerald-600" },
            reject: { bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", icon: XCircle, label: "Rejected", color: "text-red-600" },
            hold: { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: Clock, label: "On Hold", color: "text-amber-600" }
        };

        const style = decisionStyles[data.decision] || decisionStyles.hold;
        const Icon = style.icon;

        return (
            <div className={cn("rounded-xl p-8 text-center border", style.bg)}>
                <Icon className={cn("w-16 h-16 mx-auto mb-4", style.color)} />
                <h4 className={cn("text-2xl font-bold mb-2", style.color)}>{style.label}</h4>
                {data.decided_by && (
                    <p className="text-sm text-zinc-500">by {data.decided_by}</p>
                )}
                {data.reason && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4 max-w-md mx-auto">
                        {data.reason}
                    </p>
                )}
            </div>
        );
    }

    if (!data?.recommendation) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                    <Award className="w-8 h-8 text-zinc-400" />
                </div>
                <h4 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                    Awaiting Interview
                </h4>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                    Complete the interview to make a hiring decision.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* AI Recommendation */}
            <div className={cn(
                "rounded-xl p-5 border",
                data.recommendation === "strong_hire" || data.recommendation === "hire"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : data.recommendation === "no_hire"
                        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                        : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
            )}>
                <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-medium text-zinc-500">Donna's Recommendation</span>
                </div>
                <div className={cn(
                    "text-xl font-bold",
                    data.recommendation === "strong_hire" || data.recommendation === "hire"
                        ? "text-emerald-600"
                        : data.recommendation === "no_hire"
                            ? "text-red-600"
                            : "text-amber-600"
                )}>
                    {data.recommendation === "strong_hire" ? "Strong Hire" :
                        data.recommendation === "hire" ? "Hire" :
                            data.recommendation === "no_hire" ? "Do Not Hire" :
                                "Maybe - Needs Review"}
                </div>
                {data.score && (
                    <div className="text-sm text-zinc-500 mt-1">
                        Interview Score: {data.score}/100
                    </div>
                )}
            </div>

            {/* Decision Buttons */}
            <div className="grid grid-cols-3 gap-4">
                <Button
                    onClick={() => onMakeDecision("hire")}
                    disabled={isLoading}
                    className="h-16 bg-emerald-600 hover:bg-emerald-500 text-white flex flex-col items-center justify-center gap-1"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            <ThumbsUp className="w-5 h-5" />
                            <span className="text-xs">Hire</span>
                        </>
                    )}
                </Button>

                <Button
                    onClick={() => onMakeDecision("hold")}
                    disabled={isLoading}
                    variant="outline"
                    className="h-16 border-amber-300 text-amber-600 hover:bg-amber-50 flex flex-col items-center justify-center gap-1"
                >
                    <Clock className="w-5 h-5" />
                    <span className="text-xs">Hold</span>
                </Button>

                <Button
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isLoading}
                    variant="outline"
                    className="h-16 border-red-300 text-red-600 hover:bg-red-50 flex flex-col items-center justify-center gap-1"
                >
                    <ThumbsDown className="w-5 h-5" />
                    <span className="text-xs">Pass</span>
                </Button>
            </div>

            {/* Reject Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent className="bg-white dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle>Pass on this candidate</DialogTitle>
                        <DialogDescription>
                            Please provide a brief reason for your decision.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g., Not enough experience in required skills..."
                        className="min-h-24"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                onMakeDecision("reject", rejectReason);
                                setShowRejectDialog(false);
                            }}
                            disabled={!rejectReason}
                            className="bg-red-600 hover:bg-red-500 text-white"
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ============================================================================
// GMAIL-STYLE EMAIL SIDE PANEL
// ============================================================================

interface EmailSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    pipelineId: string;
    candidateName: string;
    candidateEmail: string;
    onSend: (subject: string, body: string) => Promise<void>;
}

const EmailSidePanel = ({
    isOpen,
    onClose,
    pipelineId,
    candidateName,
    candidateEmail,
    onSend
}: EmailSidePanelProps) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [mode, setMode] = useState<"preview" | "edit">("preview");
    const [tone, setTone] = useState("professional");
    const [isMinimized, setIsMinimized] = useState(false);

    // Email fields
    const [subject, setSubject] = useState("");
    const [greeting, setGreeting] = useState("");
    const [body, setBody] = useState("");
    const [closing, setClosing] = useState("");
    const [schedulingLink, setSchedulingLink] = useState("");

    const firstName = candidateName.split(" ")[0];

    useEffect(() => {
        if (isOpen) {
            loadPreview();
        }
    }, [isOpen]);

    const loadPreview = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/email-preview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setSubject(data.preview.subject);
                setGreeting(data.preview.greeting);
                setBody(data.preview.body);
                setClosing(data.preview.closing);
                setSchedulingLink(data.preview.scheduling_link);
            }
        } catch (err) {
            console.error("Failed to load email preview:", err);
        } finally {
            setLoading(false);
        }
    };

    const regenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/email-preview`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ tone })
            });
            const data = await res.json();
            if (data.success) {
                setSubject(data.preview.subject);
                setGreeting(data.preview.greeting);
                setBody(data.preview.body);
                setClosing(data.preview.closing);
            }
        } catch (err) {
            console.error("Failed to regenerate:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        setSending(true);
        try {
            const fullBody = `${greeting}\n\n${body}\n\n${closing}\n\nBest regards,\nThe NeuraLeap Team`;
            await onSend(subject, fullBody);
            onClose();
        } catch (err) {
            console.error("Failed to send:", err);
        } finally {
            setSending(false);
        }
    };

    const wordCount = body.split(/\s+/).filter(Boolean).length;

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ x: "100%" }}
            animate={{ x: isMinimized ? "calc(100% - 300px)" : 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
                "fixed right-0 top-0 h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 flex flex-col",
                isMinimized ? "w-[300px]" : "w-[600px]"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-zinc-500" />
                    <span className="font-medium text-zinc-900 dark:text-white text-sm">
                        {isMinimized ? "Email" : "Compose Email"}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                >
                                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isMinimized ? "Expand" : "Minimize"}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {isMinimized ? (
                // Minimized view
                <div className="p-4">
                    <p className="text-sm text-zinc-500 mb-2">To: {candidateName}</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">{subject}</p>
                </div>
            ) : (
                <>
                    {/* Donna Helper */}
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                        <Donna
                            message={mode === "edit"
                                ? "Keep it short and personal. Under 150 words works best!"
                                : "Looking good! Review and click Send when ready."
                            }
                            mood={mode === "edit" ? "thinking" : "happy"}
                            size="sm"
                        />
                    </div>

                    {/* Mode Toggle & Controls */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMode("preview")}
                                className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                    mode === "preview"
                                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                )}
                            >
                                <Eye className="w-4 h-4 inline mr-1.5" />
                                Preview
                            </button>
                            <button
                                onClick={() => setMode("edit")}
                                className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                    mode === "edit"
                                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                                        : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                )}
                            >
                                <Edit3 className="w-4 h-4 inline mr-1.5" />
                                Edit
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Select value={tone} onValueChange={setTone}>
                                <SelectTrigger className="w-32 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="professional">Professional</SelectItem>
                                    <SelectItem value="friendly">Friendly</SelectItem>
                                    <SelectItem value="casual">Casual</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={regenerate}
                                disabled={loading}
                                className="h-8"
                            >
                                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                                Regenerate
                            </Button>
                        </div>
                    </div>

                    {/* Email Content */}
                    <ScrollArea className="flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
                                    <p className="text-sm text-zinc-500">Crafting your email...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4">
                                {/* To & Subject */}
                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                                        <span className="text-sm text-zinc-400 w-16">To</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                                <span className="text-xs font-medium text-indigo-600">{firstName.charAt(0)}</span>
                                            </div>
                                            <span className="text-sm text-zinc-900 dark:text-white">{candidateName}</span>
                                            <span className="text-xs text-zinc-400">&lt;{candidateEmail}&gt;</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                                        <span className="text-sm text-zinc-400 w-16">Subject</span>
                                        {mode === "edit" ? (
                                            <Input
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                className="flex-1 h-8 border-0 p-0 focus-visible:ring-0 text-sm"
                                                placeholder="Enter subject..."
                                            />
                                        ) : (
                                            <span className="text-sm font-medium text-zinc-900 dark:text-white">{subject}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Email Body */}
                                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                                    {mode === "edit" ? (
                                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            <div className="p-4">
                                                <Label className="text-xs text-zinc-500 mb-2 block">Greeting</Label>
                                                <Input
                                                    value={greeting}
                                                    onChange={(e) => setGreeting(e.target.value)}
                                                    className="h-9"
                                                    placeholder="Hi John,"
                                                />
                                            </div>

                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label className="text-xs text-zinc-500">Body</Label>
                                                    <span className={cn(
                                                        "text-xs",
                                                        wordCount > 150 ? "text-amber-500" : "text-zinc-400"
                                                    )}>
                                                        {wordCount} words {wordCount > 150 && "(try under 150)"}
                                                    </span>
                                                </div>
                                                <Textarea
                                                    value={body}
                                                    onChange={(e) => setBody(e.target.value)}
                                                    className="min-h-40 resize-none"
                                                    placeholder="Write your message..."
                                                />
                                            </div>

                                            <div className="p-4">
                                                <Label className="text-xs text-zinc-500 mb-2 block">Closing</Label>
                                                <Input
                                                    value={closing}
                                                    onChange={(e) => setClosing(e.target.value)}
                                                    className="h-9"
                                                    placeholder="Looking forward to hearing from you."
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 space-y-4">
                                            <p className="text-zinc-700 dark:text-zinc-300">{greeting}</p>
                                            <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">{body}</p>
                                            <p className="text-zinc-700 dark:text-zinc-300">{closing}</p>
                                            <p className="text-zinc-500">
                                                Best regards,<br />
                                                The NeuraLeap Team
                                            </p>

                                            {/* CTA Button */}
                                            <div className="pt-4">
                                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-indigo-500/25">
                                                    <Calendar className="w-4 h-4" />
                                                    Schedule Your Interview
                                                </div>
                                                <p className="text-xs text-zinc-400 mt-2">
                                                    This button links to your scheduling page
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tips */}
                                <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                                    <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" />
                                        Tips for better response rates
                                    </h4>
                                    <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5" />
                                            Keep subject line short and personal
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5" />
                                            Mention something specific from their background
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5" />
                                            Keep email under 150 words
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </ScrollArea>

                    {/* Footer Actions */}
                    <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                                <Paperclip className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Attach file</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9">
                                                <Link className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Insert link</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={onClose}>
                                    Discard
                                </Button>
                                <Button
                                    onClick={handleSend}
                                    disabled={sending || !subject || !body}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-28"
                                >
                                    {sending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Sending
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Send
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
};

// ============================================================================
// MANUAL EMAIL INPUT DIALOG
// ============================================================================

const ManualEmailDialog = ({
    isOpen,
    onClose,
    onSubmit,
    candidateName
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (email: string, phone?: string) => Promise<void>;
    candidateName: string;
}) => {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    const handleSubmit = async () => {
        if (!validateEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await onSubmit(email, phone || undefined);
            onClose();
            setEmail("");
            setPhone("");
        } catch (err: any) {
            setError(err.message || "Failed to save");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="mb-4">
                        <Donna
                            message={`No problem! If you have ${candidateName.split(" ")[0]}'s email from LinkedIn or another source, just add it here.`}
                            mood="helpful"
                            size="sm"
                        />
                    </div>
                    <DialogTitle>Add Contact Information</DialogTitle>
                    <DialogDescription>
                        We could not find this candidate's email automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(""); }}
                            placeholder="candidate@example.com"
                            className="mt-1.5"
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div>
                        <Label htmlFor="phone">Phone <span className="text-zinc-400">(optional)</span></Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="mt-1.5"
                        />
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Where to find their email:
                        </h4>
                        <ul className="space-y-1.5 text-xs text-zinc-500">
                            <li className="flex items-start gap-2">
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                LinkedIn "Contact Info" section
                            </li>
                            <li className="flex items-start gap-2">
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                Their personal website or portfolio
                            </li>
                            <li className="flex items-start gap-2">
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                Company email pattern (name@company.com)
                            </li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !email}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        Save and Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ============================================================================
// TIMELINE PHASE COMPONENT
// ============================================================================

const TimelinePhase = ({
    step,
    index,
    isExpanded,
    onToggle,
    isLast,
    children,
    onAction,
    actionLabel,
    actionLoading
}: {
    step: FlowStep;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    isLast: boolean;
    children?: React.ReactNode;
    onAction?: () => void;
    actionLabel?: string;
    actionLoading?: boolean;
}) => {
    const iconMap: Record<string, string> = {
        enrichment: "brain",
        contact: "contact",
        outreach: "mail",
        scheduling: "calendar",
        interview: "phone",
        decision: "award"
    };

    const canExpand = (step.status === "completed" || step.status === "ready") && children;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
        >
            {/* Connector Line */}
            {!isLast && (
                <div className={cn(
                    "absolute left-6 top-16 w-0.5 h-full -translate-x-1/2",
                    step.status === "completed"
                        ? "bg-gradient-to-b from-emerald-500 to-emerald-300 dark:from-emerald-600 dark:to-emerald-800"
                        : "bg-zinc-200 dark:bg-zinc-700"
                )} />
            )}

            {/* Phase Card */}
            <div className="relative flex gap-4 sm:gap-6">
                {/* Icon */}
                <div className="relative z-10 shrink-0">
                    <PhaseIcon icon={iconMap[step.id] || "circle"} status={step.status} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-8">
                    <motion.div
                        className={cn(
                            "rounded-2xl border transition-all overflow-hidden",
                            step.status === "completed"
                                ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                : step.status === "in_progress"
                                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                                    : step.status === "ready"
                                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                                        : step.status === "failed"
                                            ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                                            : "bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700",
                            canExpand && "cursor-pointer"
                        )}
                        whileHover={canExpand ? { scale: 1.005 } : {}}
                        onClick={canExpand ? onToggle : undefined}
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-5 flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className={cn(
                                            "font-semibold truncate",
                                            step.status === "pending" ? "text-zinc-400" : "text-zinc-900 dark:text-white"
                                        )}>
                                            {step.name}
                                        </h3>

                                        {/* Help Button */}
                                        <StepExplainer stepId={step.id}>
                                            <button
                                                className="text-zinc-400 hover:text-indigo-500 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <HelpCircle className="w-4 h-4" />
                                            </button>
                                        </StepExplainer>
                                    </div>

                                    {step.summary && (
                                        <p className="text-sm text-zinc-500 mt-0.5 truncate">
                                            {step.summary}
                                        </p>
                                    )}

                                    {step.duration_estimate && step.status === "pending" && (
                                        <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {step.duration_estimate}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {step.completed_at && (
                                    <span className="text-xs text-zinc-400 font-mono hidden sm:block">
                                        {new Date(step.completed_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </span>
                                )}

                                {/* Status Badge */}
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "capitalize text-xs",
                                        step.status === "completed" && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                        step.status === "in_progress" && "bg-blue-50 border-blue-200 text-blue-700 animate-pulse",
                                        step.status === "ready" && "bg-amber-50 border-amber-200 text-amber-700",
                                        step.status === "failed" && "bg-red-50 border-red-200 text-red-700",
                                        step.status === "pending" && "bg-zinc-50 border-zinc-200 text-zinc-500"
                                    )}
                                >
                                    {step.status === "in_progress" ? "Working..." :
                                        step.status === "ready" ? "Ready" :
                                            step.status}
                                </Badge>

                                {canExpand && (
                                    <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* Action Button (when not expanded) */}
                        {!isExpanded && onAction && (step.status === "ready" || step.status === "pending") && (
                            <div className="px-4 sm:px-5 pb-4">
                                <Button
                                    onClick={(e) => { e.stopPropagation(); onAction(); }}
                                    disabled={actionLoading}
                                    className={cn(
                                        "w-full",
                                        step.status === "ready"
                                            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                                            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
                                    )}
                                >
                                    {actionLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <ArrowRight className="w-4 h-4 mr-2" />
                                    )}
                                    {actionLabel || "Continue"}
                                </Button>
                            </div>
                        )}

                        {/* Blocker Alert */}
                        {step.blocker && !isExpanded && (
                            <div className="mx-4 sm:mx-5 mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                            {step.blocker}
                                        </p>
                                        {step.action_needed === "manual_email" && onAction && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => { e.stopPropagation(); onAction(); }}
                                                className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                                            >
                                                Add Email Manually
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Expanded Content */}
                        <AnimatePresence>
                            {isExpanded && children && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="overflow-hidden"
                                >
                                    <div className="border-t border-zinc-200 dark:border-zinc-700 p-4 sm:p-6">
                                        {children}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};


// PROGRESS HEADER
// ============================================================================
const ProgressHeader = ({
    completed,
    total,
    currentStep,
    candidate,
    job,
    onBack
}: {
    completed: number;
    total: number;
    currentStep?: string;
    candidate: any;
    job: any;
    onBack: () => void;
}) => {
    const percentage = Math.round((completed / total) * 100);
    return (
        <header className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Top Row */}
                <div className="flex items-center gap-4 py-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>

                    {/* Candidate Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {candidate.profile_picture_url ? (
                            <img
                                src={candidate.profile_picture_url}
                                alt={candidate.name}
                                className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                                {candidate.name?.charAt(0)}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 className="font-semibold text-zinc-900 dark:text-white truncate">
                                {candidate.name}
                            </h1>
                            <p className="text-xs text-zinc-500 truncate">
                                {job.title}
                            </p>
                        </div>
                    </div>

                    {/* Progress Pill */}
                    <div className="hidden sm:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-1.5 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {completed}/{total} steps
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="pb-3">
                    <Progress value={percentage} className="h-1.5" />
                </div>
            </div>
        </header>
    );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function PipelineFlowPage() {
    const params = useParams();
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const sessionId = params.sessionId as string;
    const pipelineId = params.pipelineId as string;
    // State
    const [flow, setFlow] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Panels
    const [showEmailPanel, setShowEmailPanel] = useState(false);
    const [showManualEmail, setShowManualEmail] = useState(false);

    // Polling
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }
        loadFlow();

        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [isAuthenticated, pipelineId]);

    const loadFlow = async (triggerEnrichment = false) => {
        try {
            // Trigger enrichment if needed
            if (triggerEnrichment) {
                await fetch(`${API_BASE}/pipeline/${pipelineId}/start-flow`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ skip_enrichment: false })
                });
            }

            // Get journey data
            const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/journey`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            setFlow(data.journey);

            // Auto-expand latest completed step
            const completedPhases = (data.journey?.phases || []).filter(
                (p: any) => p.status === "completed" || p.status === "ready"
            );
            if (completedPhases.length > 0 && !expandedStep) {
                setExpandedStep(completedPhases[completedPhases.length - 1].id);
            }

            // Polling for in-progress phases
            const hasInProgress = (data.journey?.phases || []).some(
                (p: any) => p.status === "in_progress"
            );

            if (hasInProgress && !pollInterval.current) {
                pollInterval.current = setInterval(async () => {
                    const pollRes = await fetch(`${API_BASE}/pipeline/${pipelineId}/journey`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const pollData = await pollRes.json();
                    setFlow(pollData.journey);

                    // Stop polling when nothing is in progress
                    const stillInProgress = (pollData.journey?.phases || []).some(
                        (p: any) => p.status === "in_progress"
                    );

                    if (!stillInProgress && pollInterval.current) {
                        clearInterval(pollInterval.current);
                        pollInterval.current = null;
                    }
                }, 3000);
            }

            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const startEnrichment = async () => {
        setActionLoading(true);
        await loadFlow(true);
        setActionLoading(false);
    };

    const handleManualEmail = async (email: string, phone?: string) => {
        const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/provide-email`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, phone })
        });

        if (!res.ok) throw new Error("Failed to save email");
        loadFlow();
    };

    const handleSendEmail = async (subject: string, body: string) => {
        const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/send-email`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ subject, body })
        });

        if (!res.ok) throw new Error("Failed to send email");
        loadFlow();
    };

    const handleDecision = async (decision: string, reason?: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/decision`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ decision, reason })
            });

            if (!res.ok) throw new Error("Failed to save decision");
            loadFlow();
        } catch (err) {
            console.error("Decision failed:", err);
        } finally {
            setActionLoading(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Donna
                        message="Getting everything ready for you..."
                        mood="thinking"
                        size="lg"
                    />
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mt-6" />
                </div>
            </div>
        );
    }

    // Error state
    if (error || !flow) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <Donna
                            message="Oops! Something went wrong. Let me help you get back on track."
                            mood="concerned"
                            size="lg"
                        />
                        <p className="text-sm text-zinc-500 mt-4 mb-6">{error || "Could not load"}</p>
                        <Button onClick={() => router.push(`/pipeline/${sessionId}`)} variant="outline">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Pipeline
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const candidate = flow.candidate || {};
    const job = flow?.job || {};
    const steps = flow?.phases || [];
    const completedCount = steps.filter((s: any) => s.status === "completed").length;
    const progress = {
        completed: completedCount,
        total: steps.length,
        percentage: Math.round((completedCount / steps.length) * 100)
    };

    // Get step actions
    const getStepAction = (step: FlowStep) => {
        switch (step.id) {
            case "enrichment":
                if (step.status === "pending") return { action: startEnrichment, label: "Start Analysis" };
                break;
            case "contact":
                if (step.action_needed === "manual_email") return { action: () => setShowManualEmail(true), label: "Add Email" };
                break;
            case "outreach":
                if (step.status === "ready") return { action: () => setShowEmailPanel(true), label: "Compose Email" };
                break;
        }
        return null;
    };

    // Find candidate email for email panel
    const candidateEmail = steps.find((s: FlowStep) => s.id === "contact")?.result?.email || "";

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <ProgressHeader
                completed={flow?.phases?.filter((p: any) => p.status === "completed").length || 0}
                total={flow?.phases?.length || 7}
                currentStep={flow?.current_stage}
                candidate={flow?.candidate || {}}
                job={flow?.job || {}}
                onBack={() => router.push(`/pipeline/${sessionId}`)}
            />

            {/* Main Content */}
            <main className={cn(
                "max-w-4xl mx-auto px-4 sm:px-6 py-8 transition-all duration-300",
                showEmailPanel && "mr-[600px]"
            )}>
                {/* Donna Welcome */}
                <div className="mb-8">
                    <Donna
                        message={
                            progress.completed === 0
                                ? "Ready to start! Click 'Start Analysis' to begin evaluating this candidate."
                                : progress.completed === progress.total
                                    ? "Amazing work! You have completed the hiring journey for this candidate."
                                    : `Making progress! ${progress.total - progress.completed} steps to go.`
                        }
                        mood={progress.completed === progress.total ? "excited" : "helpful"}
                        size="md"
                    />
                </div>

                {/* Timeline */}
                <div className="space-y-0">
                    {steps.map((step: any, index: number) => {
                        const stepAction = getStepAction(step);
                        const isActive = step.status === "in_progress";

                        return (
                            <TimelinePhase
                                key={step.id}
                                step={step}
                                index={index}
                                isExpanded={expandedStep === step.id}
                                onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                                isLast={index === steps.length - 1}
                                onAction={stepAction?.action}
                                actionLabel={stepAction?.label}
                                actionLoading={actionLoading && isActive}
                            >
                                {step.id === "enrichment" && <EnrichmentExpandedContent data={step.data} />}
                                {step.id === "outreach" && (
                                    <OutreachExpandedContent
                                        data={step.data}
                                        onComposeEmail={() => setShowEmailPanel(true)}
                                        hasEmail={!!candidateEmail}
                                    />
                                )}
                                {step.id === "scheduling" && <SchedulingExpandedContent data={step.data} />}
                                {step.id === "interview" && <InterviewExpandedContent data={step.data} />}
                                {step.id === "decision" && (
                                    <DecisionExpandedContent
                                        data={step.data}
                                        onMakeDecision={handleDecision}
                                        isLoading={actionLoading}
                                    />
                                )}
                            </TimelinePhase>
                        );
                    })}
                </div>
            </main>

            {/* Gmail-style Email Side Panel */}
            <AnimatePresence>
                {showEmailPanel && (
                    <EmailSidePanel
                        isOpen={showEmailPanel}
                        onClose={() => setShowEmailPanel(false)}
                        pipelineId={pipelineId}
                        candidateName={candidate.name || ""}
                        candidateEmail={candidateEmail}
                        onSend={handleSendEmail}
                    />
                )}
            </AnimatePresence>

            {/* Manual Email Dialog */}
            <ManualEmailDialog
                isOpen={showManualEmail}
                onClose={() => setShowManualEmail(false)}
                onSubmit={handleManualEmail}
                candidateName={candidate.name || ""}
            />
        </div>
    );
}
