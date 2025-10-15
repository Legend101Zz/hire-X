"""
AI-Powered Query Builder with Progressive Search Strategies
"""
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from ai_model import Model


class IntelligentQueryBuilder:
    """
    Builds MongoDB queries with multiple strategies and AI assistance.
    """
    
    def __init__(self):
        self.model = Model()
        
        # Candidate schema reference for AI
        self.candidate_schema = {
            "location": "string (e.g., 'Mumbai, Maharashtra, India')",
            "city": "string (e.g., 'Mumbai')",
            "state": "string (e.g., 'Maharashtra')",
            "country": "string (e.g., 'India')",
            "title": "string (e.g., 'Senior Backend Engineer')",
            "current_industry": "string (e.g., 'Fintech')",
            "seniority_level": "string (e.g., 'senior', 'mid', 'junior')",
            "functional_area": "string (e.g., 'it', 'finance')",
            "expertise": "comma-separated string (e.g., 'python,java,aws')",
            "education": "array of objects with 'major', 'campus', 'specialization'",
            "experience": "array of objects with company details",
            "certifications": "array or string",
            "awards": "array or string"
        }
    
    async def build_query_with_strategy(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]],
        strategy: str = "strict"
    ) -> Dict[str, Any]:
        """
        Build MongoDB query with specified strategy.
        
        Strategies:
        - "strict": Exact matching with expansions
        - "partial": Substring matching with expansions  
        - "relaxed": Only most important filters
        - "ai_suggested": Let AI build the query
        """
        
        if strategy == "ai_suggested":
            return await self._build_ai_query(filters, expansions)
        
        if strategy == "strict":
            return self._build_strict_query(filters, expansions)
        
        if strategy == "partial":
            return self._build_partial_query(filters, expansions)
        
        if strategy == "relaxed":
            return self._build_relaxed_query(filters, expansions)
        
        # Default to strict
        return self._build_strict_query(filters, expansions)
    
    def _build_strict_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Build strict query with expansions - FIXED VERSION.
        """
        query_parts = []
        
        # Map field names to expansion keys
        field_to_expansion = {
            "location": "locations",
            "title": "roles",
            "current_industry": "industries",
            "expertise": "skills"
        }
        
        for filter_obj in filters:
            field = filter_obj.get("field")
            operator = filter_obj.get("operator")
            value = filter_obj.get("value")
            
            if not field or not value:
                continue
            
            # Get expanded values
            expansion_key = field_to_expansion.get(field, field)
            
            # ✅ FIX: Handle list values properly
            if isinstance(value, list):
                expanded_values = value.copy()
            else:
                expanded_values = [value]
            
            # Add expansions if available
            if expansion_key in expansions and expansions[expansion_key]:
                expansion_list = expansions[expansion_key]
                if isinstance(expansion_list, list):
                    expanded_values.extend(expansion_list)
            
            # ✅ FIX: Convert to set only if all elements are hashable (strings)
            try:
                expanded_values = list(set([str(v) for v in expanded_values if v]))
            except:
                # If set conversion fails, just deduplicate manually
                seen = []
                expanded_values = [str(v) for v in expanded_values if v and (str(v) not in seen and not seen.append(str(v)))]
            
            # Build query based on field type and operator
            if operator == "contains" or operator == "equals":
                or_conditions = []
                for val in expanded_values:
                    if field in ["location", "city", "state"]:
                        # For location fields, check if value is CONTAINED in the field
                        or_conditions.append({
                            field: {
                                "$regex": re.escape(val),
                                "$options": "i"
                            }
                        })
                    elif field == "expertise":
                        # For expertise (comma-separated), check if keyword appears
                        or_conditions.append({
                            field: {
                                "$regex": re.escape(val),
                                "$options": "i"
                            }
                        })
                    elif field == "current_industry":
                        # Check both current_industry field and company names in experience
                        or_conditions.append({
                            "$or": [
                                {
                                    field: {
                                        "$regex": re.escape(val),
                                        "$options": "i"
                                    }
                                },
                                {
                                    "experience.name": {
                                        "$regex": re.escape(val),
                                        "$options": "i"
                                    }
                                }
                            ]
                        })
                    else:
                        # For other fields, substring match
                        or_conditions.append({
                            field: {
                                "$regex": re.escape(val),
                                "$options": "i"
                            }
                        })
                
                if len(or_conditions) == 1:
                    query_parts.append(or_conditions[0])
                elif len(or_conditions) > 1:
                    query_parts.append({"$or": or_conditions})
            
            elif operator in [">=", "<=", ">", "<", "=="]:
                # Numeric operators
                try:
                    numeric_value = float(value)
                    if operator == ">=":
                        query_parts.append({field: {"$gte": numeric_value}})
                    elif operator == "<=":
                        query_parts.append({field: {"$lte": numeric_value}})
                    elif operator == ">":
                        query_parts.append({field: {"$gt": numeric_value}})
                    elif operator == "<":
                        query_parts.append({field: {"$lt": numeric_value}})
                    else:  # ==
                        query_parts.append({field: numeric_value})
                except ValueError:
                    pass
        
        # Combine with AND
        if len(query_parts) == 0:
            return {}
        elif len(query_parts) == 1:
            return query_parts[0]
        else:
            return {"$and": query_parts}

    def _build_partial_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Build more relaxed query - uses OR between filters instead of AND.
        """
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
            
            expansion_key = field_to_expansion.get(field, field)
            
            # ✅ FIX: Handle list values properly
            if isinstance(value, list):
                expanded_values = value.copy()
            else:
                expanded_values = [value]
            
            if expansion_key in expansions and expansions[expansion_key]:
                expansion_list = expansions[expansion_key]
                if isinstance(expansion_list, list):
                    expanded_values.extend(expansion_list)
            
            # ✅ FIX: Convert to set only if all elements are hashable
            try:
                expanded_values = list(set([str(v) for v in expanded_values if v]))
            except:
                seen = []
                expanded_values = [str(v) for v in expanded_values if v and (str(v) not in seen and not seen.append(str(v)))]
            
            # Build OR conditions for this filter
            or_conditions = []
            for val in expanded_values:
                or_conditions.append({
                    field: {
                        "$regex": re.escape(val),
                        "$options": "i"
                    }
                })
            
            if len(or_conditions) > 0:
                query_parts.append({"$or": or_conditions} if len(or_conditions) > 1 else or_conditions[0])
        
        # Use OR between filter groups (more relaxed)
        if len(query_parts) == 0:
            return {}
        elif len(query_parts) == 1:
            return query_parts[0]
        else:
            return {"$or": query_parts}
        
    def _build_relaxed_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Build most relaxed query - only keeps location filter.
        """
        # Only keep location-based filters
        location_filters = [f for f in filters if f.get("field") in ["location", "city", "state"]]
        
        if not location_filters:
            # If no location filters, return empty (search all)
            return {}
        
        return self._build_strict_query(location_filters, expansions)
    
    async def _build_ai_query(
        self,
        filters: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Let AI build the MongoDB query based on understanding the schema.
        """
        
        system_prompt = """You are a MongoDB query expert specializing in candidate search.

Given:
1. Candidate profile schema (field types and formats)
2. Search filters from HR
3. Expanded search terms

Your task: Build an optimal MongoDB query that will find candidates.

SCHEMA UNDERSTANDING:
- location: Full address like "Mumbai, Maharashtra, India" - use substring matching
- expertise: Comma-separated skills like "python,aws,docker" - use regex to find if keyword appears
- current_industry: Industry name OR check experience.name for company names
- title: Job title - check for keywords
- education: Array of objects - use $elemMatch if checking education
- experience: Array of company objects - check experience.name for company names

QUERY BUILDING RULES:
1. For location: Use {"location": {"$regex": "Mumbai", "$options": "i"}} - substring match
2. For expertise: Use {"expertise": {"$regex": "python", "$options": "i"}} - finds in comma list
3. For industry: Check both current_industry AND experience.name
4. Use $or when you have multiple values to check
5. Use $and when ALL conditions must match
6. Use $regex with $options: "i" for case-insensitive matching
7. Don't use exact match (^value$) unless explicitly needed

Return ONLY valid MongoDB query as JSON, no explanations."""

        user_message = f"""Candidate Schema:
{json.dumps(self.candidate_schema, indent=2)}

Search Filters:
{json.dumps(filters, indent=2)}

Expanded Terms:
{json.dumps(expansions, indent=2)}

Build optimal MongoDB query:"""

        try:
            response = await self._call_llm(system_prompt, user_message, temperature=0.1)
            
            # Parse JSON from response
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            query = json.loads(response_text)
            return query
            
        except Exception as e:
            print(f"❌ AI query building failed: {e}")
            # Fallback to strict query
            return self._build_strict_query(filters, expansions)
    
    async def suggest_relaxation(
        self,
        filters: List[Dict[str, Any]],
        current_results_count: int
    ) -> Dict[str, Any]:
        """
        AI suggests what to relax if no candidates found.
        """
        
        system_prompt = """You are helping an HR person find candidates. They have filters but found no matches.

Analyze their filters and suggest what to relax to find candidates.

Return JSON:
{
  "suggestion": "friendly explanation of what to try",
  "filters_to_remove": ["field1", "field2"],  // which filters to remove
  "filters_to_modify": [
    {"field": "...", "change": "..."}  // how to modify
  ],
  "reasoning": "why this will help"
}

Be smart:
- Location filters are usually important, suggest nearby cities instead of removing
- Skills can be relaxed (e.g., "Go required" → "Go or similar backend language")
- Experience requirements can be slightly lowered
- Industry can be broadened"""

        user_message = f"""Current filters finding {current_results_count} candidates:
{json.dumps(filters, indent=2)}

What should we relax to find candidates?"""

        try:
            response = await self._call_llm(system_prompt, user_message, temperature=0.7)
            
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            suggestion = json.loads(response_text)
            return suggestion
            
        except Exception as e:
            print(f"❌ AI suggestion failed: {e}")
            return {
                "suggestion": "Try removing some filters or using broader search terms.",
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
        
        headers = {
            "Authorization": f"Bearer {api_key}",
        }
        
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