"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  Heart,
  Linkedin,
  Github,
  Mail,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, getInitials } from "@/lib/utils";
import type { EnrichedCandidate } from "@/types";

interface EnrichedCandidateCardProps {
  candidate: EnrichedCandidate;
  onViewDetails: () => void;
  onShortlist?: () => void;
  isShortlisted?: boolean;
}

export default function EnrichedCandidateCard({
  candidate,
  onViewDetails,
  onShortlist,
  isShortlisted = false,
}: EnrichedCandidateCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get match label color
  const getMatchColor = (label: string) => {
    switch (label) {
      case "Excellent Match":
        return "success";
      case "Great Match":
        return "default";
      case "Good Match":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Get response likelihood color
  const getResponseColor = (label?: string) => {
    if (!label) return "outline";
    switch (label) {
      case "Very High":
      case "High":
        return "success";
      case "Moderate":
        return "warning";
      default:
        return "outline";
    }
  };

  const fullName = `${candidate.first_name} ${candidate.last_name}`;
  const initials = getInitials(fullName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-300 hover:shadow-xl",
          isHovered && "border-primary/50 ring-2 ring-primary/10"
        )}
        onClick={onViewDetails}
      >
        <CardHeader className="pb-4">
          {/* Header with Avatar and Basic Info */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-400 flex items-center justify-center text-white font-bold text-xl">
                {initials}
              </div>
            </div>

            {/* Name and Title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-semibold truncate group-hover:text-primary transition-colors">
                    {fullName}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {candidate.title}
                  </p>
                  {candidate.company && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Briefcase className="w-3 h-3" />
                      {candidate.company}
                    </p>
                  )}
                </div>
                {/* Shortlist Button */}
                {onShortlist && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShortlist();
                    }}
                    className={cn(
                      "flex-shrink-0",
                      isShortlisted && "text-red-500 hover:text-red-600"
                    )}
                  >
                    <Heart
                      className={cn(
                        "w-5 h-5",
                        isShortlisted && "fill-current"
                      )}
                    />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Location and Match Score */}
          <div className="flex items-center justify-between mt-3 gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{candidate.location}</span>
            </div>
            <Badge variant={getMatchColor(candidate.match_label) as any}>
              {candidate.match_label}
            </Badge>
          </div>

          {/* Match Score Progress */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Match Score</span>
              <span className="font-semibold">{candidate.match_score}%</span>
            </div>
            <Progress value={candidate.match_score} className="h-1.5" />
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="py-4 space-y-4">
          {/* Match Reason */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              Why this candidate?
            </p>
            <p className="text-sm leading-relaxed line-clamp-2">
              {candidate.match_reason}
            </p>
          </div>

          {/* Enrichment Data */}
          <div className="grid grid-cols-2 gap-3">
            {/* Salary */}
            {candidate.salary_enrichment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-help">
                    <TrendingUp className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Est. CTC
                      </p>
                      <p className="text-sm font-semibold truncate">
                        ₹{candidate.salary_enrichment.current_estimated_ctc}L
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    <span className="font-semibold">Growth:</span>{" "}
                    {candidate.salary_enrichment.growth_trajectory}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-semibold">Confidence:</span>{" "}
                    {candidate.salary_enrichment.confidence_score}%
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Response Likelihood */}
            {candidate.response_likelihood && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-help">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Response
                      </p>
                      <p className="text-sm font-semibold truncate">
                        {candidate.response_likelihood.likelihood_label}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    <span className="font-semibold">Score:</span>{" "}
                    {candidate.response_likelihood.overall_score}%
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-semibold">Best time:</span>{" "}
                    {candidate.response_likelihood.best_contact_time || "N/A"}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Skill Validation */}
            {candidate.skill_validation && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-help col-span-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        Validated Skills
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {candidate.skill_validation.validated_skills
                          .slice(0, 3)
                          .map((skill, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs"
                            >
                              {skill}
                            </Badge>
                          ))}
                        {candidate.skill_validation.validated_skills.length >
                          3 && (
                          <Badge variant="outline" className="text-xs">
                            +
                            {candidate.skill_validation.validated_skills
                              .length - 3}{" "}
                            more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    <span className="font-semibold">Confidence:</span>{" "}
                    {candidate.skill_validation.overall_confidence}%
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-semibold">Evidence:</span>{" "}
                    {candidate.skill_validation.evidence.length} sources
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Availability */}
            {candidate.availability && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-help col-span-2">
                    <Briefcase className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Availability
                      </p>
                      <p className="text-sm font-semibold">
                        {candidate.availability.notice_period}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    {candidate.availability.estimated_availability}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardContent>

        <Separator />

        <CardFooter className="pt-4 flex items-center justify-between">
          {/* Contact Links */}
          <div className="flex items-center gap-2">
            {candidate.linkedin_url && (
              <Button
                size="icon"
                variant="ghost"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              </Button>
            )}
            {candidate.email && (
              <Button
                size="icon"
                variant="ghost"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a href={`mailto:${candidate.email}`}>
                  <Mail className="w-4 h-4" />
                </a>
              </Button>
            )}
            {candidate.phone && (
              <Button
                size="icon"
                variant="ghost"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a href={`tel:${candidate.phone}`}>
                  <Phone className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>

          {/* View Details Button */}
          <Button variant="outline" size="sm" className="gap-2">
            View Details
            <ExternalLink className="w-3 h-3" />
          </Button>
        </CardFooter>

        {/* Enrichment Status Badge */}
        <div className="absolute top-4 right-4">
          {candidate.enrichment_status === "completed" && (
            <Badge
              variant="success"
              className="text-xs gap-1 shadow-lg"
            >
              <CheckCircle2 className="w-3 h-3" />
              Enriched
            </Badge>
          )}
          {candidate.enrichment_status === "in_progress" && (
            <Badge variant="secondary" className="text-xs animate-pulse">
              Processing...
            </Badge>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
