/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    Search,
    Sparkles,
    Loader2,
    User,
    Briefcase,
    MapPin,
    TrendingUp,
    Clock,
    CheckCircle,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    DollarSign,
    BarChart2,
    Award,
    MessageSquare,
    Target,
    Zap,
    Brain,
    ChevronRight,
    ChevronDown,
    ArrowLeft,
    Upload,
    FileText,
    FileCheck,
    X,
    Linkedin,
    Globe,
    Database,
    Share2,
    Download,
    Copy,
    Check,
    Link2,
    History,
    Trash2,
    Eye,
    Calendar,
    Building2,
    GraduationCap,
    Code,
    Users,
    ArrowUpRight,
    Info,
    AlertTriangle,
    CircleDot,
    Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import type { DeepDiveResult, DeepDiveApiResponse, HistoryItem, ExperienceItem } from "@/types/deep-dive";
import {
    getMatchScore,
    getMatchColor,
    getMatchBgColor,
    getHiringRecommendation,
    getStrengths,
    getConcerns,
    getGaps,
    normalizeMatchItems,
    isValidResult,
    getCurrentCTC,
    getResponseScore,
    getNoticePeriod,
    getExperienceYears,
} from "@/utils/deep-dive-helpers";

// ============================================================================
// SUBTLE ANIMATED BACKGROUND
// ============================================================================

