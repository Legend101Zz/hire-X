"""
Pydantic models for API requests and responses.
"""
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class PromptRequest(BaseModel):
    prompt: str


class SessionResponse(BaseModel):
    session_id: str
    message: str


class PromptResponse(BaseModel):
    location: List[str]
    role: List[str]
    experience: List[str]
    industry: List[str]
    skills: List[str]


# Authentication models
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    hashed_password: str
    created_at: Optional[str] = None
    last_login: Optional[str] = None


class IncidentLog(BaseModel):
    username: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    incident_type: str  # "failed_login", "invalid_credentials", etc.
    timestamp: str
    details: Optional[str] = None
