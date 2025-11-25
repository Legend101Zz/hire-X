"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Download, ArrowLeft, ExternalLink, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as resultsApi from "@/utils/api/resultsApiV2";
import { PollingManager } from "@/utils/polling";
import SearchProgressAnimation from "@/components/loading/SearchProgressAnimation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import CareerTimeline from "@/components/results/CareerTimeline";
import SalaryChart from "@/components/results/SalaryChart";
import ResponseFactors from "@/components/results/ResponseFactors";
import SkillsValidation from "@/components/results/SkillsValidation";
import RecruiterSummary from "@/components/results/RecruiterSummary";
import type { EnrichedCandidate, ProgressResponse } from "@/types";

function ResultsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { token, isAuthenticated } = useAuth();

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EnrichedCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<EnrichedCandidate | null>(
    null
  );

  // Redirect guards
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
    if (!sessionId) {
      router.push("/search");
    }
  }, [isAuthenticated, sessionId, router]);

  // Poll for enrichment progress
  useEffect(() => {
    if (!sessionId || !token) return;

    setIsLoading(true);
    setIsEnriching(true);

    const pollingManager = new PollingManager<ProgressResponse>(
      () => resultsApi.getProgress(sessionId, token),
      {
        interval: 2000,
        shouldStop: (data) => {
          return (
            data.progress_percentage === 100 ||
            (data as any).status === "completed" ||
            (data as any).status === "failed"
          );
        },
        onUpdate: (data) => {
          setProgress(data.progress_percentage);
          setProgressMessage(
            data.current_candidate ||
            `Enriched ${data.enriched_count} of ${data.total_candidates} candidates...`
          );
        },
        onComplete: async (finalData) => {
          setProgress(100);
          setProgressMessage("Enrichment complete!");
          setIsEnriching(false);

          if ((finalData as any).status === "failed") {
            setError("Enrichment failed. Please try again.");
            setIsLoading(false);
            return;
          }

          try {
            const response = await resultsApi.getCandidates(sessionId, token, {
              page: 1,
              page_size: 20,
              sort_by: "match_score",
              sort_order: "desc",
            });

            setCandidates(response.candidates);
            if (response.candidates.length > 0) {
              setSelectedCandidate(response.candidates[0]);
            }
            setIsLoading(false);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Failed to load candidates"
            );
            setIsLoading(false);
          }
        },
        onError: (err) => {
          setError(err.message);
          setIsLoading(false);
          setIsEnriching(false);
        },
      }
    );

    pollingManager.start();
    return () => pollingManager.stop();
  }, [sessionId, token]);

  // Handle export
  const handleExport = async () => {
    if (!sessionId || !token) return;

    try {
      const blob = await resultsApi.exportResults(sessionId, token, "csv", true);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enriched-candidates-${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Loading state
  if (isLoading && isEnriching) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <SearchProgressAnimation
          progress={progress}
          message={progressMessage}
          stage="enriching"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center bg-slate-900 border-slate-700">
          <h2 className="text-xl font-bold text-red-500 mb-4">Error</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <Button onClick={() => router.push("/search")}>Back to Search</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/search")}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Sparkles className="w-8 h-8 text-amber-500" />
                  Enriched Candidates
                </h1>
                <p className="text-slate-400 mt-1">
                  {candidates.length} candidates • Fully enriched with AI insights
                </p>
              </div>
            </div>

            <Button
              onClick={handleExport}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Candidate List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-400" />
              Top Candidates
            </h2>

            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
              {candidates.map((candidate, index) => (
                <motion.div
                  key={candidate.candidate_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => setSelectedCandidate(candidate)}
                  className={`cursor-pointer rounded-xl p-4 border transition-all ${selectedCandidate?.candidate_id === candidate.candidate_id
                    ? "bg-violet-500/10 border-violet-500/50 shadow-lg shadow-violet-500/20"
                    : "bg-slate-800/30 border-slate-700/30 hover:border-violet-500/30 hover:bg-slate-800/50"
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">
                        {candidate.first_name} {candidate.last_name}
                      </h3>
                      <p className="text-sm text-slate-400">{candidate.title}</p>
                      <p className="text-xs text-slate-500">{candidate.location}</p>
                    </div>
                    <Badge
                      className={`${candidate.match_label === "Excellent Match"
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : candidate.match_label === "Great Match"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}
                    >
                      {candidate.match_score}
                    </Badge>
                  </div>

                  {candidate.salary_enrichment && (
                    <div className="mt-2 text-xs text-slate-400">
                      CTC: ₹{candidate.salary_enrichment.current_estimated_ctc}L
                    </div>
                  )}

                  {candidate.recruiter_summary && (
                    <div className="mt-2">
                      <Badge
                        className={`text-xs ${candidate.recruiter_summary.overall_recommendation ===
                          "Strong Yes"
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : candidate.recruiter_summary.overall_recommendation === "Yes"
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            : candidate.recruiter_summary.overall_recommendation ===
                              "Maybe"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}
                      >
                        {candidate.recruiter_summary.overall_recommendation}
                      </Badge>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Content - Selected Candidate Details */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedCandidate ? (
                <motion.div
                  key={selectedCandidate.candidate_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="bg-slate-900/50 border-slate-700/50 p-8">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                          {selectedCandidate.first_name} {selectedCandidate.last_name}
                        </h2>
                        <p className="text-xl text-slate-300 mb-1">
                          {selectedCandidate.title}
                        </p>
                        <p className="text-slate-400">
                          {selectedCandidate.company} • {selectedCandidate.location}
                        </p>
                      </div>

                      {selectedCandidate.linkedin_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-blue-500/30 hover:bg-blue-500/10"
                        >
                          <a
                            href={selectedCandidate.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            LinkedIn
                          </a>
                        </Button>
                      )}
                    </div>

                    {/* Match Info */}
                    <div className="mb-8 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Match Quality</p>
                          <p className="text-2xl font-bold text-white">
                            {selectedCandidate.match_label}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-bold text-violet-400">
                            {selectedCandidate.match_score}
                          </p>
                          <p className="text-sm text-slate-400">/ 100</p>
                        </div>
                      </div>
                      {selectedCandidate.match_reason && (
                        <p className="text-sm text-slate-300 mt-3">
                          {selectedCandidate.match_reason}
                        </p>
                      )}
                    </div>

                    {/* Tabs for Different Sections */}
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-5 bg-slate-800/50">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="career">Career</TabsTrigger>
                        <TabsTrigger value="skills">Skills</TabsTrigger>
                        <TabsTrigger value="response">Response</TabsTrigger>
                        <TabsTrigger value="availability">Availability</TabsTrigger>
                      </TabsList>

                      {/* Summary Tab */}
                      <TabsContent value="summary" className="space-y-6 mt-6">
                        {selectedCandidate.recruiter_summary ? (
                          <RecruiterSummary summary={selectedCandidate.recruiter_summary} />
                        ) : (
                          <div className="text-center text-slate-400 py-12">
                            No recruiter summary available
                          </div>
                        )}
                      </TabsContent>

                      {/* Career Tab */}
                      <TabsContent value="career" className="space-y-6 mt-6">
                        {selectedCandidate.salary_enrichment ? (
                          <>
                            <SalaryChart
                              progression={
                                selectedCandidate.salary_enrichment.career_progression
                              }
                            />
                            <CareerTimeline
                              progression={
                                selectedCandidate.salary_enrichment.career_progression
                              }
                              currentCTC={
                                selectedCandidate.salary_enrichment.current_estimated_ctc
                              }
                              growthRate={
                                selectedCandidate.salary_enrichment.average_annual_growth
                              }
                            />
                          </>
                        ) : (
                          <div className="text-center text-slate-400 py-12">
                            No career data available
                          </div>
                        )}
                      </TabsContent>

                      {/* Skills Tab */}
                      <TabsContent value="skills" className="mt-6">
                        {selectedCandidate.skill_validation ? (
                          <SkillsValidation
                            validation={selectedCandidate.skill_validation}
                          />
                        ) : (
                          <div className="text-center text-slate-400 py-12">
                            No skill validation available
                          </div>
                        )}
                      </TabsContent>

                      {/* Response Tab */}
                      <TabsContent value="response" className="mt-6">
                        {selectedCandidate.response_likelihood ? (
                          <ResponseFactors
                            factors={selectedCandidate.response_likelihood.factors}
                            overallScore={
                              selectedCandidate.response_likelihood.overall_score
                            }
                            recommendedApproach={
                              selectedCandidate.response_likelihood.recommended_approach
                            }
                          />
                        ) : (
                          <div className="text-center text-slate-400 py-12">
                            No response analysis available
                          </div>
                        )}
                      </TabsContent>

                      {/* Availability Tab */}
                      <TabsContent value="availability" className="mt-6">
                        {selectedCandidate.availability ? (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                                <p className="text-sm text-slate-400 mb-1">
                                  Notice Period
                                </p>
                                <p className="text-xl font-bold text-white">
                                  {selectedCandidate.availability.notice_period}
                                </p>
                              </div>
                              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                                <p className="text-sm text-slate-400 mb-1">
                                  Urgency Score
                                </p>
                                <p className="text-xl font-bold text-white">
                                  {selectedCandidate.availability.urgency_score}/10
                                </p>
                              </div>
                            </div>

                            {selectedCandidate.availability.job_search_signals.length >
                              0 && (
                                <div>
                                  <h5 className="font-semibold text-white mb-3">
                                    Job Search Signals
                                  </h5>
                                  <ul className="space-y-2">
                                    {selectedCandidate.availability.job_search_signals.map(
                                      (signal, index) => (
                                        <li key={index} className="text-slate-300">
                                          • {signal}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}

                            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                              <p className="text-sm text-slate-400 mb-1">
                                Estimated Availability
                              </p>
                              <p className="text-white">
                                {selectedCandidate.availability.estimated_availability}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-slate-400 py-12">
                            No availability data
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </Card>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <p className="text-slate-400">Select a candidate to view details</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div >
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <p className="text-slate-400">Loading results...</p>
        </div>
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}