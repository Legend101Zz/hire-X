'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Mic, ArrowUp, CpuIcon, Bot, User, Loader2, ExternalLink, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost, handleApiResponse } from '@/utils/api';
import Header from './header';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'indicator' | 'table' | 'results_button' | 'followup_questions';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  sessionId?: string;
  questions?: FollowupQuestion[];
}

interface FollowupQuestion {
  id: string;
  question: string;
  answer?: string;
  isAnswered?: boolean;
}

interface FollowupQuestionComponentProps {
  question: FollowupQuestion;
  messageId: string;
  onAnswer: (messageId: string, questionId: string, answer: string) => void;
  isCurrentQuestion?: boolean;
}

const FollowupQuestionComponent: React.FC<FollowupQuestionComponentProps> = ({
  question,
  isCurrentQuestion = false
}) => {
  return (
    <div className={`rounded-xl p-4 transition-all duration-200 ${isCurrentQuestion && !question.isAnswered
      ? 'bg-violet-100 border-2 border-violet-300 shadow-md'
      : question.isAnswered
        ? 'bg-green-50 border border-green-200'
        : 'bg-violet-50 border border-violet-200'
      }`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isCurrentQuestion && !question.isAnswered
          ? 'bg-violet-300'
          : question.isAnswered
            ? 'bg-green-200'
            : 'bg-violet-200'
          }`}>
          <span className={`text-xs font-medium ${isCurrentQuestion && !question.isAnswered
            ? 'text-violet-800'
            : question.isAnswered
              ? 'text-green-700'
              : 'text-violet-700'
            }`}>
            {question.isAnswered ? '✓' : '?'}
          </span>
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium mb-1 ${isCurrentQuestion && !question.isAnswered
            ? 'text-violet-900'
            : question.isAnswered
              ? 'text-green-800'
              : 'text-violet-800'
            }`}>
            {isCurrentQuestion && !question.isAnswered ? 'Current Question:' : 'Question:'}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{question.question}</p>
        </div>
      </div>

      {question.isAnswered && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <div className="bg-white border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-600 mb-1">Your answer:</p>
            <p className="text-sm text-gray-800">{question.answer}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const PromptPage = () => {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('Claude 3.5 Sonnet');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [currentFollowupQuestion, setCurrentFollowupQuestion] = useState<{ messageId: string; questionId: string; question: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modelOptions = [
    'Claude 3.5 Sonnet',
    'Gemini 2.0 Pro',
    'OpenAI GPT-4o',
    'DeepSeek R1',
    'Grok 2'
  ];

  const steps = [
    'Prompt your requirements',
    'Finding relevant profiles',
    'Follow up questions',
    'Curating list and ranking profiles',
    'Results'
  ];

  // const heroText = "Find the Right Talent from Pool of 10 Million+ People";
  const heroText = "Hello there, what are you looking for today?";

  // Typing animation effect
  useEffect(() => {
    if (currentIndex < heroText.length && !isSubmitted) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + heroText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50); // Adjust speed here (50ms per character)

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, heroText, isSubmitted]);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Monitor session ID changes
  useEffect(() => {
    if (sessionId) {
      console.log('🆔 Session ID updated:', sessionId);
    }
  }, [sessionId]);


  // Cleanup WebSocket connection on component unmount
  useEffect(() => {
    return () => {
      if (websocket) {
        websocket.close();
        console.log('🧹 WebSocket connection cleaned up');
      }
    };
  }, [websocket]);

  // Function to add a new message
  const addMessage = (type: Message['type'], content: string, isTyping = false) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date(),
      isTyping
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  // Function to update a message (useful for typing indicators)
  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  };

  // Function to send POST request to parse prompt
  const sendPromptToBackend = async (prompt: string): Promise<string> => {
    try {
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await apiPost('/parse-prompt', { prompt }, token);
      const data = await handleApiResponse(response, () => {
        logout();
        router.push('/login');
      });

      console.log('📤 POST request successful:', data);
      return data.session_id;
    } catch (error) {
      console.error('❌ POST request failed:', error);
      throw error;
    }
  };

  // Function to send answer via WebSocket
  const sendAnswer = (question: string, answer: string) => {
    if (!question || !answer) {
      console.error('❌ Question and answer are required');
      return;
    }

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      const message = {
        action: 'answer',
        question: question,
        answer: answer
      };

      console.log('📤 Sending answer via WebSocket:', message);
      websocket.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket not connected. ReadyState:', websocket?.readyState);
    }
  };

  // Function to handle answering a followup question
  const handleAnswerQuestion = (messageId: string, questionId: string, answer: string) => {
    if (!answer.trim()) return null;

    // Find the current message and question before updating
    const currentMessage = messages.find(m => m.id === messageId);
    const currentQuestion = currentMessage?.questions?.find(q => q.id === questionId);

    if (!currentQuestion) return null;

    // Update the message to mark question as answered
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.questions) {
        const updatedQuestions = msg.questions.map(q =>
          q.id === questionId
            ? { ...q, answer: answer, isAnswered: true }
            : q
        );

        return {
          ...msg,
          questions: updatedQuestions
        };
      }
      return msg;
    }));

    // Send answer via WebSocket
    sendAnswer(currentQuestion.question, answer);

    // Add user's answer as a separate message
    addMessage('user', answer);

    // Find the next unanswered question from the updated state
    const updatedMessage = currentMessage && currentMessage.questions ? {
      ...currentMessage,
      questions: currentMessage.questions.map(q =>
        q.id === questionId
          ? { ...q, answer: answer, isAnswered: true }
          : q
      )
    } : null;

    const unansweredQuestions = updatedMessage?.questions?.filter(q => !q.isAnswered);

    // Return information about the next question
    return {
      hasMoreQuestions: unansweredQuestions && unansweredQuestions.length > 0,
      nextQuestion: unansweredQuestions && unansweredQuestions.length > 0 ? {
        messageId,
        questionId: unansweredQuestions[0].id,
        question: unansweredQuestions[0].question
      } : null
    };
  };

  // Handler functions for different WebSocket actions

  const handleFinalResults = () => {
    console.log('🎉 Final results received, current sessionId:', sessionId);
    addMessage('assistant', 'Results are ready! Click the button below to view your curated candidate list.');

    // Add a results button message
    const resultsButtonMessage: Message = {
      id: `results-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'results_button',
      content: 'View Results',
      timestamp: new Date(),
      sessionId: sessionId || undefined
    };

    console.log('🔘 Creating results button with sessionId:', resultsButtonMessage.sessionId);
    setMessages(prev => [...prev, resultsButtonMessage]);

    setCurrentStep(5); // Move to "Results" step
  };

  const handleProgressUpdate = (progressData: { step: string; message: string; progress?: number }) => {
    console.log('📊 Processing progress update:', progressData);

    // Extract progress information
    const { step, message, progress } = progressData;

    // Add progress message to chat (only if message exists and is meaningful)
    if (message && message.trim()) {
      addMessage('assistant', message);
    }

    // Update current step based on progress step
    switch (step) {
      case 'analyzing_prompt':
        setCurrentStep(1); // "Analyzing prompt" step
        break;
      case 'searching_database':
        setCurrentStep(2); // "Finding relevant profiles" step
        break;
      case 'serving_profiles':
        setCurrentStep(3); // "Generating follow-up questions" step
        break;
      case 'generating_questions':
        setCurrentStep(3); // "Generating follow-up questions" step
        break;
      case 'waiting_for_followup_answers':
        setCurrentStep(3); // "Generating follow-up questions" step
        break;
      case 'resuming_after_followup':
        setCurrentStep(4); // "Curating list and ranking profiles" step
        break;
      case 'scorecarding_profiles':
        setCurrentStep(4); // "Curating list and ranking profiles" step
        break;
      case 'finalizing_results':
        setCurrentStep(4); // "Curating list and ranking profiles" step
        break;
      case 'completed':
        setCurrentStep(5); // "Results" step
        break;
      default:
        console.log('🤷 Unknown progress step:', step);
    }

    // Log progress for debugging
    console.log(`📊 Progress: ${progress}% - ${step} - ${message}`);
  };

  const handleFollowupQuestions = (questionsData: unknown) => {
    // Handle different data formats from backend
    let questions: string[] = [];

    if (Array.isArray(questionsData)) {
      // If it's already an array of questions
      questions = questionsData.map(q => String(q));
    } else if (typeof questionsData === 'string') {
      // If it's a JSON string
      try {
        const parsed = JSON.parse(questionsData);
        if (Array.isArray(parsed)) {
          questions = parsed.map(q => String(q));
        }
      } catch (error) {
        console.error('Error parsing followup questions:', error);
        return;
      }
    } else if (questionsData && typeof questionsData === 'object') {
      // If it's an object with a data property
      const data = (questionsData as { data?: unknown }).data;
      if (Array.isArray(data)) {
        questions = data.map(q => String(q));
      }
    }

    if (questions.length === 0) {
      console.error('No valid questions found in followup data');
      return;
    }

    // Create a formatted message
    const messageContent = 'Based on your requirements, I have a few follow-up questions to better match candidates:';

    // Add the requirements message first
    addMessage('assistant', messageContent);

    // Create followup questions array
    const followupQuestions: FollowupQuestion[] = questions.map((question, index) => ({
      id: `question-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      question: question,
      isAnswered: false
    }));

    // Create a special followup questions message
    const followupMessage: Message = {
      id: `followup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'followup_questions',
      content: 'Please answer the following questions:',
      timestamp: new Date(),
      questions: followupQuestions
    };

    setMessages(prev => [...prev, followupMessage]);
    setCurrentStep(3); // Move to "Follow up questions" step

    // Set the first question as the current question to be answered
    if (followupQuestions.length > 0) {
      setCurrentFollowupQuestion({
        messageId: followupMessage.id,
        questionId: followupQuestions[0].id,
        question: followupQuestions[0].question
      });
    }
  };

  // Function to establish WebSocket connection
  const connectWebSocket = (sessionId: string) => {
    try {
      if (!token) {
        throw new Error('No authentication token available for WebSocket connection');
      }

      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_BASE_URL || 'ws://localhost:8000';
      const ws = new WebSocket(`${wsBaseUrl}/session/${sessionId}?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        console.log('🔌 WebSocket connected for session:', sessionId);
        setWebsocket(ws);
      };

      ws.onmessage = (event) => {
        console.log('📨 WebSocket message received:', event.data);

        try {
          const messageData = JSON.parse(event.data);
          console.log('📨 Parsed WebSocket message:', messageData);

          // Handle different action types
          switch (messageData.action) {
            case 'prompt_analysis':
              // Skip - handled by progress_update now
              console.log('📊 Prompt analysis action received (handled by progress_update):', messageData.data);
              break;
            case 'database_lookup':
              // Skip - handled by progress_update now  
              console.log('📊 Database lookup action received (handled by progress_update):', messageData.data);
              break;
            case 'final_results':
              console.log('📊 Final results action received:', messageData.data);
              handleFinalResults();
              break;
            case 'followup_questions':
              handleFollowupQuestions(messageData.data);
              break;
            case 'progress_update':
              console.log('📊 Progress update received:', messageData.data);
              handleProgressUpdate(messageData.data);
              break;
            case 'workflow_status':
              console.log('📊 Workflow status update:', messageData.data);
              // Only handle status updates that aren't covered by progress_update
              if (messageData.data === 'waiting_for_followup_answers') {
                // This will be handled by progress_update, so we can skip it here
                console.log('📊 Waiting for followup answers (handled by progress_update)');
              } else if (messageData.data === 'resuming_after_followup') {
                // This will be handled by progress_update, so we can skip it here
                console.log('📊 Resuming after followup (handled by progress_update)');
              } else if (messageData.data === 'completed') {
                // This will be handled by progress_update, so we can skip it here
                console.log('📊 Workflow completed (handled by progress_update)');
              }
              break;
            case 'scorecard':
              // Skip - handled by progress_update now
              console.log('📊 Scorecard update received (handled by progress_update):', messageData.data);
              break;
            default:
              console.log('🤷 Unknown action type:', messageData.action);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected for session:', sessionId);
        setWebsocket(null);
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      return ws;
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (inputText.trim()) {
      const prompt = inputText.trim();

      // Check if we're answering a follow-up question
      if (currentFollowupQuestion) {
        // Handle follow-up question answer and get next question info
        const result = handleAnswerQuestion(
          currentFollowupQuestion.messageId,
          currentFollowupQuestion.questionId,
          prompt
        );

        if (result) {
          if (result.hasMoreQuestions && result.nextQuestion) {
            // Set next unanswered question
            setCurrentFollowupQuestion(result.nextQuestion);
          } else {
            // No more questions to answer
            setCurrentFollowupQuestion(null);
          }
        }

        setInputText('');
        return;
      }

      // Regular prompt submission
      // Add user message
      addMessage('user', prompt);

      // Add typing indicator
      const indicatorId = addMessage('indicator', 'Processing your request...', true);

      // Collapse the interface and advance to next step
      setIsSubmitted(true);
      setCurrentStep(2);

      try {
        // Send POST request to backend
        console.log('📤 Sending prompt to backend:', prompt);
        const newSessionId = await sendPromptToBackend(prompt);

        // Store session ID
        setSessionId(newSessionId);
        console.log('💾 Session ID stored:', newSessionId);

        // Establish WebSocket connection
        connectWebSocket(newSessionId);

      } catch (error) {
        console.error('❌ Error in handleSubmit:', error);
        updateMessage(indicatorId, {
          content: 'Error processing request. Please try again.',
          isTyping: false
        });
      }

      setInputText('');
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Render individual message
  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';
    const isIndicator = message.type === 'indicator';
    const isTable = message.type === 'table';
    const isResultsButton = message.type === 'results_button';
    const isFollowupQuestions = message.type === 'followup_questions';

    if (isIndicator) {
      return (
        <div key={message.id} className="flex items-center justify-center py-4">
          <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
            {message.isTyping && (
              <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
            )}
            <span className="text-violet-700 text-sm font-medium">
              {message.content}
            </span>
          </div>
        </div>
      );
    }

    if (isTable) {
      return (
        <div key={message.id} className="flex justify-center py-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-4xl w-full">
            <div className="text-gray-600 text-sm">
              {message.content}
            </div>
          </div>
        </div>
      );
    }

    if (isResultsButton) {
      const hasSessionId = !!message.sessionId;
      return (
        <div key={message.id} className="flex justify-center py-4">
          <button
            onClick={() => {
              console.log('🔘 Results button clicked, sessionId:', message.sessionId);
              if (message.sessionId) {
                console.log('✅ Navigating to results page:', `/results/${message.sessionId}`);
                router.push(`/results/${message.sessionId}`);
              } else {
                console.error('❌ No sessionId available for results button');
                // Fallback: try to use the current sessionId from state
                if (sessionId) {
                  console.log('🔄 Using fallback sessionId from state:', sessionId);
                  router.push(`/results/${sessionId}`);
                } else {
                  console.error('❌ No sessionId available anywhere');
                }
              }
            }}
            disabled={!hasSessionId && !sessionId}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg transform hover:-translate-y-0.5 ${hasSessionId || sessionId
              ? 'bg-violet-500 hover:bg-violet-600 text-white hover:shadow-xl cursor-pointer'
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
          >
            <ExternalLink className="w-5 h-5" />
            <span>{message.content}</span>
            {!hasSessionId && !sessionId && (
              <span className="text-xs ml-2">(No session ID)</span>
            )}
          </button>
        </div>
      );
    }

    if (isFollowupQuestions) {
      return (
        <div key={message.id} className="py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex-1">
                <p className="text-sm text-gray-700 mb-4">{message.content}</p>
                <div className="space-y-3">
                  {message.questions?.map((question) => (
                    <FollowupQuestionComponent
                      key={question.id}
                      question={question}
                      messageId={message.id}
                      onAnswer={handleAnswerQuestion}
                      isCurrentQuestion={
                        currentFollowupQuestion?.questionId === question.id &&
                        currentFollowupQuestion?.messageId === message.id
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} py-3`}>
        <div className={`flex items-start gap-3 max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-violet-500' : 'bg-gray-200'
            }`}>
            {isUser ? (
              <User className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-gray-600" />
            )}
          </div>

          {/* Message content */}
          <div className={`rounded-2xl px-4 py-3 ${isUser
            ? 'bg-violet-500 text-white'
            : 'bg-white border border-gray-200 text-gray-800'
            }`}>
            <p className="text-sm leading-relaxed">{message.content}</p>
            <p className={`text-xs mt-2 ${isUser ? 'text-violet-100' : 'text-gray-500'
              }`}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Header */}
      <Header />
      {/* Progress Sidebar - Floating Glass Island */}
      <div className="fixed left-0 top-1/2 transform -translate-y-1/2 w-56 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-4 shadow-xl z-10 transition-transform duration-300 ease-in-out hover:translate-x-6 -translate-x-48">
        <div className="space-y-4">
          <h2 className="text-base text-gray-800/90 mb-4">Progress</h2>

          {/* Vertical Progress Line */}
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-300/50"></div>
            <div
              className="absolute left-3 top-0 w-0.5 bg-violet-500/80 transition-all duration-500 shadow-sm"
              style={{ height: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            ></div>

            {/* Steps */}
            <div className="space-y-6">
              {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isActive = currentStep === stepNumber;
                const isCompleted = currentStep > stepNumber;

                return (
                  <div key={stepNumber} className="relative flex items-start">
                    {/* Step Circle */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium z-10 transition-all duration-300 backdrop-blur-sm ${isCompleted
                      ? 'bg-violet-500/90 text-white shadow-lg'
                      : isActive
                        ? 'bg-violet-500/90 text-white ring-4 ring-violet-100/50 shadow-lg'
                        : 'bg-gray-200/60 text-gray-600/80'
                      }`}>
                      {isCompleted ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        stepNumber
                      )}
                    </div>

                    {/* Step Text */}
                    <div className="ml-3 mt-0.5">
                      <p className={`text-xs font-medium transition-colors ${isActive ? 'text-violet-600/90' : isCompleted ? 'text-gray-700/90' : 'text-gray-500/80'
                        }`}>
                        {step}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`w-full flex flex-col transition-all duration-500 ${isSubmitted ? 'h-screen' : 'min-h-screen items-center justify-center p-4'}`}>
        {!isSubmitted ? (
          <div className="w-full max-w-4xl mx-auto">
            {/* Main prompt text */}
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-light text-gray-400 mb-8 min-h-[4rem] flex items-center justify-center">
                <span>
                  {displayedText.split('Right Talent').map((part, index) => (
                    <React.Fragment key={index}>
                      {part.split('10 Million+').map((subPart, subIndex) => (
                        <React.Fragment key={subIndex}>
                          {subPart}
                          {subIndex < part.split('10 Million+').length - 1 && (
                            <span className="text-violet-500">10 Million+</span>
                          )}
                        </React.Fragment>
                      ))}
                      {index < displayedText.split('Right Talent').length - 1 && (
                        <span className="text-violet-500">Right Talent</span>
                      )}
                    </React.Fragment>
                  ))}
                  {currentIndex < heroText.length && (
                    <span className="animate-pulse text-gray-400 ml-1">|</span>
                  )}
                </span>
              </h1>
            </div>

            {/* Input and controls container */}
            <div className="bg-transparent rounded-2xl shadow-lg p-6 border border-gray-200">
              {/* Text input area */}
              <div className="mb-6">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Solutions Architect with 10+ years in FAANG companies near ..."
                  className="w-full h-12 p-4 text-gray-800 text-base border-0 outline-none resize-none placeholder-gray-400"
                />
              </div>

              {/* Controls bar */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Left side controls */}
                <div className="flex items-center gap-3">
                  {/* Add button */}
                  <button className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-3">
                  {/* Model dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowModelDropdown(!showModelDropdown);
                      }}
                      className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors h-9"
                    >
                      <span className="text-gray-700 text-xs font-medium">{selectedModel}</span>
                      <CpuIcon className="w-4 h-4 text-gray-500" />
                    </button>

                    {showModelDropdown && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                        {modelOptions.map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setSelectedModel(option);
                              setShowModelDropdown(false);
                            }}
                            className="w-full text-gray-800 text-xs text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Microphone button */}
                  <button className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors">
                    <Mic className="w-5 h-5 text-gray-600" />
                  </button>

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!inputText.trim()}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${inputText.trim()
                      ? 'bg-violet-500 hover:bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Optional: Example prompts */}
            <div className="mt-6 text-center">
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Senior Software Engineer with 3+ Years of Experience in Fintech near Mumbai',
                  'Product Manager with 5+ Years of Experience in SaaS near Bangalore',
                  'UX Designer with 3+ Years of Experience in Mobile Apps near Delhi NCR',
                  'Backend Engineer with 12+ Years of Experience in Go in Gurgaon',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setInputText(example)}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Submitted state - page layout with messages and prompt bar */
          <>
            {/* Messages Page Section */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-4xl mx-auto px-4 py-6">
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bot className="w-8 h-8 text-violet-500" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Ready to help you find talent</h3>
                      <p className="text-gray-500">Start by describing what you&apos;re looking for below</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map(renderMessage)}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prompt Bar at Bottom */}
            <div className="bg-white p-4">
              <div className="max-w-4xl mx-auto">
                {/* Input and controls container - positioned at bottom */}
                <div className="bg-transparent rounded-2xl shadow-lg p-6 border border-gray-200">
                  {/* Text input area */}
                  <div className="mb-6">
                    {currentFollowupQuestion && (
                      <div className="mb-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                        <p className="text-sm text-violet-700 font-medium mb-1">Answering follow-up question:</p>
                        <p className="text-sm text-violet-600">{currentFollowupQuestion.question}</p>
                      </div>
                    )}
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        currentFollowupQuestion
                          ? `Type your answer here...`
                          : "Ask a follow-up question or refine your search..."
                      }
                      className="w-full h-12 p-4 text-gray-800 text-base border-0 outline-none resize-none placeholder-gray-400"
                    />
                  </div>

                  {/* Controls bar */}
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* Left side controls */}
                    <div className="flex items-center gap-3">
                      {/* Add button */}
                      <button className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors">
                        <Plus className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-3">
                      {/* Model dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setShowModelDropdown(!showModelDropdown);
                          }}
                          className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors h-9"
                        >
                          <span className="text-gray-700 text-xs font-medium">{selectedModel}</span>
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>

                        {showModelDropdown && (
                          <div className="absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            {modelOptions.map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  setSelectedModel(option);
                                  setShowModelDropdown(false);
                                }}
                                className="w-full text-gray-800 text-xs text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl transition-colors"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Microphone button */}
                      <button className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors">
                        <Mic className="w-5 h-5 text-gray-600" />
                      </button>

                      {/* Submit button */}
                      <button
                        onClick={handleSubmit}
                        disabled={!inputText.trim()}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${inputText.trim()
                          ? 'bg-violet-500 hover:bg-violet-600 text-white'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Click outside to close dropdowns */}
      {showModelDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowModelDropdown(false);
          }}
        />
      )}
    </div>
  );
};

export default PromptPage;
