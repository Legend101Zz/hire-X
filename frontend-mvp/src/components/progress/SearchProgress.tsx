/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    CheckCircle2,
    Brain,
    Database,
    Sparkles,
    AlertTriangle,
    XCircle,
    Lightbulb,
    TrendingUp,
    Users,
    Clock,
    Target,
    Zap
} from 'lucide-react';

interface ProgressUpdate {
    status: string;
    message: string;
    progress: number;
    data?: any;
    timestamp: string;
}

interface SearchProgressProps {
    sessionId: string;
    onComplete: (results: any) => void;
    onNeedsRefinement: (preflightResults: any) => void;
    onError: (error: string) => void;
}

const statusIcons = {
    parsing: Brain,
    preflight: Search,
    searching: Database,
    scoring: Sparkles,
    ai_ranking: Brain,
    saving: Database,
    completed: CheckCircle2,
    needs_refinement: AlertTriangle,
    error: XCircle,
};

const statusMessages = {
    parsing: "Analyzing your requirements...",
    preflight: "Checking data availability...",
    searching: "Searching candidate database...",
    scoring: "Scoring candidates...",
    ai_ranking: "AI analyzing top candidates...",
    saving: "Saving results...",
    completed: "Search completed!",
    needs_refinement: "Refinement needed",
    error: "An error occurred",
};

// Engaging HR facts and tips
const HR_FACTS = [
    {
        icon: Clock,
        text: "The average recruiter spends only 6-7 seconds reviewing a resume initially",
        color: "blue"
    },
    {
        icon: Users,
        text: "Companies with strong onboarding see 82% higher retention rates",
        color: "purple"
    },
    {
        icon: TrendingUp,
        text: "68% of recruiting professionals say that investing in new recruiting technology is the best way to improve performance",
        color: "green"
    },
    {
        icon: Target,
        text: "Quality of hire is the #1 metric for measuring recruiting success",
        color: "orange"
    },
    {
        icon: Lightbulb,
        text: "Employee referrals account for 30-50% of all hires at top companies",
        color: "pink"
    },
    {
        icon: Zap,
        text: "The best candidates are off the market in just 10 days",
        color: "cyan"
    },
    {
        icon: Users,
        text: "59% of candidates say a company's culture is more important than salary",
        color: "indigo"
    },
    {
        icon: TrendingUp,
        text: "AI-powered recruiting can reduce time-to-hire by up to 40%",
        color: "emerald"
    },
    {
        icon: Clock,
        text: "On average, it takes 42 days to fill a position",
        color: "rose"
    },
    {
        icon: Sparkles,
        text: "Diverse teams are 35% more likely to outperform their competitors",
        color: "violet"
    }
];

const colorSchemes = {
    blue: "from-blue-500 to-cyan-500",
    purple: "from-purple-500 to-pink-500",
    green: "from-green-500 to-emerald-500",
    orange: "from-orange-500 to-amber-500",
    pink: "from-pink-500 to-rose-500",
    cyan: "from-cyan-500 to-blue-500",
    indigo: "from-indigo-500 to-purple-500",
    emerald: "from-emerald-500 to-teal-500",
    rose: "from-rose-500 to-pink-500",
    violet: "from-violet-500 to-purple-500"
};

