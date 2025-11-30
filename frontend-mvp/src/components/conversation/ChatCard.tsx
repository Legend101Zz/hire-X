

"use client";

import { motion } from "framer-motion";
import { MessageSquare, Bot, User, Loader2 } from "lucide-react";
import type { ConversationMessage } from "@/types";
import { RefObject } from "react";

interface ChatCardProps {
    messages: ConversationMessage[];
    isTyping: boolean;
    isCollapsed: boolean;
    messagesEndRef?: RefObject<HTMLDivElement>;
}

export default function ChatCard({
    messages,
    isTyping,
    isCollapsed,
    messagesEndRef
}: ChatCardProps) {
    if (isCollapsed) {
        return (
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl p-4">
                <div className="flex items-center gap-2 text-slate-400">
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm">{messages.length} messages</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col h-[500px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold">Chat with Donna</h3>
                        <p className="text-slate-400 text-xs">
                            {isTyping ? "Donna is typing..." : `${messages.length} messages`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <p className="text-center">
                            Start a conversation with Donna!<br />
                            <span className="text-sm">Tell her about the role you're hiring for.</span>
                        </p>
                    </div>
                ) : (
                    messages.map((message, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                        >
                            {/* Avatar */}
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.role === "user"
                                ? "bg-purple-500"
                                : "bg-gradient-to-br from-amber-400 to-orange-500"
                                }`}>
                                {message.role === "user" ? (
                                    <User className="w-4 h-4 text-white" />
                                ) : (
                                    <Bot className="w-4 h-4 text-white" />
                                )}
                            </div>

                            {/* Message Bubble */}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === "user"
                                ? "bg-purple-500/20 border border-purple-500/30 text-purple-100"
                                : "bg-slate-800 border border-slate-700/50 text-slate-100"
                                }`}>
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                {message.timestamp && (
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {new Date(message.timestamp).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}

                {/* Typing indicator */}
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-slate-800 border border-slate-700/50 rounded-2xl px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                                <span className="text-sm text-slate-400">Donna is thinking...</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}