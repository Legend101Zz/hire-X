
// frontend/src/components/pipeline/EmptyState.tsx
'use client';

import { motion } from 'framer-motion';
import { Search, Plus, AlertCircle, FileX } from 'lucide-react';

interface EmptyStateProps {
    type: 'no-pipelines' | 'no-candidates' | 'not-found' | 'error';
    onCreate?: () => void;
    onRetry?: () => void;
    message?: string;
}

export function EmptyState({ type, onCreate, onRetry, message }: EmptyStateProps) {
    const configs = {
        'no-pipelines': {
            icon: Plus,
            title: 'No pipelines yet',
            description: 'Create your first recruitment pipeline to start tracking candidates',
            action: onCreate ? { label: 'Create Pipeline', onClick: onCreate } : null,
        },
        'no-candidates': {
            icon: Search,
            title: 'No candidates found',
            description: 'Try adjusting your search or filters',
            action: null,
        },
        'not-found': {
            icon: FileX,
            title: 'Pipeline not found',
            description: 'This pipeline may have been deleted or you don\'t have access',
            action: null,
        },
        'error': {
            icon: AlertCircle,
            title: 'Something went wrong',
            description: message || 'Failed to load data. Please try again.',
            action: onRetry ? { label: 'Try Again', onClick: onRetry } : null,
        },
    };

    const config = configs[type];
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-20 text-center"
        >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/[0.04] flex items-center justify-center">
                <Icon className="w-10 h-10 text-white/20" />
            </div>

            <h3 className="text-lg font-medium text-white/80 mb-2">
                {config.title}
            </h3>

            <p className="text-[14px] text-white/40 mb-6 max-w-md mx-auto">
                {config.description}
            </p>

            {config.action && (
                <button
                    onClick={config.action.onClick}
                    className="px-5 py-2.5 bg-white text-black text-[14px] font-medium rounded-lg hover:bg-white/90 transition-colors"
                >
                    {config.action.label}
                </button>
            )}
        </motion.div>
    );
}