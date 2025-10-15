"""
Prompt persistence and management.
"""
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import MongoClient


class PromptManager:
    """Manages prompt persistence and linking with scorecards."""
    
    def __init__(self):
        # Use same database as scorecards
        db_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
        db_name = os.getenv("DATABASE_NAME", "neuraleap")
        client = MongoClient(db_url)
        self.db = client[db_name]
        self.prompts_collection = self.db["prompts"]
        
        # Setup indexes
        self._setup_indexes()
        print("✅ PromptManager initialized")
    
    def _setup_indexes(self):
        """Setup database indexes if they don't exist."""
        existing_indexes = self.prompts_collection.index_information()
        
        # Define required indexes
        indexes_to_create = [
            ("prompt_id_1", [("prompt_id", 1)], {"unique": True}),
            ("session_id_1", [("session_id", 1)], {}),
            ("username_1_created_at_-1", [("username", 1), ("created_at", -1)], {}),
            ("scorecard_id_1", [("scorecard_id", 1)], {}),
        ]
        
        for index_name, keys, options in indexes_to_create:
            if index_name not in existing_indexes:
                try:
                    self.prompts_collection.create_index(keys, **options)
                    print(f"✅ Created index: {index_name}")
                except Exception as e:
                    print(f"⚠️ Could not create index {index_name}: {e}")
            else:
                print(f"ℹ️ Index {index_name} already exists")
    
    def create_prompt(
        self,
        session_id: str,
        username: str,
        prompt_text: str,
        scorecard_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new prompt document."""
        prompt_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        prompt_doc = {
            "prompt_id": prompt_id,
            "session_id": session_id,
            "username": username,
            "prompt": prompt_text,
            "scorecard_id": scorecard_id,
            "status": "draft",
            "created_at": now,
            "updated_at": now
        }
        
        self.prompts_collection.insert_one(prompt_doc)
        
        # Remove MongoDB's _id for JSON serialization
        if "_id" in prompt_doc:
            del prompt_doc["_id"]
        
        return prompt_doc
    
    def link_scorecard(self, prompt_id: str, scorecard_id: str) -> bool:
        """Link a scorecard to a prompt."""
        result = self.prompts_collection.update_one(
            {"prompt_id": prompt_id},
            {
                "$set": {
                    "scorecard_id": scorecard_id,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        return result.modified_count > 0
    
    def update_status(self, prompt_id: str, status: str) -> bool:
        """Update prompt status."""
        result = self.prompts_collection.update_one(
            {"prompt_id": prompt_id},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        return result.modified_count > 0
    
    def get_prompt(self, prompt_id: str) -> Optional[Dict[str, Any]]:
        """Get prompt by ID."""
        prompt = self.prompts_collection.find_one({"prompt_id": prompt_id})
        if prompt and "_id" in prompt:
            del prompt["_id"]
        return prompt
    
    def get_prompt_by_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get prompt by session ID."""
        prompt = self.prompts_collection.find_one({"session_id": session_id})
        if prompt and "_id" in prompt:
            del prompt["_id"]
        return prompt

    def get_prompts_by_username(
        self, 
        username: str, 
        limit: int = 50, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get all prompts for a user (for history page).
        
        Args:
            username: Username to query
            limit: Number of results to return
            offset: Number of results to skip (for pagination)
            
        Returns:
            List of prompt documents, sorted by created_at descending
        """
        cursor = self.prompts_collection.find(
            {"username": username}
        ).sort("created_at", -1).skip(offset).limit(limit)
        
        prompts = []
        for prompt in cursor:
            if "_id" in prompt:
                del prompt["_id"]
            prompts.append(prompt)
        
        return prompts
    
    def count_prompts_by_username(self, username: str) -> int:
        """Count total prompts for a user."""
        return self.prompts_collection.count_documents({"username": username})
    
    def delete_prompt(self, prompt_id: str) -> bool:
        """
        Delete a prompt document.
        
        Args:
            prompt_id: Prompt ID to delete
            
        Returns:
            True if deleted, False if not found
        """
        result = self.prompts_collection.delete_one({"prompt_id": prompt_id})
        return result.deleted_count > 0
    
    def update_prompt_text(self, prompt_id: str, new_text: str) -> bool:
        """
        Update the prompt text (useful for editing history).
        
        Args:
            prompt_id: Prompt ID
            new_text: New prompt text
            
        Returns:
            True if updated successfully
        """
        result = self.prompts_collection.update_one(
            {"prompt_id": prompt_id},
            {
                "$set": {
                    "prompt": new_text,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        return result.modified_count > 0
    
    def add_prompt_to_user(self, username: str, prompt_id: str) -> bool:
        """
        Add prompt_id to user's prompts array.
        This should be called from your auth system after creating a prompt.
        
        Args:
            username: Username
            prompt_id: Prompt ID to add to user's array
            
        Returns:
            True if updated successfully
        """
        from pymongo import MongoClient

        # Connect to users collection (adjust if needed)
        users_collection = self.db["users"]
        
        result = users_collection.update_one(
            {"username": username},
            {
                "$addToSet": {"prompts": prompt_id},  # $addToSet prevents duplicates
                "$set": {"updated_at": datetime.utcnow().isoformat()}
            }
        )
        
        return result.modified_count > 0
    
    def get_prompt_with_scorecard(self, prompt_id: str) -> Optional[Dict[str, Any]]:
        """
        Get prompt with its linked scorecard data.
        Performs a join-like operation.
        
        Args:
            prompt_id: Prompt ID
            
        Returns:
            Dict with prompt and scorecard data, or None if not found
        """
        prompt = self.get_prompt(prompt_id)
        
        if not prompt:
            return None
        
        # If prompt has linked scorecard, fetch it
        if prompt.get("scorecard_id"):
            scorecards_collection = self.db["scorecards"]
            scorecard = scorecards_collection.find_one(
                {"scorecard_id": prompt["scorecard_id"]}
            )
            
            if scorecard and "_id" in scorecard:
                del scorecard["_id"]
            
            prompt["scorecard"] = scorecard
        
        return prompt
    
    def search_prompts(
        self, 
        username: str, 
        search_query: str, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search user's prompts by text.
        
        Args:
            username: Username to search within
            search_query: Text to search for
            limit: Max results
            
        Returns:
            List of matching prompts
        """
        cursor = self.prompts_collection.find({
            "username": username,
            "prompt": {"$regex": search_query, "$options": "i"}  # Case-insensitive search
        }).sort("created_at", -1).limit(limit)
        
        prompts = []
        for prompt in cursor:
            if "_id" in prompt:
                del prompt["_id"]
            prompts.append(prompt)
        
        return prompts
    
    def get_recent_prompts(self, username: str, days: int = 7) -> List[Dict[str, Any]]:
        """
        Get prompts created in the last N days.
        
        Args:
            username: Username
            days: Number of days to look back
            
        Returns:
            List of recent prompts
        """
        from datetime import timedelta
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        cutoff_iso = cutoff_date.isoformat()
        
        cursor = self.prompts_collection.find({
            "username": username,
            "created_at": {"$gte": cutoff_iso}
        }).sort("created_at", -1)
        
        prompts = []
        for prompt in cursor:
            if "_id" in prompt:
                del prompt["_id"]
            prompts.append(prompt)
        
        return prompts