"""
Configuration Settings
=====================
This file loads all configuration from environment variables (.env file).

All settings are validated and have sensible defaults.
"""

import os
from typing import Optional

from dotenv import load_dotenv

from core.logging_config import get_logger

# Load environment variables from .env file
load_dotenv()

# Get the logger for this module
logger = get_logger(__name__)
class Settings:
    """
    Application settings loaded from environment variables.
    
    This class makes it easy to access all your configuration in one place.
    All values are read from the .env file or use defaults.
    """
    
    # ========================================================================
    # JWT & Security
    # ========================================================================
    
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
    
    # ========================================================================
    # AI Configuration
    # ========================================================================
    
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "openai/gpt-4o-mini")
    
    # ========================================================================
    # MongoDB - Main Database (Users, Prompts, Logs)
    # ========================================================================
    
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "neuraleap")
    
    # ========================================================================
    # MongoDB - Profiles Database (56M candidate profiles)
    # ========================================================================
    
    PROFILES_DB_URL: str = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017")
    PROFILES_DB_NAME: str = os.getenv("PROFILES_DB_NAME", "mydatabase")
    
    # ========================================================================
    # Redis Configuration
    # ========================================================================
    
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    
    # ========================================================================
    # Server Configuration
    # ========================================================================
    
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    
    # ========================================================================
    # Performance Settings
    # ========================================================================
    
    # Maximum number of candidates to return
    MAX_CANDIDATES: int = int(os.getenv("MAX_CANDIDATES", "50"))
    
    # Search limit (how many to fetch before scoring)
    SEARCH_LIMIT: int = int(os.getenv("SEARCH_LIMIT", "500"))
    
    # Number of worker threads for parallel scoring
    SCORER_WORKERS: int = int(os.getenv("SCORER_WORKERS", "4"))
    
    # Batch size for parallel scoring
    SCORING_BATCH_SIZE: int = int(os.getenv("SCORING_BATCH_SIZE", "50"))
    
    # ========================================================================
    # Logging Configuration
    # ========================================================================
    
    # Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Where to log
    LOG_TO_CONSOLE: bool = os.getenv("LOG_TO_CONSOLE", "true").lower() == "true"
    LOG_TO_FILE: bool = os.getenv("LOG_TO_FILE", "true").lower() == "true"
    
    # File logging settings
    LOG_FILE: str = os.getenv("LOG_FILE", "app.log")
    LOG_MAX_SIZE_MB: int = int(os.getenv("LOG_MAX_SIZE_MB", "10"))  # Max size before rotation
    LOG_BACKUP_COUNT: int = int(os.getenv("LOG_BACKUP_COUNT", "5"))  # Number of backup files
    
    def validate(self) -> bool:
        """
        Validate that all required settings are present.
        
        Returns:
            bool: True if all required settings are valid
        """
        errors = []
        
        # Check required API key
        if not self.OPENROUTER_API_KEY:
            errors.append("❌ OPENROUTER_API_KEY is not set in .env")
        
        # Check JWT secret
        if self.JWT_SECRET_KEY == "your-secret-key-change-in-production":
            errors.append("⚠️  WARNING: Using default JWT_SECRET_KEY (change in production!)")
        
        # Check database URLs
        if not self.MONGODB_URL:
            errors.append("❌ MONGODB_URL is not set in .env")
        
        if not self.PROFILES_DB_URL:
            errors.append("❌ PROFILES_DB_URL is not set in .env")
        
        # Print errors if any
        if errors:
            logger.error("\n" + "=" * 80)
            logger.error("CONFIGURATION ERRORS:")
            logger.error("=" * 80)
            for error in errors:
                logger.error(error)
            logger.error("=" * 80)
            logger.error()
            return False
        
        return True


# Create a global settings instance
# This can be imported and used anywhere: from core.config import settings
settings = Settings()

# Validate settings on import
if not settings.validate():
    logger.critical("Some configuration values are missing or invalid.")
    logger.critical("Please check your .env file and update the required values.")
    logger.critical()