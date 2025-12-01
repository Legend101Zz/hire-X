"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    User, Code, Briefcase, MapPin, Building2, Clock,
    Sparkles, CheckCircle, Plus
} from "lucide-react";
import type { IdealProfileCard } from "@/types";

interface ResumeProfileCardProps {
    idealProfile: IdealProfileCard;
    highlightedField: string | null;
    updatingField: string | null;
    recentlyUpdatedFields?: string[];
}

export default function ResumeProfileCard({
    idealProfile,
    highlightedField,
    updatingField,
    recentlyUpdatedFields = [],
}: ResumeProfileCardProps) {

    const isFieldUpdated = (field: string) => recentlyUpdatedFields.includes(field);
    const isFieldHighlighted = (field: string) => highlightedField === field;
    const isFieldUpdating = (field: string) => updatingField === field;

    const getFieldStyle = (field: string) => {
        if (isFieldUpdating(field)) {
            return "border-amber-500 bg-amber-500/10 animate-pulse";
        }
        if (isFieldUpdated(field)) {
            return "border-green-500 bg-green-500/10";
        }
        if (isFieldHighlighted(field)) {
            return "border-purple-500 bg-purple-500/10";
        }
        return "border-slate-700/50 bg-slate-800/30";
    };

    const renderField = (
        field: string,
        icon: React.ReactNode,
        label: string,
        value: string | string[] | undefined,
        emptyText: string = "Not specified"
    ) => {
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);
        const displayValue = Array.isArray(value) ? value.join(", ") : value;

        return (
            <motion.div
                layout
                className={`p-3 rounded-xl border transition-all duration-300 ${getFieldStyle(field)}`}
            >
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isEmpty ? 'bg-slate-700/50' : 'bg-slate-700'}`}>
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                            {label}
                            {isFieldUpdated(field) && (
                                <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center gap-1 text-green-400"
                                >
                                    <CheckCircle className="w-3 h-3" />
                                    <span className="text-[10px]">Updated!</span>
                                </motion.span>
                            )}
                        </p>
                        {isEmpty ? (
                            <p className="text-slate-600 text-sm italic flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                {emptyText}
                            </p>
                        ) : (
                            <p className="text-white text-sm font-medium truncate">
                                {displayValue}
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    };

    // Calculate profile completeness
    const getCompleteness = () => {
        let score = 0;
        if (idealProfile.role_title) score += 25;
        if (idealProfile.must_have_skills.length >= 2) score += 25;
        if (idealProfile.seniority || idealProfile.experience_years) score += 25;
        if (idealProfile.locations.length > 0 || idealProfile.industries.length > 0) score += 25;
        return score;
    };

    const completeness = getCompleteness();

    return (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-purple-500/10 to-amber-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">Ideal Candidate</h3>
                            <p className="text-slate-400 text-xs">Building your profile...</p>
                        </div>
                    </div>

                    {/* Completeness indicator */}
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-purple-500 to-amber-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${completeness}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <span className="text-xs text-slate-400">{completeness}%</span>
                    </div>
                </div>
            </div>

            {/* Fields */}
            <div className="p-4 space-y-3">
                {renderField(
                    "role_title",
                    <Briefcase className="w-4 h-4 text-purple-400" />,
                    "Role Title",
                    idealProfile.role_title,
                    "Tell me the role"
                )}

                {renderField(
                    "must_have_skills",
                    <Code className="w-4 h-4 text-blue-400" />,
                    "Must-Have Skills",
                    idealProfile.must_have_skills,
                    "Add required skills"
                )}

                {renderField(
                    "nice_to_have_skills",
                    <Sparkles className="w-4 h-4 text-amber-400" />,
                    "Nice-to-Have Skills",
                    idealProfile.nice_to_have_skills,
                    "Add bonus skills"
                )}

                {renderField(
                    "seniority",
                    <Clock className="w-4 h-4 text-green-400" />,
                    "Seniority Level",
                    idealProfile.seniority || idealProfile.experience_years,
                    "Specify experience level"
                )}

                {renderField(
                    "locations",
                    <MapPin className="w-4 h-4 text-red-400" />,
                    "Locations",
                    idealProfile.locations,
                    "Add preferred locations"
                )}

                {renderField(
                    "industries",
                    <Building2 className="w-4 h-4 text-indigo-400" />,
                    "Industries",
                    idealProfile.industries,
                    "Specify industries"
                )}
            </div>

            {/* Quick Actions */}
            {completeness < 100 && (
                <div className="px-4 pb-4">
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/30">
                        <p className="text-xs text-slate-400 mb-2">💡 Quick suggestions:</p>
                        <div className="flex flex-wrap gap-1">
                            {!idealProfile.locations.length && (
                                <span className="px-2 py-1 bg-slate-700/50 text-slate-400 rounded text-xs">
                                    + Add location
                                </span>
                            )}
                            {!idealProfile.seniority && (
                                <span className="px-2 py-1 bg-slate-700/50 text-slate-400 rounded text-xs">
                                    + Set seniority
                                </span>
                            )}
                            {idealProfile.must_have_skills.length < 3 && (
                                <span className="px-2 py-1 bg-slate-700/50 text-slate-400 rounded text-xs">
                                    + More skills
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
