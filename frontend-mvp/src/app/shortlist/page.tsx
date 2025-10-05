'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/ui/sidebar';
import Header from '@/components/ui/header';
import ProfileModal from '@/components/ui/profile-modal';
import ContactFetchModal from '@/components/ui/contact-fetch-modal';
import { SparklesIcon, TrashIcon, CheckIcon, MessageCircle, Phone, Users, Zap } from 'lucide-react';
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

  // Listen for storage changes
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
      // Limit to 5 selections for bulk operations
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
    if (selectedProfiles.size === shortlistedProfiles.length) {
      setSelectedProfiles(new Set());
      setShowBulkActions(false);
    } else {
      // Select up to 5 profiles
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

  // Handle single candidate contact fetch
  const handleSingleContactFetch = async (profile: Profile, index: number) => {
    const profileId = profile._id || profile.sessionId || `temp_${index}`;
    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
    const currentRole = profile.experience?.find(exp => exp.current === 1)?.title || profile.title;

    setContactFetchCandidates([{ id: profileId, name, currentRole }]);
    setContactFetchResults([]);
    setIsContactFetchModalOpen(true);
  };

  // Handle bulk contact fetch
  const handleBulkContactFetch = () => {
    const selectedProfilesList = Array.from(selectedProfiles)
      .map(index => {
        const profile = shortlistedProfiles[index];
        const profileId = profile._id || profile.sessionId || `temp_${index}`;
        const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown';
        const currentRole = profile.experience?.find(exp => exp.current === 1)?.title || profile.title;

        return { id: profileId, name, currentRole };
      });

    setContactFetchCandidates(selectedProfilesList);
    setContactFetchResults([]);
    setIsContactFetchModalOpen(true);
  };

  // Fetch contacts from API
  const fetchContacts = async () => {
    setFetchingContacts(true);
    setContactFetchResults([]);

    try {
      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to fetch contact information');
        return;
      }

      // Generate session ID
      const sessionId = `shortlist_${Date.now()}`;

      if (contactFetchCandidates.length === 1) {
        // Single contact fetch
        const result = await fetchSingleContact(
          contactFetchCandidates[0].id,
          sessionId,
          token
        );
        setContactFetchResults([result]);
      } else {
        // Bulk contact fetch
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
                      checked={selectedProfiles.size === Math.min(shortlistedProfiles.length, 5)}
                      onChange={selectAll}
                      className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">
                      Select {shortlistedProfiles.length > 5 ? 'First 5' : 'All'}
                    </span>
                  </label>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {/* Bulk Fetch Contacts Button */}
                {showBulkActions && (
                  <button
                    onClick={handleBulkContactFetch}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Fetch Contacts ({selectedProfiles.size})
                  </button>
                )}

                {/* Bulk Remove */}
                {showBulkActions && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={removeSelectedFromShortlist}
                      className="flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
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
                    className={`border rounded-lg p-6 hover:shadow-md transition-all ${isSelected ? 'border-violet-300 bg-violet-50' : 'border-gray-200'
                      }`}
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
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3
                                className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-violet-600"
                                onClick={() => openProfileModal(profile)}
                              >
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
                                handleSingleContactFetch(profile, index);
                              }}
                              className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                              title="Fetch contact info"
                            >
                              <Phone className="w-4 h-4 mr-1" />
                              Get Contact
                            </button>
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
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="text-sm text-violet-700 leading-relaxed flex items-start">
                          <SparklesIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
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