"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, Search, Zap, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
    icon: React.ReactNode;
    label: string;
    description: string;
}

const steps: TimelineStep[] = [
    {
        icon: <Sparkles className="w-5 h-5" />,
        label: "Define Requirements",
        description: "Conversational AI learns your ideal candidate profile",
    },
    {
        icon: <Search className="w-5 h-5" />,
        label: "Smart Search",
        description: "Search 56M+ profiles with intelligent matching algorithms",
    },
    {
        icon: <Zap className="w-5 h-5" />,
        label: "AI Enrichment",
        description: "Auto-validate skills, estimate salary & check availability",
    },
    {
        icon: <UserCheck className="w-5 h-5" />,
        label: "Connect & Hire",
        description: "Reach passive candidates with enriched contact data",
    },
];

export default function HiringTimeline() {
    return (
        <div className="relative w-full">
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-primary/0 via-primary/50 to-primary/0" />

            <div className="space-y-6">
                {steps.map((step, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.15, duration: 0.5 }}
                        className="relative flex gap-4 group"
                    >
                        {/* Icon Circle */}
                        <div className="relative z-10 flex-shrink-0">
                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                    "bg-card border border-border",
                                    "group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-primary/20",
                                    "transition-all duration-300"
                                )}
                            >
                                <div className="text-primary group-hover:scale-110 transition-transform">
                                    {step.icon}
                                </div>
                            </motion.div>
                        </div>

                        {/* Content Card */}
                        <motion.div
                            whileHover={{ y: -2 }}
                            className={cn(
                                "flex-1 p-4 rounded-lg",
                                "bg-card/50 backdrop-blur-sm border border-border/50",
                                "group-hover:border-primary/30 group-hover:bg-card/80",
                                "transition-all duration-300"
                            )}
                        >
                            <h4 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                                {step.label}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.15 + 0.3 }}
                                >
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                </motion.div>
                            </h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}