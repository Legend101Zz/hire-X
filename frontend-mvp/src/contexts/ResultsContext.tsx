/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ResultsContextType {
    searchSessionId: string | null;
    setSearchSessionId: (id: string | null) => void;
    candidates: any[];
    setCandidates: (candidates: any[]) => void;
    filters: any;
    setFilters: (filters: any) => void;
    sortBy: string;
    setSortBy: (sort: string) => void;
    currentPage: number;
    setCurrentPage: (page: number) => void;
}

const ResultsContext = createContext<ResultsContextType | undefined>(undefined);

export function ResultsProvider({ children }: { children: ReactNode }) {
    const [searchSessionId, setSearchSessionId] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [filters, setFilters] = useState<any>({});
    const [sortBy, setSortBy] = useState('match_score');
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <ResultsContext.Provider
            value={{
                searchSessionId,
                setSearchSessionId,
                candidates,
                setCandidates,
                filters,
                setFilters,
                sortBy,
                setSortBy,
                currentPage,
                setCurrentPage
            }}
        >
            {children}
        </ResultsContext.Provider>
    );
}

export function useResults() {
    const context = useContext(ResultsContext);
    if (!context) {
        throw new Error('useResults must be used within ResultsProvider');
    }
    return context;
}