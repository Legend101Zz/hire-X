'use client';

import { motion, AnimatePresence } from 'framer-motion';
import ProgressBar from './ProgressBar';
import { X, Minimize2 } from 'lucide-react';

interface ProgressModalProps {
    isOpen: boolean;
    progress: number;
    status: string;
    message: string;
    onMinimize?: () => void;
    canMinimize?: boolean;
}

export default function ProgressModal({
    isOpen,
    progress,
    status,
    message,
    onMinimize,
    canMinimize = false
}: ProgressModalProps) {
    const isComplete = status === 'completed';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        {isComplete ? '🎉 Search Complete!' : '🔍 Searching...'}
                                    </h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {isComplete
                                            ? 'Your results are ready!'
                                            : 'Finding and enriching candidates from 56M profiles'}
                                    </p>
                                </div>

                                {/* Minimize Button */}
                                {canMinimize && !isComplete && onMinimize && (
                                    <button
                                        onClick={onMinimize}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
                                        title="Minimize"
                                    >
                                        <Minimize2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-8">
                            <ProgressBar progress={progress} status={status} message={message} />

                            {/* Additional Info */}
                            {!isComplete && (
                                <div className="mt-6 space-y-3">
                                    {/* What's happening */}
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm text-blue-900">
                                            <span className="font-semibold">What's happening:</span>
                                        </p>
                                        <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                                            <li>Searching our database of 56 million profiles</li>
                                            <li>Scoring candidates based on your requirements</li>
                                            <li>Enriching top 50 with detailed salary, skills & availability data</li>
                                        </ul>
                                    </div>

                                    {/* Fun fact */}
                                    <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                                        <p className="text-sm text-violet-900">
                                            <span className="font-semibold">💡 Did you know?</span> Our AI analyzes
                                            candidate profiles across multiple dimensions including career progression,
                                            skill validation, and response likelihood to find you the best matches!
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Completion Message */}
                            {isComplete && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg text-center"
                                >
                                    <p className="text-lg font-semibold text-green-900 mb-2">
                                        ✨ Found Your Top Matches!
                                    </p>
                                    <p className="text-sm text-green-700">
                                        We've enriched each candidate with salary insights, skill validation, and
                                        response likelihood. Ready to review!
                                    </p>
                                </motion.div>
                            )}
                        </div>

                        {/* Footer */}
                        {!isComplete && canMinimize && onMinimize && (
                            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
                                <button
                                    onClick={onMinimize}
                                    className="w-full px-4 py-2 text-sm font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
                                >
                                    Continue in background
                                </button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}