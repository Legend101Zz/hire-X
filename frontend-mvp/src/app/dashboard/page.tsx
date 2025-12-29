'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Users,
    Sparkles,
    Plus,
    ChevronRight,
    Star,
    Briefcase,
    Clock,
    Calendar,
    Zap,
    MessageSquare,
    Phone,
    Send,
    Play,
    Reply,
    FileText,
    CheckCircle2,
    X,
    RefreshCw,
    ArrowRight,
    Eye,
    PartyPopper,
    AlertCircle,
    Lightbulb,
    Inbox,
    Trash2,
    TrendingUp,
    Target,
    Award,
    Loader2,
    Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import * as dashboardApi from '@/utils/api/dashboardApi';
import type {
    EnhancedDashboardData,
    SearchSummary,
    InboxItem,
    UpcomingInterview,
    InterviewScheduleView,
    InterviewsResponse,
    PipelineStageStats,
} from '@/utils/api/dashboardApi';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/layout/AppLayout';
import AnimatedBackground from '@/components/auth/AnimatedBackground';

// ================================================================
// VIEW TYPES
// ================================================================
type DashboardView = 'home' | 'roles' | 'responses' | 'interviews';

// ================================================================
// STAT CARD COMPONENT
// ================================================================
const StatCard = ({
    label,
    value,
    icon: Icon,
    trend,
    color = 'default',
    onClick,
}: {
    label: string;
    value: number | string;
    icon: React.ElementType;
    trend?: string;
    color?: 'default' | 'blue' | 'green' | 'amber' | 'purple';
    onClick?: () => void;
}) => {
    const colors = {
        default: 'from-slate-500/20 to-slate-600/10 border-slate-700/50',
        blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
        green: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
        amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    };

    const iconColors = {
        default: 'text-slate-400',
        blue: 'text-blue-400',
        green: 'text-emerald-400',
        amber: 'text-amber-400',
        purple: 'text-purple-400',
    };

    return (
        <motion.button
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                'relative p-5 rounded-2xl text-left transition-all backdrop-blur-sm border bg-gradient-to-br',
                colors[color],
                onClick && 'cursor-pointer hover:border-indigo-500/30'
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={cn('p-2.5 rounded-xl bg-white/5', iconColors[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                        <TrendingUp className="h-3 w-3" />
                        {trend}
                    </div>
                )}
            </div>
            <div className="text-3xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
        </motion.button>
    );
};

// ================================================================
// ACTION CARD
// ================================================================
const ActionCard = ({
    icon: Icon,
    title,
    description,
    onClick,
    variant = 'default',
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    onClick: () => void;
    variant?: 'default' | 'primary';
}) => {
    return (
        <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                'group w-full p-6 rounded-2xl text-left transition-all border',
                variant === 'primary'
                    ? 'bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent border-indigo-500/30 hover:border-indigo-400/50'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
            )}
        >
            <div
                className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all',
                    variant === 'primary'
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25'
                        : 'bg-slate-700/50 group-hover:bg-slate-700'
                )}
            >
                <Icon className={cn('h-6 w-6', variant === 'primary' ? 'text-white' : 'text-slate-300')} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">
                {title}
            </h3>
            <p className="text-sm text-slate-400">{description}</p>
        </motion.button>
    );
};

// ================================================================
// FOCUS ITEM
// ================================================================
const FocusItem = ({
    icon: Icon,
    title,
    subtitle,
    badge,
    onClick,
    urgent = false,
}: {
    icon: React.ElementType;
    title: string;
    subtitle: string;
    badge?: string;
    onClick: () => void;
    urgent?: boolean;
}) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl transition-all group text-left',
                'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30',
                urgent && 'border-l-2 border-l-amber-500'
            )}
        >
            <div
                className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                    urgent ? 'bg-amber-500/20' : 'bg-indigo-500/20'
                )}
            >
                <Icon className={cn('h-5 w-5', urgent ? 'text-amber-400' : 'text-indigo-400')} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">{title}</p>
                    {badge && (
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-0 text-xs">{badge}</Badge>
                    )}
                </div>
                <p className="text-sm text-slate-400 truncate">{subtitle}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-white transition-colors flex-shrink-0" />
        </button>
    );
};

