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
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    X,
    Zap,
    Users,
    Filter,
    Clock,
    IndianRupee,
    ChevronRight,
    MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
    experience_years?: number;
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

// Helper to handle API inconsistencies (Object vs String)
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

                // --- FIXED MAPPING LOGIC ---
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
                        profile_picture_url: candidateData.profile_picture_url,
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

        try {
            await conversationApi.selectCandidates(sessionId, [id], isAdding, token!);
        } catch (err) {
            console.error("Failed to sync selection", err);
            if (isAdding) newSet.delete(id);
            else newSet.add(id);
            setShortlistedIds(newSet);
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
        try {
            const response = await conversationApi.createPipelineFromSession(
                sessionId,
                token,
                { shortlisted_candidate_ids: Array.from(shortlistedIds) }
            );
            router.push(`/pipeline/${response.pipeline_id}`);
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreatingPipeline(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
                <AnimatedBackground />
                <div className="z-10 flex flex-col items-center gap-4 p-8 bg-background/40 backdrop-blur-xl rounded-2xl border border-border/50">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <div className="text-center">
                        <h2 className="text-foreground font-medium text-lg">Curating Talent Pool</h2>
                        <p className="text-muted-foreground text-sm">Organizing your search results...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-screen bg-background text-foreground font-sans overflow-hidden">
            <AnimatedBackground />

            {/* Main Layout */}
            <div className="relative z-10 flex h-full">

                {/* --- LEFT: EXCEL-LIKE LIST --- */}
                <div className="w-[500px] flex flex-col border-r border-border/40 bg-background/60 backdrop-blur-xl shadow-2xl z-20">

                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-4 border-b border-border/40 shrink-0 bg-background/20">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push("/search")}
                                className="text-muted-foreground hover:text-foreground hover:bg-white/10"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="font-semibold text-sm text-foreground truncate max-w-[200px] leading-tight">
                                    {sessionData?.ideal_profile?.role_title || "Search Results"}
                                </h1>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                    <span className={`w-1.5 h-1.5 rounded-full ${candidates.length > 0 ? "bg-green-500" : "bg-zinc-700"}`} />
                                    {candidates.length} Candidates Found
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-3 space-y-3 shrink-0 border-b border-border/40">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-9 bg-background/40 border border-border/40 rounded-md pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                            />
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="w-full bg-background/40 border border-border/40 p-0.5 h-9 rounded-md grid grid-cols-2">
                                <TabsTrigger
                                    value="all"
                                    className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground h-8 rounded-sm transition-all"
                                >
                                    All Candidates
                                </TabsTrigger>
                                <TabsTrigger
                                    value="shortlist"
                                    className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground h-8 rounded-sm transition-all"
                                >
                                    Shortlist <span className="ml-1.5 bg-primary/20 px-1.5 rounded-full text-[9px]">{shortlistedIds.size}</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Table Header */}
                    <div className="flex items-center px-4 py-2 border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-background/20">
                        <div className="w-10 text-center">Score</div>
                        <div className="flex-1 pl-3">Candidate Info</div>
                        <div className="w-10 text-right pr-2">Action</div>
                    </div>

                    {/* Rows */}
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-border/20">
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
                                <div className="py-20 text-center px-6">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                        <Filter className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        {activeTab === 'shortlist' ? "No candidates shortlisted yet." : "No candidates found."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Floating Outreach Bar */}
                    <AnimatePresence>
                        {shortlistedIds.size > 0 && (
                            <div className="absolute bottom-6 left-4 right-4 z-30">
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 20, opacity: 0 }}
                                >
                                    <Button
                                        onClick={() => setShowPipelineModal(true)}
                                        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 border border-primary/20 font-medium rounded-xl"
                                    >
                                        <div className="flex items-center justify-between w-full px-2">
                                            <span className="flex items-center gap-2">
                                                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                                                    {shortlistedIds.size}
                                                </Badge>
                                                <span className="text-xs font-semibold uppercase tracking-wider">Selected</span>
                                            </span>
                                            <span className="flex items-center gap-2 text-sm">
                                                Start Outreach <ArrowRight className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </Button>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* --- RIGHT: DOSSIER VIEW --- */}
                <div className="flex-1 flex flex-col bg-background/20 backdrop-blur-md relative overflow-hidden">
                    {/* Top Breadcrumb */}
                    <div className="h-14 border-b border-border/40 flex items-center px-8 text-xs text-muted-foreground bg-background/20">
                        <span>Search Results</span>
                        <ChevronRight className="w-3 h-3 mx-2" />
                        <span className="text-foreground">{selectedCandidate?.name || "Select Candidate"}</span>
                    </div>

                    {selectedCandidate ? (
                        <CandidateDossier
                            candidate={selectedCandidate}
                            isShortlisted={shortlistedIds.has(selectedCandidate.candidate_id)}
                            onToggleShortlist={(e: any) => toggleShortlist(e, selectedCandidate.candidate_id)}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <LayoutGrid className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm">Select a candidate from the list to view details</p>
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
    );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

function CandidateRow({ candidate, isSelected, isShortlisted, onClick, onToggleShortlist }: any) {
    const score = candidate.match_score || 0;

    const getScoreColor = (s: number) => {
        if (s >= 80) return "text-green-500 bg-green-500/10 border-green-500/20";
        if (s >= 60) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    };

    // Spotlight logic
    const rowRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (rowRef.current) {
            const rect = rowRef.current.getBoundingClientRect();
            setMousePosition({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }
    };

    return (
        <div
            ref={rowRef}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            className={`
                group relative flex items-center px-4 py-3 cursor-pointer transition-colors border-l-2
                ${isSelected
                    ? "bg-white/[0.04] border-l-primary"
                    : "border-l-transparent hover:bg-white/[0.02]"
                }
            `}
            style={{
                "--mouse-x": `${mousePosition.x}px`,
                "--mouse-y": `${mousePosition.y}px`,
            } as React.CSSProperties}
        >
            {/* Spotlight Overlay */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(400px_circle_at_var(--mouse-x)_var(--mouse-y),rgba(255,255,255,0.05),transparent)]" />

            {/* Score */}
            <div className="w-10 text-center shrink-0">
                <div className={`text-[10px] font-bold px-1 py-0.5 rounded border ${getScoreColor(score)}`}>
                    {score}
                </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pl-3">
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium truncate ${isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                        {candidate.name}
                    </span>
                    {isShortlisted && <Star className="w-3 h-3 text-amber-400 fill-current" />}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {candidate.current_title || candidate.headline}
                </div>
                {candidate.current_company && (
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {candidate.current_company}
                    </div>
                )}
            </div>

            {/* Action */}
            <div className="w-10 flex justify-end shrink-0 z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${isShortlisted ? "text-amber-400 bg-amber-400/10" : "text-zinc-600 hover:text-amber-400"}`}
                    onClick={onToggleShortlist}
                >
                    <Star className={`w-3.5 h-3.5 ${isShortlisted ? "fill-current" : ""}`} />
                </Button>
            </div>
        </div>
    );
}

function CandidateDossier({ candidate, isShortlisted, onToggleShortlist }: any) {
    const analysis = candidate.match_analysis || {};
    const score = analysis.overall_match_score || 0;

    return (
        <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto p-10 pb-32">

                {/* Header Section */}
                <div className="flex items-start justify-between mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">{candidate.name}</h1>
                            {candidate.linkedin_url && (
                                <a
                                    href={candidate.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-blue-500 transition-colors"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                        </div>
                        <h2 className="text-xl text-muted-foreground font-light max-w-2xl leading-relaxed">
                            {candidate.current_title || candidate.headline}
                        </h2>
                        <div className="flex items-center gap-4 mt-4 text-sm text-zinc-500">
                            {candidate.current_company && (
                                <div className="flex items-center gap-1.5">
                                    <Briefcase className="w-4 h-4" /> {candidate.current_company}
                                </div>
                            )}
                            {candidate.location && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4" /> {candidate.location}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        onClick={onToggleShortlist}
                        className={`
                            h-10 border-border/40 text-sm font-medium
                            ${isShortlisted
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                            }
                        `}
                    >
                        {isShortlisted ? "Shortlisted" : "Add to Shortlist"}
                    </Button>
                </div>

                <div className="grid grid-cols-12 gap-8">

                    {/* Left Column: AI Analysis */}
                    <div className="col-span-12 lg:col-span-8 space-y-8">

                        {/* Executive Summary */}
                        <section>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-400" /> Executive Summary
                            </h3>
                            <div className="bg-white/[0.02] border border-border/40 rounded-lg p-6 leading-relaxed text-zinc-300 text-[15px] shadow-sm">
                                {analysis.summary}
                            </div>
                        </section>

                        {/* Analysis Grid - Rendering Strings Now */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-green-500/[0.02] border border-green-500/10 rounded-lg p-5">
                                <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Strengths
                                </h4>
                                <ul className="space-y-2">
                                    {analysis.strengths?.slice(0, 4).map((s: string, i: number) => (
                                        <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                            <span className="w-1 h-1 rounded-full bg-green-500 mt-2 shrink-0" />
                                            {s}
                                        </li>
                                    ))}
                                    {(!analysis.strengths || analysis.strengths.length === 0) && (
                                        <li className="text-muted-foreground text-sm italic">None detected</li>
                                    )}
                                </ul>
                            </div>
                            <div className="bg-rose-500/[0.02] border border-rose-500/10 rounded-lg p-5">
                                <h4 className="text-sm font-medium text-rose-400 mb-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Gaps
                                </h4>
                                <ul className="space-y-2">
                                    {analysis.concerns?.slice(0, 4).map((s: string, i: number) => (
                                        <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                            <span className="w-1 h-1 rounded-full bg-rose-500 mt-2 shrink-0" />
                                            {s}
                                        </li>
                                    ))}
                                    {(!analysis.concerns || analysis.concerns.length === 0) && (
                                        <li className="text-muted-foreground text-sm italic">None detected</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Detected Skills */}
                        <section>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-400" /> Key Skills
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {candidate.skills?.map((skill: string, i: number) => (
                                    <span key={i} className="px-2.5 py-1 rounded-md bg-white/5 border border-border/40 text-xs text-zinc-300">
                                        {skill}
                                    </span>
                                ))}
                                {(!candidate.skills || candidate.skills.length === 0) && (
                                    <span className="text-muted-foreground text-sm italic">No skills found</span>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Stats & Metadata */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">

                        {/* Score Widget */}
                        <div className="bg-white/[0.02] border border-border/40 rounded-lg p-6 flex flex-col items-center justify-center">
                            <div className="relative mb-3">
                                <svg className="w-24 h-24 transform -rotate-90">
                                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-800" />
                                    <circle
                                        cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent"
                                        strokeDasharray={276} strokeDashoffset={276 - (276 * score) / 100}
                                        className={score >= 70 ? "text-green-500" : score >= 50 ? "text-amber-500" : "text-rose-500"}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">
                                    {score}
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">Match Confidence</div>
                        </div>

                        {/* HR Data (Manual Import) */}
                        <div className="bg-white/[0.02] border border-border/40 rounded-lg p-6 space-y-4">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Candidate Metadata</h4>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2"><Briefcase className="w-3.5 h-3.5" /> Exp.</span>
                                    <span className="text-zinc-300">{candidate.experience_years ? `${candidate.experience_years} Years` : "N/A"}</span>
                                </div>
                                {candidate.manual_data ? (
                                    <>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground flex items-center gap-2"><IndianRupee className="w-3.5 h-3.5" /> Salary</span>
                                            <span className="text-zinc-300">{candidate.manual_data.expected_salary || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Notice</span>
                                            <span className="text-zinc-300">{candidate.manual_data.notice_period || "N/A"}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="pt-2 text-xs text-muted-foreground italic text-center">No internal HR data</div>
                                )}
                            </div>
                        </div>

                        {candidate.manual_data?.notes && (
                            <div className="bg-amber-500/[0.05] border border-amber-500/10 rounded-lg p-4">
                                <h4 className="text-xs font-semibold text-amber-500/70 uppercase tracking-wider mb-2">Internal Notes</h4>
                                <p className="text-sm text-zinc-400 italic">"{candidate.manual_data.notes}"</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </ScrollArea>
    );
}

// --- PIPELINE MODAL ---
function PipelineCreationModal({ count, onClose, onConfirm, isLoading }: any) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-xl bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden"
            >
                <div className="p-8">
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Create Pipeline</h2>
                            <p className="text-muted-foreground text-sm mt-1">
                                You are about to move <span className="text-foreground font-medium">{count} candidates</span> to the outreach stage.
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="space-y-6 mb-8">
                        <div className="flex gap-4 opacity-100">
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/40">1</div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Enrichment</h4>
                                <p className="text-xs text-muted-foreground mt-1">Donna will scrape verified contact details.</p>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-border/40 ml-4 -my-2" />
                        <div className="flex gap-4 opacity-70">
                            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold border border-border/40">2</div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Draft Generation</h4>
                                <p className="text-xs text-muted-foreground mt-1">AI creates personalized email sequences.</p>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-border/40 ml-4 -my-2" />
                        <div className="flex gap-4 opacity-70">
                            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold border border-border/40">3</div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Review</h4>
                                <p className="text-xs text-muted-foreground mt-1">Approve drafts before sending.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border/40">
                        <Button variant="ghost" onClick={onClose} className="flex-1 text-muted-foreground hover:text-foreground hover:bg-white/5">
                            Cancel
                        </Button>
                        <Button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Continue"}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}