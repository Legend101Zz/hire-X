"""
Authentication API Endpoints
============================
These endpoints handle user authentication (login, logout, etc.)

This file works alongside core auth.py module which contains
the JWT token generation and verification logic.
"""

from core.auth import create_access_token, get_password_hash, verify_password
# Import dependencies
from core.dependencies import get_current_username, get_mongodb
from core.logging_config import get_logger
from data.mongodb import MongoDB
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
# Import models
from models.requests import LoginRequest, RegisterRequest
from models.responses import TokenResponse, UserResponse

# Create router
router = APIRouter(prefix="/auth")
security = HTTPBearer()

# Get the logger for this module
logger = get_logger(__name__)


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(
    request: LoginRequest,
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Login endpoint - authenticate user and return JWT token.
    
    Example request:
        POST /login
        {
            "username": "john@company.com",
            "password": "mypassword123"
        }
    
    Example response:
        {
            "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "token_type": "bearer",
            "username": "john@company.com"
        }
    """
    
    # Get user from database
    user = await mongodb.get_user(request.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Verify password
    if not verify_password(request.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Create JWT token
    access_token = create_access_token(data={"sub": user["username"]})
    
    logger.info(f"User logged in: {request.username}")
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        username=user["username"]
    )


@router.post("/register", response_model=UserResponse, tags=["Authentication"])
async def register(
    request: RegisterRequest,
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Register a new user.
    
    Example request:
        POST /register
        {
            "username": "john@company.com",
            "email": "john@company.com",
            "password": "securepassword123",
            "full_name": "John Doe"
        }
    
    Example response:
        {
            "username": "john@company.com",
            "email": "john@company.com",
            "full_name": "John Doe",
            "message": "User registered successfully"
        }
    """
    
    # Check if user already exists
    existing_user = await mongodb.get_user(request.username)
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Hash password
    hashed_password = get_password_hash(request.password)
    
    # Create user document
    from datetime import datetime
    user_data = {
        "username": request.username,
        "email": request.email,
        "full_name": request.full_name,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Store in database
    user_id = await mongodb.create_user(user_data)
    
    logger.info(f"New user registered: {request.username}")
    return UserResponse(
        username=request.username,
        email=request.email,
        full_name=request.full_name,
        message="User registered successfully"
    )


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(
    username: str = Depends(get_current_username),
    mongodb: MongoDB = Depends(get_mongodb)
):
    """
    Get current user information.
    
    This endpoint requires a valid JWT token.
    
    Example request:
        GET /me
        Headers: Authorization: Bearer <token>
    
    Example response:
        {
            "username": "john@company.com",
            "email": "john@company.com",
            "full_name": "John Doe"
        }
    """
    
    # Get user from database
    user = await mongodb.get_user(username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        username=user.get("username"),
        email=user.get("email"),
        full_name=user.get("full_name"),
        message="User information retrieved"
    )


@router.post("/logout", tags=["Authentication"])
async def logout():
    """
    Logout endpoint.
    
    Note: Since we're using stateless JWT tokens, logout is handled client-side
    by deleting the token. This endpoint just returns a success message.
    
    Example request:
        POST /logout
    
    Example response:
        {
            "message": "Logged out successfully"
        }
    """
    
    return {"message": "Logged out successfully. Please delete your token client-side."}