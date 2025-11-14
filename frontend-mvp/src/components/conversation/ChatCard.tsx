"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Sparkles, Check, CheckCheck, ChevronDown, ChevronUp, Minimize2, Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Message {
    role: string;
    content: string;
}

interface ChatCardProps {
    messages: Message[];
    isTyping?: boolean;
}

export default function ChatCard({ messages, isTyping = false }: ChatCardProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [readReceipts, setReadReceipts] = useState<{ [key: number]: boolean }>({});
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Auto-scroll with smooth animation
    useEffect(() => {
        if (!isCollapsed) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }

        // Mark messages as read after a delay
        if (messages.length > 0) {
            const lastIndex = messages.length - 1;
            setTimeout(() => {
                setReadReceipts(prev => ({ ...prev, [lastIndex]: true }));
            }, 800);
        }
    }, [messages, isCollapsed]);

    return (
        <motion.div
            layout
            className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 backdrop-blur-xl flex flex-col"
            animate={{
                height: isCollapsed ? "auto" : "100%",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            {/* Ambient glow effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

            {/* Header - Sleek and minimal with collapse button */}
            <div className="relative px-6 py-4 border-b border-slate-800/50 bg-slate-950/30 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <MessageSquare className="w-4 h-4 text-purple-400" />
                            </div>
                            {/* Pulse indicator */}
                            <motion.div
                                className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"
                                animate={{
                                    scale: [1, 1.2, 1],
                                    opacity: [1, 0.8, 1],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-100">
                                Conversation
                            </h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                {isCollapsed ? `${messages.length} messages` : "Live chat"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Message counter with glow */}
                        <motion.div
                            className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20"
                            animate={{
                                boxShadow: [
                                    "0 0 0 0 rgba(168, 85, 247, 0)",
                                    "0 0 0 4px rgba(168, 85, 247, 0.1)",
                                    "0 0 0 0 rgba(168, 85, 247, 0)",
                                ],
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <span className="text-xs font-semibold text-purple-400">
                                {messages.length}
                            </span>
                        </motion.div>

                        {/* Collapse/Expand button */}
                        <motion.button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <motion.div
                                animate={{ rotate: isCollapsed ? 180 : 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {isCollapsed ? (
                                    <Maximize2 className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <Minimize2 className="w-4 h-4 text-slate-400" />
                                )}
                            </motion.div>
                        </motion.button>
                    </div>
                </div>

                {/* Preview when collapsed */}
                <AnimatePresence>
                    {isCollapsed && messages.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 pt-3 border-t border-slate-800/50"
                        >
                            <div className="text-xs text-slate-400 truncate">
                                <span className="text-slate-500">Last message: </span>
                                {messages[messages.length - 1]?.content}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Messages Container - Only show when not collapsed */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-track-slate-800/50 scrollbar-thumb-slate-700/50 hover:scrollbar-thumb-slate-600/50"
                        style={{ maxHeight: "500px" }}
                    >
                        {messages.length === 0 ? (
                            // Empty state with animation
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center py-12"
                            >
                                <motion.div
                                    animate={{
                                        y: [0, -10, 0],
                                        rotate: [0, 5, -5, 0],
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="mb-4 p-4 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20"
                                >
                                    <MessageSquare className="w-8 h-8 text-purple-400" />
                                </motion.div>
                                <h4 className="text-lg font-semibold text-slate-300 mb-2">
                                    Start the conversation
                                </h4>
                                <p className="text-sm text-slate-500 max-w-xs">
                                    Chat with Donna to build your ideal candidate profile
                                </p>
                            </motion.div>
                        ) : (
                            <>
                                <AnimatePresence mode="popLayout">
                                    {messages.map((msg, idx) => (
                                        <MessageBubble
                                            key={idx}
                                            message={msg}
                                            index={idx}
                                            isRead={readReceipts[idx]}
                                        />
                                    ))}
                                </AnimatePresence>

                                {/* Typing Indicator - Premium style */}
                                {isTyping && <TypingIndicator />}

                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer - Subtle status bar */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-6 py-3 border-t border-slate-800/50 bg-slate-950/30"
                    >
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <motion.div
                                    className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <span className="uppercase tracking-wider">Donna is online</span>
                            </div>
                            {messages.length > 0 && (
                                <span>
                                    {messages.length} {messages.length === 1 ? "message" : "messages"}
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Individual message bubble component with limited width
function MessageBubble({ message, index, isRead }: { message: Message; index: number; isRead?: boolean }) {
    const isUser = message.role === "user";
    const [showReaction, setShowReaction] = useState(false);

    useEffect(() => {
        if (!isUser && Math.random() > 0.5) {
            const timer = setTimeout(() => setShowReaction(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [isUser]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.5,
            }}
            className={`flex ${isUser ? "justify-end" : "justify-start"} group`}
        >
            <div className="relative" style={{ maxWidth: "75%" }}>
                {/* Message content */}
                <motion.div
                    className={`relative rounded-2xl px-4 py-3 backdrop-blur-sm ${isUser
                            ? "bg-gradient-to-br from-purple-600 via-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/20"
                            : "bg-slate-800/60 text-slate-100 border border-slate-700/50 shadow-lg"
                        }`}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400 }}
                >
                    {/* Glow effect for user messages */}
                    {isUser && (
                        <motion.div
                            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-400/20 to-blue-400/20 blur-xl -z-10"
                            animate={{
                                opacity: [0.5, 0.8, 0.5],
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                        />
                    )}

                    {/* Message text */}
                    <p className="text-sm leading-relaxed break-words">{message.content}</p>

                    {/* Footer with timestamp and status */}
                    <div className="flex items-center gap-2 mt-1.5">
                        <span
                            className={`text-[10px] ${isUser ? "text-purple-200" : "text-slate-500"
                                }`}
                        >
                            {new Date().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>

                        {/* Read receipts for user messages */}
                        {isUser && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                {isRead ? (
                                    <CheckCheck className="w-3 h-3 text-emerald-300" />
                                ) : (
                                    <Check className="w-3 h-3 text-purple-300" />
                                )}
                            </motion.div>
                        )}
                    </div>
                </motion.div>

                {/* Reaction bubble - appears for assistant messages */}
                <AnimatePresence>
                    {showReaction && !isUser && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute -bottom-2 left-4 px-2 py-1 bg-slate-700/90 backdrop-blur-sm rounded-full border border-slate-600/50 shadow-lg"
                        >
                            <span className="text-xs">👍</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// Enhanced typing indicator with limited width
function TypingIndicator() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-start"
        >
            <div className="relative" style={{ maxWidth: "200px" }}>
                {/* Glow effect */}
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 blur-xl rounded-2xl"
                    animate={{
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                />

                <div className="relative bg-slate-800/60 backdrop-blur-sm rounded-2xl px-5 py-4 border border-slate-700/50 shadow-lg">
                    <div className="flex items-center gap-3">
                        {/* Animated dots */}
                        <div className="flex gap-1.5">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-400 to-blue-400"
                                    animate={{
                                        y: [-3, 3, -3],
                                        scale: [1, 1.2, 1],
                                    }}
                                    transition={{
                                        duration: 0.8,
                                        repeat: Infinity,
                                        delay: i * 0.15,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Thinking text */}
                        <motion.span
                            className="text-xs text-slate-400 whitespace-nowrap"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            Donna is thinking
                        </motion.span>

                        {/* Sparkle icon */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}