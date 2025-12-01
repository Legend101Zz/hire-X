/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck      
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Brain, ArrowLeft, MapPin, Building2, Linkedin, Clock,
    DollarSign, Briefcase, Code, CheckCircle2, AlertTriangle, X,
    Globe, Sparkles, Target, Eye, Copy, Check, Plus,
    ChevronDown, TrendingUp, FileText, ExternalLink, ShieldCheck,
    GraduationCap, Mail, MessageCircle, Signal, Share2,
    Fingerprint, Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { DeepDiveResult, ExperienceItem } from "@/types/deep-dive";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

// ============================================================================
// UI PRIMITIVES
// ============================================================================

function Background() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[#050505]">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-violet-500 opacity-20 blur-[100px]" />
        </div>
    );
}

function TechLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505]">
            <Background />
            <div className="flex flex-col items-center gap-6 relative z-10">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-zinc-800 border-t-violet-500 animate-spin" />
                    <Brain className="absolute inset-0 m-auto w-6 h-6 text-violet-500 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-zinc-200 font-medium tracking-wide">ANALYZING PROFILE</h3>
                    <p className="text-zinc-500 text-xs font-mono">NEURALEAP ENGINE V2</p>
                </div>
            </div>
        </div>
    );
}

function DataCard({
    children,
    className = "",
    title,
    icon: Icon,
    action,
    defaultOpen = true,
    collapsible = false,
    noPadding = false
}: any) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const Header = (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/20 select-none">
            <div className="flex items-center gap-2 text-zinc-400">
                {Icon && <Icon className="w-4 h-4 text-violet-500/80" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</span>
            </div>
            <div className="flex items-center gap-2">
                {action}
                {collapsible && (
                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </div>
        </div>
    );

    const containerClass = `relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md ${className}`;

    if (collapsible) {
        return (
            <Collapsible open={isOpen} onOpenChange={setIsOpen} className={containerClass}>
                <CollapsibleTrigger className="w-full cursor-pointer hover:bg-zinc-800/50 transition-colors">
                    {Header}
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className={noPadding ? "" : "p-4"}>{children}</div>
                </CollapsibleContent>
            </Collapsible>
        );
    }

    return (
        <div className={containerClass}>
            {(title || Icon) && Header}
            <div className={noPadding ? "" : "p-4"}>{children}</div>
        </div>
    );
}

// ============================================================================
// VISUALIZATIONS
// ============================================================================

function MatchRadarChart({ breakdown }: { breakdown: any }) {
    if (!breakdown) return null;

    const data = Object.keys(breakdown).map(key => ({
        subject: key.replace(/_/g, ' ').replace('match', '').trim().split(' ')[0],
        fullSubject: key.replace(/_/g, ' '),
        A: breakdown[key].score || 0,
        fullMark: 100
    }));

    if (data.length < 3) return null;

    return (
        <div className="h-[180px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="#3f3f46" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Match" dataKey="A" stroke="#8b5cf6" strokeWidth={2} fill="#8b5cf6" fillOpacity={0.3} />
                    <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="bg-zinc-950 border border-zinc-800 p-2 rounded text-xs text-zinc-300">
                                    <span className="capitalize font-semibold text-white">{payload[0].payload.fullSubject}:</span> {payload[0].value}/100
                                </div>
                            );
                        }
                        return null;
                    }} />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}

