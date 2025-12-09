"""
Hatch Email Finder Service
Finds candidate emails using Hatch API with MongoDB caching and Redis session storage.
"""
import json
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bson import ObjectId
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from core.config import Settings
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache

logger = get_logger(__name__)


class HatchService:
    """Service for finding candidate emails via Hatch API with intelligent caching."""
    
    def __init__(self, mongodb: MongoDB, redis_cache: RedisCache):
        self.settings = Settings()
        self.api_key = self.settings.HATCH_API_KEY
        self.base_url = "https://api.hatchhq.ai/v1"
        
        self.mongodb = mongodb
        self.redis_cache = redis_cache
        
        # Collections
        self.profiles_collection = mongodb.profiles_collection
        self.candidates_collection = mongodb.main_db["candidates"]
        
        # Create indexes
        self._create_indexes()
        
        # HTTP session with retry logic
        self.session = self._create_session()
        
        if not self.api_key:
            logger.warning("⚠️ HATCH_API_KEY not configured")
        else:
            logger.info(f"✅ HatchService initialized")
    
    def _create_indexes(self):
        """Create MongoDB indexes for efficient queries."""
        try:
            self.candidates_collection.create_index("profile_id", unique=True)
            logger.info("✅ HatchService indexes created")
        except Exception as e:
            logger.warning(f"Could not create indexes: {e}")
    
    def _create_session(self):
        """Create requests session with HTTP/1.1 and retry configuration."""
        session = requests.Session()
        adapter = HTTPAdapter(
            max_retries=Retry(total=0, connect=0, read=0, backoff_factor=0),
            pool_connections=1,
            pool_maxsize=1
        )
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        return session
    
    def _normalize_linkedin_url(self, linkedin_url: Optional[str]) -> Optional[str]:
        """
        Normalize LinkedIn URL to standard format.
        
        Examples:
        - /in/--vikash-kumar/ -> https://www.linkedin.com/in/vikash-kumar/
        - in/someone -> https://www.linkedin.com/in/someone/
        """
        if not linkedin_url:
            return None
        
        # Already complete URL
        if linkedin_url.startswith(('http://', 'https://')):
            linkedin_url = re.sub(r'/in/--+', '/in/', linkedin_url)
            linkedin_url = re.sub(r'--+/', '/', linkedin_url)
            return linkedin_url.rstrip('/') + '/'
        
        # Clean and build URL
        linkedin_url = linkedin_url.lstrip('/')
        linkedin_url = re.sub(r'in/--+', 'in/', linkedin_url)
        linkedin_url = re.sub(r'--+/', '/', linkedin_url)
        
        if not linkedin_url.startswith('in/'):
            linkedin_url = linkedin_url.replace('linkedin.com/in/', '').replace('www.linkedin.com/in/', '')
            linkedin_url = f'in/{linkedin_url}'
        
        return f'https://www.linkedin.com/{linkedin_url}' + ('/' if not linkedin_url.endswith('/') else '')
    
    async def find_email_by_profile_id(
        self,
        profile_id: str,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Find email for a candidate using their MongoDB profile _id.
        
        Flow:
        1. Get profile from profiles collection
        2. Check candidates collection cache
        3. If miss, call Hatch API
        4. Save to cache and Redis session
        
        Args:
            profile_id: MongoDB _id from profiles collection
            session_id: Optional session ID for Redis caching
            
        Returns:
            Dict with email and metadata
        """
        try:
            # Get profile
            profile = self.profiles_collection.find_one({"_id": ObjectId(profile_id)})
            
            if not profile:
                return {
                    "success": False,
                    "profile_id": profile_id,
                    "error": "Profile not found"
                }
            
            # Extract profile data
            first_name = profile.get("first_name", "")
            last_name = profile.get("last_name", "")
            raw_linkedin_url = profile.get("linkedin_url")
            linkedin_url = self._normalize_linkedin_url(raw_linkedin_url)
            
            # Get company domain from current experience
            company_domain = None
            experiences = profile.get("experience", [])
            if experiences:
                current_exp = next((e for e in experiences if e.get("current") == 1), None)
                if current_exp and current_exp.get("companyUrl_cleaned"):
                    company_domain = current_exp.get("companyUrl_cleaned")
            
            logger.info(f"📋 Finding email for: {first_name} {last_name} (ID: {profile_id})")
            
            # Check cache
            cached_data = self._get_from_cache(profile_id)
            
            if cached_data and cached_data.get("email"):
                logger.info(f"✅ Cache HIT for profile {profile_id}")
                
                if session_id:
                    await self._store_in_redis(session_id, profile_id, cached_data)
                
                return {
                    "success": True,
                    "profile_id": profile_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": cached_data.get("email"),
                    "source": "cache",
                    "cached_at": cached_data.get("updated_at")
                }
            
            logger.info(f"❌ Cache MISS for profile {profile_id} - Calling Hatch API")
            
            # Call Hatch API
            email_result = await self._get_email_from_hatch(
                linkedin_url=linkedin_url,
                first_name=first_name,
                last_name=last_name,
                domain=company_domain
            )
            
            # Prepare contact data
            contact_data = {
                "profile_id": profile_id,
                "first_name": first_name,
                "last_name": last_name,
                "email": email_result.get("email") if email_result.get("success") else None,
                "linkedin_url": linkedin_url,
                "company_domain": company_domain,
                "email_error": email_result.get("error") if not email_result.get("success") else None,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Save to cache
            self._save_to_cache(contact_data)
            
            # Store in Redis session
            if session_id:
                await self._store_in_redis(session_id, profile_id, contact_data)
            
            return {
                "success": bool(contact_data["email"]),
                "profile_id": profile_id,
                "first_name": first_name,
                "last_name": last_name,
                "email": contact_data["email"],
                "source": "api",
                "error": contact_data.get("email_error")
            }
            
        except Exception as e:
            logger.error(f"❌ Error finding email for {profile_id}: {str(e)}")
            return {
                "success": False,
                "profile_id": profile_id,
                "error": str(e)
            }
    
    async def find_bulk_emails(
        self,
        profile_ids: List[str],
        session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find emails for multiple profiles (max 5 to avoid rate limits)."""
        if len(profile_ids) > 5:
            raise ValueError("Maximum 5 profiles allowed per request")
        
        results = []
        for profile_id in profile_ids:
            result = await self.find_email_by_profile_id(profile_id, session_id)
            results.append(result)
            
            # Delay between requests
            if len(results) < len(profile_ids):
                time.sleep(2)
        
        return results
    
    async def _get_email_from_hatch(
        self,
        linkedin_url: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call Hatch API to get email with retry logic."""
        max_retries = 3
        retry_delay = 3
        
        for attempt in range(max_retries):
            try:
                headers = {
                    "x-api-key": self.api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Connection": "close",
                    "User-Agent": "Neuraleap/1.0"
                }
                
                # Prefer LinkedIn URL
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
                
                logger.info(f"   📧 Email lookup attempt {attempt + 1}/{max_retries}")
                
                response = self.session.post(
                    f"{self.base_url}/findEmail",
                    headers=headers,
                    json=payload,
                    timeout=60,
                    allow_redirects=False
                )
                
                if response.status_code == 200:
                    data = response.json()
                    email = data.get("email")
                    if email:
                        logger.info(f"   ✅ Email found: {email}")
                        return {"success": True, "email": email}
                    return {"success": False, "error": "No email in response"}
                        
                elif response.status_code == 429:
                    wait_time = retry_delay * (attempt + 1)
                    logger.warning(f"   ⚠️ Rate limit, waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                    
                elif response.status_code in [404, 400]:
                    error_msg = response.json().get("message", f"API error {response.status_code}")
                    logger.error(f"   ❌ Client error: {error_msg}")
                    return {"success": False, "error": error_msg}
                    
                else:
                    if attempt < max_retries - 1:
                        logger.warning(f"   ⚠️ Error {response.status_code}, retrying...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        error_msg = response.json().get("message", f"HTTP {response.status_code}")
                        return {"success": False, "error": error_msg}
                    
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return {"success": False, "error": "Timeout after retries"}
                    
            except requests.exceptions.ConnectionError:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return {"success": False, "error": "Connection failed"}
                    
            except Exception as e:
                return {"success": False, "error": str(e)[:100]}
        
        return {"success": False, "error": "Max retries exceeded"}
    
    def _get_from_cache(self, profile_id: str) -> Optional[Dict[str, Any]]:
        """Get email from candidates cache."""
        try:
            return self.candidates_collection.find_one({"profile_id": profile_id})
        except Exception as e:
            logger.error(f"Cache read error: {e}")
            return None
    
    def _save_to_cache(self, contact_data: Dict[str, Any]) -> bool:
        """Save email to candidates collection."""
        try:
            self.candidates_collection.update_one(
                {"profile_id": contact_data["profile_id"]},
                {"$set": contact_data},
                upsert=True
            )
            logger.info(f"✅ Cached: {contact_data['first_name']} {contact_data['last_name']}")
            return True
        except Exception as e:
            logger.error(f"Cache write error: {e}")
            return False
    
    async def _store_in_redis(
        self,
        session_id: str,
        profile_id: str,
        contact_data: Dict[str, Any]
    ) -> bool:
        """Store email in Redis session (1 hour TTL)."""
        try:
            key = f"{session_id}:hatch_email:{profile_id}"
            self.redis_cache.set(key, json.dumps(contact_data, default=str), ex=3600)
            return True
        except Exception as e:
            logger.error(f"Redis store error: {e}")
            return False