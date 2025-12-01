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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import * as dashboardApi from "@/utils/api/dashboardApi";
import type { DashboardData, SearchSummary, DeepDiveSummary } from "@/utils/api/dashboardApi";

export default function DashboardPage() {
    const router = useRouter();
    const { token, isAuthenticated, user } = useAuth();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [activeTab, setActiveTab] = useState<"searches" | "deep-dives">("searches");
    const [searches, setSearches] = useState<SearchSummary[]>([]);
    const [deepDives, setDeepDives] = useState<DeepDiveSummary[]>([]);
    const [searchPage, setSearchPage] = useState(1);
    const [deepDivePage, setDeepDivePage] = useState(1);
    const [hasMoreSearches, setHasMoreSearches] = useState(true);
    const [hasMoreDeepDives, setHasMoreDeepDives] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [historyFilter, setHistoryFilter] = useState("");

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Redirect if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    // Load initial data
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

    // Load more searches
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

    // Load more deep dives
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

    // Infinite scroll observer
    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    if (activeTab === "searches") {
                        loadMoreSearches();
                    } else {
                        loadMoreDeepDives();
                    }
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [activeTab, loadMoreSearches, loadMoreDeepDives]);

    // Delete search
    const handleDeleteSearch = async (sessionId: string) => {
        if (!token || !confirm("Delete this search? This cannot be undone.")) return;

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

    // Format date
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const metrics = dashboardData?.metrics;

    // Filter helpers
    const filteredSearches = searches.filter((s) =>
        !historyFilter ? true : (s.role_title || "untitled").toLowerCase().includes(historyFilter.toLowerCase())
    );

    const filteredDeepDives = deepDives.filter((d) =>
        !historyFilter ? true : (d.candidate_name || "").toLowerCase().includes(historyFilter.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Softer radial background (premium) */}
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(80,80,120,0.08),transparent_70%)]" />

            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <span className="font-semibold text-lg">NeuraLeap</span>
                        </div>
                        <nav className="hidden md:flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="text-foreground">Dashboard</Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => router.push("/search")}>
                                Search
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => router.push("/deep-dive")}>
                                Deep Dive
                            </Button>
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <PremiumBadge />
                        <Button variant="outline" size="sm" className="hidden sm:flex">
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                        </Button>
                        <Button size="sm" onClick={() => router.push("/search")}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Search
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome & Quick Actions */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-1 tracking-tight">
                        Welcome back{dashboardData?.user?.username ? `, ${dashboardData.user.username.split("@")[0]}` : ""}
                    </h1>
                    <p className="text-muted-foreground">
                        Here&apos;s what&apos;s happening with your recruiting pipeline
                    </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard
                        icon={Search}
                        label="Total Searches"
                        value={metrics?.total_searches || 0}
                        subtext={`${metrics?.searches_this_month || 0} this month`}
                        color="blue"
                    />
                    <MetricCard
                        icon={Users}
                        label="Candidates Analyzed"
                        value={metrics?.total_candidates_analyzed || 0}
                        subtext={`${metrics?.total_candidates_shortlisted || 0} shortlisted`}
                        color="green"
                    />
                    <MetricCard
                        icon={Brain}
                        label="Deep Dives"
                        value={metrics?.total_deep_dives || 0}
                        subtext="Individual analyses"
                        color="purple"
                    />
                    <MetricCard
                        icon={ArrowUpRight}
                        label="Credits"
                        value={metrics?.credits_remaining ?? 0}
                        subtext={`${metrics?.credits_used || 0} used`}
                        color="amber"
                        showProgress
                        progress={((metrics?.credits_remaining ?? 0) / 100) * 100}
                    />
                </div>

                {/* Account Status */}
                <div className="bg-card px-5 py-4 rounded-xl border border-border/40 mb-8 flex items-center justify-between shadow-sm">
                    <div>
                        <h3 className="font-semibold text-lg">Account Status</h3>
                        <p className="text-sm text-muted-foreground">You are a <span className="font-medium">Pro Member</span>. Enjoy unlimited usage and premium features.</p>
                    </div>
                    <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30 shadow-sm px-3 py-1">
                        🔥 Unlimited Credits
                    </Badge>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <QuickActionCard
                        title="Start New Search"
                        description="Find candidates with AI-powered search and analysis"
                        icon={Search}
                        onClick={() => router.push("/search")}
                        gradient="from-blue-500/10 to-cyan-500/10"
                        iconColor="text-blue-500"
                    />
                    <QuickActionCard
                        title="Deep Dive Analysis"
                        description="Analyze a single candidate with comprehensive insights"
                        icon={Brain}
                        onClick={() => router.push("/deep-dive")}
                        gradient="from-purple-500/10 to-pink-500/10"
                        iconColor="text-purple-500"
                    />
                </div>

                {/* History Section */}
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                    {/* Tabs Header */}
                    <div className="border-b border-border/40 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div>
                                <h2 className="text-lg font-semibold">Your Activity</h2>
                                <p className="text-sm text-muted-foreground">Quickly access your recent searches and deep dives</p>
                            </div>

                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                                <TabsList className="bg-secondary/10 h-10 px-1 rounded-lg">
                                    <TabsTrigger
                                        value="searches"
                                        className="data-[state=active]:bg-secondary data-[state=active]:shadow-none h-8 px-3 text-sm"
                                    >
                                        <Search className="h-3.5 w-3.5 mr-2 inline-block" />
                                        Searches ({metrics?.total_searches || 0})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="deep-dives"
                                        className="data-[state=active]:bg-secondary data-[state=active]:shadow-none h-8 px-3 text-sm"
                                    >
                                        <Brain className="h-3.5 w-3.5 mr-2 inline-block" />
                                        Deep Dives ({metrics?.total_deep_dives || 0})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center border border-border/50 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode("grid")}
                                    className={`p-1.5 ${viewMode === "grid" ? "bg-secondary" : "hover:bg-secondary/50"}`}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`p-1.5 ${viewMode === "list" ? "bg-secondary" : "hover:bg-secondary/50"}`}
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Filter input (native input to avoid extra deps) */}
                            <div className="hidden sm:flex items-center gap-2 border border-border/50 rounded-lg px-2 py-1">
                                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    value={historyFilter}
                                    onChange={(e) => setHistoryFilter(e.target.value)}
                                    placeholder="Filter history..."
                                    className="bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <AnimatePresence mode="wait">
                            {activeTab === "searches" ? (
                                <motion.div
                                    key="searches"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    {filteredSearches.length === 0 ? (
                                        <EmptyState
                                            icon={Search}
                                            title="No searches yet"
                                            description="Start your first search to find great candidates"
                                            action={
                                                <Button onClick={() => router.push("/search")}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    New Search
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
                                            {filteredSearches.map((search, index) => (
                                                <SearchCard
                                                    key={search.session_id}
                                                    search={search}
                                                    viewMode={viewMode}
                                                    formatDate={formatDate}
                                                    onView={() => router.push(`/results/${search.session_id}`)}
                                                    onDelete={() => handleDeleteSearch(search.session_id)}
                                                    index={index}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="deep-dives"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    {filteredDeepDives.length === 0 ? (
                                        <EmptyState
                                            icon={Brain}
                                            title="No deep dives yet"
                                            description="Analyze individual candidates for comprehensive insights"
                                            action={
                                                <Button onClick={() => router.push("/deep-dive")}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    New Deep Dive
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
                                            {filteredDeepDives.map((dive, index) => (
                                                <DeepDiveCard
                                                    key={dive.result_id}
                                                    dive={dive}
                                                    viewMode={viewMode}
                                                    formatDate={formatDate}
                                                    onView={() => router.push(`/deep-dive/shared/${dive.result_id}`)}
                                                    index={index}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Load more trigger */}
                        <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-4">
                            {isLoadingMore && (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ================================================================
// Sub-components
// ================================================================

function PremiumBadge() {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 shadow-[0_6px_20px_rgba(255,200,0,0.06)]">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium text-amber-600">Pro User • Unlimited Credits</span>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    subtext,
    color,
    showProgress,
    progress,
}: {
    icon: any;
    label: string;
    value: number;
    subtext: string;
    color: "blue" | "green" | "purple" | "amber";
    showProgress?: boolean;
    progress?: number;
}) {
    const colorClasses = {
        blue: "text-blue-500 bg-blue-500/10",
        green: "text-green-500 bg-green-500/10",
        purple: "text-purple-500 bg-purple-500/10",
        amber: "text-amber-500 bg-amber-500/10",
    };

    return (
        <div className="bg-card rounded-xl border border-border/50 p-5 hover:border-border/80 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${colorClasses[color]} shadow-inner`}>
                    <Icon className="h-4 w-4" />
                </div>
                {showProgress && (
                    <div className="text-xs text-muted-foreground">
                        {progress !== undefined ? `${Math.round(progress)}%` : "—"}
                    </div>
                )}
            </div>
            <div className="text-2xl font-bold mb-1">{value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{subtext}</div>
            {showProgress && (
                <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function QuickActionCard({
    title,
    description,
    icon: Icon,
    onClick,
    gradient,
    iconColor,
}: {
    title: string;
    description: string;
    icon: any;
    onClick: () => void;
    gradient: string;
    iconColor: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`
        relative overflow-hidden rounded-xl border border-border/50 p-6 text-left
        bg-gradient-to-br ${gradient} hover:border-border transition-all
        group hover:shadow-md transform hover:-translate-y-0.5 duration-200
      `}
        >
            <div className="flex items-start justify-between">
                <div>
                    <div className={`p-2.5 rounded-xl bg-background/80 inline-flex mb-4 ${iconColor}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
        </button>
    );
}

function SearchCard({
    search,
    viewMode,
    formatDate,
    onView,
    onDelete,
    index,
}: {
    search: SearchSummary;
    viewMode: "grid" | "list";
    formatDate: (date: string) => string;
    onView: () => void;
    onDelete: () => void;
    index: number;
}) {
    if (viewMode === "list") {
        return (
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 group cursor-pointer transition-all duration-200"
                onClick={onView}
            >
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{search.role_title || "Untitled Search"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{search.enriched_count} candidates</span>
                        <span>•</span>
                        <span>{formatDate(search.created_at)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {search.avg_match_score && search.avg_match_score > 0 && (
                        <Badge variant="outline" className="text-xs">
                            {search.avg_match_score}% avg
                        </Badge>
                    )}
                    {search.shortlisted_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
                            {search.shortlisted_count}
                        </Badge>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-background rounded-lg border border-border/50 p-4 hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer group"
            onClick={onView}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
            </div>

            <h3 className="font-semibold mb-1 line-clamp-1">{search.role_title || "Untitled Search"}</h3>

            {search.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {search.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {skill}
                        </Badge>
                    ))}
                    {search.skills.length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            +{search.skills.length - 3}
                        </Badge>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {search.enriched_count}
                    </span>
                    {search.shortlisted_count > 0 && (
                        <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {search.shortlisted_count}
                        </span>
                    )}
                </div>
                <span>{formatDate(search.created_at)}</span>
            </div>
        </motion.div>
    );
}

function DeepDiveCard({
    dive,
    viewMode,
    formatDate,
    onView,
    index,
}: {
    dive: DeepDiveSummary;
    viewMode: "grid" | "list";
    formatDate: (date: string) => string;
    onView: () => void;
    index: number;
}) {
    if (viewMode === "list") {
        return (
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 group cursor-pointer transition-all duration-200"
                onClick={onView}
            >
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Brain className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{dive.candidate_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{dive.candidate_title}</div>
                </div>
                <div className="flex items-center gap-2">
                    {dive.match_score && (
                        <Badge variant="outline" className={`text-xs ${getScoreColor(dive.match_score)}`}>
                            {dive.match_score}%
                        </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatDate(dive.created_at)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-background rounded-lg border border-border/50 p-4 hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer"
            onClick={onView}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Brain className="h-5 w-5 text-purple-500" />
                </div>
                {dive.match_score && (
                    <Badge variant="outline" className={`text-xs ${getScoreColor(dive.match_score)}`}>
                        {dive.match_score}% match
                    </Badge>
                )}
            </div>

            <h3 className="font-semibold mb-1 line-clamp-1">{dive.candidate_name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{dive.candidate_title}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                {dive.linkedin_url && (
                    <a
                        href={dive.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 hover:text-primary"
                    >
                        <ExternalLink className="h-3 w-3" />
                        LinkedIn
                    </a>
                )}
                <span>{formatDate(dive.created_at)}</span>
            </div>
        </motion.div>
    );
}

function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: any;
    title: string;
    description: string;
    action: React.ReactNode;
}) {
    return (
        <div className="text-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">{description}</p>
            {action}
        </div>
    );
}

function getScoreColor(score: number): string {
    if (score >= 80) return "border-green-500/50 text-green-500";
    if (score >= 60) return "border-amber-500/50 text-amber-500";
    return "border-red-500/50 text-red-500";
}
