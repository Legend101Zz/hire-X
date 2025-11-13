"""
Configuration API Endpoints
===========================
API routes for managing model configuration.

Endpoints:
- GET /config/models/options - Get available model options
- GET /config/models/presets - Get predefined presets
- GET /config/session/{session_id} - Get session's model config
- POST /config/session/{session_id} - Update session's model config
- POST /config/session/{session_id}/preset - Apply a preset
- POST /config/user - Update user's default config
- GET /config/user - Get user's default config
"""

from typing import Dict

from core.dependencies import get_current_username, get_model_config_manager
from core.logging_config import get_logger
from fastapi import APIRouter, Depends, HTTPException
from models.configuration_models import (CostEstimate, ModelConfigRequest,
                                         ModelConfiguration)
from services.model_config_manager import ModelConfigManager

logger = get_logger(__name__)

# Create router
router = APIRouter(prefix="/config-model")


# ============================================================================
# GET AVAILABLE OPTIONS & PRESETS
# ============================================================================

@router.get("/models/options")
async def get_model_options(
    config_manager: ModelConfigManager = Depends(get_model_config_manager)
):
    """
    Get all available model options for each task type.
    
    Returns:
        {
            "conversation": [
                {
                    "id": "claude-sonnet-4-5",
                    "name": "Claude Sonnet 4.5",
                    "cost": "High",
                    "quality": "Excellent",
                    "description": "..."
                },
                ...
            ],
            "web_search": [...],
            "bulk_analysis": [...],
            "scoring": [...]
        }
    
    Example usage from frontend:
        const options = await fetch('/config/models/options');
        // Show dropdown with these options
    """
    try:
        options = config_manager.get_available_options()
        return {
            "success": True,
            "options": options
        }
    except Exception as e:
        logger.error(f"Error getting model options: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/presets")
