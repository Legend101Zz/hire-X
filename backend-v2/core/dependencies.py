"""
Dependency Injection for FastAPI - V3
======================================
This file sets up all the services and provides them to API endpoints.

MODIFIED FOR V3: Added enrichment_service and conversation_manager
"""

from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Import auth utilities
from core.auth import verify_token
from core.config import Settings
from core.logging_config import get_logger
# Import data layer
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from services.ai_parser import AIParser
from services.availability_checker import AvailabilityChecker
from services.candidate_scorer import CandidateScorer
# Import all V3 services
from services.conversation_manager import ConversationManager
from services.enrichment_service import EnrichmentService
from services.funnel_search_service import FunnelSearchService
from services.intelligent_enrichment_orchestrator import \
    IntelligentEnrichmentOrchestrator
from services.intelligent_search_crew import IntelligentSearchCrew
from services.jd_generator import JDGeneratorService
from services.jd_parser import JDParser
from services.model_config_manager import ModelConfigManager
from services.parallel_enrichment_service import ParallelEnrichmentService
from services.query_debugger import QueryDebugger
from services.response_likelihood_scorer import ResponseLikelihoodScorer
from services.salary_estimator import SalaryEstimator
# from services.sample_profile_generator import SampleProfileGenerator
# from services.sample_profile_generator_v2 import SampleProfileGeneratorV2
from services.sample_profile_generator_v3 import SampleProfileGeneratorV3
from services.scorecard_workflow import ScorecardWorkflow
from services.search_engine import SearchEngine
from services.skill_validator import SkillValidator
from services.vapi_interview_service import VapiInterviewService
from services.web_search_wrapper import WebSearchWrapper

# Security scheme for JWT
security = HTTPBearer()

# Get the logger for this module
logger = get_logger(__name__)


ENABLE_CREWAI = False
# ============================================================================
# Global Service Instances (Singletons)
# ============================================================================
# These are created once when the app starts and reused for all requests

# We'll store these in a global dict that's initialized in main.py
_global_services: Dict[str, Any] = {}

async def initialize_services() -> Dict[str, Any]:
    """
    Initialize all services once at startup.
    
    This creates the service instances that will be reused across all requests.
    Called from main.py during application startup.
    
    Returns:
        Dict with all initialized services
    """ 
    logger.info("Initializing services...")
                
    settings = Settings()     
    # ========================================
    # DATA LAYER
    # ========================================
    mongodb = MongoDB()
    try:
        await mongodb.connect()  # ✅ Connect before creating dependent services
        logger.info("✅ MongoDB async connection established")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        # Set collections to None for graceful degradation
        mongodb.profiles_collection = None
        mongodb.users_collection = None
        mongodb.prompts_collection = None
        mongodb.logs_collection = None
    
    redis_cache = RedisCache()
    logger.info("✅ Redis connected successfully")
    
    # ========================================
    # CORE SERVICES
    # ========================================
    search_engine = SearchEngine(mongodb.profiles_collection)
    await search_engine.verify_indexes()  # ✅ Call async verification
    logger.info("✅ SearchEngine initialized")
    
    scorer = CandidateScorer()
    logger.info("✅ CandidateScorer initialized")
                
    ai_parser = AIParser()
    logger.info("✅ AIParser initialized")
    
    model_config_manager = ModelConfigManager(redis_cache)
    logger.info("✅ ModelConfigManager initialized")
    
    jd_generator = JDGeneratorService(model_config_manager)
    logger.info("✅ JDGeneratorService initialized")
    
    
    web_search = WebSearchWrapper(redis_cache,model_config_manager)
    logger.info("✅ WebSearchWrapper initialized")
    
    salary_estimator = SalaryEstimator(web_search, redis_cache, model_config_manager)
    logger.info("✅ SalaryEstimator initialized")
    
    response_scorer = ResponseLikelihoodScorer(redis_cache, model_config_manager)
    logger.info("✅ ResponseLikelihoodScorer initialized")
    
    skill_validator = SkillValidator(web_search, redis_cache, model_config_manager)
    logger.info("✅ SkillValidator initialized")
    
    availability_checker = AvailabilityChecker(web_search, redis_cache, model_config_manager)
    logger.info("✅ AvailabilityChecker initialized")
    
    # Enrichment Service - orchestrates all enrichment
    enrichment_service = EnrichmentService(
        mongodb=mongodb,
        redis_cache=redis_cache,
        model_config_manager=model_config_manager,
        salary_estimator=salary_estimator,
        response_scorer=response_scorer,
        skill_validator=skill_validator,
        availability_checker=availability_checker,
        web_search=web_search
    )
    logger.info("✅ EnrichmentService initialized")
    
    # JD Parser
    jd_parser = JDParser(model_config_manager)
    logger.info("✅ JDParser initialized")
    
    sample_generator_v3 = None
    # Sample Profile Generator
    if ENABLE_CREWAI:
        try:
            sample_generator_v3 = SampleProfileGeneratorV3(
                profiles_collection=mongodb.profiles_collection,
                openrouter_api_key=settings.OPENROUTER_API_KEY,
                model_name=settings.AI_MODEL_NAME
            )
            logger.info("✅ SampleProfileGeneratorV3 (CrewAI) initialized")
        except Exception as e:
            logger.warning(f"⚠️ CrewAI initialization failed: {e}. V3 generator unavailable.")
            sample_generator_v3 = None
    
    # Add Query Debugger
    query_debugger = QueryDebugger()
    logger.info("✅ QueryDebugger initialized")
    
    funnel_search = FunnelSearchService(
        profiles_collection=mongodb.profiles_collection,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_base_url="https://openrouter.ai/api/v1"
    )
    logger.info("✅ FunnelSearchService initialized (replaces TieredSmartSearch)")

    # Conversation Manager
    conversation_manager = ConversationManager(
        redis_cache=redis_cache,
        model_config_manager=model_config_manager,
        funnel_search=funnel_search 
    )
    logger.info("✅ ConversationManager initialized")
    
    # ========================================
    # WORKFLOW ORCHESTRATOR
    # ========================================
    workflow = ScorecardWorkflow(
        mongodb=mongodb,
        redis_cache=redis_cache,
        search_engine=search_engine,
        candidate_scorer=scorer,  
        ai_parser=ai_parser,
        model_config_manager=model_config_manager,
        enrichment_service=enrichment_service, 
        conversation_manager=conversation_manager  
    )
    logger.info("✅ ScorecardWorkflow V3 orchestrated successfully")
    
    deep_dive_service = IntelligentEnrichmentOrchestrator(
        mongodb=mongodb,
        redis_cache=redis_cache,
        model_config_manager=model_config_manager
    )
    logger.info("✅ IntelligentEnrichmentOrchestrator initialized")
    
    parallel_enrichment_service = ParallelEnrichmentService(
            enrichment_orchestrator=deep_dive_service,
            redis_cache=redis_cache,
            mongodb=mongodb
        )
    logger.info("✅ ParallelEnrichmentService created")
    
    vapi_interview_service = VapiInterviewService(
            mongodb=mongodb,
            redis_cache=redis_cache
        )
    
    logger.info("✅ VapiInterviewService created")
    # ========================================
    # STORE IN GLOBAL DICT
    # ========================================
    services = {
        # Data Layer
        "mongodb": mongodb,
        "redis_cache": redis_cache,
        
        # Core Services (V2)
        "search_engine": search_engine,
        "scorer": scorer,
        "ai_parser": ai_parser,
        "model_config_manager": model_config_manager,
        
        # Phase 2A Services (Enrichment)
        "web_search": web_search,
        "salary_estimator": salary_estimator,
        "response_scorer": response_scorer,
        "skill_validator": skill_validator,
        "availability_checker": availability_checker,
        "enrichment_service": enrichment_service,
        
        # Phase 2B Services (Conversation)
        "jd_parser": jd_parser,
        "jd_generator": jd_generator,
        "sample_generator_v3": sample_generator_v3, 
        "query_debugger": query_debugger,  # Add debugger
        "conversation_manager": conversation_manager,
        "funnel_search": funnel_search,
        # Workflow Orchestrator
        "workflow": workflow,
        
        # deep search
        "deep_dive_service": deep_dive_service,
        "parallel_enrichment_service": parallel_enrichment_service,
        
        # interview 
        "vapi_interview_service" : vapi_interview_service
    }
    
    # Save to global variable
    global _global_services
    _global_services = services
    
    logger.info("🎉 All services initialized successfully")
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


def get_model_config_manager() -> ModelConfigManager:
    """Get the model configuration manager service."""
    return _global_services["model_config_manager"]


# ============================================================================
# Phase 2A Dependencies (Enrichment)
# ============================================================================

def get_web_search():
    """Get the web search wrapper service."""
    return _global_services["web_search"]


def get_salary_estimator():
    """Get the salary estimator service."""
    return _global_services["salary_estimator"]


def get_response_scorer():
    """Get the response scorer service."""
    return _global_services["response_scorer"]


def get_skill_validator():
    """Get the skill validator service."""
    return _global_services["skill_validator"]


def get_availability_checker():
    """Get the availability checker service."""
    return _global_services["availability_checker"]


def get_enrichment_service() -> EnrichmentService:
    """Get the enrichment service."""
    return _global_services["enrichment_service"]

def get_deep_dive_service() -> IntelligentEnrichmentOrchestrator:
    """Get the deep dive service."""
    return _global_services["deep_dive_service"]

def get_parallel_enrichment_service() -> ParallelEnrichmentService:
    """Get singleton parallel enrichment service."""
    return _global_services["parallel_enrichment_service"]



# ============================================================================
# Phase 2B Dependencies (Conversation)
# ============================================================================

def get_conversation_manager() -> ConversationManager:
    """Get the conversation manager service."""
    return _global_services["conversation_manager"]


def get_jd_parser() -> JDParser:
    """Get the JD parser service."""
    return _global_services["jd_parser"]


# def get_sample_generator() -> SampleProfileGenerator:
#     """Get the sample profile generator."""
#     return _global_services["sample_generator"]

# def get_sample_generator_v2() -> SampleProfileGeneratorV2:
#     """Get the V2 sample generator with debugging."""
#     return _global_services["sample_generator_v2"]

def get_sample_generator_v3() -> SampleProfileGeneratorV3:
    """
    Get the V3 sample generator with CrewAI.
    
    Raises:
        HTTPException: If V3 generator not available
    """
    generator = _global_services.get("sample_generator_v3")
    if generator is None:
        raise HTTPException(
            status_code=503,
            detail="CrewAI-based search is currently unavailable"
        )
    return generator

def get_query_debugger() -> QueryDebugger:
    """Get the query debugger."""
    return _global_services["query_debugger"]

async def get_jd_generator(
) :
    """Get JD generator service."""
    return _global_services["jd_generator"]

def get_funnel_search() -> FunnelSearchService:
    """Get the funnel search service."""
    return _global_services["funnel_search"]

def get_vapi_interview_service() -> VapiInterviewService:
    """Get singleton vapi_interview_service"""
    return _global_services["vapi_interview_service"]



def get_current_username(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    Extract and validate the current user from JWT token.
    
    This is used in protected endpoints to get the username.
    
    Args:
        credentials: JWT token from Authorization header
        
    Returns:
        username string
        
    Raises:
        HTTPException: If token is invalid
        
    Usage:
        @app.get("/user/profile")
        async def get_profile(username: str = Depends(get_current_username)):
            return {"username": username}
    """
    token = credentials.credentials
    
    try:
        # Verify token and extract payload
        payload = verify_token(token)
        username = payload.get("sub")  # "sub" field contains username
        
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: username not found"
            )
        
        return username
        
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
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