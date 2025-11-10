"""
Dependency Injection for FastAPI
=================================
This file sets up all the services and provides them to API endpoints.

FastAPI's dependency injection system is awesome - it handles:
- Service initialization
- Request-scoped instances
- Automatic cleanup
"""

from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Import auth utilities
from core.auth import verify_token
from core.logging_config import get_logger
# Import data layer
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from services.ai_parser import AIParser
from services.candidate_scorer import CandidateScorer
# Import all services
from services.scorecard_workflow import ScorecardWorkflow
from services.search_engine import SearchEngine

# Security scheme for JWT
security = HTTPBearer()

# Get the logger for this module
logger = get_logger(__name__)

# ============================================================================
# Global Service Instances (Singletons)
# ============================================================================
# These are created once when the app starts and reused for all requests

# We'll store these in a global dict that's initialized in main.py
_global_services: Dict[str, Any] = {}

def initialize_services() -> Dict[str,Any]:
    """
    Initialize all services once at startup.
    
    This creates the service instances that will be reused across all requests.
    Called from main.py during application startup.
    
    Returns:
        Dict with all initialized services
    """ 
    logger.info("Initializing services...")
    
    # Initialize data layer
    mongodb = MongoDB()
    logger.info("MongoDB connected successfully")
    
    redis_cache = RedisCache()
    logger.info("Redis connected successfully")
    
    # Initialize service layer
    search_engine = SearchEngine(mongodb.profiles_collection)
    logger.info("Search Engine Started")
    
    scorer = CandidateScorer()
    logger.info("CandidateScorer Started")
                
    ai_parser = AIParser()
    logger.info("AIParser Started")
    
    # Initialize workflow (orchestrator)
    workflow = ScorecardWorkflow(
        search_engine=search_engine,
        scorer=scorer,
        ai_parser=ai_parser,
        mongodb=mongodb,
        redis_cache=redis_cache
    )
    logger.info("ScorecardWorkflow orchestratated successfully")
    
    # Store in global dict
    services = {
        "mongodb": mongodb,
        "redis_cache": redis_cache,
        "search_engine": search_engine,
        "scorer": scorer,
        "ai_parser": ai_parser,
        "workflow": workflow
    }
    
    # Save to global variable
    global _global_services
    _global_services = services
    
    logger.info("All services initialized")
    return services

# ============================================================================
# Dependency Functions (Used in API Endpoints)
# ============================================================================

def get_workflow() -> ScorecardWorkflow:
    """
    Get the scorecard workflow service.
    
    Usage in API endpoints:
        @app.post("/scorecard/parse-prompt")
        async def parse_prompt(workflow: ScorecardWorkflow = Depends(get_workflow)):
            # Use workflow here
            pass
    """
    return _global_services["workflow"]

def get_mongodb() -> MongoDB:
    """Get the MongoDB service."""
    return _global_services["mongodb"]


def get_redis() -> RedisCache:
    """Get the Redis cache service."""
    return _global_services["redis_cache"]


def get_search_engine() -> SearchEngine:
    """Get the search engine service."""
    return _global_services["search_engine"]

def get_current_username(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extract and validate the current user from JWT token.
    
    This is used in protected endpoints to get the username.
    
    Usage:
        @app.post("/protected-endpoint")
        async def protected(username: str = Depends(get_current_username)):
            # username is automatically extracted from JWT
            return {"user": username}
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Get token from Authorization header
        token = credentials.credentials
        
        # Verify token and extract username
        payload = verify_token(token)
        username = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        return username
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Any other error
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )


def get_optional_username(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))
) -> str:
    """
    Optional authentication - returns username if token provided, else "anonymous".
    
    Use this for endpoints that work both authenticated and unauthenticated.
    """
    if credentials is None:
        return "anonymous"
    
    try:
        token = credentials.credentials
        payload = verify_token(token)
        return payload.get("sub", "anonymous")
    except:
        return "anonymous"