'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, Calendar, Clock, MapPin, Building2, Briefcase } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { TimeSlot } from '@/types/scheduling';
import { BookingForm } from './BookingForm';

interface ConfirmationStepProps {
    slot: TimeSlot;
    jobTitle: string;
    companyName: string | null;
    duration: number;
    onConfirm: (notes?: string, requirements?: string, phone?: string) => void;
    onBack: () => void;
    loading: boolean;
}

const IST_TIMEZONE = 'Asia/Kolkata';

export function ConfirmationStep({
    slot,
    jobTitle,
    companyName,
    duration,
    onConfirm,
    onBack,
    loading,
}: ConfirmationStepProps) {
    // Convert to IST for display
    const dateObj = parseISO(slot.datetime);
    const istDate = toZonedTime(dateObj, IST_TIMEZONE);

    const formattedDate = format(istDate, 'EEEE, MMMM d, yyyy');
    const formattedTime = `${slot.start_time} - ${slot.end_time}`;

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header with Back Button */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/[0.06] rounded-lg transition-all group"
                    aria-label="Go back"
                >
                    <ChevronLeft className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
                </button>
                <div>
                    <h2 className="text-lg font-semibold text-white">Confirm Interview</h2>
                    <p className="text-[12px] text-white/50">Review details and complete booking</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-[1fr,380px] gap-6">
                {/* Left: Booking Form */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <BookingForm
                        onSubmit={(notes, requirements, phone) => onConfirm(notes, requirements, phone)}
                        loading={loading}
                        duration={duration}
                        requiresPhone={true}
                    />
                </motion.div>

                {/* Right: Summary Card */}
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:order-first"
                >
                    <div className="sticky top-6">
                        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
                            {/* Job Header */}
                            <div className="p-5 border-b border-white/[0.06]">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#0b6aff]/10 flex items-center justify-center flex-shrink-0">
                                        <Briefcase className="w-5 h-5 text-[#0b6aff]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-white mb-0.5 leading-tight">
                                            {jobTitle}
                                        </h3>
                                        {companyName && (
                                            <p className="text-[12px] text-white/50 flex items-center gap-1.5">
                                                <Building2 className="w-3 h-3" />
                                                {companyName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Schedule Details */}
                            <div className="p-5 space-y-3">
                                <div className="text-[11px] text-white/40 uppercase tracking-wide font-semibold mb-3">
                                    Interview Details
                                </div>

                                <DetailRow
                                    icon={<Calendar className="w-4 h-4 text-[#0b6aff]" />}
                                    label="Date"
                                    value={formattedDate}
                                />
                                <DetailRow
                                    icon={<Clock className="w-4 h-4 text-emerald-400" />}
                                    label="Time"
                                    value={formattedTime}
                                />
                                <DetailRow
                                    icon={<MapPin className="w-4 h-4 text-violet-400" />}
                                    label="Timezone"
                                    value="Indian Standard Time"
                                />
                                <DetailRow
                                    icon={<Clock className="w-4 h-4 text-amber-400" />}
                                    label="Duration"
                                    value={`${duration} minutes`}
                                />
                            </div>

                            {/* AI Interview Notice */}
                            <div className="p-4 bg-[#0b6aff]/5 border-t border-[#0b6aff]/10">
                                <div className="flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-[#0b6aff] mt-1.5 flex-shrink-0" />
                                    <p className="text-[11px] text-white/60 leading-relaxed">
                                        This is an AI-powered voice interview. You'll receive a call at your registered number at the scheduled time.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3 py-1">
            <div className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0 mt-0.5">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/40 font-medium mb-0.5">
                    {label}
                </p>
                <p className="text-[13px] text-white font-medium leading-snug">
                    {value}
                </p>
            </div>
        </div>
    );
}