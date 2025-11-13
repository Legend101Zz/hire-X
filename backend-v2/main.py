"""
Main FastAPI Application Entry Point - V3
==========================================
This is the starting point of Neuraleap backend application.
It initializes all services and sets up the API routes.

Author: Mrigesh Thakur
Last Modified: Nov 2025
Version: 3.0.0
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
from api import auth, configuration, conversation, enriched_results, scorecard
# Import core components
from core.config import settings
from core.dependencies import initialize_services
from core.logging_config import get_logger

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
    logger.debug("=" * 80)
    logger.debug("STARTING NEURALEAP BACKEND V3")
    logger.debug("=" * 80)
    

    try:        
        # Initialize global services (stored in app.state)
        app.state.services = initialize_services()
        logger.info("🎉 All services started successfully")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        logger.exception("Full error traceback:")  # This will show the full traceback
        sys.exit(1)
        
    logger.debug("=" * 80)
    logger.debug(f"🌐 API Server ready at: http://{settings.SERVER_HOST}:{settings.SERVER_PORT}")
    logger.debug(f"📖 API Docs available at: http://{settings.SERVER_HOST}:{settings.SERVER_PORT}/docs")
    logger.debug("=" * 80)
 
    
    # Application is now running
    yield
    
    # Shutdown: Clean up resources
    logger.debug("Shutting down gracefully...")
    
    
# Create FastAPI application
app = FastAPI(
    title="Neuraleap Backend V3",
    description="AI-powered candidate search with conversational interface and smart enrichment",
    version="3.0.0",
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
        "https://hire-x-xi.vercel.app",  # Vercel deployment (without trailing slash)
        "https://hire-x-xi.vercel.app/",  # Vercel deployment (with trailing slash)
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
        "version": "3.0.0"
    }


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - just a welcome message :) 
    """
    return {
        "message": "Welcome to Neuraleap API v3.0",
        "docs": "/docs",
        "health": "/health",
        "features": [
            "Conversational interface with Donna",
            "56M profile search",
            "Smart candidate enrichment",
            "Real-time progress tracking"
        ]
    }


# ============================================================================
# Include API Routers
# ============================================================================

# Authentication routes: /auth/login, /auth/logout, etc.
app.include_router(
    auth.router,
    tags=["Authentication"]
)

# Scorecard routes: /scorecard/parse-prompt, /scorecard/session/{id}/status, etc.
app.include_router(
    scorecard.router,
    tags=["Scorecard"]
)

# Configuration routes: /config/models/options, /config/session/{id}, etc.
app.include_router(
    configuration.router,
    tags=["Configuration"]
)

# Conversation routes: /conversation/start, /conversation/message, etc.
app.include_router(
    conversation.router,
    tags=["Conversation"]
)

# Results routes: /results/session/{id}, etc.
app.include_router(
    enriched_results.router,
    tags=["Results"]
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