"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function BlueprintBackground() {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-gray-950">
            {/* Blueprint Grid */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.4) 1px, transparent 1px)
          `,
                    backgroundSize: "40px 40px",
                }}
            />

            {mounted && (
                <>
                    {/* Animated Grid Pattern - Only render when mounted */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <defs>
                            <pattern
                                id="blueprint-pattern"
                                x="0"
                                y="0"
                                width="80"
                                height="80"
                                patternUnits="userSpaceOnUse"
                            >
                                {/* ✅ FIXED: Removed motion from SVG circle to avoid undefined errors */}
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="2"
                                    fill="rgba(139, 92, 246, 0.3)"
                                    opacity="0.5"
                                />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#blueprint-pattern)" />
                    </svg>

                    {/* Gradient Orbs */}
                    <motion.div
                        className="absolute w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
                        }}
                        animate={{
                            x: [100, 200, 100],
                            y: [100, 300, 100],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />

                    <motion.div
                        className="absolute w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)",
                            right: 0,
                            bottom: 0,
                        }}
                        animate={{
                            x: [-100, -200, -100],
                            y: [-100, -300, -100],
                        }}
                        transition={{
                            duration: 25,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />

                    {/* Mouse Spotlight */}
                    <motion.div
                        className="absolute pointer-events-none w-[800px] h-[800px] rounded-full"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 60%)",
                        }}
                        animate={{
                            x: mousePos.x - 400,
                            y: mousePos.y - 400,
                        }}
                        transition={{
                            type: "spring",
                            damping: 50,
                            stiffness: 200,
                        }}
                    />

                    {/* Scanning Lines */}
                    <motion.div
                        className="absolute left-0 right-0 h-px pointer-events-none"
                        style={{
                            background:
                                "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.6), transparent)",
                        }}
                        animate={{
                            top: ["0%", "100%"],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    />

                    <motion.div
                        className="absolute top-0 bottom-0 w-px pointer-events-none"
                        style={{
                            background:
                                "linear-gradient(180deg, transparent, rgba(139, 92, 246, 0.6), transparent)",
                        }}
                        animate={{
                            left: ["0%", "100%"],
                        }}
                        transition={{
                            duration: 10,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    />

                    {/* Floating Geometric Shapes */}
                    {[...Array(8)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute pointer-events-none"
                            style={{
                                left: `${10 + i * 12}%`,
                                top: `${15 + (i % 4) * 20}%`,
                            }}
                            animate={{
                                y: [-20, 20, -20],
                                rotate: [0, 90, 180, 270, 360],
                                opacity: [0.1, 0.2, 0.1],
                            }}
                            transition={{
                                duration: 10 + i * 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.3,
                            }}
                        >
                            <div className="w-8 h-8 border border-violet-500/30 rotate-45" />
                        </motion.div>
                    ))}
                </>
            )}
        </div>
    );
}