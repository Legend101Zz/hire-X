/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, X, ArrowRight } from 'lucide-react';

interface SearchBarProps {
    onSearch: (query: string) => void;
    isLoading?: boolean;
}

const PLACEHOLDER_TEXTS = [
    "Senior Software Engineer with 5+ years in Fintech...",
    "Marketing Manager with MBA in Bangalore...",
    "Full Stack Developer with React experience...",
    "Data Scientist with Python and ML skills...",
    "Product Manager in Healthcare industry...",
];

export default function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false);

    // Listen for populate event
    useEffect(() => {
        const handlePopulate = (e: any) => {
            setQuery(e.detail);
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isLoading) return;
        onSearch(query);
    };

    const handleClear = () => {
        setQuery('');
    };

    return (
        <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto"
        >
            <div className="relative group">
                {/* Glow Effect */}
                <motion.div
                    animate={isFocused ? {
                        opacity: [0.5, 0.8, 0.5],
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity"
                />

                {/* Search Input Container */}
                <div className="relative">
                    {/* Search Icon */}
                    <div className="absolute left-6 top-1/2 transform -translate-y-1/2 z-10">
                        <motion.div
                            animate={isFocused ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 0.3 }}
                        >
                            <Search className="w-6 h-6 text-gray-400" />
                        </motion.div>
                    </div>

                    {/* Main Input */}
                    <motion.input
                        key={placeholderIndex}
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={PLACEHOLDER_TEXTS[placeholderIndex]}
                        disabled={isLoading}
                        className="w-full pl-16 pr-32 py-7 text-lg text-gray-900 placeholder-gray-400 bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-2xl transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
                    />

                    {/* Right Side Actions */}
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        {query && !isLoading && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                type="button"
                                onClick={handleClear}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </motion.button>
                        )}

                        {/* Submit Button */}
                        <motion.button
                            type="submit"
                            disabled={!query.trim() || isLoading}
                            whileHover={query.trim() && !isLoading ? { scale: 1.05 } : {}}
                            whileTap={query.trim() && !isLoading ? { scale: 0.95 } : {}}
                            className={`px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${query.trim() && !isLoading
                                ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    >
                                        <Sparkles className="w-5 h-5" />
                                    </motion.div>
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                    <span>Search</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Helper Text */}
            {isFocused && !query && (
                <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-3 text-sm text-gray-500 text-center"
                >
                    Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Enter</kbd> to search
                </motion.p>
            )}
        </motion.form>
    );
}