"""
Authentication utilities for JWT tokens, password hashing, and MongoDB operations.
"""
import os
import datetime
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pymongo import MongoClient
from models import User, IncidentLog
import asyncio


class AuthManager:
    """Manages authentication operations including JWT tokens, password hashing, and MongoDB."""
    
    def __init__(self):
        # JWT Configuration
        self.secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 30
        
        # Password hashing
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
        
        # MongoDB connection
        self.mongo_client = MongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017/"))
        self.db = self.mongo_client.get_database(os.getenv("DATABASE_NAME", "neuraleap"))
        self.users_collection = self.db.users
        self.incidents_collection = self.db["incident-logs"]
        
        # Create indexes
        self._create_indexes()
    
    def _create_indexes(self):
        """Create necessary database indexes."""
        try:
            self.users_collection.create_index("username", unique=True)
            self.incidents_collection.create_index([("username", 1), ("timestamp", -1)])
        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password."""
        # Truncate password if it's too long for bcrypt (72 bytes max)
        if len(password.encode('utf-8')) > 72:
            password = password[:72]
        return self.pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[datetime.timedelta] = None):
        """Create a JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.datetime.utcnow() + expires_delta
        else:
            expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None
    
    async def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate a user by username and password."""
        try:
            user_data = self.users_collection.find_one({"username": username})
            if not user_data:
                return None
            
            if not self.verify_password(password, user_data["hashed_password"]):
                return None
            
            # Convert MongoDB document to User model
            user = User(
                username=user_data["username"],
                email=user_data.get("email"),
                hashed_password=user_data["hashed_password"],
                created_at=user_data.get("created_at"),
                last_login=user_data.get("last_login")
            )
            
            # Update last login time
            self.users_collection.update_one(
                {"username": username},
                {"$set": {"last_login": datetime.datetime.utcnow().isoformat()}}
            )
            
            return user
            
        except Exception as e:
            print(f"Error authenticating user: {e}")
            return None
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get a user by username."""
        try:
            user_data = self.users_collection.find_one({"username": username})
            if not user_data:
                return None
            
            return User(
                username=user_data["username"],
                email=user_data.get("email"),
                hashed_password=user_data["hashed_password"],
                created_at=user_data.get("created_at"),
                last_login=user_data.get("last_login")
            )
            
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    async def log_incident(self, username: str, incident_type: str, ip_address: Optional[str] = None, 
                          user_agent: Optional[str] = None, details: Optional[str] = None):
        """Log a security incident."""
        try:
            incident = IncidentLog(
                username=username,
                ip_address=ip_address,
                user_agent=user_agent,
                incident_type=incident_type,
                timestamp=datetime.datetime.utcnow().isoformat(),
                details=details
            )
            
            # Convert to dict for MongoDB insertion
            incident_dict = incident.model_dump()
            self.incidents_collection.insert_one(incident_dict)
            
            print(f"Incident logged: {incident_type} for user {username}")
            
        except Exception as e:
            print(f"Error logging incident: {e}")
    
    async def create_user(self, username: str, password: str, email: Optional[str] = None) -> bool:
        """Create a new user."""
        try:
            # Check if user already exists
            if self.users_collection.find_one({"username": username}):
                return False
            
            hashed_password = self.get_password_hash(password)
            user_data = {
                "username": username,
                "email": email,
                "hashed_password": hashed_password,
                "created_at": datetime.datetime.utcnow().isoformat(),
                "last_login": None
            }
            
            self.users_collection.insert_one(user_data)
            return True
            
        except Exception as e:
            print(f"Error creating user: {e}")
            return False
