'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    RefreshCw,
    Settings,
    MoreHorizontal,
    Download,
    Share2
} from 'lucide-react';
import Link from 'next/link';

import { usePipelineDashboard, usePipelineActions } from '@/hooks/usePipeline';
import { PipelineHeader } from '@/components/pipeline/PipelineHeader';
import { PipelineStages } from '@/components/pipeline/PipelineStages';
import { CandidateList } from '@/components/pipeline/CandidateList';
import { CandidateDetail } from '@/components/pipeline/CandidateDetail';
import { PipelineAnalytics } from '@/components/pipeline/PipelineAnalytics';
import { EmptyState } from '@/components/pipeline/EmptyState';
import { PipelineCandidate } from '@/types/pipeline';

export default function PipelineDashboardPage() {
    const params = useParams();
    const pipelineId = params.id as string;

    const { pipeline, loading, error, fetchDashboard } = usePipelineDashboard(pipelineId);
    const actions = usePipelineActions(pipelineId);

    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [activeCandidate, setActiveCandidate] = useState<PipelineCandidate | null>(null);
    const [stageFilter, setStageFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchDashboard();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchDashboard]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchDashboard();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleShortlist = async () => {
        if (selectedCandidates.length === 0) return;
        await actions.shortlistCandidates(selectedCandidates);
        setSelectedCandidates([]);
        fetchDashboard();
    };

    const handleEnrich = async () => {
        const toEnrich = selectedCandidates.length > 0 ? selectedCandidates : undefined;
        await actions.startEnrichment(toEnrich);
        setSelectedCandidates([]);
        fetchDashboard();
    };

    const handleOutreach = async () => {
        const toContact = selectedCandidates.length > 0 ? selectedCandidates : undefined;
        await actions.startOutreach(toContact);
        setSelectedCandidates([]);
        fetchDashboard();
    };

    const handleToggleFavorite = async (candidateId: string) => {
        await actions.toggleFavorite(candidateId);
        fetchDashboard();
    };

    if (loading && !pipeline) {
        return <DashboardSkeleton />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button
                        onClick={fetchDashboard}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!pipeline) {
        return <EmptyState type="not-found" />;
    }

    // Filter candidates
    const filteredCandidates = pipeline.candidates.filter(c => {
        if (stageFilter && c.stage !== stageFilter) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                c.name.toLowerCase().includes(query) ||
                c.current_company?.toLowerCase().includes(query) ||
                c.current_title?.toLowerCase().includes(query)
            );
        }
        return true;
    });

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Top Navigation */}
            <nav className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0a0a0a]/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/pipeline"
                            className="p-2 -ml-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-white/60" />
                        </Link>
                        <div>
                            <h1 className="text-[15px] font-medium text-white">
                                {pipeline.name}
                            </h1>
                            <p className="text-[13px] text-white/40">
                                {pipeline.job_title} {pipeline.company_name && `• ${pipeline.company_name}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 hover:bg-white/[0.06] rounded-lg transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-4 h-4 text-white/60" />
                        </button>
                        <button
                            onClick={() => setShowAnalytics(!showAnalytics)}
                            className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors ${showAnalytics
                                ? 'bg-white/10 text-white'
                                : 'hover:bg-white/[0.06] text-white/60'
                                }`}
                        >
                            Analytics
                        </button>
                        <button className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
                            <Settings className="w-4 h-4 text-white/60" />
                        </button>
                        <button className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-white/60" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto px-6 py-6">
                {/* Stats Header */}
                <PipelineHeader
                    stats={pipeline.stats}
                    totalCandidates={pipeline.total_candidates}
                    selectedCount={selectedCandidates.length}
                    onShortlist={handleShortlist}
                    onEnrich={handleEnrich}
                    onOutreach={handleOutreach}
                    loading={actions.loading}
                />

                {/* Visual Pipeline Stages */}
                <PipelineStages
                    stages={pipeline.pipeline_stages}
                    activeStage={stageFilter}
                    onStageClick={(stage) => setStageFilter(stage === stageFilter ? null : stage)}
                />

                {/* Analytics Panel */}
                <AnimatePresence>
                    {showAnalytics && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <PipelineAnalytics
                                stats={pipeline.stats}
                                funnel={pipeline.funnel}
                                stageDistribution={pipeline.stage_distribution}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Candidate List */}
                <CandidateList
                    candidates={filteredCandidates}
                    selectedIds={selectedCandidates}
                    onSelect={setSelectedCandidates}
                    onCandidateClick={setActiveCandidate}
                    onToggleFavorite={handleToggleFavorite}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    stageFilter={stageFilter}
                    onStageFilterChange={setStageFilter}
                    stageDistribution={pipeline.stage_distribution}
                />
            </main>

            {/* Candidate Detail Modal */}
            <AnimatePresence>
                {activeCandidate && (
                    <CandidateDetail
                        candidate={activeCandidate}
                        job={pipeline.job}
                        onClose={() => setActiveCandidate(null)}
                        onStageChange={async (newStage, notes) => {
                            await actions.updateCandidateStage(activeCandidate.candidate_id, newStage, notes);
                            fetchDashboard();
                        }}
                        onReject={async (reason, feedback) => {
                            await actions.rejectCandidate(activeCandidate.candidate_id, reason, feedback);
                            setActiveCandidate(null);
                            fetchDashboard();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// Loading skeleton
function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] animate-pulse">
            <div className="h-14 border-b border-white/[0.08]" />
            <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
                <div className="h-32 bg-white/[0.04] rounded-xl" />
                <div className="h-20 bg-white/[0.04] rounded-xl" />
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-24 bg-white/[0.04] rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}