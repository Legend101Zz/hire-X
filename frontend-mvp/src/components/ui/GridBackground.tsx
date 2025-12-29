'use client';

import { cn } from '@/lib/utils';

interface GridBackgroundProps {
    className?: string;
    children?: React.ReactNode;
}

export function GridBackground({ className, children }: GridBackgroundProps) {
    return (
        <div className={cn('relative min-h-screen w-full', className)}>
            {/* Base gradient */}
            <div className="fixed inset-0 bg-slate-950" />

            {/* Grid pattern */}
            <div
                className="fixed inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Radial gradient overlay */}
            <div
                className="fixed inset-0"
                style={{
                    background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(139, 92, 246, 0.1), transparent),
            radial-gradient(ellipse 50% 30% at 0% 100%, rgba(59, 130, 246, 0.08), transparent)
          `,
                }}
            />

            {/* Dot pattern overlay */}
            <div
                className="fixed inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.8) 1px, transparent 1px)`,
                    backgroundSize: '30px 30px',
                }}
            />

            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}

export default GridBackground;