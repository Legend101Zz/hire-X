"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    X,
    ArrowRight,
    FileText,
    Users,
    MessageSquare,
    CheckCircle2,
    Target,
    Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface WizardStep {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    donnaPosition: "center" | "profile" | "sample" | "chat";
    donnaExpression: "waving" | "happy" | "excited" | "thinking";
    highlightArea?: "profile" | "sample" | "chat" | "input";
}

const wizardSteps: WizardStep[] = [
    {
        id: 1,
        title: "Welcome to Your AI-Powered Workspace! 🎉",
        description: "Hi! I'm Donna, your AI recruiting assistant. Let me show you around this powerful workspace where we'll find your perfect candidates together!",
        icon: <Sparkles className="w-6 h-6" />,
        donnaPosition: "center",
        donnaExpression: "waving",
    },
    {
        id: 2,
        title: "Build Your Ideal Candidate Profile",
        description: "This is where we'll craft your perfect candidate profile. As we chat, I'll automatically update this card with the requirements you mention - skills, experience, location, and more!",
        icon: <FileText className="w-6 h-6" />,
        donnaPosition: "profile",
        donnaExpression: "excited",
        highlightArea: "profile",
    },
    {
        id: 3,
        title: "See Matching Candidates in Real-Time",
        description: "Here, I'll show you candidates that match your requirements as we refine the profile. You can accept or reject them, and I'll learn from your feedback to find better matches!",
        icon: <Users className="w-6 h-6" />,
        donnaPosition: "sample",
        donnaExpression: "happy",
        highlightArea: "sample",
    },
    {
        id: 4,
        title: "Chat Naturally with Me",
        description: "Just tell me what you're looking for in plain English! No forms, no complicated filters. I'll understand what you need and help you find the right candidates.",
        icon: <MessageSquare className="w-6 h-6" />,
        donnaPosition: "chat",
        donnaExpression: "thinking",
        highlightArea: "chat",
    },
    {
        id: 5,
        title: "Your Personalized Search Input",
        description: "Type your requirements here - whether it's 'Find me a senior React developer in Mumbai' or 'Looking for someone with 5+ years in fintech'. I'll handle the rest!",
        icon: <Zap className="w-6 h-6" />,
        donnaPosition: "chat",
        donnaExpression: "excited",
        highlightArea: "input",
    },
    {
        id: 6,
        title: "Ready to Find Amazing Talent?",
        description: "That's it! We're ready to start. Just tell me about the role you're hiring for, and I'll help you build the perfect candidate profile. Let's find your next hire together! 🚀",
        icon: <CheckCircle2 className="w-6 h-6" />,
        donnaPosition: "center",
        donnaExpression: "waving",
    },
];

interface WizardGuideProps {
    onComplete: () => void;
    onSkip: () => void;
}

