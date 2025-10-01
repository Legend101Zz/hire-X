"""
Redis connection and session management.
"""
import json
import os
import asyncio
from typing import Dict, Any, Optional, Callable
import redis
import redis.asyncio as aioredis


class RedisManager:
    def __init__(self, host: str = None, port: int = None, db: int = None):
        """
        Initialize Redis connection manager.
        
        Args:
            host: Redis server host (uses REDIS_HOST env var if not provided)
            port: Redis server port (uses REDIS_PORT env var if not provided)
            db: Redis database number (uses REDIS_DB env var if not provided)
        """
        # Use environment variables with fallbacks
        host = host or os.getenv("REDIS_HOST", "localhost")
        port = port or int(os.getenv("REDIS_PORT", "6379"))
        db = db or int(os.getenv("REDIS_DB", "0"))
        
        try:
            self.redis_client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
            self.async_redis_client = aioredis.from_url(f"redis://{host}:{port}/{db}", decode_responses=True)
            # Test connection
            self.redis_client.ping()
            print("✅ Connected to Redis successfully")
        except redis.ConnectionError:
            print("❌ Failed to connect to Redis. Make sure Redis is running.")
            raise
        
        # WebSocket callback registry
        self.websocket_callbacks: Dict[str, Callable] = {}
    
    def store_prompt(self, session_id: str, prompt: str) -> bool:
        """
        Store prompt data for a session.
        
        Args:
            session_id: Unique session identifier
            prompt: The prompt data to store
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            key = f"{session_id}:prompt"
            self.redis_client.set(key, prompt)
            return True
        except Exception as e:
            print(f"Error storing prompt: {e}")
            return False
    
    def get_prompt(self, session_id: str) -> Optional[str]:
        """
        Retrieve prompt data for a session.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            str: The prompt data or None if not found
        """
        try:
            key = f"{session_id}:prompt"
            return self.redis_client.get(key)
        except Exception as e:
            print(f"Error retrieving prompt: {e}")
            return None
    
    def store_filtered_data(self, session_id: str, data: Dict[str, Any]) -> bool:
        """
        Store filtered/processed data for a session.
        
        Args:
            session_id: Unique session identifier
            data: The filtered data to store
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            key = f"{session_id}:filtered_data"
            self.redis_client.set(key, json.dumps(data))
            return True
        except Exception as e:
            print(f"Error storing filtered data: {e}")
            return False
    
    def get_filtered_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve filtered/processed data for a session.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            dict: The filtered data or None if not found
        """
        try:
            key = f"{session_id}:filtered_data"
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"Error retrieving filtered data: {e}")
            return None
    
    def get_data(self, session_id: str, action_tag: str) -> Optional[Any]:
        """
        Retrieve data from Redis using the sessionID:action_tag:data structure.
        
        Args:
            session_id: Unique session identifier
            action_tag: Tag identifying the type of data
            
        Returns:
            Any: Retrieved data or None if not found
        """
        try:
            key = f"{session_id}:{action_tag}"
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"Error retrieving data for {session_id}:{action_tag}: {e}")
            return None
    
    def store_workflow_status(self, session_id: str, status: str) -> bool:
        """
        Store workflow status for a session.
        
        Args:
            session_id: Unique session identifier
            status: The workflow status to store
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            key = f"{session_id}:workflow_status"
            self.redis_client.set(key, status)
            return True
        except Exception as e:
            print(f"Error storing workflow status: {e}")
            return False
    
    def get_workflow_status(self, session_id: str) -> Optional[str]:
        """
        Retrieve workflow status for a session.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            str: The workflow status or None if not found
        """
        try:
            key = f"{session_id}:workflow_status"
            return self.redis_client.get(key)
        except Exception as e:
            print(f"Error retrieving workflow status: {e}")
            return None
    
    def delete_session(self, session_id: str) -> bool:
        """
        Delete all data for a session.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            pattern = f"{session_id}:*"
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
            return True
        except Exception as e:
            print(f"Error deleting session: {e}")
            return False
    
    async def subscribe_to_session(self, session_id: str, callback: Callable):
        """
        Subscribe to Redis pub/sub for a specific session.
        
        Args:
            session_id: Session ID to subscribe to
            callback: Callback function to handle messages
        """
        try:
            # Store callback for this session
            self.websocket_callbacks[session_id] = callback
            
            # Subscribe to session-specific channel
            pubsub = self.async_redis_client.pubsub()
            await pubsub.subscribe(f"session_updates:{session_id}")
            
            print(f"📡 Subscribed to session updates: {session_id}")
            
            # Listen for messages
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        await callback(session_id, data)
                    except json.JSONDecodeError:
                        print(f"Failed to decode message for session {session_id}")
                        
        except Exception as e:
            print(f"Error subscribing to session {session_id}: {e}")
    
    async def publish_session_update(self, session_id: str, action: str, data: Any):
        """
        Publish a session update to Redis pub/sub.
        
        Args:
            session_id: Session ID
            action: Action name
            data: Data to publish
        """
        try:
            message = {
                "action": action,
                "data": data,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            await self.async_redis_client.publish(
                f"session_updates:{session_id}", 
                json.dumps(message, default=str)
            )
            print(f"📤 Published update for session {session_id}: {action}")
            
        except Exception as e:
            print(f"Error publishing update for session {session_id}: {e}")
    
    def register_websocket_callback(self, session_id: str, callback: Callable):
        """
        Register a WebSocket callback for a session.
        
        Args:
            session_id: Session ID
            callback: Callback function to handle WebSocket messages
        """
        self.websocket_callbacks[session_id] = callback
    
    def unregister_websocket_callback(self, session_id: str):
        """
        Unregister a WebSocket callback for a session.
        
        Args:
            session_id: Session ID
        """
        if session_id in self.websocket_callbacks:
            del self.websocket_callbacks[session_id]
