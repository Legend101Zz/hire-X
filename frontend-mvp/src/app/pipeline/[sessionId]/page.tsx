"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Play,
    Mail,
    AlertCircle,
    ExternalLink,
    Loader2,
    MapPin,
    Search,
    Zap,
    Check,
    X,
    Terminal,
    ChevronRight,
    Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedBackground from "@/components/auth/AnimatedBackground";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types ---
interface CandidateStatus {
    candidate_id: string;
    pipeline_id: string;
    name: string;
    headline: string;
    location: string;
    linkedin_url: string;
    stage: string;
    stage_label: string;
    is_enriched: boolean;
    match_score?: number;
    match_label?: string;
    has_email: boolean;
    enrichment_error?: string;
    outreach_sent: boolean;
    outreach_opened: boolean;
}

interface LogEntry {
    id: string;
    message: string;
    status: "pending" | "success" | "error";
    timestamp: string;
}

export default function PipelineBatchPage() {
    const params = useParams();
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const sessionId = params.sessionId as string;

    const [batchData, setBatchData] = useState<any>(null);
    const [candidates, setCandidates] = useState<CandidateStatus[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [enriching, setEnriching] = useState(false);

    // Outreach Modal State
    const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
    const [launchLogs, setLaunchLogs] = useState<LogEntry[]>([]);
    const [isLaunching, setIsLaunching] = useState(false);

    // Derived stats
    const stats = useMemo(() => {
        return {
            total: candidates.length,
            ready: candidates.filter(c => c.is_enriched && c.has_email).length,
            contacted: candidates.filter(c => c.outreach_sent).length
        };
    }, [candidates]);

    useEffect(() => { if (!isAuthenticated) router.push("/login"); }, [isAuthenticated, router]);

    // Polling Logic
    useEffect(() => {
        if (!sessionId || !token) return;

        loadBatchStatus();

        const interval = setInterval(() => {
            // Don't poll if we are actively launching to prevent UI jitter
            if (!isLaunching) {
                loadBatchStatus();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [sessionId, token, isLaunching]);

    const loadBatchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/conversation/${sessionId}/pipeline-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setBatchData(data);
            setCandidates(data.candidates || []);
        } catch (err) {
            console.error("Polling error:", err);
        } finally {
            setLoading(false);
        }
    };

    const startBatchEnrichment = async () => {
        const pipelineIds = Array.from(selectedIds)
            .map((id) => candidates.find((c) => c.candidate_id === id)?.pipeline_id)
            .filter(Boolean);

        if (!pipelineIds.length) return;

        setEnriching(true);
        try {
            await fetch(`${API_BASE}/conversation/${sessionId}/batch-enrich`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ pipeline_ids: pipelineIds })
            });
            setSelectedIds(new Set());
            setTimeout(loadBatchStatus, 1000);
        } catch (e) {
            alert("Failed to start enrichment");
        } finally {
            setEnriching(false);
        }
    };

    // --- Launch Sequence Logic ---
    const handleLaunchSequence = async () => {
        setIsLaunchModalOpen(true);
        setIsLaunching(true);
        setLaunchLogs([]);

        const targets = candidates.filter(c => selectedIds.has(c.candidate_id));

        for (const target of targets) {
            // Log: Starting
            addLog(`Initializing sequence for ${target.name}...`, "pending");

            if (!target.pipeline_id) {
                addLog(`Error: No pipeline ID for ${target.name}`, "error");
                continue;
            }

            if (!target.has_email) {
                addLog(`Skipping ${target.name}: No verified email frequency.`, "error");
                continue;
            }

            try {
                const res = await fetch(`${API_BASE}/pipeline/${target.pipeline_id}/outreach`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ candidate_ids: [target.candidate_id] }) // API expects list
                });

                if (res.ok) {
                    addLog(`Sequence deployed to ${target.name} successfully.`, "success");
                } else {
                    const err = await res.json();
                    addLog(`Failed to deploy ${target.name}: ${err.detail}`, "error");
                }
            } catch (e) {
                addLog(`Connection error for ${target.name}`, "error");
            }

            // Artificial delay for cool effect
            await new Promise(r => setTimeout(r, 800));
        }

        setIsLaunching(false);
        setSelectedIds(new Set());
        loadBatchStatus();
    };

    const addLog = (message: string, status: "pending" | "success" | "error") => {
        setLaunchLogs(prev => [...prev, {
            id: Math.random().toString(36),
            message,
            status,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    // Bulk Selection Helpers
    const toggleSelectAll = () => {
        if (selectedIds.size === candidates.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(candidates.map(c => c.candidate_id)));
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    if (loading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
            <AnimatedBackground />

            {/* Sticky Header */}
            <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/pipeline")} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-3">
                                {batchData?.job_title}
                                <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-normal">{stats.total} targets</Badge>
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-8 text-sm">
                        <StatItem label="Ready to Contact" value={stats.ready} />
                        <div className="w-px h-8 bg-zinc-800" />
                        <StatItem label="Sequence Active" value={stats.contacted} color="text-purple-400" />
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Left Sidebar */}
                <div className="hidden lg:block lg:col-span-3">
                    <div className="sticky top-24 space-y-4">
                        <JobContextCard jobTitle={batchData?.job_title} jdText={batchData?.jd_text} />
                    </div>
                </div>

                {/* Main List */}
                <div className="col-span-1 lg:col-span-9 space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 backdrop-blur-sm sticky top-20 z-30">
                        <div className="flex items-center gap-3 pl-2">
                            <Checkbox
                                checked={selectedIds.size === candidates.length && candidates.length > 0}
                                onCheckedChange={toggleSelectAll}
                                className="border-zinc-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            />
                            <span className="text-sm text-zinc-400 font-medium">Select All</span>
                        </div>
                        <div className="text-xs text-zinc-600 px-2 font-mono">LIVE STATUS</div>
                    </div>

                    <div className="space-y-2 pb-24">
                        {candidates.length === 0 ? (
                            <div className="text-center py-20 text-zinc-500">
                                <Ghost className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>No candidates found.</p>
                            </div>
                        ) : (
                            candidates.map((candidate) => (
                                <CandidateRow
                                    key={candidate.candidate_id}
                                    candidate={candidate}
                                    isSelected={selectedIds.has(candidate.candidate_id)}
                                    onToggle={() => toggleSelection(candidate.candidate_id)}
                                    onClick={() => router.push(`/pipeline/${sessionId}/${candidate.pipeline_id}`)}
                                />
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Floating Command Bar */}
            <AnimatePresence>
                {selectedIds.size > 0 && !isLaunchModalOpen && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl text-white p-2 pr-4 pl-4 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-zinc-700 ring-1 ring-white/10"
                    >
                        <div className="bg-white text-black rounded-full px-3 py-1 text-xs font-bold mr-2">
                            {selectedIds.size} selected
                        </div>

                        <Button
                            size="sm"
                            variant="ghost"
                            className="hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-full"
                            onClick={startBatchEnrichment}
                            disabled={enriching}
                        >
                            {enriching ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-400" /> : <Zap className="w-4 h-4 mr-2 text-yellow-500" />}
                            Find Emails
                        </Button>

                        <div className="w-px h-4 bg-zinc-700" />

                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 rounded-full px-5 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                            onClick={handleLaunchSequence}
                        >
                            <Rocket className="w-4 h-4 mr-2" />
                            Launch Sequence
                        </Button>

                        <Button size="icon" variant="ghost" className="ml-1 w-8 h-8 rounded-full hover:bg-zinc-800" onClick={() => setSelectedIds(new Set())}>
                            <X className="w-4 h-4" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Launch Console Modal (Side Sheet) */}
            <AnimatePresence>
                {isLaunchModalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                            onClick={() => !isLaunching && setIsLaunchModalOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl z-[70] flex flex-col"
                        >
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Terminal className="w-5 h-5 text-indigo-500" />
                                    Launch Console
                                </h2>
                                {!isLaunching && (
                                    <Button variant="ghost" size="icon" onClick={() => setIsLaunchModalOpen(false)}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="text-xs font-mono text-zinc-500">STATUS LOG</span>
                                    {isLaunching && <span className="text-xs text-indigo-400 animate-pulse">● PROCESSING</span>}
                                </div>

                                <ScrollArea className="flex-1 pr-4">
                                    <div className="space-y-3 font-mono text-sm">
                                        {launchLogs.map((log) => (
                                            <div key={log.id} className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-300">
                                                <span className="text-zinc-600 text-xs mt-0.5 min-w-[60px]">{log.timestamp}</span>
                                                <div className="flex-1">
                                                    <span className={
                                                        log.status === "error" ? "text-red-400" :
                                                            log.status === "success" ? "text-emerald-400" :
                                                                "text-zinc-300"
                                                    }>
                                                        {log.status === "success" && "✓ "}
                                                        {log.status === "error" && "✕ "}
                                                        {log.message}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {isLaunching && (
                                            <div className="flex gap-2 items-center text-zinc-500">
                                                <span className="text-xs min-w-[60px]">...</span>
                                                <span className="animate-pulse">_</span>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="p-6 border-t border-zinc-800 bg-zinc-900">
                                <div className="flex justify-between text-xs text-zinc-500 mb-2">
                                    <span>Progress</span>
                                    <span>{Math.round((launchLogs.length / (selectedIds.size || 1)) * 100)}%</span>
                                </div>
                                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-indigo-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(launchLogs.length / (selectedIds.size || 1)) * 100}%` }}
                                    />
                                </div>
                                {!isLaunching && (
                                    <Button className="w-full mt-4 bg-zinc-100 text-zinc-900 hover:bg-zinc-200" onClick={() => setIsLaunchModalOpen(false)}>
                                        Close Console
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Sub-Components ---

function StatItem({ label, value, color = "text-white" }: any) {
    return (
        <div className="flex flex-col items-end">
            <span className={`font-bold text-lg leading-none ${color}`}>{value}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{label}</span>
        </div>
    );
}

function JobContextCard({ jobTitle, jdText }: any) {
    return (
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Search className="w-3 h-3" /> The Role
            </h3>
            <div className="space-y-4">
                <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Target Title</label>
                    <p className="font-medium text-white">{jobTitle}</p>
                </div>
                {jdText && (
                    <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Snippet</label>
                        <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-800 line-clamp-[8]">
                            {jdText}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function CandidateRow({ candidate, isSelected, onToggle, onClick }: { candidate: CandidateStatus, isSelected: boolean, onToggle: () => void, onClick: () => void }) {
    const isEnriched = candidate.is_enriched && candidate.has_email;
    const isFailed = candidate.enrichment_error;
    const isSent = candidate.outreach_sent;
    const matchScore = candidate.match_score || 0;

    return (
        <div
            className={`group flex flex-col md:flex-row items-start md:items-center gap-4 p-4 rounded-xl border transition-all duration-200 hover:bg-zinc-900/80 cursor-pointer ${isSelected ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900/30'
                }`}
        >
            <div className="pt-1 md:pt-0" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={onToggle}
                    className="border-zinc-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
            </div>

            <div className="flex-1 min-w-0" onClick={onClick}>
                <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg ${isSelected ? 'text-indigo-300' : 'text-zinc-100'} group-hover:text-indigo-400 transition-colors`}>
                        {candidate.name}
                    </span>
                    {candidate.linkedin_url && (
                        <a href={candidate.linkedin_url} target="_blank" onClick={(e) => e.stopPropagation()} className="text-zinc-600 hover:text-blue-400 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    )}
                </div>
                <div className="text-sm text-zinc-400 truncate max-w-[400px]">{candidate.headline}</div>
                {candidate.location && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                        <MapPin className="w-3 h-3" /> {candidate.location}
                    </div>
                )}
            </div>

            <div className="hidden md:flex flex-col items-center px-6 border-l border-zinc-800/50 min-w-[120px]">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Fit Score</span>
                <span className={`text-xl font-black ${matchScore > 85 ? 'text-emerald-400' : matchScore > 65 ? 'text-yellow-500' : 'text-zinc-600'}`}>
                    {matchScore > 0 ? `${matchScore}%` : '-'}
                </span>
            </div>

            <div className="flex-1 flex items-center justify-end gap-3 min-w-[240px]">
                <StatusPill
                    active={isEnriched}
                    failed={!!isFailed}
                    loading={candidate.stage === 'enriching'}
                    label="Email Found"
                    icon={Check}
                />
                <div className={`w-4 h-px ${isSent ? 'bg-indigo-900' : 'bg-zinc-800'} hidden md:block`} />
                <StatusPill
                    active={isSent}
                    failed={false}
                    loading={false}
                    label="Sent"
                    icon={Mail}
                    color="purple"
                />
            </div>
        </div>
    );
}

function StatusPill({ active, failed, loading, label, icon: Icon, color = "emerald" }: any) {
    const colors: any = {
        emerald: {
            active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            loading: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse",
            failed: "bg-red-500/10 text-red-400 border-red-500/20",
            inactive: "bg-zinc-900 text-zinc-600 border-zinc-800"
        },
        purple: {
            active: "bg-purple-500/10 text-purple-400 border-purple-500/20",
            loading: "bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse",
            failed: "bg-red-500/10 text-red-400 border-red-500/20",
            inactive: "bg-zinc-900 text-zinc-600 border-zinc-800"
        }
    };

    const style = failed ? colors[color].failed : loading ? colors[color].loading : active ? colors[color].active : colors[color].inactive;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${style}`}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> :
                failed ? <AlertCircle className="w-3 h-3" /> :
                    active ? <Icon className="w-3 h-3" /> :
                        <div className="w-3 h-3 rounded-full border-2 border-current opacity-30" />
            }
            {failed ? "Failed" : label}
        </div>
    );
}

function LoadingScreen() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="text-center z-10">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-4" />
                <p className="text-zinc-400 font-medium">Loading mission data...</p>
            </div>
        </div>
    );
}