async def get_model_presets(
    config_manager: ModelConfigManager = Depends(get_model_config_manager)
):
    """
    Get predefined model configuration presets.
    
    Returns:
        {
            "balanced": {
                "name": "Balanced (Recommended)",
                "description": "Mix of quality and cost",
                "configuration": {...},
                "estimated_cost_per_50_candidates": 25.0
            },
            "high_quality": {...},
            "cost_efficient": {...}
        }
    
    Example usage:
        const presets = await fetch('/config/models/presets');
        // Show preset buttons: "Balanced", "High Quality", "Cost Efficient"
    """
    try:
        presets = config_manager.get_presets()
        return {
            "success": True,
            "presets": presets
        }
    except Exception as e:
        logger.error(f"Error getting presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# SESSION CONFIGURATION
# ============================================================================

@router.get("/session/{session_id}")
async def get_session_config(
    session_id: str,
    config_manager: ModelConfigManager = Depends(get_model_config_manager),
    username: str = Depends(get_current_username)
):
    """
    Get model configuration for a specific session.
    
    If no session config exists, returns user's default or global default.
    
    Args:
        session_id: Session ID
    
    Returns:
        {
            "success": true,
            "config": {
                "conversation": "claude-sonnet-4-5",
                "jd_parsing": "claude-sonnet-4-5",
                ...
            },
            "source": "session" | "user_default" | "global_default"
        }
    """
    try:
        # Try to get session config
        session_config = await config_manager.get_session_config(session_id)
        
        if session_config:
            return {
                "success": True,
                "config": session_config,
                "source": "session"
            }
        
        # Try user default
        user_config = await config_manager.get_user_config(username)
        if user_config:
            return {
                "success": True,
                "config": user_config,
                "source": "user_default"
            }
        
        # Return global default
        return {
            "success": True,
            "config": config_manager.DEFAULT_CONFIG,
            "source": "global_default"
        }
        
    except Exception as e:
        logger.error(f"Error getting session config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}")
async def update_session_config(
    session_id: str,
    config_request: ModelConfigRequest,
    config_manager: ModelConfigManager = Depends(get_model_config_manager),
    username: str = Depends(get_current_username)
):
    """
    Update model configuration for a session.
    
    You can update individual fields or all at once.
    Only provided fields will be updated.
    
    Request body:
        {
            "conversation": "claude-sonnet-4-5",  // optional
            "web_search": "perplexity/sonar-pro",  // optional
            "salary_estimation": "deepseek/deepseek-r1",  // optional
            ...
        }
    
    Returns:
        {
            "success": true,
            "message": "Configuration updated",
            "updated_config": {...},
            "estimated_cost": 25.0
        }
    
    Example usage:
        await fetch('/config/session/abc-123', {
            method: 'POST',
            body: JSON.stringify({
                web_search: "perplexity/sonar",  // Change just this
            })
        });
    """
    try:
        # Get current config
        current_config = await config_manager.get_session_config(session_id)
        
        if not current_config:
            # No existing config, start with default
            current_config = config_manager.DEFAULT_CONFIG
        
        # Update only provided fields
        update_dict = config_request.dict(exclude_none=True)
        current_dict = current_config.dict()
        current_dict.update(update_dict)
        
        # Create new config
        new_config = ModelConfiguration(**current_dict)
        
        # Save it
        await config_manager.update_session_config(session_id, new_config)
        
        # Estimate cost
        estimated_cost = config_manager.estimate_cost(new_config)
        
        return {
            "success": True,
            "message": "Configuration updated successfully",
            "updated_config": new_config,
            "estimated_cost_per_50_candidates": estimated_cost
        }
        
    except Exception as e:
        logger.error(f"Error updating session config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/preset")
async def apply_preset_to_session(
    session_id: str,
    preset_name: str,
    config_manager: ModelConfigManager = Depends(get_model_config_manager),
    username: str = Depends(get_current_username)
):
    """
    Apply a predefined preset to a session.
    
    Query parameter:
        preset_name: "balanced" | "high_quality" | "cost_efficient"
    
    Example:
        POST /config/session/abc-123/preset?preset_name=balanced
    
    Returns:
        {
            "success": true,
            "message": "Preset 'balanced' applied",
            "config": {...},
            "estimated_cost": 25.0
        }
    """
    try:
        # Apply preset
        await config_manager.apply_preset(session_id, preset_name)
        
        # Get the applied config
        config = await config_manager.get_session_config(session_id)
        
        # Estimate cost
        estimated_cost = config_manager.estimate_cost(config)
        
        return {
            "success": True,
            "message": f"Preset '{preset_name}' applied successfully",
            "config": config,
            "estimated_cost_per_50_candidates": estimated_cost
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error applying preset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# USER DEFAULT CONFIGURATION
# ============================================================================

@router.get("/user")
async def get_user_default_config(
    config_manager: ModelConfigManager = Depends(get_model_config_manager),
    username: str = Depends(get_current_username)
):
    """
    Get user's default model configuration.
    
    This is the configuration that will be used for all new sessions
    unless overridden at the session level.
    
    Returns:
        {
            "success": true,
            "config": {...} or null if no default set
        }
    """
    try:
        user_config = await config_manager.get_user_config(username)
        
        return {
            "success": True,
            "config": user_config,
            "has_custom_default": user_config is not None
        }
        
    except Exception as e:
        logger.error(f"Error getting user config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user")
async def update_user_default_config(
    config: ModelConfiguration,
    config_manager: ModelConfigManager = Depends(get_model_config_manager),
    username: str = Depends(get_current_username)
):
    """
    Set user's default model configuration.
    
    This will be used for all future sessions.
    
    Request body:
        {
            "conversation": "claude-sonnet-4-5",
            "jd_parsing": "claude-sonnet-4-5",
            "web_search": "perplexity/sonar-pro",
            ...
        }
    
    Returns:
        {
            "success": true,
            "message": "Default configuration saved",
            "config": {...}
        }
    """
    try:
        await config_manager.update_user_config(username, config)
        
        return {
            "success": True,
            "message": "Default configuration saved successfully",
            "config": config
        }
        
    except Exception as e:
        logger.error(f"Error updating user config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# COST ESTIMATION
# ============================================================================

@router.post("/estimate-cost")
async def estimate_configuration_cost(
    config: ModelConfiguration,
    num_candidates: int = 50,
    config_manager: ModelConfigManager = Depends(get_model_config_manager)
):
    """
    Get cost estimate for a model configuration.
    
    Request body:
        {
            "conversation": "claude-sonnet-4-5",
            ...
        }
    
    Query parameter:
        num_candidates: Number of candidates (default 50)
    
    Returns:
        {
            "success": true,
            "total_cost_inr": 25.0,
            "cost_per_candidate": 0.5,
            "num_candidates": 50
        }
    """
    try:
        total_cost = config_manager.estimate_cost(config, num_candidates)
        
        return {
            "success": True,
            "total_cost_inr": total_cost,
            "cost_per_candidate": round(total_cost / num_candidates, 2),
            "num_candidates": num_candidates
        }
        
    except Exception as e:
        logger.error(f"Error estimating cost: {e}")
        raise HTTPException(status_code=500, detail=str(e))