/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
"use client";

import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, Sparkles, AlertCircle, Building2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SampleFeedbackButtonsProps {
    onFeedback: (
        feedbackType: "too_junior" | "need_more_skill" | "wrong_industry" | "perfect",
        data?: Record<string, any>
    ) => void;
    disabled?: boolean;
}

export default function SampleFeedbackButtons({
    onFeedback,
    disabled = false,
}: SampleFeedbackButtonsProps) {
    const [showSkillInput, setShowSkillInput] = useState(false);
    const [skillName, setSkillName] = useState("");

    const handleNeedMoreSkill = () => {
        if (skillName.trim()) {
            onFeedback("need_more_skill", { skill: skillName.trim() });
            setSkillName("");
            setShowSkillInput(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200"
        >
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                How are these candidates?
            </p>

            <div className="grid grid-cols-2 gap-2">
                {/* Perfect */}
                <Button
                    onClick={() => onFeedback("perfect")}
                    disabled={disabled}
                    variant="outline"
                    className="bg-white hover:bg-green-50 hover:border-green-300 transition-all"
                >
                    <ThumbsUp className="w-4 h-4 mr-2 text-green-600" />
                    Perfect! Find more
                </Button>

                {/* Too Junior */}
                <Button
                    onClick={() => onFeedback("too_junior")}
                    disabled={disabled}
                    variant="outline"
                    className="bg-white hover:bg-orange-50 hover:border-orange-300 transition-all"
                >
                    <Award className="w-4 h-4 mr-2 text-orange-600" />
                    Too Junior
                </Button>

                {/* Wrong Industry */}
                <Button
                    onClick={() => onFeedback("wrong_industry")}
                    disabled={disabled}
                    variant="outline"
                    className="bg-white hover:bg-purple-50 hover:border-purple-300 transition-all"
                >
                    <Building2 className="w-4 h-4 mr-2 text-purple-600" />
                    Wrong Industry
                </Button>

                {/* Need More Skill */}
                <Button
                    onClick={() => setShowSkillInput(!showSkillInput)}
                    disabled={disabled}
                    variant="outline"
                    className="bg-white hover:bg-blue-50 hover:border-blue-300 transition-all"
                >
                    <AlertCircle className="w-4 h-4 mr-2 text-blue-600" />
                    Need More Skill
                </Button>
            </div>

            {/* Skill Input */}
            {showSkillInput && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="flex gap-2"
                >
                    <input
                        type="text"
                        value={skillName}
                        onChange={(e) => setSkillName(e.target.value)}
                        placeholder="Which skill? (e.g., React, Node.js)"
                        className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleNeedMoreSkill();
                        }}
                    />
                    <Button onClick={handleNeedMoreSkill} size="sm" disabled={!skillName.trim()}>
                        Apply
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
}