'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    Search,
    Loader2,
    Plus,
    Clock,
    ExternalLink,
    Trash2,
    User,
    Briefcase,
    Star,
    ChevronRight,
    Link as LinkIcon,
    Sparkles,
    TrendingUp,
    AlertCircle,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import AnimatedBackground from '@/components/auth/AnimatedBackground';

// Types
interface DeepDiveSummary {
    result_id: string;
    candidate_name: string;
    candidate_title: string;
    linkedin_url: string;
    match_score: number | null;
    created_at: string;
}

// ================================================================
// DEEP DIVE CARD
// ================================================================
const DeepDiveCard = ({
    report,
    onView,
    onDelete,
}: {
    report: DeepDiveSummary;
    onView: () => void;
    onDelete?: () => void;
}) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Recently';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getScoreColor = (score: number | null) => {
        if (!score) return 'text-slate-400';
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-blue-400';
        if (score >= 40) return 'text-amber-400';
        return 'text-rose-400';
    };

    const getScoreBg = (score: number | null) => {
        if (!score) return 'bg-slate-500/20';
        if (score >= 80) return 'bg-emerald-500/20';
        if (score >= 60) return 'bg-blue-500/20';
        if (score >= 40) return 'bg-amber-500/20';
        return 'bg-rose-500/20';
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 transition-all cursor-pointer"
            onClick={onView}
        >
            <div className="flex items-start gap-4">
                {/* Avatar / Score */}
                <div
                    className={cn(
                        'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        report.match_score ? getScoreBg(report.match_score) : 'bg-slate-700/50'
                    )}
                >
                    {report.match_score ? (
                        <span className={cn('text-lg font-bold', getScoreColor(report.match_score))}>
                            {report.match_score}
                        </span>
                    ) : (
                        <User className="h-6 w-6 text-slate-400" />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate pr-2">
                            {report.candidate_name || 'Unknown Candidate'}
                        </h3>
                        {onDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 -mt-1"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    {report.candidate_title && (
                        <p className="text-sm text-slate-400 truncate mb-2">{report.candidate_title}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(report.created_at)}
                        </span>
                        {report.linkedin_url && (

                            <a href={report.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <LinkIcon className="h-3.5 w-3.5" />
                                LinkedIn
                            </a>
                        )}
                    </div>

                    {report.match_score && (
                        <div className="mt-3">
                            <Badge
                                className={cn(
                                    'border-0',
                                    report.match_score >= 80
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : report.match_score >= 60
                                            ? 'bg-blue-500/20 text-blue-300'
                                            : report.match_score >= 40
                                                ? 'bg-amber-500/20 text-amber-300'
                                                : 'bg-rose-500/20 text-rose-300'
                                )}
                            >
                                {report.match_score >= 80
                                    ? 'Strong Match'
                                    : report.match_score >= 60
                                        ? 'Good Match'
                                        : report.match_score >= 40
                                            ? 'Fair Match'
                                            : 'Weak Match'}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>
        </motion.div >
    );
};

// ================================================================
// NEW ANALYSIS FORM
// ================================================================
const NewAnalysisForm = ({
    onSubmit,
    isLoading,
}: {
    onSubmit: (linkedinUrl: string, jobDescription?: string) => void;
    isLoading: boolean;
}) => {
    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [showJd, setShowJd] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkedinUrl.trim()) return;
        onSubmit(linkedinUrl.trim(), jobDescription.trim() || undefined);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 backdrop-blur-sm"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-white">New Analysis</h2>
                    <p className="text-sm text-slate-400">Get detailed insights on any candidate</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">LinkedIn Profile URL</label>
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                        <input
                            type="url"
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            placeholder="https://linkedin.com/in/..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => setShowJd(!showJd)}
                        className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        <Plus className={cn('h-4 w-4 transition-transform', showJd && 'rotate-45')} />
                        {showJd ? 'Remove job description' : 'Add job description for matching'}
                    </button><AnimatePresence>
                        {showJd && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste the job description here to get match scores and recommendations..."
                                    rows={4}
                                    className="w-full mt-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Button
                    type="submit"
                    disabled={isLoading || !linkedinUrl.trim()}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 h-12"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Search className="h-5 w-5 mr-2" />
                            Analyze Profile
                        </>
                    )}
                </Button>
            </form>
        </motion.div>
    );
};

// ================================================================
// MAIN PAGE
// ================================================================
export default function DeepDivePage() {
    const router = useRouter();
    const { token } = useAuth(); const [reports, setReports] = useState<DeepDiveSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load reports
    useEffect(() => {
        const loadReports = async () => {
            if (!token) return;

            try {
                setIsLoading(true);
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/dashboard/deep-dives`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    setReports(data.deep_dives || []);
                }
            } catch (err) {
                console.error('Failed to load reports:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadReports();
    }, [token]);

    const handleNewAnalysis = async (linkedinUrl: string, jobDescription?: string) => {
        if (!token) return;

        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/deep-dive/analyze`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        linkedin_url: linkedinUrl,
                        job_description: jobDescription,
                    }),
                }
            );

            if (response.ok) {
                const data = await response.json();
                // Navigate to the result page
                router.push(`/deep-dive/${data.result_id}`);
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Failed to analyze profile');
            }
        } catch (err) {
            console.error('Analysis error:', err);
            setError('Failed to analyze profile. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeleteReport = async (resultId: string) => {
        if (!token || !confirm('Delete this report?')) return;

        try {
            // API call to delete
            setReports((prev) => prev.filter((r) => r.result_id !== resultId));
        } catch (err) {
            console.error('Failed to delete report:', err);
        }
    };

    return (
        <AppLayout>
            <div className="min-h-screen relative">
                <AnimatedBackground />

                <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Candidate Reports</h1>
                        <p className="text-lg text-slate-400">
                            Deep analysis and insights on candidates
                        </p>
                    </motion.div>

                    {/* Error Message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3"
                        >
                            <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />
                            <p className="text-sm text-rose-300">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="ml-auto text-rose-400 hover:text-rose-300"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    )}

                    {/* New Analysis Form */}
                    <div className="mb-8">
                        <NewAnalysisForm onSubmit={handleNewAnalysis} isLoading={isAnalyzing} />
                    </div>

                    {/* Reports List */}
                    <section>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-xl font-semibold text-white">Previous Reports</h2>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    {reports.length} report{reports.length !== 1 ? 's' : ''} generated
                                </p>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                            </div>
                        ) : reports.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {reports.map((report) => (
                                    <DeepDiveCard
                                        key={report.result_id}
                                        report={report}
                                        onView={() => router.push(`/deep-dive/shared/${report.result_id}`)}
                                        onDelete={() => handleDeleteReport(report.result_id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center py-16 text-center"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
                                    <FileText className="h-8 w-8 text-slate-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">No reports yet</h3>
                                <p className="text-slate-400 max-w-sm">
                                    Enter a LinkedIn URL above to generate your first detailed candidate analysis
                                </p>
                            </motion.div>
                        )}
                    </section>

                    {/* Tips Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-12 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50"
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">What you&apos;ll get</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                    <User className="h-4 w-4 text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-white mb-1">Complete Profile</h4>
                                    <p className="text-sm text-slate-400">
                                        Experience, education, skills, and career trajectory
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-white mb-1">Match Analysis</h4>
                                    <p className="text-sm text-slate-400">
                                        Fit score, strengths, gaps, and recommendations
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                    <Star className="h-4 w-4 text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-white mb-1">Outreach Tips</h4>
                                    <p className="text-sm text-slate-400">
                                        Personalized talking points and approach strategy
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </AppLayout>
    );
}