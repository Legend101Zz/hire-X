'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Send,
    Loader2,
    CheckCircle2,
    Search,
    X,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    Zap,
    Brain,
    TrendingUp,
    Users,
    Target,
    Lightbulb
} from 'lucide-react';
import ScorecardDocument from '@/components/scorecard/ScorecardBuilderDocument';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';

// HR Trivia for loading states
const HR_TRIVIA = [
    { icon: <Users className="w-4 h-4" />, text: "Did you know? The best candidates are often passive job seekers." },
    { icon: <Brain className="w-4 h-4" />, text: "75% of qualified candidates aren't actively looking for jobs." },
    { icon: <TrendingUp className="w-4 h-4" />, text: "Employee referrals have the highest retention rate at 45%." },
    { icon: <Target className="w-4 h-4" />, text: "It takes an average of 42 days to fill a position." },
    { icon: <Lightbulb className="w-4 h-4" />, text: "Companies with strong employer brands reduce cost per hire by 50%." },
    { icon: <Sparkles className="w-4 h-4" />, text: "68% of recruiters say investing in new tech is the best way to improve performance." },
    { icon: <Users className="w-4 h-4" />, text: "Cultural fit is cited as the most important quality in candidates." },
    { icon: <Brain className="w-4 h-4" />, text: "AI can reduce time-to-hire by up to 70%." },
];

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Scorecard {
    scorecard_id?: string;
    mustHaveFilters?: any[];
    scoringCriteria?: any[];
    expansions?: any;
    threshold?: number;
    metadata?: any;
    status?: string;
    updated_at?: string;
}

interface ScorecardBuilderProps {
    sessionId: string;
}

