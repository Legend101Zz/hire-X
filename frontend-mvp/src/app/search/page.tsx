"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import * as conversationApi from "@/utils/api/conversationApiV2";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

export default function SearchPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { setSessionId, setIdealProfile, setIsSearching, setSearchError } =
    useSearch();

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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
    console.log('heref', file)
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
      console.log('file', file)
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
      let response;

      if (searchMode === "jd" && jdFile) {
        const reader = new FileReader();
        reader.readAsDataURL(jdFile);
        await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
        });
        const base64 = (reader.result as string).split(",")[1];

        response = await conversationApi.startConversation(token, {
          jd_file_content: base64,
          jd_file_name: jdFile.name,
        });
      } else {
        response = await conversationApi.startConversation(token, {
          initial_message: query,
        });
      }

      router.push(`/conversation?session=${response.session_id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    "Senior Full Stack Developer with React and Node.js",
    "Product Manager with SaaS experience in B2B",
    "Data Scientist with ML/AI expertise and Python",
    "DevOps Engineer with Kubernetes and AWS",
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Enhanced Animated Background */}
      <AnimatedBackground />

      <div className="relative z-10 container mx-auto px-4 py-16">
        {/* Header with animation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 space-y-6"
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
            Describe your ideal candidate or upload a job description. Our AI
            will find perfect matches with enrichment data.
          </p>
        </motion.div>

        {/* Main Search Card */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <Card
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
                  Text Search
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
                        Describe your ideal candidate
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
                        Upload Job Description
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

                      {/* Location Filter with Visual Toggle */}
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
                                    ? "Location filtering enabled"
                                    : "Candidates from all locations"}
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

                          {/* Info Tooltip */}
                          {!filters.locationEnabled && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-3 flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md"
                            >
                              <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                Location filter is OFF by default. Candidates may be willing to relocate.
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
                            Seniority Level
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
                      <span>Searching 56M+ Profiles...</span>
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                        className="flex gap-1"
                      >
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 bg-black rounded-full"
                            style={{ animationDelay: `${i * 0.2}s` }}
                          />
                        ))}
                      </motion.div>
                    </motion.div>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 relative z-10">
                        {isValidInput ? (
                          <>
                            <Zap className="w-5 h-5 group-hover:animate-pulse" />
                            Find Candidates
                            <CheckCircle2 className="w-5 h-5" />
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5" />
                            {searchMode === "text"
                              ? "Enter search query"
                              : "Upload job description"}
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

        {/* Example Queries */}
        {searchMode === "text" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="max-w-4xl mx-auto mt-8 space-y-4"
          >
            <p className="text-sm text-muted-foreground text-center">
              Try these examples:
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

        {/* Job Search Pipeline Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="max-w-5xl mx-auto mt-20"
        >
          <div className="text-center mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="text-3xl font-bold mb-3"
            >
              Your AI-Powered Hiring Pipeline
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-muted-foreground"
            >
              Watch as AI transforms your search into perfect matches
            </motion.p>
          </div>



        </motion.div>
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
  );
}