export default function WizardGuide({ onComplete, onSkip }: WizardGuideProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    const step = wizardSteps[currentStep];
    const isLastStep = currentStep === wizardSteps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            handleComplete();
        } else {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const handleComplete = () => {
        setIsExiting(true);
        setTimeout(() => {
            onComplete();
        }, 500);
    };

    const handleSkip = () => {
        setIsExiting(true);
        setTimeout(() => {
            onSkip();
        }, 500);
    };

    // Get spotlight position based on highlighted area
    const getSpotlightPosition = () => {
        switch (step.highlightArea) {
            case "profile":
                return { left: "12%", top: "40%", width: "28%", height: "60%" };
            case "sample":
                return { left: "38%", top: "40%", width: "28%", height: "60%" };
            case "chat":
                return { left: "64%", top: "40%", width: "28%", height: "60%" };
            case "input":
                return { left: "20%", top: "85%", width: "60%", height: "10%" };
            default:
                return null;
        }
    };

    const spotlightPosition = getSpotlightPosition();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isExiting ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
        >
            {/* Overlay with spotlight effect */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm">
                {/* Spotlight highlight */}
                <AnimatePresence mode="wait">
                    {spotlightPosition && (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="absolute rounded-2xl"
                            style={{
                                left: spotlightPosition.left,
                                top: spotlightPosition.top,
                                width: spotlightPosition.width,
                                height: spotlightPosition.height,
                                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 80px 40px rgba(251, 191, 36, 0.3)",
                                border: "3px solid rgba(251, 191, 36, 0.5)",
                            }}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Wizard Card */}
            <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative z-10 max-w-2xl w-full mx-4"
            >
                {/* Main Card */}
                <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-2 border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden">
                    {/* Animated gradient border */}
                    <motion.div
                        className="absolute inset-0 rounded-3xl"
                        style={{
                            background: "linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.2), transparent)",
                        }}
                        animate={{
                            x: ["-100%", "200%"],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    />

                    {/* Close button */}
                    <button
                        onClick={handleSkip}
                        className="absolute top-6 right-6 z-20 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-colors group"
                    >
                        <X className="w-5 h-5 text-slate-400 group-hover:text-slate-200" />
                    </button>

                    {/* Content */}
                    <div className="relative p-8">
                        {/* Icon and Step Counter */}
                        <div className="flex items-center justify-between mb-6">
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: 0.2, type: "spring" }}
                                className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30"
                            >
                                {step.icon}
                            </motion.div>

                            <div className="text-sm text-slate-400">
                                Step {step.id} of {wizardSteps.length}
                            </div>
                        </div>

                        {/* Title */}
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-bold text-white mb-4"
                        >
                            {step.title}
                        </motion.h2>

                        {/* Description */}
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-lg text-slate-300 leading-relaxed mb-8"
                        >
                            {step.description}
                        </motion.p>

                        {/* Progress Bar */}
                        <div className="mb-8">
                            <div className="flex gap-2">
                                {wizardSteps.map((_, idx) => (
                                    <motion.div
                                        key={idx}
                                        className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-800"
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                                            initial={{ scaleX: 0 }}
                                            animate={{
                                                scaleX: idx <= currentStep ? 1 : 0,
                                            }}
                                            transition={{ duration: 0.5 }}
                                            style={{ transformOrigin: "left" }}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex items-center justify-between gap-4">
                            <Button
                                onClick={handlePrevious}
                                disabled={currentStep === 0}
                                variant="outline"
                                className="border-slate-700 hover:bg-slate-800 disabled:opacity-30"
                            >
                                Previous
                            </Button>

                            <div className="flex items-center gap-3">
                                {!isLastStep && (
                                    <Button
                                        onClick={handleSkip}
                                        variant="ghost"
                                        className="text-slate-400 hover:text-slate-200"
                                    >
                                        Skip Tour
                                    </Button>
                                )}

                                <Button
                                    onClick={handleNext}
                                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/20 px-8"
                                >
                                    {isLastStep ? (
                                        <>
                                            <span>Get Started</span>
                                            <Sparkles className="w-5 h-5 ml-2" />
                                        </>
                                    ) : (
                                        <>
                                            <span>Next</span>
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Keyboard shortcuts hint */}
                        <div className="mt-6 pt-6 border-t border-slate-800/50 flex items-center justify-center gap-4 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded font-mono">
                                    ←
                                </kbd>
                                <span>Previous</span>
                            </div>
                            <div className="w-px h-3 bg-slate-700/50" />
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded font-mono">
                                    →
                                </kbd>
                                <span>Next</span>
                            </div>
                            <div className="w-px h-3 bg-slate-700/50" />
                            <div className="flex items-center gap-2">
                                <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded font-mono">
                                    Esc
                                </kbd>
                                <span>Skip</span>
                            </div>
                        </div>
                    </div>

                    {/* Animated Donna peeking from corner */}
                    <motion.div
                        initial={{ x: 100, y: 100, opacity: 0 }}
                        animate={{
                            x: 0,
                            y: 0,
                            opacity: 1,
                            rotate: [-5, 5, -5],
                        }}
                        transition={{
                            duration: 0.6,
                            rotate: {
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }
                        }}
                        className="absolute -bottom-4 -right-4 w-32 h-32"
                    >
                        <div className="relative w-full h-full">
                            {/* Glow effect */}
                            <motion.div
                                className="absolute inset-0 bg-amber-500/30 rounded-full blur-xl"
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [0.3, 0.5, 0.3],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                }}
                            />
                            {/* Donna's orb */}
                            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl border-4 border-white/20">
                                <motion.div
                                    animate={{
                                        scale: [1, 1.1, 1],
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                    }}
                                >
                                    <Sparkles className="w-12 h-12 text-white drop-shadow-lg" />
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* Keyboard navigation */}
            <KeyboardNavigation
                onNext={handleNext}
                onPrevious={handlePrevious}
                onSkip={handleSkip}
                canGoPrevious={currentStep > 0}
            />
        </motion.div>
    );
}

// Keyboard navigation component
function KeyboardNavigation({
    onNext,
    onPrevious,
    onSkip,
    canGoPrevious
}: {
    onNext: () => void;
    onPrevious: () => void;
    onSkip: () => void;
    canGoPrevious: boolean;
}) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight" || e.key === "Enter") {
                onNext();
            } else if (e.key === "ArrowLeft" && canGoPrevious) {
                onPrevious();
            } else if (e.key === "Escape") {
                onSkip();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onNext, onPrevious, onSkip, canGoPrevious]);

    return null;
}