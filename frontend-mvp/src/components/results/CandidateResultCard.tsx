
'use client';

import { motion } from 'framer-motion';
import {
    ExternalLink,
    MapPin,
    Briefcase,
    Clock,
    DollarSign,
    FileText,
    CheckCircle2,
    User,
    Star
} from 'lucide-react';

interface CandidateResultCardProps {
    candidate: {
        candidate_id: string;
        linkedin_url: string;
        name: string;
        headline: string | null;
        current_company: string | null;
        current_title: string | null;
        location: string | null;
        experience_years: number | null;
        skills: string[];
        match_score: number | null;
        match_label: string | null;
        profile_picture_url: string | null;
        manual_data?: {
            expected_salary?: string;
            current_salary?: string;
            notice_period?: string;
            notes?: string;
            has_resume?: boolean;
        };
        source: string;
    };
    isSelected: boolean;
    onToggleSelect: () => void;
    jobRequirements?: {
        required_skills?: string[];
        nice_to_have_skills?: string[];
        must_have_skills?: string[];
    };
}

export function CandidateResultCard({
    candidate,
    isSelected,
    onToggleSelect,
    jobRequirements
}: CandidateResultCardProps) {
    // Determine match color based on score
    const getMatchColor = (score: number | null) => {
        if (score === null) return 'text-white/40';
        if (score >= 85) return 'text-emerald-400';
        if (score >= 70) return 'text-green-400';
        if (score >= 55) return 'text-blue-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getMatchBg = (score: number | null) => {
        if (score === null) return 'bg-white/[0.04]';
        if (score >= 85) return 'bg-emerald-500/10';
        if (score >= 70) return 'bg-green-500/10';
        if (score >= 55) return 'bg-blue-500/10';
        if (score >= 40) return 'bg-yellow-500/10';
        return 'bg-red-500/10';
    };

    // Check if skill matches job requirements
    const isRequiredSkill = (skill: string) => {
        const required = jobRequirements?.required_skills || jobRequirements?.must_have_skills || [];
        return required.some((s: string) => s.toLowerCase() === skill.toLowerCase());
    };

    const isNiceToHaveSkill = (skill: string) => {
        const niceToHave = jobRequirements?.nice_to_have_skills || [];
        return niceToHave.some((s: string) => s.toLowerCase() === skill.toLowerCase());
    };

    const isPending = candidate.name === 'Pending...' || !candidate.name;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`
        relative bg-white/[0.02] border rounded-xl p-5 cursor-pointer transition-all
        ${isSelected
                    ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20'
                    : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.03]'
                }
      `}
            onClick={onToggleSelect}
        >
            {/* Selection Checkbox */}
            <div className="absolute top-4 right-4 z-10">
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`
            w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
            ${isSelected
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-white/20 hover:border-white/40 bg-black/20'
                        }
          `}
                >
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                </motion.div>
            </div>

            {/* Header with Avatar */}
            <div className="flex items-start gap-4 mb-4">
                {candidate.profile_picture_url ? (
                    <img
                        src={candidate.profile_picture_url}
                        alt={candidate.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/10"
                    />
                ) : (
                    <div className={`
            w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg
            ${isPending
                            ? 'bg-white/[0.06] animate-pulse'
                            : 'bg-gradient-to-br from-purple-500 to-pink-500'
                        }
          `}>
                        {isPending ? (
                            <User className="w-6 h-6 text-white/30" />
                        ) : (
                            candidate.name?.charAt(0)?.toUpperCase() || '?'
                        )}
                    </div>
                )}

                <div className="flex-1 min-w-0 pr-8">
                    <h3 className={`text-[16px] font-semibold truncate ${isPending ? 'text-white/40' : 'text-white'}`}>
                        {isPending ? 'Loading profile...' : candidate.name}
                    </h3>
                    <p className="text-[13px] text-white/50 truncate mt-0.5">
                        {candidate.current_title || candidate.headline || (isPending ? 'Fetching details...' : 'No title')}
                    </p>
                    {candidate.current_company && (
                        <p className="text-[12px] text-white/40 truncate mt-0.5 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {candidate.current_company}
                        </p>
                    )}
                </div>
            </div>

            {/* Info Row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                {candidate.location && (
                    <div className="flex items-center gap-1.5 text-[12px] text-white/40">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{candidate.location}</span>
                    </div>
                )}
                {candidate.experience_years && (
                    <div className="flex items-center gap-1.5 text-[12px] text-white/40">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>{candidate.experience_years} yrs exp</span>
                    </div>
                )}
            </div>

            {/* Manual Data Tags (if from manual import) */}
            {candidate.manual_data && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {candidate.manual_data.expected_salary && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-500/10 text-green-400 text-[11px] font-medium rounded-lg border border-green-500/20">
                            <DollarSign className="w-3 h-3" />
                            {candidate.manual_data.expected_salary}
                        </span>
                    )}
                    {candidate.manual_data.notice_period && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-400 text-[11px] font-medium rounded-lg border border-blue-500/20">
                            <Clock className="w-3 h-3" />
                            {candidate.manual_data.notice_period}
                        </span>
                    )}
                    {candidate.manual_data.has_resume && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 text-[11px] font-medium rounded-lg border border-purple-500/20">
                            <FileText className="w-3 h-3" />
                            Resume
                        </span>
                    )}
                </div>
            )}

            {/* Notes from manual import */}
            {candidate.manual_data?.notes && (
                <div className="mb-4 p-2.5 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                    <p className="text-[12px] text-white/50 italic">
                        &quot;{candidate.manual_data.notes}&quot;
                    </p>
                </div>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
                <div className="mb-4">
                    <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.slice(0, 6).map((skill, i) => {
                            const required = isRequiredSkill(skill);
                            const niceToHave = isNiceToHaveSkill(skill);

                            return (
                                <span
                                    key={i}
                                    className={`
                    px-2 py-0.5 text-[11px] rounded-md font-medium
                    ${required
                                            ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                                            : niceToHave
                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                : 'bg-white/[0.04] text-white/50 border border-white/[0.06]'
                                        }
                  `}
                                >
                                    {required && <Star className="w-2.5 h-2.5 inline mr-1" />}
                                    {skill}
                                </span>
                            );
                        })}
                        {candidate.skills.length > 6 && (
                            <span className="px-2 py-0.5 text-[11px] text-white/30">
                                +{candidate.skills.length - 6} more
                            </span>
                        )}
                    </div>

                    {/* Skills Legend */}
                    {jobRequirements && (
                        <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[10px] text-white/30">
                                <span className="w-2 h-2 rounded-full bg-green-400" />
                                Required
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-white/30">
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                Nice to have
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                {/* Match Score */}
                <div className="flex items-center gap-2">
                    {candidate.match_score !== null ? (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${getMatchBg(candidate.match_score)}`}>
                            <span className={`text-xl font-bold ${getMatchColor(candidate.match_score)}`}>
                                {candidate.match_score}%
                            </span>
                            {candidate.match_label && (
                                <span className={`text-[11px] ${getMatchColor(candidate.match_score)}`}>
                                    {candidate.match_label}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-[12px] text-white/30 px-3 py-1.5 bg-white/[0.04] rounded-lg">
                            {isPending ? 'Calculating...' : 'Not scored'}
                        </span>
                    )}
                </div>

                {/* LinkedIn Link */}

                <a href={candidate.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-white/50 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    LinkedIn
                </a>
            </div>

            {/* Processing Indicator */}
            {
                isPending && (
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 to-transparent rounded-xl flex items-end justify-center pb-4 pointer-events-none">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                            <span className="text-[11px] text-white/70">Fetching profile...</span>
                        </div>
                    </div>
                )
            }
        </motion.div >
    );
}