/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
//@ts-nocheck
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
    Trash2,
    AlertCircle,
    ChevronDown,
    Hash,
    Type,
    List,
    Eye,
    MoreHorizontal,
    BarChart3,
    HelpCircle,
    ArrowRight,
    ArrowLeft,
    Lightbulb,
    Users,
    Award,
    Tag,
    Edit2,
    Save,
    XCircle
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ScorecardDocumentProps {
    scorecard: any;
    onUpdate: (scorecard: any) => void;
    sessionId: string;
    isEditable?: boolean;
}

const SEARCHABLE_FIELDS = {
    // Must-have filter fields
    FILTERS: [
        { value: 'location', label: 'Location (City/State)' },
        { value: 'city', label: 'City' },
        { value: 'state', label: 'State' },
        { value: 'country', label: 'Country' },
        { value: 'title', label: 'Job Title' },
        { value: 'current_industry', label: 'Current Industry' },
        { value: 'seniority_level', label: 'Seniority Level' },
        { value: 'functional_area', label: 'Functional Area' },
        { value: 'expertise', label: 'Skills/Expertise' },
    ],

    // Scoring criteria fields (can check these in profile)
    SCORING: [
        { value: 'title', label: 'Job Title' },
        { value: 'expertise', label: 'Skills/Expertise' },
        { value: 'current_industry', label: 'Current Industry' },
        { value: 'functional_area', label: 'Functional Area' },
        { value: 'seniority_level', label: 'Seniority Level' },
        { value: 'location', label: 'Location' },
        { value: 'city', label: 'City' },
        { value: 'education', label: 'Education' },
        { value: 'certifications', label: 'Certifications' },
        { value: 'awards', label: 'Awards' },
    ],

    // Operators for each field type
    OPERATORS: {
        text: [
            { value: 'contains', label: 'Contains' },
            { value: 'equals', label: 'Equals' },
            { value: 'not_contains', label: 'Does Not Contain' },
        ],
        list: [
            { value: 'in', label: 'Is One Of' },
            { value: 'not_in', label: 'Is Not One Of' },
        ],
        number: [
            { value: '>=', label: 'Greater Than or Equal' },
            { value: '<=', label: 'Less Than or Equal' },
            { value: '==', label: 'Equals' },
        ]
    }
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';



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

    const [animatingFields, setAnimatingFields] = useState<Set<string>>(new Set());
    const [changedSections, setChangedSections] = useState<Set<string>>(new Set());

    useEffect(() => {
        // CHECK FOR _changes FIELD FROM BACKEND
        const changes = scorecard._changes || [];

        if (changes.length > 0) {
            console.log('🎨 AI made changes:', changes);

            // Track which fields are animating
            const fieldIds = new Set<string>();
            const sections = new Set<string>();

            changes.forEach((change: any) => {
                // Create unique field ID: "section-index-field"
                const fieldId = `${change.section}-${change.field}`;
                fieldIds.add(fieldId);
                sections.add(change.section);
            });

            setAnimatingFields(fieldIds);
            setChangedSections(sections);

            // Remove animations after 2.5 seconds
            setTimeout(() => {
                setAnimatingFields(new Set());
                setChangedSections(new Set());
            }, 2500);
        }

        setIsTyping(true);
        setTimeout(() => {
            setLocalScorecard(scorecard);
            setIsTyping(false);
        }, 300);

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
                            animatingFields={animatingFields}
                            sectionChanged={changedSections.has('mustHaveFilters')}
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
                            animatingFields={animatingFields}
                            sectionChanged={changedSections.has('scoringCriteria')}
                        />
                    </div>

                    {/* Smart Expansions */}
                    {localScorecard.expansions && Object.keys(localScorecard.expansions).length > 0 && (
                        <div id="expansions-section" className={highlightedSection === 'expansions' ? 'relative z-40' : ''}>
                            <ExpansionsSection
                                expansions={localScorecard.expansions}
                                isTyping={isTyping}
                                isHighlighted={highlightedSection === 'expansions'}
                                sessionId={sessionId}
                                onUpdate={(newExpansions) => {
                                    const updated = { ...localScorecard, expansions: newExpansions };
                                    setLocalScorecard(updated);
                                    onUpdate(updated);
                                }}
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
                    Instead of manually writing complex database queries, you simply tell us what you&apos;re looking for in plain English.
                    Our AI handles all the complexity behind the scenes.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 font-medium">
                        💡 <span className="font-bold">Example:</span> &quot;Senior backend engineer with Go experience in Gurgaon&quot;
                    </p>
                    <p className="text-sm text-gray-900 mt-2">
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
                            <p className="text-sm text-gray-900">Identifies: roles, locations, skills, experience levels, industries</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Creates Initial Structure</p>
                            <p className="text-sm text-gray-900">Builds the foundation of your search criteria</p>
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
                            <span className="ml-2 text-sm text-gray-900">&quot;Backend Engineer&quot;</span>
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
                        <span className="font-bold">Technical Note:</span> Backend requests concept expansion from LLM, which returns expanded term lists. These get added to the scorecard&apos;s expansion mappings. LLM also suggests initial weights for scoring.
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
                            <p className="text-sm text-gray-800">&quot;Must candidates be located in Gurgaon, or can they work remotely?&quot;</p>
                        </div>
                        <div className="bg-blue-600 text-white rounded-lg p-3">
                            <p className="text-xs font-semibold mb-1">YOU ANSWER:</p>
                            <p className="text-sm">&quot;Must be in Gurgaon&quot;</p>
                        </div>
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                        ⚡ <span className="font-bold">Result:</span> Any candidate not in Gurgaon is automatically excluded. They won&apos;t even appear in results.
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
                    <span className="font-bold text-gray-900">What happens:</span> The AI helps you decide what makes someone a &quot;great&quot; vs &quot;good&quot; candidate.
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
                                <p className="text-xs text-gray-900">Critical skill - highest weight</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                                20
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Startup Experience</p>
                                <p className="text-xs text-gray-900">Important but not required</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-8 h-8 bg-blue-400 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                                10
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">AWS Certification</p>
                                <p className="text-xs text-gray-900">Nice bonus</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                        ✅ <span className="font-bold">Minimum Threshold:</span> Set the minimum score (e.g., 40/60) to pass. Candidates below this won&apos;t appear.
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
                            <p className="text-xs text-gray-900">Senior Backend Engineer • Gurgaon • 7 years Go</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-green-400">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-bold text-gray-900">Raj Patel</p>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">42/60</span>
                            </div>
                            <p className="text-xs text-gray-900">Software Engineer • Gurgaon • 5 years Go</p>
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
                            <p className="text-xs text-gray-900">Search thousands of candidates with your filters</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">
                            2
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Apply Scoring</p>
                            <p className="text-xs text-gray-900">Calculate points for each candidate based on your criteria</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">
                            3
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">AI Deep Evaluation</p>
                            <p className="text-xs text-gray-900">AI reads full profiles and explains why each person is a good match</p>
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
                            Detailed explanation of why they&apos;re a good fit
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
                    <span className="font-bold text-gray-900">The beauty of this system:</span> You don&apos;t need to understand databases, queries, or technical details. Just describe what you want!
                </p>
                <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Simple for HR</p>
                            <p className="text-sm text-gray-900">Just talk naturally - no technical knowledge needed</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Powerful AI</p>
                            <p className="text-sm text-gray-900">Handles complexity, expansions, scoring, and evaluation automatically</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Collaborative</p>
                            <p className="text-sm text-gray-900">AI asks questions, you provide feedback, together you find the best candidates</p>
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
                            <X className="w-5 h-5 text-gray-700" />
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {step.title}
                    </h2>
                    <p className="text-gray-900 mt-1">
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
                    <p className="text-lg text-gray-900 mt-2">
                        Based on: <span className="text-gray-800 font-medium">&quot;{query}&quot;x</span>
                    </p>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// MUST-HAVE SECTION
// ============================================================================

function MustHaveSection({ filters, onUpdate, isEditable, isTyping, isHighlighted, animatingFields = new Set(),
    sectionChanged = false }: any) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <motion.section
            animate={{
                scale: isHighlighted ? 1.01 : 1,
                boxShadow: isHighlighted
                    ? '0 0 0 4px rgba(239, 68, 68, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    : sectionChanged
                        ? '0 0 0 3px rgba(59, 130, 246, 0.5)'
                        : '0 0 0 0px rgba(239, 68, 68, 0)'
            }}
            transition={{ duration: 0.3 }}
            className={`space-y-3 ${isHighlighted ? 'bg-white rounded-xl p-6 relative' : ''}`}
        >
            {/* CHANGE INDICATOR */}
            {sectionChanged && !isHighlighted && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute -top-2 -right-2 z-10"
                >
                    <div className="relative">
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 1, 0.5]
                            }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute inset-0 bg-blue-500 rounded-full blur-sm"
                        />
                        <div className="relative w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-white" />
                        </div>
                    </div>
                </motion.div>
            )}
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
                            <ChevronDown className="w-5 h-5 text-gray-900" />
                        </motion.div>
                    </button>
                    <Target className="w-5 h-5 text-red-500" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Must-Have Requirements
                        </h2>
                        <p className="text-sm text-gray-900 mt-0.5">
                            Deal-breakers that eliminate candidates automatically
                        </p>
                    </div>
                </div>
                <span className="text-sm font-medium text-gray-700">
                    {filters.length} {filters.length === 1 ? 'requirement' : 'requirements'}
                </span>
            </div>

            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-100">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">These are non-negotiables.</span> If a candidate doesn&apos;t meet ALL of these, they won&apos;t appear in your results.
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
                                { key: 'field', label: 'Field', type: 'select', icon: <List className="w-4 h-4" />, width: '200px' },
                                { key: 'operator', label: 'Condition', type: 'select', icon: <Type className="w-4 h-4" />, width: '180px' },
                                { key: 'value', label: 'Value', type: 'text', icon: <Type className="w-4 h-4" />, },
                                { key: 'description', label: 'Description', type: 'longtext', icon: <Type className="w-4 h-4" />, },
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
                            animatingFields={animatingFields}
                            sectionName="mustHaveFilters"
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
                            <ChevronDown className="w-5 h-5 text-gray-900" />
                        </motion.div>
                    </button>
                    <Scale className="w-5 h-5 text-blue-500" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            What Makes a Great Match
                        </h2>
                        <p className="text-sm text-gray-900 mt-0.5">
                            Weighted factors that rank and score candidates
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">
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
                                    { key: 'description', label: 'What makes them great?', type: 'longtext', icon: <Type className="w-4 h-4" /> },
                                    { key: 'keywords', label: 'Keywords', type: 'tags', icon: <List className="w-4 h-4" />, width: '280px' },
                                    { key: 'points', label: 'Points', type: 'number', icon: <Hash className="w-4 h-4" />, width: '140px' },
                                    { key: 'weight', label: 'Weight', type: 'progress', icon: <BarChart3 className="w-4 h-4" />, width: '180px' },
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
                            <span className="text-lg text-gray-900 font-normal ml-2">/ {totalPoints}</span>
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

function ExpansionsSection({ expansions, isTyping, isHighlighted, sessionId,
    onUpdate }: any) {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [localExpansions, setLocalExpansions] = useState(expansions);
    const [editingKey, setEditingKey] = useState<string | null>(null);


    useEffect(() => {
        setLocalExpansions(expansions);
    }, [expansions]);

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/scorecard/${sessionId}/update-expansions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ expansions: localExpansions })
            });

            onUpdate(localExpansions);
            setIsEditing(false);
            setEditingKey(null);
        } catch (error) {
            console.error('Error saving expansions:', error);
        }
    };

    const handleCancel = () => {
        setLocalExpansions(expansions);
        setIsEditing(false);
        setEditingKey(null);
    };

    const handleAddTerm = (key: string, term: string) => {
        setLocalExpansions({
            ...localExpansions,
            [key]: [...(localExpansions[key] || []), term]
        });
    };

    const handleRemoveTerm = (key: string, index: number) => {
        const updated = [...localExpansions[key]];
        updated.splice(index, 1);
        setLocalExpansions({
            ...localExpansions,
            [key]: updated
        });
    }

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
                            <ChevronDown className="w-5 h-5 text-gray-900" />
                        </motion.div>
                    </button>
                    <Zap className="w-5 h-5 text-purple-500" />
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Smart Expansions
                        </h2>
                        <p className="text-sm text-gray-900 mt-0.5">
                            AI-generated variations to find more candidates
                        </p>
                    </div>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-2"
                    >
                        <Edit2 className="w-4 h-4" />
                        Edit Expansions
                    </button>
                )}
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-900">We search smarter.</span> When you look for &quot;Backend Engineer&quot;, we also search for related titles automatically.
                </p>
            </div>

            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div className="space-y-4 pt-2">
                        {Object.entries(localExpansions).map(([key, values]: [string, any]) => {
                            const valuesArray = Array.isArray(values) ? values : [];

                            if (valuesArray.length === 0) return null;
                            return (
                                <div key={key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                                            {key.replace('_', ' ')}
                                        </h4>

                                        {/* ✅ ADD NEW TERM */}
                                        {isEditing && editingKey === key && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Add term..."
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                            handleAddTerm(key, e.currentTarget.value.trim());
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                    className="px-2 py-1 text-sm border-2 border-purple-500 rounded-lg"
                                                />
                                            </div>
                                        )}

                                        {isEditing && (
                                            <button
                                                onClick={() => setEditingKey(editingKey === key ? null : key)}
                                                className="p-1 hover:bg-purple-100 rounded"
                                            >
                                                <Plus className="w-4 h-4 text-purple-600" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {values.map((value: string, i: number) => (
                                            <motion.span
                                                key={i}
                                                layout
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-900 border border-purple-200"
                                            >
                                                {value}

                                                {/* ✅ REMOVE BUTTON */}
                                                {isEditing && (
                                                    <button
                                                        onClick={() => handleRemoveTerm(key, i)}
                                                        className="p-0.5 hover:bg-purple-200 rounded-full"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </motion.span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* ✅ SAVE/CANCEL BUTTONS */}
                        {isEditing && (
                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-purple-200">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </button>
                            </div>
                        )}
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
    animatingFields?: Set<string>;
    sectionName?: string;
}

function NotionTable({
    items,
    columns,
    onUpdate,
    onAdd,
    isEditable,
    emptyMessage,
    accentColor,
    totalPoints = 0,
    animatingFields = new Set(),
    sectionName = ''
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
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center bg-gradient-to-br from-gray-50 to-gray-100"
            >
                <div className="max-w-md mx-auto space-y-4">
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`w-16 h-16 mx-auto rounded-2xl ${accentColor === 'red' ? 'bg-gradient-to-br from-red-400 to-pink-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'
                            } flex items-center justify-center shadow-xl`}
                    >
                        {accentColor === 'red' ? (
                            <Target className="w-8 h-8 text-white" />
                        ) : (
                            <Scale className="w-8 h-8 text-white" />
                        )}
                    </motion.div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Nothing here yet</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{emptyMessage}</p>
                    </div>
                    {isEditable && (
                        <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onAdd}
                            className={`inline-flex items-center gap-2 px-6 py-3 ${accentColor === 'red'
                                ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                                } text-white rounded-xl transition-all text-sm font-bold shadow-lg hover:shadow-xl`}
                        >
                            <Plus className="w-5 h-5" />
                            Add Your First One
                        </motion.button>
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <div className="border-2 border-gray-200 rounded-2xl overflow-hidden bg-white shadow-xl">
            {/* Enhanced Table Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <div className="flex items-stretch min-h-[56px]">
                    {/* Row Number Column */}
                    <div className="w-16 flex-shrink-0 border-r-2 border-gray-200 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-sm">
                            <Hash className="w-4 h-4 text-gray-600" />
                        </div>
                    </div>

                    {/* Column Headers */}
                    {columns.map((col, idx) => (
                        <div
                            key={col.key}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold text-gray-800 uppercase tracking-wider ${idx < columns.length - 1 ? 'border-r-2 border-gray-200' : ''
                                }`}
                            style={{
                                width: col.width || 'auto',
                                minWidth: col.width || '150px',
                                flex: col.width ? '0 0 auto' : '1 1 0'
                            }}
                        >
                            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                                {col.icon}
                            </div>
                            <span className="truncate">{col.label}</span>
                        </div>
                    ))}

                    {/* Actions Column */}
                    <div className="w-16 flex-shrink-0 border-l-2 border-gray-200 flex items-center justify-center">
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Info Banner */}
            <div className="px-4 py-3 bg-blue-50 border-b-2 border-blue-100">
                <div className="flex items-start gap-3 text-xs">
                    <div className="p-1 bg-blue-100 rounded-md flex-shrink-0">
                        <AlertCircle className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-blue-900 mb-1">
                            💡 Searchable Fields Only
                        </p>
                        <p className="text-blue-800 leading-relaxed">
                            {sectionName === 'mustHaveFilters'
                                ? 'Only fields from candidate profiles: location, title, industry, skills, seniority, etc.'
                                : 'Only fields from candidate profiles: title, skills, industry, education, certifications, awards, etc.'
                            }
                        </p>
                    </div>
                </div>
            </div>

            {/* Enhanced Table Body */}
            <div className="divide-y-2 divide-gray-100">
                <AnimatePresence mode="popLayout">
                    {items.map((item, index) => {
                        const isHovered = hoveredRow === index;

                        return (
                            <motion.div
                                key={index}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20, height: 0 }}
                                transition={{ duration: 0.3 }}
                                onHoverStart={() => setHoveredRow(index)}
                                onHoverEnd={() => setHoveredRow(null)}
                                className={`flex items-stretch min-h-[72px] group/row relative ${isHovered ? 'bg-blue-50/30' : 'bg-white'
                                    } transition-all`}
                            >
                                {/* Row number & Drag Handle */}
                                <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center border-r-2 border-gray-100">
                                    {isEditable && isHovered ? (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            whileHover={{ scale: 1.1 }}
                                            className="cursor-grab active:cursor-grabbing"
                                        >
                                            <GripVertical className="w-5 h-5 text-gray-400" />
                                        </motion.div>
                                    ) : (
                                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                                            <span className="text-xs font-bold text-gray-700">
                                                {index + 1}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Cells */}
                                {columns.map((col, colIdx) => {
                                    const fieldId = `${sectionName}-${col.key}`;
                                    const isAnimating = animatingFields.has(fieldId);

                                    return (
                                        <div
                                            key={col.key}
                                            className={`flex items-center ${colIdx < columns.length - 1 ? 'border-r-2 border-gray-100' : ''
                                                }`}
                                            style={{
                                                width: col.width || 'auto',
                                                minWidth: col.width || '150px',
                                                flex: col.width ? '0 0 auto' : '1 1 0'
                                            }}
                                        >
                                            <TableCell
                                                item={item}
                                                column={col}
                                                isEditing={editingCell?.row === index && editingCell?.col === col.key}
                                                onStartEdit={() => isEditable && setEditingCell({ row: index, col: col.key })}
                                                onStopEdit={() => setEditingCell(null)}
                                                onUpdate={(value) => handleUpdate(index, col.key, value)}
                                                isEditable={isEditable}
                                                totalPoints={totalPoints}
                                                isAnimating={isAnimating}
                                            />
                                        </div>
                                    );
                                })}

                                {/* Actions */}
                                <div className="w-16 flex-shrink-0 flex items-center justify-center border-l-2 border-gray-100">
                                    <AnimatePresence>
                                        {isEditable && isHovered && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                                exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                                                whileHover={{ scale: 1.1, rotate: 5 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => handleDelete(index)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Enhanced Add New Row Button */}
            {isEditable && (
                <motion.button
                    whileHover={{ backgroundColor: 'rgb(249, 250, 251)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onAdd}
                    className="w-full px-4 py-4 flex items-center gap-3 text-sm font-semibold text-gray-700 transition-all border-t-2 border-gray-100 group"
                >
                    <motion.div
                        whileHover={{ scale: 1.2, rotate: 90 }}
                        className="w-6 h-6 rounded-lg bg-gray-200 group-hover:bg-blue-200 flex items-center justify-center transition-colors"
                    >
                        <Plus className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors" />
                    </motion.div>
                    <span className="group-hover:text-blue-600 transition-colors">Add New Row</span>
                </motion.button>
            )}
        </div>
    );
}


// ============================================================================
// TAGS INPUT COMPONENT
// ============================================================================

function TagsInput({
    value = [],
    onChange,
    placeholder = "Add keywords...",
    isEditable = true
}: {
    value: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    isEditable?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [localTags, setLocalTags] = useState<string[]>(value || []);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalTags(value || []);
    }, [value]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleAddTag = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !localTags.includes(trimmed)) {
            const newTags = [...localTags, trimmed];
            setLocalTags(newTags);
            setInputValue('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const newTags = localTags.filter(tag => tag !== tagToRemove);
        setLocalTags(newTags);
    };

    const handleClose = () => {
        onChange(localTags);
        setIsOpen(false);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        } else if (e.key === 'Escape') {
            handleClose();
        } else if (e.key === 'Backspace' && !inputValue && localTags.length > 0) {
            handleRemoveTag(localTags[localTags.length - 1]);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {/* Display View */}
            {!isOpen ? (
                <div
                    onClick={() => isEditable && setIsOpen(true)}
                    className={`flex flex-wrap gap-1.5 min-h-[36px] ${isEditable ? 'cursor-pointer hover:bg-gray-50' : ''
                        } rounded-lg p-2 transition-colors`}
                >
                    {localTags.length > 0 ? (
                        <>
                            {localTags.slice(0, 3).map((tag, i) => (
                                <motion.span
                                    key={i}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-200"
                                >
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                </motion.span>
                            ))}
                            {localTags.length > 3 && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                    +{localTags.length - 3} more
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-sm text-gray-400 py-1">
                            {placeholder}
                        </span>
                    )}
                </div>
            ) : (
                /* Edit View - Popover */
                <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute top-0 left-0 right-0 z-50 bg-white rounded-xl border-2 border-blue-500 shadow-2xl p-3 space-y-3"
                    style={{ minWidth: '300px' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-blue-600" />
                            <h4 className="text-sm font-bold text-gray-900">Edit Keywords</h4>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    {/* Tags Display */}
                    <div className="flex flex-wrap gap-2 min-h-[40px] max-h-[200px] overflow-y-auto p-2 bg-gray-50 rounded-lg">
                        <AnimatePresence mode="popLayout">
                            {localTags.map((tag, i) => (
                                <motion.span
                                    key={tag}
                                    layout
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white shadow-sm group"
                                >
                                    <Tag className="w-3.5 h-3.5" />
                                    {tag}
                                    <button
                                        onClick={() => handleRemoveTag(tag)}
                                        className="ml-1 p-0.5 hover:bg-blue-700 rounded-full transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </motion.span>
                            ))}
                            {localTags.length === 0 && (
                                <span className="text-sm text-gray-500 py-2">
                                    No keywords yet. Add some below!
                                </span>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Input */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Type and press Enter..."
                                className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 placeholder-gray-400"
                            />
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleAddTag}
                            disabled={!inputValue.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                        </motion.button>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Enter</kbd> to add,{' '}
                            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Esc</kbd> to close
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleClose}
                            className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold flex items-center gap-1"
                        >
                            <Check className="w-3 h-3" />
                            Done ({localTags.length})
                        </motion.button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ============================================================================
// TABLE CELL
// ============================================================================

function TableCell({
    item,
    column,
    isEditing,
    onStartEdit,
    onStopEdit,
    onUpdate,
    isEditable,
    totalPoints,
    isAnimating = false
}: any) {
    const [localValue, setLocalValue] = useState(item[column.key]);
    const inputRef = useRef<any>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    useEffect(() => {
        setLocalValue(item[column.key]);
    }, [item[column.key]]);

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
                    <div className="w-full">
                        <TagsInput
                            value={value || []}
                            onChange={(newTags) => onUpdate(newTags)}
                            placeholder="Click to add keywords..."
                            isEditable={isEditable}
                        />
                    </div>
                );

            case 'number':
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-lg font-bold text-white">
                                {value || 0}
                            </span>
                        </div>
                        <span className="text-xs text-gray-700 font-semibold whitespace-nowrap">points</span>
                    </div>
                );

            case 'progress':
                const percentage = totalPoints > 0 ? (item.points / totalPoints) * 100 : 0;
                return (
                    <div className="w-full space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                                />
                            </div>
                            <span className="text-sm font-bold text-gray-900 whitespace-nowrap min-w-[50px] text-right">
                                {Math.round(percentage)}%
                            </span>
                        </div>
                    </div>
                );

            case 'select':
                const displayValue = value ? value.replace(/_/g, ' ') : 'Select...';
                return (
                    <div className="w-full">
                        <div className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold border-2 ${value
                            ? 'bg-blue-50 text-blue-900 border-blue-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}>
                            {displayValue}
                        </div>
                    </div>
                );

            case 'longtext':
                return (
                    <div className="w-full py-1">
                        <p className="text-sm text-gray-900 leading-relaxed font-medium">
                            {value || <span className="text-gray-400 italic">Click to add description...</span>}
                        </p>
                    </div>
                );

            default:
                return (
                    <div className="w-full">
                        <span className="text-sm text-gray-900 font-medium">
                            {value || <span className="text-gray-400 italic">Empty</span>}
                        </span>
                    </div>
                );
        }
    };

    const renderEditor = () => {
        switch (column.type) {
            case 'select':
                let options: Array<{ value: string; label: string }> = [];

                if (column.key === 'field') {
                    options = SEARCHABLE_FIELDS.FILTERS;
                } else if (column.key === 'operator') {
                    const fieldValue = item.field;
                    const isListField = ['education', 'certifications', 'awards'].includes(fieldValue);
                    const isNumberField = ['experience_years', 'seniority_level'].includes(fieldValue);

                    if (isListField) {
                        options = SEARCHABLE_FIELDS.OPERATORS.list;
                    } else if (isNumberField) {
                        options = SEARCHABLE_FIELDS.OPERATORS.number;
                    } else {
                        options = SEARCHABLE_FIELDS.OPERATORS.text;
                    }
                }

                return (
                    <select
                        ref={inputRef}
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleSave}
                        className="w-full px-3 py-2.5 text-sm font-semibold bg-white border-2 border-blue-500 rounded-lg focus:outline-none text-gray-900 shadow-lg"
                    >
                        <option value="">Select...</option>
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
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
                        className="w-full px-3 py-2.5 text-sm font-bold bg-white border-2 border-blue-500 rounded-lg focus:outline-none text-gray-900 shadow-lg"
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
                        className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-blue-500 rounded-lg focus:outline-none resize-none text-gray-900 shadow-lg leading-relaxed"
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
                        className="w-full px-3 py-2.5 text-sm font-medium bg-white border-2 border-blue-500 rounded-lg focus:outline-none text-gray-900 shadow-lg"
                    />
                );
        }
    };

    return (
        <motion.div
            animate={{
                backgroundColor: isAnimating
                    ? ['#FFFFFF', '#DBEAFE', '#FFFFFF']
                    : '#FFFFFF',
                scale: isAnimating ? [1, 1.005, 1] : 1
            }}
            transition={{
                duration: 0.8,
                ease: "easeInOut"
            }}
            className={`w-full h-full px-4 py-3 relative group/cell ${!isEditing && isEditable && column.type !== 'tags' ? 'cursor-pointer hover:bg-blue-50/50' : ''
                } transition-all flex items-center`}
            onClick={() => !isEditing && isEditable && column.type !== 'tags' && onStartEdit()}
        >
            {/* Sparkle animation when changed */}
            <AnimatePresence>
                {isAnimating && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0, rotate: -180 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0, opacity: 0, rotate: 180 }}
                        className="absolute top-2 right-2 z-10"
                    >
                        <div className="relative">
                            <motion.div
                                animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.3, 0.8, 0.3]
                                }}
                                transition={{ repeat: 3, duration: 0.6 }}
                                className="absolute inset-0 bg-blue-400 rounded-full blur-md"
                            />
                            <div className="relative w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit icon on hover (except for tags) */}
            {!isEditing && isEditable && column.type !== 'tags' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute top-2 right-2 opacity-0 group-hover/cell:opacity-100 transition-opacity z-10"
                >
                    <div className="p-1 bg-blue-100 rounded-md shadow-sm">
                        <Edit2 className="w-3 h-3 text-blue-600" />
                    </div>
                </motion.div>
            )}

            {/* Content */}
            <div className="w-full">
                {isEditing ? renderEditor() : renderDisplay()}
            </div>
        </motion.div>
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
                <div className="flex items-center gap-8 text-sm text-gray-900">
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
                    <span className="text-gray-900">Threshold: </span>
                    <span className="font-bold text-gray-900">{stats.threshold} pts</span>
                </div>
            </div>
        </div>
    );
}