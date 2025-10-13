'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Target,
    Scale,
    Zap,
    Check,
    X,
    Plus,
    GripVertical,
    MoreHorizontal,
    Trash2,
    AlertCircle,
    ChevronDown,
    Edit3,
    Hash,
    Type,
    List,
    BarChart3,
    Eye,
    EyeOff,
    HelpCircle,
    ArrowRight,
    ArrowLeft,
    Lightbulb,
    Search,
    MessageSquare,
    Users,
    Award
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ScorecardDocumentProps {
    scorecard: any;
    onUpdate: (scorecard: any) => void;
    sessionId: string;
    isEditable?: boolean;
}

export default function ScorecardDocument({
    scorecard,
    onUpdate,
    sessionId,
    isEditable = true
}: ScorecardDocumentProps) {
    const [localScorecard, setLocalScorecard] = useState(scorecard);
    const [isTyping, setIsTyping] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

    useEffect(() => {
        if (scorecard) {
            setIsTyping(true);
            setTimeout(() => {
                setLocalScorecard(scorecard);
                setIsTyping(false);
            }, 300);
        }
    }, [scorecard]);

    if (!localScorecard) {
        return <LoadingDocument />;
    }

    return (
        <div className="h-full overflow-y-auto bg-white relative">
            {/* Help Button - Floating */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowHelp(true)}
                className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center z-40 group"
            >
                <HelpCircle className="w-6 h-6" />
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    ?
                </span>
                <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    How does this work?
                </div>
            </motion.button>

            {/* Help Modal */}
            <AnimatePresence>
                {showHelp && (
                    <HelpWalkthrough
                        onClose={() => {
                            setShowHelp(false);
                            setHighlightedSection(null);
                        }}
                        onHighlight={setHighlightedSection}
                    />
                )}
            </AnimatePresence>

            {/* Highlight Overlay */}
            <AnimatePresence>
                {highlightedSection && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 z-30 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Document Container */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-[1200px] mx-auto px-16 py-12"
            >
                {/* Document Header */}
                <div id="header-section" className={highlightedSection === 'header' ? 'relative z-40' : ''}>
                    <DocumentHeader
                        query={localScorecard.metadata?.originalQuery}
                        isTyping={isTyping}
                        isHighlighted={highlightedSection === 'header'}
                    />
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-200 my-8" />

                {/* Main Content */}
                <div className="space-y-12">
                    {/* Must-Have Requirements Section */}
                    <div id="filters-section" className={highlightedSection === 'filters' ? 'relative z-40' : ''}>
                        <MustHaveSection
                            filters={localScorecard.mustHaveFilters || []}
                            onUpdate={(filters) => {
                                const updated = { ...localScorecard, mustHaveFilters: filters };
                                setLocalScorecard(updated);
                                onUpdate(updated);
                            }}
                            isEditable={isEditable}
                            isTyping={isTyping}
                            isHighlighted={highlightedSection === 'filters'}
                        />
                    </div>

                    {/* Scoring Criteria Section */}
                    <div id="scoring-section" className={highlightedSection === 'scoring' ? 'relative z-40' : ''}>
                        <ScoringSection
                            criteria={localScorecard.scoringCriteria || []}
                            threshold={localScorecard.threshold || 50}
                            onUpdate={(criteria, threshold) => {
                                const updated = {
                                    ...localScorecard,
                                    scoringCriteria: criteria,
                                    threshold: threshold
                                };
                                setLocalScorecard(updated);
                                onUpdate(updated);
                            }}
                            isEditable={isEditable}
                            isTyping={isTyping}
                            isHighlighted={highlightedSection === 'scoring'}
                        />
                    </div>

                    {/* Smart Expansions */}
                    {localScorecard.expansions && Object.keys(localScorecard.expansions).length > 0 && (
                        <div id="expansions-section" className={highlightedSection === 'expansions' ? 'relative z-40' : ''}>
                            <ExpansionsSection
                                expansions={localScorecard.expansions}
                                isTyping={isTyping}
                                isHighlighted={highlightedSection === 'expansions'}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DocumentFooter scorecard={localScorecard} />
            </motion.div>
        </div>
    );
}

// ============================================================================
// HELP WALKTHROUGH STEPS DATA
// ============================================================================

const HELP_STEPS = [
    {
        id: 'intro',
        title: 'Welcome! Let me explain how this works 👋',
        description: 'This AI-powered system helps you find the perfect candidates in 5 smart phases. Let\'s walk through each one!',
        icon: <Sparkles className="w-8 h-8" />,
        color: 'from-purple-500 to-blue-500',
        highlight: null,
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    Instead of manually writing complex database queries, you simply tell us what you're looking for in plain English.
                    Our AI handles all the complexity behind the scenes.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 font-medium">
                        💡 <span className="font-bold">Example:</span> "Senior backend engineer with Go experience in Gurgaon"
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                        The AI automatically understands: location, skills, seniority, and more!
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'phase1',
        title: 'Phase 1: Understanding Your Request 🎯',
        description: 'The AI reads your query and extracts key information',
        icon: <Lightbulb className="w-8 h-8" />,
        color: 'from-yellow-500 to-orange-500',
        highlight: 'header',
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">What happens:</span> Your query is sent to our AI, which acts like a smart assistant reading your requirements.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Entity Extraction</p>
                            <p className="text-sm text-gray-600">Identifies: roles, locations, skills, experience levels, industries</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Creates Initial Structure</p>
                            <p className="text-sm text-gray-600">Builds the foundation of your search criteria</p>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">Technical Note:</span> Backend sends query to LLM with a system prompt explaining entity extraction. LLM returns structured JSON data.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'phase2',
        title: 'Phase 2: Smart Expansion 🧠',
        description: 'AI generates related terms to find more candidates',
        icon: <Zap className="w-8 h-8" />,
        color: 'from-purple-500 to-pink-500',
        highlight: 'expansions',
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">What happens:</span> The AI thinks of all the different ways people might describe the same thing in their profiles.
                </p>
                <div className="bg-purple-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">Example Expansions:</p>
                    <div className="space-y-2 mt-2">
                        <div>
                            <span className="text-xs font-semibold text-gray-700 uppercase">You said:</span>
                            <span className="ml-2 text-sm text-gray-900">"Backend Engineer"</span>
                        </div>
                        <div>
                            <span className="text-xs font-semibold text-gray-700 uppercase">We also search:</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {['Software Engineer', 'Senior Developer', 'Lead Engineer', 'Technical Architect'].map((term, i) => (
                                    <span key={i} className="px-2 py-1 bg-purple-200 text-purple-900 rounded-md text-xs font-medium">
                                        {term}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">Technical Note:</span> Backend requests concept expansion from LLM, which returns expanded term lists. These get added to the scorecard's expansion mappings. LLM also suggests initial weights for scoring.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'phase3-filters',
        title: 'Phase 3a: Must-Have Requirements ⛔',
        description: 'Hard filters that eliminate candidates',
        icon: <Target className="w-8 h-8" />,
        color: 'from-red-500 to-pink-500',
        highlight: 'filters',
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">What happens:</span> The AI asks you clarifying questions to understand your non-negotiables.
                </p>
                <div className="bg-red-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">Example Conversation:</p>
                    <div className="space-y-2">
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                            <p className="text-xs font-semibold text-blue-600 mb-1">AI ASKS:</p>
                            <p className="text-sm text-gray-800">"Must candidates be located in Gurgaon, or can they work remotely?"</p>
                        </div>
                        <div className="bg-blue-600 text-white rounded-lg p-3">
                            <p className="text-xs font-semibold mb-1">YOU ANSWER:</p>
                            <p className="text-sm">"Must be in Gurgaon"</p>
                        </div>
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                        ⚡ <span className="font-bold">Result:</span> Any candidate not in Gurgaon is automatically excluded. They won't even appear in results.
                    </p>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">Technical Note:</span> Each user message triggers an LLM API call with conversation history + current scorecard state. LLM suggests changes, backend parses and updates scorecard. This loops until finalized.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'phase3-scoring',
        title: 'Phase 3b: Scoring Criteria 📊',
        description: 'Flexible factors that rank candidates',
        icon: <Scale className="w-8 h-8" />,
        color: 'from-blue-500 to-cyan-500',
        highlight: 'scoring',
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">What happens:</span> The AI helps you decide what makes someone a "great" vs "good" candidate.
                </p>
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">How Points Work:</p>
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                                30
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Go Programming Experience</p>
                                <p className="text-xs text-gray-600">Critical skill - highest weight</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                                20
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Startup Experience</p>
                                <p className="text-xs text-gray-600">Important but not required</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-blue-400 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                                10
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">AWS Certification</p>
                                <p className="text-xs text-gray-600">Nice bonus</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                        ✅ <span className="font-bold">Minimum Threshold:</span> Set the minimum score (e.g., 40/60) to pass. Candidates below this won't appear.
                    </p>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">Technical Note:</span> Same conversational loop as filters. Backend manages state, sends context to LLM, receives scoring suggestions, updates scorecard weights and criteria.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'phase4',
        title: 'Phase 4: Sample Preview 👀',
        description: 'Test your criteria on a few candidates first',
        icon: <Eye className="w-8 h-8" />,
        color: 'from-green-500 to-teal-500',
        highlight: null,
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">What happens:</span> Before searching all candidates, we show you 2-3 examples to make sure we got it right.
                </p>
                <div className="bg-green-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">Sample Results Preview:</p>
                    <div className="space-y-2">
                        <div className="bg-white rounded-lg p-3 border-2 border-green-500">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-bold text-gray-900">Sarah Johnson</p>
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">45/60</span>
                            </div>
                            <p className="text-xs text-gray-600">Senior Backend Engineer • Gurgaon • 7 years Go</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-green-400">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-bold text-gray-900">Raj Patel</p>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">42/60</span>
                            </div>
                            <p className="text-xs text-gray-600">Software Engineer • Gurgaon • 5 years Go</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                            ✓ Looks Good!
                        </button>
                        <button className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
                            ✗ Not Quite
                        </button>
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                        💡 If you reject, the AI asks what was wrong and adjusts the criteria!
                    </p>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">Technical Note:</span> Backend builds MongoDB query from must-have filters, fetches small sample (~10 docs), applies scoring algorithm in code, sorts by score, shows top 2. If rejected, sends feedback to LLM for scorecard adjustment.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'phase5',
        title: 'Phase 5: Full Search & Deep Evaluation 🚀',
        description: 'Search all candidates and get AI quality scores',
        icon: <Users className="w-8 h-8" />,
        color: 'from-indigo-500 to-purple-500',
        highlight: null,
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">What happens:</span> Once you approve, we search ALL candidates and have AI deeply evaluate each one.
                </p>
                <div className="bg-indigo-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">
                            1
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Comprehensive Search</p>
                            <p className="text-xs text-gray-600">Search thousands of candidates with your filters</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">
                            2
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Apply Scoring</p>
                            <p className="text-xs text-gray-600">Calculate points for each candidate based on your criteria</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">
                            3
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">AI Deep Evaluation</p>
                            <p className="text-xs text-gray-600">AI reads full profiles and explains why each person is a good match</p>
                        </div>
                    </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Final Results Include:</p>
                    <ul className="space-y-1 text-sm text-gray-700">
                        <li className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-600" />
                            Top 10-20 candidates ranked by score
                        </li>
                        <li className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-600" />
                            AI quality score (0-100) for each
                        </li>
                        <li className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-purple-600" />
                            Detailed explanation of why they're a good fit
                        </li>
                    </ul>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-bold">Technical Note:</span> Backend runs full MongoDB query (may return thousands), applies scoring to all, filters by threshold, sorts and takes top 10-20. Sends these profiles to LLM for deep evaluation with quality scores and explanations.
                    </p>
                </div>
            </div>
        )
    },
    {
        id: 'outro',
        title: 'You\'re All Set! 🎉',
        description: 'Now you understand how the AI works for you',
        icon: <Sparkles className="w-8 h-8" />,
        color: 'from-green-500 to-teal-500',
        highlight: null,
        content: (
            <div className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                    <span className="font-bold text-gray-900">The beauty of this system:</span> You don't need to understand databases, queries, or technical details. Just describe what you want!
                </p>
                <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Simple for HR</p>
                            <p className="text-sm text-gray-600">Just talk naturally - no technical knowledge needed</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Powerful AI</p>
                            <p className="text-sm text-gray-600">Handles complexity, expansions, scoring, and evaluation automatically</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Collaborative</p>
                            <p className="text-sm text-gray-600">AI asks questions, you provide feedback, together you find the best candidates</p>
                        </div>
                    </div>
                </div>
                <div className="bg-blue-600 text-white rounded-xl p-6 text-center">
                    <p className="text-lg font-bold mb-2">Ready to find your perfect candidate?</p>
                    <p className="text-sm opacity-90">Click anywhere on the scorecard to start editing, or chat with the AI for help!</p>
                </div>
            </div>
        )
    }
];

// ============================================================================
// HELP WALKTHROUGH COMPONENT
// ============================================================================

function HelpWalkthrough({ onClose, onHighlight }: { onClose: () => void; onHighlight: (section: string | null) => void }) {
    const [currentStep, setCurrentStep] = useState(0);
    const step = HELP_STEPS[currentStep];

    useEffect(() => {
        onHighlight(step.highlight);
    }, [currentStep, step.highlight, onHighlight]);

    const goNext = () => {
        if (currentStep < HELP_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const goPrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const progress = ((currentStep + 1) / HELP_STEPS.length) * 100;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Progress Bar */}
                <div className="h-2 bg-gray-100">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full bg-gradient-to-r ${step.color}`}
                    />
                </div>

                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white`}>
                            {step.icon}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {step.title}
                    </h2>
                    <p className="text-gray-600 mt-1">
                        {step.description}
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {step.content}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {HELP_STEPS.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentStep(index)}
                                    className={`w-2 h-2 rounded-full transition-all ${index === currentStep
                                        ? 'w-8 bg-blue-600'
                                        : index < currentStep
                                            ? 'bg-green-500'
                                            : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            {currentStep > 0 && (
                                <button
                                    onClick={goPrev}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                            )}
                            <button
                                onClick={goNext}
                                className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg transition-colors font-medium bg-gradient-to-r ${step.color} hover:opacity-90`}
                            >
                                {currentStep === HELP_STEPS.length - 1 ? (
                                    <>
                                        Got It!
                                        <Check className="w-4 h-4" />
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ============================================================================
// DOCUMENT HEADER
// ============================================================================

function DocumentHeader({ query, isTyping, isHighlighted }: any) {
    return (
        <motion.div
            animate={{
                scale: isHighlighted ? 1.02 : 1,
                boxShadow: isHighlighted
                    ? '0 0 0 4px rgba(59, 130, 246, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    : '0 0 0 0px rgba(59, 130, 246, 0)'
            }}
            transition={{ duration: 0.3 }}
            className={`space-y-4 ${isHighlighted ? 'bg-white rounded-xl p-6 relative' : ''}`}
        >
            {isHighlighted && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                    Your Query
                </div>
            )}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                    <Sparkles className="w-6 h-6 text-white" />
                </div>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full"
                    >
                        <div className="flex space-x-1">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={{ scale: [1, 1.5, 1] }}
                                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                                    className="w-1.5 h-1.5 bg-blue-600 rounded-full"
                                />
                            ))}
                        </div>
                        <span className="text-sm font-medium text-blue-700">AI is thinking...</span>
                    </motion.div>
                )}
            </div>
            <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                    Your Search Criteria
                </h1>
                {query && (
                    <p className="text-lg text-gray-600 mt-2">
                        Based on: <span className="text-gray-800 font-medium">"{query}"</span>
                    </p>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// MUST-HAVE SECTION
// ============================================================================

function MustHaveSection({ filters, onUpdate, isEditable, isTyping, isHighlighted }: any) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <motion.section
            animate={{
                scale: isHighlighted ? 1.01 : 1,
                boxShadow: isHighlighted
                    ? '0 0 0 4px rgba(239, 68, 68, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    : '0 0 0 0px rgba(239, 68, 68, 0)'
            }}
            transition={{ duration: 0.3 }}
            className={`space-y-3 ${isHighlighted ? 'bg-white rounded-xl p-6 relative' : ''}`}
        >
            {isHighlighted && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full">
                    Must-Have Filters
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <motion.div
                            animate={{ rotate: isCollapsed ? -90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                        </motion.div>
                    </button>
                    <Target className="w-5 h-5 text-red-500" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Must-Have Requirements
                        </h2>
                        <p className="text-sm text-gray-600 mt-0.5">
                            Deal-breakers that eliminate candidates automatically
                        </p>
                    </div>
                </div>
                <span className="text-sm font-medium text-gray-500">
                    {filters.length} {filters.length === 1 ? 'requirement' : 'requirements'}
                </span>
            </div>

            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">These are non-negotiables.</span> If a candidate doesn't meet ALL of these, they won't appear in your results.
                </p>
            </div>

            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <NotionTable
                            items={filters}
                            columns={[
                                { key: 'field', label: 'Field', type: 'select', icon: <List className="w-4 h-4" /> },
                                { key: 'operator', label: 'Condition', type: 'select', icon: <Type className="w-4 h-4" /> },
                                { key: 'value', label: 'Value', type: 'text', icon: <Type className="w-4 h-4" /> },
                                { key: 'description', label: 'Description', type: 'longtext', icon: <Type className="w-4 h-4" /> },
                            ]}
                            onUpdate={onUpdate}
                            onAdd={() => {
                                onUpdate([
                                    ...filters,
                                    {
                                        field: 'location',
                                        operator: 'contains',
                                        value: '',
                                        description: ''
                                    }
                                ]);
                            }}
                            isEditable={isEditable}
                            emptyMessage="No requirements yet. Add one to get started."
                            accentColor="red"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

// ============================================================================
// SCORING SECTION
// ============================================================================

function ScoringSection({ criteria, threshold, onUpdate, isEditable, isTyping, isHighlighted }: any) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const totalPoints = criteria.reduce((sum: number, c: any) => sum + (c.points || 0), 0);

    return (
        <motion.section
            animate={{
                scale: isHighlighted ? 1.01 : 1,
                boxShadow: isHighlighted
                    ? '0 0 0 4px rgba(59, 130, 246, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    : '0 0 0 0px rgba(59, 130, 246, 0)'
            }}
            transition={{ duration: 0.3 }}
            className={`space-y-3 ${isHighlighted ? 'bg-white rounded-xl p-6 relative' : ''}`}
        >
            {isHighlighted && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full">
                    Scoring Criteria
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <motion.div
                            animate={{ rotate: isCollapsed ? -90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                        </motion.div>
                    </button>
                    <Scale className="w-5 h-5 text-blue-500" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            What Makes a Great Match
                        </h2>
                        <p className="text-sm text-gray-600 mt-0.5">
                            Weighted factors that rank and score candidates
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-500">
                        {criteria.length} {criteria.length === 1 ? 'factor' : 'factors'}
                    </span>
                    <div className="h-4 w-px bg-gray-300" />
                    <span className="text-sm font-bold text-blue-600">
                        {totalPoints} points total
                    </span>
                </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">These are nice-to-haves.</span> Candidates earn points for each factor they match. The more points, the higher they rank.
                </p>
            </div>

            <AnimatePresence>
                {!isCollapsed && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <ScoreThresholdCard
                                threshold={threshold}
                                totalPoints={totalPoints}
                                onThresholdChange={(newThreshold) => onUpdate(criteria, newThreshold)}
                                isEditable={isEditable}
                            />
                        </motion.div>

                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <NotionTable
                                items={criteria}
                                columns={[
                                    { key: 'description', label: 'What makes them great?', type: 'longtext', icon: <Type className="w-4 h-4" />, width: '40%' },
                                    { key: 'keywords', label: 'Keywords', type: 'tags', icon: <List className="w-4 h-4" />, width: '35%' },
                                    { key: 'points', label: 'Points', type: 'number', icon: <Hash className="w-4 h-4" />, width: '15%' },
                                    { key: 'weight', label: 'Weight', type: 'progress', icon: <BarChart3 className="w-4 h-4" />, width: '10%' },
                                ]}
                                onUpdate={(updated) => onUpdate(updated, threshold)}
                                onAdd={() => {
                                    onUpdate(
                                        [
                                            ...criteria,
                                            {
                                                description: '',
                                                keywords: [],
                                                points: 10
                                            }
                                        ],
                                        threshold
                                    );
                                }}
                                isEditable={isEditable}
                                emptyMessage="No scoring factors yet. Add one to start ranking candidates."
                                accentColor="blue"
                                totalPoints={totalPoints}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

// ============================================================================
// SCORE THRESHOLD CARD
// ============================================================================

function ScoreThresholdCard({ threshold, totalPoints, onThresholdChange, isEditable }: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [localThreshold, setLocalThreshold] = useState(threshold);
    const percentage = totalPoints > 0 ? (threshold / totalPoints) * 100 : 0;

    return (
        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-bold text-gray-900">Minimum Score Threshold</h3>
                    <p className="text-sm text-gray-700 mt-1">
                        Candidates need at least this many points to appear in results
                    </p>
                </div>
                {isEditable && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-white/80 rounded-lg hover:bg-white transition-colors"
                    >
                        Adjust
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="0"
                            max={totalPoints}
                            value={localThreshold}
                            onChange={(e) => setLocalThreshold(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-white rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <input
                            type="number"
                            min="0"
                            max={totalPoints}
                            value={localThreshold}
                            onChange={(e) => setLocalThreshold(parseInt(e.target.value))}
                            className="w-24 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-center font-bold text-gray-900 focus:border-blue-500 focus:ring-0"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => {
                                setLocalThreshold(threshold);
                                setIsEditing(false);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onThresholdChange(localThreshold);
                                setIsEditing(false);
                            }}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Save
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="relative h-3 bg-white/80 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-gray-900">
                            {threshold}
                            <span className="text-lg text-gray-600 font-normal ml-2">/ {totalPoints}</span>
                        </span>
                        <span className="text-sm font-medium text-gray-700 bg-white/80 px-3 py-1 rounded-full">
                            {Math.round(percentage)}% required
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// EXPANSIONS SECTION
// ============================================================================

function ExpansionsSection({ expansions, isTyping, isHighlighted }: any) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    return (
        <motion.section
            animate={{
                scale: isHighlighted ? 1.01 : 1,
                boxShadow: isHighlighted
                    ? '0 0 0 4px rgba(168, 85, 247, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    : '0 0 0 0px rgba(168, 85, 247, 0)'
            }}
            transition={{ duration: 0.3 }}
            className={`space-y-3 ${isHighlighted ? 'bg-white rounded-xl p-6 relative' : ''}`}
        >
            {isHighlighted && (
                <div className="absolute -top-3 left-6 px-3 py-1 bg-purple-600 text-white text-sm font-bold rounded-full">
                    Smart Expansions
                </div>
            )}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <motion.div
                            animate={{ rotate: isCollapsed ? -90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                        </motion.div>
                    </button>
                    <Zap className="w-5 h-5 text-purple-500" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Smart Expansions
                        </h2>
                        <p className="text-sm text-gray-600 mt-0.5">
                            AI-generated variations to find more candidates
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">We search smarter.</span> When you look for "Backend Engineer", we also search for related titles automatically.
                </p>
            </div>

            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-4 pt-2"
                    >
                        {Object.entries(expansions).map(([key, values]: [string, any]) => {
                            if (!values || values.length === 0) return null;

                            return (
                                <div key={key} className="space-y-2">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                                        {key.replace('_', ' ')}
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {values.map((value: string, i: number) => (
                                            <motion.span
                                                key={i}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.03 }}
                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-900 border border-purple-200"
                                            >
                                                {value}
                                            </motion.span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

// ============================================================================
// NOTION-STYLE TABLE
// ============================================================================

interface NotionTableProps {
    items: any[];
    columns: Array<{
        key: string;
        label: string;
        type: 'text' | 'longtext' | 'select' | 'number' | 'tags' | 'progress';
        icon: React.ReactNode;
        width?: string;
    }>;
    onUpdate: (items: any[]) => void;
    onAdd: () => void;
    isEditable: boolean;
    emptyMessage: string;
    accentColor: 'red' | 'blue';
    totalPoints?: number;
}

function NotionTable({
    items,
    columns,
    onUpdate,
    onAdd,
    isEditable,
    emptyMessage,
    accentColor,
    totalPoints = 0
}: NotionTableProps) {
    const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);

    const handleUpdate = (index: number, key: string, value: any) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [key]: value };
        onUpdate(updated);
    };

    const handleDelete = (index: number) => {
        onUpdate(items.filter((_, i) => i !== index));
    };

    if (items.length === 0) {
        return (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                <div className="max-w-sm mx-auto space-y-3">
                    <div className={`w-12 h-12 mx-auto rounded-xl ${accentColor === 'red' ? 'bg-red-50' : 'bg-blue-50'} flex items-center justify-center`}>
                        {accentColor === 'red' ? <Target className="w-6 h-6 text-red-500" /> : <Scale className="w-6 h-6 text-blue-500" />}
                    </div>
                    <p className="text-sm text-gray-600">{emptyMessage}</p>
                    {isEditable && (
                        <button
                            onClick={onAdd}
                            className={`inline-flex items-center gap-2 px-4 py-2 ${accentColor === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors text-sm font-medium`}
                        >
                            <Plus className="w-4 h-4" />
                            Add First One
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Table Header */}
            <div className="bg-gray-50 border-b border-gray-200">
                <div className="flex items-center">
                    <div className="w-10 flex-shrink-0" />
                    {columns.map((col) => (
                        <div
                            key={col.key}
                            className="px-4 py-3 flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase tracking-wide"
                            style={{ width: col.width || 'auto', flex: col.width ? undefined : 1 }}
                        >
                            {col.icon}
                            {col.label}
                        </div>
                    ))}
                    <div className="w-12 flex-shrink-0" />
                </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
                <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                        <motion.div
                            key={index}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            onHoverStart={() => setHoveredRow(index)}
                            onHoverEnd={() => setHoveredRow(null)}
                            className="flex items-center hover:bg-gray-50 transition-colors group"
                        >
                            {/* Drag Handle */}
                            <div className="w-10 flex-shrink-0 flex items-center justify-center">
                                {isEditable && hoveredRow === index && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    >
                                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
                                    </motion.div>
                                )}
                            </div>

                            {/* Cells */}
                            {columns.map((col) => (
                                <TableCell
                                    key={col.key}
                                    item={item}
                                    column={col}
                                    isEditing={editingCell?.row === index && editingCell?.col === col.key}
                                    onStartEdit={() => isEditable && setEditingCell({ row: index, col: col.key })}
                                    onStopEdit={() => setEditingCell(null)}
                                    onUpdate={(value) => handleUpdate(index, col.key, value)}
                                    isEditable={isEditable}
                                    totalPoints={totalPoints}
                                />
                            ))}

                            {/* Actions */}
                            <div className="w-12 flex-shrink-0 flex items-center justify-center">
                                {isEditable && hoveredRow === index && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        onClick={() => handleDelete(index)}
                                        className="p-1.5 hover:bg-red-100 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                    </motion.button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Add New Row */}
            {isEditable && (
                <button
                    onClick={onAdd}
                    className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                    <Plus className="w-4 h-4" />
                    New
                </button>
            )}
        </div>
    );
}

// ============================================================================
// TABLE CELL
// ============================================================================

function TableCell({ item, column, isEditing, onStartEdit, onStopEdit, onUpdate, isEditable, totalPoints }: any) {
    const [localValue, setLocalValue] = useState(item[column.key]);
    const inputRef = useRef<any>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        onUpdate(localValue);
        onStopEdit();
    };

    const handleCancel = () => {
        setLocalValue(item[column.key]);
        onStopEdit();
    };

    const renderDisplay = () => {
        const value = item[column.key];

        switch (column.type) {
            case 'tags':
                return (
                    <div className="flex flex-wrap gap-1.5">
                        {value && value.length > 0 ? (
                            <>
                                {value.slice(0, 4).map((tag: string, i: number) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                                    >
                                        {tag}
                                    </span>
                                ))}
                                {value.length > 4 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                                        +{value.length - 4}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-sm text-gray-400">Empty</span>
                        )}
                    </div>
                );

            case 'number':
                return (
                    <span className="text-sm font-semibold text-gray-900">
                        {value || 0}
                    </span>
                );

            case 'progress':
                const percentage = totalPoints > 0 ? (item.points / totalPoints) * 100 : 0;
                return (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                            {Math.round(percentage)}%
                        </span>
                    </div>
                );

            case 'select':
                return (
                    <span className="text-sm text-gray-900 font-medium">
                        {value ? value.replace('_', ' ') : 'Select...'}
                    </span>
                );

            case 'longtext':
                return (
                    <p className="text-sm text-gray-900 line-clamp-2">
                        {value || <span className="text-gray-400">Empty</span>}
                    </p>
                );

            default:
                return (
                    <span className="text-sm text-gray-900">
                        {value || <span className="text-gray-400">Empty</span>}
                    </span>
                );
        }
    };

    const renderEditor = () => {
        switch (column.type) {
            case 'select':
                const options = column.key === 'field'
                    ? ['location', 'title', 'expertise', 'current_industry', 'seniority_level']
                    : ['contains', 'equals', 'in'];

                return (
                    <select
                        ref={inputRef}
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleSave}
                        className="w-full px-2 py-1.5 text-sm bg-white border-2 border-blue-500 rounded focus:outline-none"
                    >
                        {options.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt.replace('_', ' ')}
                            </option>
                        ))}
                    </select>
                );

            case 'number':
                return (
                    <input
                        ref={inputRef}
                        type="number"
                        value={localValue}
                        onChange={(e) => setLocalValue(parseInt(e.target.value) || 0)}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') handleCancel();
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-white border-2 border-blue-500 rounded focus:outline-none"
                    />
                );

            case 'tags':
                return (
                    <input
                        ref={inputRef}
                        type="text"
                        value={Array.isArray(localValue) ? localValue.join(', ') : localValue}
                        onChange={(e) => {
                            const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                            setLocalValue(tags);
                        }}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') handleCancel();
                        }}
                        placeholder="tag1, tag2, tag3..."
                        className="w-full px-2 py-1.5 text-sm bg-white border-2 border-blue-500 rounded focus:outline-none"
                    />
                );

            case 'longtext':
                return (
                    <TextareaAutosize
                        ref={inputRef}
                        value={localValue || ''}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.metaKey) handleSave();
                            if (e.key === 'Escape') handleCancel();
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-white border-2 border-blue-500 rounded focus:outline-none resize-none"
                        minRows={2}
                    />
                );

            default:
                return (
                    <input
                        ref={inputRef}
                        type="text"
                        value={localValue || ''}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') handleCancel();
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-white border-2 border-blue-500 rounded focus:outline-none"
                    />
                );
        }
    };

    return (
        <div
            className="px-4 py-3 cursor-pointer"
            style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
            onClick={() => !isEditing && isEditable && onStartEdit()}
        >
            {isEditing ? renderEditor() : renderDisplay()}
        </div>
    );
}

// ============================================================================
// HELPERS
// ============================================================================

function LoadingDocument() {
    return (
        <div className="h-full flex items-center justify-center bg-white">
            <div className="text-center space-y-4">
                <div className="flex space-x-2 justify-center">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                            className="w-3 h-3 bg-blue-600 rounded-full"
                        />
                    ))}
                </div>
                <p className="text-base font-medium text-gray-900">Loading your criteria...</p>
            </div>
        </div>
    );
}

function DocumentFooter({ scorecard }: any) {
    const stats = {
        filters: scorecard.mustHaveFilters?.length || 0,
        criteria: scorecard.scoringCriteria?.length || 0,
        totalPoints: scorecard.scoringCriteria?.reduce((sum: number, c: any) => sum + (c.points || 0), 0) || 0,
        threshold: scorecard.threshold || 0,
    };

    return (
        <div className="mt-16 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-8 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="font-medium text-gray-900">{stats.filters}</span> requirements
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        <span className="font-medium text-gray-900">{stats.criteria}</span> scoring factors
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                        <span className="font-medium text-gray-900">{stats.totalPoints}</span> total points
                    </div>
                </div>
                <div className="text-sm">
                    <span className="text-gray-600">Threshold: </span>
                    <span className="font-bold text-gray-900">{stats.threshold} pts</span>
                </div>
            </div>
        </div>
    );
}