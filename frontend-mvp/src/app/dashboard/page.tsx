/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck      
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Users,
    Brain,
    Sparkles,
    Plus,
    ChevronRight,
    Star,
    Trash2,
    ArrowUpRight,
    Loader2,
    Briefcase,
    Clock,
    MapPin,
    Calendar,
    LogOut,
    User,
    Settings,
    HelpCircle,
    Heart,
    TrendingUp,
    Zap,
    CheckCircle2,
    MessageCircle,
    Target,
    Coffee,
    Rocket,
    Award,
    Smile,
    Phone,
    Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import * as dashboardApi from "@/utils/api/dashboardApi";
import type { DashboardData, SearchSummary, DeepDiveSummary } from "@/utils/api/dashboardApi";

// --- Animation Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

const floatAnimation = {
    y: [0, -10, 0],
    transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
    }
};

// --- Friendly Greetings ---
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", emoji: "☀️" };
    if (hour < 18) return { text: "Good afternoon", emoji: "🌤️" };
    return { text: "Good evening", emoji: "🌙" };
};

const motivationalQuotes = [
    "Great hires start here! Let's find your next star.",
    "Every great team starts with one great hire.",
    "You're building something amazing, one hire at a time.",
    "Finding talent shouldn't be hard. We've got your back!",
    "Let's make hiring the fun part of your day.",
];

