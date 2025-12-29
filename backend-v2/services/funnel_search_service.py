# services/funnel_search_service.py - FIXED VERSION
"""
Funnel Search Service - FIXED
==============================
Fast, accurate search using the Index-First strategy.

CRITICAL FIX: No regex in MongoDB queries - all regex done in Python.
"""

import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from openai import OpenAI

from core.logging_config import get_logger

logger = get_logger(__name__)


# ============================================================================
# STATIC MAPPINGS (LinkedIn's actual values)
# ============================================================================

LINKEDIN_INDUSTRIES = {
    "Computer Software", "Information Technology and Services", "Internet",
    "Computer Hardware", "Computer Networking", "Computer & Network Security",
    "Semiconductors", "Telecommunications",
    "Financial Services", "Banking", "Investment Banking", "Investment Management",
    "Venture Capital & Private Equity", "Insurance", "Accounting",
    "Hospital & Health Care", "Medical Devices", "Pharmaceuticals",
    "Biotechnology", "Health, Wellness and Fitness",
    "E-Learning", "Education Management", "Higher Education",
    "Marketing and Advertising", "Online Media", "Entertainment",
    "Management Consulting", "Human Resources", "Staffing and Recruiting",
    "Retail", "Consumer Goods", "Automotive", "Aviation & Aerospace",
    "Oil & Energy", "Utilities", "Real Estate", "Construction",
    "Government Administration", "Legal Services", "Nonprofit Organization Management",
    "Research", "Design", "Graphic Design", "Media Production"
}

INDUSTRY_MAPPING = {
    "saas": ["Computer Software", "Information Technology and Services", "Internet"],
    "software": ["Computer Software", "Information Technology and Services"],
    "tech": ["Computer Software", "Information Technology and Services", "Internet"],
    "it": ["Information Technology and Services", "Computer Software"],
    "internet": ["Internet", "Computer Software"],
    "ai": ["Computer Software", "Information Technology and Services", "Research"],
    "ml": ["Computer Software", "Information Technology and Services", "Research"],
    "cybersecurity": ["Computer & Network Security", "Information Technology and Services"],
    "cloud": ["Computer Software", "Information Technology and Services"],
    "fintech": ["Financial Services", "Computer Software", "Banking"],
    "finance": ["Financial Services", "Banking", "Investment Banking"],
    "banking": ["Banking", "Financial Services", "Investment Banking"],
    "investment": ["Investment Banking", "Investment Management", "Venture Capital & Private Equity"],
    "vc": ["Venture Capital & Private Equity", "Investment Management"],
    "pe": ["Venture Capital & Private Equity", "Investment Management"],
    "healthtech": ["Hospital & Health Care", "Medical Devices", "Computer Software"],
    "healthcare": ["Hospital & Health Care", "Medical Devices", "Pharmaceuticals"],
    "pharma": ["Pharmaceuticals", "Biotechnology", "Hospital & Health Care"],
    "biotech": ["Biotechnology", "Pharmaceuticals", "Research"],
    "medtech": ["Medical Devices", "Hospital & Health Care"],
    "edtech": ["E-Learning", "Education Management", "Computer Software"],
    "ecommerce": ["Internet", "Retail", "Computer Software"],
    "e-commerce": ["Internet", "Retail", "Computer Software"],
    "consulting": ["Management Consulting", "Information Technology and Services"],
    "marketing": ["Marketing and Advertising", "Online Media"],
    "adtech": ["Marketing and Advertising", "Online Media", "Computer Software"],
    "hr": ["Human Resources", "Staffing and Recruiting"],
    "hrtech": ["Human Resources", "Computer Software", "Staffing and Recruiting"],
}

SENIORITY_MAPPING = {
    "senior": ["senior", "lead", "principal", "staff"],
    "lead": ["lead", "senior", "principal"],
    "principal": ["principal", "staff", "lead", "senior"],
    "staff": ["staff", "principal", "senior"],
    "architect": ["principal", "staff", "senior", "lead"],
    "mid": ["senior", "analyst"],
    "mid-level": ["senior", "analyst"],
    "intermediate": ["senior", "analyst"],
    "junior": ["analyst", "associate"],
    "entry": ["analyst", "associate", "intern"],
    "associate": ["associate", "analyst"],
    "manager": ["manager", "senior", "lead", "director"],
    "director": ["director", "vp", "senior"],
    "vp": ["vp", "director", "c-level"],
    "executive": ["vp", "director", "c-level", "ceo", "cto", "cfo"],
    "c-level": ["ceo", "cto", "cfo", "coo", "vp", "director"],
}

