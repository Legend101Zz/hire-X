'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Plus,
    Trash2,
    Save,
    X,
    GripVertical,
    ChevronDown
} from 'lucide-react';

interface Scorecard {
    mustHaveFilters: any[];
    scoringCriteria: any[];
    expansions: any;
    threshold: number;
    metadata: any;
}

interface ScorecardAdvancedViewProps {
    scorecard: Scorecard;
    onUpdate: (scorecard: Scorecard) => void;
    sessionId: string;
}

const FIELD_OPTIONS = [
    { value: 'location', label: 'Location' },
    { value: 'title', label: 'Job Title' },
    { value: 'expertise', label: 'Skills/Expertise' },
    { value: 'current_industry', label: 'Industry' },
    { value: 'seniority_level', label: 'Seniority Level' },
    { value: 'functional_area', label: 'Functional Area' },
];

const OPERATOR_OPTIONS = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'in', label: 'In List' },
    { value: '>=', label: 'Greater or Equal' },
    { value: '<=', label: 'Less or Equal' },
];

export default function ScorecardAdvancedView({
    scorecard,
    onUpdate,
    sessionId
}: ScorecardAdvancedViewProps) {
    const [editedScorecard, setEditedScorecard] = useState(scorecard);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddFilter = () => {
        const newFilter = {
            field: 'location',
            operator: 'contains',
            value: '',
            description: ''
        };

        setEditedScorecard({
            ...editedScorecard,
            mustHaveFilters: [...editedScorecard.mustHaveFilters, newFilter]
        });
        setHasChanges(true);
    };

    const handleRemoveFilter = (index: number) => {
        const newFilters = editedScorecard.mustHaveFilters.filter((_, i) => i !== index);
        setEditedScorecard({
            ...editedScorecard,
            mustHaveFilters: newFilters
        });
        setHasChanges(true);
    };

    const handleUpdateFilter = (index: number, field: string, value: any) => {
        const newFilters = [...editedScorecard.mustHaveFilters];
        newFilters[index] = {
            ...newFilters[index],
            [field]: value
        };
        setEditedScorecard({
            ...editedScorecard,
            mustHaveFilters: newFilters
        });
        setHasChanges(true);
    };

    const handleAddScoringCriteria = () => {
        const newCriteria = {
            description: '',
            fields: ['title'],
            keywords: [],
            points: 10
        };

        setEditedScorecard({
            ...editedScorecard,
            scoringCriteria: [...editedScorecard.scoringCriteria, newCriteria]
        });
        setHasChanges(true);
    };

    const handleRemoveScoringCriteria = (index: number) => {
        const newCriteria = editedScorecard.scoringCriteria.filter((_, i) => i !== index);
        setEditedScorecard({
            ...editedScorecard,
            scoringCriteria: newCriteria
        });
        setHasChanges(true);
    };

    const handleUpdateScoringCriteria = (index: number, field: string, value: any) => {
        const newCriteria = [...editedScorecard.scoringCriteria];
        newCriteria[index] = {
            ...newCriteria[index],
            [field]: value
        };
        setEditedScorecard({
            ...editedScorecard,
            scoringCriteria: newCriteria
        });
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ scorecard: editedScorecard })
            });

            if (response.ok) {
                onUpdate(editedScorecard);
                setHasChanges(false);
            }
        } catch (error) {
            console.error('Error saving scorecard:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Advanced Editor
                    </h2>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                            {isSaving ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Save className="w-4 h-4" />
                                    </motion.div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-500">
                    Precise control over filters, scoring, and weights
                </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Must-Have Filters Section */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 px-5 py-3">
                        <h3 className="text-sm font-semibold text-gray-900">
                            Must-Have Filters
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Hard requirements that eliminate candidates
                        </p>
                    </div>

                    <div className="p-5 space-y-3">
                        {editedScorecard.mustHaveFilters.map((filter, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-50 rounded-lg border border-gray-200 p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />

                                    <div className="flex-1 space-y-3">
                                        {/* Field Selector */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Field
                                            </label>
                                            <select
                                                value={filter.field}
                                                onChange={(e) => handleUpdateFilter(index, 'field', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {FIELD_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Operator Selector */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Operator
                                            </label>
                                            <select
                                                value={filter.operator}
                                                onChange={(e) => handleUpdateFilter(index, 'operator', e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                {OPERATOR_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Value Input */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Value
                                            </label>
                                            <input
                                                type="text"
                                                value={filter.value}
                                                onChange={(e) => handleUpdateFilter(index, 'value', e.target.value)}
                                                placeholder="Enter value..."
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Description (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={filter.description || ''}
                                                onChange={(e) => handleUpdateFilter(index, 'description', e.target.value)}
                                                placeholder="Friendly description..."
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleRemoveFilter(index)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}

                        <button
                            onClick={handleAddFilter}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Filter
                        </button>
                    </div>
                </div>

                {/* Scoring Criteria Section */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-5 py-3">
                        <h3 className="text-sm font-semibold text-gray-900">
                            Scoring Criteria
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Weighted factors that rank candidates
                        </p>
                    </div>

                    <div className="p-5 space-y-3">
                        {editedScorecard.scoringCriteria.map((criteria, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-50 rounded-lg border border-gray-200 p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />

                                    <div className="flex-1 space-y-3">
                                        {/* Description */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Description
                                            </label>
                                            <input
                                                type="text"
                                                value={criteria.description}
                                                onChange={(e) => handleUpdateScoringCriteria(index, 'description', e.target.value)}
                                                placeholder="What this criteria measures..."
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Keywords */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Keywords (comma-separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={criteria.keywords ? criteria.keywords.join(', ') : ''}
                                                onChange={(e) => handleUpdateScoringCriteria(
                                                    index,
                                                    'keywords',
                                                    e.target.value.split(',').map(k => k.trim()).filter(k => k)
                                                )}
                                                placeholder="keyword1, keyword2, keyword3..."
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Points */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                Points
                                            </label>
                                            <input
                                                type="number"
                                                value={criteria.points}
                                                onChange={(e) => handleUpdateScoringCriteria(index, 'points', parseInt(e.target.value) || 0)}
                                                min="0"
                                                max="100"
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleRemoveScoringCriteria(index)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}

                        <button
                            onClick={handleAddScoringCriteria}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Scoring Criteria
                        </button>
                    </div>
                </div>

                {/* Threshold Setting */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 px-5 py-3">
                        <h3 className="text-sm font-semibold text-gray-900">
                            Minimum Score Threshold
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            Candidates below this score are excluded
                        </p>
                    </div>

                    <div className="p-5">
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={editedScorecard.threshold}
                                onChange={(e) => {
                                    setEditedScorecard({
                                        ...editedScorecard,
                                        threshold: parseInt(e.target.value)
                                    });
                                    setHasChanges(true);
                                }}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">
                                    {editedScorecard.threshold}
                                </div>
                                <div className="text-xs text-gray-500">
                                    points
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}