function SubtleBackground() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {/* Clean gradient base */}
            <div className="absolute inset-0 bg-[#0a0a0b]" />

            {/* Subtle radial gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />

            {/* Very subtle grid */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `linear-gradient(to right, rgb(255 255 255) 1px, transparent 1px),
                                     linear-gradient(to bottom, rgb(255 255 255) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }}
            />

            {/* Noise texture overlay */}
            <div
                className="absolute inset-0 opacity-[0.015]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
                }}
            />
        </div>
    );
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function LoadingSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-white/5 rounded-lg" />
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-white/5 rounded-xl" />
                ))}
            </div>
            <div className="h-64 bg-white/5 rounded-xl" />
        </div>
    );
}

// ============================================================================
// PROCESSING STAGES COMPONENT
// ============================================================================

function ProcessingStages({ currentStage }: { currentStage: string }) {
    const stages = [
        { id: "jd", label: "Analyzing job requirements", icon: FileText },
        { id: "data", label: "Fetching candidate data", icon: Database },
        { id: "classify", label: "Classifying experience", icon: Briefcase },
        { id: "skills", label: "Validating skills", icon: Code },
        { id: "salary", label: "Estimating compensation", icon: DollarSign },
        { id: "response", label: "Calculating response likelihood", icon: MessageSquare },
        { id: "match", label: "Synthesizing insights", icon: Brain },
    ];

    const currentIndex = stages.findIndex(s =>
        currentStage.toLowerCase().includes(s.label.split(" ")[0].toLowerCase())
    );

    return (
        <div className="max-w-lg mx-auto py-12">
            {/* Central spinner */}
            <div className="flex justify-center mb-10">
                <div className="relative">
                    <motion.div
                        className="w-16 h-16 rounded-full border-2 border-white/10"
                        style={{ borderTopColor: 'rgb(139 92 246)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-violet-400" />
                    </div>
                </div>
            </div>

            {/* Stage list */}
            <div className="space-y-2">
                {stages.map((stage, index) => {
                    const Icon = stage.icon;
                    const isComplete = index < currentIndex;
                    const isActive = index === currentIndex;
                    const isPending = index > currentIndex;

                    return (
                        <motion.div
                            key={stage.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300
                                ${isActive ? 'bg-violet-500/10 border border-violet-500/20' : ''}
                                ${isComplete ? 'opacity-60' : ''}
                                ${isPending ? 'opacity-30' : ''}
                            `}
                        >
                            <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                ${isComplete ? 'bg-emerald-500/20' : ''}
                                ${isActive ? 'bg-violet-500/20' : ''}
                                ${isPending ? 'bg-white/5' : ''}
                            `}>
                                {isComplete ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : isActive ? (
                                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                                ) : (
                                    <Icon className="w-4 h-4 text-white/40" />
                                )}
                            </div>
                            <span className={`
                                text-sm font-medium
                                ${isComplete ? 'text-white/60' : ''}
                                ${isActive ? 'text-white' : ''}
                                ${isPending ? 'text-white/30' : ''}
                            `}>
                                {stage.label}
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ElementType;
    color: 'violet' | 'emerald' | 'amber' | 'blue' | 'rose' | 'slate';
    tooltip?: string;
}

function MetricCard({ label, value, subValue, icon: Icon, color, tooltip }: MetricCardProps) {
    const colorClasses = {
        violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        slate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    };

    const iconColorClasses = {
        violet: 'text-violet-400',
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        blue: 'text-blue-400',
        rose: 'text-rose-400',
        slate: 'text-slate-400',
    };

    const content = (
        <div className={`p-4 rounded-xl border ${colorClasses[color]} transition-all hover:scale-[1.02]`}>
            <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</span>
                <Icon className={`w-4 h-4 ${iconColorClasses[color]}`} />
            </div>
            <div className="text-2xl font-semibold text-white">{value}</div>
            {subValue && <div className="text-xs text-white/40 mt-1">{subValue}</div>}
        </div>
    );

    if (tooltip) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent className="bg-slate-900 border-slate-700 text-white">
                        {tooltip}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return content;
}

// ============================================================================
// SECTION COMPONENT
// ============================================================================

interface SectionProps {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: React.ReactNode;
}

function Section({ title, icon: Icon, children, defaultOpen = true, badge }: SectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                <Icon className="w-4 h-4 text-white/60" />
                            </div>
                            <span className="font-medium text-white">{title}</span>
                            {badge}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-5 pb-5 pt-2">
                        {children}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

// ============================================================================
// EXPERIENCE TIMELINE COMPONENT
// ============================================================================

function ExperienceTimeline({ experiences }: { experiences: ExperienceItem[] }) {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'professional': return 'bg-emerald-500';
            case 'internship': return 'bg-blue-500';
            case 'freelance': return 'bg-amber-500';
            case 'student': return 'bg-violet-500';
            case 'volunteer': return 'bg-pink-500';
            default: return 'bg-slate-500';
        }
    };

    const getTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            professional: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            internship: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            freelance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            student: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
            volunteer: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
        };
        return colors[type] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    };

    return (
        <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10" />

            <div className="space-y-4">
                {experiences.map((exp, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative pl-8"
                    >
                        {/* Timeline dot */}
                        <div className={`absolute left-0 top-2 w-[22px] h-[22px] rounded-full border-2 border-[#0a0a0b] ${getTypeColor(exp.experience_type)}`} />

                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-medium text-white">{exp.title}</h4>
                                        <Badge className={`text-xs border ${getTypeBadge(exp.experience_type)}`}>
                                            {exp.experience_type}
                                        </Badge>
                                        {exp.counts_as_experience && (
                                            <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Counts
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-white/60 mt-1">{exp.company}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                                        {exp.duration && <span>{exp.duration}</span>}
                                        {exp.start_date && (
                                            <span>
                                                {exp.start_date} - {exp.end_date || 'Present'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {exp.duration_months > 0 && (
                                    <div className="text-right">
                                        <span className="text-lg font-semibold text-white">
                                            {Math.round(exp.duration_months / 12 * 10) / 10}
                                        </span>
                                        <span className="text-xs text-white/40 ml-1">yrs</span>
                                    </div>
                                )}
                            </div>
                            {exp.reasoning && (
                                <p className="text-xs text-white/30 mt-2 italic">{exp.reasoning}</p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// SHARE DIALOG COMPONENT
// ============================================================================

function ShareDialog({ resultId, candidateName }: { resultId: string; candidateName: string }) {
    const [copied, setCopied] = useState(false);
    const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/deep-dive/shared/${resultId}`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-white/10 hover:bg-white/5">
                    <Share2 className="w-4 h-4" />
                    Share
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111113] border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-white">Share Analysis</DialogTitle>
                    <DialogDescription className="text-white/60">
                        Share this deep dive analysis for {candidateName}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={shareUrl}
                            className="bg-white/5 border-white/10 text-white font-mono text-sm"
                        />
                        <Button
                            onClick={handleCopy}
                            className={`shrink-0 ${copied ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-500'}`}
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                    <p className="text-xs text-white/40">
                        This link will expire in 30 days. Anyone with the link can view this analysis.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ============================================================================
// HISTORY PANEL COMPONENT
// ============================================================================

function HistoryPanel({
    isOpen,
    onClose,
    onSelect
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (id: string) => void;
}) {
    const { token } = useAuth();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/my-results?limit=20`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setHistory(data.results);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/results/${id}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setHistory(prev => prev.filter(h => h.id !== id));
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#111113] border-l border-white/10 z-50 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <History className="w-5 h-5 text-white/60" />
                                <h2 className="font-semibold text-white">Analysis History</h2>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="text-white/60 hover:text-white">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
                                    ))}
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-12">
                                    <Database className="w-12 h-12 text-white/20 mx-auto mb-3" />
                                    <p className="text-white/40">No analysis history yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((item) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/10 cursor-pointer transition-all group"
                                            onClick={() => onSelect(item.id)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-white truncate">{item.candidate_name}</h4>
                                                    <p className="text-sm text-white/40 truncate mt-0.5">{item.headline}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`text-xs ${item.match_score >= 70 ? 'bg-emerald-500/10 text-emerald-400' :
                                                        item.match_score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                                                            'bg-slate-500/10 text-slate-400'
                                                        }`}>
                                                        {item.match_score}%
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400"
                                                        onClick={(e) => handleDelete(item.id, e)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Eye className="w-3 h-3" />
                                                    {item.view_count} views
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DeepDivePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { token, isAuthenticated } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [jdInputMode, setJdInputMode] = useState<"text" | "file">("text");
    const [isPreFilled, setIsPreFilled] = useState(false);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    // Results
    const [result, setResult] = useState<DeepDiveResult | null>(null);
    const [resultId, setResultId] = useState<string | null>(null);

    // Auth guard
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    // Load shared result if ID in URL
    useEffect(() => {
        const sharedId = searchParams.get('id');
        if (sharedId) {
            loadSharedResult(sharedId);
        }
    }, [searchParams]);

    //  Pre-fill from URL params
    useEffect(() => {
        const urlLinkedinUrl = searchParams.get('linkedin_url');
        const urlJd = searchParams.get('jd');
        const candidateName = searchParams.get('candidate_name');
        const fromSession = searchParams.get('from_session');

        // If we have LinkedIn URL, pre-fill it
        if (urlLinkedinUrl) {
            setLinkedinUrl(urlLinkedinUrl);
            setIsPreFilled(true);
        }

        // If JD is provided in URL, use it
        if (urlJd && urlJd.trim().length > 0) {
            setJobDescription(urlJd);
        }
        // Otherwise, if we have a session ID, fetch the JD from backend
        else if (fromSession && token) {
            fetchJobDescriptionFromSession(fromSession);
        }

        console.log(`Pre-filled data for ${candidateName || 'candidate'} from session ${fromSession || 'search'}`);
    }, [searchParams, token]);

    // New function to fetch JD from session
    const fetchJobDescriptionFromSession = async (sessionId: string) => {
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/conversation/${sessionId}/job-description`,
                {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                }
            );

            if (!res.ok) {
                console.error('Failed to fetch JD from session');
                return;
            }

            const data = await res.json();

            if (data.success && data.jd_text) {
                setJobDescription(data.jd_text);
                console.log(`✅ Loaded JD from session ${sessionId}`);
            } else {
                console.warn('No JD text found in session');
            }
        } catch (err) {
            console.error('Error fetching JD from session:', err);
        }
    };

    const loadSharedResult = async (id: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/results/${id}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Result not found');
                } else if (res.status === 410) {
                    throw new Error('Result has expired');
                } else {
                    throw new Error('Failed to load result');
                }
            }

            const data = await res.json();
            console.log('Loaded shared result:', data);

            // The backend returns { success, data, created_at, expires_at }
            if (data.success && data.data) {
                setResult(data.data);
                setResultId(id);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err: any) {
            console.error('Load error:', err);
            setError(err.message || 'Failed to load shared result');
        } finally {
            setIsLoading(false);
        }
    };


    // File handling
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
            if (!validTypes.includes(file.type)) {
                setError("Please upload a PDF, DOC, DOCX, or TXT file");
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError("File size must be less than 10MB");
                return;
            }
            setJdFile(file);
            setError(null);
        }
    };

    const readFileContent = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const isValidInput = linkedinUrl.includes("linkedin.com/in/") &&
        (jdInputMode === "text" ? jobDescription.length >= 50 : jdFile !== null);

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidInput) return;

        setIsLoading(true);
        setError(null);
        setResult(null);
        setResultId(null);

        let jdContent = jobDescription;
        if (jdInputMode === "file" && jdFile) {
            try {
                jdContent = await readFileContent(jdFile);
            } catch {
                setError("Failed to read file");
                setIsLoading(false);
                return;
            }
        }

        // Simulate stages
        const stages = ["Analyzing", "Fetching", "Classifying", "Validating", "Estimating", "Calculating", "Synthesizing"];
        let stageIdx = 0;
        const interval = setInterval(() => {
            if (stageIdx < stages.length) {
                setLoadingStage(stages[stageIdx]);
                stageIdx++;
            }
        }, 3000);

        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/analyze`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        linkedin_url: linkedinUrl,
                        job_description: jdContent,
                        force_scrape: false,
                    }),
                }
            );

            clearInterval(interval);

            if (!res.ok) {
                const errorData = await res.json();
                console.error("API Error:", errorData);
                throw new Error(errorData.detail || "Analysis failed");
            }

            const apiResponse: DeepDiveApiResponse = await res.json();

            console.log("=== API RESPONSE ===");
            console.log("Success:", apiResponse.success);
            console.log("Message:", apiResponse.message);
            console.log("Result ID:", apiResponse.result_id);
            console.log("Has data:", !!apiResponse.data);
            console.log("Has candidate:", !!apiResponse.data?.candidate);
            console.log("Has match_analysis:", !!apiResponse.data?.match_analysis);
            console.log("Match score:", apiResponse.data?.match_analysis?.overall_match_score);
            console.log("===================");

            if (!apiResponse.success) {
                throw new Error("API returned success=false");
            }

            if (!apiResponse.data) {
                throw new Error("No data in response");
            }

            // Validate minimum required data
            if (!apiResponse.data.candidate?.full_name) {
                throw new Error("Invalid candidate data");
            }

            setResult(apiResponse.data);
            setResultId(apiResponse.result_id || null);

        } catch (err: any) {
            console.error("Submit error:", err);
            setError(err.message || "Analysis failed");
        } finally {
            clearInterval(interval);
            setIsLoading(false);
            setLoadingStage("");
        }
    };


    // Export CSV
    const handleExportCSV = async () => {
        if (!resultId) return;

        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/export/${resultId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `deep_dive_${result?.candidate.full_name.replace(/\s+/g, '_')}_${resultId}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    // Match score color
    const getMatchColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-blue-400';
        if (score >= 40) return 'text-amber-400';
        return 'text-rose-400';
    };

    const getMatchBgColor = (score: number) => {
        if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5';
        if (score >= 60) return 'from-blue-500/20 to-blue-500/5';
        if (score >= 40) return 'from-amber-500/20 to-amber-500/5';
        return 'from-rose-500/20 to-rose-500/5';
    };

    const ResultsDisplay = () => {
        if (!result) return null;

        // Validate result has minimum required data
        if (!isValidResult(result)) {
            return (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 text-center rounded-xl border border-amber-500/20 bg-amber-500/10"
                >
                    <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Incomplete Analysis</h3>
                    <p className="text-white/60 mb-4">
                        The analysis completed but some required data is missing.
                    </p>
                    <details className="text-left text-xs text-white/40 mb-4">
                        <summary className="cursor-pointer hover:text-white/60">View Details</summary>
                        <pre className="mt-2 p-3 bg-black/20 rounded overflow-auto max-h-40">
                            {JSON.stringify({
                                hasCandidate: !!result.candidate,
                                candidateName: result.candidate?.full_name,
                                hasMatchAnalysis: !!result.match_analysis,
                                matchScore: result.match_analysis?.overall_match_score,
                                hasSkillValidation: !!result.skill_validation,
                                hasSalaryTimeline: !!result.salary_timeline,
                                hasResponseLikelihood: !!result.response_likelihood,
                                hasNoticePeriod: !!result.notice_period,
                            }, null, 2)}
                        </pre>
                    </details>
                    <Button
                        onClick={() => {
                            setResult(null);
                            setResultId(null);
                        }}
                        variant="outline"
                        className="border-amber-500/30 hover:bg-amber-500/20"
                    >
                        Try Again
                    </Button>
                </motion.div>
            );
        }

        const matchScore = getMatchScore(result);
        const strengths = normalizeMatchItems(result.match_analysis?.strengths || []);
        const concerns = normalizeMatchItems(result.match_analysis?.concerns || []);
        const gaps = normalizeMatchItems(result.match_analysis?.gaps || []);

        return (
            <motion.div
                key={resultId || 'result'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
            >
                {/* ============================================ */}
                {/* HEADER CARD */}
                {/* ============================================ */}
                <div className={`rounded-2xl border border-white/[0.06] bg-gradient-to-b ${getMatchBgColor(matchScore)} overflow-hidden`}>
                    <div className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                            {/* Candidate Info */}
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
                                    {result.candidate.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">{result.candidate.full_name}</h1>
                                    {result.candidate.headline && (
                                        <p className="text-white/60 mt-0.5">{result.candidate.headline}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2 text-sm text-white/40">
                                        {result.candidate.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {result.candidate.location}
                                            </span>
                                        )}
                                        {result.candidate.current_company && (
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                {result.candidate.current_company}
                                            </span>
                                        )}
                                    </div>
                                    {result.candidate.linkedin_url && (

                                        <a href={result.candidate.linkedin_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 mt-2"
                                        >
                                            <Linkedin className="w-3 h-3" />
                                            View Profile
                                            <ArrowUpRight className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {resultId && (
                                    <>
                                        <ShareDialog resultId={resultId} candidateName={result.candidate.full_name} />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExportCSV}
                                            className="gap-2 border-white/10 hover:bg-white/5"
                                        >
                                            <Download className="w-4 h-4" />
                                            Export
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Score Bar */}
                        <div className="mt-6 pt-6 border-t border-white/[0.06]">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center">
                                    <div className={`text-3xl font-bold ${getMatchColor(matchScore)}`}>
                                        {matchScore}%
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">Match Score</div>
                                </div>
                                <div className="text-center">
                                    {result.match_analysis?.hiring_recommendation ? (
                                        <>
                                            <Badge className={`text-sm py-1 px-3 ${result.match_analysis.hiring_recommendation.action.toLowerCase().includes('strong')
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                : result.match_analysis.hiring_recommendation.action.toLowerCase().includes('interview')
                                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                }`}>
                                                {getHiringRecommendation(result.match_analysis)}
                                            </Badge>
                                            <div className="text-xs text-white/40 mt-2">Recommendation</div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-white/40">No recommendation</div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-white">
                                        {getResponseScore(result)}%
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">Response Likelihood</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-white">
                                        {getExperienceYears(result)}
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">Years Experience</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Source Footer */}
                    <div className="px-6 py-3 bg-black/20 flex items-center justify-between text-xs text-white/40">
                        <div className="flex items-center gap-2">
                            {result.data_source.includes('brightdata') ? (
                                <><Linkedin className="w-3 h-3 text-[#0A66C2]" /> Fresh LinkedIn Data</>
                            ) : result.data_source.includes('database') ? (
                                <><Database className="w-3 h-3 text-emerald-400" /> From Database</>
                            ) : (
                                <><Globe className="w-3 h-3 text-violet-400" /> Web Search</>
                            )}
                        </div>
                        <span>Analyzed in {result.processing_time_seconds.toFixed(1)}s</span>
                    </div>
                </div>

                {/* ============================================ */}
                {/* METRICS GRID */}
                {/* ============================================ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                        label="Current CTC"
                        value={result.salary_timeline ? `₹${getCurrentCTC(result)}L` : 'N/A'}
                        subValue={result.salary_timeline ? `Range: ₹${result.salary_timeline.current_estimated_ctc.low}-${result.salary_timeline.current_estimated_ctc.high}L` : 'Not estimated'}
                        icon={DollarSign}
                        color="emerald"
                        tooltip="Estimated based on role, company, and market data"
                    />
                    <MetricCard
                        label="Skills Confidence"
                        value={result.skill_validation ? `${result.skill_validation.overall_confidence}%` : 'N/A'}
                        subValue={result.skill_validation ? `${result.skill_validation.validated_skills.length} validated` : 'Not validated'}
                        icon={Award}
                        color="violet"
                    />
                    <MetricCard
                        label="Notice Period"
                        value={result.notice_period ? `${getNoticePeriod(result)} days` : 'N/A'}
                        subValue={result.notice_period?.most_likely_start || 'Unknown'}
                        icon={Clock}
                        color="amber"
                    />
                    <MetricCard
                        label="Professional Roles"
                        value={result.candidate.experience_summary.professional_roles}
                        subValue={`${result.candidate.experience_summary.internships} internships`}
                        icon={Briefcase}
                        color="blue"
                    />
                </div>

                {/* ============================================ */}
                {/* MAIN SECTIONS */}
                {/* ============================================ */}
                {
                    result.match_analysis && (
                        <div className="space-y-4">
                            {/* ANALYSIS SUMMARY SECTION */}
                            <Section title="Analysis Summary" icon={Brain}>
                                <div className="space-y-4">
                                    {result.match_analysis.recruiter_summary?.one_liner && (
                                        <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                            <div className="flex items-start gap-3">
                                                <Sparkles className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                                                <p className="text-violet-300">{result.match_analysis.recruiter_summary.one_liner}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid md:grid-cols-3 gap-4">
                                        {/* Strengths */}
                                        <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                            <h4 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4" />
                                                Strengths
                                            </h4>
                                            <ul className="space-y-2">
                                                {strengths.length > 0 ? strengths.map((s, i) => (
                                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                        <CircleDot className="w-3 h-3 text-emerald-400 mt-1 shrink-0" />
                                                        <div>
                                                            <div>{s.text}</div>
                                                            {s.meta && <div className="text-xs text-emerald-400/60 mt-0.5">{s.meta}</div>}
                                                        </div>
                                                    </li>
                                                )) : (
                                                    <li className="text-sm text-white/40">No strengths identified</li>
                                                )}
                                            </ul>
                                        </div>

                                        {/* Concerns */}
                                        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                            <h4 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                Concerns
                                            </h4>
                                            <ul className="space-y-2">
                                                {concerns.length > 0 ? concerns.map((c, i) => (
                                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                        <Minus className="w-3 h-3 text-amber-400 mt-1 shrink-0" />
                                                        <div>
                                                            <div>{c.text}</div>
                                                            {c.meta && <div className="text-xs text-amber-400/60 mt-0.5">[{c.meta}]</div>}
                                                        </div>
                                                    </li>
                                                )) : (
                                                    <li className="text-sm text-white/40">No concerns identified</li>
                                                )}
                                            </ul>
                                        </div>

                                        {/* Gaps */}
                                        <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/10">
                                            <h4 className="text-sm font-medium text-rose-400 mb-3 flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4" />
                                                Gaps
                                            </h4>
                                            <ul className="space-y-2">
                                                {gaps.length > 0 ? gaps.map((g, i) => (
                                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                                        <X className="w-3 h-3 text-rose-400 mt-1 shrink-0" />
                                                        <div>
                                                            <div>{g.text}</div>
                                                            {g.meta && <div className="text-xs text-rose-400/60 mt-0.5">({g.meta})</div>}
                                                        </div>
                                                    </li>
                                                )) : (
                                                    <li className="text-sm text-white/40">No critical gaps identified</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Recommendation */}
                                    {result.match_analysis.hiring_recommendation && (
                                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                            <p className="text-sm text-white/60">{result.match_analysis.hiring_recommendation.reasoning}</p>
                                            {result.match_analysis.hiring_recommendation.alternative_suggestion && (
                                                <p className="text-sm text-violet-400 mt-2 flex items-start gap-2">
                                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                                    {result.match_analysis.hiring_recommendation.alternative_suggestion}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Section>

                            {/* EXPERIENCE SECTION */}
                            {result.candidate.experience && result.candidate.experience.length > 0 && (
                                <Section
                                    title="Experience Analysis"
                                    icon={Briefcase}
                                    badge={
                                        <Badge className="ml-2 text-xs bg-white/5 text-white/60">
                                            {result.candidate.experience_summary.total_roles} roles
                                        </Badge>
                                    }
                                >
                                    <div className="space-y-4">
                                        {/* Experience breakdown */}
                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                                                <div className="text-xl font-semibold text-emerald-400">
                                                    {result.candidate.experience_summary.professional_roles}
                                                </div>
                                                <div className="text-xs text-white/40">Professional</div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                                                <div className="text-xl font-semibold text-blue-400">
                                                    {result.candidate.experience_summary.internships}
                                                </div>
                                                <div className="text-xs text-white/40">Internships</div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-violet-500/10 text-center">
                                                <div className="text-xl font-semibold text-violet-400">
                                                    {result.candidate.experience_summary.other_activities}
                                                </div>
                                                <div className="text-xs text-white/40">Other</div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-white/5 text-center">
                                                <div className="text-xl font-semibold text-white">
                                                    {result.candidate.experience_summary.real_experience_years}
                                                </div>
                                                <div className="text-xs text-white/40">Real Years</div>
                                            </div>
                                        </div>

                                        {/* Timeline */}
                                        <ExperienceTimeline experiences={result.candidate.experience} />
                                    </div>
                                </Section>
                            )}

                            {/* SKILLS SECTION */}
                            {result.skill_validation && (
                                <Section
                                    title="Skill Validation"
                                    icon={Code}
                                    badge={
                                        <Badge className={`ml-2 text-xs ${result.skill_validation.overall_confidence >= 70
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                            {result.skill_validation.overall_confidence}% confidence
                                        </Badge>
                                    }
                                >
                                    <div className="space-y-4">
                                        {result.skill_validation.assessment && (
                                            <p className="text-sm text-white/60 p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                                                {result.skill_validation.assessment}
                                            </p>
                                        )}

                                        <div className="grid md:grid-cols-2 gap-4">
                                            {/* Validated Skills */}
                                            <div>
                                                <h4 className="text-sm font-medium text-emerald-400 mb-3">
                                                    ✓ Validated ({result.skill_validation.validated_skills.length})
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {result.skill_validation.validated_skills.length > 0 ? (
                                                        result.skill_validation.validated_skills.map((skill, i) => (
                                                            <Badge key={i} className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                                {skill}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm text-white/40">No validated skills</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Unvalidated Skills */}
                                            <div>
                                                <h4 className="text-sm font-medium text-white/40 mb-3">
                                                    ○ Unverified ({result.skill_validation.unvalidated_skills.length})
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {result.skill_validation.unvalidated_skills.length > 0 ? (
                                                        result.skill_validation.unvalidated_skills.map((skill, i) => (
                                                            <Badge key={i} variant="outline" className="text-white/40 border-white/10">
                                                                {skill}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm text-white/40">All skills validated</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Skill Gaps */}
                                        {result.skill_validation.skill_gaps && result.skill_validation.skill_gaps.critical_gaps && result.skill_validation.skill_gaps.critical_gaps.length > 0 && (
                                            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                                <h4 className="text-sm font-medium text-rose-400 mb-2">Critical Skill Gaps</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {result.skill_validation.skill_gaps.critical_gaps.map((gap, i) => (
                                                        <Badge key={i} className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                                                            {gap}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                {result.skill_validation.skill_gaps.gap_severity && (
                                                    <p className="text-xs text-rose-300 mt-2">
                                                        Severity: {result.skill_validation.skill_gaps.gap_severity}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Bonus Skills */}
                                        {result.skill_validation.bonus_skills && result.skill_validation.bonus_skills.length > 0 && (
                                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                <h4 className="text-sm font-medium text-blue-400 mb-2">Bonus Skills Discovered</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {result.skill_validation.bonus_skills.map((bonus, i) => (
                                                        <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                                            {bonus.skill}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Evidence */}
                                        {result.skill_validation.evidence && result.skill_validation.evidence.length > 0 && (
                                            <div className="space-y-2 mt-4">
                                                <h4 className="text-sm font-medium text-white/60">Evidence Found</h4>
                                                {result.skill_validation.evidence.slice(0, 5).map((ev: any, i: number) => (
                                                    <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-white">{ev.skill}</span>
                                                                <Badge className="text-xs bg-white/5 text-white/40">{ev.evidence_type}</Badge>
                                                            </div>
                                                            <span className="text-sm text-white/40">{ev.confidence}/10</span>
                                                        </div>
                                                        <p className="text-sm text-white/50 mt-1">{ev.evidence_description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {/* SALARY SECTION */}
                            {result.salary_timeline && result.salary_timeline.career_progression.length > 0 && (
                                <Section title="Compensation Analysis" icon={TrendingUp} defaultOpen={false}>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-4 rounded-lg bg-emerald-500/10 text-center">
                                                <div className="text-2xl font-bold text-emerald-400">
                                                    ₹{result.salary_timeline.current_estimated_ctc.most_likely}L
                                                </div>
                                                <div className="text-xs text-white/40">Current Estimate</div>
                                            </div>
                                            <div className="p-4 rounded-lg bg-blue-500/10 text-center">
                                                <div className="text-2xl font-bold text-blue-400">
                                                    {result.salary_timeline.growth_analysis.average_annual_growth_percent}%
                                                </div>
                                                <div className="text-xs text-white/40">Avg Growth</div>
                                            </div>
                                            <div className="p-4 rounded-lg bg-violet-500/10 text-center">
                                                <div className="text-2xl font-bold text-violet-400">
                                                    {result.salary_timeline.confidence_score}%
                                                </div>
                                                <div className="text-xs text-white/40">Confidence</div>
                                            </div>
                                        </div>

                                        {/* Career progression */}
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-white/60">Career Progression</h4>
                                            {result.salary_timeline.career_progression.map((role: any, i: number) => (
                                                <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-white">{role.role}</div>
                                                        <div className="text-sm text-white/40">{role.company} • {role.duration}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-emerald-400 font-medium">
                                                            ₹{role.estimated_ctc_low}-{role.estimated_ctc_high}L
                                                        </div>
                                                        <div className="text-xs text-white/30">{role.confidence} confidence</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Section>
                            )}

                            {/* RESPONSE & NOTICE SECTIONS */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Response Likelihood */}
                                {result.response_likelihood && (
                                    <Section title="Response Likelihood" icon={MessageSquare} defaultOpen={false}>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-center py-4">
                                                <div className="relative w-32 h-32">
                                                    <svg className="w-full h-full -rotate-90">
                                                        <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-white/10" />
                                                        <motion.circle
                                                            cx="64" cy="64" r="56"
                                                            stroke="currentColor" strokeWidth="8" fill="none"
                                                            strokeLinecap="round"
                                                            className={getMatchColor(result.response_likelihood.overall_score)}
                                                            initial={{ strokeDasharray: "0 352" }}
                                                            animate={{ strokeDasharray: `${(result.response_likelihood.overall_score / 100) * 352} 352` }}
                                                            transition={{ duration: 1 }}
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-2xl font-bold">{result.response_likelihood.overall_score}%</span>
                                                        <span className="text-xs text-white/40">{result.response_likelihood.likelihood_label}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Activity Signals */}
                                            {result.response_likelihood.activity_signals?.overall_activity && (
                                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                                    <div className="text-xs text-white/40 mb-1">Overall Activity</div>
                                                    <div className="text-sm text-white">{result.response_likelihood.activity_signals.overall_activity}</div>
                                                </div>
                                            )}

                                            {/* Best Channels */}
                                            {result.response_likelihood.reachability?.best_channels && result.response_likelihood.reachability.best_channels.length > 0 && (
                                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                                    <div className="text-xs text-white/40 mb-2">Best Contact Channels</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {result.response_likelihood.reachability.best_channels.map((channel, i) => (
                                                            <Badge key={i} className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                                {channel}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Factors */}
                                            {result.response_likelihood.factors && result.response_likelihood.factors.length > 0 && (
                                                <>
                                                    <h4 className="text-sm font-medium text-white/60">Key Factors</h4>
                                                    {result.response_likelihood.factors.slice(0, 3).map((f: any, i: number) => (
                                                        <div key={i} className="p-3 rounded-lg bg-white/[0.02]">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-sm text-white/70">{f.factor_name}</span>
                                                                <span className="text-sm text-white/40">{f.score}/10</span>
                                                            </div>
                                                            <Progress value={f.score * 10} className="h-1.5 bg-white/10" />
                                                        </div>
                                                    ))}
                                                </>
                                            )}

                                            {/* Recommended Approach */}
                                            {result.response_likelihood.recommended_approach && (
                                                <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                                    <h4 className="text-sm font-medium text-violet-400 mb-2">Recommended Approach</h4>
                                                    {result.response_likelihood.recommended_approach.should_reach_out !== undefined && (
                                                        <p className="text-xs text-white/60 mb-2">
                                                            Should reach out: {result.response_likelihood.recommended_approach.should_reach_out ? 'Yes' : 'No'}
                                                        </p>
                                                    )}
                                                    {result.response_likelihood.recommended_approach.primary_channel && (
                                                        <p className="text-xs text-white/60 mb-1">
                                                            Primary channel: {result.response_likelihood.recommended_approach.primary_channel}
                                                        </p>
                                                    )}
                                                    {result.response_likelihood.recommended_approach.message_focus && (
                                                        <p className="text-xs text-white/60 mb-1">
                                                            Message focus: {result.response_likelihood.recommended_approach.message_focus}
                                                        </p>
                                                    )}
                                                    {result.response_likelihood.recommended_approach.personalization_hooks && result.response_likelihood.recommended_approach.personalization_hooks.length > 0 && (
                                                        <div className="mt-2">
                                                            <p className="text-xs text-white/40 mb-1">Personalization hooks:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {result.response_likelihood.recommended_approach.personalization_hooks.map((hook: string, i: number) => (
                                                                    <Badge key={i} className="text-xs bg-violet-500/20 text-violet-300">
                                                                        {hook}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </Section>
                                )}

                                {/* Notice Period */}
                                {result.notice_period && (
                                    <Section title="Notice Period" icon={Clock} defaultOpen={false}>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                                                    <div className="text-xl font-semibold text-white/60">
                                                        {result.notice_period.estimated_notice_days.minimum}
                                                    </div>
                                                    <div className="text-xs text-white/30">Min days</div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                                                    <div className="text-xl font-semibold text-amber-400">
                                                        {result.notice_period.estimated_notice_days.likely}
                                                    </div>
                                                    <div className="text-xs text-white/30">Likely days</div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-white/[0.02] text-center">
                                                    <div className="text-xl font-semibold text-white/60">
                                                        {result.notice_period.estimated_notice_days.maximum}
                                                    </div>
                                                    <div className="text-xs text-white/30">Max days</div>
                                                </div>
                                            </div>

                                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                <div className="text-xs text-white/40 mb-1">Most Likely Start</div>
                                                <div className="text-emerald-400">{result.notice_period.most_likely_start}</div>
                                            </div>

                                            {result.notice_period.earliest_possible_start && (
                                                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                                                    <div className="text-xs text-white/40 mb-1">Earliest Possible Start</div>
                                                    <div className="text-white/80">{result.notice_period.earliest_possible_start}</div>
                                                </div>
                                            )}

                                            {result.notice_period.negotiation_tips && result.notice_period.negotiation_tips.length > 0 && (
                                                <div className="space-y-1">
                                                    <div className="text-xs text-white/40 mb-2">Negotiation Tips</div>
                                                    {result.notice_period.negotiation_tips.map((tip, i) => (
                                                        <div key={i} className="text-sm text-white/60 flex items-start gap-2">
                                                            <ChevronRight className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                                                            {tip}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Section>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* ============================================ */}
                {/* NEW ANALYSIS BUTTON */}
                {/* ============================================ */}
                <div className="flex justify-center pt-8">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setResult(null);
                            setResultId(null);
                            setLinkedinUrl("");
                            setJobDescription("");
                            setJdFile(null);
                        }}
                        className="gap-2 border-white/10 hover:bg-white/5"
                    >
                        <Zap className="w-4 h-4" />
                        Analyze Another Candidate
                    </Button>
                </div>
            </motion.div >
        );
    }

    return (
        <div className="min-h-screen relative text-white">
            <SubtleBackground />

            {/* Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0b]/80 border-b border-white/[0.06]">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                const fromSession = searchParams.get('from_session');
                                if (fromSession) {
                                    router.push(`/search/${fromSession}`);
                                } else {
                                    router.push("/dashboard");
                                }
                            }}
                            className="text-white/60 hover:text-white hover:bg-white/5"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                <Brain className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold">Deep Dive</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowHistory(true)}
                            className="gap-2 text-white/60 hover:text-white hover:bg-white/5"
                        >
                            <History className="w-4 h-4" />
                            History
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8 relative z-10">
                {/* Input Form */}
                {!result && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto"
                    >
                        {/* Hero */}
                        <div className="text-center mb-10">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-400 mb-4"
                            >
                                <Sparkles className="w-3 h-3" />
                                AI-Powered Analysis
                            </motion.div>
                            <h1 className="text-3xl font-bold mb-3">
                                Deep Dive into Any Candidate
                            </h1>
                            <p className="text-white/50 max-w-lg mx-auto">
                                Get comprehensive insights including skill validation, salary estimates, and match analysis.
                            </p>
                        </div>


                        {/* ADD PRE-FILLED NOTIFICATION */}
                        {isPreFilled && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${jobDescription.trim().length > 0
                                    ? "bg-emerald-500/10 border border-emerald-500/20"
                                    : "bg-amber-500/10 border border-amber-500/20"
                                    }`}
                            >
                                {jobDescription.trim().length > 0 ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-emerald-300 mb-1">
                                                Data Pre-filled from Search Results
                                            </h4>
                                            <p className="text-xs text-emerald-200/80">
                                                We&apos;ve automatically filled in the candidate&apos;s LinkedIn URL and job description.
                                                Review the details below and click &quot;Analyze Candidate&quot; when ready.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-semibold text-amber-300 mb-1">
                                                LinkedIn URL Pre-filled
                                            </h4>
                                            <p className="text-xs text-amber-200/80">
                                                We&apos;ve filled in the candidate&apos;s LinkedIn URL. Please add the job description below to continue.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* LinkedIn URL */}
                            <div className="space-y-2">
                                <Label className="text-sm text-white/70 flex items-center gap-2">
                                    <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                                    LinkedIn Profile URL
                                </Label>
                                <div className="relative">
                                    <Input
                                        type="url"
                                        placeholder="https://linkedin.com/in/username"
                                        value={linkedinUrl}
                                        onChange={(e) => setLinkedinUrl(e.target.value)}
                                        className="h-12 bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 pr-10"
                                    />
                                    {linkedinUrl.includes("linkedin.com/in/") && (
                                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                                    )}
                                </div>
                            </div>

                            {/* Job Description */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm text-white/70 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-amber-400" />
                                        Job Description
                                    </Label>
                                    <div className="flex gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setJdInputMode("text")}
                                            className={`text-xs ${jdInputMode === "text" ? 'text-white bg-white/10' : 'text-white/40'}`}
                                        >
                                            Text
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setJdInputMode("file")}
                                            className={`text-xs ${jdInputMode === "file" ? 'text-white bg-white/10' : 'text-white/40'}`}
                                        >
                                            Upload
                                        </Button>
                                    </div>
                                </div>

                                {jdInputMode === "text" ? (
                                    <div className="relative">
                                        <Textarea
                                            placeholder="Paste the complete job description here..."
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                            rows={8}
                                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30 focus:border-violet-500/50 resize-none"
                                        />
                                        <div className="absolute bottom-3 right-3 text-xs text-white/30">
                                            {jobDescription.length} / 50 min
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        {!jdFile ? (
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full h-32 border border-dashed border-white/10 hover:border-violet-500/30 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:bg-violet-500/5"
                                            >
                                                <Upload className="w-6 h-6 text-white/30" />
                                                <span className="text-sm text-white/40">Click to upload (PDF, DOC, TXT)</span>
                                            </button>
                                        ) : (
                                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <FileCheck className="w-5 h-5 text-emerald-400" />
                                                    <span className="text-white">{jdFile.name}</span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setJdFile(null)}
                                                    className="text-white/40 hover:text-white"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Error */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-3"
                                >
                                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                                    <span className="text-sm text-rose-300">{error}</span>
                                </motion.div>
                            )}

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={!isValidInput}
                                className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Zap className="w-4 h-4 mr-2" />
                                Analyze Candidate
                            </Button>
                        </form>
                    </motion.div>
                )}

                {/* Loading State */}
                {isLoading && <ProcessingStages currentStage={loadingStage} />}

                {/* Results */}
                {result && !isLoading && <ResultsDisplay />}
            </main>

            {/* History Panel */}
            <HistoryPanel
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                onSelect={(id) => {
                    setShowHistory(false);
                    loadSharedResult(id);
                }}
            />
        </div >
    )
};