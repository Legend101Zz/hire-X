'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Users,
    Calendar,
    TrendingUp,
    Archive,
    Trash2
} from 'lucide-react';

import { usePipelineList } from '@/hooks/usePipeline';
import { PipelineListItem } from '@/types/pipeline';
import { CreatePipelineModal } from '@/components/pipeline/CreatePipelineModal';
import { EmptyState } from '@/components/pipeline/EmptyState';

export default function PipelineListPage() {
    const { pipelines, loading, error, fetchPipelines } = usePipelineList();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchPipelines(statusFilter || undefined);
    }, [fetchPipelines, statusFilter]);

    const filteredPipelines = pipelines.filter(p => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                p.name.toLowerCase().includes(query) ||
                p.job_title.toLowerCase().includes(query) ||
                p.company_name?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0a0a0a]/80 backdrop-blur-xl">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-white">Pipelines</h1>
                        <p className="text-[13px] text-white/40">Manage your recruitment pipelines</p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-[13px] font-medium rounded-lg hover:bg-white/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Pipeline
                    </button>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-6 py-6">
                {/* Toolbar */}
                <div className="flex items-center gap-4 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search pipelines..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg
                       text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
                        {['active', 'completed', 'archived'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                                className={`
                  px-3 py-1.5 text-[13px] rounded-md transition-colors capitalize
                  ${statusFilter === status
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white/70'
                                    }
                `}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Pipeline Grid */}
                {loading ? (
                    <PipelineListSkeleton />
                ) : filteredPipelines.length === 0 ? (
                    <EmptyState type="no-pipelines" onCreate={() => setShowCreateModal(true)} />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filteredPipelines.map((pipeline, index) => (
                                <motion.div
                                    key={pipeline.pipeline_id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <PipelineCard pipeline={pipeline} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <CreatePipelineModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => {
                            setShowCreateModal(false);
                            fetchPipelines();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function PipelineCard({ pipeline }: { pipeline: PipelineListItem }) {
    const statusColors: Record<string, string> = {
        active: 'bg-green-500/10 text-green-400 border-green-500/20',
        completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        archived: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    };

    const sourceIcons: Record<string, string> = {
        donna_search: '🔍',
        manual_import: '📥',
        api: '🔗',
    };

    return (
        <Link href={`/pipeline/${pipeline.pipeline_id}`}>
            <motion.div
                whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 cursor-pointer transition-all"
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{sourceIcons[pipeline.source] || '📋'}</span>
                            <h3 className="text-[15px] font-medium text-white truncate">
                                {pipeline.name}
                            </h3>
                        </div>
                        <p className="text-[13px] text-white/50 truncate">
                            {pipeline.job_title}
                            {pipeline.company_name && ` • ${pipeline.company_name}`}
                        </p>
                    </div>

                    <span className={`
            px-2 py-0.5 rounded text-[11px] font-medium border capitalize
            ${statusColors[pipeline.status] || statusColors.active}
          `}>
                        {pipeline.status}
                    </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                    <StatBox icon={Users} label="Total" value={pipeline.stats.total_sourced} />
                    <StatBox icon={TrendingUp} label="Responded" value={pipeline.stats.total_responded} />
                    <StatBox icon={Calendar} label="Scheduled" value={pipeline.stats.total_scheduled} />
                    <StatBox icon={Users} label="Hired" value={pipeline.stats.total_hired} color="emerald" />
                </div>

                {/* Progress */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/40">Pipeline Progress</span>
                        <span className="text-white/60">
                            {pipeline.stats.total_hired} / {pipeline.stats.total_sourced}
                        </span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full flex">
                            <div
                                className="bg-emerald-500 transition-all"
                                style={{ width: `${(pipeline.stats.total_hired / Math.max(pipeline.stats.total_sourced, 1)) * 100}%` }}
                            />
                            <div
                                className="bg-indigo-500 transition-all"
                                style={{ width: `${(pipeline.stats.total_scheduled / Math.max(pipeline.stats.total_sourced, 1)) * 100}%` }}
                            />
                            <div
                                className="bg-purple-500 transition-all"
                                style={{ width: `${(pipeline.stats.total_contacted / Math.max(pipeline.stats.total_sourced, 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                    <span className="text-[11px] text-white/30">
                        Created {new Date(pipeline.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[11px] text-white/30">
                        Updated {new Date(pipeline.updated_at).toLocaleDateString()}
                    </span>
                </div>
            </motion.div>
        </Link>
    );
}

function StatBox({
    icon: Icon,
    label,
    value,
    color = 'white'
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color?: string;
}) {
    const colors: Record<string, string> = {
        white: 'text-white',
        emerald: 'text-emerald-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
    };

    return (
        <div className="text-center">
            <div className={`text-lg font-semibold ${colors[color]}`}>{value}</div>
            <div className="text-[10px] text-white/40">{label}</div>
        </div>
    );
}

function PipelineListSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 animate-pulse">
                    <div className="h-6 bg-white/[0.06] rounded w-3/4 mb-2" />
                    <div className="h-4 bg-white/[0.04] rounded w-1/2 mb-4" />
                    <div className="grid grid-cols-4 gap-3 mb-4">
                        {[...Array(4)].map((_, j) => (
                            <div key={j} className="h-10 bg-white/[0.04] rounded" />
                        ))}
                    </div>
                    <div className="h-2 bg-white/[0.04] rounded" />
                </div>
            ))}
        </div>
    );
}

