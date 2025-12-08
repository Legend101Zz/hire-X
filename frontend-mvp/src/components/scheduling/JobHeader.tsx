
'use client';

import { motion } from 'framer-motion';
import { Building2, Clock, User } from 'lucide-react';

interface JobHeaderProps {
    jobTitle: string;
    companyName: string | null;
    duration: number;
    candidateName: string;
}

export function JobHeader({ jobTitle, companyName, duration, candidateName }: JobHeaderProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/[0.1] rounded-2xl p-6"
        >
            <div className="flex items-start gap-5">
                {/* Icon */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">💼</span>
                </div>

                {/* Info */}
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white mb-1">{jobTitle}</h1>

                    <div className="flex flex-wrap items-center gap-4 mt-3">
                        {companyName && (
                            <div className="flex items-center gap-2 text-[14px] text-white/60">
                                <Building2 className="w-4 h-4" />
                                {companyName}
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-[14px] text-white/60">
                            <Clock className="w-4 h-4" />
                            {duration} minutes
                        </div>
                        <div className="flex items-center gap-2 text-[14px] text-white/60">
                            <User className="w-4 h-4" />
                            {candidateName}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}