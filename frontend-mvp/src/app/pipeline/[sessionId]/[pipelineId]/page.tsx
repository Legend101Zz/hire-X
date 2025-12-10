"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    ExternalLink,
    Loader2,
    Briefcase,
    MapPin,
    Mail,
    Phone,
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Sparkles,
    Zap,
    TrendingUp,
    Play,
    Send,
    Eye,
    MousePointer,
    Video,
    FileText,
    User,
    Building,
    DollarSign,
    Award,
    MessageSquare,
    RefreshCw,
    Lock,
    Target,
    Globe,
    XCircle,
    BrainCircuit,
    Ban,
    ThumbsDown,
    GitBranch,
    Rocket,
    ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types & Enums ---

enum CandidateStage {
    SOURCED = "sourced",
    SHORTLISTED = "shortlisted",
    ENRICHING = "enriching",
    ENRICHED = "enriched",
    ENRICHMENT_FAILED = "enrichment_failed",
    OUTREACH_PENDING = "outreach_pending",
    OUTREACH_SENT = "outreach_sent",
    OUTREACH_REMINDER = "outreach_reminder",
    NO_RESPONSE = "no_response",
    SCHEDULING = "scheduling",
    SCHEDULED = "scheduled",
    INTERVIEW_COMPLETED = "interview_completed",
    EVALUATED = "evaluated"
}

// --- Visual Components (ScoreCircle, MetricCard) ---
// (Kept exactly as before for consistency)

