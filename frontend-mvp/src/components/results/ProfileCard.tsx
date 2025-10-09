/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { motion } from 'framer-motion';
import {
    MapPin,
    Briefcase,
    Building2,
    TrendingUp,
    Eye,
    Linkedin
} from 'lucide-react';

interface ProfileCardProps {
    profile: any;
    rank: number;
    onClick: () => void;
}

export default function ProfileCard({ profile, rank, onClick }: ProfileCardProps) {
    const finalScore = profile.final_score || profile.pre_score || 0;
    const hasSummary = !!profile.summary;

    // Score color based on value
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-blue-600 bg-blue-100';
        if (score >= 40) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    // Extract skills from expertise string
    const skills = profile.expertise
        ? profile.expertise.split(',').slice(0, 5)
        : [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.05 }}
            onClick={onClick}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden"
        >
            {/* Rank Badge */}
            {rank <= 3 && (
                <div className="absolute top-4 right-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        rank === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                            'bg-gradient-to-br from-orange-400 to-orange-600'
                        }`}>
                        #{rank}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
                {/* Avatar */}
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {profile.first_name?.[0]}{profile.last_name?.[0]}
                </div>

                {/* Name & Title */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {profile.first_name} {profile.last_name}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                        {profile.title || 'N/A'}
                    </p>
                </div>

                {/* Score Badge */}
                <div className={`px-4 py-2 rounded-full font-bold text-lg ${getScoreColor(finalScore)}`}>
                    {finalScore}
                </div>
            </div>

            {/* Details */}
            <div className="space-y-2 mb-4">
                {/* Location */}
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{profile.location || 'Location not specified'}</span>
                </div>

                {/* Industry */}
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{profile.current_industry || 'Industry not specified'}</span>
                </div>

                {/* Experience (if available) */}
                {profile.experience && profile.experience.length > 0 && profile.experience[0].company && (
                    <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <Briefcase className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                            {profile.experience[0].title} at {profile.experience[0].company}
                        </span>
                    </div>
                )}
            </div>

            {/* AI Summary */}
            {hasSummary && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-xs font-semibold text-blue-900 uppercase">AI Analysis</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">
                        {profile.summary}
                    </p>
                </div>
            )}

            {/* Skills Tags */}
            {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {skills.map((skill: string, idx: number) => (
                        <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                            {skill.trim()}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium group-hover:translate-x-1 transition-transform"
                >
                    <Eye className="w-4 h-4" />
                    View Full Profile
                </button>

                <div className="flex gap-2">
                    {profile.linkedin_url && (
                        <a
                            href={`https://linkedin.com${profile.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                            <Linkedin className="w-4 h-4 text-blue-600" />
                        </a>
                    )}
                </div>
            </div>

            {/* Loading indicator for profiles without summary */}
            {
                !hasSummary && profile.pre_score && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                        <motion.div
                            className="h-full bg-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    </div>
                )
            }
        </motion.div >
    );
}