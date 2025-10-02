/// TODO: JUST A COMING SOON PAGE FOR NOW
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserCircle, ArrowLeft, Star } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Sidebar from '@/components/ui/sidebar';

export default function ProfilesPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="flex min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50">
                <Sidebar />

                <div className="flex-1 ml-64 flex items-center justify-center p-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center max-w-2xl"
                    >
                        <motion.div
                            animate={{
                                rotate: [0, 360]
                            }}
                            transition={{
                                duration: 20,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                            className="inline-block mb-8"
                        >
                            <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl flex items-center justify-center shadow-2xl">
                                <UserCircle className="w-16 h-16 text-white" />
                            </div>
                        </motion.div>

                        <div className="relative mb-6">
                            <motion.div
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute -top-4 left-1/2 transform -translate-x-1/2"
                            >
                                <Star className="w-6 h-6 text-violet-400 fill-violet-400" />
                            </motion.div>
                        </div>

                        <h1 className="text-5xl font-bold text-gray-900 mb-4">
                            Coming Soon
                        </h1>

                        <p className="text-2xl text-indigo-600 mb-6">
                            Profile Management
                        </p>

                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            &quot;Every candidate has a story. We&lsquo;re building the ultimate canvas
                            to showcase their journey and help you find the perfect match.&quot;
                        </p>

                        <div className="w-full bg-gray-200 rounded-full h-2 mb-8 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "80%" }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-600"
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