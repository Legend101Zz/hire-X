'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Clock,
    MapPin,
    Building2,
    ChevronLeft,
    Check,
    Loader2,
    AlertCircle
} from 'lucide-react';

import { useSchedulingInfo, useBooking } from '@/hooks/useScheduling';
import { TimeSlot } from '@/types/scheduling';
import { SchedulingLayout } from '@/components/scheduling/SchedulingLayout';
import { JobHeader } from '@/components/scheduling/JobHeader';
import { CalendarView } from '@/components/scheduling/CalendarView';
import { TimeSlotPicker } from '@/components/scheduling/TimeSlotPicker';
import { BookingForm } from '@/components/scheduling/BookingForm';
import { SchedulingError } from '@/components/scheduling/SchedulingError';
import { SchedulingSkeleton } from '@/components/scheduling/SchedulingSkeleton';

type Step = 'date' | 'time' | 'confirm';

export default function SchedulingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = params.token as string;

    // Check for test mode in URL
    const testMode = searchParams.get('test') === 'true';

    const { info, loading, error, fetchInfo } = useSchedulingInfo(token, testMode);
    const { bookSlot, loading: booking } = useBooking(token);

    const [step, setStep] = useState<Step>('date');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [timezone, setTimezone] = useState<string>('Asia/Kolkata');

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    useEffect(() => {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(userTimezone);
    }, []);

    // Group slots by date
    const slotsByDate = useMemo(() => {
        if (!info?.available_slots) return {};

        return info.available_slots.reduce((acc, slot) => {
            const date = slot.date;
            if (!acc[date]) acc[date] = [];
            acc[date].push(slot);
            return acc;
        }, {} as Record<string, TimeSlot[]>);
    }, [info?.available_slots]);

    const availableDates = useMemo(() => {
        return Object.keys(slotsByDate).sort();
    }, [slotsByDate]);

    const slotsForDate = useMemo(() => {
        if (!selectedDate) return [];
        return slotsByDate[selectedDate] || [];
    }, [selectedDate, slotsByDate]);

    // Auto-select first date in test mode
    useEffect(() => {
        if (testMode && availableDates.length > 0 && !selectedDate) {
            setSelectedDate(availableDates[0]);
            setStep('time');
        }
    }, [testMode, availableDates, selectedDate]);

    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
        setSelectedSlot(null);
        setStep('time');
    };

    const handleSlotSelect = (slot: TimeSlot) => {
        setSelectedSlot(slot);
        setStep('confirm');
    };

    const handleBook = async (notes?: string, requirements?: string, phone?: string) => {
        if (!selectedSlot) return;

        try {
            const confirmation = await bookSlot({
                scheduled_datetime: selectedSlot.datetime,
                timezone,
                candidate_notes: notes,
                special_requirements: requirements,
                phone_number: phone,
            });

            router.push(`/schedule/${token}/confirm?id=${confirmation.schedule_id}`);
        } catch (err) {
            // Error handled in hook
        }
    };

    const handleBack = () => {
        if (step === 'time') {
            setStep('date');
            setSelectedSlot(null);
        } else if (step === 'confirm') {
            setStep('time');
        }
    };

    if (loading) {
        return (
            <SchedulingLayout>
                <SchedulingSkeleton />
            </SchedulingLayout>
        );
    }

    if (error || !info?.valid) {
        return (
            <SchedulingLayout>
                <SchedulingError
                    message={error || info?.error || 'Invalid scheduling link'}
                />
            </SchedulingLayout>
        );
    }

    return (
        <SchedulingLayout>
            <div className="max-w-4xl mx-auto">
                {/* Test Mode Banner */}
                {testMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4"
                    >
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-400" />
                            <div>
                                <p className="text-[14px] text-yellow-400 font-medium">
                                    🧪 Test Mode Active
                                </p>
                                <p className="text-[13px] text-white/60 mt-0.5">
                                    Interview slots available in the next 5 minutes for testing
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Job Header */}
                <JobHeader
                    jobTitle={info.job_title}
                    companyName={info.company_name}
                    duration={info.interview_duration_minutes}
                    candidateName={info.candidate_name}
                />

                {/* Progress Steps */}
                <ProgressSteps currentStep={step} />

                {/* Main Content */}
                <div className="mt-8">
                    <AnimatePresence mode="wait">
                        {step === 'date' && (
                            <motion.div
                                key="date"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <DateSelectionStep
                                    availableDates={availableDates}
                                    selectedDate={selectedDate}
                                    onSelectDate={handleDateSelect}
                                    timezone={timezone}
                                    onTimezoneChange={setTimezone}
                                />
                            </motion.div>
                        )}

                        {step === 'time' && (
                            <motion.div
                                key="time"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <TimeSelectionStep
                                    date={selectedDate!}
                                    slots={slotsForDate}
                                    selectedSlot={selectedSlot}
                                    onSelectSlot={handleSlotSelect}
                                    onBack={handleBack}
                                    duration={info.interview_duration_minutes}
                                />
                            </motion.div>
                        )}

                        {step === 'confirm' && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ConfirmationStep
                                    slot={selectedSlot!}
                                    jobTitle={info.job_title}
                                    companyName={info.company_name}
                                    duration={info.interview_duration_minutes}
                                    onConfirm={handleBook}
                                    onBack={handleBack}
                                    loading={booking}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </SchedulingLayout>
    );
}



