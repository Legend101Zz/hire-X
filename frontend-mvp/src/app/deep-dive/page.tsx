"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    Search,
    Sparkles,
    Loader2,
    User,
    Briefcase,
    MapPin,
    TrendingUp,
    Clock,
    CheckCircle,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    DollarSign,
    BarChart2,
    Award,
    MessageSquare,
    Target,
    Zap,
    Brain,
    ChevronRight,
    ArrowLeft,
    Upload,
    FileText,
    FileCheck,
    X,
    Linkedin,
    Globe,
    Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// TYPES
// ============================================================================

interface DeepDiveResult {
    candidate: {
        full_name: string;
        title: string;
        current_company: string;
        location: string;
        linkedin_url: string;
        total_experience_years: number;
        skills: string[];
    };
    enrichment_plan: {
        role_type: string;
        role_title: string;
        seniority_level: string;
    };
    skill_validation: {
        validated_skills: string[];
        unvalidated_skills: string[];
        evidence: any[];
        overall_confidence: number;
        assessment: string;
    };
    salary_timeline: {
        career_progression: any[];
        current_estimated_ctc: { low: number; high: number; most_likely: number };
        growth_analysis: { average_annual_growth_percent: number; trajectory: string };
        confidence_score: number;
    };
    response_likelihood: {
        overall_score: number;
        likelihood_label: string;
        factors: any[];
        recommended_approach: any;
    };
    notice_period: {
        estimated_notice_days: { minimum: number; likely: number; maximum: number };
        earliest_possible_start: string;
        most_likely_start: string;
        negotiation_tips?: string[];
    };
    match_analysis: {
        overall_match_score: number;
        match_label: string;
        strengths: string[];
        concerns: string[];
        gaps: string[];
        hiring_recommendation: { action: string; reasoning: string };
        recruiter_summary: any;
    };
    data_source: string;
    processing_time_seconds: number;
}

// ============================================================================
// ANIMATED BACKGROUND COMPONENT
// ============================================================================

