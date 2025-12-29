/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Search,
    ExternalLink,
    Loader2,
    Briefcase,
    MapPin,
    Star,
    Sparkles,
    LayoutGrid,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    X,
    Zap,
    Filter,
    Clock,
    IndianRupee,
    ChevronRight,
    Mail,
    UserCheck,
    FileText,
    Bot,
    HelpCircle,
    Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import * as conversationApi from "@/utils/api/conversationApiV2";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

// --- Types ---
interface MatchAnalysis {
    overall_match_score?: number;
    match_label?: string;
    summary?: string;
    strengths?: string[];
    concerns?: string[];
}

interface Candidate {
    candidate_id: string;
    linkedin_url: string;
    name: string;
    headline?: string;
    current_company?: string;
    current_title?: string;
    location?: string;
    experience_years?: number | string;
    skills: string[];
    match_score?: number;
    match_analysis?: MatchAnalysis;
    profile_picture_url?: string;
    source: string;
    manual_data?: {
        expected_salary?: string;
        current_salary?: string;
        notice_period?: string;
        notes?: string;
    };
}

// Helper: Normalize list data from API
const normalizePoints = (points: any[]): string[] => {
    if (!Array.isArray(points)) return [];
    return points.map(p => {
        if (typeof p === 'string') return p;
        if (typeof p === 'object' && p !== null) return p.strength || p.concern || "Point";
        return "";
    }).filter(Boolean);
};

