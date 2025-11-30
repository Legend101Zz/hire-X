"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles, CheckCircle, Search, Database, Globe } from "lucide-react";

interface EnrichmentOverlayProps {
    progress: {
        completed: number;
        total: number;
        status: string;
    };
}

export default function EnrichmentOverlay({ progress }: EnrichmentOverlayProps) {
    const [loadingText, setLoadingText] = useState("Initializing search...");

    const percentage = progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0;

    // Cycle through "techy" status messages while waiting
    useEffect(() => {
        const messages = [
            "Verifying professional footprints...",
            "Analyzing GitHub repositories...",
            "Cross-referencing salary data...",
            "Validating skill evidence...",
            "Checking digital presence..."
        ];

        let i = 0;
        const interval = setInterval(() => {
            setLoadingText(messages[i % messages.length]);
            i++;
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden"
        >
            {/* Background Grid Animation */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
            </div>

            {/* Central Content */}
            <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6">

                {/* Donna Placeholder (She will be positioned here by the parent component, 
                    but we create a glowing aura here) */}
                <motion.div
                    className="w-48 h-48 rounded-full bg-amber-500/10 blur-3xl absolute -top-10 left-1/2 -translate-x-1/2"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity }}
                />

                {/* Spacing for Donna */}
                <div className="h-32" />

                {/* Progress Stats */}
                <motion.h2
                    key={loadingText}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-white mb-2 text-center"
                >
                    {percentage === 100 ? "Finalizing Results..." : loadingText}
                </motion.h2>

                <p className="text-slate-400 mb-8 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Enriching Candidate {progress.completed} of {progress.total}
                </p>

                {/* Progress Bar */}
                <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
                    <motion.div
                        className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-amber-500 to-orange-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ type: "spring", stiffness: 50 }}
                    />
                    {/* Scanning Line Effect on Bar */}
                    <motion.div
                        className="absolute top-0 bottom-0 w-20 bg-white/20 blur-md"
                        animate={{ x: [-100, 500] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                </div>

                <div className="flex justify-between w-full mt-2 text-xs text-slate-500 font-mono">
                    <span>0%</span>
                    <span>{percentage}%</span>
                    <span>100%</span>
                </div>

                {/* Floating Icons Animation */}
                <div className="absolute inset-0 -z-10 pointer-events-none">
                    {[Search, Database, Globe, CheckCircle].map((Icon, i) => (
                        <motion.div
                            key={i}
                            className="absolute text-slate-700/30"
                            initial={{
                                x: Math.random() * 400 - 200,
                                y: Math.random() * 400 - 200,
                                scale: 0,
                                opacity: 0
                            }}
                            animate={{
                                y: [0, -100],
                                opacity: [0, 1, 0],
                                scale: [0.5, 1, 0.5]
                            }}
                            transition={{
                                duration: 3 + Math.random() * 2,
                                repeat: Infinity,
                                delay: i * 0.5
                            }}
                            style={{ left: '50%', top: '50%' }}
                        >
                            <Icon size={24 + Math.random() * 24} />
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}