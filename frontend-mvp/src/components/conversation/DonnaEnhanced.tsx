"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles, Heart } from "lucide-react";

type BotExpression = "neutral" | "happy" | "thinking" | "excited" | "peek" | "waving";
type BotPosition = "home" | "chat" | "profile" | "sample" | "intro1" | "intro2" | "intro3";

interface DonnaEnhancedProps {
    position: BotPosition;
    expression: BotExpression;
    isThinking?: boolean;
    speechBubble?: string;
    showSpeech?: boolean;
}

export default function DonnaEnhanced({
    position,
    expression,
    isThinking = false,
    speechBubble,
    showSpeech = false,
}: DonnaEnhancedProps) {
    const [eyeState, setEyeState] = useState<"open" | "blink">("open");
    const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);
    const [mounted, setMounted] = useState(false);
    const [positions, setPositions] = useState({
        home: { x: 50, y: 100 },
        chat: { x: 400, y: 500 },
        profile: { x: 300, y: 300 },
        sample: { x: 600, y: 300 },
        intro1: { x: 200, y: 200 },
        intro2: { x: 500, y: 200 },
        intro3: { x: 800, y: 200 },
    });
    const [isHovered, setIsHovered] = useState(false);
    const [isClicked, setIsClicked] = useState(false);
    const [giggleCount, setGiggleCount] = useState(0);

    useEffect(() => {
        setMounted(true);

        const updatePositions = () => {
            setPositions({
                home: { x: window.innerWidth - 320, y: window.innerHeight - 120 },
                chat: { x: window.innerWidth / 2, y: window.innerHeight - 180 },
                profile: { x: 280, y: 350 },
                sample: { x: window.innerWidth / 2 + 20, y: 350 },
                intro1: { x: 280, y: 280 },
                intro2: { x: window.innerWidth / 2 + 20, y: 280 },
                intro3: { x: window.innerWidth - 300, y: 280 },
            });
        };

        updatePositions();
        window.addEventListener("resize", updatePositions);
        return () => window.removeEventListener("resize", updatePositions);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const blinkInterval = setInterval(() => {
            if (expression !== "peek") {
                setEyeState("blink");
                setTimeout(() => setEyeState("open"), 150);
            }
        }, 3000 + Math.random() * 2000);

        return () => clearInterval(blinkInterval);
    }, [expression, mounted]);

    useEffect(() => {
        if (!mounted || position === "home" || isHovered) return;

        const interval = setInterval(() => {
            setSparkles((prev) => [
                ...prev.slice(-8), // Keep only last 8 sparkles for performance
                {
                    id: Date.now(),
                    x: positions[position].x + (Math.random() - 0.5) * 40,
                    y: positions[position].y + (Math.random() - 0.5) * 40,
                },
            ]);
        }, 120); // More frequent sparkles

        return () => clearInterval(interval);
    }, [position, mounted, positions, isHovered]);

    // Add cleanup for sparkles
    useEffect(() => {
        const cleanup = setInterval(() => {
            setSparkles((prev) => prev.filter((s) => Date.now() - s.id < 2000));
        }, 500);

        return () => clearInterval(cleanup);
    }, []);

    const getEyePath = (): string => {
        // Fallback default path
        const defaultPath = "M4,7 Q8,5 12,7";

        if (!mounted) return defaultPath;
        if (eyeState === "blink") return "M4,8 L12,8";

        switch (expression) {
            case "happy":
                return "M4,6 Q8,10 12,6";
            case "thinking":
                return "M4,8 L12,8";
            case "excited":
                return "M4,5 Q8,2 12,5";
            case "peek":
                return "M4,8 C6,6 10,6 12,8";
            case "waving":
                return "M4,7 Q8,4 12,7";
            case "neutral":
            default:
                return defaultPath;
        }
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        setGiggleCount((prev) => prev + 1);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleClick = () => {
        setIsClicked(true);
        setGiggleCount(0);

        // Reset after animation
        setTimeout(() => {
            setIsClicked(false);
        }, 1000);
    };

    if (!mounted) return null;

    return (
        <>
            {/* Enhanced Sparkle Trail */}
            <AnimatePresence>
                {sparkles.map((sparkle, index) => (
                    <motion.div
                        key={sparkle.id}
                        className="fixed pointer-events-none z-40"
                        style={{ left: sparkle.x, top: sparkle.y }}
                        initial={{ opacity: 0.8, scale: 1 }}
                        animate={{
                            opacity: 0,
                            scale: 0,
                            y: [0, -20] // Float upward
                        }}
                        exit={{ opacity: 0 }}
                        transition={{
                            duration: 1.5,
                            ease: "easeOut"
                        }}
                    >
                        <Sparkles
                            className="w-3 h-3 text-amber-400"
                            fill="currentColor"
                            style={{
                                filter: `hue-rotate(${index * 30}deg)` // Rainbow trail
                            }}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* The Bot - Now Interactive */}
            <motion.div
                className="fixed z-50 cursor-pointer"
                animate={{
                    x: positions[position].x,
                    y: positions[position].y,
                }}
                transition={{
                    type: "spring",
                    stiffness: isHovered ? 300 : 120, // Stiffer when hovered (stays in place)
                    damping: isHovered ? 30 : 18,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                {/* Enhanced Glow */}
                <motion.div
                    className="absolute inset-0 -z-10"
                    animate={{
                        scale: isThinking ? [1, 1.4, 1] : isHovered ? 1.2 : 1,
                        opacity: isThinking ? [0.5, 0.8, 0.5] : isHovered ? 0.8 : 0.6,
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: isThinking ? Infinity : 0,
                    }}
                >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 blur-2xl" />
                </motion.div>

                {/* Waving Hand Animation */}
                {expression === "waving" && (
                    <motion.div
                        className="absolute -top-8 -right-2"
                        animate={{
                            rotate: [0, 14, -8, 14, -4, 10, 0],
                        }}
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            repeatDelay: 0.3,
                        }}
                    >
                        <span className="text-4xl">👋</span>
                    </motion.div>
                )}

                {/* Bot Body - Amber/Orange Theme */}
                <motion.div
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-2xl flex items-center justify-center border-4 border-amber-300/50 backdrop-blur-sm"
                    animate={{
                        rotate: isThinking
                            ? [0, 6, -6, 0]
                            : isHovered
                                ? [0, -5, 5, -5, 5, 0] // Giggle wiggle
                                : isClicked
                                    ? [0, 15, -15, 10, -10, 0] // Happy bounce
                                    : 0,
                        scale: expression === "excited"
                            ? [1, 1.15, 1]
                            : isClicked
                                ? [1, 1.3, 1.1, 1] // Pop on click
                                : isHovered
                                    ? 1.1 // Slightly bigger on hover
                                    : 1,
                        boxShadow: [
                            "0 20px 60px rgba(251, 191, 36, 0.4)",
                            isHovered ? "0 30px 80px rgba(251, 191, 36, 0.8)" : "0 25px 70px rgba(251, 191, 36, 0.6)",
                            "0 20px 60px rgba(251, 191, 36, 0.4)",
                        ],
                    }}
                    transition={{
                        rotate: {
                            duration: isHovered ? 0.4 : isClicked ? 0.5 : 0.5,
                            repeat: isThinking ? Infinity : 0,
                        },
                        scale: {
                            duration: isClicked ? 0.5 : 0.3,
                            repeat: expression === "excited" ? Infinity : 0,
                        },
                        boxShadow: {
                            duration: 2,
                            repeat: Infinity,
                        },
                    }}
                >
                    {/* Face Container */}
                    <svg width="40" height="40" viewBox="0 0 32 32" className="relative z-10">
                        {/* Left Eye */}
                        <motion.path
                            d={getEyePath()}
                            stroke="white"
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                            animate={{ d: getEyePath() }}
                            transition={{ duration: 0.2 }}
                        />

                        {/* Right Eye */}
                        <motion.path
                            d={getEyePath()}
                            transform="translate(12, 0)"
                            stroke="white"
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                            animate={{ d: getEyePath() }}
                            transition={{ duration: 0.2 }}
                        />

                        {/* Mouth */}
                        {(expression === "happy" || expression === "excited" || isHovered || isClicked) && (
                            <motion.path
                                d="M8,18 Q16,23 24,18"
                                stroke="white"
                                strokeWidth="2.5"
                                fill="none"
                                strokeLinecap="round"
                                initial={{ opacity: 0, pathLength: 0 }}
                                animate={{ opacity: 1, pathLength: 1 }}
                                transition={{ duration: 0.4 }}
                            />
                        )}
                    </svg>

                    {/* Thinking Indicator */}
                    {isThinking && (
                        <motion.div
                            className="absolute -right-8 top-0 flex gap-1.5"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-white rounded-full shadow-lg"
                                    animate={{
                                        y: [-3, 3, -3],
                                        opacity: [1, 0.5, 1],
                                    }}
                                    transition={{
                                        duration: 0.6,
                                        repeat: Infinity,
                                        delay: i * 0.15,
                                    }}
                                />
                            ))}
                        </motion.div>
                    )}

                    {/* Excited Sparkles */}
                    {expression === "excited" && (
                        <>
                            <motion.div
                                className="absolute -top-3 -right-3"
                                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                                <Sparkles className="w-6 h-6 text-yellow-300" fill="currentColor" />
                            </motion.div>
                            <motion.div
                                className="absolute -bottom-2 -left-2"
                                animate={{ rotate: -360, scale: [1, 1.1, 1] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                            >
                                <Heart className="w-5 h-5 text-pink-400" fill="currentColor" />
                            </motion.div>
                        </>
                    )}
                </motion.div>

                {/* Main Speech Bubble */}
                <AnimatePresence>
                    {showSpeech && speechBubble && (
                        <motion.div
                            className="absolute left-24 top-0 pointer-events-none z-50"
                            initial={{ opacity: 0, scale: 0.8, x: -20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8, x: -20 }}
                        >
                            <div className="relative bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl px-6 py-4 max-w-sm border-2 border-amber-200/50 backdrop-blur-md">
                                {/* Arrow */}
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2">
                                    <div className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-r-[12px] border-r-amber-200/50" />
                                    <div className="absolute top-0 left-[3px] w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-r-[12px] border-r-white" />
                                </div>

                                <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                                    {speechBubble}
                                </p>

                                {/* Animated Background */}
                                <motion.div
                                    className="absolute inset-0 -z-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl opacity-50"
                                    animate={{
                                        scale: [1, 1.02, 1],
                                        opacity: [0.5, 0.7, 0.5],
                                    }}
                                    transition={{
                                        duration: 2.5,
                                        repeat: Infinity,
                                    }}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hover Speech Bubble */}
                <AnimatePresence>
                    {isHovered && !showSpeech && (
                        <motion.div
                            className="absolute left-24 top-0 pointer-events-none z-50"
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        >
                            <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-xl px-4 py-2 border-2 border-amber-300/70">
                                {/* Arrow */}
                                <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-amber-300/70" />
                                    <div className="absolute top-0 left-[2px] w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-amber-50" />
                                </div>

                                <p className="text-xs font-medium text-gray-700">
                                    {giggleCount === 1 && "That tickles! 🤭"}
                                    {giggleCount === 2 && "Hehe! 😊"}
                                    {giggleCount === 3 && "Stop it! 😄"}
                                    {giggleCount > 3 && "You're silly! 😆"}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Click Speech Bubble */}
                <AnimatePresence>
                    {isClicked && (
                        <motion.div
                            className="absolute left-24 top-0 pointer-events-none z-50"
                            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
                        >
                            <div className="relative bg-gradient-to-br from-pink-100 to-rose-100 rounded-xl shadow-xl px-4 py-2 border-2 border-pink-300">
                                <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-pink-300" />
                                    <div className="absolute top-0 left-[2px] w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-pink-100" />
                                </div>

                                <p className="text-sm font-bold text-pink-800 flex items-center gap-1">
                                    Yay! 💖 <Sparkles className="w-3 h-3" />
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
}