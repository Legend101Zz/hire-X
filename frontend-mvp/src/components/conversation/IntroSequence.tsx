"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IntroSequenceProps {
    onComplete: () => void;
}

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
    const [step, setStep] = useState(0);
    const [showSkip, setShowSkip] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowSkip(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const steps = [
        {
            title: "Meet Donna! 👋",
            description:
                "Your AI recruitment co-pilot. I'll help you build the perfect candidate profile through conversation.",
            highlight: "home",
        },
        {
            title: "Build Your Profile 📝",
            description:
                "I'll guide you through defining role requirements, skills, and preferences - like working together on a resume.",
            highlight: "profile",
        },
        {
            title: "See Live Examples 🎯",
            description:
                "As we talk, I'll show you matching candidates in real-time so you can refine your requirements.",
            highlight: "sample",
        },
        {
            title: "Chat Naturally 💬",
            description:
                "Just tell me what you're looking for in plain English. I'll handle the rest!",
            highlight: "chat",
        },
    ];

    const currentStep = steps[step];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            onComplete();
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-[100] bg-gray-950/95 backdrop-blur-xl flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="max-w-2xl mx-auto px-8 text-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        {/* Icon */}
                        <motion.div
                            animate={{
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, -5, 0],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                            }}
                            className="flex justify-center"
                        >
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/50">
                                <Sparkles className="w-12 h-12 text-white" />
                            </div>
                        </motion.div>

                        {/* Content */}
                        <div className="space-y-4">
                            <h2 className="text-4xl font-bold text-white">
                                {currentStep.title}
                            </h2>
                            <p className="text-xl text-gray-300 leading-relaxed">
                                {currentStep.description}
                            </p>
                        </div>

                        {/* Progress Dots */}
                        <div className="flex items-center justify-center gap-2">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-2 rounded-full transition-all ${idx === step
                                            ? "w-8 bg-amber-400"
                                            : "w-2 bg-gray-600"
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center justify-center gap-4 pt-4">
                            {showSkip && step < steps.length - 1 && (
                                <Button
                                    variant="ghost"
                                    onClick={onComplete}
                                    className="text-gray-400 hover:text-white"
                                >
                                    Skip Tour
                                </Button>
                            )}

                            <Button
                                onClick={handleNext}
                                size="lg"
                                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-8"
                            >
                                {step < steps.length - 1 ? (
                                    <>
                                        Next
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </>
                                ) : (
                                    <>
                                        Let's Start!
                                        <Sparkles className="w-5 h-5 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}