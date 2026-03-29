"""
AI Parser Service
=================
Uses AI to parse hiring prompts and extract structured requirements.

This takes a free-text prompt like:
"Looking for a Senior Python Developer in San Francisco with 5+ years experience"

And extracts structured data like:
{
    "industries": ["Technology"],
    "seniority": ["Senior"],
    "locations": ["San Francisco"],
    "keywords": "python developer",
    "years_experience": 5
}
"""

import json
from typing import Any, Dict

import requests

from core.config import settings
from core.logging_config import get_logger

# Get the logger for this module
logger = get_logger(__name__)

class AIParser:
    """
    AI-powered hiring prompt parser.
    
    Uses the OpenRouter API to parse natural language job requirements
    into structured data that can be used for searching and scoring.
    """
    
    def __init__(self):
        """Initialize the AI parser with API credentials."""
        self.api_key = settings.OPENROUTER_API_KEY
        self.model = settings.AI_MODEL_NAME
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        
        if not self.api_key:
            logger.warning("WARNING: OPENROUTER_API_KEY not set!")
            logger.warning ("AI parsing will not work without an API key")
            
    async def call_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        response_format: str = "json"
    ) -> str:
        """
        Generic LLM calling method for any prompt.
        
        This is used by QueryDebugger and other services that need
        to call the LLM with custom prompts.
        
        Args:
            system_prompt: System instructions for the LLM
            user_prompt: User's actual prompt
            model: Model to use (defaults to config model)
            temperature: Temperature for response randomness
            max_tokens: Maximum tokens in response
            response_format: "json" or "text"
        
        Returns:
            LLM's response as string
        
        Example:
            response = await ai_parser.call_llm(
                system_prompt="You are a query analyzer...",
                user_prompt="Analyze this query: {...}",
                model="anthropic/claude-3.5-sonnet"
            )
        """
        
        logger.info(f"Calling LLM with model: {model or self.model}")
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://Hire-X.com",
                "X-Title": "Hire-X Hiring Platform"
            }
            
            data = {
                "model": model or self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            
            # Add response format if JSON requested
            if response_format == "json":
                data["response_format"] = {"type": "json_object"}
            
            response = requests.post(
                self.api_url,
                headers=headers,
                json=data,
                timeout=30
            )
            
            response.raise_for_status()
            
            result = response.json()
            ai_response = result["choices"][0]["message"]["content"]
            
            logger.info(f"✅ LLM response received ({len(ai_response)} chars)")
            
            return ai_response
            
        except Exception as e:
            logger.error(f"❌ LLM call failed: {e}")
            raise
    
    async def parse_prompt(self, prompt: str) -> Dict[str, Any]:
        """
        Parse a hiring prompt into structured requirements.
        
        Args:
            prompt: Natural language job description/requirements
            
        Returns:
            Dictionary with structured requirements:
            {
                "industries": ["Technology", "Finance"],
                "seniority": ["Senior", "Lead"],
                "locations": ["San Francisco", "New York"],
                "keywords": "python machine learning",
                "years_experience": 5,
                "strict_industries": [...],  # For fallback search
                "broad_industries": [...],
                ...
            }
            
        Example:
            parsed = await ai_parser.parse_prompt(
                "Find me a Senior Python Developer in SF with ML experience"
            )
            
            # Result:
            {
                "industries": ["Technology"],
                "seniority": ["Senior"],
                "locations": ["San Francisco"],
                "keywords": "python machine learning developer",
                ...
            }
        """
        
        logger.info(f"Parsing prompt with AI: '{prompt[:60]}...'")
        
        try:
            # Create the AI prompt
            system_prompt = self._create_system_prompt()
            
            # Call OpenRouter API
            response = self.call_llm(system_prompt, prompt)
            
            # Parse the AI's response
            parsed_data = self._extract_json_from_response(response)
            
            # Add the original prompt
            parsed_data["original_prompt"] = prompt
            
            # Ensure all required fields exist with defaults
            parsed_data = self._ensure_required_fields(parsed_data)
            
            logger.info(f"Parsed: {len(parsed_data.get('industries', []))} industries, "
                  f"{len(parsed_data.get('seniority', []))} seniority levels")
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"AI parsing failed: {e}")
            # Return a basic parse as fallback
            return self._create_fallback_parse(prompt)
    
    def _create_system_prompt(self) -> str:
        """
        Create the system prompt that tells the AI how to parse.
        
        This is the instruction manual for the AI.
        """
        return """You are a hiring requirements parser. Extract structured information from job descriptions.

Return a JSON object with these fields:

{
    "industries": ["Technology", "Finance"],  // Target industries
    "seniority": ["Senior", "Lead"],          // Seniority levels
    "locations": ["San Francisco", "New York"], // Locations/cities
    "keywords": "python machine learning",     // Key skills/technologies
    "years_experience": 5,                     // Minimum years (number or null)
    
    // For fallback search (broader criteria)
    "strict_industries": ["Technology"],       // Most specific industries
    "broad_industries": ["Technology", "Software", "IT"],  // Include related
    "strict_seniority": ["Senior"],            // Exact seniority
    "broad_seniority": ["Senior", "Mid-level"] // Include adjacent levels
}

Rules:
- Industries: Use standard categories (Technology, Finance, Healthcare, etc.)
- Seniority: Use standard levels (Entry, Mid-level, Senior, Lead, Executive)
- Locations: Extract city names, not full addresses
- Keywords: Extract key technical skills and role keywords
- Always include strict and broad versions for better fallback

Return ONLY the JSON, no explanation."""
    
    def _call_openrouter(self, system_prompt: str, user_prompt: str) -> str:
        """
        Call the OpenRouter API (legacy method for parse_prompt).
        
        Now wraps the generic call_llm method.
        """
        import asyncio

        # Use the new generic method
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in async context
            return asyncio.create_task(
                self.call_llm(system_prompt, user_prompt)
            )
        else:
            # Not in async context
            return loop.run_until_complete(
                self.call_llm(system_prompt, user_prompt)
            )
            
    def _extract_json_from_response(self, response: str) -> Dict[str, Any]:
        """
        Extract JSON from AI response.
        
        The AI sometimes includes extra text around the JSON,
        so we need to extract just the JSON part.
        """
        
        # Try to find JSON in the response
        start = response.find("{")
        end = response.rfind("}") + 1
        
        if start == -1 or end == 0:
            raise ValueError("No JSON found in AI response")
        
        json_str = response[start:end]
        
        # Parse JSON
        return json.loads(json_str)
    
    def _ensure_required_fields(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensure all required fields exist with sensible defaults.
        """
        
        # Set defaults for missing fields
        defaults = {
            "industries": [],
            "seniority": [],
            "locations": [],
            "keywords": "",
            "years_experience": None,
            "strict_industries": [],
            "broad_industries": [],
            "strict_seniority": [],
            "broad_seniority": []
        }
        
        for key, default_value in defaults.items():
            if key not in data or data[key] is None:
                data[key] = default_value
        
        # If broad versions are empty, copy from strict
        if not data["broad_industries"] and data["industries"]:
            data["broad_industries"] = data["industries"].copy()
        
        if not data["broad_seniority"] and data["seniority"]:
            data["broad_seniority"] = data["seniority"].copy()
        
        # If strict versions are empty, copy from main
        if not data["strict_industries"] and data["industries"]:
            data["strict_industries"] = data["industries"].copy()
        
        if not data["strict_seniority"] and data["seniority"]:
            data["strict_seniority"] = data["seniority"].copy()
        
        return data
    
    def _create_fallback_parse(self, prompt: str) -> Dict[str, Any]:
        """
        Create a basic parse if AI fails.
        
        This is a simple keyword-based fallback that doesn't require AI.
        """
        
        logger.warning("Using fallback parser (basic keyword matching)")
        
        prompt_lower = prompt.lower()
        
        # Try to extract some basic info
        industries = []
        if any(word in prompt_lower for word in ["tech", "software", "engineer", "developer"]):
            industries = ["Technology"]
        
        seniority = []
        if "senior" in prompt_lower:
            seniority = ["Senior"]
        elif "junior" in prompt_lower or "entry" in prompt_lower:
            seniority = ["Entry"]
        
        # Extract the prompt as keywords
        keywords = prompt
        
        return {
            "original_prompt": prompt,
            "industries": industries,
            "seniority": seniority,
            "locations": [],
            "keywords": keywords,
            "years_experience": None,
            "strict_industries": industries,
            "broad_industries": industries + ["Software", "IT Services"],
            "strict_seniority": seniority,
            "broad_seniority": seniority + ["Mid-level"] if seniority else []
        }