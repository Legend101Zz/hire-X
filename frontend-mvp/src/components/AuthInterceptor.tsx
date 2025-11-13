"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react"; // Or your preferred loading icon

// --- Config ---
const PUBLIC_ROUTES = ["/login", "/register"]; // Routes accessible without login
const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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

        // If user is NOT authenticated and is on a PROTECTED page
        if (!isAuthenticated && !isPublicPage) {
            router.push("/login"); // Redirect to login
        }

        // (Optional) If user IS authenticated and tries to visit a PUBLIC page
        if (isAuthenticated && isPublicPage) {
            router.push("/"); // Redirect to the main app (your search page)
        }
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
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
                <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                <p className="text-muted-foreground">Loading Your Session...</p>
            </div>
        );
    }

    // If auth is loaded and user is on a valid page, show the children
    const isPublicPage = PUBLIC_ROUTES.includes(pathname);
    if (
        (!isAuthenticated && isPublicPage) || // Unauthenticated on public page
        (isAuthenticated && !isPublicPage) // Authenticated on protected page
    ) {
        return <>{children}</>;
    }

    // Otherwise, return null while the redirect effect runs
    return null;
}