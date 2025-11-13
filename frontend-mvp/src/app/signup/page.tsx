"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import HiringTimeline from "@/components/auth/HiringTimeline";
import StatsGrid from "@/components/auth/StatsGrid";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

const SignupPage = () => {
    const router = useRouter();
    const { register } = useAuth();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [passwordStrength, setPasswordStrength] = useState(0);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }

        if (name === "password") {
            calculatePasswordStrength(value);
        }
    };

    const calculatePasswordStrength = (password: string) => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 15;
        if (/[^a-zA-Z\d]/.test(password)) strength += 10;
        setPasswordStrength(Math.min(strength, 100));
    };

    const getPasswordStrengthColor = () => {
        if (passwordStrength < 30) return "bg-red-500";
        if (passwordStrength < 60) return "bg-yellow-500";
        if (passwordStrength < 80) return "bg-blue-500";
        return "bg-green-500";
    };

    const getPasswordStrengthText = () => {
        if (passwordStrength < 30) return "Weak";
        if (passwordStrength < 60) return "Fair";
        if (passwordStrength < 80) return "Good";
        return "Strong";
    };

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = "Full name is required";
        }

        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!formData.username.trim()) {
            newErrors.username = "Username is required";
        } else if (formData.username.length < 3) {
            newErrors.username = "Username must be at least 3 characters";
        }

        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters";
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = "Please confirm your password";
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const success = await register(
                formData.username,
                formData.email,
                formData.password,
                formData.fullName
            );

            if (success) {
                router.push("/");
            } else {
                setErrors({ general: "Registration failed. Please try again." });
            }
        } catch (err) {
            setErrors({
                general: err instanceof Error ? err.message : "Registration failed. Please try again."
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex">
            {/* Animated Background */}
            <AnimatedBackground />

            {/* Left side - Form */}
            <div className="flex-1 flex items-center justify-center p-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    {/* Back to login */}
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 group transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to login
                    </Link>

                    <Card className="border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
                        <CardHeader className="space-y-1 pb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <motion.div
                                    whileHover={{ rotate: 180 }}
                                    transition={{ duration: 0.3 }}
                                    className="w-10 h-10 bg-gradient-to-br from-primary to-primary/50 rounded-lg flex items-center justify-center"
                                >
                                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                                </motion.div>
                                <CardTitle className="text-2xl font-bold">NeuraLeap</CardTitle>
                            </div>
                            <CardDescription>
                                Create your account and start finding perfect candidates
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            {errors.general && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
                                >
                                    <p className="text-sm text-destructive">{errors.general}</p>
                                </motion.div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="fullName"
                                            name="fullName"
                                            type="text"
                                            value={formData.fullName}
                                            onChange={handleInputChange}
                                            className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    {errors.fullName && (
                                        <motion.p
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-sm text-destructive"
                                        >
                                            {errors.fullName}
                                        </motion.p>
                                    )}
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                                            placeholder="john@company.com"
                                        />
                                    </div>
                                    {errors.email && (
                                        <motion.p
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-sm text-destructive"
                                        >
                                            {errors.email}
                                        </motion.p>
                                    )}
                                </div>

                                {/* Username */}
                                <div className="space-y-2">
                                    <Label htmlFor="username">Username</Label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="username"
                                            name="username"
                                            type="text"
                                            value={formData.username}
                                            onChange={handleInputChange}
                                            className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                                            placeholder="johndoe"
                                        />
                                    </div>
                                    {errors.username && (
                                        <motion.p
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-sm text-destructive"
                                        >
                                            {errors.username}
                                        </motion.p>
                                    )}
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            className="pl-9 pr-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                                            placeholder="Create a strong password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Password strength indicator */}
                                    {formData.password && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="space-y-1"
                                        >
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${passwordStrength}%` }}
                                                    className={`h-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Password strength: <span className="font-medium text-foreground">{getPasswordStrengthText()}</span>
                                            </p>
                                        </motion.div>
                                    )}

                                    {errors.password && (
                                        <motion.p
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-sm text-destructive"
                                        >
                                            {errors.password}
                                        </motion.p>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={formData.confirmPassword}
                                            onChange={handleInputChange}
                                            className="pl-9 pr-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                                            placeholder="Confirm your password"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.confirmPassword && (
                                        <motion.p
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-sm text-destructive"
                                        >
                                            {errors.confirmPassword}
                                        </motion.p>
                                    )}
                                </div>

                                {/* Terms and conditions */}
                                <div className="flex items-start gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="terms"
                                        className="mt-1 w-4 h-4 rounded border-input bg-background"
                                        required
                                    />
                                    <label htmlFor="terms" className="text-sm text-muted-foreground">
                                        I agree to the{" "}
                                        <a href="#" className="text-primary hover:underline">
                                            Terms of Service
                                        </a>{" "}
                                        and{" "}
                                        <a href="#" className="text-primary hover:underline">
                                            Privacy Policy
                                        </a>
                                    </label>
                                </div>

                                {/* Sign Up Button */}
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full mt-6 group relative overflow-hidden"
                                    size="lg"
                                >
                                    <span className="relative z-10 flex items-center gap-2">
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                                Creating account...
                                            </>
                                        ) : (
                                            <>
                                                Create Account
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary-foreground/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                </Button>
                            </form>

                            {/* Footer */}
                            <div className="mt-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Already have an account?{" "}
                                    <Link
                                        href="/login"
                                        className="font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                                    >
                                        Sign in
                                    </Link>
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Right side - Timeline */}
            <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="max-w-md"
                >
                    <div className="mb-12">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-3xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent"
                        >
                            Transform Your Hiring
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-muted-foreground text-lg"
                        >
                            AI-powered recruitment that connects you with perfect candidates from 56M+ profiles
                        </motion.p>
                    </div>

                    <div className="mb-12">
                        <HiringTimeline />
                    </div>

                    {/* Stats */}
                    <StatsGrid />
                </motion.div>
            </div>
        </div>
    );
};

export default SignupPage;