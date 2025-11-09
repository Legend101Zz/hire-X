"""
Request Models (Pydantic Schemas)
=================================
These define the structure of incoming API requests.

Pydantic automatically validates the request data.
"""

from typing import Any, Dict

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """
    Login request body.
    
    Example:
        {
            "username": "john@company.com",
            "password": "mypassword123"
        }
    """
    username: str = Field(..., description="Username or email")
    password: str = Field(..., min_length=6, description="User password")


class RegisterRequest(BaseModel):
    """
    User registration request.
    
    Example:
        {
            "username": "john@company.com",
            "email": "john@company.com",
            "password": "securepassword123",
            "full_name": "John Doe"
        }
    """
    username: str = Field(..., description="Username (typically email)")
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    full_name: str = Field(..., description="Full name")


class ParsePromptRequest(BaseModel):
    """
    Request to parse a hiring prompt and create a scorecard.
    
    Example:
        {
            "prompt": "Looking for a Senior Python Developer in San Francisco with 5+ years experience"
        }
    """
    prompt: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Job requirements in natural language"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "Find me a Senior Python Developer in San Francisco with machine learning experience"
            }
        }


class FollowupAnswersRequest(BaseModel):
    """
    Follow-up answers to refine the scorecard.
    
    Example:
        {
            "answers": {
                "preferred_industries": ["Technology", "Finance"],
                "must_have_skills": ["Python", "Docker", "AWS"],
                "deal_breakers": ["No remote work"]
            }
        }
    """
    answers: Dict[str, Any] = Field(
        ...,
        description="Follow-up answers as key-value pairs"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "answers": {
                    "preferred_industries": ["Technology"],
                    "must_have_skills": ["Python", "Machine Learning"],
                    "years_experience_min": 5
                }
            }
        }