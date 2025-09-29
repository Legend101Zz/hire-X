'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/ui/sidebar';
import Header from '@/components/ui/header';
import ProfileModal from '@/components/ui/profile-modal';
import { SparklesIcon, TrashIcon, CheckIcon, MessageCircle, Phone, FileText, DollarSign, Users, ArrowRight } from 'lucide-react';
import { Profile } from '@/types/profile';

export default function ShortlistPage() {
  const [shortlistedProfiles, setShortlistedProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<number>>(new Set());
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isReachOutModalOpen, setIsReachOutModalOpen] = useState(false);

  // Load shortlisted profiles from localStorage
  useEffect(() => {
    const loadShortlistedProfiles = () => {
      try {
        const stored = localStorage.getItem('shortlistedProfiles');
        if (stored) {
          const profiles = JSON.parse(stored);
          setShortlistedProfiles(profiles);
        }
      } catch (error) {
        console.error('Error loading shortlisted profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadShortlistedProfiles();
  }, []);

  // Listen for storage changes (when profiles are shortlisted from other pages)
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('shortlistedProfiles');
      if (stored) {
        const profiles = JSON.parse(stored);
        setShortlistedProfiles(profiles);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleSelect = (index: number) => {
    const newSelected = new Set(selectedProfiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedProfiles(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAll = () => {
    if (selectedProfiles.size === shortlistedProfiles.length) {
      setSelectedProfiles(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedProfiles(new Set(shortlistedProfiles.map((_, index) => index)));
      setShowBulkActions(true);
    }
  };

  const removeFromShortlist = (index: number) => {
    const updatedProfiles = shortlistedProfiles.filter((_, i) => i !== index);
    setShortlistedProfiles(updatedProfiles);
    localStorage.setItem('shortlistedProfiles', JSON.stringify(updatedProfiles));
    
    // Remove from selected if it was selected
    const newSelected = new Set(selectedProfiles);
    newSelected.delete(index);
    setSelectedProfiles(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const removeSelectedFromShortlist = () => {
    const updatedProfiles = shortlistedProfiles.filter((_, index) => !selectedProfiles.has(index));
    setShortlistedProfiles(updatedProfiles);
    localStorage.setItem('shortlistedProfiles', JSON.stringify(updatedProfiles));
    setSelectedProfiles(new Set());
    setShowBulkActions(false);
  };

  const openProfileModal = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsModalOpen(false);
    setSelectedProfile(null);
  };

  const highlightKeywords = (text: string) => {
    const keywords = ['over two decades of experience', 'low-latency, high-capacity trading systems', 'distributed systems', 'Go', 'financial sector', 'financial services domain'];
    
    let highlightedText = text;
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<span class="bg-yellow-200 font-medium">$1</span>');
    });
    
    return highlightedText;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
              <p className="text-violet-700 font-medium">Loading shortlist...</p>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col overflow-hidden pl-64">
        <Header />
        <div className="flex-1 bg-white">
          {/* Header with count and actions */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Shortlisted Candidates ({shortlistedProfiles.length})
                </h2>
                {shortlistedProfiles.length > 0 && (
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedProfiles.size === shortlistedProfiles.length}
                      onChange={selectAll}
                      className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">Select All</span>
                  </label>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Initiate Reach Outs Button */}
                {shortlistedProfiles.length > 0 && (
                  <button
                    onClick={() => setIsReachOutModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors font-medium"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Initiate reach outs
                  </button>
                )}
                
                {/* Bulk Actions */}
                {showBulkActions && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {selectedProfiles.size} selected
                    </span>
                    <button
                      onClick={removeSelectedFromShortlist}
                      className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4 mr-1" />
                      Remove Selected
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          {shortlistedProfiles.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckIcon className="w-8 h-8 text-violet-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No shortlisted candidates</h3>
                <p className="text-gray-600 mb-6">
                  Start by searching for candidates and adding them to your shortlist. 
                  You can shortlist candidates by clicking the &quot;Shortlist&quot; button on their profile cards.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                  Start Searching
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {shortlistedProfiles.map((profile, index) => {
                const isSelected = selectedProfiles.has(index);
                const currentRole = (profile.experience?.find(exp => exp.current === 1)?.title || profile.title || 'N/A').toString();
                const education = (profile.education?.[0]?.major || profile.education?.[0]?.campus || 'N/A').toString();
                const summary = profile.summary && profile.summary !== 'NA' ? profile.summary : 
                  `${profile.first_name || ''} ${profile.last_name || ''}`.trim() + 
                  `'s has missing description, so no summary available for the profile`;

                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-6 hover:shadow-md transition-all cursor-pointer ${
                      isSelected ? 'border-violet-300 bg-violet-50' : 'border-gray-200'
                    }`}
                    onClick={() => openProfileModal(profile)}
                  >
                    <div className="flex items-start space-x-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(index);
                        }}
                        className="mt-1 w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                      />

                      {/* Profile Content */}
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {`${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Profile Name'}
                              </h3>
                              <div className="flex items-center space-x-2">
                                {profile.linkedin_url && (
                                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clipRule="evenodd" />
                                    </svg>
                                  </a>
                                )}
                                <button className="text-gray-400 hover:text-gray-600">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                  </svg>
                                </button>
                                <button className="text-gray-400 hover:text-gray-600">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-gray-800">{currentRole} • <span className="text-gray-600">{profile.location?.toString() || 'N/A'}</span></p>
                            <p className="text-sm text-gray-900">{education}</p>
                            {profile.shortlistedAt && (
                              <p className="text-xs text-violet-600 mt-1">
                                Shortlisted on {new Date(profile.shortlistedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromShortlist(index);
                              }}
                              className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                            >
                              <TrashIcon className="w-4 h-4 mr-1" />
                              Remove
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openProfileModal(profile);
                              }}
                              className="p-2 text-gray-400 hover:text-gray-600"
                              title="View full profile"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="text-sm text-violet-700 leading-relaxed flex items-center">
                          <SparklesIcon className="w-4 h-4 mr-2" />
                          <span dangerouslySetInnerHTML={{ __html: highlightKeywords(summary) }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Sidebar />
      
      {/* Profile Modal */}
      <ProfileModal
        profile={selectedProfile}
        isOpen={isModalOpen}
        onClose={closeProfileModal}
      />

      {/* Reach Out Modal */}
      {isReachOutModalOpen && (
        <div className="fixed inset-0 bg-transparent bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Candidate Outreach Process</h2>
                <button
                  onClick={() => setIsReachOutModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Process Overview */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">How We Reach Out to Candidates</h3>
                
                {/* Process Steps */}
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">1. WhatsApp Initial Contact</h4>
                      <p className="text-gray-600">
                        We reach out to candidates through WhatsApp to introduce our opportunity and gauge their interest. 
                        This initial contact helps us understand their current situation and availability.
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">2. Schedule Phone Call</h4>
                      <p className="text-gray-600">
                        We schedule a detailed phone call to understand their requirements, career goals, 
                        and expectations. This helps us assess the best fit and gather comprehensive insights.
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">3. Generate Comprehensive Report</h4>
                      <p className="text-gray-600">
                        Once we have enough leads, we create a detailed report including phone numbers, 
                        call insights, complete candidate descriptions, and recommendations for next steps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Calculation */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-center mb-4">
                  <DollarSign className="w-6 h-6 text-green-600 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">Pricing</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-700">Number of candidates:</span>
                    </div>
                    <span className="font-semibold text-gray-900">{shortlistedProfiles.length}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-gray-500" />
                      <span className="text-gray-700">Cost per candidate:</span>
                    </div>
                    <span className="font-semibold text-gray-900">$0.25</span>
                  </div>
                  
                  <div className="border-t border-gray-300 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900">Total Cost:</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${(shortlistedProfiles.length * 0.25).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setIsReachOutModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Here you would implement the actual reach out functionality
                    alert(`Initiating reach outs for ${shortlistedProfiles.length} candidates. Total cost: $${(shortlistedProfiles.length * 0.25).toFixed(2)}`);
                    setIsReachOutModalOpen(false);
                  }}
                  className="px-6 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 transition-colors font-medium"
                >
                  Proceed with Reach Outs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
