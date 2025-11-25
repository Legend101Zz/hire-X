// app/conversation/page.tsx (UPDATED)
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BlueprintBackground from "@/components/conversation/BlueprintBackground";
import DonnaEnhanced from "@/components/conversation/DonnaEnhanced";
import ResumeProfileCard from "@/components/conversation/ResumeProfileCard";
import ChatCard from "@/components/conversation/ChatCard";
import IntroSequence from "@/components/conversation/IntroSequence";
import SwipeableCandidateDeck from "@/components/conversation/SwipeableCandidateDeck";
import WizardGuide, { shouldShowWizard } from "@/components/conversation/WizardGuide";
import * as conversationApi from "@/utils/api/conversationApiV2";
import type { IdealProfileCard, ConversationMessage } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

type BotExpression = "neutral" | "happy" | "thinking" | "excited" | "peek" | "waving";
type BotPosition = "home" | "chat" | "profile" | "sample" | "intro1" | "intro2" | "intro3";

interface FeedbackData {
    rejected: Array<{
        candidate: any;
        reason: string;
        timestamp: string;
    }>;
    accepted: Array<{
        candidate: any;
        timestamp: string;
    }>;
}

function LoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
            <div className="text-center">
                <Sparkles className="w-12 h-12 text-amber-500 animate-pulse mx-auto mb-4" />
                <p className="text-amber-300">Loading workspace...</p>
            </div>
        </div>
    );
}

