'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Clock, Phone } from 'lucide-react';

interface BookingFormProps {
    onSubmit: (notes?: string, requirements?: string, phone?: string) => void;
    loading?: boolean;
    duration: number;
    requiresPhone?: boolean;
}

export function BookingForm({
    onSubmit,
    loading,
    duration,
    requiresPhone = true  // Always ask for phone for interviews
}: BookingFormProps) {
    const [notes, setNotes] = useState('');
    const [requirements, setRequirements] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');

    const validatePhone = (value: string): boolean => {
        // Basic phone validation - adjust regex based on your needs
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        return phoneRegex.test(value.replace(/\s/g, ''));
    };

    const handlePhoneChange = (value: string) => {
        setPhone(value);
        if (value && !validatePhone(value)) {
            setPhoneError('Please enter a valid phone number');
        } else {
            setPhoneError('');
        }
    };

    const handleSubmit = () => {
        if (requiresPhone && !phone) {
            setPhoneError('Phone number is required for the interview');
            return;
        }

        if (requiresPhone && !validatePhone(phone)) {
            setPhoneError('Please enter a valid phone number');
            return;
        }

        onSubmit(notes || undefined, requirements || undefined, phone || undefined);
    };

    return (
        <div className="space-y-6">
            {/* Phone Number (Required for Interview) */}
            {requiresPhone && (
                <div>
                    <label className="block text-[13px] text-white/60 mb-2">
                        Phone Number <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Phone className="w-4 h-4 text-white/40" />
                        </div>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            placeholder="+91 98765 43210"
                            className={`w-full pl-11 pr-4 py-3 bg-white/[0.04] border rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 ${phoneError ? 'border-red-500/50' : 'border-white/[0.08]'
                                }`}
                        />
                    </div>
                    {phoneError && (
                        <p className="mt-1.5 text-[12px] text-red-400">{phoneError}</p>
                    )}
                    <p className="mt-1.5 text-[12px] text-white/40">
                        We'll call you on this number at the scheduled time
                    </p>
                </div>
            )}

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
                            This is a {duration}-minute voice interview. You&apos;ll receive a call at your
                            registered phone number at the scheduled time.
                        </p>
                    </div>
                </div>
            </div>

            {/* Confirm Button */}
            <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleSubmit}
                disabled={loading || (requiresPhone && (!phone || !!phoneError))}
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