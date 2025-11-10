"""
Response Likelihood Scorer
==========================
Calculates how likely a candidate is to respond to outreach.

This service:
- Analyzes multiple factors (LinkedIn activity, connections, role, etc.)
- Provides weighted scoring (0-100)
- Generates detailed factor breakdown
- Gives outreach recommendations

Output: The factor table you wanted!
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from core.logging_config import get_logger
from models.enrichment_models import (ResponseLikelihoodAnalysis,
                                      ResponseLikelihoodFactor)
from services.model_config_manager import ModelConfigManager
from services.web_search_wrapper import WebSearchWrapper

logger = get_logger(__name__)


class ResponseLikelihoodScorer:
    """
    Calculates candidate response likelihood with factor breakdown.
    
    Creates the detailed factor table:
    Factor | Weight | Score | Notes
    """
    
    # Factor weights (must sum to 100)
    FACTOR_WEIGHTS = {
        "linkedin_activity": 30,
        "connection_openness": 20,
        "role_seniority_tenure": 20,
        "company_culture": 15,
        "industry_demand": 10,
        "profile_completeness": 5
    }
    
    def __init__(
        self,
        web_search: WebSearchWrapper,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize response likelihood scorer.
        
        Args:
            web_search: Web search wrapper for market research
            model_config_manager: For getting configured models
        """
        self.web_search = web_search
        self.model_manager = model_config_manager
        
        logger.info("ResponseLikelihoodScorer initialized")
    
    async def calculate_response_likelihood(
        self,
        candidate: Dict,
        session_id: Optional[str] = None
    ) -> ResponseLikelihoodAnalysis:
        """
        Calculate comprehensive response likelihood analysis.
        
        Args:
            candidate: Candidate profile
            session_id: Optional session ID
            
        Returns:
            ResponseLikelihoodAnalysis with factor breakdown
        
        Example candidate dict:
            {
                "linkedin_url": "...",
                "current_role": "Senior General Manager - IT",
                "current_company": "Mswipe",
                "tenure_months": 18,
                "location": "Mumbai",
                "industry": "Fintech",
                "last_profile_update": "2024-04-01",
                "connection_count": 500,
                "has_open_to_work": False,
                "recent_activity": []
            }
        """
        
        logger.info(f"Calculating response likelihood for candidate {candidate.get('_id', 'unknown')}")
        
        # Calculate each factor score in parallel
        tasks = [
            self._analyze_linkedin_activity(candidate),
            self._analyze_connection_openness(candidate),
            self._analyze_seniority_tenure(candidate),
            self._analyze_company_culture(candidate, session_id),
            self._analyze_industry_demand(candidate, session_id),
            self._analyze_profile_completeness(candidate)
        ]
        
        factor_results = await asyncio.gather(*tasks)
        
        # Build factor list
        factors = [
            ResponseLikelihoodFactor(
                factor="LinkedIn Activity",
                weight=self.FACTOR_WEIGHTS["linkedin_activity"],
                score=factor_results[0]["score"],
                notes=factor_results[0]["notes"]
            ),
            ResponseLikelihoodFactor(
                factor="Connection Count & Openness",
                weight=self.FACTOR_WEIGHTS["connection_openness"],
                score=factor_results[1]["score"],
                notes=factor_results[1]["notes"]
            ),
            ResponseLikelihoodFactor(
                factor="Role Seniority & Time in Role",
                weight=self.FACTOR_WEIGHTS["role_seniority_tenure"],
                score=factor_results[2]["score"],
                notes=factor_results[2]["notes"]
            ),
            ResponseLikelihoodFactor(
                factor="Company Culture & Retention",
                weight=self.FACTOR_WEIGHTS["company_culture"],
                score=factor_results[3]["score"],
                notes=factor_results[3]["notes"]
            ),
            ResponseLikelihoodFactor(
                factor="Industry & Location Demand",
                weight=self.FACTOR_WEIGHTS["industry_demand"],
                score=factor_results[4]["score"],
                notes=factor_results[4]["notes"]
            ),
            ResponseLikelihoodFactor(
                factor="Profile Completeness",
                weight=self.FACTOR_WEIGHTS["profile_completeness"],
                score=factor_results[5]["score"],
                notes=factor_results[5]["notes"]
            )
        ]
        
        # Calculate weighted overall score
        overall_score = sum(
            (f.weight * f.score / 10)
            for f in factors
        )
        overall_score = int(overall_score)
        
        # Determine likelihood label
        likelihood_label = self._get_likelihood_label(overall_score)
        
        # Generate recommendations
        recommendation = self._generate_recommendation(
            overall_score,
            factors,
            candidate
        )
        
        return ResponseLikelihoodAnalysis(
            overall_score=overall_score,
            likelihood_label=likelihood_label,
            factors=factors,
            recommended_approach=recommendation["approach"],
            estimated_response_time=recommendation["response_time"],
            best_contact_days=recommendation.get("best_days"),
            best_contact_time=recommendation.get("best_time")
        )
    
    async def _analyze_linkedin_activity(self, candidate: Dict) -> Dict:
        """
        Analyze LinkedIn activity level.
        
        Signals:
        - Posts, comments, shares
        - Last profile update
        - Content engagement
        """
        
        last_update = candidate.get("last_profile_update")
        recent_activity = candidate.get("recent_activity", [])
        
        # Calculate days since last activity
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                days_since = (datetime.now() - last_update_date).days
            except:
                days_since = 365  # Assume old if can't parse
        else:
            days_since = 365
        
        # Score based on activity
        if days_since < 7 and len(recent_activity) > 3:
            score = 9
            notes = f"Very active: Posted {len(recent_activity)} times in past week. High engagement suggests openness to networking."
        elif days_since < 30 and len(recent_activity) > 0:
            score = 7
            notes = f"Moderately active: {len(recent_activity)} posts/updates in past month. Regular LinkedIn user."
        elif days_since < 90:
            score = 4
            notes = f"Low activity: Last update {days_since} days ago. Occasional LinkedIn user."
        elif days_since < 180:
            score = 2
            notes = f"Minimal activity: Last update {days_since} days ago. Rarely checks LinkedIn."
        else:
            score = 1
            notes = f"No recent activity: Last update {days_since}+ days ago. Profile is static—typical of senior leaders who avoid public engagement."
        
        return {"score": score, "notes": notes}
    
    async def _analyze_connection_openness(self, candidate: Dict) -> Dict:
        """
        Analyze connection count and openness signals.
        
        Signals:
        - Connection count
        - "Open to Work" banner
        - Headline keywords ("looking", "seeking", etc.)
        - Recent job change
        """
        
        connection_count = candidate.get("connection_count", 0)
        has_open_to_work = candidate.get("has_open_to_work", False)
        headline = candidate.get("headline", "").lower()
        
        # Check for job-seeking keywords
        seeking_keywords = ["looking", "seeking", "available", "open to opportunities"]
        is_seeking = any(keyword in headline for keyword in seeking_keywords)
        
        # Score based on signals
        if has_open_to_work or is_seeking:
            score = 10
            notes = "'Open to Work' banner visible or seeking keywords in headline. Actively looking for opportunities."
        elif connection_count > 1000:
            score = 8
            notes = f"{connection_count}+ connections (large network). Actively networks and likely responsive to outreach."
        elif connection_count > 500:
            score = 6
            notes = f"{connection_count}+ connections (moderate network). Reasonably active networker."
        elif connection_count > 100:
            score = 4
            notes = f"{connection_count}+ connections. Selective about connections, moderate response rate."
        else:
            score = 2
            notes = f"Small network ({connection_count} connections). Very selective—likely only accepts known contacts."
        
        return {"score": score, "notes": notes}
    
    async def _analyze_seniority_tenure(self, candidate: Dict) -> Dict:
        """
        Analyze role seniority and tenure impact.
        
        Higher seniority + longer tenure = lower response rate
        (Senior people are busier, less likely to switch)
        """
        
        current_role = candidate.get("current_role", "")
        tenure_months = candidate.get("tenure_months", 0)
        
        # Determine seniority level
        role_lower = current_role.lower()
        if any(title in role_lower for title in ["ceo", "cto", "cfo", "vp", "vice president", "head of", "director"]):
            seniority_level = "C-Level/VP"
            seniority_factor = 0.2  # 20% response rate
        elif any(title in role_lower for title in ["senior manager", "general manager", "sgm", "gm"]):
            seniority_level = "Senior Manager"
            seniority_factor = 0.3  # 30% response rate
        elif "manager" in role_lower:
            seniority_level = "Manager"
            seniority_factor = 0.5  # 50% response rate
        elif any(title in role_lower for title in ["senior", "lead"]):
            seniority_level = "Senior IC"
            seniority_factor = 0.6  # 60% response rate
        else:
            seniority_level = "Mid/Junior"
            seniority_factor = 0.7  # 70% response rate
        
        # Tenure impact (longer tenure = more stable, less likely to move)
        tenure_years = tenure_months / 12
        if tenure_years < 1:
            tenure_impact = "Recently joined"
            tenure_factor = 0.3  # Less likely to move again soon
        elif tenure_years < 2:
            tenure_impact = f"{tenure_months} months tenure"
            tenure_factor = 0.7  # Sweet spot for switching
        elif tenure_years < 4:
            tenure_impact = f"{tenure_years:.1f} years tenure"
            tenure_factor = 0.6  # Moderate likelihood
        else:
            tenure_impact = f"{tenure_years:.1f}+ years tenure"
            tenure_factor = 0.4  # Very stable, less likely
        
        # Combined score
        combined_factor = (seniority_factor + tenure_factor) / 2
        score = int(combined_factor * 10)
        
        notes = f"{seniority_level} role at current company for {tenure_impact}. {seniority_level} professionals respond to ~{int(seniority_factor*100)}% of cold outreach. {'Sweet spot for job switching.' if 1 < tenure_years < 3 else 'High workload reduces bandwidth for external opportunities.'}"
        
        return {"score": score, "notes": notes}
    
    async def _analyze_company_culture(self, candidate: Dict, session_id: Optional[str]) -> Dict:
        """
        Analyze company culture and retention.
        
        Uses web search to find:
        - Company Glassdoor ratings
        - Average tenure
        - Retention rates
        - Growth stage
        """
        
        company = candidate.get("current_company", "")
        
        if not company:
            return {
                "score": 5,
                "notes": "Company unknown—unable to assess culture/retention."
            }
        
        # Search for company culture info
        search_result = await self.web_search.search(
            f"{company} company culture Glassdoor reviews retention average tenure",
            session_id=session_id
        )
        
        answer = search_result.get("answer", "").lower()
        
        # Parse for signals
        if "high retention" in answer or "employees stay" in answer:
            score = 3
            notes = f"{company}: High retention reported. Employees typically stay long-term, reducing job-switching intent."
        elif "high turnover" in answer or "low retention" in answer:
            score = 8
            notes = f"{company}: High turnover reported. Employees frequently open to new opportunities."
        elif "startup" in answer or "series" in answer:
            score = 6
            notes = f"{company}: Startup/growth stage. Moderate retention—employees often explore options after vesting."
        else:
            score = 5
            notes = f"{company}: Standard retention patterns. Moderate likelihood of considering opportunities."
        
        return {"score": score, "notes": notes}
    
    async def _analyze_industry_demand(self, candidate: Dict, session_id: Optional[str]) -> Dict:
        """
        Analyze industry and location demand.
        
        High demand = passive candidates still browsing
        """
        
        industry = candidate.get("industry", "")
        location = candidate.get("location", "")
        current_role = candidate.get("current_role", "")
        
        # Search for demand
        search_result = await self.web_search.search(
            f"hiring demand for {current_role} {industry} {location} India 2025",
            session_id=session_id
        )
        
        answer = search_result.get("answer", "").lower()
        
        # Parse for signals
        if "high demand" in answer or "shortage" in answer or "growing" in answer:
            score = 8
            notes = f"High demand for {current_role} in {location}/{industry}. Passive candidates in this niche often browse opportunities even if not actively applying."
        elif "competitive" in answer:
            score = 6
            notes = f"Competitive market for {current_role} in {location}. Moderate demand—good candidates get multiple offers."
        elif "low demand" in answer or "saturated" in answer:
            score = 4
            notes = f"Lower demand for {current_role} in {location}. Fewer opportunities may make candidate less responsive to outreach."
        else:
            score = 5
            notes = f"Moderate demand for {current_role} in {location}. Standard market conditions."
        
        return {"score": score, "notes": notes}
    
    async def _analyze_profile_completeness(self, candidate: Dict) -> Dict:
        """
        Analyze profile completeness.
        
        Complete profile = professional maintenance
        But doesn't necessarily mean active job seeking
        """
        
        # Check for key fields
        has_photo = bool(candidate.get("photo_url"))
        has_headline = bool(candidate.get("headline"))
        has_summary = bool(candidate.get("summary"))
        has_skills = len(candidate.get("skills", [])) > 5
        has_experience = len(candidate.get("experience", [])) > 0
        
        completeness_score = sum([
            has_photo,
            has_headline,
            has_summary,
            has_skills,
            has_experience
        ])
        
        if completeness_score >= 4:
            score = 7
            notes = "Complete profile with detailed experience, skills listed. Suggests professional maintenance but not necessarily active job seeking."
        elif completeness_score >= 3:
            score = 5
            notes = "Moderately complete profile. Maintains LinkedIn presence."
        else:
            score = 3
            notes = "Incomplete profile. Minimal LinkedIn engagement—likely not checking frequently."
        
        return {"score": score, "notes": notes}
    
    def _get_likelihood_label(self, score: int) -> str:
        """Convert score to label."""
        if score >= 75:
            return "Very High"
        elif score >= 60:
            return "High"
        elif score >= 45:
            return "Moderate"
        elif score >= 30:
            return "Low-Moderate"
        else:
            return "Low"
    
    def _generate_recommendation(
        self,
        overall_score: int,
        factors: List[ResponseLikelihoodFactor],
        candidate: Dict
    ) -> Dict:
        """
        Generate outreach recommendations.
        
        Returns:
            {
                "approach": "How to reach out",
                "response_time": "When to expect response",
                "best_days": ["Tuesday", "Wednesday"],
                "best_time": "10-11am"
            }
        """
        
        current_role = candidate.get("current_role", "")
        seniority_level = self._get_seniority_level(current_role)
        
        # Determine approach
        if overall_score >= 60:
            approach = f"Direct outreach via personalized InMail or email. Highlight specific opportunity match and growth potential. Candidate is likely open to conversations."
        elif overall_score >= 40:
            if seniority_level in ["C-Level/VP", "Senior Manager"]:
                approach = f"Senior outreach via warm intro if possible, or highly personalized InMail referencing their specific expertise. Highlight leadership opportunity and competitive package. Be concise—respect their time."
            else:
                approach = f"Personalized InMail mentioning specific skills/achievements. Include clear value proposition (growth, learning, compensation). Follow up once if no response."
        else:
            approach = f"Warm introduction strongly recommended for {seniority_level} professionals. Cold outreach has <20% response rate. If no warm intro available, craft exceptional InMail highlighting unique opportunity alignment and refer to specific accomplishments."
        
        # Response time
        if overall_score >= 60:
            response_time = "1-3 days (if interested)"
        elif overall_score >= 40:
            response_time = "3-7 days (if interested)"
        else:
            response_time = "7-14 days (if responds at all)"
        
        # Best contact days (avoid Monday/Friday)
        best_days = ["Tuesday", "Wednesday", "Thursday"]
        
        # Best time (mid-morning, not too early)
        best_time = "10-11am"
        
        return {
            "approach": approach,
            "response_time": response_time,
            "best_days": best_days,
            "best_time": best_time
        }
    
    def _get_seniority_level(self, role: str) -> str:
        """Get seniority level from role title."""
        role_lower = role.lower()
        if any(title in role_lower for title in ["ceo", "cto", "cfo", "vp", "vice president"]):
            return "C-Level/VP"
        elif any(title in role_lower for title in ["director", "head of"]):
            return "Director"
        elif any(title in role_lower for title in ["senior manager", "general manager", "sgm", "gm"]):
            return "Senior Manager"
        elif "manager" in role_lower:
            return "Manager"
        elif any(title in role_lower for title in ["senior", "lead", "principal"]):
            return "Senior IC"
        else:
            return "Mid/Junior"