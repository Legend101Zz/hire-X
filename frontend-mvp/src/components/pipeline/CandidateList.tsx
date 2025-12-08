
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Filter,
    SortAsc,
    SortDesc,
    LayoutGrid,
    LayoutList,
    ChevronDown
} from 'lucide-react';
import { PipelineCandidate } from '@/types/pipeline';
import { CandidateCard } from './CandidateCard';

interface CandidateListProps {
    candidates: PipelineCandidate[];
    selectedIds: string[];
    onSelect: (ids: string[]) => void;
    onCandidateClick: (candidate: PipelineCandidate) => void;
    onToggleFavorite: (id: string) => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    stageFilter: string | null;
    onStageFilterChange: (stage: string | null) => void;
    stageDistribution: Record<string, number>;
}

type SortField = 'added_at' | 'name' | 'match_score' | 'stage';
type ViewMode = 'list' | 'grid';

export function CandidateList({
    candidates,
    selectedIds,
    onSelect,
    onCandidateClick,
    onToggleFavorite,
    searchQuery,
    onSearchChange,
    stageFilter,
    onStageFilterChange,
    stageDistribution,
}: CandidateListProps) {
    const [sortField, setSortField] = useState<SortField>('added_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Sort candidates
    const sortedCandidates = useMemo(() => {
        return [...candidates].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'match_score':
                    comparison = (a.match_score || 0) - (b.match_score || 0);
                    break;
                case 'added_at':
                default:
                    comparison = new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [candidates, sortField, sortOrder]);

    const toggleSelectAll = () => {
        if (selectedIds.length === candidates.length) {
            onSelect([]);
        } else {
            onSelect(candidates.map(c => c.candidate_id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            onSelect(selectedIds.filter(i => i !== id));
        } else {
            onSelect([...selectedIds, id]);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search candidates..."
                        className="w-full pl-10 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg
                     text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20
                     transition-colors"
                    />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                        className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg
                     text-[13px] text-white/70 focus:outline-none focus:border-white/20
                     appearance-none cursor-pointer"
                    >
                        <option value="added_at">Date Added</option>
                        <option value="name">Name</option>
                        <option value="match_score">Match Score</option>
                    </select>

                    <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-2 bg-white/[0.04] border border-white/[0.08] rounded-lg
                     hover:bg-white/[0.08] transition-colors"
                    >
                        {sortOrder === 'asc' ? (
                            <SortAsc className="w-4 h-4 text-white/60" />
                        ) : (
                            <SortDesc className="w-4 h-4 text-white/60" />
                        )}
                    </button>

                    {/* View Mode Toggle */}
                    <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                                }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Select All */}
            {candidates.length > 0 && (
                <div className="flex items-center gap-3 px-1">
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 text-[13px] text-white/50 hover:text-white/70 transition-colors"
                    >
                        <div className={`
              w-4 h-4 rounded border transition-all flex items-center justify-center
              ${selectedIds.length === candidates.length
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-white/20 hover:border-white/40'
                            }
            `}>
                            {selectedIds.length === candidates.length && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </div>
                        {selectedIds.length > 0
                            ? `${selectedIds.length} of ${candidates.length} selected`
                            : 'Select all'
                        }
                    </button>

                    {stageFilter && (
                        <button
                            onClick={() => onStageFilterChange(null)}
                            className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Clear filter
                        </button>
                    )}
                </div>
            )}

            {/* Candidate Cards */}
            {candidates.length === 0 ? (
                <EmptyCandidateState hasFilter={!!stageFilter || !!searchQuery} />
            ) : (
                <motion.div
                    className={viewMode === 'grid'
                        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
                        : 'space-y-2'
                    }
                    layout
                >
                    <AnimatePresence mode="popLayout">
                        {sortedCandidates.map((candidate, index) => (
                            <motion.div
                                key={candidate.candidate_id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2, delay: index * 0.02 }}
                            >
                                <CandidateCard
                                    candidate={candidate}
                                    isSelected={selectedIds.includes(candidate.candidate_id)}
                                    onSelect={() => toggleSelect(candidate.candidate_id)}
                                    onClick={() => onCandidateClick(candidate)}
                                    onToggleFavorite={() => onToggleFavorite(candidate.candidate_id)}
                                    viewMode={viewMode}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}

function EmptyCandidateState({ hasFilter }: { hasFilter: boolean }) {
    return (
        <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/[0.04] flex items-center justify-center">
                <Search className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-[15px] font-medium text-white/60 mb-1">
                {hasFilter ? 'No matching candidates' : 'No candidates yet'}
            </h3>
            <p className="text-[13px] text-white/40">
                {hasFilter
                    ? 'Try adjusting your search or filters'
                    : 'Add candidates to start your pipeline'
                }
            </p>
        </div>
    );
}