export default function ResultsPage() {
    const params = useParams();
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const sessionId = params.sessionId as string;

    // --- State ---
    const [isLoading, setIsLoading] = useState(true);
    const [sessionData, setSessionData] = useState<any>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [isCreatingPipeline, setIsCreatingPipeline] = useState(false);
    const [showPipelineModal, setShowPipelineModal] = useState(false);

    // --- Auth Check ---
    useEffect(() => {
        if (!isAuthenticated && !isLoading) router.push("/login");
    }, [isAuthenticated, router, isLoading]);

    // --- Data Loading ---
    useEffect(() => {
        const loadResults = async () => {
            if (!sessionId || !token) return;
            try {
                const data = await conversationApi.getSessionResults(sessionId, token);
                setSessionData(data);

                // --- DATA MAPPING LOGIC ---
                const rawCandidates = data.candidates || [];
                const mappedCandidates: Candidate[] = rawCandidates.map((c: any, index: number) => {
                    const candidateData = c.candidate || c; // Handle nested structure

                    // Generate Robust ID
                    const uniqueId =
                        (candidateData.candidate_id && candidateData.candidate_id !== "") ? candidateData.candidate_id :
                            (candidateData._id && candidateData._id !== "") ? candidateData._id :
                                (c.candidate_id && c.candidate_id !== "") ? c.candidate_id :
                                    `temp-${index}-${Math.random().toString(36).substr(2, 9)}`;

                    const rawAnalysis = c.match_analysis || {};

                    return {
                        candidate_id: uniqueId,
                        linkedin_url: candidateData.linkedin_url || "",
                        name: candidateData.name || candidateData.full_name || "Unknown Candidate",
                        headline: candidateData.headline || candidateData.title,
                        current_company: candidateData.current_company,
                        current_title: candidateData.current_title || candidateData.title,
                        location: candidateData.location,
                        experience_years: candidateData.experience_years || candidateData.total_experience_years,
                        skills: Array.isArray(candidateData.skills) ? candidateData.skills.slice(0, 15) : [],
                        match_score: c.match_score || c.score || 0,
                        match_analysis: {
                            overall_match_score: rawAnalysis.overall_match_score || c.match_score || 0,
                            match_label: rawAnalysis.match_label || c.match_label || "Analyzed",
                            summary: rawAnalysis.summary || "Pending analysis...",
                            strengths: normalizePoints(rawAnalysis.strengths),
                            concerns: normalizePoints(rawAnalysis.concerns)
                        },
                        // Ensure we capture the image URL if available
                        profile_picture_url: candidateData.profile_picture_url || candidateData.img_url || candidateData.avatar_url,
                        source: c.source || "donna_search",
                        manual_data: candidateData.manual_data
                    };
                });

                setCandidates(mappedCandidates);

                // Restore previous selection if valid
                if (data.selected_candidate_ids && data.selected_candidate_ids.length > 0) {
                    const validIds = new Set(
                        data.selected_candidate_ids.filter((id: string) =>
                            mappedCandidates.some(mc => mc.candidate_id === id)
                        )
                    );
                    setShortlistedIds(validIds);
                }

                if (mappedCandidates.length > 0) {
                    setSelectedCandidate(mappedCandidates[0]);
                }
            } catch (err) {
                console.error("Failed to load results:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadResults();
    }, [sessionId, token]);

    // --- Logic ---
    const toggleShortlist = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSet = new Set(shortlistedIds);
        const isAdding = !newSet.has(id);

        if (isAdding) newSet.add(id);
        else newSet.delete(id);

        setShortlistedIds(newSet);

        // Background sync
        try {
            await conversationApi.selectCandidates(sessionId, [id], isAdding, token!);
        } catch (err) {
            console.error("Failed to sync selection", err);
            // Revert state on error
            if (isAdding) newSet.delete(id);
            else newSet.add(id);
            setShortlistedIds(new Set(newSet));
        }
    };

    const filteredCandidates = useMemo(() => {
        let list = candidates;

        if (activeTab === "shortlist") {
            list = list.filter(c => shortlistedIds.has(c.candidate_id));
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.current_title?.toLowerCase().includes(q) ||
                c.skills.some(s => s.toLowerCase().includes(q))
            );
        }

        return list.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    }, [candidates, activeTab, shortlistedIds, searchQuery]);

    const handleCreatePipeline = async () => {
        if (!token || shortlistedIds.size === 0) return;
        setIsCreatingPipeline(true);
        // setShowPipelineModal(false); // keep open while loading for better UX

        try {
            const response = await conversationApi.createPipelineFromSession(
                sessionId,
                token,
                { shortlisted_candidate_ids: Array.from(shortlistedIds) }
            );

            if (response.success && response.pipeline_ids.length > 0) {
                router.push(`/pipeline/${sessionId}`);
            } else {
                console.error("No pipelines created");
                alert("Could not create pipeline. Please try again.");
                setIsCreatingPipeline(false);
            }
        } catch (err) {
            console.error("Pipeline creation failed:", err);
            alert("Failed to create pipeline. Please try again.");
            setIsCreatingPipeline(false);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="relative h-screen bg-background text-foreground font-sans overflow-hidden flex flex-col">
                <AnimatedBackground />

                {/* --- HEADER --- */}
                <header className="h-14 border-b border-border/40 bg-background/60 backdrop-blur-xl z-50 flex items-center justify-between px-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/search")}
                            className="text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex flex-col">
                            <h1 className="text-sm font-semibold text-foreground tracking-tight">
                                {sessionData?.ideal_profile?.role_title || "Talent Search Results"}
                            </h1>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                Session: <span className="font-mono text-primary/80">{sessionId.slice(-6)}</span>
                            </span>
                        </div>
                    </div>

                    {/* Donna AI Mascot */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 cursor-help transition-all hover:bg-primary/20 group">
                                <Bot className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-medium text-primary hidden sm:inline">Donna is active</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs bg-popover border-border p-3 text-xs shadow-xl">
                            <p className="font-semibold mb-1 text-primary">I'm your AI Recruiter!</p>
                            I've analyzed {candidates.length} profiles. Select the best ones, and I'll start interviewing them for you.
                        </TooltipContent>
                    </Tooltip>
                </header>

                <div className="flex-1 flex overflow-hidden z-20">

                    {/* --- LEFT: SMART CANDIDATE LIST --- */}
                    <div className="w-[450px] flex flex-col border-r border-border/40 bg-background/40 backdrop-blur-md shadow-2xl relative">

                        {/* Search & Filter Bar */}
                        <div className="p-3 space-y-3 border-b border-border/40 bg-background/20 shrink-0">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Filter by name, skill, or title..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-10 bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                                />
                            </div>

                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="w-full bg-black/20 p-1 rounded-lg grid grid-cols-2 gap-1 h-auto">
                                    <TabsTrigger
                                        value="all"
                                        className="text-xs py-2 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 text-zinc-500 rounded-md transition-all"
                                    >
                                        All Candidates ({candidates.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="shortlist"
                                        className="text-xs py-2 data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400 text-zinc-500 rounded-md transition-all"
                                    >
                                        Shortlist <span className="ml-2 bg-amber-500 text-black px-1.5 py-0.5 rounded-full text-[9px] font-bold">{shortlistedIds.size}</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* List Column Headers */}
                        <div className="flex items-center px-4 py-2 border-b border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-white/[0.02] shrink-0">
                            <div className="w-12 text-center">Score</div>
                            <div className="flex-1 pl-3">Candidate Details</div>
                            <div className="w-8"></div>
                        </div>

                        {/* Scrollable List */}
                        <ScrollArea className="flex-1">
                            <div className="divide-y divide-white/[0.06]">
                                {filteredCandidates.map((candidate) => (
                                    <CandidateRow
                                        key={candidate.candidate_id}
                                        candidate={candidate}
                                        isSelected={selectedCandidate?.candidate_id === candidate.candidate_id}
                                        isShortlisted={shortlistedIds.has(candidate.candidate_id)}
                                        onClick={() => setSelectedCandidate(candidate)}
                                        onToggleShortlist={(e: any) => toggleShortlist(e, candidate.candidate_id)}
                                    />
                                ))}

                                {filteredCandidates.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center opacity-60">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                            <Filter className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground">No matches found</p>
                                        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* "Start Outreach" Floating Button */}
                        <AnimatePresence>
                            {shortlistedIds.size > 0 && (
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 50, opacity: 0 }}
                                    className="absolute bottom-5 left-5 right-5 z-30"
                                >
                                    <Button
                                        onClick={() => setShowPipelineModal(true)}
                                        className="w-full h-14 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white shadow-xl shadow-primary/20 border-t border-white/20 rounded-xl group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <div className="flex items-center justify-between w-full px-2 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-primary font-bold text-xs shadow-sm">
                                                    {shortlistedIds.size}
                                                </span>
                                                <div className="flex flex-col items-start text-xs">
                                                    <span className="font-semibold text-white">Candidates Selected</span>
                                                    <span className="text-white/80 font-light">Ready for outreach</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 font-semibold text-sm">
                                                Begin Outreach <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* --- RIGHT: CANDIDATE DOSSIER --- */}
                    <div className="flex-1 flex flex-col bg-background/80 backdrop-blur-xl relative overflow-hidden">
                        {selectedCandidate ? (
                            <CandidateDossier
                                candidate={selectedCandidate}
                                isShortlisted={shortlistedIds.has(selectedCandidate.candidate_id)}
                                onToggleShortlist={(e: any) => toggleShortlist(e, selectedCandidate.candidate_id)}
                                sessionData={sessionData}
                                sessionId={sessionId}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
                                <LayoutGrid className="w-16 h-16 mb-6 opacity-20" />
                                <h3 className="text-lg font-medium text-foreground mb-2">No Candidate Selected</h3>
                                <p className="text-sm max-w-xs mx-auto">Select a candidate from the list on the left to view their full AI analysis.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- PIPELINE MODAL --- */}
                <AnimatePresence>
                    {showPipelineModal && (
                        <PipelineCreationModal
                            count={shortlistedIds.size}
                            onClose={() => setShowPipelineModal(false)}
                            onConfirm={handleCreatePipeline}
                            isLoading={isCreatingPipeline}
                        />
                    )}
                </AnimatePresence>
            </div>
        </TooltipProvider>
    );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

function LoadingScreen() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
            <AnimatedBackground />
            <div className="z-10 flex flex-col items-center gap-6 p-10 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-pulse" />
                    <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin" />
                    <Bot className="absolute inset-0 m-auto w-6 h-6 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-foreground font-semibold text-xl tracking-tight">Curating Talent Pool</h2>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                        Donna is analyzing profiles, calculating match scores, and organizing your dashboard...
                    </p>
                </div>
            </div>
        </div>
    );
}

function CandidateRow({ candidate, isSelected, isShortlisted, onClick, onToggleShortlist }: any) {
    const score = candidate.match_score || 0;

    // Traffic Light Score Coloring
    const getScoreColor = (s: number) => {
        if (s >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
        if (s >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
        return "text-rose-400 border-rose-500/30 bg-rose-500/10";
    };

    return (
        <div
            onClick={onClick}
            className={`
                group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-l-[3px]
                ${isSelected
                    ? "bg-white/[0.08] border-l-primary"
                    : "border-l-transparent hover:bg-white/[0.04]"
                }
            `}
        >
            {/* Score Badge */}
            <div className="shrink-0 mt-0.5">
                <div className={`
                    w-12 h-8 flex items-center justify-center rounded-md border text-xs font-bold font-mono
                    ${getScoreColor(score)}
                `}>
                    {score}%
                </div>
            </div>

            {/* Candidate Info */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-zinc-300 group-hover:text-white"}`}>
                        {candidate.name}
                    </span>
                    {isShortlisted && (
                        <Tooltip>
                            <TooltipTrigger>
                                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            </TooltipTrigger>
                            <TooltipContent>Shortlisted</TooltipContent>
                        </Tooltip>
                    )}
                </div>

                <div className="text-xs text-zinc-400 truncate flex items-center gap-1.5">
                    <span className="truncate max-w-[150px]">{candidate.current_title}</span>
                    {candidate.current_company && (
                        <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500 truncate">{candidate.current_company}</span>
                        </>
                    )}
                </div>

                <div className="flex flex-wrap gap-1 mt-1.5">
                    {candidate.skills.slice(0, 3).map((skill: string, i: number) => (
                        <span key={i} className="px-1.5 py-0.5 rounded-[3px] bg-white/5 border border-white/5 text-[9px] text-zinc-400">
                            {skill}
                        </span>
                    ))}
                    {candidate.skills.length > 3 && (
                        <span className="px-1.5 py-0.5 text-[9px] text-zinc-600">+{candidate.skills.length - 3}</span>
                    )}
                </div>
            </div>

            {/* Star Action */}
            <div className="shrink-0 flex items-center self-center pl-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`
                        h-8 w-8 rounded-full transition-all
                        ${isShortlisted
                            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                        }
                    `}
                    onClick={onToggleShortlist}
                >
                    <Star className={`w-4 h-4 ${isShortlisted ? "fill-current" : ""}`} />
                </Button>
            </div>
        </div>
    );
}

function CandidateDossier({ candidate, isShortlisted, onToggleShortlist, sessionData,
    sessionId }: {
        candidate: any;
        isShortlisted: boolean;
        onToggleShortlist: (e: any) => void;
        sessionData: any;
        sessionId: string;
    }) {
    const router = useRouter();
    const analysis = candidate.match_analysis || {};
    const score = analysis.overall_match_score || 0;

    const handleDeepDive = () => {
        // Get job description from session data
        const jobDescription = sessionData?.ideal_profile?.detailed_requirements ||
            sessionData?.job_description ||
            "";

        // Navigate to deep-dive with pre-filled data
        const params = new URLSearchParams({
            linkedin_url: candidate.linkedin_url,
            jd: jobDescription,
            candidate_name: candidate.name,
            from_session: sessionId
        });

        router.push(`/deep-dive?${params.toString()}`);
    };

    // Helper to render image or fallback
    const renderProfileImage = () => {
        if (candidate.profile_picture_url && candidate.profile_picture_url.trim() !== "") {
            return (
                <img
                    src={candidate.profile_picture_url}
                    alt={candidate.name}
                    className="w-16 h-16 rounded-full border-2 border-white/10 object-cover"
                    onError={(e) => {
                        // Fallback on error
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                />
            );
        }
        return null;
    };

    const renderFallbackImage = () => (
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border-2 border-white/10 flex items-center justify-center text-2xl font-bold text-zinc-400 ${candidate.profile_picture_url ? 'hidden' : ''}`}>
            {candidate.name.charAt(0)}
        </div>
    );

    return (
        <ScrollArea className="h-full">
            <div className="p-8 pb-32 max-w-5xl mx-auto">

                {/* Header Profile Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.08] to-transparent border border-white/10 p-8 mb-8">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                        <Briefcase className="w-64 h-64 rotate-12" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-3">
                                {/* Image Handling */}
                                {renderProfileImage()}
                                {renderFallbackImage()}

                                <div>
                                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                                        {candidate.name}
                                        {candidate.linkedin_url && (
                                            <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-blue-400 transition-colors">
                                                <ExternalLink className="w-5 h-5" />
                                            </a>
                                        )}
                                    </h1>
                                    <p className="text-lg text-zinc-400 font-light mt-1">{candidate.headline || candidate.current_title}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 mt-6 text-sm text-zinc-400">
                                {candidate.current_company && (
                                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                                        <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>{candidate.current_company}</span>
                                    </div>
                                )}
                                {candidate.location && (
                                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                                        <span>{candidate.location}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                    <span>{typeof candidate.experience_years === 'string' ? candidate.experience_years : `${candidate.experience_years || 0} Years Exp.`}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-4">
                            {/* Match Score Indicator */}
                            <div className="flex items-center gap-3 bg-black/40 rounded-lg px-4 py-2 border border-white/10">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Match Score</span>
                                <div className={`text-2xl font-bold ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {score}%
                                </div>
                            </div>
                            {/* DECISION HELPER CARD */}
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="w-full max-w-sm bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                                        <Brain className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xs font-semibold text-violet-300 mb-1">Not sure if this is the right fit?</h4>
                                        <p className="text-[11px] text-violet-200/70 leading-relaxed mb-3">
                                            Get a comprehensive AI analysis with skill validation, salary estimates, and hiring recommendations before making your decision.
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={handleDeepDive}
                                            className="w-full h-9 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium shadow-lg transition-all group"
                                        >
                                            <Brain className="w-3.5 h-3.5 mr-2 group-hover:scale-110 transition-transform" />
                                            Run Deep Dive Analysis
                                            <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Divider */}
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            <Button
                                size="lg"
                                onClick={onToggleShortlist}
                                className={`
                                    h-12 px-6 rounded-xl font-medium shadow-lg transition-all
                                    ${isShortlisted
                                        ? "bg-amber-400 text-black hover:bg-amber-500"
                                        : "bg-white text-black hover:bg-zinc-200"
                                    }
                                `}
                            >
                                {isShortlisted ? (
                                    <><Star className="w-4 h-4 mr-2 fill-black" /> Shortlisted</>
                                ) : (
                                    <><Star className="w-4 h-4 mr-2" /> Add to Shortlist</>
                                )}
                            </Button>


                        </div>
                    </div>
                </div>

                {/* Content Grid */}
                <div className="grid grid-cols-12 gap-6">

                    {/* LEFT COL: Analysis */}
                    <div className="col-span-12 lg:col-span-8 space-y-6">

                        {/* Executive Summary */}
                        <div className="bg-card border border-border/40 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full group-hover:bg-primary/20 transition-all duration-500" />
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                <h3 className="font-semibold text-foreground">AI Executive Summary</h3>
                            </div>
                            <p className="text-zinc-300 leading-relaxed text-[15px]">
                                {analysis.summary}
                            </p>
                        </div>

                        {/* Analysis Columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Strengths */}
                            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-6">
                                <h4 className="flex items-center gap-2 text-emerald-400 font-medium mb-4">
                                    <CheckCircle2 className="w-5 h-5" /> Key Strengths
                                </h4>
                                <ul className="space-y-3">
                                    {analysis.strengths?.length > 0 ? (
                                        analysis.strengths.slice(0, 5).map((s: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                <span className="leading-snug">{s}</span>
                                            </li>
                                        ))
                                    ) : <span className="text-muted-foreground text-sm italic">No specific strengths listed.</span>}
                                </ul>
                            </div>

                            {/* Gaps */}
                            <div className="bg-rose-950/10 border border-rose-500/20 rounded-xl p-6">
                                <h4 className="flex items-center gap-2 text-rose-400 font-medium mb-4">
                                    <AlertCircle className="w-5 h-5" /> Potential Gaps
                                </h4>
                                <ul className="space-y-3">
                                    {analysis.concerns?.length > 0 ? (
                                        analysis.concerns.slice(0, 5).map((s: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                                                <span className="leading-snug">{s}</span>
                                            </li>
                                        ))
                                    ) : <span className="text-muted-foreground text-sm italic">No major concerns detected.</span>}
                                </ul>
                            </div>
                        </div>

                        {/* Skills Cloud */}
                        <div className="bg-card border border-border/40 rounded-xl p-6">
                            <h4 className="flex items-center gap-2 text-zinc-400 font-medium text-sm uppercase tracking-wider mb-4">
                                <Zap className="w-4 h-4" /> Detected Skills
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {candidate.skills.map((skill: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700 px-3 py-1.5 font-normal">
                                        {skill}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: Metadata */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">

                        {/* HR Data Widget */}
                        <div className="bg-card border border-border/40 rounded-xl p-6 space-y-5">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-3 h-3" /> Candidate Details
                            </h4>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-border/30">
                                    <span className="text-sm text-muted-foreground">Experience</span>
                                    <span className="text-sm font-medium text-foreground">{candidate.experience_years ? `${candidate.experience_years} Years` : "N/A"}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-border/30">
                                    <span className="text-sm text-muted-foreground">Current Salary</span>
                                    <span className="text-sm font-medium text-foreground">{candidate.manual_data?.current_salary || "—"}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-border/30">
                                    <span className="text-sm text-muted-foreground">Expected Salary</span>
                                    <span className="text-sm font-medium text-foreground">{candidate.manual_data?.expected_salary || "—"}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-muted-foreground">Notice Period</span>
                                    <span className="text-sm font-medium text-foreground">{candidate.manual_data?.notice_period || "—"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Internal Notes Widget */}
                        {candidate.manual_data?.notes && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 relative">
                                <div className="absolute top-4 right-4">
                                    <Tooltip>
                                        <TooltipTrigger><HelpCircle className="w-4 h-4 text-amber-500/40" /></TooltipTrigger>
                                        <TooltipContent>Internal HR Notes</TooltipContent>
                                    </Tooltip>
                                </div>
                                <h4 className="text-xs font-bold text-amber-500/80 uppercase tracking-widest mb-3">Internal Notes</h4>
                                <p className="text-sm text-zinc-400 italic leading-relaxed">"{candidate.manual_data.notes}"</p>
                            </div>
                        )}

                        {/* Source Badge */}
                        <div className="flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-600">
                            <span>Source: {candidate.source}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-600" />
                            <span>ID: {candidate.candidate_id.slice(0, 8)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}

// --- PIPELINE MODAL (ENHANCED WITH DONNA & DUPLICATE CHECK) ---
function PipelineCreationModal({ count, onClose, onConfirm, isLoading }: any) {
    const [hasPipeline, setHasPipeline] = useState(false);
    const [isCheckingPipeline, setIsCheckingPipeline] = useState(true);
    const [showDonnaTooltip, setShowDonnaTooltip] = useState(false);

    // Check if pipeline already exists for this session
    useEffect(() => {
        const checkExistingPipeline = async () => {
            try {
                const sessionData = await conversationApi.getSessionResults(sessionId, token);
                // Assuming the API returns pipeline info - adjust based on your actual API
                setHasPipeline(sessionData.has_active_pipeline || false);
            } catch (err) {
                console.error("Could not check pipeline status", err);
            } finally {
                setIsCheckingPipeline(false);
            }
        };
        checkExistingPipeline();
    }, []);

    if (isCheckingPipeline) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-[#0f0f12] border border-white/10 rounded-2xl p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-[#0f0f12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="p-8">
                    {/* Donna Mascot Header */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex items-start gap-4">
                            {/* Donna Avatar with Interaction */}
                            <motion.div
                                className="relative"
                                onMouseEnter={() => setShowDonnaTooltip(true)}
                                onMouseLeave={() => setShowDonnaTooltip(false)}
                            >
                                <motion.div
                                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center border-2 border-white/20 shadow-lg cursor-pointer"
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Bot className="w-8 h-8 text-white" />
                                </motion.div>

                                {/* Donna's Playful Tooltip */}
                                <AnimatePresence>
                                    {showDonnaTooltip && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            className="absolute -top-2 left-20 bg-primary text-white px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shadow-xl border border-white/20"
                                        >
                                            🦖 Rawr! Let's find those candidates!
                                            <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-primary rotate-45" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            <div>
                                <h2 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
                                    {hasPipeline ? "Start Another Outreach?" : "Let's Connect with Candidates!"}
                                    <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                                </h2>
                                <p className="text-zinc-400 mt-2">
                                    {hasPipeline ? (
                                        <>
                                            You already have an active campaign. Starting a new one will create a <strong className="text-amber-400">separate outreach</strong> for these {count} candidates.
                                        </>
                                    ) : (
                                        <>
                                            You picked <span className="text-white font-medium">{count} great {count === 1 ? 'candidate' : 'candidates'}</span>! 🎯
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-zinc-500 hover:text-white rounded-full hover:bg-white/5"
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    {/* Warning Banner for Duplicate Outreach */}
                    {hasPipeline && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-semibold text-amber-300 mb-1">Heads Up!</h4>
                                <p className="text-xs text-amber-200/80 leading-relaxed">
                                    You already have an outreach running. Creating another campaign means you'll reach out to these candidates separately. Both campaigns will track responses independently.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Simple Explanation Box */}
                    <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-xl p-6 mb-8 border border-white/10">
                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-400" />
                            Here's what I'll do for you:
                        </h3>
                        <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                            Think of me as your <strong className="text-primary">personal investigator & assistant</strong>. I'll handle the boring stuff so you can focus on hiring!
                        </p>
                    </div>

                    {/* Step Visualization - SIMPLIFIED FOR HR */}
                    <div className="space-y-4 mb-8">
                        {/* Step 1 */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.div
                                    className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-all cursor-help"
                                    whileHover={{ x: 4 }}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <UserCheck className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-semibold text-white">Step 1: Detective Work </h4>
                                                <Badge className="bg-blue-500/20 text-blue-300 text-[10px] border-blue-500/30">Automatic</Badge>
                                            </div>
                                            <p className="text-xs text-zinc-400">
                                                I'll find their email addresses and phone numbers for you
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs"><strong>What happens:</strong> I search the internet to find verified contact info. No manual work needed!</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Step 2 */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.div
                                    className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-all cursor-help"
                                    whileHover={{ x: 4 }}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <Mail className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-semibold text-white">Step 2: Reach Out </h4>
                                                <Badge className="bg-purple-500/20 text-purple-300 text-[10px] border-purple-500/30">You Control</Badge>
                                            </div>
                                            <p className="text-xs text-zinc-400">
                                                I'll write personalized emails, but you approve before sending
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs"><strong>Your safety net:</strong> Every email goes to a review dashboard first. You can edit, discard, or approve each one!</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Step 3 */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.div
                                    className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-all cursor-help"
                                    whileHover={{ x: 4 }}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <Bot className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-semibold text-white">Step 3: Track & Interview </h4>
                                                <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] border-emerald-500/30">Smart AI</Badge>
                                            </div>
                                            <p className="text-xs text-zinc-400">
                                                I'll notify you when they reply & can conduct initial interviews
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs"><strong>The magic part:</strong> I can ask screening questions, check availability, and send you a summary of interested candidates!</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Step 4 */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <motion.div
                                    className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-all cursor-help"
                                    whileHover={{ x: 4 }}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <FileText className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-semibold text-white">Step 4: Final Report </h4>
                                                <Badge className="bg-amber-500/20 text-amber-300 text-[10px] border-amber-500/30">Delivered</Badge>
                                            </div>
                                            <p className="text-xs text-zinc-400">
                                                You get a neat summary: who's interested, who's not, next steps
                                            </p>
                                        </div>
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs"><strong>Your final dashboard:</strong> See who replied, interview results, and ready-to-hire recommendations all in one place!</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Trust-Building Note */}
                    <motion.div
                        className="bg-zinc-900/50 rounded-lg p-4 mb-6 flex items-start gap-3 border border-white/5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <HelpCircle className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h5 className="text-xs font-semibold text-white mb-1">You're always in control! 👍</h5>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Nothing happens without your approval. I'm just here to save you time on the boring stuff like finding emails and writing messages.
                            </p>
                        </div>
                    </motion.div>

                    {/* Encouraging Progress Message */}
                    <motion.div
                        className="text-center mb-6 py-3 px-4 bg-primary/5 rounded-lg border border-primary/20"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <p className="text-sm text-primary font-medium flex items-center justify-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            You're almost there! Just one click to start
                            <Sparkles className="w-4 h-4" />
                        </p>
                    </motion.div>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 h-12 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 group"
                        >
                            <span className="group-hover:scale-110 transition-transform inline-block">Maybe Later</span>
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={onConfirm}
                                    disabled={isLoading}
                                    className="flex-[2] h-12 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white font-medium text-sm shadow-lg shadow-primary/25 rounded-lg relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                    {isLoading ? (
                                        <div className="flex items-center gap-2 relative z-10">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Setting things up...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 relative z-10">
                                            <Zap className="w-4 h-4" />
                                            <span>{hasPipeline ? "Yes, Start New Campaign" : "Let's Go! Start Campaign"}</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-primary text-white border-primary/30">
                                <p className="text-xs font-medium">🎯 Great progress so far!</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}