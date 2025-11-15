"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, ThumbsUp, ThumbsDown, History, ChevronUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BlueprintBackground from "@/components/conversation/BlueprintBackground";
import DonnaEnhanced from "@/components/conversation/DonnaEnhanced";
import ResumeProfileCard from "@/components/conversation/ResumeProfileCard";
import SampleProfileDisplay from "@/components/conversation/SampleProfileDisplay";
import ChatCard from "@/components/conversation/ChatCard";
import IntroSequence from "@/components/conversation/IntroSequence";
import { Badge } from "@/components/ui/badge";
import * as conversationApi from "@/utils/api/conversationApiV2";
import type { IdealProfileCard, SampleProfile, ConversationMessage } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import WizardGuide from "@/components/conversation/WizardGuide";

type BotExpression = "neutral" | "happy" | "thinking" | "excited" | "peek" | "waving";
type BotPosition = "home" | "chat" | "profile" | "sample" | "intro1" | "intro2" | "intro3";

interface RejectedCandidate {
    profile: any;
    reason?: string;
    timestamp: Date;
}

const WIZARD_SHOWN_KEY = "neuraleap_wizard_shown";

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

    const [showWizard, setShowWizard] = useState(false);
    const [wizardChecked, setWizardChecked] = useState(false);

    // Show intro only on first visit
    const [showIntro, setShowIntro] = useState(false);
    const [isLoadingState, setIsLoadingState] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

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

    const [sampleProfile, setSampleProfile] = useState<SampleProfile | null>(null);
    const [showCandidateActions, setShowCandidateActions] = useState(false);
    const [rejectedCandidates, setRejectedCandidates] = useState<RejectedCandidate[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [waitingForRejectionReason, setWaitingForRejectionReason] = useState(false);

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

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const hasSeenWizard = localStorage.getItem(WIZARD_SHOWN_KEY);
        if (!hasSeenWizard) {
            setShowWizard(true);
        }
        setWizardChecked(true);
    }, []);


    // ================================================================
    // WIZARD HANDLERS
    // ================================================================
    const handleWizardComplete = () => {
        localStorage.setItem(WIZARD_SHOWN_KEY, "true");
        setShowWizard(false);
        // Optionally show intro sequence after wizard
        // setShowIntro(true);
    };

    const handleWizardSkip = () => {
        localStorage.setItem(WIZARD_SHOWN_KEY, "true");
        setShowWizard(false);
    };

    // ================================================================
    // LOAD CONVERSATION STATE ON MOUNT
    // ================================================================

    useEffect(() => {
        // Don't load state until wizard check is complete
        if (!wizardChecked) return;

        const loadConversationState = async () => {
            if (!sessionId || !token) {
                setLoadError("Invalid session or missing authentication");
                setIsLoadingState(false);
                return;
            }

            try {
                console.log("📥 Loading conversation state:", sessionId);
                const state = await conversationApi.getConversationState(sessionId, token);

                // Set state from backend
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

                setSampleProfile(state.sample_profile || null);

                // Check if the last message indicates we need clarification
                const lastMessage = state.messages[state.messages.length - 1];
                if (lastMessage && lastMessage.role === "assistant") {
                    if (lastMessage.content.includes("couldn't find any matching candidates")) {
                        // Donna is asking for clarification
                        setBotExpression("thinking");
                        setSpeechBubble("Let's refine the search together!");
                        setShowSpeech(true);
                    }
                }

                setMessages(state.messages || []);

                setIsLoadingState(false);

                // Show intro only if it's a brand new conversation
                if (!state.messages || state.messages.length === 0) {
                    setShowIntro(true);
                } else {
                    // Skip intro and show welcome if already started
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

    // ================================================================
    // INTRO SEQUENCE
    // ================================================================

    const handleIntroComplete = () => {
        setShowIntro(false);
        setTimeout(() => {
            showWelcomeSequence();
        }, 500);
    };

    const showWelcomeSequence = async () => {
        // Step 1: Fly to profile card
        setBotPosition("profile");
        setBotExpression("waving");
        setSpeechBubble("This is where we'll build your ideal candidate profile together");
        setShowSpeech(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Step 2: Fly to sample card
        setShowSpeech(false);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setBotPosition("sample");
        setSpeechBubble("Here, I'll show you matching candidates in real-time");
        setShowSpeech(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Step 3: Fly to chat
        setShowSpeech(false);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setBotPosition("chat");
        setSpeechBubble("And we'll chat here! Just tell me what you're looking for");
        setShowSpeech(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Step 4: Go home and start
        setShowSpeech(false);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setBotPosition("home");
        setBotExpression("neutral");
    };

    // Handle input focus - Bot peeks
    const handleInputFocus = () => {
        if (botPosition === "home") {
            setBotPosition("chat");
            setBotExpression("peek");
        }
    };

    // Handle input blur
    const handleInputBlur = () => {
        if (botPosition === "chat" && !isTyping) {
            setTimeout(() => {
                setBotPosition("home");
                setBotExpression("neutral");
            }, 1000);
        }
    };

    // ================================================================
    // SEND MESSAGE
    // ================================================================

    const handleSendMessage = async () => {
        if (!inputValue.trim() || !sessionId || !token || isTyping) return;

        const userMessage = inputValue.trim();
        setInputValue("");
        setIsTyping(true);
        setBotExpression("thinking");
        setIsThinking(true);

        // Add user message immediately
        const newUserMessage: ConversationMessage = {
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newUserMessage]);

        // Bot flies to chat and thinks
        setBotPosition("chat");

        try {
            // Send message to backend
            const response = await conversationApi.sendMessage(sessionId, token, {
                message: userMessage,
            });

            // Add Donna's response
            const donnaMessage: ConversationMessage = {
                role: "assistant",
                content: response.donna_reply,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, donnaMessage]);

            // Update profile and sample
            setIdealProfile(response.updated_ideal_profile);
            if (response.updated_sample_profile) {
                setSampleProfile(response.updated_sample_profile);
                setShowCandidateActions(true);
            }

            // Highlight updated fields
            highlightProfileUpdates(response.updated_ideal_profile);

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
            // Return home after a delay
            setTimeout(() => {
                setBotPosition("home");
                setBotExpression("neutral");
            }, 1500);
        }
    };

    // ================================================================
    // PROFILE UPDATE HIGHLIGHTING
    // ================================================================

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

                // Donna flies to profile card
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

    // ================================================================
    // CANDIDATE ACTIONS
    // ================================================================

    const handleAcceptCandidate = async () => {
        setShowCandidateActions(false);
        setBotPosition("sample");
        setBotExpression("excited");
        setSpeechBubble("Excellent choice! Ready to search for more like this?");
        setShowSpeech(true);

        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Great! You've accepted this candidate. Ready to search for more?", timestamp: new Date().toISOString() }
        ]);

        setTimeout(() => {
            setShowSpeech(false);
            setBotPosition("home");
            setBotExpression("happy");
        }, 3000);
    };

    const handleRejectCandidate = async () => {
        setShowCandidateActions(false);

        // Add to rejected history
        if (sampleProfile) {
            setRejectedCandidates(prev => [
                ...prev,
                { profile: sampleProfile, timestamp: new Date() }
            ]);
        }

        setBotPosition("chat");
        setBotExpression("thinking");

        setMessages((prev) => [
            ...prev,
            { role: "user", content: "Not this one", timestamp: new Date().toISOString() },
            { role: "assistant", content: "I understand. Could you tell me what didn't work about this candidate?", timestamp: new Date().toISOString() }
        ]);

        setWaitingForRejectionReason(true);
        setSampleProfile(null);

        setTimeout(() => {
            setBotPosition("home");
            setBotExpression("neutral");
        }, 2000);
    };

    // ================================================================
    // RENDER
    // ================================================================

    // Show wizard first if not seen before
    if (!wizardChecked || (wizardChecked && showWizard)) {
        return (
            <AnimatePresence>
                {showWizard && (
                    <WizardGuide
                        onComplete={handleWizardComplete}
                        onSkip={handleWizardSkip}
                    />
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
            {/* Intro Sequence */}
            <AnimatePresence>
                {showIntro && <IntroSequence onComplete={handleIntroComplete} />}
            </AnimatePresence>

            {/* Main Workspace */}
            <div className="min-h-screen relative overflow-hidden">
                <BlueprintBackground />

                {/* Donna Bot */}
                <DonnaEnhanced
                    position={botPosition}
                    expression={botExpression}
                    isThinking={isThinking}
                    speechBubble={speechBubble}
                    showSpeech={showSpeech}
                />

                {/* Main Content */}
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
                            <h1 className="text-5xl font-bold text-white">
                                Recruiter's Workspace
                            </h1>
                        </motion.div>
                        <p className="text-amber-200 text-lg font-medium">
                            Build your ideal candidate profile with Donna
                        </p>
                    </motion.div>

                    {/* Three Premium Cards - ORIGINAL LAYOUT */}
                    <div className="grid lg:grid-cols-3 gap-8 mb-8">
                        {/* Left: Resume Profile */}
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

                        {/* Center: Sample Profile with Actions */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="relative"
                        >
                            <SampleProfileDisplay
                                profile={sampleProfile}
                                isLoading={isTyping && !sampleProfile}
                            />

                            {/* Candidate Actions - Floating over sample profile */}
                            <AnimatePresence>
                                {showCandidateActions && sampleProfile && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4"
                                    >
                                        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-xl border border-slate-700/50 shadow-2xl p-4 backdrop-blur-xl">
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    onClick={handleRejectCandidate}
                                                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white h-12 rounded-lg shadow-lg shadow-red-500/20"
                                                >
                                                    <ThumbsDown className="w-5 h-5 mr-2" />
                                                    Not a fit
                                                </Button>
                                                <Button
                                                    onClick={handleAcceptCandidate}
                                                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white h-12 rounded-lg shadow-lg shadow-emerald-500/20"
                                                >
                                                    <ThumbsUp className="w-5 h-5 mr-2" />
                                                    Looks good!
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Right: Chat */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6, type: "spring" }}
                        >
                            <ChatCard messages={messages} isTyping={isTyping} isCollapsed={false} />
                        </motion.div>
                    </div>

                    {/* Chat Input - Dark Professional Style - BOTTOM */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="max-w-4xl mx-auto"
                    >
                        <div className="relative group">
                            {/* Ambient glow effect */}
                            <motion.div
                                className="absolute -inset-1 bg-gradient-to-r from-violet-500 via-purple-500 to-amber-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"
                                animate={{
                                    opacity: [0.15, 0.25, 0.15],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                }}
                            />

                            {/* Main input container */}
                            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl backdrop-blur-xl overflow-hidden">
                                {/* Top gradient line */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

                                <div className="p-3 flex items-center gap-3">
                                    {/* Input field */}
                                    <div className="flex-1 relative">
                                        <Input
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onFocus={handleInputFocus}
                                            onBlur={handleInputBlur}
                                            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                                            placeholder={waitingForRejectionReason ? "Tell me what didn't work..." : "Type your message to Donna..."}
                                            disabled={isTyping}
                                            className="w-full bg-slate-800/50 border-slate-700/50 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 text-slate-100 placeholder:text-slate-500 rounded-xl px-5 h-14 text-base transition-all duration-300"
                                        />

                                        {/* Input glow on focus */}
                                        <motion.div
                                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"
                                        />
                                    </div>

                                    {/* Send button */}
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!inputValue.trim() || isTyping}
                                        size="lg"
                                        className="relative h-14 px-8 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-300 group/btn overflow-hidden"
                                    >
                                        {/* Button glow effect */}
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-400 opacity-0 group-hover/btn:opacity-20 blur-xl transition-opacity"
                                        />

                                        {/* Button content */}
                                        <div className="relative flex items-center gap-2">
                                            {isTyping ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span className="font-semibold">Sending</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-semibold">Send</span>
                                                    <motion.div
                                                        animate={{ x: [0, 3, 0] }}
                                                        transition={{ duration: 1.5, repeat: Infinity }}
                                                    >
                                                        <Send className="w-5 h-5" />
                                                    </motion.div>
                                                </>
                                            )}
                                        </div>
                                    </Button>
                                </div>

                                {/* Bottom info bar */}
                                <div className="px-5 py-2 bg-slate-950/30 border-t border-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded text-[10px] font-mono">
                                                Enter
                                            </kbd>
                                            <span>to send</span>
                                        </div>
                                        <div className="w-px h-3 bg-slate-700/50" />
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded text-[10px] font-mono">
                                                Shift + Enter
                                            </kbd>
                                            <span>for new line</span>
                                        </div>
                                    </div>

                                    {/* Character counter */}
                                    <motion.div
                                        className="text-xs text-slate-500"
                                        animate={{
                                            color: inputValue.length > 0 ? "rgb(168, 85, 247)" : "rgb(100, 116, 139)",
                                        }}
                                    >
                                        {inputValue.length > 0 && `${inputValue.length} characters`}
                                    </motion.div>
                                </div>
                            </div>
                        </div>

                        {/* Status indicator */}
                        <AnimatePresence>
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400"
                                >
                                    <motion.div
                                        className="w-2 h-2 rounded-full bg-purple-500"
                                        animate={{
                                            scale: [1, 1.3, 1],
                                            opacity: [1, 0.5, 1],
                                        }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                    <span>Donna is processing your message...</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>

                {/* Rejected Candidates History - Bottom Left */}
                <AnimatePresence>
                    {rejectedCandidates.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: -100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            className="fixed bottom-8 left-8 z-40"
                        >
                            <div className="relative">
                                {/* History Toggle Button */}
                                <motion.button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl hover:border-slate-600/50 transition-all"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <History className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-semibold text-slate-200">
                                                Rejected Profiles
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {rejectedCandidates.length} candidates
                                            </div>
                                        </div>
                                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                            {rejectedCandidates.length}
                                        </Badge>
                                        <motion.div
                                            animate={{ rotate: showHistory ? 180 : 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                        </motion.div>
                                    </div>
                                </motion.button>

                                {/* History Panel */}
                                <AnimatePresence>
                                    {showHistory && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20, height: 0 }}
                                            animate={{ opacity: 1, y: 0, height: "auto" }}
                                            exit={{ opacity: 0, y: 20, height: 0 }}
                                            className="absolute bottom-full left-0 mb-4 w-96 overflow-hidden"
                                        >
                                            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-xl max-h-96 overflow-y-auto">
                                                {/* Header */}
                                                <div className="px-6 py-4 border-b border-slate-800/50 sticky top-0 bg-slate-950/50 backdrop-blur-sm">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-sm font-semibold text-slate-200">
                                                            Rejected Candidates
                                                        </h3>
                                                        <Button
                                                            onClick={() => setRejectedCandidates([])}
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-xs text-slate-500 hover:text-slate-300"
                                                        >
                                                            Clear all
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* List */}
                                                <div className="p-4 space-y-3">
                                                    {rejectedCandidates.map((rejected, idx) => (
                                                        <motion.div
                                                            key={idx}
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: idx * 0.05 }}
                                                            className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:border-slate-600/50 transition-all"
                                                        >
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div>
                                                                    <div className="text-sm font-semibold text-slate-200">
                                                                        {rejected.profile.name}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        {rejected.profile.title}
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline" className="border-red-500/30 text-red-400 text-xs">
                                                                    {rejected.profile.match_score}%
                                                                </Badge>
                                                            </div>
                                                            {rejected.reason && (
                                                                <div className="mt-2 text-xs text-slate-400 italic">
                                                                    "{rejected.reason}"
                                                                </div>
                                                            )}
                                                            <div className="mt-2 text-[10px] text-slate-600">
                                                                {rejected.timestamp.toLocaleTimeString()}
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
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