
'use client';

import { motion } from 'framer-motion';

interface SchedulingLayoutProps {
    children: React.ReactNode;
}

export function SchedulingLayout({ children }: SchedulingLayoutProps) {
    return (
        <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-gradient-to-br from-blue-500/10 via-transparent to-transparent rounded-full blur-3xl" />
                <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-gradient-to-tl from-purple-500/10 via-transparent to-transparent rounded-full blur-3xl" />
            </div>

            {/* Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
                    backgroundSize: '50px 50px'
                }}
            />

            {/* Header */}
            <header className="relative border-b border-white/[0.06]">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">N</span>
                            </div>
                            <span className="text-white font-semibold">Hire-X</span>
                        </div>
                        <span className="text-[13px] text-white/40">Interview Scheduling</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="relative px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {children}
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="relative border-t border-white/[0.06] mt-auto">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between text-[12px] text-white/30">
                        <span>Powered by Hire-X</span>
                        <div className="flex items-center gap-4">
                            <a href="#" className="hover:text-white/50">Privacy</a>
                            <a href="#" className="hover:text-white/50">Terms</a>
                            <a href="#" className="hover:text-white/50">Help</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}