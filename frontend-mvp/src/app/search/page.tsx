/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  MapPin,
  Briefcase,
  Building2,
  Sparkles,
  Upload,
  FileText,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Users,
  Brain,
  TrendingUp,
  FileCheck,
  Rocket,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  MessageSquare,
  Info,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import * as conversationApi from "@/utils/api/conversationApiV2";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

import { ManualImportPanel } from '@/components/search/ManualImportPanel';
import { WelcomeModal, useFirstTimeVisit } from '@/components/search/WelcomeModal';


export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isLoading: authLoading } = useAuth();
  const { setSessionId, setIdealProfile, setIsSearching, setSearchError } = useSearch();

  // First-time visit handling
  const { isFirstVisit, isLoading: visitLoading, markAsVisited } = useFirstTimeVisit();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // --- Global Page Mode State ---
  const [pageMode, setPageMode] = useState<"donna" | "manual">("donna");

  // --- Existing "Donna" Search State ---
  const [searchMode, setSearchMode] = useState<"text" | "jd">("text");
  const [query, setQuery] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filters, setFilters] = useState({
    locationEnabled: false,
    location: "",
    seniority: "",
    industry: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isValidInput, setIsValidInput] = useState(false);

  // JD Generation states
  const [jdGenerationMode, setJdGenerationMode] = useState(false);
  const [generatedJD, setGeneratedJD] = useState("");
  const [jdSessionId, setJdSessionId] = useState("");
  const [originalQuery, setOriginalQuery] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [showRefineInput, setShowRefineInput] = useState(false);
  const MAX_RETRIES = 2;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [useIntelligentSearch, setUseIntelligentSearch] = useState(true);

  // Show welcome modal for first-time visitors
  useEffect(() => {
    if (!visitLoading && isFirstVisit) {
      setShowWelcomeModal(true);
    }
  }, [visitLoading, isFirstVisit]);

  // 3. Effect to handle URL params (e.g. /search?mode=manual)
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "manual") {
      setPageMode("manual");
    } else if (modeParam === "donna") {
      setPageMode("donna");
    }
  }, [searchParams]);

  const handleWelcomeClose = () => {
    setShowWelcomeModal(false);
    markAsVisited();
  };

  const handleModeSelectFromWelcome = (mode: 'donna' | 'manual') => {
    setPageMode(mode);
    markAsVisited();
  };

  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/login");
    }
  }, [token, router, authLoading]);

  // Validate input
  useEffect(() => {
    if (searchMode === "text") {
      setIsValidInput(query.trim().length > 0);
    } else {
      setIsValidInput(jdFile !== null);
    }
  }, [searchMode, query, jdFile]);

  // Track mouse position for spotlight effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    const card = cardRef.current;
    if (card) {
      card.addEventListener("mousemove", handleMouseMove);
      return () => card.removeEventListener("mousemove", handleMouseMove);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
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

  const handleSearch = async () => {
    if (!isValidInput) {
      setError(
        searchMode === "text"
          ? "Please enter a search query"
          : "Please upload a job description file"
      );
      return;
    }

    if (!token) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let filterContext = "";
      if (filters.locationEnabled && filters.location) filterContext += `\nLocation: ${filters.location}`;
      if (filters.seniority) filterContext += `\nSeniority: ${filters.seniority}`;
      if (filters.industry) filterContext += `\nIndustry: ${filters.industry}`;
      if (useIntelligentSearch) filterContext += `\n[System: Use Intelligent Multi-agent Search]`;

      if (searchMode === "jd" && jdFile) {
        const reader = new FileReader();
        reader.readAsDataURL(jdFile);
        await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
        });
        const base64 = (reader.result as string).split(",")[1];

        const response = await conversationApi.startConversation(token, {
          jd_file_content: base64,
          jd_file_name: jdFile.name,
          initial_message: filterContext.trim()
        });

        router.push(`/conversation?session=${response.session_id}`);
      } else {
        setOriginalQuery(query);
        const enhancedQuery = `${query} ${filterContext}`;
        const jdResponse = await conversationApi.generateJD(token, enhancedQuery);
        setGeneratedJD(jdResponse.jd_text);
        setJdSessionId(jdResponse.session_id);
        setJdGenerationMode(true);
        setRetryCount(0);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefineJD = async () => {
    if (!refineFeedback.trim()) {
      setError("Please provide feedback on what to improve");
      return;
    }

    if (retryCount >= MAX_RETRIES) {
      setError("Maximum refinement attempts reached");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const refineResponse = await conversationApi.refineJD(token!, {
        session_id: jdSessionId,
        original_query: originalQuery,
        previous_jd: generatedJD,
        feedback: refineFeedback,
        retry_count: retryCount,
      });

      setGeneratedJD(refineResponse.jd_text);
      setRetryCount(refineResponse.retry_count);
      setRefineFeedback("");
      setShowRefineInput(false);

      if (refineResponse.max_retries_reached) {
        setError("Maximum refinements reached. Proceeding with current JD.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedWithJD = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await conversationApi.startConversationWithJD(
        token!,
        generatedJD
      );
      router.push(`/conversation?session=${response.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start conversation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelJDGeneration = () => {
    setJdGenerationMode(false);
    setGeneratedJD("");
    setJdSessionId("");
    setRetryCount(0);
    setRefineFeedback("");
    setShowRefineInput(false);
  };

  const exampleQueries = [
    "Senior Full Stack Developer with React and Node.js",
    "Product Manager with SaaS experience in B2B",
    "Data Scientist with ML/AI expertise and Python",
    "DevOps Engineer with Kubernetes and AWS",
  ];

  return (
    <TooltipProvider>
      <div className="min-h-screen relative overflow-hidden bg-background">
        {/* Animated Background */}
        <AnimatedBackground />

        {/* Welcome Modal for First-Time Users */}
        <AnimatePresence>
          {showWelcomeModal && (
            <WelcomeModal
              onClose={handleWelcomeClose}
              onSelectMode={handleModeSelectFromWelcome}
            />
          )}
        </AnimatePresence>

        {/* Sticky Header */}
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            {/* Left: Dashboard Button */}
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="gap-2 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>

            {/* Center: Mode Toggle with Tooltips */}
            <div className="flex flex-col items-center">
              <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPageMode("donna")}
                      className={`gap-2 rounded-md transition-all duration-300 ${pageMode === "donna"
                        ? "bg-background shadow-sm text-foreground hover:bg-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                        }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat with Donna
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      Describe your ideal candidate or paste a job description. Donna will find, enrich, and help you reach out to the best matches.
                    </p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPageMode("manual")}
                      className={`gap-2 rounded-md transition-all duration-300 ${pageMode === "manual"
                        ? "bg-background shadow-sm text-foreground hover:bg-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                        }`}
                    >
                      <Upload className="w-4 h-4" />
                      Manual Import
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">
                      Already have candidates in mind? Add their LinkedIn profiles here. We'll pull in details and help you evaluate them.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Helper text below toggle */}
              <p className="text-xs text-muted-foreground mt-1.5 hidden sm:block">
                {pageMode === "donna"
                  ? "Describe who you need — Donna handles the rest"
                  : "Add candidates you've already found"}
              </p>
            </div>

            {/* Right: Spacer */}
            <div className="w-[100px] flex justify-end">
              {/* Optional: Add user avatar here */}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {pageMode === "donna" ? (
              <motion.div
                key="donna-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header with animation */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center mb-12 space-y-6 pt-8"
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary backdrop-blur-sm"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span className="font-medium">AI-Powered Talent Search</span>
                  </motion.div>

                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                    Find Your Next{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-pink-400 animate-gradient">
                      Star Candidate
                    </span>
                  </h1>

                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Tell Donna about your ideal hire, and she'll find the perfect matches. It's like texting a really smart recruiting assistant.
                  </p>
                </motion.div>

                {/* Main Search Content */}
                <AnimatePresence mode="wait">
                  {jdGenerationMode ? (
                    // JD Review & Refinement UI
                    <motion.div
                      key="jd-review"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="max-w-4xl mx-auto space-y-6"
                    >
                      <Card className="shadow-2xl border-border/50 backdrop-blur-xl bg-card/80">
                        <CardContent className="p-8 space-y-6">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-2xl font-bold flex items-center gap-2">
                                <FileCheck className="w-6 h-6 text-primary" />
                                Here's what I understood
                              </h2>
                              <p className="text-sm text-muted-foreground mt-1">
                                Look good? You can tweak it or let's start finding matches.
                              </p>
                            </div>
                            <Badge
                              variant={retryCount >= MAX_RETRIES ? "destructive" : "secondary"}
                              className="text-sm px-3 py-1"
                            >
                              {retryCount}/{MAX_RETRIES} refinements used
                            </Badge>
                          </div>

                          <Separator />

                          {/* JD Text Area */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-base font-semibold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                Job Description
                              </Label>
                              <span className="text-xs text-muted-foreground">
                                {generatedJD.length} characters
                              </span>
                            </div>

                            <Textarea
                              value={generatedJD}
                              onChange={(e) => setGeneratedJD(e.target.value)}
                              className="min-h-[400px] font-mono text-sm resize-none focus:ring-2 focus:ring-primary/20 transition-all"
                              placeholder="Generated JD will appear here..."
                              disabled={isLoading}
                            />

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              <span>Feel free to edit directly — you're in control</span>
                            </div>
                          </div>

                          {/* Error Message */}
                          <AnimatePresence>
                            {error && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3"
                              >
                                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                <p className="text-destructive text-sm font-medium">{error}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Refinement Input Section */}
                          <AnimatePresence>
                            {showRefineInput && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-3 overflow-hidden"
                              >
                                <Separator />

                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-3">
                                  <Label className="text-base font-semibold flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    What should we change?
                                  </Label>

                                  <Textarea
                                    value={refineFeedback}
                                    onChange={(e) => setRefineFeedback(e.target.value)}
                                    className="min-h-[120px] resize-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g., 'Add more focus on React experience' or 'Make the requirements less strict'..."
                                    disabled={isLoading}
                                  />

                                  <div className="flex gap-2">
                                    <Button
                                      onClick={handleRefineJD}
                                      disabled={isLoading || !refineFeedback.trim()}
                                      className="flex-1 bg-primary hover:bg-primary/90"
                                    >
                                      {isLoading ? (
                                        <span className="flex items-center gap-2">
                                          <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                          >
                                            <Sparkles className="w-4 h-4" />
                                          </motion.div>
                                          Updating...
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-2">
                                          <Sparkles className="w-4 h-4" />
                                          Update JD ({MAX_RETRIES - retryCount} left)
                                        </span>
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setShowRefineInput(false);
                                        setRefineFeedback("");
                                      }}
                                      disabled={isLoading}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <Separator />

                          {/* Action Buttons */}
                          <div className="flex gap-3">
                            <motion.div
                              className="flex-1"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Button
                                onClick={handleProceedWithJD}
                                disabled={isLoading || !generatedJD.trim()}
                                className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg shadow-green-500/20"
                              >
                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                Looks Good — Find Candidates
                              </Button>
                            </motion.div>

                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Button
                                variant="outline"
                                onClick={() => setShowRefineInput(!showRefineInput)}
                                disabled={isLoading || retryCount >= MAX_RETRIES}
                                className="h-12 px-6 border-2"
                              >
                                <Sparkles className="w-5 h-5 mr-2" />
                                {retryCount >= MAX_RETRIES ? "Max Retries" : "Refine"}
                              </Button>
                            </motion.div>

                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Button
                                variant="ghost"
                                onClick={handleCancelJDGeneration}
                                disabled={isLoading}
                                className="h-12 px-6"
                              >
                                <X className="w-5 h-5 mr-2" />
                                Start Over
                              </Button>
                            </motion.div>
                          </div>

                          {/* Max Retries Warning */}
                          {retryCount >= MAX_RETRIES && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3"
                            >
                              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-yellow-600 dark:text-yellow-400 text-sm font-semibold">
                                  Maximum refinements reached
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  You can still edit the text directly above, or proceed with the current version.
                                </p>
                              </div>
                            </motion.div>
                          )}

                          {/* Info Card */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3"
                          >
                            <Lightbulb className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-blue-600 dark:text-blue-400 font-medium">
                                Quick tip
                              </p>
                              <p className="text-muted-foreground text-xs mt-1">
                                The more specific your requirements, the better matches you'll get. Don't worry about getting it perfect — Donna will ask clarifying questions if needed.
                              </p>
                            </div>
                          </motion.div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    // Normal Search UI
                    <motion.div
                      key="search"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="max-w-4xl mx-auto"
                    >
                      <Card
                        ref={cardRef}
                        className="shadow-2xl border-border/50 backdrop-blur-xl bg-card/80 spotlight"
                        style={
                          {
                            "--mouse-x": `${mousePosition.x}px`,
                            "--mouse-y": `${mousePosition.y}px`,
                          } as React.CSSProperties
                        }
                      >
                        <CardContent className="p-8 space-y-6">
                          {/* Search Mode Toggle */}
                          <div className="flex items-center justify-center gap-2 p-1 bg-muted/50 rounded-lg w-fit mx-auto">
                            <Button
                              variant={searchMode === "text" ? "default" : "ghost"}
                              size="sm"
                              onClick={() => setSearchMode("text")}
                              className="gap-2"
                            >
                              <Search className="w-4 h-4" />
                              Describe Role
                            </Button>
                            <Button
                              variant={searchMode === "jd" ? "default" : "ghost"}
                              size="sm"
                              onClick={() => setSearchMode("jd")}
                              className="gap-2"
                            >
                              <Upload className="w-4 h-4" />
                              Upload JD
                            </Button>
                          </div>

                          <AnimatePresence mode="wait">
                            {searchMode === "text" ? (
                              <motion.div
                                key="text"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                              >
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="search"
                                    className="text-base font-semibold"
                                  >
                                    Tell me about your ideal candidate
                                  </Label>
                                  <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                      id="search"
                                      value={query}
                                      onChange={(e) => setQuery(e.target.value)}
                                      onKeyDown={(e) =>
                                        e.key === "Enter" && isValidInput && handleSearch()
                                      }
                                      placeholder="e.g., Senior React Developer with 5+ years experience in fintech..."
                                      className="pl-12 h-14 text-lg border-2 focus:border-primary transition-all"
                                      disabled={isLoading}
                                    />
                                    {query.trim() && (
                                      <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2"
                                      >
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                      </motion.div>
                                    )}
                                  </div>
                                  {/* Helpful hint */}
                                  {!query.trim() && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                      <Lightbulb className="w-3.5 h-3.5" />
                                      The more detail you share, the better matches Donna can find
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="jd"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                              >
                                <div className="space-y-2">
                                  <Label className="text-base font-semibold">
                                    Upload your job description
                                  </Label>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                  />

                                  {!jdFile ? (
                                    <button
                                      onClick={() => fileInputRef.current?.click()}
                                      disabled={isLoading}
                                      className="w-full h-32 border-2 border-dashed border-border hover:border-primary rounded-lg flex flex-col items-center justify-center gap-2 transition-all hover:bg-primary/5 group"
                                    >
                                      <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                      <p className="text-sm font-medium">
                                        Click to upload or drag and drop
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        PDF, DOC, DOCX, or TXT (max 10MB)
                                      </p>
                                    </button>
                                  ) : (
                                    <motion.div
                                      initial={{ scale: 0.9, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      className="p-4 bg-green-500/10 border-2 border-green-500/30 rounded-lg flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                          <FileCheck className="w-5 h-5 text-green-500" />
                                        </div>
                                        <div>
                                          <p className="font-medium flex items-center gap-2">
                                            {jdFile.name}
                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {(jdFile.size / 1024).toFixed(2)} KB
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setJdFile(null)}
                                        disabled={isLoading}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </motion.div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Advanced Filters Toggle */}
                          <div className="space-y-4">
                            <Button
                              variant="ghost"
                              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                              className="w-full justify-between hover:bg-muted/50 group"
                              disabled={isLoading}
                            >
                              <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="font-semibold text-sm">
                                  Advanced Filters
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-xs group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                                >
                                  Optional
                                </Badge>
                              </div>
                              <motion.div
                                animate={{ rotate: showAdvancedFilters ? 180 : 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              </motion.div>
                            </Button>

                            {/* Collapsible Advanced Filters */}
                            <AnimatePresence>
                              {showAdvancedFilters && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden space-y-4"
                                >
                                  <Separator />

                                  {/* Location Filter */}
                                  <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="relative"
                                  >
                                    <div
                                      className={`p-4 rounded-lg border-2 transition-all duration-300 ${filters.locationEnabled
                                        ? "bg-primary/5 border-primary/30"
                                        : "bg-muted/30 border-border/50 opacity-60"
                                        }`}
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${filters.locationEnabled
                                              ? "bg-primary/20"
                                              : "bg-muted"
                                              }`}
                                          >
                                            <MapPin
                                              className={`w-4 h-4 transition-colors ${filters.locationEnabled
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                                }`}
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-sm font-semibold">
                                              Location Filter
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                              {filters.locationEnabled
                                                ? "Filtering by location"
                                                : "Searching all locations"}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-2">
                                            <motion.div
                                              animate={{
                                                scale: filters.locationEnabled ? 1 : 0.9,
                                                opacity: filters.locationEnabled ? 1 : 0.5,
                                              }}
                                              className={`text-xs font-bold px-2 py-1 rounded-full ${filters.locationEnabled
                                                ? "bg-primary/20 text-primary"
                                                : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                              {filters.locationEnabled ? "ON" : "OFF"}
                                            </motion.div>
                                            <Switch
                                              checked={filters.locationEnabled}
                                              onCheckedChange={(checked) =>
                                                setFilters({
                                                  ...filters,
                                                  locationEnabled: checked,
                                                })
                                              }
                                              disabled={isLoading}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <AnimatePresence>
                                        {filters.locationEnabled && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                          >
                                            <Input
                                              value={filters.location}
                                              onChange={(e) =>
                                                setFilters({
                                                  ...filters,
                                                  location: e.target.value,
                                                })
                                              }
                                              placeholder="e.g., Bangalore, Remote, United States..."
                                              disabled={isLoading}
                                              className="h-10"
                                            />
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      {!filters.locationEnabled && (
                                        <motion.div
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          className="mt-3 flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md"
                                        >
                                          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-blue-600 dark:text-blue-400">
                                            We'll search everywhere by default. Many candidates are open to relocating!
                                          </p>
                                        </motion.div>
                                      )}
                                    </div>
                                  </motion.div>

                                  {/* Other Filters */}
                                  <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="grid md:grid-cols-2 gap-4"
                                  >
                                    <div className="space-y-2">
                                      <Label className="flex items-center gap-2 text-sm">
                                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                        </div>
                                        Experience Level
                                      </Label>
                                      <Input
                                        value={filters.seniority}
                                        onChange={(e) =>
                                          setFilters({
                                            ...filters,
                                            seniority: e.target.value,
                                          })
                                        }
                                        placeholder="e.g., Senior, Mid-level..."
                                        disabled={isLoading}
                                        className="h-10"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label className="flex items-center gap-2 text-sm">
                                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                        </div>
                                        Industry
                                      </Label>
                                      <Input
                                        value={filters.industry}
                                        onChange={(e) =>
                                          setFilters({
                                            ...filters,
                                            industry: e.target.value,
                                          })
                                        }
                                        placeholder="e.g., Fintech, Healthcare..."
                                        disabled={isLoading}
                                        className="h-10"
                                      />
                                    </div>
                                  </motion.div>

                                  {/* Intelligent Search Toggle */}
                                  <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="md:col-span-2"
                                  >
                                    <div
                                      className={`p-4 rounded-lg border-2 transition-all duration-300 ${useIntelligentSearch
                                        ? "bg-purple-500/5 border-purple-500/30"
                                        : "bg-muted/30 border-border/50"
                                        }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${useIntelligentSearch ? "bg-purple-500/20" : "bg-muted"
                                              }`}
                                          >
                                            <Brain
                                              className={`w-5 h-5 transition-colors ${useIntelligentSearch
                                                ? "text-purple-500"
                                                : "text-muted-foreground"
                                                }`}
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <Label className="text-sm font-semibold flex items-center gap-2">
                                              Smart Search
                                              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                                                BETA
                                              </Badge>
                                            </Label>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {useIntelligentSearch
                                                ? "Using AI to find the best matches"
                                                : "Using standard search"}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <motion.div
                                            animate={{
                                              scale: useIntelligentSearch ? 1 : 0.9,
                                              opacity: useIntelligentSearch ? 1 : 0.5,
                                            }}
                                            className={`text-xs font-bold px-2 py-1 rounded-full ${useIntelligentSearch
                                              ? "bg-purple-500/20 text-purple-400"
                                              : "bg-muted text-muted-foreground"
                                              }`}
                                          >
                                            {useIntelligentSearch ? "ON" : "OFF"}
                                          </motion.div>
                                          <Switch
                                            checked={useIntelligentSearch}
                                            onCheckedChange={setUseIntelligentSearch}
                                            disabled={isLoading}
                                          />
                                        </div>
                                      </div>

                                      {useIntelligentSearch && (
                                        <motion.div
                                          initial={{ opacity: 0, y: -10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          className="mt-3 flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-md"
                                        >
                                          <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-purple-300/80">
                                            Donna will analyze your requirements deeply and build optimized searches to find the best candidates.
                                          </p>
                                        </motion.div>
                                      )}
                                    </div>
                                  </motion.div>

                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Error Message */}
                          <AnimatePresence>
                            {error && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3"
                              >
                                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                <p className="text-destructive text-sm font-medium">
                                  {error}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Enhanced Search Button */}
                          <motion.div
                            whileHover={{ scale: isValidInput ? 1.02 : 1 }}
                            whileTap={{ scale: isValidInput ? 0.98 : 1 }}
                          >
                            <Button
                              size="lg"
                              onClick={handleSearch}
                              disabled={!isValidInput || isLoading}
                              className={`w-full h-14 text-base font-bold relative overflow-hidden group transition-all duration-300 ${isValidInput
                                ? "bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/50"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                                }`}
                            >
                              {isLoading ? (
                                <motion.div
                                  className="flex items-center gap-3"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                >
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{
                                      duration: 1,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                  >
                                    <Sparkles className="w-5 h-5" />
                                  </motion.div>
                                  <span>
                                    {searchMode === "text" ? "Donna is thinking..." : "Processing..."}
                                  </span>
                                </motion.div>
                              ) : (
                                <>
                                  <span className="flex items-center gap-2 relative z-10">
                                    {isValidInput ? (
                                      <>
                                        <Zap className="w-5 h-5 group-hover:animate-pulse" />
                                        {searchMode === "text" ? "Let's Find Candidates" : "Start Search"}
                                        <CheckCircle2 className="w-5 h-5" />
                                      </>
                                    ) : (
                                      <>
                                        <MessageSquare className="w-5 h-5" />
                                        {searchMode === "text"
                                          ? "Describe your ideal candidate above"
                                          : "Upload a job description to continue"}
                                      </>
                                    )}
                                  </span>
                                  {isValidInput && (
                                    <motion.div
                                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                      animate={{
                                        x: ["-100%", "100%"],
                                      }}
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "linear",
                                      }}
                                    />
                                  )}
                                </>
                              )}
                            </Button>
                          </motion.div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Example Queries */}
                {searchMode === "text" && !jdGenerationMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="max-w-4xl mx-auto mt-8 space-y-4"
                  >
                    <p className="text-sm text-muted-foreground text-center">
                      Not sure where to start? Try one of these:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {exampleQueries.map((example, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + idx * 0.1 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuery(example)}
                            disabled={isLoading}
                            className="text-xs hover:bg-primary/10 hover:text-primary hover:border-primary transition-all"
                          >
                            {example}
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              // Manual Import Panel
              <motion.div
                key="manual-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="pt-8"
              >
                <ManualImportPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <style jsx>{`
          @keyframes gradient {
            0%,
            100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          .animate-gradient {
            background-size: 200% auto;
            animation: gradient 3s linear infinite;
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}