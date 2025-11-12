"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Brain,
  Users,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface SearchProgressAnimationProps {
  progress: number; // 0-100
  currentStage?: string;
  message?: string;
  estimatedTime?: string;
}

const STAGES = [
  {
    id: "parsing",
    label: "Understanding Requirements",
    icon: Brain,
    color: "text-blue-500",
    minProgress: 0,
  },
  {
    id: "searching",
    label: "Searching Profiles",
    icon: Search,
    color: "text-purple-500",
    minProgress: 20,
  },
  {
    id: "matching",
    label: "AI Matching",
    icon: Sparkles,
    color: "text-yellow-500",
    minProgress: 40,
  },
  {
    id: "enriching",
    label: "Enriching Data",
    icon: Users,
    color: "text-green-500",
    minProgress: 60,
  },
  {
    id: "scoring",
    label: "Scoring Candidates",
    icon: CheckCircle2,
    color: "text-pink-500",
    minProgress: 80,
  },
];

const INTERESTING_FACTS = [
  "AI analyzes over 50 data points per candidate",
  "We verify skills across GitHub, Stack Overflow, and professional networks",
  "Salary estimates are based on industry data and career progression",
  "Response likelihood uses behavioral analysis and engagement patterns",
  "Our matching algorithm considers both explicit and implicit requirements",
];

export default function SearchProgressAnimation({
  progress,
  currentStage,
  message,
  estimatedTime,
}: SearchProgressAnimationProps) {
  const [factIndex, setFactIndex] = useState(0);
  const [completedStages, setCompletedStages] = useState<string[]>([]);

  // Rotate interesting facts every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % INTERESTING_FACTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update completed stages based on progress
  useEffect(() => {
    const completed = STAGES.filter(
      (stage) => progress >= stage.minProgress + 20
    ).map((s) => s.id);
    setCompletedStages(completed);
  }, [progress]);

  const currentStageData = STAGES.find(
    (s) => progress >= s.minProgress && progress < s.minProgress + 20
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-primary/5 p-4">
      {/* Animated background grid */}
      <div className="absolute inset-0 grid-bg opacity-10 animate-pulse" />

      <Card className="relative z-10 w-full max-w-2xl p-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <div className="relative">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <Sparkles className="w-8 h-8 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </motion.div>
          <h2 className="text-3xl font-bold">Finding Perfect Matches</h2>
          <p className="text-muted-foreground">
            {message || "Our AI is analyzing thousands of profiles..."}
          </p>
          {estimatedTime && (
            <Badge variant="secondary" className="text-xs">
              Estimated time: {estimatedTime}
            </Badge>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {currentStageData?.label || "Processing..."}
            </span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Stages */}
        <div className="space-y-3">
          {STAGES.map((stage, idx) => {
            const isCompleted = completedStages.includes(stage.id);
            const isCurrent = currentStageData?.id === stage.id;
            const Icon = stage.icon;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isCompleted
                    ? "border-green-500/30 bg-green-500/5"
                    : isCurrent
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/20"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted
                      ? "bg-green-500/10"
                      : isCurrent
                      ? "bg-primary/10"
                      : "bg-muted"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Icon
                      className={`w-5 h-5 ${
                        isCurrent ? stage.color : "text-muted-foreground"
                      } ${isCurrent ? "animate-pulse" : ""}`}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      isCompleted || isCurrent
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
                {isCompleted && (
                  <Badge variant="success" className="text-xs">
                    Done
                  </Badge>
                )}
                {isCurrent && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Interesting Fact */}
        <div className="border-t border-border pt-6">
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Did you know?
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={factIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-sm font-medium text-primary"
              >
                {INTERESTING_FACTS[factIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Loader Dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
