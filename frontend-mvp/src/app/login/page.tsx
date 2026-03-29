"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import HiringTimeline from "@/components/auth/HiringTimeline";
import StatsGrid from "@/components/auth/StatsGrid";
import AnimatedBackground from "@/components/auth/AnimatedBackground";

const LoginPage = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
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
      const success = await login(formData.username, formData.password);
      if (success) {
        router.push("/");
      } else {
        setErrors({ general: "Invalid username or password" });
      }
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : "Login failed. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg flex">
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Left side - Timeline */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="absolute inset-0 dot-bg" />

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-md relative z-10"
        >
          <div className="mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent"
            >
              Welcome Back
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground text-lg"
            >
              Continue your AI-powered recruitment journey and find perfect candidates faster
            </motion.p>
          </div>

          <div className="mb-12">
            <HiringTimeline />
          </div>

          {/* Stats */}
          <StatsGrid />
        </motion.div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Spotlight effect */}
        <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
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
                <CardTitle className="text-2xl font-bold">Hire-X</CardTitle>
              </div>
              <CardDescription>
                Sign in to your account to continue
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
                {/* Username/Email */}
                <div className="space-y-2">
                  <Label htmlFor="username">Username or Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="pl-9 bg-background/50"
                      placeholder="Enter your username or email"
                    />
                  </div>
                  {errors.username && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive"
                    >
                      {errors.username}
                    </motion.p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-9 pr-10 bg-background/50"
                      placeholder="Enter your password"
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
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 rounded border-input bg-background"
                  />
                  <label htmlFor="remember" className="text-sm text-muted-foreground">
                    Remember me for 30 days
                  </label>
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-6 group"
                  size="lg"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign in
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">
                    New to Hire-X?
                  </span>
                </div>
              </div>

              {/* Sign up link */}
              <Link href="/signup">
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  type="button"
                >
                  Create an account
                </Button>
              </Link>

              {/* Footer */}
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Need help?{" "}

                  <a href="#"
                    className="font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Contact support
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div >
  );
};

export default LoginPage;