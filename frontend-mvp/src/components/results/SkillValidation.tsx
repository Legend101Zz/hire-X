'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Code, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface SkillEvidence {
    skill: string;
    url: string;
    source: string; // 'GitHub', 'StackOverflow', etc.
    confidence: number; // 0-100
}

interface SkillValidationProps {
    validatedSkills: string[];
    unvalidatedSkills: string[];
    evidence: SkillEvidence[];
}

export default function SkillValidation({
    validatedSkills,
    unvalidatedSkills,
    evidence
}: SkillValidationProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Code className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">Skill Validation</p>
                        <p className="text-xs text-gray-600">
                            {validatedSkills.length} verified • {evidence.length} sources
                        </p>
                    </div>
                </div>

                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-200"
                    >
                        <div className="p-4 space-y-4">
                            {/* Validated Skills */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                        Validated Skills ({validatedSkills.length})
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {validatedSkills.map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-full border border-green-200"
                                        >
                                            {skill} ✓
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Unvalidated Skills */}
                            {unvalidatedSkills.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <XCircle className="w-4 h-4 text-gray-400" />
                                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                            Unvalidated ({unvalidatedSkills.length})
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {unvalidatedSkills.map((skill, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-full border border-gray-200"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Evidence */}
                            <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                                    Evidence Sources
                                </p>
                                <div className="space-y-2">
                                    {evidence.map((item, index) => (
                                        <motion.a
                                            key={index}
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.source === 'GitHub' ? 'bg-gray-900' :
                                                        item.source === 'StackOverflow' ? 'bg-orange-500' :
                                                            'bg-blue-500'
                                                    }`}>
                                                    <span className="text-white text-xs font-bold">
                                                        {item.source[0]}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {item.skill}
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        {item.source} • {item.confidence}% confidence
                                                    </p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                                        </motion.a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}