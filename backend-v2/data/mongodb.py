"""
MongoDB Data Access Layer
==========================
This file handles ALL database operations for MongoDB.

We have two databases:
1. Profiles DB: Contains 56M candidate profiles (read-only for most operations)
2. Main DB: Contains users, prompts, logs (read-write)
"""


from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import ConnectionFailure, OperationFailure

from core.config import settings
from core.logging_config import get_logger

# Get the logger for this module
logger = get_logger(__name__)

class MongoDB:
    """
    MongoDB wrapper that provides clean access to both databases.
    
    This class is a singleton - one instance is created at startup and reused.
    """
    
    def __init__(self):
        """
        Initialize MongoDB connections.
        
        Creates connections to:
        - Profiles database (56M candidate profiles)
        - Main database (users, prompts, logs)
        """
        logger.info("Connecting to MongoDB...")
        
        # ====================================================================
        # Profiles Database (56M candidates)
        # ====================================================================
        try:
            self.profiles_client = MongoClient(
                settings.PROFILES_DB_URL,
                serverSelectionTimeoutMS=5000  # 5 second timeout
            )
            
            # Test connection
            self.profiles_client.admin.command('ping')
            
            # Get database and collection
            profiles_db = self.profiles_client[settings.PROFILES_DB_NAME]
            self.profiles_collection = profiles_db["profiles"]
            
            # Count documents (for logging)
            profile_count = self.profiles_collection.count_documents({})
            logger.info(f"Profiles DB: {settings.PROFILES_DB_NAME} ({profile_count:,} profiles)")
            
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to Profiles DB: {e}")
            raise
        
        # ====================================================================
        # Main Database (users, prompts, logs)
        # ====================================================================
        try:
            self.main_client = MongoClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=5000
            )
            
            # Test connection
            self.main_client.admin.command('ping')
            
            # Get database and collections
            main_db = self.main_client[settings.DATABASE_NAME]
            self.users_collection = main_db["users"]
            self.prompts_collection = main_db["prompts"]
            self.logs_collection = main_db["user_logs"]
            
            logger.info(f"Main DB: {settings.DATABASE_NAME}")
            
            # Create indexes if they don't exist
            self._ensure_indexes()
            
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to Main DB: {e}")
            raise
    
    def _ensure_indexes(self):
        """
        Create necessary indexes on the main database.
        This runs once at startup to ensure indexes exist.
        """
        try:
            # Prompts collection indexes
            self.prompts_collection.create_index("session_id", unique=True)
            self.prompts_collection.create_index("prompt_id", unique=True)
            self.prompts_collection.create_index([("username", 1), ("created_at", -1)])
            
            logger.info("Database indexes verified")
            
        except OperationFailure as e:
            logger.error(f"Could not create indexes: {e}")
    
    # ========================================================================
    # Scorecard Operations
    # ========================================================================
    
    async def save_scorecard(self, scorecard: Dict[str, Any]) -> str:
        """
        Save a completed scorecard to the database.
        
        Args:
            scorecard: Dictionary containing scorecard data
            
        Returns:
            str: The inserted document ID
            
        Example:
            scorecard = {
                "session_id": "abc-123",
                "username": "john@company.com",
                "prompt": "Find Senior Python Developer",
                "candidates": [...],
                "summary": {...},
                "created_at": datetime.utcnow()
            }
            
            doc_id = await mongodb.save_scorecard(scorecard)
        """
        try:
            result = self.prompts_collection.insert_one(scorecard)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to save scorecard: {e}")
            raise
    
    async def get_scorecard_by_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a scorecard by session ID.
        
        Args:
            session_id: The session ID to look up
            
        Returns:
            Dict with scorecard data, or None if not found
        """
        try:
            scorecard = self.prompts_collection.find_one({"session_id": session_id})
            
            # Convert ObjectId to string for JSON serialization
            if scorecard and "_id" in scorecard:
                scorecard["_id"] = str(scorecard["_id"])
            
            return scorecard
            
        except Exception as e:
            logger.error(f"Failed to get scorecard: {e}")
            return None
    
    async def get_user_scorecards(
        self,
        username: str,
        limit: int = 10,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all scorecards for a specific user.
        
        Args:
            username: Username to filter by
            limit: Maximum number of results
            skip: Number of results to skip (for pagination)
            
        Returns:
            List of scorecard documents
        """
        try:
            cursor = self.prompts_collection.find(
                {"username": username}
            ).sort("created_at", -1).skip(skip).limit(limit)
            
            scorecards = list(cursor)
            
            # Convert ObjectIds to strings
            for scorecard in scorecards:
                if "_id" in scorecard:
                    scorecard["_id"] = str(scorecard["_id"])
            
            return scorecards
            
        except Exception as e:
            logger.error(f"Failed to get user scorecards: {e}")
            return []
    
    # ========================================================================
    # Profile Operations (56M Profiles)
    # ========================================================================
    
    async def get_profile_by_id(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single profile by ID.
        
        Args:
            profile_id: MongoDB ObjectId as string
            
        Returns:
            Profile document or None
        """
        try:
            profile = self.profiles_collection.find_one({"_id": ObjectId(profile_id)})
            
            if profile and "_id" in profile:
                profile["_id"] = str(profile["_id"])
            
            return profile
            
        except Exception as e:
            logger.error(f"Failed to get profile: {e}")
            return None
    
    async def get_profiles_by_ids(self, profile_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Get multiple profiles by their IDs.
        
        Args:
            profile_ids: List of MongoDB ObjectIds as strings
            
        Returns:
            List of profile documents
        """
        try:
            # Convert string IDs to ObjectIds
            object_ids = [ObjectId(pid) for pid in profile_ids]
            
            # Fetch profiles
            cursor = self.profiles_collection.find({"_id": {"$in": object_ids}})
            profiles = list(cursor)
            
            # Convert ObjectIds back to strings
            for profile in profiles:
                if "_id" in profile:
                    profile["_id"] = str(profile["_id"])
            
            return profiles
            
        except Exception as e:
            logger.error(f"Failed to get profiles: {e}")
            return []
    
    # ========================================================================
    # User Operations
    # ========================================================================
    
    async def get_user(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Get user by username.
        
        Args:
            username: Username to look up
            
        Returns:
            User document or None
        """
        try:
            user = self.users_collection.find_one({"username": username})
            
            if user and "_id" in user:
                user["_id"] = str(user["_id"])
            
            return user
            
        except Exception as e:
            logger.error(f"Failed to get user: {e}")
            return None
    
    async def create_user(self, user_data: Dict[str, Any]) -> str:
        """
        Create a new user.
        
        Args:
            user_data: Dictionary with user information
            
        Returns:
            str: The inserted user ID
        """
        try:
            result = self.users_collection.insert_one(user_data)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise
    
    # ========================================================================
    # Logging Operations
    # ========================================================================
    
    async def log_user_action(
        self,
        username: str,
        action: str,
        details: Dict[str, Any] = None
    ):
        """
        Log a user action for analytics.
        
        Args:
            username: Username performing the action
            action: Action type (e.g., "search", "scorecard_created")
            details: Additional details about the action
        """
        try:
            log_entry = {
                "username": username,
                "action": action,
                "details": details or {},
                "timestamp": datetime.utcnow()
            }
            
            self.logs_collection.insert_one(log_entry)
            
        except Exception as e:
            # Don't raise - logging failures shouldn't break the app
            logger.critical(f" Failed to log action: {e}")
    
    # ========================================================================
    # Cleanup
    # ========================================================================
    
    def close(self):
        """Close all MongoDB connections."""
        if hasattr(self, 'profiles_client'):
            self.profiles_client.close()
        if hasattr(self, 'main_client'):
            self.main_client.close()
        logger.info("MongoDB connections closed")
        
    async def save_enriched_results(self, result_doc: Dict[str, Any]):
        """
        Save enriched results to MongoDB.
        
        Args:
            result_doc: Results document including:
                - session_id
                - conversation_session_id
                - username
                - ideal_profile
                - candidates (with enrichment data)
                - total_found
                - enriched_count
                - created_at
                - status
        """
        
        collection = self.db["enriched_results"]
        
        # Create indexes if not exists
        await self._ensure_enriched_results_indexes()
        
        # Insert or update
        await collection.update_one(
            {"session_id": result_doc["session_id"]},
            {"$set": result_doc},
            upsert=True
        )
    
    
    async def get_enriched_results(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get enriched results by session ID.
        
        Args:
            session_id: Search session ID
        
        Returns:
            Results document or None
        """
        
        collection = self.db["enriched_results"]
        return await collection.find_one({"session_id": session_id})
    
    
    async def list_enriched_results(
        self,
        username: str,
        limit: int = 20,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List enriched results for a user.
        
        Args:
            username: Username
            limit: Max results
            skip: Number to skip (for pagination)
        
        Returns:
            List of result documents (without full candidate data)
        """
        
        collection = self.db["enriched_results"]
        
        cursor = collection.find(
            {"username": username},
            {
                "session_id": 1,
                "conversation_session_id": 1,
                "ideal_profile": 1,
                "total_found": 1,
                "enriched_count": 1,
                "created_at": 1,
                "status": 1
            }
        ).sort("created_at", -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    
    async def _ensure_enriched_results_indexes(self):
        """Create indexes for enriched_results collection."""
        
        collection = self.db["enriched_results"]
        
        # Index on session_id (unique)
        await collection.create_index("session_id", unique=True)
        
        # Index on username + created_at (for listing)
        await collection.create_index([
            ("username", 1),
            ("created_at", -1)
        ])
        
        # Index on conversation_session_id
        await collection.create_index("conversation_session_id")
    
    
    # ================================================================
    # CONVERSATIONS (Optional - for persistence)
    # ================================================================
    
    async def save_conversation_state(self, conversation_doc: Dict[str, Any]):
        """
        Save conversation state to MongoDB (for long-term persistence).
        
        Args:
            conversation_doc: Conversation state including:
                - session_id
                - username
                - stage
                - ideal_profile
                - messages
                - created_at
                - updated_at
        
        Note: This is optional - conversation state is primarily in Redis.
              This is for long-term archival or recovery.
        """
        
        collection = self.db["conversations"]
        
        # Create indexes if not exists
        await self._ensure_conversations_indexes()
        
        # Insert or update
        await collection.update_one(
            {"session_id": conversation_doc["session_id"]},
            {"$set": conversation_doc},
            upsert=True
        )
    
    
    async def get_conversation_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get conversation state from MongoDB.
        
        Args:
            session_id: Conversation session ID
        
        Returns:
            Conversation document or None
        """
        
        collection = self.db["conversations"]
        return await collection.find_one({"session_id": session_id})
    
    
    async def _ensure_conversations_indexes(self):
        """Create indexes for conversations collection."""
        
        collection = self.db["conversations"]
        
        # Index on session_id (unique)
        await collection.create_index("session_id", unique=True)
        
        # Index on username + updated_at
        await collection.create_index([
            ("username", 1),
            ("updated_at", -1)
        ])