/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import SearchBar from './search/SearchBar';
import Header from './ui/header';
import {
  Sparkles,
  Target,
  Scale,
  Zap,
  CheckCircle2,
  Loader2,
  Brain,
  FileText,
  Settings,
  Wand2,
  Users,
  TrendingUp,
  Award
} from 'lucide-react';

const HERO_TEXT = "Hello there, what are you looking for today?";

const CREATION_STEPS = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: "Understanding Your Request",
    description: "AI is analyzing your search query...",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: "Extracting Requirements",
    description: "Identifying must-have criteria...",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Smart Expansion",
    description: "Finding related terms and variations...",
    color: "from-orange-500 to-red-500"
  },
  {
    icon: <Scale className="w-6 h-6" />,
    title: "Building Scoring System",
    description: "Creating ranking criteria...",
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: <FileText className="w-6 h-6" />,
    title: "Finalizing Scorecard",
    description: "Preparing your search document...",
    color: "from-indigo-500 to-purple-500"
  }
];

const FEATURES = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: "AI-Powered Matching",
    description: "Smart algorithms find the perfect candidates"
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: "Precision Search",
    description: "Filter and rank with custom criteria"
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: "Instant Results",
    description: "Get qualified candidates in seconds"
  }
];

export default function PromptPage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  // Typewriter effect
  useEffect(() => {
    if (currentIndex < HERO_TEXT.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + HERO_TEXT[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex]);

  // Progress through creation steps
  useEffect(() => {
    if (isSearching && currentStep < CREATION_STEPS.length - 1) {
      const timeout = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isSearching, currentStep]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setCurrentStep(0);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/scorecard/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ query }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Small delay to show completion animation
        setTimeout(() => {
          router.push(`/scorecard?session=${data.session_id}`);
        }, 1000);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        alert('Failed to start search. Please try again.');
        setIsSearching(false);
      }
    } catch (error) {
      console.error('Error starting search:', error);
      alert('Failed to start search. Please try again.');
      setIsSearching(false);
    }
  };

  const EXAMPLE_QUERIES = [
    'Senior Python Developer in Bangalore with 5+ years',
    'Financial Services Manager with MBA near Mumbai',
    'Full Stack Engineer with React and Node.js experience',
    'Data Scientist with ML expertise in Healthcare',
  ];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <Header />

      {/* Animated Background */}
      <AnimatedBackground />

      {/* Watermark */}
      <div className="fixed bottom-8 right-8 opacity-5 pointer-events-none z-0">
        <Users className="w-64 h-64 text-gray-900" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-20">
        <AnimatePresence mode="wait">
          {!isSearching ? (
            <motion.div
              key="search-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-16"
            >
              {/* Hero Section */}
              <div className="text-center space-y-8">
                {/* Main Heading */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900">
                    {displayedText}
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                      className="inline-block w-1 h-12 md:h-16 bg-gradient-to-b from-blue-600 to-purple-600 ml-2"
                    />
                  </h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto"
                  >
                    AI-powered candidate search with smart matching and instant results
                  </motion.p>
                </motion.div>

                {/* Features Pills */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-wrap justify-center gap-4"
                >
                  {FEATURES.map((feature, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 + idx * 0.1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      className="flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-full shadow-lg"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                        {feature.icon}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900">{feature.title}</p>
                        <p className="text-xs text-gray-600">{feature.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Search Bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <SearchBar onSearch={handleSearch} isLoading={isSearching} />
              </motion.div>

              {/* Example Queries */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center space-y-4"
              >
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Try these examples
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {EXAMPLE_QUERIES.map((example, idx) => (
                    <motion.button
                      key={example}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.1 + idx * 0.1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const event = new CustomEvent('populateSearch', { detail: example });
                        window.dispatchEvent(event);
                      }}
                      disabled={isSearching}
                      className="px-6 py-3 bg-white text-gray-700 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl"
                    >
                      {example}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="loading-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ScorecardCreationAnimation currentStep={currentStep} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// ANIMATED BACKGROUND (Vercel-style)
// ============================================================================

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      {/* Gradient Mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />

      {/* Animated Grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <motion.path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(0,0,0,0.02)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Floating Orbs */}
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -100, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"
      />

      {/* Floating Lines */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.1, 0.3, 0.1],
            x: [0, Math.random() * 100 - 50],
            y: [0, Math.random() * 100 - 50],
          }}
          transition={{
            duration: 10 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5
          }}
          className="absolute w-px bg-gradient-to-b from-transparent via-blue-500 to-transparent"
          style={{
            left: `${20 + i * 15}%`,
            top: '10%',
            height: '80%',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SCORECARD CREATION ANIMATION
// ============================================================================

function ScorecardCreationAnimation({ currentStep }: { currentStep: number }) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Main Animation Container */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Wand2 className="w-8 h-8 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Creating Your Search Criteria
                </h2>
                <p className="text-blue-100 text-sm">
                  Our AI is building a custom scorecard for your search
                </p>
              </div>
            </div>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </motion.div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="p-8 space-y-4">
          {CREATION_STEPS.map((step, index) => (
            <StepCard
              key={index}
              step={step}
              index={index}
              currentStep={currentStep}
              isActive={index === currentStep}
              isCompleted={index < currentStep}
            />
          ))}
        </div>

        {/* Skeleton Preview */}
        <div className="px-8 pb-8">
          <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-300">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">
                Scorecard Preview
              </span>
            </div>
            <ScorecardSkeleton currentStep={currentStep} />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Settings className="w-4 h-4 animate-spin" />
              <span>Processing your request...</span>
            </div>
            <span className="text-gray-500 font-medium">
              Step {currentStep + 1} of {CREATION_STEPS.length}
            </span>
          </div>
        </div>
      </div>

      {/* Fun Facts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center"
      >
        <AnimatedFunFact />
      </motion.div>
    </div>
  );
}

// Keep StepCard, ScorecardSkeleton, and AnimatedFunFact components the same...
// [Previous implementations remain unchanged]

function StepCard({ step, index, currentStep, isActive, isCompleted }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative flex items-start gap-4 p-4 rounded-xl transition-all ${isActive
          ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300'
          : isCompleted
            ? 'bg-green-50 border-2 border-green-300'
            : 'bg-gray-50 border-2 border-gray-200'
        }`}
    >
      <div
        className={`relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive
            ? `bg-gradient-to-br ${step.color} text-white shadow-lg`
            : isCompleted
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-400'
          }`}
      >
        {isCompleted ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >x
            <CheckCircle2 className="w-6 h-6" />
          </motion.div>
        ) : (
          <>
            {step.icon}
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(59, 130, 246, 0.4)',
                    '0 0 0 10px rgba(59, 130, 246, 0)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3
          className={`text-base font-bold mb-1 ${isActive ? 'text-gray-900' : isCompleted ? 'text-green-900' : 'text-gray-500'
            }`}
        >
          {step.title}
        </h3>
        <p
          className={`text-sm ${isActive ? 'text-gray-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
            }`}
        >
          {isCompleted ? 'Completed!' : step.description}
        </p>
      </div>

      {isActive && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="flex-shrink-0"
        >
          <Loader2 className="w-5 h-5 text-blue-600" />
        </motion.div>
      )}
    </motion.div>
  );
}

function ScorecardSkeleton({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: currentStep >= 0 ? 1 : 0.3 }}
        transition={{ duration: 0.5 }}
        className="space-y-2"
      >
        <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse w-1/2" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: currentStep >= 1 ? 1 : 0.3 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-red-400" />
          <div className="h-4 bg-red-200 rounded w-32" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-gradient-to-r from-red-100 to-red-200 rounded animate-pulse" />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: currentStep >= 3 ? 1 : 0.3 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-4 h-4 text-blue-400" />
          <div className="h-4 bg-blue-200 rounded w-40" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gradient-to-r from-blue-100 to-blue-200 rounded animate-pulse" />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: currentStep >= 2 ? 1 : 0.3 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <div className="h-4 bg-purple-200 rounded w-36" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-gradient-to-r from-purple-100 to-purple-200 rounded-full animate-pulse w-20" />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const FUN_FACTS = [
  "💡 AI can reduce hiring time by up to 70%",
  "🎯 89% of bad hires lack soft skills, not technical skills",
  "⚡ Companies with strong employer brands reduce cost per hire by 50%",
  "🚀 The best candidates are often passive job seekers",
  "📊 Employee referrals have a 45% retention rate after one year",
  "🧠 Cultural fit is the #1 quality cited by recruiters",
];

function AnimatedFunFact() {
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={factIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-6 py-3 bg-white/80 backdrop-blur-xl rounded-full border border-gray-200 shadow-lg"
      >
        <Sparkles className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-medium text-gray-700">
          {FUN_FACTS[factIndex]}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}