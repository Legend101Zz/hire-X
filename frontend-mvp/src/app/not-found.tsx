'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-pink-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-2xl"
            >
                {/* Animated 404 Number */}
                <motion.div
                    animate={{
                        y: [0, -10, 0]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="mb-8"
                >
                    <h1 className="text-9xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                        404
                    </h1>
                </motion.div>

                {/* Search Icon */}
                <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="inline-block mb-6"
                >
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
                        <Search className="w-12 h-12 text-violet-600" />
                    </div>
                </motion.div>

                {/* Main Message */}
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Oops! No Candidates to Recruit Here
                </h2>

                {/* Subtext */}
                <p className="text-lg text-gray-600 mb-2">
                    Looks like this page went job-hopping without telling us!
                </p>
                <p className="text-md text-gray-500 mb-8">
                    The talent we&apos;re looking for isn&apos;t on this page—but we&apos;ve got plenty more where that came from.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-violet-600 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-violet-200"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Go Back
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        <Home className="w-5 h-5" />
                        Back to Home
                    </button>
                </div>

                {/* Brand */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12"
                >
                    <p className="text-2xl font-semibold text-violet-600">Hire-X hire</p>
                    <p className="text-sm text-gray-500 mt-2">Finding talent, even when pages get lost</p>
                </motion.div>
            </motion.div>
        </div>
    );
}