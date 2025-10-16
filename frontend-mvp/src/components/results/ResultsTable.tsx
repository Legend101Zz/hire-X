'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    ColumnDef,
    SortingState,
    VisibilityState,
} from '@tanstack/react-table';
import {
    ChevronDown,
    ChevronUp,
    Download,
    Filter,
    Settings2,
    Check,
    X,
    Heart,
    ExternalLink,
    Sparkles,
    Award,
    Target,
    TrendingUp,
    Eye,
    EyeOff,
    Loader2
} from 'lucide-react';

interface ResultsTableProps {
    sessionId: string;
}

export default function ResultsTable({ sessionId }: ResultsTableProps) {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sorting, setSorting] = useState<SortingState>([{ id: 'total_score', desc: true }]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
    const [shortlistedProfiles, setShortlistedProfiles] = useState<Set<string>>(new Set());

    // Fetch results
    useEffect(() => {
        fetchResults();
        loadShortlistedProfiles();
    }, [sessionId]);

    const fetchResults = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/results`,
                {
                    headers: { 'Authorization': `Bearer ${token}` },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setResults(data);
            }
        } catch (error) {
            console.error('Error fetching results:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadShortlistedProfiles = () => {
        try {
            const shortlist = JSON.parse(localStorage.getItem('shortlistedProfiles') || '[]');
            setShortlistedProfiles(new Set(shortlist.map((p: any) => p.profile_id)));
        } catch (error) {
            console.error('Error loading shortlist:', error);
        }
    };

    const toggleShortlist = (profileId: string) => {
        try {
            const shortlist = JSON.parse(localStorage.getItem('shortlistedProfiles') || '[]');
            const newShortlisted = new Set(shortlistedProfiles);

            if (newShortlisted.has(profileId)) {
                const updated = shortlist.filter((p: any) => p.profile_id !== profileId);
                localStorage.setItem('shortlistedProfiles', JSON.stringify(updated));
                newShortlisted.delete(profileId);
            } else {
                const profile = results.results.find((p: any) => p.profile_id === profileId);
                shortlist.push({ ...profile, shortlistedAt: new Date().toISOString() });
                localStorage.setItem('shortlistedProfiles', JSON.stringify(shortlist));
                newShortlisted.add(profileId);
            }

            setShortlistedProfiles(newShortlisted);
            window.dispatchEvent(new CustomEvent('shortlistUpdated'));
        } catch (error) {
            console.error('Error toggling shortlist:', error);
        }
    };

    const columns = useMemo<ColumnDef<any>[]>(() => {
        if (!results) return [];

        const cols: ColumnDef<any>[] = [
            {
                id: 'rank',
                header: '#',
                cell: ({ row }) => (
                    <div className="flex items-center justify-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${row.index < 3
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700'
                            }`}>
                            {row.index + 1}
                        </div>
                    </div>
                ),
                size: 60,
                enableSorting: false,
            },
            {
                id: 'shortlist',
                header: '❤️',
                cell: ({ row }) => {
                    const isShortlisted = shortlistedProfiles.has(row.original.profile_id);
                    return (
                        <button
                            onClick={() => toggleShortlist(row.original.profile_id)}
                            className={`p-2 rounded-lg transition-all ${isShortlisted
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400'
                                }`}
                        >
                            <Heart className={`w-4 h-4 ${isShortlisted ? 'fill-current' : ''}`} />
                        </button>
                    );
                },
                size: 60,
                enableSorting: false,
            },
            {
                id: 'name',
                header: 'Name',
                accessorKey: 'profile_summary.name',
                cell: ({ row }) => {
                    const profile = row.original.profile_summary;
                    return (
                        <div className="min-w-[180px]">
                            <div className="font-semibold text-gray-900">{profile.name}</div>
                            <a
                                href={`https://linkedin.com${row.original.linkedin_url || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                            >
                                <ExternalLink className="w-3 h-3" />
                                LinkedIn
                            </a>
                        </div >
                    );
                },
                size: 200,
            },
            {
                id: 'title',
                header: 'Job Title',
                accessorKey: 'profile_summary.title',
                cell: ({ row }) => (
                    <div className="min-w-[200px]">
                        <div className="text-sm text-gray-900">{row.original.profile_summary.title}</div>
                    </div>
                ),
                size: 220,
            },
            {
                id: 'company',
                header: 'Company',
                accessorKey: 'profile_summary.industry',
                cell: ({ row }) => (
                    <div className="min-w-[150px]">
                        <div className="text-sm text-gray-700">{row.original.profile_summary.industry || 'N/A'}</div>
                    </div>
                ),
                size: 180,
            },
            {
                id: 'match',
                header: 'Match',
                accessorKey: 'score_percentage',
                cell: ({ row }) => {
                    const percentage = row.original.score_percentage;
                    const getColor = (pct: number) => {
                        if (pct >= 80) return 'bg-green-500';
                        if (pct >= 60) return 'bg-blue-500';
                        if (pct >= 40) return 'bg-yellow-500';
                        return 'bg-red-500';
                    };

                    return (
                        <div className="min-w-[100px]">
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getColor(percentage)} transition-all`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-gray-900 w-12 text-right">
                                    {percentage}%
                                </span>
                            </div>
                        </div>
                    );
                },
                size: 120,
            },
        ];

        // Add criterion columns
        if (results.search_criteria) {
            results.search_criteria.forEach((criterion: string) => {
                cols.push({
                    id: `criterion_${criterion}`,
                    header: criterion,
                    cell: ({ row }) => {
                        const match = row.original.criteria_matches?.[criterion];
                        if (!match) return <div className="text-center text-gray-400">-</div>;

                        return (
                            <div className="min-w-[100px] text-center">
                                {match.matched ? (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                                        <Check className="w-4 h-4" />
                                        <span className="text-sm font-semibold">
                                            {match.earned_points}/{match.max_points}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-500 rounded-lg">
                                        <X className="w-4 h-4" />
                                        <span className="text-sm">0/{match.max_points}</span>
                                    </div>
                                )}
                            </div>
                        );
                    },
                    size: 120,
                });
            });
        }

        // Expand column
        cols.push({
            id: 'expand',
            header: '',
            cell: ({ row }) => (
                <button
                    onClick={() => {
                        const newExpanded = new Set(expandedRows);
                        if (newExpanded.has(row.original.profile_id)) {
                            newExpanded.delete(row.original.profile_id);
                        } else {
                            newExpanded.add(row.original.profile_id);
                        }
                        setExpandedRows(newExpanded);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    {expandedRows.has(row.original.profile_id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                </button>
            ),
            size: 60,
            enableSorting: false,
        });

        return cols;
    }, [results, expandedRows, shortlistedProfiles]);

    const table = useReactTable({
        data: results?.results || [],
        columns,
        state: {
            sorting,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading results...</p>
                </div>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <p className="text-gray-600">No results found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
                <div className="px-8 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">Search Results</h1>
                            <p className="text-gray-600">{results.prompt}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                            >
                                <Settings2 className="w-4 h-4" />
                                Customize Columns
                            </button>
                            <button
                                onClick={() => alert('Export coming soon!')}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-600" />
                            <span className="text-gray-600">Total: </span>
                            <span className="font-bold text-gray-900">{results.total_matches}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-600" />
                            <span className="text-gray-600">Showing: </span>
                            <span className="font-bold text-gray-900">{results.results.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-600" />
                            <span className="text-gray-600">Shortlisted: </span>
                            <span className="font-bold text-gray-900">{shortlistedProfiles.size}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Column Customizer Panel */}
            <AnimatePresence>
                {showColumnCustomizer && (
                    <ColumnCustomizer
                        table={table}
                        onClose={() => setShowColumnCustomizer(false)}
                    />
                )}
            </AnimatePresence>

            {/* Table */}
            <div className="px-8 py-6">
                <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            {/* Header */}
                            <thead className="bg-gray-50 border-b-2 border-gray-200">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <th
                                                key={header.id}
                                                className="px-4 py-3 text-left border-r border-gray-200 last:border-r-0"
                                                style={{ width: header.getSize() }}
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <div
                                                        className={`flex items-center gap-2 ${header.column.getCanSort()
                                                            ? 'cursor-pointer select-none hover:text-blue-600'
                                                            : ''
                                                            }`}
                                                        onClick={header.column.getToggleSortingHandler()}
                                                    >
                                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                                            {flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                        </span>
                                                        {header.column.getCanSort() && header.column.getIsSorted() && (
                                                            <div className="text-blue-600">
                                                                {header.column.getIsSorted() === 'asc' ? (
                                                                    <ChevronUp className="w-4 h-4" />
                                                                ) : (
                                                                    <ChevronDown className="w-4 h-4" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>

                            {/* Body */}
                            <tbody className="divide-y divide-gray-200">
                                {table.getRowModel().rows.map((row, index) => (
                                    <>
                                        <motion.tr
                                            key={row.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.02 }}
                                            className="hover:bg-blue-50/30 transition-colors"
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <td
                                                    key={cell.id}
                                                    className="px-4 py-3 border-r border-gray-100 last:border-r-0"
                                                    style={{ width: cell.column.getSize() }}
                                                >
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </motion.tr>

                                        {/* Expanded Row */}
                                        <AnimatePresence>
                                            {expandedRows.has(row.original.profile_id) && (
                                                <motion.tr
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="bg-gradient-to-r from-blue-50 to-purple-50"
                                                >
                                                    <td colSpan={columns.length} className="px-4 py-6 border-r border-gray-100">
                                                        <ExpandedRowContent profile={row.original} />
                                                    </td>
                                                </motion.tr>
                                            )}
                                        </AnimatePresence>
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Column Customizer Component
function ColumnCustomizer({ table, onClose }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-8 mb-4 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Customize Columns
                </h3>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                    <X className="w-4 h-4 text-gray-500" />
                </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
                {table.getAllLeafColumns().map((column: any) => {
                    if (['rank', 'shortlist', 'expand'].includes(column.id)) return null;

                    return (
                        <label
                            key={column.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={column.getIsVisible()}
                                onChange={column.getToggleVisibilityHandler()}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                                {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                            </span>
                        </label>
                    );
                })}
            </div>
        </motion.div>
    );
}

// Expanded Row Content showing AI reasoning
function ExpandedRowContent({ profile }: { profile: any }) {
    return (
        <div className="space-y-4">
            {/* AI Summary */}
            {profile.summary && (
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-2">AI Analysis</h4>
                            <p className="text-sm text-gray-700 leading-relaxed">{profile.summary}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Match Breakdown */}
            {profile.criteria_matches && (
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        Match Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(profile.criteria_matches).map(([criterion, match]: [string, any]) => (
                            <div
                                key={criterion}
                                className={`p-3 rounded-lg border-2 ${match.matched
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {match.matched ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <X className="w-4 h-4 text-gray-400" />
                                        )}
                                        <span className="text-sm font-semibold text-gray-900">{criterion}</span>
                                    </div>
                                    <span className={`text-xs font-bold ${match.matched ? 'text-green-700' : 'text-gray-500'
                                        }`}>
                                        {match.earned_points}/{match.max_points}
                                    </span>
                                </div>
                                {match.reasoning && (
                                    <p className="text-xs text-gray-600 leading-relaxed mt-1">
                                        {match.reasoning}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}