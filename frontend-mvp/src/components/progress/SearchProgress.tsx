/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    CheckCircle2,
    Brain,
    Database,
    Sparkles,
    AlertTriangle,
    XCircle
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
    completed: "Search completed!",
    needs_refinement: "Refinement needed",
    error: "An error occurred",
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

    useEffect(() => {
        // Poll for progress updates
        const pollInterval = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/status`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    }
                );

                if (response.ok) {
                    const update = await response.json();
                    setProgress(update);

                    // Handle different statuses
                    if (update.status === 'completed') {
                        clearInterval(pollInterval);

                        // Fetch results
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
                            onComplete(results);
                        }
                    } else if (update.status === 'needs_refinement') {
                        clearInterval(pollInterval);
                        onNeedsRefinement(update.data);
                    } else if (update.status === 'error') {
                        clearInterval(pollInterval);
                        onError(update.message);
                    }
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        }, 1000); // Poll every second

        return () => clearInterval(pollInterval);
    }, [sessionId, onComplete, onNeedsRefinement, onError]);

    const Icon = statusIcons[progress.status as keyof typeof statusIcons] || Search;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
            >
                {/* Animated Icon */}
                <div className="flex justify-center mb-6">
                    <motion.div
                        animate={progress.status !== 'completed' ? {
                            rotate: [0, 360],
                            scale: [1, 1.1, 1],
                        } : {}}
                        transition={{
                            duration: 2,
                            repeat: progress.status !== 'completed' ? Infinity : 0,
                            ease: "easeInOut",
                        }}
                        className={`p-4 rounded-full ${progress.status === 'completed'
                            ? 'bg-green-100'
                            : progress.status === 'error'
                                ? 'bg-red-100'
                                : 'bg-blue-100'
                            }`}
                    >
                        <Icon
                            className={`w-12 h-12 ${progress.status === 'completed'
                                ? 'text-green-600'
                                : progress.status === 'error'
                                    ? 'text-red-600'
                                    : 'text-blue-600'
                                }`}
                        />
                    </motion.div>
                </div>

                {/* Status Message */}
                <h3 className="text-2xl font-bold text-center mb-2">
                    {statusMessages[progress.status as keyof typeof statusMessages] || progress.status}
                </h3>

                <p className="text-gray-600 text-center mb-6">
                    {progress.message}
                </p>

                {/* Progress Bar */}
                <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.progress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`absolute inset-y-0 left-0 rounded-full ${progress.status === 'completed'
                            ? 'bg-green-500'
                            : progress.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                    />

                    {/* Animated shimmer effect */}
                    {progress.status !== 'completed' && progress.status !== 'error' && (
                        <motion.div
                            animate={{ x: ['0%', '200%'] }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        />
                    )}
                </div>

                {/* Progress Percentage */}
                <div className="text-center text-sm text-gray-500">
                    {progress.progress}%
                </div>

                {/* Stage Indicators */}
                <div className="mt-6 flex justify-between text-xs">
                    {['parsing', 'preflight', 'searching', 'scoring', 'ai_ranking'].map((stage) => (
                        <div
                            key={stage}
                            className={`flex flex-col items-center ${progress.status === stage
                                ? 'text-blue-600'
                                : progress.progress > ['parsing', 'preflight', 'searching', 'scoring', 'ai_ranking'].indexOf(stage) * 20
                                    ? 'text-green-600'
                                    : 'text-gray-400'
                                }`}
                        >
                            <div
                                className={`w-2 h-2 rounded-full mb-1 ${progress.status === stage
                                    ? 'bg-blue-600'
                                    : progress.progress > ['parsing', 'preflight', 'searching', 'scoring', 'ai_ranking'].indexOf(stage) * 20
                                        ? 'bg-green-600'
                                        : 'bg-gray-300'
                                    }`}
                            />
                            <span className="capitalize hidden sm:block">
                                {stage === 'ai_ranking' ? 'AI' : stage}
                            </span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}