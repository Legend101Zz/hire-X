'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/ui/sidebar';
import ScorecardBuilder from '@/components/scorecard/ScorecardBuilder';
import { Loader2 } from 'lucide-react';

function ScorecardPageContent() {
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
        <ScorecardBuilder sessionId={sessionId} />
    );
}

export default function ScorecardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        }>
            <ScorecardPageContent />
        </Suspense>
    );
}