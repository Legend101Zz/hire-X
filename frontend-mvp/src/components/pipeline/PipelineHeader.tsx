
'use client';

import { motion } from 'framer-motion';
import {
    Users,
    Star,
    Sparkles,
    Mail,
    Calendar,
    CheckCircle2,
    TrendingUp,
    Loader2
} from 'lucide-react';
import { PipelineStats } from '@/types/pipeline';

interface PipelineHeaderProps {
    stats: PipelineStats;
    totalCandidates: number;
    selectedCount: number;
    onShortlist: () => void;
    onEnrich: () => void;
    onOutreach: () => void;
    loading: boolean;
}

export function PipelineHeader({
    stats,
    totalCandidates,
    selectedCount,
    onShortlist,
    onEnrich,
    onOutreach,
    loading
}: PipelineHeaderProps) {
    const statCards = [
        {
            label: 'Total Candidates',
            value: stats.total_sourced,
            icon: Users,
            color: 'text-blue-400',
            bgColor: 'bg-blue-400/10'
        },
        {
            label: 'Shortlisted',
            value: stats.total_shortlisted,
            icon: Star,
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-400/10'
        },
        {
            label: 'Contacted',
            value: stats.total_contacted,
            icon: Mail,
            color: 'text-purple-400',
            bgColor: 'bg-purple-400/10'
        },
        {
            label: 'Responded',
            value: stats.total_responded,
            icon: TrendingUp,
            color: 'text-green-400',
            bgColor: 'bg-green-400/10',
            rate: stats.response_rate > 0 ? `${stats.response_rate}%` : null
        },
        {
            label: 'Scheduled',
            value: stats.total_scheduled,
            icon: Calendar,
            color: 'text-indigo-400',
            bgColor: 'bg-indigo-400/10'
        },
        {
            label: 'Hired',
            value: stats.total_hired,
            icon: CheckCircle2,
            color: 'text-emerald-400',
            bgColor: 'bg-emerald-400/10'
        },
    ];

    return (
        <div className="mb-6 space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {statCards.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                            <div>
                                <p className="text-2xl font-semibold text-white">{stat.value}</p>
                                <p className="text-[12px] text-white/40">{stat.label}</p>
                                {stat.rate && (
                                    <p className="text-[11px] text-green-400">{stat.rate}</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                        <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[13px] text-white/60 mr-2"
                        >
                            {selectedCount} selected
                        </motion.span>
                    )}

                    <ActionButton
                        onClick={onShortlist}
                        disabled={selectedCount === 0 || loading}
                        icon={Star}
                        label="Shortlist"
                        color="yellow"
                    />

                    <ActionButton
                        onClick={onEnrich}
                        disabled={loading}
                        icon={Sparkles}
                        label={selectedCount > 0 ? "Enrich Selected" : "Enrich All Shortlisted"}
                        color="purple"
                        loading={loading}
                    />

                    <ActionButton
                        onClick={onOutreach}
                        disabled={loading}
                        icon={Mail}
                        label={selectedCount > 0 ? "Contact Selected" : "Contact All Ready"}
                        color="blue"
                        loading={loading}
                    />
                </div>

                <div className="text-[13px] text-white/40">
                    {totalCandidates} total candidates
                </div>
            </div>
        </div>
    );
}

interface ActionButtonProps {
    onClick: () => void;
    disabled?: boolean;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: 'yellow' | 'purple' | 'blue' | 'green';
    loading?: boolean;
}

function ActionButton({ onClick, disabled, icon: Icon, label, color, loading }: ActionButtonProps) {
    const colors = {
        yellow: 'hover:bg-yellow-500/10 hover:border-yellow-500/30 hover:text-yellow-400',
        purple: 'hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-400',
        blue: 'hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400',
        green: 'hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
        px-3 py-1.5 text-[13px] rounded-lg border border-white/[0.08] 
        text-white/70 transition-all flex items-center gap-2
        disabled:opacity-40 disabled:cursor-not-allowed
        ${colors[color]}
      `}
        >
            {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
                <Icon className="w-3.5 h-3.5" />
            )}
            {label}
        </button>
    );
}