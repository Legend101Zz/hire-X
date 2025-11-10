"""
Core Authentication Utilities
==============================
Handles JWT token creation/verification and password hashing.

This module provides the core security functions used by the auth API endpoints.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import jwt
from passlib.context import CryptContext

from core.logging_config import get_logger

logger = get_logger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    
    Args:
        plain_password: The plain text password to verify
        hashed_password: The hashed password from the database
        
    Returns:
        bool: True if password matches, False otherwise
    """
    try:
        result = pwd_context.verify(plain_password, hashed_password)
        logger.debug("Password verification completed", extra={
            "result": result
        })
        return result
    except Exception as e:
        logger.error(f"Password verification failed: {e}", exc_info=True)
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password for storage.
    
    Args:
        password: Plain text password
        
    Returns:
        str: Hashed password
    """
    try:
        hashed = pwd_context.hash(password)
        logger.debug("Password hashed successfully")
        return hashed
    except Exception as e:
        logger.error(f"Password hashing failed: {e}", exc_info=True)
        raise


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dictionary containing token payload (e.g., {"sub": username})
        expires_delta: Optional custom expiration time
        
    Returns:
        str: Encoded JWT token
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    try:
        # Encode JWT token
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        logger.info("Access token created", extra={
            "username": data.get("sub"),
            "expires_at": expire.isoformat()
        })
        
        return encoded_jwt
        
    except Exception as e:
        logger.error(f"Token creation failed: {e}", exc_info=True)
        raise


def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        dict: Decoded token payload
        
    Raises:
        jwt.ExpiredSignatureError: If token has expired
        jwt.JWTError: If token is invalid
    """
    try:
        # Decode and verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        
        if username is None:
            logger.warning("Token verification failed: No username in payload")
            raise jwt.JWTError("Invalid token payload")
        
        logger.debug("Token verification successful", extra={
            "username": username
        })
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Token verification failed: Token expired")
        raise
        
    except jwt.JWTError as e:
        logger.error(f"Token verification failed: {e}", exc_info=True)
        raise


def decode_token(token: str) -> Optional[str]:
    """
    Decode a token and return the username.
    
    This is a convenience function that wraps verify_token and returns
    just the username, or None if verification fails.
    
    Args:
        token: JWT token string
        
    Returns:
        Optional[str]: Username if token is valid, None otherwise
    """
    try:
        payload = verify_token(token)
        return payload.get("sub")
    except (jwt.ExpiredSignatureError, jwt.JWTError):
        return None


# Example usage and testing
if __name__ == "__main__":
    # Test password hashing
    logger.info("Testing password hashing...")
    password = "test_password_123"
    hashed = get_password_hash(password)
    logger.info(f"Password hashed: {hashed[:20]}...")
    
    # Test password verification
    logger.info("Testing password verification...")
    is_valid = verify_password(password, hashed)
    logger.info(f"Password verification result: {is_valid}")
    
    # Test token creation
    logger.info("Testing token creation...")
    token = create_access_token(data={"sub": "test@example.com"})
    logger.info(f"Token created: {token[:50]}...")
    
    # Test token verification
    logger.info("Testing token verification...")
    payload = verify_token(token)
    logger.info(f"Token payload: {payload}")
    
    # Test username extraction
    logger.info("Testing username extraction...")
    username = decode_token(token)
    logger.info(f"Username from token: {username}")