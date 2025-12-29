/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Phone, AlertCircle } from 'lucide-react';

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
    requiresPhone = true
}: BookingFormProps) {
    const [notes, setNotes] = useState('');
    const [requirements, setRequirements] = useState('');
    const [phone, setPhone] = useState('+91 ');
    const [phoneError, setPhoneError] = useState('');

    const validatePhone = (value: string): boolean => {
        const cleaned = value.replace(/\s/g, '');
        const phoneRegex = /^\+91[6-9]\d{9}$/;
        return phoneRegex.test(cleaned);
    };

    const handlePhoneChange = (value: string) => {
        if (!value.startsWith('+91')) {
            value = '+91 ' + value.replace(/^\+?91?\s*/, '');
        }

        let cleaned = value.replace(/\s/g, '');
        if (cleaned.startsWith('+91') && cleaned.length > 3) {
            const digits = cleaned.substring(3);
            if (digits.length <= 5) {
                cleaned = '+91 ' + digits;
            } else {
                cleaned = '+91 ' + digits.substring(0, 5) + ' ' + digits.substring(5, 10);
            }
        }

        setPhone(cleaned);

        const cleanedForValidation = cleaned.replace(/\s/g, '');
        if (cleanedForValidation.length === 13) {
            if (!validatePhone(cleanedForValidation)) {
                setPhoneError('Please enter a valid Indian mobile number');
            } else {
                setPhoneError('');
            }
        } else if (cleanedForValidation.length > 3) {
            setPhoneError('');
        }
    };

    const handleSubmit = () => {
        if (requiresPhone && !phone.trim()) {
            setPhoneError('Phone number is required');
            return;
        }

        const cleanedPhone = phone.replace(/\s/g, '');
        if (requiresPhone && !validatePhone(cleanedPhone)) {
            setPhoneError('Please enter a valid 10-digit mobile number');
            return;
        }

        onSubmit(notes || undefined, requirements || undefined, cleanedPhone || undefined);
    };

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-sm font-semibold text-white mb-4">Contact Information</h3>

                {/* Phone Number */}
                {requiresPhone && (
                    <div>
                        <label className="block text-[12px] text-white/60 font-medium mb-2">
                            Mobile Number <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Phone className="w-4 h-4 text-white/40" />
                            </div>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="+91 98765 43210"
                                className={`
                                    w-full pl-10 pr-4 py-3 
                                    bg-white/[0.03] border rounded-lg 
                                    text-[13px] text-white placeholder-white/30 
                                    focus:outline-none focus:ring-2 focus:ring-[#0b6aff]/50
                                    transition-all
                                    ${phoneError
                                        ? 'border-red-500/50'
                                        : 'border-white/[0.08] focus:border-[#0b6aff]/50'
                                    }
                                `}
                            />
                        </div>
                        {phoneError ? (
                            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-400">
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>{phoneError}</span>
                            </div>
                        ) : (
                            <p className="mt-2 text-[11px] text-white/40">
                                We'll call this number at the scheduled time
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Additional Information */}
            <div>
                <h3 className="text-sm font-semibold text-white mb-4">Additional Information</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[12px] text-white/60 font-medium mb-2">
                            Special Requirements <span className="text-white/30">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            placeholder="e.g., Preferred language, accessibility needs"
                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#0b6aff]/50 focus:border-[#0b6aff]/50 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-[12px] text-white/60 font-medium mb-2">
                            Notes <span className="text-white/30">(optional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Any additional information you'd like to share..."
                            className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#0b6aff]/50 focus:border-[#0b6aff]/50 resize-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Confirm Button */}
            <motion.button
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
                onClick={handleSubmit}
                disabled={loading || (requiresPhone && (!phone || !!phoneError))}
                className="w-full py-3.5 bg-[#0b6aff] text-white text-[14px] font-semibold rounded-lg hover:bg-[#0b6aff]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0b6aff]/20"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Confirming...
                    </>
                ) : (
                    <>
                        <Check className="w-4 h-4" />
                        Confirm Interview
                    </>
                )}
            </motion.button>

            <p className="text-center text-[10px] text-white/30 leading-relaxed">
                By confirming, you agree to be available at the scheduled time in IST
            </p>
        </div>
    );
}