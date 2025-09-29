'use client';

import Link from 'next/link';

interface HeaderProps {
  className?: string;
}

export default function Header({ className = '' }: HeaderProps) {

  const navigationTabs = [
    { name: 'Search', href: '/', isActive: true },
    // { name: 'Autopilot', href: '#', isActive: false },
    // { name: 'Insights', href: '#', isActive: false },
  ];

  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - App name and tabs */}
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl text-gray-900">neuraleap hire</h1>
            
            {/* Navigation tabs */}
            <nav className="flex space-x-1">
              {navigationTabs.map((tab) => (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    tab.isActive
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-4">
            <button className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Share
            </button>
            
            <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              New Search
              <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
