"use client";

import { TrendingUp, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { SalaryEnrichment } from "@/types";

interface SalaryCardProps {
  data: SalaryEnrichment;
}

export default function SalaryCard({ data }: SalaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Salary Progression
          <Badge variant="secondary" className="ml-auto">
            {data.confidence_score}% Confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Salary */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Current Estimated CTC
            </span>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-green-500">
            ₹{data.current_estimated_ctc}L
          </p>
        </div>

        <Separator />

        {/* Growth Trajectory */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Growth Trajectory
          </p>
          <p className="text-sm font-medium">{data.growth_trajectory}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Average annual growth: {data.average_annual_growth}
          </p>
        </div>

        {/* Career Progression */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Career Progression
          </p>
          <div className="space-y-3">
            {data.career_progression.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-muted/30 border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.role}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.company} • {item.duration}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.experience_level}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-500">
                    ₹{item.estimated_ctc_range}L
                  </span>
                </div>
                {item.rationale && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {item.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Next Expected Range */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground mb-1">
            Next Expected Range
          </p>
          <p className="text-xl font-bold text-primary">
            ₹{data.next_expected_range}L
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
