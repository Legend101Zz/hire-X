'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Zap, Target } from 'lucide-react';
import SearchBar from '@/components/search/SearchBar';

export default function HomePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async (query: string, filters?: any) => {
    setIsSubmitting(true);

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
          body: JSON.stringify({
            prompt: query,
            filters: filters
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        router.push(`/search?session=${data.session_id}`);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error starting search:', error);
      alert('Failed to start search. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            Find Your Perfect
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Candidate
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered candidate search with smart matching, instant results, and detailed insights
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-16">
          <SearchBar
            onSearch={handleSearch}
            isLoading={isSubmitting}
          />
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <FeatureCard
            icon={<Zap className="w-7 h-7" />}
            title="AI-Powered Matching"
            description="Advanced AI analyzes candidates and provides detailed match summaries in seconds"
          />
          <FeatureCard
            icon={<TrendingUp className="w-7 h-7" />}
            title="Smart Scoring"
            description="Two-tier scoring system ranks candidates by relevance with transparent breakdowns"
          />
          <FeatureCard
            icon={<Target className="w-7 h-7" />}
            title="Preflight Checks"
            description="Instant validation and query refinement ensure you find the right candidates"
          />
        </div>

        {/* Example Queries */}
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
            Try These Examples
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'Senior Python Developer in Bangalore with 5+ years',
              'Financial Services Manager with MBA near Mumbai',
              'Full Stack Engineer with React and Node.js experience',
              'Data Scientist with ML expertise in Healthcare',
            ].map((example) => (
              <button
                key={example}
                onClick={() => handleSearch(example)}
                className="px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-all text-sm font-medium shadow-sm hover:shadow-md"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all group">
      <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-bold text-xl mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}