"""
Availability Checker Service - Enhanced V3
==========================================
Intelligently estimates candidate availability and urgency using web search.

This service:
- Searches for company layoff news and hiring freezes
- Checks candidate's online activity patterns
- Analyzes job market signals
- Estimates notice period based on real data
- Determines job search urgency with evidence

Output: Detailed availability data with supporting evidence!
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from core.logging_config import get_logger
from data.redis_cache import RedisCache
from models.enrichment_models import AvailabilityData

logger = get_logger(__name__)


class AvailabilityChecker:
    """
    Intelligently checks candidate availability using web search and signals.
    
    Enhanced Features:
    - Company health check (layoffs, funding, news)
    - Job market activity detection
    - Evidence-based urgency scoring
    - Smart notice period estimation
    """
    
    # Standard notice periods by seniority (baseline)
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
        "startup": -15,
        "government": +30,
        "consulting": -15,
        "banking": +30,
        "fintech": 0,
        "technology": -10
    }
    
    # Layoff/urgency keywords to search for
    URGENCY_KEYWORDS = [
        "layoffs", "restructuring", "downsizing", "cost-cutting",
        "hiring freeze", "workforce reduction", "pink slips",
        "mass exit", "attrition", "resignations"
    ]
    
    def __init__(
        self,
        web_search,
        redis_cache: RedisCache,
        model_config_manager
    ):
        """
        Initialize availability checker with web search.
        
        Args:
            web_search: WebSearchWrapper for company research
            redis_cache: Redis for caching results
            model_config_manager: Model config for LLM calls
        """
        self.web_search = web_search
        self.redis = redis_cache
        self.model_config = model_config_manager
        
        logger.info("AvailabilityChecker initialized with web search")
    
    async def check_availability(
        self,
        candidate: Dict,
        ideal_profile: Optional[Dict] = None
    ) -> AvailabilityData:
        """
        Check candidate availability with intelligent web research.
        
        Args:
            candidate: Candidate profile
            ideal_profile: Ideal profile for context
            
        Returns:
            AvailabilityData with evidence-based availability
        
        Example candidate dict:
            {
                "current_role": "Senior Manager - IT",
                "current_company": "Mswipe",
                "industry": "Fintech",
                "last_profile_update": "2024-04-01",
                "location": "Bangalore",
                "tenure_months": 18
            }
        """
        
        logger.info(f"Checking availability for candidate at {candidate.get('current_company')}")
        
        # Run all checks in parallel
        notice_period_task = self._estimate_notice_period(candidate)
        company_health_task = self._check_company_health(candidate)
        profile_signals_task = self._detect_profile_signals(candidate)
        
        # Wait for all
        notice_period, company_health, profile_signals = await asyncio.gather(
            notice_period_task,
            company_health_task,
            profile_signals_task,
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(notice_period, Exception):
            logger.error(f"Notice period estimation failed: {notice_period}")
            notice_period = "30 days"
        
        if isinstance(company_health, Exception):
            logger.error(f"Company health check failed: {company_health}")
            company_health = {"status": "unknown", "signals": []}
        
        if isinstance(profile_signals, Exception):
            logger.error(f"Profile signals detection failed: {profile_signals}")
            profile_signals = []
        
        # Combine all signals
        all_signals = profile_signals + company_health.get("signals", [])
        
        # Get last profile update
        last_update_str = self._format_last_update(candidate)
        
        # Calculate urgency score with company health
        urgency_score = self._calculate_urgency(
            candidate,
            profile_signals,
            company_health
        )
        
        # Estimate availability
        estimated_availability = self._estimate_availability(
            notice_period,
            urgency_score,
            company_health
        )
        
        return AvailabilityData(
            notice_period=notice_period,
            last_profile_update=last_update_str,
            job_search_signals=all_signals,
            estimated_availability=estimated_availability,
            urgency_score=urgency_score
        )
    
    # ================================================================
    # COMPANY HEALTH CHECK (NEW!)
    # ================================================================
    
    async def _check_company_health(self, candidate: Dict) -> Dict:
        """
        Check company health through web search.
        
        Searches for:
        - Layoff news
        - Funding issues
        - Restructuring
        - Hiring freezes
        
        Returns:
            {
                "status": "healthy" | "at_risk" | "unstable" | "unknown",
                "signals": List[str],
                "recent_news": List[str]
            }
        """
        
        company = candidate.get("current_company", "")
        if not company or len(company) < 3:
            return {"status": "unknown", "signals": [], "recent_news": []}
        
        # Check cache first (company health changes slowly)
        cache_key = f"company_health:{company.lower()}"
        cached = await self.redis.get_cached_data(cache_key)
        if cached:
            logger.info(f"Using cached company health for {company}")
            return cached
        
        signals = []
        recent_news = []
        status = "healthy"
        
        try:
            # Search for negative news
            negative_query = f"{company} layoffs restructuring downsizing 2024 2025"
            negative_results = await self.web_search.search(
                query=negative_query,
                max_results=5
            )
            
            # Search for positive news
            positive_query = f"{company} hiring expansion funding growth 2024 2025"
            positive_results = await self.web_search.search(
                query=positive_query,
                max_results=3
            )
            
            # Analyze negative signals
            negative_count = 0
            for result in negative_results.get("results", []):
                title = result.get("title", "").lower()
                snippet = result.get("snippet", "").lower()
                
                for keyword in self.URGENCY_KEYWORDS:
                    if keyword in title or keyword in snippet:
                        negative_count += 1
                        
                        # Extract specific signal
                        if "layoff" in title or "layoff" in snippet:
                            signals.append(f"Recent layoffs reported at {company}")
                            recent_news.append(f"🔴 {result.get('title', 'Layoff news')}")
                        elif "hiring freeze" in title or "hiring freeze" in snippet:
                            signals.append(f"Hiring freeze reported at {company}")
                            recent_news.append(f"⚠️ {result.get('title', 'Hiring freeze')}")
                        elif "restructuring" in title or "restructuring" in snippet:
                            signals.append(f"Company restructuring at {company}")
                            recent_news.append(f"⚠️ {result.get('title', 'Restructuring')}")
                        
                        break  # One signal per result
            
            # Analyze positive signals
            positive_count = 0
            for result in positive_results.get("results", []):
                title = result.get("title", "").lower()
                snippet = result.get("snippet", "").lower()
                
                if any(word in title or word in snippet for word in ["hiring", "expansion", "funding", "growth"]):
                    positive_count += 1
            
            # Determine status
            if negative_count >= 3:
                status = "unstable"
                signals.append(f"⚠️ Multiple negative news items about {company}")
            elif negative_count >= 1:
                status = "at_risk"
            elif positive_count >= 2:
                status = "healthy"
                signals.append(f"✅ {company} appears to be growing/hiring")
            else:
                status = "unknown"
                signals.append("No recent significant news found")
            
            result = {
                "status": status,
                "signals": signals[:3],  # Top 3 signals
                "recent_news": recent_news[:3]
            }
            
            # Cache for 24 hours (company news changes daily)
            await self.redis.cache_data(cache_key, result, ttl=86400)
            
            return result
        
        except Exception as e:
            logger.error(f"Company health check failed: {e}")
            return {"status": "unknown", "signals": [], "recent_news": []}
    
    # ================================================================
    # PROFILE SIGNALS (Enhanced)
    # ================================================================
    
    async def _detect_profile_signals(self, candidate: Dict) -> List[str]:
        """
        Detect job search signals from profile data.
        
        Returns:
            List of detected signals with evidence
        """
        
        signals = []
        
        # Check "Open to Work"
        if candidate.get("has_open_to_work", False):
            signals.append("🟢 'Open to Work' banner visible - actively job hunting")
        
        # Check headline
        headline = candidate.get("headline", "").lower()
        job_seeking_keywords = ["looking", "seeking", "available", "open to opportunities", "hiring"]
        for keyword in job_seeking_keywords:
            if keyword in headline:
                signals.append(f"🟢 Job-seeking keyword '{keyword}' in headline")
                break
        
        # Check recent profile update
        last_update = candidate.get("last_profile_update")
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                days_since = (datetime.now() - last_update_date).days
                
                if days_since < 7:
                    signals.append("🟢 Profile updated within past week - high activity")
                elif days_since < 30:
                    signals.append("🟡 Profile updated recently (past month)")
                elif days_since > 365:
                    signals.append("🔴 Profile not updated in over a year - may be passive")
            except:
                pass
        
        # Check tenure (short tenure = might be looking)
        tenure_months = candidate.get("tenure_months", 0)
        if tenure_months < 6:
            signals.append("🟡 Short tenure at current company (<6 months) - potential flight risk")
        elif tenure_months > 60:
            signals.append("🔴 Long tenure (5+ years) - may be less motivated to move")
        
        # Check location for relocation signals
        location = candidate.get("location", "").lower()
        if "relocating" in location or "willing to relocate" in location:
            signals.append("🟢 Willing to relocate - highly flexible")
        
        # If no signals, note it
        if not signals:
            signals.append("ℹ️ No active job-seeking signals detected - likely passive candidate")
        
        return signals
    
    # ================================================================
    # NOTICE PERIOD ESTIMATION
    # ================================================================
    
    async def _estimate_notice_period(self, candidate: Dict) -> str:
        """
        Estimate notice period based on role, industry, and company type.
        
        Returns:
            Notice period string like "30 days" or "60 days"
        """
        
        current_role = candidate.get("current_role", "").lower()
        industry = candidate.get("industry", "").lower()
        company = candidate.get("current_company", "").lower()
        
        # Determine seniority level
        seniority = self._determine_seniority(current_role)
        
        # Get base notice period
        base_notice = self.NOTICE_PERIODS.get(seniority, 30)
        
        # Apply industry adjustments
        industry_adjustment = 0
        for industry_type, adjustment in self.INDUSTRY_ADJUSTMENTS.items():
            if industry_type in industry or industry_type in company:
                industry_adjustment = adjustment
                break
        
        # Company size factor (larger companies = longer notice)
        if any(term in company.lower() for term in ["ltd", "limited", "pvt", "inc", "corp"]):
            # Likely larger company
            if seniority in ["director", "vp", "c_level"]:
                industry_adjustment += 15
        
        final_notice = max(15, base_notice + industry_adjustment)
        
        # Format string with reasoning
        if final_notice <= 15:
            return "Immediate to 15 days (Entry-level/startup)"
        elif final_notice <= 30:
            return "30 days (Standard notice)"
        elif final_notice <= 60:
            return "60 days (Senior role)"
        else:
            return "90+ days (Leadership role)"
    
    def _determine_seniority(self, current_role: str) -> str:
        """Determine seniority from role title."""
        
        role = current_role.lower()
        
        if any(term in role for term in ["ceo", "cto", "cfo", "coo", "chief"]):
            return "c_level"
        elif any(term in role for term in ["vp", "vice president", "svp"]):
            return "vp"
        elif any(term in role for term in ["director", "head of", "associate director"]):
            return "director"
        elif any(term in role for term in ["senior manager", "general manager", "sgm", "principal"]):
            return "lead"
        elif "manager" in role or "lead" in role:
            return "senior"
        elif "senior" in role or "sr." in role:
            return "mid"
        elif "junior" in role or "jr." in role:
            return "junior"
        else:
            return "entry"
    
    # ================================================================
    # URGENCY CALCULATION (Enhanced)
    # ================================================================
    
    def _calculate_urgency(
        self,
        candidate: Dict,
        profile_signals: List[str],
        company_health: Dict
    ) -> int:
        """
        Calculate urgency score (0-10) with company health.
        
        Higher score = more likely to respond/move quickly
        """
        
        score = 0
        
        # Company health is a MAJOR factor
        if company_health.get("status") == "unstable":
            score += 5  # Very high urgency if company is failing
        elif company_health.get("status") == "at_risk":
            score += 3  # Moderate urgency
        elif company_health.get("status") == "healthy":
            score -= 1  # Might be less interested
        
        # Profile signals
        for signal in profile_signals:
            if "open to work" in signal.lower():
                score += 4  # Very strong signal
            elif "🟢" in signal:
                score += 2  # Positive job-seeking signal
            elif "🟡" in signal:
                score += 1  # Mild signal
            elif "🔴" in signal:
                score -= 1  # Negative signal
        
        # Recent profile update
        last_update = candidate.get("last_profile_update")
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                days_since = (datetime.now() - last_update_date).days
                
                if days_since < 7:
                    score += 3
                elif days_since < 30:
                    score += 2
                elif days_since > 365:
                    score -= 2  # Very stale profile
            except:
                pass
        
        # Tenure
        tenure_months = candidate.get("tenure_months", 0)
        if tenure_months < 6:
            score += 2  # Very short tenure
        elif tenure_months < 12:
            score += 1
        elif tenure_months > 60:
            score -= 2  # Very long tenure
        
        # Cap at 0-10
        return max(0, min(score, 10))
    
    # ================================================================
    # AVAILABILITY ESTIMATION (Enhanced)
    # ================================================================
    
    def _estimate_availability(
        self,
        notice_period: str,
        urgency_score: int,
        company_health: Dict
    ) -> str:
        """
        Estimate when candidate could realistically start.
        
        Takes into account urgency and company situation.
        """
        
        # Parse base days from notice period
        if "Immediate" in notice_period or "15 days" in notice_period:
            base_days = 15
        elif "30 days" in notice_period:
            base_days = 30
        elif "60 days" in notice_period:
            base_days = 60
        else:
            base_days = 90
        
        # Adjust for urgency
        if urgency_score >= 8:
            # Very high urgency
            adjusted_days = int(base_days * 0.6)
            if company_health.get("status") == "unstable":
                return f"⚡ Available in ~{adjusted_days} days (company instability + active search - may negotiate immediate start)"
            else:
                return f"⚡ Available in ~{adjusted_days} days (actively job hunting - may negotiate shorter notice)"
        
        elif urgency_score >= 6:
            # Moderate urgency
            adjusted_days = int(base_days * 0.8)
            return f"Available in ~{adjusted_days} days (showing job search signals)"
        
        elif urgency_score >= 4:
            # Some interest
            return f"Available in ~{base_days} days (standard notice period)"
        
        else:
            # Low urgency - passive candidate
            adjusted_days = int(base_days * 1.3)
            if company_health.get("status") == "healthy":
                return f"Available in {adjusted_days}+ days (passive candidate at stable company - may need convincing)"
            else:
                return f"Available in ~{base_days} days (not actively looking but company situation may motivate move)"
    
    # ================================================================
    # HELPER METHODS
    # ================================================================
    
    def _format_last_update(self, candidate: Dict) -> str:
        """Format last profile update date."""
        
        last_update = candidate.get("last_profile_update")
        if last_update:
            try:
                last_update_date = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
                return last_update_date.strftime("%B %d, %Y")
            except:
                return "Unknown"
        return "Unknown"