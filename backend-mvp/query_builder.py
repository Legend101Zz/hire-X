"""
AI-Powered Query Builder with Progressive Search Strategies
"""
import json
import os
import re
from typing import Any, Dict, List, Optional

from ai_model import Model


class IntelligentQueryBuilder:
    """
    Builds MongoDB queries using AI for both strict and relaxed modes.
    """

    def __init__(self):
        self.model = Model()

        # Schema for AI reference
        self.candidate_schema = {
            "location": "Full address (e.g., 'Bengaluru, Karnataka, India')",
            "city": "City name (often 'NA')",
            "state": "State name (often 'NA')",
            "title": "Current job title",
            "summary": "Rich career narrative (2-5 paragraphs with skills, experience, achievements)",
            "expertise": "Comma-separated skills string",
            "functional_area": "Function (e.g., 'it', 'finance')",
            "current_industry": "Current industry",
            "seniority_level": "Seniority (senior, mid, junior, specialist)",
            "experience": "Array of company objects",
            "education": "Array of education objects",
            "certifications": "Array of certifications"
        }

    async def build_query_with_strategy(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]],
        strategy: str = "strict"
    ) -> Dict[str, Any]:
        """
        Build MongoDB query using AI.

        Strategies:
        - "strict": All filters must match (AND logic)
        - "relaxed": Only location mandatory + broad keyword search in summary/expertise
        """

        if strategy == "strict":
            return await self._build_ai_strict_query(filters, expansions)
        elif strategy == "relaxed":
            return await self._build_ai_relaxed_query(filters, expansions)
        else:
            # Default to strict
            return await self._build_ai_strict_query(filters, expansions)

    async def _build_ai_strict_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        AI builds a STRICT query where ALL criteria must match.
        """

        system_prompt = """You are a MongoDB query expert building STRICT candidate search queries.

**STRICT MODE RULES:**
1. ALL filters must match (use $and to combine filter groups)
2. For each filter, use $or to match ANY of the expanded terms
3. Search across MULTIPLE FIELDS including the rich 'summary' field
4. The summary contains detailed career narratives - always search it!

**Candidate Schema:**
- location: "Bengaluru, Karnataka, India" (full address)
- city: Often "NA", use location instead
- title: Job title
- summary: 2-5 paragraphs of career details, skills, achievements (SEARCH THIS!)
- expertise: Comma-separated skills like "python,aws,docker"
- current_industry: Current industry
- experience: Array with company objects (name, industry)
- education: Array with education objects (major, specialization, campus)
- seniority_level: "senior", "mid", "junior", etc.

**Query Building Pattern:**

For location filter:
```json
{
  "$or": [
    {"location": {"$regex": "Mumbai", "$options": "i"}},
    {"city": {"$regex": "Mumbai", "$options": "i"}},
    {"state": {"$regex": "Maharashtra", "$options": "i"}}
  ]
}
```

For skill filter (ALWAYS include summary):
```json
{
  "$or": [
    {"expertise": {"$regex": "Python", "$options": "i"}},
    {"title": {"$regex": "Python", "$options": "i"}},
    {"summary": {"$regex": "Python", "$options": "i"}}
  ]
}
```

For industry filter (check multiple sources):
```json
{
  "$or": [
    {"current_industry": {"$regex": "Fintech", "$options": "i"}},
    {"experience.name": {"$regex": "Fintech", "$options": "i"}},
    {"experience.industry": {"$regex": "Fintech", "$options": "i"}},
    {"summary": {"$regex": "Fintech", "$options": "i"}}
  ]
}
```

**Final Query Structure:**
Combine ALL filter groups with $and:
```json
{
  "$and": [
    { /* location filter with $or */ },
    { /* skill filter with $or */ },
    { /* industry filter with $or */ }
  ]
}
```

Return ONLY the MongoDB query JSON, no explanations."""

        user_message = f"""Build a STRICT MongoDB query where ALL criteria must match.

**Filters (must-have requirements):**
{json.dumps(filters, indent=2)}

**Expanded Terms (include these variations):**
{json.dumps(expansions, indent=2)}

