
'use client';

import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface SchedulingErrorProps {
    message: string;
    onRetry?: () => void;
}

export function SchedulingError({ message, onRetry }: SchedulingErrorProps) {
    return (
        <div className="max-w-md mx-auto text-center py-12">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center"
            >
                <AlertCircle className="w-10 h-10 text-red-400" />
            </motion.div>

            <h2 className="text-xl font-semibold text-white mb-3">
                Unable to Load Scheduling
            </h2>

            <p className="text-[15px] text-white/60 mb-8">
                {message}
            </p>

            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-5 py-2.5 bg-white/[0.08] border border-white/[0.1] text-white text-[14px] font-medium rounded-xl hover:bg-white/[0.12] transition-colors inline-flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            )}

            <div className="mt-8 pt-8 border-t border-white/[0.08]">
                <p className="text-[13px] text-white/40">
                    If this problem persists, please contact the recruiter directly.
                </p>
            </div>
        </div>
    );
}