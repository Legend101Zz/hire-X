import { DeepDiveResult, MatchAnalysis } from "@/types/deep-dive";

/**
 * Safely get match score with fallback
 */
export function getMatchScore(result: DeepDiveResult | null): number {
  return result?.match_analysis?.overall_match_score ?? 0;
}

/**
 * Safely get match label
 */
export function getMatchLabel(result: DeepDiveResult | null): string {
  return result?.match_analysis?.match_label ?? "Unknown";
}

/**
 * Get match color class based on score
 */
export function getMatchColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

/**
 * Get match background gradient
 */
export function getMatchBgColor(score: number): string {
  if (score >= 80) return "from-emerald-500/20 to-emerald-500/5";
  if (score >= 60) return "from-blue-500/20 to-blue-500/5";
  if (score >= 40) return "from-amber-500/20 to-amber-500/5";
  return "from-rose-500/20 to-rose-500/5";
}

/**
 * Get hiring recommendation with fallback
 */
export function getHiringRecommendation(
  matchAnalysis: MatchAnalysis | null
): string {
  return matchAnalysis?.hiring_recommendation?.action ?? "Under Review";
}

/**
 * Safely get strengths as strings
 */
export function getStrengths(matchAnalysis: MatchAnalysis | null): string[] {
  if (!matchAnalysis?.strengths) return [];
  return matchAnalysis.strengths.map((s) =>
    typeof s === "string" ? s : s.strength ?? "Unknown"
  );
}

/**
 * Safely get concerns as strings
 */
export function getConcerns(matchAnalysis: MatchAnalysis | null): string[] {
  if (!matchAnalysis?.concerns) return [];
  return matchAnalysis.concerns.map((c) =>
    typeof c === "string" ? c : c.concern ?? "Unknown"
  );
}

/**
 * Safely get gaps as strings
 */
export function getGaps(matchAnalysis: MatchAnalysis | null): string[] {
  if (!matchAnalysis?.gaps) return [];
  return matchAnalysis.gaps.map((g) =>
    typeof g === "string" ? g : g.gap ?? "Unknown"
  );
}

/**
 * Normalize strength/concern/gap objects to display format
 */
export function normalizeMatchItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]
): Array<{ text: string; meta?: string }> {
  return items.map((item) => {
    if (typeof item === "string") {
      return { text: item };
    }
    if (item.strength) {
      return { text: item.strength, meta: item.evidence };
    }
    if (item.concern) {
      return { text: item.concern, meta: item.severity };
    }
    if (item.gap) {
      return { text: item.gap, meta: item.importance };
    }
    return { text: "Unknown" };
  });
}

/**
 * Check if result has minimum required data
 */
export function isValidResult(result: DeepDiveResult | null): boolean {
  return !!(result?.candidate?.full_name && result?.match_analysis);
}

/**
 * Get safe CTC value
 */
export function getCurrentCTC(result: DeepDiveResult | null): number {
  return result?.salary_timeline?.current_estimated_ctc?.most_likely ?? 0;
}

/**
 * Get safe response score
 */
export function getResponseScore(result: DeepDiveResult | null): number {
  return result?.response_likelihood?.overall_score ?? 0;
}

/**
 * Get safe notice period
 */
export function getNoticePeriod(result: DeepDiveResult | null): number {
  return result?.notice_period?.estimated_notice_days?.likely ?? 0;
}

/**
 * Get safe experience years
 */
export function getExperienceYears(result: DeepDiveResult | null): number {
  return result?.candidate?.experience_summary?.real_experience_years ?? 0;
}
