"""
Configuration Models for V3
===========================
These models define the structure for model configuration,
allowing users to choose which LLM models to use for different tasks.
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ModelOption(BaseModel):
    """
    Represents a single model option that users can choose.
    
    Example:
        {
            "id": "claude-sonnet-4-5",
            "name": "Claude Sonnet 4.5",
            "cost": "High",
            "quality": "Excellent",
            "description": "Best for conversation and complex reasoning"
        }
    """
    id: str
    name: str
    cost: str  # "Very Low" | "Low" | "Medium" | "High"
    quality: str  # "Good" | "Very Good" | "Excellent"
    description: Optional[str] = None


class ModelConfiguration(BaseModel):
    """
    Complete model configuration for a session.
    Users can configure which model to use for each task type.
    
    Example:
        {
            "conversation": "claude-sonnet-4-5",
            "jd_parsing": "claude-sonnet-4-5",
            "web_search": "perplexity/sonar-pro",
            "salary_estimation": "deepseek/deepseek-r1",
            "skill_validation": "deepseek/deepseek-r1",
            "response_likelihood": "deepseek/deepseek-r1",
            "match_scoring": "claude-sonnet-4-5"
        }
    """
    conversation: str = "claude-sonnet-4-5"
    jd_parsing: str = "claude-sonnet-4-5"
    web_search: str = "claude-sonnet-4-5"
    salary_estimation: str = "deepseek/deepseek-r1"
    skill_validation: str = "deepseek/deepseek-r1"
    response_likelihood: str = "deepseek/deepseek-r1"
    match_scoring: str = "claude-sonnet-4-5"


class ModelConfigRequest(BaseModel):
    """
    Request body for updating model configuration.
    All fields are optional - only update what's provided.
    """
    conversation: Optional[str] = None
    jd_parsing: Optional[str] = None
    web_search: Optional[str] = None
    salary_estimation: Optional[str] = None
    skill_validation: Optional[str] = None
    response_likelihood: Optional[str] = None
    match_scoring: Optional[str] = None


class ModelPreset(BaseModel):
    """
    Predefined model configuration presets for quick selection.
    
    Example presets:
    - "balanced": Mix of quality and cost
    - "high_quality": Best models for all tasks
    - "cost_efficient": Cheapest models that still work well
    """
    name: str
    description: str
    configuration: ModelConfiguration
    estimated_cost_per_50_candidates: float  # in INR


class CostEstimate(BaseModel):
    """
    Estimated cost breakdown for a configuration.
    """
    total_cost_inr: float
    breakdown: Dict[str, float]  # task -> cost in INR
    configuration_used: ModelConfiguration