function SalaryTrendChart({ progression }: { progression: any[] }) {
    if (!progression || progression.length < 2) return (
        <div className="h-[140px] flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800/50 rounded-lg bg-zinc-900/10 mt-4">
            <TrendingUp className="w-6 h-6 mb-2 opacity-30" />
            <span className="text-xs">Insufficient history for trend</span>
        </div>
    );

    // FIX: Parse years and Sort Ascending (Oldest -> Newest)
    const data = [...progression]
        .map((role) => ({
            name: role.role,
            company: role.company,
            salary: ((role.estimated_ctc_low + role.estimated_ctc_high) / 2).toFixed(1),
            range: [role.estimated_ctc_low, role.estimated_ctc_high],
            // Parse year to int, handle "Present" or non-numeric if necessary
            year: parseInt(String(role.start_year).replace(/\D/g, '')) || 0
        }))
        .sort((a, b) => a.year - b.year); // Explicit numeric sort

    return (
        <div className="h-[160px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorSalary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="year" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val}L`} />
                    <Tooltip
                        cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-zinc-950/90 border border-zinc-800 p-2 rounded shadow-xl backdrop-blur-md text-xs">
                                        <p className="text-zinc-400 mb-0.5">{d.year}</p>
                                        <p className="font-semibold text-zinc-100">{d.company}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-emerald-400 font-mono font-bold">₹{d.salary}L</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area type="monotone" dataKey="salary" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSalary)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function ScoreGauge({ score }: { score: number }) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 80) return "#10b981"; // Emerald
        if (s >= 60) return "#3b82f6"; // Blue
        if (s >= 40) return "#f59e0b"; // Amber
        return "#f43f5e"; // Rose
    };

    return (
        <div className="relative flex items-center justify-center w-24 h-24">
            <svg className="w-full h-full -rotate-90 transform">
                <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-800" />
                <motion.circle
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx="48" cy="48" r={radius}
                    stroke={getColor(score)} strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold text-white font-mono">{score}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Match</span>
            </div>
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

// Helper to parse the numbered list string from LLM
function StrategyList({ text }: { text: string }) {
    if (!text) return <p className="text-sm text-zinc-500">No specific strategy provided.</p>;

    // Split by (1), (2) or 1., 2. or just newlines
    const points = text.split(/(?:\(\d+\)|\d+\.)/).filter(p => p.trim().length > 0);

    if (points.length <= 1) {
        return <p className="text-sm text-zinc-300 leading-relaxed">{text}</p>;
    }

    return (
        <ul className="space-y-3">
            {points.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm group">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-mono shrink-0">
                        {i + 1}
                    </div>
                    <span className="text-zinc-300 group-hover:text-zinc-100 transition-colors">
                        {point.replace(/^[\s.:]+/, '').trim()}
                    </span>
                </li>
            ))}
        </ul>
    );
}

// ============================================================================
// CONTENT COMPONENTS
// ============================================================================

