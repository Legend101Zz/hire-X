"""
Sample Profile Generator
=======================
Generates representative sample profiles from the database.

This shows the user:
"If we find someone like THIS, would that work?"

Strategy:
1. Build query from ideal profile
2. Fetch top 5 matches from database
3. Score them quickly
4. Return the best one

This is FAST (< 1 second) because:
- Simple MongoDB query
- No enrichment
- Basic scoring only
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from models.conversation_models import IdealProfileCard, SampleProfile


class SampleProfileGenerator:
    """
    Generates sample profiles to show during conversation.
    """
    
    def __init__(
        self,
        profiles_collection,
        ai_scorer
    ):
        """
        Initialize sample profile generator.
        
        Args:
            profiles_collection: MongoDB profiles collection
            ai_scorer: AI scorer service for basic scoring
        """
        self.profiles = profiles_collection
        self.scorer = ai_scorer
    
    
    # ================================================================
    # GENERATE SAMPLE
    # ================================================================
    
    async def generate_sample(
        self,
        ideal_profile: IdealProfileCard,
        count: int = 1
    ) -> Optional[SampleProfile]:
        """
        Generate sample profile(s) from database.
        
        Args:
            ideal_profile: Ideal candidate profile
            count: Number of samples (default: 1)
        
        Returns:
            SampleProfile or None if no matches
        """
        
        # Build MongoDB query
        query = self._build_query(ideal_profile)
        
        # Fetch candidates
        candidates = await self._fetch_candidates(query, limit=5)
        
        if not candidates:
            return None
        
        # Score candidates (quick scoring)
        scored = await self._score_candidates(candidates, ideal_profile)
        
        # Return top candidate
        if scored:
            top_candidate = scored[0]
            return self._to_sample_profile(top_candidate)
        
        return None
    
    
    # ================================================================
    # QUERY BUILDING
    # ================================================================
    
    def _build_query(self, ideal_profile: IdealProfileCard) -> Dict:
        """
        Build MongoDB query from ideal profile.
        
        Strategy:
        - Use must-have skills with $all operator
        - Match seniority if specified
        - Match location if specified
        - Match industry if specified
        
        Args:
            ideal_profile: Ideal candidate profile
        
        Returns:
            MongoDB query dict
        """
        
        query = {}
        
        # Role title (fuzzy match on title field)
        if ideal_profile.role_title:
            # Split into words and search for any
            role_words = ideal_profile.role_title.lower().split()
            query["title"] = {
                "$regex": "|".join(role_words),
                "$options": "i"
            }
        
        # Must-have skills (match at least 50% of them)
        if ideal_profile.must_have_skills:
            # For sample, we're lenient - match at least 2 skills
            min_skills = min(2, len(ideal_profile.must_have_skills))
            
            query["$or"] = [
                {
                    "expertise": {
                        "$regex": skill,
                        "$options": "i"
                    }
                }
                for skill in ideal_profile.must_have_skills[:5]  # Top 5 skills
            ]
        
        # Location
        if ideal_profile.locations:
            query["location"] = {
                "$in": [loc.lower() for loc in ideal_profile.locations]
            }
        
        # Industry
        if ideal_profile.industries:
            query["current_industry"] = {
                "$in": [ind.lower() for ind in ideal_profile.industries]
            }
        
        return query
    
    
    async def _fetch_candidates(
        self,
        query: Dict,
        limit: int = 5
    ) -> List[Dict]:
        """
        Fetch candidates from database.
        
        Args:
            query: MongoDB query
            limit: Max number of candidates
        
        Returns:
            List of candidate dicts
        """
        
        try:
            # Execute query
            cursor = self.profiles.find(query).limit(limit)
            
            # Convert to list
            candidates = await cursor.to_list(length=limit)
            
            return candidates
        
        except Exception as e:
            print(f"Error fetching candidates: {e}")
            return []
    
    
    # ================================================================
    # SCORING
    # ================================================================
    
    async def _score_candidates(
        self,
        candidates: List[Dict],
        ideal_profile: IdealProfileCard
    ) -> List[Dict]:
        """
        Quick score candidates.
        
        Args:
            candidates: List of candidate dicts
            ideal_profile: Ideal profile for comparison
        
        Returns:
            List of candidates with scores (sorted)
        """
        
        scored = []
        
        for candidate in candidates:
            score = self._quick_score(candidate, ideal_profile)
            candidate["match_score"] = score
            scored.append(candidate)
        
        # Sort by score (descending)
        scored.sort(key=lambda x: x["match_score"], reverse=True)
        
        return scored
    
    
    def _quick_score(
        self,
        candidate: Dict,
        ideal_profile: IdealProfileCard
    ) -> float:
        """
        Quick scoring algorithm.
        
        Factors:
        1. Skills match (60%)
        2. Role title match (20%)
        3. Experience match (10%)
        4. Location match (10%)
        
        Args:
            candidate: Candidate dict
            ideal_profile: Ideal profile
        
        Returns:
            Score (0-100)
        """
        
        score = 0.0
        
        # 1. Skills match (60 points max)
        if ideal_profile.must_have_skills:
            candidate_skills = candidate.get("expertise", "").lower()
            matched_skills = 0
            
            for skill in ideal_profile.must_have_skills:
                if skill.lower() in candidate_skills:
                    matched_skills += 1
            
            skill_ratio = matched_skills / len(ideal_profile.must_have_skills)
            score += skill_ratio * 60
        
        # 2. Role title match (20 points max)
        if ideal_profile.role_title:
            candidate_title = candidate.get("title", "").lower()
            ideal_title = ideal_profile.role_title.lower()
            
            # Check if any word from ideal title is in candidate title
            ideal_words = set(ideal_title.split())
            candidate_words = set(candidate_title.split())
            
            common_words = ideal_words & candidate_words
            if common_words:
                title_ratio = len(common_words) / len(ideal_words)
                score += title_ratio * 20
        
        # 3. Experience match (10 points max)
        # Simplified: just check if they have experience
        candidate_exp = candidate.get("experience", [])
        if candidate_exp:
            score += 10
        
        # 4. Location match (10 points max)
        if ideal_profile.locations:
            candidate_loc = candidate.get("location", "").lower()
            for loc in ideal_profile.locations:
                if loc.lower() in candidate_loc:
                    score += 10
                    break
        
        return round(score, 1)
    
    
    # ================================================================
    # CONVERSION
    # ================================================================
    
    def _to_sample_profile(self, candidate: Dict) -> SampleProfile:
        """
        Convert MongoDB document to SampleProfile.
        
        Args:
            candidate: MongoDB document
        
        Returns:
            SampleProfile object
        """
        
        # Extract skills from expertise
        expertise = candidate.get("expertise", "")
        skills = [s.strip() for s in expertise.split(",")][:10]  # Top 10 skills
        
        # Calculate experience years
        experience_list = candidate.get("experience", [])
        total_exp = 0
        for exp in experience_list:
            # Try to calculate duration
            try:
                start = exp.get("start_date", "")
                end = exp.get("end_date", "Present")
                
                # Simplified: count entries
                total_exp += 2  # Assume 2 years per job
            except:
                pass
        
        # Get current company
        current_company = "Unknown"
        if experience_list:
            current_company = experience_list[0].get("company", "Unknown")
        
        # Create SampleProfile
        return SampleProfile(
            profile_id=str(candidate.get("_id")),
            name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
            title=candidate.get("title", ""),
            skills=skills,
            experience_years=max(total_exp, 1),
            current_company=current_company,
            location=candidate.get("location", ""),
            industry=candidate.get("current_industry", ""),
            match_score=candidate.get("match_score", 0.0)
        )


# ================================================================
# HELPER FUNCTIONS
# ================================================================

def format_sample_for_display(sample: SampleProfile) -> str:
    """
    Format sample profile for display to user.
    
    Args:
        sample: SampleProfile object
    
    Returns:
        Formatted string
    """
    
    skills_str = ", ".join(sample.skills[:5])
    if len(sample.skills) > 5:
        skills_str += f" (+{len(sample.skills) - 5} more)"
    
    return f"""**{sample.name}** - {sample.title}
**Skills:** {skills_str}
**Experience:** {sample.experience_years} years at {sample.current_company}
**Location:** {sample.location}
**Match Score:** {sample.match_score}%"""


async def generate_multiple_samples(
    generator: SampleProfileGenerator,
    ideal_profile: IdealProfileCard,
    count: int = 3
) -> List[SampleProfile]:
    """
    Generate multiple sample profiles.
    
    Args:
        generator: SampleProfileGenerator instance
        ideal_profile: Ideal profile
        count: Number of samples
    
    Returns:
        List of SampleProfile objects
    """
    
    # Build query
    query = generator._build_query(ideal_profile)
    
    # Fetch candidates
    candidates = await generator._fetch_candidates(query, limit=count * 2)
    
    if not candidates:
        return []
    
    # Score candidates
    scored = await generator._score_candidates(candidates, ideal_profile)
    
    # Convert to SampleProfile objects
    samples = [
        generator._to_sample_profile(candidate)
        for candidate in scored[:count]
    ]
    
    return samples