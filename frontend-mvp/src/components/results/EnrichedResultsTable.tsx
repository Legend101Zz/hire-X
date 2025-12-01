/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, User, MapPin, Briefcase } from 'lucide-react';
import SalaryProgression from './SalaryProgression';
import ResponseLikelihood from './ResponseLikelihood';
import SkillValidation from './SkillValidation';
import React from 'react';

interface EnrichedCandidate {
    profile_id: string;
    name: string;
    title: string;
    location: string;
    company: string;
    match_label: string;
    match_score: number;
    salary_enrichment?: any;
    response_likelihood?: any;
    skill_validation?: any;
    availability?: any;
}

interface EnrichedResultsTableProps {
    candidates: EnrichedCandidate[];
    onShortlist?: (profileId: string) => void;
}

export default function EnrichedResultsTable({
    candidates,
    onShortlist
}: EnrichedResultsTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (profileId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(profileId)) {
            newExpanded.delete(profileId);
        } else {
            newExpanded.add(profileId);
        }
        setExpandedRows(newExpanded);
    };

    const getMatchBadgeColor = (label: string) => {
        if (label === 'Great Match') return 'bg-green-100 text-green-700 border-green-300';
        if (label === 'Good Match') return 'bg-blue-100 text-blue-700 border-blue-300';
        return 'bg-gray-100 text-gray-700 border-gray-300';
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Rank
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Candidate
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Match
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Est. Salary
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Response
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {candidates.map((candidate, index) => {
                            const isExpanded = expandedRows.has(candidate.profile_id);

                            return (
                                <React.Fragment key={candidate.profile_id}>
                                    {/* Main Row */}
                                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            #{index + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                    {candidate.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{candidate.name}</p>
                                                    <p className="text-xs text-gray-600 flex items-center gap-1">
                                                        <Briefcase className="w-3 h-3" />
                                                        {candidate.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {candidate.location}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getMatchBadgeColor(candidate.match_label)}`}>
                                                {candidate.match_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {candidate.salary_enrichment?.estimated_current_ctc || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {candidate.response_likelihood?.overall_score || 0}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleRow(candidate.profile_id)}
                                                    className="px-3 py-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                    {isExpanded ? 'Collapse' : 'Expand'}
                                                </button>
                                                {onShortlist && (
                                                    <button
                                                        onClick={() => onShortlist(candidate.profile_id)}
                                                        className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
                                                    >
                                                        Shortlist
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Details */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-0">
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="py-4 space-y-3 bg-gray-50">
                                                            {candidate.salary_enrichment && (
                                                                <SalaryProgression
                                                                    totalExperienceYears={candidate.salary_enrichment.total_experience_years}
                                                                    currentCtc={candidate.salary_enrichment.estimated_current_ctc}
                                                                    careerProgression={candidate.salary_enrichment.career_progression}
                                                                    nextExpectedRange={candidate.salary_enrichment.next_expected_range}
                                                                />
                                                            )}
                                                            {candidate.response_likelihood && (
                                                                <ResponseLikelihood
                                                                    overallScore={candidate.response_likelihood.overall_score}
                                                                    factors={candidate.response_likelihood.factors}
                                                                    recommendations={candidate.response_likelihood.recommendations}
                                                                />
                                                            )}
                                                            {candidate.skill_validation && (
                                                                <SkillValidation
                                                                    validatedSkills={candidate.skill_validation.validated_skills}
                                                                    unvalidatedSkills={candidate.skill_validation.unvalidated_skills}
                                                                    evidence={candidate.skill_validation.evidence}
                                                                />
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                </td>
                                            </tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}