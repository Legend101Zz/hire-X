/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
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
    Github,
    Linkedin,
    Code2,
    GraduationCap,
    TrendingDown,
    Activity,
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

interface EnrichmentData {
    match_score: number;
    match_label: string;
    strengths: any[];
    concerns: any[];
    recommendation: any;
    executive_summary: string;
    experience_assessment: any;
    skill_validation: any;
    salary_estimate: any;
    response_likelihood: any;
    professional_footprint: any;
    candidate_info: any;
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
                    className="relative bg-zinc-800/80 backdrop-blur-sm rounded-2xl rounded-tl-sm py-3 px-4 shadow-lg border border-zinc-700/50 max-w-sm"
                >
                    <div className="absolute left-0 top-3 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-l border-b border-zinc-700/50 rotate-45" />
                    <p className={cn("text-zinc-300 leading-relaxed", textSizes[size])}>
                        {message}
                    </p>
                </motion.div>
            )}
        </div>
    );
};

// ============================================================================
// HORIZONTAL ANALYSIS TABS
// ============================================================================

interface AnalysisTab {
    id: string;
    label: string;
    icon: LucideIcon;
    color: string;
}

const ANALYSIS_TABS: AnalysisTab[] = [
    { id: "overview", label: "Overview", icon: BarChart3, color: "violet" },
    { id: "skills", label: "Skills", icon: Code2, color: "blue" },
    { id: "experience", label: "Experience", icon: Briefcase, color: "emerald" },
    { id: "salary", label: "Salary", icon: DollarSign, color: "amber" },
    { id: "footprint", label: "Digital Footprint", icon: Globe, color: "pink" },
    { id: "recommendation", label: "Recommendation", icon: Rocket, color: "orange" },
];

// ============================================================================
// ENRICHMENT DEEP DIVE COMPONENT
// ============================================================================