function AnimatedBackground() {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

            {/* Radial gradient at top */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

            {/* Grid pattern */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px),
                                     linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)`,
                    backgroundSize: "50px 50px",
                }}
            />

            {/* Floating orbs */}
            <motion.div
                className="absolute w-[500px] h-[500px] rounded-full"
                style={{
                    background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
                    left: "10%",
                    top: "20%",
                }}
                animate={{
                    x: [0, 50, 0],
                    y: [0, 30, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            <motion.div
                className="absolute w-[400px] h-[400px] rounded-full"
                style={{
                    background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
                    right: "10%",
                    bottom: "20%",
                }}
                animate={{
                    x: [0, -40, 0],
                    y: [0, -50, 0],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            {/* Mouse spotlight */}
            <motion.div
                className="absolute pointer-events-none w-[600px] h-[600px] rounded-full"
                style={{
                    background: "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
                }}
                animate={{
                    x: mousePosition.x - 300,
                    y: mousePosition.y - 300,
                }}
                transition={{
                    type: "spring",
                    damping: 50,
                    stiffness: 200,
                }}
            />

            {/* Scanning line */}
            <motion.div
                className="absolute left-0 right-0 h-px"
                style={{
                    background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent)",
                }}
                animate={{
                    top: ["0%", "100%"],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />

            {/* Floating particles */}
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-violet-400/30 rounded-full"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                        y: [0, -30, 0],
                        opacity: [0.2, 0.5, 0.2],
                    }}
                    transition={{
                        duration: 5 + Math.random() * 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: Math.random() * 5,
                    }}
                />
            ))}
        </div>
    );
}

// ============================================================================
// LOADING ANIMATION COMPONENT
// ============================================================================

function LoadingAnimation({ stage }: { stage: string }) {
    const stages = [
        { icon: Brain, label: "Analyzing job description...", color: "text-violet-400" },
        { icon: Target, label: "Creating enrichment plan...", color: "text-blue-400" },
        { icon: Database, label: "Searching database (56M+ profiles)...", color: "text-emerald-400" },
        { icon: Linkedin, label: "Scraping LinkedIn profile...", color: "text-sky-400" },
        { icon: Globe, label: "Validating skills via web search...", color: "text-amber-400" },
        { icon: DollarSign, label: "Estimating salary timeline...", color: "text-green-400" },
        { icon: MessageSquare, label: "Calculating response likelihood...", color: "text-pink-400" },
        { icon: Sparkles, label: "Synthesizing insights...", color: "text-purple-400" },
    ];

    return (
        <div className="py-12">
            <div className="flex justify-center mb-8">
                <motion.div
                    className="relative w-24 h-24"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                    <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500" />
                    <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-blue-500" />
                    <div className="absolute inset-4 rounded-full border-4 border-transparent border-t-purple-500" />
                </motion.div>
            </div>

            <div className="space-y-3 max-w-md mx-auto">
                {stages.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = stage.includes(s.label.split("...")[0].toLowerCase()) ||
                        stages.findIndex(st => stage.toLowerCase().includes(st.label.split("...")[0].toLowerCase().substring(0, 10))) >= i;

                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0.3 }}
                            animate={{ opacity: isActive ? 1 : 0.3 }}
                            className={`flex items-center gap-3 p-3 rounded-lg ${isActive ? "bg-slate-800/50" : ""}`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? s.color : "text-slate-600"}`} />
                            <span className={`text-sm ${isActive ? "text-slate-200" : "text-slate-600"}`}>
                                {s.label}
                            </span>
                            {isActive && stage.toLowerCase().includes(s.label.split("...")[0].toLowerCase().substring(0, 10)) && (
                                <Loader2 className="w-4 h-4 animate-spin text-violet-400 ml-auto" />
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function DeepDivePage() {
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [jdInputMode, setJdInputMode] = useState<"text" | "file">("text");
    const [jobDescription, setJobDescription] = useState("");
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Results state
    const [result, setResult] = useState<DeepDiveResult | null>(null);
    const [activeTab, setActiveTab] = useState("overview");

    // Auth guard
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    // File handling
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

    // Read file content
    const readFileContent = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                resolve(text);
            };
            reader.onerror = reject;

            if (file.type === "text/plain") {
                reader.readAsText(file);
            } else {
                // For PDF/DOCX, we'll send as base64 and let backend parse
                reader.readAsDataURL(file);
            }
        });
    };

    // Check if input is valid
    const isValidInput = linkedinUrl.trim().length > 0 &&
        (jdInputMode === "text" ? jobDescription.trim().length > 50 : jdFile !== null);

    // Loading stages for simulation
    const loadingStages = [
        "Analyzing job description",
        "Creating enrichment plan",
        "Searching database",
        "Scraping LinkedIn",
        "Validating skills",
        "Estimating salary",
        "Calculating response",
        "Synthesizing insights",
    ];

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValidInput) {
            setError("Please provide both LinkedIn URL and Job Description (min 50 characters)");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        // Get JD content
        let jdContent = jobDescription;
        if (jdInputMode === "file" && jdFile) {
            try {
                jdContent = await readFileContent(jdFile);
            } catch (err) {
                setError("Failed to read file");
                setIsLoading(false);
                return;
            }
        }

        // Simulate loading stages
        let stageIndex = 0;
        const stageInterval = setInterval(() => {
            if (stageIndex < loadingStages.length) {
                setLoadingStage(loadingStages[stageIndex]);
                stageIndex++;
            }
        }, 2500);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/analyze`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        linkedin_url: linkedinUrl,
                        job_description: jdContent,
                        force_scrape: false,
                    }),
                }
            );

            clearInterval(stageInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Analysis failed");
            }

            const data = await response.json();
            setResult(data.data);
            setLoadingStage("");

        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            clearInterval(stageInterval);
            setIsLoading(false);
        }
    };

    // Helper functions
    const getMatchColor = (label: string) => {
        switch (label) {
            case "Excellent Match": return "from-emerald-500 to-green-500";
            case "Great Match": return "from-blue-500 to-cyan-500";
            case "Good Match": return "from-amber-500 to-yellow-500";
            default: return "from-slate-500 to-gray-500";
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case "Strong Interview": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
            case "Interview": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
            case "Consider": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
            default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
        }
    };

    return (
        <div className="min-h-screen relative">
            {/* Animated Background */}
            <AnimatedBackground />

            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/70 border-b border-slate-800/50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.push("/search")}
                                className="text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div className="flex items-center gap-3">
                                <motion.div
                                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Brain className="w-5 h-5 text-white" />
                                </motion.div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">
                                        Candidate Deep Dive
                                    </h1>
                                    <p className="text-sm text-slate-400">
                                        AI-powered candidate intelligence
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-violet-400 border-violet-400/30">
                                <Database className="w-3 h-3 mr-1" />
                                56M+ Profiles
                            </Badge>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-8"
                >
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-sm text-violet-400 backdrop-blur-sm mb-4"
                    >
                        <Sparkles className="w-4 h-4 animate-pulse" />
                        <span className="font-medium">Intelligent Candidate Analysis</span>
                    </motion.div>

                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                        Deep Dive into Any{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400">
                            LinkedIn Profile
                        </span>
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Get comprehensive insights including skill validation, salary estimates,
                        response likelihood, and match analysis.
                    </p>
                </motion.div>

                {/* Input Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    <Card className="mb-8 bg-slate-900/50 border-slate-800/50 backdrop-blur-sm overflow-hidden">
                        {/* Gradient top border */}
                        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500" />

                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* LinkedIn URL Input */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <Linkedin className="w-4 h-4 text-sky-400" />
                                        LinkedIn Profile URL
                                    </Label>
                                    <div className="relative group">
                                        <Input
                                            type="url"
                                            placeholder="https://www.linkedin.com/in/username"
                                            value={linkedinUrl}
                                            onChange={(e) => setLinkedinUrl(e.target.value)}
                                            className="pl-10 h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                            disabled={isLoading}
                                        />
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                                        {linkedinUrl.includes("linkedin.com/in/") && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2"
                                            >
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            </motion.div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        We'll search our database first, then scrape from LinkedIn if needed
                                    </p>
                                </div>

                                {/* JD Input Mode Toggle */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-amber-400" />
                                        Job Description
                                    </Label>

                                    <div className="flex gap-2 mb-3">
                                        <Button
                                            type="button"
                                            variant={jdInputMode === "text" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setJdInputMode("text")}
                                            className={jdInputMode === "text" ? "bg-violet-600 hover:bg-violet-500" : "text-slate-400"}
                                        >
                                            <FileText className="w-4 h-4 mr-2" />
                                            Paste Text
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={jdInputMode === "file" ? "default" : "ghost"}
                                            size="sm"
                                            onClick={() => setJdInputMode("file")}
                                            className={jdInputMode === "file" ? "bg-violet-600 hover:bg-violet-500" : "text-slate-400"}
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload File
                                        </Button>
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {jdInputMode === "text" ? (
                                            <motion.div
                                                key="text"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                            >
                                                <Textarea
                                                    placeholder="Paste the complete job description here. Include role requirements, skills needed, experience level, and any other relevant details..."
                                                    value={jobDescription}
                                                    onChange={(e) => setJobDescription(e.target.value)}
                                                    rows={10}
                                                    className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 resize-none transition-all"
                                                    disabled={isLoading}
                                                />
                                                <div className="flex justify-between mt-2">
                                                    <p className="text-xs text-slate-500">
                                                        Minimum 50 characters required
                                                    </p>
                                                    <p className={`text-xs ${jobDescription.length >= 50 ? "text-green-500" : "text-slate-500"}`}>
                                                        {jobDescription.length} / 50 min
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="file"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                            >
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept=".pdf,.doc,.docx,.txt"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                />

                                                {!jdFile ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isLoading}
                                                        className="w-full h-40 border-2 border-dashed border-slate-700 hover:border-violet-500/50 rounded-xl flex flex-col items-center justify-center gap-3 transition-all hover:bg-violet-500/5 group"
                                                    >
                                                        <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                                                            <Upload className="w-7 h-7 text-slate-400 group-hover:text-violet-400 transition-colors" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-sm font-medium text-slate-300">
                                                                Click to upload or drag and drop
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                PDF, DOC, DOCX, or TXT (max 10MB)
                                                            </p>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <motion.div
                                                        initial={{ scale: 0.95, opacity: 0 }}
                                                        animate={{ scale: 1, opacity: 1 }}
                                                        className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                                                <FileCheck className="w-6 h-6 text-emerald-400" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-white flex items-center gap-2">
                                                                    {jdFile.name}
                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                                </p>
                                                                <p className="text-xs text-slate-400">
                                                                    {(jdFile.size / 1024).toFixed(2)} KB
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setJdFile(null)}
                                                            disabled={isLoading}
                                                            className="hover:bg-red-500/10 hover:text-red-400"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </motion.div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20"
                                    >
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <span className="text-sm">{error}</span>
                                    </motion.div>
                                )}

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    disabled={isLoading || !isValidInput}
                                    className="w-full h-14 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-lg font-medium relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-3">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>{loadingStage || "Analyzing..."}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="relative z-10 flex items-center gap-2">
                                                <Zap className="w-5 h-5" />
                                                Run Deep Analysis
                                            </span>
                                            {isValidInput && (
                                                <motion.div
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                                    animate={{ x: ["-100%", "100%"] }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                />
                                            )}
                                        </>
                                    )}
                                </Button>

                                {/* Loading Animation */}
                                {isLoading && (
                                    <LoadingAnimation stage={loadingStage} />
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Results Section */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* Candidate Header Card */}
                            <Card className="bg-slate-900/50 border-slate-800/50 backdrop-blur-sm overflow-hidden">
                                <div className={`h-2 bg-gradient-to-r ${getMatchColor(result.match_analysis.match_label)}`} />
                                <CardContent className="pt-6">
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        {/* Avatar & Info */}
                                        <div className="flex items-start gap-4 flex-1">
                                            <motion.div
                                                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shrink-0 shadow-lg shadow-violet-500/20"
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                {result.candidate.full_name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")
                                                    .substring(0, 2)}
                                            </motion.div>
                                            <div className="flex-1 min-w-0">
                                                <h2 className="text-2xl font-bold text-white truncate">
                                                    {result.candidate.full_name}
                                                </h2>
                                                <p className="text-lg text-slate-300 flex items-center gap-2">
                                                    <Briefcase className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{result.candidate.title}</span>
                                                </p>
                                                <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                                                    <MapPin className="w-4 h-4 shrink-0" />
                                                    {result.candidate.location}
                                                </p>
                                                {result.candidate.linkedin_url && (

                                                    <a href={result.candidate.linkedin_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 mt-2 transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        View LinkedIn Profile
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Score Cards */}
                                        <div className="flex flex-wrap gap-4 lg:flex-nowrap">
                                            <div className="flex-1 min-w-[130px] text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                                <p className="text-sm text-slate-400 mb-1">Match Score</p>
                                                <p className="text-3xl font-bold text-white">
                                                    {result.match_analysis.overall_match_score}%
                                                </p>
                                                <Badge className={`mt-2 bg-gradient-to-r ${getMatchColor(result.match_analysis.match_label)} text-white border-0`}>
                                                    {result.match_analysis.match_label}
                                                </Badge>
                                            </div>
                                            <div className="flex-1 min-w-[130px] text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                                <p className="text-sm text-slate-400 mb-1">Recommendation</p>
                                                <Badge className={`text-lg py-2 px-4 ${getActionColor(result.match_analysis.hiring_recommendation.action)}`}>
                                                    {result.match_analysis.hiring_recommendation.action}
                                                </Badge>
                                            </div>
                                            <div className="flex-1 min-w-[130px] text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                                <p className="text-sm text-slate-400 mb-1">Response Odds</p>
                                                <p className="text-3xl font-bold text-white">
                                                    {result.response_likelihood.overall_score}%
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {result.response_likelihood.likelihood_label}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Source & Time */}
                                    <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between text-sm text-slate-500">
                                        <div className="flex items-center gap-2">
                                            {result.data_source === "database" ? (
                                                <>
                                                    <Database className="w-4 h-4 text-emerald-400" />
                                                    <span className="text-emerald-400">Found in database</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Linkedin className="w-4 h-4 text-sky-400" />
                                                    <span className="text-sky-400">Scraped from LinkedIn</span>
                                                </>
                                            )}
                                        </div>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            Analyzed in {result.processing_time_seconds.toFixed(1)}s
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Tabs for detailed views - Keep existing tab content */}
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                                <TabsList className="grid grid-cols-5 bg-slate-800/50 border border-slate-700/50 p-1">
                                    <TabsTrigger
                                        value="overview"
                                        className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                                    >
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="skills"
                                        className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                                    >
                                        Skills
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="salary"
                                        className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                                    >
                                        Salary
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="response"
                                        className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                                    >
                                        Response
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="notice"
                                        className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                                    >
                                        Notice
                                    </TabsTrigger>
                                </TabsList>

                                {/* Tab contents remain the same as before */}
                                {/* ... (keep all the TabsContent from previous implementation) ... */}

                                {/* Overview Tab */}
                                <TabsContent value="overview" className="space-y-6">
                                    {/* Recruiter Summary */}
                                    <Card className="bg-slate-900/50 border-slate-800/50">
                                        <CardHeader>
                                            <CardTitle className="text-white flex items-center gap-2">
                                                <MessageSquare className="w-5 h-5 text-violet-400" />
                                                Recruiter Summary
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {result.match_analysis.recruiter_summary?.one_liner && (
                                                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                                                    <p className="text-violet-300 font-medium">
                                                        {result.match_analysis.recruiter_summary.one_liner}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                    <p className="text-sm font-medium text-emerald-400 mb-2">Strengths</p>
                                                    <ul className="space-y-1">
                                                        {result.match_analysis.strengths.map((s, i) => (
                                                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                                                                {s}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                                    <p className="text-sm font-medium text-amber-400 mb-2">Concerns</p>
                                                    <ul className="space-y-1">
                                                        {result.match_analysis.concerns.map((c, i) => (
                                                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                                                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                                                {c}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-slate-800/50 rounded-lg">
                                                <p className="text-sm font-medium text-slate-300 mb-2">Hiring Recommendation</p>
                                                <p className="text-sm text-slate-400">
                                                    {result.match_analysis.hiring_recommendation.reasoning}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Quick Stats */}
                                    <div className="grid md:grid-cols-4 gap-4">
                                        <Card className="bg-slate-900/50 border-slate-800/50 hover:border-violet-500/30 transition-colors">
                                            <CardContent className="pt-6 text-center">
                                                <Clock className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-white">
                                                    {result.candidate.total_experience_years} yrs
                                                </p>
                                                <p className="text-sm text-slate-400">Experience</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-slate-900/50 border-slate-800/50 hover:border-green-500/30 transition-colors">
                                            <CardContent className="pt-6 text-center">
                                                <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-white">
                                                    ₹{result.salary_timeline.current_estimated_ctc.most_likely}L
                                                </p>
                                                <p className="text-sm text-slate-400">Est. CTC</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-slate-900/50 border-slate-800/50 hover:border-amber-500/30 transition-colors">
                                            <CardContent className="pt-6 text-center">
                                                <Award className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-white">
                                                    {result.skill_validation.overall_confidence}%
                                                </p>
                                                <p className="text-sm text-slate-400">Skills Verified</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-slate-900/50 border-slate-800/50 hover:border-blue-500/30 transition-colors">
                                            <CardContent className="pt-6 text-center">
                                                <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                                                <p className="text-2xl font-bold text-white">
                                                    {result.salary_timeline.growth_analysis.average_annual_growth_percent}%
                                                </p>
                                                <p className="text-sm text-slate-400">Avg Growth</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                {/* Skills Tab */}
                                <TabsContent value="skills">
                                    <Card className="bg-slate-900/50 border-slate-800/50">
                                        <CardHeader>
                                            <CardTitle className="text-white flex items-center gap-2">
                                                <Award className="w-5 h-5 text-violet-400" />
                                                Skill Validation
                                                <Badge className="ml-auto bg-slate-700 text-slate-300">
                                                    {result.skill_validation.overall_confidence}% Confidence
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {result.skill_validation.assessment && (
                                                <div className="p-4 bg-slate-800/50 rounded-lg">
                                                    <p className="text-sm text-slate-300">{result.skill_validation.assessment}</p>
                                                </div>
                                            )}

                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div>
                                                    <p className="text-sm font-medium text-emerald-400 mb-3">
                                                        ✓ Validated Skills ({result.skill_validation.validated_skills.length})
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {result.skill_validation.validated_skills.map((skill, i) => (
                                                            <Badge key={i} className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-400 mb-3">
                                                        ○ Unverified Skills ({result.skill_validation.unvalidated_skills.length})
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {result.skill_validation.unvalidated_skills.map((skill, i) => (
                                                            <Badge key={i} variant="outline" className="text-slate-400 border-slate-600">
                                                                {skill}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {result.skill_validation.evidence.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium text-slate-300 mb-3">Evidence Found</p>
                                                    <div className="space-y-3">
                                                        {result.skill_validation.evidence.slice(0, 5).map((ev: any, i: number) => (
                                                            <div key={i} className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                                                                <div className="flex items-start justify-between">
                                                                    <div>
                                                                        <span className="font-medium text-white">{ev.skill}</span>
                                                                        <Badge className="ml-2 text-xs bg-slate-700 text-slate-300">
                                                                            {ev.evidence_type}
                                                                        </Badge>
                                                                    </div>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {ev.confidence}/10
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-sm text-slate-400 mt-1">{ev.evidence_description}</p>
                                                                {ev.evidence_url && (

                                                                    <a href={ev.evidence_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-flex items-center gap-1"
                                                                    >
                                                                        <ExternalLink className="w-3 h-3" />
                                                                        View Source
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Salary Tab */}
                                <TabsContent value="salary">
                                    <Card className="bg-slate-900/50 border-slate-800/50">
                                        <CardHeader>
                                            <CardTitle className="text-white flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-green-400" />
                                                Salary Timeline
                                                <Badge className="ml-auto bg-slate-700 text-slate-300">
                                                    {result.salary_timeline.confidence_score}% Confidence
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Current CTC */}
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                                    <p className="text-sm text-slate-400">Current Est. CTC</p>
                                                    <p className="text-3xl font-bold text-green-400">
                                                        ₹{result.salary_timeline.current_estimated_ctc.most_likely}L
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Range: ₹{result.salary_timeline.current_estimated_ctc.low}-{result.salary_timeline.current_estimated_ctc.high}L
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                                                    <p className="text-sm text-slate-400">Avg Annual Growth</p>
                                                    <p className="text-3xl font-bold text-blue-400">
                                                        {result.salary_timeline.growth_analysis.average_annual_growth_percent}%
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {result.salary_timeline.growth_analysis.trajectory}
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg text-center">
                                                    <p className="text-sm text-slate-400">Career Length</p>
                                                    <p className="text-3xl font-bold text-violet-400">
                                                        {result.candidate.total_experience_years} yrs
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {result.salary_timeline.career_progression.length} roles
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Career Timeline */}
                                            <div>
                                                <p className="text-sm font-medium text-slate-300 mb-4">Career Progression</p>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />
                                                    <div className="space-y-4">
                                                        {result.salary_timeline.career_progression.map((role: any, i: number) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 0, x: -20 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: i * 0.1 }}
                                                                className="relative pl-10"
                                                            >
                                                                <div className={`absolute left-2 w-5 h-5 rounded-full border-2 ${i === 0 ? "bg-green-500 border-green-500" : "bg-slate-900 border-slate-600"
                                                                    }`} />
                                                                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600 transition-colors">
                                                                    <div className="flex items-start justify-between">
                                                                        <div>
                                                                            <p className="font-medium text-white">{role.role}</p>
                                                                            <p className="text-sm text-slate-400">{role.company}</p>
                                                                            <p className="text-xs text-slate-500">{role.duration} • {role.start_year}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <Badge className="bg-slate-700 text-slate-300 text-xs">
                                                                                {role.experience_level}
                                                                            </Badge>
                                                                            <p className="text-lg font-bold text-green-400 mt-1">
                                                                                ₹{role.estimated_ctc_low}-{role.estimated_ctc_high}L
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 mt-2">{role.rationale}</p>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Response Tab */}
                                <TabsContent value="response">
                                    <Card className="bg-slate-900/50 border-slate-800/50">
                                        <CardHeader>
                                            <CardTitle className="text-white flex items-center gap-2">
                                                <MessageSquare className="w-5 h-5 text-blue-400" />
                                                Response Likelihood
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Score Gauge */}
                                            <div className="flex items-center justify-center py-6">
                                                <div className="relative w-40 h-40">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle
                                                            cx="80"
                                                            cy="80"
                                                            r="70"
                                                            stroke="currentColor"
                                                            strokeWidth="12"
                                                            fill="none"
                                                            className="text-slate-700"
                                                        />
                                                        <motion.circle
                                                            cx="80"
                                                            cy="80"
                                                            r="70"
                                                            stroke="currentColor"
                                                            strokeWidth="12"
                                                            fill="none"
                                                            strokeLinecap="round"
                                                            className={`${result.response_likelihood.overall_score >= 70 ? "text-green-500" :
                                                                result.response_likelihood.overall_score >= 50 ? "text-amber-500" :
                                                                    "text-red-500"
                                                                }`}
                                                            initial={{ strokeDasharray: "0 440" }}
                                                            animate={{ strokeDasharray: `${(result.response_likelihood.overall_score / 100) * 440} 440` }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-4xl font-bold text-white">
                                                            {result.response_likelihood.overall_score}%
                                                        </span>
                                                        <span className="text-sm text-slate-400">
                                                            {result.response_likelihood.likelihood_label}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Factors */}
                                            <div className="space-y-3">
                                                {result.response_likelihood.factors.map((factor: any, i: number) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.1 }}
                                                        className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/30"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-medium text-white">{factor.factor_name}</span>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-xs text-slate-400">
                                                                    {factor.weight_percent}% weight
                                                                </Badge>
                                                                <span className={`text-lg font-bold ${factor.score >= 7 ? "text-green-400" :
                                                                    factor.score >= 5 ? "text-amber-400" :
                                                                        "text-red-400"
                                                                    }`}>
                                                                    {factor.score}/10
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Progress
                                                            value={factor.score * 10}
                                                            className="h-2 mb-2 bg-slate-700"
                                                        />
                                                        <p className="text-sm text-slate-400">{factor.interpretation}</p>
                                                        <p className="text-xs text-slate-500 mt-1">Data: {factor.raw_data}</p>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* Recommended Approach */}
                                            {result.response_likelihood.recommended_approach && (
                                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                    <p className="text-sm font-medium text-blue-400 mb-3">Recommended Approach</p>
                                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-slate-500">Channel</p>
                                                            <p className="text-slate-300">{result.response_likelihood.recommended_approach.channel}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500">Timing</p>
                                                            <p className="text-slate-300">{result.response_likelihood.recommended_approach.timing}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500">Response Time</p>
                                                            <p className="text-slate-300">{result.response_likelihood.recommended_approach.expected_response_time}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-500">Message Style</p>
                                                            <p className="text-slate-300">{result.response_likelihood.recommended_approach.message_style}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Notice Period Tab */}
                                <TabsContent value="notice">
                                    <Card className="bg-slate-900/50 border-slate-800/50">
                                        <CardHeader>
                                            <CardTitle className="text-white flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-amber-400" />
                                                Notice Period Estimate
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                                                    <p className="text-sm text-slate-400">Minimum</p>
                                                    <p className="text-3xl font-bold text-slate-300">
                                                        {result.notice_period.estimated_notice_days.minimum} days
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                                    <p className="text-sm text-slate-400">Most Likely</p>
                                                    <p className="text-3xl font-bold text-amber-400">
                                                        {result.notice_period.estimated_notice_days.likely} days
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                                                    <p className="text-sm text-slate-400">Maximum</p>
                                                    <p className="text-3xl font-bold text-slate-300">
                                                        {result.notice_period.estimated_notice_days.maximum} days
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                                    <p className="text-sm text-slate-400">Earliest Possible Start</p>
                                                    <p className="text-lg font-medium text-green-400">
                                                        {result.notice_period.earliest_possible_start}
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                    <p className="text-sm text-slate-400">Most Likely Start</p>
                                                    <p className="text-lg font-medium text-blue-400">
                                                        {result.notice_period.most_likely_start}
                                                    </p>
                                                </div>
                                            </div>

                                            {result.notice_period.negotiation_tips && result.notice_period.negotiation_tips.length > 0 && (
                                                <div className="p-4 bg-slate-800/50 rounded-lg">
                                                    <p className="text-sm font-medium text-slate-300 mb-2">Negotiation Tips</p>
                                                    <ul className="space-y-1">
                                                        {result.notice_period.negotiation_tips.map((tip, i) => (
                                                            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                                                <ChevronRight className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                                                                {tip}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >
        </div >
    );
}