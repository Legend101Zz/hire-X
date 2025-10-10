/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, MapPin, Building2, Mail, Phone, Linkedin, Award, Briefcase, GraduationCap } from 'lucide-react';

interface ProfileDetailModalProps {
    profileId: string;
    onClose: () => void;
}

export default function ProfileDetailModal({ profileId, onClose }: ProfileDetailModalProps) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfileDetails();
    }, [profileId]);

    const fetchProfileDetails = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v2/profile/${profileId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setProfile(data);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                {loading ? (
                                    <div className="h-8 w-48 bg-white/20 rounded animate-pulse" />
                                ) : (
                                    <>
                                        <h2 className="text-3xl font-bold mb-2">
                                            {profile?.first_name} {profile?.last_name}
                                        </h2>
                                        <p className="text-blue-100 text-lg">{profile?.title}</p>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : profile ? (
                            <div className="space-y-6">
                                {/* Quick Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoCard icon={<MapPin />} label="Location" value={profile.location || 'N/A'} />
                                    <InfoCard icon={<Building2 />} label="Industry" value={profile.current_industry || 'N/A'} />
                                    <InfoCard icon={<Award />} label="Seniority" value={profile.seniority_level || 'N/A'} />
                                    <InfoCard icon={<Briefcase />} label="Functional Area" value={profile.functional_area || 'N/A'} />
                                </div>

                                {/* Skills */}
                                {profile.expertise && profile.expertise !== 'NA' && (
                                    <Section title="Skills & Expertise">
                                        <div className="flex flex-wrap gap-2">
                                            {profile.expertise.split(',').map((skill: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
                                                >
                                                    {skill.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* Experience */}
                                {profile.experience && Array.isArray(profile.experience) && profile.experience.length > 0 && profile.experience[0] !== 'NA' && (
                                    <Section title="Experience">
                                        <div className="space-y-4">
                                            {profile.experience.map((exp: any, idx: number) => (
                                                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                                                    <h4 className="font-semibold text-gray-900">{exp.title || exp.role}</h4>
                                                    <p className="text-gray-600">{exp.company}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {exp.start_date} - {exp.end_date || 'Present'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* Education */}
                                {profile.education && Array.isArray(profile.education) && profile.education.length > 0 && (
                                    <Section title="Education">
                                        <div className="space-y-4">
                                            {profile.education.map((edu: any, idx: number) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    <GraduationCap className="w-5 h-5 text-gray-400 mt-1" />
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900">{edu.major || edu.degree}</h4>
                                                        <p className="text-gray-600">{edu.campus || edu.institution}</p>
                                                        {edu.specialization && <p className="text-sm text-gray-500">{edu.specialization}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* LinkedIn */}
                                {profile.linkedin_url && profile.linkedin_url !== 'NA' && (
                                    <div className="pt-4 border-t">
                                        <a
                                            href={`https://linkedin.com${profile.linkedin_url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <Linkedin className="w-5 h-5" />
                                            View LinkedIn Profile
                                        </a>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-600">Profile not found</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div >
        </AnimatePresence >
    );
}

function InfoCard({ icon, label, value }: any) {
    return (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
                <div className="text-gray-400">{icon}</div>
                <div>
                    <div className="text-xs text-gray-500 font-medium">{label}</div>
                    <div className="text-sm font-semibold text-gray-900">{value}</div>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: any) {
    return (
        <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
            {children}
        </div>
    );
}