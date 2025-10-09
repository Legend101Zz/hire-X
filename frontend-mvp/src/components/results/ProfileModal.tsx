/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    X,
    MapPin,
    Building2,
    Briefcase,
    GraduationCap,
    Award,
    FileText,
    Linkedin,
    Mail,
    Phone,
    Download,
    Star,
    TrendingUp,
    Calendar,
    ExternalLink
} from 'lucide-react';
import ScoreExplanation from './ScoreExplanation';

interface ProfileModalProps {
    profile: any;
    onClose: () => void;
    sessionId: string;
}

export default function ProfileModal({ profile, onClose, sessionId }: ProfileModalProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'experience' | 'education'>('overview');
    const [fullProfile, setFullProfile] = useState<any>(profile);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch full profile details if not already loaded
        if (!profile.experience || profile.experience.length === 0 || profile.experience[0] === 'NA') {
            fetchFullProfile();
        }
    }, [profile]);

    const fetchFullProfile = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/profile/${profile.profile_id || profile._id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setFullProfile(data);
            }
        } catch (error) {
            console.error('Error fetching full profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const finalScore = fullProfile.final_score || fullProfile.pre_score || 0;
    const skills = fullProfile.expertise ? fullProfile.expertise.split(',') : [];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                                {fullProfile.first_name?.[0]}{fullProfile.last_name?.[0]}
                            </div>

                            {/* Info */}
                            <div>
                                <h2 className="text-2xl font-bold mb-1">
                                    {fullProfile.first_name} {fullProfile.last_name}
                                </h2>
                                <p className="text-blue-100 mb-3">{fullProfile.title}</p>

                                <div className="flex flex-wrap gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="w-4 h-4" />
                                        {fullProfile.location}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Building2 className="w-4 h-4" />
                                        {fullProfile.current_industry}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {/* Score Badge */}
                            <div className="bg-white text-gray-900 px-4 py-2 rounded-full font-bold text-xl">
                                {finalScore}
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-4">
                        {fullProfile.linkedin_url && (
                            <a
                                href={`https://linkedin.com${fullProfile.linkedin_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
                            >
                                <Linkedin className="w-4 h-4" />
                                LinkedIn
                            </a>
                        )}
                        <button className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Contact
                        </button>
                        <button className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 px-6">
                    <div className="flex gap-6">
                        {['overview', 'experience', 'education'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`py-4 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === tab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* AI Summary */}
                            {fullProfile.summary && (
                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="p-2 bg-blue-600 rounded-lg">
                                            <TrendingUp className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg text-gray-900">AI Analysis</h3>
                                            <p className="text-sm text-gray-600">Why this candidate is a good match</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-700 leading-relaxed">{fullProfile.summary}</p>
                                </div>
                            )}

                            {/* Score Explanation */}
                            <ScoreExplanation profile={fullProfile} />

                            {/* Skills */}
                            {skills.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Star className="w-5 h-5 text-blue-600" />
                                        Skills & Expertise
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.map((skill: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                                            >
                                                {skill.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recent Experience */}
                            {fullProfile.experience && fullProfile.experience.length > 0 && fullProfile.experience[0] !== 'NA' && (
                                <div>
                                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Briefcase className="w-5 h-5 text-blue-600" />
                                        Recent Experience
                                    </h3>
                                    <div className="space-y-4">
                                        {fullProfile.experience.slice(0, 2).map((exp: any, idx: number) => (
                                            <div key={idx} className="border-l-4 border-blue-600 pl-4">
                                                <h4 className="font-medium text-gray-900">{exp.title}</h4>
                                                <p className="text-gray-600">{exp.company}</p>
                                                {exp.location && (
                                                    <p className="text-sm text-gray-500">{exp.location}</p>
                                                )}
                                                {exp.startDate && (
                                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {exp.startDate} - {exp.endDate || 'Present'}
                                                    </div>
                                                )}
                                                {exp.summary && (
                                                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">{exp.summary}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'experience' && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-xl">Professional Experience</h3>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                                </div>
                            ) : fullProfile.experience && fullProfile.experience.length > 0 && fullProfile.experience[0] !== 'NA' ? (
                                <div className="space-y-6">
                                    {fullProfile.experience.map((exp: any, idx: number) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-6">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h4 className="font-semibold text-lg text-gray-900">{exp.title}</h4>
                                                    <p className="text-blue-600 font-medium">{exp.company}</p>
                                                </div>
                                                {exp.current && (
                                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                                        Current
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                                                {exp.location && (
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-4 h-4" />
                                                        {exp.location}
                                                    </div>
                                                )}
                                                {exp.startDate && (
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-4 h-4" />
                                                        {exp.startDate} - {exp.endDate || 'Present'}
                                                    </div>
                                                )}
                                                {exp.industry && (
                                                    <div className="flex items-center gap-1">
                                                        <Building2 className="w-4 h-4" />
                                                        {exp.industry}
                                                    </div>
                                                )}
                                            </div>

                                            {exp.summary && (
                                                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                                    {exp.summary}
                                                </p>
                                            )}

                                            {exp.companyUrl && (
                                                <a
                                                    href={exp.companyUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm mt-3"
                                                >
                                                    Company Website
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    No experience information available
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'education' && (
                        <div className="space-y-6">
                            <h3 className="font-semibold text-xl">Education</h3>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                                </div>
                            ) : fullProfile.education && fullProfile.education.length > 0 && fullProfile.education[0] !== 'NA' ? (
                                <div className="space-y-4">
                                    {fullProfile.education.map((edu: any, idx: number) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-6">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-blue-100 rounded-lg">
                                                    <GraduationCap className="w-6 h-6 text-blue-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-lg text-gray-900">{edu.major}</h4>
                                                    <p className="text-blue-600">{edu.campus}</p>
                                                    {edu.specialization && (
                                                        <p className="text-gray-600 text-sm mt-1">
                                                            Specialization: {edu.specialization}
                                                        </p>
                                                    )}
                                                    {edu.startDate && (
                                                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                                            <Calendar className="w-4 h-4" />
                                                            {edu.startDate} - {edu.endDate || 'Present'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    No education information available
                                </div>
                            )}

                            {/* Certifications */}
                            {fullProfile.certifications && fullProfile.certifications.length > 0 && fullProfile.certifications[0] !== 'NA' && (
                                <div className="mt-8">
                                    <h3 className="font-semibold text-xl mb-4">Certifications & Awards</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {fullProfile.certifications.map((cert: any, idx: number) => (
                                            <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-start gap-3">
                                                    <Award className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-1" />
                                                    <div>
                                                        <h4 className="font-medium text-gray-900">{cert.title || cert}</h4>
                                                        {cert.description && (
                                                            <p className="text-sm text-gray-600 mt-1">{cert.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            Profile ID: {fullProfile.profile_id || fullProfile._id}
                        </div>
                        <div className="flex gap-3">
                            <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors">
                                Save for Later
                            </button>
                            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Contact Candidate
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div >
        </motion.div >
    );
}