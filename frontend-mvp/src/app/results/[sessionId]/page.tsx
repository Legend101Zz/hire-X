/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck       
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Download, Search, Star,
    Briefcase, MapPin, Check, AlertCircle,
    Linkedin, ExternalLink, Sparkles,
    Mail, Zap, ChevronDown, ChevronUp,
    X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Bot, Quote, TrendingUp, Calendar, Award,
    Target, Users, MessageSquare, Filter, BarChart3,
    Clock, Shield, Globe, FileText, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import * as resultsApi from "@/utils/api/resultsApi";
import BlueprintBackground from "@/components/conversation/BlueprintBackground";

// --- Types ---
interface IdealProfile {
    role_title?: string;
    must_have_skills?: string[];
    nice_to_have_skills?: string[];
    min_experience?: number;
    max_experience?: number;
    preferred_locations?: string[];
    role_description?: string;
}

interface Candidate {
    candidate_id?: string;
    profile_id?: string;
    is_shortlisted?: boolean;
    candidate?: {
        linkedin_id?: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
        headline?: string;
        title?: string;
        location?: string;
        current_company?: string;
        linkedin_url?: string;
        experience_years?: number;
        summary?: string;
    };
    match_analysis?: {
        overall_match_score?: number;
        match_label?: string;
        summary?: string;
        strengths?: Array<{ strength: string } | string>;
        concerns?: Array<{ concern: string } | string>;
    };
    salary_estimation?: {
        current_estimated_ctc?: { low?: number; most_likely?: number; high?: number };
        career_progression?: Array<{
            year?: number;
            company?: string;
            title?: string;
            estimated_ctc?: number;
        }>;
    };
    response_likelihood?: {
        likelihood_label?: string;
        overall_score?: number;
        recommended_approach?: { should_reach_out?: boolean; best_channel?: string };
        factors?: Array<{ factor_name: string; impact: string; interpretation: string }>;
    };
    skill_validation?: {
        overall_confidence?: number;
        evidence?: Array<{ skill: string; evidence_type: string; evidence_strength?: string; details?: string }>;
        validated_skills?: string[];
    };
    availability?: {
        estimated_notice_days?: { likely?: number };
        notice_period_days?: number;
        earliest_possible_start?: string;
    };
    professional_footprint?: {
        verified_profiles?: Array<{ platform: string; url: string }>;
        overall_footprint_assessment?: { presence_level?: string; notable_findings?: string[] };
    };
}

interface ResultsOverview {
    session_id: string;
    conversation_session_id?: string;
    ideal_profile?: IdealProfile;
    total_found: number;
    enriched_count: number;
    created_at: string;
    status: string;
}

// --- Helper Functions ---
const getCandidateId = (c: Candidate) => c.candidate_id || c.profile_id || c.candidate?.linkedin_id || "";
const getCandidateName = (c: Candidate) => c.candidate?.full_name || `${c.candidate?.first_name || ""} ${c.candidate?.last_name || ""}`.trim() || "Unknown Candidate";
const getMatchScore = (c: Candidate) => c.match_analysis?.overall_match_score || 0;
const getSalary = (c: Candidate) => c.salary_estimation?.current_estimated_ctc?.most_likely || 0;
const getResponseScore = (c: Candidate) => c.response_likelihood?.overall_score || 0;

