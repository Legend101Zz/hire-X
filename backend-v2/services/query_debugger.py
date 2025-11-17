"""
Query Debugger V4 - Database-Aware
===================================
"""

import json
from typing import Any, Dict, List, Optional

from services.query_builder import QueryBuilder, QueryStrategy


class QueryDebugger:
    """Debugs queries with real database knowledge."""
    
    # Database stats
    DB_STATS = {
        "total_docs": 58_918_216,
        "title_valid": 58_013_325,  # 98.5%
        "seniority_valid": 32_417_410,  # 55%
        "industry_valid": 40_461_430,  # 69%
        "expertise_valid": 23_361_660,  # 40% (NOT INDEXED!)
        "location_valid": 47_283_614,  # 80%
    }
    
    def analyze_query(
        self,
        ideal_profile: Dict[str, Any],
        query: Dict[str, Any],
        strategy: QueryStrategy,
        result_count: int,
        query_time_ms: int
    ) -> Dict[str, Any]:
        """Analyze query performance and suggest improvements."""
        
        # Check for problems
        issues = []
        
        # 1. Timeout issues
        if query_time_ms > 2000:
            issues.append("Query too slow (>2s)")
            issues.append("Likely not using indexes properly")
        
        # 2. Check if querying expertise (BAD)
        if "expertise" in str(query):
            issues.append("Querying expertise field (not indexed, 60% NA)")
            issues.append("This will cause full collection scan")
        
        # 3. Check regex complexity
        if "$regex" in str(query):
            regex_patterns = self._extract_regex_patterns(query)
            for pattern in regex_patterns:
                if "|" in pattern:
                    issues.append(f"Multi-term regex: {pattern} (can't use index)")
        
        # 4. Zero results
        if result_count == 0:
            issues.append("No matching documents found")
            
            # Diagnose why
            if "current_industry" in str(query):
                industries = ideal_profile.get("industries", [])
                issues.append(f"Industry filter might be too specific: {industries}")
            
            if "seniority_level" in str(query):
                issues.append("Seniority filter present (55% of docs have valid seniority)")
        
        # Suggest next strategy
        next_strategy = self._suggest_next_strategy(strategy, result_count, issues)
        
        # Should ask user?
        ask_user = (strategy == QueryStrategy.MINIMAL and result_count == 0)
        
        return {
            "diagnosis": self._create_diagnosis(issues, result_count, query_time_ms),
            "likely_issues": issues,
            "next_strategy": next_strategy.value if next_strategy else None,
            "ask_user": ask_user,
            "clarifying_questions": self._generate_questions(ideal_profile, issues)
        }
    
    def _extract_regex_patterns(self, query: Dict) -> List[str]:
        """Extract regex patterns from query."""
        patterns = []
        query_str = json.dumps(query)
        
        import re
        regex_matches = re.findall(r'"\\$regex":\s*"([^"]+)"', query_str)
        patterns.extend(regex_matches)
        
        return patterns
    
    def _suggest_next_strategy(
        self,
        current: QueryStrategy,
        result_count: int,
        issues: List[str]
    ) -> Optional[QueryStrategy]:
        """Suggest next strategy to try."""
        
        if result_count > 0:
            return None  # Success!
        
        strategies_order = [
            QueryStrategy.INDUSTRY_SENIORITY,
            QueryStrategy.INDUSTRY_ONLY,
            QueryStrategy.SENIORITY_ONLY,
            QueryStrategy.TITLE_WORDS,
            QueryStrategy.MINIMAL
        ]
        
        try:
            current_idx = strategies_order.index(current)
            if current_idx < len(strategies_order) - 1:
                return strategies_order[current_idx + 1]
        except ValueError:
            pass
        
        return None
    
    def _create_diagnosis(
        self,
        issues: List[str],
        result_count: int,
        query_time_ms: int
    ) -> str:
        """Create human-readable diagnosis."""
        
        if result_count == 0:
            return "Query returned no results - filters too strict"
        elif query_time_ms > 2000:
            return f"Query too slow ({query_time_ms}ms) - not using indexes"
        elif len(issues) > 0:
            return issues[0]
        else:
            return "Query executed successfully"
    
    def _generate_questions(
        self,
        profile: Dict,
        issues: List[str]
    ) -> List[str]:
        """Generate clarifying questions."""
        
        questions = []
        
        if "expertise" in str(issues):
            questions.append("Should I relax skill requirements?")
        
        if "Industry" in str(issues):
            questions.append("Should I search across all industries?")
        
        if "Seniority" in str(issues):
            questions.append("Should I include other seniority levels?")
        
        return questions[:3]