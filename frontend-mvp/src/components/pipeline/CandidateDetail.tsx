/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ExternalLink,
    Mail,
    Phone,
    MapPin,
    Briefcase,
    GraduationCap,
    Star,
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Send,
    Ban,
    Play,
    FileText,
    MessageSquare
} from 'lucide-react';
import { PipelineCandidate, JobContext, CandidateStage } from '@/types/pipeline';

interface CandidateDetailProps {
    candidate: PipelineCandidate;
    job: JobContext;
    onClose: () => void;
    onStageChange: (newStage: string, notes?: string) => Promise<void>;
    onReject: (reason: string, feedback?: string) => Promise<void>;
}

export function CandidateDetail({
    candidate,
    job,
    onClose,
    onStageChange,
    onReject
}: CandidateDetailProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'interview'>('overview');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectFeedback, setRejectFeedback] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        setLoading(true);
        try {
            await onReject(rejectReason, rejectFeedback);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'interview', label: 'Interview', disabled: !candidate.interview.interview_session_id },
    ];

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#111111] border-l border-white/[0.08] z-50 overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="flex-shrink-0 border-b border-white/[0.08] p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                            {candidate.profile_picture_url ? (
                                <img
                                    src={candidate.profile_picture_url}
                                    alt={candidate.name}
                                    className="w-16 h-16 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-2xl">
                                    {candidate.name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-semibold text-white mb-1">
                                    {candidate.name}
                                </h2>
                                <p className="text-[14px] text-white/60">
                                    {candidate.current_title}
                                    {candidate.current_company && ` at ${candidate.current_company}`}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                    {candidate.location && (
                                        <span className="flex items-center gap-1 text-[12px] text-white/40">
                                            <MapPin className="w-3 h-3" />
                                            {candidate.location}
                                        </span>
                                    )}
                                    {candidate.experience_years && (
                                        <span className="text-[12px] text-white/40">
                                            {candidate.experience_years} years exp
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">

                        <a href={candidate.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-[13px] hover:bg-blue-500/20 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            LinkedIn
                        </a>

                        {candidate.email && (
                            <a href={`mailto:${candidate.email}`}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] text-white/70 rounded-lg text-[13px] hover:bg-white/[0.1] transition-colors"
                            >
                                <Mail className="w-3.5 h-3.5" />
                                Email
                            </a>
                        )}

                        <div className="flex-1" />

                        <button
                            onClick={() => setShowRejectModal(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[13px] hover:bg-red-500/20 transition-colors"
                        >
                            <Ban className="w-3.5 h-3.5" />
                            Reject
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex-shrink-0 border-b border-white/[0.08] px-6">
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                disabled={tab.disabled}
                                className={`
                  px-4 py-3 text-[13px] font-medium transition-colors relative
                  ${activeTab === tab.id
                                        ? 'text-white'
                                        : tab.disabled
                                            ? 'text-white/20 cursor-not-allowed'
                                            : 'text-white/50 hover:text-white/70'
                                    }
                `}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'overview' && (
                        <OverviewTab candidate={candidate} job={job} />
                    )}
                    {activeTab === 'timeline' && (
                        <TimelineTab candidate={candidate} />
                    )}
                    {activeTab === 'interview' && (
                        <InterviewTab candidate={candidate} />
                    )}
                </div>
            </motion.div>

            {/* Reject Modal */}
            <AnimatePresence>
                {showRejectModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 z-[60]"
                            onClick={() => setShowRejectModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#1a1a1a] border border-white/[0.08] rounded-xl p-6 z-[60]"
                        >
                            <h3 className="text-lg font-semibold text-white mb-4">
                                Reject Candidate
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[13px] text-white/60 mb-2">
                                        Reason for rejection *
                                    </label>
                                    <select
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white focus:outline-none focus:border-white/20"
                                    >
                                        <option value="">Select a reason...</option>
                                        <option value="not_qualified">Not qualified</option>
                                        <option value="overqualified">Overqualified</option>
                                        <option value="salary_mismatch">Salary mismatch</option>
                                        <option value="location_mismatch">Location mismatch</option>
                                        <option value="poor_fit">Poor cultural fit</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[13px] text-white/60 mb-2">
                                        Additional feedback (optional)
                                    </label>
                                    <textarea
                                        value={rejectFeedback}
                                        onChange={(e) => setRejectFeedback(e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[14px] text-white focus:outline-none focus:border-white/20 resize-none"
                                        placeholder="Any additional notes..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowRejectModal(false)}
                                    className="px-4 py-2 text-[13px] text-white/60 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectReason || loading}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors"
                                >
                                    {loading ? 'Rejecting...' : 'Reject Candidate'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

// Overview Tab
function OverviewTab({ candidate, job }: { candidate: PipelineCandidate; job: JobContext }) {
    const matchColors: Record<string, string> = {
        'Excellent Match': 'text-emerald-400 bg-emerald-400/10',
        'Great Match': 'text-green-400 bg-green-400/10',
        'Good Match': 'text-blue-400 bg-blue-400/10',
        'Fair Match': 'text-yellow-400 bg-yellow-400/10',
        'Below Target': 'text-red-400 bg-red-400/10',
    };

    return (
        <div className="space-y-6">
            {/* Match Score */}
            {candidate.match_score && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[14px] font-medium text-white">Match Analysis</h3>
                        <span className={`px-3 py-1 rounded-lg text-[13px] font-medium ${matchColors[candidate.match_label || ''] || 'text-white/60 bg-white/10'}`}>
                            {candidate.match_score}% • {candidate.match_label}
                        </span>
                    </div>

                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden mb-4">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${candidate.match_score}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className={`h-full rounded-full ${candidate.match_score >= 85 ? 'bg-emerald-500' :
                                candidate.match_score >= 70 ? 'bg-green-500' :
                                    candidate.match_score >= 55 ? 'bg-blue-500' :
                                        candidate.match_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                        />
                    </div>

                    {/* Strengths */}
                    {candidate.enrichment.top_strengths.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-[12px] text-white/40 uppercase tracking-wide mb-2">Strengths</h4>
                            <div className="space-y-2">
                                {candidate.enrichment.top_strengths.map((strength, i) => (
                                    <div key={i} className="flex items-start gap-2 text-[13px] text-white/70">
                                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                        {strength}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Concerns */}
                    {candidate.enrichment.concerns.length > 0 && (
                        <div>
                            <h4 className="text-[12px] text-white/40 uppercase tracking-wide mb-2">Concerns</h4>
                            <div className="space-y-2">
                                {candidate.enrichment.concerns.map((concern, i) => (
                                    <div key={i} className="flex items-start gap-2 text-[13px] text-white/70">
                                        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                        {concern}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Skills */}
            {candidate.skills.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="text-[14px] font-medium text-white mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                        {candidate.skills.map((skill, i) => {
                            const isRequired = job.required_skills.some(s =>
                                s.toLowerCase() === skill.toLowerCase()
                            );
                            const isNice = job.nice_to_have_skills.some(s =>
                                s.toLowerCase() === skill.toLowerCase()
                            );

                            return (
                                <span
                                    key={i}
                                    className={`
                    px-2.5 py-1 rounded-lg text-[12px]
                    ${isRequired
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : isNice
                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                : 'bg-white/[0.04] text-white/60 border border-white/[0.06]'
                                        }
                  `}
                                >
                                    {skill}
                                </span>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-white/40">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            Required
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            Nice to have
                        </span>
                    </div>
                </div>
            )}

            {/* Contact Info */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <h3 className="text-[14px] font-medium text-white mb-3">Contact Information</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${candidate.has_email ? 'bg-green-500/10' : 'bg-white/[0.04]'}`}>
                                <Mail className={`w-4 h-4 ${candidate.has_email ? 'text-green-400' : 'text-white/30'}`} />
                            </div>
                            <div>
                                <p className="text-[13px] text-white">{candidate.email || 'Not available'}</p>
                                <p className="text-[11px] text-white/40">Email</p>
                            </div>
                        </div>
                        {candidate.has_email && (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${candidate.has_phone ? 'bg-green-500/10' : 'bg-white/[0.04]'}`}>
                                <Phone className={`w-4 h-4 ${candidate.has_phone ? 'text-green-400' : 'text-white/30'}`} />
                            </div>
                            <div>
                                <p className="text-[13px] text-white">{candidate.has_phone ? 'Available' : 'Not available'}</p>
                                <p className="text-[11px] text-white/40">Phone</p>
                            </div>
                        </div>
                        {candidate.has_phone && (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                        )}
                    </div>
                </div>
            </div>

            {/* Outreach Status */}
            {candidate.outreach_sent_at && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <h3 className="text-[14px] font-medium text-white mb-3">Outreach Status</h3>
                    <div className="space-y-3">
                        <StatusItem
                            icon={Send}
                            label="Email Sent"
                            timestamp={candidate.outreach_sent_at}
                            active
                        />
                        <StatusItem
                            icon={Mail}
                            label="Email Opened"
                            timestamp={candidate.outreach?.first_opened_at}
                            count={candidate.outreach?.total_opens}
                            active={candidate.outreach_opened}
                        />
                        <StatusItem
                            icon={ExternalLink}
                            label="Link Clicked"
                            timestamp={candidate.outreach?.first_clicked_at}
                            count={candidate.outreach?.total_clicks}
                            active={candidate.outreach_clicked}
                        />
                        {candidate.interview_scheduled_at && (
                            <StatusItem
                                icon={Calendar}
                                label="Interview Scheduled"
                                timestamp={candidate.interview_scheduled_at}
                                active
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Timeline Tab
function TimelineTab({ candidate }: { candidate: PipelineCandidate }) {
    // Generate timeline from stage history and events
    const timeline = [
        {
            type: 'stage',
            label: 'Added to pipeline',
            timestamp: candidate.added_at,
            icon: '📋'
        }
    ];

    // Add outreach events
    if (candidate.outreach_sent_at) {
        timeline.push({
            type: 'event',
            label: 'Initial email sent',
            timestamp: candidate.outreach_sent_at,
            icon: '📧'
        });
    }

    if (candidate.outreach?.first_opened_at) {
        timeline.push({
            type: 'event',
            label: 'Email opened',
            timestamp: candidate.outreach.first_opened_at,
            icon: '👀'
        });
    }

    if (candidate.outreach?.first_clicked_at) {
        timeline.push({
            type: 'event',
            label: 'Scheduling link clicked',
            timestamp: candidate.outreach.first_clicked_at,
            icon: '🔗'
        });
    }

    if (candidate.interview_scheduled_at) {
        timeline.push({
            type: 'event',
            label: 'Interview scheduled',
            timestamp: candidate.interview_scheduled_at,
            icon: '📅'
        });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
        <div className="space-y-4">
            {timeline.map((item, index) => (
                <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center text-lg">
                            {item.icon}
                        </div>
                        {index < timeline.length - 1 && (
                            <div className="w-px h-full bg-white/[0.08] my-2" />
                        )}
                    </div>
                    <div className="flex-1 pb-6">
                        <p className="text-[14px] text-white">{item.label}</p>
                        <p className="text-[12px] text-white/40">
                            {new Date(item.timestamp).toLocaleString()}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Interview Tab
function InterviewTab({ candidate }: { candidate: PipelineCandidate }) {
    const interview = candidate.interview;

    if (!interview.interview_session_id) {
        return (
            <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-[15px] font-medium text-white/60 mb-1">No interview yet</h3>
                <p className="text-[13px] text-white/40">Interview data will appear here after completion</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Score */}
            {interview.overall_score && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-center">
                    <div className="text-4xl font-bold text-white mb-2">
                        {interview.overall_score}%
                    </div>
                    <p className="text-[14px] text-white/60 capitalize">
                        {interview.recommendation?.replace('_', ' ')}
                    </p>
                </div>
            )}

            {/* Recording */}
            {interview.recording_url && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 rounded-lg">
                                <Play className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-[14px] text-white">Interview Recording</p>
                                <p className="text-[12px] text-white/40">
                                    Duration: {Math.round((interview.call_duration_seconds || 0) / 60)} minutes
                                </p>
                            </div>
                        </div>

                        <a
                            href={interview.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-[13px] rounded-lg transition-colors"
                        >
                            Play
                        </a>
                    </div>
                </div>
            )}

            {/* Transcript */}
            {interview.transcript_available && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <FileText className="w-5 h-5 text-white/60" />
                        <h3 className="text-[14px] font-medium text-white">Transcript Available</h3>
                    </div>
                    <p className="text-[13px] text-white/50">
                        Full interview transcript is available for review.
                    </p>
                </div>
            )}
        </div>
    );
}

// Helper component
function StatusItem({
    icon: Icon,
    label,
    timestamp,
    count,
    active
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    timestamp?: string | null;
    count?: number;
    active: boolean;
}) {
    return (
        <div className={`flex items-center justify-between p-3 rounded-lg ${active ? 'bg-white/[0.04]' : 'bg-white/[0.02]'}`}>
            <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${active ? 'text-green-400' : 'text-white/30'}`} />
                <div>
                    <p className={`text-[13px] ${active ? 'text-white' : 'text-white/40'}`}>{label}</p>
                    {timestamp && (
                        <p className="text-[11px] text-white/30">
                            {new Date(timestamp).toLocaleString()}
                        </p>
                    )}
                </div>
            </div>
            {count !== undefined && count > 0 && (
                <span className="text-[12px] text-white/50">{count}x</span>
            )}
        </div>
    );
}