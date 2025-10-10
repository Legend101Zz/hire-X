/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, X, Loader2, MapPin, Briefcase, Building2, Award, Code, Edit3, Plus, Check, ArrowRight } from 'lucide-react';
import { debounce } from 'lodash';

interface SearchBarProps {
    onSearch: (query: string, filters?: any) => void;
    isLoading?: boolean;
}

const PLACEHOLDER_TEXTS = [
    "Senior Software Engineer with 5+ years in Fintech...",
    "Marketing Manager with MBA in Bangalore...",
    "Full Stack Developer with React experience...",
    "Data Scientist with Python and ML skills...",
    "Product Manager in Healthcare industry...",
];

// Schema-based filter options
const FILTER_OPTIONS = {
    location: {
        label: 'Location',
        icon: MapPin,
        type: 'multiselect',
        options: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow']
    },
    industry: {
        label: 'Industry',
        icon: Building2,
        type: 'multiselect',
        options: [
            'Information Technology',
            'Financial Services',
            'Healthcare',
            'E-commerce',
            'Manufacturing',
            'Consulting',
            'Education',
            'Marketing & Advertising',
            'Real Estate',
            'Retail'
        ]
    },
    title: {
        label: 'Job Title',
        icon: Briefcase,
        type: 'text',
        placeholder: 'e.g., Software Engineer, Product Manager'
    },
    seniority_level: {
        label: 'Seniority Level',
        icon: Award,
        type: 'select',
        options: ['Entry Level', 'Mid-Level', 'Senior', 'Lead', 'Director', 'VP', 'C-Level']
    },
    expertise: {
        label: 'Skills',
        icon: Code,
        type: 'tags',
        placeholder: 'Add skills (press Enter)'
    },
    years_of_experience: {
        label: 'Experience',
        icon: Briefcase,
        type: 'select',
        options: ['0-2 years', '2-5 years', '5-10 years', '10-15 years', '15+ years']
    }
};

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [quickFilters, setQuickFilters] = useState<any>({});
    const [aiFilters, setAiFilters] = useState<any>({});
    const [isExtractingAI, setIsExtractingAI] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [showEditMode, setShowEditMode] = useState(false);
    const [aiExtractionDone, setAiExtractionDone] = useState(false);
    const hasExtractedRef = useRef(false);

    // Listen for populate event
    useEffect(() => {
        const handlePopulate = (e: any) => {
            setQuery(e.detail);
            setShowEditMode(false);
            hasExtractedRef.current = false;
            setAiExtractionDone(false);
            setQuickFilters({});
            setAiFilters({});
        };

        window.addEventListener('populateSearch', handlePopulate);
        return () => window.removeEventListener('populateSearch', handlePopulate);
    }, []);

    // Rotate placeholder text
    useEffect(() => {
        if (query) return;

        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [query]);

    // Quick filter extraction (instant, client-side)
    const extractQuickFilters = useCallback((searchQuery: string) => {
        if (!searchQuery.trim() || searchQuery.length < 3) {
            setQuickFilters({});
            return;
        }

        const filters: any = {};
        const lowerQuery = searchQuery.toLowerCase();

        // Quick location detection
        const cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune', 'kolkata', 'ahmedabad', 'jaipur', 'lucknow'];
        const foundCities: string[] = [];

        cities.forEach(city => {
            if (lowerQuery.includes(city)) {
                foundCities.push(city.charAt(0).toUpperCase() + city.slice(1));
            }
        });

        if (foundCities.length > 0) {
            filters.location = foundCities;
        }

        // Quick industry detection
        const industryMap: { [key: string]: string } = {
            'fintech': 'Financial Services',
            'finance': 'Financial Services',
            'banking': 'Financial Services',
            'healthcare': 'Healthcare',
            'pharma': 'Healthcare',
            'tech': 'Information Technology',
            'software': 'Information Technology',
            'it': 'Information Technology',
            'retail': 'Retail',
            'ecommerce': 'E-commerce',
            'consulting': 'Consulting',
            'education': 'Education',
            'marketing': 'Marketing & Advertising',
        };

        for (const [keyword, industry] of Object.entries(industryMap)) {
            if (lowerQuery.includes(keyword)) {
                filters.industry = filters.industry || [];
                if (!filters.industry.includes(industry)) {
                    filters.industry.push(industry);
                }
            }
        }

        // Quick experience detection
        const expMatch = lowerQuery.match(/(\d+)\+?\s*(?:years?|yrs?)/);
        if (expMatch) {
            const years = parseInt(expMatch[1]);
            if (years <= 2) filters.years_of_experience = '0-2 years';
            else if (years <= 5) filters.years_of_experience = '2-5 years';
            else if (years <= 10) filters.years_of_experience = '5-10 years';
            else if (years <= 15) filters.years_of_experience = '10-15 years';
            else filters.years_of_experience = '15+ years';
        }

        // Quick seniority detection
        const seniorityMap: { [key: string]: string } = {
            'senior': 'Senior',
            'lead': 'Lead',
            'principal': 'Lead',
            'director': 'Director',
            'vp': 'VP',
            'vice president': 'VP',
            'cto': 'C-Level',
            'ceo': 'C-Level',
            'cfo': 'C-Level',
            'entry': 'Entry Level',
            'junior': 'Entry Level',
        };

        for (const [keyword, level] of Object.entries(seniorityMap)) {
            if (lowerQuery.includes(keyword)) {
                filters.seniority_level = level;
                break;
            }
        }

        // Quick skills detection
        const commonSkills = [
            'python', 'java', 'javascript', 'react', 'node', 'angular', 'vue',
            'sql', 'mongodb', 'aws', 'azure', 'docker', 'kubernetes'
        ];

        const foundSkills: string[] = [];
        commonSkills.forEach(skill => {
            if (lowerQuery.includes(skill)) {
                foundSkills.push(skill.toUpperCase());
            }
        });

        if (foundSkills.length > 0) {
            filters.expertise = foundSkills;
        }

        setQuickFilters(filters);
    }, []);

    // AI filter extraction (async, runs ONCE)
    const extractAIFilters = useCallback(
        debounce(async (searchQuery: string) => {
            if (!searchQuery.trim() || searchQuery.length < 10 || hasExtractedRef.current) {
                return;
            }

            hasExtractedRef.current = true;
            setIsExtractingAI(true);

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/extract-filters`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ query: searchQuery }),
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    setAiFilters(data.filters || {});
                }
            } catch (error) {
                console.error('Error extracting AI filters:', error);
            } finally {
                setIsExtractingAI(false);
                setAiExtractionDone(true);
            }
        }, 1500),
        [] // Empty dependency array - only depends on the query passed to it
    );

    // Trigger filter extraction when query changes
    useEffect(() => {
        if (!query.trim()) {
            setQuickFilters({});
            setAiFilters({});
            hasExtractedRef.current = false;
            setAiExtractionDone(false);
            return;
        }

        // Quick filters - instant
        extractQuickFilters(query);

        // AI filters - debounced, runs once
        if (query.length >= 10) {
            extractAIFilters(query);
        }
    }, [query, extractQuickFilters, extractAIFilters]);

    const handleStartSearch = () => {
        if (!query.trim()) return;

        // Merge quick and AI filters
        const allFilters = { ...quickFilters };

        // Merge AI filters, preferring AI values
        Object.entries(aiFilters).forEach(([key, value]) => {
            if (Array.isArray(value) && Array.isArray(allFilters[key])) {
                // Merge arrays and remove duplicates
                allFilters[key] = [...new Set([...allFilters[key], ...value])];
            } else {
                allFilters[key] = value;
            }
        });

        onSearch(query, allFilters);
    };

    const handleClear = () => {
        setQuery('');
        setQuickFilters({});
        setAiFilters({});
        hasExtractedRef.current = false;
        setAiExtractionDone(false);
        setShowEditMode(false);
    };

    const updateFilter = (key: string, value: any) => {
        // Update in whichever filter set it belongs to
        if (quickFilters[key] !== undefined) {
            setQuickFilters({ ...quickFilters, [key]: value });
        } else {
            setAiFilters({ ...aiFilters, [key]: value });
        }
    };

    const removeFilter = (key: string) => {
        const newQuick = { ...quickFilters };
        const newAI = { ...aiFilters };
        delete newQuick[key];
        delete newAI[key];
        setQuickFilters(newQuick);
        setAiFilters(newAI);
    };

    // Merge filters for display
    const allFilters = { ...quickFilters, ...aiFilters };
    const hasFilters = Object.keys(allFilters).length > 0;

    return (
        <div className="w-full">
            {/* Search Input */}
            <div className="relative">
                <div className="relative">
                    <div className="absolute left-6 top-1/2 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-gray-400" />
                    </div>

                    <motion.input
                        key={placeholderIndex}
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={PLACEHOLDER_TEXTS[placeholderIndex]}
                        disabled={isLoading}
                        className="w-full pl-16 pr-16 py-6 text-lg text-gray-900 placeholder-gray-400 rounded-2xl border-2 border-gray-200 bg-white focus:border-blue-500 focus:outline-none shadow-xl transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />

                    {query && !isLoading && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            type="button"
                            onClick={handleClear}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Filter Extraction Status */}
            <AnimatePresence>
                {query && query.length >= 10 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                    >
                        <div className="flex items-center justify-center gap-3 text-sm">
                            {isExtractingAI ? (
                                <>
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    <span className="text-blue-600 font-medium">AI is enhancing filters...</span>
                                </>
                            ) : aiExtractionDone ? (
                                <>
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="text-green-600 font-medium">Filters ready!</span>
                                </>
                            ) : null}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filters Display & Edit */}
            <AnimatePresence>
                {hasFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6"
                    >
                        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            <Sparkles className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                                                {isExtractingAI ? 'Extracting Filters...' : 'Detected Filters'}
                                            </h3>
                                            <p className="text-xs text-gray-600">
                                                {Object.keys(quickFilters).length > 0 && '⚡ Quick filters • '}
                                                {Object.keys(aiFilters).length > 0 && '✨ AI enhanced • '}
                                                {Object.keys(allFilters).length} total
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowEditMode(!showEditMode)}
                                        disabled={isExtractingAI}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${showEditMode
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 disabled:opacity-50'
                                            }`}
                                    >
                                        {showEditMode ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Done
                                            </>
                                        ) : (
                                            <>
                                                <Edit3 className="w-4 h-4" />
                                                Edit
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Filter Content */}
                            <div className="p-6">
                                {!showEditMode ? (
                                    <FilterReadView
                                        filters={allFilters}
                                        quickFilters={quickFilters}
                                        aiFilters={aiFilters}
                                        onRemove={removeFilter}
                                    />
                                ) : (
                                    <FilterEditView
                                        filters={allFilters}
                                        onChange={updateFilter}
                                        onRemove={removeFilter}
                                    />
                                )}
                            </div>

                            {/* Start Search Button */}
                            <div className="px-6 pb-6">
                                <motion.button
                                    onClick={handleStartSearch}
                                    disabled={isLoading || isExtractingAI}
                                    whileHover={{ scale: isExtractingAI ? 1 : 1.02 }}
                                    whileTap={{ scale: isExtractingAI ? 1 : 0.98 }}
                                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg ${isExtractingAI
                                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white cursor-wait'
                                            : isLoading
                                                ? 'bg-gray-400 text-white cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-xl'
                                        }`}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            Searching...
                                        </>
                                    ) : isExtractingAI ? (
                                        <>
                                            <Sparkles className="w-6 h-6 animate-pulse" />
                                            Analyzing... Please wait
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-6 h-6" />
                                            Start Search
                                            <ArrowRight className="w-6 h-6" />
                                        </>
                                    )}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Read-only filter display with source indicator
function FilterReadView({ filters, quickFilters, aiFilters, onRemove }: any) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(filters).map(([key, value]: [string, any]) => {
                const config = FILTER_OPTIONS[key as keyof typeof FILTER_OPTIONS] || {
                    label: key,
                    icon: Sparkles
                };
                const Icon = config.icon;

                // Check if this is a quick filter or AI filter
                const isQuickFilter = quickFilters[key] !== undefined;
                const isAIFilter = aiFilters[key] !== undefined;

                return (
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 ${isAIFilter
                                ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300'
                                : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300'
                            }`}
                    >
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Icon className={`w-4 h-4 ${isAIFilter ? 'text-purple-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-600">{config.label}</span>
                                {isQuickFilter && !isAIFilter && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-200 text-blue-700 rounded font-bold">
                                        QUICK
                                    </span>
                                )}
                                {isAIFilter && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded font-bold">
                                        AI
                                    </span>
                                )}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 truncate">
                                {Array.isArray(value) ? value.join(', ') : value}
                            </div>
                        </div>
                        <button
                            onClick={() => onRemove(key)}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors group"
                        >
                            <X className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
}

// Editable filter panel
function FilterEditView({ filters, onChange, onRemove }: any) {
    return (
        <div className="space-y-6">
            {/* Existing filters */}
            <div className="space-y-4">
                {Object.entries(filters).map(([key, value]: [string, any]) => {
                    const config = FILTER_OPTIONS[key as keyof typeof FILTER_OPTIONS];
                    if (!config) return null;

                    return (
                        <FilterInput
                            key={key}
                            filterKey={key}
                            config={config}
                            value={value}
                            onChange={(newValue) => onChange(key, newValue)}
                            onRemove={() => onRemove(key)}
                        />
                    );
                })}
            </div>

            {/* Add new filter */}
            <div className="pt-4 border-t-2 border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add More Filters
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(FILTER_OPTIONS)
                        .filter(([key]) => !filters[key])
                        .map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                                <button
                                    key={key}
                                    onClick={() => {
                                        if (config.type === 'multiselect' || config.type === 'tags') {
                                            onChange(key, []);
                                        } else {
                                            onChange(key, '');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-700 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <Icon className="w-4 h-4" />
                                    {config.label}
                                </button>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}

// [Keep the FilterInput component exactly as it was in the previous version]
function FilterInput({ filterKey, config, value, onChange, onRemove }: any) {
    const Icon = config.icon;
    const [tagInput, setTagInput] = useState('');

    const handleAddTag = () => {
        if (tagInput.trim() && config.type === 'tags') {
            const currentTags = Array.isArray(value) ? value : [];
            onChange([...currentTags, tagInput.trim()]);
            setTagInput('');
        }
    };

    return (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">{config.label}</span>
                </div>
                <button
                    onClick={onRemove}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-600" />
                </button>
            </div>

            {config.type === 'text' && (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={config.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                />
            )}

            {config.type === 'select' && (
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                >
                    <option value="">Select...</option>
                    {config.options.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            )}

            {config.type === 'multiselect' && (
                <div className="space-y-2">
                    <select
                        onChange={(e) => {
                            const currentValues = Array.isArray(value) ? value : [];
                            if (e.target.value && !currentValues.includes(e.target.value)) {
                                onChange([...currentValues, e.target.value]);
                            }
                            e.target.value = '';
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                    >
                        <option value="">Add {config.label.toLowerCase()}...</option>
                        {config.options.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                    {Array.isArray(value) && value.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {value.map((item: string, idx: number) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                                >
                                    {item}
                                    <button
                                        onClick={() => onChange(value.filter((v: string) => v !== item))}
                                        className="hover:text-blue-900"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {config.type === 'tags' && (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddTag();
                                }
                            }}
                            placeholder={config.placeholder}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                        />
                        <button
                            onClick={handleAddTag}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    {Array.isArray(value) && value.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {value.map((tag: string, idx: number) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                                >
                                    {tag}
                                    <button
                                        onClick={() => onChange(value.filter((v: string) => v !== tag))}
                                        className="hover:text-purple-900"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}