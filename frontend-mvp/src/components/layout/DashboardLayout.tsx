'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { user, isLoading } = useAuth();
    const router = useRouter();

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup'];
    const isPublicRoute = publicRoutes.includes(pathname);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !user && !isPublicRoute) {
            router.push('/login');
        }
    }, [user, isLoading, isPublicRoute, router]);

    // Show loading spinner while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't show header on public routes
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Don't render anything if not authenticated
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <Header />

            {/* Main Content with top padding for fixed header */}
            <main className="pt-20">
                {children}
            </main>
        </div>
    );
}