export default function ResultsPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const sessionId = params.sessionId as string;

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [overview, setOverview] = useState<ResultsOverview | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [searchFilter, setSearchFilter] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'match_score', direction: 'desc' });
    const [isShortlistOnly, setIsShortlistOnly] = useState(false);
    const [responseLikelihoodFilter, setResponseLikelihoodFilter] = useState<string | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // Load Data
    useEffect(() => {
        if (!sessionId || !token) return;
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [overviewData, candidatesData] = await Promise.all([
                    resultsApi.getResults(sessionId, token),
                    resultsApi.getCandidates(sessionId, token)
                ]);
                setOverview(overviewData);
                setCandidates(candidatesData.candidates || []);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [sessionId, token]);

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [searchFilter, isShortlistOnly, responseLikelihoodFilter]);

    // Calculate Top Recommendation for Sidebar
    const topRecommendation = useMemo(() => {
        if (!candidates || candidates.length === 0) return null;
        const best = candidates.reduce((prev, current) =>
            (getMatchScore(prev) > getMatchScore(current)) ? prev : current
        );
        if (getMatchScore(best) === 0) return null;
        return best;
    }, [candidates]);

    // Filtering & Sorting
    const filteredCandidates = useMemo(() => {
        let result = [...candidates];

        if (isShortlistOnly) {
            result = result.filter(c => c.is_shortlisted);
        }

        if (responseLikelihoodFilter) {
            result = result.filter(c =>
                c.response_likelihood?.likelihood_label === responseLikelihoodFilter
            );
        }

        if (searchFilter) {
            const lower = searchFilter.toLowerCase();
            result = result.filter(c =>
                getCandidateName(c).toLowerCase().includes(lower) ||
                (c.candidate?.title || "").toLowerCase().includes(lower) ||
                (c.candidate?.current_company || "").toLowerCase().includes(lower)
            );
        }

        result.sort((a, b) => {
            let aValue: any = 0;
            let bValue: any = 0;

            switch (sortConfig.key) {
                case 'match_score':
                    aValue = getMatchScore(a);
                    bValue = getMatchScore(b);
                    break;
                case 'salary':
                    aValue = getSalary(a);
                    bValue = getSalary(b);
                    break;
                case 'experience':
                    aValue = a.candidate?.experience_years || 0;
                    bValue = b.candidate?.experience_years || 0;
                    break;
                case 'response':
                    aValue = getResponseScore(a);
                    bValue = getResponseScore(b);
                    break;
                case 'name':
                    aValue = getCandidateName(a);
                    bValue = getCandidateName(b);
                    break;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [candidates, searchFilter, sortConfig, isShortlistOnly, responseLikelihoodFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
    const paginatedCandidates = filteredCandidates.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Stats
    const stats = useMemo(() => {
        const shortlisted = candidates.filter(c => c.is_shortlisted).length;
        const highMatch = candidates.filter(c => getMatchScore(c) >= 80).length;
        const highResponse = candidates.filter(c => getResponseScore(c) >= 70).length;
        return { shortlisted, highMatch, highResponse };
    }, [candidates]);

    // Actions
    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleToggleShortlist = async (e: React.MouseEvent, candidateId: string) => {
        e.stopPropagation();
        if (!token) return;

        setCandidates(prev => prev.map(c =>
            getCandidateId(c) === candidateId ? { ...c, is_shortlisted: !c.is_shortlisted } : c
        ));

        if (selectedCandidate && getCandidateId(selectedCandidate) === candidateId) {
            setSelectedCandidate(prev => prev ? ({ ...prev, is_shortlisted: !prev.is_shortlisted }) : null);
        }

        try {
            await resultsApi.toggleShortlist(sessionId, candidateId, token);
        } catch (error) {
            console.error("Shortlist failed", error);
            setCandidates(prev => prev.map(c =>
                getCandidateId(c) === candidateId ? { ...c, is_shortlisted: !c.is_shortlisted } : c
            ));
        }
    };

    const handleExport = async () => {
        if (!token) return;
        try {
            const blob = await resultsApi.exportResults(sessionId, token, "csv");
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `candidates_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export CSV. Please try again.");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Loading Analysis...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
            <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
                <BlueprintBackground />
            </div>

            {/* --- Enhanced Toolbar --- */}
            <header className="h-16 flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur-md z-10 px-6 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/search")} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div className="h-6 w-px bg-border/60" />
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-base">Candidate Analysis</h1>
                            <p className="text-xs text-muted-foreground">
                                {overview?.ideal_profile?.role_title || "Search Results"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search candidates, titles, companies..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="w-full h-10 bg-secondary/50 border border-border/50 rounded-lg pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsShortlistOnly(!isShortlistOnly)}
                        className={`h-10 ${isShortlistOnly ? "bg-amber-500/10 border-amber-500/50 text-amber-500" : "text-muted-foreground"}`}
                    >
                        <Star className={`w-4 h-4 mr-2 ${isShortlistOnly ? "fill-amber-500" : ""}`} />
                        Shortlist ({stats.shortlisted})
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} className="h-10">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden z-0 p-6 flex gap-6">
                {/* --- Left Sidebar: Search Context & Filters --- */}
                <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto custom-scrollbar">
                    {/* Search Context Card */}
                    {overview?.ideal_profile && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Target className="w-5 h-5 text-primary" />
                                <h2 className="font-semibold text-base">Search Criteria</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1.5">Role</div>
                                    <div className="text-sm font-semibold text-foreground">
                                        {overview.ideal_profile.role_title || "—"}
                                    </div>
                                </div>

                                {overview.ideal_profile.must_have_skills && overview.ideal_profile.must_have_skills.length > 0 && (
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">Must-Have Skills</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {overview.ideal_profile.must_have_skills.map((skill, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    {skill}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {overview.ideal_profile.nice_to_have_skills && overview.ideal_profile.nice_to_have_skills.length > 0 && (
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">Nice-to-Have Skills</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {overview.ideal_profile.nice_to_have_skills.map((skill, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {skill}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(overview.ideal_profile.min_experience || overview.ideal_profile.max_experience) && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {overview.ideal_profile.min_experience && (
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">Min Exp</div>
                                                <div className="text-sm font-semibold">{overview.ideal_profile.min_experience}+ years</div>
                                            </div>
                                        )}
                                        {overview.ideal_profile.max_experience && (
                                            <div>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">Max Exp</div>
                                                <div className="text-sm font-semibold">{overview.ideal_profile.max_experience} years</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {overview.ideal_profile.preferred_locations && overview.ideal_profile.preferred_locations.length > 0 && (
                                    <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">Locations</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {overview.ideal_profile.preferred_locations.map((loc, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    <MapPin className="w-3 h-3 mr-1" />
                                                    {loc}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* --- NEW: AI VERDICT / TOP RECOMMENDATION CARD --- */}
                    {topRecommendation && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-violet-500/10 via-card/60 to-purple-500/5 backdrop-blur-sm border border-violet-500/20 rounded-xl p-5 shadow-sm relative overflow-hidden group cursor-pointer hover:border-violet-500/40 transition-all"
                            onClick={() => setSelectedCandidate(topRecommendation)}
                        >
                            <div className="absolute -right-6 -top-6 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
                                <Bot className="w-24 h-24 text-violet-500" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-violet-500" />
                                    <h2 className="font-semibold text-sm text-violet-600 dark:text-violet-400 uppercase tracking-wide">Top Verdict</h2>
                                </div>

                                <div className="mb-3">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Highest Match</div>
                                    <div className="font-bold text-lg leading-tight flex items-center justify-between">
                                        <span className="truncate mr-2">{getCandidateName(topRecommendation)}</span>
                                        <Badge className="bg-violet-500 hover:bg-violet-600 border-none text-white shrink-0">
                                            {getMatchScore(topRecommendation)}%
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                                        {topRecommendation.candidate?.title}
                                    </div>
                                </div>

                                <div className="text-sm text-foreground/80 leading-relaxed line-clamp-3 italic bg-background/50 p-2.5 rounded-lg border border-violet-500/10 mb-2">
                                    &quot;{topRecommendation.match_analysis?.summary || "Strongest candidate based on skills and experience analysis."}&quot;
                                </div>

                                <div className="text-xs text-violet-500 font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                                    View Detailed Analysis <ChevronRight className="w-3 h-3" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {/* --- END AI VERDICT CARD --- */}

                    {/* Quick Stats */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Layers className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-base">Quick Stats</h2>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Total Candidates</span>
                                <span className="text-lg font-bold font-mono">{candidates.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                    Shortlisted
                                </span>
                                <span className="text-lg font-bold font-mono text-amber-500">{stats.shortlisted}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">High Match (80%+)</span>
                                <span className="text-lg font-bold font-mono text-green-500">{stats.highMatch}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">High Response (70%+)</span>
                                <span className="text-lg font-bold font-mono text-blue-500">{stats.highResponse}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Response Likelihood Filter */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-sm"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold text-base">Filters</h2>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground mb-2">Response Likelihood</div>
                            {['Very High', 'High', 'Moderate', 'Low'].map(level => (
                                <button
                                    key={level}
                                    onClick={() => setResponseLikelihoodFilter(
                                        responseLikelihoodFilter === level ? null : level
                                    )}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${responseLikelihoodFilter === level
                                        ? 'bg-primary/10 border border-primary/50 text-primary font-medium'
                                        : 'hover:bg-secondary/50 border border-transparent'
                                        }`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* --- Main Content: Data Table --- */}
                <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                    <div className="flex-1 border border-border/50 rounded-t-lg bg-card/40 backdrop-blur-sm overflow-auto shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="text-sm font-semibold text-muted-foreground bg-secondary/80 border-b border-border/50 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 cursor-pointer hover:text-foreground w-12 text-center" onClick={() => handleSort('match_score')}>#</th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-foreground w-[25%]" onClick={() => handleSort('name')}>
                                        Candidate <SortIcon active={sortConfig.key === 'name'} direction={sortConfig.direction} />
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-foreground w-[12%]" onClick={() => handleSort('match_score')}>
                                        Match <SortIcon active={sortConfig.key === 'match_score'} direction={sortConfig.direction} />
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-foreground w-[12%]" onClick={() => handleSort('response')}>
                                        Response <SortIcon active={sortConfig.key === 'response'} direction={sortConfig.direction} />
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-foreground w-[8%]" onClick={() => handleSort('experience')}>
                                        Exp <SortIcon active={sortConfig.key === 'experience'} direction={sortConfig.direction} />
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:text-foreground w-[12%]" onClick={() => handleSort('salary')}>
                                        Est. CTC <SortIcon active={sortConfig.key === 'salary'} direction={sortConfig.direction} />
                                    </th>
                                    <th className="px-6 py-4 w-[10%]">Notice</th>
                                    <th className="px-6 py-4 text-right w-[8%]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {paginatedCandidates.map((c, idx) => {
                                    const score = getMatchScore(c);
                                    const responseScore = getResponseScore(c);
                                    const isSelected = selectedCandidate && getCandidateId(selectedCandidate) === getCandidateId(c);
                                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;

                                    return (
                                        <tr
                                            key={getCandidateId(c)}
                                            onClick={() => setSelectedCandidate(c)}
                                            className={`
                                            group transition-all duration-200 cursor-pointer
                                            ${isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-secondary/40"}
                                        `}
                                        >
                                            <td className="px-6 py-5 font-mono text-muted-foreground text-sm text-center">
                                                {globalIndex}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-base font-semibold transition-colors ${isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                                                            {getCandidateName(c)}
                                                        </span>
                                                        {c.professional_footprint?.overall_footprint_assessment?.presence_level === 'High' && (
                                                            <Shield className="w-4 h-4 text-blue-500" title="Strong online presence" />
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground line-clamp-1">
                                                        {c.candidate?.title || "Unknown Title"}
                                                    </span>
                                                    {c.candidate?.current_company && (
                                                        <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                                                            <Briefcase className="w-3 h-3" />
                                                            {c.candidate.current_company}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-12 h-1.5 rounded-full bg-secondary overflow-hidden ring-1 ring-border/50`}>
                                                            <div
                                                                className={`h-full rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                style={{ width: `${score}%` }}
                                                            />
                                                        </div>
                                                        <span className={`font-mono text-sm font-bold ${score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                                                            {score}%
                                                        </span>
                                                    </div>
                                                    {c.match_analysis?.match_label && (
                                                        <Badge variant="outline" className="text-xs w-fit">
                                                            {c.match_analysis.match_label}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                                        <span className={`font-mono text-sm font-bold ${responseScore >= 70 ? 'text-green-500' :
                                                            responseScore >= 50 ? 'text-blue-500' :
                                                                responseScore >= 30 ? 'text-amber-500' : 'text-red-500'
                                                            }`}>
                                                            {responseScore}%
                                                        </span>
                                                    </div>
                                                    {c.response_likelihood?.likelihood_label && (
                                                        <Badge variant="outline" className="text-xs w-fit">
                                                            {c.response_likelihood.likelihood_label}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-1.5 text-sm text-foreground/80">
                                                    <Award className="w-4 h-4 text-muted-foreground" />
                                                    {c.candidate?.experience_years || "—"} yrs
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-sm font-semibold">
                                                        {getSalary(c) > 0 ? `₹${getSalary(c)}L` : "—"}
                                                    </span>
                                                    {c.salary_estimation?.current_estimated_ctc && (
                                                        <span className="text-xs text-muted-foreground">
                                                            ₹{c.salary_estimation.current_estimated_ctc.low}L - ₹{c.salary_estimation.current_estimated_ctc.high}L
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <Clock className="w-4 h-4" />
                                                    {c.availability?.estimated_notice_days?.likely || c.availability?.notice_period_days || "?"} days
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 hover:bg-background border border-transparent hover:border-border"
                                                    onClick={(e) => handleToggleShortlist(e, getCandidateId(c))}
                                                >
                                                    <Star
                                                        className={`w-5 h-5 transition-colors ${c.is_shortlisted ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}
                                                    />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* --- Pagination Footer --- */}
                    <div className="h-16 bg-card/60 border border-t-0 border-border/50 rounded-b-lg flex items-center justify-between px-6 backdrop-blur-sm">
                        <div className="text-sm text-muted-foreground">
                            Showing <span className="font-medium text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredCandidates.length)}</span> of <span className="font-medium text-foreground">{filteredCandidates.length}</span> results
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <div className="flex items-center gap-1 mx-3">
                                <span className="text-sm font-medium">Page {currentPage}</span>
                                <span className="text-sm text-muted-foreground">of {Math.max(1, totalPages)}</span>
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Enhanced Slide-Over Details --- */}
            <AnimatePresence>
                {selectedCandidate && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedCandidate(null)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                        />

                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-full max-w-3xl bg-background border-l border-border shadow-2xl z-50 overflow-hidden flex flex-col"
                        >
                            <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-gradient-to-r from-primary/5 to-transparent backdrop-blur-md">
                                <h2 className="font-semibold text-lg flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" /> Detailed Analysis
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedCandidate(null)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                                <CandidateDetail
                                    candidate={selectedCandidate}
                                    onToggleShortlist={(id) => handleToggleShortlist({ stopPropagation: () => { } } as any, id)}
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Sub-Components ---

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) { if (!active) return <ChevronDown className="w-3 h-3 inline-block ml-1 opacity-20" />; return direction === 'asc' ? <ChevronUp className="w-3 h-3 inline-block ml-1 text-primary" /> : <ChevronDown className="w-3 h-3 inline-block ml-1 text-primary" />; }

function CandidateDetail({ candidate, onToggleShortlist }: { candidate: Candidate; onToggleShortlist: (id: string) => void }) {
    const name = getCandidateName(candidate); const score = getMatchScore(candidate); const responseScore = getResponseScore(candidate); const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'salary' | 'response'>('overview');

    return (
        <div className="p-8 space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-2 border-primary/20 flex items-center justify-center text-4xl font-bold text-primary shrink-0 shadow-lg shadow-primary/10">
                    {name[0]}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold truncate tracking-tight mb-2">{name}</h1>
                            <p className="text-muted-foreground text-lg leading-relaxed">{candidate.candidate?.headline || candidate.candidate?.title}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="default"
                            onClick={() => onToggleShortlist(getCandidateId(candidate))}
                            className={candidate.is_shortlisted ? "border-amber-500/50 bg-amber-500/10 text-amber-500 hover:text-amber-600 hover:bg-amber-500/20" : ""}
                        >
                            <Star className={`w-4 h-4 mr-2 ${candidate.is_shortlisted ? "fill-amber-500" : ""}`} />
                            {candidate.is_shortlisted ? "Starred" : "Shortlist"}
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-lg border border-border/50">
                            <Briefcase className="w-4 h-4" />
                            {candidate.candidate?.current_company || "Unknown Co."}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-lg border border-border/50">
                            <MapPin className="w-4 h-4" />
                            {candidate.candidate?.location || "Unknown Loc."}
                        </div>
                        {candidate.candidate?.experience_years && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-lg border border-border/50">
                                <Award className="w-4 h-4" />
                                {candidate.candidate.experience_years} Years Experience
                            </div>
                        )}
                        {candidate.professional_footprint?.overall_footprint_assessment?.presence_level && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <Globe className="w-4 h-4 text-blue-500" />
                                {candidate.professional_footprint.overall_footprint_assessment.presence_level} Online Presence
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Match Score</div>
                    <div className="flex items-baseline gap-3">
                        <div className={`text-4xl font-bold tracking-tight ${score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                            {score}%
                        </div>
                        <Badge variant="outline" className="text-xs font-normal h-6">
                            {candidate.match_analysis?.match_label || "Analyzed"}
                        </Badge>
                    </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Response Likelihood</div>
                    <div className="flex items-baseline gap-3">
                        <div className={`text-4xl font-bold tracking-tight ${responseScore >= 70 ? 'text-green-500' :
                            responseScore >= 50 ? 'text-blue-500' :
                                'text-amber-500'
                            }`}>
                            {responseScore}%
                        </div>
                        <Badge variant="outline" className="text-xs font-normal h-6">
                            {candidate.response_likelihood?.likelihood_label || "Unknown"}
                        </Badge>
                    </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                    <div className="text-sm font-medium text-muted-foreground mb-2">Estimated CTC</div>
                    <div className="text-4xl font-bold font-mono tracking-tight text-foreground">
                        ₹{getSalary(candidate)}L
                    </div>
                    {candidate.salary_estimation?.current_estimated_ctc && (
                        <div className="text-xs text-muted-foreground mt-1">
                            Range: ₹{candidate.salary_estimation.current_estimated_ctc.low}L - ₹{candidate.salary_estimation.current_estimated_ctc.high}L
                        </div>
                    )}
                </div>
            </div>

            {/* AI Recommendation Summary */}
            {candidate.match_analysis?.summary && (
                <div className="relative overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-background to-purple-500/5 p-6 shadow-sm">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Bot className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-base font-semibold text-violet-400 flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5" /> AI Recommendation
                        </h3>
                        <div className="text-base text-foreground/90 leading-relaxed">
                            <Quote className="w-5 h-5 text-violet-400/50 mb-2" />
                            <p className="italic">{candidate.match_analysis.summary}</p>
                        </div>
                        {candidate.response_likelihood?.recommended_approach?.should_reach_out && (
                            <div className="mt-4 pt-4 border-t border-violet-500/20">
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="w-4 h-4 text-violet-400" />
                                    <span className="font-medium text-violet-300">Recommended Channel:</span>
                                    <Badge variant="secondary" className="bg-violet-500/20 text-violet-300">
                                        {candidate.response_likelihood.recommended_approach.best_channel || 'Email'}
                                    </Badge>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-border/50">
                <div className="flex gap-1">
                    {[
                        { id: 'overview', label: 'Overview', icon: FileText },
                        { id: 'skills', label: 'Skills & Evidence', icon: Zap },
                        { id: 'salary', label: 'Salary & Career', icon: TrendingUp },
                        { id: 'response', label: 'Response Analysis', icon: MessageSquare },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'overview' && (
                    <>
                        {/* Strengths / Concerns */}
                        <section className="space-y-3">
                            <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                <Check className="w-5 h-5 text-green-500" /> Strengths & Concerns
                            </h3>
                            <div className="grid gap-3">
                                {candidate.match_analysis?.strengths?.map((s: any, i) => (
                                    <div key={i} className="flex gap-4 text-sm p-4 bg-green-500/5 border border-green-500/10 rounded-xl transition-all hover:bg-green-500/10 hover:border-green-500/20">
                                        <div className="bg-green-500/20 p-1.5 rounded-full h-fit">
                                            <Check className="w-4 h-4 text-green-500" />
                                        </div>
                                        <span className="text-foreground/90 leading-relaxed font-medium pt-0.5">
                                            {typeof s === 'string' ? s : s.strength}
                                        </span>
                                    </div>
                                ))}
                                {candidate.match_analysis?.concerns?.map((c: any, i) => (
                                    <div key={i} className="flex gap-4 text-sm p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl transition-all hover:bg-amber-500/10 hover:border-amber-500/20">
                                        <div className="bg-amber-500/20 p-1.5 rounded-full h-fit">
                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <span className="text-foreground/90 leading-relaxed font-medium pt-0.5">
                                            {typeof c === 'string' ? c : c.concern}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Availability */}
                        {candidate.availability && (
                            <section className="p-5 bg-card/60 border border-border/50 rounded-xl">
                                <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                    <Calendar className="w-5 h-5 text-primary" /> Availability
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-1">Notice Period</div>
                                        <div className="text-2xl font-bold">
                                            {candidate.availability.notice_period_days || candidate.availability.estimated_notice_days?.likely || "?"} days
                                        </div>
                                    </div>
                                    {candidate.availability.earliest_possible_start && (
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Earliest Start</div>
                                            <div className="text-lg font-semibold">
                                                {new Date(candidate.availability.earliest_possible_start).toLocaleDateString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {activeTab === 'skills' && (
                    <section className="space-y-6">
                        <div>
                            <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                <Zap className="w-5 h-5 text-yellow-500" /> Validated Skills
                                {candidate.skill_validation?.overall_confidence && (
                                    <Badge variant="secondary" className="ml-2">
                                        {candidate.skill_validation.overall_confidence}% Confidence
                                    </Badge>
                                )}
                            </h3>

                            {candidate.skill_validation?.evidence && candidate.skill_validation.evidence.length > 0 ? (
                                <div className="space-y-3">
                                    {candidate.skill_validation.evidence.map((skill, i) => (
                                        <div key={i} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-base">{skill.skill}</span>
                                                    {skill.evidence_strength && (
                                                        <Badge
                                                            variant={skill.evidence_strength === 'High' ? 'default' : 'secondary'}
                                                            className={skill.evidence_strength === 'High' ? 'bg-green-500' : ''}
                                                        >
                                                            {skill.evidence_strength}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className="text-xs">
                                                    {skill.evidence_type}
                                                </Badge>
                                            </div>
                                            {skill.details && (
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {skill.details}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    No detailed skill evidence available
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'salary' && (
                    <section className="space-y-6">
                        {/* Current Salary */}
                        <div className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl">
                            <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                <TrendingUp className="w-5 h-5 text-purple-500" /> Current Salary Estimation
                            </h3>
                            {candidate.salary_estimation?.current_estimated_ctc ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-2">Most Likely</div>
                                        <div className="text-4xl font-bold font-mono">
                                            ₹{candidate.salary_estimation.current_estimated_ctc.most_likely}L
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Conservative</div>
                                            <div className="text-xl font-bold font-mono">
                                                ₹{candidate.salary_estimation.current_estimated_ctc.low}L
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Optimistic</div>
                                            <div className="text-xl font-bold font-mono">
                                                ₹{candidate.salary_estimation.current_estimated_ctc.high}L
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">No salary data available</div>
                            )}
                        </div>

                        {/* Career Progression */}
                        {candidate.salary_estimation?.career_progression && candidate.salary_estimation.career_progression.length > 0 && (
                            <div>
                                <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-5 h-5 text-primary" /> Career Progression
                                </h3>
                                <div className="space-y-3">
                                    {candidate.salary_estimation.career_progression.map((job, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 bg-card/60 border border-border/50 rounded-xl">
                                            <div className="text-2xl font-bold text-muted-foreground/50">{job.year}</div>
                                            <div className="flex-1">
                                                <div className="font-semibold text-base">{job.title}</div>
                                                <div className="text-sm text-muted-foreground">{job.company}</div>
                                                {job.estimated_ctc && (
                                                    <div className="text-sm font-mono font-semibold text-primary mt-1">
                                                        ₹{job.estimated_ctc}L
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'response' && (
                    <section className="space-y-6">
                        {/* Response Factors */}
                        {candidate.response_likelihood?.factors && candidate.response_likelihood.factors.length > 0 && (
                            <div>
                                <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                    <MessageSquare className="w-5 h-5 text-blue-500" /> Response Factors
                                </h3>
                                <div className="space-y-3">
                                    {candidate.response_likelihood.factors.map((factor, i) => (
                                        <div key={i} className="p-4 bg-card/60 border border-border/50 rounded-xl">
                                            <div className="flex items-start justify-between mb-2">
                                                <span className="font-semibold">{factor.factor_name}</span>
                                                <Badge
                                                    variant={
                                                        factor.impact === 'Positive' ? 'default' :
                                                            factor.impact === 'Negative' ? 'destructive' : 'secondary'
                                                    }
                                                    className={
                                                        factor.impact === 'Positive' ? 'bg-green-500' : ''
                                                    }
                                                >
                                                    {factor.impact}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {factor.interpretation}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Professional Footprint */}
                        {candidate.professional_footprint?.overall_footprint_assessment && (
                            <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
                                    <Globe className="w-5 h-5 text-blue-500" /> Professional Footprint
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm text-muted-foreground mb-1">Online Presence Level</div>
                                        <div className="text-xl font-semibold">
                                            {candidate.professional_footprint.overall_footprint_assessment.presence_level}
                                        </div>
                                    </div>
                                    {candidate.professional_footprint.overall_footprint_assessment.notable_findings &&
                                        candidate.professional_footprint.overall_footprint_assessment.notable_findings.length > 0 && (
                                            <div>
                                                <div className="text-sm text-muted-foreground mb-2">Notable Findings</div>
                                                <ul className="space-y-2">
                                                    {candidate.professional_footprint.overall_footprint_assessment.notable_findings.map((finding, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm">
                                                            <Check className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                                            <span>{finding}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* Links Footer */}
            <section className="pt-6 border-t border-border/50">
                <h3 className="text-base font-semibold mb-4">Profile Links</h3>
                <div className="flex flex-wrap gap-3">
                    {candidate.candidate?.linkedin_url && (
                        <a
                            href={candidate.candidate.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 bg-[#0077b5]/10 hover:bg-[#0077b5]/20 border border-[#0077b5]/30 rounded-xl text-sm transition-colors font-medium"
                        >
                            <Linkedin className="w-5 h-5 text-[#0077b5]" />
                            LinkedIn Profile
                        </a>
                    )}
                    {candidate.professional_footprint?.verified_profiles?.map((p, i) => (
                        <a
                            key={i}
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 bg-secondary/80 hover:bg-secondary border border-border/50 rounded-xl text-sm transition-colors font-medium"
                        >
                            <ExternalLink className="w-5 h-5 text-muted-foreground" />
                            {p.platform}
                        </a>
                    ))}
                </div>
            </section>
        </div>
    );
}