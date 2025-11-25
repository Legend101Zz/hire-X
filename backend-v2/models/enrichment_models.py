"""
Enrichment Models for V3
========================
These models define the structure for enriched candidate data,
including salary progression, response likelihood, and skill validation.
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field

# ============================================================================
# SALARY ENRICHMENT MODELS
# ============================================================================

class CareerProgressionEntry(BaseModel):
    """
    Single entry in a candidate's career progression with salary estimate.
    
    Example:
        {
            "role": "Senior General Manager - IT",
            "company": "Mswipe (Mumbai)",
            "duration": "Apr 2024 – Present (1 yr 6 mos)",
            "experience_level": "Executive (14+ yrs)",
            "estimated_ctc_range": "25.0 – 35.0",
            "rationale": "SGM IT ~₹25-40L current...",
            "sources": ["glassdoor.com/...", "ambitionbox.com/..."]
        }
    """
    role: str
    company: str
    duration: str
    experience_level: str  # Entry/Junior/Mid/Senior/Lead/Executive
    estimated_ctc_range: str  # "2.5 – 3.5" (in Lakhs INR)
    rationale: str  # Detailed explanation of how we estimated
    sources: List[str] = []  # URLs of sources used


class SalaryEnrichment(BaseModel):
    """
    Complete salary analysis showing career progression and growth.
    
    This is the detailed view that shows in the expandable row.
    """
    career_progression: List[CareerProgressionEntry]
    current_estimated_ctc: str  # "25.0 – 35.0"
    growth_trajectory: str  # "2.5L → 35L over 14 years (14x growth)"
    average_annual_growth: str  # "18.5%"
    next_expected_range: str  # "30-40L (if switches to larger fintech/bank)"
    confidence_score: int = Field(ge=0, le=100, default=70)
    enrichment_notes: Optional[str] = None  # Any additional context


# ============================================================================
# RESPONSE LIKELIHOOD MODELS
# ============================================================================

class ResponseLikelihoodFactor(BaseModel):
    """
    Single factor in response likelihood calculation.
    
    Example:
        {
            "factor": "LinkedIn Activity",
            "weight": 30,
            "score": 2,
            "notes": "No posts, shares, or comments in 2024–2025..."
        }
    """
    factor: str
    weight: int  # Percentage weight (e.g., 30 means 30%)
    score: int = Field(ge=0, le=10)  # Score out of 10
    notes: str  # Detailed explanation


class ResponseLikelihoodAnalysis(BaseModel):
    """
    Complete response likelihood analysis with factor breakdown.
    
    This shows how likely a candidate is to respond to outreach.
    """
    overall_score: int = Field(ge=0, le=100)  # Weighted average
    likelihood_label: str  # "Low" | "Low-Moderate" | "Moderate" | "High" | "Very High"
    factors: List[ResponseLikelihoodFactor]
    recommended_approach: str  # How to reach out to this candidate
    estimated_response_time: str  # "3-7 days (if responds)"
    best_contact_days: Optional[List[str]] = None  # ["Tuesday", "Wednesday"]
    best_contact_time: Optional[str] = None  # "10-11am"


# ============================================================================
# SKILL VALIDATION MODELS
# ============================================================================

class SkillEvidence(BaseModel):
    """
    Evidence of a skill from web search.
    
    Example:
        {
            "skill": "React",
            "evidence_type": "GitHub",
            "url": "github.com/johndoe/react-project",
            "description": "React dashboard with 500+ stars",
            "confidence": 9
        }
    """
    skill: str
    evidence_type: str  # "GitHub" | "StackOverflow" | "Blog" | "LinkedIn Post"
    url: str
    description: str
    confidence: int = Field(ge=0, le=10)


class SkillValidation(BaseModel):
    """
    Validation results for candidate's skills.
    """
    validated_skills: List[str]  # Skills we found evidence for
    unvalidated_skills: List[str]  # Skills listed but no evidence found
    evidence: List[SkillEvidence]
    overall_confidence: int = Field(ge=0, le=100)
    notes: Optional[str] = None


# ============================================================================
# AVAILABILITY MODELS
# ============================================================================

class AvailabilityData(BaseModel):
    """
    Candidate availability information.
    """
    notice_period: str  # "30 days" | "Immediate" | "60+ days"
    last_profile_update: Optional[str] = None  # ISO date
    job_search_signals: List[str] = []  # ["Posted 'Open to Work'", "Updated headline"]
    estimated_availability: str  # "Available in 30 days"
    urgency_score: int = Field(ge=0, le=10)  # How urgently they're looking



    
# ============================================================================
# RECRUITER SUMMARY MODEL 
# ============================================================================

class RecruiterSummary(BaseModel):
    """
    AI-generated recruiter-friendly summary of candidate.
    """
    why_shortlist: str  # 2-3 sentences: Why this candidate stands out
    why_reject: str  # 2-3 sentences: Potential concerns
    fit_summary: str  # For hiring manager: Overall assessment
    standout_achievements: List[str] = []  # Top 3-5 achievements
    red_flags: List[str] = []  # Any concerns
    interesting_findings: List[str] = []  # Press mentions, certifications, etc.
    overall_recommendation: str  # "Strong Yes" | "Yes" | "Maybe" | "No"
    confidence_level: int = Field(ge=0, le=100)  # How confident we are


class WebIntelligence(BaseModel):
    """
    Intelligence gathered from web about candidate.
    """
    github_stats: Optional[Dict] = None  # Stars, contributions, repos
    online_presence: List[str] = []  # Active platforms
    press_mentions: List[Dict] = []  # News articles, interviews
    social_signals: List[str] = []  # Twitter, blog posts, etc.
    risk_flags: List[str] = []  # Job hopping, gaps, controversies
    last_updated: str




# ============================================================================
# COMBINED ENRICHED CANDIDATE MODEL
# ============================================================================

class EnrichedCandidate(BaseModel):
    """
    Complete enriched candidate data.
    
    This combines:
    - Basic profile info from MongoDB
    - Match information from scoring
    - All enrichment data (salary, response likelihood, skills, availability)
    """
    
    # Basic Info (from profiles collection)
    candidate_id: str
    first_name: str
    last_name: str
    title: str
    company: Optional[str] = None
    location: str
    linkedin_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    # Match Information
    match_label: str  # "Excellent Match" | "Great Match" | "Good Match" | "Fair Match"
    match_reason: str  # Plain English explanation
    match_score: int = Field(ge=0, le=100)  # Internal score (not shown to user)
    
    # Enrichment Data (all optional - may be pending)
    salary_enrichment: Optional[SalaryEnrichment] = None
    response_likelihood: Optional[ResponseLikelihoodAnalysis] = None
    skill_validation: Optional[SkillValidation] = None
    availability: Optional[AvailabilityData] = None
    recruiter_summary: Optional[RecruiterSummary] = None
    web_intelligence: Optional[WebIntelligence] = None
    
    # Metadata
    enrichment_status: str = "pending"  # "pending" | "in_progress" | "completed" | "failed"
    enriched_at: Optional[str] = None  # ISO timestamp
    enrichment_error: Optional[str] = None  # If failed, what went wrong


# ============================================================================
# ENRICHMENT REQUEST/RESPONSE MODELS
# ============================================================================

class EnrichmentRequest(BaseModel):
    """
    Request to enrich specific candidates.
    """
    session_id: str
    candidate_ids: List[str]
    enrichment_types: List[str] = ["salary", "response_likelihood", "skills", "availability"]


class EnrichmentProgress(BaseModel):
    """
    Progress update during enrichment.
    """
    session_id: str
    total_candidates: int
    enriched_count: int
    failed_count: int
    current_candidate: Optional[str] = None
    progress_percentage: int = Field(ge=0, le=100)
