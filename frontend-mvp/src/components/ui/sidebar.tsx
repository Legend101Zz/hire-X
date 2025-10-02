'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  className?: string;
}

interface PromptHistoryItem {
  prompt_id: string;
  session_id: string;
  prompt: string;
  created_at: string;
}

// Support Popup Component
interface SupportPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

function SupportPopup({ isOpen, onClose }: SupportPopupProps) {
  if (!isOpen) return null;

  const contacts = [
    {
      name: 'Aditya Patil',
      role: 'Techical Co-Founder',
      phone: '+91 7400321092', // Replace with actual phone number
      email: 'adityapatil24680@gmail.com', // Replace with actual email
      primary: true
    },
    {
      name: 'Mrigesh Thakur',
      role: 'Techical Co-Founder',
      phone: '+91 96198 29501', // Replace with actual phone number
      email: 'rohan@neuraleap.co' // Replace with actual email
    },
    {
      name: 'Rohan Lodha',
      role: 'CEO & Co-Founder',
      phone: '+91 96198 29501', // Replace with actual phone number
      email: 'rohan@neuraleap.co' // Replace with actual email
    }
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-transparent z-50"
        onClick={onClose}
      />

      {/* Popup */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Got Tech Trouble?</h2>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Support Message */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 leading-relaxed">
                <span className="font-medium">If something breaks (or even just looks at you funny), call Aditya Patil or Mrigesh. They&apos;s basically our 24/7 superheros for all things technical. Can&apos;t reach them? (That&apos;s about as rare as spotting a unicorn). In that case, call Rohan, our big superhero, cape included.</span>
              </p>
            </div>

            {/* Contact Cards */}
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div
                  key={contact.name}
                  className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${contact.primary
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-gray-200 bg-gray-50'
                    }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                      <p className="text-sm text-gray-600">{contact.role}</p>
                    </div>
                    {contact.primary && (
                      <span className="px-2 py-1 text-xs bg-violet-100 text-violet-700 rounded-full font-medium">
                        Primary Contact
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Phone */}
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center text-sm text-gray-700 hover:text-violet-600 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      {contact.phone}
                    </a>

                    {/* Email */}
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center text-sm text-gray-700 hover:text-violet-600 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      {contact.email}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                We&apos;re here to help you succeed. Don&apos;t hesitate to reach out!
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [shortlistCount, setShortlistCount] = useState(0);
  const [isSupportPopupOpen, setIsSupportPopupOpen] = useState(false);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [mostRecentSessionId, setMostRecentSessionId] = useState<string | null>(null);
  const { user } = useAuth();

  // Load shortlist count from localStorage
  useEffect(() => {
    const loadShortlistCount = () => {
      try {
        const stored = localStorage.getItem('shortlistedProfiles');
        if (stored) {
          const profiles = JSON.parse(stored);
          setShortlistCount(profiles.length);
        }
      } catch (error) {
        console.error('Error loading shortlist count:', error);
      }
    };

    loadShortlistCount();

    // Listen for shortlist updates
    const handleShortlistUpdate = (event: CustomEvent) => {
      setShortlistCount(event.detail.count);
    };

    window.addEventListener('shortlistUpdated', handleShortlistUpdate as EventListener);
    return () => window.removeEventListener('shortlistUpdated', handleShortlistUpdate as EventListener);
  }, []);

  // Load prompt history
  useEffect(() => {
    const loadPromptHistory = async () => {
      if (!user) return;

      setIsLoadingHistory(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${apiBaseUrl}/user/prompt-history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Full API response:', data);
          const prompts = data.prompts || [];
          console.log('Loaded prompts:', prompts);
          console.log('First prompt:', prompts[0]);
          setPromptHistory(prompts);

          // Set the most recent session ID for the Profiles link
          if (prompts.length > 0 && prompts[0].session_id) {
            console.log('Setting most recent session ID to:', prompts[0].session_id);
            setMostRecentSessionId(prompts[0].session_id);
          } else {
            console.log('No prompts found or no session_id in first prompt');
          }
        } else {
          const errorText = await response.text();
          console.error('Failed to load prompt history:', response.status, errorText);
        }
      } catch (error) {
        console.error('Error loading prompt history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadPromptHistory();
  }, [user]);

  // Debug log
  console.log('Current mostRecentSessionId:', mostRecentSessionId);
  console.log('Profiles href will be:', mostRecentSessionId ? `/results/${mostRecentSessionId}` : '/');

  const navigationItems = [
    {
      name: 'Profiles',
      href: mostRecentSessionId ? `/results/${mostRecentSessionId}` : '/profiles',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
      badge: null,
      isActive: mostRecentSessionId ? pathname === `/results/${mostRecentSessionId}` : false,
      editIcon: false,
    },
    {
      name: 'Shortlist',
      href: '/shortlist',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      badge: shortlistCount > 0 ? shortlistCount.toString() : null,
      isActive: pathname === '/shortlist',
      editIcon: false,
    },
    {
      name: 'Contacts',
      href: '/contacts',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
      badge: null,
      isActive: false,
      editIcon: false,
    },
    {
      name: 'Sequences',
      href: '/sequences',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
        </svg>
      ),
      badge: null,
      isActive: false,
      editIcon: false,
    },
    {
      name: 'Usage',
      href: '/usage',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
      badge: null,
      isActive: false,
      editIcon: false,
    },
    {
      name: 'Integrations',
      href: '/integrations',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
      ),
      badge: null,
      isActive: pathname === '/integrations',
      editIcon: false,
    },
  ];

  return (
    <div className={`fixed left-0 top-0 bg-white border-r border-gray-200 w-64 flex-shrink-0 flex flex-col h-screen z-30 ${className}`}>
      {/* Top Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
          </svg>
          <span>All Projects</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <span>All Agents</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 overflow-y-auto">
        <nav className="space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${item.isActive
                ? 'bg-violet-50 text-violet-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <div className="flex items-center">
                <span className={`mr-3 ${item.isActive ? 'text-violet-600' : 'text-gray-400'}`}>
                  {item.icon}
                </span>
                {item.name}
                {item.badge && (
                  <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              {item.editIcon && (
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              )}
            </Link>
          ))}
        </nav>

        {/* Separator Line */}
        <div className="my-4 border-t border-gray-200"></div>

        {/* History Section */}
        <div>
          <div className="px-3 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">History</h3>
          </div>
          <div className="space-y-1">
            {isLoadingHistory ? (
              <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
            ) : promptHistory.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No search history yet</div>
            ) : (
              promptHistory.map((item) => (
                <button
                  key={item.prompt_id}
                  onClick={() => router.push(`/results/${item.session_id}`)}
                  className="w-full text-left px-3 py-2 rounded-md text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  title={item.prompt}
                >
                  <div className="truncate">
                    {item.prompt.length > 50 ? `${item.prompt.substring(0, 50)}...` : item.prompt}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Settings & Support */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-4 text-sm">
          <Link href="/settings" className="flex items-center text-gray-600 hover:text-gray-900">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Settings
          </Link>
          <button
            onClick={() => setIsSupportPopupOpen(true)}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            Support
          </button>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
            </span>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">{user?.username || 'User'}</div>
            <div className="text-xs text-gray-500">{user?.email || 'No email'}</div>
          </div>
        </div>
      </div>

      {/* Support Popup */}
      <SupportPopup
        isOpen={isSupportPopupOpen}
        onClose={() => setIsSupportPopupOpen(false)}
      />
    </div>
  );
}
