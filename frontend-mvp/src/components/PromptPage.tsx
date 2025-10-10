'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SearchBar from './search/SearchBar';
import SearchProgress from './progress/SearchProgress';
import QueryRefinement from './search/QueryRefinement';
import Header from './ui/header';

const HERO_TEXT = "Hello there, what are you looking for today?";

export default function PromptPage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showRefinement, setShowRefinement] = useState(false);
  const [preflightResults, setPreflightResults] = useState<any>(null);
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const handleSearch = async (query: string, filters?: any) => {
    setIsSearching(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/parse-prompt`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt: query, filters }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.session_id);
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

  const handleComplete = () => {
    setIsSearching(false);
    router.push(`/results?session=${sessionId}`);
  };

  const handleNeedsRefinement = (results: any) => {
    setPreflightResults(results);
    setShowRefinement(true);
  };

  const handleRefine = async (refinements: any) => {
    setShowRefinement(false);
    try {
      const token = localStorage.getItem('token');
      await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/session/${sessionId}/refine`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(refinements),
        }
      );
    } catch (error) {
      console.error('Error refining search:', error);
      setIsSearching(false);
    }
  };

  const handleError = (error: string) => {
    console.error('Search error:', error);
    alert(`Search failed: ${error}`);
    setIsSearching(false);
    setSessionId(null);
  };

  const EXAMPLE_QUERIES = [
    'Senior Python Developer in Bangalore with 5+ years',
    'Financial Services Manager with MBA near Mumbai',
    'Full Stack Engineer with React and Node.js experience',
    'Data Scientist with ML expertise in Healthcare',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-25">
        {/* Hero Text with Typewriter Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
            {displayedText}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
              className="inline-block w-1 h-10 md:h-12 bg-gradient-to-b from-blue-600 to-purple-600 ml-1"
            />
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto"
          >
            AI-powered candidate search with smart matching and instant results
          </motion.p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <SearchBar onSearch={handleSearch} isLoading={isSearching} />
        </motion.div>

        {/* Example Queries */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <p className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
            Try these examples
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {EXAMPLE_QUERIES.map((example, idx) => (
              <motion.button
                key={example}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const event = new CustomEvent('populateSearch', { detail: example });
                  window.dispatchEvent(event);
                }}
                disabled={isSearching}
                className="px-4 py-2.5 bg-white text-gray-700 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-center"
        >
          <div className="group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="text-4xl mb-3 inline-block"
            >
              ⚡
            </motion.div>
            <h3 className="font-semibold text-gray-800 mb-1">Instant Results</h3>
            <p className="text-sm text-gray-600">Get matched candidates in seconds</p>
          </div>
          <div className="group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              className="text-4xl mb-3 inline-block"
            >
              🎯
            </motion.div>
            <h3 className="font-semibold text-gray-800 mb-1">Smart Matching</h3>
            <p className="text-sm text-gray-600">AI-powered relevance scoring</p>
          </div>
          <div className="group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="text-4xl mb-3 inline-block"
            >
              ✨
            </motion.div>
            <h3 className="font-semibold text-gray-800 mb-1">Auto Filters</h3>
            <p className="text-sm text-gray-600">Intelligent filter extraction</p>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      {isSearching && sessionId && (
        <SearchProgress
          sessionId={sessionId}
          onComplete={handleComplete}
          onNeedsRefinement={handleNeedsRefinement}
          onError={handleError}
        />
      )}

      {showRefinement && preflightResults && (
        <QueryRefinement
          preflightResults={preflightResults}
          onRefine={handleRefine}
          onCancel={() => {
            setShowRefinement(false);
            setIsSearching(false);
            setSessionId(null);
          }}
        />
      )}
    </div>
  );
}