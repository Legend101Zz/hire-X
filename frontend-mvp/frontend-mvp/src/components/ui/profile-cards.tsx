'use client';

import { useState, useEffect } from 'react';
import ProfileModal from './profile-modal';
import { SparklesIcon } from 'lucide-react';
import { Profile } from '@/types/profile';

interface ProfileCardsProps {
  profiles: Profile[];
}

export default function ProfileCards({ profiles }: ProfileCardsProps) {
  const [selectedProfiles, setSelectedProfiles] = useState<Set<number>>(new Set());
  const [shortlistedProfiles, setShortlistedProfiles] = useState<Set<number>>(new Set());
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check which profiles are already shortlisted when component loads
  useEffect(() => {
    const checkShortlistedProfiles = () => {
      try {
        const stored = localStorage.getItem('shortlistedProfiles');
        if (stored) {
          const shortlistedProfilesList = JSON.parse(stored);
          const shortlistedIds = new Set(shortlistedProfilesList.map((p: Profile) => p.organization_id));
          
          const shortlistedIndices = new Set<number>();
          profiles.forEach((profile, index) => {
            if (shortlistedIds.has(profile.organization_id)) {
              shortlistedIndices.add(index);
            }
          });
          
          setShortlistedProfiles(shortlistedIndices);
        }
      } catch (error) {
        console.error('Error checking shortlisted profiles:', error);
      }
    };

    checkShortlistedProfiles();
  }, [profiles]);

  const toggleSelect = (index: number) => {
    const newSelected = new Set(selectedProfiles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedProfiles(newSelected);
  };

  const toggleShortlist = (index: number) => {
    const newShortlisted = new Set(shortlistedProfiles);
    if (newShortlisted.has(index)) {
      newShortlisted.delete(index);
    } else {
      newShortlisted.add(index);
    }
    setShortlistedProfiles(newShortlisted);
    
    // Update localStorage with shortlisted profiles
    const profile = profiles[index];
    if (profile) {
      const stored = localStorage.getItem('shortlistedProfiles');
      let shortlistedProfilesList: Profile[] = stored ? JSON.parse(stored) : [];
      
      if (newShortlisted.has(index)) {
        // Add to shortlist
        const profileWithMetadata = {
          ...profile,
          shortlistedAt: new Date().toISOString(),
          sessionId: window.location.pathname.split('/').pop() // Get session ID from URL
        };
        shortlistedProfilesList.push(profileWithMetadata);
      } else {
        // Remove from shortlist
        shortlistedProfilesList = shortlistedProfilesList.filter(
          p => p.organization_id !== profile.organization_id
        );
      }
      
      localStorage.setItem('shortlistedProfiles', JSON.stringify(shortlistedProfilesList));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('shortlistUpdated', {
        detail: { count: shortlistedProfilesList.length }
      }));
    }
  };

  const selectAll = () => {
    if (selectedProfiles.size === profiles.length) {
      setSelectedProfiles(new Set());
    } else {
      setSelectedProfiles(new Set(profiles.map((_, index) => index)));
    }
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

  return (
    <div className="flex-1 bg-white">

      {/* Header with count and select all */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">All Profiles ({profiles.length})</h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedProfiles.size === profiles.length && profiles.length > 0}
                onChange={selectAll}
                className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
              />
              <span className="ml-2 text-sm text-gray-600">Select All</span>
            </label>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm text-gray-600">16 - 30 of {profiles.length}</span>
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Cards */}
      <div className="p-6 space-y-6">
        {profiles.map((profile, index) => {
          const isSelected = selectedProfiles.has(index);
          const isShortlisted = shortlistedProfiles.has(index);
          const currentRole = (profile.experience?.find(exp => exp.current === 1)?.title || profile.title || 'N/A').toString();
          const education = (profile.education?.[0]?.major || profile.education?.[0]?.campus || 'N/A').toString();
          const summary = profile.summary && profile.summary !== 'NA' ? profile.summary : 
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim() + 
            `'s has missing description, so no summary available for the profile`;

          return (
            <div 
              key={index} 
              className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
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
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleShortlist(index);
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          isShortlisted
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {isShortlisted ? 'Shortlisted' : 'Shortlist'}
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


      {/* Profile Modal */}
      <ProfileModal
        profile={selectedProfile}
        isOpen={isModalOpen}
        onClose={closeProfileModal}
      />
    </div>
  );
}