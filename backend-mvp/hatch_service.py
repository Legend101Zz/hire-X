"""
Hatch API integration service with MongoDB caching and Redis session storage.
"""
import json
import os
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bson import ObjectId
from pymongo import MongoClient
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


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
        
        # Create a session with HTTP/1.1 and proper connection handling
        self.session = self._create_session()
        
        if not self.api_key:
            print("⚠️ Warning: HATCH_API_KEY not set in environment variables")
        else:
            print(f"✅ Hatch API Key configured (length: {len(self.api_key)})")
    
    def _create_indexes(self):
        """Create MongoDB indexes for efficient queries."""
        try:
            # Index on profile_id (which is the _id from mydatabase/profiles)
            self.candidates_collection.create_index("profile_id", unique=True)
        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")
    
    def _create_session(self):
        """
        Create a requests session with proper configuration.
        Forces HTTP/1.1 and handles connection issues.
        """
        session = requests.Session()
        
        # Force HTTP/1.1 by disabling HTTP/2
        # This is done by configuring the adapter
        adapter = HTTPAdapter(
            max_retries=Retry(
                total=0,  # We'll handle retries manually
                connect=0,
                read=0,
                backoff_factor=0
            ),
            pool_connections=1,
            pool_maxsize=1
        )
        
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        
        return session
    
    def _normalize_linkedin_url(self, linkedin_url: Optional[str]) -> Optional[str]:
        """
        Normalize LinkedIn URL to proper format.
        
        Handles formats like:
        - /in/--vikash-kumar/ -> https://www.linkedin.com/in/vikash-kumar/
        - /in/--deepsengupta--/ -> https://www.linkedin.com/in/deepsengupta/
        - https://www.linkedin.com/in/someone/ -> https://www.linkedin.com/in/someone/
        - in/someone -> https://www.linkedin.com/in/someone/
        
        Args:
            linkedin_url: LinkedIn URL in any format
            
        Returns:
            Normalized LinkedIn URL or None if invalid
        """
        if not linkedin_url:
            return None
        
        # If already a complete URL, clean and return
        if linkedin_url.startswith('http://') or linkedin_url.startswith('https://'):
            # Remove leading/trailing dashes from the username part
            linkedin_url = re.sub(r'/in/--+', '/in/', linkedin_url)
            linkedin_url = re.sub(r'--+/', '/', linkedin_url)
            return linkedin_url.rstrip('/') + '/'
        
        # Remove any leading slashes
        linkedin_url = linkedin_url.lstrip('/')
        
        # Remove leading/trailing dashes from username
        linkedin_url = re.sub(r'in/--+', 'in/', linkedin_url)
        linkedin_url = re.sub(r'--+/', '/', linkedin_url)
        
        # Ensure it starts with 'in/'
        if not linkedin_url.startswith('in/'):
            if linkedin_url.startswith('linkedin.com/in/'):
                linkedin_url = linkedin_url.replace('linkedin.com/in/', 'in/')
            elif linkedin_url.startswith('www.linkedin.com/in/'):
                linkedin_url = linkedin_url.replace('www.linkedin.com/in/', 'in/')
            else:
                # Assume it's just a username
                linkedin_url = f'in/{linkedin_url}'
        
        # Build full URL
        full_url = f'https://www.linkedin.com/{linkedin_url}'
        
        # Ensure it ends with /
        if not full_url.endswith('/'):
            full_url += '/'
        
        return full_url
    
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
            raw_linkedin_url = profile.get("linkedin_url")
            
            # Normalize LinkedIn URL
            linkedin_url = self._normalize_linkedin_url(raw_linkedin_url)
            
            if raw_linkedin_url and not linkedin_url:
                print(f"⚠️ Could not normalize LinkedIn URL: {raw_linkedin_url}")
            elif raw_linkedin_url != linkedin_url:
                print(f"🔄 Normalized LinkedIn URL: {raw_linkedin_url} -> {linkedin_url}")
            
            # Get company domain from current experience if available
            company_domain = None
            experiences = profile.get("experience", [])
            if experiences and len(experiences) > 0:
                # Get the most recent/current company
                current_exp = next((exp for exp in experiences if exp.get("current") == 1), None)
                if current_exp and current_exp.get("companyUrl_cleaned"):
                    company_domain = current_exp.get("companyUrl_cleaned")
            
            print(f"📋 Profile found: {first_name} {last_name} (ID: {profile_mongo_id})")
            print(f"   LinkedIn: {linkedin_url}")
            
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
                "profile_id": profile_mongo_id,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone_result.get("phone") if phone_result.get("success") else None,
                "email": None,
                "linkedin_url": linkedin_url,
                "company_domain": company_domain,
                "phone_error": phone_result.get("error") if not phone_result.get("success") else None,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Step 4: If phone failed, try to get email
            if not contact_data["phone"]:
                print(f"📧 Phone lookup failed, trying email...")
                email_result = await self._get_email_from_hatch(
                    linkedin_url=linkedin_url,
                    first_name=first_name,
                    last_name=last_name,
                    domain=company_domain
                )
                contact_data["email"] = email_result.get("email") if email_result.get("success") else None
                contact_data["email_error"] = email_result.get("error") if not email_result.get("success") else None
            
            # Step 5: Save to neuraleap/candidates collection
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
                "message": self._get_result_message(contact_data),
                "errors": {
                    "phone": contact_data.get("phone_error"),
                    "email": contact_data.get("email_error")
                } if (contact_data.get("phone_error") or contact_data.get("email_error")) else None
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
        """Get contact information for multiple profiles (max 5)."""
        if len(profile_ids) > 5:
            raise ValueError("Maximum 5 profiles allowed per request")
        
        results = []
        for profile_id in profile_ids:
            result = await self.get_contact_info_by_profile_id(
                profile_mongo_id=profile_id,
                session_id=session_id
            )
            results.append(result)
            
            # Add delay between requests to avoid rate limiting
            if len(results) < len(profile_ids):
                time.sleep(2)
        
        return results
    
    async def _get_phone_from_hatch(self, linkedin_url: Optional[str]) -> Dict[str, Any]:
        """Call Hatch API to get phone number with retry logic and HTTP/1.1."""
        if not linkedin_url:
            return {"success": False, "error": "LinkedIn URL required for phone lookup"}
        
        max_retries = 3
        retry_delay = 3
        
        for attempt in range(max_retries):
            try:
                headers = {
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Connection": "close",  # Force connection close to avoid HTTP/2 issues
                    "User-Agent": "Neuraleap/1.0 (Python-requests)"
                }
                
                payload = {"linkedinUrl": linkedin_url}
                
                print(f"   🔍 Phone lookup attempt {attempt + 1}/{max_retries}")
                print(f"      URL: {self.base_url}/findPhone")
                print(f"      LinkedIn: {linkedin_url}")
                
                # Use the session with HTTP/1.1 forced
                response = self.session.post(
                    f"{self.base_url}/findPhone",
                    headers=headers,
                    json=payload,
                    timeout=60,  # Increased to 60 seconds
                    allow_redirects=False
                )
                
                print(f"      Response Status: {response.status_code}")
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        phone = data.get("phone")
                        if phone:
                            print(f"   ✅ Phone found: {phone}")
                            return {"success": True, "phone": phone}
                        else:
                            print(f"   ⚠️ No phone in response")
                            return {"success": False, "error": "No phone number in response"}
                    except json.JSONDecodeError as e:
                        print(f"   ⚠️ Invalid JSON response: {response.text[:100]}")
                        return {"success": False, "error": "Invalid JSON response"}
                        
                elif response.status_code == 429:
                    wait_time = retry_delay * (attempt + 1)
                    print(f"   ⚠️ Rate limit (429), waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                    
                elif response.status_code in [404, 400]:
                    # Don't retry for client errors
                    error_msg = f"API error {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", error_data.get("error", error_msg))
                    except:
                        error_msg = response.text[:100] if response.text else error_msg
                    print(f"   ❌ Client error: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
                else:
                    error_msg = f"HTTP {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", error_msg)
                    except:
                        error_msg = response.text[:100] if response.text else error_msg
                    
                    print(f"   ⚠️ Server error: {error_msg}")
                    
                    if attempt < max_retries - 1:
                        print(f"   Retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        return {"success": False, "error": error_msg}
                    
            except requests.exceptions.Timeout:
                print(f"   ⏱️ Timeout on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    print(f"   Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return {"success": False, "error": f"Timeout after {max_retries} attempts"}
                    
            except requests.exceptions.ConnectionError as e:
                error_str = str(e)
                print(f"   🔌 Connection error: {error_str[:100]}")
                if attempt < max_retries - 1:
                    print(f"   Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return {"success": False, "error": f"Connection failed: {error_str[:100]}"}
                    
            except Exception as e:
                print(f"   ❌ Unexpected error: {str(e)[:100]}")
                return {"success": False, "error": str(e)[:100]}
        
        return {"success": False, "error": "Max retries exceeded"}
    
    async def _get_email_from_hatch(
        self,
        linkedin_url: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call Hatch API to get email with retry logic and HTTP/1.1."""
        max_retries = 3
        retry_delay = 3
        
        for attempt in range(max_retries):
            try:
                headers = {
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Connection": "close",
                    "User-Agent": "Neuraleap/1.0 (Python-requests)"
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
                
                print(f"   📧 Email lookup attempt {attempt + 1}/{max_retries}")
                
                response = self.session.post(
                    f"{self.base_url}/findEmail",
                    headers=headers,
                    json=payload,
                    timeout=60,
                    allow_redirects=False
                )
                
                print(f"      Response Status: {response.status_code}")
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        email = data.get("email")
                        if email:
                            print(f"   ✅ Email found: {email}")
                            return {"success": True, "email": email}
                        else:
                            print(f"   ⚠️ No email in response")
                            return {"success": False, "error": "No email in response"}
                    except json.JSONDecodeError:
                        print(f"   ⚠️ Invalid JSON response")
                        return {"success": False, "error": "Invalid JSON response"}
                        
                elif response.status_code == 429:
                    wait_time = retry_delay * (attempt + 1)
                    print(f"   ⚠️ Rate limit (429), waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                    
                elif response.status_code in [404, 400]:
                    error_msg = f"API error {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("message", error_data.get("error", error_msg))
                    except:
                        pass
                    print(f"   ❌ Client error: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
                else:
                    if attempt < max_retries - 1:
                        print(f"   ⚠️ Error {response.status_code}, retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        error_msg = f"HTTP {response.status_code}"
                        try:
                            error_data = response.json()
                            error_msg = error_data.get("message", error_msg)
                        except:
                            pass
                        return {"success": False, "error": error_msg}
                    
            except requests.exceptions.Timeout:
                print(f"   ⏱️ Timeout on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return {"success": False, "error": "Timeout after retries"}
                    
            except requests.exceptions.ConnectionError as e:
                print(f"   🔌 Connection error")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return {"success": False, "error": "Connection failed"}
                    
            except Exception as e:
                print(f"   ❌ Unexpected error: {str(e)[:100]}")
                return {"success": False, "error": str(e)[:100]}
        
        return {"success": False, "error": "Max retries exceeded"}
    
    def _get_from_cache(self, profile_mongo_id: str) -> Optional[Dict[str, Any]]:
        """Get contact information from neuraleap/candidates cache."""
        try:
            cached = self.candidates_collection.find_one({"profile_id": profile_mongo_id})
            return cached
        except Exception as e:
            print(f"Error reading from cache: {e}")
            return None
    
    def _save_to_cache(self, contact_data: Dict[str, Any]) -> bool:
        """Save contact information to neuraleap/candidates collection."""
        try:
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
                3600,
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