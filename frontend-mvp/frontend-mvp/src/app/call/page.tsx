'use client'

import React, { useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

const JobMatchingInterface = () => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectClick = () => {
    setIsConnecting(true);
  };

  const handleHangup = () => {
    setIsConnecting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl text-gray-900">neuraleap</h1>
                <span className="text-3xl text-purple-600">hire</span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="space-y-6">
              {/* Professional Profile */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg text-gray-900">Donna&apos;s Notebook</h2>
                  <div className="text-sm text-gray-500 flex items-center space-x-2">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Active</span>
                  </div>
                </div>
                <div className="text-sm text-gray-700 leading-relaxed">
                  <p className="mb-3">
                    You are a <span className="bg-yellow-200 font-medium">highly-driven engineer and hacker</span> with a passion for building fault injectors and kernel drivers &quot;because you can&quot;. You have experience in software development and are now looking to channel your intense intellectual drive into building the future of AI. You are a <span className="bg-yellow-200 font-medium">Senior Full Stack Engineer</span> who prefers <span className="bg-yellow-200 font-medium">backend-focused roles</span> with an aptitude for <span className="bg-yellow-200 font-medium">Golang and Python</span>.
                  </p>
                  
                  <p className="mb-3">
                    Spent 5 years at TechCorp building distributed systems. Led a team of 4 engineers on the fault injection framework - really impressive work. Said they built it because &quot;nobody else was doing it right&quot; and they wanted to test system resilience properly. Very passionate about system-level programming.
                  </p>
                  
                  <p className="mb-3">
                    Strong in Go, Python, Kubernetes, Docker. Has experience with PostgreSQL and Redis. Mentioned they&apos;ve contributed to several open source Go projects. Worked with AWS and GCP extensively. Seems to really understand the infrastructure side of things.
                  </p>
                  
                  <p className="mb-3">
                    Currently at a startup but looking for something more challenging. Expressed strong interest in AI/ML infrastructure roles - said they want to work on &quot;the hard problems&quot; that will shape the future. Available for immediate start, which is great.
                  </p>
                  
                  <p className="mb-3">
                    Previous call went well - showed deep technical knowledge and genuine enthusiasm. Asked thoughtful questions about our architecture and scaling challenges. Definitely someone we want to move forward with. Next step: technical deep-dive on distributed systems and maybe a system design question.
                  </p>
                  
                  <p className="mb-3">
                    Key things to explore: their fault injection framework design, how they approach debugging in distributed systems, experience with AI/ML infrastructure challenges, and what specifically motivates them about backend engineering. Also want to understand their leadership style since they mentioned leading a team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Fixed */}
      <div className="w-120 bg-white border-l border-gray-200 flex flex-col items-center justify-center p-6 sticky top-0 h-screen relative overflow-hidden">
        {/* Animated Background Glow Spots */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-8 w-16 h-16 bg-purple-200 rounded-full opacity-30 animate-pulse blur-sm" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
          <div className="absolute top-40 right-12 w-12 h-12 bg-purple-300 rounded-full opacity-25 animate-pulse blur-md" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
          <div className="absolute top-60 left-16 w-20 h-20 bg-purple-100 rounded-full opacity-40 animate-pulse blur-sm" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>
          <div className="absolute top-80 right-8 w-14 h-14 bg-purple-200 rounded-full opacity-35 animate-pulse blur-lg" style={{ animationDelay: '0.5s', animationDuration: '3.5s' }}></div>
          <div className="absolute top-32 left-12 w-10 h-10 bg-purple-300 rounded-full opacity-30 animate-pulse blur-sm" style={{ animationDelay: '1.5s', animationDuration: '4.5s' }}></div>
          <div className="absolute top-72 right-16 w-18 h-18 bg-purple-100 rounded-full opacity-25 animate-pulse blur-md" style={{ animationDelay: '2.5s', animationDuration: '6s' }}></div>
          <div className="absolute top-96 left-6 w-8 h-8 bg-purple-200 rounded-full opacity-40 animate-pulse blur-sm" style={{ animationDelay: '3s', animationDuration: '3.2s' }}></div>
          <div className="absolute top-48 right-6 w-22 h-22 bg-purple-300 rounded-full opacity-20 animate-pulse blur-lg" style={{ animationDelay: '1.2s', animationDuration: '5.5s' }}></div>
        </div>
        
        <div className="text-center mb-8 relative z-10">
          <h2 className="text-2xl text-gray-900 mb-2">Sync-up with Donna Paulsen</h2>
          <p className="text-gray-600">Executive Assistant to Harvey Specter</p>
        </div>

        {/* Profile Circle */}
        <div className="w-32 h-32 mb-8 flex items-center justify-center relative z-10">
          {/* Outer Glowing Ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 via-purple-700 to-purple-600 opacity-50 animate-spin" style={{ animationDuration: '8s' }}>
            <div className="absolute inset-1 rounded-full bg-white"></div>
          </div>
          
          {/* Middle Ring */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 opacity-60 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}>
            <div className="absolute inset-1 rounded-full bg-white"></div>
          </div>
          
          {/* Inner Ring */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-r from-purple-400 via-purple-500 to-purple-400 opacity-70 animate-spin" style={{ animationDuration: '4s' }}>
            <div className="absolute inset-1 rounded-full bg-white"></div>
          </div>
          
          {/* Center Circle */}
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center shadow-lg">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-purple-700 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="mb-6 relative z-10">
          <span className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm">Ready</span>
        </div>

        {/* Connect Button or Call Controls */}
        <div className="relative z-10">
          {!isConnecting ? (
            <button
              onClick={handleConnectClick}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-full flex items-center space-x-2 transition-colors duration-200 shadow-lg"
            >
              <span className="font-medium">Connect with Donna</span>
            </button>
          ) : (
            <div className="flex space-x-4">
              <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-full flex items-center space-x-2 transition-colors duration-200 shadow-lg">
                <Phone className="w-5 h-5" />
                <span className="font-medium">Answer</span>
              </button>
              <button
                onClick={handleHangup}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full flex items-center space-x-2 transition-colors duration-200 shadow-lg"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="font-medium">Hang up</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobMatchingInterface;