'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import ChatInterface from '@/components/conversation/ChatInterface';
import IdealProfileCard from '@/components/conversation/IdealProfileCard';
import SampleProfile from '@/components/conversation/SampleProfile';
import JDUpload from '@/components/conversation/JDUpload';
import Header from '@/components/ui/header';
import Sidebar from '@/components/ui/sidebar';
import { Sparkles, Upload, MessageSquare, Loader2 } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    quickReplies?: string[];
}

interface IdealProfile {
    role_title?: string;
    must_have_skills: string[];
    nice_to_have_skills: string[];
    seniority?: string;
    experience_years?: string;
    industries: string[];
    locations: string[];
    company_size?: string;
    additional_requirements?: string;
}

interface SampleProfileData {
    name: string;
    title: string;
    location: string;
    company: string;
    experience_years: number;
    skills: string[];
    seniority: string;
    profile_picture?: string;
}

export default function ConversationPage() {
    const router = useRouter();

    // State
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [idealProfile, setIdealProfile] = useState<IdealProfile>({
        must_have_skills: [],
        nice_to_have_skills: [],
        industries: [],
        locations: []
    });
    const [sampleProfile, setSampleProfile] = useState<SampleProfileData | null>(null);
    const [completeness, setCompleteness] = useState(0);
    const [isDonnaTyping, setIsDonnaTyping] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showJDUpload, setShowJDUpload] = useState(true);
    const [hasStarted, setHasStarted] = useState(false);

    // Start conversation
    const startConversation = async (initialMessage?: string) => {
        setIsLoading(true);
        setHasStarted(true);
        setShowJDUpload(false);

        try {
            const token = localStorage.getItem('token');
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(`${apiBaseUrl}/conversation/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    initial_message: initialMessage || "I'd like to find candidates"
                })
            });

            if (!response.ok) throw new Error('Failed to start conversation');

            const data = await response.json();
            setSessionId(data.session_id);

            // Add Donna's greeting
            setMessages([
                {
                    id: '1',
                    role: 'assistant',
                    content: data.donna_response || "Hi! I'm Donna, your AI recruitment assistant. Let's find your ideal candidate together. What role are you hiring for?",
                    timestamp: new Date(),
                    quickReplies: data.quick_replies || [
                        'Senior Developer',
                        'Marketing Manager',
                        'Sales Executive'
                    ]
                }
            ]);
        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('Failed to start conversation. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Send message
    const sendMessage = async (content: string) => {
        if (!sessionId || !content.trim()) return;

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date()
        };

        setMessages((prev) => [...prev, userMessage]);
        setIsDonnaTyping(true);
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(`${apiBaseUrl}/conversation/${sessionId}/message`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: content })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();

            // Add Donna's response
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.donna_response,
                timestamp: new Date(),
                quickReplies: data.quick_replies
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Update ideal profile
            if (data.ideal_profile) {
                setIdealProfile(data.ideal_profile);
                setCompleteness(data.completeness || 0);
            }

            // Update sample profile
            if (data.sample_profile) {
                setSampleProfile(data.sample_profile);
            }

            // If ready to search, redirect
            if (data.stage === 'ready' || data.completeness >= 100) {
                // Show final confirmation
                setTimeout(() => {
                    handleFinalize();
                }, 2000);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setIsDonnaTyping(false);
            setIsLoading(false);
        }
    };

    // Handle JD upload
    const handleJDUpload = async (file: File) => {
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            // Start conversation first if not started
            if (!sessionId) {
                await startConversation('I have a job description to upload');
            }

            // Upload JD
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${apiBaseUrl}/conversation/${sessionId}/upload-jd`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Failed to upload JD');

            const data = await response.json();

            // Update profile with extracted data
            if (data.ideal_profile) {
                setIdealProfile(data.ideal_profile);
                setCompleteness(data.completeness || 0);
            }

            // Add Donna's response about JD
            const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.donna_response || "Great! I've extracted the key requirements from your JD. Let me verify a few things to make sure we find the perfect candidates.",
                timestamp: new Date(),
                quickReplies: data.quick_replies
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setShowJDUpload(false);
            setHasStarted(true);
        } catch (error) {
            console.error('Error uploading JD:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    // Finalize and start search
    const handleFinalize = async () => {
        if (!sessionId) return;

        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(`${apiBaseUrl}/conversation/${sessionId}/finalize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to finalize');

            const data = await response.json();

            // Redirect to results page with progress tracking
            router.push(`/results/${data.search_session_id}?track=true`);
        } catch (error) {
            console.error('Error finalizing:', error);
            alert('Failed to start search. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <div className="flex pt-16">
                <Sidebar />

                <main className="flex-1 ml-64 p-8">
                    {!hasStarted ? (
                        // Welcome Screen
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-4xl mx-auto"
                        >
                            {/* Hero */}
                            <div className="text-center mb-12">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 200 }}
                                    className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                                >
                                    <Sparkles className="w-10 h-10 text-white" />
                                </motion.div>

                                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                                    Find Your Ideal Candidate
                                </h1>
                                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                                    Have a conversation with Donna, our AI assistant, to build your ideal candidate
                                    profile together. Or upload a job description to get started faster.
                                </p>
                            </div>

                            {/* Options */}
                            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                {/* Start Conversation */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => startConversation()}
                                    disabled={isLoading}
                                    className="p-8 bg-white rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:shadow-lg transition-all text-left group disabled:opacity-50"
                                >
                                    <MessageSquare className="w-12 h-12 text-violet-600 mb-4 group-hover:scale-110 transition-transform" />
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                        Start Conversation
                                    </h3>
                                    <p className="text-gray-600">
                                        Chat with Donna to collaboratively build your ideal candidate profile
                                    </p>
                                </motion.button>

                                {/* Upload JD */}
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    className="p-8 bg-white rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all"
                                >
                                    <Upload className="w-12 h-12 text-blue-600 mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload JD</h3>
                                    <p className="text-gray-600 mb-4">
                                        Upload a job description to automatically extract requirements
                                    </p>
                                    <JDUpload onUpload={handleJDUpload} isProcessing={isLoading} />
                                </motion.div>
                            </div>
                        </motion.div>
                    ) : (
                        // Conversation View
                        <div className="max-w-7xl mx-auto">
                            <div className="grid lg:grid-cols-3 gap-6">
                                {/* Left: Chat */}
                                <div className="lg:col-span-2 h-[calc(100vh-8rem)]">
                                    <ChatInterface
                                        sessionId={sessionId || ''}
                                        messages={messages}
                                        onSendMessage={sendMessage}
                                        isLoading={isLoading}
                                        isDonnaTyping={isDonnaTyping}
                                    />
                                </div>

                                {/* Right: Profile & Sample */}
                                <div className="space-y-6">
                                    <IdealProfileCard profile={idealProfile} completeness={completeness} />
                                    <SampleProfile profile={sampleProfile} isLoading={false} />

                                    {/* Search Button */}
                                    {completeness >= 100 && (
                                        <motion.button
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleFinalize}
                                            disabled={isLoading}
                                            className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-lg flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                    Starting Search...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-6 h-6" />
                                                    Yes, Search for Candidates!
                                                </>
                                            )}
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}