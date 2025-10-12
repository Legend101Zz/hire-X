/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Briefcase, Building2, Award, Sparkles } from 'lucide-react';

interface SearchFiltersProps {
    filters: any;
    extractedFilters: any;
    onChange: (filters: any) => void;
    onClose: () => void;
}

export default function SearchFilters({
    filters,
    extractedFilters,
    onChange,
    onClose
}: SearchFiltersProps) {
    const updateFilter = (key: string, value: string) => {
        onChange({ ...filters, [key]: value });
    };

    const clearAll = () => {
        onChange({});
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Advanced Filters</h3>
                    <p className="text-sm text-gray-500">Refine your search with additional criteria</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Auto-extracted notice */}
            {Object.keys(extractedFilters).length > 0 && (
                <div className="mb-6 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div className="text-sm">
                        <span className="font-medium text-purple-900">AI extracted filters from your query.</span>
                        <span className="text-purple-700"> You can modify or add more below.</span>
                    </div>
                </div>
            )}

            {/* Filters Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Location */}
                <FilterInput
                    icon={<MapPin className="w-4 h-4 text-blue-600" />}
                    label="Location"
                    value={filters.location || ''}
                    onChange={(val) => updateFilter('location', val)}
                    placeholder="e.g., Mumbai, Bangalore"
                    isExtracted={'Location' in extractedFilters}
                />

                {/* Industry */}
                <FilterInput
                    icon={<Building2 className="w-4 h-4 text-blue-600" />}
                    label="Industry"
                    value={filters.industry || ''}
                    onChange={(val) => updateFilter('industry', val)}
                    placeholder="e.g., Fintech, Healthcare"
                    isExtracted={'Industry' in extractedFilters}
                />

                {/* Experience */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        Experience
                    </label>
                    <select
                        value={filters.experience || ''}
                        onChange={(e) => updateFilter('experience', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Any experience</option>
                        <option value="0-2">0-2 years</option>
                        <option value="2-5">2-5 years</option>
                        <option value="5-10">5-10 years</option>
                        <option value="10+">10+ years</option>
                    </select>
                </div>

                {/* Seniority */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Award className="w-4 h-4 text-blue-600" />
                        Seniority Level
                    </label>
                    <select
                        value={filters.seniority || ''}
                        onChange={(e) => updateFilter('seniority', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Any level</option>
                        <option value="entry">Entry Level</option>
                        <option value="mid">Mid Level</option>
                        <option value="senior">Senior</option>
                        <option value="lead">Lead</option>
                        <option value="principal">Principal</option>
                    </select>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
                <button
                    onClick={clearAll}
                    className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                >
                    Clear all filters
                </button>
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Apply Filters
                </button>
            </div>
        </motion.div>
    );
}

function FilterInput({ icon, label, value, onChange, placeholder, isExtracted }: any) {
    return (
        <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                {icon}
                {label}
                {isExtracted && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                        <Sparkles className="w-3 h-3" />
                        AI detected
                    </span>
                )}
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isExtracted ? 'border-purple-300 bg-purple-50/30' : 'border-gray-300'
                    }`}
            />
        </div>
    );
}