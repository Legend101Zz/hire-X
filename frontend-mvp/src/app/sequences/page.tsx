/// TODO: JUST A COMING SOON PAGE FOR NOW
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Layers, ArrowLeft, Zap } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/ui/sidebar';

export default function SequencesPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="flex min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
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
                                y: [0, -10, 0]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="inline-block mb-8"
                        >
                            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-2xl">
                                <Layers className="w-16 h-16 text-white" />
                            </div>
                        </motion.div>

                        {/* Lightning Bolt */}
                        <div className="relative mb-6">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.6, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute -top-4 left-1/2 transform -translate-x-1/2"
                            >
                                <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                            </motion.div>
                        </div>

                        <h1 className="text-5xl font-bold text-gray-900 mb-4">
                            Coming Soon
                        </h1>

                        <p className="text-2xl text-purple-600 mb-6">
                            Recruitment Sequences
                        </p>

                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            &quot;Great sequences are like great conversations—they flow naturally.
                            We&apos;re automating the outreach so you can focus on the relationships.&quot;
                        </p>

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-8 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "45%" }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-purple-500 to-violet-600"
                            />
                        </div>

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