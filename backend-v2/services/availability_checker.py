"""
Availability Checker Service
============================
Estimates candidate availability and urgency.

This service:
- Estimates notice period based on industry/seniority
- Checks profile activity signals
- Determines job search indicators
- Calculates urgency score

Output: Availability data with notice period and urgency!
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from core.logging_config import get_logger
from models.enrichment_models import AvailabilityData

logger = get_logger(__name__)


class AvailabilityChecker:
    """
    Checks candidate availability and job search signals.
    
    Estimates:
    - Notice period (based on industry norms)
    - Job search indicators
    - Urgency score
    """
    
    # Standard notice periods by seniority (in days)
    NOTICE_PERIODS = {
        "entry": 30,
        "junior": 30,
        "mid": 30,
        "senior": 60,
        "lead": 60,
        "director": 90,
        "vp": 90,
        "c_level": 90
    }
    
    # Industry-specific adjustments
    INDUSTRY_ADJUSTMENTS = {
        "startup": -15,  # Startups often have shorter notice
        "government": +30,  # Government jobs have longer notice
        "consulting": -15,  # Consulting has flexible notice
        "banking": +30  # Banking sector typically longer
    }
    
    def __init__(self):
        """Initialize availability checker."""
        logger.info("AvailabilityChecker initialized")
    
    def check_availability(
        self,
        candidate: Dict
    ) -> AvailabilityData:
        """
        Check candidate availability.
        
        Args:
            candidate: Candidate profile
            
        Returns:
            AvailabilityData with notice period and urgency
        
        Example candidate dict:
            {
                "current_role": "Senior Manager - IT",
                "current_company": "Mswipe",
                "industry": "Fintech",
                "last_profile_update": "2024-04-01",
                "has_open_to_work": False,
                "headline": "...",
                "recent_activity": []
            }
        """
        
        logger.info(f"Checking availability for candidate {candidate.get('_id')}")
        
        # Estimate notice period
        notice_period = self._estimate_notice_period(candidate)
        
        # Check job search signals
        job_search_signals = self._detect_job_search_signals(candidate)
        
        # Get last profile update
        last_update = candidate.get("last_profile_update")
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                last_update_str = last_update_date.strftime("%B %d, %Y")
            except:
                last_update_str = "Unknown"
        else:
            last_update_str = "Unknown"
        
        # Calculate urgency score (0-10)
        urgency_score = self._calculate_urgency(candidate, job_search_signals)
        
        # Determine estimated availability
        estimated_availability = self._estimate_availability(
            notice_period,
            urgency_score,
            job_search_signals
        )
        
        return AvailabilityData(
            notice_period=notice_period,
            last_profile_update=last_update_str,
            job_search_signals=job_search_signals,
            estimated_availability=estimated_availability,
            urgency_score=urgency_score
        )
    
    def _estimate_notice_period(self, candidate: Dict) -> str:
        """
        Estimate notice period based on role and industry.
        
        Returns:
            Notice period string like "30 days" or "60 days"
        """
        
        current_role = candidate.get("current_role", "").lower()
        industry = candidate.get("industry", "").lower()
        company = candidate.get("current_company", "").lower()
        
        # Determine seniority level
        if any(term in current_role for term in ["ceo", "cto", "cfo", "chief"]):
            seniority = "c_level"
        elif any(term in current_role for term in ["vp", "vice president"]):
            seniority = "vp"
        elif any(term in current_role for term in ["director", "head of"]):
            seniority = "director"
        elif any(term in current_role for term in ["senior manager", "general manager", "sgm"]):
            seniority = "lead"
        elif "manager" in current_role or "lead" in current_role:
            seniority = "senior"
        elif "senior" in current_role:
            seniority = "mid"
        elif "junior" in current_role:
            seniority = "junior"
        else:
            seniority = "entry"
        
        # Get base notice period
        base_notice = self.NOTICE_PERIODS.get(seniority, 30)
        
        # Apply industry adjustments
        industry_adjustment = 0
        for industry_type, adjustment in self.INDUSTRY_ADJUSTMENTS.items():
            if industry_type in industry or industry_type in company:
                industry_adjustment = adjustment
                break
        
        final_notice = max(15, base_notice + industry_adjustment)  # Minimum 15 days
        
        # Format string
        if final_notice <= 15:
            return "Immediate to 15 days"
        elif final_notice <= 30:
            return "30 days"
        elif final_notice <= 60:
            return "60 days"
        else:
            return "90+ days"
    
    def _detect_job_search_signals(self, candidate: Dict) -> List[str]:
        """
        Detect signals that candidate is job searching.
        
        Returns:
            List of detected signals
        """
        
        signals = []
        
        # Check "Open to Work" banner
        if candidate.get("has_open_to_work", False):
            signals.append("'Open to Work' banner visible")
        
        # Check headline for keywords
        headline = candidate.get("headline", "").lower()
        if any(keyword in headline for keyword in ["looking", "seeking", "available", "open to opportunities"]):
            signals.append("Job-seeking keywords in headline")
        
        # Check recent profile update
        last_update = candidate.get("last_profile_update")
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                days_since = (datetime.now() - last_update_date).days
                
                if days_since < 7:
                    signals.append("Profile updated within past week")
                elif days_since < 30:
                    signals.append("Profile updated recently (past month)")
            except:
                pass
        
        # Check recent activity
        recent_activity = candidate.get("recent_activity", [])
        if len(recent_activity) > 3:
            signals.append(f"High LinkedIn activity ({len(recent_activity)} posts/interactions recently)")
        
        # Check for short tenure
        tenure_months = candidate.get("tenure_months", 0)
        if tenure_months < 6:
            signals.append("Short tenure at current company (<6 months) - may be looking")
        
        # If no signals, say so
        if not signals:
            signals.append("No active job-seeking signals detected")
        
        return signals
    
    def _calculate_urgency(
        self,
        candidate: Dict,
        job_search_signals: List[str]
    ) -> int:
        """
        Calculate urgency score (0-10).
        
        Higher score = more urgently looking
        """
        
        score = 0
        
        # "Open to Work" is a strong signal
        if candidate.get("has_open_to_work", False):
            score += 5
        
        # Recent profile updates
        last_update = candidate.get("last_profile_update")
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                days_since = (datetime.now() - last_update_date).days
                
                if days_since < 7:
                    score += 3
                elif days_since < 30:
                    score += 2
                elif days_since < 90:
                    score += 1
            except:
                pass
        
        # High activity
        recent_activity = candidate.get("recent_activity", [])
        if len(recent_activity) > 5:
            score += 2
        elif len(recent_activity) > 2:
            score += 1
        
        # Short tenure (might be unhappy)
        tenure_months = candidate.get("tenure_months", 0)
        if tenure_months < 6:
            score += 1
        
        # Cap at 10
        return min(score, 10)
    
    def _estimate_availability(
        self,
        notice_period: str,
        urgency_score: int,
        signals: List[str]
    ) -> str:
        """
        Estimate when candidate could start.
        
        Returns:
            String like "Available in 30 days" or "Immediately available"
        """
        
        # Parse notice period
        if "Immediate" in notice_period:
            base_days = 7
        elif "30" in notice_period:
            base_days = 30
        elif "60" in notice_period:
            base_days = 60
        else:
            base_days = 90
        
        # Adjust based on urgency
        if urgency_score >= 8:
            # Very urgent - might negotiate shorter notice
            adjusted_days = int(base_days * 0.7)
            return f"Available in ~{adjusted_days} days (high urgency - may negotiate shorter notice)"
        elif urgency_score >= 5:
            return f"Available in ~{base_days} days"
        else:
            # Not urgent - might take full notice + buffer
            adjusted_days = int(base_days * 1.2)
            return f"Available in {adjusted_days}+ days (not actively looking - may need time to consider)"