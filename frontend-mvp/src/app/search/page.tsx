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
  Target,
  TrendingUp,
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

export default function SearchPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { setSessionId, setIdealProfile, setIsSearching, setSearchError } =
    useSearch();

  const [searchMode, setSearchMode] = useState<"text" | "jd">("text");
  const [query, setQuery] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [filters, setFilters] = useState({
    locationEnabled: false,
    location: "",
    seniority: "",
    industries: [] as string[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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
      // Check file type
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
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }
      setJdFile(file);
      setError(null);
    }
  };

  const handleSearch = async () => {
    if (searchMode === "text" && !query.trim()) {
      setError("Please enter a search query");
      return;
    }

    if (searchMode === "jd" && !jdFile) {
      setError("Please upload a job description file");
      return;
    }

    if (!token) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSearching(true);
    setSearchError(null);

    try {
      let response;

      if (searchMode === "jd" && jdFile) {
        // Convert file to base64
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

      setSessionId(response.session_id);
      setIdealProfile(response.ideal_profile);

      router.push(`/results?session=${response.session_id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start search";
      setError(errorMessage);
      setSearchError(errorMessage);
      setIsSearching(false);
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/5" />
      <div className="absolute inset-0 grid-bg opacity-40" />

      {/* Animated gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

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

        {/* Main Search Card with Spotlight Effect */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <Card
            className="shadow-2xl border-border/50 backdrop-blur-sm bg-card/95 spotlight"
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
                      <Label htmlFor="search" className="text-base font-semibold">
                        Describe your ideal candidate
                      </Label>
                      <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          id="search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          placeholder="e.g., Senior React Developer with 5+ years experience in fintech..."
                          className="pl-12 h-14 text-lg border-2 focus:border-primary transition-all"
                          disabled={isLoading}
                        />
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
                        <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-primary" />
                            <div>
                              <p className="font-medium">{jdFile.name}</p>
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
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Separator />

              {/* Advanced Filters */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Advanced Filters</h3>
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                </div>

                {/* Location Filter */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50 transition-all hover:border-border">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <Label
                        htmlFor="location"
                        className="text-sm font-medium flex items-center gap-2"
                      >
                        Location Filter
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold cursor-help">
                              i
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="max-w-xs text-sm"
                          >
                            <p className="font-semibold mb-1">
                              Location filter is OFF by default
                            </p>
                            <p className="text-muted-foreground">
                              Candidates may be willing to relocate. Enable this
                              filter only if location is a strict requirement.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                    </div>
                    <Input
                      id="location"
                      value={filters.location}
                      onChange={(e) =>
                        setFilters({ ...filters, location: e.target.value })
                      }
                      placeholder="e.g., Bangalore, Remote, United States..."
                      disabled={!filters.locationEnabled || isLoading}
                      className="h-10"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2 pt-6">
                    <Switch
                      id="location-toggle"
                      checked={filters.locationEnabled}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, locationEnabled: checked })
                      }
                      disabled={isLoading}
                    />
                    <Label
                      htmlFor="location-toggle"
                      className="text-xs text-muted-foreground font-medium"
                    >
                      {filters.locationEnabled ? "ON" : "OFF"}
                    </Label>
                  </div>
                </div>

                {/* Other Filters */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="seniority"
                      className="flex items-center gap-2"
                    >
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      Seniority Level
                    </Label>
                    <Input
                      id="seniority"
                      value={filters.seniority}
                      onChange={(e) =>
                        setFilters({ ...filters, seniority: e.target.value })
                      }
                      placeholder="e.g., Senior, Mid-level..."
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="industry" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      Industry
                    </Label>
                    <Input
                      id="industry"
                      placeholder="e.g., Fintech, Healthcare..."
                      disabled={isLoading}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search Button */}
              <Button
                size="lg"
                onClick={handleSearch}
                disabled={isLoading || (searchMode === "text" && !query.trim()) || (searchMode === "jd" && !jdFile)}
                className="w-full h-12 text-base font-semibold shine-effect relative overflow-hidden group"
              >
                {isLoading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="mr-2"
                    >
                      <Sparkles className="w-5 h-5" />
                    </motion.div>
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                    Find Candidates
                  </>
                )}
              </Button>
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

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16"
        >
          {[
            {
              icon: Target,
              title: "AI-Powered Matching",
              description:
                "Advanced algorithms find candidates that truly fit your requirements",
              color: "text-blue-500",
            },
            {
              icon: TrendingUp,
              title: "Salary Insights",
              description:
                "Get estimated salary ranges and career progression data",
              color: "text-green-500",
            },
            {
              icon: Sparkles,
              title: "Enrichment Data",
              description:
                "Response likelihood, skill validation, and availability insights",
              color: "text-purple-500",
            },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + idx * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <Card className="text-center p-6 hover:border-primary/50 transition-all hover:shadow-xl spotlight group">
                <feature.icon
                  className={`w-12 h-12 mx-auto mb-3 ${feature.color} group-hover:scale-110 transition-transform`}
                />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            </motion.div>
          ))}
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

// Import SlidersHorizontal
import { SlidersHorizontal } from "lucide-react";