function ScoreCircle({ score }: { score: number }) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 75) return "#10b981";
        if (s >= 50) return "#f59e0b";
        return "#ef4444";
    };

    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90">
                <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
                <circle
                    cx="64" cy="64" r={radius}
                    stroke={getColor(score)} strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${score < 50 ? 'text-red-500' : 'text-foreground'}`}>{score}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fit Score</span>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, sublabel, variant = "neutral" }: any) {
    const variants: any = {
        neutral: "bg-zinc-900/50 border-zinc-800",
        success: "bg-emerald-950/10 border-emerald-900/20",
        warning: "bg-amber-950/10 border-amber-900/20",
        danger: "bg-red-950/10 border-red-900/20",
    };

    return (
        <div className={`p-4 rounded-xl border ${variants[variant]} flex flex-col justify-between h-full`}>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-background/40">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
            <div>
                <p className="text-xl font-bold text-foreground truncate">{value}</p>
                {sublabel && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{sublabel}</p>}
            </div>
        </div>
    );
}

// --- Main Page Component ---

export default function PipelineDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { token, isAuthenticated } = useAuth();
    const sessionId = params.sessionId as string;
    const pipelineId = params.pipelineId as string;

    const [pipeline, setPipeline] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Modal States
    const [showManualContact, setShowManualContact] = useState(false);
    const [showOutreachModal, setShowOutreachModal] = useState(false);
    const [manualEmail, setManualEmail] = useState("");
    const [manualPhone, setManualPhone] = useState("");

    useEffect(() => { if (!isAuthenticated) router.push("/login"); }, [isAuthenticated, router]);

    useEffect(() => {
        if (!pipelineId || pipelineId === "undefined") {
            setError("Invalid pipeline ID");
            setLoading(false);
            return;
        }
        loadPipeline();
        const interval = setInterval(() => {
            if (pipeline?.stage === CandidateStage.ENRICHING) loadPipeline();
        }, 3000);
        return () => clearInterval(interval);
    }, [pipelineId, pipeline?.stage]);

    const loadPipeline = async () => {
        if (!pipelineId || !token) return;
        try {
            let url = `${API_BASE}/pipeline/${pipelineId}/enriched`;
            let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

            if (!response.ok) {
                url = `${API_BASE}/pipeline/${pipelineId}`;
                response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setPipeline(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Actions
    const startEnrichment = async () => {
        setActionLoading(true);
        try {
            await fetch(`${API_BASE}/pipeline/${pipelineId}/enrich`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ include_contact_fetch: true })
            });
            setTimeout(loadPipeline, 1000);
        } catch (err) { alert("Failed to start enrichment"); } finally { setActionLoading(false); }
    };

    const submitManualContact = async () => {
        if (!manualEmail) return alert("Email is required");
        setActionLoading(true);
        try {
            await fetch(`${API_BASE}/pipeline/${pipelineId}/manual-contact`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ email: manualEmail, phone: manualPhone || undefined })
            });
            setShowManualContact(false);
            loadPipeline();
        } catch (err) { alert("Failed to update contact"); } finally { setActionLoading(false); }
    };

    const confirmOutreach = async () => {
        if (!pipeline?.candidate?.candidate_id) {
            alert("Candidate ID missing");
            return;
        }

        setActionLoading(true);
        try {
            // Updated to match the specific route requirement
            const response = await fetch(`${API_BASE}/pipeline/${pipelineId}/outreach`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    candidate_ids: [pipeline.candidate.candidate_id]
                })
            });

            if (!response.ok) throw new Error("Outreach failed");

            setShowOutreachModal(false);
            loadPipeline();
        } catch (err) {
            console.error(err);
            alert("Failed to start outreach sequence");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <LoadingScreen />;
    if (error || !pipeline) return <ErrorScreen error={error} router={router} sessionId={sessionId} />;

    const candidate = pipeline.candidate;
    const stage = pipeline.stage as CandidateStage;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 pb-20">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
            <AnimatedBackground />

            <div className="relative z-10">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={() => router.push(`/pipeline/${sessionId}`)} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                            <div className="h-6 w-px bg-zinc-800" />
                            <div>
                                <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                                    {candidate.name}
                                    {candidate.linkedin_url && (
                                        <a href={candidate.linkedin_url} target="_blank" className="text-zinc-500 hover:text-blue-400"><ExternalLink className="w-3.5 h-3.5" /></a>
                                    )}
                                </h1>
                                <p className="text-xs text-zinc-500 max-w-md truncate">{candidate.headline || candidate.current_title}</p>
                            </div>
                        </div>
                        <StageIndicator stage={stage} stageLabel={pipeline.stage_label} />
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <div className="sticky top-24">
                            <CandidateDossier candidate={candidate} job={pipeline.job} contact={pipeline.contact} />
                        </div>
                    </div>


                    <div className="lg:col-span-8">
                        <AnimatePresence mode="wait">
                            {/* UPDATED CONDITION BELOW */}
                            {(stage === CandidateStage.ENRICHED ||
                                stage === CandidateStage.SCHEDULING ||
                                stage === CandidateStage.SCHEDULED ||
                                stage === CandidateStage.EVALUATED ||
                                stage.includes('outreach') ||
                                stage.includes('interview')) ? (

                                <EnrichedView
                                    pipeline={pipeline}
                                    hasEmail={!!candidate.contact?.email}
                                    onStartOutreach={() => setShowOutreachModal(true)}
                                    onManualContact={() => setShowManualContact(true)}
                                    loading={actionLoading}
                                />

                            ) : stage === CandidateStage.ENRICHING ? (
                                <EnrichingView />
                            ) : (
                                <NotEnrichedView onStartEnrichment={startEnrichment} loading={actionLoading} />
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showManualContact && (
                    <ManualContactModal
                        email={manualEmail}
                        phone={manualPhone}
                        onEmailChange={setManualEmail}
                        onPhoneChange={setManualPhone}
                        onSubmit={submitManualContact}
                        onClose={() => setShowManualContact(false)}
                        loading={actionLoading}
                    />
                )}
                {showOutreachModal && (
                    <OutreachModal
                        candidate={candidate}
                        contact={pipeline.contact || candidate.contact}
                        onSubmit={confirmOutreach}
                        onClose={() => setShowOutreachModal(false)}
                        loading={actionLoading}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Components ---

function StageIndicator({ stage, stageLabel }: { stage: string; stageLabel: string }) {
    const config: any = {
        [CandidateStage.ENRICHED]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        [CandidateStage.OUTREACH_SENT]: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        default: "bg-zinc-800 text-zinc-400 border-zinc-700"
    };
    const style = config[stage] || config.default;
    return <Badge variant="outline" className={`${style} uppercase tracking-wider text-[10px]`}>{stageLabel}</Badge>;
}

// 1. The Dossier Card (Left Sidebar)
function CandidateDossier({ candidate, job, contact }: any) {
    return (
        <Card className="bg-zinc-900/80 border-zinc-800 overflow-hidden backdrop-blur-sm">
            <div className="p-6 text-center border-b border-zinc-800 bg-zinc-900">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 p-1 bg-gradient-to-b from-zinc-700 to-zinc-900 border border-zinc-700">
                    <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {candidate.profile_picture_url ? (
                            <img src={candidate.profile_picture_url} alt="" className="w-full h-full object-cover opacity-90" />
                        ) : (
                            <User className="w-10 h-10 text-zinc-600" />
                        )}
                    </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{candidate.name}</h2>
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <MapPin className="w-3 h-3" /> {candidate.location || "Unknown"}
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="space-y-4">
                    <InfoRow icon={Building} label="Current Role" value={candidate.current_company || "Not listed"} sub={candidate.current_title} />
                    <InfoRow icon={Briefcase} label="Experience" value={`${candidate.experience_years || 0} Years`} />
                    <InfoRow
                        icon={Mail}
                        label="Contact Status"
                        value={contact?.email || "Locked / Missing"}
                        valueColor={contact?.email ? "text-emerald-400 font-mono" : "text-zinc-600 italic"}
                    />
                </div>

                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-semibold">Targeting For</div>
                    <div className="font-medium text-indigo-300">{job.job_title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{job.company_name}</div>
                </div>
            </div>
        </Card>
    );
}

function InfoRow({ icon: Icon, label, value, sub, valueColor = "text-zinc-300" }: any) {
    return (
        <div className="flex gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                <Icon className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-zinc-500 font-medium">{label}</div>
                <div className={`text-sm truncate ${valueColor}`}>{value}</div>
                {sub && <div className="text-xs text-zinc-500 truncate">{sub}</div>}
            </div>
        </div>
    );
}

// 2. The Main Intelligence Dashboard
function EnrichedView({ pipeline, hasEmail, onStartOutreach, onManualContact, loading }: any) {
    const rootData = pipeline || {};
    const nestedData = pipeline.enrichment_data || {};

    const get = (key: string) => rootData[key] || nestedData[key] || {};

    const match = get('match_analysis');
    const skills = get('skill_validation');
    const salary = get('salary_timeline');
    const rec = match.hiring_recommendation || {};
    const assessment = match.experience_assessment || {};
    const footprint = get('professional_footprint');
    const responseLikelihood = get('response_likelihood');

    const strengths = match.strengths || match.top_strengths || [];
    const concerns = match.concerns || [];
    const gaps = match.gaps || [];
    const evidence = skills.evidence || [];

    const score = match.overall_match_score || 0;
    const isBadMatch = score < 40;

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Verdict Banner */}
            <RecommendationBanner
                recommendation={rec}
                isBadMatch={isBadMatch}
                hasEmail={hasEmail}
                onOutreach={onStartOutreach}
                onManualContact={onManualContact}
                loading={loading}
            />

            {pipeline.candidate?.outreach?.initial_email_sent_at && (
                <PipelineStatusTimeline
                    candidate={pipeline.candidate}
                    outreach={pipeline.candidate.outreach}
                    interview={pipeline.candidate.interview}
                />
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                    <ScoreCircle score={score} />
                    <div>
                        <div className="text-xs text-zinc-500 uppercase font-bold">Match</div>
                        <div className={`text-sm font-medium ${isBadMatch ? 'text-red-400' : 'text-zinc-300'}`}>
                            {match.match_label || "Analyzed"}
                        </div>
                    </div>
                </div>

                <MetricCard
                    icon={Briefcase}
                    label="Exp Reality"
                    value={`${assessment.actual_years || 0} Years`}
                    sublabel={`Required: ${assessment.required_years || 5}+ Years`}
                    variant={assessment.meets_requirement ? "success" : "danger"}
                />

                <MetricCard
                    icon={DollarSign}
                    label="Current Comp"
                    value={salary.current_estimated_ctc?.most_likely ? `₹${salary.current_estimated_ctc.most_likely}L` : "N/A"}
                    sublabel={salary.current_estimated_ctc?.note || "Insufficient history"}
                    variant={salary.current_estimated_ctc?.most_likely ? "neutral" : "warning"}
                />

                <MetricCard
                    icon={BrainCircuit}
                    label="Skill Confidence"
                    value={`${skills.overall_confidence || 0}%`}
                    sublabel="AI Validation Score"
                    variant={skills.overall_confidence > 70 ? "success" : "neutral"}
                />
            </div>

            {/* Deep Dive Tabs */}
            <Card className="bg-zinc-900/30 border-zinc-800">
                <Tabs defaultValue="intel" className="w-full">
                    <div className="border-b border-zinc-800 px-6">
                        <TabsList className="bg-transparent h-14 w-full justify-start gap-6">
                            <TabTrigger value="intel" label="Intelligence" icon={BrainCircuit} />
                            <TabTrigger value="skills" label="Skill Check" icon={Target} />
                            <TabTrigger value="gaps" label="Gap Analysis" icon={GitBranch} />
                        </TabsList>
                    </div>

                    <TabsContent value="intel" className="p-6 space-y-6">
                        <div className="bg-zinc-900 p-5 rounded-lg border border-zinc-800">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Advisor Note
                            </h3>
                            <p className="text-zinc-300 leading-relaxed text-sm">
                                {match.recruiter_summary?.elevator_pitch || match.assessment || "No summary available."}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <Card className={`p-5 border bg-emerald-950/5 border-emerald-900/20`}>
                                <h4 className={`text-sm font-bold flex items-center gap-2 mb-4 text-emerald-400`}>
                                    <CheckCircle2 className="w-4 h-4" /> Candidate Assets
                                </h4>
                                <ul className="space-y-4">
                                    {strengths.length > 0 ? strengths.map((item: any, i: number) => {
                                        const text = typeof item === 'string' ? item : item.strength;
                                        const sub = typeof item === 'object' ? item.evidence : null;
                                        return (
                                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-3">
                                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0`} />
                                                <div>
                                                    <span className="font-medium text-zinc-200 block">{text}</span>
                                                    {sub && <span className="text-zinc-500 text-xs">{sub}</span>}
                                                </div>
                                            </li>
                                        )
                                    }) : <p className="text-xs text-zinc-500 italic">No major strengths found.</p>}
                                </ul>
                            </Card>

                            <Card className={`p-5 border bg-red-950/5 border-red-900/20`}>
                                <h4 className={`text-sm font-bold flex items-center gap-2 mb-4 text-red-400`}>
                                    <AlertTriangle className="w-4 h-4" /> Critical Blockers
                                </h4>
                                <ul className="space-y-4">
                                    {concerns.length > 0 ? concerns.map((item: any, i: number) => {
                                        const text = typeof item === 'string' ? item : item.concern;
                                        const sub = typeof item === 'object' ? item.mitigation || item.evidence : null;
                                        return (
                                            <li key={i} className="text-sm text-zinc-300 flex items-start gap-3">
                                                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-medium text-zinc-200 block">{text}</span>
                                                    {sub && <span className="text-red-400/60 text-xs">{sub}</span>}
                                                </div>
                                            </li>
                                        )
                                    }) : <p className="text-xs text-zinc-500 italic">No critical concerns.</p>}
                                </ul>
                            </Card>
                        </div>

                        {rec.alternative_roles && rec.alternative_roles.length > 0 && (
                            <div className="mt-4 p-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30">
                                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Better Fit For</h4>
                                <div className="flex flex-wrap gap-2">
                                    {rec.alternative_roles.map((role: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                                            {role}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="skills" className="p-6">
                        <div className="grid gap-4">
                            {evidence.length > 0 ? evidence.map((item: any, i: number) => (
                                <div key={i} className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-zinc-200 flex items-center gap-2">
                                            {item.skill}
                                            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                                                Confidence: {item.confidence}/10
                                            </Badge>
                                        </h4>
                                    </div>
                                    <p className="text-sm text-zinc-400 mb-2">{item.evidence_description}</p>
                                    {item.evidence_sources && (
                                        <div className="flex gap-2 flex-wrap">
                                            {item.evidence_sources.map((src: string, j: number) => (
                                                <span key={j} className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-1 rounded">
                                                    {src}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="text-center py-10 text-zinc-600">
                                    <BrainCircuit className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    No verifiable skills found in public footprint.
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="gaps" className="p-6">
                        <div className="space-y-4">
                            {gaps.length > 0 ? gaps.map((gap: any, i: number) => {
                                const text = gap.gap;
                                const fix = gap.time_to_close;
                                return (
                                    <div key={i} className="flex gap-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                        <div className="mt-1"><Ban className="w-5 h-5 text-red-500" /></div>
                                        <div>
                                            <h4 className="font-medium text-zinc-200">{text}</h4>
                                            <p className="text-sm text-zinc-500 mt-1">Reality check: {fix}</p>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div className="text-center p-8">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                                    <p className="text-zinc-400">No critical gaps found!</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </Card>
        </motion.div>
    );
}

function PipelineStatusTimeline({ candidate, outreach, interview }: any) {
    const stages = [
        {
            id: 'enriched',
            label: 'Analysis Complete',
            icon: BrainCircuit,
            completed: candidate.enrichment?.is_enriched,
            timestamp: candidate.enrichment?.enriched_at,
            color: 'text-emerald-500'
        },
        {
            id: 'outreach_sent',
            label: 'Email Sent',
            icon: Send,
            completed: outreach?.initial_email_sent_at,
            timestamp: outreach?.initial_email_sent_at,
            color: 'text-purple-500',
            sublabel: outreach?.initial_email_sent_at ? 'Delivered successfully' : null
        },
        {
            id: 'email_opened',
            label: 'Email Opened',
            icon: Eye,
            completed: outreach?.first_opened_at,
            timestamp: outreach?.first_opened_at,
            color: 'text-blue-500',
            sublabel: outreach?.total_opens > 0 ? `Opened ${outreach.total_opens}x` : null
        },
        {
            id: 'link_clicked',
            label: 'Link Clicked',
            icon: MousePointer,
            completed: outreach?.first_clicked_at,
            timestamp: outreach?.first_clicked_at,
            color: 'text-cyan-500',
            sublabel: 'Scheduling interest shown'
        },
        {
            id: 'responded',
            label: 'Candidate Responded',
            icon: MessageSquare,
            completed: outreach?.candidate_responded,
            timestamp: outreach?.response_received_at,
            color: 'text-indigo-500'
        },
        {
            id: 'scheduled',
            label: 'Interview Scheduled',
            icon: Calendar,
            completed: interview?.scheduled_datetime,
            timestamp: interview?.scheduled_datetime,
            color: 'text-pink-500',
            sublabel: interview?.scheduled_datetime ? new Date(interview.scheduled_datetime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            }) : null
        },
        {
            id: 'interviewed',
            label: 'Interview Completed',
            icon: Video,
            completed: interview?.call_ended_at,
            timestamp: interview?.call_ended_at,
            color: 'text-orange-500',
            sublabel: interview?.call_duration_seconds ? `Duration: ${Math.floor(interview.call_duration_seconds / 60)}m` : null
        }
    ];

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-indigo-500" />
                    Pipeline Journey
                </h3>
                <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-400 text-xs">
                    Live Tracking
                </Badge>
            </div>

            <div className="relative space-y-6">
                {/* Vertical line */}
                <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-zinc-800" />

                {stages.map((stage, index) => {
                    const isActive = stage.completed;
                    const isNext = !isActive && index > 0 && stages[index - 1]?.completed;

                    return (
                        <motion.div
                            key={stage.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative flex items-start gap-4"
                        >
                            {/* Status Indicator */}
                            <div className={`
                                relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                                ${isActive
                                    ? `border-transparent bg-gradient-to-br from-${stage.color.split('-')[1]}-500 to-${stage.color.split('-')[1]}-600 shadow-lg shadow-${stage.color.split('-')[1]}-500/50`
                                    : isNext
                                        ? 'border-zinc-700 bg-zinc-800 animate-pulse'
                                        : 'border-zinc-800 bg-zinc-900'
                                }
                            `}>
                                {isActive ? (
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                ) : (
                                    <stage.icon className={`w-4 h-4 ${isNext ? 'text-zinc-500' : 'text-zinc-700'}`} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pb-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className={`text-sm font-semibold ${isActive ? 'text-white' : isNext ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                            {stage.label}
                                        </h4>
                                        {stage.sublabel && isActive && (
                                            <p className="text-xs text-zinc-500 mt-0.5">{stage.sublabel}</p>
                                        )}
                                    </div>
                                    {stage.timestamp && (
                                        <Badge variant="outline" className="bg-zinc-950 border-zinc-800 text-zinc-500 text-[10px] font-mono">
                                            {new Date(stage.timestamp).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </Badge>
                                    )}
                                </div>

                                {/* Progress indicator for active stage */}
                                {isNext && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Waiting for candidate action...</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Summary Stats */}
            {outreach && (
                <div className="mt-6 pt-6 border-t border-zinc-800 grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-zinc-300">{outreach.total_opens || 0}</div>
                        <div className="text-xs text-zinc-600 uppercase tracking-wider">Opens</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-zinc-300">{outreach.total_clicks || 0}</div>
                        <div className="text-xs text-zinc-600 uppercase tracking-wider">Clicks</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-zinc-300">{outreach.reminder_count || 0}</div>
                        <div className="text-xs text-zinc-600 uppercase tracking-wider">Reminders</div>
                    </div>
                </div>
            )}
        </Card>
    );
}

// 3. The "Verdict" Banner
function RecommendationBanner({ recommendation, isBadMatch, hasEmail, onOutreach, onManualContact, loading }: any) {
    const [showOverride, setShowOverride] = useState(false);

    if (!recommendation) return null;

    const action = recommendation.action || "Review";
    const reason = recommendation.reasoning || "Please review the analysis below.";
    const isPass = action === "Pass" || isBadMatch;

    return (
        <Card className={`border-l-4 ${isPass ? 'border-l-red-500 bg-red-500/5' : 'border-l-emerald-500 bg-emerald-500/5'} border-y-0 border-r-0 rounded-r-xl rounded-l-none`}>
            <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <Badge className={`${isPass ? 'bg-red-500' : 'bg-emerald-500'} hover:bg-current text-white border-0 font-bold tracking-wide px-3 py-1`}>
                                {isPass ? '⚠️ DO NOT REACH OUT' : '✅ PROCEED'}
                            </Badge>
                            <span className="text-xs text-zinc-500 font-mono">
                                AI CONFIDENCE: {recommendation.confidence}%
                            </span>
                        </div>
                        <h3 className={`text-lg font-bold ${isPass ? 'text-red-400' : 'text-emerald-400'} mb-2`}>
                            {isPass ? "Critical Mismatch Detected" : "Strong Match - Ready for Outreach"}
                        </h3>
                        <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl">
                            {reason}
                        </p>

                        {/* Alternative roles suggestion */}
                        {isPass && recommendation.alternative_roles?.length > 0 && (
                            <div className="mt-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                                <div className="text-xs text-zinc-500 mb-2">💡 Better fit for:</div>
                                <div className="flex flex-wrap gap-2">
                                    {recommendation.alternative_roles.map((role: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                                            {role}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-2 min-w-[200px]">
                        {isPass ? (
                            <>
                                {/* Disabled primary button */}
                                <Button
                                    variant="outline"
                                    className="border-red-900/50 text-red-400 hover:bg-red-950/20 cursor-not-allowed opacity-60 w-full"
                                    disabled
                                >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Outreach Blocked
                                </Button>

                                {/* Override option */}
                                {!showOverride ? (
                                    <Button
                                        onClick={() => setShowOverride(true)}
                                        variant="ghost"
                                        size="sm"
                                        className="text-zinc-500 hover:text-zinc-300 text-xs h-8"
                                    >
                                        Override Warning
                                        <ChevronRight className="w-3 h-3 ml-1" />
                                    </Button>
                                ) : (
                                    <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <p className="text-xs text-amber-400 font-semibold">
                                            ⚠️ Confirm Override
                                        </p>
                                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                                            This will proceed despite AI recommendation. Ensure you have valid reasons.
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => setShowOverride(false)}
                                                variant="ghost"
                                                size="sm"
                                                className="flex-1 h-8 text-xs"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={hasEmail ? onOutreach : onManualContact}
                                                disabled={loading}
                                                size="sm"
                                                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white h-8 text-xs"
                                            >
                                                {loading ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Send className="w-3 h-3 mr-1" />
                                                        Force Send
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : hasEmail ? (
                            <Button
                                onClick={onOutreach}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white w-full h-11"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Rocket className="w-4 h-4 mr-2" />
                                        Launch Outreach
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                onClick={onManualContact}
                                variant="outline"
                                className="border-zinc-700 text-zinc-400 w-full"
                            >
                                <Mail className="w-4 h-4 mr-2" />
                                Add Contact First
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

// 4. The Outreach Modal (Mission Control)
function OutreachModal({ candidate, contact, onSubmit, onClose, loading }: any) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-0 overflow-hidden">
                <div className="p-6 border-b border-zinc-800 bg-zinc-950">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Rocket className="w-5 h-5 text-purple-500" />
                        Initialize Sequence
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">Confirm outreach parameters before launch.</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Target Card */}
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                            <User className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">{candidate.name}</div>
                            <div className="text-xs text-zinc-400 font-mono">{contact?.email}</div>
                        </div>
                        <Badge className="ml-auto bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Verified</Badge>
                    </div>

                    {/* Configuration */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-2 block">Strategy</label>
                            <div className="p-3 text-sm text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-md">
                                AI-Personalized Invitation (Context: Github & Experience)
                            </div>
                        </div>
                        <div>
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-2 block">Agent</label>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-sm text-zinc-300">Donna AI (Active)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-3">
                    <Button onClick={onClose} variant="ghost" className="text-zinc-400 hover:text-white">Abort</Button>
                    <Button onClick={onSubmit} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white min-w-[120px]">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Launching...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Confirm Launch
                            </>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}

// --- Helpers & Loaders (Keep existing) ---

function TabTrigger({ value, label, icon: Icon }: any) {
    return (
        <TabsTrigger
            value={value}
            className="data-[state=active]:bg-transparent data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 rounded-none pb-3 px-2 text-zinc-500 hover:text-zinc-300 transition-all"
        >
            <Icon className="w-4 h-4 mr-2" />
            {label}
        </TabsTrigger>
    );
}

function NotEnrichedView({ onStartEnrichment, loading }: any) {
    return (
        <Card className="p-12 bg-zinc-900/50 border-dashed border-2 border-zinc-800 text-center">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-zinc-600" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Deep Intel Locked</h2>
            <p className="text-zinc-400 max-w-md mx-auto mb-8 text-sm">
                Run a deep scan to reveal salary estimations, true fit analysis, and contact details.
            </p>
            <Button onClick={onStartEnrichment} disabled={loading} size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 fill-current" />}
                Analyze Candidate
            </Button>
        </Card>
    );
}

function EnrichingView() {
    return (
        <Card className="p-12 bg-zinc-900/50 border-zinc-800 text-center relative overflow-hidden">
            <motion.div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.5)]" animate={{ top: ["0%", "100%"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Analyzing Footprint...</h2>
            <p className="text-zinc-500 font-mono text-xs">CROSS-REFERENCING GITHUB • ESTIMATING CTC • VERIFYING SKILLS</p>
        </Card>
    );
}

function LoadingScreen() {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-zinc-500 text-sm font-mono tracking-widest">LOADING INTEL...</p>
            </div>
        </div>
    );
}

function ErrorScreen({ error, router, sessionId }: any) {
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <Card className="bg-zinc-900 border-zinc-800 p-8 text-center max-w-md">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-white mb-2">System Error</h2>
                <p className="text-zinc-500 mb-6 text-sm">{error || "Pipeline not found."}</p>
                <Button onClick={() => router.push(`/pipeline/${sessionId}`)} variant="outline" className="border-zinc-700 text-zinc-300">
                    Return to Mission Control
                </Button>
            </Card>
        </div>
    );
}

function ManualContactModal({ email, phone, onEmailChange, onPhoneChange, onSubmit, onClose, loading }: any) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <Card className="w-full max-w-md bg-zinc-900 border-zinc-800 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Manual Entry</h2>
                <div className="space-y-4 mb-6">
                    <div>
                        <Label className="text-zinc-400">Email</Label>
                        <Input value={email} onChange={(e) => onEmailChange(e.target.value)} className="bg-zinc-950 border-zinc-800 mt-1.5 text-white" />
                    </div>
                    <div>
                        <Label className="text-zinc-400">Phone</Label>
                        <Input value={phone} onChange={(e) => onPhoneChange(e.target.value)} className="bg-zinc-950 border-zinc-800 mt-1.5 text-white" />
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button onClick={onClose} variant="ghost" className="flex-1 text-zinc-400">Cancel</Button>
                    <Button onClick={onSubmit} disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">Save</Button>
                </div>
            </Card>
        </div>
    );
}