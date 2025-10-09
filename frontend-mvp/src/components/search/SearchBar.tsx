/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Filter, X } from 'lucide-react';
import SearchFilters from './SearchFilters';

interface SearchBarProps {
    onSearch: (query: string, filters?: any) => void;
    isLoading?: boolean;
    placeholder?: string;
}

export default function SearchBar({
    onSearch,
    isLoading = false,
    placeholder = "e.g., Senior Software Engineer with 5+ years in Fintech near Mumbai..."
}: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<any>({});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query, filters);
        }
    };

    const handleClear = () => {
        setQuery('');
        setFilters({});
    };

    const activeFiltersCount = Object.values(filters).filter(v => v).length;

    return (
        <div className="w-full">
            {/* Search Input */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative">
                    {/* Search Icon */}
                    <div className="absolute left-6 top-1/2 transform -translate-y-1/2">
                        <Search className="w-6 h-6 text-gray-400" />
                    </div>

                    {/* Input */}
                    <motion.input
                        whileFocus={{ scale: 1.01 }}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={placeholder}
                        disabled={isLoading}
                        className="w-full pl-16 pr-48 py-6 text-lg rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none shadow-xl transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />

                    {/* Clear Button */}
                    {query && !isLoading && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            type="button"
                            onClick={handleClear}
                            className="absolute right-36 top-1/2 transform -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </motion.button>
                    )}

                    {/* Filter Button */}
                    <motion.button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`absolute right-28 top-1/2 transform -translate-y-1/2 p-3 rounded-lg transition-all ${showFilters || activeFiltersCount > 0
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <Filter className="w-5 h-5" />
                        {activeFiltersCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                                {activeFiltersCount}
                            </span>
                        )}
                    </motion.button>

                    {/* Search Button */}
                    <motion.button
                        type="submit"
                        disabled={!query.trim() || isLoading}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="absolute right-3 top-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 transition-all flex items-center gap-2 font-semibold shadow-lg disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Searching...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Search
                            </>
                        )}
                    </motion.button>
                </div>

                {/* AI Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-6 left-6 flex items-center gap-2 text-xs text-gray-500"
                >
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span>Powered by AI • Smart matching & ranking</span>
                </motion.div>
            </form>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6"
                >
                    <SearchFilters
                        filters={filters}
                        onChange={setFilters}
                        onClose={() => setShowFilters(false)}
                    />
                </motion.div>
            )}
        </div>
    );
}