// ================================================================
// PIPELINE STAGE BAR
// ================================================================
const PipelineStageBar = ({
    stats,
    onStageClick,
}: {
    stats: PipelineStageStats;
    onStageClick?: (stage: string) => void;
}) => {
    const stages = [
        { key: 'sourced', label: 'Found', count: stats.sourced, color: 'bg-slate-500' },
        { key: 'enriched', label: 'Reviewed', count: stats.enriched, color: 'bg-blue-500' },
        { key: 'outreach_sent', label: 'Contacted', count: stats.outreach_sent, color: 'bg-cyan-500' },
        { key: 'responded', label: 'Replied', count: stats.responded, color: 'bg-emerald-500' },
        { key: 'scheduled', label: 'Interviewing', count: stats.scheduled + stats.interviewed, color: 'bg-violet-500' },
        { key: 'hired', label: 'Hired', count: stats.hired, color: 'bg-green-500' },
    ];

    const total = stages.reduce((acc, s) => acc + s.count, 0) || 1;

    return (
        <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Candidate Pipeline</h3>
                    <p className="text-sm text-slate-400">Track progress across all roles</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-indigo-400 hover:text-indigo-300"
                    onClick={() => onStageClick?.('all')}
                >
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>

            {/* Progress Bar */}
            <div className="h-3 rounded-full bg-slate-700/50 overflow-hidden flex mb-6">
                {stages.map((stage, i) => (
                    <motion.div
                        key={stage.key}
                        initial={{ width: 0 }}
                        animate={{ width: `${(stage.count / total) * 100}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className={cn(stage.color, 'h-full')}
                        style={{ minWidth: stage.count > 0 ? '4px' : '0' }}
                    />
                ))}
            </div>

            {/* Stage Labels */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {stages.map((stage) => (
                    <button
                        key={stage.key}
                        onClick={() => onStageClick?.(stage.key)}
                        className="text-center p-3 rounded-xl hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <div className={cn('w-2 h-2 rounded-full', stage.color)} />
                            <span className="text-xl font-bold text-white">{stage.count}</span>
                        </div>
                        <p className="text-xs text-slate-400">{stage.label}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ================================================================
// ROLE CARD
// ================================================================
const RoleCard = ({
    role,
    onView,
    onDelete,
}: {
    role: SearchSummary;
    onView: () => void;
    onDelete?: () => void;
}) => {
    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Recently';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 transition-all cursor-pointer"
            onClick={onView}
        >
            <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-5 w-5 text-indigo-400" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                        <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate pr-2">
                            {role.role_title || 'Untitled Role'}
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

                    <p className="text-sm text-slate-400 flex items-center gap-2 mb-3">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(role.created_at)}
                    </p>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-sm">
                            <Users className="h-4 w-4 text-blue-400" />
                            <span className="text-white font-medium">{role.enriched_count}</span>
                            <span className="text-slate-500">found</span>
                        </div>
                        {role.shortlisted_count > 0 && (
                            <div className="flex items-center gap-1.5 text-sm">
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                <span className="text-white font-medium">{role.shortlisted_count}</span>
                                <span className="text-slate-500">saved</span>
                            </div>
                        )}
                    </div>

                    {role.skills && role.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {role.skills.slice(0, 3).map((skill, i) => (
                                <Badge key={i} variant="secondary" className="text-xs bg-slate-700/50 text-slate-300 border-0">
                                    {skill}
                                </Badge>
                            ))}
                            {role.skills.length > 3 && (
                                <Badge variant="secondary" className="text-xs bg-slate-700/50 text-slate-400 border-0">
                                    +{role.skills.length - 3}
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ================================================================
// RESPONSE ITEM
// ================================================================
const ResponseItem = ({ item }: { item: InboxItem }) => {
    const router = useRouter();

    const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
        response: { icon: Reply, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
        interview: { icon: Phone, color: 'text-blue-400', bg: 'bg-blue-500/20' },
        reminder: { icon: Bell, color: 'text-amber-400', bg: 'bg-amber-500/20' },
        milestone: { icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/20' },
    };

    const config = typeConfig[item.type] || typeConfig.reminder;
    const Icon = config.icon;

    const handleClick = () => {
        if (item.pipeline_id) {
            // Navigate to the pipeline page with the candidate
            router.push(`/pipeline/${item.pipeline_id.replace('pipe-', '')}/${item.pipeline_id}`);
        }
    };

    return (
        <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleClick}
            className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left',
                'hover:bg-slate-800/50 border border-transparent',
                item.is_unread && 'bg-slate-800/30'
            )}
        >
            <div className={cn('flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center', config.bg)}>
                <Icon className={cn('h-5 w-5', config.color)} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn('font-medium truncate', item.is_unread ? 'text-white' : 'text-slate-300')}>
                        {item.title}
                    </span>
                    {item.is_unread && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500" />}
                </div>
                <p className="text-sm text-slate-400 truncate">{item.subtitle}</p>
            </div>

            <span className="text-xs text-slate-500 flex-shrink-0">{item.time}</span>
        </motion.button>
    );
};

// ================================================================
// INTERVIEW CARD
// ================================================================
const InterviewCardEnhanced = ({
    interview,
    onStart,
    onView,
}: {
    interview: InterviewScheduleView | UpcomingInterview;
    onStart?: () => void;
    onView?: () => void;
}) => {
    const statusColors: Record<string, { bg: string; text: string; label: string }> = {
        scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Scheduled' },
        confirmed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Confirmed' },
        in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'In Progress' },
        completed: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Completed' },
        cancelled: { bg: 'bg-rose-500/20', text: 'text-rose-300', label: 'Cancelled' },
        no_show: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'No Show' },
    };

    const status = statusColors[interview.status] || statusColors.scheduled;
    const canStart = 'can_start' in interview ? interview.can_start : false;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -2 }}
            className={cn(
                'p-5 rounded-xl border transition-all backdrop-blur-sm cursor-pointer',
                interview.is_today && canStart
                    ? 'bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border-indigo-500/30'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/30'
            )}
            onClick={onView}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Badge className={cn(status.bg, status.text, 'border-0')}>{status.label}</Badge>
                    {interview.is_today && (
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                            <Zap className="h-3 w-3 mr-1" />
                            Today
                        </Badge>
                    )}
                </div>
                <span className="text-xs text-slate-400">{interview.time_until}</span>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-400">
                        {interview.candidate_name.substring(0, 2).toUpperCase()}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white truncate">{interview.candidate_name}</h4>
                    <p className="text-sm text-slate-400 truncate">{interview.job_title}</p>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-300 mb-4">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <span>
                    {new Date(interview.scheduled_datetime).toLocaleString('en-IN', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{interview.duration_minutes} min</span>
            </div>

            <div className="flex items-center gap-2">
                {canStart && onStart && (
                    <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onStart();
                        }}
                    >
                        <Play className="h-4 w-4 mr-1.5" />
                        Start
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 hover:bg-slate-800"
                    onClick={(e) => {
                        e.stopPropagation();
                        onView?.();
                    }}
                >
                    Details
                </Button>
            </div>
        </motion.div>
    );
};

// ================================================================
// SECTION HEADER
// ================================================================
const SectionHeader = ({
    title,
    subtitle,
    action,
    actionLabel,
}: {
    title: string;
    subtitle?: string;
    action?: () => void;
    actionLabel?: string;
}) => {
    return (
        <div className="flex items-center justify-between mb-5">
            <div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {action && actionLabel && (
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={action}>
                    {actionLabel}
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            )}
        </div>
    );
};

// ================================================================
// EMPTY STATE
// ================================================================
const EmptyState = ({
    icon: Icon,
    title,
    message,
    actionLabel,
    onAction,
}: {
    icon: React.ElementType;
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-6 text-center"
        >
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4">
                <Icon className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-slate-400 max-w-sm mb-6">{message}</p>
            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {actionLabel}
                </Button>
            )}
        </motion.div>
    );
};

// ================================================================
// DASHBOARD CONTENT
// ================================================================
function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { token } = useAuth();

    const viewParam = searchParams.get('view') as DashboardView | null;
    const [activeView, setActiveView] = useState<DashboardView>(viewParam || 'home');

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [dashboardData, setDashboardData] = useState<EnhancedDashboardData | null>(null);
    const [interviewsData, setInterviewsData] = useState<InterviewsResponse | null>(null);
    const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);

    useEffect(() => {
        if (viewParam) {
            setActiveView(viewParam);
        } else {
            setActiveView('home');
        }
    }, [viewParam]);

    useEffect(() => {
        if (activeView === 'interviews' && token) {
            loadInterviews();
        }
    }, [activeView, token]);

    const loadInterviews = async () => {
        if (!token) return;
        setIsLoadingInterviews(true);
        try {
            const data = await dashboardApi.getAllInterviews(token);
            setInterviewsData(data);
        } catch (error) {
            console.error('Failed to load interviews:', error);
        } finally {
            setIsLoadingInterviews(false);
        }
    };

    const loadDashboard = async (showRefresh = false) => {
        if (!token) return;

        try {
            if (showRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const data = await dashboardApi.getEnhancedDashboard(token);
            setDashboardData(data);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            try {
                const legacyData = await dashboardApi.getDashboard(token);
                setDashboardData({
                    ...legacyData,
                    pipeline_stats: {
                        sourced: legacyData.metrics.total_candidates_analyzed,
                        enriched: 0,
                        outreach_sent: 0,
                        outreach_opened: 0,
                        outreach_clicked: 0,
                        responded: 0,
                        scheduled: 0,
                        interviewed: 0,
                        offered: 0,
                        hired: 0,
                    },
                    inbox_items: [],
                    upcoming_interviews: [],
                    recent_candidates: [],
                    donna_tip: undefined,
                });
            } catch (e) {
                console.error('Failed to load legacy dashboard:', e);
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [token]);

    const handleDeleteSearch = async (sessionId: string) => {
        if (!token || !confirm('Archive this role?')) return;
        try {
            await dashboardApi.deleteSearch(sessionId, token);
            loadDashboard(true);
        } catch (error) {
            console.error('Failed to delete search:', error);
        }
    };

    const navigateToView = (view: DashboardView) => {
        if (view === 'home') {
            router.push('/dashboard');
        } else {
            router.push(`/dashboard?view=${view}`);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        if (hour < 21) return 'Good evening';
        return 'Good night';
    };

    const metrics = dashboardData?.metrics;
    const pipelineStats = dashboardData?.pipeline_stats;
    const firstName = dashboardData?.user?.username?.split('@')[0] || 'there';
    const unreadResponses = dashboardData?.inbox_items?.filter((i) => i.type === 'response' && i.is_unread).length || 0;
    const todayInterviewCount = dashboardData?.upcoming_interviews?.filter((i) => i.is_today).length || 0;

    const recentRoles =
        dashboardData?.recent_searches?.map((s) => ({
            session_id: s.session_id,
            role_title: s.role_title,
            candidates_count: s.enriched_count,
            created_at: s.created_at,
        })) || [];

    if (isLoading) {
        return (
            <AppLayout recentRoles={[]} unreadCount={0} interviewCount={0}>
                <div className="min-h-screen relative flex flex-col items-center justify-center gap-4">
                    <AnimatedBackground />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Sparkles className="h-7 w-7 text-white animate-pulse" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-white">Loading your dashboard</p>
                            <p className="text-sm text-slate-400 mt-1">Just a moment...</p>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout recentRoles={recentRoles} unreadCount={unreadResponses} interviewCount={todayInterviewCount}>
            <div className="min-h-screen relative">
                <AnimatedBackground />

                <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
                                {getGreeting()}, {firstName}
                            </h1>
                            <p className="text-lg text-slate-400">
                                {activeView === 'home' && "Here's your hiring overview"}
                                {activeView === 'roles' && 'All your hiring projects'}
                                {activeView === 'responses' && 'Candidate messages'}
                                {activeView === 'interviews' && 'Your scheduled interviews'}
                            </p>
                        </motion.div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white"
                            onClick={() => loadDashboard(true)}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
                        </Button>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* HOME VIEW */}
                        {activeView === 'home' && (
                            <motion.div
                                key="home"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <StatCard
                                        label="Active Roles"
                                        value={metrics?.total_searches || 0}
                                        icon={Briefcase}
                                        color="purple"
                                        onClick={() => navigateToView('roles')}
                                    />
                                    <StatCard
                                        label="Candidates Found"
                                        value={metrics?.total_candidates_analyzed || 0}
                                        icon={Users}
                                        color="blue"
                                        onClick={() => router.push('/pipeline')}
                                    />
                                    <StatCard
                                        label="Awaiting Response"
                                        value={pipelineStats?.outreach_sent || 0}
                                        icon={Send}
                                        color="amber"
                                    />
                                    <StatCard
                                        label="Hired"
                                        value={pipelineStats?.hired || 0}
                                        icon={Award}
                                        color="green"
                                    />
                                </div>

                                {/* Today's Focus */}
                                {(todayInterviewCount > 0 || unreadResponses > 0) && (
                                    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 backdrop-blur-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                                                <Target className="h-5 w-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">Today's Focus</h3>
                                                <p className="text-sm text-slate-400">Items needing your attention</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {todayInterviewCount > 0 && (
                                                <FocusItem
                                                    icon={Phone}
                                                    title={`${todayInterviewCount} interview${todayInterviewCount > 1 ? 's' : ''} scheduled`}
                                                    subtitle={`Next: ${dashboardData?.upcoming_interviews?.[0]?.candidate_name || 'Unknown'}`}
                                                    onClick={() => navigateToView('interviews')}
                                                    urgent
                                                />
                                            )}
                                            {unreadResponses > 0 && (
                                                <FocusItem
                                                    icon={MessageSquare}
                                                    title={`${unreadResponses} new response${unreadResponses > 1 ? 's' : ''}`}
                                                    subtitle="Candidates are waiting for your reply"
                                                    badge="New"
                                                    onClick={() => navigateToView('responses')}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Quick Actions */}
                                <section>
                                    <SectionHeader title="Quick Actions" />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <ActionCard
                                            icon={Search}
                                            title="Find Talent"
                                            description="Start a new search to discover candidates"
                                            onClick={() => router.push('/search')}
                                            variant="primary"
                                        />
                                        <ActionCard
                                            icon={Users}
                                            title="Import Candidates"
                                            description="Add candidates you've already found"
                                            onClick={() => router.push('/search?mode=manual')}
                                        />
                                        <ActionCard
                                            icon={FileText}
                                            title="Analyze Profile"
                                            description="Get detailed insights on any candidate"
                                            onClick={() => router.push('/deep-dive')}
                                        />
                                    </div>
                                </section>

                                {/* Pipeline Overview */}
                                {pipelineStats && (
                                    <PipelineStageBar
                                        stats={pipelineStats}
                                        onStageClick={(stage) => router.push(`/pipeline?stage=${stage}`)}
                                    />
                                )}

                                {/* Recent Roles */}
                                <section>
                                    <SectionHeader
                                        title="Recent Roles"
                                        subtitle="Your active hiring projects"
                                        action={() => navigateToView('roles')}
                                        actionLabel="View all"
                                    />
                                    {dashboardData?.recent_searches && dashboardData.recent_searches.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {dashboardData.recent_searches.slice(0, 4).map((role) => (
                                                <RoleCard
                                                    key={role.session_id}
                                                    role={role}
                                                    onView={() => router.push(`/results/${role.session_id}`)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState
                                            icon={Briefcase}
                                            title="No roles yet"
                                            message="Start your first search to begin finding candidates"
                                            actionLabel="Start Searching"
                                            onAction={() => router.push('/search')}
                                        />
                                    )}
                                </section>
                            </motion.div>
                        )}

                        {/* ROLES VIEW */}
                        {activeView === 'roles' && (
                            <motion.div
                                key="roles"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <SectionHeader title="All Roles" subtitle="Every hiring project you've started" />
                                {dashboardData?.recent_searches && dashboardData.recent_searches.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {dashboardData.recent_searches.map((role) => (
                                            <RoleCard
                                                key={role.session_id}
                                                role={role}
                                                onView={() => router.push(`/results/${role.session_id}`)}
                                                onDelete={() => handleDeleteSearch(role.session_id)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={Briefcase}
                                        title="No roles yet"
                                        message="Start your first search to begin finding candidates"
                                        actionLabel="Start Searching"
                                        onAction={() => router.push('/search')}
                                    />
                                )}
                            </motion.div>
                        )}

                        {/* RESPONSES VIEW */}
                        {activeView === 'responses' && (
                            <motion.div
                                key="responses"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <SectionHeader title="Responses" subtitle="Messages from candidates" />
                                {dashboardData?.inbox_items && dashboardData.inbox_items.length > 0 ? (
                                    <div className="rounded-2xl bg-slate-800/20 border border-slate-700/50 divide-y divide-slate-700/30 overflow-hidden">
                                        {dashboardData.inbox_items.map((item) => (
                                            <ResponseItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={Inbox}
                                        title="No responses yet"
                                        message="When candidates reply to your outreach, they'll appear here"
                                    />
                                )}
                            </motion.div>
                        )}

                        {/* INTERVIEWS VIEW */}
                        {activeView === 'interviews' && (
                            <motion.div
                                key="interviews"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                {isLoadingInterviews ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                                    </div>
                                ) : interviewsData ? (
                                    <>
                                        {/* Stats */}
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <StatCard label="Today" value={interviewsData.stats.today_count} icon={Zap} color="amber" />
                                            <StatCard label="Upcoming" value={interviewsData.stats.upcoming_count} icon={Calendar} color="blue" />
                                            <StatCard label="Completed" value={interviewsData.stats.total_completed} icon={CheckCircle2} color="green" />
                                            <StatCard label="Cancelled" value={interviewsData.stats.total_cancelled} icon={X} />
                                            <StatCard label="Completion" value={`${interviewsData.stats.completion_rate}%`} icon={TrendingUp} color="purple" />
                                        </div>

                                        {/* Today */}
                                        {interviewsData.today.length > 0 && (
                                            <section>
                                                <SectionHeader title="Today" subtitle={`${interviewsData.today.length} scheduled`} />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {interviewsData.today.map((interview) => (
                                                        <InterviewCardEnhanced
                                                            key={interview.schedule_id}
                                                            interview={interview}
                                                            onStart={() => {
                                                                if (interview.interview_session_id) {
                                                                    router.push(`/interview/${interview.interview_session_id}`);
                                                                }
                                                            }}
                                                            onView={() =>
                                                                router.push(`/pipeline/${interview.pipeline_id.replace('pipe-', '')}/${interview.pipeline_id}`)
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {/* Upcoming */}
                                        {interviewsData.upcoming.length > 0 && (
                                            <section>
                                                <SectionHeader title="Upcoming" subtitle="Next 14 days" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {interviewsData.upcoming.map((interview) => (
                                                        <InterviewCardEnhanced
                                                            key={interview.schedule_id}
                                                            interview={interview}
                                                            onView={() =>
                                                                router.push(`/pipeline/${interview.pipeline_id.replace('pipe-', '')}/${interview.pipeline_id}`)
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {/* Completed */}
                                        {interviewsData.completed.length > 0 && (
                                            <section>
                                                <SectionHeader title="Completed" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {interviewsData.completed.slice(0, 6).map((interview) => (
                                                        <InterviewCardEnhanced
                                                            key={interview.schedule_id}
                                                            interview={interview}
                                                            onView={() =>
                                                                router.push(`/pipeline/${interview.pipeline_id.replace('pipe-', '')}/${interview.pipeline_id}`)
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {/* Empty */}
                                        {interviewsData.today.length === 0 &&
                                            interviewsData.upcoming.length === 0 &&
                                            interviewsData.completed.length === 0 && (
                                                <EmptyState
                                                    icon={Calendar}
                                                    title="No interviews yet"
                                                    message="When candidates book interviews, they'll appear here"
                                                />
                                            )}
                                    </>
                                ) : (
                                    <EmptyState
                                        icon={Calendar}
                                        title="No interviews scheduled"
                                        message="Start reaching out to candidates to schedule interviews"
                                    />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </AppLayout>
    );
}

// ================================================================
// MAIN EXPORT WITH SUSPENSE
// ================================================================
export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                </div>
            }
        >
            <DashboardContent />
        </Suspense>
    );
}