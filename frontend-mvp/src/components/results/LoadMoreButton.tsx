import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, ChevronDown, Sparkles } from 'lucide-react';

interface LoadMoreButtonProps {
    onLoadMore: () => void;
    isLoading: boolean;
    remaining: number;
}

export default function LoadMoreButton({
    onLoadMore,
    isLoading,
    remaining
}: LoadMoreButtonProps) {
    return (
        <div className="flex flex-col items-center gap-4 py-8">
            {/* Progress Info */}
            <div className="text-center">
                <p className="text-gray-600">
                    <span className="font-semibold text-gray-900">{remaining}</span> more candidates available
                </p>
                <p className="text-sm text-gray-500 mt-1">
                    AI summaries generated on demand
                </p>
            </div>

            {/* Load More Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onLoadMore}
                disabled={isLoading}
                className={`
          relative px-8 py-4 rounded-xl font-semibold text-white
          bg-gradient-to-r from-blue-600 to-purple-600
          hover:from-blue-700 hover:to-purple-700
          disabled:from-gray-400 disabled:to-gray-500
          transition-all shadow-lg hover:shadow-xl
          flex items-center gap-3
        `}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating AI Summaries...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        Load More Results
                        <ChevronDown className="w-5 h-5" />
                    </>
                )}

                {/* Animated Background */}
                {!isLoading && (
                    <motion.div
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-400 to-purple-400 opacity-0"
                        whileHover={{ opacity: 0.2 }}
                        transition={{ duration: 0.3 }}
                    />
                )}
            </motion.button>

            {/* Loading Animation */}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-3"
                >
                    <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.5, 1, 0.5],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2,
                                }}
                                className="w-3 h-3 bg-blue-600 rounded-full"
                            />
                        ))}
                    </div>
                    <p className="text-sm text-gray-600">
                        Analyzing next batch of candidates...
                    </p>
                </motion.div>
            )}
        </div>
    );
}