const EnrichmentDeepDive = ({ data, candidateName }: { data: any; candidateName: string }) => {
    const [activeTab, setActiveTab] = useState("overview");

    if (!data) return null;

    // Extract data from full_enrichment_data structure
    const enrichmentData = data.full_enrichment_data || data;
    const matchAnalysis = enrichmentData.match_analysis || {};
    const skillValidation = enrichmentData.skill_validation || {};
    const salaryTimeline = enrichmentData.salary_timeline || {};
    const professionalFootprint = enrichmentData.professional_footprint || {};
    const candidateInfo = enrichmentData.candidate || {};
    const responseLikelihood = enrichmentData.response_likelihood || {};

    const score = matchAnalysis.overall_match_score || data.match_score || 0;

    const getScoreColor = (s: number) => {
        if (s >= 80) return "from-emerald-500 to-green-400";
        if (s >= 60) return "from-green-500 to-lime-400";
        if (s >= 40) return "from-amber-500 to-yellow-400";
        return "from-red-500 to-orange-400";
    };

    const getScoreLabel = (s: number) => {
        if (s >= 80) return "Excellent Match";
        if (s >= 60) return "Good Match";
        if (s >= 40) return "Fair Match";
        return "Below Requirements";
    };

    return (
        <div className="space-y-6">
            {/* Horizontal Tab Navigation */}
            <div className="flex items-center gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-x-auto">
                {ANALYSIS_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab(tab.id);
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                                isActive
                                    ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30`
                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                            )}
                            style={isActive ? {
                                backgroundColor: `rgba(var(--${tab.color}-500), 0.15)`,
                            } : {}}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Overview Tab */}
                    {activeTab === "overview" && (
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Main Score Card */}
                            <div className="lg:col-span-1">
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 text-center h-full">
                                    <div className="relative w-32 h-32 mx-auto mb-4">
                                        <svg className="w-full h-full -rotate-90">
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="56"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                className="text-zinc-800"
                                            />
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="56"
                                                fill="none"
                                                stroke="url(#scoreGradient)"
                                                strokeWidth="8"
                                                strokeLinecap="round"
                                                strokeDasharray={`${(score / 100) * 352} 352`}
                                            />
                                            <defs>
                                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor={score >= 60 ? "#10b981" : "#ef4444"} />
                                                    <stop offset="100%" stopColor={score >= 60 ? "#22c55e" : "#f97316"} />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-4xl font-black text-white">{score}</span>
                                            <span className="text-xs text-zinc-500">/ 100</span>
                                        </div>
                                    </div>
                                    <h3 className={cn(
                                        "text-lg font-semibold",
                                        score >= 60 ? "text-emerald-400" : "text-amber-400"
                                    )}>
                                        {getScoreLabel(score)}
                                    </h3>
                                    <p className="text-sm text-zinc-500 mt-1">
                                        {matchAnalysis.match_label || data.match_label}
                                    </p>
                                </div>
                            </div>

                            {/* Summary & Key Points */}
                            <div className="lg:col-span-2 space-y-4">
                                {/* Executive Summary */}
                                <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-2xl border border-violet-500/20 p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                            <Bot className="w-4 h-4 text-violet-400" />
                                        </div>
                                        <span className="text-sm font-semibold text-violet-300">
                                            Donna&apos;s Assessment
                                        </span>
                                    </div>
                                    <p className="text-zinc-300 leading-relaxed text-sm">
                                        {matchAnalysis.recruiter_summary?.elevator_pitch ||
                                            data.executive_summary ||
                                            "Analysis complete. Review the detailed sections for more insights."}
                                    </p>
                                </div>

                                {/* Strengths & Concerns Grid */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Strengths */}
                                    <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ThumbsUp className="w-4 h-4 text-emerald-400" />
                                            <span className="text-sm font-semibold text-emerald-300">
                                                Key Strengths
                                            </span>
                                        </div>
                                        <ul className="space-y-2">
                                            {(matchAnalysis.strengths || data.strengths || []).slice(0, 3).map((s: any, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span>{typeof s === 'string' ? s : s.strength || s.description}</span>
                                                </li>
                                            ))}
                                            {(!matchAnalysis.strengths && !data.strengths) && (
                                                <li className="text-sm text-zinc-500 italic">No strengths identified</li>
                                            )}
                                        </ul>
                                    </div>

                                    {/* Concerns */}
                                    <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                                            <span className="text-sm font-semibold text-amber-300">
                                                Areas to Explore
                                            </span>
                                        </div>
                                        <ul className="space-y-2">
                                            {(matchAnalysis.concerns || data.concerns || []).slice(0, 3).map((c: any, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <span>{typeof c === 'string' ? c : c.concern || c.description}</span>
                                                </li>
                                            ))}
                                            {(!matchAnalysis.concerns && !data.concerns) && (
                                                <li className="text-sm text-zinc-500 italic">No major concerns</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Skills Tab */}
                    {activeTab === "skills" && (
                        <div className="space-y-6">
                            {/* Skill Categories */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Validated Skills */}
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        <h4 className="font-semibold text-white">Validated Skills</h4>
                                        <Badge variant="outline" className="ml-auto border-emerald-500/30 text-emerald-400 text-xs">
                                            {skillValidation.validated_skills?.length || 0} verified
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(skillValidation.validated_skills || []).map((skill: string, i: number) => (
                                            <Badge
                                                key={i}
                                                className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20"
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                {skill}
                                            </Badge>
                                        ))}
                                        {(!skillValidation.validated_skills || skillValidation.validated_skills.length === 0) && (
                                            <p className="text-sm text-zinc-500 italic">No validated skills</p>
                                        )}
                                    </div>
                                </div>

                                {/* Unvalidated/Claimed Skills */}
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <AlertCircle className="w-5 h-5 text-amber-400" />
                                        <h4 className="font-semibold text-white">Claimed (Unverified)</h4>
                                        <Badge variant="outline" className="ml-auto border-amber-500/30 text-amber-400 text-xs">
                                            {skillValidation.unvalidated_skills?.length || 0} unverified
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(skillValidation.unvalidated_skills || []).map((skill: string, i: number) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="border-zinc-700 text-zinc-400"
                                            >
                                                {skill}
                                            </Badge>
                                        ))}
                                        {(!skillValidation.unvalidated_skills || skillValidation.unvalidated_skills.length === 0) && (
                                            <p className="text-sm text-zinc-500 italic">No unverified skills</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Skill Gaps Analysis */}
                            {skillValidation.skill_gaps && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-red-400" />
                                        Skill Gaps
                                    </h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        {skillValidation.skill_gaps.critical_gaps?.length > 0 && (
                                            <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-4">
                                                <p className="text-xs text-red-400 font-medium uppercase tracking-wider mb-2">Critical</p>
                                                <ul className="space-y-1">
                                                    {skillValidation.skill_gaps.critical_gaps.map((gap: string, i: number) => (
                                                        <li key={i} className="text-sm text-zinc-300">{gap}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {skillValidation.skill_gaps.concerning_gaps?.length > 0 && (
                                            <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-4">
                                                <p className="text-xs text-amber-400 font-medium uppercase tracking-wider mb-2">Concerning</p>
                                                <ul className="space-y-1">
                                                    {skillValidation.skill_gaps.concerning_gaps.map((gap: string, i: number) => (
                                                        <li key={i} className="text-sm text-zinc-300">{gap}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {skillValidation.skill_gaps.acceptable_gaps?.length > 0 && (
                                            <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-4">
                                                <p className="text-xs text-blue-400 font-medium uppercase tracking-wider mb-2">Acceptable</p>
                                                <ul className="space-y-1">
                                                    {skillValidation.skill_gaps.acceptable_gaps.map((gap: string, i: number) => (
                                                        <li key={i} className="text-sm text-zinc-300">{gap}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Evidence */}
                            {skillValidation.evidence && skillValidation.evidence.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                        Evidence Found
                                    </h4>
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {skillValidation.evidence.slice(0, 5).map((e: any, i: number) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    {e.platform === "github" ? <Github className="w-4 h-4 text-blue-400" /> :
                                                        e.platform === "linkedin" ? <Linkedin className="w-4 h-4 text-blue-400" /> :
                                                            <Globe className="w-4 h-4 text-blue-400" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-white truncate">{e.skill || e.title}</p>
                                                    <p className="text-xs text-zinc-400 mt-0.5">{e.source || e.platform}</p>
                                                    {e.description && (
                                                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{e.description}</p>
                                                    )}
                                                </div>
                                                {e.confidence && (
                                                    <Badge variant="outline" className="shrink-0 text-xs">
                                                        {e.confidence}%
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Experience Tab */}
                    {activeTab === "experience" && (
                        <div className="space-y-6">
                            {/* Experience Summary */}
                            <div className="grid md:grid-cols-4 gap-4">
                                {[
                                    {
                                        label: "Total Roles",
                                        value: candidateInfo.experience_summary?.total_roles || 0,
                                        icon: Briefcase,
                                        color: "violet"
                                    },
                                    {
                                        label: "Professional",
                                        value: candidateInfo.experience_summary?.professional_roles || 0,
                                        icon: Building,
                                        color: "emerald"
                                    },
                                    {
                                        label: "Internships",
                                        value: candidateInfo.experience_summary?.internships || 0,
                                        icon: GraduationCap,
                                        color: "blue"
                                    },
                                    {
                                        label: "Real Exp (Yrs)",
                                        value: candidateInfo.experience_summary?.real_experience_years || 0,
                                        icon: Clock,
                                        color: "amber"
                                    },
                                ].map((stat, i) => {
                                    const Icon = stat.icon;
                                    return (
                                        <div key={i} className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 text-center">
                                            <Icon className={`w-5 h-5 text-${stat.color}-400 mx-auto mb-2`} />
                                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                                            <p className="text-xs text-zinc-500">{stat.label}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Experience Timeline */}
                            {candidateInfo.experience && candidateInfo.experience.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4">Work History</h4>
                                    <div className="space-y-4">
                                        {candidateInfo.experience.map((exp: any, i: number) => (
                                            <div key={i} className="relative pl-6 pb-4 border-l-2 border-zinc-700 last:border-0 last:pb-0">
                                                <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-violet-500 -translate-x-[7px]" />
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="font-medium text-white">{exp.title || exp.position}</p>
                                                        <p className="text-sm text-violet-400">{exp.company || exp.company_name}</p>
                                                        {exp.description && (
                                                            <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{exp.description}</p>
                                                        )}
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0 text-xs">
                                                        {exp.duration || exp.dates || "Present"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Education */}
                            {candidateInfo.education && candidateInfo.education.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <GraduationCap className="w-5 h-5 text-blue-400" />
                                        Education
                                    </h4>
                                    <div className="space-y-3">
                                        {candidateInfo.education.map((edu: any, i: number) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                    <GraduationCap className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{edu.degree || edu.field_of_study}</p>
                                                    <p className="text-sm text-zinc-400">{edu.school || edu.institution}</p>
                                                    <p className="text-xs text-zinc-500 mt-1">{edu.dates || edu.year}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Salary Tab */}
                    {activeTab === "salary" && (
                        <div className="space-y-6">
                            {/* Current Estimate */}
                            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                        <DollarSign className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-amber-400">Estimated Current CTC</p>
                                        <p className="text-3xl font-bold text-white">
                                            {salaryTimeline.current_estimated_ctc?.most_likely
                                                ? `₹${salaryTimeline.current_estimated_ctc.most_likely}L`
                                                : "Not Available"}
                                        </p>
                                    </div>
                                </div>
                                {salaryTimeline.current_estimated_ctc?.range || (salaryTimeline.current_estimated_ctc?.low && salaryTimeline.current_estimated_ctc?.high) ? (
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-zinc-400">Range:</span>
                                        <span className="text-white">
                                            ₹{salaryTimeline.current_estimated_ctc.low}L - ₹{salaryTimeline.current_estimated_ctc.high}L
                                        </span>
                                    </div>
                                ) : null}
                                {salaryTimeline.current_estimated_ctc?.note && (
                                    <p className="text-sm text-zinc-400 mt-3 italic">
                                        {salaryTimeline.current_estimated_ctc.note}
                                    </p>
                                )}
                            </div>

                            {/* Confidence Factors */}
                            {salaryTimeline.confidence_factors && salaryTimeline.confidence_factors.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-semibold text-white">Confidence Analysis</h4>
                                        <Badge variant="outline" className={cn(
                                            "text-xs",
                                            salaryTimeline.confidence_score >= 70 ? "border-emerald-500/30 text-emerald-400" :
                                                salaryTimeline.confidence_score >= 40 ? "border-amber-500/30 text-amber-400" :
                                                    "border-red-500/30 text-red-400"
                                        )}>
                                            {salaryTimeline.confidence_score || 0}% confident
                                        </Badge>
                                    </div>
                                    <ul className="space-y-2">
                                        {salaryTimeline.confidence_factors.map((factor: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                                <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                                                {factor}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Career Progression */}
                            {salaryTimeline.career_progression && salaryTimeline.career_progression.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                                        Salary Progression
                                    </h4>
                                    <div className="space-y-3">
                                        {salaryTimeline.career_progression.map((role: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                                                <div>
                                                    <p className="font-medium text-white">{role.title}</p>
                                                    <p className="text-sm text-zinc-400">{role.company}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-emerald-400">₹{role.estimated_ctc}L</p>
                                                    <p className="text-xs text-zinc-500">{role.year}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Digital Footprint Tab */}
                    {activeTab === "footprint" && (
                        <div className="space-y-6">
                            {/* Overall Assessment */}
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 text-center">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-3">
                                        <Globe className="w-7 h-7 text-pink-400" />
                                    </div>
                                    <p className="text-3xl font-bold text-white">
                                        {professionalFootprint.overall_footprint_assessment?.digital_presence_score || 0}
                                    </p>
                                    <p className="text-sm text-zinc-400">Presence Score</p>
                                    <Badge className="mt-2" variant="outline">
                                        {professionalFootprint.overall_footprint_assessment?.presence_level || "Unknown"}
                                    </Badge>
                                </div>

                                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 text-center">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-3">
                                        <Shield className="w-7 h-7 text-blue-400" />
                                    </div>
                                    <p className="text-3xl font-bold text-white">
                                        {professionalFootprint.identity_verification?.overall_confidence || 0}%
                                    </p>
                                    <p className="text-sm text-zinc-400">Identity Confidence</p>
                                </div>

                                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5 text-center">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center mx-auto mb-3">
                                        <FileText className="w-7 h-7 text-emerald-400" />
                                    </div>
                                    <p className="text-3xl font-bold text-white">
                                        {professionalFootprint.evidence_found?.length || 0}
                                    </p>
                                    <p className="text-sm text-zinc-400">Evidence Items</p>
                                </div>
                            </div>

                            {/* Verified Profiles */}
                            {professionalFootprint.verified_profiles && professionalFootprint.verified_profiles.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        Verified Profiles
                                    </h4>
                                    <div className="grid md:grid-cols-2 gap-3">
                                        {professionalFootprint.verified_profiles.map((profile: any, i: number) => (

                                            <div a key={i}
                                                href={profile.url || "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                    {profile.platform === "github" ? <Github className="w-5 h-5 text-emerald-400" /> :
                                                        profile.platform === "linkedin" ? <Linkedin className="w-5 h-5 text-emerald-400" /> :
                                                            <Globe className="w-5 h-5 text-emerald-400" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-white capitalize">{profile.platform || "Profile"}</p>
                                                    <p className="text-xs text-zinc-400 truncate">{profile.username || profile.url}</p>
                                                </div>
                                                <ExternalLink className="w-4 h-4 text-zinc-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notable Findings */}
                            {professionalFootprint.overall_footprint_assessment?.notable_findings && (
                                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                    <h4 className="font-semibold text-white mb-4">Notable Findings</h4>
                                    <ul className="space-y-2">
                                        {professionalFootprint.overall_footprint_assessment.notable_findings.map((finding: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                                {finding}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recommendation Tab */}
                    {activeTab === "recommendation" && (
                        <div className="space-y-6">
                            {/* Main Recommendation */}
                            <div className={cn(
                                "rounded-2xl border p-6",
                                matchAnalysis.hiring_recommendation?.action === "Proceed" || matchAnalysis.hiring_recommendation?.action === "Hire"
                                    ? "bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20"
                                    : matchAnalysis.hiring_recommendation?.action === "Pass" || matchAnalysis.hiring_recommendation?.action === "No Hire"
                                        ? "bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20"
                                        : "bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20"
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                                        matchAnalysis.hiring_recommendation?.action === "Proceed" || matchAnalysis.hiring_recommendation?.action === "Hire"
                                            ? "bg-emerald-500/20"
                                            : matchAnalysis.hiring_recommendation?.action === "Pass"
                                                ? "bg-red-500/20"
                                                : "bg-amber-500/20"
                                    )}>
                                        {matchAnalysis.hiring_recommendation?.action === "Proceed" || matchAnalysis.hiring_recommendation?.action === "Hire" ? (
                                            <Rocket className="w-7 h-7 text-emerald-400" />
                                        ) : matchAnalysis.hiring_recommendation?.action === "Pass" ? (
                                            <Ban className="w-7 h-7 text-red-400" />
                                        ) : (
                                            <AlertCircle className="w-7 h-7 text-amber-400" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className={cn(
                                            "text-xl font-bold",
                                            matchAnalysis.hiring_recommendation?.action === "Proceed" || matchAnalysis.hiring_recommendation?.action === "Hire"
                                                ? "text-emerald-400"
                                                : matchAnalysis.hiring_recommendation?.action === "Pass"
                                                    ? "text-red-400"
                                                    : "text-amber-400"
                                        )}>
                                            {matchAnalysis.hiring_recommendation?.action === "Proceed" ? "Recommended to Proceed" :
                                                matchAnalysis.hiring_recommendation?.action === "Hire" ? "Strong Hire" :
                                                    matchAnalysis.hiring_recommendation?.action === "Pass" ? "Not Recommended" :
                                                        matchAnalysis.hiring_recommendation?.action || "Review Needed"}
                                        </h3>
                                        <p className="text-zinc-300 mt-2 leading-relaxed">
                                            {matchAnalysis.hiring_recommendation?.reasoning ||
                                                "Review the analysis details to make your decision."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Response Likelihood */}
                            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-5">
                                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-400" />
                                    Response Likelihood
                                </h4>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                responseLikelihood.overall_score >= 70 ? "bg-emerald-500" :
                                                    responseLikelihood.overall_score >= 40 ? "bg-amber-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${responseLikelihood.overall_score || 50}%` }}
                                        />
                                    </div>
                                    <span className="text-lg font-bold text-white">
                                        {responseLikelihood.overall_score || 50}%
                                    </span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {responseLikelihood.likelihood_label || "Unknown"}
                                </Badge>

                                {/* FIX: Properly handle recommended_approach object */}
                                {responseLikelihood.recommended_approach && (
                                    <div className="mt-4 space-y-2">
                                        {/* Show summary if it exists */}
                                        {typeof responseLikelihood.recommended_approach === 'string' ? (
                                            <p className="text-sm text-zinc-400">
                                                {responseLikelihood.recommended_approach}
                                            </p>
                                        ) : (
                                            <>
                                                {responseLikelihood.recommended_approach.summary && (
                                                    <p className="text-sm text-zinc-400">
                                                        {responseLikelihood.recommended_approach.summary}
                                                    </p>
                                                )}

                                                {/* Show reasoning if available */}
                                                {responseLikelihood.recommended_approach.reasoning && (
                                                    <p className="text-sm text-zinc-500 italic">
                                                        {responseLikelihood.recommended_approach.reasoning}
                                                    </p>
                                                )}

                                                {/* Show primary channel */}
                                                {responseLikelihood.recommended_approach.primary_channel && (
                                                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-2">
                                                        <Mail className="w-3.5 h-3.5" />
                                                        <span>
                                                            Best approach: <span className="text-zinc-300 font-medium">
                                                                {responseLikelihood.recommended_approach.primary_channel}
                                                            </span>
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Show personalization hooks if available */}
                                                {responseLikelihood.recommended_approach.personalization_hooks &&
                                                    responseLikelihood.recommended_approach.personalization_hooks.length > 0 && (
                                                        <div className="mt-3 p-3 bg-violet-500/5 rounded-lg border border-violet-500/20">
                                                            <p className="text-xs text-violet-300 font-medium mb-2">
                                                                💡 Personalization Tips:
                                                            </p>
                                                            <ul className="space-y-1">
                                                                {responseLikelihood.recommended_approach.personalization_hooks.slice(0, 3).map((hook: string, i: number) => (
                                                                    <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                                                                        <span className="text-violet-400 mt-0.5">•</span>
                                                                        <span>{hook}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl border border-violet-500/20 p-5">
                                <h4 className="font-semibold text-white mb-3">Ready to proceed?</h4>
                                <p className="text-sm text-zinc-400 mb-4">
                                    Based on the analysis, you can now reach out to this candidate.
                                </p>
                                <div className="flex gap-3">
                                    <Button className="bg-violet-600 hover:bg-violet-500 text-white">
                                        <Mail className="w-4 h-4 mr-2" />
                                        Compose Outreach Email
                                    </Button>
                                    <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                                        <Download className="w-4 h-4 mr-2" />
                                        Export Report
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div >
    );
};

// ============================================================================
// GMAIL-STYLE EMAIL COMPOSER
// ============================================================================

interface GmailEmailComposerProps {
    isOpen: boolean;
    onClose: () => void;
    pipelineId: string;
    candidateName: string;
    candidateEmail: string;
    existingEmail?: any; // From outreach.emails[0]
    onSend: (subject: string, body: string) => Promise<void>;
}

const GmailEmailComposer = ({
    isOpen,
    onClose,
    pipelineId,
    candidateName,
    candidateEmail,
    existingEmail,
    onSend
}: GmailEmailComposerProps) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [mode, setMode] = useState<"preview" | "edit">("preview");
    const [tone, setTone] = useState("professional");
    const [isMinimized, setIsMinimized] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Email fields
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [bodyPlain, setBodyPlain] = useState("");

    const firstName = candidateName.split(" ")[0];

    useEffect(() => {
        if (isOpen) {
            if (existingEmail) {
                // Load existing email from outreach
                setSubject(existingEmail.subject || "");
                setBodyHtml(existingEmail.body_html || "");
                setBodyPlain(existingEmail.body_plain || "");
                setLoading(false);

                // Check if email was already sent
                if (existingEmail.sent_at || existingEmail.status === 'sent') {
                    console.log("Email already sent, skipping preview generation");
                    return; // Don't call loadPreview
                }
            } else {
                loadPreview();
            }
        }
    }, [isOpen, existingEmail]);

    const loadPreview = async () => {
        setLoading(true);
        try {
            // First call - gets or generates draft
            const res = await fetch(
                `${API_BASE}/pipeline/${pipelineId}/email-preview?tone=${tone}`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            const data = await res.json();
            if (data.success && data.preview) {
                setSubject(data.preview.subject || "");
                setBodyHtml(data.preview.body_html || "");
                setBodyPlain(data.preview.body_plain || data.preview.body || "");

                // Show cache indicator if from cache
                if (data.preview.from_cache) {
                    console.log("📧 Using cached draft");
                }
            }
        } catch (err) {
            console.error("Failed to load email preview:", err);
        } finally {
            setLoading(false);
        }
    };


    // Update regenerate to force new generation
    const regenerate = async () => {
        setRegenerating(true);
        try {
            const res = await fetch(
                `${API_BASE}/pipeline/${pipelineId}/email-preview?tone=${tone}&regenerate=true`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            const data = await res.json();
            if (data.success && data.preview) {
                setSubject(data.preview.subject || "");
                setBodyHtml(data.preview.body_html || "");
                setBodyPlain(data.preview.body_plain || data.preview.body || "");
            }
        } catch (err) {
            console.error("Failed to regenerate:", err);
        } finally {
            setRegenerating(false);
        }
    };


    const handleSend = async () => {
        setSending(true);
        try {
            // Check if user edited anything
            const hasEdits = mode === "edit";

            const res = await fetch(`${API_BASE}/pipeline/${pipelineId}/send-email`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    subject: hasEdits ? subject : null,  // Only send if edited
                    body: hasEdits ? bodyPlain : null,   // Only send if edited
                    use_draft: !hasEdits                 // Use draft if not edited
                })
            });

            const data = await res.json();

            if (data.success) {
                console.log("✅ Email sent successfully!");

                // IMPORTANT: Close composer first
                onClose();

                // Then trigger parent refresh via onSend callback
                // This will reload the flow and update the UI
                await onSend(subject, bodyPlain);
            } else {
                console.error("Failed to send:", data);
                alert(data.message || "Failed to send email");
            }
        } catch (err) {
            console.error("Failed to send:", err);
            alert("Failed to send email. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(bodyPlain);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const wordCount = bodyPlain.split(/\s+/).filter(Boolean).length;

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Composer Modal */}
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    width: isFullscreen ? "100%" : isMinimized ? "400px" : "700px",
                    height: isFullscreen ? "100%" : isMinimized ? "auto" : "auto",
                }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={cn(
                    "fixed z-50 bg-zinc-900 border border-zinc-700 shadow-2xl flex flex-col overflow-hidden",
                    isFullscreen
                        ? "inset-0 rounded-none"
                        : isMinimized
                            ? "bottom-0 right-6 rounded-t-xl max-h-12"
                            : "bottom-6 right-6 rounded-xl max-h-[85vh]"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Gmail Style */}
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/80 border-b border-zinc-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">
                                {isMinimized ? `To: ${firstName}` : "New Message"}
                            </h3>
                            {!isMinimized && (
                                <p className="text-xs text-zinc-400">Compose your outreach email</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-400 hover:text-white"
                                        onClick={() => setIsMinimized(!isMinimized)}
                                    >
                                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{isMinimized ? "Expand" : "Minimize"}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-400 hover:text-white"
                                        onClick={() => setIsFullscreen(!isFullscreen)}
                                    >
                                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-white"
                            onClick={onClose}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* To & Subject Fields */}
                        <div className="border-b border-zinc-800">
                            {/* To Field */}
                            <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/50">
                                <span className="text-sm text-zinc-500 w-16">To</span>
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                            <span className="text-xs font-medium text-white">{firstName.charAt(0)}</span>
                                        </div>
                                        <span className="text-sm text-white">{candidateName}</span>
                                        <span className="text-xs text-zinc-400">&lt;{candidateEmail}&gt;</span>
                                    </div>
                                </div>
                            </div>

                            {/* Subject Field */}
                            <div className="flex items-center gap-3 px-4 py-2">
                                <span className="text-sm text-zinc-500 w-16">Subject</span>
                                {mode === "edit" ? (
                                    <Input
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="flex-1 h-8 bg-transparent border-0 p-0 focus-visible:ring-0 text-white placeholder:text-zinc-500"
                                        placeholder="Enter subject..."
                                    />
                                ) : (
                                    <span className="text-sm text-white flex-1">{subject || "No subject"}</span>
                                )}
                            </div>
                        </div>

                        {/* Mode Toggle & Controls */}
                        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setMode("preview")}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                            mode === "preview"
                                                ? "bg-violet-500 text-white"
                                                : "text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        <Eye className="w-3.5 h-3.5 inline mr-1.5" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => setMode("edit")}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                            mode === "edit"
                                                ? "bg-violet-500 text-white"
                                                : "text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />
                                        Edit
                                    </button>
                                </div>

                                <Separator orientation="vertical" className="h-6 bg-zinc-700" />

                                <span className={cn(
                                    "text-xs",
                                    wordCount > 150 ? "text-amber-400" : "text-zinc-500"
                                )}>
                                    {wordCount} words
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Select value={tone} onValueChange={setTone}>
                                    <SelectTrigger className="w-28 h-8 text-xs bg-zinc-800 border-zinc-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-700">
                                        <SelectItem value="professional">Professional</SelectItem>
                                        <SelectItem value="friendly">Friendly</SelectItem>
                                        <SelectItem value="casual">Casual</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={regenerate}
                                    disabled={regenerating}
                                    className="h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                                >
                                    {regenerating ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                    ) : (
                                        <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Regenerate
                                </Button>
                            </div>
                        </div>

                        {/* Email Body */}
                        <ScrollArea className="flex-1 min-h-0">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-3" />
                                        <p className="text-sm text-zinc-400">Generating personalized email...</p>
                                    </div>
                                </div>
                            ) : mode === "preview" ? (
                                /* Gmail-like Preview */
                                <div className="p-6">
                                    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-xl mx-auto">
                                        {/* Email Header */}
                                        <div className="bg-gradient-to-r from-zinc-100 to-zinc-50 px-6 py-4 border-b border-zinc-200">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                                                    N
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-zinc-900">NeuraLeap</span>
                                                        <span className="text-xs text-zinc-400">Just now</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-500">to {firstName}</p>
                                                </div>
                                            </div>
                                            <h2 className="font-semibold text-zinc-800 mt-3">{subject}</h2>
                                        </div>

                                        {/* Email Body - Rendered HTML */}
                                        <div className="px-6 py-5">
                                            {bodyHtml ? (
                                                <div
                                                    className="prose prose-sm max-w-none text-zinc-700"
                                                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                                                />
                                            ) : (
                                                <div className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
                                                    {bodyPlain}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview Actions */}
                                    <div className="flex items-center justify-center gap-3 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={copyToClipboard}
                                            className="text-xs border-zinc-700 text-zinc-300"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                                                    Copy text
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                /* Edit Mode */
                                <div className="p-4">
                                    <Textarea
                                        value={bodyPlain}
                                        onChange={(e) => setBodyPlain(e.target.value)}
                                        className="min-h-[300px] bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
                                        placeholder="Write your message..."
                                    />

                                    {/* Tips */}
                                    <div className="mt-4 bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                                        <h4 className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-2">
                                            <Lightbulb className="w-4 h-4" />
                                            Tips for better responses
                                        </h4>
                                        <ul className="space-y-1 text-xs text-amber-200/80">
                                            <li className="flex items-center gap-2">
                                                <Check className="w-3 h-3" />
                                                Keep subject line under 50 characters
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-3 h-3" />
                                                Mention something specific from their background
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-3 h-3" />
                                                Keep total email under 150 words
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <Check className="w-3 h-3" />
                                                End with a clear call-to-action
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>

                        {/* Footer Actions - Gmail Style */}
                        <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white">
                                                    <Paperclip className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Attach file</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white">
                                                    <Link className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Insert link</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white">
                                                    <Smile className="w-4 h-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Insert emoji</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={onClose}
                                        className="text-zinc-400 hover:text-white"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Discard
                                    </Button>
                                    <Button
                                        onClick={handleSend}
                                        disabled={sending || !subject || !bodyPlain}
                                        className="bg-blue-600 hover:bg-blue-500 text-white min-w-32"
                                    >
                                        {sending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                Send
                                                <Send className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>
        </>
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
        pending: "bg-zinc-800 border-zinc-700 text-zinc-500",
        in_progress: "bg-blue-500/10 border-blue-500/50 text-blue-400 animate-pulse",
        completed: "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20",
        ready: "bg-gradient-to-br from-amber-500 to-orange-500 border-amber-400 text-white shadow-lg shadow-amber-500/20",
        failed: "bg-red-500/10 border-red-500/50 text-red-400"
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
        decision: "award",
        sourced: "search"
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
                        ? "bg-gradient-to-b from-emerald-500 to-emerald-800"
                        : "bg-zinc-800"
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
                            "rounded-2xl border transition-all overflow-hidden backdrop-blur-sm",
                            step.status === "completed"
                                ? "bg-zinc-900/50 border-zinc-700 hover:border-zinc-600"
                                : step.status === "in_progress"
                                    ? "bg-blue-500/5 border-blue-500/30"
                                    : step.status === "ready"
                                        ? "bg-amber-500/5 border-amber-500/30"
                                        : step.status === "failed"
                                            ? "bg-red-500/5 border-red-500/30"
                                            : "bg-zinc-900/30 border-zinc-800",
                            canExpand && "cursor-pointer"
                        )}
                        whileHover={canExpand ? { scale: 1.002 } : {}}
                        onClick={canExpand ? onToggle : undefined}
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-5 flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className={cn(
                                            "font-semibold truncate",
                                            step.status === "pending" ? "text-zinc-500" : "text-white"
                                        )}>
                                            {step.name}
                                        </h3>
                                    </div>

                                    {step.summary && (
                                        <p className="text-sm text-zinc-400 mt-0.5 truncate">
                                            {step.summary}
                                        </p>
                                    )}

                                    {step.duration_estimate && step.status === "pending" && (
                                        <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {step.duration_estimate}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {step.completed_at && (
                                    <span className="text-xs text-zinc-500 font-mono hidden sm:block">
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
                                        step.status === "completed" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                                        step.status === "in_progress" && "bg-blue-500/10 border-blue-500/30 text-blue-400 animate-pulse",
                                        step.status === "ready" && "bg-amber-500/10 border-amber-500/30 text-amber-400",
                                        step.status === "failed" && "bg-red-500/10 border-red-500/30 text-red-400",
                                        step.status === "pending" && "bg-zinc-800 border-zinc-700 text-zinc-500"
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
                                        <ChevronDown className="w-5 h-5 text-zinc-500" />
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
                                            ? "bg-violet-600 hover:bg-violet-500 text-white"
                                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
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
                            <div className="mx-4 sm:mx-5 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-300">
                                            {step.blocker}
                                        </p>
                                        {step.action_needed === "manual_email" && onAction && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => { e.stopPropagation(); onAction(); }}
                                                className="mt-2 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
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
                                    <div className="border-t border-zinc-800 p-4 sm:p-6">
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

// ============================================================================
// OUTREACH EXPANDED CONTENT
// ============================================================================

const OutreachExpandedContent = ({
    data,
    onComposeEmail,
    hasEmail,
    existingEmail
}: {
    data: any;
    onComposeEmail: () => void;
    hasEmail: boolean;
    existingEmail?: any;
}) => {
    if (!hasEmail) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-amber-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">
                    Email Not Found
                </h4>
                <p className="text-sm text-zinc-400 max-w-md mx-auto mb-4">
                    We could not find this candidate&apos;s email automatically.
                    You can add it manually to send an outreach email.
                </p>
            </div>
        );
    }

    if (!data?.sent_at && !existingEmail?.sent_at) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-violet-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">
                    Ready to Reach Out
                </h4>
                <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
                    We have their email address. Compose a personalized email to grab their attention.
                </p>
                <Button
                    onClick={onComposeEmail}
                    className="bg-violet-600 hover:bg-violet-500 text-white"
                >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Compose Email
                </Button>
            </div>
        );
    }

    // Email has been sent - show engagement tracker
    const emailData = existingEmail || data;
    const engagementSteps = [
        {
            id: "sent",
            label: "Sent",
            icon: Send,
            active: true,
            time: emailData.sent_at
        },
        {
            id: "delivered",
            label: "Delivered",
            icon: CheckCircle2,
            active: true,
            time: emailData.sent_at
        },
        {
            id: "opened",
            label: `Opened${(data?.open_count || 0) > 1 ? ` (${data.open_count}x)` : ''}`,
            icon: Eye,
            active: data?.total_opens > 0 || data?.opened,
            time: data?.first_opened_at
        },
        {
            id: "clicked",
            label: "Link Clicked",
            icon: MousePointer,
            active: data?.total_clicks > 0 || data?.clicked,
            time: data?.first_clicked_at
        },
        {
            id: "responded",
            label: "Scheduled",
            icon: Calendar,
            active: data?.candidate_responded,
            time: data?.response_received_at
        }
    ];

    return (
        <div className="space-y-6">
            {/* Engagement Tracker */}
            <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
                <h4 className="text-sm font-medium text-zinc-400 mb-4">Email Engagement</h4>
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
                                                : "bg-zinc-700 text-zinc-500"
                                        )}
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: step.active ? 1 : 0.9 }}
                                    >
                                        <Icon className="w-5 h-5" />
                                    </motion.div>
                                    <span className={cn(
                                        "text-xs font-medium text-center",
                                        step.active ? "text-zinc-200" : "text-zinc-500"
                                    )}>
                                        {step.label}
                                    </span>
                                    {step.time && (
                                        <span className="text-[10px] text-zinc-500">
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
                                                ? "bg-gradient-to-r from-emerald-500 to-zinc-700"
                                                : "bg-zinc-700"
                                    )} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>{/* Email Preview */}
            {emailData.subject && (
                <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                    N
                                </div>
                                <div>
                                    <div className="font-medium text-zinc-900">NeuraLeap</div>
                                    <div className="text-xs text-zinc-500">to {data?.email_address}</div>
                                </div>
                            </div>
                            <div className="text-xs text-zinc-400">
                                {emailData.sent_at && new Date(emailData.sent_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                        </div>
                        <div className="font-semibold text-zinc-800">
                            {emailData.subject}
                        </div>
                    </div>
                    <div className="p-5 max-h-64 overflow-y-auto">
                        {emailData.body_html ? (
                            <div
                                className="text-sm text-zinc-600 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: emailData.body_html }}
                            />
                        ) : (
                            <div className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
                                {emailData.body_plain || emailData.body || "Email content preview not available"}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* View/Edit Button */}
            <div className="flex justify-center">
                <Button
                    variant="outline"
                    onClick={onComposeEmail}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                    <Eye className="w-4 h-4 mr-2" />
                    View Full Email
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
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
        <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                {/* Top Row */}
                <div className="flex items-center gap-4 py-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0 text-zinc-400 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>

                    {/* Candidate Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {candidate.profile_picture_url ? (
                            <img
                                src={candidate.profile_picture_url}
                                alt={candidate.name}
                                className="w-10 h-10 rounded-full object-cover border border-zinc-700 shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                                {candidate.name?.charAt(0)}
                            </div>
                        )}
                        <div className="min-w-0">
                            <h1 className="font-semibold text-white truncate">
                                {candidate.name}
                            </h1>
                            <p className="text-xs text-zinc-400 truncate">
                                {job.title || job.job_title}
                            </p>
                        </div>
                    </div>

                    {/* Progress Pill */}
                    <div className="hidden sm:flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5 shrink-0">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            percentage === 100 ? "bg-emerald-500" : "bg-violet-500"
                        )} />
                        <span className="text-xs font-medium text-zinc-300">
                            {completed}/{total} steps
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="pb-3">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                            className={cn(
                                "h-full rounded-full",
                                percentage === 100 ? "bg-emerald-500" : "bg-violet-500"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>
            </div>
        </header>
    );
}

// ============================================================================
// MANUAL EMAIL DIALOG
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
            <DialogContent className="max-w-md bg-zinc-900 border-zinc-700">
                <DialogHeader>
                    <div className="mb-4">
                        <Donna
                            message={`No problem! If you have ${candidateName.split(" ")[0]}'s email from LinkedIn or another source, just add it here.`}
                            mood="helpful"
                            size="sm"
                        />
                    </div>
                    <DialogTitle className="text-white">Add Contact Information</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        We could not find this candidate&apos;s email automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="email" className="text-zinc-300">Email Address <span className="text-red-400">*</span></Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(""); }}
                            placeholder="candidate@example.com"
                            className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
                        />
                        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                    </div>

                    <div>
                        <Label htmlFor="phone" className="text-zinc-300">Phone <span className="text-zinc-500">(optional)</span></Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !email}
                        className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        Save and Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
    const [showEmailComposer, setShowEmailComposer] = useState(false);
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
        try {
            await loadFlow(); // Refresh the entire flow to get updated state
        } catch (err) {
            console.error("Failed to refresh flow:", err);
        }
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
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Donna
                        message="Getting everything ready for you..."
                        mood="thinking"
                        size="lg"
                    />
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mt-6" />
                </div>
            </div>
        );
    }

    // Error state
    if (error || !flow) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-zinc-900 border-zinc-800">
                    <CardContent className="p-8 text-center">
                        <Donna
                            message="Oops! Something went wrong. Let me help you get back on track."
                            mood="concerned"
                            size="lg"
                        />
                        <p className="text-sm text-zinc-400 mt-4 mb-6">{error || "Could not load"}</p>
                        <Button
                            onClick={() => router.push(`/pipeline/${sessionId}`)}
                            variant="outline"
                            className="border-zinc-700 text-zinc-300"
                        >
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

    // Get outreach data from the flow
    const outreachPhase = steps.find((s: any) => s.id === "outreach");
    const candidateEmail = outreachPhase?.data?.email_address || candidate.email || "";
    const existingEmail = outreachPhase?.data?.emails?.[0] || null;

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
                if (step.status === "ready") return { action: () => setShowEmailComposer(true), label: "Compose Email" };
                break;
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-zinc-950">
            {/* Header */}
            <ProgressHeader
                completed={completedCount}
                total={steps.length}
                currentStep={flow?.current_stage}
                candidate={candidate}
                job={job}
                onBack={() => router.push(`/pipeline/${sessionId}`)}
            />

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                {/* Donna Welcome */}
                <div className="mb-8">
                    <Donna
                        message={
                            completedCount === 0
                                ? "Ready to start! Click 'Start Analysis' to begin evaluating this candidate."
                                : completedCount === steps.length
                                    ? "Amazing work! You have completed the hiring journey for this candidate."
                                    : `Making progress! ${steps.length - completedCount} steps to go.`
                        }
                        mood={completedCount === steps.length ? "excited" : "helpful"}
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
                                {/* Enrichment Deep Dive */}
                                {step.id === "enrichment" && step.data && (
                                    <EnrichmentDeepDive
                                        data={step.data}
                                        candidateName={candidate.name || "Candidate"}
                                    />
                                )}

                                {/* Outreach */}
                                {step.id === "outreach" && (
                                    <OutreachExpandedContent
                                        data={step.data}
                                        onComposeEmail={() => setShowEmailComposer(true)}
                                        hasEmail={!!candidateEmail}
                                        existingEmail={existingEmail}
                                    />
                                )}
                            </TimelinePhase>
                        );
                    })}
                </div>
            </main>

            {/* Gmail-style Email Composer */}
            <AnimatePresence>
                {showEmailComposer && (
                    <GmailEmailComposer
                        isOpen={showEmailComposer}
                        onClose={() => setShowEmailComposer(false)}
                        pipelineId={pipelineId}
                        candidateName={candidate.name || ""}
                        candidateEmail={candidateEmail}
                        existingEmail={existingEmail}
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