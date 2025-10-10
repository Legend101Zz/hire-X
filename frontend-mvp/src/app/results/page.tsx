'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import ResultsContent from '@/components/results/ResultsContent';
import { Loader2 } from 'lucide-react';

function ResultsPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sessionId = searchParams.get('session');

    useEffect(() => {
        if (!sessionId) {
            router.push('/');
        }
    }, [sessionId, router]);

    if (!sessionId) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex">
                <Sidebar />
                <div className="flex-1 ml-64">
                    <Header />
                    <ResultsContent sessionId={sessionId} />
                </div>
            </div>
        </div>
    );
}

export default function ResultsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        }>
            <ResultsPageContent />
        </Suspense>
    );
}