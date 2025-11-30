"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Download, Search, Filter, ChevronRight,
    Briefcase, MapPin, DollarSign, Clock, CheckCircle,
    AlertTriangle, Globe, Github, Linkedin, ExternalLink,
    Brain, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import * as resultsApi from "@/utils/api/resultsApi";

// --- Types ---
interface DeepDiveResult {
    candidate: any;
    match_analysis: any;
    salary_timeline: any;
    skill_validation: any;
    response_likelihood: any;
    notice_period: any;
    professional_footprint: any;
    processing_time_seconds: number;
}

export default function ResultsPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const sessionId = params.sessionId as string;

    const [isLoading, setIsLoading] = useState(true);
    const [candidates, setCandidates] = useState<DeepDiveResult[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [stats, setStats] = useState({ total: 0, enriched: 0 });

    // Load Data
    useEffect(() => {
        if (!sessionId || !token) return;

        const fetchData = async () => {
            try {
                // 1. Check progress/status first
                const progress = await resultsApi.getProgress(sessionId, token);

                // 2. Fetch candidates
                const data = await resultsApi.getCandidates(sessionId, token);

                if (data.candidates) {
                    setCandidates(data.candidates);
                    setStats({
                        total: progress.total || data.candidates.length,
                        enriched: progress.completed || data.candidates.length
                    });

                    // Select first candidate by default
                    if (data.candidates.length > 0) {
                        setSelectedId(data.candidates[0].candidate.linkedin_id || data.candidates[0].candidate_id);
                    }
                }
            } catch (error) {
                console.error("Error loading results:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [sessionId, token]);

    const selectedCandidate = candidates.find(c =>
        (c.candidate?.linkedin_id || c.candidate?.profile_id || c.candidate_id) === selectedId
    );

    const handleExport = async () => {
        if (!token) return;
        try {
            const blob = await resultsApi.exportResults(sessionId, token, "csv");
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `deep_dive_results_${sessionId}.csv`;
            a.click();
        } catch (e) {
            console.error("Export failed", e);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading analysis results...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            {/* Header */}
            <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/search")} className="text-slate-400">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div className="h-6 w-px bg-slate-800" />
                    <h1 className="font-semibold text-white">Deep Dive Results</h1>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                        {candidates.length} Candidates Enriched
                    </Badge>
                </div>
                <Button onClick={handleExport} className="bg-green-600 hover:bg-green-500 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                </Button>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: Candidate List */}
                <div className="w-1/3 border-r border-slate-800 bg-slate-900/30 flex flex-col">
                    <div className="p-4 border-b border-slate-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filter candidates..."
                                className="w-full bg-slate-800 border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {candidates.map((item, idx) => {
                            const c = item.candidate || {};
                            const match = item.match_analysis || {};
                            const id = c.linkedin_id || c.profile_id || item.candidate_id || idx.toString();
                            const isSelected = id === selectedId;

                            return (
                                <div
                                    key={id}
                                    onClick={() => setSelectedId(id)}
                                    className={`p-4 rounded-xl cursor-pointer border transition-all ${isSelected
                                            ? "bg-amber-500/10 border-amber-500/50"
                                            : "bg-slate-800/20 border-transparent hover:bg-slate-800/50"
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-semibold ${isSelected ? "text-amber-400" : "text-white"}`}>
                                            {c.full_name || "Unknown Candidate"}
                                        </h3>
                                        <Badge className={getScoreColor(match.overall_match_score)}>
                                            {match.overall_match_score || 0}%
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-1 mb-2">{c.headline}</p>

                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                            {item.salary_timeline?.current_estimated_ctc?.most_likely
                                                ? `₹${item.salary_timeline.current_estimated_ctc.most_likely}L`
                                                : "Salary Unknown"}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                            {item.notice_period?.estimated_notice_days?.likely || "?"} days notice
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content: Detailed View */}
                <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
                    {selectedCandidate ? (
                        <div className="max-w-4xl mx-auto space-y-8">
                            <CandidateHeader data={selectedCandidate} />

                            <div className="grid grid-cols-2 gap-6">
                                <MatchAnalysisCard data={selectedCandidate.match_analysis} />
                                <ResponseCard data={selectedCandidate.response_likelihood} />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <SkillsCard data={selectedCandidate.skill_validation} />
                                <SalaryCard data={selectedCandidate.salary_timeline} notice={selectedCandidate.notice_period} />
                            </div>

                            <FootprintCard data={selectedCandidate.professional_footprint} />
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            Select a candidate to view details
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Sub-components ---

function CandidateHeader({ data }: { data: DeepDiveResult }) {
    const c = data.candidate || {};
    return (
        <div className="flex items-start gap-6 pb-6 border-b border-slate-800">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-amber-900/20">
                {c.full_name?.[0]}
            </div>
            <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">{c.full_name}</h1>
                <p className="text-lg text-slate-400 mb-4">{c.headline}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        {c.current_company}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {c.location}
                    </div>
                    {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-400 hover:underline">
                            <Linkedin className="w-4 h-4" />
                            LinkedIn Profile
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function MatchAnalysisCard({ data }: { data: any }) {
    if (!data) return null;
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                AI Match Analysis
            </h3>

            <div className="flex items-center gap-4 mb-6">
                <div className="text-4xl font-bold text-purple-400">{data.overall_match_score}%</div>
                <div>
                    <div className="text-sm font-medium text-white">{data.match_label}</div>
                    <div className="text-xs text-slate-400">Overall Fit Score</div>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Strengths</h4>
                    <div className="space-y-2">
                        {data.strengths?.map((s: any, i: number) => (
                            <div key={i} className="flex gap-2 text-sm text-slate-300">
                                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                <span>{typeof s === 'string' ? s : s.strength}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {data.concerns?.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">Concerns</h4>
                        <div className="space-y-2">
                            {data.concerns?.map((c: any, i: number) => (
                                <div key={i} className="flex gap-2 text-sm text-slate-300">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span>{typeof c === 'string' ? c : c.concern}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function SkillsCard({ data }: { data: any }) {
    if (!data) return null;
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Skill Validation
            </h3>

            <div className="mb-4">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-sm text-slate-400">Confidence</span>
                    <span className="text-sm font-medium text-white">{data.overall_confidence}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: `${data.overall_confidence}%` }} />
                </div>
            </div>

            <div className="space-y-3">
                {data.evidence?.slice(0, 4).map((item: any, i: number) => (
                    <div key={i} className="bg-slate-800/50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-slate-200">{item.skill}</span>
                            <Badge variant="outline" className="text-[10px] border-slate-600">
                                {item.evidence_strength || "Verified"}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-400">{item.evidence_description || item.evidence_type}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SalaryCard({ data, notice }: { data: any, notice: any }) {
    if (!data) return null;
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                Compensation & Notice
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="text-xs text-green-400 mb-1">Est. Current CTC</div>
                    <div className="text-xl font-bold text-white">
                        ₹{data.current_estimated_ctc?.most_likely || "0"}L
                    </div>
                    <div className="text-[10px] text-slate-400">
                        Range: {data.current_estimated_ctc?.low}-{data.current_estimated_ctc?.high}L
                    </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="text-xs text-blue-400 mb-1">Notice Period</div>
                    <div className="text-xl font-bold text-white">
                        {notice?.estimated_notice_days?.likely || "0"} Days
                    </div>
                    <div className="text-[10px] text-slate-400">
                        Start: {notice?.earliest_possible_start || "Unknown"}
                    </div>
                </div>
            </div>

            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">History</h4>
            <div className="space-y-3 relative before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-slate-800">
                {data.career_progression?.slice(0, 3).map((job: any, i: number) => (
                    <div key={i} className="pl-6 relative">
                        <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-slate-800 border-2 border-slate-600" />
                        <div className="text-sm font-medium text-white">{job.role}</div>
                        <div className="text-xs text-slate-400 flex justify-between">
                            <span>{job.company}</span>
                            <span className="text-green-500/70">~₹{job.estimated_ctc_high}L</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ResponseCard({ data }: { data: any }) {
    if (!data) return null;
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Response Likelihood
            </h3>

            <div className="flex items-center gap-3 mb-4">
                <div className={`text-2xl font-bold ${data.overall_score > 70 ? "text-green-400" : "text-amber-400"}`}>
                    {data.likelihood_label}
                </div>
                <div className="text-sm text-slate-500">({data.overall_score}/100)</div>
            </div>

            <div className="p-3 bg-slate-800/50 rounded-lg text-sm text-slate-300 mb-4">
                <span className="font-semibold text-blue-400">Recommendation: </span>
                {data.recommended_approach?.should_reach_out ? "Reach Out" : "Hold"}
            </div>

            <div className="space-y-2">
                {data.factors?.map((f: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-400">{f.factor_name}</span>
                        <span className={f.impact === "positive" ? "text-green-400" : "text-amber-400"}>
                            {f.interpretation}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FootprintCard({ data }: { data: any }) {
    if (!data) return null;
    const assessment = data.overall_footprint_assessment || {};

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                Digital Footprint
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-6">
                {data.verified_profiles?.map((p: any, i: number) => (
                    <a
                        key={i}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors group"
                    >
                        {p.platform.toLowerCase().includes('github') ? <Github className="w-5 h-5" /> :
                            p.platform.toLowerCase().includes('linkedin') ? <Linkedin className="w-5 h-5" /> :
                                <Globe className="w-5 h-5" />}
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-white truncate">{p.platform}</div>
                            <div className="text-xs text-slate-500 truncate group-hover:text-indigo-400">View Profile</div>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-600" />
                    </a>
                ))}
            </div>

            <div className="text-sm text-slate-300">
                <span className="font-semibold text-indigo-400">Assessment: </span>
                {assessment.presence_level} presence. {assessment.notable_findings?.[0]}
            </div>
        </div>
    );
}

// --- Helpers ---

function getScoreColor(score: number) {
    if (score >= 80) return "bg-green-500/20 text-green-400 border-green-500/50";
    if (score >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/50";
    return "bg-red-500/20 text-red-400 border-red-500/50";
}