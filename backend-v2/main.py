"""
Main FastAPI Application Entry Point
====================================
This is the starting point of Neuraleap backend application.
It initializes all services and sets up the API routes.

Author: Mrigesh Thakur
Last Modified: Nov 2025
"""


import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env file
load_dotenv()

# Import API routes
from api import auth, scorecard
# Import core components
from core.config import settings
from core.dependencies import initialize_services
from core.logging_config import get_logger
# Import data layer for connection testing
from data.mongodb import MongoDB
from data.redis_cache import RedisCache

# Get the logger for this module
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for the FastAPI application.
    
    This runs when the app starts up and shuts down.
    We use it to:
    - Initialize database connections
    - Set up services
    - Clean up on shutdown
    """
    logger.info("=" * 80)
    logger.info("STARTING NEURALEAP BACKEND")
    logger.info("=" * 80)
    

    try:        
        # Initialize global services ( stored in app.state)
        app.state.services = initialize_services()
        logger.info("All services started")
        
    except Exception as e:
        logger.error("Failed to initialize: {e}")
        sys.exit(1)
        
    logger.info("=" * 80)
    logger.info(f"🌐 API Server ready at: http://{settings.SERVER_HOST}:{settings.SERVER_PORT}")
    logger.info("=" * 80)
    logger.info()
    
    # Application is now running
    yield
    
    # Shutdown: Clean up resources
    logger.info("Shutting downn gracefully...")
    
    
# Create FastAPI application
app = FastAPI(
    title="Neuraleap API",
    description="Candidate scorecarding and search API for 56M profiles",
    version="2.0.0",
    lifespan=lifespan
)


# ============================================================================
# CORS Configuration
# ============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",  # React development server
    "http://127.0.0.1:3000",  # Alternative localhost
    "http://localhost:3001",  # Alternative port
    "http://127.0.0.1:3001",  # Alternative port
    "https://hire-x-xi.vercel.app/",# vercel deployment With trailing slash
    "https://hire-x-xi.vercel.app" # vercel deployment 
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],
    max_age=3600,
)


# ============================================================================
# Health Check Endpoint
# ============================================================================

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Simple health check endpoint.
    Returns 200 OK if the server is running.
    """
    return {
        "status": "healthy",
        "service": "neuraleap-api",
        "version": "2.0.0"
    }


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - just a welcome message :) 
    """
    return {
        "message": "Welcome to Neuraleap API v2.0",
        "docs": "/docs",
        "health": "/health"
    }


# ============================================================================
# Include API Routers
# ============================================================================

# Authentication routes: /auth/login, /auth/logout, etc.
app.include_router(
    auth.router,
    prefix="/auth",  
    tags=["Authentication"]
)

# Scorecard routes: /scorecard/parse-prompt, /scorecard/session/{id}/status, etc.
app.include_router(
    scorecard.router,
    prefix="/scorecard", 
    tags=["Scorecard"]
)


# ============================================================================
# Development Server
# ============================================================================

if __name__ == "__main__":
    """
    Run the server directly with: python main.py for dev purposes
    
    For production, use: uvicorn main:app --host 0.0.0.0 --port 8000
    """
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=True,  # Auto-reload on code changes (disable in production)
        log_level="info"
    )


