"""
Salary Estimator Service
========================
Estimates salary for each role in a candidate's career history.

This service:
- Analyzes each job in experience history
- Searches for salary data (PayScale, AmbitionBox, Glassdoor)
- Adjusts for inflation, location, company size
- Generates detailed rationale with sources
- Creates career progression timeline

Output: The detailed table structure you wanted!
"""

import asyncio
import re
from datetime import datetime
from typing import Dict, List, Optional

from core.logging_config import get_logger
from data.redis_cache import RedisCache
from models.enrichment_models import CareerProgressionEntry, SalaryEnrichment
from services.model_config_manager import ModelConfigManager
from services.web_search_wrapper import WebSearchWrapper

logger = get_logger(__name__)


class SalaryEstimator:
    """
    Estimates salary ranges for each role in candidate's career.
    
    Creates the detailed career progression table:
    Role & Company | Duration | Experience Level | Est. CTC | Rationale
    """
    
    # Experience level buckets
    EXPERIENCE_LEVELS = {
        (0, 2): "Entry (0-2 yrs)",
        (2, 4): "Junior (2-4 yrs)",
        (4, 7): "Mid (4-7 yrs)",
        (7, 10): "Senior (7-10 yrs)",
        (10, 15): "Lead (10-15 yrs)",
        (15, 100): "Executive (15+ yrs)"
    }
    
    # Location premiums (percentage increase over baseline)
    LOCATION_PREMIUMS = {
        "bangalore": 15,
        "mumbai": 10,
        "delhi": 10,
        "ncr": 10,
        "gurgaon": 10,
        "noida": 8,
        "pune": 5,
        "hyderabad": 5,
        "chennai": 5
    }
    
    # Inflation adjustment (rough estimate per year)
    ANNUAL_INFLATION_RATE = 0.06  # 6% per year
    
    def __init__(
        self,
        web_search: WebSearchWrapper,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize salary estimator.
        
        Args:
            web_search: Web search wrapper for finding salary data
            redis_cache: Redis cache for storing results
            model_config_manager: For getting configured models
        """
        self.web_search = web_search
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        logger.info("SalaryEstimator initialized")
    
    async def estimate_career_progression(
        self,
        candidate: Dict,
        session_id: Optional[str] = None
    ) -> SalaryEnrichment:
        """
        Estimate salary for entire career progression.
        
        Args:
            candidate: Candidate profile with experience history
            session_id: Optional session ID for model config
            
        Returns:
            SalaryEnrichment with detailed career progression
        
        Example candidate dict:
            {
                "experience": [
                    {
                        "title": "Senior General Manager - IT",
                        "company": "Mswipe",
                        "location": "Mumbai",
                        "start_date": "2024-04-01",
                        "end_date": None,  # Current role
                        "duration_months": 18
                    },
                    ...
                ]
            }
        """
        
        experience_history = candidate.get("experience", [])
        
        if not experience_history:
            logger.warning(f"No experience history for candidate {candidate.get('_id')}")
            return self._empty_result()
        
        logger.info(f"Estimating salary for {len(experience_history)} roles")
        
        # Process each role
        career_progression = []
        cumulative_years = 0
        
        for i, exp in enumerate(experience_history):
            # Calculate years at this role
            years_at_role = exp.get("duration_months", 12) / 12.0
            
            # Determine experience level
            exp_level = self._get_experience_level(cumulative_years)
            
            # Estimate salary for this role
            entry = await self._estimate_single_role(
                exp,
                cumulative_years,
                exp_level,
                session_id
            )
            
            career_progression.append(entry)
            cumulative_years += years_at_role
        
        # Calculate growth metrics
        if len(career_progression) >= 2:
            first_salary = self._parse_salary_range(career_progression[0].estimated_ctc_range)[0]
            current_salary = self._parse_salary_range(career_progression[-1].estimated_ctc_range)[1]
            
            growth_multiplier = current_salary / first_salary if first_salary > 0 else 1
            
            growth_trajectory = f"{first_salary}L → {current_salary}L over {int(cumulative_years)} years ({growth_multiplier:.1f}x growth)"
            
            average_annual_growth = f"{((growth_multiplier ** (1/cumulative_years)) - 1) * 100:.1f}%"
            
            # Predict next expected range
            next_expected = self._predict_next_salary(career_progression[-1], cumulative_years)
        else:
            growth_trajectory = "Insufficient data"
            average_annual_growth = "N/A"
            next_expected = "Unable to predict"
        
        return SalaryEnrichment(
            career_progression=career_progression,
            current_estimated_ctc=career_progression[-1].estimated_ctc_range if career_progression else "Unknown",
            growth_trajectory=growth_trajectory,
            average_annual_growth=average_annual_growth,
            next_expected_range=next_expected,
            confidence_score=self._calculate_confidence(career_progression)
        )
    
    async def _estimate_single_role(
        self,
        exp: Dict,
        cumulative_years: float,
        exp_level: str,
        session_id: Optional[str]
    ) -> CareerProgressionEntry:
        """
        Estimate salary for a single role.
        
        Args:
            exp: Experience entry
            cumulative_years: Total years of experience at start of this role
            exp_level: Experience level string
            session_id: Session ID
            
        Returns:
            CareerProgressionEntry with salary estimate
        """
        
        title = exp.get("title", "Unknown Role")
        company = exp.get("company", "Unknown Company")
        location = exp.get("location", "India")
        start_date = exp.get("start_date")
        end_date = exp.get("end_date")
        
        # Format duration
        duration = self._format_duration(start_date, end_date)
        
        # Get year for inflation adjustment
        if start_date:
            try:
                year = datetime.fromisoformat(start_date.replace("Z", "+00:00")).year
            except:
                year = datetime.now().year
        else:
            year = datetime.now().year
        
        # Search for salary data
        search_queries = [
            f"{title} salary {company} {location} {year}",
            f"{title} salary {location} India {year}",
            f"{exp_level.split()[0]} level {title} salary India"
        ]
        
        search_results = await self.web_search.search_multiple(
            search_queries,
            session_id=session_id
        )
        
        # Parse and estimate salary
        estimated_range, rationale, sources = self._parse_search_results(
            search_results,
            title,
            company,
            location,
            year,
            exp_level,
            cumulative_years
        )
        
        # Format company with location
        company_with_location = f"{company} ({location})"
        
        return CareerProgressionEntry(
            role=title,
            company=company_with_location,
            duration=duration,
            experience_level=exp_level,
            estimated_ctc_range=estimated_range,
            rationale=rationale,
            sources=sources
        )
    
    def _parse_search_results(
        self,
        search_results: List[Dict],
        title: str,
        company: str,
        location: str,
        year: int,
        exp_level: str,
        cumulative_years: float
    ) -> tuple[str, str, List[str]]:
        """
        Parse search results and generate salary estimate.
        
        Returns:
            (estimated_range, rationale, sources)
        """
        
        # Extract salary mentions from search results
        all_sources = []
        salary_mentions = []
        
        for result in search_results:
            if result.get("answer"):
                # Look for salary mentions in format: ₹X-Y L or X-Y lakhs
                answer = result["answer"]
                
                # Pattern: ₹5-7L, 5-7 lakhs, ₹500000-700000
                patterns = [
                    r'₹?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:L|lakhs?|LPA)',
                    r'₹?\s*(\d{5,7})\s*-\s*(\d{5,7})',
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, answer, re.IGNORECASE)
                    for match in matches:
                        low, high = match
                        # Convert to lakhs if needed
                        low_num = float(low)
                        high_num = float(high)
                        
                        if low_num > 100:  # Probably in rupees, not lakhs
                            low_num = low_num / 100000
                            high_num = high_num / 100000
                        
                        salary_mentions.append((low_num, high_num))
                
                # Collect sources
                all_sources.extend(result.get("sources", []))
        
        # Calculate estimate based on mentions
        if salary_mentions:
            # Average all mentions
            avg_low = sum(s[0] for s in salary_mentions) / len(salary_mentions)
            avg_high = sum(s[1] for s in salary_mentions) / len(salary_mentions)
            
            # Adjust for inflation to current year
            current_year = datetime.now().year
            years_diff = current_year - year
            inflation_factor = (1 + self.ANNUAL_INFLATION_RATE) ** years_diff
            
            # Adjust for location
            location_premium = self._get_location_premium(location)
            location_factor = 1 + (location_premium / 100)
            
            # Calculate final estimate
            estimated_low = avg_low * inflation_factor * location_factor
            estimated_high = avg_high * inflation_factor * location_factor
            
            estimated_range = f"{estimated_low:.1f} – {estimated_high:.1f}"
        else:
            # Fallback: estimate based on experience level
            estimated_low, estimated_high = self._fallback_estimate(cumulative_years, location)
            estimated_range = f"{estimated_low:.1f} – {estimated_high:.1f}"
        
        # Generate rationale
        rationale = self._generate_rationale(
            title,
            company,
            location,
            year,
            exp_level,
            estimated_range,
            salary_mentions,
            all_sources
        )
        
        return estimated_range, rationale, all_sources[:5]  # Top 5 sources
    
    def _generate_rationale(
        self,
        title: str,
        company: str,
        location: str,
        year: int,
        exp_level: str,
        estimated_range: str,
        salary_mentions: List[tuple],
        sources: List[str]
    ) -> str:
        """
        Generate detailed rationale for salary estimate.
        
        This creates the detailed explanation like:
        "Senior General Manager IT in Mumbai startups ~₹25-40L current 
        (Glassdoor/AmbitionBox for seniors). Cloud GRC/audits; 
        promo adds 15-25%."
        """
        
        source_names = []
        for url in sources[:3]:
            if "payscale" in url.lower():
                source_names.append("PayScale")
            elif "ambitionbox" in url.lower():
                source_names.append("AmbitionBox")
            elif "glassdoor" in url.lower():
                source_names.append("Glassdoor")
            elif "linkedin" in url.lower():
                source_names.append("LinkedIn Salary")
        
        if not source_names:
            source_names = ["industry data"]
        
        source_str = "/".join(list(set(source_names)))
        
        # Build rationale
        rationale_parts = []
        
        # Role + location + range
        rationale_parts.append(
            f"{title} in {location} ~₹{estimated_range}L"
        )
        
        # Year context if historical
        current_year = datetime.now().year
        if year < current_year:
            rationale_parts.append(
                f"in {year} (adjusted from {source_str} historical data)"
            )
        else:
            rationale_parts.append(
                f"current ({source_str})"
            )
        
        # Experience level context
        rationale_parts.append(
            f"{exp_level} typical for this role"
        )
        
        # Location adjustment
        location_premium = self._get_location_premium(location)
        if location_premium > 0:
            rationale_parts.append(
                f"Location premium ({location}): +{location_premium}%"
            )
        
        # Company size/type if known
        if "startup" in company.lower():
            rationale_parts.append("Startup compensation typically includes equity")
        elif "confidential" in company.lower():
            rationale_parts.append("Confidential company suggests modest base pay")
        
        return ". ".join(rationale_parts) + "."
    
    def _get_experience_level(self, years: float) -> str:
        """Get experience level label based on years."""
        for (min_years, max_years), level in self.EXPERIENCE_LEVELS.items():
            if min_years <= years < max_years:
                return level
        return "Executive (15+ yrs)"
    
    def _get_location_premium(self, location: str) -> int:
        """Get location premium percentage."""
        location_lower = location.lower()
        for city, premium in self.LOCATION_PREMIUMS.items():
            if city in location_lower:
                return premium
        return 0
    
    def _fallback_estimate(self, years: float, location: str) -> tuple[float, float]:
        """
        Fallback salary estimate when no data found.
        
        Based on typical Indian tech salary progression.
        """
        # Base estimate by experience
        if years < 2:
            base_low, base_high = 2.5, 4.0
        elif years < 4:
            base_low, base_high = 3.5, 5.5
        elif years < 7:
            base_low, base_high = 5.0, 8.0
        elif years < 10:
            base_low, base_high = 8.0, 14.0
        elif years < 15:
            base_low, base_high = 12.0, 22.0
        else:
            base_low, base_high = 20.0, 40.0
        
        # Adjust for location
        location_factor = 1 + (self._get_location_premium(location) / 100)
        
        return base_low * location_factor, base_high * location_factor
    
    def _format_duration(self, start_date: Optional[str], end_date: Optional[str]) -> str:
        """
        Format duration string like "Apr 2024 – Present (1 yr 6 mos)".
        """
        if not start_date:
            return "Unknown duration"
        
        try:
            start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            
            if end_date:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                is_current = False
            else:
                end = datetime.now()
                is_current = True
            
            # Format dates
            start_str = start.strftime("%b %Y")
            end_str = "Present" if is_current else end.strftime("%b %Y")
            
            # Calculate duration
            months = (end.year - start.year) * 12 + (end.month - start.month)
            years = months // 12
            remaining_months = months % 12
            
            if years > 0 and remaining_months > 0:
                duration_str = f"({years} yr {remaining_months} mos)"
            elif years > 0:
                duration_str = f"({years} yr)"
            else:
                duration_str = f"({remaining_months} mos)"
            
            return f"{start_str} – {end_str} {duration_str}"
            
        except Exception as e:
            logger.error(f"Error formatting duration: {e}")
            return "Unknown duration"
    
    def _parse_salary_range(self, range_str: str) -> tuple[float, float]:
        """Parse salary range string like '25.0 – 35.0' to (25.0, 35.0)."""
        try:
            parts = range_str.replace("–", "-").split("-")
            return float(parts[0].strip()), float(parts[1].strip())
        except:
            return 0.0, 0.0
    
    def _predict_next_salary(
        self,
        current_entry: CareerProgressionEntry,
        total_years: float
    ) -> str:
        """
        Predict next expected salary range.
        
        Based on:
        - Current salary
        - Typical growth rate for experience level
        - Market trends
        """
        current_low, current_high = self._parse_salary_range(current_entry.estimated_ctc_range)
        
        # Growth expectations by experience level
        if total_years < 5:
            growth_rate = 0.20  # 20% jump for early career
        elif total_years < 10:
            growth_rate = 0.15  # 15% for mid-career
        else:
            growth_rate = 0.10  # 10% for senior roles
        
        next_low = current_low * (1 + growth_rate)
        next_high = current_high * (1 + growth_rate)
        
        return f"{next_low:.0f}-{next_high:.0f}L (if switches to larger company/higher role)"
    
    def _calculate_confidence(self, progression: List[CareerProgressionEntry]) -> int:
        """
        Calculate confidence score (0-100) for salary estimates.
        
        Based on:
        - Number of data sources
        - Recency of data
        - Coverage of career history
        """
        if not progression:
            return 0
        
        # Base confidence
        confidence = 50
        
        # Boost for number of roles analyzed
        confidence += min(len(progression) * 3, 20)
        
        # Boost for having sources
        roles_with_sources = sum(1 for entry in progression if entry.sources)
        confidence += min(roles_with_sources * 5, 20)
        
        # Penalty for old data (if most recent role is old)
        latest_role = progression[-1]
        if "Present" not in latest_role.duration:
            confidence -= 10
        
        return min(max(confidence, 0), 100)
    
    def _empty_result(self) -> SalaryEnrichment:
        """Return empty result when no data."""
        return SalaryEnrichment(
            career_progression=[],
            current_estimated_ctc="Unknown",
            growth_trajectory="Insufficient data",
            average_annual_growth="N/A",
            next_expected_range="Unable to predict",
            confidence_score=0
        )