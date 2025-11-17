"""
Query Builder 
=========================================
Based on real database stats:
- 58M documents
- title: 98.5% valid (904k NA)
- seniority_level: 55% valid (26M NA)  
- current_industry: 69% valid (18M NA)
- expertise: 40% valid (35M NA) - NOT INDEXED
"""

import re
from enum import Enum
from typing import Any, Dict, List, Optional


class QueryStrategy(str, Enum):
    """Query strategies that ACTUALLY use indexes."""
    INDUSTRY_SENIORITY = "industry_seniority"  # Uses compound index
    INDUSTRY_ONLY = "industry_only"
    SENIORITY_ONLY = "seniority_only"
    TITLE_WORDS = "title_words"  # Individual words, not regex OR
    MINIMAL = "minimal"


class QueryBuilder:
    """
    Builds queries that use indexes properly.
    
    Available indexes:
    - idx_title (title)
    - idx_seniority (seniority_level)
    - idx_industry (current_industry)
    - idx_location_seniority_industry (compound)
    - idx_industry_exp (compound)
    """
    
    def __init__(self, ideal_profile: Dict[str, Any]):
        self.profile = ideal_profile
        
        # Pre-process seniority mapping
        self.seniority_values = self._map_seniority(
            ideal_profile.get("seniority", "")
        )
    
    def build(self, strategy: QueryStrategy) -> Dict[str, Any]:
        """Build query based on strategy."""
        
        if strategy == QueryStrategy.INDUSTRY_SENIORITY:
            return self._build_industry_seniority()
        elif strategy == QueryStrategy.INDUSTRY_ONLY:
            return self._build_industry_only()
        elif strategy == QueryStrategy.SENIORITY_ONLY:
            return self._build_seniority_only()
        elif strategy == QueryStrategy.TITLE_WORDS:
            return self._build_title_words()
        elif strategy == QueryStrategy.MINIMAL:
            return self._build_minimal()
        else:
            return self._build_industry_seniority()
    
    def _build_industry_seniority(self) -> Dict[str, Any]:
        """
        Strategy 1: Use compound index (industry + seniority).
        
        This is FAST because MongoDB has idx_location_seniority_industry.
        """
        
        conditions = []
        
        # 1. Industry (indexed, 69% valid)
        industries = self.profile.get("industries", [])
        if industries:
            # Use $in for exact matches (uses index)
            conditions.append({
                "current_industry": {
                    "$in": industries[:3],  # Top 3 industries
                    "$ne": "NA"
                }
            })
        
        # 2. Seniority (indexed, 55% valid)
        if self.seniority_values:
            conditions.append({
                "seniority_level": {
                    "$in": self.seniority_values,
                    "$ne": "NA"
                }
            })
        
        # 3. Title words (indexed, but as separate check)
        title_words = self._extract_title_words()
        if title_words:
            # Use $in for individual words (better than regex OR)
            # This will match titles containing ANY of these words
            word_conditions = []
            for word in title_words[:3]:  # Top 3 words
                word_conditions.append({
                    "title": {
                        "$regex": f"\\b{self._escape_regex(word)}\\b",
                        "$options": "i"
                    }
                })
            
            if word_conditions:
                conditions.append({"$or": word_conditions})
        
        if not conditions:
            return {"title": {"$ne": "NA", "$exists": True}}
        
        return {"$and": conditions} if len(conditions) > 1 else conditions[0]
    
    def _build_industry_only(self) -> Dict[str, Any]:
        """Strategy 2: Industry filter only."""
        
        industries = self.profile.get("industries", [])
        if industries:
            return {
                "current_industry": {
                    "$in": industries[:3],
                    "$ne": "NA"
                }
            }
        
        return self._build_seniority_only()
    
    def _build_seniority_only(self) -> Dict[str, Any]:
        """Strategy 3: Seniority filter only."""
        
        if self.seniority_values:
            return {
                "seniority_level": {
                    "$in": self.seniority_values,
                    "$ne": "NA"
                }
            }
        
        return self._build_title_words()
    
    def _build_title_words(self) -> Dict[str, Any]:
        """
        Strategy 4: Individual title word matches.
        
        Instead of "full|stack|developer" (can't use index),
        we search for ONE word at a time.
        """
        
        title_words = self._extract_title_words()
        if not title_words:
            return self._build_minimal()
        
        # Use the MOST specific word (usually first)
        primary_word = title_words[0]
        
        return {
            "title": {
                "$regex": f"\\b{self._escape_regex(primary_word)}\\b",
                "$options": "i"
            }
        }
    
    def _build_minimal(self) -> Dict[str, Any]:
        """Strategy 5: Just get valid titles."""
        
        return {
            "title": {
                "$ne": "NA",
                "$exists": True
            }
        }
    
    def _map_seniority(self, seniority: str) -> List[str]:
        """
        Map user seniority to database values.
        
        Returns list of exact values to search (not regex).
        """
        
        if not seniority:
            return []
        
        seniority_lower = seniority.lower()
        
        # Map to actual database values
        if "senior" in seniority_lower or "staff" in seniority_lower:
            return ["senior", "lead", "principal", "staff"]
        elif "mid" in seniority_lower:
            return ["mid", "senior"]
        elif "entry" in seniority_lower or "junior" in seniority_lower:
            return ["entry", "junior", "associate"]
        elif "executive" in seniority_lower or "director" in seniority_lower:
            return ["director", "vp", "head", "chief", "cxo", "executive"]
        else:
            # Return the value itself
            return [seniority]
    
    def _extract_title_words(self) -> List[str]:
        """
        Extract individual words from title.
        
        Returns words in priority order (most specific first).
        """
        
        role_title = self.profile.get("role_title", "")
        if not role_title:
            return []
        
        # Common stop words
        stop_words = {
            "senior", "junior", "lead", "principal", "staff",
            "i", "ii", "iii", "iv", "v",
            "the", "a", "an", "and", "or", "for", "to", "of", "at",
            "with", "in", "on", "-", "/", "&", "real", "time"
        }
        
        # Split on delimiters
        words = re.split(r'[\s\-/,&()]+', role_title.lower())
        
        # Filter stop words
        filtered = []
        for w in words:
            w = w.strip()
            if w and w not in stop_words and len(w) > 2:
                filtered.append(w)
        
        # Prioritize technical/specific terms
        priorities = ["full", "stack", "developer", "engineer", "architect",
                      "backend", "frontend", "devops", "data", "cloud"]
        
        prioritized = []
        other = []
        
        for word in filtered:
            if word in priorities:
                prioritized.append(word)
            else:
                other.append(word)
        
        return prioritized + other
    
    def _escape_regex(self, text: str) -> str:
        """Escape regex special characters."""
        return re.escape(text)
    
    def describe_query(self, query: Dict[str, Any]) -> str:
        """Human-readable query description."""
        
        parts = []
        query_str = str(query)
        
        if "current_industry" in query_str:
            parts.append("industry")
        if "seniority_level" in query_str:
            parts.append("seniority")
        if "location" in query_str:
            parts.append("location")
        if "title" in query_str:
            parts.append("title")
        if "$or" in query_str:
            parts.append("(multiple options)")
        
        return " + ".join(parts) if parts else "basic"