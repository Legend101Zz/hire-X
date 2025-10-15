
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TypeAnimation } from 'react-type-animation';
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
    GripVertical,
    Minimize2,
    Maximize2,
    ThumbsUp,
    ThumbsDown
} from 'lucide-react';
import ScorecardDocument from '@/components/scorecard/ScorecardBuilderDocument';
import router from 'next/router';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';

// HR Trivia for loading states
const HR_TRIVIA = [
    { icon: <Brain className="w-4 h-4" />, text: "AI can reduce time-to-hire by up to 70%" },
    { icon: <Sparkles className="w-4 h-4" />, text: "75% of qualified candidates aren't actively looking" },
    { icon: <Zap className="w-4 h-4" />, text: "Employee referrals have 45% retention rate" },
];

interface Message {
    role: 'user' | 'assistant' | 'system';  // ✅ ADD 'system' for sample cards
    content: string;
    timestamp?: string;
    type?: 'text' | 'samples';  // ✅ ADD type field
    data?: any;  // ✅ ADD data field for samples
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
    const [messages, setMessages] = useState<Message[]>([]);
    const [scorecard, setScorecard] = useState<Scorecard | null>(null);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingScorecard, setIsFetchingScorecard] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // ✅ FIX: Update phase type
    const [phase, setPhase] = useState<'validation' | 'sample_validation' | 'ready_for_full_search' | 'max_iterations_reached'>('validation');

    const [isChatOpen, setIsChatOpen] = useState(true);
    const [showSamplesButton, setShowSamplesButton] = useState(false);
    const [sampleCandidates, setSampleCandidates] = useState<any[]>([]);
    const [isLoadingSamples, setIsLoadingSamples] = useState(false);
    const [sampleIterationCount, setSampleIterationCount] = useState(0);

    // Resizable panel state
    const [chatWidth, setChatWidth] = useState(450);
    const [isResizing, setIsResizing] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const resizeStartXRef = useRef<number>(0);
    const resizeStartWidthRef = useRef<number>(450);

    useEffect(() => {
        fetchScorecard();
        connectWebSocket();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, [sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ✅ FIX: Show button after 2 user messages, keep showing it
    useEffect(() => {
        const userMessages = messages.filter(m => m.role === 'user').length;
        if (userMessages >= 2) {
            setShowSamplesButton(true);
        }
    }, [messages]);

    const fetchScorecard = async () => {
        setIsFetchingScorecard(true);
        setFetchError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
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
            setFetchError('Network error. Please check your connection.');
        } finally {
            setIsFetchingScorecard(false);
        }
    };

    const connectWebSocket = () => {
        try {
            const token = localStorage.getItem('token');
            const ws = new WebSocket(`${WS_BASE_URL}/session/${sessionId}?token=${token}`);

            ws.onopen = () => console.log('✅ WebSocket connected');

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.action === 'scorecard_created') {
                    setScorecard(data.data.scorecard);
                    setPhase(data.data.phase || 'validation');
                } else if (data.action === 'scorecard_updated') {
                    setScorecard(data.data.scorecard);
                    if (data.data.phase) setPhase(data.data.phase);
                } else if (data.action === 'samples_ready') {
                    setSampleCandidates(data.data.samples || []);

                    // ✅ NEW: Handle different result types
                    if (data.data.no_results && data.data.suggestion) {
                        // Show AI suggestion UI
                        setMessages(prev => [...prev, {
                            role: 'system',
                            type: 'suggestion',
                            content: data.data.message,
                            data: { suggestion: data.data.suggestion },
                            timestamp: new Date().toISOString()
                        }]);
                    } else if (data.data.below_threshold) {
                        // Show candidates below threshold with warning
                        setMessages(prev => [...prev, {
                            role: 'system',
                            type: 'samples',
                            content: data.data.message,
                            data: {
                                samples: data.data.samples,
                                below_threshold: true,
                                highest_score: data.data.highest_score,
                                threshold: data.data.threshold
                            },
                            timestamp: new Date().toISOString()
                        }]);
                    } else if (data.data.samples && data.data.samples.length > 0) {
                        // Normal success case
                        setMessages(prev => [...prev, {
                            role: 'system',
                            type: 'samples',
                            content: data.data.message,
                            data: { samples: data.data.samples },
                            timestamp: new Date().toISOString()
                        }]);
                    } else {
                        // Fallback
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: data.data.message || 'No candidates found.',
                            timestamp: new Date().toISOString()
                        }]);
                    }
                } else if (data.action === 'samples_rejected') {
                    setScorecard(data.data.scorecard);
                    setSampleIterationCount(data.data.iteration_count || 0);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: data.data.message,
                        timestamp: new Date().toISOString()
                    }]);

                    if (data.data.phase === 'sample_iteration') {
                        setTimeout(() => handleFindSamples(), 1000);
                    } else if (data.data.phase === 'max_iterations_reached') {
                        setPhase('max_iterations_reached');
                    }
                } else if (data.action === 'samples_approved') {
                    const data = JSON.parse(event.data);

                    if (data.action === 'samples_approved') {
                        setPhase('ready_for_full_search');
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: data.data.message || "Perfect! Your criteria is ready. Let's find all matching candidates! 🚀",
                            timestamp: new Date().toISOString()
                        }]);

                        // ✅ NEW: Redirect to results page
                        if (data.data.redirect_to_results) {
                            setTimeout(() => {
                                router.push(`/results?session=${sessionId}`);
                            }, 2000); // Wait 2 seconds so user sees the success message
                        }
                    }
                }
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                // Don't show error to user, will auto-reconnect
            };

            ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                if (event.code !== 1000) {
                    console.log('Attempting to reconnect...');
                    reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('❌ WebSocket connection failed:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = inputMessage.trim();
        const timestamp = new Date().toISOString();
        setInputMessage('');
        setIsLoading(true);

        setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp }]);

        try {
            const token = localStorage.getItem('token');
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
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message,
                    timestamp: new Date().toISOString()
                }]);
                setScorecard(data.scorecard);
                setPhase(data.phase);
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error. Please try again.',
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered a network error. Please try again.',
                timestamp: new Date().toISOString()
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

    const handleScorecardUpdate = async (updatedScorecard: Scorecard) => {
        setScorecard(updatedScorecard);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ scorecard: updatedScorecard })
            });
        } catch (error) {
            console.error('❌ Error updating scorecard:', error);
        }
    };

    const handleProceedToSearch = () => {
        console.log('🚀 Proceeding to search with scorecard:', scorecard);
        // TODO: Navigate to full search results page
    };

    const handleFindSamples = async () => {
        setIsLoadingSamples(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}/sample-search`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Response will be handled by WebSocket
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Sorry, I encountered an error finding samples. Please try again.',
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (error) {
            console.error('Error finding samples:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Network error. Please check your connection.',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsLoadingSamples(false);
        }
    };

    const handleApplySuggestion = async (suggestion: any) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}/apply-suggestion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    suggestion: suggestion,
                    accepted: true
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Results will come via WebSocket
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: 'Great! I updated the criteria. Let me search again... 🔍',
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (error) {
            console.error('Error applying suggestion:', error);
        }
    };

    const handleApproveSamples = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}/approve-samples`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();

                // ✅ Direct redirect if API says so
                if (data.redirect_to_results) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: "Perfect! Redirecting you to search all candidates... 🚀",
                        timestamp: new Date().toISOString()
                    }]);

                    setTimeout(() => {
                        router.push(`/results?session=${sessionId}`);
                    }, 1500);
                }
            }
        } catch (error) {
            console.error('Error approving samples:', error);
        }
    };
    const handleRejectSamples = async (feedback: string) => {
        // Add user feedback as a message
        setMessages(prev => [...prev, {
            role: 'user',
            content: `Not quite right: ${feedback}`,
            timestamp: new Date().toISOString()
        }]);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}/reject-samples`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ feedback })
            });

            if (response.ok) {
                const data = await response.json();
                setScorecard(data.scorecard);
                setSampleIterationCount(data.iteration_count || 0);
                // Response will be handled by WebSocket
            }
        } catch (error) {
            console.error('Error rejecting samples:', error);
        }
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        setIsResizing(true);
        resizeStartXRef.current = e.clientX;
        resizeStartWidthRef.current = chatWidth;
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const deltaX = resizeStartXRef.current - e.clientX;
            const newWidth = Math.min(Math.max(resizeStartWidthRef.current + deltaX, 300), 800);
            setChatWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

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
                </div>
            </div>
        );
    }

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

                    <div className="flex items-center gap-2">
                        {isChatOpen && !isMinimized && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsMinimized(true)}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Minimize chat"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </motion.button>
                        )}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                setIsChatOpen(!isChatOpen);
                                setIsMinimized(false);
                            }}
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
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 overflow-hidden">
                    <ScorecardDocument
                        scorecard={scorecard}
                        onUpdate={handleScorecardUpdate}
                        sessionId={sessionId}
                        isEditable={phase !== 'ready_for_full_search'}
                    />
                </div>

                <AnimatePresence>
                    {isChatOpen && !isMinimized && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: chatWidth, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="relative border-l border-gray-200 bg-white overflow-hidden flex flex-col"
                            style={{ width: chatWidth }}
                        >
                            <div
                                className={`absolute left-0 top-0 bottom-0 w-1 hover:w-2 bg-transparent hover:bg-blue-500 cursor-col-resize z-50 transition-all ${isResizing ? 'w-2 bg-blue-500' : ''}`}
                                onMouseDown={handleResizeStart}
                            >
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4 text-white" />
                                </div>
                            </div>

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
                                onFindSamples={handleFindSamples}
                                sampleCandidates={sampleCandidates}
                                onApproveSamples={handleApproveSamples}
                                onRejectSamples={handleRejectSamples}
                                isLoadingSamples={isLoadingSamples}
                                showSamplesButton={showSamplesButton}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {isChatOpen && isMinimized && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 80, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="border-l border-gray-200 bg-gradient-to-b from-blue-50 to-purple-50 flex flex-col items-center justify-center cursor-pointer hover:from-blue-100 hover:to-purple-100 transition-colors"
                            onClick={() => setIsMinimized(false)}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                <MessageSquare className="w-6 h-6 text-blue-600 mb-2" />
                            </motion.div>
                            <span className="text-xs font-medium text-gray-700 writing-mode-vertical transform rotate-180">
                                AI Chat
                            </span>
                            {messages.filter(m => m.role === 'assistant').length > 0 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="mt-2 w-2 h-2 bg-blue-600 rounded-full"
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {!isChatOpen && messages.length > 0 && (
                    <motion.button
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                            setIsChatOpen(true);
                            setIsMinimized(false);
                        }}
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
// CONVERSATION PANEL
// ============================================================================

interface ConversationPanelProps {
    messages: Message[];
    inputMessage: string;
    isLoading: boolean;
    phase: 'validation' | 'sample_validation' | 'ready_for_full_search' | 'max_iterations_reached';
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onInputChange: (value: string) => void;
    onSendMessage: () => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onProceedToSearch: () => void;
    onFindSamples: () => void;
    sampleCandidates: any[];
    onApproveSamples: () => void;
    onRejectSamples: (feedback: string) => void;
    isLoadingSamples: boolean;
    showSamplesButton: boolean;
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
    onProceedToSearch,
    onFindSamples,
    sampleCandidates,
    onApproveSamples,
    onRejectSamples,
    isLoadingSamples,
    showSamplesButton
}: ConversationPanelProps) {
    const [currentTrivia, setCurrentTrivia] = useState(HR_TRIVIA[0]);

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
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <motion.div
                                animate={{
                                    boxShadow: [
                                        "0 0 0 0 rgba(59, 130, 246, 0.4)",
                                        "0 0 0 10px rgba(59, 130, 246, 0)",
                                        "0 0 0 0 rgba(59, 130, 246, 0)"
                                    ]
                                }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                            >
                                <Brain className="w-5 h-5 text-white" />
                            </motion.div>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
                            />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                                Your Recruiting Buddy 🤝
                            </h3>
                            <p className="text-xs text-gray-600">Ready to help!</p>
                        </div>
                    </div>

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 px-3 py-1 bg-white rounded-full shadow-sm"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                                <Brain className="w-3 h-3 text-purple-600" />
                            </motion.div>
                            <span className="text-xs font-medium text-gray-700">Thinking...</span>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {messages.length === 0 ? (
                    <EmptyState />
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            {messages.map((message, index) => (
                                message.type === 'samples' ? (
                                    <SampleCard
                                        key={index}
                                        samples={message.data?.samples || []}
                                        onApprove={onApproveSamples}
                                        onReject={onRejectSamples}
                                    />

                                ) : (
                                    <MessageBubble key={index} message={message} index={index} />
                                )
                            ))}
                        </AnimatePresence>

                        {isLoading && <TypingIndicator trivia={currentTrivia} />}

                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* ✅ FIX: ALWAYS SHOW CHAT INPUT */}
            <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
                <div className="space-y-3">
                    {/* Chat Input - Always visible */}
                    <ChatInput
                        inputMessage={inputMessage}
                        isLoading={isLoading}
                        onInputChange={onInputChange}
                        onSendMessage={onSendMessage}
                        onKeyPress={onKeyPress}
                    />

                    {/* Optional buttons based on phase */}
                    <AnimatePresence>
                        {showSamplesButton && phase === 'validation' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <motion.button
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={onFindSamples}
                                    disabled={isLoadingSamples}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl hover:from-green-700 hover:to-teal-700 transition-all font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />

                                    {isLoadingSamples ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Finding Candidates...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-5 h-5" />
                                            <span>Show Me Sample Candidates! 👀</span>
                                        </>
                                    )}
                                </motion.button>
                            </motion.div>
                        )}

                        {phase === 'ready_for_full_search' && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onProceedToSearch}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 transition-all font-bold shadow-lg hover:shadow-xl"
                            >
                                <Search className="w-5 h-5" />
                                <span>Let's Find ALL Candidates! 🚀</span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
}

// ============================================================================
// SAMPLE CARD (Shows in messages area)
// ============================================================================

interface SampleCardProps {
    samples: any[];
    onApprove: () => void;
    onReject: (feedback: string) => void;
}

function SampleCard({ samples, onApprove, onReject }: SampleCardProps) {
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectFeedback, setRejectFeedback] = useState('');

    if (samples.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6"
            >
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                    <div>
                        <p className="text-sm font-bold text-yellow-900 mb-2">
                            No candidates found
                        </p>
                        <p className="text-sm text-yellow-800">
                            We couldn't find any candidates matching your criteria. Try adjusting your requirements in the chat above.
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-2xl p-6 shadow-xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-blue-200">
                <div className="flex items-center gap-3">
                    <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                        <Search className="w-5 h-5 text-white" />
                    </motion.div>
                    <div>
                        <h4 className="text-base font-bold text-gray-900">Sample Candidates</h4>
                        <p className="text-xs text-gray-700 mt-0.5">
                            Do these look good? 🤔
                        </p>
                    </div>
                </div>
                <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">
                    {samples.length} samples
                </span>
            </div>

            {/* Samples List */}
            <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
                {samples.map((candidate, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-xl p-4 border-2 border-blue-200 hover:border-blue-300 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <h5 className="text-base font-bold text-gray-900">
                                    {candidate.profile.first_name} {candidate.profile.last_name}
                                </h5>
                                <p className="text-sm text-gray-700 mt-1">
                                    {candidate.profile.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                    📍 {candidate.profile.location} • 🏢 {candidate.profile.current_industry}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                    {candidate.score}
                                </div>
                                <div className="text-xs text-gray-600">
                                    / {candidate.max_score}
                                </div>
                            </div>
                        </div>

                        {/* Score Breakdown */}
                        <div className="space-y-1.5 mt-3 pt-3 border-t border-blue-200">
                            {candidate.score_breakdown.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className={item.matched ? 'text-green-700 font-medium' : 'text-gray-500'}>
                                        {item.matched ? '✓' : '○'} {item.description}
                                    </span>
                                    <span className={item.matched ? 'text-green-700 font-bold' : 'text-gray-400'}>
                                        {item.earned_points}/{item.max_points}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Action Buttons */}
            {!showRejectForm ? (
                <div className="flex gap-3 pt-3 border-t-2 border-blue-200">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onApprove}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-semibold shadow-lg"
                    >
                        <ThumbsUp className="w-5 h-5" />
                        Looks Great! 👍
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                    >
                        <ThumbsDown className="w-5 h-5" />
                        Not Quite 👎
                    </motion.button>
                </div>
            ) : (
                <div className="space-y-3 pt-3 border-t-2 border-blue-200">
                    <p className="text-sm font-medium text-gray-900">
                        What's not quite right? Be specific so I can adjust! 💡
                    </p>
                    <textarea
                        value={rejectFeedback}
                        onChange={(e) => setRejectFeedback(e.target.value)}
                        placeholder="e.g., 'Too junior', 'Wrong industry', 'Need more Go experience'"
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-0 text-sm resize-none"
                        rows={3}
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                if (rejectFeedback.trim()) {
                                    onReject(rejectFeedback);
                                    setShowRejectForm(false);
                                    setRejectFeedback('');
                                }
                            }}
                            disabled={!rejectFeedback.trim()}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                            Submit Feedback
                        </button>
                        <button
                            onClick={() => {
                                setShowRejectForm(false);
                                setRejectFeedback('');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}


function SuggestionCard({ suggestion, onApply }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 shadow-xl"
        >
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 mb-2">
                        💡 No Results Found - Here's What I Suggest
                    </h4>
                    <p className="text-sm text-gray-800 leading-relaxed">
                        {suggestion.suggestion}
                    </p>
                </div>
            </div>

            {suggestion.reasoning && (
                <div className="bg-white rounded-lg p-4 mb-4 border border-yellow-200">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Why this helps:</p>
                    <p className="text-sm text-gray-900">{suggestion.reasoning}</p>
                </div>
            )}

            {suggestion.filters_to_remove && suggestion.filters_to_remove.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Filters to remove:</p>
                    <div className="flex flex-wrap gap-2">
                        {suggestion.filters_to_remove.map((field: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-red-100 text-red-800 rounded-md text-xs">
                                {field}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={() => onApply(suggestion)}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                    ✓ Apply This & Search Again
                </button>
                <button
                    onClick={() => { }}
                    className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                >
                    Keep Trying
                </button>
            </div>
        </motion.div>
    );
}

// ============================================================================
// MESSAGE BUBBLE WITH MARKDOWN
// ============================================================================

function MessageBubble({ message, index }: { message: Message; index: number }) {
    const [showTyping, setShowTyping] = useState(message.role === 'assistant');
    const [displayContent, setDisplayContent] = useState('');

    useEffect(() => {
        if (message.role === 'assistant' && showTyping) {
            // Simulate typewriter effect
            let currentIndex = 0;
            const content = message.content;
            const interval = setInterval(() => {
                if (currentIndex <= content.length) {
                    setDisplayContent(content.slice(0, currentIndex));
                    currentIndex++;
                } else {
                    setShowTyping(false);
                    clearInterval(interval);
                }
            }, 15); // Adjust speed here (lower = faster)

            return () => clearInterval(interval);
        } else {
            setDisplayContent(message.content);
        }
    }, [message.content, message.role]);


    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[90%] rounded-2xl px-5 py-4 shadow-md ${message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white'
                    : 'bg-white text-gray-900 border-2 border-gray-100'
                    }`}
            >
                {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b-2 border-gray-100">
                        <motion.div
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="w-7 h-7 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-sm"
                        >
                            <Sparkles className="w-4 h-4 text-white" />
                        </motion.div>
                        <div>
                            <span className="text-xs font-bold text-gray-800">AI Assistant</span>
                            {showTyping && (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] text-gray-500">typing</span>
                                    <motion.span
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="text-xs text-gray-400"
                                    >
                                        ●
                                    </motion.span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : ''
                    }`}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ node, ...props }) => (
                                <h1 className="text-lg font-bold mb-2 mt-4 text-gray-900" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                                <h2 className="text-base font-bold mb-2 mt-3 text-gray-900" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                                <h3 className="text-sm font-bold mb-1 mt-2 text-gray-800" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                                <p className="mb-3 leading-relaxed text-gray-800 text-sm" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                                <ul className="list-disc list-inside space-y-2 my-3 text-gray-800" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                                <ol className="list-decimal list-inside space-y-2 my-3 text-gray-800" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                                <li className="text-sm text-gray-800 ml-2" {...props} />
                            ),
                            strong: ({ node, ...props }) => (
                                <strong className="font-bold text-gray-900" {...props} />
                            ),
                            em: ({ node, ...props }) => (
                                <em className="italic text-gray-700" {...props} />
                            ),
                            code: ({ node, inline, ...props }: any) =>
                                inline ? (
                                    <code className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-800" {...props} />
                                ) : (
                                    <code className="block p-3 bg-gray-100 border border-gray-200 rounded text-xs font-mono my-2 overflow-x-auto text-gray-800" {...props} />
                                ),
                            blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-4 border-blue-500 pl-4 my-3 italic text-gray-700 bg-blue-50 py-2 rounded-r" {...props} />
                            ),
                        }}
                    >
                        {displayContent}
                    </ReactMarkdown>

                    {showTyping && (
                        <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="inline-block w-2 h-4 bg-gray-800 ml-1"
                        />
                    )}
                </div>

                {message.timestamp && !showTyping && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className={`text-xs mt-2 block ${message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                            }`}
                    >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </motion.span>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

function TypingIndicator({ trivia }: { trivia: typeof HR_TRIVIA[0] }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-start"
        >
            <div className="max-w-[90%] space-y-3">
                {/* Enhanced Typing bubble */}
                <div className="bg-white rounded-2xl px-5 py-4 border-2 border-gray-200 shadow-lg inline-block">
                    <div className="flex items-center gap-4">
                        {/* Animated Avatar */}
                        <motion.div
                            animate={{
                                rotate: [0, 360],
                                scale: [1, 1.1, 1]
                            }}
                            transition={{
                                rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                            }}
                            className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-md"
                        >
                            <Brain className="w-4 h-4 text-white" />
                        </motion.div>

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-800">Thinking</span>
                                <div className="flex items-center gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                y: [-3, -8, -3],
                                                scale: [1, 1.2, 1],
                                            }}
                                            transition={{
                                                repeat: Infinity,
                                                duration: 0.8,
                                                delay: i * 0.15,
                                                ease: "easeInOut"
                                            }}
                                            className="w-2.5 h-2.5 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-full shadow-sm"
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Typing animation text */}
                            <TypeAnimation
                                sequence={[
                                    'Analyzing your request',
                                    1000,
                                    'Crafting the perfect response',
                                    1000,
                                    'Almost there',
                                    1000,
                                ]}
                                wrapper="span"
                                speed={50}
                                className="text-xs text-gray-600 font-medium"
                                repeat={Infinity}
                            />
                        </div>
                    </div>
                </div>

                {/* Enhanced trivia card */}
                <motion.div
                    key={trivia.text}
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ duration: 0.5 }}
                    className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl px-5 py-4 border-2 border-purple-200 shadow-md"
                >
                    <div className="flex items-start gap-3">
                        <motion.span
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-2xl"
                        >
                            {trivia.icon}
                        </motion.span>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-purple-900 mb-1.5">
                                💡 Quick Insight
                            </p>
                            <p className="text-sm text-gray-800 leading-relaxed font-medium">
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
            className="h-full flex items-center justify-center p-6"
        >
            <div className="text-center max-w-sm">
                <motion.div
                    animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <MessageSquare className="w-12 h-12 text-blue-600" />
                </motion.div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                    Hey there! 👋
                </h3>

                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                    Let's find some amazing candidates together! I'll ask you a few quick questions
                    to understand exactly what you're looking for.
                </p>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-xs text-blue-900 font-medium mb-2">How this works:</p>
                    <div className="space-y-2 text-left">
                        {[
                            { icon: "💬", text: "I'll ask one question at a time" },
                            { icon: "✏️", text: "You can edit the scorecard anytime" },
                            { icon: "🎯", text: "We'll refine until it's perfect" }
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 + (i * 0.1) }}
                                className="flex items-center gap-3"
                            >
                                <span className="text-lg">{item.icon}</span>
                                <p className="text-xs text-gray-700">{item.text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                    Just answer naturally - I'm here to help! ☕
                </p>
            </div>
        </motion.div>
    );
}

// ============================================================================
// CHAT INPUT
// ============================================================================

function ChatInput({ inputMessage, isLoading, onInputChange, onSendMessage, onKeyPress }: any) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [showEncouragement, setShowEncouragement] = useState(false);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputMessage]);

    useEffect(() => {
        if (inputMessage.length > 0) {
            setShowEncouragement(true);
        } else {
            setShowEncouragement(false);
        }
    }, [inputMessage]);

    return (
        <div className="space-y-2">
            <motion.div
                animate={{
                    boxShadow: isFocused
                        ? '0 0 0 3px rgba(59, 130, 246, 0.1)'
                        : '0 0 0 0px rgba(59, 130, 246, 0)'
                }}
                className="flex items-end gap-3 rounded-2xl transition-all"
            >
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={inputMessage}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyPress={onKeyPress}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Just type naturally... I'm all ears! 👂"
                        disabled={isLoading}
                        rows={1}
                        className="w-full px-5 py-4 pr-12 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 focus:border-blue-400 rounded-2xl focus:outline-none disabled:opacity-50 text-sm resize-none transition-all placeholder-gray-500 font-medium text-gray-900"
                        style={{
                            minHeight: '52px',
                            maxHeight: '120px',
                        }}
                    />
                    <AnimatePresence>
                        {inputMessage && (
                            <motion.button
                                initial={{ scale: 0, rotate: -90 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 90 }}
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onInputChange('')}
                                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 transition-colors bg-gray-200 hover:bg-gray-300 rounded-full p-1"
                            >
                                <X className="w-4 h-4" />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Character count for long messages */}
                    {inputMessage.length > 200 && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-2 left-4 text-xs text-gray-500"
                        >
                            {inputMessage.length} characters
                        </motion.div>
                    )}
                </div>

                <motion.button
                    whileHover={{ scale: 1.05, rotate: -5 }}
                    whileTap={{ scale: 0.95, rotate: 5 }}
                    onClick={onSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="px-5 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-2xl hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center min-w-[52px]"
                >
                    <AnimatePresence mode="wait">
                        {isLoading ? (
                            <motion.div
                                key="loading"
                                initial={{ rotate: 0, scale: 0 }}
                                animate={{ rotate: 360, scale: 1 }}
                                exit={{ rotate: 0, scale: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="send"
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 10, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Send className="w-5 h-5" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </motion.div>

            {/* Dynamic hint text */}
            <AnimatePresence mode="wait">
                {showEncouragement && !isLoading ? (
                    <motion.div
                        key="encouragement"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-2 px-2"
                    >
                        <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            className="text-sm"
                        >
                            ✨
                        </motion.span>
                        <p className="text-xs text-purple-600 font-semibold">
                            Looking good! Press Enter to send
                        </p>
                    </motion.div>
                ) : (
                    <motion.p
                        key="hint"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-gray-500 px-2 font-medium"
                    >
                        Press{' '}
                        <kbd className="px-2 py-1 bg-gray-200 border border-gray-300 rounded text-xs font-bold text-gray-700 shadow-sm">
                            Enter
                        </kbd>{' '}
                        to send
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// COMPLETION STATE
// ============================================================================

function CompletionState({ onProceedToSearch }: { onProceedToSearch: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-3"
        >
            <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 10, -10, 0]
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"
                    >
                        <CheckCircle2 className="w-7 h-7 text-white" />
                    </motion.div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-green-900 mb-1">
                            Awesome! We're all set! 🎉
                        </h4>
                        <p className="text-xs text-green-700">
                            Your search criteria looks great
                        </p>
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onProceedToSearch}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-lg hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 transition-all font-semibold shadow-lg hover:shadow-xl"
                >
                    <Search className="w-5 h-5" />
                    <span>Let's Find Amazing Candidates! 🚀</span>
                </motion.button>

                <p className="text-xs text-center text-gray-600 mt-2">
                    This is going to be good! ✨
                </p>
            </div>
        </motion.div>
    );
}

// ============================================================================
// SAMPLE VALIDATION UI
// ============================================================================

interface SampleValidationUIProps {
    candidates: any[];
    onApprove: () => void;
    onReject: (feedback: string) => void;
}

function SampleValidationUI({ candidates, onApprove, onReject }: SampleValidationUIProps) {
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectFeedback, setRejectFeedback] = useState('');

    if (candidates.length === 0) {
        return (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-yellow-900 mb-1">
                            No candidates found
                        </p>
                        <p className="text-sm text-yellow-800">
                            We couldn't find any candidates matching your criteria. Try relaxing some requirements.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                    <h4 className="text-sm font-bold text-gray-900">Sample Candidates</h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                        Do these look good? Let me know if you want adjustments
                    </p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                    {candidates.length} samples
                </span>
            </div>

            {/* Sample Candidates List */}
            <div className="max-h-96 overflow-y-auto space-y-3">
                {candidates.map((candidate, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border-2 border-blue-200 hover:border-blue-300 transition-colors"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <h4 className="text-base font-bold text-gray-900">
                                    {candidate.profile.first_name} {candidate.profile.last_name}
                                </h4>
                                <p className="text-sm text-gray-700 mt-1">
                                    {candidate.profile.title}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                    📍 {candidate.profile.location} • 🏢 {candidate.profile.current_industry}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-blue-600">
                                    {candidate.score}
                                </div>
                                <div className="text-xs text-gray-600">
                                    / {candidate.max_score}
                                </div>
                            </div>
                        </div>

                        {/* Score Breakdown */}
                        <div className="space-y-1.5 mt-3 pt-3 border-t border-blue-200">
                            {candidate.score_breakdown.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className={item.matched ? 'text-green-700 font-medium' : 'text-gray-500'}>
                                        {item.matched ? '✓' : '○'} {item.description}
                                    </span>
                                    <span className={item.matched ? 'text-green-700 font-bold' : 'text-gray-400'}>
                                        {item.earned_points}/{item.max_points}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Action Buttons */}
            {!showRejectForm ? (
                <div className="flex gap-3 pt-3 border-t border-gray-200">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onApprove}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-semibold shadow-lg"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        Looks Great! Do Full Search
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                    >
                        <X className="w-5 h-5" />
                        Not Quite Right
                    </motion.button>
                </div>
            ) : (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-900">
                        What's not quite right? Be specific so I can adjust! 💡
                    </p>
                    <textarea
                        value={rejectFeedback}
                        onChange={(e) => setRejectFeedback(e.target.value)}
                        placeholder="e.g., 'Too junior', 'Wrong industry', 'Need more Go experience', etc."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-0 text-sm resize-none"
                        rows={3}
                        autoFocus
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                if (rejectFeedback.trim()) {
                                    onReject(rejectFeedback);
                                    setShowRejectForm(false);
                                    setRejectFeedback('');
                                }
                            }}
                            disabled={!rejectFeedback.trim()}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                            Submit Feedback
                        </button>
                        <button
                            onClick={() => {
                                setShowRejectForm(false);
                                setRejectFeedback('');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}