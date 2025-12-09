
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
    Trash2,
    ExternalLink,
    Loader2,
    Briefcase,
    LayoutGrid,
    List,
    Clock,
    TrendingUp,
    Calendar,
    Mail,
    CheckCircle,
    ArrowUpRight,
    GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import * as dashboardApi from "@/utils/api/dashboardApi";
import { usePipelineList } from "@/hooks/usePipeline";

interface DashboardMetrics {
    total_searches: number;
    total_candidates_analyzed: number;
    total_candidates_shortlisted: number;
    total_deep_dives: number;
    credits_remaining: number;
    searches_this_month: number;
    total_pipelines: number;
    active_pipelines: number;
}

interface SearchSummary {
    session_id: string;
    role_title: string;
    skills: string[];
    total_candidates: number;
    shortlisted_count: number;
    status: string;
    created_at: string;
    pipeline_id?: string;
}

interface PipelineSummary {
    pipeline_id: string;
    name: string;
    job_title: string;
    status: string;
    stats: {
        total_sourced: number;
        total_shortlisted: number;
        total_contacted: number;
        total_scheduled: number;
        total_hired: number;
    };
    created_at: string;
    updated_at: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const { token, isAuthenticated, user } = useAuth();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [searches, setSearches] = useState<SearchSummary[]>([]);
    const [activeTab, setActiveTab] = useState<"pipelines" | "searches">("pipelines");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Pipeline data
    const { pipelines, loading: pipelinesLoading, fetchPipelines } = usePipelineList();

