'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    CheckCircle2,
    Calendar,
    Clock,
    Phone,
    Mail,
    ArrowRight,
    CalendarPlus
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { SchedulingLayout } from '@/components/scheduling/SchedulingLayout';
import { createGoogleCalendarUrl } from '@/utils/calendar';

export default function ConfirmationPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const token = params.token as string;
    const scheduleId = searchParams.get('id');

    // Get booking details from session storage (saved during booking)
    const [bookingDetails, setBookingDetails] = useState<any>(null);

    useEffect(() => {
        // Retrieve booking details from sessionStorage
        const savedDetails = sessionStorage.getItem('booking_details');
        if (savedDetails) {
            setBookingDetails(JSON.parse(savedDetails));
        }
    }, []);

    if (!bookingDetails) {
        return (
            <SchedulingLayout>
                <div className="max-w-xl mx-auto text-center py-20">
                    <p className="text-white/60">Loading confirmation...</p>
                </div>
            </SchedulingLayout>
        );
    }

    const startTime = parseISO(bookingDetails.scheduled_datetime);
    const formattedDate = format(startTime, 'EEEE, MMMM d, yyyy');
    const formattedTime = format(startTime, 'h:mm a');

    const handleAddToCalendar = () => {
        const calendarUrl = createGoogleCalendarUrl(
            `Interview: ${bookingDetails.job_title}`,
            bookingDetails.scheduled_datetime,
            bookingDetails.duration_minutes,
            `AI-powered voice interview for ${bookingDetails.job_title}${bookingDetails.company_name ? ` at ${bookingDetails.company_name}` : ''}.\n\nYou will receive a phone call at ${bookingDetails.phone_number} at the scheduled time.\n\nPlease ensure you're in a quiet location with good phone reception.\n\nBooking ID: ${scheduleId}`,
            'Phone Call'
        );

        window.open(calendarUrl, '_blank');
    };

    return (
        <SchedulingLayout>
            <div className="max-w-2xl mx-auto">
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
                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30"
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.3, type: "spring" }}
                    >
                        <CheckCircle2 className="w-10 h-10 text-white" />
                    </motion.div>
                </motion.div>

                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-center mb-8"
                >
                    <h1 className="text-2xl font-bold text-white mb-2">
                        Interview Confirmed
                    </h1>
                    <p className="text-[14px] text-white/60">
                        You're all set! Check your email for confirmation details.
                    </p>
                </motion.div>

                {/* Booking Details Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="border border-white/[0.08] rounded-xl overflow-hidden mb-6"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#0b6aff]/10 to-emerald-500/10 border-b border-white/[0.08] px-6 py-4">
                        <h2 className="text-base font-semibold text-white mb-1">
                            {bookingDetails.job_title}
                        </h2>
                        {bookingDetails.company_name && (
                            <p className="text-[13px] text-white/60">
                                {bookingDetails.company_name}
                            </p>
                        )}
                    </div>

                    {/* Details */}
                    <div className="p-6 space-y-4">
                        <InfoRow
                            icon={<Calendar className="w-4 h-4 text-[#0b6aff]" />}
                            label="Date & Time"
                            value={`${formattedDate} at ${formattedTime} IST`}
                        />
                        <InfoRow
                            icon={<Clock className="w-4 h-4 text-emerald-400" />}
                            label="Duration"
                            value={`${bookingDetails.duration_minutes} minutes`}
                        />
                        <InfoRow
                            icon={<Phone className="w-4 h-4 text-violet-400" />}
                            label="Phone Number"
                            value={bookingDetails.phone_number}
                        />
                        {bookingDetails.candidate_email && (
                            <InfoRow
                                icon={<Mail className="w-4 h-4 text-amber-400" />}
                                label="Confirmation Sent"
                                value={bookingDetails.candidate_email}
                            />
                        )}
                    </div>

                    {/* Notice */}
                    <div className="bg-[#0b6aff]/5 border-t border-[#0b6aff]/10 px-6 py-4">
                        <p className="text-[12px] text-white/60 leading-relaxed">
                            You'll receive an AI-powered voice call at your registered phone number. Please ensure you're in a quiet location with good reception.
                        </p>
                    </div>
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-3"
                >
                    <button
                        onClick={handleAddToCalendar}
                        className="w-full py-3.5 bg-[#0b6aff] hover:bg-[#0b6aff]/90 text-white text-[14px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0b6aff]/20"
                    >
                        <CalendarPlus className="w-5 h-5" />
                        Add to Google Calendar
                    </button>

                    <Link
                        href="/"
                        className="w-full py-3.5 text-white/60 text-[13px] rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        Back to Home
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </motion.div>

                {/* Tips */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-10 pt-8 border-t border-white/[0.08]"
                >
                    <h3 className="text-[13px] font-semibold text-white mb-4 text-center">
                        Interview Preparation Tips
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <TipCard
                            icon={<Phone className="w-5 h-5 text-[#0b6aff]" />}
                            title="Phone Ready"
                            description="Keep your phone charged and nearby"
                        />
                        <TipCard
                            icon={<Calendar className="w-5 h-5 text-emerald-400" />}
                            title="Quiet Space"
                            description="Find a quiet place with good reception"
                        />
                        <TipCard
                            icon={<Clock className="w-5 h-5 text-violet-400" />}
                            title="Be Prepared"
                            description="Review your experience beforehand"
                        />
                    </div>
                </motion.div>
            </div>
        </SchedulingLayout>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                {icon}
            </div>
            <div className="flex-1">
                <p className="text-[11px] text-white/40 font-medium mb-0.5">{label}</p>
                <p className="text-[13px] text-white">{value}</p>
            </div>
        </div>
    );
}

function TipCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
            <div className="mb-2">{icon}</div>
            <h4 className="text-[12px] font-semibold text-white mb-1">{title}</h4>
            <p className="text-[11px] text-white/50 leading-relaxed">{description}</p>
        </div>
    );
}