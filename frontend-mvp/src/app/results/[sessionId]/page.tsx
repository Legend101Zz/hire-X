// app/results/[sessionId]/page.tsx (NEW FILE)

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle,
    Clock,
    TrendingUp,
    Sparkles,
    Download,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import * as resultsApi from "@/utils/api/resultsApi";
import type { EnrichedCandidate } from "@/types";

export default function ResultsPage() {
    const params = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const sessionId = params.sessionId as string;

    const [isLoading, setIsLoading] = useState(true);
    const [progress, setProgress] = useState<any>(null);
    const [results, setResults] = useState<any>(null);
    const [candidates, setCandidates] = useState<EnrichedCandidate[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Poll for progress
    useEffect(() => {
        if (!sessionId || !token) return;

        const pollProgress = async () => {
            try {
                const progressData = await resultsApi.getProgress(sessionId, token);
                setProgress(progressData);

                if (progressData.status === "completed") {
                    // Load full results
                    const resultsData = await resultsApi.getResults(sessionId, token);
                    setResults(resultsData);

                    const candidatesData = await resultsApi.getCandidates(sessionId, token);
                    setCandidates(candidatesData.candidates);

                    setIsLoading(false);
                } else if (progressData.status === "failed") {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error polling progress:", error);
            }
        };

        // Poll every 2 seconds
        const interval = setInterval(pollProgress, 2000);

        // Initial poll
        pollProgress();

        return () => clearInterval(interval);
    }, [sessionId, token]);

    const toggleRow = (candidateId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(candidateId)) {
            newExpanded.delete(candidateId);
        } else {
            newExpanded.add(candidateId);
        }
        setExpandedRows(newExpanded);
    };

    const handleExport = async () => {
        try {
            const response = await resultsApi.exportResults(sessionId, token, "csv");
            // Trigger download
            const blob = new Blob([response], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `candidates_${sessionId}.csv`;
            a.click();
        } catch (error) {
            console.error("Export error:", error);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center max-w-md"
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 mx-auto mb-6"
                    >
                        <Sparkles className="w-full h-full text-amber-500" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-4">Enriching Candidates</h2>
                    <p className="text-slate-400 mb-6">{progress?.message || "Starting enrichment..."}</p>

                    {progress && (
                        <div className="space-y-3">
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress.progress_percentage}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                            <p className="text-sm text-slate-500">
                                {progress.enriched_count} / {progress.total_candidates} candidates enriched
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Button
                        variant="ghost"
                        onClick={() => router.push("/search")}
                        className="mb-4 text-slate-400 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Search
                    </Button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2">Enriched Results</h1>
                            <p className="text-slate-400">
                                {results?.total_found} candidates found • {results?.enriched_count} fully enriched
                            </p>
                        </div>

                        <Button
                            onClick={handleExport}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export to CSV
                        </Button>
                    </div>
                </div>

                {/* Candidates Table */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Candidate</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Match</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Salary</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Response</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Availability</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidates.map((candidate) => (
                                <>
                                    <motion.tr
                                        key={candidate.candidate_id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="border-t border-slate-800 hover:bg-slate-800/30 cursor-pointer"
                                        onClick={() => toggleRow(candidate.candidate_id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-white">
                                                    {candidate.first_name} {candidate.last_name}
                                                </p>
                                                <p className="text-sm text-slate-400">{candidate.title}</p>
                                                <p className="text-xs text-slate-500">{candidate.location}</p>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <Badge
                                                className={`${candidate.match_label === "Excellent Match"
                                                        ? "bg-green-500/20 text-green-400"
                                                        : candidate.match_label === "Great Match"
                                                            ? "bg-blue-500/20 text-blue-400"
                                                            : "bg-amber-500/20 text-amber-400"
                                                    }`}
                                            >
                                                {candidate.match_label}
                                            </Badge>
                                        </td>

                                        <td className="px-6 py-4">
                                            {candidate.salary_enrichment ? (
                                                <div className="text-sm">
                                                    <p className="text-white font-medium">
                                                        ₹{candidate.salary_enrichment.current_estimated_ctc}L
                                                    </p>
                                                    <p className="text-xs text-slate-400">Current</p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            {candidate.response_likelihood ? (
                                                <div className="text-sm">
                                                    <p className="text-white font-medium">
                                                        {candidate.response_likelihood.overall_score}/100
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        {candidate.response_likelihood.likelihood_label}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            {candidate.availability ? (
                                                <div className="text-sm">
                                                    <p className="text-white">{candidate.availability.notice_period}</p>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            {expandedRows.has(candidate.candidate_id) ? (
                                                <ChevronUp className="w-5 h-5 text-slate-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-slate-400" />
                                            )}
                                        </td>
                                    </motion.tr>

                                    {/* Expanded Row */}
                                    <AnimatePresence>
                                        {expandedRows.has(candidate.candidate_id) && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-slate-800/20"
                                            >
                                                <td colSpan={6} className="px-6 py-6">
                                                    <div className="grid grid-cols-3 gap-6">
                                                        {/* Salary Details */}
                                                        {candidate.salary_enrichment && (
                                                            <div className="bg-slate-900/50 rounded-lg p-4">
                                                                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                                                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                                                    Career Progression
                                                                </h4>
                                                                <div className="space-y-3">
                                                                    {candidate.salary_enrichment.career_progression.map((entry, idx) => (
                                                                        <div key={idx} className="text-sm">
                                                                            <p className="text-white font-medium">{entry.role}</p>
                                                                            <p className="text-slate-400">{entry.company}</p>
                                                                            <p className="text-xs text-slate-500">{entry.duration}</p>
                                                                            <p className="text-green-400 font-medium mt-1">
                                                                                ₹{entry.estimated_ctc_range}L
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Response Likelihood */}
                                                        {candidate.response_likelihood && (
                                                            <div className="bg-slate-900/50 rounded-lg p-4">
                                                                <h4 className="font-semibold text-white mb-3">Response Analysis</h4>
                                                                <div className="space-y-2">
                                                                    {candidate.response_likelihood.factors.map((factor, idx) => (
                                                                        <div key={idx} className="text-sm">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-slate-300">{factor.factor}</span>
                                                                                <span className="text-white font-medium">
                                                                                    {factor.score}/10
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs text-slate-500 mt-1">{factor.notes}</p>
                                                                        </div>
                                                                    ))}
                                                                    <div className="mt-4 pt-4 border-t border-slate-700">
                                                                        <p className="text-sm text-slate-400">
                                                                            {candidate.response_likelihood.recommended_approach}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Skills Validation */}
                                                        {candidate.skill_validation && (
                                                            <div className="bg-slate-900/50 rounded-lg p-4">
                                                                <h4 className="font-semibold text-white mb-3">Validated Skills</h4>
                                                                <div className="space-y-3">
                                                                    {candidate.skill_validation.evidence.map((evidence, idx) => (
                                                                        <div key={idx} className="text-sm">
                                                                            <p className="text-white font-medium">{evidence.skill}</p>
                                                                            <p className="text-slate-400 text-xs">{evidence.evidence_type}</p>

                                                                            href={evidence.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-400 hover:text-blue-300 text-xs"
                                      >
                                                                            View Evidence →
                                                                        </a>
                                    </div>
                                  ))}
                                                            </div>
                              </div>
                            )}
                                                </div>
                                            </td>
                      </motion.tr>
                    )}
                                </AnimatePresence >
                </>
              ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div >
  );
}