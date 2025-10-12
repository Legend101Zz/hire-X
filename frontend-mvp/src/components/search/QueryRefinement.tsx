/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, RefreshCw, X } from 'lucide-react';

interface QueryRefinementProps {
    preflightResults: any;
    onRefine: (refinements: { [key: string]: string }) => void;
    onCancel: () => void;
}

const suggestions = {
    Industry: [
        "Try broader terms: 'Software', 'Technology', 'IT Services'",
        "Financial related: 'Financial Services', 'Banking', 'Insurance'",
        "Consulting: 'Management Consulting', 'Business Consulting'",
    ],
    Location: [
        "Try nearby cities: 'Pune', 'Thane', 'Maharashtra'",
        "Try major cities: 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai'",
        "Try regions: 'India', 'USA', 'Europe'",
    ],
    Role: [
        "Try simpler terms: 'Software Engineer' instead of 'Senior Software Engineer'",
        "Try variations: 'Developer', 'Engineer', 'Architect'",
        "Try broader: 'Engineer' or 'Manager'",
    ],
};

export default function QueryRefinement({
    preflightResults,
    onRefine,
    onCancel,
}: QueryRefinementProps) {
    const failedFilters = preflightResults.failed_filters || {};
    const [refinements, setRefinements] = useState<{ [key: string]: string }>({});
    const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
    const [testResults, setTestResults] = useState<{ [key: string]: number }>({});

    const handleTest = async (filterName: string, value: string) => {
        setTesting({ ...testing, [filterName]: true });

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/test-alternative`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        filter_name: filterName,
                        value: value,
                    }),
                }
            );

            if (response.ok) {
                const result = await response.json();
                setTestResults({ ...testResults, [filterName]: result.count });
            }
        } catch (error) {
            console.error('Error testing alternative:', error);
        } finally {
            setTesting({ ...testing, [filterName]: false });
        }
    };

    const handleSubmit = () => {
        onRefine(refinements);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Refine Your Search</h2>
                            <p className="text-sm text-gray-600">
                                No results found. Let&apos;s adjust your criteria.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {Object.entries(failedFilters).map(([filterName, info]: [string, any]) => (
                        <div key={filterName} className="border rounded-lg p-4">
                            {/* Failed Filter */}
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 bg-red-100 rounded-lg mt-1">
                                    <X className="w-5 h-5 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{filterName}</h3>
                                    <p className="text-gray-600 text-sm">
                                        We couldn&apos;t find &apos;<span className="font-medium">{info.requested}</span>&apos;
                                    </p>
                                </div>
                            </div>

                            {/* Suggestions */}
                            {suggestions[filterName as keyof typeof suggestions] && (
                                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                                    <div className="flex items-start gap-2 mb-2">
                                        <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <span className="font-medium text-blue-900">Suggestions:</span>
                                    </div>
                                    <ul className="space-y-1 ml-7">
                                        {suggestions[filterName as keyof typeof suggestions].map((suggestion, idx) => (
                                            <li key={idx} className="text-sm text-blue-800">
                                                • {suggestion}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={`Try a different ${filterName.toLowerCase()}...`}
                                    value={refinements[filterName] || ''}
                                    onChange={(e) =>
                                        setRefinements({ ...refinements, [filterName]: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && refinements[filterName]) {
                                            handleTest(filterName, refinements[filterName]);
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={() => {
                                        if (refinements[filterName]) {
                                            handleTest(filterName, refinements[filterName]);
                                        }
                                    }}
                                    disabled={!refinements[filterName] || testing[filterName]}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                >
                                    {testing[filterName] ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Testing...
                                        </>
                                    ) : (
                                        'Test'
                                    )}
                                </button>
                            </div>

                            {/* Test Results */}
                            {testResults[filterName] !== undefined && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-3"
                                >
                                    {testResults[filterName] > 0 ? (
                                        <div className="flex items-center gap-2 text-green-600 text-sm">
                                            <div className="w-2 h-2 bg-green-600 rounded-full" />
                                            Found {testResults[filterName].toLocaleString()} profiles!
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-red-600 text-sm">
                                            <X className="w-4 h-4" />
                                            Still no results. Try another value.
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={Object.keys(refinements).length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Search with Refinements
                    </button>
                </div>
            </motion.div>
        </div>
    );
}