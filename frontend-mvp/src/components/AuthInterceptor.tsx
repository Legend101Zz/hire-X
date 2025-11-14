"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

// --- Config ---
const PUBLIC_ROUTES = ["/login", "/register"]; // Routes accessible without login
const AUTH_REDIRECT_ROUTES = ["/login", "/register"]; // Routes that authenticated users should be redirected FROM
const DEFAULT_AUTHENTICATED_ROUTE = "/search"; // Where to redirect authenticated users trying to access auth pages
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function AuthInterceptor({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, isLoading, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    // --- 1. Page-Level Route Protection ---
    useEffect(() => {
        // Wait until the auth state is loaded
        if (isLoading) {
            return;
        }

        const isPublicPage = PUBLIC_ROUTES.includes(pathname);
        const isAuthPage = AUTH_REDIRECT_ROUTES.includes(pathname);

        // Case 1: Authenticated user trying to access login/register
        // Redirect them to the main app
        if (isAuthenticated && isAuthPage) {
            console.log("✅ Already authenticated - redirecting to app");
            router.push(DEFAULT_AUTHENTICATED_ROUTE);
            return;
        }

        // Case 2: Unauthenticated user trying to access protected page
        // Redirect them to login
        if (!isAuthenticated && !isPublicPage) {
            console.log("🔒 Not authenticated - redirecting to login");
            router.push("/login");
            return;
        }

        // Case 3: Valid access - do nothing
        // - Authenticated user on protected page ✅
        // - Unauthenticated user on public page ✅
    }, [isLoading, isAuthenticated, pathname, router]);

    // --- 2. API-Level 401 (Expired Token) Interceptor ---
    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            const response = await originalFetch(...args);

            // If we get a 401 on any API call to our backend
            if (
                response.status === 401 &&
                args[0]?.toString().includes(API_BASE_URL)
            ) {
                console.log("🔒 Authentication expired - redirecting to login");

                // Clear auth state and redirect
                logout();
                router.push("/login");
            }

            return response;
        };

        // Cleanup function to restore original fetch
        return () => {
            window.fetch = originalFetch;
        };
    }, [logout, router]);

    // --- 3. Render Logic ---

    // While loading, show a full-screen loader
    if (isLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-950">
                <Sparkles className="h-10 w-10 animate-pulse text-violet-500" />
                <p className="text-gray-400">Loading Your Session...</p>
            </div>
        );
    }

    // Show children for all valid cases
    // The useEffect above handles redirects, so if we reach here, access is valid
    return <>{children}</>;
}