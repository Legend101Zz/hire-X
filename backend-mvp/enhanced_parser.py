"""
Enhanced prompt parser with mandatory/optional separation.
"""
import json
from typing import Any, Dict

from ai_model import Model


class EnhancedPromptParser:
    """
    Enhanced parser that generates:
    1. strict_params - MANDATORY criteria (must-have)
    2. broad_params - OPTIONAL criteria (nice-to-have)
    3. scoring_rules - Dynamic scoring weights
    """
    
    def __init__(self, model: Model):
        self.model = model
    
    def parse_with_tiers(self, prompt: str) -> Dict[str, Any]:
        """
        Parse prompt into strict params, broad params, and scoring rules.
        
        Returns:
            {
                "strict_params": {...},
                "broad_params": {...},
                "scoring_rules": {...}
            }
        """
        
        enhanced_prompt = f"""You are an expert hiring requirement analyzer. Extract structured data from this job requirement.

TASK: Create 3 JSON objects with these EXACT keys:
1. "strict_params" - MUST-HAVE requirements only
2. "broad_params" - NICE-TO-HAVE and related alternatives  
3. "scoring_rules" - Point values for keyword matching

RULES:
- If prompt mentions "Fintech", "Banking", "Finance" → Put in strict_params.Industry
- If prompt mentions city name like "Mumbai", "Delhi" → Put in strict_params.Location
- If prompt mentions "Senior", "5+ years" → Put in strict_params.Seniority_Level
- In broad_params, add related/nearby alternatives

JOB REQUIREMENT:
{prompt}

OUTPUT FORMAT (use this EXACT structure):
{{
  "strict_params": {{
    "Location": [],
    "Role": [],
    "Experience": [],
    "Industry": [],
    "Skills": [],
    "Seniority_Level": [],
    "Functional_Area": []
  }},
  "broad_params": {{
    "Location": [],
    "Role": [],
    "Experience": [],
    "Industry": [],
    "Skills": [],
    "Education": [],
    "Country": [],
    "State": [],
    "City": [],
    "Seniority_Level": [],
    "Functional_Area": []
  }},
  "scoring_rules": {{
    "skills": {{}},
    "experience": {{}},
    "education": {{}},
    "industry": {{}},
    "role_keywords": {{}}
  }}
}}

EXAMPLE for "Senior Python Developer in Mumbai with Fintech experience":
{{
  "strict_params": {{
    "Location": ["Mumbai"],
    "Role": ["Senior Python Developer"],
    "Industry": ["Fintech"],
    "Seniority_Level": ["Senior"]
  }},
  "broad_params": {{
    "Location": ["Mumbai", "Pune", "Thane", "Navi Mumbai"],
    "Role": ["Python Developer", "Senior Developer", "Backend Developer"],
    "Industry": ["Fintech", "Financial Services", "Banking", "Payments"],
    "Skills": ["Python", "Django", "Flask", "AWS", "Docker"],
    "Country": ["India"],
    "State": ["Maharashtra"]
  }},
  "scoring_rules": {{
    "skills": {{"Python": 60, "Django": 30, "AWS": 25}},
    "industry": {{"Fintech": 80, "Banking": 50}},
    "role_keywords": {{"Senior": 50, "Python Developer": 70}}
  }}
}}

Now extract from the actual job requirement above. Return ONLY valid JSON, nothing else."""

        try:
            # Call LLM
            response = self.model.generate_summary(enhanced_prompt)
            
            # Clean response
            response = response.strip()
            
            # Remove markdown code blocks if present
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            
            # Find JSON object
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")
            
            json_str = response[json_start:json_end]
            parsed = json.loads(json_str)
            
            # Validate structure
            required_keys = ["strict_params", "broad_params", "scoring_rules"]
            if not all(key in parsed for key in required_keys):
                print(f"⚠️ Missing keys. Found: {list(parsed.keys())}")
                raise ValueError("Missing required keys in LLM response")
            
            # Ensure all param values are lists
            for params_key in ["strict_params", "broad_params"]:
                if params_key not in parsed:
                    parsed[params_key] = self._get_default_params()
                    continue
                    
                for field_key, field_value in parsed[params_key].items():
                    if not isinstance(field_value, list):
                        parsed[params_key][field_key] = [field_value] if field_value else []
            
            # Ensure scoring_rules is a dict
            if "scoring_rules" not in parsed or not isinstance(parsed["scoring_rules"], dict):
                parsed["scoring_rules"] = self._get_default_scoring()
            
            print("✅ Successfully parsed LLM response")
            return parsed
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing failed: {e}")
            print(f"Response preview: {response[:200] if 'response' in locals() else 'N/A'}...")
            return self._get_default_result()
        except Exception as e:
            print(f"❌ Enhanced parsing failed: {e}")
            return self._get_default_result()
    
    def _get_default_result(self) -> Dict[str, Any]:
        """Return default structure when parsing fails."""
        return {
            "strict_params": self._get_default_params(),
            "broad_params": self._get_default_params(),
            "scoring_rules": self._get_default_scoring()
        }
    
    def _get_default_params(self) -> Dict[str, list]:
        """Default empty params structure."""
        return {
            "Location": [],
            "Role": [],
            "Experience": [],
            "Industry": [],
            "Skills": [],
            "Education": [],
            "Certifications": [],
            "Country": [],
            "State": [],
            "City": [],
            "Seniority_Level": [],
            "Functional_Area": []
        }
    
    def _get_default_scoring(self) -> Dict[str, Dict[str, int]]:
        """Default scoring rules."""
        return {
            "skills": {},
            "experience": {},
            "education": {},
            "industry": {},
            "role_keywords": {}
        }