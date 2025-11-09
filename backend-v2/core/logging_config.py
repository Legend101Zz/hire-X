"""
Centralized logging configuration for Neuraleap backend.

Features:
- Environment-based log levels (DEV vs PROD)
- File and console handlers
- Structured log format with timestamps
- Rotating file handlers to prevent disk bloat
- Color-coded console output for development
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color coding for console output."""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
    }
    RESET = '\033[0m'
    
    def format(self,record):
        # Add color to level name
        if record.levelname in self.COLORS:
            record.levelname =f"{self.COLORS[record.levelname]}{record.levelname}{self.RESET}"
        return super().format(record)
    
class LoggerManager(object):
    """Centralized logger manager for the application."""
    _instance: Optional['LoggerManager'] = None
    _initialized: bool = False
    
    def __new__(cls):
        """Singleton pattern to ensure we only have one logger config throughout our backend"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the logger manager"""
        self.environment = os.getenv("ENVIRONMENT", "development").lower()
        self.log_level = self._get_log_level()
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)
        
        # Create loggers
        self._setup_loggers()
        self._initialized = True
        
    def _get_log_level(self) -> int:
        """
        Get log level based on environment.
        
        Environment variables:
        - ENVIRONMENT: development/production
        - LOG_LEVEL: DEBUG/INFO/WARNING/ERROR/CRITICAL (overrides environment default)
        """
        # Check if explicit log level is set
        log_level_str = os.getenv("LOG_LEVEL", "").upper()
        if log_level_str:
            return getattr(logging, log_level_str, logging.INFO)
        
        # Default based on environment
        if self.environment == "production":
            return logging.INFO
        else:
            return logging.DEBUG
        
    def _setup_loggers(self):
        """Setup all application loggers"""
        # Root logger configuration
        root_logger = logging.getLogger()
        root_logger.setLevel(self.log_level)
        root_logger.handlers.clear() # we clear any existing loggers
        
        # Console handler with color formatting ( for development )
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(self.log_level)
        
        if self.environment == "production":
            # forv Production: Simple format without colors
            console_format = logging.Formatter(
                fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
        else:
            # Development: Colored format
            console_format = ColoredFormatter(
                fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                datefmt='%H:%M:%S'
            )
        console_handler.setFormatter(console_format)
        root_logger.addHandler(console_handler)
        # File handler with rotation (for all environments)
        file_handler = RotatingFileHandler(
            self.log_dir / "neuraleap.log",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)  # Always capture DEBUG in files
        file_format = logging.Formatter(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_format)
        root_logger.addHandler(file_handler)
        
        # Error-specific file handler
        error_handler = RotatingFileHandler(
            self.log_dir / "errors.log",
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_format)
        root_logger.addHandler(error_handler)
        
        # Suppress noisy third-party loggers
        logging.getLogger("urllib3").setLevel(logging.WARNING)
        logging.getLogger("requests").setLevel(logging.WARNING)
        logging.getLogger("asyncio").setLevel(logging.WARNING)
        
    def get_logger(self,name:str) -> logging.Logger:
        """
        Get a logger instance for a specific module.
        
        Args:
            name: Name of the module (typically __name__)
        
        Returns:
            Configured logger instance
        """
        return logging.getLogger(name)
    
# Global logger manager instance
_manager = LoggerManager()


def get_logger(name: str) -> logging.Logger:
    """
    Convenience function to get a logger.
    
    Usage:
        from logger_config import get_logger
        logger = get_logger(__name__)
        logger.info("Application started")
    
    Args:
        name: Name of the module (use __name__)
    
    Returns:
        Configured logger instance
    """
    return _manager.get_logger(name)


def log_function_call(func):
    """
    Decorator to automatically log function calls.
    
    Usage:
        @log_function_call
        def my_function(param1, param2):
            return param1 + param2
    """
    import functools
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        logger = get_logger(func.__module__)
        logger.debug(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"{func.__name__} completed successfully")
            return result
        except Exception as e:
            logger.error(f"{func.__name__} failed with error: {e}", exc_info=True)
            raise
    
    return wrapper


def log_async_function_call(func):
    """
    Decorator to automatically log async function calls.
    
    Usage:
        @log_async_function_call
        async def my_async_function(param1):
            return await some_operation(param1)
    """
    import functools
    
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        logger = get_logger(func.__module__)
        logger.debug(f"Calling async {func.__name__} with args={args}, kwargs={kwargs}")
        try:
            result = await func(*args, **kwargs)
            logger.debug(f"Async {func.__name__} completed successfully")
            return result
        except Exception as e:
            logger.error(f"Async {func.__name__} failed with error: {e}", exc_info=True)
            raise
    
    return wrapper

