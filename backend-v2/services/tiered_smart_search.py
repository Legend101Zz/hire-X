# services/tiered_smart_search.py
"""
Tiered Smart Search Service - FIXED
====================================
Fast search with HARD quality filters to prevent garbage results.
"""

import json
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

from bson import ObjectId
from openai import OpenAI
from pymongo.collection import Collection

from core.logging_config import get_logger

logger = get_logger(__name__)


class TieredSmartSearch:
    """
    Tiered search with quality pre-filters.
    Fast but won't show students for senior roles!
    """
    
    def __init__(
        self,
        profiles_collection: Collection,
        openai_api_key: str,
        openai_base_url: str = "https://openrouter.ai/api/v1"
    ):
        """Initialize search service."""
        self.profiles = profiles_collection
        self.ai_client = OpenAI(
            api_key=openai_api_key,
            base_url=openai_base_url
        )
        
        logger.info("✅ TieredSmartSearch initialized with quality filters")
    
    
    async def search(
        self,
        jd_data: Dict[str, Any],
        limit: int = 5,  # Default 5 for samples
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute tiered smart search.
        
        Args:
            jd_data: JD requirements
            limit: Number of candidates (default 5 for conversation samples)
            filters: Optional quality filters
        """
        logger.info(f"🔍 Starting tiered search (limit={limit})...")
        
        # Step 1: Expand terms with AI
        expanded_terms = self._expand_and_classify_skills_with_ai(jd_data, filters)
        
        logger.info(f"🧠 AI Classified:")
        logger.info(f"   Core skills: {len(expanded_terms.get('core_skills', []))}")
        logger.info(f"   Min threshold: {expanded_terms.get('min_skill_matches', 3)}")
        
        # Step 2: Find candidates with quality filters
        skill_matched_candidates = await self._find_candidates_with_quality_filters(
            expanded_terms,
            limit=limit * 10  # Get more for tiering
        )
        
        logger.info(f"📦 Found {len(skill_matched_candidates)} candidates")
        
        # Step 3: Group into skill tiers
        tiered_candidates = self._group_into_skill_tiers(
            skill_matched_candidates,
            expanded_terms
        )
        
        logger.info(f"📊 Tiers:")
        for tier_name, candidates in tiered_candidates.items():
            logger.info(f"   {tier_name}: {len(candidates)}")
        
        # Step 4: Progressive selection
        selected_candidates = self._progressive_tier_selection(
            tiered_candidates,
            expanded_terms,
            limit
        )
        
        # Step 5: Score
        scored_candidates = self._score_candidates(
            selected_candidates,
            jd_data,
            expanded_terms
        )
        
        return {
            "success": len(selected_candidates) > 0,
            "candidates": scored_candidates[:limit],
            "total_found": len(selected_candidates),
            "tier_distribution": {
                tier: len(candidates) 
                for tier, candidates in tiered_candidates.items()
            },
            "expanded_terms": expanded_terms
        }


    def _expand_and_classify_skills_with_ai(
    self,
    jd_data: Dict[str, Any],
    filters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
        """Use AI to classify and expand skills with BETTER prompt."""
        
        required_skills = jd_data.get("required_skills", [])
        role_title = jd_data.get("role_title", "")
        seniority = jd_data.get("seniority", "")
        industries = jd_data.get("industries", [])
        
        prompt = f"""You are a database search expert. Analyze this job and create searchable variations.

    **Job Details:**
    - Role: {role_title}
    - Seniority: {seniority}
    - Required Skills: {required_skills[:15]}
    - Industries: {industries[:5]}

    **Database Schema:**
    - `expertise`: comma-separated LOWERCASE keywords (e.g., "javascript,react,node.js,mongodb")
    - `summary`: paragraph text
    - `current_industry`: LinkedIn standard industry names (see examples below)
    - `seniority_level`: "senior", "lead", "principal", "staff", "director", "vp", "analyst", "associate"
    - `title`: job titles (lowercase search)

    **Tasks:**
    1. Extract TOP 8 CORE technical skills with LOWERCASE variations
    2. Map industries to EXACT LinkedIn standard names (see list below)
    3. Map seniority to database values
    4. Extract title keywords

    **LinkedIn Industry Names (use EXACTLY these):**
    - "Computer Software" (for SaaS, Software, Tech)
    - "Information Technology and Services" (for IT, Tech Services)
    - "Internet" (for E-commerce, Online Services)
    - "Financial Services" (for Fintech, Finance, Banking)
    - "Banking" (for traditional banks)
    - "Investment Banking" (for investment firms)
    - "Hospital & Health Care" (for Healthcare, HealthTech)
    - "Medical Devices" (for MedTech)
    - "E-Learning" (for EdTech, Education)
    - "Retail" (for E-commerce, Retail)
    - "Management Consulting" (for Consulting)
    - "Marketing and Advertising" (for Marketing, AdTech)

    **Return ONLY JSON:**
    {{
    "core_skills": [
        {{"name": "React", "variations": ["react", "reactjs", "react.js"], "weight": 2.0}}
    ],
    "min_skill_matches": 3,
    "industries": ["Computer Software", "Information Technology and Services"],
    "seniority_levels": ["senior", "lead"],
    "title_keywords": ["full stack developer", "full stack engineer"]
    }}

    **Critical:** Use EXACT industry names from the list above, not paraphrased versions!"""

        try:          
            logger.info('Expanding with AI...')
            response = self.ai_client.chat.completions.create(
                model="anthropic/claude-3.5-sonnet",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Very low for exact matching
                max_tokens=2000
            )
            ai_response = response.choices[0].message.content.strip()
            logger.debug(f'ai : {ai_response}')
            # Clean markdown if present
            if "```" in ai_response:
                ai_response = ai_response.split("```")[1]
                if ai_response.startswith("json"):
                    ai_response = ai_response[4:]
                ai_response = ai_response.split("```")[0]
            
            expanded = json.loads(ai_response)
            logger.debug(f'expanded : {expanded}')
            # ✅ FLATTEN AND VALIDATE
            expanded["all_skill_variations"] = {}
            for skill in expanded.get("core_skills", []):
                skill_name = skill.get("name")
                variations = skill.get("variations", [])
                weight = skill.get("weight", 2.0)
                
                # Ensure all variations are lowercase
                variations = [v.lower().strip() for v in variations if v]
                
                for var in variations:
                    expanded["all_skill_variations"][var] = {
                        "name": skill_name,
                        "weight": weight,
                        "type": "core"
                    }
            
            # ✅ LOG WHAT WE'RE SEARCHING FOR
            logger.info("✅ AI classification successful")
            logger.info(f"   Searching for: {list(expanded['all_skill_variations'].keys())[:10]}")
            
            return expanded
            
        except Exception as e:
            logger.error(f"❌ AI failed: {e}, using basic expansion")
            return self._basic_expansion(jd_data, filters)


    def _basic_expansion(
        self,
        jd_data: Dict[str, Any],
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Fallback expansion without AI - IMPROVED VERSION.
        """
        logger.debug('using _basic_expansion wtf')
        required_skills = jd_data.get("required_skills", [])
        
        import re
        core_skills = []
        all_variations = {}
        
        for skill in required_skills[:8]:
            # Skip soft skills
            if any(soft in skill.lower() for soft in ["communication", "problem-solving", "leadership", "teamwork"]):
                continue
            
            # Extract main technology name (before parentheses)
            clean_skill = re.split(r'[\(\[]', skill)[0].strip()
            
            # ✅ GENERATE LOWERCASE VARIATIONS
            variations = set()
            
            # 1. Add cleaned version (lowercase)
            variations.add(clean_skill.lower())
            
            # 2. Handle .js suffix
            if ".js" in clean_skill.lower():
                base = re.sub(r'\.js$', '', clean_skill, flags=re.IGNORECASE)
                variations.add(base.lower())
                variations.add(base.lower() + "js")
                variations.add(base.lower() + ".js")
                variations.add(base.lower() + " js")
            
            # 3. Handle .py suffix
            elif ".py" in clean_skill.lower():
                variations.add("python")
                variations.add("py")
            
            # 4. Handle common abbreviations
            skill_lower = clean_skill.lower()
            if "javascript" in skill_lower:
                variations.update(["javascript", "js", "ecmascript"])
            elif "typescript" in skill_lower:
                variations.update(["typescript", "ts"])
            elif "postgresql" in skill_lower:
                variations.update(["postgresql", "postgres", "pgsql"])
            elif "mongodb" in skill_lower:
                variations.update(["mongodb", "mongo"])
            
            # 5. Remove version numbers
            without_version = re.sub(r'\s*\d+(\.\d+)*\+?\s*', '', clean_skill)
            variations.add(without_version.lower())
            
            # 6. Handle special characters
            no_special = re.sub(r'[^\w\s]', '', clean_skill)
            variations.add(no_special.lower())
            
            # Filter empty and too short
            variations = {v for v in variations if len(v) > 1}
            variations_list = sorted(variations)[:4]  # Top 4
            
            core_skills.append({
                "name": clean_skill,
                "variations": variations_list,
                "weight": 2.0
            })
            
            for var in variations_list:
                all_variations[var] = {
                    "name": clean_skill,
                    "weight": 2.0,
                    "type": "core"
                }
        
        # ✅ EXPAND INDUSTRIES
        base_industries = filters.get("industries") if filters else jd_data.get("industries", [])
        
        industry_map = {
            "saas": ["Computer Software", "Information Technology and Services", "Internet"],
            "fintech": ["Financial Services", "Banking", "Investment Banking"],
            "e-commerce": ["Internet", "Retail", "Computer Software"],
            "healthtech": ["Hospital & Health Care", "Medical Devices", "Pharmaceuticals"],
            "edtech": ["E-Learning", "Education Management"],
        }
        
        expanded_industries = []
        for ind in base_industries[:5]:
            expanded_industries.append(ind)
            # Check if industry matches any key
            for key, mapped in industry_map.items():
                if key in ind.lower():
                    expanded_industries.extend(mapped)
        
        # ✅ EXPAND SENIORITY
        base_seniority = filters.get("seniority") if filters else jd_data.get("seniority", "")
        seniority_lower = base_seniority.lower()
        
        if "senior" in seniority_lower:
            seniority_levels = ["senior", "lead", "principal", "staff"]
        elif "mid" in seniority_lower:
            seniority_levels = ["senior", "analyst", "associate"]
        elif "junior" in seniority_lower or "entry" in seniority_lower:
            seniority_levels = ["analyst", "associate", "intern"]
        else:
            seniority_levels = ["senior", "lead"]
        
        # ✅ EXTRACT TITLE KEYWORDS
        role_title = jd_data.get("role_title", "")
        words = re.findall(r'\b\w+\b', role_title)
        title_keywords = []
        for i in range(len(words) - 1):
            phrase = f"{words[i]} {words[i+1]}"
            if len(phrase) > 5:  # Skip very short
                title_keywords.append(phrase)
        
        logger.info("✅ Basic expansion complete")
        logger.info(f"   Searching for: {list(all_variations.keys())[:10]}")
        
        return {
            "core_skills": core_skills,
            "all_skill_variations": all_variations,
            "min_skill_matches": 2,  # Lower for fallback
            "industries": list(set(expanded_industries)),
            "seniority_levels": seniority_levels,
            "title_keywords": title_keywords[:5]
        }
        
    async def _find_candidates_with_quality_filters(
        self,
        expanded_terms: Dict[str, Any],
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Find candidates with SKILLS FIRST approach.
        
        NEW Strategy:
        1. Find ALL candidates with ANY skill match (no other filters)
        2. Count skills per candidate
        3. Return for tiering (quality filters applied WITHIN tiers later)
        """
        logger.info("🔎 Searching SKILLS FIRST (no quality filters yet)...")
        
        all_skill_terms = list(expanded_terms["all_skill_variations"].keys())
        
        if not all_skill_terms:
            logger.warning("No skill terms to search for")
            return []
        
        logger.info(f"   Searching for skills: {all_skill_terms[:10]}...")
        
        # ================================================================
        # STEP 1: Find ALL candidates with ANY skill match
        # ================================================================
        skill_conditions = []
        for skill_term in all_skill_terms[:30]:  # Top 30 variations
            skill_conditions.extend([
                {"expertise": {"$regex": skill_term, "$options": "i"}},
                {"summary": {"$regex": skill_term, "$options": "i"}}
            ])
        
        # ONLY filter by having some data (no seniority/title filters yet!)
        query = {
            "$and": [
                {"$or": skill_conditions},
                {
                    "$or": [
                        {"expertise": {"$ne": "NA", "$ne": ""}},
                        {"summary": {"$ne": "NA", "$ne": ""}}
                    ]
                }
            ]
        }
        
        start = time.time()
        
        # Get MORE candidates (we'll filter in tiers)
        cursor = self.profiles.find(query, {
            "_id": 1, "first_name": 1, "last_name": 1, "title": 1,
            "location": 1, "current_industry": 1, "seniority_level": 1,
            "summary": 1, "expertise": 1, "linkedin_url": 1
        }).limit(limit * 4)  # Get 4x more for better tiering
        
        candidates = await cursor.to_list(length=limit * 4)
        elapsed = time.time() - start
        
        logger.info(f"   ✅ Found {len(candidates)} candidates with skill matches in {elapsed:.2f}s")
        
        return candidates
    
    def _group_into_skill_tiers(
        self,
        candidates: List[Dict[str, Any]],
        expanded_terms: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group candidates BY SKILL MATCH COUNT.
        
        Tiers:
        - tier_excellent: 6-8 skills matched
        - tier_very_good: 4-5 skills matched
        - tier_good: 2-3 skills matched
        - tier_acceptable: 1 skill matched
        
        Quality filters applied WITHIN tiers during selection.
        """
        logger.info("📊 Grouping by skill match count...")
        
        all_skill_variations = expanded_terms["all_skill_variations"]
        seniority_levels = expanded_terms.get("seniority_levels", [])
        
        candidates_with_counts = []
        
        for candidate in candidates:
            expertise = candidate.get("expertise", "").lower()
            summary = candidate.get("summary", "").lower()
            title = candidate.get("title", "").lower()
            seniority = candidate.get("seniority_level", "")
            
            matched_skills = set()
            weighted_score = 0.0
            
            # Count matched skills
            for skill_var, skill_info in all_skill_variations.items():
                if skill_var in expertise or skill_var in summary:
                    matched_skills.add(skill_info["name"])
                    weighted_score += skill_info["weight"]
            
            # ✅ CHECK QUALITY (but don't filter yet, just flag)
            is_quality = True
            
            # Check if student/intern (for senior roles)
            if "senior" in seniority_levels or "lead" in seniority_levels:
                if any(bad in title for bad in ["student", "intern", "trainee"]):
                    is_quality = False
                if seniority in ["student", "intern"]:
                    is_quality = False
            
            candidate["_matched_skills"] = list(matched_skills)
            candidate["_skill_count"] = len(matched_skills)
            candidate["_weighted_skill_score"] = weighted_score
            candidate["_is_quality"] = is_quality  # Flag for filtering
            
            candidates_with_counts.append(candidate)
        
        # ✅ GROUP BY SKILL COUNT (not weighted score)
        tiers = {
            "tier_excellent": [],    # 6-8 skills
            "tier_very_good": [],    # 4-5 skills
            "tier_good": [],         # 2-3 skills
            "tier_acceptable": []    # 1 skill
        }
        
        for candidate in candidates_with_counts:
            skill_count = candidate["_skill_count"]
            
            if skill_count >= 6:
                tiers["tier_excellent"].append(candidate)
            elif skill_count >= 4:
                tiers["tier_very_good"].append(candidate)
            elif skill_count >= 2:
                tiers["tier_good"].append(candidate)
            elif skill_count >= 1:
                tiers["tier_acceptable"].append(candidate)
        
        # Log tier distribution
        for tier_name, tier_candidates in tiers.items():
            quality_count = sum(1 for c in tier_candidates if c["_is_quality"])
            logger.info(f"   {tier_name}: {len(tier_candidates)} total ({quality_count} quality)")
        
        return tiers

    def _progressive_tier_selection(
        self,
        tiered_candidates: Dict[str, List[Dict[str, Any]]],
        expanded_terms: Dict[str, Any],
        target_limit: int
    ) -> List[Dict[str, Any]]:
        """
        Select from tiers progressively.
        
        NEW Strategy:
        1. Start with highest tier (most skills)
        2. WITHIN tier, prioritize quality candidates
        3. Apply secondary filters (title, industry, seniority)
        4. Fill from next tier only if needed
        """
        
        selected = []
        tier_order = ["tier_excellent", "tier_very_good", "tier_good", "tier_acceptable"]
        
        seniority_levels = expanded_terms.get("seniority_levels", [])
        industries = expanded_terms.get("industries", [])
        title_keywords = expanded_terms.get("title_keywords", [])
        
        for tier_name in tier_order:
            tier_candidates = tiered_candidates.get(tier_name, [])
            
            if not tier_candidates:
                continue
            
            logger.info(f"   Processing {tier_name}: {len(tier_candidates)} candidates")
            
            # ✅ FILTER BY QUALITY FIRST (within this tier)
            quality_candidates = [c for c in tier_candidates if c.get("_is_quality", True)]
            non_quality_candidates = [c for c in tier_candidates if not c.get("_is_quality", True)]
            
            logger.info(f"      Quality: {len(quality_candidates)}, Non-quality: {len(non_quality_candidates)}")
            
            # Score by secondary criteria
            for candidate in quality_candidates + non_quality_candidates:
                secondary_score = 0
                
                title = candidate.get("title", "").lower()
                current_industry = candidate.get("current_industry", "")
                seniority = candidate.get("seniority_level", "")
                
                # Title match (30 points)
                if any(kw.lower() in title for kw in title_keywords):
                    secondary_score += 30
                
                # Industry match (20 points)
                if current_industry in industries:
                    secondary_score += 20
                
                # Seniority match (10 points)
                if seniority in seniority_levels:
                    secondary_score += 10
                
                # Quality bonus (10 points)
                if candidate.get("_is_quality"):
                    secondary_score += 10
                
                candidate["_secondary_score"] = secondary_score
            
            # ✅ SORT: Quality first, then by secondary score, then by skill count
            tier_candidates.sort(
                key=lambda x: (
                    x.get("_is_quality", True),  # Quality first
                    x["_secondary_score"],        # Then secondary criteria
                    x["_skill_count"]             # Then skill count
                ),
                reverse=True
            )
            
            # Add to selected
            selected.extend(tier_candidates)
            
            logger.info(f"      Added {len(tier_candidates)} candidates (total: {len(selected)})")
            
            # Stop if we have enough
            if len(selected) >= target_limit:
                logger.info(f"   ✅ Target reached at {tier_name}")
                break
        
        return selected[:target_limit * 2] 
    
    def _score_candidates(
        self,
        candidates: List[Dict],
        jd_data: Dict[str, Any],
        expanded_terms: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Final scoring."""
        
        scored = []
        
        max_weighted = max([c.get("_weighted_skill_score", 0) for c in candidates] + [1])
        
        for candidate in candidates:
            weighted_skill_score = candidate.get("_weighted_skill_score", 0)
            secondary_score = candidate.get("_secondary_score", 0)
            
            normalized_skill_score = (weighted_skill_score / max_weighted) * 100
            total_score = normalized_skill_score + secondary_score
            
            match_details = []
            matched_skills = candidate.get("_matched_skills", [])
            
            if matched_skills:
                match_details.append(f"Skills ({len(matched_skills)}): {', '.join(matched_skills[:3])}")
            
            if secondary_score >= 30:
                match_details.append("Title match")
            if secondary_score >= 50:
                match_details.append("Industry match")
            
            scored.append({
                "candidate": {
                    "profile_id": str(candidate.get("_id")),
                    "first_name": candidate.get("first_name", ""),
                    "last_name": candidate.get("last_name", ""),
                    "title": candidate.get("title", ""),
                    "location": candidate.get("location", ""),
                    "current_industry": candidate.get("current_industry", ""),
                    "seniority_level": candidate.get("seniority_level", ""),
                    "summary": candidate.get("summary", "")[:200],
                    "expertise": candidate.get("expertise", "")[:200],
                    "linkedin_url": candidate.get("linkedin_url", "")
                },
                "score": round(total_score, 1),
                "skill_match_count": candidate.get("_skill_count", 0),
                "matched_skills": matched_skills[:10],
                "match_details": match_details
            })
        
        return scored
    
    def debug_search(self, expanded_terms: Dict[str, Any]) -> Dict[str, Any]:
        """
        Debug helper to understand why search is failing.
        """
        all_skill_terms = list(expanded_terms["all_skill_variations"].keys())[:10]
        
        logger.info("🐛 DEBUG: Checking database for skill matches...")
        
        debug_info = {
            "total_profiles": self.profiles.estimated_document_count(),
            "skill_terms_searched": all_skill_terms,
            "individual_skill_matches": {}
        }
        
        # Check each skill individually
        for skill in all_skill_terms[:5]:
            count = self.profiles.count_documents({
                "$or": [
                    {"expertise": {"$regex": skill, "$options": "i"}},
                    {"summary": {"$regex": skill, "$options": "i"}}
                ]
            })
            debug_info["individual_skill_matches"][skill] = count
            logger.info(f"   Skill '{skill}': {count} matches")
        
        # Check non-NA expertise
        non_na_expertise = self.profiles.count_documents({
            "expertise": {"$ne": "NA", "$ne": ""}
        })
        debug_info["non_na_expertise"] = non_na_expertise
        logger.info(f"   Non-NA expertise: {non_na_expertise}")
        
        # Check non-NA summary
        non_na_summary = self.profiles.count_documents({
            "summary": {"$ne": "NA", "$ne": ""}
        })
        debug_info["non_na_summary"] = non_na_summary
        logger.info(f"   Non-NA summary: {non_na_summary}")
        
        # Check seniority distribution
        seniority_dist = {}
        for level in ["senior", "lead", "principal", "staff", "NA"]:
            count = self.profiles.count_documents({"seniority_level": level})
            seniority_dist[level] = count
        debug_info["seniority_distribution"] = seniority_dist
        logger.info(f"   Seniority distribution: {seniority_dist}")
        
        return debug_info