Build strict query (ALL filters must match, but each filter can match ANY of its expanded terms):"""

        try:
            response = await self._call_llm(system_prompt, user_message, temperature=0.1)
            query = self._extract_json(response)
            
            # Fallback if AI fails
            if not query:
                print("⚠️ AI query building failed, using manual strict query")
                return self._build_manual_strict_query(filters, expansions)
            
            return query

        except Exception as e:
            print(f"❌ AI strict query failed: {e}")
            return self._build_manual_strict_query(filters, expansions)

    async def _build_ai_relaxed_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        AI builds a RELAXED query: mandatory location + broad keyword search.
        """

        system_prompt = """You are a MongoDB query expert building RELAXED candidate search queries.

**RELAXED MODE RULES:**
1. ONLY location filters are mandatory (must match)
2. All other keywords (skills, roles, industries) should search broadly across summary/expertise/title
3. Use $or logic for non-location keywords (match ANY of them)
4. The goal: cast a wider net while keeping location fixed

**Candidate Schema:**
- location: "Bengaluru, Karnataka, India" 
- summary: Rich career narratives (ALWAYS search this)
- expertise: Comma-separated skills
- title: Job title
- current_industry: Industry
- experience: Array of companies

**Query Building Pattern:**

Step 1 - Extract location (MANDATORY):
```json
{
  "$or": [
    {"location": {"$regex": "Mumbai", "$options": "i"}},
    {"city": {"$regex": "Mumbai", "$options": "i"}}
  ]
}
```

Step 2 - Extract all other keywords (skills, roles, industries) and search broadly:
```json
{
  "$or": [
    {"summary": {"$regex": "Python", "$options": "i"}},
    {"summary": {"$regex": "Backend", "$options": "i"}},
    {"summary": {"$regex": "Fintech", "$options": "i"}},
    {"expertise": {"$regex": "Python", "$options": "i"}},
    {"expertise": {"$regex": "Backend", "$options": "i"}},
    {"title": {"$regex": "Backend", "$options": "i"}},
    {"current_industry": {"$regex": "Fintech", "$options": "i"}}
  ]
}
```

**Final Query Structure:**
```json
{
  "$and": [
    { /* mandatory location */ },
    { /* broad keyword search with $or */ }
  ]
}
```

If NO location filter exists, just return the broad keyword search.

Return ONLY the MongoDB query JSON."""

        user_message = f"""Build a RELAXED MongoDB query:
- Location filters: MANDATORY
- All other terms: broad search across summary/expertise/title (ANY match)

**Filters:**
{json.dumps(filters, indent=2)}

**Expanded Terms:**
{json.dumps(expansions, indent=2)}

Build relaxed query:"""

        try:
            response = await self._call_llm(system_prompt, user_message, temperature=0.2)
            query = self._extract_json(response)
            
            if not query:
                print("⚠️ AI query building failed, using manual relaxed query")
                return self._build_manual_relaxed_query(filters, expansions)
            
            return query

        except Exception as e:
            print(f"❌ AI relaxed query failed: {e}")
            return self._build_manual_relaxed_query(filters, expansions)

    # =============================================================================
    # MANUAL FALLBACK QUERIES (in case AI fails)
    # =============================================================================

    def _build_manual_strict_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """Manual fallback for strict query."""
        query_parts = []

        field_to_expansion = {
            "location": "locations",
            "title": "roles",
            "current_industry": "industries",
            "expertise": "skills"
        }

        for filter_obj in filters:
            field = filter_obj.get("field")
            value = filter_obj.get("value")

            if not field or not value:
                continue

            # Get expanded values
            expansion_key = field_to_expansion.get(field, field)
            expanded_values = [value] if not isinstance(value, list) else value.copy()

            if expansion_key in expansions and expansions[expansion_key]:
                expanded_values.extend(expansions[expansion_key])

            # Deduplicate
            expanded_values = list(set([str(v) for v in expanded_values if v and v != "NA"]))

            if not expanded_values:
                continue

            # Build OR conditions for this filter
            or_conditions = []
            for val in expanded_values:
                # Search in multiple fields including summary
                if field in ["location", "city", "state"]:
                    or_conditions.extend([
                        {"location": {"$regex": re.escape(val), "$options": "i"}},
                        {"city": {"$regex": re.escape(val), "$options": "i"}},
                        {"state": {"$regex": re.escape(val), "$options": "i"}}
                    ])
                elif field == "title":
                    or_conditions.extend([
                        {"title": {"$regex": re.escape(val), "$options": "i"}},
                        {"summary": {"$regex": re.escape(val), "$options": "i"}}
                    ])
                elif field == "expertise":
                    or_conditions.extend([
                        {"expertise": {"$regex": re.escape(val), "$options": "i"}},
                        {"summary": {"$regex": re.escape(val), "$options": "i"}},
                        {"title": {"$regex": re.escape(val), "$options": "i"}}
                    ])
                elif field == "current_industry":
                    or_conditions.extend([
                        {"current_industry": {"$regex": re.escape(val), "$options": "i"}},
                        {"experience.name": {"$regex": re.escape(val), "$options": "i"}},
                        {"summary": {"$regex": re.escape(val), "$options": "i"}}
                    ])
                else:
                    or_conditions.append({field: {"$regex": re.escape(val), "$options": "i"}})

            if or_conditions:
                query_parts.append({"$or": or_conditions} if len(or_conditions) > 1 else or_conditions[0])

        # Combine with AND
        if len(query_parts) == 0:
            return {}
        elif len(query_parts) == 1:
            return query_parts[0]
        else:
            return {"$and": query_parts}

    def _build_manual_relaxed_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """Manual fallback for relaxed query."""
        
        # Extract location filters (mandatory)
        location_filters = [f for f in filters if f.get("field") in ["location", "city", "state"]]
        location_or = []
        
        for loc_filter in location_filters:
            value = loc_filter.get("value")
            if value:
                location_or.extend([
                    {"location": {"$regex": re.escape(value), "$options": "i"}},
                    {"city": {"$regex": re.escape(value), "$options": "i"}},
                    {"state": {"$regex": re.escape(value), "$options": "i"}}
                ])
        
        # Extract all other keywords
        other_keywords = []
        for filter_obj in filters:
            field = filter_obj.get("field")
            if field in ["location", "city", "state"]:
                continue
            
            value = filter_obj.get("value")
            if value:
                if isinstance(value, list):
                    other_keywords.extend(value)
                else:
                    other_keywords.append(value)
        
        # Add expansion keywords
        for key, values in expansions.items():
            if key == "locations":
                continue  # Already handled
            if isinstance(values, list):
                other_keywords.extend(values)
        
        # Deduplicate
        other_keywords = list(set([str(k) for k in other_keywords if k and k != "NA"]))
        
        # Build broad keyword search
        keyword_or = []
        for keyword in other_keywords:
            keyword_or.extend([
                {"summary": {"$regex": re.escape(keyword), "$options": "i"}},
                {"expertise": {"$regex": re.escape(keyword), "$options": "i"}},
                {"title": {"$regex": re.escape(keyword), "$options": "i"}},
                {"current_industry": {"$regex": re.escape(keyword), "$options": "i"}}
            ])
        
        # Combine
        if location_or and keyword_or:
            return {
                "$and": [
                    {"$or": location_or},
                    {"$or": keyword_or}
                ]
            }
        elif location_or:
            return {"$or": location_or}
        elif keyword_or:
            return {"$or": keyword_or}
        else:
            return {}

    # =============================================================================
    # HELPER METHODS
    # =============================================================================

    def _extract_json(self, response: str) -> Dict[str, Any]:
        """Extract JSON from LLM response."""
        try:
            response_text = response.strip()
            
            # Remove markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            return json.loads(response_text)
        except Exception as e:
            print(f"❌ JSON extraction failed: {e}")
            return {}

    async def suggest_relaxation(
        self,
        filters: List[Dict[str, Any]],
        current_results_count: int
    ) -> Dict[str, Any]:
        """AI suggests what to relax if no candidates found."""

        system_prompt = """You help HR find candidates when searches return no results.

Analyze filters and suggest what to change. Remember: profiles have rich 'summary' fields.

Return JSON:
{
    "suggestion": "friendly explanation of what to try",
    "filters_to_remove": ["field1", "field2"],
    "filters_to_modify": [{"field": "...", "change": "..."}],
    "reasoning": "why this helps",
    "alternative_strategy": "specific alternative approach"
}

Be practical:
- Location usually important - suggest nearby cities
- Skills can be broadened to related technologies
- Experience can be lowered slightly
- Try searching summaries with broader terms"""

        user_message = f"""Found {current_results_count} candidates with these filters:
{json.dumps(filters, indent=2)}

Suggest what to relax:"""

        try:
            response = await self._call_llm(system_prompt, user_message, temperature=0.7)
            return self._extract_json(response) or {
                "suggestion": "Try broadening your requirements",
                "filters_to_remove": [],
                "filters_to_modify": [],
                "reasoning": "Default suggestion"
            }
        except Exception as e:
            print(f"❌ Suggestion failed: {e}")
            return {
                "suggestion": "Try relaxing location or skill requirements",
                "filters_to_remove": [],
                "filters_to_modify": [],
                "reasoning": "Default suggestion"
            }

    async def _call_llm(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7
    ) -> str:
        """Call OpenRouter API."""
        import requests

        url = "https://openrouter.ai/api/v1/chat/completions"
        api_key = os.getenv("OPENROUTER_API_KEY")
        model_name = os.getenv("AI_MODEL_NAME", "openai/gpt-4o-mini")

        headers = {"Authorization": f"Bearer {api_key}"}

        data = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "temperature": temperature
        }

        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"❌ LLM API error: {e}")
            return ""