# Location mappings for exact country match
LOCATION_TO_COUNTRY = {
    "mumbai": "India",
    "bangalore": "India",
    "bengaluru": "India",
    "delhi": "India",
    "hyderabad": "India",
    "chennai": "India",
    "pune": "India",
    "kolkata": "India",
    "gurgaon": "India",
    "gurugram": "India",
    "noida": "India",
    "new york": "United States",
    "san francisco": "United States",
    "seattle": "United States",
    "austin": "United States",
    "boston": "United States",
    "london": "United Kingdom",
    "singapore": "Singapore",
    "dubai": "United Arab Emirates",
}


@dataclass
class SearchFilters:
    """Structured search filters derived from JD."""
    industries: List[str] = field(default_factory=list)
    seniority_levels: List[str] = field(default_factory=list)
    locations: List[str] = field(default_factory=list)
    country: Optional[str] = None
    title_keywords: List[str] = field(default_factory=list)
    experience_range: Optional[Tuple[int, int]] = None
    core_skills: List[Dict[str, Any]] = field(default_factory=list)
    skill_variations: Dict[str, str] = field(default_factory=dict)


class FunnelSearchService:
    """
    Fast search using Index-First strategy.
    
    CRITICAL: No regex in MongoDB - all filtering in Python!
    """
    
    def __init__(
        self,
        profiles_collection,
        openai_api_key: str,
        openai_base_url: str = "https://openrouter.ai/api/v1"
    ):
        self.profiles = profiles_collection
        self.ai_client = OpenAI(
            api_key=openai_api_key,
            base_url=openai_base_url
        )
        logger.info("✅ FunnelSearchService initialized (NO-REGEX version)")
    
    
    async def search(
        self,
        jd_data: Dict[str, Any],
        limit: int = 50,
        user_filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute funnel search.
        
        Pipeline:
        1. Parse JD → Structured filters
        2. Index-only query (NO REGEX!) → 10K-100K candidates
        3. Python filtering (location, title, skills) → 500 candidates
        4. Score and rank → Top N
        """
        start_time = time.time()
        search_log = []
        
        # ================================================================
        # STAGE 1: Parse JD into structured filters
        # ================================================================
        logger.info("Stage 1: Parsing JD into search filters...")
        
        filters = await self._parse_jd_to_filters(jd_data, user_filters)
        
        search_log.append({
            "stage": "parse_jd",
            "industries": filters.industries[:5],
            "seniority": filters.seniority_levels,
            "locations": filters.locations[:3],
            "country": filters.country,
            "title_keywords": filters.title_keywords[:3],
            "core_skills": [s["name"] for s in filters.core_skills[:5]],
        })
        
        logger.info(f"   Industries: {filters.industries[:3]}")
        logger.info(f"   Seniority: {filters.seniority_levels}")
        logger.info(f"   Country: {filters.country}")
        logger.info(f"   Locations: {filters.locations[:3]}")
        logger.info(f"   Title keywords: {filters.title_keywords[:3]}")
        logger.info(f"   Skills: {[s['name'] for s in filters.core_skills[:5]]}")
        
        # ================================================================
        # STAGE 2: Index-only MongoDB query (NO REGEX!)
        # ================================================================
        logger.info("Stage 2: Index-only query (NO REGEX!)...")
        
        stage2_start = time.time()
        
        pre_filtered = await self._execute_index_only_query(
            filters,
            limit=limit * 200  # Get more since we'll filter in Python
        )
        
        stage2_time = time.time() - stage2_start
        
        search_log.append({
            "stage": "index_query",
            "count": len(pre_filtered),
            "time_ms": int(stage2_time * 1000)
        })
        
        logger.info(f" Found {len(pre_filtered)} candidates in {stage2_time:.2f}s")
        
        # ================================================================
        # STAGE 3: Python filtering (location + title + skills)
        # ================================================================
        logger.info("Stage 3: Python filtering (location, title, skills)...")
        
        stage3_start = time.time()
        
        # Step 3a: Filter by location (in Python)
        if filters.locations:
            location_filtered = self._filter_by_location_python(pre_filtered, filters.locations)
            logger.info(f"   Location filter: {len(pre_filtered)} → {len(location_filtered)}")
        else:
            location_filtered = pre_filtered
        
        # Step 3b: Filter by title keywords (in Python)
        if filters.title_keywords:
            title_filtered = self._filter_by_title_python(location_filtered, filters.title_keywords)
            logger.info(f"   Title filter: {len(location_filtered)} → {len(title_filtered)}")
        else:
            title_filtered = location_filtered
        
        # Step 3c: Match skills (in Python)
        skill_matched = self._match_skills_python(title_filtered, filters)
        logger.info(f"   Skill filter: {len(title_filtered)} → {len(skill_matched)}")
        
        stage3_time = time.time() - stage3_start
        
        search_log.append({
            "stage": "python_filtering",
            "input_count": len(pre_filtered),
            "after_location": len(location_filtered) if filters.locations else len(pre_filtered),
            "after_title": len(title_filtered) if filters.title_keywords else len(location_filtered),
            "after_skills": len(skill_matched),
            "time_ms": int(stage3_time * 1000)
        })
        
        logger.info(f"Filtered to {len(skill_matched)} candidates in {stage3_time:.2f}s")
        
        # ================================================================
        # STAGE 4: Score and rank
        # ================================================================
        logger.info("Stage 4: Scoring and ranking...")
        
        scored_candidates = self._score_and_rank(skill_matched, filters, limit)
        
        total_time = time.time() - start_time
        
        search_log.append({
            "stage": "final",
            "total_candidates": len(scored_candidates),
            "total_time_ms": int(total_time * 1000)
        })
        
        logger.info(f"✅ Search complete: {len(scored_candidates)} candidates in {total_time:.2f}s")
        
        return {
            "success": len(scored_candidates) > 0,
            "candidates": scored_candidates[:limit],
            "total_found": len(skill_matched),
            "search_log": search_log,
            "filters_used": {
                "industries": filters.industries,
                "seniority_levels": filters.seniority_levels,
                "country": filters.country,
                "locations": filters.locations,
                "title_keywords": filters.title_keywords,
                "core_skills": [s["name"] for s in filters.core_skills]
            }
        }
    
    
    # ========================================================================
    # STAGE 1: Parse JD to Filters
    # ========================================================================
    
    async def _parse_jd_to_filters(
        self,
        jd_data: Dict[str, Any],
        user_filters: Optional[Dict[str, Any]] = None
    ) -> SearchFilters:
        """Convert JD into structured search filters."""
        
        filters = SearchFilters()
        
        # --- Industries ---
        raw_industries = user_filters.get("industries") if user_filters else jd_data.get("industries", [])
        
        for ind in raw_industries[:5]:
            ind_lower = ind.lower().strip()
            if ind_lower in INDUSTRY_MAPPING:
                filters.industries.extend(INDUSTRY_MAPPING[ind_lower])
            elif ind in LINKEDIN_INDUSTRIES:
                filters.industries.append(ind)
            else:
                for linkedin_ind in LINKEDIN_INDUSTRIES:
                    if ind_lower in linkedin_ind.lower():
                        filters.industries.append(linkedin_ind)
                        break
        
        seen = set()
        filters.industries = [x for x in filters.industries if not (x in seen or seen.add(x))]
        filters.industries = filters.industries[:10]
        
        # --- Seniority ---
        raw_seniority = user_filters.get("seniority") if user_filters else jd_data.get("seniority", "")
        seniority_lower = raw_seniority.lower().strip()
        
        for key, values in SENIORITY_MAPPING.items():
            if key in seniority_lower:
                filters.seniority_levels.extend(values)
                break
        
        if not filters.seniority_levels:
            filters.seniority_levels = ["senior", "lead", "principal"]
        
        filters.seniority_levels = list(set(filters.seniority_levels))[:6]
        
        # --- Location + Country ---
        raw_locations = user_filters.get("locations") if user_filters else jd_data.get("locations", [])
        
        for loc in raw_locations[:5]:
            loc_lower = loc.lower().strip()
            filters.locations.append(loc)
            
            # Detect country
            for city, country in LOCATION_TO_COUNTRY.items():
                if city in loc_lower:
                    filters.country = country
                    break
            
            if "india" in loc_lower:
                filters.country = "India"
            elif "united states" in loc_lower or "usa" in loc_lower:
                filters.country = "United States"
        
        # --- Title keywords ---
        role_title = jd_data.get("role_title", "")
        role_lower = role_title.lower()
        
        # Extract significant words
        words = re.findall(r'\b\w+\b', role_lower)
        stopwords = {"with", "the", "and", "for", "from", "have", "this", "that", "will", "your", "a", "an", "at", "in", "on"}
        significant = [w for w in words if len(w) > 2 and w not in stopwords]
        
        filters.title_keywords = significant[:5]
        
        # Add role-specific keywords
        if "developer" in role_lower or "engineer" in role_lower:
            if "full" in role_lower and "stack" in role_lower:
                filters.title_keywords.extend(["full", "stack", "fullstack"])
            if "front" in role_lower:
                filters.title_keywords.extend(["frontend", "front"])
            if "back" in role_lower:
                filters.title_keywords.extend(["backend", "back"])
            if "software" in role_lower:
                filters.title_keywords.extend(["software", "sde", "swe"])
        
        if "data" in role_lower and "scientist" in role_lower:
            filters.title_keywords.extend(["data", "scientist", "ml", "machine"])
        
        if "devops" in role_lower:
            filters.title_keywords.extend(["devops", "sre", "infrastructure", "cloud"])
        
        if "product" in role_lower and "manager" in role_lower:
            filters.title_keywords.extend(["product", "manager", "pm"])
        
        filters.title_keywords = list(set(filters.title_keywords))[:10]
        
        # --- Skills ---
        skills_data = await self._expand_skills_with_llm(jd_data)
        filters.core_skills = skills_data["core_skills"]
        filters.skill_variations = skills_data["variations"]
        
        # --- Experience range ---
        if user_filters and "experience_min" in user_filters:
            filters.experience_range = (
                user_filters.get("experience_min", 0),
                user_filters.get("experience_max", 30)
            )
        
        return filters
    
    
    async def _expand_skills_with_llm(self, jd_data: Dict[str, Any]) -> Dict[str, Any]:
        """Use LLM to expand skills into searchable variations."""
        
        required_skills = jd_data.get("required_skills", [])
        role_title = jd_data.get("role_title", "")
        
        soft_skill_keywords = {"communication", "leadership", "teamwork", "problem-solving", 
                             "analytical", "critical thinking", "time management", "collaboration"}
        
        technical_skills = [s for s in required_skills[:15] 
                          if not any(soft in s.lower() for soft in soft_skill_keywords)]
        
        if not technical_skills:
            return {"core_skills": [], "variations": {}}
        
        prompt = f"""Extract skills and their LOWERCASE variations for database search.

**Role:** {role_title}
**Skills:** {technical_skills[:10]}

**Rules:**
1. Return ONLY lowercase variations
2. Include: abbreviations, alternate spellings
3. Max 4 variations per skill
4. Top 8 skills only

**Return JSON:**
{{
  "core_skills": [
    {{"name": "React", "variations": ["react", "reactjs", "react.js"], "priority": 1}}
  ]
}}"""

        try:
            response = self.ai_client.chat.completions.create(
                model="anthropic/claude-haiku-4.5",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1500
            )
            
            ai_response = response.choices[0].message.content.strip()
            
            if "```" in ai_response:
                ai_response = ai_response.split("```")[1]
                if ai_response.startswith("json"):
                    ai_response = ai_response[4:]
                ai_response = ai_response.split("```")[0]
            
            import json
            data = json.loads(ai_response)
            
            variations = {}
            for skill in data.get("core_skills", []):
                canonical = skill["name"]
                for var in skill.get("variations", []):
                    var_lower = var.lower().strip()
                    if var_lower:
                        variations[var_lower] = canonical
            
            logger.info(f"✅ LLM skill expansion: {len(data.get('core_skills', []))} skills, {len(variations)} variations")
            
            return {"core_skills": data.get("core_skills", []), "variations": variations}
            
        except Exception as e:
            logger.error(f"❌ LLM skill expansion failed: {e}")
            return self._fallback_skill_expansion(technical_skills)
    
    
    def _fallback_skill_expansion(self, skills: List[str]) -> Dict[str, Any]:
        """Fallback skill expansion without LLM."""
        
        core_skills = []
        variations = {}
        
        for skill in skills[:8]:
            clean = re.split(r'[\(\[]', skill)[0].strip()
            skill_vars = set()
            skill_vars.add(clean.lower())
            
            if ".js" in clean.lower():
                base = re.sub(r'\.js$', '', clean, flags=re.IGNORECASE)
                skill_vars.add(base.lower())
                skill_vars.add(base.lower() + "js")
            
            if " " in clean:
                skill_vars.add(clean.lower().replace(" ", ""))
            
            skill_vars = {v for v in skill_vars if len(v) > 1}
            
            core_skills.append({
                "name": clean,
                "variations": list(skill_vars)[:4],
                "priority": len(core_skills) + 1
            })
            
            for var in skill_vars:
                variations[var] = clean
        
        return {"core_skills": core_skills, "variations": variations}
    
    
    # ========================================================================
    # STAGE 2: Index-Only MongoDB Query (NO REGEX!)
    # ========================================================================
    
    async def _execute_index_only_query(
        self,
        filters: SearchFilters,
        limit: int = 10000
    ) -> List[Dict[str, Any]]:
        """
        Execute MongoDB query using ONLY indexed fields with $in (NO REGEX!).
        
        This should be FAST (< 1 second) because it uses indexes.
        """
        
        query_conditions = []
        
        # --- Industry (indexed, uses $in = FAST) ---
        if filters.industries:
            query_conditions.append({
                "current_industry": {"$in": filters.industries}
            })
        
        # --- Seniority (indexed, uses $in = FAST) ---
        if filters.seniority_levels:
            query_conditions.append({
                "seniority_level": {"$in": filters.seniority_levels}
            })
        
        # --- Country (exact match = FAST) ---
        # Use country instead of location regex!
        if filters.country:
            query_conditions.append({
                "country": filters.country
            })
        
        # --- Exclude NA values ---
        query_conditions.append({"title": {"$ne": "NA"}})
        query_conditions.append({"current_industry": {"$ne": "NA"}})
        
        # Build final query
        if query_conditions:
            query = {"$and": query_conditions}
        else:
            query = {"title": {"$ne": "NA"}}
        
        logger.debug(f"Index-only query: {query}")
        
        # Projection
        projection = {
            "_id": 1,
            "first_name": 1,
            "last_name": 1,
            "title": 1,
            "location": 1,
            "country": 1,
            "current_industry": 1,
            "seniority_level": 1,
            "expertise": 1,
            "summary": 1,
            "linkedin_url": 1,
            "experience_years": 1,
        }
        
        # Execute query
        cursor = self.profiles.find(query, projection).limit(limit)
        
        # Handle both sync and async
        if hasattr(cursor, 'to_list'):
            results = await cursor.to_list(length=limit)
        else:
            results = list(cursor)
        
        return results
    
    
    # ========================================================================
    # STAGE 3: Python Filtering
    # ========================================================================
    
    def _filter_by_location_python(
        self,
        candidates: List[Dict[str, Any]],
        locations: List[str]
    ) -> List[Dict[str, Any]]:
        """Filter candidates by location using Python regex (FAST on small set)."""
        
        # Build regex pattern for all locations
        patterns = []
        for loc in locations:
            # Handle common variations
            loc_lower = loc.lower()
            if loc_lower == "bangalore" or loc_lower == "bengaluru":
                patterns.extend(["bangalore", "bengaluru"])
            elif loc_lower == "gurgaon" or loc_lower == "gurugram":
                patterns.extend(["gurgaon", "gurugram"])
            else:
                patterns.append(re.escape(loc_lower))
        
        pattern = re.compile("|".join(patterns), re.IGNORECASE)
        
        filtered = []
        for candidate in candidates:
            location = candidate.get("location", "") or ""
            if pattern.search(location):
                filtered.append(candidate)
        
        return filtered
    
    
    def _filter_by_title_python(
        self,
        candidates: List[Dict[str, Any]],
        title_keywords: List[str]
    ) -> List[Dict[str, Any]]:
        """Filter candidates by title keywords using Python (FAST on small set)."""
        
        # Require at least one keyword match
        patterns = [re.compile(re.escape(kw), re.IGNORECASE) for kw in title_keywords]
        
        filtered = []
        for candidate in candidates:
            title = candidate.get("title", "") or ""
            
            # Check if any keyword matches
            if any(p.search(title) for p in patterns):
                candidate["_title_match"] = True
                filtered.append(candidate)
        
        return filtered
    
    
    def _match_skills_python(
        self,
        candidates: List[Dict[str, Any]],
        filters: SearchFilters
    ) -> List[Dict[str, Any]]:
        """Match skills in Python (FAST on small set)."""
        
        if not filters.skill_variations:
            for c in candidates:
                c["_matched_skills"] = []
                c["_skill_score"] = 0
            return candidates
        
        # Precompile patterns
        patterns = {}
        for variation in filters.skill_variations.keys():
            escaped = re.escape(variation)
            pattern = re.compile(rf'(?:^|,|\s|/){escaped}(?:,|\s|/|$)', re.IGNORECASE)
            patterns[variation] = pattern
        
        matched_candidates = []
        
        for candidate in candidates:
            expertise = candidate.get("expertise", "") or ""
            summary = candidate.get("summary", "") or ""
            title = candidate.get("title", "") or ""
            
            search_text = f"{expertise},{summary},{title}".lower()
            
            matched_skills = set()
            skill_score = 0.0
            
            for variation, pattern in patterns.items():
                if pattern.search(search_text):
                    canonical = filters.skill_variations[variation]
                    matched_skills.add(canonical)
                    
                    for skill in filters.core_skills:
                        if skill["name"] == canonical:
                            priority = skill.get("priority", 5)
                            skill_score += (10 - priority) / 2
                            break
                    else:
                        skill_score += 1
            
            # Keep candidates with at least 1 skill match
            if matched_skills:
                candidate["_matched_skills"] = list(matched_skills)
                candidate["_skill_score"] = skill_score
                matched_candidates.append(candidate)
        
        matched_candidates.sort(key=lambda x: x["_skill_score"], reverse=True)
        
        return matched_candidates
    
    
    # ========================================================================
    # STAGE 4: Scoring and Ranking
    # ========================================================================
    
    def _score_and_rank(
        self,
        candidates: List[Dict[str, Any]],
        filters: SearchFilters,
        limit: int
    ) -> List[Dict[str, Any]]:
        """Score candidates and return formatted results."""
        
        scored = []
        max_skill_score = max([c.get("_skill_score", 0) for c in candidates] + [1])
        
        for candidate in candidates:
            # Skill score (50 points max)
            raw_skill_score = candidate.get("_skill_score", 0)
            normalized_skill = (raw_skill_score / max_skill_score) * 50
            
            # Title match (25 points)
            title_score = 25 if candidate.get("_title_match") else 0
            
            # Industry match (15 points)
            industry_score = 15 if candidate.get("current_industry") in filters.industries else 0
            
            # Seniority match (10 points)
            seniority_score = 10 if candidate.get("seniority_level") in filters.seniority_levels else 0
            
            total_score = normalized_skill + title_score + industry_score + seniority_score
            
            match_reasons = []
            matched_skills = candidate.get("_matched_skills", [])
            
            if matched_skills:
                match_reasons.append(f"Skills ({len(matched_skills)}): {', '.join(matched_skills[:4])}")
            if title_score > 0:
                match_reasons.append("Title match")
            if industry_score > 0:
                match_reasons.append(f"Industry: {candidate.get('current_industry')}")
            if seniority_score > 0:
                match_reasons.append(f"Seniority: {candidate.get('seniority_level')}")
            
            scored.append({
                "candidate": {
                    "profile_id": str(candidate.get("_id")),
                    "first_name": candidate.get("first_name", ""),
                    "last_name": candidate.get("last_name", ""),
                    "title": candidate.get("title", ""),
                    "location": candidate.get("location", ""),
                    "country": candidate.get("country", ""),
                    "current_industry": candidate.get("current_industry", ""),
                    "seniority_level": candidate.get("seniority_level", ""),
                    "expertise": candidate.get("expertise", "")[:300],
                    "summary": (candidate.get("summary", "") or "")[:200],
                    "linkedin_url": candidate.get("linkedin_url", ""),
                    "experience_years": candidate.get("experience_years")
                },
                "score": round(total_score, 1),
                "skill_match_count": len(matched_skills),
                "matched_skills": matched_skills[:10],
                "match_reasons": match_reasons
            })
        
        scored.sort(key=lambda x: x["score"], reverse=True)
        
        return scored[:limit * 2]