function ConversationWorkspace() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { token } = useAuth();
    const sessionId = searchParams.get("session");

    // Wizard state
    const [showWizard, setShowWizard] = useState(false);
    const [wizardChecked, setWizardChecked] = useState(false);

    // Loading state
    const [showIntro, setShowIntro] = useState(false);
    const [isLoadingState, setIsLoadingState] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Conversation state
    const [stage, setStage] = useState<string>("greeting");
    const [readyToSearch, setReadyToSearch] = useState(false);

    // Profile State
    const [idealProfile, setIdealProfile] = useState<IdealProfileCard>({
        role_title: "",
        must_have_skills: [],
        nice_to_have_skills: [],
        seniority: "",
        experience_years: "",
        industries: [],
        company_size: [],
        locations: [],
        additional_requirements: "",
    });

    // Chat State
    const [inputValue, setInputValue] = useState("");
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);

    // Bot State
    const [botPosition, setBotPosition] = useState<BotPosition>("home");
    const [botExpression, setBotExpression] = useState<BotExpression>("waving");
    const [isThinking, setIsThinking] = useState(false);
    const [speechBubble, setSpeechBubble] = useState("");
    const [showSpeech, setShowSpeech] = useState(false);

    // Highlight State
    const [highlightedField, setHighlightedField] = useState<string | null>(null);
    const [updatingField, setUpdatingField] = useState<string | null>(null);

    // Sample Candidates State
    const [sampleCandidates, setSampleCandidates] = useState<any[]>([]);
    const [showCandidateDeck, setShowCandidateDeck] = useState(false);
    const [isLoadingSamples, setIsLoadingSamples] = useState(false);

    // Feedback State
    const [feedbackData, setFeedbackData] = useState<FeedbackData>({
        rejected: [],
        accepted: [],
    });
    const [showFeedbackSummary, setShowFeedbackSummary] = useState(false);
    const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Check wizard on mount
    useEffect(() => {
        const shouldShow = shouldShowWizard();
        setShowWizard(shouldShow);
        setWizardChecked(true);
    }, []);

    // Load conversation state
    useEffect(() => {
        if (!wizardChecked || showWizard) return;

        const loadConversationState = async () => {
            if (!sessionId || !token) {
                setLoadError("Invalid session or missing authentication");
                setIsLoadingState(false);
                return;
            }

            try {
                console.log("📥 Loading conversation state:", sessionId);
                const state = await conversationApi.getConversationState(sessionId, token);

                // ✅ DEBUG: Log loaded state
                console.log("📊 Loaded state:", state);
                console.log("  - Role:", state.ideal_profile?.role_title);
                console.log("  - Skills:", state.ideal_profile?.must_have_skills);
                console.log("  - Sample candidates:", state.sample_candidates?.length || 0);

                setStage(state.stage || "greeting");
                setReadyToSearch(state.ready_to_search || false);
                setIdealProfile(state.ideal_profile || {
                    role_title: "",
                    must_have_skills: [],
                    nice_to_have_skills: [],
                    seniority: "",
                    experience_years: "",
                    industries: [],
                    company_size: [],
                    locations: [],
                    additional_requirements: "",
                });
                if (state.sample_candidates && state.sample_candidates.length > 0) {
                    console.log("📦 Restoring sample candidates from state");
                    setSampleCandidates(state.sample_candidates);
                    setShowCandidateDeck(true);
                } 

                setMessages(state.messages || []);
                setIsLoadingState(false);

                if (!state.messages || state.messages.length === 0) {
                    setShowIntro(true);
                } else {
                    setBotPosition("home");
                    setBotExpression("happy");
                }
            } catch (error) {
                console.error("Error loading conversation state:", error);
                setLoadError(error instanceof Error ? error.message : "Failed to load conversation");
                setIsLoadingState(false);
            }
        };

        loadConversationState();
    }, [sessionId, token, wizardChecked, showWizard]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-load samples when stage changes to review
    useEffect(() => {
        if (stage === "review" && sessionId && token && sampleCandidates.length === 0) {
            loadSampleCandidates();
        }
    }, [stage, sessionId, token]);

    // Wizard handlers
    const handleWizardComplete = () => {
        setShowWizard(false);
    };

    const handleWizardSkip = () => {
        setShowWizard(false);
    };

    // Intro sequence
    const handleIntroComplete = () => {
        setShowIntro(false);
        setTimeout(() => {
            showWelcomeSequence();
        }, 500);
    };

    const showWelcomeSequence = async () => {
        setBotPosition("profile");
        setBotExpression("waving");
        setSpeechBubble("This is where we'll build your ideal candidate profile together");
        setShowSpeech(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setShowSpeech(false);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setBotPosition("sample");
        setSpeechBubble("Here, I'll show you matching candidates as swipeable cards!");
        setShowSpeech(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setShowSpeech(false);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setBotPosition("chat");
        setSpeechBubble("And we'll chat here! Just tell me what you're looking for");
        setShowSpeech(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setShowSpeech(false);
        setBotPosition("home");
        setBotExpression("neutral");
    };

    // Handle Donna speaking
    const handleDonnaSpeak = (message: string, expression: BotExpression) => {
        setSpeechBubble(message);
        setBotExpression(expression);
        setShowSpeech(true);

        setTimeout(() => {
            setShowSpeech(false);
            setBotExpression("neutral");
        }, 4000);
    };

    // Send message
    const handleSendMessage = async () => {
        if (!inputValue.trim() || !sessionId || !token || isTyping) return;

        const userMessage = inputValue.trim();
        setInputValue("");
        setIsTyping(true);
        setBotExpression("thinking");
        setIsThinking(true);

        const newUserMessage: ConversationMessage = {
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newUserMessage]);

        setBotPosition("chat");

        try {
            const response = await conversationApi.sendMessage(sessionId, token, {
                message: userMessage,
            });

            const donnaMessage: ConversationMessage = {
                role: "assistant",
                content: response.donna_reply,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, donnaMessage]);

            setStage(response.stage || stage);
            setReadyToSearch(response.ready_to_search || false);

            const oldProfile = idealProfile;
            const newProfile = response.updated_ideal_profile;

            setIdealProfile(newProfile);
            highlightProfileUpdates(newProfile);

            // Check if we should load samples
            setTimeout(async () => {
                if (response.stage === "review" || hasEnoughInfo(newProfile)) {
                    await loadSampleCandidates();
                }
            }, 2000);

            setBotExpression("happy");
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage: ConversationMessage = {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            setBotExpression("neutral");
        } finally {
            setIsTyping(false);
            setIsThinking(false);
            setTimeout(() => {
                setBotPosition("home");
                setBotExpression("neutral");
            }, 1500);
        }
    };

    const hasEnoughInfo = (profile: IdealProfileCard): boolean => {
        return !!(
            profile.role_title &&
            profile.must_have_skills.length >= 2 &&
            (profile.seniority || profile.industries.length > 0)
        );
    };

    // Load sample candidates
    const loadSampleCandidates = async () => {
        if (!sessionId || !token || isLoadingSamples) return;

        setIsLoadingSamples(true);
        setBotPosition("sample");
        setBotExpression("thinking");
        setSpeechBubble("Searching for matching candidates... ⚡");
        setShowSpeech(true);

        try {
            console.log("🔍 Loading sample candidates...");
            const response = await conversationApi.getSampleCandidates(sessionId, token);

            if (response.samples && response.samples.length > 0) {
                setSampleCandidates(response.samples);
                setShowCandidateDeck(true);
                setSpeechBubble(
                    `Found ${response.samples.length} candidates! Swipe right (👍) to like, left (👎) to pass!`
                );
                setBotExpression("excited");
            } else {
                setSpeechBubble("Hmm, let's refine the criteria to find better matches!");
                setBotExpression("thinking");
            }

            setTimeout(() => {
                setShowSpeech(false);
                setBotPosition("home");
                setBotExpression("neutral");
            }, 4000);
        } catch (error) {
            console.error("Error loading samples:", error);
            setSpeechBubble("Oops! Had trouble finding candidates. Let's adjust the search?");
            setBotExpression("thinking");
        } finally {
            setIsLoadingSamples(false);
        }
    };

    // Profile update highlighting
    const highlightProfileUpdates = (newProfile: IdealProfileCard) => {
        const fieldsToCheck: (keyof IdealProfileCard)[] = [
            "role_title",
            "must_have_skills",
            "seniority",
            "experience_years",
            "industries",
            "locations",
        ];

        fieldsToCheck.forEach((field) => {
            const oldValue = JSON.stringify(idealProfile[field]);
            const newValue = JSON.stringify(newProfile[field]);

            if (oldValue !== newValue) {
                setHighlightedField(field);
                setUpdatingField(field);

                setBotPosition("profile");
                setBotExpression("excited");

                setTimeout(() => {
                    setUpdatingField(null);
                    setBotPosition("home");
                    setBotExpression("happy");
                }, 2000);

                setTimeout(() => {
                    setHighlightedField(null);
                }, 4000);
            }
        });
    };

    // Candidate actions
    const handleAcceptCandidate = (candidate: any) => {
        setFeedbackData((prev) => ({
            ...prev,
            accepted: [
                ...prev.accepted,
                {
                    candidate: candidate.candidate,
                    timestamp: new Date().toISOString(),
                },
            ],
        }));

        // Add to chat
        const message: ConversationMessage = {
            role: "user",
            content: `✅ Liked ${candidate.candidate.first_name} ${candidate.candidate.last_name}`,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, message]);
    };

    const handleRejectCandidate = (candidate: any, reason?: string) => {
        setFeedbackData((prev) => ({
            ...prev,
            rejected: [
                ...prev.rejected,
                {
                    candidate: candidate.candidate,
                    reason: reason || "Not specified",
                    timestamp: new Date().toISOString(),
                },
            ],
        }));

        // Add to chat
        const message: ConversationMessage = {
            role: "user",
            content: `❌ Passed on ${candidate.candidate.first_name} ${candidate.candidate.last_name} - ${reason}`,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, message]);
    };

    const handleDeckComplete = () => {
        setShowCandidateDeck(false);
        setShowFeedbackSummary(true);

        handleDonnaSpeak(
            `Great! You reviewed ${feedbackData.accepted.length + feedbackData.rejected.length} candidates. Ready to refine and find more? 🎯`,
            "excited"
        );
    };

    // Process feedback and get better results
    const handleProcessFeedback = async () => {
        if (!sessionId || !token) return;

        setIsProcessingFeedback(true);
        setBotPosition("sample");
        setBotExpression("thinking");
        setSpeechBubble("Analyzing your feedback to find better matches... 🧠");
        setShowSpeech(true);

        try {
            // Analyze rejection patterns
            const rejectionReasons = feedbackData.rejected.map((r) => r.reason);
            const mostCommonReason = getMostCommonReason(rejectionReasons);

            // Map reasons to feedback types
            let feedbackType: "too_junior" | "need_more_skill" | "wrong_industry" | "perfect" = "perfect";
            let feedbackData_api: Record<string, any> = {};

            if (mostCommonReason.includes("junior") || mostCommonReason.includes("Junior")) {
                feedbackType = "too_junior";
            } else if (mostCommonReason.includes("skill") || mostCommonReason.includes("Skill")) {
                feedbackType = "need_more_skill";
                // Extract skill from reason if possible
                const skillMatch = mostCommonReason.match(/need more (\w+)/i);
                if (skillMatch) {
                    feedbackData_api.skill = skillMatch[1];
                }
            } else if (mostCommonReason.includes("industry") || mostCommonReason.includes("Industry")) {
                feedbackType = "wrong_industry";
            }

            // Send feedback to backend
            const response = await conversationApi.provideFeedback(
                sessionId,
                token,
                feedbackType,
                feedbackData_api
            );

            setSpeechBubble(response.donna_reply);
            setBotExpression("happy");

            // Add Donna's response to chat
            const donnaMessage: ConversationMessage = {
                role: "assistant",
                content: response.donna_reply,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, donnaMessage]);

            // Load new samples
            if (response.updated_samples && response.updated_samples.length > 0) {
                setSampleCandidates(response.updated_samples);
                setShowCandidateDeck(true);
                setShowFeedbackSummary(false);

                // Reset feedback data
                setFeedbackData({
                    rejected: [],
                    accepted: [],
                });
            }

            setTimeout(() => {
                setShowSpeech(false);
                setBotPosition("home");
                setBotExpression("neutral");
            }, 4000);
        } catch (error) {
            console.error("Feedback error:", error);
            setSpeechBubble("Oops! Had trouble processing feedback. Let's try again?");
            setBotExpression("thinking");
        } finally {
            setIsProcessingFeedback(false);
        }
    };

    const getMostCommonReason = (reasons: string[]): string => {
        const counts: Record<string, number> = {};
        reasons.forEach((reason) => {
            counts[reason] = (counts[reason] || 0) + 1;
        });
        return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), reasons[0] || "");
    };

    // Finalize and start comprehensive search
    const handleFinalizeSearch = async () => {
        if (!sessionId || !token) return;

        // ✅ DEBUG: Log current state
        console.log("🚀 Finalizing search...");
        console.log("📊 Current state:");
        console.log("  - Session ID:", sessionId);
        console.log("  - Ideal Profile:", idealProfile);
        console.log("  - Sample Candidates:", sampleCandidates.length);
        console.log("  - Stage:", stage);

        // Validate before calling API
        if (!idealProfile.role_title) {
            console.error("❌ Role title is missing!");
            handleDonnaSpeak(
                "Oops! The profile is incomplete. Let's build it properly first! 📋",
                "thinking"
            );
            return;
        }

        if (idealProfile.must_have_skills.length < 2) {
            console.error("❌ Not enough skills!");
            handleDonnaSpeak(
                "I need at least 2 must-have skills. Let's add more! 💡",
                "thinking"
            );
            return;
        }

        try {
            setBotPosition("chat");
            setBotExpression("excited");
            setSpeechBubble("Perfect! Enriching your top 5 candidates... 🚀");
            setShowSpeech(true);

            console.log("📤 Calling finalize API...");
            const response = await conversationApi.finalizeConversation(sessionId, token);

            console.log("✅ Finalize response:", response);
            router.push(`/results?session=${response.session_id}`);

        } catch (error) {
            console.error("❌ Finalize error:", error);
            const errorMessage = error instanceof Error
                ? error.message
                : "Failed to start enrichment";

            handleDonnaSpeak(
                `Oops! ${errorMessage}. Let's check the profile! 📋`,
                "thinking"
            );
        }
    };

    // Render guards
    if (!wizardChecked || showWizard) {
        return (
            <AnimatePresence>
                {showWizard && (
                    <WizardGuide onComplete={handleWizardComplete} onSkip={handleWizardSkip} />
                )}
            </AnimatePresence>
        );
    }

    if (isLoadingState) {
        return <LoadingFallback />;
    }

    if (loadError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Error Loading Conversation</h2>
                    <p className="text-gray-400 mb-4">{loadError}</p>
                    <Button onClick={() => router.push("/search")}>Back to Search</Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <AnimatePresence>
                {showIntro && <IntroSequence onComplete={handleIntroComplete} />}
            </AnimatePresence>

            <div className="min-h-screen relative overflow-hidden">
                <BlueprintBackground />

                <DonnaEnhanced
                    position={botPosition}
                    expression={botExpression}
                    isThinking={isThinking}
                    speechBubble={speechBubble}
                    showSpeech={showSpeech}
                />

                <div className="relative container mx-auto px-8 py-12">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <motion.div
                            className="inline-flex items-center gap-3 mb-4"
                            animate={{
                                textShadow: [
                                    "0 0 20px rgba(251, 191, 36, 0.5)",
                                    "0 0 40px rgba(251, 191, 36, 0.8)",
                                    "0 0 20px rgba(251, 191, 36, 0.5)",
                                ],
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                        >
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/50">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-5xl font-bold text-white">Recruiter's Workspace</h1>
                        </motion.div>
                        <p className="text-amber-200 text-lg font-medium">
                            Build your ideal candidate profile with Donna
                        </p>
                    </motion.div>

                    {/* Main Grid */}
                    <div className="grid lg:grid-cols-3 gap-8 mb-8">
                        {/* Profile Card */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, type: "spring" }}
                        >
                            <ResumeProfileCard
                                idealProfile={idealProfile}
                                highlightedField={highlightedField}
                                updatingField={updatingField}
                            />
                        </motion.div>

                        {/* Center Column - Swipeable Deck or Feedback Summary */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="relative"
                        >
                            <AnimatePresence mode="wait">
                                {showCandidateDeck && sampleCandidates.length > 0 ? (
                                    <motion.div
                                        key="deck"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                    >
                                        <SwipeableCandidateDeck
                                            candidates={sampleCandidates}
                                            onAccept={handleAcceptCandidate}
                                            onReject={handleRejectCandidate}
                                            onComplete={handleDeckComplete}
                                            onDonnaSpeak={handleDonnaSpeak}
                                        />
                                    </motion.div>
                                ) : showFeedbackSummary ? (
                                    <motion.div
                                        key="summary"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50 shadow-2xl"
                                    >
                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            <CheckCircle className="w-6 h-6 text-green-500" />
                                            Review Complete!
                                        </h3>

                                        <div className="space-y-4 mb-6">
                                            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                                <p className="text-sm text-green-400 mb-1">Candidates Liked</p>
                                                <p className="text-3xl font-bold text-white">
                                                    {feedbackData.accepted.length}
                                                </p>
                                            </div>

                                            <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                                                <p className="text-sm text-red-400 mb-1">Candidates Passed</p>
                                                <p className="text-3xl font-bold text-white">
                                                    {feedbackData.rejected.length}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Button
                                                onClick={handleProcessFeedback}
                                                disabled={isProcessingFeedback}
                                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white h-12 rounded-lg shadow-lg"
                                            >
                                                {isProcessingFeedback ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5 mr-2" />
                                                        Refine & Find Better Matches
                                                    </>
                                                )}
                                            </Button>

                                            {feedbackData.accepted.length > 0 && (
                                                <Button
                                                    onClick={handleFinalizeSearch}
                                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white h-12 rounded-lg shadow-lg"
                                                >
                                                    <CheckCircle className="w-5 h-5 mr-2" />
                                                    Start Full Search (50+ Candidates)
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="placeholder"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-12 border border-slate-700/50 shadow-2xl flex items-center justify-center min-h-[500px]"
                                    >
                                        <div className="text-center">
                                            <motion.div
                                                animate={{
                                                    scale: [1, 1.1, 1],
                                                    rotate: [0, 10, -10, 0],
                                                }}
                                                transition={{ duration: 3, repeat: Infinity }}
                                            >
                                                <Sparkles className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                                            </motion.div>
                                            <p className="text-slate-400 text-lg">
                                                {isLoadingSamples
                                                    ? "Finding matching candidates..."
                                                    : "Tell me about the role and I'll find matching candidates!"}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Chat Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6, type: "spring" }}
                        >
                            <ChatCard messages={messages} isTyping={isTyping} isCollapsed={false} />
                        </motion.div>
                    </div>

                    {/* Chat Input */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="max-w-4xl mx-auto"
                    >
                        <div className="relative group">
                            <motion.div
                                className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-amber-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"
                                animate={{ opacity: [0.15, 0.25, 0.15] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />

                            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl backdrop-blur-xl overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

                                <div className="p-3 flex items-center gap-3">
                                    <div className="flex-1 relative">
                                        <Input
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                                            placeholder="Type your message to Donna..."
                                            disabled={isTyping}
                                            className="w-full bg-slate-800/50 border-slate-700/50 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 text-slate-100 placeholder:text-slate-500 rounded-xl px-5 h-14 text-base transition-all duration-300"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim() || isTyping}
                                        size="lg"
                                        className="relative h-14 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-300"
                                    >
                                        <div className="relative flex items-center gap-2">
                                            {isTyping ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span className="font-semibold">Sending</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-semibold">Send</span>
                                                    <Send className="w-5 h-5" />
                                                </>
                                            )}
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </>
    );
}

export default function ConversationPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <ConversationWorkspace />
        </Suspense>
    );
}