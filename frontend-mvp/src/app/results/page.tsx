"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Download, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import * as resultsApi from "@/utils/api/resultsApiV2";
import { PollingManager } from "@/utils/polling";
import SearchProgressAnimation from "@/components/loading/SearchProgressAnimation";
import EnrichedCandidateCard from "@/components/results/EnrichedCandidateCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EnrichedCandidate, ProgressResponse } from "@/types";
import { useConversationWebSocket } from "@/hooks/useConversationWebSocket";


function ResultsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { token, isAuthenticated } = useAuth();
  const { candidates, setCandidates, pagination, setPagination } = useSearch();

  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    "match_score" | "salary" | "response_likelihood"
  >("match_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedCandidate, setSelectedCandidate] =
    useState<EnrichedCandidate | null>(null);
  const [shortlistedIds, setShortlistedIds] = useState<string[]>([]);
  const [searchProgress, setSearchProgress] = useState({
    status: 'searching',
    message: 'Searching...',
    progress: 0
  });

  const { isConnected } = useConversationWebSocket(
    sessionId,
    (update) => {
      setSearchProgress(update);
    },
    (results) => {
      // Search completed
      console.log("Search completed:", results);
    },
    (error) => {
      console.error("Search error:", error);
    }
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Redirect if no session ID
  useEffect(() => {
    if (!sessionId) {
      router.push("/search");
    }
  }, [sessionId, router]);

  // Poll for progress and fetch candidates
  useEffect(() => {
    if (!sessionId || !token) return;

    setIsLoading(true);
    setIsEnriching(true);

    const pollingManager = new PollingManager<ProgressResponse>(
      () => resultsApi.getProgress(sessionId, token),
      {
        interval: 2000,
        shouldStop: (data) => data.progress_percentage === 100,
        onUpdate: (data) => {
          setProgress(data.progress_percentage);
          setProgressMessage(
            data.current_candidate
              ? `Enriching ${data.current_candidate}...`
              : "Processing candidates..."
          );
        },
        onComplete: async () => {
          setProgress(100);
          setIsEnriching(false);

          try {
            // Fetch candidates
            const response = await resultsApi.getCandidates(sessionId, token, {
              page: 1,
              page_size: 20,
              sort_by: sortBy,
              sort_order: sortOrder,
            });

            setCandidates(response.candidates);
            setPagination(response.pagination);
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

    return () => {
      pollingManager.stop();
    };
  }, [sessionId, token, sortBy, sortOrder, setCandidates, setPagination]);

  // Handle export
  const handleExport = async (format: "csv" | "excel") => {
    if (!sessionId || !token) return;

    try {
      const blob = await resultsApi.exportResults(sessionId, token, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `candidates-${sessionId}.${format === "csv" ? "csv" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Handle shortlist toggle
  const handleShortlist = (candidateId: string) => {
    setShortlistedIds((prev) =>
      prev.includes(candidateId)
        ? prev.filter((id) => id !== candidateId)
        : [...prev, candidateId]
    );

    const shortlisted = shortlistedIds.includes(candidateId)
      ? shortlistedIds.filter((id) => id !== candidateId)
      : [...shortlistedIds, candidateId];

    localStorage.setItem("shortlistedCandidates", JSON.stringify(shortlisted));
  };

  // Load shortlisted from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("shortlistedCandidates");
    if (saved) {
      try {
        setShortlistedIds(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load shortlisted candidates:", err);
      }
    }
  }, []);

  // Show loading animation
  if (isLoading || isEnriching) {
    return (
      <SearchProgressAnimation
        progress={progress}
        message={progressMessage}
        estimatedTime={progress < 50 ? "2-3 minutes" : "1 minute"}
      />
    );
  }

  // Show error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="text-6xl">😞</div>
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push("/search")}>
            Back to Search
          </Button>
        </Card>
      </div>
    );
  }

  // Show empty state
  if (!candidates || candidates.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="text-6xl">🔍</div>
          <h2 className="text-2xl font-bold">No candidates found</h2>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or filters.
          </p>
          <Button onClick={() => router.push("/search")}>
            New Search
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Search Results</h1>
            <p className="text-muted-foreground mt-1">
              Found {pagination?.total_candidates || candidates.length}{" "}
              candidates matching your criteria
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/search")}
            >
              New Search
            </Button>
          </div>
        </div>

        {/* Filters and Sort */}
        <Card className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {shortlistedIds.length > 0 && (
                <Badge variant="secondary">
                  {shortlistedIds.length} Shortlisted
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <Select
                value={sortBy}
                onValueChange={(value: typeof sortBy) => setSortBy(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match_score">Match Score</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                  <SelectItem value="response_likelihood">
                    Response Likelihood
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortOrder}
                onValueChange={(value: typeof sortOrder) => setSortOrder(value)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Highest First</SelectItem>
                  <SelectItem value="asc">Lowest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Candidates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((candidate) => (
            <EnrichedCandidateCard
              key={candidate.candidate_id}
              candidate={candidate}
              onViewDetails={() => setSelectedCandidate(candidate)}
              onShortlist={() => handleShortlist(candidate.candidate_id)}
              isShortlisted={shortlistedIds.includes(candidate.candidate_id)}
            />
          ))}
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_prev}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_next}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Profile Detail Modal Placeholder */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">
                {selectedCandidate.first_name} {selectedCandidate.last_name}
              </h2>
              <p className="text-muted-foreground mb-4">
                Full profile details will be displayed here.
              </p>
              <Button onClick={() => setSelectedCandidate(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <SearchProgressAnimation progress={0} message="Loading results..." />
      }
    >
      <ResultsPageContent />
    </Suspense>
  );
}