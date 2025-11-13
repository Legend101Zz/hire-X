"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Particle {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
}

export default function AnimatedBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [particles, setParticles] = useState<Particle[]>([]);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Initialize particles
    useEffect(() => {
        const particleCount = 50;
        const newParticles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
            newParticles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                opacity: Math.random() * 0.5 + 0.2,
            });
        }

        setParticles(newParticles);
    }, []);

    // Track mouse position
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Animate particles
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        let animationFrameId: number;

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update and draw particles
            setParticles((prevParticles) => {
                return prevParticles.map((particle) => {
                    // Update position
                    let newX = particle.x + particle.speedX;
                    let newY = particle.y + particle.speedY;

                    // Bounce off edges
                    if (newX < 0 || newX > canvas.width) particle.speedX *= -1;
                    if (newY < 0 || newY > canvas.height) particle.speedY *= -1;

                    newX = Math.max(0, Math.min(canvas.width, newX));
                    newY = Math.max(0, Math.min(canvas.height, newY));

                    // Draw particle
                    ctx.beginPath();
                    ctx.arc(newX, newY, particle.size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(139, 92, 246, ${particle.opacity})`;
                    ctx.fill();

                    // Draw connections to nearby particles
                    prevParticles.forEach((otherParticle) => {
                        const dx = newX - otherParticle.x;
                        const dy = newY - otherParticle.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < 150) {
                            ctx.beginPath();
                            ctx.moveTo(newX, newY);
                            ctx.lineTo(otherParticle.x, otherParticle.y);
                            ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - distance / 150) * 0.2
                                })`;
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    });

                    return {
                        ...particle,
                        x: newX,
                        y: newY,
                    };
                });
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <>
            {/* Enhanced Grid Background */}
            <div className="absolute inset-0 grid-bg opacity-30" />

            {/* Perspective Grid Lines */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0" style={{ perspective: "1000px" }}>
                    <motion.div
                        animate={{
                            rotateX: [0, 5, 0],
                            rotateY: [0, -5, 0],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                        className="absolute inset-0"
                        style={{
                            transformStyle: "preserve-3d",
                        }}
                    >
                        {/* Horizontal lines */}
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={`h-${i}`}
                                className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                                style={{
                                    top: `${i * 5}%`,
                                }}
                                animate={{
                                    opacity: [0.1, 0.3, 0.1],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                }}
                            />
                        ))}

                        {/* Vertical lines */}
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={`v-${i}`}
                                className="absolute h-full w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent"
                                style={{
                                    left: `${i * 5}%`,
                                }}
                                animate={{
                                    opacity: [0.1, 0.3, 0.1],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    delay: i * 0.1,
                                }}
                            />
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* Animated Gradient Orbs */}
            <motion.div
                animate={{
                    x: [0, 100, 0],
                    y: [0, -50, 0],
                    scale: [1, 1.2, 1],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
            />

            <motion.div
                animate={{
                    x: [0, -100, 0],
                    y: [0, 50, 0],
                    scale: [1, 1.3, 1],
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl"
            />

            <motion.div
                animate={{
                    x: [0, 50, 0],
                    y: [0, -100, 0],
                    scale: [1, 1.1, 1],
                }}
                transition={{
                    duration: 12,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl"
            />

            {/* Particle Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
            />

            {/* Mouse Spotlight Effect */}
            <motion.div
                className="absolute pointer-events-none"
                animate={{
                    x: mousePosition.x - 300,
                    y: mousePosition.y - 300,
                }}
                transition={{
                    type: "spring",
                    damping: 30,
                    stiffness: 200,
                }}
            >
                <div className="w-[600px] h-[600px] rounded-full bg-gradient-radial from-primary/10 via-primary/5 to-transparent" />
            </motion.div>

            {/* Floating Geometric Shapes */}
            {[...Array(6)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute"
                    style={{
                        left: `${10 + i * 15}%`,
                        top: `${20 + (i % 3) * 20}%`,
                    }}
                    animate={{
                        y: [-20, 20, -20],
                        rotate: [0, 180, 360],
                        opacity: [0.1, 0.3, 0.1],
                    }}
                    transition={{
                        duration: 8 + i * 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.5,
                    }}
                >
                    <div
                        className="w-12 h-12 border border-primary/20 rotate-45"
                        style={{
                            boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)",
                        }}
                    />
                </motion.div>
            ))}

            {/* Scanning Line Effect */}
            <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                animate={{
                    top: ["0%", "100%"],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />
        </>
    );
}