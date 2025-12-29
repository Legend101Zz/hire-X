/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ArrowRight,
    Sparkles,
    Loader2,
    Users,
    Star,
    DollarSign,
    MapPin,
    ChevronRight
} from 'lucide-react';

interface ShortlistSidebarProps {
    selectedCandidates: Array<{
        candidate_id: string;
        name: string;
        current_company?: string | null;
        current_title?: string | null;
        match_score?: number | null;
        profile_picture_url?: string | null;
        manual_data?: {
            expected_salary?: string;
            notice_period?: string;
        };
    }>;
    onRemove: (id: string) => void;
    onCreatePipeline: () => void;
    loading: boolean;
}

export function ShortlistSidebar({
    selectedCandidates,
    onRemove,
    onCreatePipeline,
    loading
}: ShortlistSidebarProps) {
    const isOpen = selectedCandidates.length > 0;

    // Calculate average match score
    const avgScore = selectedCandidates.length > 0
        ? Math.round(
            selectedCandidates
                .filter(c => c.match_score !== null)
                .reduce((sum, c) => sum + (c.match_score || 0), 0) /
            selectedCandidates.filter(c => c.match_score !== null).length
        ) || 0
        : 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="sticky top-16 h-[calc(100vh-64px)] border-l border-white/[0.08] bg-[#0c0c0c] overflow-hidden flex-shrink-0"
                >
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-white/[0.08]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Users className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-white">
                                            Shortlist
                                        </h3>
                                        <p className="text-[11px] text-white/40">
                                            {selectedCandidates.length} candidate{selectedCandidates.length !== 1 ? 's' : ''} selected
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-[13px] font-semibold rounded-full">
                                    {selectedCandidates.length}
                                </span>
                            </div>

                            {/* Stats */}
                            {selectedCandidates.length > 0 && avgScore > 0 && (
                                <div className="flex items-center gap-4 p-3 bg-white/[0.03] rounded-lg">
                                    <div className="flex-1">
                                        <p className="text-[11px] text-white/40">Avg. Match</p>
                                        <p className="text-[18px] font-bold text-white">{avgScore}%</p>
                                    </div>
                                    <div className="w-px h-8 bg-white/[0.1]" />
                                    <div className="flex-1">
                                        <p className="text-[11px] text-white/40">Selected</p>
                                        <p className="text-[18px] font-bold text-white">{selectedCandidates.length}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Candidates List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
                            <AnimatePresence mode="popLayout">
                                {selectedCandidates.map((candidate, index) => (
                                    <motion.div
                                        key={candidate.candidate_id}
                                        layout
                                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, x: 0, scale: 1 }}
                                        exit={{ opacity: 0, x: -20, scale: 0.95 }}
                                        transition={{ duration: 0.2, delay: index * 0.02 }}
                                        className="group relative bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:bg-white/[0.05] transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Avatar */}
                                            {candidate.profile_picture_url ? (
                                                <img
                                                    src={candidate.profile_picture_url}
                                                    alt={candidate.name}
                                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                                                    {candidate.name?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-white truncate pr-6">
                                                    {candidate.name}
                                                </p>
                                                {candidate.current_title && (
                                                    <p className="text-[11px] text-white/40 truncate">
                                                        {candidate.current_title}
                                                    </p>
                                                )}
                                                {candidate.current_company && (
                                                    <p className="text-[11px] text-white/30 truncate">
                                                        at {candidate.current_company}
                                                    </p>
                                                )}

                                                {/* Tags */}
                                                <div className="flex items-center gap-2 mt-2">
                                                    {candidate.match_score !== null && (
                                                        <span className={`
                              text-[10px] font-medium px-1.5 py-0.5 rounded
                              ${candidate.match_score >= 70
                                                                ? 'bg-green-500/10 text-green-400'
                                                                : candidate.match_score >= 50
                                                                    ? 'bg-yellow-500/10 text-yellow-400'
                                                                    : 'bg-white/[0.06] text-white/50'
                                                            }
                            `}>
                                                            {candidate.match_score}%
                                                        </span>
                                                    )}
                                                    {candidate.manual_data?.expected_salary && (
                                                        <span className="text-[10px] text-white/40 flex items-center gap-0.5">
                                                            <DollarSign className="w-2.5 h-2.5" />
                                                            {candidate.manual_data.expected_salary}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Remove Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRemove(candidate.candidate_id);
                                                }}
                                                className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Action Footer */}
                        <div className="p-4 border-t border-white/[0.08] bg-[#0a0a0a]">
                            {/* Info Text */}
                            <p className="text-[11px] text-white/40 text-center mb-3">
                                Create a pipeline to enrich profiles, find contact info, and start outreach
                            </p>

                            {/* Create Pipeline Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onCreatePipeline}
                                disabled={loading || selectedCandidates.length === 0}
                                className="w-full py-3.5 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white text-[14px] font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating Pipeline...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Create Pipeline
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                )}
                            </motion.button>

                            {/* Quick Stats */}
                            <div className="flex items-center justify-center gap-4 mt-3">
                                <span className="flex items-center gap-1 text-[10px] text-white/30">
                                    <Star className="w-3 h-3 text-yellow-400" />
                                    Auto-shortlisted
                                </span>
                                <span className="text-[10px] text-white/20">•</span>
                                <span className="text-[10px] text-white/30">
                                    Ready for enrichment
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}