"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Brain,
    ArrowLeft,
    Loader2,
    MapPin,
    Building2,
    Linkedin,
    Clock,
    DollarSign,
    Briefcase,
    Code,
    CheckCircle2,
    AlertTriangle,
    X,
    Database,
    Globe,
    Sparkles,
    Target,
    Eye,
    Copy,
    Check,
    Plus,
    Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { DeepDiveResult, ExperienceItem } from "@/types/deep-dive";

// ============================================================================
// UI PRIMITIVES & LOADER
// ============================================================================

function Background() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[#0a0a0a]">
            {/* Vercel-style Grid Background */}
            <div className="absolute inset-0 grid-bg opacity-[0.4]"
                style={{
                    backgroundImage: `linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
        </div>
    );
}

function TechLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
            <Background />
            <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-r-2 border-indigo-500 animate-spin [animation-duration:1.5s]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
                    </div>
                </div>
                <div className="mt-8 space-y-2 text-center">
                    <h3 className="text-zinc-200 font-mono font-medium tracking-widest text-sm">
                        NEURALEAP INTELLIGENCE
                    </h3>
                    <p className="text-zinc-500 text-xs animate-pulse">
                        Decrypting Analysis Data...
                    </p>
                </div>
            </div>
        </div>
    );
}

function DataCard({ children, className = "", title, icon: Icon, action }: any) {
    return (
        <div className={`group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm ${className}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {(title || Icon) && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/50">
                    <div className="flex items-center gap-2 text-zinc-400">
                        {Icon && <Icon className="w-4 h-4" />}
                        <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
                    </div>
                    {action}
                </div>
            )}
            <div className="p-4">{children}</div>
        </div>
    );
}

