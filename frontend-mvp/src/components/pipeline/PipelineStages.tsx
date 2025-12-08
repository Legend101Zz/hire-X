
'use client';

import { motion } from 'framer-motion';
import { PipelineStage } from '@/types/pipeline';

interface PipelineStagesProps {
    stages: PipelineStage[];
    activeStage: string | null;
    onStageClick: (stage: string) => void;
}

export function PipelineStages({ stages, activeStage, onStageClick }: PipelineStagesProps) {
    const totalCount = stages.reduce((sum, s) => sum + s.count, 0);

    return (
        <div className="mb-6">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                {/* Stage Progress Bar */}
                <div className="relative mb-4">
                    {/* Background track */}
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        {/* Filled portions */}
                        <div className="h-full flex">
                            {stages.map((stage, index) => {
                                const width = totalCount > 0 ? (stage.count / totalCount) * 100 : 0;
                                const colors: Record<string, string> = {
                                    gray: 'bg-gray-500',
                                    blue: 'bg-blue-500',
                                    green: 'bg-green-500',
                                    purple: 'bg-purple-500',
                                    indigo: 'bg-indigo-500',
                                    teal: 'bg-teal-500',
                                    cyan: 'bg-cyan-500',
                                    yellow: 'bg-yellow-500',
                                    red: 'bg-red-500',
                                    emerald: 'bg-emerald-500',
                                };

                                return (
                                    <motion.div
                                        key={stage.key}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${width}%` }}
                                        transition={{ duration: 0.5, delay: index * 0.1 }}
                                        className={`h-full ${colors[stage.color] || 'bg-white/20'}`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Stage Pills */}
                <div className="flex flex-wrap gap-2">
                    {stages.map((stage) => {
                        const isActive = activeStage === stage.key;
                        const hasCount = stage.count > 0;

                        return (
                            <motion.button
                                key={stage.key}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onStageClick(stage.key)}
                                className={`
                  group flex items-center gap-2 px-3 py-1.5 rounded-lg
                  text-[13px] transition-all border
                  ${isActive
                                        ? 'bg-white/10 border-white/20 text-white'
                                        : hasCount
                                            ? 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.06]'
                                            : 'bg-transparent border-white/[0.04] text-white/30'
                                    }
                `}
                            >
                                <span className="text-base">{stage.icon}</span>
                                <span>{stage.label}</span>
                                <span className={`
                  px-1.5 py-0.5 rounded text-[11px] font-medium
                  ${isActive
                                        ? 'bg-white/20 text-white'
                                        : hasCount
                                            ? 'bg-white/[0.08] text-white/60'
                                            : 'bg-white/[0.04] text-white/20'
                                    }
                `}>
                                    {stage.count}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}