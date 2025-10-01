"""
Hatch API integration service with MongoDB caching and Redis session storage.
"""
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from pymongo import MongoClient


class HatchService:
    """Service for interacting with Hatch API with intelligent caching."""
    
    def __init__(self, redis_manager):
        self.api_key = os.getenv("HATCH_API_KEY", "")
        self.base_url = "https://api.hatchhq.ai/v1"
        self.redis_manager = redis_manager
        
        # MongoDB connection
        self.mongo_client = MongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017/"))
        self.neuraleap_db = self.mongo_client["neuraleap"]
        self.candidates_collection = self.neuraleap_db["candidates"]
        
        # Create indexes for faster lookups
        self._create_indexes()
        
        if not self.api_key:
            print("⚠️ Warning: HATCH_API_KEY not set in environment variables")
    
    def _create_indexes(self):
        """Create MongoDB indexes for efficient queries."""
        try:
            # Index on profile_id for quick lookups
            self.candidates_collection.create_index("profile_id")
            # Compound index for profile_id and data type
            self.candidates_collection.create_index([("profile_id", 1), ("data_type", 1)])
        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")
    
    async def get_contact_info(
        self, 
        profile_id: str, 
        linkedin_url: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        domain: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get contact information (phone or email) for a candidate.
        Checks cache first, then hits Hatch API if needed.
        
        Priority: Phone Number > Email
        
        Args:
            profile_id: MongoDB ObjectId from profiles collection
            linkedin_url: LinkedIn profile URL (optional)
            first_name: First name for email search
            last_name: Last name for email search
            domain: Company domain for email search
            session_id: Session ID for Redis caching
            
        Returns:
            Dict with contact information and metadata
        """
        try:
            # Step 1: Check MongoDB cache
            cached_data = self._get_from_cache(profile_id)
            if cached_data:
                print(f"✅ Cache HIT for profile {profile_id}")
                
                # Store in Redis session if session_id provided
                if session_id:
                    await self._store_in_redis(session_id, profile_id, cached_data)
                
                return {
                    "success": True,
                    "profile_id": profile_id,
                    "phone": cached_data.get("phone"),
                    "email": cached_data.get("email"),
                    "source": "cache",
                    "cached_at": cached_data.get("updated_at")
                }
            
            print(f"❌ Cache MISS for profile {profile_id} - Calling Hatch API")
            
            # Step 2: Try to get phone number from Hatch API
            phone_result = await self._get_phone_from_hatch(linkedin_url)
            
            contact_data = {
                "profile_id": profile_id,
                "phone": phone_result.get("phone") if phone_result.get("success") else None,
                "email": None,
                "linkedin_url": linkedin_url,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Step 3: If phone failed, try to get email
            if not contact_data["phone"]:
                email_result = await self._get_email_from_hatch(
                    linkedin_url=linkedin_url,
                    first_name=first_name,
                    last_name=last_name,
                    domain=domain
                )
                contact_data["email"] = email_result.get("email") if email_result.get("success") else None
            
            # Step 4: Save to MongoDB cache (even if both failed)
            self._save_to_cache(contact_data)
            
            # Step 5: Store in Redis session if session_id provided
            if session_id:
                await self._store_in_redis(session_id, profile_id, contact_data)
            
            return {
                "success": bool(contact_data["phone"] or contact_data["email"]),
                "profile_id": profile_id,
                "phone": contact_data["phone"],
                "email": contact_data["email"],
                "source": "api",
                "message": self._get_result_message(contact_data)
            }
            
        except Exception as e:
            print(f"❌ Error getting contact info for {profile_id}: {str(e)}")
            return {
                "success": False,
                "profile_id": profile_id,
                "error": str(e)
            }
    
    async def get_bulk_contact_info(
        self,
        profiles: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get contact information for multiple profiles (max 5).
        
        Args:
            profiles: List of profile dicts with required fields
            session_id: Session ID for Redis caching
            
        Returns:
            List of contact information results
        """
        if len(profiles) > 5:
            raise ValueError("Maximum 5 profiles allowed per request")
        
        results = []
        for profile in profiles:
            result = await self.get_contact_info(
                profile_id=profile.get("profile_id") or profile.get("_id"),
                linkedin_url=profile.get("linkedin_url"),
                first_name=profile.get("first_name"),
                last_name=profile.get("last_name"),
                domain=profile.get("company_domain"),
                session_id=session_id
            )
            results.append(result)
        
        return results
    
    async def _get_phone_from_hatch(self, linkedin_url: Optional[str]) -> Dict[str, Any]:
        """Call Hatch API to get phone number."""
        if not linkedin_url:
            return {"success": False, "error": "LinkedIn URL required for phone lookup"}
        
        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json"
            }
            payload = {"linkedinUrl": linkedin_url}
            
            response = requests.post(
                f"{self.base_url}/findPhone",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return {"success": True, "phone": data.get("phone")}
            else:
                print(f"⚠️ Hatch phone API returned {response.status_code}: {response.text}")
                return {"success": False, "error": f"API returned {response.status_code}"}
                
        except Exception as e:
            print(f"❌ Error calling Hatch phone API: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _get_email_from_hatch(
        self,
        linkedin_url: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call Hatch API to get email address."""
        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json"
            }
            
            # Prefer LinkedIn URL if available
            if linkedin_url:
                payload = {"linkedinUrl": linkedin_url}
            elif first_name and last_name and domain:
                payload = {
                    "firstName": first_name,
                    "lastName": last_name,
                    "domain": domain
                }
            else:
                return {"success": False, "error": "Insufficient information for email lookup"}
            
            response = requests.post(
                f"{self.base_url}/findEmail",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return {"success": True, "email": data.get("email")}
            else:
                print(f"⚠️ Hatch email API returned {response.status_code}: {response.text}")
                return {"success": False, "error": f"API returned {response.status_code}"}
                
        except Exception as e:
            print(f"❌ Error calling Hatch email API: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def _get_from_cache(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Get contact information from MongoDB cache."""
        try:
            cached = self.candidates_collection.find_one({"profile_id": profile_id})
            return cached
        except Exception as e:
            print(f"Error reading from cache: {e}")
            return None
    
    def _save_to_cache(self, contact_data: Dict[str, Any]) -> bool:
        """Save contact information to MongoDB cache."""
        try:
            # Upsert: update if exists, insert if not
            self.candidates_collection.update_one(
                {"profile_id": contact_data["profile_id"]},
                {"$set": contact_data},
                upsert=True
            )
            print(f"✅ Saved to cache: {contact_data['profile_id']}")
            return True
        except Exception as e:
            print(f"Error saving to cache: {e}")
            return False
    
    async def _store_in_redis(
        self,
        session_id: str,
        profile_id: str,
        contact_data: Dict[str, Any]
    ) -> bool:
        """Store contact information in Redis session."""
        try:
            key = f"{session_id}:hatch_contact:{profile_id}"
            json_data = json.dumps(contact_data, default=str)
            self.redis_manager.redis_client.setex(
                key,
                3600,  # Expire after 1 hour
                json_data
            )
            print(f"✅ Stored in Redis: {key}")
            return True
        except Exception as e:
            print(f"Error storing in Redis: {e}")
            return False
    
    def _get_result_message(self, contact_data: Dict[str, Any]) -> str:
        """Generate a user-friendly message about the result."""
        if contact_data["phone"]:
            return "Phone number found"
        elif contact_data["email"]:
            return "Phone not found, email retrieved"
        else:
            return "No contact information found"   