'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, TrendingUp, Calendar, Building2, IndianRupee } from 'lucide-react';

interface CareerEntry {
    role: string;
    company: string;
    duration: string;
    experience_level: string;
    estimated_ctc_range: string;
    rationale: string;
    sources?: string[];
}

interface SalaryProgressionProps {
    totalExperienceYears: number;
    currentCtc: string;
    careerProgression: CareerEntry[];
    nextExpectedRange?: string;
}

export default function SalaryProgression({
    totalExperienceYears,
    currentCtc,
    careerProgression,
    nextExpectedRange
}: SalaryProgressionProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header - Always Visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">Salary Progression</p>
                        <p className="text-xs text-gray-600">
                            {totalExperienceYears} years • Current: {currentCtc}
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
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">
                                        Total Experience
                                    </p>
                                    <p className="text-lg font-bold text-blue-700">
                                        {totalExperienceYears} {totalExperienceYears === 1 ? 'Year' : 'Years'}
                                    </p>
                                </div>

                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-1">
                                        Current CTC
                                    </p>
                                    <p className="text-lg font-bold text-green-700">{currentCtc}</p>
                                </div>
                            </div>

                            {/* Career Timeline Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 bg-gray-50">
                                            <th className="px-3 py-2 text-left font-semibold text-gray-700">
                                                Role & Company
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-700">
                                                Duration
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-700">
                                                Level
                                            </th>
                                            <th className="px-3 py-2 text-left font-semibold text-gray-700">
                                                Est. CTC
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {careerProgression.map((entry, index) => (
                                            <tr
                                                key={index}
                                                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                            >
                                                {/* Role & Company */}
                                                <td className="px-3 py-3">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{entry.role}</p>
                                                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                                                            <Building2 className="w-3 h-3" />
                                                            {entry.company}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* Duration */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1 text-gray-700">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                        <span>{entry.duration}</span>
                                                    </div>
                                                </td>

                                                {/* Level */}
                                                <td className="px-3 py-3">
                                                    <span className="px-2 py-1 bg-violet-50 text-violet-700 text-xs font-medium rounded-full border border-violet-200">
                                                        {entry.experience_level}
                                                    </span>
                                                </td>

                                                {/* CTC */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1 font-semibold text-gray-900">
                                                        <IndianRupee className="w-3.5 h-3.5" />
                                                        {entry.estimated_ctc_range}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Rationale Section */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                    How We Estimated
                                </p>
                                {careerProgression.map((entry, index) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <p className="text-xs font-medium text-gray-900 mb-1">
                                            {entry.role} at {entry.company}:
                                        </p>
                                        <p className="text-xs text-gray-700">{entry.rationale}</p>
                                        {entry.sources && entry.sources.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {entry.sources.map((source, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={source}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        Source {idx + 1}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Next Expected Range */}
                            {nextExpectedRange && (
                                <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-4 h-4 text-violet-600" />
                                        <p className="text-sm font-semibold text-violet-900">
                                            Next Expected Range
                                        </p>
                                    </div>
                                    <p className="text-lg font-bold text-violet-700">{nextExpectedRange}</p>
                                    <p className="text-xs text-violet-700 mt-1">
                                        Based on career trajectory and market standards
                                    </p>
                                </div>
                            )}

                            {/* Growth Chart (Simple Visual) */}
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                                    Career Growth Trajectory
                                </p>
                                <div className="flex items-end justify-between h-24 gap-2">
                                    {careerProgression.map((entry, index) => {
                                        // Extract numeric value from range (e.g., "₹8-12L" -> 10)
                                        const match = entry.estimated_ctc_range.match(/(\d+)/);
                                        const value = match ? parseInt(match[1]) : 5;
                                        const maxValue = Math.max(
                                            ...careerProgression.map((e) => {
                                                const m = e.estimated_ctc_range.match(/(\d+)/);
                                                return m ? parseInt(m[1]) : 5;
                                            })
                                        );
                                        const height = (value / maxValue) * 100;

                                        return (
                                            <div key={index} className="flex-1 flex flex-col items-center">
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${height}%` }}
                                                    transition={{ delay: index * 0.1, duration: 0.5 }}
                                                    className="w-full bg-gradient-to-t from-violet-500 to-purple-600 rounded-t-lg min-h-[20px]"
                                                    title={entry.estimated_ctc_range}
                                                />
                                                <p className="text-xs text-gray-600 mt-2 text-center truncate w-full">
                                                    {entry.role.split(' ')[0]}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}