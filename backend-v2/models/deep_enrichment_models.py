"""
Deep Enrichment Models
======================
Pydantic models for the Intelligent Enrichment Orchestrator.

These models define the structure for:
- Enrichment plans (role-specific strategies)
- Skill validation results
- Salary timeline estimates
- Response likelihood scores
- Notice period estimates
- Match analysis

Author: NeuraLeap Engineering
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EnrichmentPlan(BaseModel):
    """
    LLM-generated enrichment plan that adapts to role type.
    
    This plan drives how we validate skills, estimate salary, etc.
    Different roles need different validation strategies.
    """
    role_type: str  # software_engineer, sales, marketing, etc.
    role_title: str  # Specific title from JD
    seniority_level: str  # entry, mid, senior, lead, director, vp, c_level
    extracted_requirements: Dict[str, Any]  # Skills, experience, education
    skill_validation_strategy: Dict[str, Any]  # Sources and methods
    salary_estimation_strategy: Dict[str, Any]  # Market data approach
    response_likelihood_factors: Dict[str, Any]  # Signals to analyze
    notice_period_estimation: Dict[str, Any]  # Estimation parameters


class SkillValidationResult(BaseModel):
    """Result of skill validation with evidence."""
    validated_skills: List[str]  # Skills with evidence
    unvalidated_skills: List[str]  # Skills without evidence
    evidence: List[Dict[str, Any]]  # Full evidence details
    overall_confidence: int = Field(ge=0, le=100)
    validation_strategy_used: Dict[str, Any]
    assessment: Optional[str] = None  # Overall assessment text


class SalaryTimeline(BaseModel):
    """Salary timeline based on experience history."""
    career_progression: List[Dict[str, Any]]  # Role-by-role estimates
    current_estimated_ctc: Dict[str, Any]  # {low, high, most_likely}
    growth_analysis: Dict[str, Any]  # Growth rate analysis
    next_role_expectation: Dict[str, Any]  # Expected next salary
    confidence_score: int = Field(ge=0, le=100)
    confidence_factors: List[str]
    estimation_strategy_used: Dict[str, Any]


class ResponseLikelihoodScore(BaseModel):
    """Response likelihood with transparent factor scoring."""
    overall_score: int = Field(ge=0, le=100)
    likelihood_label: str  # Very Low, Low, Moderate, High, Very High
    factors: List[Dict[str, Any]]  # Factor breakdown
    recommended_approach: Dict[str, Any]  # Outreach recommendations
    confidence_in_estimate: int = Field(ge=0, le=100)
    data_quality_notes: str


class NoticePeriodEstimate(BaseModel):
    """Notice period estimation."""
    estimated_notice_days: Dict[str, int]  # {minimum, likely, maximum}
    confidence: int = Field(ge=0, le=100)
    factors_considered: List[Dict[str, Any]]
    buyout_possibility: Dict[str, Any]
    earliest_possible_start: str
    most_likely_start: str
    negotiation_tips: List[str]


class MatchAnalysis(BaseModel):
    """Final match analysis synthesizing all data."""
    overall_match_score: int = Field(ge=0, le=100)
    match_label: str  # Excellent, Great, Good, Fair, Poor
    strengths: List[str]
    concerns: List[str]
    gaps: List[str]
    hiring_recommendation: Dict[str, Any]  # {action, reasoning, focus_areas}
    recruiter_summary: Dict[str, Any]  # Talking points, salary range, timeline


class CandidateDeepDive(BaseModel):
    """
    Complete deep dive result.
    
    This is the full output of the enrichment orchestrator,
    containing all analyzed data about a candidate.
    """
    # Basic candidate data
    candidate: Dict[str, Any]
    job_requirements: Dict[str, Any]
    
    # The plan used
    enrichment_plan: EnrichmentPlan
    
    # Enrichment results (all optional - may fail individually)
    skill_validation: Optional[SkillValidationResult] = None
    salary_timeline: Optional[SalaryTimeline] = None
    response_likelihood: Optional[ResponseLikelihoodScore] = None
    notice_period: Optional[NoticePeriodEstimate] = None
    
    # Final analysis
    match_analysis: Optional[MatchAnalysis] = None
    
    # Metadata
    data_source: str  # database, brightdata_dataset, brightdata_unlocker, perplexity
    processing_time_seconds: float
    enriched_at: str  # ISO timestamp