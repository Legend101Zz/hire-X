
'use client';

import { motion } from 'framer-motion';
import {
    Star,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    ExternalLink,
    Eye,
    MousePointer,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle
} from 'lucide-react';
import { PipelineCandidate } from '@/types/pipeline';

interface CandidateCardProps {
    candidate: PipelineCandidate;
    isSelected: boolean;
    onSelect: () => void;
    onClick: () => void;
    onToggleFavorite: () => void;
    viewMode: 'list' | 'grid';
}

export function CandidateCard({
    candidate,
    isSelected,
    onSelect,
    onClick,
    onToggleFavorite,
    viewMode
}: CandidateCardProps) {
    const stageColors: Record<string, string> = {
        gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        green: 'bg-green-500/10 text-green-400 border-green-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
        orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };

    const matchColors: Record<string, string> = {
        'Excellent Match': 'text-emerald-400',
        'Great Match': 'text-green-400',
        'Good Match': 'text-blue-400',
        'Fair Match': 'text-yellow-400',
        'Below Target': 'text-red-400',
    };

    if (viewMode === 'grid') {
        return (
            <motion.div
                whileHover={{ y: -2 }}
                className={`
          relative bg-white/[0.02] border rounded-xl p-4 cursor-pointer
          transition-all hover:bg-white/[0.04]
          ${isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/[0.06]'}
        `}
                onClick={onClick}
            >
                {/* Selection checkbox */}
                <div
                    className="absolute top-3 left-3"
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                >
                    <div className={`
            w-5 h-5 rounded border-2 transition-all flex items-center justify-center
            ${isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-white/20 hover:border-white/40'
                        }
          `}>
                        {isSelected && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Favorite */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                    className="absolute top-3 right-3"
                >
                    <Star className={`w-4 h-4 transition-colors ${candidate.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/20 hover:text-white/40'
                        }`} />
                </button>

                {/* Content */}
                <div className="pt-6">
                    {/* Avatar & Name */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-lg">
                            {candidate.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[15px] font-medium text-white truncate">
                                {candidate.name}
                            </h3>
                            <p className="text-[13px] text-white/50 truncate">
                                {candidate.current_title || candidate.headline}
                            </p>
                        </div>
                    </div>

                    {/* Company & Location */}
                    <div className="space-y-1.5 mb-3">
                        {candidate.current_company && (
                            <div className="flex items-center gap-2 text-[12px] text-white/40">
                                <Briefcase className="w-3.5 h-3.5" />
                                <span className="truncate">{candidate.current_company}</span>
                            </div>
                        )}
                        {candidate.location && (
                            <div className="flex items-center gap-2 text-[12px] text-white/40">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{candidate.location}</span>
                            </div>
                        )}
                    </div>

                    {/* Match Score */}
                    {candidate.match_score && (
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-white/40">Match</span>
                                <span className={`text-[12px] font-medium ${matchColors[candidate.match_label || ''] || 'text-white/60'}`}>
                                    {candidate.match_score}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${candidate.match_score}%` }}
                                    className={`h-full rounded-full ${candidate.match_score >= 85 ? 'bg-emerald-500' :
                                        candidate.match_score >= 70 ? 'bg-green-500' :
                                            candidate.match_score >= 55 ? 'bg-blue-500' :
                                                candidate.match_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                />
                            </div>
                        </div>
                    )}

                    {/* Stage Badge */}
                    <div className="flex items-center justify-between">
                        <span className={`
              inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border
              ${stageColors[candidate.stage_color] || stageColors.gray}
            `}>
                            <span>{candidate.stage_icon}</span>
                            {candidate.stage_label}
                        </span>

                        {/* Contact indicators */}
                        <div className="flex items-center gap-1.5">
                            {candidate.has_email && (
                                <Mail className="w-3.5 h-3.5 text-white/30" />
                            )}
                            {candidate.has_phone && (
                                <Phone className="w-3.5 h-3.5 text-white/30" />
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // List view
    return (
        <motion.div
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
            className={`
        relative bg-white/[0.02] border rounded-xl p-4 cursor-pointer
        transition-all
        ${isSelected ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/[0.06]'}
      `}
            onClick={onClick}
        >
            <div className="flex items-center gap-4">
                {/* Checkbox */}
                <div
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    className="flex-shrink-0"
                >
                    <div className={`
            w-5 h-5 rounded border-2 transition-all flex items-center justify-center cursor-pointer
            ${isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-white/20 hover:border-white/40'
                        }
          `}>
                        {isSelected && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0">
                    {candidate.profile_picture_url ? (
                        <img
                            src={candidate.profile_picture_url}
                            alt={candidate.name}
                            className="w-12 h-12 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-lg">
                            {candidate.name.charAt(0)}
                        </div>
                    )}
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-[15px] font-medium text-white truncate">
                            {candidate.name}
                        </h3>
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                        >
                            <Star className={`w-4 h-4 transition-colors ${candidate.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-white/20 hover:text-white/40'
                                }`} />
                        </button>
                    </div>

                    <p className="text-[13px] text-white/50 truncate mb-1">
                        {candidate.current_title || candidate.headline}
                        {candidate.current_company && ` at ${candidate.current_company}`}
                    </p>

                    <div className="flex items-center gap-3 text-[12px] text-white/40">
                        {candidate.location && (
                            <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {candidate.location}
                            </span>
                        )}
                        {candidate.experience_years && (
                            <span>{candidate.experience_years} yrs exp</span>
                        )}
                    </div>
                </div>

                {/* Match Score */}
                <div className="flex-shrink-0 w-24 text-right">
                    {candidate.match_score ? (
                        <div>
                            <div className={`text-lg font-semibold ${matchColors[candidate.match_label || ''] || 'text-white/60'}`}>
                                {candidate.match_score}%
                            </div>
                            <div className="text-[11px] text-white/40">{candidate.match_label}</div>
                        </div>
                    ) : (
                        <div className="text-[12px] text-white/30">Not scored</div>
                    )}
                </div>

                {/* Outreach Status */}
                <div className="flex-shrink-0 w-32">
                    {candidate.outreach_sent_at ? (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                                {candidate.outreach_clicked ? (
                                    <MousePointer className="w-3.5 h-3.5 text-green-400" />
                                ) : candidate.outreach_opened ? (
                                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                                ) : (
                                    <Mail className="w-3.5 h-3.5 text-white/30" />
                                )}
                                <span className="text-[12px] text-white/50">
                                    {candidate.outreach_clicked ? 'Clicked' :
                                        candidate.outreach_opened ? 'Opened' : 'Sent'}
                                </span>
                            </div>
                            {candidate.interview_scheduled_at && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-[11px] text-white/40">Scheduled</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-[12px] text-white/30">Not contacted</span>
                    )}
                </div>

                {/* Stage */}
                <div className="flex-shrink-0">
                    <span className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border
            ${stageColors[candidate.stage_color] || stageColors.gray}
          `}>
                        <span>{candidate.stage_icon}</span>
                        {candidate.stage_label}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-2">

                    <a href={candidate.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-4 h-4 text-white/40" />
                    </a>
                </div>
            </div>
        </motion.div >
    );
}