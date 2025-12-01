"""
Progressive Smart Search Service
=================================
Simple cascading search strategy - start strict, relax progressively.

Strategy:
1. Try Skills + Title + Industry + Seniority (BEST)
2. Try Skills + Title (Good)
3. Try Skills + Industry (Acceptable)
4. Try Skills + Seniority (Acceptable)
5. Try Skills only (Last resort)
6. If still no results, try Industry + Title

Stop as soon as we have enough candidates!
"""

import time
from typing import Any, Dict, List, Optional

from openai import OpenAI
from pymongo.collection import Collection

from core.logging_config import get_logger

logger = get_logger(__name__)


class ProgressiveSmartSearch:
    """
    Progressive search - start strict, relax until we have enough results.
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
        
        logger.info("✅ ProgressiveSmartSearch initialized")
    
    
    def search(
        self,
        jd_data: Dict[str, Any],
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute progressive smart search.
        """
        logger.info("🔍 Starting progressive smart search...")
        
        # Step 1: Expand search terms using AI
        expanded_terms = self._expand_search_terms_with_ai(jd_data, filters)
        logger.info(f"🧠 AI Expanded Terms:")
        logger.info(f"   Skills: {len(expanded_terms.get('all_skill_terms', []))} variations")
        logger.info(f"   Industries: {len(expanded_terms['industries'])} options")
        logger.info(f"   Seniority: {expanded_terms['seniority_levels']}")
        logger.info(f"   Title Keywords: {expanded_terms['title_keywords'][:3]}")
        
        # Step 2: Progressive search stages
        search_log = []
        candidates = []
        
        stages = self._build_search_stages(expanded_terms, limit * 3)
        
        for stage in stages:
            stage_name = stage["name"]
            query = stage["query"]
            target_count = stage.get("target", limit)
            
            logger.info(f"🔎 Stage: {stage_name}")
            logger.debug(f"   Query: {query}")
            
            start = time.time()
            
            cursor = self.profiles.find(query).limit(target_count)
            stage_candidates = list(cursor)
            
            elapsed = time.time() - start
            
            search_log.append({
                "stage": stage_name,
                "count": len(stage_candidates),
                "time_ms": int(elapsed * 1000)
            })
            
            logger.info(f"   ✅ Found {len(stage_candidates)} candidates in {elapsed:.2f}s")
            
            # If we have enough candidates, STOP!
            if len(stage_candidates) >= limit:
                candidates = stage_candidates
                logger.info(f"🎯 SUCCESS! Using stage: {stage_name}")
                break
            
            # Otherwise, keep these and try next stage
            if stage_candidates:
                candidates = stage_candidates
                logger.info(f"   ⚠️ Not enough, trying next stage...")
        
        # Step 3: Score and rank candidates
        if candidates:
            scored_candidates = self._score_candidates(candidates, jd_data, expanded_terms)
        else:
            scored_candidates = []
            logger.warning("❌ No candidates found in any stage!")
        
        return {
            "success": len(candidates) > 0,
            "candidates": scored_candidates[:limit],
            "total_found": len(candidates),
            "search_log": search_log,
            "expanded_terms": expanded_terms,
            "suggestions": self._generate_refinement_suggestions(jd_data, len(candidates))
        }
    
    
    def _expand_search_terms_with_ai(
        self,
        jd_data: Dict[str, Any],
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Use AI to semantically expand search terms.
        """
        
        base_industries = filters.get("industries") if filters else jd_data.get("industries", [])
        base_seniority = filters.get("seniority") if filters else jd_data.get("seniority", "")
        role_title = jd_data.get("role_title", "")
        required_skills = jd_data.get("required_skills", [])
        
        prompt = f"""You are a recruitment database expert. Expand these search terms to match LinkedIn profiles.

**Original Terms:**
- Role Title: {role_title}
- Required Skills (top 10): {required_skills[:10]}
- Industries: {base_industries}
- Seniority: {base_seniority}

**Database Fields:**
- expertise: comma-separated keywords (e.g., "javascript,react,node.js,mongodb,express")
- summary: paragraph text describing experience
- title: job titles
- current_industry: LinkedIn industry names (e.g., "Computer Software", "Information Technology and Services")
- seniority_level: values like "senior", "lead", "principal", "analyst", "associate"

**Task:**
Extract TOP 8 TECHNICAL SKILLS (core technologies only, no soft skills) with variations.

Return ONLY a JSON object:
{{
  "top_technical_skills": [
    {{"name": "Next.js", "variations": ["Next.js", "Next", "Nextjs"]}},
    {{"name": "Node.js", "variations": ["Node.js", "Node", "NodeJS"]}},
    ...
  ],
  "industries": ["Computer Software", "Information Technology and Services", ...],
  "seniority_levels": ["senior", "lead", "principal"],
  "title_keywords": ["Full Stack Developer", "Full Stack Engineer", ...]
}}

**Important:**
- Focus on searchable technical terms
- Include variations for each skill
- Map generic industries to LinkedIn standard names
- Keep it concise (8 skills max)"""

        try:
            response = self.ai_client.chat.completions.create(
                model="anthropic/claude-haiku-4.5",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1500
            )
            
            import json
            ai_response = response.choices[0].message.content.strip()
            
            # Clean markdown if present
            if "```" in ai_response:
                ai_response = ai_response.split("```")[1]
                if ai_response.startswith("json"):
                    ai_response = ai_response[4:]
                ai_response = ai_response.split("```")[0]
            
            expanded = json.loads(ai_response)
            
            # Flatten skills into searchable list
            expanded["all_skill_terms"] = []
            for skill in expanded.get("top_technical_skills", []):
                expanded["all_skill_terms"].extend(skill.get("variations", []))
            
            logger.info("✅ AI semantic expansion successful")
            return expanded
            
        except Exception as e:
            logger.error(f"❌ AI expansion failed: {e}, using basic expansion")
            return self._basic_expansion(jd_data, filters)
    
    
    def _basic_expansion(
        self,
        jd_data: Dict[str, Any],
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Fallback expansion without AI."""
        
        required_skills = jd_data.get("required_skills", [])
        
        # Extract technical skills
        soft_skills = {"communication", "problem-solving", "leadership", "teamwork"}
        
        technical_skills = []
        all_skill_terms = []
        
        import re
        for skill in required_skills[:8]:
            if any(soft in skill.lower() for soft in soft_skills):
                continue
            
            clean_skill = re.split(r'[\(\[]', skill)[0].strip()
            variations = [clean_skill]
            
            if ".js" in clean_skill.lower():
                base = clean_skill.replace(".js", "").replace(".JS", "")
                variations.extend([base, base + "JS"])
            
            technical_skills.append({"name": clean_skill, "variations": variations})
            all_skill_terms.extend(variations)
        
        # Expand industries
        base_industries = filters.get("industries") if filters else jd_data.get("industries", [])
        
        industry_map = {
            "SaaS": ["Computer Software", "Information Technology and Services", "Internet"],
            "Fintech": ["Financial Services", "Banking", "Computer Software"],
            "E-commerce": ["Internet", "Retail", "Computer Software"],
        }
        
        expanded_industries = []
        for ind in base_industries:
            expanded_industries.append(ind)
            if ind in industry_map:
                expanded_industries.extend(industry_map[ind])
        
        # Seniority
        base_seniority = filters.get("seniority") if filters else jd_data.get("seniority", "")
        seniority_lower = base_seniority.lower()
        
        if "senior" in seniority_lower:
            seniority_levels = ["senior", "lead", "principal", "staff"]
        elif "mid" in seniority_lower:
            seniority_levels = ["senior", "analyst", "associate"]
        else:
            seniority_levels = ["senior", "lead"]
        
        # Title keywords
        role_title = jd_data.get("role_title", "")
        words = re.findall(r'\b\w+\b', role_title)
        title_keywords = []
        for i in range(len(words) - 1):
            title_keywords.append(f"{words[i]} {words[i+1]}")
        
        return {
            "top_technical_skills": technical_skills,
            "all_skill_terms": all_skill_terms,
            "industries": list(set(expanded_industries)),
            "seniority_levels": seniority_levels,
            "title_keywords": title_keywords[:5]
        }
    
    
    def _build_search_stages(
        self,
        expanded_terms: Dict[str, Any],
        target_limit: int
    ) -> List[Dict[str, Any]]:
        """
        Build progressive search stages from most to least restrictive.
        
        Each stage stops as soon as we have enough candidates.
        """
        stages = []
        
        skill_terms = expanded_terms.get("all_skill_terms", [])[:15]
        industries = expanded_terms.get("industries", [])
        seniority_levels = expanded_terms.get("seniority_levels", [])
        title_keywords = expanded_terms.get("title_keywords", [])
        
        # Build skill query components
        skill_conditions = []
        if skill_terms:
            for skill in skill_terms:
                skill_conditions.extend([
                    {"expertise": {"$regex": skill, "$options": "i"}},
                    {"summary": {"$regex": skill, "$options": "i"}}
                ])
        
        # Build title query components
        title_conditions = []
        if title_keywords:
            for keyword in title_keywords[:5]:
                title_conditions.append({"title": {"$regex": keyword, "$options": "i"}})
        
        # Stage 1: Skills + Title + Industry + Seniority (PERFECT MATCH)
        if skill_conditions and title_conditions and industries and seniority_levels:
            stages.append({
                "name": "Perfect Match (Skills + Title + Industry + Seniority)",
                "query": {
                    "$and": [
                        {"$or": skill_conditions},
                        {"$or": title_conditions},
                        {"title": {"$ne": "NA"}},
                        {
                            "$or": [
                                {"current_industry": {"$in": industries, "$ne": "NA"}},
                                {"experience.industry": {"$in": industries}}
                            ]
                        },
                        {"seniority_level": {"$in": seniority_levels, "$ne": "NA"}}
                    ]
                },
                "target": target_limit
            })
        
        # Stage 2: Skills + Title (VERY GOOD)
        if skill_conditions and title_conditions:
            stages.append({
                "name": "Skills + Title",
                "query": {
                    "$and": [
                        {"$or": skill_conditions},
                        {"$or": title_conditions},
                        {"title": {"$ne": "NA"}}
                    ]
                },
                "target": target_limit
            })
        
        # Stage 3: Skills + Industry (GOOD)
        if skill_conditions and industries:
            stages.append({
                "name": "Skills + Industry",
                "query": {
                    "$and": [
                        {"$or": skill_conditions},
                        {
                            "$or": [
                                {"current_industry": {"$in": industries, "$ne": "NA"}},
                                {"experience.industry": {"$in": industries}}
                            ]
                        }
                    ]
                },
                "target": target_limit
            })
        
        # Stage 4: Skills + Seniority (ACCEPTABLE)
        if skill_conditions and seniority_levels:
            stages.append({
                "name": "Skills + Seniority",
                "query": {
                    "$and": [
                        {"$or": skill_conditions},
                        {"seniority_level": {"$in": seniority_levels, "$ne": "NA"}}
                    ]
                },
                "target": target_limit
            })
        
        # Stage 5: Skills Only (LAST RESORT)
        if skill_conditions:
            stages.append({
                "name": "Skills Only",
                "query": {
                    "$and": [
                        {"$or": skill_conditions},
                        {
                            "$or": [
                                {"expertise": {"$ne": "NA", "$ne": ""}},
                                {"summary": {"$ne": "NA", "$ne": ""}}
                            ]
                        }
                    ]
                },
                "target": target_limit
            })
        
        # Stage 6: Industry + Title (FALLBACK)
        if industries and title_conditions:
            stages.append({
                "name": "Industry + Title (No skills)",
                "query": {
                    "$and": [
                        {"$or": title_conditions},
                        {"title": {"$ne": "NA"}},
                        {
                            "$or": [
                                {"current_industry": {"$in": industries, "$ne": "NA"}},
                                {"experience.industry": {"$in": industries}}
                            ]
                        }
                    ]
                },
                "target": target_limit
            })
        
        return stages
    
    
    def _score_candidates(
        self,
        candidates: List[Dict],
        jd_data: Dict[str, Any],
        expanded_terms: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Score candidates.
        
        Scoring:
        - Skills: 60 points (most important)
        - Title: 20 points
        - Industry: 10 points
        - Seniority: 10 points
        """
        scored = []
        
        all_skill_terms = [s.lower() for s in expanded_terms.get("all_skill_terms", [])]
        title_keywords = expanded_terms.get("title_keywords", [])
        industries = expanded_terms.get("industries", [])
        seniority_levels = expanded_terms.get("seniority_levels", [])
        
        for candidate in candidates:
            score = 0
            match_details = []
            matched_skills = []
            
            # 1. Skills (60 points)
            expertise = candidate.get("expertise", "").lower()
            summary = candidate.get("summary", "").lower()
            
            for skill_term in all_skill_terms:
                if skill_term.lower() in expertise or skill_term.lower() in summary:
                    matched_skills.append(skill_term)
            
            if all_skill_terms:
                unique_matched = list(set(matched_skills))
                skill_score = (len(unique_matched) / len(set(all_skill_terms))) * 60
                score += skill_score
                
                if unique_matched:
                    match_details.append(f"Skills ({len(unique_matched)}): {', '.join(unique_matched[:3])}")
            
            # 2. Title (20 points)
            title = candidate.get("title", "").lower()
            title_matched = False
            for keyword in title_keywords:
                if keyword.lower() in title:
                    score += 20
                    match_details.append(f"Title: '{keyword}'")
                    title_matched = True
                    break
            
            # 3. Industry (10 points)
            current_industry = candidate.get("current_industry", "")
            if current_industry in industries:
                score += 10
                match_details.append(f"Industry: {current_industry}")
            
            # 4. Seniority (10 points)
            seniority = candidate.get("seniority_level", "")
            if seniority in seniority_levels:
                score += 10
                match_details.append(f"Seniority: {seniority}")
            
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
                "score": round(score, 1),
                "matched_skills": list(set(matched_skills))[:10],
                "match_details": match_details
            })
        
        # Sort by score descending
        scored.sort(key=lambda x: x["score"], reverse=True)
        
        return scored
    
    
    def _generate_refinement_suggestions(
        self,
        jd_data: Dict[str, Any],
        results_count: int
    ) -> List[str]:
        """Generate suggestions."""
        suggestions = []
        
        if results_count == 0:
            suggestions.extend([
                "No candidates found with required skills",
                "Try reducing skill requirements",
                "Consider alternative technologies"
            ])
        elif results_count < 10:
            suggestions.extend([
                "Limited matches found",
                "Try broadening skill requirements"
            ])
        else:
            suggestions.extend([
                f"Found {results_count} candidates!",
                "Refine by adding more criteria"
            ])
        
        return suggestions