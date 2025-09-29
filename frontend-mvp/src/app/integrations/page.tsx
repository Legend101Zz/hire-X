'use client';

import { useState } from 'react';
import Sidebar from '@/components/ui/sidebar';
import Header from '@/components/ui/header';
import { 
  Cloud, 
  Linkedin, 
  HardDrive, 
  CheckCircle, 
  ExternalLink,
  Zap,
  Shield,
  Clock
} from 'lucide-react';

interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  isConnected: boolean;
  features: string[];
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationApp[]>([
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Access and sync files from your Google Drive account',
      icon: <Cloud className="w-8 h-8" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      isConnected: false,
      features: ['File sync', 'Document access', 'Real-time updates']
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Import data like contacts and profile data from LinkedIn',
      icon: <Linkedin className="w-8 h-8" />,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      isConnected: false,
      features: ['Contact import', 'Profile data', 'Network insights']
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      description: 'Connect your Microsoft OneDrive for seamless file management',
      icon: <HardDrive className="w-8 h-8" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      isConnected: false,
      features: ['Cloud storage', 'File sharing', 'Collaboration']
    }
  ]);

  const handleIntegrate = (appId: string) => {
    setIntegrations(prev => 
      prev.map(app => 
        app.id === appId 
          ? { ...app, isConnected: true }
          : app
      )
    );
    
    // Simulate integration process
    setTimeout(() => {
      alert(`${integrations.find(app => app.id === appId)?.name} integration initiated!`);
    }, 500);
  };

  const handleDisconnect = (appId: string) => {
    setIntegrations(prev => 
      prev.map(app => 
        app.id === appId 
          ? { ...app, isConnected: false }
          : app
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col overflow-hidden pl-64">
        <Header />
        <div className="flex-1 bg-white">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Integrations (Coming Soon)</h1>
                <p className="text-gray-600 mt-1">
                  Connect your favorite apps to streamline your workflow
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Zap className="w-4 h-4" />
                <span>{integrations.filter(app => app.isConnected).length} connected</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Benefits Section */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg">
                  <Shield className="w-6 h-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-green-900">Secure</h3>
                    <p className="text-sm text-green-700">All integrations use OAuth 2.0 for secure authentication</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
                  <Zap className="w-6 h-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-blue-900">Fast</h3>
                    <p className="text-sm text-blue-700">Real-time data sync and instant updates</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg">
                  <Clock className="w-6 h-6 text-purple-600 mt-1" />
                  <div>
                    <h3 className="font-medium text-purple-900">Reliable</h3>
                    <p className="text-sm text-purple-700">99.9% uptime with automatic failover</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Integration Apps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.map((app) => (
                <div 
                  key={app.id}
                  className={`border rounded-xl p-6 transition-all duration-200 hover:shadow-lg ${
                    app.isConnected 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* App Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${app.bgColor}`}>
                      <div className={app.color}>
                        {app.icon}
                      </div>
                    </div>
                    {app.isConnected && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    )}
                  </div>

                  {/* App Info */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {app.name}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Features:</h4>
                    <ul className="space-y-1">
                      {app.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="flex space-x-2">
                    {app.isConnected ? (
                      <>
                        <button
                          onClick={() => handleDisconnect(app.id)}
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Disconnect
                        </button>
                        <button className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Manage
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleIntegrate(app.id)}
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
                      >
                        Integrate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Coming Soon Section */}
            <div className="mt-12">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Coming Soon</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['Slack', 'Notion', 'Airtable', 'HubSpot'].map((app) => (
                  <div 
                    key={app}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50 opacity-60"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                        <div className="w-6 h-6 bg-gray-300 rounded"></div>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-700">{app}</h3>
                        <p className="text-xs text-gray-500">Coming soon</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Sidebar />
    </div>
  );
}
