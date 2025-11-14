"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Briefcase, MapPin, Building, Award } from "lucide-react";

interface SampleProfile {
    profile_id: string;
    name: string;
    title: string;
    skills: string[];
    experience_years: number;
    current_company: string;
    location: string;
    industry: string;
    match_score: number;
}

interface SampleProfileDisplayProps {
    profile: SampleProfile | null;
    isLoading?: boolean;
}

export default function SampleProfileDisplay({
    profile,
    isLoading = false,
}: SampleProfileDisplayProps) {
    if (isLoading) {
        return (
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm p-6">
                <div className="space-y-4">
                    <Skeleton className="h-4 w-32 bg-gray-800" />
                    <Skeleton className="h-20 w-full bg-gray-800" />
                    <Skeleton className="h-16 w-full bg-gray-800" />
                </div>
            </Card>
        );
    }

    if (!profile) {
        return (
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm p-6 text-center">
                <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                    No sample profile yet. Keep chatting with Donna!
                </p>
            </Card>
        );
    }

    return (
        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm overflow-hidden">
            {/* Header with Match Score */}
            <div className="bg-gradient-to-r from-violet-600/20 to-purple-600/20 p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Sample Profile</h3>
                    <Badge className="bg-violet-600 text-white">
                        {profile.match_score}% Match
                    </Badge>
                </div>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-4">
                {/* Name & Title */}
                <div>
                    <h4 className="text-lg font-semibold text-white mb-1">
                        {profile.name}
                    </h4>
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        {profile.title}
                    </p>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Building className="w-4 h-4" />
                        <span>{profile.current_company}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <Award className="w-4 h-4" />
                        <span>{profile.experience_years} years experience</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="w-4 h-4" />
                        <span>{profile.location}</span>
                    </div>
                </div>

                {/* Skills */}
                {profile.skills.length > 0 && (
                    <div>
                        <p className="text-xs text-gray-400 mb-2">Top Skills</p>
                        <div className="flex flex-wrap gap-2">
                            {profile.skills.slice(0, 6).map((skill, index) => (
                                <Badge
                                    key={index}
                                    variant="secondary"
                                    className="bg-gray-800 text-gray-300 border-gray-700"
                                >
                                    {skill}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}