// Progress Steps Component
function ProgressSteps({ currentStep }: { currentStep: Step }) {
    const steps = [
        { key: 'date', label: 'Select Date', icon: Calendar },
        { key: 'time', label: 'Choose Time', icon: Clock },
        { key: 'confirm', label: 'Confirm', icon: Check },
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
        <div className="flex items-center justify-center gap-2 mt-8">
            {steps.map((step, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                const Icon = step.icon;

                return (
                    <div key={step.key} className="flex items-center">
                        <div className="flex items-center gap-2">
                            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all
                ${isActive
                                    ? 'bg-white text-black'
                                    : isCompleted
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white/[0.06] text-white/40'
                                }
              `}>
                                {isCompleted ? (
                                    <Check className="w-5 h-5" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>
                            <span className={`
                text-[13px] font-medium hidden sm:block
                ${isActive ? 'text-white' : 'text-white/40'}
              `}>
                                {step.label}
                            </span>
                        </div>

                        {index < steps.length - 1 && (
                            <div className={`
                w-8 sm:w-16 h-px mx-3
                ${index < currentIndex ? 'bg-green-500' : 'bg-white/[0.1]'}
              `} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}



function DateSelectionStep({
    availableDates,
    selectedDate,
    onSelectDate,
    timezone,
    onTimezoneChange,
}: {
    availableDates: string[];
    selectedDate: string | null;
    onSelectDate: (date: string) => void;
    timezone: string;
    onTimezoneChange: (tz: string) => void;
}) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (availableDates.length > 0) {
            // Parse date safely - handle UTC dates
            const firstDate = availableDates[0];
            // Add 'T00:00:00' to ensure proper parsing
            return new Date(firstDate + 'T00:00:00');
        }
        return new Date();
    });

    const commonTimezones = [
        { value: 'Asia/Kolkata', label: 'India (IST)' },
        { value: 'America/New_York', label: 'New York (EST)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
        { value: 'Europe/London', label: 'London (GMT)' },
        { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
        { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    ];

    return (
        <div className="space-y-6">
            {/* Timezone Selector */}
            <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-white/40" />
                    <span className="text-[14px] text-white/60">Timezone</span>
                </div>
                <select
                    value={timezone}
                    onChange={(e) => onTimezoneChange(e.target.value)}
                    className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-[14px] text-white focus:outline-none focus:border-white/20"
                >
                    {commonTimezones.map(tz => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                </select>
            </div>

            {/* Calendar */}
            <CalendarView
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                availableDates={availableDates}
                selectedDate={selectedDate}
                onSelectDate={onSelectDate}
            />

            {/* Quick Date Selection */}
            <div>
                <h3 className="text-[13px] text-white/40 uppercase tracking-wide mb-3">
                    Available Dates
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {availableDates.slice(0, 8).map(date => {
                        // Safe date parsing
                        const dateObj = new Date(date + 'T00:00:00');
                        const isSelected = date === selectedDate;

                        // Check if date is valid
                        if (isNaN(dateObj.getTime())) {
                            console.error('Invalid date:', date);
                            return null;
                        }

                        return (
                            <motion.button
                                key={date}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onSelectDate(date)}
                                className={`
                  p-3 rounded-xl border text-center transition-all
                  ${isSelected
                                        ? 'bg-white text-black border-white'
                                        : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15]'
                                    }
                `}
                            >
                                <div className={`text-[12px] ${isSelected ? 'text-black/60' : 'text-white/40'}`}>
                                    {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                </div>
                                <div className={`text-lg font-semibold ${isSelected ? 'text-black' : 'text-white'}`}>
                                    {dateObj.getDate()}
                                </div>
                                <div className={`text-[12px] ${isSelected ? 'text-black/60' : 'text-white/40'}`}>
                                    {dateObj.toLocaleDateString('en-US', { month: 'short' })}
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function TimeSelectionStep({
    date,
    slots,
    selectedSlot,
    onSelectSlot,
    onBack,
    duration,
}: {
    date: string;
    slots: TimeSlot[];
    selectedSlot: TimeSlot | null;
    onSelectSlot: (slot: TimeSlot) => void;
    onBack: () => void;
    duration: number;
}) {
    // Safe date parsing
    const dateObj = new Date(date + 'T00:00:00');

    // Check if valid
    if (isNaN(dateObj.getTime())) {
        return (
            <div className="text-center py-12">
                <Clock className="w-12 h-12 text-red-400/20 mx-auto mb-4" />
                <p className="text-red-400">Invalid date selected</p>
                <button
                    onClick={onBack}
                    className="mt-4 text-[14px] text-blue-400 hover:text-blue-300"
                >
                    Go back
                </button>
            </div>
        );
    }

    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-white/60" />
                </button>
                <div>
                    <h2 className="text-xl font-semibold text-white">{formattedDate}</h2>
                    <p className="text-[14px] text-white/50">
                        Select a {duration}-minute time slot
                    </p>
                </div>
            </div>

            {/* Use TimeSlotPicker Component */}
            <TimeSlotPicker
                slots={slots}
                selectedSlot={selectedSlot}
                onSelectSlot={onSelectSlot}
                groupByTimeOfDay={true}
            />

            {slots.length === 0 && (
                <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">No available slots for this date</p>
                    <button
                        onClick={onBack}
                        className="mt-4 text-[14px] text-blue-400 hover:text-blue-300"
                    >
                        Choose another date
                    </button>
                </div>
            )}
        </div>
    );
}

// Updated ConfirmationStep using BookingForm component
function ConfirmationStep({
    slot,
    jobTitle,
    companyName,
    duration,
    onConfirm,
    onBack,
    loading,
}: {
    slot: TimeSlot;
    jobTitle: string;
    companyName: string | null;
    duration: number;
    onConfirm: (notes?: string, requirements?: string) => void;
    onBack: () => void;
    loading: boolean;
}) {
    const dateObj = new Date(slot.datetime);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-white/60" />
                </button>
                <div>
                    <h2 className="text-xl font-semibold text-white">Confirm Your Interview</h2>
                    <p className="text-[14px] text-white/50">Review and confirm your booking</p>
                </div>
            </div>

            {/* Booking Summary */}
            <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-2xl">
                        📅
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">{jobTitle}</h3>
                        {companyName && (
                            <p className="text-[14px] text-white/60 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                {companyName}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/[0.08] grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/[0.06] rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[12px] text-white/40">Date</p>
                            <p className="text-[14px] text-white font-medium">{formattedDate}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/[0.06] rounded-lg">
                            <Clock className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-[12px] text-white/40">Time</p>
                            <p className="text-[14px] text-white font-medium">
                                {slot.start_time} - {slot.end_time}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/[0.06] rounded-lg">
                            <MapPin className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-[12px] text-white/40">Timezone</p>
                            <p className="text-[14px] text-white font-medium">{slot.timezone}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Use BookingForm Component */}
            <BookingForm
                onSubmit={(notes, requirements, phone) => onConfirm(notes, requirements, phone)}
                loading={loading}
                duration={duration}
                requiresPhone={true}
            />
        </div>
    );
}