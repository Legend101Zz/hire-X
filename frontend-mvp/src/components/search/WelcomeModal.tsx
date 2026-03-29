/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeModalProps {
    onClose: () => void;
    onSelectMode: (mode: 'donna' | 'manual') => void;
}

export function WelcomeModal({ onClose, onSelectMode }: WelcomeModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Content */}
                <div className="p-8 pt-12">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
                        >
                            <Sparkles className="w-8 h-8 text-primary" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Welcome to Hire-X 🎉
                        </h2>
                        <p className="text-muted-foreground">
                            Two ways to find great talent — pick what fits your situation.
                        </p>
                    </div>

                    {/* Options */}
                    <div className="space-y-4 mb-8">
                        {/* Donna Option */}
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            onClick={() => {
                                onSelectMode('donna');
                                onClose();
                            }}
                            className="w-full p-4 rounded-xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                    <MessageSquare className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground mb-1">
                                        Chat with Donna
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Describe who you need. Donna will find, enrich, and help you reach out to the best matches.
                                    </p>
                                    <span className="inline-block mt-2 text-xs text-primary font-medium">
                                        Best for: New roles, fresh searches
                                    </span>
                                </div>
                            </div>
                        </motion.button>

                        {/* Manual Option */}
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                            onClick={() => {
                                onSelectMode('manual');
                                onClose();
                            }}
                            className="w-full p-4 rounded-xl border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                    <Upload className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground mb-1">
                                        Manual Import
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Already have candidates in mind? Add their LinkedIn profiles and we'll enrich their details.
                                    </p>
                                    <span className="inline-block mt-2 text-xs text-primary font-medium">
                                        Best for: Referrals, inbound applicants
                                    </span>
                                </div>
                            </div>
                        </motion.button>
                    </div>

                    {/* Footer hint */}
                    <p className="text-center text-sm text-muted-foreground">
                        Not sure where to start?{' '}
                        <button
                            onClick={() => {
                                onSelectMode('donna');
                                onClose();
                            }}
                            className="text-primary hover:underline font-medium"
                        >
                            Try Donna — she's friendly.
                        </button>
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Hook to manage first-time visit
export function useFirstTimeVisit(key: string = 'Hire-X_welcomed') {
    const [isFirstVisit, setIsFirstVisit] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const hasVisited = localStorage.getItem(key);
        if (!hasVisited) {
            setIsFirstVisit(true);
        }
        setIsLoading(false);
    }, [key]);

    const markAsVisited = () => {
        localStorage.setItem(key, 'true');
        setIsFirstVisit(false);
    };

    return { isFirstVisit, isLoading, markAsVisited };
}