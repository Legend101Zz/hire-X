"""
Query Debugger V3
================
With schema awareness.
"""

import json
from typing import Any, Dict

from services.ai_parser import AIParser
from services.query_builder import QueryBuilder, QueryStrategy


class QueryDebugger:
    """Debugs MongoDB queries with schema awareness."""
    
    DEBUGGER_PROMPT = """You are a MongoDB query debugging assistant for a recruitment platform.

**DATABASE SCHEMA:**
```
{
  "title": "string",                    // Job title (INDEXED)
  "experience_years": "number",         // Years of experience (INDEXED) - can be missing
  "location": "string",                 // City, Country (INDEXED) - can be "NA"
  "current_industry": "string",         // Industry (INDEXED) - can be "NA"
  "seniority_level": "string",          // Seniority (INDEXED) - can be "NA"
  "expertise": "string",                // Skills (NOT INDEXED) - comma-separated, can be "NA"
  "experience": "array",                // Work history - can be ['NA'] or empty
  "education": "array",                 // Education history - can be ['NA'] or empty
  "summary": "string",                  // Profile summary - often "NA"
  "functional_area": "string",          // Functional area (e.g., "it", "sales")
}
```

**IMPORTANT NOTES:**
- Many fields can be "NA" or missing
- Only title, experience_years, location, current_industry, seniority_level are indexed
- Queries on expertise (skills) are SLOW - use sparingly
- Text search index was removed (too slow)

**AVAILABLE QUERY STRATEGIES:**
1. EXACT - All filters (experience + location + industry + title + skills)
2. RELAXED_LOCATION - Remove location filter
3. RELAXED_INDUSTRY - Remove industry filter  
4. TITLE_ONLY - Just title keywords
5. MINIMAL - Single title keyword only

**YOUR TASK:**
Analyze why a query returned few/no results and suggest next strategy.

Respond with JSON:
```json
{
    "diagnosis": "Why query failed",
    "likely_issues": ["issue1", "issue2"],
    "next_strategy": "STRATEGY_NAME",
    "ask_user": false,
    "clarifying_questions": ["question1", "question2"]
}
```

**ANALYSIS GUIDELINES:**
- If experience_years filter returns 0: likely too strict or field missing
- If location/industry filter fails: might be "NA" in database
- If title keywords fail: keywords might not match database titles
- If 3+ strategies tried: ask user for clarification

Now analyze this query:"""
    
    def __init__(self, ai_parser: AIParser):
        self.ai = ai_parser
    
    async def analyze_query(
        self,
        ideal_profile: Dict[str, Any],
        query: Dict[str, Any],
        strategy: QueryStrategy,
        result_count: int,
        query_builder: QueryBuilder
    ) -> Dict[str, Any]:
        """Analyze query and suggest improvements."""
        
        query_description = query_builder.describe_query(query)
        
        user_prompt = f"""
**Ideal Profile:**
{json.dumps(ideal_profile, indent=2)}

**Query Strategy Used:** {strategy}

**MongoDB Query:**
{json.dumps(query, indent=2)}

**Query Description:** {query_description}

**Results Found:** {result_count}

**Analysis:**
"""
        
        try:
            response = await self.ai.call_llm(
                system_prompt=self.DEBUGGER_PROMPT,
                user_prompt=user_prompt,
                model="anthropic/claude-sonnet-4",
                response_format="json"
            )
            
            analysis = json.loads(response)
            
            return {
                "diagnosis": analysis.get("diagnosis", "Unknown"),
                "likely_issues": analysis.get("likely_issues", []),
                "next_strategy": analysis.get("next_strategy", "RELAXED_LOCATION"),
                "ask_user": analysis.get("ask_user", False),
                "clarifying_questions": analysis.get("clarifying_questions", [])
            }
        
        except Exception as e:
            print(f"Error in query debugger: {e}")
            return self._fallback_analysis(strategy, result_count)
    
    def _fallback_analysis(self, strategy: QueryStrategy, result_count: int) -> Dict[str, Any]:
        """Fallback if LLM fails."""
        
        if result_count == 0:
            if strategy == QueryStrategy.EXACT:
                return {
                    "diagnosis": "Exact match too strict",
                    "likely_issues": ["Too many filters"],
                    "next_strategy": "RELAXED_LOCATION",
                    "ask_user": False,
                    "clarifying_questions": []
                }
            elif strategy == QueryStrategy.MINIMAL:
                return {
                    "diagnosis": "Even minimal query returns nothing",
                    "likely_issues": ["Title keywords don't match database"],
                    "next_strategy": None,
                    "ask_user": True,
                    "clarifying_questions": [
                        "Could you describe the role with different keywords?",
                        "What alternative job titles should I search for?"
                    ]
                }
            else:
                # Try next strategy
                strategies = [
                    QueryStrategy.EXACT,
                    QueryStrategy.RELAXED_LOCATION,
                    QueryStrategy.RELAXED_INDUSTRY,
                    QueryStrategy.TITLE_ONLY,
                    QueryStrategy.MINIMAL
                ]
                
                try:
                    current_idx = strategies.index(strategy)
                    if current_idx < len(strategies) - 1:
                        next_strategy = strategies[current_idx + 1]
                        return {
                            "diagnosis": f"{strategy} too strict",
                            "likely_issues": ["Need to relax constraints"],
                            "next_strategy": next_strategy.value,
                            "ask_user": False,
                            "clarifying_questions": []
                        }
                except:
                    pass
        
        return {
            "diagnosis": "Query returned no actionable results",
            "likely_issues": [],
            "next_strategy": None,
            "ask_user": True,
            "clarifying_questions": ["Could you provide more details?"]
        }