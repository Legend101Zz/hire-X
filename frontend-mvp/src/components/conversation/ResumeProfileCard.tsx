"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Briefcase,
    Award,
    Clock,
    Building,
    MapPin,
    Star,
    CheckCircle2,
    Circle,
    Sparkles,
    Target,
    TrendingUp,
    Plus,
    Edit3,
} from "lucide-react";

interface ResumeProfileCardProps {
    profile: any;
    highlightedField?: string | null;
    updatingField?: string | null;
}

export default function ResumeProfileCard({
    profile,
    highlightedField = null,
    updatingField = null,
}: ResumeProfileCardProps) {
    const completionScore = calculateCompletion(profile);
    const filledFields = countFilledFields(profile);

    return (
        <Card className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/50 shadow-2xl overflow-hidden h-full backdrop-blur-xl">
            {/* Ambient glow effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-amber-500/5 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

            {/* Content */}
            <div className="relative">
                {/* Header - Spreadsheet style */}
                <div className="px-6 pt-5 pb-4 border-b border-slate-800/50 bg-slate-950/30">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded bg-violet-500/10 border border-violet-500/20">
                                    <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                                </div>
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                                    Candidate Profile
                                </span>
                            </div>
                            <motion.h2
                                className="text-lg font-semibold text-slate-100 transition-all"
                                animate={{
                                    opacity: profile.role_title ? 1 : 0.3,
                                }}
                            >
                                {profile.role_title || "Position Title"}
                            </motion.h2>
                        </div>

                        {/* Compact completion indicator */}
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xl font-bold text-slate-100">
                                    {completionScore}%
                                </div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                                    Complete
                                </div>
                            </div>
                            <div className="relative w-10 h-10">
                                <svg className="w-10 h-10 transform -rotate-90">
                                    <circle
                                        cx="20"
                                        cy="20"
                                        r="16"
                                        stroke="rgba(71, 85, 105, 0.3)"
                                        strokeWidth="2.5"
                                        fill="none"
                                    />
                                    <motion.circle
                                        cx="20"
                                        cy="20"
                                        r="16"
                                        stroke="url(#gradient)"
                                        strokeWidth="2.5"
                                        fill="none"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: completionScore / 100 }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                    />
                                </svg>
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#8b5cf6" />
                                        <stop offset="100%" stopColor="#f59e0b" />
                                    </linearGradient>
                                </defs>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 relative h-1 bg-slate-800/50 rounded-full overflow-hidden">
                        <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-purple-500 to-amber-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${completionScore}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                        <motion.div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-400 via-purple-400 to-amber-400 rounded-full opacity-50 blur-sm"
                            initial={{ width: 0 }}
                            animate={{ width: `${completionScore}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                    </div>
                </div>

                {/* Main Content - Table-like structure */}
                <div className="p-6 space-y-4">
                    {/* Row 1: Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <DataField
                            id="seniority"
                            icon={Award}
                            label="Seniority Level"
                            value={profile.seniority}
                            placeholder="Not specified"
                            highlighted={highlightedField === "seniority"}
                            updating={updatingField === "seniority"}
                        />
                        <DataField
                            id="experience_years"
                            icon={Clock}
                            label="Experience"
                            value={profile.experience_years}
                            placeholder="Not specified"
                            highlighted={highlightedField === "experience_years"}
                            updating={updatingField === "experience_years"}
                        />
                    </div>

                    {/* Row 2: Core Skills - Featured section */}
                    <SkillsDataSection
                        id="must_have_skills"
                        skills={profile.must_have_skills}
                        highlighted={highlightedField === "must_have_skills"}
                        updating={updatingField === "must_have_skills"}
                    />

                    {/* Row 3 & 4: Industries and Locations */}
                    <MultiValueField
                        id="industries"
                        icon={Building}
                        label="Target Industries"
                        values={profile.industries}
                        highlighted={highlightedField === "industries"}
                        updating={updatingField === "industries"}
                        color="blue"
                    />

                    <MultiValueField
                        id="locations"
                        icon={MapPin}
                        label="Preferred Locations"
                        values={profile.locations}
                        highlighted={highlightedField === "locations"}
                        updating={updatingField === "locations"}
                        color="emerald"
                    />

                    {/* Status Indicators */}
                    <AnimatePresence>
                        {filledFields >= 3 && filledFields < 5 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                    <div className="p-1.5 rounded-full bg-emerald-500/20">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-emerald-400">
                                            Profile Building
                                        </div>
                                        <div className="text-xs text-emerald-400/70">
                                            {5 - filledFields} more fields to complete
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {completionScore === 100 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, height: 0 }}
                                animate={{ opacity: 1, scale: 1, height: "auto" }}
                                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="p-4 bg-gradient-to-r from-violet-500/10 to-amber-500/10 border border-violet-500/20 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-violet-500/20">
                                            <CheckCircle2 className="w-5 h-5 text-violet-400" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-semibold text-violet-300">
                                                Profile Complete
                                            </div>
                                            <div className="text-xs text-violet-400/70">
                                                Ready to search candidates
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-violet-500/20 rounded-full">
                                            <span className="text-xs font-semibold text-violet-300">
                                                Ready
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer - Stats bar */}
                <div className="px-6 pb-5 pt-3 border-t border-slate-800/50 bg-slate-950/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5 text-slate-400">
                                <Circle className="w-2 h-2 text-violet-400 fill-violet-400" />
                                {filledFields} of 5 fields
                            </span>
                            {completionScore > 60 && (
                                <motion.span
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-1.5 text-emerald-400 font-medium"
                                >
                                    <CheckCircle2 className="w-3 h-3" />
                                    On track
                                </motion.span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500">
                            Last updated: now
                        </div>
                    </div>
                </div>
            </div>

            {/* Donna positioning markers */}
            <div id="field-seniority" className="absolute top-[140px] left-6 w-1 h-1" />
            <div id="field-experience_years" className="absolute top-[140px] right-6 w-1 h-1" />
            <div id="field-must_have_skills" className="absolute top-[210px] left-6 w-1 h-1" />
            <div id="field-industries" className="absolute top-[310px] left-6 w-1 h-1" />
            <div id="field-locations" className="absolute top-[370px] left-6 w-1 h-1" />
        </Card>
    );
}

// Data field component - Spreadsheet row style
function DataField({
    id,
    icon: Icon,
    label,
    value,
    placeholder,
    highlighted,
    updating,
}: any) {
    return (
        <motion.div
            id={`field-${id}`}
            className={`relative group transition-all duration-300 ${highlighted
                    ? "bg-amber-500/10 border border-amber-500/30 shadow-lg shadow-amber-500/10"
                    : value
                        ? "bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50"
                        : "bg-slate-800/20 border border-slate-700/30 border-dashed"
                } rounded-lg p-3.5 backdrop-blur-sm`}
            animate={{
                scale: highlighted ? 1.02 : 1,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
            {/* Updating indicator */}
            <AnimatePresence>
                {updating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-1.5 -right-1.5"
                    >
                        <div className="relative">
                            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                            </div>
                            <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-75" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Field header */}
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${value ? "text-violet-400" : "text-slate-500"}`} />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    {label}
                </span>
            </div>

            {/* Field value */}
            <AnimatePresence mode="wait">
                {value ? (
                    <motion.div
                        key="value"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="text-sm font-medium text-slate-200"
                    >
                        {value}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-xs text-slate-500"
                    >
                        <Plus className="w-3 h-3" />
                        {placeholder}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Skills section - Featured with pills
function SkillsDataSection({ id, skills, highlighted, updating }: any) {
    return (
        <motion.div
            id={`field-${id}`}
            className={`relative transition-all duration-300 ${highlighted
                    ? "bg-amber-500/10 border border-amber-500/30 shadow-lg shadow-amber-500/10"
                    : skills?.length > 0
                        ? "bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
                        : "bg-slate-800/20 border border-slate-700/30 border-dashed"
                } rounded-lg p-4 backdrop-blur-sm`}
            animate={{
                scale: highlighted ? 1.01 : 1,
            }}
        >
            {/* Updating indicator */}
            <AnimatePresence>
                {updating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-1.5 -right-1.5 z-10"
                    >
                        <div className="relative">
                            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                            </div>
                            <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-75" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Star
                        className={`w-3.5 h-3.5 ${skills?.length > 0 ? "text-yellow-400" : "text-slate-500"}`}
                        fill={skills?.length > 0 ? "currentColor" : "none"}
                    />
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                        Core Skills
                    </span>
                </div>
                {skills?.length > 0 && (
                    <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] px-2 py-0">
                        {skills.length} skills
                    </Badge>
                )}
            </div>

            {/* Skills list */}
            <AnimatePresence mode="wait">
                {skills?.length > 0 ? (
                    <motion.div
                        key="skills"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-wrap gap-2"
                    >
                        {skills.map((skill: string, idx: number) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.03 }}
                            >
                                <Badge className="bg-slate-800/60 border-violet-500/30 text-violet-300 hover:bg-slate-700/60 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                                    {skill}
                                </Badge>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-slate-500 py-2"
                    >
                        <Target className="w-4 h-4" />
                        <span className="text-xs">Add required skills</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Multi-value field for tags
function MultiValueField({ id, icon: Icon, label, values, highlighted, updating, color }: any) {
    const colorClasses = {
        blue: {
            glow: "from-blue-500/10 to-blue-500/5",
            border: "border-blue-500/20",
            icon: "text-blue-400",
            badge: "bg-slate-800/60 border-blue-500/30 text-blue-300",
        },
        emerald: {
            glow: "from-emerald-500/10 to-emerald-500/5",
            border: "border-emerald-500/20",
            icon: "text-emerald-400",
            badge: "bg-slate-800/60 border-emerald-500/30 text-emerald-300",
        },
    };

    const colors = colorClasses[color as keyof typeof colorClasses];

    return (
        <motion.div
            id={`field-${id}`}
            className={`relative transition-all duration-300 ${highlighted
                    ? "bg-amber-500/10 border border-amber-500/30 shadow-lg shadow-amber-500/10"
                    : values?.length > 0
                        ? `bg-gradient-to-br ${colors.glow} border ${colors.border}`
                        : "bg-slate-800/20 border border-slate-700/30 border-dashed"
                } rounded-lg p-3.5 backdrop-blur-sm`}
            animate={{
                scale: highlighted ? 1.01 : 1,
            }}
        >
            {/* Updating indicator */}
            <AnimatePresence>
                {updating && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-1.5 -right-1.5"
                    >
                        <div className="relative">
                            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/50">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                    <Sparkles className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                            </div>
                            <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-75" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center gap-2 mb-2.5">
                <Icon className={`w-3.5 h-3.5 ${values?.length > 0 ? colors.icon : "text-slate-500"}`} />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    {label}
                </span>
            </div>

            <AnimatePresence mode="wait">
                {values?.length > 0 ? (
                    <motion.div
                        key="values"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-wrap gap-1.5"
                    >
                        {values.map((value: string, idx: number) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                            >
                                <Badge className={`${colors.badge} text-xs font-medium backdrop-blur-sm`}>
                                    {value}
                                </Badge>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 text-xs text-slate-500"
                    >
                        <Plus className="w-3 h-3" />
                        Not specified
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function calculateCompletion(profile: any): number {
    let score = 0;
    const fields = [
        profile.role_title,
        profile.seniority,
        profile.experience_years,
        profile.must_have_skills?.length >= 3,
        profile.industries?.length > 0,
    ];

    fields.forEach((field) => {
        if (field) score += 20;
    });

    return Math.min(score, 100);
}

function countFilledFields(profile: any): number {
    let count = 0;
    if (profile.role_title) count++;
    if (profile.seniority) count++;
    if (profile.experience_years) count++;
    if (profile.must_have_skills?.length >= 1) count++;
    if (profile.industries?.length > 0) count++;
    return count;
}