export default function ScorecardBuilder({ sessionId }: ScorecardBuilderProps) {
    // ========================================================================
    // STATE MANAGEMENT
    // ========================================================================
    const [messages, setMessages] = useState<Message[]>([]);
    const [scorecard, setScorecard] = useState<Scorecard | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingScorecard, setIsFetchingScorecard] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [phase, setPhase] = useState<'validation' | 'ready_to_search'>('validation');
    const [isChatOpen, setIsChatOpen] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ========================================================================
    // 🔌 WEBSOCKET SETUP - This runs once on mount
    // ========================================================================
    useEffect(() => {
        console.log('🔍 Initializing session:', sessionId);

        // Step 1: Fetch initial scorecard data
        fetchScorecard();

        // Step 2: Connect to WebSocket for real-time updates
        connectWebSocket();

        // Cleanup on unmount
        return () => {
            console.log('🧹 Cleaning up WebSocket connection');
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [sessionId]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ========================================================================
    // 📡 FETCH INITIAL SCORECARD DATA
    // ========================================================================
    const fetchScorecard = async () => {
        setIsFetchingScorecard(true);
        setFetchError(null);

        try {
            const token = localStorage.getItem('token');
            console.log('📡 Fetching scorecard from:', `${API_BASE_URL}/api/scorecard/${sessionId}`);

            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('📡 Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Scorecard data received:', data);

                // Update state with fetched data
                setScorecard(data.scorecard);
                setMessages(data.conversation || []);
                setPhase(data.phase || 'validation');
            } else if (response.status === 404) {
                setFetchError('Scorecard not found. Please start a new search.');
            } else if (response.status === 401) {
                setFetchError('Session expired. Please login again.');
            } else {
                const errorData = await response.json().catch(() => ({}));
                setFetchError(errorData.detail || 'Failed to load scorecard.');
            }
        } catch (error) {
            console.error('❌ Error fetching scorecard:', error);
            setFetchError('Network error. Please check your connection.');
        } finally {
            setIsFetchingScorecard(false);
        }
    };

    // ========================================================================
    // 🔌 WEBSOCKET CONNECTION - Real-time updates
    // ========================================================================
    const connectWebSocket = () => {
        try {
            const token = localStorage.getItem('token');
            const wsUrl = `${WS_BASE_URL}/session/${sessionId}?token=${token}`;

            console.log('🔌 Connecting to WebSocket:', wsUrl);
            const ws = new WebSocket(wsUrl);

            // ✅ Connection opened
            ws.onopen = () => {
                console.log('✅ WebSocket connected successfully');
            };

            // 📨 Message received - THIS IS WHERE REAL-TIME UPDATES HAPPEN
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 WebSocket message received:', data);

                    // Handle different message types
                    if (data.action === 'scorecard_created') {
                        console.log('🆕 New scorecard created');
                        setScorecard(data.data.scorecard);
                        setPhase(data.data.phase || 'validation');
                    }
                    else if (data.action === 'scorecard_updated') {
                        console.log('🔄 Scorecard updated');
                        setScorecard(data.data.scorecard);
                        if (data.data.phase) {
                            setPhase(data.data.phase);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            };

            // ❌ Connection error
            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };

            // 🔌 Connection closed
            ws.onclose = (event) => {
                console.log('🔌 WebSocket closed:', event.code, event.reason);

                // Attempt to reconnect after 3 seconds
                if (event.code !== 1000) { // 1000 = normal closure
                    console.log('🔄 Attempting to reconnect in 3 seconds...');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, 3000);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('❌ WebSocket connection failed:', error);
        }
    };

    // ========================================================================
    // 💬 SEND MESSAGE TO AI
    // ========================================================================
    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = inputMessage.trim();
        setInputMessage('');
        setIsLoading(true);

        // Optimistically add user message to UI
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const token = localStorage.getItem('token');
            console.log('💬 Sending message to AI:', userMessage);

            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMessage })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ AI response received:', data);

                // Add AI response to messages
                setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

                // Update scorecard and phase
                setScorecard(data.scorecard);
                setPhase(data.phase);
            } else {
                console.error('❌ Error response:', response.status);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.'
                }]);
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered a network error. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // ========================================================================
    // 📝 UPDATE SCORECARD (Manual edits from document)
    // ========================================================================
    const handleScorecardUpdate = async (updatedScorecard: Scorecard) => {
        // Optimistically update UI
        setScorecard(updatedScorecard);

        // Save to backend
        try {
            const token = localStorage.getItem('token');
            console.log('💾 Saving scorecard updates...');

            await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ scorecard: updatedScorecard })
            });

            console.log('✅ Scorecard saved successfully');
        } catch (error) {
            console.error('❌ Error updating scorecard:', error);
        }
    };

    // ========================================================================
    // 🚀 PROCEED TO SEARCH
    // ========================================================================
    const handleProceedToSearch = () => {
        // TODO: Navigate to candidate search results
        console.log('🚀 Proceeding to search with scorecard:', scorecard);
        // router.push(`/search?session=${sessionId}`);
    };

    // ========================================================================
    // 🎨 LOADING STATE
    // ========================================================================
    if (isFetchingScorecard) {
        return (
            <div className="h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                        <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                    </motion.div>
                    <p className="text-base font-medium text-gray-900 mb-1">Loading your scorecard...</p>
                    <p className="text-sm text-gray-500">Session: {sessionId.slice(0, 8)}...</p>
                </div>
            </div>
        );
    }

    // ========================================================================
    // ❌ ERROR STATE
    // ========================================================================
    if (fetchError) {
        return (
            <div className="h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Scorecard</h2>
                    <p className="text-sm text-gray-600 mb-6">{fetchError}</p>
                    <button
                        onClick={fetchScorecard}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // ========================================================================
    // 🎨 MAIN UI
    // ========================================================================
    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-8 py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">
                                Build Your Search Criteria
                            </h1>
                            <p className="text-sm text-gray-500">
                                Collaborate with AI to refine your candidate search
                            </p>
                        </div>
                    </div>

                    {/* Chat Toggle Button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <MessageSquare className="w-4 h-4" />
                        {isChatOpen ? (
                            <>
                                <span>Hide Chat</span>
                                <ChevronUp className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                <span>Show Chat</span>
                                <ChevronDown className="w-4 h-4" />
                            </>
                        )}
                    </motion.button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Scorecard Document - Main Focus */}
                <div className="flex-1 overflow-hidden">
                    <ScorecardDocument
                        scorecard={scorecard}
                        onUpdate={handleScorecardUpdate}
                        sessionId={sessionId}
                        isEditable={phase !== 'ready_to_search'}
                    />
                </div>

                {/* Conversation Panel - Collapsible */}
                <AnimatePresence>
                    {isChatOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '450px', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="border-l border-gray-200 bg-white overflow-hidden flex flex-col"
                        >
                            <ConversationPanel
                                messages={messages}
                                inputMessage={inputMessage}
                                isLoading={isLoading}
                                phase={phase}
                                messagesEndRef={messagesEndRef}
                                onInputChange={setInputMessage}
                                onSendMessage={handleSendMessage}
                                onKeyPress={handleKeyPress}
                                onProceedToSearch={handleProceedToSearch}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating Chat Button (when chat is closed) */}
            <AnimatePresence>
                {!isChatOpen && messages.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsChatOpen(true)}
                        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center z-50"
                    >
                        <MessageSquare className="w-6 h-6" />
                        {messages.filter(m => m.role === 'assistant').length > 0 && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
                            >
                                {messages.filter(m => m.role === 'assistant').length}
                            </motion.span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}


// ============================================================================
// 💬 ENHANCED CONVERSATION PANEL COMPONENT
// ============================================================================

interface ConversationPanelProps {
    messages: Message[];
    inputMessage: string;
    isLoading: boolean;
    phase: 'validation' | 'ready_to_search';
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onInputChange: (value: string) => void;
    onSendMessage: () => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onProceedToSearch: () => void;
}

function ConversationPanel({
    messages,
    inputMessage,
    isLoading,
    phase,
    messagesEndRef,
    onInputChange,
    onSendMessage,
    onKeyPress,
    onProceedToSearch
}: ConversationPanelProps) {
    const [currentTrivia, setCurrentTrivia] = useState(HR_TRIVIA[0]);

    // Rotate trivia while loading
    useEffect(() => {
        if (isLoading) {
            const interval = setInterval(() => {
                setCurrentTrivia(HR_TRIVIA[Math.floor(Math.random() * HR_TRIVIA.length)]);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    return (
        <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <Brain className="w-5 h-5 text-white" />
                        </div>
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
                        <p className="text-xs text-gray-600">Always here to help</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {messages.map((message, index) => (
                                <MessageBubble key={index} message={message} index={index} />
                            ))}
                        </AnimatePresence>

                        {isLoading && <TypingIndicator trivia={currentTrivia} />}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
                {phase === 'ready_to_search' ? (
                    <CompletionState onProceedToSearch={onProceedToSearch} />
                ) : (
                    <ChatInput
                        inputMessage={inputMessage}
                        isLoading={isLoading}
                        onInputChange={onInputChange}
                        onSendMessage={onSendMessage}
                        onKeyPress={onKeyPress}
                    />
                )}
            </div>
        </>
    );
}

// ============================================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================================

function MessageBubble({ message, index }: { message: Message; index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                        : 'bg-gray-100 text-gray-900 border border-gray-200'
                    }`}
            >
                {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">AI Assistant</span>
                    </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                </p>
                <span className={`text-xs mt-2 block ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </motion.div>
    );
}

// ============================================================================
// TYPING INDICATOR WITH TRIVIA
// ============================================================================

function TypingIndicator({ trivia }: { trivia: typeof HR_TRIVIA[0] }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-start"
        >
            <div className="max-w-[85%] space-y-3">
                {/* Typing Animation */}
                <div className="bg-gray-100 rounded-2xl px-4 py-3 border border-gray-200 inline-block">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <Sparkles className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-gray-600">AI is thinking</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 1.5,
                                        delay: i * 0.2
                                    }}
                                    className="w-2 h-2 bg-blue-600 rounded-full"
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* HR Trivia */}
                <motion.div
                    key={trivia.text}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.5 }}
                    className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl px-4 py-3 border border-purple-100"
                >
                    <div className="flex items-start gap-3">
                        <div className="text-purple-600 mt-0.5">
                            {trivia.icon}
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-purple-900 mb-1">
                                HR Insight
                            </p>
                            <p className="text-xs text-gray-700 leading-relaxed">
                                {trivia.text}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex items-center justify-center"
        >
            <div className="text-center max-w-sm px-4">
                <motion.div
                    animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 3,
                        ease: "easeInOut"
                    }}
                    className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <MessageSquare className="w-10 h-10 text-blue-600" />
                </motion.div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Let's Build Something Great
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                    I'll help you refine your search criteria by asking questions and understanding your needs.
                    You can also edit the document directly anytime!
                </p>

                {/* Quick Tips */}
                <div className="mt-6 space-y-2">
                    <div className="flex items-start gap-2 text-left">
                        <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Ask me to clarify any requirements</p>
                    </div>
                    <div className="flex items-start gap-2 text-left">
                        <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Request changes to scoring criteria</p>
                    </div>
                    <div className="flex items-start gap-2 text-left">
                        <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Get explanations on any section</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ============================================================================
// CHAT INPUT
// ============================================================================

function ChatInput({
    inputMessage,
    isLoading,
    onInputChange,
    onSendMessage,
    onKeyPress
}: any) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [inputMessage]);

    return (
        <div className="space-y-2">
            <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={inputMessage}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyPress={onKeyPress}
                        placeholder="Ask me anything or suggest changes..."
                        disabled={isLoading}
                        rows={1}
                        className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm resize-none max-h-32 transition-all"
                        style={{ minHeight: '44px' }}
                    />
                    {inputMessage && (
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            onClick={() => onInputChange('')}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </motion.button>
                    )}
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="px-4 py-3 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </motion.button>
            </div>
            <p className="text-xs text-gray-500 px-1">
                Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-xs">Shift + Enter</kbd> for new line
            </p>
        </div>
    );
}

// ============================================================================
// COMPLETION STATE
// ============================================================================

function CompletionState({ onProceedToSearch }: { onProceedToSearch: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
        >
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-green-900">All Set!</h4>
                        <p className="text-xs text-green-700">Your search criteria is ready</p>
                    </div>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onProceedToSearch}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-sm"
                >
                    <Search className="w-4 h-4" />
                    Find Candidates Now
                </motion.button>
            </div>
        </motion.div>
    );
}