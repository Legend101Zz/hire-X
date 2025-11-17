"""
Sample Profile Generator V3 - Fast & Accurate
==============================================
"""

import json
import time
from typing import Any, Dict, List

from pymongo.asynchronous.mongo_client import AsyncMongoClient

from core.logging_config import get_logger
from models.conversation_models import IdealProfileCard, SampleProfile
from services.query_builder import QueryBuilder, QueryStrategy

logger = get_logger(__name__)


class SampleProfileGeneratorV2:
    """Generates sample profiles using proper indexes."""
    
    def __init__(
        self,
        profiles_collection:  AsyncMongoClient
    ):
        self.profiles_collection = profiles_collection
    
    async def generate_sample(
        self,
        ideal_profile: IdealProfileCard,
        limit: int = 1
    ) -> Dict[str, Any]:
        """
        Generate sample profile with proper indexing.
        
        Strategy:
        1. Try indexed queries first (fast)
        2. Fetch 50 candidates
        3. Filter must-have skills in Python
        4. Score and return best
        """
        
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
        
        # Strategies that use indexes
        strategies = [
            QueryStrategy.INDUSTRY_SENIORITY,  # Best: uses compound index
            QueryStrategy.INDUSTRY_ONLY,
            QueryStrategy.SENIORITY_ONLY,
            QueryStrategy.TITLE_WORDS,
            QueryStrategy.MINIMAL
        ]
        
        for attempt, strategy in enumerate(strategies):
            logger.info(f"🔍 Attempt {attempt + 1}: {strategy.value}")
            
            # Build query
            query = builder.build(strategy)
            query_desc = builder.describe_query(query)
            
            # ✅ Log query for debugging
            logger.info(f"📋 Query: {query_desc}")
            logger.info(f"🔎 MongoDB: {json.dumps(query, indent=2)}")
            
            try:
                # ✅ Fetch candidates with TIMEOUT
                fetch_limit = 50  # Reasonable number for filtering
                
                cursor = self.profiles_collection.find(query) \
                    .limit(fetch_limit) \
                    .max_time_ms(2000)  # 2 second timeout
                
                start_time = time.time()
                candidates = await cursor.to_list(length=fetch_limit)
                query_time = time.time() - start_time
                
                logger.info(f"✅ Found {len(candidates)} in {query_time:.2f}s")
                
                # Log attempt
                query_log.append({
                    "attempt": attempt + 1,
                    "strategy": strategy.value,
                    "query": query_desc,
                    "time_ms": round(query_time * 1000),
                    "results_raw": len(candidates)
                })
                
                if len(candidates) == 0:
                    logger.warning(f"⚠️ No results with {strategy.value}")
                    continue
                
                # ✅ Filter by must-have skills in Python
                must_have = profile_dict.get("must_have_skills", [])
                filtered = self._filter_by_must_have_skills(candidates, must_have)
                
                logger.info(f"📊 After must-have filter: {len(filtered)} candidates")
                query_log[-1]["results_filtered"] = len(filtered)
                
                if len(filtered) == 0:
                    logger.warning("⚠️ No candidates with must-have skills")
                    continue
                
                # ✅ Score candidates
                scored = self._score_candidates(filtered, profile_dict)
                
                # ✅ Check if best score meets threshold
                best = scored[0]
                if best["match_score"] >= 40.0:  # Lower threshold (40%)
                    sample = self._convert_to_sample(best, profile_dict)
                    
                    logger.info(f"🎯 Best: {sample.get('name')} ({best['match_score']:.1f}%)")
                    
                    return {
                        "sample_profile": sample,
                        "query_log": query_log,
                        "needs_clarification": False,
                        "clarifying_questions": []
                    }
                else:
                    logger.warning(f"⚠️ Best score {best['match_score']:.1f}% below 40%")
            
            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Query error: {error_msg}")
                
                query_log.append({
                    "attempt": attempt + 1,
                    "strategy": strategy.value,
                    "query": query_desc,
                    "error": error_msg
                })
                
                # If timeout, continue to next strategy
                if "time limit" in error_msg.lower() or "timeout" in error_msg.lower():
                    logger.warning("⏱️ Timeout - trying next strategy")
                    continue
        
        # All strategies failed
        logger.warning("🚫 All strategies exhausted")
        
        return {
            "sample_profile": None,
            "query_log": query_log,
            "needs_clarification": True,
            "clarifying_questions": self._generate_clarifying_questions(profile_dict, query_log)
        }
    
    def _filter_by_must_have_skills(
        self,
        candidates: List[Dict],
        must_have_skills: List[str]
    ) -> List[Dict]:
        """Filter candidates by must-have skills in Python."""
        
        if not must_have_skills:
            return candidates
        
        filtered = []
        top_skills = must_have_skills[:4]  # Top 4 skills
        min_required = max(1, len(top_skills) // 2)  # At least 1, or 50%
        
        for candidate in candidates:
            expertise = candidate.get("expertise", "").lower()
            title = candidate.get("title", "").lower()
            searchable = f"{expertise} {title}"
            
            matches = 0
            matched = []
            
            for skill in top_skills:
                # Handle variations (Next.js → next, nextjs)
                skill_variations = [
                    skill.lower(),
                    skill.lower().replace(".", ""),
                    skill.lower().replace(" ", ""),
                    skill.lower().split(".")[0],  # "next" from "next.js"
                ]
                
                if any(var in searchable for var in skill_variations):
                    matches += 1
                    matched.append(skill)
            
            if matches >= min_required:
                candidate["_matched_skills"] = matched
                candidate["_match_count"] = matches
                filtered.append(candidate)
        
        # Sort by match count
        filtered.sort(key=lambda x: x.get("_match_count", 0), reverse=True)
        
        return filtered
    
    def _score_candidates(
        self,
        candidates: List[Dict],
        profile: Dict
    ) -> List[Dict]:
        """Score candidates (must-have skills already filtered)."""
        
        scored = []
        must_have = profile.get("must_have_skills", [])
        nice_to_have = profile.get("nice_to_have_skills", [])
        
        for candidate in candidates:
            score = 0.0
            
            # 1. Must-have match (60 points)
            matched_count = candidate.get("_match_count", 0)
            if must_have:
                ratio = matched_count / len(must_have[:4])
                score += ratio * 60
            
            # 2. Nice-to-have (20 points)
            if nice_to_have:
                expertise = candidate.get("expertise", "").lower()
                nice_matches = sum(1 for s in nice_to_have[:5] if s.lower() in expertise)
                score += (nice_matches / len(nice_to_have[:5])) * 20
            
            # 3. Seniority match (10 points)
            if profile.get("seniority"):
                cand_sen = candidate.get("seniority_level", "").lower()
                prof_sen = profile["seniority"].lower()
                if prof_sen in cand_sen or cand_sen in prof_sen:
                    score += 10
            
            # 4. Title relevance (10 points)
            if profile.get("role_title"):
                cand_title = candidate.get("title", "").lower()
                prof_title = profile["role_title"].lower()
                common_words = len(set(prof_title.split()) & set(cand_title.split()))
                score += min(common_words * 2, 10)
            
            candidate["match_score"] = round(score, 1)
            scored.append(candidate)
        
        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored
    
    def _convert_to_sample(
        self,
        candidate: Dict,
        profile: Dict
    ) -> SampleProfile:
        """Convert MongoDB doc to SampleProfile."""
        
        # Extract skills
        expertise = candidate.get("expertise", "")
        skills = [s.strip() for s in expertise.split(",") if s.strip()][:10]
        
        # Get experience years
        exp_years = candidate.get("experience_years", 0)
        if not exp_years:
            # Estimate from experience array
            exp_list = candidate.get("experience", [])
            if exp_list and exp_list != ["NA"]:
                exp_years = len(exp_list) * 2  # Rough estimate
        
        return SampleProfile(
            profile_id=str(candidate.get("_id", "")),
            name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
            title=candidate.get("title", ""),
            skills=skills,
            experience_years=exp_years,
            current_company=self._extract_current_company(candidate),
            location=candidate.get("location", ""),
            industry=candidate.get("current_industry", ""),
            match_score=candidate.get("match_score", 0.0)
        )
    
    def _extract_current_company(self, candidate: Dict) -> str:
        """Extract current company from experience."""
        exp_list = candidate.get("experience", [])
        if exp_list and exp_list != ["NA"] and len(exp_list) > 0:
            if isinstance(exp_list[0], dict):
                return exp_list[0].get("company", "Unknown")
        return "Unknown"
    
    def _generate_clarifying_questions(
        self,
        profile: Dict,
        query_log: List[Dict]
    ) -> List[str]:
        """Generate helpful clarifying questions."""
        
        questions = []
        
        # Check what failed
        role = profile.get("role_title", "")
        skills = profile.get("must_have_skills", [])
        
        if role:
            questions.append(f"Should I search for alternative titles like '{role.replace('Senior', 'Lead')}'?")
        
        if skills:
            questions.append(f"Can candidates have {len(skills)-1} out of {len(skills)} must-have skills?")
        
        questions.append("Should I expand to more industries or locations?")
        
        return questions[:3]