    // Auth check
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/login");
        }
    }, [isAuthenticated, router]);

    // Load data
    useEffect(() => {
        if (!token) return;

        const loadDashboard = async () => {
            try {
                setIsLoading(true);
                const data = await dashboardApi.getDashboard(token);
                setMetrics(data.metrics);
                setSearches(data.recent_searches || []);
            } catch (error) {
                console.error("Failed to load dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDashboard();
        fetchPipelines();
    }, [token, fetchPipelines]);

    // Delete search
    const handleDeleteSearch = async (sessionId: string) => {
        if (!token) return;
        try {
            await dashboardApi.deleteSearch(sessionId, token);
            setSearches(prev => prev.filter(s => s.session_id !== sessionId));
        } catch (error) {
            console.error("Failed to delete search:", error);
        }
    };

    // Get active pipelines for quick access
    const activePipelines = pipelines.filter(p => p.status === "active").slice(0, 5);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0a0a0a]/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            Welcome back{user?.username ? `, ${user.username}` : ""}
                        </h1>
                        <p className="text-[13px] text-white/40">
                            Here's what's happening with your recruitment
                        </p>
                    </div>
                    <Button
                        onClick={() => router.push("/search")}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Search
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <MetricCard
                        icon={GitBranch}
                        label="Active Pipelines"
                        value={activePipelines.length}
                        color="purple"
                    />
                    <MetricCard
                        icon={Users}
                        label="Candidates Analyzed"
                        value={metrics?.total_candidates_analyzed || 0}
                        color="blue"
                    />
                    <MetricCard
                        icon={Mail}
                        label="Outreach Sent"
                        value={metrics?.total_candidates_shortlisted || 0}
                        color="green"
                    />
                    <MetricCard
                        icon={Calendar}
                        label="Interviews Scheduled"
                        value={metrics?.total_deep_dives || 0}
                        color="yellow"
                    />
                </div>

                {/* Active Pipelines Quick View */}
                {activePipelines.length > 0 && (
                    <section className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Active Pipelines</h2>
                            <Link
                                href="/pipeline"
                                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                                View All <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activePipelines.map(pipeline => (
                                <PipelineQuickCard key={pipeline.pipeline_id} pipeline={pipeline} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Tab Content */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        {/* Tabs */}
                        <div className="flex items-center bg-white/[0.04] rounded-lg p-1">
                            <button
                                onClick={() => setActiveTab("pipelines")}
                                className={`px-4 py-2 text-sm rounded-md transition-colors ${activeTab === "pipelines"
                                    ? "bg-white/10 text-white"
                                    : "text-white/50 hover:text-white"
                                    }`}
                            >
                                <GitBranch className="w-4 h-4 inline-block mr-2" />
                                All Pipelines
                            </button>
                            <button
                                onClick={() => setActiveTab("searches")}
                                className={`px-4 py-2 text-sm rounded-md transition-colors ${activeTab === "searches"
                                    ? "bg-white/10 text-white"
                                    : "text-white/50 hover:text-white"
                                    }`}
                            >
                                <Search className="w-4 h-4 inline-block mr-2" />
                                Recent Searches
                            </button>
                        </div>

                        {/* View Toggle */}
                        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2 rounded ${viewMode === "grid" ? "bg-white/10" : ""}`}
                            >
                                <LayoutGrid className="w-4 h-4 text-white/60" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2 rounded ${viewMode === "list" ? "bg-white/10" : ""}`}
                            >
                                <List className="w-4 h-4 text-white/60" />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === "pipelines" ? (
                            <motion.div
                                key="pipelines"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {pipelinesLoading ? (
                                    <div className="text-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-purple-400 mx-auto" />
                                    </div>
                                ) : pipelines.length === 0 ? (
                                    <EmptyState
                                        icon={GitBranch}
                                        title="No pipelines yet"
                                        description="Start a search and create a pipeline to track candidates"
                                        action={{
                                            label: "Start Search",
                                            onClick: () => router.push("/search")
                                        }}
                                    />
                                ) : (
                                    <div className={viewMode === "grid"
                                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                        : "space-y-3"
                                    }>
                                        {pipelines.map(pipeline => (
                                            viewMode === "grid" ? (
                                                <PipelineGridCard key={pipeline.pipeline_id} pipeline={pipeline} />
                                            ) : (
                                                <PipelineListRow key={pipeline.pipeline_id} pipeline={pipeline} />
                                            )
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="searches"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {searches.length === 0 ? (
                                    <EmptyState
                                        icon={Search}
                                        title="No searches yet"
                                        description="Start searching for candidates with Donna"
                                        action={{
                                            label: "Start Search",
                                            onClick: () => router.push("/search")
                                        }}
                                    />
                                ) : (
                                    <div className={viewMode === "grid"
                                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                        : "space-y-3"
                                    }>
                                        {searches.map(search => (
                                            <SearchCard
                                                key={search.session_id}
                                                search={search}
                                                viewMode={viewMode}
                                                onDelete={() => handleDeleteSearch(search.session_id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </main>
        </div>
    );
}

// Metric Card Component
function MetricCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: "purple" | "blue" | "green" | "yellow";
}) {
    const colors = {
        purple: "text-purple-400 bg-purple-400/10",
        blue: "text-blue-400 bg-blue-400/10",
        green: "text-green-400 bg-green-400/10",
        yellow: "text-yellow-400 bg-yellow-400/10",
    };

    return (
        <div className="p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl">
            <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
            <p className="text-sm text-white/40">{label}</p>
        </div>
    );
}

// Pipeline Quick Card (for active pipelines section)
function PipelineQuickCard({ pipeline }: { pipeline: any }) {
    const progress = pipeline.stats?.total_sourced > 0
        ? Math.round((pipeline.stats.total_hired / pipeline.stats.total_sourced) * 100)
        : 0;

    return (
        <Link href={`/pipeline/${pipeline.pipeline_id}`}>
            <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl cursor-pointer"
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white truncate">{pipeline.name}</h3>
                    <ArrowUpRight className="w-4 h-4 text-purple-400" />
                </div>
                <p className="text-sm text-white/50 mb-3">{pipeline.job_title}</p>

                {/* Mini Progress */}
                <div className="flex items-center gap-4 text-xs">
                    <span className="text-white/40">
                        <Users className="w-3 h-3 inline mr-1" />
                        {pipeline.stats?.total_sourced || 0}
                    </span>
                    <span className="text-green-400">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        {pipeline.stats?.total_hired || 0} hired
                    </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </motion.div>
        </Link>
    );
}

// Pipeline Grid Card
function PipelineGridCard({ pipeline }: { pipeline: any }) {
    const statusColors: Record<string, string> = {
        active: "bg-green-500/20 text-green-400 border-green-500/30",
        paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        archived: "bg-white/10 text-white/40 border-white/20",
    };

    return (
        <Link href={`/pipeline/${pipeline.pipeline_id}`}>
            <motion.div
                whileHover={{ scale: 1.01 }}
                className="p-5 bg-white/[0.02] border border-white/[0.08] rounded-xl hover:border-white/[0.15] transition-all cursor-pointer"
            >
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{pipeline.name}</h3>
                        <p className="text-sm text-white/40 truncate">{pipeline.job_title}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[11px] rounded border ${statusColors[pipeline.status] || statusColors.active}`}>
                        {pipeline.status}
                    </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center">
                        <p className="text-lg font-semibold text-white">{pipeline.stats?.total_sourced || 0}</p>
                        <p className="text-[10px] text-white/30">Total</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-blue-400">{pipeline.stats?.total_contacted || 0}</p>
                        <p className="text-[10px] text-white/30">Contacted</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-purple-400">{pipeline.stats?.total_scheduled || 0}</p>
                        <p className="text-[10px] text-white/30">Scheduled</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold text-green-400">{pipeline.stats?.total_hired || 0}</p>
                        <p className="text-[10px] text-white/30">Hired</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full flex">
                        <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${(pipeline.stats?.total_hired / Math.max(pipeline.stats?.total_sourced, 1)) * 100}%` }}
                        />
                        <div
                            className="bg-purple-500 transition-all"
                            style={{ width: `${(pipeline.stats?.total_scheduled / Math.max(pipeline.stats?.total_sourced, 1)) * 100}%` }}
                        />
                        <div
                            className="bg-blue-500 transition-all"
                            style={{ width: `${(pipeline.stats?.total_contacted / Math.max(pipeline.stats?.total_sourced, 1)) * 100}%` }}
                        />
                    </div>
                </div>

                <p className="text-[11px] text-white/30 mt-3">
                    Updated {new Date(pipeline.updated_at).toLocaleDateString()}
                </p>
            </motion.div>
        </Link>
    );
}

// Pipeline List Row
function PipelineListRow({ pipeline }: { pipeline: any }) {
    return (
        <Link href={`/pipeline/${pipeline.pipeline_id}`}>
            <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl hover:border-white/[0.15] transition-all cursor-pointer">
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{pipeline.name}</h3>
                    <p className="text-sm text-white/40">{pipeline.job_title}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                    <span className="text-white/60">
                        <Users className="w-4 h-4 inline mr-1" />
                        {pipeline.stats?.total_sourced || 0}
                    </span>
                    <span className="text-blue-400">
                        <Mail className="w-4 h-4 inline mr-1" />
                        {pipeline.stats?.total_contacted || 0}
                    </span>
                    <span className="text-green-400">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        {pipeline.stats?.total_hired || 0}
                    </span>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30" />
            </div>
        </Link>
    );
}

// Search Card
function SearchCard({
    search,
    viewMode,
    onDelete,
}: {
    search: SearchSummary;
    viewMode: "grid" | "list";
    onDelete: () => void;
}) {
    const router = useRouter();

    if (viewMode === "list") {
        return (
            <div
                onClick={() => router.push(`/results/${search.session_id}`)}
                className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl hover:border-white/[0.15] transition-all cursor-pointer"
            >
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{search.role_title || "Untitled Search"}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        {search.skills?.slice(0, 3).map((skill, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] bg-white/[0.06] text-white/50 rounded">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
                <span className="text-sm text-white/40">
                    {search.total_candidates} candidates
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-2 hover:bg-white/[0.06] rounded-lg text-white/30 hover:text-red-400"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            onClick={() => router.push(`/results/${search.session_id}`)}
            className="p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl hover:border-white/[0.15] transition-all cursor-pointer"
        >
            <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-white truncate">{search.role_title || "Untitled"}</h3>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1 hover:bg-white/[0.06] rounded text-white/30 hover:text-red-400"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
                {search.skills?.slice(0, 4).map((skill, i) => (
                    <span key={i} className="px-2 py-0.5 text-[10px] bg-white/[0.06] text-white/50 rounded">
                        {skill}
                    </span>
                ))}
            </div>
            <div className="flex items-center justify-between text-xs text-white/40">
                <span>{search.total_candidates} candidates</span>
                <span>{new Date(search.created_at).toLocaleDateString()}</span>
            </div>
            {search.pipeline_id && (
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <Link
                        href={`/pipeline/${search.pipeline_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                        <GitBranch className="w-3 h-3" />
                        View Pipeline
                    </Link>
                </div>
            )}
        </motion.div>
    );
}

// Empty State
function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
}) {
    return (
        <div className="text-center py-12">
            <Icon className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
            <p className="text-sm text-white/40 mb-4">{description}</p>
            {action && (
                <Button onClick={action.onClick} className="bg-purple-600 hover:bg-purple-700">
                    {action.label}
                </Button>
            )}
        </div>
    );
}