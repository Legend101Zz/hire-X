
'use client';

export function SchedulingSkeleton() {
    return (
        <div className="max-w-4xl mx-auto animate-pulse">
            {/* Header */}
            <div className="bg-white/[0.04] rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-5">
                    <div className="w-16 h-16 rounded-xl bg-white/[0.08]" />
                    <div className="flex-1">
                        <div className="h-8 bg-white/[0.08] rounded w-2/3 mb-3" />
                        <div className="flex gap-4">
                            <div className="h-5 bg-white/[0.06] rounded w-24" />
                            <div className="h-5 bg-white/[0.06] rounded w-20" />
                            <div className="h-5 bg-white/[0.06] rounded w-28" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-4 mb-8">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-white/[0.08]" />
                        {i < 2 && <div className="w-16 h-px bg-white/[0.06] mx-3" />}
                    </div>
                ))}
            </div>

            {/* Calendar */}
            <div className="bg-white/[0.04] rounded-xl p-5">
                <div className="h-6 bg-white/[0.08] rounded w-40 mx-auto mb-6" />
                <div className="grid grid-cols-7 gap-2">
                    {[...Array(35)].map((_, i) => (
                        <div key={i} className="aspect-square rounded-lg bg-white/[0.04]" />
                    ))}
                </div>
            </div>
        </div>
    );
}