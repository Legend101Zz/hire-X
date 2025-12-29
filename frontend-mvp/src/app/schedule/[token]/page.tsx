'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

import { useSchedulingInfo, useBooking } from '@/hooks/useScheduling';
import { TimeSlot } from '@/types/scheduling';
import { SchedulingLayout } from '@/components/scheduling/SchedulingLayout';
import { JobHeader } from '@/components/scheduling/JobHeader';
import { CalendlyCalendar } from '@/components/scheduling/CalendlyCalendar';
import { ConfirmationStep } from '@/components/scheduling/ConfirmationStep';
import { SchedulingError } from '@/components/scheduling/SchedulingError';
import { SchedulingSkeleton } from '@/components/scheduling/SchedulingSkeleton';

type Step = 'select' | 'confirm';

export default function SchedulingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = params.token as string;

    const testMode = searchParams.get('test') === 'true';

    const { info, loading, error, fetchInfo } = useSchedulingInfo(token, testMode);
    const { bookSlot, loading: booking } = useBooking(token);

    const [step, setStep] = useState<Step>('select');
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    const handleSlotSelect = (slot: TimeSlot) => {
        setSelectedSlot(slot);
        setStep('confirm');
    };

    const handleBook = async (notes?: string, requirements?: string, phone?: string) => {
        if (!selectedSlot) return;

        try {
            // Remove spaces from phone number before sending
            const cleanedPhone = phone?.replace(/\s/g, '');

            const confirmation = await bookSlot({
                scheduled_datetime: selectedSlot.datetime,
                timezone: 'Asia/Kolkata', // Always use IST
                candidate_notes: notes,
                special_requirements: requirements,
                phone_number: cleanedPhone,
            });

            sessionStorage.setItem('booking_details', JSON.stringify({
                job_title: info?.job_title,
                company_name: info?.company_name,
                candidate_email: info?.candidate_email,
                scheduled_datetime: selectedSlot.datetime,
                duration_minutes: info?.interview_duration_minutes,
                phone_number: cleanedPhone,
                timezone: 'Asia/Kolkata'
            }));

            router.push(`/schedule/${token}/confirm?id=${confirmation.schedule_id}`);
        } catch (err) {
            // Error handled in hook
        }
    };

    const handleBack = () => {
        setStep('select');
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
            <div className="max-w-6xl mx-auto">
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
                        {step === 'select' && (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <CalendlyCalendar
                                    availableSlots={info.available_slots}
                                    selectedSlot={selectedSlot}
                                    onSelectSlot={handleSlotSelect}
                                    timezone="Asia/Kolkata"
                                    testMode={testMode}
                                />
                            </motion.div>
                        )}

                        {step === 'confirm' && selectedSlot && (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <ConfirmationStep
                                    slot={selectedSlot}
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

function ProgressSteps({ currentStep }: { currentStep: Step }) {
    const steps = [
        { key: 'select', label: 'Select Time', icon: Check },
        { key: 'confirm', label: 'Confirm Details', icon: Check },
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
                        <div className="flex items-center gap-2.5">
                            <div className={`
                                w-9 h-9 rounded-full flex items-center justify-center transition-all
                                ${isActive
                                    ? 'bg-white text-black shadow-lg shadow-white/20'
                                    : isCompleted
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white/[0.06] text-white/40'
                                }
                            `}>
                                {isCompleted ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <span className="text-sm font-semibold">{index + 1}</span>
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
                                w-12 sm:w-20 h-[2px] mx-3 transition-all
                                ${index < currentIndex ? 'bg-green-500' : 'bg-white/[0.1]'}
                            `} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}