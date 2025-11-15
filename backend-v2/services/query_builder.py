"""
Query Builder - Working Version
================================
Uses ONLY fields that exist in your database.
"""

import re
from enum import Enum
from typing import Any, Dict, List, Optional


class QueryStrategy(str, Enum):
    """Query strategies from strict to relaxed."""
    EXACT = "exact"
    RELAXED_LOCATION = "relaxed_location"
    TITLE_SKILLS = "title_skills"
    TITLE_ONLY = "title_only"
    MINIMAL = "minimal"


class QueryBuilder:
    """
    Builds MongoDB queries using only available fields.
    
    Available fields:
    - title (string, indexed)
    - location (string, indexed)
    - current_industry (string, indexed)
    - seniority_level (string, indexed)
    - expertise (string, NOT indexed)
    - functional_area (string)
    """
    
    def __init__(self, ideal_profile: Dict[str, Any]):
        self.profile = ideal_profile
    
    def build(self, strategy: QueryStrategy) -> Dict[str, Any]:
        """Build query based on strategy."""
        
        if strategy == QueryStrategy.EXACT:
            return self._build_exact()
        elif strategy == QueryStrategy.RELAXED_LOCATION:
            return self._build_relaxed_location()
        elif strategy == QueryStrategy.TITLE_SKILLS:
            return self._build_title_skills()
        elif strategy == QueryStrategy.TITLE_ONLY:
            return self._build_title_only()
        elif strategy == QueryStrategy.MINIMAL:
            return self._build_minimal()
        else:
            return self._build_exact()
    
    def _build_exact(self) -> Dict[str, Any]:
        """
        Strategy 1: Use all available filters.
        
        Priority:
        1. Location (indexed, fast)
        2. Industry (indexed, fast)
        3. Seniority (indexed, fast)
        4. Title (indexed, regex)
        """
        
        conditions = []
        
        # 1. LOCATION (indexed, fastest)
        if self.profile.get("locations"):
            location_patterns = []
            for loc in self.profile["locations"][:2]:
                location_patterns.append({
                    "location": {
                        "$regex": self._escape_regex(loc),
                        "$options": "i"
                    }
                })
            
            # Exclude NA
            if len(location_patterns) == 1:
                conditions.append({
                    "$and": [
                        location_patterns[0],
                        {"location": {"$ne": "NA"}}
                    ]
                })
            elif len(location_patterns) > 1:
                conditions.append({
                    "$and": [
                        {"$or": location_patterns},
                        {"location": {"$ne": "NA"}}
                    ]
                })
        
        # 2. INDUSTRY (indexed)
        if self.profile.get("industries"):
            industry_patterns = []
            for industry in self.profile["industries"][:2]:
                industry_patterns.append({
                    "current_industry": {
                        "$regex": self._escape_regex(industry),
                        "$options": "i"
                    }
                })
            
            if len(industry_patterns) == 1:
                conditions.append({
                    "$and": [
                        industry_patterns[0],
                        {"current_industry": {"$ne": "NA"}}
                    ]
                })
            elif len(industry_patterns) > 1:
                conditions.append({
                    "$and": [
                        {"$or": industry_patterns},
                        {"current_industry": {"$ne": "NA"}}
                    ]
                })
        
        # 3. SENIORITY (indexed)
        if self.profile.get("seniority"):
            seniority_map = {
                "Entry Level": "entry|junior|associate",
                "Mid Level": "mid|senior|lead",
                "Senior Level": "senior|lead|principal|staff",
                "Executive": "director|vp|head|chief|cxo"
            }
            
            seniority_pattern = seniority_map.get(
                self.profile["seniority"],
                self._escape_regex(self.profile["seniority"])
            )
            
            conditions.append({
                "$and": [
                    {
                        "seniority_level": {
                            "$regex": seniority_pattern,
                            "$options": "i"
                        }
                    },
                    {"seniority_level": {"$ne": "NA"}}
                ]
            })
        
        # 4. TITLE (indexed, but regex slower)
        if self.profile.get("role_title"):
            keywords = self._extract_title_keywords(self.profile["role_title"])
            if keywords:
                # Match ANY of top 3 keywords
                title_pattern = "|".join([self._escape_regex(kw) for kw in keywords[:3]])
                conditions.append({
                    "$and": [
                        {
                            "title": {
                                "$regex": title_pattern,
                                "$options": "i"
                            }
                        },
                        {"title": {"$ne": "NA"}}
                    ]
                })
        
        # Combine
        return self._combine_conditions(conditions)
    
    def _build_relaxed_location(self) -> Dict[str, Any]:
        """Strategy 2: Remove location constraint."""
        
        conditions = []
        
        # Industry
        if self.profile.get("industries"):
            conditions.append({
                "$and": [
                    {
                        "current_industry": {
                            "$regex": self._escape_regex(self.profile["industries"][0]),
                            "$options": "i"
                        }
                    },
                    {"current_industry": {"$ne": "NA"}}
                ]
            })
        
        # Title
        if self.profile.get("role_title"):
            keywords = self._extract_title_keywords(self.profile["role_title"])
            if keywords:
                title_pattern = "|".join([self._escape_regex(kw) for kw in keywords[:3]])
                conditions.append({
                    "$and": [
                        {
                            "title": {
                                "$regex": title_pattern,
                                "$options": "i"
                            }
                        },
                        {"title": {"$ne": "NA"}}
                    ]
                })
        
        return self._combine_conditions(conditions)
    
    def _build_title_skills(self) -> Dict[str, Any]:
        """Strategy 3: Title + skills only."""
        
        conditions = []
        
        # Title
        if self.profile.get("role_title"):
            keywords = self._extract_title_keywords(self.profile["role_title"])
            if keywords:
                title_pattern = "|".join([self._escape_regex(kw) for kw in keywords[:2]])
                conditions.append({
                    "$and": [
                        {
                            "title": {
                                "$regex": title_pattern,
                                "$options": "i"
                            }
                        },
                        {"title": {"$ne": "NA"}}
                    ]
                })
        
        # Top 1-2 skills
        if self.profile.get("must_have_skills"):
            skills = self.profile["must_have_skills"][:2]
            skill_pattern = "|".join([self._escape_regex(skill) for skill in skills])
            conditions.append({
                "$and": [
                    {
                        "expertise": {
                            "$regex": skill_pattern,
                            "$options": "i"
                        }
                    },
                    {"expertise": {"$ne": "NA"}}
                ]
            })
        
        return self._combine_conditions(conditions)
    
    def _build_title_only(self) -> Dict[str, Any]:
        """Strategy 4: Just title keywords."""
        
        if self.profile.get("role_title"):
            keywords = self._extract_title_keywords(self.profile["role_title"])
            if keywords:
                title_pattern = "|".join([self._escape_regex(kw) for kw in keywords[:3]])
                return {
                    "$and": [
                        {
                            "title": {
                                "$regex": title_pattern,
                                "$options": "i"
                            }
                        },
                        {"title": {"$ne": "NA"}}
                    ]
                }
        
        return {}
    
    def _build_minimal(self) -> Dict[str, Any]:
        """Strategy 5: Single keyword."""
        
        if self.profile.get("role_title"):
            keywords = self._extract_title_keywords(self.profile["role_title"])
            if keywords:
                return {
                    "$and": [
                        {
                            "title": {
                                "$regex": self._escape_regex(keywords[0]),
                                "$options": "i"
                            }
                        },
                        {"title": {"$ne": "NA"}}
                    ]
                }
        
        # Absolute fallback - get ANY profiles
        return {"title": {"$ne": "NA", "$exists": True}}
    
    def _combine_conditions(self, conditions: List[Dict]) -> Dict[str, Any]:
        """Combine conditions."""
        
        if len(conditions) == 0:
            # Fallback - just get any valid profiles
            return {"title": {"$ne": "NA", "$exists": True}}
        elif len(conditions) == 1:
            return conditions[0]
        else:
            return {"$and": conditions}
    
    def _extract_title_keywords(self, title: str) -> List[str]:
        """Extract important keywords from title."""
        
        # Common stop words
        stop_words = {
            "senior", "junior", "lead", "principal", "staff",
            "i", "ii", "iii", "cat", "the", "a", "an", "and", "or", "for", "to", "of", "at"
        }
        
        # Split and clean
        words = re.split(r'[\s\-/,]+', title.lower())
        
        # Filter
        keywords = [
            w.strip() for w in words 
            if w.strip() and w.strip() not in stop_words and len(w.strip()) > 2
        ]
        
        return keywords
    
    def _escape_regex(self, text: str) -> str:
        """Escape special regex characters."""
        return re.escape(text)
    
    def describe_query(self, query: Dict[str, Any]) -> str:
        """Generate human-readable description."""
        
        parts = []
        
        query_str = str(query)
        
        if "location" in query_str:
            parts.append("location filter")
        if "current_industry" in query_str:
            parts.append("industry filter")
        if "seniority_level" in query_str:
            parts.append("seniority filter")
        if "title" in query_str:
            parts.append("title match")
        if "expertise" in query_str:
            parts.append("skills filter")
        
        return " + ".join(parts) if parts else "basic query"