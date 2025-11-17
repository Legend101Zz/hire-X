"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, CheckCircle2, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type AgentStatus = "pending" | "running" | "completed" | "error";

export interface AgentStep {
    agent: string;
    task: string;
    status: AgentStatus;
    output?: string;
    icon?: "brain" | "search" | "check";
    timestamp?: Date;
}

interface AgentProgressProps {
    steps: AgentStep[];
    isActive: boolean;
    onClose?: () => void;
}

const AgentIcon = ({ icon, status }: { icon?: string; status: AgentStatus }) => {
    if (status === "running") {
        return (
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
                <Loader2 className="w-5 h-5 text-blue-500" />
            </motion.div>
        );
    }

    if (status === "completed") {
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }

    if (status === "error") {
        return <AlertCircle className="w-5 h-5 text-red-500" />;
    }

    // Pending state
    switch (icon) {
        case "brain":
            return <Brain className="w-5 h-5 text-gray-400" />;
        case "search":
            return <Search className="w-5 h-5 text-gray-400" />;
        case "check":
            return <CheckCircle2 className="w-5 h-5 text-gray-400" />;
        default:
            return <Sparkles className="w-5 h-5 text-gray-400" />;
    }
};

const getStatusColor = (status: AgentStatus) => {
    switch (status) {
        case "completed":
            return "border-green-500 bg-green-500/10";
        case "running":
            return "border-blue-500 bg-blue-500/10";
        case "error":
            return "border-red-500 bg-red-500/10";
        default:
            return "border-gray-700 bg-gray-800/40";
    }
};

const getStatusBadge = (status: AgentStatus) => {
    switch (status) {
        case "completed":
            return "bg-green-500/20 text-green-400 border-green-500/30";
        case "running":
            return "bg-blue-500/20 text-blue-400 border-blue-500/30";
        case "error":
            return "bg-red-500/20 text-red-400 border-red-500/30";
        default:
            return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
};

export default function AgentProgress({ steps, isActive, onClose }: AgentProgressProps) {
    if (!isActive) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 z-50 w-[420px]"
        >
            <Card className="shadow-2xl border-slate-700/50 backdrop-blur-xl bg-slate-900/95">
                <CardContent className="p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                    opacity: [1, 0.7, 1],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"
                            >
                                <Brain className="w-5 h-5 text-white" />
                            </motion.div>
                            <div>
                                <h3 className="text-lg font-bold text-white">AI Agent Activity</h3>
                                <p className="text-xs text-gray-400">Multi-agent search in progress</p>
                            </div>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                    ✕
                                </motion.div>
                            </button>
                        )}
                    </div>

                    {/* Progress Steps */}
                    <div className="space-y-3">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`p-4 rounded-lg border-2 transition-all ${getStatusColor(
                                    step.status
                                )}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="mt-0.5">
                                            <AgentIcon icon={step.icon} status={step.status} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-white text-sm">{step.agent}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{step.task}</p>

                                            {/* Output */}
                                            <AnimatePresence>
                                                {step.output && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="mt-2 overflow-hidden"
                                                    >
                                                        <div className="p-2 bg-slate-800/60 border border-slate-700/50 rounded text-xs text-gray-300">
                                                            {step.output}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <Badge
                                        className={`ml-2 text-xs font-semibold ${getStatusBadge(
                                            step.status
                                        )}`}
                                    >
                                        {step.status.toUpperCase()}
                                    </Badge>
                                </div>

                                {/* Timestamp */}
                                {step.timestamp && (
                                    <div className="mt-2 text-[10px] text-gray-600">
                                        {step.timestamp.toLocaleTimeString()}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Overall Progress */}
                    <div className="pt-4 border-t border-slate-700/50">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-gray-300 font-semibold">
                                {steps.filter((s) => s.status === "completed").length} / {steps.length}{" "}
                                completed
                            </span>
                        </div>
                        <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{
                                    width: `${(steps.filter((s) => s.status === "completed").length / steps.length) *
                                        100
                                        }%`,
                                }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}