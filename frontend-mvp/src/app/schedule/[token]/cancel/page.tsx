/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    AlertTriangle,
    XCircle,
    Loader2
} from 'lucide-react';
import Link from 'next/link';

import { useBooking } from '@/hooks/useScheduling';
import { SchedulingLayout } from '@/components/scheduling/SchedulingLayout';

export default function CancelPage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;

    const { cancel, loading, error } = useBooking(token);

    const [reason, setReason] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [cancelled, setCancelled] = useState(false);

    const handleCancel = async () => {
        if (!confirmed) return;

        try {
            await cancel(reason);
            setCancelled(true);
        } catch (err) {
            // Error handled in hook
        }
    };

    if (cancelled) {
        return (
            <SchedulingLayout>
                <div className="max-w-md mx-auto text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center"
                    >
                        <XCircle className="w-10 h-10 text-red-400" />
                    </motion.div>

                    <h1 className="text-2xl font-bold text-white mb-3">
                        Interview Cancelled
                    </h1>
                    <p className="text-[15px] text-white/60 mb-8">
                        Your interview has been cancelled. We're sorry to see you go.
                    </p>

                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 text-left">
                        <p className="text-[14px] text-white/70">
                            If you change your mind, you may be able to book a new interview
                            depending on position availability. Contact the recruiter for more information.
                        </p>
                    </div>
                </div>
            </SchedulingLayout>
        );
    }

    return (
        <SchedulingLayout>
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href={`/schedule/${token}`}
                        className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-white/60" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Cancel Interview</h1>
                        <p className="text-[14px] text-white/50">Are you sure you want to cancel?</p>
                    </div>
                </div>

                {/* Warning */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[14px] text-yellow-400 font-medium">Important</p>
                            <p className="text-[13px] text-white/70 mt-1">
                                Cancelling your interview may affect your application. Consider rescheduling
                                instead if you're unable to make the original time.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reason */}
                <div className="mb-6">
                    <label className="block text-[13px] text-white/60 mb-2">
                        Reason for cancellation (optional)
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        placeholder="Let us know why you're cancelling..."
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
                    />
                </div>

                {/* Confirmation Checkbox */}
                <label className="flex items-start gap-3 mb-6 cursor-pointer">
                    <div className="mt-0.5">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-all
              ${confirmed
                                ? 'bg-red-500 border-red-500'
                                : 'border-white/30 hover:border-white/50'
                            }
            `}>
                            {confirmed && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>
                    </div>
                    <span className="text-[14px] text-white/70">
                        I understand that cancelling may negatively impact my application
                    </span>
                </label>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-[14px] text-red-400">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <Link
                        href={`/schedule/${token}/reschedule`}
                        className="flex-1 py-3.5 bg-white/[0.06] border border-white/[0.08] text-white text-[14px] font-medium rounded-xl hover:bg-white/[0.1] transition-colors text-center"
                    >
                        Reschedule Instead
                    </Link>

                    <motion.button
                        whileHover={{ scale: confirmed ? 1.02 : 1 }}
                        whileTap={{ scale: confirmed ? 0.98 : 1 }}
                        onClick={handleCancel}
                        disabled={!confirmed || loading}
                        className="flex-1 py-3.5 bg-red-500 text-white text-[14px] font-medium rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Cancelling...
                            </>
                        ) : (
                            'Cancel Interview'
                        )}
                    </motion.button>
                </div>
            </div>
        </SchedulingLayout>
    );
}