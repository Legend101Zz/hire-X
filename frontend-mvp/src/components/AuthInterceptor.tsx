'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export default function AuthInterceptor({ children }: { children: React.ReactNode }) {
    const { logout, } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Store the original fetch
        const originalFetch = window.fetch;

        // Override fetch globally to intercept 401 responses
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            // If we get a 401 on any API call to our backend
            if (response.status === 401 && args[0]?.toString().includes(API_BASE_URL)) {
                console.log('🔒 Authentication expired - redirecting to login');

                // Clear auth state and redirect
                logout();
                router.push('/login');
            }

            return response;
        };

        // Cleanup function to restore original fetch
        return () => {
            window.fetch = originalFetch;
        };
    }, [logout, router]);

    return <>{children}</>;
}