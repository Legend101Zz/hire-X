"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Briefcase,
    Users,
    Mail,
    ChevronRight,
    Sparkles,
    Plus,
    Ghost,
    Search,
    Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedBackground from "@/components/auth/AnimatedBackground";
import { getPipelineSessions } from "@/utils/api/conversationApiV2";

// Mock Interface
interface PipelineSession {
    session_id: string;
    job_title: string;
    total_candidates: number;
    status_counts: {
        pending: number;
        enriching: number;
        enriched: number;
        outreach_sent: number;
        failed: number;
    };
    created_at: string;
}

export default function PipelineListPage() {
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const [sessions, setSessions] = useState<PipelineSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAuthenticated === false) router.push("/login");
        else if (isAuthenticated && token) loadSessions();
    }, [isAuthenticated, token, router]);

    const loadSessions = async () => {
        if (!token) return;
        try {
            const data = await getPipelineSessions(token);
            setSessions(data.sessions);
        } catch (err) {
            console.error("Failed to load sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="z-10 flex flex-col items-center">
                    <Sparkles className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                    <p className="text-zinc-400 font-medium">Booting up your campaigns...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 relative font-sans selection:bg-indigo-500/30">
            {/* Subtle Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

            <AnimatedBackground />

            <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
                {/* Friendly Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
                            Active Searches
                        </h1>
                        <p className="text-zinc-400 max-w-lg text-lg">
                            Don't worry, "Pipeline" is just a fancy word for <span className="text-indigo-400 font-medium">"Who are we talking to?"</span>.
                            Here are the roles you're currently working on.
                        </p>
                    </div>
                    <Button
                        onClick={() => router.push("/search")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 h-12 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all hover:scale-105"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Start New Search
                    </Button>
                </div>

                {sessions.length === 0 ? (
                    <EmptyState router={router} />
                ) : (
                    <div className="grid gap-4">
                        {sessions.map((session, index) => (
                            <motion.div
                                key={session.session_id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <PipelineSessionRow session={session} />
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PipelineSessionRow({ session }: { session: PipelineSession }) {
    const router = useRouter();
    const stats = session.status_counts || { pending: 0, enriching: 0, enriched: 0, outreach_sent: 0, failed: 0 };

    // Calculate funnel percentages
    const total = session.total_candidates || 1;
    // "Ready" = Enriched + Contacted (anyone we have an email for)
    const emailsFound = stats.enriched + stats.outreach_sent;
    const outreachSent = stats.outreach_sent;

    const emailPct = (emailsFound / total) * 100;
    const sentPct = (outreachSent / total) * 100;

    return (
        <div
            onClick={() => router.push(`/pipeline/${session.session_id}`)}
            className="group relative bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6 hover:border-indigo-500/50 hover:bg-zinc-900 transition-all duration-300 cursor-pointer overflow-hidden"
        >
            <div className="flex flex-col md:flex-row gap-8 md:items-center justify-between">

                {/* Left: Job Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-zinc-100 truncate group-hover:text-indigo-300 transition-colors">
                                {session.job_title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                                <span>Created {new Date(session.created_at).toLocaleDateString()}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-zinc-400">
                                    <Sparkles className="w-3 h-3 text-yellow-500" />
                                    Donna AI
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle: The Funnel (Simplified) */}
                <div className="flex-[1.5] max-w-xl">
                    <div className="grid grid-cols-3 gap-4 mb-3">
                        {/* Step 1: Found */}
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1">Found</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-white">{session.total_candidates}</span>
                                <span className="text-xs text-zinc-600">candidates</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-zinc-600 w-full" />
                            </div>
                        </div>

                        {/* Step 2: Ready */}
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 flex items-center gap-1">
                                Emails Ready <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            </span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-white">{emailsFound}</span>
                                <span className="text-xs text-zinc-600">verified</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${emailPct}%` }} />
                            </div>
                        </div>

                        {/* Step 3: Contacted */}
                        <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1 flex items-center gap-1">
                                Messaged <Mail className="w-3 h-3 text-purple-500" />
                            </span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-purple-400">{outreachSent}</span>
                                <span className="text-xs text-zinc-600">sent</span>
                            </div>
                            <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${sentPct}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: CTA */}
                <div className="flex items-center justify-end pl-4">
                    <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 group-hover:text-white transition-colors">
                        <span>View Details</span>
                        <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ router }: { router: any }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-xl relative">
                <Ghost className="w-12 h-12 text-zinc-600" />
                <div className="absolute top-0 right-0 w-6 h-6 bg-indigo-500 rounded-full animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-white mb-3">It's quiet... too quiet.</h3>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
                You haven't started any searches yet! Don't be shy, Donna is ready to find you some amazing people.
            </p>

            <Button
                onClick={() => router.push("/search")}
                size="lg"
                className="bg-white text-zinc-950 hover:bg-zinc-200 rounded-full font-bold px-8"
            >
                <Search className="w-4 h-4 mr-2" />
                Start Your First Search
            </Button>
        </div>
    );
}