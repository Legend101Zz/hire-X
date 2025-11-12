"use client";

import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { SkillValidation } from "@/types";

interface SkillsCardProps {
  data: SkillValidation;
}

export default function SkillsCard({ data }: SkillsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-purple-500" />
          Skill Validation
          <Badge variant="secondary" className="ml-auto">
            {data.overall_confidence}% Confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validated Skills */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <p className="text-sm font-medium">
              Validated Skills ({data.validated_skills.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.validated_skills.map((skill, idx) => (
              <Badge key={idx} variant="success" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        {/* Unvalidated Skills */}
        {data.unvalidated_skills.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  Unvalidated Skills ({data.unvalidated_skills.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.unvalidated_skills.map((skill, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Evidence */}
        <div>
          <p className="text-sm font-medium mb-3">
            Evidence ({data.evidence.length} sources)
          </p>
          <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
            {data.evidence.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-muted/30 border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{item.skill}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.evidence_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {item.confidence}/10
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  asChild
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
