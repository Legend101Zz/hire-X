"""
Hatch API integration service with MongoDB caching and Redis session storage.
"""
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bson import ObjectId
from pymongo import MongoClient


class HatchService:
    """Service for interacting with Hatch API with intelligent caching."""
    
    def __init__(self, redis_manager):
        self.api_key = os.getenv("HATCH_API_KEY", "")
        self.base_url = "https://api.hatchhq.ai/v1"
        self.redis_manager = redis_manager
        
        # MongoDB connections
        self.mongo_client = MongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017/"))
        
        # mydatabase - where original profiles are stored
        self.mydatabase_db = self.mongo_client["mydatabase"]
        self.profiles_collection = self.mydatabase_db["profiles"]
        
        # neuraleap - where we cache Hatch API results
        self.neuraleap_db = self.mongo_client["neuraleap"]
        self.candidates_collection = self.neuraleap_db["candidates"]
        
        # Create indexes for faster lookups
        self._create_indexes()
        
        if not self.api_key:
            print("⚠️ Warning: HATCH_API_KEY not set in environment variables")
    
    def _create_indexes(self):
        """Create MongoDB indexes for efficient queries."""
        try:
            # Index on profile_id (which is the _id from mydatabase/profiles)
            self.candidates_collection.create_index("profile_id", unique=True)
        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")
    
    async def get_contact_info_by_profile_id(
        self, 
        profile_mongo_id: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get contact information for a candidate using their MongoDB _id from mydatabase/profiles.
        
        Flow:
        1. Get profile from mydatabase/profiles using the _id
        2. Check if neuraleap/candidates has cached contact info for this profile_id
        3. If yes, return from cache
        4. If no, call Hatch API and save to neuraleap/candidates
        
        Args:
            profile_mongo_id: MongoDB _id from mydatabase/profiles collection
            session_id: Session ID for Redis caching
            
        Returns:
            Dict with contact information and metadata
        """
        try:
            # Step 1: Get profile from mydatabase/profiles
            profile = self.profiles_collection.find_one({"_id": ObjectId(profile_mongo_id)})
            
            if not profile:
                return {
                    "success": False,
                    "profile_id": profile_mongo_id,
                    "error": "Profile not found in mydatabase/profiles"
                }
            
            # Extract profile data
            first_name = profile.get("first_name", "")
            last_name = profile.get("last_name", "")
            linkedin_url = profile.get("linkedin_url")
            
            # Get company domain from current experience if available
            company_domain = None
            experiences = profile.get("experience", [])
            if experiences and len(experiences) > 0:
                # Get the most recent/current company
                current_exp = next((exp for exp in experiences if exp.get("current") == 1), None)
                if current_exp and current_exp.get("companyUrl_cleaned"):
                    company_domain = current_exp.get("companyUrl_cleaned")
            
            print(f"📋 Profile found: {first_name} {last_name} (ID: {profile_mongo_id})")
            
            # Step 2: Check neuraleap/candidates cache
            cached_data = self._get_from_cache(profile_mongo_id)
            
            if cached_data:
                print(f"✅ Cache HIT for profile {profile_mongo_id}")
                
                # Store in Redis session if session_id provided
                if session_id:
                    await self._store_in_redis(session_id, profile_mongo_id, cached_data)
                
                return {
                    "success": True,
                    "profile_id": profile_mongo_id,
                    "first_name": cached_data.get("first_name"),
                    "last_name": cached_data.get("last_name"),
                    "phone": cached_data.get("phone"),
                    "email": cached_data.get("email"),
                    "source": "cache",
                    "cached_at": cached_data.get("updated_at")
                }
            
            print(f"❌ Cache MISS for profile {profile_mongo_id} - Calling Hatch API")
            
            # Step 3: Try to get phone number from Hatch API
            phone_result = await self._get_phone_from_hatch(linkedin_url)
            
            contact_data = {
                "profile_id": profile_mongo_id,  # This is the _id from mydatabase/profiles
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone_result.get("phone") if phone_result.get("success") else None,
                "email": None,
                "linkedin_url": linkedin_url,
                "company_domain": company_domain,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Step 4: If phone failed, try to get email
            if not contact_data["phone"]:
                email_result = await self._get_email_from_hatch(
                    linkedin_url=linkedin_url,
                    first_name=first_name,
                    last_name=last_name,
                    domain=company_domain
                )
                contact_data["email"] = email_result.get("email") if email_result.get("success") else None
            
            # Step 5: Save to neuraleap/candidates collection (even if both failed, to avoid re-trying)
            self._save_to_cache(contact_data)
            
            # Step 6: Store in Redis session if session_id provided
            if session_id:
                await self._store_in_redis(session_id, profile_mongo_id, contact_data)
            
            return {
                "success": bool(contact_data["phone"] or contact_data["email"]),
                "profile_id": profile_mongo_id,
                "first_name": first_name,
                "last_name": last_name,
                "phone": contact_data["phone"],
                "email": contact_data["email"],
                "source": "api",
                "message": self._get_result_message(contact_data)
            }
            
        except Exception as e:
            print(f"❌ Error getting contact info for {profile_mongo_id}: {str(e)}")
            return {
                "success": False,
                "profile_id": profile_mongo_id,
                "error": str(e)
            }
    
    async def get_bulk_contact_info(
        self,
        profile_ids: List[str],
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get contact information for multiple profiles (max 5).
        
        Args:
            profile_ids: List of MongoDB _ids from mydatabase/profiles (max 5)
            session_id: Session ID for Redis caching
            
        Returns:
            List of contact information results
        """
        if len(profile_ids) > 5:
            raise ValueError("Maximum 5 profiles allowed per request")
        
        results = []
        for profile_id in profile_ids:
            result = await self.get_contact_info_by_profile_id(
                profile_mongo_id=profile_id,
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
    
    def _get_from_cache(self, profile_mongo_id: str) -> Optional[Dict[str, Any]]:
        """
        Get contact information from neuraleap/candidates cache.
        
        Args:
            profile_mongo_id: The _id from mydatabase/profiles
        """
        try:
            # Query using profile_id field which stores the _id from mydatabase/profiles
            cached = self.candidates_collection.find_one({"profile_id": profile_mongo_id})
            return cached
        except Exception as e:
            print(f"Error reading from cache: {e}")
            return None
    
    def _save_to_cache(self, contact_data: Dict[str, Any]) -> bool:
        """
        Save contact information to neuraleap/candidates collection.
        
        The contact_data should contain:
        - profile_id: MongoDB _id from mydatabase/profiles
        - first_name: Person's first name
        - last_name: Person's last name
        - phone: Phone number from Hatch API (or None)
        - email: Email from Hatch API (or None)
        - linkedin_url: LinkedIn profile URL
        - created_at: When first saved
        - updated_at: When last updated
        """
        try:
            # Upsert: update if exists, insert if not
            # Use profile_id as unique identifier
            self.candidates_collection.update_one(
                {"profile_id": contact_data["profile_id"]},
                {"$set": contact_data},
                upsert=True
            )
            print(f"✅ Saved to neuraleap/candidates: {contact_data['first_name']} {contact_data['last_name']} (ID: {contact_data['profile_id']})")
            return True
        except Exception as e:
            print(f"Error saving to cache: {e}")
            return False
    
    async def _store_in_redis(
        self,
        session_id: str,
        profile_mongo_id: str,
        contact_data: Dict[str, Any]
    ) -> bool:
        """Store contact information in Redis session (temporary cache)."""
        try:
            key = f"{session_id}:hatch_contact:{profile_mongo_id}"
            json_data = json.dumps(contact_data, default=str)
            self.redis_manager.redis_client.setex(
                key,
                3600,  # Expire after 1 hour
                json_data
            )
            print(f"✅ Stored in Redis session: {key}")
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