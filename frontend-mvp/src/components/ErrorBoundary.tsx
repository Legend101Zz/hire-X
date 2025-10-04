'use client';

import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
                        <p className="text-gray-600 mb-4">Please refresh the page or try logging in again</p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false });
                                window.location.href = '/login';
                            }}
                            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}