export default function SearchProgress({
    sessionId,
    onComplete,
    onNeedsRefinement,
    onError
}: SearchProgressProps) {
    const [progress, setProgress] = useState<ProgressUpdate>({
        status: 'parsing',
        message: 'Starting search...',
        progress: 0,
        timestamp: new Date().toISOString(),
    });
    const [currentFactIndex, setCurrentFactIndex] = useState(0);
    const [showFact, setShowFact] = useState(true);

    const wsRef = useRef<WebSocket | null>(null);
    const handlersCalledRef = useRef({
        completed: false,
        refinement: false,
        error: false
    });

    // Rotate facts every 5 seconds
    useEffect(() => {
        const factInterval = setInterval(() => {
            setShowFact(false);
            setTimeout(() => {
                setCurrentFactIndex((prev) => (prev + 1) % HR_FACTS.length);
                setShowFact(true);
            }, 300);
        }, 5000);

        return () => clearInterval(factInterval);
    }, []);

    // Memoize callbacks
    const handleCompleteCallback = useCallback(onComplete, [onComplete]);
    const handleNeedsRefinementCallback = useCallback(onNeedsRefinement, [onNeedsRefinement]);
    const handleErrorCallback = useCallback(onError, [onError]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000'}/session/${sessionId}?token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('🔌 WebSocket connected for session:', sessionId);
        };

        ws.onmessage = async (event) => {
            try {
                const update = JSON.parse(event.data);
                console.log('📨 Progress update:', update);

                if (update.action === 'progress_update' && update.data) {
                    // Immediate update with React state
                    setProgress(prevProgress => {
                        // Only update if new progress is different
                        if (prevProgress.progress !== update.data.progress ||
                            prevProgress.status !== update.data.status) {
                            return update.data;
                        }
                        return prevProgress;
                    });

                    // Handle completion
                    if (update.data.status === 'completed' && !handlersCalledRef.current.completed) {
                        handlersCalledRef.current.completed = true;

                        setTimeout(async () => {
                            try {
                                const token = localStorage.getItem('token');
                                const resultsResponse = await fetch(
                                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/results`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                        },
                                    }
                                );

                                if (resultsResponse.ok) {
                                    const results = await resultsResponse.json();
                                    handleCompleteCallback(results);
                                }
                            } catch (error) {
                                console.error('Error fetching results:', error);
                            }
                        }, 800);
                    }
                    else if (update.data.status === 'needs_refinement' && !handlersCalledRef.current.refinement) {
                        handlersCalledRef.current.refinement = true;
                        handleNeedsRefinementCallback(update.data.data);
                    }
                    else if (update.data.status === 'error' && !handlersCalledRef.current.error) {
                        handlersCalledRef.current.error = true;
                        handleErrorCallback(update.data.message);
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [sessionId, handleCompleteCallback, handleNeedsRefinementCallback, handleErrorCallback]);

    const Icon = statusIcons[progress.status as keyof typeof statusIcons] || Search;
    const currentFact = HR_FACTS[currentFactIndex];
    const FactIcon = currentFact.icon;
    const gradientColor = colorSchemes[currentFact.color as keyof typeof colorSchemes];

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center z-50 p-4">
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white rounded-full opacity-20"
                        animate={{
                            x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
                            y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
                        }}
                        transition={{
                            duration: 15 + Math.random() * 10,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        style={{
                            left: Math.random() * 100 + '%',
                            top: Math.random() * 100 + '%',
                        }}
                    />
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative bg-white rounded-3xl shadow-2xl p-8 md:p-10 max-w-2xl w-full"
            >
                {/* Animated Icon */}
                <div className="flex justify-center mb-6">
                    <motion.div
                        animate={progress.status !== 'completed' && progress.status !== 'error' ? {
                            rotate: [0, 360],
                            scale: [1, 1.15, 1],
                        } : progress.status === 'completed' ? {
                            scale: [1, 1.2, 1],
                        } : {}}
                        transition={{
                            duration: 2,
                            repeat: progress.status !== 'completed' && progress.status !== 'error' ? Infinity : 0,
                            ease: "easeInOut",
                        }}
                        className={`relative p-6 rounded-full ${progress.status === 'completed'
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                            : progress.status === 'error'
                                ? 'bg-gradient-to-br from-red-400 to-rose-500'
                                : 'bg-gradient-to-br from-blue-500 to-purple-600'
                            } shadow-lg`}
                    >
                        <Icon className="w-14 h-14 text-white" />

                        {/* Pulse ring animation */}
                        {progress.status !== 'completed' && progress.status !== 'error' && (
                            <>
                                <motion.div
                                    className="absolute inset-0 rounded-full border-4 border-blue-400"
                                    animate={{
                                        scale: [1, 1.5],
                                        opacity: [0.5, 0],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeOut",
                                    }}
                                />
                                <motion.div
                                    className="absolute inset-0 rounded-full border-4 border-purple-400"
                                    animate={{
                                        scale: [1, 1.5],
                                        opacity: [0.5, 0],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeOut",
                                        delay: 1,
                                    }}
                                />
                            </>
                        )}
                    </motion.div>
                </div>

                {/* Status Message */}
                <motion.h3
                    key={progress.status}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
                >
                    {statusMessages[progress.status as keyof typeof statusMessages] || progress.status}
                </motion.h3>

                <motion.p
                    key={progress.message}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-gray-600 text-center mb-8 text-lg"
                >
                    {progress.message}
                </motion.p>

                {/* Progress Bar */}
                <div className="relative mb-6">
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.progress}%` }}
                            transition={{
                                duration: 0.5,
                                ease: "easeOut"
                            }}
                            className={`h-full rounded-full relative ${progress.status === 'completed'
                                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                                : progress.status === 'error'
                                    ? 'bg-gradient-to-r from-red-400 to-rose-500'
                                    : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'
                                }`}
                        >
                            {/* Shimmer effect */}
                            {progress.status !== 'completed' && progress.status !== 'error' && (
                                <motion.div
                                    animate={{ x: ['-100%', '200%'] }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "linear",
                                    }}
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                />
                            )}
                        </motion.div>
                    </div>

                    {/* Progress percentage */}
                    <motion.div
                        key={progress.progress}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2"
                    >
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {progress.progress}%
                        </span>
                    </motion.div>
                </div>

                {/* Stage Indicators */}
                <div className="flex justify-between mb-8 px-2">
                    {['parsing', 'preflight', 'searching', 'scoring', 'ai_ranking'].map((stage, idx) => {
                        const stageProgress = (idx + 1) * 20;
                        const isActive = progress.status === stage;
                        const isCompleted = progress.progress > stageProgress;

                        return (
                            <motion.div
                                key={stage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex flex-col items-center"
                            >
                                <motion.div
                                    animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                                    transition={{ duration: 1, repeat: Infinity }}
                                    className={`w-3 h-3 rounded-full mb-2 ${isActive
                                        ? 'bg-blue-600 ring-4 ring-blue-200'
                                        : isCompleted
                                            ? 'bg-green-500'
                                            : 'bg-gray-300'
                                        }`}
                                />
                                <span className={`text-xs font-medium capitalize hidden sm:block ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                                    }`}>
                                    {stage === 'ai_ranking' ? 'AI' : stage.split('_')[0]}
                                </span>
                            </motion.div>
                        );
                    })}
                </div>

                {/* HR Facts Section */}
                {progress.status !== 'completed' && progress.status !== 'error' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-6 p-6 rounded-2xl bg-gradient-to-r ${gradientColor} relative overflow-hidden`}
                    >
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />

                        <div className="relative">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                    <Lightbulb className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-white font-bold text-sm uppercase tracking-wide">
                                    Did You Know?
                                </span>
                            </div>

                            <AnimatePresence mode="wait">
                                {showFact && (
                                    <motion.div
                                        key={currentFactIndex}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="flex items-start gap-3"
                                    >
                                        <FactIcon className="w-6 h-6 text-white/90 flex-shrink-0 mt-1" />
                                        <p className="text-white text-sm md:text-base leading-relaxed font-medium">
                                            {currentFact.text}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}

                {/* Completion Message */}
                {progress.status === 'completed' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200"
                    >
                        <div className="flex items-center gap-3 justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                            <p className="text-green-800 font-semibold text-lg">
                                Your results are ready! Redirecting...
                            </p>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}