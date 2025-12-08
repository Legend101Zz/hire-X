'use client';

import { motion } from 'framer-motion';
import { PipelineStats } from '@/types/pipeline';

interface PipelineAnalyticsProps {
    stats: PipelineStats;
    funnel: Record<string, number>;
    stageDistribution: Record<string, number>;
}

export function PipelineAnalytics({ stats, funnel, stageDistribution }: PipelineAnalyticsProps) {
    const conversionMetrics = [
        {
            label: 'Response Rate',
            value: stats.response_rate,
            description: 'Candidates who responded to outreach',
            benchmark: 30
        },
        {
            label: 'Schedule Rate',
            value: stats.schedule_rate,
            description: 'Responders who scheduled interviews',
            benchmark: 70
        },
        {
            label: 'Interview Completion',
            value: stats.interview_completion_rate,
            description: 'Scheduled interviews completed',
            benchmark: 85
        },
        {
            label: 'Offer Rate',
            value: stats.offer_rate,
            description: 'Interviewed candidates who got offers',
            benchmark: 20
        },
    ];

    return (
        <div className="mb-6 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-[14px] font-medium text-white mb-4">Conversion Funnel</h3>

            {/* Funnel Visualization */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {conversionMetrics.map((metric, index) => (
                    <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white/[0.03] rounded-lg p-4"
                    >
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-2xl font-semibold text-white">
                                {metric.value}%
                            </span>
                            <span
                                className={`text-[11px] ${metric.value >= metric.benchmark
                                        ? 'text-green-400'
                                        : 'text-yellow-400'
                                    }`}
                            >
                                {metric.value >= metric.benchmark ? '↑' : '↓'} vs {metric.benchmark}%
                            </span>
                        </div>

                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-2">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${metric.value}%` }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                className={`h-full rounded-full ${metric.value >= metric.benchmark
                                        ? 'bg-green-500'
                                        : 'bg-yellow-500'
                                    }`}
                            />
                        </div>

                        <p className="text-[12px] text-white/60">{metric.label}</p>
                        <p className="text-[11px] text-white/30">{metric.description}</p>
                    </motion.div>
                ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
                <QuickStat label="No Response" value={stats.total_no_response} color="gray" />
                <QuickStat label="Rejected" value={stats.total_rejected} color="red" />
                <QuickStat label="Withdrawn" value={stats.total_withdrawn} color="orange" />
                <QuickStat label="On Hold" value={0} color="yellow" />
                <QuickStat label="In Progress" value={stats.total_contacted - stats.total_responded} color="blue" />
                <QuickStat label="Scheduled" value={stats.total_scheduled} color="indigo" />
                <QuickStat label="Offers Sent" value={stats.total_offers} color="purple" />
                <QuickStat label="Hired" value={stats.total_hired} color="emerald" />
            </div>
        </div>
    );
}

function QuickStat({ label, value, color }: { label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        gray: 'text-gray-400',
        red: 'text-red-400',
        orange: 'text-orange-400',
        yellow: 'text-yellow-400',
        blue: 'text-blue-400',
        indigo: 'text-indigo-400',
        purple: 'text-purple-400',
        emerald: 'text-emerald-400',
        green: 'text-green-400',
    };

    return (
        <div className="text-center">
            <div className={`text-xl font-semibold ${colors[color]}`}>{value}</div>
            <div className="text-[10px] text-white/40">{label}</div>
        </div>
    );
}
