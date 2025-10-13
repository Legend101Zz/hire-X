"""
WebSocket connection manager for real-time session updates.
"""
import asyncio
import json
from typing import Any, Dict, Set

from fastapi import WebSocket
from redis_manager import RedisManager


class WebSocketManager:
    """Manages WebSocket connections and Redis pub/sub integration."""
    
    def __init__(self, redis_manager: RedisManager):
        """
        Initialize WebSocket manager.
        
        Args:
            redis_manager: RedisManager instance for pub/sub
        """
        self.redis_manager = redis_manager
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.redis_listeners: Dict[str, asyncio.Task] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """
        Accept WebSocket connection and register for session updates.
        
        Args:
            websocket: WebSocket connection
            session_id: Session ID to monitor
        """
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        
        print(f"🔌 WebSocket connected for session: {session_id}")
        
        if session_id not in self.redis_listeners:
            await self._start_redis_listener(session_id)
        
        await self._send_initial_data(websocket, session_id)
    
    async def disconnect(self, websocket: WebSocket, session_id: str):
        """
        Remove WebSocket connection and cleanup if no connections remain.
        
        Args:
            websocket: WebSocket connection
            session_id: Session ID
        """
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            
            # If no more connections for this session, stop Redis listener
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                await self._stop_redis_listener(session_id)
        
        print(f"🔌 WebSocket disconnected for session: {session_id}")
    
    async def broadcast_to_session(self, session_id: str, message: Dict[str, Any]):
        """
        Broadcast message to all WebSocket connections for a session.
        (Public method - can be called from API endpoints)
        
        Args:
            session_id: Session ID
            message: Message to broadcast with structure:
                {
                    "action": "action_name",
                    "data": {...}
                }
        """
        await self._broadcast_to_session(session_id, message)
    
    async def _start_redis_listener(self, session_id: str):
        """Start Redis pub/sub listener for a session."""
        try:
            # Create callback function for this session
            async def redis_callback(sid: str, message: Dict[str, Any]):
                await self._broadcast_to_session(sid, message)
            
            # Start listening task
            task = asyncio.create_task(
                self.redis_manager.subscribe_to_session(session_id, redis_callback)
            )
            self.redis_listeners[session_id] = task
            
            print(f"📡 Started Redis listener for session: {session_id}")
            
        except Exception as e:
            print(f"❌ Failed to start Redis listener for session {session_id}: {e}")
    
    async def _stop_redis_listener(self, session_id: str):
        """Stop Redis pub/sub listener for a session."""
        if session_id in self.redis_listeners:
            task = self.redis_listeners[session_id]
            task.cancel()
            del self.redis_listeners[session_id]
            
            # Unregister callback
            self.redis_manager.unregister_websocket_callback(session_id)
            
            print(f"📡 Stopped Redis listener for session: {session_id}")
    
    async def _broadcast_to_session(self, session_id: str, message: Dict[str, Any]):
        """
        Broadcast message to all WebSocket connections for a session.
        (Private method - used internally)
        
        Args:
            session_id: Session ID
            message: Message to broadcast
        """
        if session_id not in self.active_connections:
            return
        
        # Format message according to specification
        websocket_message = {
            "action": message.get("action", "unknown"),
            "data": message.get("data", {})
        }
        
        message_text = json.dumps(websocket_message)
        disconnected_websockets = set()
        
        for websocket in self.active_connections[session_id]:
            try:
                await websocket.send_text(message_text)
            except Exception as e:
                print(f"❌ Failed to send message to WebSocket for session {session_id}: {e}")
                disconnected_websockets.add(websocket)
        
        # Remove disconnected WebSockets
        for websocket in disconnected_websockets:
            self.active_connections[session_id].discard(websocket)
    
    async def _send_initial_data(self, websocket: WebSocket, session_id: str):
        """
        Send existing session data to newly connected WebSocket.
        
        Args:
            websocket: WebSocket connection
            session_id: Session ID
        """
        try:
            # Get all existing data for this session
            session_data = await self._get_session_data(session_id)
            
            # Send each piece of data
            for action, data in session_data.items():
                message = {
                    "action": action,
                    "data": data
                }
                await websocket.send_text(json.dumps(message))
            
            print(f"📤 Sent initial data to WebSocket for session: {session_id}")
            
        except Exception as e:
            print(f"❌ Failed to send initial data for session {session_id}: {e}")
    
    async def _get_session_data(self, session_id: str) -> Dict[str, Any]:
        """
        Retrieve all existing data for a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            dict: All session data organized by action
        """
        session_data = {}
        
        # List of actions to check
        actions = [
            "workflow_status",
            "progress_update",
            "prompt_analysis", 
            "database_lookup",
            "followup_questions",
            "direct_profiles",
            "scorecard_results",
            "final_results",
            "scorecard",
            "conversation",
            "phase"
        ]
        
        for action in actions:
            try:
                key = f"{session_id}:{action}"
                data = self.redis_manager.redis_client.get(key)
                if data:
                    session_data[action] = json.loads(data)
            except Exception as e:
                print(f"Error retrieving {action} for session {session_id}: {e}")
        
        return session_data
    
    async def get_connection_count(self, session_id: str) -> int:
        """
        Get number of active WebSocket connections for a session.
        
        Args:
            session_id: Session ID
            
        Returns:
            int: Number of active connections
        """
        return len(self.active_connections.get(session_id, set()))
    
    async def get_all_connection_counts(self) -> Dict[str, int]:
        """
        Get connection counts for all active sessions.
        
        Returns:
            dict: Session ID to connection count mapping
        """
        return {
            session_id: len(connections) 
            for session_id, connections in self.active_connections.items()
        }