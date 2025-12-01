/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
"use client";

import { CheckCircle2, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { ResponseLikelihood } from "@/types";

interface ResponseCardProps {
  data: ResponseLikelihood;
}

export default function ResponseCard({ data }: ResponseCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getLabelColor = (label: string) => {
    if (label.includes("High")) return "success";
    if (label.includes("Moderate")) return "warning";
    return "outline";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          Response Likelihood
          <Badge
            variant={getLabelColor(data.likelihood_label) as any}
            className="ml-auto"
          >
            {data.likelihood_label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Overall Score
            </span>
            <span
              className={`text-2xl font-bold ${getScoreColor(data.overall_score)}`}
            >
              {data.overall_score}%
            </span>
          </div>
          <Progress value={data.overall_score} className="h-2" />
        </div>

        <Separator />

        {/* Factors */}
        <div>
          <p className="text-sm font-medium mb-3">Key Factors</p>
          <div className="space-y-2">
            {data.factors.map((factor, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {factor.factor}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {factor.weight}%
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {factor.score}/10
                    </Badge>
                  </div>
                </div>
                <Progress
                  value={(factor.score / 10) * 100}
                  className="h-1.5"
                />
                {factor.notes && (
                  <p className="text-xs text-muted-foreground italic">
                    {factor.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Recommended Approach */}
        <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Recommended Approach
          </p>
          <p className="text-sm text-muted-foreground">
            {data.recommended_approach}
          </p>
        </div>

        {/* Best Contact Time */}
        <div className="grid grid-cols-2 gap-4">
          {data.estimated_response_time && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Response Time</p>
                <p className="text-sm font-medium">
                  {data.estimated_response_time}
                </p>
              </div>
            </div>
          )}
          {data.best_contact_time && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Best Time</p>
                <p className="text-sm font-medium">{data.best_contact_time}</p>
              </div>
            </div>
          )}
        </div>

        {data.best_contact_days && data.best_contact_days.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Best Days</p>
            <div className="flex flex-wrap gap-2">
              {data.best_contact_days.map((day, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {day}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
