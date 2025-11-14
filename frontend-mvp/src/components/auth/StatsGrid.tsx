"use client";

import React from "react";
import { motion } from "framer-motion";
import { Users, Zap, Brain } from "lucide-react";

const stats = [
    {
        icon: <Users className="w-6 h-6" />,
        value: "56M+",
        label: "Profiles",
    },
    {
        icon: <Zap className="w-6 h-6" />,
        value: "10x",
        label: "Faster",
    },
    {
        icon: <Brain className="w-6 h-6" />,
        value: "AI",
        label: "Powered",
    },
];

export default function StatsGrid() {
    return (
        <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="relative group"
                >
                    <div className="absolute inset-0 bg-primary/10 rounded-lg blur-xl group-hover:bg-primary/20 transition-all duration-300" />
                    <div className="relative p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50 group-hover:border-primary/30 transition-all duration-300">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-2 text-primary group-hover:scale-110 transition-transform">
                                {stat.icon}
                            </div>
                            <div className="text-2xl font-bold text-foreground mb-1">
                                {stat.value}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {stat.label}
                            </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}