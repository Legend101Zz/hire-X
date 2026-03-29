"""
Model Configuration Manager
===========================
Allows users to configure which LLM models to use for different tasks.
This enables cost control and quality customization.
"""

import json
from typing import Dict, List, Optional

import httpx

from core.config import settings
from core.logging_config import get_logger
from data.redis_cache import RedisCache
from models.configuration_models import (ModelConfiguration, ModelOption,
                                         ModelPreset)

logger = get_logger(__name__)


class ModelConfigManager:
    """
    Manages model selection for different tasks.
    
    Users can:
    1. Choose from preset configurations (balanced, high-quality, cost-efficient)
    2. Customize individual model selections
    3. Get cost estimates for their configuration
    """
    
    # ========================================================================
    # DEFAULT CONFIGURATIONS
    # ========================================================================
    
    DEFAULT_CONFIG = ModelConfiguration(
        conversation="anthropic/claude-sonnet-4.5",
        jd_parsing="anthropic/claude-sonnet-4.5",
        web_search="perplexity/sonar-pro",
        salary_estimation="x-ai/grok-code-fast-1",
        skill_validation="x-ai/grok-code-fast-1",
        response_likelihood="x-ai/grok-code-fast-1",
        match_scoring="anthropic/claude-sonnet-4.5"
    )
    
    # ========================================================================
    # AVAILABLE MODEL OPTIONS
    # ========================================================================
    
    MODEL_OPTIONS = {
    "conversation": [
        ModelOption(
            id="claude-sonnet-4.5",
            name="Claude Sonnet 4.5",
            cost="High",
            quality="Excellent",
            description="Best for natural conversation and complex reasoning"
        ),
        ModelOption(
            id="claude-sonnet-4",
            name="Claude Sonnet 4",
            cost="High",
            quality="Excellent",
            description="Great for conversation, slightly older version"
        ),
        ModelOption(
            id="gpt-4o",
            name="GPT-4o",
            cost="High",
            quality="Very Good",
            description="OpenAI's latest model, good for conversation"
        )
    ],
    
    "web_search": [
        ModelOption(
            id="perplexity/sonar-pro",
            name="Perplexity Sonar Pro",
            cost="Medium",
            quality="Excellent",
            description="Specialized for web search with citations"
        ),
        ModelOption(
            id="perplexity/sonar",
            name="Perplexity Sonar",
            cost="Low",
            quality="Very Good",
            description="Good web search at lower cost"
        ),
        ModelOption(
            id="deepseek/deepseek-r1",
            name="DeepSeek R1",
            cost="Very Low",
            quality="Good",
            description="Cost-effective option for web search"
        )
    ],
    
    "bulk_analysis": [  # For salary, skills, response likelihood
        ModelOption(
            id="x-ai/grok-code-fast-1",
            name="Grok Code Fast 1",
            cost="Medium",
            quality="Very Good",
            description="xAI's optimized model for fast structured reasoning and code-like precision"
        ),
        ModelOption(
            id="deepseek/deepseek-r1",
            name="DeepSeek R1",
            cost="Very Low",
            quality="Good",
            description="Best cost/quality ratio for bulk analysis"
        ),
        ModelOption(
            id="anthropic/claude-haiku-4.5",
            name="Claude Haiku 4",
            cost="Low",
            quality="Very Good",
            description="Fast and accurate for analysis tasks"
        ),
        ModelOption(
            id="openai/gpt-4o-mini",
            name="GPT-4o Mini",
            cost="Low",
            quality="Good",
            description="Compact OpenAI model for analysis"
        )
    ],
    
    "scoring": [
        ModelOption(
            id="anthropic/claude-sonnet-4.5",
            name="Claude Sonnet 4.5",
            cost="High",
            quality="Excellent",
            description="Best for nuanced candidate matching"
        ),
        ModelOption(
            id="x-ai/grok-code-fast-1",
            name="Grok Code Fast 1",
            cost="Medium",
            quality="Very Good",
            description="Efficient structured reasoning for candidate scoring and logic-based ranking"
        ),
        ModelOption(
            id="anthropic/claude-sonnet-4",
            name="Claude Sonnet 4",
            cost="High",
            quality="Excellent",
            description="Great for candidate scoring"
        ),
        ModelOption(
            id="deepseek/deepseek-r1",
            name="DeepSeek R1",
            cost="Very Low",
            quality="Good",
            description="Cost-effective for basic scoring"
        )
    ]
}

    # ========================================================================
    # PRESET CONFIGURATIONS
    # ========================================================================
    
    PRESETS = {
        "balanced": ModelPreset(
            name="Balanced (Recommended)",
            description="Mix of quality and cost - best for most use cases",
            configuration=ModelConfiguration(
                conversation="claude-sonnet-4.5",
                jd_parsing="claude-sonnet-4.5",
                web_search="perplexity/sonar-pro",
                salary_estimation="deepseek/deepseek-r1",
                skill_validation="deepseek/deepseek-r1",
                response_likelihood="deepseek/deepseek-r1",
                match_scoring="claude-sonnet-4.5"
            ),
            estimated_cost_per_50_candidates=25.0  # ₹25 per search
        ),
        
        "high_quality": ModelPreset(
            name="High Quality",
            description="Best models for all tasks - highest accuracy",
            configuration=ModelConfiguration(
                conversation="claude-sonnet-4.5",
                jd_parsing="claude-sonnet-4.5",
                web_search="perplexity/sonar-pro",
                salary_estimation="claude-sonnet-4.5",
                skill_validation="claude-sonnet-4.5",
                response_likelihood="claude-sonnet-4.5",
                match_scoring="claude-sonnet-4.5"
            ),
            estimated_cost_per_50_candidates=75.0  # ₹75 per search
        ),
        
        "cost_efficient": ModelPreset(
            name="Cost Efficient",
            description="Cheapest models - still good quality",
            configuration=ModelConfiguration(
                conversation="claude-sonnet-4.5",  # Keep conversation high quality
                jd_parsing="deepseek/deepseek-r1",
                web_search="perplexity/sonar",
                salary_estimation="deepseek/deepseek-r1",
                skill_validation="deepseek/deepseek-r1",
                response_likelihood="deepseek/deepseek-r1",
                match_scoring="deepseek/deepseek-r1"
            ),
            estimated_cost_per_50_candidates=8.0  # ₹8 per search
        )
    }
    
    # ========================================================================
    # INITIALIZATION
    # ========================================================================
    
    def __init__(self, redis_cache: RedisCache):
        """
        Initialize the model configuration manager.
        
        Args:
            redis_cache: Redis cache for storing session configurations
        """
        self.redis = redis_cache
        logger.info("ModelConfigManager initialized")
    
    # ========================================================================
    # MAIN METHODS
    # ========================================================================
    
    async def get_model_for_task(
        self, 
        task: str, 
        session_id: Optional[str] = None,
        username: Optional[str] = None
    ) -> str:
        """
        Get the configured model for a specific task.
        
        Priority:
        1. Session-specific configuration (if session_id provided)
        2. User-specific configuration (if username provided)
        3. Default configuration
        
        Args:
            task: Task name (e.g., "conversation", "web_search")
            session_id: Optional session ID
            username: Optional username
            
        Returns:
            Model ID string (e.g., "claude-sonnet-4.5")
        
        Example:
            model = await manager.get_model_for_task(
                "salary_estimation",
                session_id="abc-123"
            )
            # Returns: "deepseek/deepseek-r1"
        """
        
        # Try session config first
        if session_id:
            session_config = await self.get_session_config(session_id)
            if session_config and hasattr(session_config, task):
                model = getattr(session_config, task)
                logger.debug(f"Using session config for {task}: {model}")
                return model
        
        # Try user config
        if username:
            user_config = await self.get_user_config(username)
            if user_config and hasattr(user_config, task):
                model = getattr(user_config, task)
                logger.debug(f"Using user config for {task}: {model}")
                return model
        
        # Fall back to default
        default_model = getattr(self.DEFAULT_CONFIG, task)
        logger.debug(f"Using default config for {task}: {default_model}")
        return default_model
    
    async def call_model(
        self,
        model_config: Optional[ModelConfiguration],
        model_purpose: str,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        session_id: Optional[str] = None,
        username: Optional[str] = None
    ) -> str:
        """
        Call LLM model via OpenRouter API.
        
        Args:
            model_config: Model configuration (can be None)
            model_purpose: Purpose mapping ("extraction" -> "conversation", etc.)
            system_prompt: System prompt
            user_message: User message
            temperature: Sampling temperature
            max_tokens: Max tokens
            session_id: Optional session ID
            username: Optional username
            
        Returns:
            Model response string
        """
        
        # Map model purposes to configuration fields
        purpose_mapping = {
            "extraction": "conversation",  # Use conversation model for extraction
            "conversation": "conversation",
            "jd_parsing": "jd_parsing",
            "scoring": "match_scoring",
            "web_search": "web_search"
        }
        
        # Get the appropriate task name
        task_name = purpose_mapping.get(model_purpose, "conversation")
        
        # Get model ID
        if model_config and hasattr(model_config, task_name):
            model_id = getattr(model_config, task_name)
        else:
            # Fall back to getting model by task
            model_id = await self.get_model_for_task(
                task_name,
                session_id=session_id,
                username=username
            )
        
        # Validate API key
        if not settings.OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        print(f"Calling {model_id} for {model_purpose}")
        
        # Prepare API request
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://Hire-X.com",
            "X-Title": "Hire-X AI Platform"
        }
        
        data = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        # Make API call
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=data
                )
                response.raise_for_status()
                
                result = response.json()
                ai_response = result["choices"][0]["message"]["content"]
                print('ai_response',ai_response)
                return ai_response
                
            except httpx.HTTPStatusError as e:
                logger.error(f"OpenRouter API error: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"Model call failed: {e}")
                raise
    
    async def update_session_config(
        self,
        session_id: str,
        config: ModelConfiguration
    ):
        """
        Update model configuration for a specific session.
        
        Args:
            session_id: Session ID
            config: New model configuration
        
        Example:
            await manager.update_session_config(
                "abc-123",
                ModelConfiguration(
                    conversation="claude-sonnet-4.5",
                    web_search="perplexity/sonar-pro",
                    # ... other fields
                )
            )
        """
        config_dict = config.dict()
        await self.redis.store_session_data(
            session_id,
            "model_config",
            config_dict,
             expire_seconds=3600  # 1 hour
            )
        logger.info(f"Updated model config for session {session_id}")
    
    async def get_session_config(
        self,
        session_id: str
    ) -> Optional[ModelConfiguration]:
        """
        Get model configuration for a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            ModelConfiguration if exists, None otherwise
        """
        config_dict = await self.redis.get_session_data(session_id, "model_config")
        if config_dict:
            return ModelConfiguration(**config_dict)
        return None
    
    async def update_user_config(
        self,
        username: str,
        config: ModelConfiguration
    ):
        """
        Save default model configuration for a user.
        
        This becomes their default for all future sessions.
        
        Args:
            username: Username
            config: Model configuration
        """
        config_dict = config.dict()
        key = f"user_model_config:{username}"
        
        await self.redis.store_session_data(
        session_id=f"user_config_{username}",
        key=key,
        data=config_dict,
        expire_seconds=86400  # 24 hours
        )
        logger.info(f"Updated default model config for user {username}")
    
    async def get_user_config(
        self,
        username: str
    ) -> Optional[ModelConfiguration]:
        """
        Get user's default model configuration.
        
        Args:
            username: Username
            
        Returns:
            ModelConfiguration if exists, None otherwise
        """
        if not username:
            logger.debug("No username provided, using default config")
            return None
        
        try:
            config_dict = await self.redis.get_session_data(
                session_id=f"user_config_{username}",
                key="model_config"
            )
            
            if config_dict:
                return ModelConfiguration(**config_dict)
                
        except Exception as e:
            logger.error(f"Error getting user config for {username}: {e}")
        
        return None

    
    def get_available_options(self) -> Dict[str, List[ModelOption]]:
        """
        Get all available model options for each task category.
        
        Returns:
            Dictionary mapping task category to list of model options
        
        Example:
            options = manager.get_available_options()
            # Returns:
            # {
            #     "conversation": [ModelOption(...), ModelOption(...)],
            #     "web_search": [...],
            #     ...
            # }
        """
        return self.MODEL_OPTIONS
    
    def get_presets(self) -> Dict[str, ModelPreset]:
        """
        Get all predefined configuration presets.
        
        Returns:
            Dictionary of preset name to ModelPreset
        """
        return self.PRESETS
    
    async def apply_preset(
        self,
        session_id: str,
        preset_name: str
    ):
        """
        Apply a preset configuration to a session.
        
        Args:
            session_id: Session ID
            preset_name: Preset name ("balanced", "high_quality", "cost_efficient")
        
        Raises:
            ValueError: If preset name is invalid
        
        Example:
            await manager.apply_preset("abc-123", "balanced")
        """
        if preset_name not in self.PRESETS:
            raise ValueError(f"Unknown preset: {preset_name}")
        
        preset = self.PRESETS[preset_name]
        await self.update_session_config(session_id, preset.configuration)
        logger.info(f"Applied preset '{preset_name}' to session {session_id}")
    
    def estimate_cost(
        self,
        config: ModelConfiguration,
        num_candidates: int = 50
    ) -> float:
        """
        Estimate cost in INR for a given configuration.
        
        Args:
            config: Model configuration
            num_candidates: Number of candidates to enrich (default 50)
            
        Returns:
            Estimated cost in INR
        
        Note:
            This is a rough estimate. Actual costs may vary based on
            token usage, which depends on candidate data complexity.
        """
        # Rough cost per candidate for different models (in INR)
        model_costs = {
            "claude-sonnet-4.5": 0.8,
            "claude-sonnet-4": 0.7,
            "claude-haiku-4": 0.2,
            "gpt-4o": 0.6,
            "gpt-4o-mini": 0.15,
            "deepseek/deepseek-r1": 0.05,
            "perplexity/sonar-pro": 0.3,
            "perplexity/sonar": 0.15
        }
        
        # Estimate based on typical usage
        total_cost = 0.0
        
        # Conversation: ~5-10 turns per session
        total_cost += model_costs.get(config.conversation, 0.5) * 10
        
        # JD Parsing: Once per session
        total_cost += model_costs.get(config.jd_parsing, 0.5)
        
        # Scoring: Once per candidate
        total_cost += model_costs.get(config.match_scoring, 0.5) * num_candidates
        
        # Enrichment: Per candidate (salary, skills, likelihood)
        enrichment_cost_per_candidate = (
            model_costs.get(config.salary_estimation, 0.3) +
            model_costs.get(config.skill_validation, 0.2) +
            model_costs.get(config.response_likelihood, 0.2) +
            model_costs.get(config.web_search, 0.3) * 3  # ~3 searches per candidate
        )
        total_cost += enrichment_cost_per_candidate * num_candidates
        
        return round(total_cost, 2)