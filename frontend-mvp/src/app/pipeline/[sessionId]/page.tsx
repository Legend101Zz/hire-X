// app/pipeline/[sessionId]/page.tsx
"use client";

import React from "react";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Play,
    Mail,
    AlertCircle,
    ExternalLink,
    Loader2,
    MapPin,
    Search,
    Zap,
    Check,
    X,
    Terminal,
    ChevronRight,
    Rocket,
    Users,
    Briefcase,
    Clock,
    Calendar,
    Phone,
    MessageSquare,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Eye,
    Send,
    RefreshCw,
    MoreVertical,
    Star,
    FileText,
    ChevronDown,
    ChevronUp,
    Sparkles,
    UserCheck,
    PhoneCall,
    Trophy,
    Filter,
    Info,
    Edit3,
    PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedBackground from "@/components/auth/AnimatedBackground";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ============================================================================
// TYPES
// ============================================================================

interface CandidateStatus {
    candidate_id: string;
    pipeline_id: string;
    name: string;
    headline: string;
    location: string;
    linkedin_url: string;
    profile_picture_url?: string;
    stage: string;
    stage_label: string;
    stage_updated_at: string;
    is_enriched: boolean;
    match_score?: number;
    match_label?: string;
    has_email: boolean;
    email?: string;
    has_phone: boolean;
    enrichment_error?: string;
    email_fetch_errors?: string[];
    needs_manual_email: boolean;
    outreach_sent: boolean;
    outreach_opened: boolean;
    outreach_clicked: boolean;
    interview_scheduled?: string;
    interview_completed: boolean;
    interview_score?: number;
    manual_data?: {
        expected_salary?: string;
        notice_period?: string;
        notes?: string;
    };
}

interface TimelineEvent {
    type: string;
    label: string;
    icon: string;
    color: string;
    timestamp: string;
    notes?: string;
    details?: Record<string, any>;
}

interface EnrichmentResult {
    pipeline_id: string;
    candidate_id: string;
    candidate_name: string;
    stages_completed: string[];
    current_stage: string;
    email_status: {
        found: boolean;
        email?: string;
        source?: string;
        errors: string[];
        needs_manual: boolean;
    };
    enrichment_status: {
        completed: boolean;
        match_score?: number;
        match_label?: string;
        error?: string;
    };
    outreach_status: {
        sent: boolean;
        error?: string;
    };
    final_stage: string;
    success: boolean;
}

interface LogEntry {
    id: string;
    message: string;
    status: "pending" | "success" | "error" | "info" | "warning";
    timestamp: string;
    details?: string;
}

// ============================================================================
// DONNA MASCOT
// ============================================================================