function CompactExperienceTable({ experiences }: { experiences: ExperienceItem[] }) {
    if (!experiences?.length) return <div className="p-6 text-sm text-zinc-500 text-center">No professional history found.</div>;

    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-zinc-900/50 text-zinc-500 font-medium">
                    <tr>
                        <th className="px-4 py-2 border-b border-zinc-800 whitespace-nowrap">Role</th>
                        <th className="px-4 py-2 border-b border-zinc-800 whitespace-nowrap">Type</th>
                        <th className="px-4 py-2 border-b border-zinc-800 whitespace-nowrap">Duration</th>
                        <th className="px-4 py-2 border-b border-zinc-800 min-w-[200px]">Context</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                    {experiences.map((exp, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-4 py-3 align-top">
                                <div className="font-semibold text-zinc-200">{exp.title}</div>
                                <div className="text-zinc-400 mt-0.5 flex items-center gap-1.5 truncate max-w-[180px]">
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    {exp.company}
                                </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                                <Badge variant="outline" className={`text-[10px] h-5 border-zinc-800 bg-zinc-900/50 ${exp.experience_type === 'professional' ? 'text-emerald-400 border-emerald-900/30' : ''}`}>
                                    {exp.experience_type}
                                </Badge>
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                                <div className="font-mono text-zinc-300">{Math.round((exp.duration_months || 0) / 12 * 10) / 10}y</div>
                                <div className="text-zinc-600 text-[10px] mt-0.5">{exp.start_date} — {exp.end_date || 'Now'}</div>
                            </td>
                            <td className="px-4 py-3 align-top">
                                <div className="text-zinc-500 line-clamp-2 group-hover:text-zinc-400 transition-colors leading-relaxed">
                                    {exp.description || "—"}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EducationList({ education }: { education: any[] }) {
    if (!education?.length) return <div className="p-4 text-xs text-zinc-500">No education data available</div>;
    return (
        <div className="space-y-4 p-4">
            {education.map((edu, i) => (
                <div key={i} className="flex gap-3">
                    <div className="mt-1 w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 shrink-0">
                        <GraduationCap className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-zinc-200">{edu.school}</h4>
                        <div className="text-xs text-zinc-400">{edu.degree} {edu.field ? `• ${edu.field}` : ''}</div>
                        <div className="text-xs text-zinc-600 mt-0.5">{edu.start_year} - {edu.end_year}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function SharedResultPage() {
    const params = useParams();
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DeepDiveResult | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (params.id) loadResult(params.id as string);
    }, [params.id]);

    const loadResult = async (id: string) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/deep-dive/results/${id}`);
            if (res.ok) {
                const data = await res.json();
                setResult(data.data);
            } else {
                setError(res.status === 410 ? "Analysis link expired" : "Analysis not found");
            }
        } catch {
            setError("Connection failed. Please check your network.");
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

    if (!isMounted) return null;
    if (loading) return <TechLoader />;

    if (error || !result) return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505]">
            <Background />
            <div className="relative z-10 text-center space-y-6 p-8 border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl rounded-2xl max-w-md w-full">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                    <X className="w-8 h-8 text-rose-500" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-white mb-2">{error}</h1>
                    <Button onClick={() => router.push("/deep-dive")} className="w-full bg-white text-black hover:bg-zinc-200 mt-4">
                        Return to Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );

    const matchScore = result.match_analysis?.overall_match_score || 0;
    const isStrongMatch = matchScore >= 70;

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-200 selection:bg-violet-500/30 font-sans">
            <Background />

            {/* Navbar */}
            <header className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/deep-dive")} className="text-zinc-400 hover:text-white hover:bg-white/5">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="h-6 w-px bg-white/10" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <Brain className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-white tracking-tight hidden sm:inline">NeuraLeap</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={copyToClipboard} className={`h-9 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 ${copied ? 'border-emerald-500/30 text-emerald-400' : ''}`}>
                            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copied ? 'Copied' : 'Share'}
                        </Button>
                        <Button size="sm" onClick={() => router.push("/deep-dive")} className="h-9 bg-white text-black hover:bg-zinc-200">
                            <Plus className="w-4 h-4 mr-2" /> New Analysis
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
                <div className="grid lg:grid-cols-12 gap-8">

                    {/* LEFT SIDEBAR: STICKY PROFILE */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-24 space-y-6">
                            <div className="relative p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative w-24 h-24 mb-4">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 blur-lg opacity-40" />
                                        <div className="relative w-full h-full rounded-full bg-zinc-950 border-2 border-zinc-800 flex items-center justify-center overflow-hidden">
                                            {result.candidate?.avatar ? (
                                                <img src={result.candidate.avatar} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-3xl font-bold text-white">{result.candidate?.full_name?.charAt(0)}</span>
                                            )}
                                        </div>
                                        {result.candidate?.linkedin_url && (
                                            <a href={result.candidate.linkedin_url} target="_blank" className="absolute bottom-0 right-0 p-1.5 bg-[#0077b5] text-white rounded-full hover:scale-110 transition-transform shadow-lg border-2 border-zinc-950">
                                                <Linkedin className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                    <h1 className="text-2xl font-bold text-white mb-2">{result.candidate?.full_name}</h1>
                                    <p className="text-sm text-zinc-400 leading-relaxed mb-4">{result.candidate?.headline}</p>
                                    {result.candidate?.location && (
                                        <Badge variant="outline" className="bg-zinc-900/50 border-zinc-800 text-zinc-400 font-normal mb-6">
                                            <MapPin className="w-3 h-3 mr-1" /> {result.candidate.location}
                                        </Badge>
                                    )}
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                            <div className="text-xs text-zinc-500 uppercase">Experience</div>
                                            <div className="text-lg font-mono font-semibold text-white">{result.candidate?.experience_summary?.real_experience_years || 0}y</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                                            <div className="text-xs text-zinc-500 uppercase">Notice</div>
                                            <div className="text-lg font-mono font-semibold text-white">{result.notice_period?.estimated_notice_days?.likely || '?'}d</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DataCard className={isStrongMatch ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}>
                                <div className="flex gap-4 items-start">
                                    <div className="shrink-0 pt-1">
                                        {isStrongMatch ? <ShieldCheck className="w-6 h-6 text-emerald-500" /> : <AlertTriangle className="w-6 h-6 text-amber-500" />}
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className={`font-semibold ${isStrongMatch ? "text-emerald-400" : "text-amber-400"}`}>
                                            {result.match_analysis?.hiring_recommendation?.action || "Review Required"}
                                        </h4>
                                        <p className="text-sm text-zinc-400 leading-relaxed">
                                            {result.match_analysis?.hiring_recommendation?.reasoning || "No reasoning available."}
                                        </p>
                                    </div>
                                </div>
                            </DataCard>

                            {/* Digital Footprint Summary */}
                            <DataCard title="Digital Footprint" icon={Fingerprint} noPadding>
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-400">Authority Score</span>
                                        <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20">
                                            {result.professional_footprint?.overall_footprint_assessment?.digital_presence_score || 0}/100
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {result.professional_footprint?.verified_profiles?.length > 0 ? result.professional_footprint.verified_profiles.map((p: any, i: number) => (
                                            <a key={i} href={p.url} target="_blank" className="text-xs px-2 py-1 bg-zinc-800 rounded flex items-center gap-1 hover:text-white transition-colors text-zinc-400">
                                                <Globe className="w-3 h-3" /> {p.platform}
                                            </a>
                                        )) : <span className="text-xs text-zinc-600">No verified profiles found.</span>}
                                    </div>
                                </div>
                            </DataCard>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Main Content */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* 1. TOP METRICS ROW */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <DataCard className="flex flex-col justify-between" title="Match DNA" icon={Target} noPadding>
                                <div className="flex items-center justify-between px-6 pt-4">
                                    <div>
                                        <div className="text-4xl font-bold text-white mb-1">{matchScore}</div>
                                        <Badge variant="outline" className={`border-0 px-2 py-0.5 ${isStrongMatch ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {result.match_analysis?.match_label}
                                        </Badge>
                                    </div>
                                    <div className="w-[120px]">
                                        <MatchRadarChart breakdown={result.match_analysis?.score_breakdown} />
                                    </div>
                                </div>
                                <div className="px-6 pb-4">
                                    <div className="text-xs text-zinc-500 mt-2">{result.match_analysis?.recruiter_summary?.one_liner}</div>
                                </div>
                            </DataCard>

                            <DataCard title="Compensation & Growth" icon={DollarSign} noPadding>
                                <div className="p-6 pb-0">
                                    <div className="flex justify-between items-baseline">
                                        <div className="text-3xl font-mono font-bold text-white tracking-tight">
                                            ₹{result.salary_timeline?.current_estimated_ctc?.most_likely || 0}L
                                        </div>
                                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-mono">
                                            <TrendingUp className="w-3 h-3" />
                                            +{result.salary_timeline?.growth_analysis?.average_annual_growth_percent || 0}%
                                        </div>
                                    </div>
                                    <div className="text-xs text-zinc-500 mt-1">
                                        Est. Range: ₹{result.salary_timeline?.current_estimated_ctc?.low}-{result.salary_timeline?.current_estimated_ctc?.high}L
                                    </div>
                                </div>
                                <SalaryTrendChart progression={result.salary_timeline?.career_progression || []} />
                            </DataCard>
                        </div>

                        {/* 2. MAIN TABS */}
                        <Tabs defaultValue="analysis" className="w-full">
                            <TabsList className="w-full bg-zinc-900/50 border border-zinc-800 p-1 rounded-xl mb-6">
                                <TabsTrigger value="analysis" className="flex-1 data-[state=active]:bg-zinc-800">Analysis</TabsTrigger>
                                <TabsTrigger value="experience" className="flex-1 data-[state=active]:bg-zinc-800">Experience</TabsTrigger>
                                <TabsTrigger value="skills" className="flex-1 data-[state=active]:bg-zinc-800">Skills</TabsTrigger>
                                <TabsTrigger value="outreach" className="flex-1 data-[state=active]:bg-zinc-800">Outreach</TabsTrigger>
                            </TabsList>

                            {/* ANALYSIS CONTENT */}
                            <TabsContent value="analysis" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <DataCard title="Strengths & Concerns" icon={CheckCircle2}>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <ul className="space-y-3">
                                            <h4 className="text-xs font-medium text-emerald-500 uppercase tracking-wide mb-2">Strengths</h4>
                                            {(result.match_analysis?.strengths || []).map((s: any, i: number) => (
                                                <li key={i} className="flex gap-3 text-sm group">
                                                    <Check className="w-4 h-4 text-emerald-500/50 group-hover:text-emerald-500 transition-colors shrink-0" />
                                                    <span className="text-zinc-300">{typeof s === 'string' ? s : s.strength}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <ul className="space-y-3">
                                            <h4 className="text-xs font-medium text-amber-500 uppercase tracking-wide mb-2">Risks & Gaps</h4>
                                            {(result.match_analysis?.concerns || []).map((c: any, i: number) => (
                                                <li key={i} className="flex gap-3 text-sm group">
                                                    <AlertTriangle className="w-4 h-4 text-amber-500/50 group-hover:text-amber-500 transition-colors shrink-0" />
                                                    <span className="text-zinc-300">{typeof c === 'string' ? c : c.concern}</span>
                                                </li>
                                            ))}
                                            {(result.match_analysis?.gaps || []).map((g: any, i: number) => (
                                                <li key={i} className="flex gap-3 text-sm group">
                                                    <X className="w-4 h-4 text-rose-500/50 group-hover:text-rose-500 transition-colors shrink-0" />
                                                    <span className="text-zinc-300">{typeof g === 'string' ? g : g.gap}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </DataCard>
                            </TabsContent>

                            {/* EXPERIENCE CONTENT */}
                            <TabsContent value="experience" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <DataCard title="Career Timeline" icon={Briefcase} noPadding>
                                    <CompactExperienceTable experiences={result.candidate?.experience || []} />
                                </DataCard>
                                <DataCard title="Education" icon={GraduationCap} noPadding>
                                    <EducationList education={result.candidate?.education || []} />
                                </DataCard>
                            </TabsContent>

                            {/* SKILLS CONTENT */}
                            <TabsContent value="skills" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <DataCard title="Skill Matrix" icon={Code}>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4" /> Verified Evidence
                                                </h4>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {(result.skill_validation?.evidence || []).map((item: any, i: number) => {
                                                    const link = item.url || item.source_url || (typeof item.evidence_sources?.[0] === 'string' && item.evidence_sources[0].startsWith('http') ? item.evidence_sources[0] : null);
                                                    return (
                                                        <div key={i} className="p-3 rounded border border-zinc-800 bg-zinc-900/30 group">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-medium text-zinc-200">{item.skill}</span>
                                                                {link && (
                                                                    <a href={link} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-emerald-400">
                                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{item.evidence_description || "Verified via footprint"}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t border-zinc-800">
                                            <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                                                <Brain className="w-4 h-4" /> Unverified / Self-Claimed
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(result.skill_validation?.unvalidated_skills || []).map((s: string, i: number) => (
                                                    <Badge key={i} variant="outline" className="border-zinc-800 text-zinc-500">{s}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </DataCard>
                            </TabsContent>

                            {/* OUTREACH CONTENT (Enhanced) */}
                            <TabsContent value="outreach" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <DataCard title="Response Likelihood" icon={Signal}>
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="text-4xl font-bold text-white">{result.response_likelihood?.overall_score}%</div>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-zinc-300">{result.response_likelihood?.likelihood_label}</div>
                                                <div className="text-xs text-zinc-500">Based on market demand & activity</div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            {(result.response_likelihood?.factors || []).map((f: any, i: number) => (
                                                <div key={i} className="space-y-1">
                                                    <div className="flex justify-between text-xs text-zinc-400">
                                                        <span>{f.factor_name}</span>
                                                        <span className={f.impact === 'positive' ? 'text-emerald-500' : 'text-zinc-500'}>{f.impact}</span>
                                                    </div>
                                                    <Progress value={(f.score || 0) * 10} className="h-1.5 bg-zinc-800" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 p-3 bg-zinc-900/50 rounded border border-zinc-800">
                                            <span className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Reasoning</span>
                                            <p className="text-sm text-zinc-300 leading-relaxed">{result.response_likelihood?.data_quality_notes || "Analysis based on profile freshness and role demand."}</p>
                                        </div>
                                    </DataCard>

                                    <DataCard title="Recruiter Strategy" icon={MessageCircle}>
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/10">
                                                <span className="text-xs text-violet-400 font-bold uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                    <Lightbulb className="w-3 h-3" /> Recommended Hook
                                                </span>
                                                <StrategyList text={result.response_likelihood?.recommended_approach?.message_focus || "Focus on role impact."} />
                                            </div>

                                            {result.response_likelihood?.recommended_approach?.personalization_hooks?.length > 0 && (
                                                <div>
                                                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Specific Talking Points</span>
                                                    <ul className="space-y-2">
                                                        {result.response_likelihood.recommended_approach.personalization_hooks.map((hook: string, i: number) => (
                                                            <li key={i} className="text-xs text-zinc-300 flex gap-2">
                                                                <Sparkles className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                                                {hook}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </DataCard>
                                </div>
                            </TabsContent>
                        </Tabs>

                    </div>
                </div>
            </main>
        </div>
    );
}
