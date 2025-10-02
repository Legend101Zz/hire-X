/// TODO: JUST A COMING SOON PAGE FOR NOW

'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, ArrowLeft, Sparkles } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/ui/sidebar';

export default function ContactsPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="flex min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
                <Sidebar />

                <div className="flex-1 ml-64 flex items-center justify-center p-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center max-w-2xl"
                    >
                        {/* Animated Icon */}
                        <motion.div
                            animate={{
                                rotate: [0, 5, -5, 0],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="inline-block mb-8"
                        >
                            <div className="w-32 h-32 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl">
                                <Users className="w-16 h-16 text-white" />
                            </div>
                        </motion.div>

                        {/* Sparkles */}
                        <div className="relative mb-6">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="absolute -top-4 left-1/2 transform -translate-x-1/2"
                            >
                                <Sparkles className="w-6 h-6 text-violet-400" />
                            </motion.div>
                        </div>

                        {/* Title */}
                        <h1 className="text-5xl font-bold text-gray-900 mb-4">
                            Coming Soon
                        </h1>

                        {/* Subtitle */}
                        <p className="text-2xl text-violet-600 mb-6">
                            Contacts Management
                        </p>

                        {/* Description */}
                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            &quot;Building the perfect rolodex takes time. We&apos;re crafting something special
                            to help you manage all your professional connections in one beautiful place.&quot;
                        </p>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-8 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "65%" }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-600"
                            />
                        </div>

                        {/* Back Button */}
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back to Home
                        </button>
                    </motion.div>
                </div>
            </div>
        </ProtectedRoute>
    );
}