export default function DashboardPage() {
    const router = useRouter();
    const { token, isAuthenticated, logout } = useAuth();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [activeTab, setActiveTab] = useState<"searches" | "deep-dives">("searches");
    const [searches, setSearches] = useState<SearchSummary[]>([]);
    const [deepDives, setDeepDives] = useState<DeepDiveSummary[]>([]);

    // UI State
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [randomQuote] = useState(() => motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]);

    // Pagination
    const [searchPage, setSearchPage] = useState(1);
    const [deepDivePage, setDeepDivePage] = useState(1);
    const [hasMoreSearches, setHasMoreSearches] = useState(true);
    const [hasMoreDeepDives, setHasMoreDeepDives] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [historyFilter, setHistoryFilter] = useState("");

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // --- Authentication Check ---
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    // --- Click Outside Handler ---
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Initial Load ---
    useEffect(() => {
        if (!token) return;

        const loadDashboard = async () => {
            try {
                setIsLoading(true);
                const data = await dashboardApi.getDashboard(token);
                setDashboardData(data);
                setSearches(data.recent_searches);
                setDeepDives(data.recent_deep_dives);
            } catch (error) {
                console.error("Failed to load dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboard();
    }, [token]);

    // --- Pagination Logic ---
    const loadMoreSearches = useCallback(async () => {
        if (!token || isLoadingMore || !hasMoreSearches) return;
        setIsLoadingMore(true);
        try {
            const data = await dashboardApi.getSearches(token, searchPage + 1, 20);
            setSearches((prev) => [...prev, ...data.searches]);
            setSearchPage((prev) => prev + 1);
            setHasMoreSearches(data.pagination.has_more);
        } catch (error) {
            console.error("Failed to load more searches:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [token, searchPage, isLoadingMore, hasMoreSearches]);

    const loadMoreDeepDives = useCallback(async () => {
        if (!token || isLoadingMore || !hasMoreDeepDives) return;
        setIsLoadingMore(true);
        try {
            const data = await dashboardApi.getDeepDives(token, deepDivePage + 1, 20);
            setDeepDives((prev) => [...prev, ...data.deep_dives]);
            setDeepDivePage((prev) => prev + 1);
            setHasMoreDeepDives(data.pagination.has_more);
        } catch (error) {
            console.error("Failed to load more deep dives:", error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [token, deepDivePage, isLoadingMore, hasMoreDeepDives]);

    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    if (activeTab === "searches") loadMoreSearches();
                    else loadMoreDeepDives();
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [activeTab, loadMoreSearches, loadMoreDeepDives]);

    // --- Handlers ---
    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const handleDeleteSearch = async (sessionId: string) => {
        if (!token || !confirm("Archive this search? Don't worry, you can always start a new one!")) return;
        try {
            await dashboardApi.deleteSearch(sessionId, token);
            setSearches((prev) => prev.filter((s) => s.session_id !== sessionId));
            if (dashboardData) {
                setDashboardData({
                    ...dashboardData,
                    metrics: {
                        ...dashboardData.metrics,
                        total_searches: Math.max(0, dashboardData.metrics.total_searches - 1),
                    },
                });
            }
        } catch (error) {
            console.error("Failed to delete search:", error);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Recently";
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    // --- Loading State ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center"
                >
                    <Sparkles className="h-8 w-8 text-white" />
                </motion.div>
                <p className="text-lg font-medium text-foreground">Getting things ready for you...</p>
                <p className="text-sm text-muted-foreground">✨ Just a moment</p>
            </div>
        );
    }

    const metrics = dashboardData?.metrics;
    const greeting = getGreeting();
    const firstName = dashboardData?.user?.username?.split("@")[0] || "there";

    const filteredSearches = searches.filter((s) =>
        !historyFilter ? true : (s.role_title || "").toLowerCase().includes(historyFilter.toLowerCase())
    );
    const filteredDeepDives = deepDives.filter((d) =>
        !historyFilter ? true : (d.candidate_name || "").toLowerCase().includes(historyFilter.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 text-foreground selection:bg-primary/20 selection:text-primary pb-20">

            {/* --- HEADER --- */}
            <header className="sticky top-0 z-50 glass border-b border-border/40 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/dashboard')}>
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg shadow-primary/20">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-foreground">NeuraLeap</span>
                    </div>

                    {/* Right Side */}
                    <div className="flex items-center gap-3">
                        {/* Quick Actions */}
                        <Button
                            onClick={() => router.push("/search")}
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hidden md:flex"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Find Talent
                        </Button>

                        {/* User Menu */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary/20 to-violet-500/20 border-2 border-primary/30 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all shadow-sm"
                            >
                                <span className="text-foreground font-bold text-sm">
                                    {firstName.substring(0, 2).toUpperCase()}
                                </span>
                            </button>

                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-56 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                                    >
                                        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
                                            <p className="font-semibold text-sm text-foreground truncate">Hey {firstName}! 👋</p>
                                            <p className="text-xs text-muted-foreground mt-1">Let's find great talent today</p>
                                        </div>
                                        <div className="p-1.5 space-y-0.5">
                                            <MenuButton icon={User} label="My Profile" />
                                            <MenuButton icon={Settings} label="Settings" />
                                            <MenuButton icon={HelpCircle} label="Help & Support" />
                                            <Separator className="my-1 bg-border/50" />
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
                                            >
                                                <LogOut className="h-4 w-4" /> Sign Out
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome Banner - Dismissible */}
                <AnimatePresence>
                    {showWelcome && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            className="mb-8 bg-gradient-to-r from-primary/10 via-violet-500/10 to-blue-500/10 border border-primary/20 rounded-2xl p-6 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 opacity-10">
                                <Sparkles className="h-32 w-32 text-primary" />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-foreground mb-1">
                                            We know you want to focus on hiring, not tech stuff! 🎯
                                        </h3>
                                        <p className="text-sm text-muted-foreground max-w-2xl">
                                            So we made this super simple. Just click, search, and find amazing people.
                                            No complicated jargon, no confusing buttons. Just hiring made easy.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowWelcome(false)}
                                        className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                                    >
                                        Got it!
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hero Section */}
                <div className="mb-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-3xl">{greeting.emoji}</span>
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                                {greeting.text}, {firstName}
                            </h1>
                        </div>
                        <p className="text-lg text-muted-foreground mb-4">
                            {randomQuote}
                        </p>

                        {/* Quick Action Buttons */}
                        <div className="flex flex-wrap gap-3 mt-6">
                            <Button
                                onClick={() => router.push("/search")}
                                size="lg"
                                className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 h-14 px-8 rounded-xl font-semibold"
                            >
                                <Rocket className="h-5 w-5 mr-2" />
                                Start Finding Talent
                            </Button>
                            <Button
                                onClick={() => router.push("/pipeline")}
                                size="lg"
                                variant="outline"
                                className="border-2 border-primary/30 hover:bg-primary/10 h-14 px-8 rounded-xl font-semibold"
                            >
                                <Users className="h-5 w-5 mr-2" />
                                View All Candidates
                            </Button>
                            <Button
                                onClick={() => router.push("/deep-dive")}
                                size="lg"
                                variant="outline"
                                className="border-border hover:bg-secondary/80 h-14 px-6 rounded-xl"
                            >
                                <Brain className="h-5 w-5 mr-2 text-violet-500" />
                                Analyze Resume
                            </Button>
                        </div>
                    </motion.div>
                </div>

                {/* Stats Cards - Simple & Visual */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10"
                >
                    <StatCard
                        icon={<Users className="h-6 w-6" />}
                        label="People You've Found"
                        value={metrics?.total_candidates_analyzed || 0}
                        subtext="Talented candidates"
                        color="blue"
                        gradient="from-blue-500 to-cyan-500"
                    />
                    <StatCard
                        icon={<Heart className="h-6 w-6" />}
                        label="Your Favorites"
                        value={metrics?.total_candidates_shortlisted || 0}
                        subtext="Top picks"
                        color="pink"
                        gradient="from-pink-500 to-rose-500"
                        highlight
                    />
                    <StatCard
                        icon={<Briefcase className="h-6 w-6" />}
                        label="Active Job Searches"
                        value={metrics?.total_searches || 0}
                        subtext="Positions open"
                        color="violet"
                        gradient="from-violet-500 to-purple-500"
                    />
                    <StatCard
                        icon={<Award className="h-6 w-6" />}
                        label="Deep Analyses"
                        value={metrics?.total_deep_dives || 0}
                        subtext="Detailed reports"
                        color="amber"
                        gradient="from-amber-500 to-orange-500"
                    />
                </motion.div>

                {/* Pipeline Overview Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => router.push("/pipeline")}
                    className="mb-10 bg-gradient-to-br from-card via-card to-primary/5 border-2 border-primary/20 rounded-2xl p-6 cursor-pointer hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg">
                                <Target className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                    Your Hiring Journey
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    See all your candidates in one place
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <PipelineStageCard
                            emoji="🔍"
                            label="Found"
                            count={metrics?.total_candidates_analyzed || 0}
                            color="blue"
                        />
                        <PipelineStageCard
                            emoji="⭐"
                            label="Favorites"
                            count={metrics?.total_candidates_shortlisted || 0}
                            color="amber"
                        />
                        <PipelineStageCard
                            emoji="💬"
                            label="Contacted"
                            count={0}
                            color="green"
                        />
                        <PipelineStageCard
                            emoji="✅"
                            label="Interviewing"
                            count={0}
                            color="violet"
                        />
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-sm text-primary font-medium">
                        <span>Click to see full candidate journey</span>
                        <ArrowUpRight className="h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>
                </motion.div>

                {/* Activity Section */}
                <div className="bg-card/50 border border-border rounded-2xl shadow-sm overflow-hidden backdrop-blur-sm">
                    {/* Tabs */}
                    <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-background/50">
                        <div>
                            <h2 className="text-xl font-bold text-foreground mb-1">Recent Activity</h2>
                            <p className="text-sm text-muted-foreground">Your latest searches and analyses</p>
                        </div>

                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                            <TabsList className="bg-secondary/40 p-1 h-11 rounded-xl border border-white/5">
                                <TabsTrigger value="searches" className="rounded-lg h-9 px-5 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
                                    <Briefcase className="h-4 w-4 mr-2" />
                                    Job Searches
                                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{metrics?.total_searches}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="deep-dives" className="rounded-lg h-9 px-5 data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium">
                                    <Brain className="h-4 w-4 mr-2" />
                                    Analyses
                                    <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">{metrics?.total_deep_dives}</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Search Filter */}
                    {(filteredSearches.length > 0 || filteredDeepDives.length > 0) && (
                        <div className="px-6 py-3 bg-background/30 border-b border-border">
                            <div className="relative group max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    value={historyFilter}
                                    onChange={(e) => setHistoryFilter(e.target.value)}
                                    placeholder={activeTab === "searches" ? "Search job titles..." : "Search candidates..."}
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary/20 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-6 bg-background/20 min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {activeTab === "searches" ? (
                                <motion.div
                                    key="searches"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="show"
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    {filteredSearches.length === 0 ? (
                                        <EmptyState
                                            icon={<Coffee className="h-12 w-12" />}
                                            title="No job searches yet"
                                            description="Ready to find your next great hire? Let's start by creating your first job search!"
                                            action={() => router.push("/search")}
                                            btnText="Find Your First Candidate"
                                            emoji="🚀"
                                        />
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {filteredSearches.map((search, i) => (
                                                <SearchItemFriendly
                                                    key={search.session_id}
                                                    search={search}
                                                    formatDate={formatDate}
                                                    onView={() => router.push(`/results/${search.session_id}`)}
                                                    onDelete={() => handleDeleteSearch(search.session_id)}
                                                    index={i}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="deep-dives"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="show"
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    {filteredDeepDives.length === 0 ? (
                                        <EmptyState
                                            icon={<Brain className="h-12 w-12" />}
                                            title="No analyses yet"
                                            description="Want to dive deep into a candidate's profile? Get detailed insights, skills assessment, and more!"
                                            action={() => router.push("/deep-dive")}
                                            btnText="Analyze First Candidate"
                                            emoji="🧠"
                                        />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filteredDeepDives.map((dive, i) => (
                                                <DeepDiveItemFriendly
                                                    key={dive.result_id}
                                                    dive={dive}
                                                    formatDate={formatDate}
                                                    onView={() => router.push(`/deep-dive/shared/${dive.result_id}`)}
                                                    index={i}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div ref={loadMoreRef} className="h-16 flex items-center justify-center mt-6">
                            {isLoadingMore && (
                                <div className="flex items-center gap-2 text-primary">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-sm font-medium">Loading more...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Help Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-10 text-center"
                >
                    <p className="text-sm text-muted-foreground mb-3">
                        Need help? We're here for you! 💙
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Chat with us
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                            <Mail className="h-4 w-4 mr-2" />
                            Email support
                        </Button>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}

// ================================================================
// COMPONENTS
// ================================================================

function MenuButton({ icon: Icon, label }: any) {
    return (
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-all group">
            <Icon className="h-4 w-4 group-hover:text-primary transition-colors" />
            {label}
        </button>
    );
}

function StatCard({ icon, label, value, subtext, color, gradient, highlight }: any) {
    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className={`relative bg-card rounded-2xl p-5 border transition-all overflow-hidden group cursor-default ${highlight ? 'border-pink-500/30 shadow-lg shadow-pink-500/10' : 'border-border hover:border-primary/30'
                }`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-5 rounded-bl-full -mr-8 -mt-8 group-hover:opacity-10 transition-opacity`} />

            <div className="relative z-10">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} bg-opacity-10 mb-4`}>
                    <div className="text-white">{icon}</div>
                </div>

                <div className="text-3xl font-bold text-foreground mb-1">
                    {value.toLocaleString()}
                </div>
                <div className="text-sm font-semibold text-foreground/80 mb-1">
                    {label}
                </div>
                <div className="text-xs text-muted-foreground">
                    {subtext}
                </div>
            </div>
        </motion.div>
    );
}

function PipelineStageCard({ emoji, label, count, color }: any) {
    const colorClasses = {
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        green: "bg-green-500/10 text-green-400 border-green-500/20",
        violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    };

    return (
        <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
            <div className="text-2xl mb-2">{emoji}</div>
            <div className="text-2xl font-bold mb-1">{count}</div>
            <div className="text-xs font-medium opacity-80">{label}</div>
        </div>
    );
}

function SearchItemFriendly({ search, formatDate, onView, onDelete, index }: any) {
    return (
        <motion.div
            variants={itemVariants}
            custom={index}
            onClick={onView}
            className="group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
        >
            <div className="flex items-start justify-between gap-4">
                {/* Left */}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <Briefcase className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {search.role_title || "Job Search"}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDate(search.created_at)}
                                {search.locations && search.locations[0] && (
                                    <>
                                        <span>•</span>
                                        <MapPin className="h-3.5 w-3.5" />
                                        {search.locations[0]}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Skills */}
                    {search.skills && search.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {search.skills.slice(0, 4).map((skill: string) => (
                                <span key={skill} className="px-3 py-1 bg-secondary/50 text-foreground text-xs font-medium rounded-full border border-white/5">
                                    {skill}
                                </span>
                            ))}
                            {search.skills.length > 4 && (
                                <span className="text-xs text-muted-foreground self-center">+{search.skills.length - 4} more</span>
                            )}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-semibold text-foreground">{search.enriched_count}</span>
                            <span className="text-xs text-muted-foreground">candidates found</span>
                        </div>
                        {search.shortlisted_count > 0 && (
                            <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                <span className="text-sm font-semibold text-foreground">{search.shortlisted_count}</span>
                                <span className="text-xs text-muted-foreground">favorites</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-col items-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                        <ChevronRight className="h-5 w-5" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function DeepDiveItemFriendly({ dive, formatDate, onView, index }: any) {
    const getScoreEmoji = (score: number) => {
        if (score >= 85) return "🌟";
        if (score >= 70) return "✨";
        if (score >= 60) return "👍";
        return "📊";
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        if (score >= 60) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    };

    return (
        <motion.div
            variants={itemVariants}
            custom={index}
            onClick={onView}
            className="group bg-card border border-border rounded-xl p-5 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/5 transition-all cursor-pointer"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300 font-bold text-lg">
                    {dive.candidate_name.substring(0, 2).toUpperCase()}
                </div>
                {dive.match_score && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-bold text-sm ${getScoreColor(dive.match_score)}`}>
                        <span>{getScoreEmoji(dive.match_score)}</span>
                        <span>{dive.match_score}%</span>
                    </div>
                )}
            </div>

            <h3 className="font-bold text-lg text-foreground group-hover:text-violet-400 transition-colors mb-1 line-clamp-1">
                {dive.candidate_name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 font-medium">
                {dive.candidate_title || "Professional"}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(dive.created_at)}
                </span>
                <span className="text-xs font-semibold text-violet-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    View Analysis <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
            </div>
        </motion.div>
    );
}

function EmptyState({ icon, title, description, action, btnText, emoji }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center py-16 px-4"
        >
            <motion.div
                animate={floatAnimation}
                className="mb-6"
            >
                <div className="h-24 w-24 bg-gradient-to-br from-secondary to-secondary/50 rounded-3xl flex items-center justify-center shadow-lg">
                    {icon}
                </div>
            </motion.div>
            <div className="text-4xl mb-4">{emoji}</div>
            <h3 className="text-2xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">{description}</p>
            <Button
                onClick={action}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white rounded-xl h-12 px-8 shadow-lg shadow-primary/20"
            >
                <Plus className="h-5 w-5 mr-2" />
                {btnText}
            </Button>
        </motion.div>
    );
}