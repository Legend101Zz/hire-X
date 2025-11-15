"""
Sample Profile Generator V2 - Working Version
==============================================
"""

import logging
from typing import Any, Dict, List, Optional

from pymongo.asynchronous.collection import AsyncCollection

from models.conversation_models import IdealProfileCard, SampleProfile
from services.ai_parser import AIParser
from services.query_builder import QueryBuilder, QueryStrategy
from services.query_debugger import QueryDebugger

logger = logging.getLogger(__name__)


class SampleProfileGeneratorV2:
    """V2 sample generator."""
    
    MAX_ATTEMPTS = 5
    
    def __init__(
        self,
        profiles_collection: AsyncCollection, 
        ai_parser: AIParser 
    ):
        self.profiles_collection = profiles_collection
        self.debugger = QueryDebugger(ai_parser)
    
    async def generate_sample(
        self,
        ideal_profile: IdealProfileCard,
        limit: int = 1
    ) -> Dict[str, Any]:
        """Generate sample profile."""
        
        if self.profiles_collection is None:
            logger.warning("Profiles collection not available")
            return {
                "sample_profile": None,
                "query_log": [],
                "needs_clarification": False,
                "clarifying_questions": []
            }
        
        # Convert to dict
        profile_dict = ideal_profile.dict() if hasattr(ideal_profile, 'dict') else ideal_profile
        
        # Initialize query builder
        builder = QueryBuilder(profile_dict)
        
        # Track attempts
        query_log = []
        
        # Try strategies in order
        strategies = [
            QueryStrategy.EXACT,
            QueryStrategy.RELAXED_LOCATION,
            QueryStrategy.TITLE_SKILLS,
            QueryStrategy.TITLE_ONLY,
            QueryStrategy.MINIMAL
        ]
        
        for attempt, strategy in enumerate(strategies):
            logger.info(f"🔍 Attempt {attempt + 1}: {strategy}")
            
            # Build query
            query = builder.build(strategy)
            query_desc = builder.describe_query(query)
            
            logger.info(f"📋 Query: {query_desc}")
            
            # Execute query
            try:
                cursor = self.profiles_collection.find(query).limit(limit * 5).max_time_ms(10000)
                
                candidates = await cursor.to_list(length=limit * 5)
                result_count = len(candidates)
                
                logger.info(f"✅ Found {result_count} candidates")
                
                # Log attempt
                query_log.append({
                    "attempt": attempt + 1,
                    "strategy": strategy,
                    "query": query_desc,
                    "results": result_count
                })
                
                # If we found results, return best one
                if result_count > 0:
                    # Quick score candidates
                    scored = self._quick_score_candidates(candidates, profile_dict)
                    
                    # Return top candidate
                    best = scored[0] if scored else candidates[0]
                    sample = self._convert_to_sample(best, profile_dict)
                    
                    return {
                        "sample_profile": sample,
                        "query_log": query_log,
                        "needs_clarification": False,
                        "clarifying_questions": []
                    }
                
                # No results - try next strategy
                logger.warning(f"⚠️ No results with {strategy}")
            
            except Exception as e:
                logger.error(f"❌ Query error: {e}")
                query_log.append({
                    "attempt": attempt + 1,
                    "strategy": strategy,
                    "query": query_desc,
                    "error": str(e)
                })
        
        # Exhausted all strategies
        logger.warning("🚫 All strategies exhausted")
        
        return {
            "sample_profile": None,
            "query_log": query_log,
            "needs_clarification": True,
            "clarifying_questions": [
                "I couldn't find matching candidates. Could you try different keywords?",
                "What alternative job titles should I search for?",
                "Should I search in different locations or industries?"
            ]
        }
    
    def _quick_score_candidates(
        self,
        candidates: List[Dict],
        ideal_profile: Dict
    ) -> List[Dict]:
        """Quick score and sort candidates."""
        
        for candidate in candidates:
            score = 0
            
            # Title match (50 points)
            if ideal_profile.get("role_title"):
                title = candidate.get("title", "").lower()
                role = ideal_profile["role_title"].lower()
                
                # Check word overlap
                title_words = set(title.split())
                role_words = set(role.split())
                overlap = title_words & role_words
                
                if overlap:
                    score += 50 * (len(overlap) / len(role_words))
            
            # Skills match (30 points)
            if ideal_profile.get("must_have_skills"):
                expertise = candidate.get("expertise", "").lower()
                matched = 0
                
                for skill in ideal_profile["must_have_skills"]:
                    if skill.lower() in expertise:
                        matched += 1
                
                if ideal_profile["must_have_skills"]:
                    score += 30 * (matched / len(ideal_profile["must_have_skills"]))
            
            # Location match (10 points)
            if ideal_profile.get("locations"):
                location = candidate.get("location", "").lower()
                for loc in ideal_profile["locations"]:
                    if loc.lower() in location:
                        score += 10
                        break
            
            # Industry match (10 points)
            if ideal_profile.get("industries"):
                industry = candidate.get("current_industry", "").lower()
                for ind in ideal_profile["industries"]:
                    if ind.lower() in industry:
                        score += 10
                        break
            
            candidate["match_score"] = round(score, 1)
        
        # Sort by score
        candidates.sort(key=lambda x: x.get("match_score", 0), reverse=True)
        
        return candidates
    
    def _convert_to_sample(
        self,
        candidate: Dict,
        ideal_profile: Dict
    ) -> SampleProfile:
        """Convert DB candidate to SampleProfile."""
        
        # Extract skills
        expertise = candidate.get("expertise", "")
        if isinstance(expertise, list):
            skills = expertise[:5]
        elif isinstance(expertise, str) and expertise != "NA":
            skills = [s.strip() for s in expertise.split(",")][:5]
        else:
            skills = []
        
        # Estimate experience from title/seniority
        seniority = candidate.get("seniority_level", "").lower()
        title = candidate.get("title", "").lower()
        
        if "senior" in title or "senior" in seniority:
            exp_years = 7
        elif "lead" in title or "principal" in title:
            exp_years = 10
        elif "junior" in title or "entry" in seniority:
            exp_years = 2
        else:
            exp_years = 5
        
        # Get current company from experience array
        current_company = "Unknown"
        experience = candidate.get("experience", [])
        if experience and experience != ['NA']:
            if isinstance(experience, list) and len(experience) > 0:
                if isinstance(experience[0], dict):
                    current_company = experience[0].get("company", "Unknown")
        
        return SampleProfile(
            profile_id=str(candidate.get("_id", "")),
            name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip() or "Sample Candidate",
            title=candidate.get("title", ideal_profile.get("role_title", "")),
            skills=skills,
            experience_years=exp_years,
            current_company=current_company,
            location=candidate.get("location", "India"),
            industry=candidate.get("current_industry", "Technology"),
            match_score=candidate.get("match_score", 75)
        )