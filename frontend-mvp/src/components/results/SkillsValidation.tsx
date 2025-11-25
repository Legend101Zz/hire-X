"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SkillValidation } from "@/types";

interface SkillsValidationProps {
    validation: SkillValidation;
}

export default function SkillsValidation({ validation }: SkillsValidationProps) {
    return (
        <div className="space-y-6">
            {/* Overall Confidence */}
            <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-white">Skills Validation</h4>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Confidence:</span>
                    <span className="text-lg font-bold text-green-400">
                        {validation.overall_confidence}%
                    </span>
                </div>
            </div>

            {/* Validated Skills */}
            {validation.validated_skills.length > 0 && (
                <div>
                    <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        Validated Skills ({validation.validated_skills.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                        {validation.validated_skills.map((skill, index) => (
                            <Badge
                                key={index}
                                className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                            >
                                {skill}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Unvalidated Skills */}
            {validation.unvalidated_skills.length > 0 && (
                <div>
                    <h5 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-slate-500" />
                        Unvalidated Skills ({validation.unvalidated_skills.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                        {validation.unvalidated_skills.map((skill, index) => (
                            <Badge
                                key={index}
                                className="bg-slate-700/20 text-slate-400 border-slate-600/30"
                            >
                                {skill}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Evidence Cards */}
            {validation.evidence.length > 0 && (
                <div className="space-y-3">
                    <h5 className="text-sm font-medium text-slate-300">Evidence Found</h5>
                    {validation.evidence.map((evidence, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 hover:border-blue-500/30 transition-all"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <span className="font-medium text-white">{evidence.skill}</span>
                                    <span className="ml-2 text-xs text-slate-400">
                                        via {evidence.evidence_type}
                                    </span>
                                </div>
                                <span className="text-xs font-medium text-green-400">
                                    {evidence.confidence}/10
                                </span>
                            </div>
                            <p className="text-sm text-slate-400 mb-2">{evidence.description}</p>
                            <a
                                href={evidence.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                                View Evidence <ExternalLink className="w-3 h-3" />
                            </a>
                        </motion.div>
                    ))}
                </div>
            )
            }
        </div >
    );
}