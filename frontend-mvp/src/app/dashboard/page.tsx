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
    ExternalLink,
    ArrowUpRight,
    Loader2,
    Briefcase,
    LayoutGrid,
    List,
    Settings,
    Clock,
    Zap,
    MapPin,
    Calendar,
    LogOut,
    User,
    CreditCard,
    Bell,
    HelpCircle,
    FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import * as dashboardApi from "@/utils/api/dashboardApi";
import type { DashboardData, SearchSummary, DeepDiveSummary } from "@/utils/api/dashboardApi";

// --- Animation Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

// --- Utility for Time-based Greeting ---
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

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

    // Pagination & View State
    const [searchPage, setSearchPage] = useState(1);
    const [deepDivePage, setDeepDivePage] = useState(1);
    const [hasMoreSearches, setHasMoreSearches] = useState(true);
    const [hasMoreDeepDives, setHasMoreDeepDives] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("list");
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

    // --- Click Outside Handler for Menus ---
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
        if (!token || !confirm("Archive this job? The candidate data will be removed.")) return;
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
        if (!dateStr) return "—";
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
                <div className="bg-card border border-border p-8 rounded-2xl shadow-xl flex flex-col items-center">
                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                    <p className="text-lg font-medium text-foreground">Preparing workspace...</p>
                </div>
            </div>
        );
    }

    const metrics = dashboardData?.metrics;
    const filteredSearches = searches.filter((s) =>
        !historyFilter ? true : (s.role_title || "untitled").toLowerCase().includes(historyFilter.toLowerCase())
    );
    const filteredDeepDives = deepDives.filter((d) =>
        !historyFilter ? true : (d.candidate_name || "").toLowerCase().includes(historyFilter.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background dot-bg text-foreground selection:bg-primary/20 selection:text-primary pb-20">

            {/* --- HEADER --- */}
            <header className="sticky top-0 z-50 glass border-b border-border/40 backdrop-blur-xl transition-all">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/dashboard')}>
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-lg shadow-primary/20">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-foreground">NeuraLeap</span>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-4">
                        {/* System Status */}
                        <div className="hidden md:flex items-center gap-2 bg-secondary/30 rounded-full px-4 py-1.5 border border-border/50 group cursor-help transition-colors hover:bg-secondary/50">
                            <div className="relative h-2 w-2">
                                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                                <div className="relative h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">System Online</span>
                        </div>

                        {/* Notifications */}
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 relative">
                            <Bell className="h-5 w-5" />
                            {/* Notification Dot */}
                            <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-primary rounded-full border border-background ring-2 ring-background"></span>
                        </Button>

                        {/* User Menu Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="h-9 w-9 rounded-full bg-gradient-to-tr from-secondary to-secondary/50 border border-border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all shadow-sm"
                            >
                                <span className="text-foreground font-bold text-sm">
                                    {dashboardData?.user?.username?.substring(0, 2).toUpperCase() || "HR"}
                                </span>
                            </button>

                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-60 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl z-50 overflow-hidden ring-1 ring-white/10"
                                    >
                                        <div className="p-4 border-b border-border/50 bg-gradient-to-r from-secondary/50 to-transparent">
                                            <p className="font-medium text-sm text-foreground truncate">{dashboardData?.user?.username}</p>
                                            <p className="text-xs text-primary mt-0.5 font-medium">✨ Pro Plan Active</p>
                                        </div>
                                        <div className="p-1 space-y-0.5">
                                            <MenuButton icon={User} label="My Profile" />
                                            <MenuButton icon={CreditCard} label="Billing & Credits" />
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

            <main className="max-w-7xl mx-auto px-6 py-10">
                {/* Hero / Greeting Section */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-2 text-muted-foreground/80 font-medium mb-2 bg-secondary/30 w-fit px-3 py-1 rounded-full text-xs border border-white/5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
                            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-500 to-blue-500">{dashboardData?.user?.username?.split("@")[0] || "Recruiter"}</span>
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
                            You currently have <strong className="text-foreground">{metrics?.total_searches || 0} active jobs</strong> in your pipeline.
                            Ready to find your next hire?
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex gap-3"
                    >
                        <Button
                            onClick={() => router.push("/search")}
                            className="bg-primary hover:bg-primary/90 text-white shadow-[0_0_25px_rgba(var(--primary),0.4)] h-12 px-8 rounded-xl transition-all hover:scale-105 active:scale-95 border-t border-white/20 font-semibold text-base"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Post New Job
                        </Button>
                        <Button
                            onClick={() => router.push("/deep-dive")}
                            variant="outline"
                            className="bg-card/50 text-foreground hover:bg-secondary/80 border-border h-12 px-6 rounded-xl transition-all hover:border-primary/50"
                        >
                            <Brain className="h-5 w-5 mr-2 text-violet-500" />
                            Analyze Resume
                        </Button>
                    </motion.div>
                </div>

                {/* KPI Cards - Vibrant & Clear */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
                    <KPICard
                        label="Candidates Sourced"
                        value={metrics?.total_candidates_analyzed || 0}
                        icon={Users}
                        trend="+12% this week"
                        color="blue"
                    />
                    <KPICard
                        label="Favorites"
                        value={metrics?.total_candidates_shortlisted || 0}
                        icon={Star}
                        trend="High match rate"
                        color="amber"
                        highlight
                    />
                    <KPICard
                        label="Reports Generated"
                        value={metrics?.total_deep_dives || 0}
                        icon={FileText}
                        trend="AI Analysis"
                        color="violet"
                    />

                    {/* Credits Card */}
                    <div
                        className="relative bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-2xl p-5 text-white shadow-xl flex flex-col justify-between group overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity duration-500">
                            <Zap className="h-32 w-32 text-yellow-400 rotate-12" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-medium text-gray-300">Credits</span>
                                <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20">Pro Plan</Badge>
                            </div>
                            <div className="text-4xl font-bold mb-1 tracking-tight">Unlimited</div>
                            <div className="text-sm text-gray-400 mb-4">Available for sourcing</div>
                            <Progress value={((metrics?.credits_remaining ?? 0) / 100) * 100} className="h-1.5 bg-gray-700" indicatorClassName="bg-gradient-to-r from-yellow-400 to-orange-500" />
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-card/50 border border-border rounded-2xl shadow-sm overflow-hidden min-h-[600px] flex flex-col backdrop-blur-sm">
                    {/* Tab Navigation & Filters */}
                    <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 bg-background/95 z-20">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
                            <TabsList className="bg-secondary/40 p-1 h-12 rounded-xl w-full sm:w-auto border border-white/5">
                                <TabsTrigger value="searches" className="rounded-lg h-10 px-6 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-muted-foreground font-medium">
                                    <Briefcase className="h-4 w-4 mr-2" />
                                    Active Jobs
                                    <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5">{metrics?.total_searches}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="deep-dives" className="rounded-lg h-10 px-6 data-[state=active]:bg-background data-[state=active]:text-violet-500 data-[state=active]:shadow-sm transition-all text-muted-foreground font-medium">
                                    <Brain className="h-4 w-4 mr-2" />
                                    Candidate Reports
                                    <Badge variant="secondary" className="ml-2 bg-violet-500/10 text-violet-500 border-violet-500/20 text-[10px] px-1.5">{metrics?.total_deep_dives}</Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    value={historyFilter}
                                    onChange={(e) => setHistoryFilter(e.target.value)}
                                    placeholder={activeTab === "searches" ? "Search jobs..." : "Search candidates..."}
                                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary/20 focus:bg-secondary/40 focus:ring-1 focus:ring-primary focus:border-primary/50 outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                            <div className="flex bg-secondary/40 rounded-lg p-1 border border-border">
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <List className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode("grid")}
                                    className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-6 bg-background/30">
                        <AnimatePresence mode="wait">
                            {activeTab === "searches" ? (
                                <motion.div
                                    key="searches"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="show"
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    {/* Table Headers for List View */}
                                    {viewMode === "list" && filteredSearches.length > 0 && (
                                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 select-none">
                                            <div className="col-span-4">Role Title</div>
                                            <div className="col-span-3">Target Skills</div>
                                            <div className="col-span-3">Candidate Pipeline</div>
                                            <div className="col-span-2 text-right">Actions</div>
                                        </div>
                                    )}

                                    {filteredSearches.length === 0 ? (
                                        <EmptyState
                                            title="No Active Jobs Found"
                                            description="You haven't posted any jobs yet. Create a new search to start sourcing candidates."
                                            action={() => router.push("/search")}
                                            btnText="Create First Job Search"
                                            icon={Briefcase}
                                        />
                                    ) : (
                                        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
                                            {filteredSearches.map((search, i) => (
                                                <SearchItem
                                                    key={search.session_id}
                                                    search={search}
                                                    viewMode={viewMode}
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
                                    {/* Table Headers for List View */}
                                    {viewMode === "list" && filteredDeepDives.length > 0 && (
                                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 select-none">
                                            <div className="col-span-4">Candidate Name</div>
                                            <div className="col-span-4">Current Title</div>
                                            <div className="col-span-2">AI Match Score</div>
                                            <div className="col-span-2 text-right">Date Analyzed</div>
                                        </div>
                                    )}

                                    {filteredDeepDives.length === 0 ? (
                                        <EmptyState
                                            title="No Reports Yet"
                                            description="Analyze a candidate's profile to get detailed insights, interview questions, and culture fit analysis."
                                            action={() => router.push("/deep-dive")}
                                            btnText="Analyze Candidate Profile"
                                            icon={Brain}
                                        />
                                    ) : (
                                        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-3"}>
                                            {filteredDeepDives.map((dive, i) => (
                                                <DeepDiveItem
                                                    key={dive.result_id}
                                                    dive={dive}
                                                    viewMode={viewMode}
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

                        <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-6">
                            {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ================================================================
// Sub-Components
// ================================================================

function MenuButton({ icon: Icon, label }: any) {
    return (
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-all group">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            {label}
        </button>
    )
}

function KPICard({ label, value, icon: Icon, trend, color, highlight }: any) {
    const colors = {
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    };

    return (
        <motion.div
            whileHover={{ y: -4 }}
            className={`bg-card rounded-2xl p-5 border transition-all hover:shadow-xl hover:shadow-primary/5 relative overflow-hidden group ${highlight ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-border'}`}
        >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-${color === 'violet' ? 'purple' : color}-500/10 to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`p-3 rounded-xl ${colors[color] || colors.blue}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <div className="relative z-10">
                <div className="text-3xl font-bold text-foreground tracking-tight">{value.toLocaleString()}</div>
                <div className="text-sm font-medium text-muted-foreground mt-1">{label}</div>
                {trend && (
                    <div className="text-xs text-emerald-400 mt-3 flex items-center gap-1 font-medium bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full border border-emerald-400/20">
                        <ArrowUpRight className="h-3 w-3" />
                        {trend}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function SearchItem({ search, viewMode, formatDate, onView, onDelete, index }: any) {
    const isNew = new Date(search.created_at).getTime() > Date.now() - 86400000;

    if (viewMode === "list") {
        return (
            <motion.div
                variants={itemVariants}
                onClick={onView}
                className="group bg-card border-l-4 border-l-primary/60 border-y border-r border-border rounded-r-xl rounded-l-sm p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-l-primary hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer relative"
            >
                {/* 1. Role Info */}
                <div className="flex-1 min-w-0 md:col-span-4 grid grid-cols-[50px_1fr] gap-5 items-center">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Briefcase className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">{search.role_title || "Untitled Role"}</h3>
                            {isNew && <Badge className="bg-blue-500 text-white hover:bg-blue-600 text-[10px] h-5 px-1.5">New</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDate(search.created_at)}</span>
                            {search.locations && search.locations[0] && (
                                <>
                                    <span className="text-muted-foreground/30">•</span>
                                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {search.locations[0]}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Skills Context */}
                <div className="hidden md:flex md:col-span-3 w-48 flex-col gap-2 pl-2">
                    <div className="flex flex-wrap gap-1.5">
                        {search.skills.slice(0, 2).map((skill: string) => (
                            <span key={skill} className="px-2.5 py-1 bg-secondary/50 text-foreground text-xs font-medium rounded-md border border-white/5 truncate max-w-[100px]">
                                {skill}
                            </span>
                        ))}
                        {search.skills.length > 2 && <span className="text-xs font-medium text-muted-foreground self-center">+{search.skills.length - 2}</span>}
                    </div>
                </div>

                {/* 3. Pipeline Stats */}
                <div className="w-full md:w-auto md:col-span-3 flex items-center gap-8 pl-4">
                    <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-lg font-bold text-foreground group-hover:text-blue-400 transition-colors">{search.enriched_count}</span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Sourced</span>
                    </div>
                    <Separator orientation="vertical" className="h-8 hidden md:block bg-border" />
                    <div className="flex flex-col items-center min-w-[60px]">
                        <span className={`text-lg font-bold ${search.shortlisted_count > 0 ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
                            {search.shortlisted_count}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Favorites</span>
                    </div>
                </div>

                {/* 4. Actions */}
                <div className="md:col-span-2 flex items-center justify-end gap-2 ml-auto">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-8 rounded-full flex items-center justify-center bg-secondary/30 group-hover:bg-primary group-hover:text-white transition-all">
                        <ChevronRight className="h-4 w-4" />
                    </div>
                </div>
            </motion.div>
        );
    }

    // Grid View
    return (
        <motion.div
            variants={itemVariants}
            onClick={onView}
            className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[240px] relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <Briefcase className="h-5 w-5" />
                    </div>
                    {search.shortlisted_count > 0 && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-2.5 py-1 h-6 hover:bg-amber-500/20 font-medium shadow-none">
                            <Star className="h-3 w-3 mr-1.5 fill-amber-500" />
                            {search.shortlisted_count} Favorites
                        </Badge>
                    )}
                </div>

                <h3 className="font-bold text-lg text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors">{search.role_title || "Untitled Role"}</h3>
                <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Posted {formatDate(search.created_at)}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                    {search.skills.slice(0, 3).map((skill: string) => (
                        <span key={skill} className="px-2 py-1 bg-secondary/40 text-muted-foreground text-xs font-medium rounded border border-white/5">
                            {skill}
                        </span>
                    ))}
                </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                    <Users className="h-4 w-4 text-blue-400" />
                    {search.enriched_count} Candidates
                </div>
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <ArrowUpRight className="h-4 w-4" />
                </div>
            </div>
        </motion.div>
    );
}

function DeepDiveItem({ dive, viewMode, formatDate, onView, index }: any) {
    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        if (score >= 60) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
        return "text-red-400 bg-red-500/10 border-red-500/20";
    };

    if (viewMode === "list") {
        return (
            <motion.div
                variants={itemVariants}
                onClick={onView}
                className="group bg-card border-l-4 border-l-violet-500/60 border-y border-r border-border rounded-r-xl rounded-l-sm p-5 grid grid-cols-12 gap-4 items-center hover:border-l-violet-500 hover:shadow-lg hover:shadow-violet-500/5 transition-all cursor-pointer"
            >
                <div className="col-span-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center text-violet-300 font-bold border border-violet-500/30 group-hover:scale-110 transition-transform">
                        {dive.candidate_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-foreground text-base truncate group-hover:text-violet-400 transition-colors">{dive.candidate_name}</div>
                        {dive.linkedin_url && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium">in</span>
                                LinkedIn
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-span-4 hidden md:block pl-2">
                    <div className="text-sm font-medium text-muted-foreground truncate" title={dive.candidate_title}>
                        {dive.candidate_title || "No title available"}
                    </div>
                </div>

                <div className="col-span-2">
                    {dive.match_score ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getScoreColor(dive.match_score)}`}>
                            {dive.match_score}% Match
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground italic">Pending...</span>
                    )}
                </div>

                <div className="col-span-2 text-right text-xs text-muted-foreground font-medium pr-2">
                    {formatDate(dive.created_at)}
                </div>
            </motion.div>
        );
    }

    // Grid View
    return (
        <motion.div
            variants={itemVariants}
            onClick={onView}
            className="group bg-card border border-border rounded-2xl p-5 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300 cursor-pointer flex flex-col h-[220px] relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold border border-border shadow-sm group-hover:border-violet-500/30 transition-colors">
                    {dive.candidate_name.substring(0, 2).toUpperCase()}
                </div>
                {dive.match_score && (
                    <div className={`flex flex-col items-end`}>
                        <span className="text-2xl font-bold text-foreground group-hover:text-violet-400 transition-colors">{dive.match_score}%</span>
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">AI Score</span>
                    </div>
                )}
            </div>

            <div className="flex-1">
                <h3 className="font-bold text-lg text-foreground truncate group-hover:text-violet-400 transition-colors">{dive.candidate_name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1 font-medium">{dive.candidate_title}</p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
                <span className="text-xs text-muted-foreground font-medium">{formatDate(dive.created_at)}</span>
                <div className="flex items-center gap-1 text-xs font-bold text-violet-400 group-hover:translate-x-1 transition-transform">
                    View Report <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
            </div>
        </motion.div>
    );
}

function EmptyState({ title, description, action, btnText, icon: Icon }: any) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-20 px-4">
            <div className="h-20 w-20 bg-secondary/50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/5">
                <Icon className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-md mb-8 leading-relaxed font-medium">{description}</p>
            <Button onClick={action} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-8 shadow-lg shadow-primary/20 transition-transform hover:scale-105">
                <Plus className="h-4 w-4 mr-2" />
                {btnText}
            </Button>
        </div>
    );
}