"""
Redis Cache Layer
=================
This file handles all Redis operations for caching and session management.

Redis is used for:
- Session data (workflow progress, temporary results)
- Caching search results
- Real-time status updates
"""

import datetime
import hashlib
import json
from typing import Any, Dict, List, Optional

import redis

from core.config import settings
from core.logging_config import get_logger

# Get the logger for this module
logger = get_logger(__name__)

class RedisCache:
    """
    Redis wrapper for caching and session management.
    
    This provides a clean interface to Redis operations.
    """
    
    def __init__(self):
        """
        Initialize Redis connection.
        
        Connects to Redis server specified in settings.
        """
        logger.info("Connecting to Redis...")
        
        try:
            self.redis = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True,  # Automatically decode bytes to strings
                socket_connect_timeout=5  # 5 second timeout
            )
            
            # Test connection
            self.redis.ping()
            logger.info(f"Redis connected: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
            
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
        
    async def get(self, key: str) -> Optional[str]:
            """
            Generic wrapper for Redis GET. 
            Kept async to satisfy await calls in services.
            """
            try:
                return self.redis.get(key)
            except Exception as e:
                logger.error(f"Redis GET failed for key {key}: {e}")
                return None

    async def set(self, key: str, value: str, ex: int = None):
        """
        Generic wrapper for Redis SET.
        Kept async to satisfy await calls in services.
        """
        try:
            return self.redis.set(key, value, ex=ex)
        except Exception as e:
            logger.error(f"Redis SET failed for key {key}: {e}")
    
    # ========================================================================
    # Session Data Operations
    # ========================================================================
    
    async def store_session_data(
        self,
        session_id: str,
        key: str,
        data: Any,
        expire_seconds: int = 3600
    ):
        """
        Store data for a specific session.
        
        Args:
            session_id: Unique session identifier
            key: Data key (e.g., "parsed_requirements", "candidates")
            data: Data to store (will be JSON serialized)
            expire_seconds: How long to keep the data (default: 1 hour)
            
        Example:
            await redis.store_session_data(
                session_id="abc-123",
                key="parsed_requirements",
                data={"industries": ["Technology"], "seniority": ["Senior"]},
                expire_seconds=3600
            )
        """
        try:
            redis_key = f"session:{session_id}:{key}"
            
            # Serialize data to JSON
            json_data = json.dumps(data)
            
            # Store in Redis with expiration (SYNCHRONOUS - so no await)
            self.redis.setex(redis_key, expire_seconds, json_data)
            
        except Exception as e:
            logger.critical(f"⚠️  Failed to store session data: {e}")
            # Don't raise - cache failures shouldn't break the app
    
    async def get_session_data(
        self,
        session_id: str,
        key: str
    ) -> Optional[Any]:
        """
        Retrieve data for a specific session.
        
        Args:
            session_id: Unique session identifier
            key: Data key to retrieve
            
        Returns:
            Stored data (deserialized from JSON) or None if not found
        """
        try:
            redis_key = f"session:{session_id}:{key}"
            
            # Get data from Redis
            json_data = self.redis.get(redis_key)
            
            if json_data is None:
                return None
            
            # Deserialize from JSON
            return json.loads(json_data)
            
        except Exception as e:
            logger.critical(f"⚠️  Failed to get session data: {e}")
            return None
    
    async def delete_session_data(self, session_id: str, key: str = None):
        """
        Delete session data.
        
        Args:
            session_id: Session to delete data from
            key: Specific key to delete, or None to delete all session data
        """
        try:
            if key:
                # Delete specific key
                redis_key = f"session:{session_id}:{key}"
                self.redis.delete(redis_key)
            else:
                # Delete all keys for this session
                pattern = f"session:{session_id}:*"
                keys = self.redis.keys(pattern)
                if keys:
                    self.redis.delete(*keys)
            
        except Exception as e:
            logger.critical(f"⚠️  Failed to delete session data: {e}")
    
    # ========================================================================
    # Workflow Status Operations
    # ========================================================================
    
    async def set_workflow_status(
        self,
        session_id: str,
        status: str,
        progress: int,
        message: str = ""
    ):
        """
        Update workflow status for real-time progress tracking.
        
        Args:
            session_id: Session identifier
            status: Status string (e.g., "parsing", "searching", "completed")
            progress: Progress percentage (0-100)
            message: Human-readable status message
            
        Example:
            await redis.set_workflow_status(
                session_id="abc-123",
                status="searching",
                progress=40,
                message="Searching database for candidates..."
            )
        """
        status_data = {
            "status": status,
            "progress": progress,
            "message": message,
            "updated_at": str(redis.StrictRedis.time(self.redis)[0])
        }
        
        await self.store_session_data(
            session_id=session_id,
            key="workflow_status",
            data=status_data,
            expire_seconds=3600
        )
    
    async def get_workflow_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get current workflow status.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Dict with status info, or None if not found
        """
        return await self.get_session_data(session_id, "workflow_status")
    
    # ========================================================================
    # Search Results Caching
    # ========================================================================
    
    def _make_search_cache_key(self, **kwargs) -> str:
        """
        Create a cache key from search parameters.
        
        This creates a unique hash from the search criteria so we can
        cache results for identical searches.
        """
        # Sort keys for consistent hashing
        cache_string = json.dumps(kwargs, sort_keys=True)
        
        # Create MD5 hash
        hash_key = hashlib.md5(cache_string.encode()).hexdigest()
        
        return f"search_cache:{hash_key}"
    
    async def get_cached_search(
        self,
        industries: list = None,
        seniority: list = None,
        locations: list = None,
        keywords: str = ""
    ) -> Optional[list]:
        """
        Get cached search results if available.
        
        Args:
            industries: Industry filters
            seniority: Seniority level filters
            locations: Location filters
            keywords: Search keywords
            
        Returns:
            Cached results or None if not in cache
        """
        try:
            cache_key = self._make_search_cache_key(
                industries=industries,
                seniority=seniority,
                locations=locations,
                keywords=keywords
            )
            
            json_data = self.redis.get(cache_key)
            
            if json_data:
                logger.info(f"Cache HIT for search")
                return json.loads(json_data)
            else:
                logger.info(f"Cache MISS for search")
                return None
                
        except Exception as e:
            logger.critical(f"⚠️  Cache error: {e}")
            return None
    
    async def cache_search_results(
        self,
        results: list,
        industries: list = None,
        seniority: list = None,
        locations: list = None,
        keywords: str = "",
        expire_seconds: int = 1800  # 30 minutes
    ):
        """
        Cache search results for future requests.
        
        Args:
            results: Search results to cache
            industries: Industry filters used
            seniority: Seniority filters used
            locations: Location filters used
            keywords: Keywords used
            expire_seconds: Cache lifetime (default: 30 minutes)
        """
        try:
            cache_key = self._make_search_cache_key(
                industries=industries,
                seniority=seniority,
                locations=locations,
                keywords=keywords
            )
            
            json_data = json.dumps(results)
            self.redis.setex(cache_key, expire_seconds, json_data)
            
            logger.critical(f"Cached {len(results)} search results")
            
        except Exception as e:
            logger.critical(f"Failed to cache results: {e}")
    
    # ========================================================================
    # Prompt Storage (for quick lookup)
    # ========================================================================
    
    async def store_prompt(
        self,
        session_id: str,
        prompt: str,
        expire_seconds: int = 3600
    ):
        """Store the original prompt for a session."""
        await self.store_session_data(
            session_id=session_id,
            key="original_prompt",
            data=prompt,
            expire_seconds=expire_seconds
        )
    
    async def get_prompt(self, session_id: str) -> Optional[str]:
        """Get the original prompt for a session."""
        return await self.get_session_data(session_id, "original_prompt")
    
    async def store_conversation_state(
        self,
        session_id: str,
        state: Dict[str, Any],
        ttl: int = 3600
    ):
        """
        Store conversation state in Redis.
        
        Args:
            session_id: Conversation session ID
            state: Full conversation state dict
            ttl: Time to live in seconds (default 1 hour)
        """
        
        key = f"conversation:{session_id}"
        
        # Store as JSON
        await self.redis.set(
            key,
            json.dumps(state),
            ex=ttl
        )
    
    
    async def get_conversation_state(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get conversation state from Redis.
        
        Args:
            session_id: Conversation session ID
        
        Returns:
            Conversation state dict or None
        """
        
        key = f"conversation:{session_id}"
        
        data = await self.redis.get(key)
        
        if data:
            return json.loads(data)
        
        return None
    
    
    async def delete_conversation_state(self, session_id: str):
        """
        Delete conversation state from Redis.
        
        Args:
            session_id: Conversation session ID
        """
        
        key = f"conversation:{session_id}"
        await self.redis.delete(key)
    
    
    async def extend_conversation_ttl(
        self,
        session_id: str,
        ttl: int = 3600
    ):
        """
        Extend TTL of conversation state.
        
        Args:
            session_id: Conversation session ID
            ttl: New TTL in seconds
        """
        
        key = f"conversation:{session_id}"
        await self.redis.expire(key, ttl)
    
    
    # ================================================================
    # WORKFLOW PROGRESS
    # ================================================================
    
    async def store_workflow_progress(
        self,
        session_id: str,
        status: str,
        progress: int,
        message: str,
        ttl: int = 3600
    ):
        """
        Store workflow progress for real-time tracking.
        
        Args:
            session_id: Workflow session ID
            status: Status (parsing, searching, scoring, enriching, completed, error)
            progress: Progress percentage (0-100)
            message: Progress message
            ttl: Time to live in seconds
        """
        
        key = f"progress:{session_id}"
        
        progress_data = {
            "status": status,
            "progress": progress,
            "message": message,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        await self.redis.set(
            key,
            json.dumps(progress_data),
            ex=ttl
        )
    
    
    async def get_workflow_progress(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get workflow progress.
        
        Args:
            session_id: Workflow session ID
        
        Returns:
            Progress data dict or None
        """
        
        key = f"progress:{session_id}"
        
        data = await self.redis.get(key)
        
        if data:
            return json.loads(data)
        
        return None
    
    
    # ================================================================
    # ENRICHMENT CACHE
    # ================================================================
    
    async def cache_candidate_enrichment(
        self,
        profile_id: str,
        enrichment_type: str,
        enrichment_data: Dict[str, Any],
        ttl: int = 86400  # 24 hours
    ):
        """
        Cache enrichment data for a candidate.
        
        Args:
            profile_id: Candidate profile ID
            enrichment_type: Type of enrichment (salary, skills, response, availability)
            enrichment_data: Enrichment data dict
            ttl: Time to live (default 24 hours)
        """
        
        key = f"enrichment:{profile_id}:{enrichment_type}"
        
        await self.redis.set(
            key,
            json.dumps(enrichment_data),
            ex=ttl
        )
    
    
    async def get_cached_enrichment(
        self,
        profile_id: str,
        enrichment_type: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached enrichment data.
        
        Args:
            profile_id: Candidate profile ID
            enrichment_type: Type of enrichment
        
        Returns:
            Enrichment data dict or None
        """
        
        key = f"enrichment:{profile_id}:{enrichment_type}"
        
        data = await self.redis.get(key)
        
        if data:
            return json.loads(data)
        
        return None
    
    
    async def batch_get_cached_enrichment(
        self,
        profile_ids: List[str],
        enrichment_type: str
    ) -> Dict[str, Dict[str, Any]]:
        """
        Get cached enrichment for multiple candidates.
        
        Args:
            profile_ids: List of profile IDs
            enrichment_type: Type of enrichment
        
        Returns:
            Dict mapping profile_id to enrichment data
        """
        
        keys = [f"enrichment:{pid}:{enrichment_type}" for pid in profile_ids]
        
        # Get all at once (pipeline for efficiency)
        pipeline = self.redis.pipeline()
        for key in keys:
            pipeline.get(key)
        
        results = await pipeline.execute()
        
        # Map results
        enrichment_map = {}
        for profile_id, data in zip(profile_ids, results):
            if data:
                enrichment_map[profile_id] = json.loads(data)
        
        return enrichment_map
    
    
    # ================================================================
    # SESSION MANAGEMENT
    # ================================================================
    
    async def list_active_conversations(
        self,
        username: str
    ) -> List[str]:
        """
        List active conversation session IDs for a user.
        
        Args:
            username: Username
        
        Returns:
            List of session IDs
        """
        
        # Use a set to track active conversations per user
        key = f"active_conversations:{username}"
        
        return await self.redis.smembers(key)
    
    
    async def add_active_conversation(
        self,
        username: str,
        session_id: str,
        ttl: int = 3600
    ):
        """
        Add conversation to active list.
        
        Args:
            username: Username
            session_id: Conversation session ID
            ttl: Time to live
        """
        
        key = f"active_conversations:{username}"
        
        await self.redis.sadd(key, session_id)
        await self.redis.expire(key, ttl)
    
    
    async def remove_active_conversation(
        self,
        username: str,
        session_id: str
    ):
        """
        Remove conversation from active list.
        
        Args:
            username: Username
            session_id: Conversation session ID
        """
        
        key = f"active_conversations:{username}"
        await self.redis.srem(key, session_id)
    
    
    # ================================================================
    # RATE LIMITING (Bonus)
    # ================================================================
    
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int
    ) -> bool:
        """
        Check if rate limit exceeded.
        
        Args:
            key: Rate limit key (e.g. "enrichment:user123")
            limit: Max requests
            window: Time window in seconds
        
        Returns:
            True if limit not exceeded, False if exceeded
        """
        
        current = await self.redis.incr(key)
        
        if current == 1:
            # First request, set expiry
            await self.redis.expire(key, window)
        
        return current <= limit
    
    # ========================================================================
    # User Context Storage
    # ========================================================================
    
    async def store_user_context(
        self,
        session_id: str,
        username: str,
        additional_context: Dict[str, Any] = None
    ):
        """
        Store user context for a session.
        
        Args:
            session_id: Session identifier
            username: Username
            additional_context: Any additional context data
        """
        context = {
            "username": username,
            **(additional_context or {})
        }
        
        await self.store_session_data(
            session_id=session_id,
            key="user_context",
            data=context,
            expire_seconds=3600
        )
    
    async def get_user_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get user context for a session."""
        return await self.get_session_data(session_id, "user_context")
    
    # ========================================================================
    # Cleanup
    # ========================================================================
    
    def close(self):
        """Close Redis connection."""
        if hasattr(self, 'redis'):
            self.redis.close()
        logger.info("Redis connection closed")