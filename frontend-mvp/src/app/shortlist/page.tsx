'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/ui/sidebar';
import Header from '@/components/ui/header';
import ProfileModal from '@/components/ui/profile-modal';
import ContactFetchModal from '@/components/ui/contact-fetch-modal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SparklesIcon,
  TrashIcon,
  CheckIcon,
  Phone,
  Zap,
  Star,
  Award,
  MapPin,
  Building2,
  ChevronRight,
  Heart,
  Loader2
} from 'lucide-react';
import { Profile } from '@/types/profile';
import { fetchSingleContact, fetchBulkContacts, HatchContactResult } from '@/utils/hatchApi';

export default function ShortlistPage() {
  const [shortlistedProfiles, setShortlistedProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<number>>(new Set());
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Contact fetch modal states
  const [isContactFetchModalOpen, setIsContactFetchModalOpen] = useState(false);
  const [contactFetchCandidates, setContactFetchCandidates] = useState<Array<{ id: string; name: string; currentRole?: string }>>([]);
  const [contactFetchResults, setContactFetchResults] = useState<HatchContactResult[]>([]);
  const [fetchingContacts, setFetchingContacts] = useState(false);

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

  // Listen for shortlist updates
  useEffect(() => {
    const handleShortlistUpdate = () => {
      const stored = localStorage.getItem('shortlistedProfiles');
      if (stored) {
        const profiles = JSON.parse(stored);
        setShortlistedProfiles(profiles);
      }
    };

    window.addEventListener('shortlistUpdated', handleShortlistUpdate);
    return () => window.removeEventListener('shortlistUpdated', handleShortlistUpdate);
  }, []);

  const toggleSelect = (index: number) => {
    const newSelected = new Set(selectedProfiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      if (newSelected.size >= 5) {
        alert('You can only select up to 5 candidates for bulk operations');
        return;
      }
      newSelected.add(index);
    }
    setSelectedProfiles(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAll = () => {
    if (selectedProfiles.size === Math.min(shortlistedProfiles.length, 5)) {
      setSelectedProfiles(new Set());
      setShowBulkActions(false);
    } else {
      const profilesToSelect = shortlistedProfiles.slice(0, 5);
      setSelectedProfiles(new Set(profilesToSelect.map((_, index) => index)));
      setShowBulkActions(true);
      if (shortlistedProfiles.length > 5) {
        alert('Only the first 5 candidates have been selected (bulk operations are limited to 5)');
      }
    }
  };

  const removeFromShortlist = (index: number) => {
    const updatedProfiles = shortlistedProfiles.filter((_, i) => i !== index);
    setShortlistedProfiles(updatedProfiles);
    localStorage.setItem('shortlistedProfiles', JSON.stringify(updatedProfiles));

    window.dispatchEvent(new CustomEvent('shortlistUpdated', {
      detail: { count: updatedProfiles.length }
    }));

    const newSelected = new Set(selectedProfiles);
    newSelected.delete(index);
    setSelectedProfiles(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const removeSelectedFromShortlist = () => {
    const updatedProfiles = shortlistedProfiles.filter((_, index) => !selectedProfiles.has(index));
    setShortlistedProfiles(updatedProfiles);
    localStorage.setItem('shortlistedProfiles', JSON.stringify(updatedProfiles));

    window.dispatchEvent(new CustomEvent('shortlistUpdated', {
      detail: { count: updatedProfiles.length }
    }));

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

  const handleSingleContactFetch = async (profile: Profile, index: number) => {
    const profileId = profile._id || profile.profile_id || `temp_${index}`;
    const name = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
    const currentRole = profile.title || profile.experience?.find((exp: any) => exp.current === 1)?.title;

    setContactFetchCandidates([{ id: profileId, name, currentRole }]);
    setContactFetchResults([]);
    setIsContactFetchModalOpen(true);
  };

  const handleBulkContactFetch = () => {
    const selectedProfilesList = Array.from(selectedProfiles)
      .map(index => {
        const profile = shortlistedProfiles[index];
        const profileId = profile._id || profile.profile_id || `temp_${index}`;
        const name = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
        const currentRole = profile.title || profile.experience?.find((exp: any) => exp.current === 1)?.title;

        return { id: profileId, name, currentRole };
      });

    setContactFetchCandidates(selectedProfilesList);
    setContactFetchResults([]);
    setIsContactFetchModalOpen(true);
  };

  const fetchContacts = async () => {
    setFetchingContacts(true);
    setContactFetchResults([]);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to fetch contact information');
        return;
      }

      const sessionId = `shortlist_${Date.now()}`;

      if (contactFetchCandidates.length === 1) {
        const result = await fetchSingleContact(
          contactFetchCandidates[0].id,
          sessionId,
          token
        );
        setContactFetchResults([result]);
      } else {
        const profileIds = contactFetchCandidates.map(c => c.id);
        const response = await fetchBulkContacts(profileIds, sessionId, token);
        setContactFetchResults(response.results);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      alert(`Failed to fetch contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFetchingContacts(false);
    }
  };

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-blue-500 to-cyan-500';
    if (score >= 40) return 'from-yellow-500 to-orange-500';
    return 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex flex-col overflow-hidden pl-64">
          <Header />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading shortlist...</p>
            </div>
          </div>
        </div>
        <Sidebar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 ml-64">


          <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-lg p-6 border-2 border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      Shortlisted Candidates
                    </h1>
                    <p className="text-gray-600">
                      {shortlistedProfiles.length} candidate{shortlistedProfiles.length !== 1 ? 's' : ''} in your shortlist
                    </p>
                  </div>

                  {shortlistedProfiles.length > 0 && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={selectAll}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-medium"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Select {shortlistedProfiles.length > 5 ? 'First 5' : 'All'}
                      </button>

                      {showBulkActions && (
                        <>
                          <button
                            onClick={handleBulkContactFetch}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                          >
                            <Zap className="w-4 h-4" />
                            Fetch Contacts ({selectedProfiles.size})
                          </button>

                          <button
                            onClick={removeSelectedFromShortlist}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                          >
                            <TrashIcon className="w-4 h-4" />
                            Remove Selected
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Content */}
            {shortlistedProfiles.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-gray-100"
              >
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Heart className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">No shortlisted candidates</h3>
                  <p className="text-gray-600 mb-8">
                    Start by searching for candidates and adding them to your shortlist.
                    Click the heart icon on any candidate card to add them here.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    <SparklesIcon className="w-5 h-5" />
                    Start Searching
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {shortlistedProfiles.map((profile, index) => {
                  const isSelected = selectedProfiles.has(index);
                  const score = profile.final_score || profile.pre_score || 0;
                  const isAIRanked = profile.final_score !== undefined && profile.summary;
                  const name = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
                  const title = profile.title || 'N/A';
                  const location = profile.location || 'N/A';
                  const industry = profile.industry || profile.current_industry || 'N/A';

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-white rounded-2xl border-2 p-6 transition-all ${isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(index)}
                          className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />

                        {/* Profile Content */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3
                                  onClick={() => openProfileModal(profile)}
                                  className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                >
                                  {name}
                                </h3>

                                {/* AI Ranked Badge */}
                                {isAIRanked && (
                                  <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                                    <Star className="w-3 h-3" />
                                    AI ANALYZED
                                  </div>
                                )}
                              </div>

                              <p className="text-gray-700 font-medium mb-2">{title}</p>

                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {location}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Building2 className="w-4 h-4" />
                                  {industry}
                                </div>
                              </div>

                              {profile.shortlistedAt && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Shortlisted on {new Date(profile.shortlistedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                              )}
                            </div>

                            {/* Score Badge */}
                            <div className={`ml-4 flex-shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r ${getScoreColor(score)} text-white shadow-lg`}>
                              <div className="text-center">
                                <div className="text-2xl font-bold">{score}</div>
                                <div className="text-xs opacity-90">
                                  {isAIRanked ? 'AI Score' : 'Score'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* AI Summary */}
                          {isAIRanked && profile.summary && profile.summary !== 'NA' && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                              <div className="flex items-start gap-2">
                                <SparklesIcon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {profile.summary}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="mt-4 flex items-center justify-between">
                            <button
                              onClick={() => openProfileModal(profile)}
                              className="flex items-center gap-2 text-blue-600 font-medium text-sm hover:gap-3 transition-all"
                            >
                              View Full Profile
                              <ChevronRight className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSingleContactFetch(profile, index)}
                                className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                              >
                                <Phone className="w-4 h-4" />
                                Get Contact
                              </button>
                              <button
                                onClick={() => removeFromShortlist(index)}
                                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                              >
                                <TrashIcon className="w-4 h-4" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        profile={selectedProfile}
        isOpen={isModalOpen}
        onClose={closeProfileModal}
      />

      {/* Contact Fetch Modal */}
      <ContactFetchModal
        isOpen={isContactFetchModalOpen}
        onClose={() => {
          setIsContactFetchModalOpen(false);
          setContactFetchCandidates([]);
          setContactFetchResults([]);
        }}
        candidates={contactFetchCandidates}
        results={contactFetchResults}
        loading={fetchingContacts}
        onFetch={fetchContacts}
      />
    </div>
  );
}