'use client';

import { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    ColumnDef,
    SortingState,
    ColumnFiltersState,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    Check,
    X,
    ExternalLink,
    Filter,
    Download,
    TrendingUp,
    Award,
    Target,
    MapPin,
    Briefcase,
    GraduationCap
} from 'lucide-react';

interface ResultsTableViewProps {
    results: any;
    onProfileClick: (profileId: string) => void;
}

export default function ResultsTableView({ results, onProfileClick }: ResultsTableViewProps) {
    const [sorting, setSorting] = useState<SortingState>([
        { id: 'total_score', desc: true }
    ]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Build columns dynamically based on search criteria
    const columns = useMemo<ColumnDef<any>[]>(() => {
        const baseColumns: ColumnDef<any>[] = [
            {
                id: 'rank',
                header: '#',
                cell: ({ row }) => (
                    <div className="text-center font-bold text-gray-900">
                        {row.index + 1}
                    </div>
                ),
                size: 60,
            },
            {
                id: 'candidate',
                header: 'Candidate',
                accessorKey: 'profile_summary.name',
                cell: ({ row }) => {
                    const profile = row.original.profile_summary;
                    return (
                        <div className="min-w-[200px]">
                            <button
                                onClick={() => onProfileClick(row.original.profile_id)}
                                className="text-left hover:bg-blue-50 rounded-lg p-2 -m-2 transition-colors group w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                        {profile.name}
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-sm text-gray-600 mt-1">{profile.title}</div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {profile.location}
                                    </span>
                                    {profile.current_industry && (
                                        <span className="flex items-center gap-1">
                                            <Briefcase className="w-3 h-3" />
                                            {profile.current_industry}
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    );
                },
                size: 300,
            },
            {
                id: 'total_score',
                header: 'AI Score',
                accessorKey: 'total_score',
                cell: ({ row }) => {
                    const score = row.original.total_score;
                    const maxScore = row.original.max_score;
                    const percentage = row.original.score_percentage;

                    return (
                        <div className="min-w-[120px]">
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-lg font-bold text-gray-900">
                                            {score}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            / {maxScore}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            className={`h-full ${percentage >= 80 ? 'bg-green-500' :
                                                    percentage >= 60 ? 'bg-blue-500' :
                                                        percentage >= 40 ? 'bg-yellow-500' :
                                                            'bg-red-500'
                                                }`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                },
                size: 150,
            },
        ];

        // Add criterion columns
        if (results.search_criteria && results.search_criteria.length > 0) {
            results.search_criteria.forEach((criterion: string) => {
                baseColumns.push({
                    id: `criterion_${criterion}`,
                    header: criterion,
                    cell: ({ row }) => {
                        const match = row.original.criteria_matches[criterion];
                        if (!match) return <div className="text-center text-gray-400">-</div>;

                        const percentage = match.percentage;

                        return (
                            <div className="min-w-[100px] px-2">
                                <div className="flex items-center justify-between">
                                    {match.matched ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                                <Check className="w-4 h-4 text-green-600" />
                                            </div>
                                            <span className="text-sm font-semibold text-green-700">
                                                {match.earned_points}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                                <X className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <span className="text-sm text-gray-400">0</span>
                                        </div>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        / {match.max_points}
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${match.matched ? 'bg-green-500' : 'bg-gray-300'}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    },
                    size: 150,
                });
            });
        }

        // Add expand column
        baseColumns.push({
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
            size: 50,
        });

        return baseColumns;
    }, [results.search_criteria, expandedRows, onProfileClick]);

    const table = useReactTable({
        data: results.results || [],
        columns,
        state: {
            sorting,
            columnFilters,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <div className="space-y-6">
            {/* Table Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-purple-600" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Top {results.results.length} Candidates
                        </h2>
                        <p className="text-sm text-gray-600">
                            Sorted by AI match score
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => alert('Export feature coming soon!')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                    <Download className="w-4 h-4" />
                    Export
                </button>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        {/* Table Header */}
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            className="px-4 py-4 text-left"
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
                                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                        {flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                    </span>
                                                    {header.column.getCanSort() && (
                                                        <div className="text-gray-400">
                                                            {{
                                                                asc: <ChevronUp className="w-4 h-4" />,
                                                                desc: <ChevronDown className="w-4 h-4" />,
                                                            }[header.column.getIsSorted() as string] ?? (
                                                                    <ChevronsUpDown className="w-4 h-4" />
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

                        {/* Table Body */}
                        <tbody className="divide-y divide-gray-100">
                            <AnimatePresence>
                                {table.getRowModel().rows.map((row, index) => (
                                    <motion.tr
                                        key={row.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-blue-50/30 transition-colors group"
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                className="px-4 py-4"
                                                style={{ width: cell.column.getSize() }}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        ))}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-gray-700">Match (>80%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span className="text-gray-700">Good (60-80%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-gray-700">Partial (40-60%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-gray-700">Weak (<40%)</span>
                        </div>
                    </div>
                    <span className="text-gray-600">
                        Click candidate name to view full profile
                    </span>
                </div>
            </div>
        </div>
    );
}