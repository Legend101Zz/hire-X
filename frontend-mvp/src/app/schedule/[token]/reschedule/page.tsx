
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    Calendar,
    Clock,
    AlertCircle,
    Loader2,
    RefreshCw
} from 'lucide-react';
import Link from 'next/link';

import { useSchedulingInfo, useBooking, useAvailableSlots } from '@/hooks/useScheduling';
import { TimeSlot } from '@/types/scheduling';
import { SchedulingLayout } from '@/components/scheduling/SchedulingLayout';
import { CalendarView } from '@/components/scheduling/CalendarView';

export default function ReschedulePage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;

    const { info, loading: infoLoading, fetchInfo } = useSchedulingInfo(token);
    const { slots, loading: slotsLoading, fetchSlots } = useAvailableSlots(token);
    const { reschedule, loading: rescheduling, error } = useBooking(token);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [reason, setReason] = useState('');
    const [reasonDetails, setReasonDetails] = useState('');
    const [step, setStep] = useState<'reason' | 'date' | 'time' | 'confirm'>('reason');

    useEffect(() => {
        fetchInfo();
        fetchSlots();
    }, [fetchInfo, fetchSlots]);

    // Group slots by date
    const slotsByDate = useMemo(() => {
        return slots.reduce((acc, slot) => {
            const date = slot.date;
            if (!acc[date]) acc[date] = [];
            acc[date].push(slot);
            return acc;
        }, {} as Record<string, TimeSlot[]>);
    }, [slots]);

    const availableDates = Object.keys(slotsByDate).sort();
    const slotsForDate = selectedDate ? slotsByDate[selectedDate] || [] : [];

    const handleReschedule = async () => {
        if (!selectedSlot) return;

        try {
            await reschedule(selectedSlot.datetime, reason, reasonDetails);
            router.push(`/schedule/${token}/confirm?rescheduled=true`);
        } catch (err) {
            // Error handled in hook
        }
    };

    const rescheduleReasons = [
        { value: 'candidate_request', label: 'Personal conflict', icon: '🙋' },
        { value: 'work_conflict', label: 'Work emergency', icon: '💼' },
        { value: 'health_issue', label: 'Health reasons', icon: '🏥' },
        { value: 'technical_issue', label: 'Technical issues', icon: '💻' },
        { value: 'other', label: 'Other reason', icon: '📝' },
    ];

    if (infoLoading) {
        return (
            <SchedulingLayout>
                <div className="max-w-xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-white/[0.06] rounded w-1/2" />
                        <div className="h-64 bg-white/[0.06] rounded-xl" />
                    </div>
                </div>
            </SchedulingLayout>
        );
    }

    return (
        <SchedulingLayout>
            <div className="max-w-xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href={`/schedule/${token}`}
                        className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-white/60" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Reschedule Interview</h1>
                        <p className="text-[14px] text-white/50">Choose a new time that works for you</p>
                    </div>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
                    >
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <p className="text-[14px] text-red-400">{error}</p>
                    </motion.div>
                )}

                {/* Step 1: Reason */}
                {step === 'reason' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <div>
                            <h2 className="text-[15px] font-medium text-white mb-3">
                                Why do you need to reschedule?
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {rescheduleReasons.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => {
                                            setReason(r.value);
                                            if (r.value !== 'other') {
                                                setStep('date');
                                            }
                                        }}
                                        className={`
                      p-4 rounded-xl border text-left transition-all flex items-center gap-3
                      ${reason === r.value
                                                ? 'bg-white/[0.08] border-white/20'
                                                : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                                            }
                    `}
                                    >
                                        <span className="text-xl">{r.icon}</span>
                                        <span className="text-[14px] text-white">{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {reason === 'other' && (
                            <div>
                                <label className="block text-[13px] text-white/60 mb-2">
                                    Please specify
                                </label>
                                <textarea
                                    value={reasonDetails}
                                    onChange={(e) => setReasonDetails(e.target.value)}
                                    rows={3}
                                    placeholder="Tell us why you need to reschedule..."
                                    className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
                                />
                                <button
                                    onClick={() => setStep('date')}
                                    disabled={!reasonDetails.trim()}
                                    className="mt-4 w-full py-3 bg-white text-black text-[14px] font-medium rounded-xl hover:bg-white/90 disabled:opacity-50 transition-colors"
                                >
                                    Continue
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Step 2: Date Selection */}
                {step === 'date' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <button
                            onClick={() => setStep('reason')}
                            className="flex items-center gap-2 text-[13px] text-white/50 hover:text-white/70"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        <h2 className="text-[15px] font-medium text-white">
                            Select a new date
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableDates.slice(0, 9).map(date => {
                                const dateObj = new Date(date);
                                const isSelected = date === selectedDate;

                                return (
                                    <motion.button
                                        key={date}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setSelectedDate(date);
                                            setStep('time');
                                        }}
                                        className={`
                      p-4 rounded-xl border text-center transition-all
                      ${isSelected
                                                ? 'bg-white text-black border-white'
                                                : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                                            }
                    `}
                                    >
                                        <div className={`text-[12px] ${isSelected ? 'text-black/60' : 'text-white/40'}`}>
                                            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </div>
                                        <div className={`text-2xl font-bold ${isSelected ? 'text-black' : 'text-white'}`}>
                                            {dateObj.getDate()}
                                        </div>
                                        <div className={`text-[12px] ${isSelected ? 'text-black/60' : 'text-white/40'}`}>
                                            {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Step 3: Time Selection */}
                {step === 'time' && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <button
                            onClick={() => setStep('date')}
                            className="flex items-center gap-2 text-[13px] text-white/50 hover:text-white/70"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        <h2 className="text-[15px] font-medium text-white">
                            Select a new time
                        </h2>

                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {slotsForDate.map(slot => {
                                const isSelected = selectedSlot?.slot_id === slot.slot_id;

                                return (
                                    <motion.button
                                        key={slot.slot_id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setSelectedSlot(slot);
                                            setStep('confirm');
                                        }}
                                        disabled={!slot.is_available}
                                        className={`
                      py-3 px-4 rounded-xl text-[14px] font-medium transition-all border
                      ${isSelected
                                                ? 'bg-white text-black border-white'
                                                : slot.is_available
                                                    ? 'bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.08]'
                                                    : 'bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed'
                                            }
                    `}
                                    >
                                        {slot.start_time}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Step 4: Confirm */}
                {step === 'confirm' && selectedSlot && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <button
                            onClick={() => setStep('time')}
                            className="flex items-center gap-2 text-[13px] text-white/50 hover:text-white/70"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                            <h2 className="text-[15px] font-medium text-white mb-4">
                                Confirm New Time
                            </h2>

                            <div className="flex items-center gap-4 p-4 bg-white/[0.04] rounded-xl">
                                <div className="p-3 bg-blue-500/10 rounded-xl">
                                    <Calendar className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-white">
                                        {new Date(selectedSlot.datetime).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-[14px] text-white/60">
                                        {selectedSlot.start_time} - {selectedSlot.end_time}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={handleReschedule}
                            disabled={rescheduling}
                            className="w-full py-4 bg-white text-black text-[15px] font-semibold rounded-xl hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {rescheduling ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Rescheduling...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    Confirm Reschedule
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                )}
            </div>
        </SchedulingLayout>
    );
}