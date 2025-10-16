'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import Sidebar from '@/components/ui/sidebar';
import ResultsTable from '@/components/results/ResultsTable';
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
        <div className="min-h-screen bg-white">
            <div className="flex">
                <Sidebar />
                <div className="flex-1 ml-64">
                    <ResultsTable sessionId={sessionId} />
                </div>
            </div>
        </div>
    );
}

export default function ResultsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        }>
            <ResultsPageContent />
        </Suspense>
    );
}