"""
AI model operations and prompt parsing logic.
"""
import json
import requests
from typing import List, Dict, Any, Protocol


class AIModel(Protocol):
    """Protocol for AI model implementations."""
    def extract(self, prompt: str) -> Dict[str, Any]:
        ...


class Model:
    """AI model implementation using OpenRouter API."""
    
    def __init__(self, model_name: str = "openai/gpt-5-nano"):
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": "Bearer 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",
        }
        self.model_name = model_name

    def extract(self, prompt: str) -> Dict[str, Any]:
        """
        Extract structured information from a prompt using the AI model.
        
        Args:
            prompt: The prompt to process
            
        Returns:
            dict: Extracted structured data
        """
        query = f"""
        Extract the following hiring prompt into JSON with fields:
        Location, Role, Experience, Industry, Skills, Education, Certifications, Publications, Patents, Awards, Memberships, Prior Industries, Organization ID, Profile Picture, State, City, Country, Seniority Level, Functional Area.

        Note:
        1. Location field must contain only name of the location which exists on earth.
        Prompt: {prompt}

        JSON:
        """

        data = {
            "model": f"{self.model_name}",
            "messages": [
                {
                    "role": "user",
                    "content": f"{query}"
                }
            ]
        }

        try:
            response = requests.post(
                self.url,
                headers=self.headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            output = result["choices"][0]["message"]["content"]
            
            json_start = output.index("{")
            json_end = output.rindex("}") + 1
            parsed = json.loads(output[json_start:json_end])
            return parsed

        except Exception as e:
            print(f"Error calling API: {e}")
            return {}

    def generate_summary(self, prompt: str) -> str:
        """
        Generate a text summary using the AI model.
        
        Args:
            prompt: The prompt to generate a summary for
            
        Returns:
            str: Generated summary text
        """
        data = {
            "model": f"{self.model_name}",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }

        try:
            response = requests.post(
                self.url,
                headers=self.headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            output = result["choices"][0]["message"]["content"]
            return output.strip()

        except Exception as e:
            print(f"Error calling API: {e}")
            return ""


class HiringPromptParser:
    """Parser for hiring requirements prompts."""
    
    def __init__(self, model: AIModel):
        """
        Initialize with a model that follows the AIModel protocol.
        The model must have an .extract(prompt: str) -> dict method.
        """
        self.model = model

    def parse(self, prompt: str) -> Dict[str, List[str]]:
        """
        Parse the hiring requirements prompt into structured parameters.
        Always returns lists for each parameter.
        """
        raw_output = self.model.extract(prompt)

        structured = {
            "Location": raw_output.get("Location", []),
            "Role": raw_output.get("Role", []),
            "Experience": raw_output.get("Experience", []),
            "Industry": raw_output.get("Industry", []),
            "Skills": raw_output.get("Skills", []),
            "Education": raw_output.get("Education", []),
            "Certifications": raw_output.get("Certifications", []),
            "Publications": raw_output.get("Publications", []),
            "Patents": raw_output.get("Patents", []),
            "Awards": raw_output.get("Awards", []),
            "Memberships": raw_output.get("Memberships", []),
            "Prior Industries": raw_output.get("Prior Industries", []),
            "Organization ID": raw_output.get("Organization ID", []),
            "Profile Picture": raw_output.get("Profile Picture", []),
            "State": raw_output.get("State", []),
            "City": raw_output.get("City", []),
            "Country": raw_output.get("Country", []),
            "Seniority Level": raw_output.get("Seniority Level", []),
            "Functional Area": raw_output.get("Functional Area", []),
        }

        for key in structured:
            if not isinstance(structured[key], list):
                structured[key] = [structured[key]] if structured[key] else []

        return structured
