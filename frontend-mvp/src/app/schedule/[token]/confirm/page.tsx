
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    CheckCircle2,
    Calendar,
    Clock,
    MapPin,
    Mail,
    Phone,
    CalendarPlus,
    ArrowRight,
    Sparkles
} from 'lucide-react';

import { SchedulingLayout } from '@/components/scheduling/SchedulingLayout';

export default function ConfirmationPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const token = params.token as string;
    const scheduleId = searchParams.get('id');

    // In a real app, you'd fetch the booking details
    // For now, we'll show a generic confirmation

    return (
        <SchedulingLayout>
            <div className="max-w-xl mx-auto text-center">
                {/* Success Animation */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                        delay: 0.1
                    }}
                    className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center"
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.3, type: "spring" }}
                    >
                        <CheckCircle2 className="w-12 h-12 text-white" />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <h1 className="text-3xl font-bold text-white mb-3">
                        You're All Set! 🎉
                    </h1>
                    <p className="text-[16px] text-white/60 mb-8">
                        Your interview has been scheduled successfully.
                        We've sent a confirmation email with all the details.
                    </p>
                </motion.div>

                {/* Booking Details Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 mb-8 text-left"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                            <Sparkles className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-semibold text-white">Interview Confirmed</h3>
                            <p className="text-[13px] text-white/50">Booking ID: {scheduleId?.slice(0, 8) || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <InfoRow icon={Calendar} label="What's Next">
                            <span className="text-white">
                                You'll receive a phone call at the scheduled time
                            </span>
                        </InfoRow>

                        <InfoRow icon={Phone} label="Interview Type">
                            <span className="text-white">Voice Interview (Phone Call)</span>
                        </InfoRow>

                        <InfoRow icon={Mail} label="Confirmation">
                            <span className="text-white">Check your email for details</span>
                        </InfoRow>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-3"
                >
                    <button className="w-full py-3.5 bg-white/[0.06] border border-white/[0.08] text-white text-[14px] font-medium rounded-xl hover:bg-white/[0.1] transition-colors flex items-center justify-center gap-2">
                        <CalendarPlus className="w-5 h-5" />
                        Add to Calendar
                    </button>

                    <Link
                        href={`/schedule/${token}/reschedule`}
                        className="w-full py-3.5 bg-transparent text-white/60 text-[14px] rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        Need to reschedule?
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </motion.div>

                {/* Tips */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12 pt-8 border-t border-white/[0.08]"
                >
                    <h3 className="text-[14px] font-medium text-white mb-4">
                        Tips for Your Interview
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                        <TipCard
                            emoji="📱"
                            title="Be Ready"
                            description="Keep your phone charged and nearby"
                        />
                        <TipCard
                            emoji="🤫"
                            title="Quiet Space"
                            description="Find a quiet place with good reception"
                        />
                        <TipCard
                            emoji="📝"
                            title="Be Prepared"
                            description="Review your experience and achievements"
                        />
                    </div>
                </motion.div>
            </div>
        </SchedulingLayout>
    );
}

function InfoRow({
    icon: Icon,
    label,
    children
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 bg-white/[0.06] rounded-lg">
                <Icon className="w-4 h-4 text-white/60" />
            </div>
            <div>
                <p className="text-[12px] text-white/40">{label}</p>
                <div className="text-[14px]">{children}</div>
            </div>
        </div>
    );
}

function TipCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="text-2xl mb-2">{emoji}</div>
            <h4 className="text-[13px] font-medium text-white mb-1">{title}</h4>
            <p className="text-[12px] text-white/50">{description}</p>
        </div>
    );
}