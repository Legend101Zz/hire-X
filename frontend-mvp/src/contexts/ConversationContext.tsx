/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ConversationContextType {
    sessionId: string | null;
    setSessionId: (id: string | null) => void;
    messages: any[];
    setMessages: (messages: any[]) => void;
    idealProfile: any;
    setIdealProfile: (profile: any) => void;
    completeness: number;
    setCompleteness: (value: number) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [idealProfile, setIdealProfile] = useState<any>({
        must_have_skills: [],
        nice_to_have_skills: [],
        industries: [],
        locations: []
    });
    const [completeness, setCompleteness] = useState(0);

    return (
        <ConversationContext.Provider
            value={{
                sessionId,
                setSessionId,
                messages,
                setMessages,
                idealProfile,
                setIdealProfile,
                completeness,
                setCompleteness
            }}
        >
            {children}
        </ConversationContext.Provider>
    );
}

export function useConversation() {
    const context = useContext(ConversationContext);
    if (!context) {
        throw new Error('useConversation must be used within ConversationProvider');
    }
    return context;
}