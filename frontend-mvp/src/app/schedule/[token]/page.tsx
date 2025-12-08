
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Clock,
    MapPin,
    Building2,
    ChevronLeft,
    ChevronRight,
    Check,
    Loader2
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
    const token = params.token as string;

    const { info, loading, error, fetchInfo } = useSchedulingInfo(token);
    const { bookSlot, loading: booking } = useBooking(token);

    const [step, setStep] = useState<Step>('date');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
    const [timezone, setTimezone] = useState<string>('Asia/Kolkata');

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    useEffect(() => {
        // Detect user timezone
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

    // Get available dates
    const availableDates = useMemo(() => {
        return Object.keys(slotsByDate).sort();
    }, [slotsByDate]);

    // Get slots for selected date
    const slotsForDate = useMemo(() => {
        if (!selectedDate) return [];
        return slotsByDate[selectedDate] || [];
    }, [selectedDate, slotsByDate]);

    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
        setSelectedSlot(null);
        setStep('time');
    };

    const handleSlotSelect = (slot: TimeSlot) => {
        setSelectedSlot(slot);
        setStep('confirm');
    };

    const handleBook = async (notes?: string, requirements?: string) => {
        if (!selectedSlot) return;

        try {
            const confirmation = await bookSlot({
                scheduled_datetime: selectedSlot.datetime,
                timezone,
                candidate_notes: notes,
                special_requirements: requirements,
            });

            // Redirect to confirmation page
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

// Date Selection Step
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
            return new Date(availableDates[0]);
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
                        const dateObj = new Date(date);
                        const isSelected = date === selectedDate;

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

// Time Selection Step
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
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    // Group slots by time of day
    const morningSlots = slots.filter(s => s.slot_type === 'morning');
    const afternoonSlots = slots.filter(s => s.slot_type === 'afternoon');
    const eveningSlots = slots.filter(s => s.slot_type === 'evening');

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

            {/* Time Slots */}
            <div className="space-y-6">
                {morningSlots.length > 0 && (
                    <TimeSlotGroup
                        label="Morning"
                        icon="🌅"
                        slots={morningSlots}
                        selectedSlot={selectedSlot}
                        onSelect={onSelectSlot}
                    />
                )}

                {afternoonSlots.length > 0 && (
                    <TimeSlotGroup
                        label="Afternoon"
                        icon="☀️"
                        slots={afternoonSlots}
                        selectedSlot={selectedSlot}
                        onSelect={onSelectSlot}
                    />
                )}

                {eveningSlots.length > 0 && (
                    <TimeSlotGroup
                        label="Evening"
                        icon="🌙"
                        slots={eveningSlots}
                        selectedSlot={selectedSlot}
                        onSelect={onSelectSlot}
                    />
                )}

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
        </div>
    );
}

function TimeSlotGroup({
    label,
    icon,
    slots,
    selectedSlot,
    onSelect,
}: {
    label: string;
    icon: string;
    slots: TimeSlot[];
    selectedSlot: TimeSlot | null;
    onSelect: (slot: TimeSlot) => void;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{icon}</span>
                <span className="text-[13px] text-white/40 uppercase tracking-wide">{label}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {slots.map(slot => {
                    const isSelected = selectedSlot?.slot_id === slot.slot_id;

                    return (
                        <motion.button
                            key={slot.slot_id}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onSelect(slot)}
                            disabled={!slot.is_available}
                            className={`
                py-3 px-4 rounded-xl text-[14px] font-medium transition-all border
                ${isSelected
                                    ? 'bg-white text-black border-white'
                                    : slot.is_available
                                        ? 'bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.08] hover:border-white/[0.15]'
                                        : 'bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed'
                                }
              `}
                        >
                            {slot.start_time}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}

// Confirmation Step
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
    const [notes, setNotes] = useState('');
    const [requirements, setRequirements] = useState('');

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

            {/* Additional Info */}
            <div className="space-y-4">
                <div>
                    <label className="block text-[13px] text-white/60 mb-2">
                        Special Requirements (optional)
                    </label>
                    <input
                        type="text"
                        value={requirements}
                        onChange={(e) => setRequirements(e.target.value)}
                        placeholder="e.g., Need screen reader support"
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                    />
                </div>

                <div>
                    <label className="block text-[13px] text-white/60 mb-2">
                        Additional Notes (optional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Anything you'd like us to know..."
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
                    />
                </div>
            </div>

            {/* Interview Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                        <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[14px] text-blue-400 font-medium">Interview Details</p>
                        <p className="text-[13px] text-white/60 mt-1">
                            This is a {duration}-minute voice interview. You'll receive a call at your
                            registered phone number at the scheduled time.
                        </p>
                    </div>
                </div>
            </div>

            {/* Confirm Button */}
            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onConfirm(notes, requirements)}
                disabled={loading}
                className="w-full py-4 bg-white text-black text-[15px] font-semibold rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Booking...
                    </>
                ) : (
                    <>
                        <Check className="w-5 h-5" />
                        Confirm Interview
                    </>
                )}
            </motion.button>

            <p className="text-center text-[12px] text-white/40">
                By confirming, you agree to be available at the scheduled time
            </p>
        </div>
    );
}