import React from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Loader2,
    XCircle,
    AlertTriangle,
    Clock
} from 'lucide-react';

interface StatusIndicatorProps {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'warning';
    label?: string;
    size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
    pending: {
        icon: Clock,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
    },
    processing: {
        icon: Loader2,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-300',
        animate: true,
    },
    completed: {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
    },
    failed: {
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
    },
    warning: {
        icon: AlertTriangle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-300',
    },
};

const sizeConfig = {
    sm: { icon: 'w-3 h-3', container: 'w-6 h-6', text: 'text-xs' },
    md: { icon: 'w-4 h-4', container: 'w-8 h-8', text: 'text-sm' },
    lg: { icon: 'w-6 h-6', container: 'w-12 h-12', text: 'text-base' },
};

export default function StatusIndicator({
    status,
    label,
    size = 'md'
}: StatusIndicatorProps) {
    const config = statusConfig[status];
    const sizeStyle = sizeConfig[size];
    const Icon = config.icon;

    return (
        <div className="flex items-center gap-2">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`
          ${sizeStyle.container} 
          ${config.bgColor} 
          ${config.borderColor}
          border rounded-full flex items-center justify-center
        `}
            >
                <motion.div
                    animate={config.animate ? { rotate: 360 } : {}}
                    transition={config.animate ? {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear'
                    } : {}}
                >
                    <Icon className={`${sizeStyle.icon} ${config.color}`} />
                </motion.div>
            </motion.div>

            {label && (
                <span className={`${sizeStyle.text} font-medium ${config.color}`}>
                    {label}
                </span>
            )}
        </div>
    );
}