function MetricCell({ label, value, subtext, trend }: any) {
    return (
        <div className="flex flex-col gap-1 min-w-[80px]">
            <span className="text-xs text-zinc-500 font-medium">{label}</span>
            <div className="flex items-baseline gap-2">
                <span className="text-xl font-mono font-semibold text-zinc-100 tracking-tight">
                    {value}
                </span>
                {trend && (
                    <span className={`text-xs ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            {subtext && <span className="text-xs text-zinc-600">{subtext}</span>}
        </div>
    );
}

function PropertyRow({ label, value, icon: Icon, border = true }: any) {
    return (
        <div className={`flex items-start py-3 ${border ? 'border-b border-zinc-800/50' : ''}`}>
            <div className="w-1/3 flex items-center gap-2 text-sm text-zinc-500">
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{label}</span>
            </div>
            <div className="w-2/3 text-sm text-zinc-300 font-medium break-words">
                {value}
            </div>
        </div>
    );
}

// ============================================================================
// COMPLEX SUB-COMPONENTS
// ============================================================================

function ExperienceRow({ exp, isLast }: { exp: ExperienceItem, isLast: boolean }) {
    return (
        <div className={`relative pl-6 pb-6 ${isLast ? '' : 'border-l border-zinc-800'}`}>
            <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0a] ${exp.experience_type === 'professional' ? 'bg-emerald-500' :
                    exp.experience_type === 'internship' ? 'bg-blue-500' : 'bg-zinc-600'
                }`} />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1">
                <div>
                    <h4 className="text-sm font-semibold text-zinc-200">{exp.title}</h4>
                    <div className="text-sm text-zinc-400 flex items-center gap-2">
                        {exp.company}
                        {exp.counts_as_experience && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        {exp.start_date} - {exp.end_date || 'Present'}
                    </span>
                </div>
            </div>

            {exp.description && (
                <p className="text-xs text-zinc-500 line-clamp-2 mt-2 leading-relaxed">
                    {exp.description}
                </p>
            )}

            <div className="mt-2 flex gap-2">
                <Badge variant="outline" className="text-[10px] h-5 border-zinc-700 text-zinc-400 bg-transparent">
                    {exp.experience_type}
                </Badge>
                {exp.duration_months > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 border-zinc-700 text-zinc-400 bg-transparent">
                        {Math.round(exp.duration_months / 12 * 10) / 10} yrs
                    </Badge>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function SharedResultPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DeepDiveResult | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (params.id) loadResult(params.id as string);
    }, [params.id]);

    const loadResult = async (id: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/results/${id}`);
            if (res.ok) {
                const data = await res.json();
                setResult(data.data);
            } else {
                setError(res.status === 410 ? "Analysis expired" : "Analysis not found");
            }
        } catch {
            setError("Connection failed");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <TechLoader />;

    if (error || !result) return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
            <Background />
            <div className="text-center space-y-4 relative z-10">
                <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                    <X className="w-6 h-6 text-rose-500" />
                </div>
                <h1 className="text-zinc-200 font-semibold">{error}</h1>
                <Button variant="outline" onClick={() => router.push("/deep-dive")} className="border-zinc-800 hover:bg-zinc-900 text-zinc-300">
                    Return to Dashboard
                </Button>
            </div>
        </div>
    );

    const matchScore = result.match_analysis.overall_match_score || 0;
    const isStrongMatch = matchScore >= 70;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 selection:bg-violet-500/30">
            <Background />

            {/* Navbar */}
            <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push("/deep-dive")}
                            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Brain className="w-4 h-4 text-violet-500" />
                            <span className="text-zinc-600">/</span>
                            <span className="hidden sm:inline text-zinc-400">Analysis Results</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="hidden sm:flex bg-violet-500/10 text-violet-400 border-violet-500/20 h-6">
                            <Eye className="w-3 h-3 mr-1.5" />
                            View Only
                        </Badge>

                        {/* Copy Link Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={copyToClipboard}
                            className={`h-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-all ${copied ? 'border-emerald-500/50 text-emerald-400' : ''}`}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 mr-2" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 mr-2" />
                                    Copy Link
                                </>
                            )}
                        </Button>

                        {/* New Analysis Button */}
                        <Button
                            size="sm"
                            onClick={() => router.push("/deep-dive")}
                            className="h-8 bg-zinc-100 text-zinc-900 hover:bg-white border-0 font-medium shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                        >
                            <Plus className="w-4 h-4 mr-1.5" />
                            <span className="hidden sm:inline">New Analysis</span>
                            <span className="sm:hidden">New</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
                <div className="grid lg:grid-cols-12 gap-6">

                    {/* LEFT COLUMN: Profile & Key Stats */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Profile Card */}
                        <DataCard className="text-center p-6">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 p-[1px] mb-4 shadow-lg shadow-violet-900/20">
                                <div className="w-full h-full rounded-full bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                                    {/* Fallback avatar logic */}
                                    <span className="text-2xl font-bold text-white">
                                        {result.candidate.full_name.charAt(0)}
                                    </span>
                                </div>
                            </div>
                            <h1 className="text-xl font-bold text-white mb-2">{result.candidate.full_name}</h1>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                                {result.candidate.headline}
                            </p>

                            <div className="flex justify-center gap-2 mb-6">
                                {result.candidate.linkedin_url && (
                                    <a href={result.candidate.linkedin_url} target="_blank" className="p-2 rounded-md bg-zinc-900 hover:bg-[#0077b5] hover:text-white text-zinc-400 transition-colors border border-zinc-800">
                                        <Linkedin className="w-4 h-4" />
                                    </a>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-px bg-zinc-800 rounded-lg overflow-hidden border border-zinc-800">
                                <div className="bg-zinc-900 p-3">
                                    <div className="text-[10px] text-zinc-500 uppercase">Exp</div>
                                    <div className="font-mono text-zinc-200">{result.candidate.experience_summary.real_experience_years}y</div>
                                </div>
                                <div className="bg-zinc-900 p-3">
                                    <div className="text-[10px] text-zinc-500 uppercase">Notice</div>
                                    <div className="font-mono text-zinc-200">{result.notice_period?.estimated_notice_days.likely || '?'}d</div>
                                </div>
                                <div className="bg-zinc-900 p-3">
                                    <div className="text-[10px] text-zinc-500 uppercase">Match</div>
                                    <div className={`font-mono font-bold ${isStrongMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {matchScore}%
                                    </div>
                                </div>
                                <div className="bg-zinc-900 p-3">
                                    <div className="text-[10px] text-zinc-500 uppercase">Salary</div>
                                    <div className="font-mono text-zinc-200">₹{result.salary_timeline?.current_estimated_ctc.most_likely}L</div>
                                </div>
                            </div>
                        </DataCard>

                        {/* Recommendation Callout */}
                        <div className={`p-4 rounded-lg border flex gap-3 ${isStrongMatch
                                ? 'bg-emerald-950/30 border-emerald-900/50'
                                : 'bg-amber-950/30 border-amber-900/50'
                            }`}>
                            {isStrongMatch ? <Target className="w-5 h-5 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />}
                            <div className="space-y-1">
                                <h4 className={`text-sm font-medium ${isStrongMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {result.match_analysis?.hiring_recommendation?.action || "Recommendation Pending"}
                                </h4>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                    {result.match_analysis?.hiring_recommendation?.reasoning || "No reasoning provided."}
                                </p>
                            </div>
                        </div>

                        {/* Properties List (Notion style) */}
                        <DataCard title="Details" icon={Database}>
                            <div className="space-y-0.5">
                                <PropertyRow label="Location" value={result.candidate.location} icon={MapPin} />
                                <PropertyRow label="Current" value={result.candidate.current_company} icon={Building2} />
                                <PropertyRow label="Source" value={result.data_source} icon={Globe} />
                                <PropertyRow label="Analyzed" value={format(new Date(result.enriched_at), 'MMM dd')} icon={Clock} border={false} />
                            </div>
                        </DataCard>
                    </div>

                    {/* RIGHT COLUMN: Detailed Analysis */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Match Analysis Table */}
                        <DataCard title="Match Analysis" icon={Target}>
                            {/* Summary One Liner */}
                            {result.match_analysis?.recruiter_summary?.one_liner && (
                                <div className="mb-6 p-3 rounded bg-violet-500/10 border border-violet-500/20 text-violet-200 text-sm flex gap-3 items-center">
                                    <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                                    {result.match_analysis.recruiter_summary.one_liner}
                                </div>
                            )}

                            <div className="overflow-hidden rounded-lg border border-zinc-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
                                        <tr>
                                            <th className="px-4 py-3 border-b border-zinc-800 w-1/4">Category</th>
                                            <th className="px-4 py-3 border-b border-zinc-800">Observation</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {/* Strengths */}
                                        {(result.match_analysis?.strengths || []).map((s: any, i: number) => (
                                            <tr key={`str-${i}`} className="bg-emerald-950/5 hover:bg-emerald-950/10 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <span className="flex items-center gap-2 text-emerald-500 font-medium text-xs uppercase tracking-wider">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Strength
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {typeof s === 'string' ? s : (
                                                        <div>
                                                            <div className="font-medium">{s.strength}</div>
                                                            {s.evidence && <div className="text-xs text-zinc-500 mt-1">Evidence: {s.evidence}</div>}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Gaps */}
                                        {(result.match_analysis?.gaps || []).map((g: any, i: number) => (
                                            <tr key={`gap-${i}`} className="bg-rose-950/5 hover:bg-rose-950/10 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <span className="flex items-center gap-2 text-rose-500 font-medium text-xs uppercase tracking-wider">
                                                        <X className="w-3.5 h-3.5" /> Gap
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {typeof g === 'string' ? g : (
                                                        <div>
                                                            <div className="font-medium">{g.gap}</div>
                                                            {g.importance && <Badge variant="outline" className="mt-1 text-[10px] border-rose-800 text-rose-400 capitalize bg-transparent">{g.importance.replace('_', ' ')}</Badge>}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Concerns */}
                                        {(result.match_analysis?.concerns || []).map((c: any, i: number) => (
                                            <tr key={`con-${i}`} className="bg-amber-950/5 hover:bg-amber-950/10 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <span className="flex items-center gap-2 text-amber-500 font-medium text-xs uppercase tracking-wider">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Concern
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-zinc-300">
                                                    {typeof c === 'string' ? c : (
                                                        <div>
                                                            <div className="font-medium">{c.concern}</div>
                                                            {c.severity && <div className="text-xs text-zinc-500 mt-1 uppercase">Severity: {c.severity}</div>}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </DataCard>

                        {/* Experience Timeline */}
                        <DataCard title="Experience Timeline" icon={Briefcase}>
                            <div className="flex gap-4 mb-6 pb-4 border-b border-zinc-800 overflow-x-auto hide-scrollbar">
                                <MetricCell label="Total Roles" value={result.candidate.experience_summary.total_roles} />
                                <div className="w-px h-10 bg-zinc-800" />
                                <MetricCell label="Real Exp" value={`${result.candidate.experience_summary.real_experience_years}y`} />
                                <div className="w-px h-10 bg-zinc-800" />
                                <MetricCell label="Pro Roles" value={result.candidate.experience_summary.professional_roles} />
                            </div>

                            <div className="space-y-2 mt-4">
                                {(result.candidate.experience || []).map((exp, i) => (
                                    <ExperienceRow key={i} exp={exp} isLast={i === (result.candidate.experience || []).length - 1} />
                                ))}
                            </div>
                        </DataCard>

                        {/* Two Column Section: Skills & Salary */}
                        <div className="grid md:grid-cols-2 gap-6">

                            {/* Skills Matrix */}
                            <DataCard title="Skill Validation" icon={Code}>
                                {result.skill_validation && (
                                    <>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-xs text-zinc-500">Confidence Score</span>
                                            <div className="flex items-center gap-2">
                                                <Progress value={result.skill_validation.overall_confidence} className="w-20 h-2 bg-zinc-800" />
                                                <span className="text-sm font-mono text-zinc-300">{result.skill_validation.overall_confidence}%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <h5 className="text-xs font-medium text-emerald-500 mb-2 uppercase tracking-wide">Validated</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(result.skill_validation.validated_skills || []).map((s, i) => (
                                                        <Badge key={i} variant="outline" className="bg-emerald-500/5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                    {(result.skill_validation.validated_skills || []).length === 0 && (
                                                        <span className="text-xs text-zinc-600 italic">None validated</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <h5 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Unverified</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(result.skill_validation.unvalidated_skills || []).map((s, i) => (
                                                        <Badge key={i} variant="outline" className="bg-zinc-800/50 text-zinc-500 border-zinc-800 hover:text-zinc-300">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </DataCard>

                            {/* Salary Insights */}
                            <DataCard title="Compensation" icon={DollarSign}>
                                {result.salary_timeline && (
                                    <div className="space-y-6">
                                        <div className="text-center py-4 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
                                            <span className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Estimated CTC</span>
                                            <div className="text-3xl font-mono font-bold text-white tracking-tight">
                                                ₹{result.salary_timeline.current_estimated_ctc?.most_likely || 0}L
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1">
                                                Range: ₹{result.salary_timeline.current_estimated_ctc?.low}-
                                                {result.salary_timeline.current_estimated_ctc?.high}L
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500">Est. Growth</span>
                                                <span className="text-emerald-400 font-mono">+{result.salary_timeline.growth_analysis?.average_annual_growth_percent || 0}% /yr</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-zinc-500">Confidence</span>
                                                <span className="text-violet-400 font-mono">{result.salary_timeline.confidence_score}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </DataCard>
                        </div>

                        {/* Footer Branding */}
                        <div className="text-center pt-8 border-t border-zinc-800/50">
                            <Button
                                variant="ghost"
                                onClick={() => router.push("/deep-dive")}
                                className="inline-flex items-center gap-2 text-zinc-600 text-sm hover:text-white hover:bg-zinc-900"
                            >
                                <Brain className="w-4 h-4" />
                                <span>Powered by NeuraLeap Intelligence</span>
                            </Button>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}