const DonnaMascot = ({
    mood = "happy",
    size = "sm",
    message,
    className
}: {
    mood?: "happy" | "thinking" | "excited" | "waving" | "working" | "celebrating";
    size?: "sm" | "md" | "lg";
    message?: string;
    className?: string;
}) => {
    const sizeClasses = {
        sm: "w-8 h-8 text-base",
        md: "w-12 h-12 text-xl",
        lg: "w-16 h-16 text-2xl"
    };

    const moodEmojis = {
        happy: "🤖",
        thinking: "🤔",
        excited: "🎉",
        waving: "👋",
        working: "⚙️",
        celebrating: "🏆"
    };

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <motion.div
                className={cn(
                    "rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg",
                    sizeClasses[size]
                )}
                animate={mood === "working" ? {
                    rotate: [0, 360],
                } : {
                    scale: [1, 1.05, 1],
                }}
                transition={mood === "working" ? {
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                } : {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                {moodEmojis[mood]}
            </motion.div>
            {message && (
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-300"
                >
                    {message}
                </motion.div>
            )}
        </div>
    );
};

// ============================================================================
// CANDIDATE STAGE TIMELINE
// ============================================================================

const CandidateStageTimeline = ({ candidate }: { candidate: CandidateStatus }) => {
    const stages = [
        {
            key: "sourced",
            label: "Added",
            description: "Candidate added to pipeline",
            icon: PlusCircle,
            completed: true,
            active: candidate.stage === "sourced",
            completedAt: candidate.stage_updated_at
        },
        {
            key: "enriched",
            label: "Analyzed",
            description: candidate.is_enriched
                ? `Profile reviewed • Match: ${candidate.match_label || 'Pending'}`
                : "Waiting for profile analysis",
            icon: Zap,
            completed: candidate.is_enriched,
            active: candidate.stage === "enriching" || candidate.stage === "enriched",
            error: candidate.stage === "enrichment_failed",
            errorMessage: candidate.enrichment_error
        },
        {
            key: "email",
            label: "Contact Info",
            description: candidate.has_email
                ? `Email found: ${candidate.email?.substring(0, 20)}...`
                : candidate.needs_manual_email
                    ? "Email needed - please provide"
                    : "Searching for contact info",
            icon: Mail,
            completed: candidate.has_email,
            active: candidate.needs_manual_email,
            error: candidate.needs_manual_email,
            needsAction: candidate.needs_manual_email
        },
        {
            key: "outreach",
            label: "Contacted",
            description: candidate.outreach_sent
                ? "Outreach email sent successfully"
                : "Ready to send outreach email",
            icon: Send,
            completed: candidate.outreach_sent,
            active: candidate.stage === "outreach_sent"
        },
        {
            key: "responded",
            label: "Responded",
            description: candidate.outreach_clicked
                ? "Candidate clicked and engaged"
                : "Waiting for candidate response",
            icon: MessageSquare,
            completed: candidate.outreach_clicked || candidate.stage === "responded" || candidate.stage === "scheduling",
            active: candidate.stage === "responded" || candidate.stage === "scheduling"
        },
        {
            key: "scheduled",
            label: "Scheduled",
            description: candidate.interview_scheduled
                ? `Interview scheduled for ${new Date(candidate.interview_scheduled).toLocaleDateString()}`
                : "Waiting to schedule interview",
            icon: Calendar,
            completed: !!candidate.interview_scheduled,
            active: candidate.stage === "scheduled"
        },
        {
            key: "interviewed",
            label: "Interviewed",
            description: candidate.interview_completed
                ? `Interview complete • Score: ${candidate.interview_score || 'Pending'}`
                : "Interview pending",
            icon: PhoneCall,
            completed: candidate.interview_completed,
            active: candidate.stage === "interview_completed"
        }
    ];

    return (
        <div className="flex items-center gap-1 w-full max-w-lg">
            {stages.map((stage, index) => {
                const Icon = stage.icon;
                const isLast = index === stages.length - 1;

                return (
                    <TooltipProvider key={stage.key}>
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <div className="flex items-center">
                                    <motion.div
                                        className={cn(
                                            "w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-help",
                                            stage.completed
                                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                : stage.error
                                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                    : stage.active
                                                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse"
                                                        : "bg-zinc-800 text-zinc-600 border border-zinc-700"
                                        )}
                                        whileHover={{ scale: 1.15 }}
                                    >
                                        {stage.completed ? (
                                            <Check className="w-3.5 h-3.5" />
                                        ) : stage.error ? (
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                        ) : (
                                            <Icon className="w-3.5 h-3.5" />
                                        )}
                                    </motion.div>
                                    {!isLast && (
                                        <div className={cn(
                                            "w-4 h-0.5 mx-0.5",
                                            stage.completed ? "bg-green-500/50" : "bg-zinc-700"
                                        )} />
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                className="bg-zinc-900 border-zinc-700 max-w-xs"
                            >
                                <div className="space-y-1">
                                    <p className="font-bold text-sm flex items-center gap-2">
                                        {stage.completed && <Check className="w-3 h-3 text-green-400" />}
                                        {stage.error && <AlertTriangle className="w-3 h-3 text-red-400" />}
                                        {stage.label}
                                    </p>
                                    <p className="text-xs text-zinc-400">{stage.description}</p>
                                    {stage.needsAction && (
                                        <p className="text-xs text-amber-400 font-medium mt-1">
                                            ⚠️ Action needed - click to provide
                                        </p>
                                    )}
                                    {stage.errorMessage && (
                                        <p className="text-xs text-red-400 mt-1">
                                            Error: {stage.errorMessage}
                                        </p>
                                    )}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            })}
        </div>
    );
};

// ============================================================================
// EMAIL INPUT DIALOG
// ============================================================================

const EmailInputDialog = ({
    isOpen,
    onClose,
    candidate,
    onSubmit,
    isSubmitting
}: {
    isOpen: boolean;
    onClose: () => void;
    candidate: CandidateStatus | null;
    onSubmit: (email: string, phone: string | null, autoOutreach: boolean) => Promise<void>;
    isSubmitting: boolean;
}) => {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [autoOutreach, setAutoOutreach] = useState(true);

    const handleSubmit = async () => {
        if (!email) return;
        await onSubmit(email, phone || null, autoOutreach);
        setEmail("");
        setPhone("");
    };

    if (!candidate) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-indigo-400" />
                        Provide Contact Info
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        We couldn't find {candidate.name}'s email automatically. Please provide it manually.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Why we need this */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                            <div className="text-sm">
                                <p className="text-amber-200 font-medium">Why wasn't the email found?</p>
                                <ul className="text-amber-200/70 text-xs mt-1 space-y-0.5">
                                    {candidate.email_fetch_errors?.map((err, i) => (
                                        <li key={i}>• {err}</li>
                                    )) || <li>• Contact info not publicly available</li>}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Email Input */}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-zinc-300">
                            Email Address <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="candidate@company.com"
                            className="bg-zinc-800 border-zinc-700 focus:border-indigo-500"
                        />
                    </div>

                    {/* Phone Input (Optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-zinc-300">
                            Phone Number <span className="text-zinc-500">(optional, for interview)</span>
                        </Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="bg-zinc-800 border-zinc-700 focus:border-indigo-500"
                        />
                    </div>

                    {/* Auto Outreach Toggle */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <div className="flex items-center gap-3">
                            <Rocket className="w-5 h-5 text-indigo-400" />
                            <div>
                                <p className="text-sm font-medium text-zinc-200">Send outreach automatically</p>
                                <p className="text-xs text-zinc-500">Email will be sent right after saving</p>
                            </div>
                        </div>
                        <Checkbox
                            checked={autoOutreach}
                            onCheckedChange={(checked) => setAutoOutreach(checked === true)}
                            className="border-zinc-600 data-[state=checked]:bg-indigo-600"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!email || isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-500"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {autoOutreach ? "Saving & Sending..." : "Saving..."}
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                {autoOutreach ? "Save & Send Outreach" : "Save Email"}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ============================================================================
// ENRICHMENT CONSOLE (Side Panel)
// ============================================================================

const EnrichmentConsole = ({
    isOpen,
    onClose,
    logs,
    isProcessing,
    currentCandidate,
    progress
}: {
    isOpen: boolean;
    onClose: () => void;
    logs: LogEntry[];
    isProcessing: boolean;
    currentCandidate: string | null;
    progress: { current: number; total: number };
}) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        onClick={() => !isProcessing && onClose()}
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-full max-w-lg bg-zinc-950 border-l border-zinc-800 shadow-2xl z-[70] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-800 bg-zinc-900">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <DonnaMascot mood={isProcessing ? "working" : "happy"} size="sm" />
                                    <div>
                                        <h2 className="text-lg font-bold text-white">
                                            {isProcessing ? "Working..." : "Complete!"}
                                        </h2>
                                        {currentCandidate && (
                                            <p className="text-sm text-zinc-400">{currentCandidate}</p>
                                        )}
                                    </div>
                                </div>
                                {!isProcessing && (
                                    <Button variant="ghost" size="icon" onClick={onClose}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                            <div className="flex justify-between text-xs text-zinc-500 mb-2">
                                <span>Progress</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        </div>

                        {/* Logs */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-auto p-6"
                        >
                            <div className="space-y-3 font-mono text-sm">
                                {logs.map((log) => (
                                    <motion.div
                                        key={log.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex gap-3 items-start"
                                    >
                                        <span className="text-zinc-600 text-xs min-w-[50px]">
                                            {log.timestamp}
                                        </span>
                                        <div className="flex items-start gap-2 flex-1">
                                            {log.status === "success" && (
                                                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                            )}
                                            {log.status === "error" && (
                                                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                            )}
                                            {log.status === "warning" && (
                                                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                            )}
                                            {log.status === "info" && (
                                                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                            )}
                                            {log.status === "pending" && (
                                                <Loader2 className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0 animate-spin" />
                                            )}
                                            <div className="flex-1">
                                                <span className={cn(
                                                    log.status === "error" ? "text-red-300" :
                                                        log.status === "success" ? "text-green-300" :
                                                            log.status === "warning" ? "text-amber-300" :
                                                                "text-zinc-300"
                                                )}>
                                                    {log.message}
                                                </span>
                                                {log.details && (
                                                    <p className="text-xs text-zinc-500 mt-1">{log.details}</p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {isProcessing && (
                                    <div className="flex gap-3 items-center text-zinc-500">
                                        <span className="text-xs min-w-[50px]">...</span>
                                        <span className="animate-pulse">_</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        {!isProcessing && (
                            <div className="p-6 border-t border-zinc-800 bg-zinc-900">
                                <Button
                                    className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                                    onClick={onClose}
                                >
                                    Close Console
                                </Button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ============================================================================
// CANDIDATE ROW COMPONENT
// ============================================================================

const CandidateRow = ({
    candidate,
    isSelected,
    onToggle,
    onClick,
    onProvideEmail,
    isProcessing
}: {
    candidate: CandidateStatus;
    isSelected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onProvideEmail: () => void;
    isProcessing: boolean;
}) => {
    const matchScore = candidate.match_score || 0;
    const isEnriched = candidate.is_enriched && candidate.has_email;
    const isFailed = !!candidate.enrichment_error;
    const needsEmail = candidate.needs_manual_email;
    const needsReview = candidate.is_enriched && candidate.has_email && !candidate.outreach_sent;
    const isSent = candidate.outreach_sent;
    const alreadyProcessed = isSent || candidate.outreach_opened || candidate.outreach_clicked;

    const getMatchColor = (score: number) => {
        if (score >= 85) return "text-emerald-400";
        if (score >= 70) return "text-green-400";
        if (score >= 55) return "text-yellow-400";
        if (score >= 40) return "text-orange-400";
        return "text-zinc-500";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "group flex flex-col gap-4 p-5 rounded-xl border transition-all duration-200",
                "hover:bg-zinc-900/80 cursor-pointer",
                isSelected
                    ? "border-indigo-500/50 bg-indigo-500/5"
                    : needsEmail
                        ? "border-amber-500/30 bg-amber-500/5"
                        : needsReview
                            ? "border-purple-500/30 bg-purple-500/5"
                            : alreadyProcessed
                                ? "border-green-500/20 bg-green-500/5"
                                : "border-zinc-800 bg-zinc-900/30"
            )}
        >
            {/* Already Contacted Banner */}
            {alreadyProcessed && (
                <div className="flex items-center gap-3 p-3 -mt-2 -mx-2 bg-green-500/10 border-b border-green-500/20 rounded-t-xl">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <div className="flex-1">
                        <p className="text-xs font-medium text-green-300">Already Contacted</p>
                        <p className="text-[10px] text-green-400/70">
                            {candidate.outreach_opened ? "Email opened" :
                                candidate.outreach_clicked ? "Candidate engaged" :
                                    "Outreach sent"}
                        </p>
                    </div>
                </div>
            )}

            {/* Review Required Banner */}
            {needsReview && !alreadyProcessed && (
                <div className="flex items-center gap-3 p-3 -mt-2 -mx-2 bg-purple-500/10 border-b border-purple-500/20 rounded-t-xl">
                    <Eye className="w-4 h-4 text-purple-400" />
                    <div className="flex-1">
                        <p className="text-xs font-medium text-purple-300">Ready for Review</p>
                        <p className="text-[10px] text-purple-400/70">Click to review profile before sending outreach</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                </div>
            )}

            {/* Top Row: Checkbox, Avatar, Name, Match Score */}
            <div className="flex items-center gap-4">
                {/* Checkbox - Disabled for already contacted, hidden for review-required */}
                {!needsReview && !alreadyProcessed && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={onToggle}
                            disabled={isProcessing}
                            className="border-zinc-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                    </div>
                )}

                {/* Show disabled checkbox with tooltip for already contacted */}
                {alreadyProcessed && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={false}
                                        disabled
                                        className="border-zinc-700 opacity-50"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-900 border-zinc-700">
                                <p className="text-xs">Already contacted - cannot reselect</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {needsReview && <div className="w-5" />} {/* Spacer */}

                {/* Rest of the component stays the same... */}
                <div className="relative">
                    {candidate.profile_picture_url ? (
                        <img
                            src={candidate.profile_picture_url}
                            alt={candidate.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-zinc-700"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {candidate.name?.charAt(0) || "?"}
                        </div>
                    )}
                    {/* Status indicator */}
                    {candidate.is_enriched && candidate.has_email && !needsReview && !alreadyProcessed && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}
                    {needsReview && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                            <Eye className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}
                    {needsEmail && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}
                    {alreadyProcessed && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        </div>
                    )}
                </div>

                {/* Name & Info */}
                <div className="flex-1 min-w-0" onClick={onClick}>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "font-bold text-lg truncate",
                            isSelected ? "text-indigo-300" : "text-zinc-100"
                        )}>
                            {candidate.name}
                        </span>
                        {candidate.linkedin_url && (
                            <a href={candidate.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-zinc-500 hover:text-blue-400 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{candidate.headline}</p>
                    {candidate.location && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                            <MapPin className="w-3 h-3" />
                            {candidate.location}
                        </div>
                    )}
                </div>

                {/* Match Score */}
                {matchScore > 0 && (
                    <div className="hidden md:flex flex-col items-center px-4 border-l border-zinc-800/50">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">
                            Fit
                        </span>
                        <span className={cn("text-2xl font-black", getMatchColor(matchScore))}>
                            {matchScore}
                        </span>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                    {needsReview && !alreadyProcessed && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                            }}
                        >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Review & Send
                        </Button>
                    )}
                    {needsEmail && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onProvideEmail();
                            }}
                        >
                            <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                            Add Email
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                            <DropdownMenuItem onClick={onClick}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Star className="w-4 h-4 mr-2" />
                                Add to Favorites
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-700" />
                            <DropdownMenuItem className="text-red-400">
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Bottom Row: Timeline + Status Pills */}
            <div className="flex items-center justify-between pl-12">
                <CandidateStageTimeline candidate={candidate} />

                <div className="flex items-center gap-2">
                    {candidate.stage === "enriching" && (
                        <StatusPill
                            icon={Loader2}
                            label="Analyzing"
                            color="blue"
                            loading
                        />
                    )}
                    {needsReview && !alreadyProcessed && (
                        <StatusPill
                            icon={Eye}
                            label="Review"
                            color="purple"
                            active
                        />
                    )}
                    {isSent && (
                        <StatusPill
                            icon={Check}
                            label="Sent"
                            color="green"
                            active
                        />
                    )}
                    {candidate.outreach_opened && (
                        <StatusPill
                            icon={Eye}
                            label="Opened"
                            color="cyan"
                            active
                        />
                    )}
                    {candidate.interview_scheduled && (
                        <StatusPill
                            icon={Calendar}
                            label="Scheduled"
                            color="teal"
                            active
                        />
                    )}
                    {candidate.interview_completed && (
                        <StatusPill
                            icon={Trophy}
                            label={`Score: ${candidate.interview_score || '-'}`}
                            color="emerald"
                            active
                        />
                    )}
                </div>
            </div>

            {/* Manual Data (if present) */}
            {candidate.manual_data && (
                <div className="flex items-center gap-4 pl-12 text-xs text-zinc-500">
                    {candidate.manual_data.expected_salary && (
                        <span>💰 {candidate.manual_data.expected_salary}</span>
                    )}
                    {candidate.manual_data.notice_period && (
                        <span>⏱️ {candidate.manual_data.notice_period}</span>
                    )}
                    {candidate.manual_data.notes && (
                        <span className="truncate max-w-xs">📝 {candidate.manual_data.notes}</span>
                    )}
                </div>
            )}
        </motion.div>
    );
};
// ============================================================================
// STATUS PILL COMPONENT
// ============================================================================

const StatusPill = ({
    icon: Icon,
    label,
    color,
    active = false,
    loading = false
}: {
    icon: any;
    label: string;
    color: "emerald" | "green" | "blue" | "purple" | "cyan" | "teal" | "amber" | "red";
    active?: boolean;
    loading?: boolean;
}) => {
    const colorClasses = {
        emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        green: "bg-green-500/10 text-green-400 border-green-500/20",
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
        amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        red: "bg-red-500/10 text-red-400 border-red-500/20"
    };

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
            colorClasses[color],
            loading && "animate-pulse"
        )}>
            <Icon className={cn("w-3 h-3", loading && "animate-spin")} />
            {label}
        </div>
    );
};

// ============================================================================
// JOB CONTEXT SIDEBAR
// ============================================================================

const JobContextSidebar = ({
    jobTitle,
    jdText,
    stats
}: {
    jobTitle: string;
    jdText?: string;
    stats: {
        total: number;
        enriched: number;
        hasEmail: number;
        contacted: number;
        responded: number;
        scheduled: number;
    };
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="space-y-4">
            {/* Job Info Card */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{jobTitle}</h3>
                        <p className="text-xs text-zinc-500">Active Pipeline</p>
                    </div>
                </div>

                {jdText && (
                    <div>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 mb-2"
                        >
                            <FileText className="w-3 h-3" />
                            Job Description
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800 max-h-48 overflow-auto">
                                        {jdText}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
                    Pipeline Stats
                </h4>
                <div className="space-y-3">
                    <StatRow label="Total Candidates" value={stats.total} icon={Users} color="zinc" />
                    <StatRow label="Enriched" value={stats.enriched} icon={Zap} color="blue" />
                    <StatRow label="Emails Ready" value={stats.hasEmail} icon={Mail} color="green" />
                    <StatRow label="Contacted" value={stats.contacted} icon={Send} color="purple" />
                    <StatRow label="Responded" value={stats.responded} icon={MessageSquare} color="cyan" />
                    <StatRow label="Scheduled" value={stats.scheduled} icon={Calendar} color="teal" />
                </div>
            </div>

            {/* Need Help Card */}
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                <div className="flex items-start gap-3">
                    <DonnaMascot mood="happy" size="sm" />
                    <div className="text-sm">
                        <p className="text-zinc-300 font-medium">Need help?</p>
                        <p className="text-zinc-500 text-xs mt-1">
                            Select candidates and click "Start Outreach" to begin contacting them!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatRow = ({
    label,
    value,
    icon: Icon,
    color
}: {
    label: string;
    value: number;
    icon: any;
    color: string;
}) => {
    const colorClasses: Record<string, string> = {
        zinc: "text-zinc-400",
        blue: "text-blue-400",
        green: "text-green-400",
        purple: "text-purple-400",
        cyan: "text-cyan-400",
        teal: "text-teal-400"
    };

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4", colorClasses[color])} />
                <span className="text-sm text-zinc-400">{label}</span>
            </div>
            <span className="font-bold text-white">{value}</span>
        </div>
    );
};


// ============================================================================
// ADD CANDIDATE DIALOG
// ============================================================================

const AddCandidateDialog = ({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        linkedin_url: string;
        name?: string;
        email?: string;
        phone?: string;
        expected_salary?: string;
        notice_period?: string;
        notes?: string;
    }) => Promise<void>;
    isSubmitting: boolean;
}) => {
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [expectedSalary, setExpectedSalary] = useState("");
    const [noticePeriod, setNoticePeriod] = useState("");
    const [notes, setNotes] = useState("");

    const handleSubmit = async () => {
        if (!linkedinUrl) return;
        await onSubmit({
            linkedin_url: linkedinUrl,
            name: name || undefined,
            email: email || undefined,
            phone: phone || undefined,
            expected_salary: expectedSalary || undefined,
            notice_period: noticePeriod || undefined,
            notes: notes || undefined
        });
        // Reset form
        setLinkedinUrl("");
        setName("");
        setEmail("");
        setPhone("");
        setExpectedSalary("");
        setNoticePeriod("");
        setNotes("");
    };

    const isValidLinkedIn = linkedinUrl.includes("linkedin.com/in/");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <PlusCircle className="w-5 h-5 text-indigo-400" />
                        Add Candidate
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Add a new candidate to this pipeline. They'll start in the "sourced" stage.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* LinkedIn URL - Required */}
                    <div className="space-y-2">
                        <Label htmlFor="linkedin" className="text-zinc-300">
                            LinkedIn URL <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            id="linkedin"
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            className={cn(
                                "bg-zinc-800 border-zinc-700 focus:border-indigo-500",
                                linkedinUrl && !isValidLinkedIn && "border-red-500"
                            )}
                        />
                        {linkedinUrl && !isValidLinkedIn && (
                            <p className="text-xs text-red-400">Please enter a valid LinkedIn profile URL</p>
                        )}
                    </div>

                    {/* Name - Optional */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-zinc-300">
                            Name <span className="text-zinc-500">(optional - we'll try to find it)</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            className="bg-zinc-800 border-zinc-700 focus:border-indigo-500"
                        />
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="add-email" className="text-zinc-300 text-xs">
                                Email
                            </Label>
                            <Input
                                id="add-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@company.com"
                                className="bg-zinc-800 border-zinc-700 focus:border-indigo-500 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="add-phone" className="text-zinc-300 text-xs">
                                Phone
                            </Label>
                            <Input
                                id="add-phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="bg-zinc-800 border-zinc-700 focus:border-indigo-500 text-sm"
                            />
                        </div>
                    </div>

                    {/* HR Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="salary" className="text-zinc-300 text-xs">
                                Expected Salary
                            </Label>
                            <Input
                                id="salary"
                                value={expectedSalary}
                                onChange={(e) => setExpectedSalary(e.target.value)}
                                placeholder="25 LPA"
                                className="bg-zinc-800 border-zinc-700 focus:border-indigo-500 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notice" className="text-zinc-300 text-xs">
                                Notice Period
                            </Label>
                            <Input
                                id="notice"
                                value={noticePeriod}
                                onChange={(e) => setNoticePeriod(e.target.value)}
                                placeholder="30 days"
                                className="bg-zinc-800 border-zinc-700 focus:border-indigo-500 text-sm"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-zinc-300 text-xs">
                            Notes
                        </Label>
                        <Input
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Referral from John, strong React skills..."
                            className="bg-zinc-800 border-zinc-700 focus:border-indigo-500 text-sm"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!linkedinUrl || !isValidLinkedIn || isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-500"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Adding...
                            </>
                        ) : (
                            <>
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Add Candidate
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function PipelineSessionPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { token, isAuthenticated } = useAuth();
    const sessionId = params.sessionId as string;

    // State
    const [batchData, setBatchData] = useState<any>(null);
    const [candidates, setCandidates] = useState<CandidateStatus[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingLogs, setProcessingLogs] = useState<LogEntry[]>([]);
    const [showConsole, setShowConsole] = useState(false);
    const [currentProcessingCandidate, setCurrentProcessingCandidate] = useState<string | null>(null);
    const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

    // Email Dialog State
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailDialogCandidate, setEmailDialogCandidate] = useState<CandidateStatus | null>(null);
    const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

    // Filters
    const [filterStage, setFilterStage] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const [showReviewCaution, setShowReviewCaution] = useState(false);
    const [pendingOutreachAction, setPendingOutreachAction] = useState(false);

    const [showAddCandidate, setShowAddCandidate] = useState(false);
    const [isAddingCandidate, setIsAddingCandidate] = useState(false);

    // Calculate candidates that need review
    const needsReviewCandidates = useMemo(() => {
        return candidates.filter(c =>
            selectedIds.has(c.candidate_id) &&
            c.is_enriched &&
            c.has_email &&
            !c.outreach_sent
        );
    }, [candidates, selectedIds]);


    const handleAddCandidate = async (data: {
        linkedin_url: string;
        name?: string;
        email?: string;
        phone?: string;
        expected_salary?: string;
        notice_period?: string;
        notes?: string;
    }) => {
        setIsAddingCandidate(true);
        try {
            const res = await fetch(`${API_BASE}/conversation/${sessionId}/add-candidate`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (result.success) {
                setShowAddCandidate(false);
                loadBatchStatus(); // Refresh list
            } else {
                alert(result.detail || result.error || "Failed to add candidate");
            }
        } catch (e: any) {
            alert(e.message || "Failed to add candidate");
        } finally {
            setIsAddingCandidate(false);
        }
    };

    // Check for action param (from pipeline list page)
    useEffect(() => {
        const action = searchParams.get("action");
        if (action === "email") {
            setFilterStage("needs_email");
        } else if (action === "outreach") {
            setFilterStage("ready_for_outreach");
        } else if (action === "review") {
            setFilterStage("responded");
        }
    }, [searchParams]);

    // Auth check
    useEffect(() => {
        if (!isAuthenticated) router.push("/login");
    }, [isAuthenticated, router]);

    // Load data
    useEffect(() => {
        if (!sessionId || !token) return;
        loadBatchStatus();

        const interval = setInterval(() => {
            if (!isProcessing) loadBatchStatus();
        }, 5000);

        return () => clearInterval(interval);
    }, [sessionId, token, isProcessing]);

    const loadBatchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/conversation/${sessionId}/pipeline-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setBatchData(data);

            // Normalize candidate data
            const normalizedCandidates = (data.candidates || []).map((c: any) => ({
                ...c,
                needs_manual_email: !c.has_email && (c.is_enriched || c.stage === "enrichment_failed"),
                email_fetch_errors: c.enrichment_error ? [c.enrichment_error] : []
            }));

            setCandidates(normalizedCandidates);
        } catch (err) {
            console.error("Failed to load pipeline status:", err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        loadBatchStatus();
    };

    // Calculate stats
    const stats = useMemo(() => {
        return {
            total: candidates.length,
            enriched: candidates.filter(c => c.is_enriched).length,
            hasEmail: candidates.filter(c => c.has_email).length,
            contacted: candidates.filter(c => c.outreach_sent).length,
            responded: candidates.filter(c => c.outreach_clicked).length,
            scheduled: candidates.filter(c => c.interview_scheduled).length,
            needsEmail: candidates.filter(c => c.needs_manual_email).length
        };
    }, [candidates]);

    // Filter candidates
    const filteredCandidates = useMemo(() => {
        let result = [...candidates];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.headline?.toLowerCase().includes(query) ||
                c.location?.toLowerCase().includes(query)
            );
        }

        // Stage filter
        if (filterStage !== "all") {
            switch (filterStage) {
                case "needs_email":
                    result = result.filter(c => c.needs_manual_email);
                    break;
                case "ready_for_outreach":
                    result = result.filter(c => c.is_enriched && c.has_email && !c.outreach_sent);
                    break;
                case "contacted":
                    result = result.filter(c => c.outreach_sent);
                    break;
                case "responded":
                    result = result.filter(c => c.outreach_clicked);
                    break;
                case "scheduled":
                    result = result.filter(c => c.interview_scheduled);
                    break;
            }
        }

        return result;
    }, [candidates, searchQuery, filterStage]);

    // Selection handlers
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredCandidates.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCandidates.map(c => c.candidate_id)));
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // Add log entry
    const addLog = (message: string, status: LogEntry["status"], details?: string) => {
        setProcessingLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            message,
            status,
            timestamp: new Date().toLocaleTimeString(),
            details
        }]);
    };

    // Start Outreach (Enrich + Email + Send)
    const handleStartOutreach = async () => {
        const targets = candidates.filter(c => selectedIds.has(c.candidate_id));
        if (targets.length === 0) return;

        // Filter out candidates who already received outreach
        const alreadyContacted = targets.filter(c => c.outreach_sent);
        const notYetContacted = targets.filter(c => !c.outreach_sent);

        // If all selected are already contacted, show error and return
        if (notYetContacted.length === 0) {
            alert("All selected candidates have already been contacted. Please select candidates who haven't received emails yet.");
            return;
        }

        // If some are already contacted, show warning
        if (alreadyContacted.length > 0) {
            const proceed = window.confirm(
                `${alreadyContacted.length} candidate${alreadyContacted.length > 1 ? 's have' : ' has'} already been contacted and will be skipped.\n\nProceed with ${notYetContacted.length} remaining candidate${notYetContacted.length > 1 ? 's' : ''}?`
            );
            if (!proceed) return;
        }

        // Check if any remaining candidates need review
        const needsReview = notYetContacted.filter(c =>
            c.is_enriched && c.has_email && !c.outreach_sent
        );

        if (needsReview.length > 0 && !pendingOutreachAction) {
            setShowReviewCaution(true);
            return;
        }

        // Reset pending action flag
        setPendingOutreachAction(false);

        // Process ONLY the not-yet-contacted candidates
        setShowConsole(true);
        setIsProcessing(true);
        setProcessingLogs([]);
        setProcessingProgress({ current: 0, total: notYetContacted.length });

        addLog(`Starting outreach for ${notYetContacted.length} candidate${notYetContacted.length > 1 ? 's' : ''}`, "info");

        if (alreadyContacted.length > 0) {
            addLog(`⏭️ Skipping ${alreadyContacted.length} already contacted`, "info");
        }

        for (let i = 0; i < notYetContacted.length; i++) {
            const target = notYetContacted[i];
            setCurrentProcessingCandidate(target.name);
            setProcessingProgress({ current: i + 1, total: notYetContacted.length });

            addLog(`Processing ${target.name}...`, "pending");

            try {
                const res = await fetch(`${API_BASE}/pipeline/${target.pipeline_id}/enrich-with-status`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ auto_outreach: true })
                });

                const result: EnrichmentResult = await res.json();

                for (const stage of result.stages_completed) {
                    switch (stage) {
                        case "email_found":
                            addLog(`📧 Email found: ${result.email_status.email}`, "success", `Source: ${result.email_status.source}`);
                            break;
                        case "email_fetch_failed":
                            addLog(`⚠️ Email not found`, "warning", result.email_status.errors.join("; "));
                            break;
                        case "enrichment_completed":
                            addLog(`✨ Analysis complete! Match: ${result.enrichment_status.match_score}%`, "success");
                            break;
                        case "outreach_sent":
                            addLog(`🚀 Email sent successfully!`, "success");
                            break;
                    }
                }

                if (result.success) {
                    if (result.email_status.needs_manual) {
                        addLog(`${target.name}: Needs email input`, "warning");
                    } else if (result.outreach_status.sent) {
                        addLog(`${target.name}: Complete! ✅`, "success");
                    } else {
                        addLog(`${target.name}: Ready`, "success");
                    }
                } else {
                    addLog(`${target.name}: Failed - ${result.enrichment_status.error}`, "error");
                }

            } catch (e: any) {
                addLog(`${target.name}: Error - ${e.message}`, "error");
            }

            await new Promise(r => setTimeout(r, 500));
        }

        addLog("All processed!", "info");
        setIsProcessing(false);
        setCurrentProcessingCandidate(null);
        setSelectedIds(new Set());
        loadBatchStatus();
    };


    // Provide manual email
    const handleProvideEmail = async (email: string, phone: string | null, autoOutreach: boolean) => {
        if (!emailDialogCandidate) return;
        setIsSubmittingEmail(true);

        try {
            const res = await fetch(`${API_BASE}/pipeline/${emailDialogCandidate.pipeline_id}/provide-email`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, phone, auto_outreach: autoOutreach })
            });

            const result = await res.json();

            if (result.success) {
                setEmailDialogOpen(false);
                setEmailDialogCandidate(null);
                loadBatchStatus();
            } else {
                alert(result.error || "Failed to save email");
            }
        } catch (e: any) {
            alert(e.message || "Failed to save email");
        } finally {
            setIsSubmittingEmail(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center z-10">
                    <DonnaMascot mood="working" size="lg" />
                    <motion.p
                        className="text-zinc-400 font-medium mt-4"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    >
                        Loading pipeline data...
                    </motion.p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
            {/* Background */}
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
            <AnimatedBackground />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push("/pipeline")}
                                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold text-white flex items-center gap-3">
                                    {batchData?.job_title || "Pipeline"}
                                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-normal">
                                        {stats.total} candidates
                                    </Badge>
                                </h1>
                                <p className="text-sm text-zinc-500 mt-0.5">
                                    {stats.hasEmail} emails ready • {stats.contacted} contacted • {stats.responded} responded
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {stats.needsEmail > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                    onClick={() => setFilterStage("needs_email")}
                                >
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    {stats.needsEmail} need email
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                                onClick={() => setShowAddCandidate(true)}
                            >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Add Candidate
                            </Button>
                            {/* Add Candidate Dialog */}
                            <AddCandidateDialog
                                isOpen={showAddCandidate}
                                onClose={() => setShowAddCandidate(false)}
                                onSubmit={handleAddCandidate}
                                isSubmitting={isAddingCandidate}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="text-zinc-400 hover:text-white"
                            >
                                <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Sidebar */}
                <div className="hidden lg:block lg:col-span-3">
                    <div className="sticky top-24">
                        <JobContextSidebar
                            jobTitle={batchData?.job_title || "Position"}
                            jdText={batchData?.jd_text}
                            stats={stats}
                        />
                    </div>
                </div>

                {/* Main List */}
                <div className="col-span-1 lg:col-span-9 space-y-4">
                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <Input
                                placeholder="Search candidates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-zinc-900/50 border-zinc-800 focus:border-indigo-500"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                                    <Filter className="w-4 h-4 mr-2" />
                                    {filterStage === "all" ? "All Stages" :
                                        filterStage === "needs_email" ? "Needs Email" :
                                            filterStage === "ready_for_outreach" ? "Ready for Outreach" :
                                                filterStage === "contacted" ? "Contacted" :
                                                    filterStage === "responded" ? "Responded" :
                                                        "Scheduled"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                                <DropdownMenuItem onClick={() => setFilterStage("all")}>
                                    All Stages
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-700" />
                                <DropdownMenuItem onClick={() => setFilterStage("needs_email")}>
                                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-400" />
                                    Needs Email ({stats.needsEmail})
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStage("ready_for_outreach")}>
                                    <Rocket className="w-4 h-4 mr-2 text-green-400" />
                                    Ready for Outreach
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStage("contacted")}>
                                    <Send className="w-4 h-4 mr-2 text-purple-400" />
                                    Contacted
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStage("responded")}>
                                    <MessageSquare className="w-4 h-4 mr-2 text-cyan-400" />
                                    Responded
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStage("scheduled")}>
                                    <Calendar className="w-4 h-4 mr-2 text-teal-400" />
                                    Scheduled
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 backdrop-blur-sm">
                        <div className="flex items-center gap-3 pl-2">
                            <Checkbox
                                checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                                onCheckedChange={toggleSelectAll}
                                disabled={isProcessing}
                                className="border-zinc-600 data-[state=checked]:bg-indigo-600"
                            />
                            <span className="text-sm text-zinc-400 font-medium">
                                {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                            </span>
                        </div>
                        <div className="text-xs text-zinc-600 font-mono flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            LIVE
                        </div>
                    </div>

                    {/* Candidate List */}
                    <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                            {filteredCandidates.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-16"
                                >
                                    <Users className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
                                    <p className="text-zinc-500">No candidates match your filters</p>
                                    <Button
                                        variant="link"
                                        onClick={() => {
                                            setFilterStage("all");
                                            setSearchQuery("");
                                        }}
                                        className="text-indigo-400 mt-2"
                                    >
                                        Clear filters
                                    </Button>
                                </motion.div>
                            ) : (
                                filteredCandidates.map((candidate) => (
                                    <CandidateRow
                                        key={candidate.candidate_id}
                                        candidate={candidate}
                                        isSelected={selectedIds.has(candidate.candidate_id)}
                                        onToggle={() => toggleSelection(candidate.candidate_id)}
                                        onClick={() => router.push(`/pipeline/${sessionId}/${candidate.pipeline_id}`)}
                                        onProvideEmail={() => {
                                            setEmailDialogCandidate(candidate);
                                            setEmailDialogOpen(true);
                                        }}
                                        isProcessing={isProcessing}
                                    />
                                ))
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bottom padding for floating bar */}
                    <div className="h-24" />
                </div>
            </main>

            {/* Floating Action Bar */}
            <AnimatePresence>
                {selectedIds.size > 0 && !showConsole && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900/95 backdrop-blur-xl text-white p-2 px-4 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-zinc-700"
                    >
                        <div className="bg-white text-black rounded-full px-3 py-1 text-xs font-bold">
                            {selectedIds.size} selected
                        </div>

                        <Button
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-0 rounded-full px-6 shadow-lg"
                            onClick={handleStartOutreach}
                            disabled={isProcessing}
                        >
                            <Rocket className="w-4 h-4 mr-2" />
                            Start Outreach
                        </Button>

                        <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 rounded-full hover:bg-zinc-800"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Enrichment Console */}
            <EnrichmentConsole
                isOpen={showConsole}
                onClose={() => setShowConsole(false)}
                logs={processingLogs}
                isProcessing={isProcessing}
                currentCandidate={currentProcessingCandidate}
                progress={processingProgress}
            />

            {/* Email Input Dialog */}
            <EmailInputDialog
                isOpen={emailDialogOpen}
                onClose={() => {
                    setEmailDialogOpen(false);
                    setEmailDialogCandidate(null);
                }}
                candidate={emailDialogCandidate}
                onSubmit={handleProvideEmail}
                isSubmitting={isSubmittingEmail}
            />

            {/* Review Caution Dialog */}
            <ReviewCautionDialog
                isOpen={showReviewCaution}
                onClose={() => {
                    setShowReviewCaution(false);
                    setPendingOutreachAction(false);
                }}
                onProceed={() => {
                    setPendingOutreachAction(true);
                    handleStartOutreach();
                }}
                needsReviewCount={needsReviewCandidates.length}
            />

        </div>
    );
}

const ReviewCautionDialog = ({
    isOpen,
    onClose,
    onProceed,
    needsReviewCount
}: {
    isOpen: boolean;
    onClose: () => void;
    onProceed: () => void;
    needsReviewCount: number;
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Some Candidates Need Review
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        {needsReviewCount} candidate{needsReviewCount > 1 ? 's' : ''} {needsReviewCount > 1 ? 'have' : 'has'} been analyzed but {needsReviewCount > 1 ? 'haven\'t' : 'hasn\'t'} been reviewed yet.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-200">
                                <p className="font-medium mb-2">What does this mean?</p>
                                <ul className="space-y-1 text-xs text-amber-200/80">
                                    <li>✓ We've analyzed their profile and found their contact info</li>
                                    <li>✓ We've calculated their match score</li>
                                    <li>⚠️ But you haven't reviewed them yet</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-indigo-200 mb-1">Recommended Action</p>
                                <p className="text-xs text-indigo-200/80">
                                    Click on each candidate to review their full profile, match analysis, and personalized email draft before sending.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                        <Eye className="w-4 h-4 mr-2" />
                        Let Me Review
                    </Button>
                    <Button
                        onClick={() => {
                            onProceed();
                            onClose();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        Send Anyway
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ReviewRequiredBadge = () => (
    <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30"
    >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-medium text-amber-300">Review Required</span>
    </motion.div>
);