"""
LinkedIn Scraper Service - Brightdata Integration
=================================================
Scrapes LinkedIn profiles using Brightdata's Web Scraper API.

Features:
- Profile scraping by URL
- Profile discovery by name
- Intelligent caching to avoid duplicate scrapes
- Rate limiting and error handling
"""

import asyncio
import hashlib
import json
import re
from datetime import datetime
from typing import Dict, List, Optional

import httpx

from core.config import settings
from core.logging_config import get_logger
from data.redis_cache import RedisCache

logger = get_logger(__name__)


class LinkedInScraperService:
    """
    Scrapes LinkedIn profiles using Brightdata's API.
    
    Supports two modes:
    1. Direct URL scraping - When we have the LinkedIn profile URL
    2. Name-based discovery - When we only have name (searches our DB first)
    
    Caching Strategy:
    - Cache scraped profiles for 7 days
    - Cache key: linkedin_profile:{linkedin_id}
    """
    
    # Brightdata API endpoints
    BRIGHTDATA_API_BASE = "https://api.brightdata.com/datasets/v3"
    
    # Dataset IDs for different LinkedIn scrapers
    DATASET_IDS = {
        "profile": "gd_l1viktl72bvl7bjuj0",  # LinkedIn Profile Collector
        "posts": "gd_lyy3tktm25m4avu764",    # LinkedIn Posts Collector
        "company": "gd_l1viktl72bvl7bjv10",  # LinkedIn Company Collector
    }
    
    # Cache TTL (7 days)
    CACHE_TTL = 7 * 24 * 60 * 60
    
    def __init__(self, redis_cache: RedisCache):
        """
        Initialize LinkedIn scraper.
        
        Args:
            redis_cache: Redis cache for storing scraped profiles
        """
        self.redis = redis_cache
        self.api_token = getattr(settings, 'BRIGHTDATA_API_TOKEN', None)
        
        if not self.api_token:
            logger.warning("BRIGHTDATA_API_TOKEN not set - LinkedIn scraping will fail")
        
        logger.info("LinkedInScraperService initialized")
    
    async def scrape_profile(
        self,
        linkedin_url: str,
        force_refresh: bool = False
    ) -> Dict:
        """
        Scrape a LinkedIn profile by URL.
        
        Args:
            linkedin_url: Full LinkedIn profile URL
            force_refresh: Skip cache and force new scrape
            
        Returns:
            Normalized profile data dict
            
        Example:
            profile = await scraper.scrape_profile(
                "https://www.linkedin.com/in/johndoe"
            )
        """
        
        # Normalize URL
        linkedin_url = self._normalize_linkedin_url(linkedin_url)
        
        if not linkedin_url:
            return {"error": "Invalid LinkedIn URL"}
        
        # Extract profile identifier for cache key
        profile_id = self._extract_profile_id(linkedin_url)
        cache_key = f"linkedin_profile:{profile_id}"
        
        # Check cache first
        if not force_refresh:
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info(f"Cache hit for LinkedIn profile: {profile_id}")
                cached_data = json.loads(cached)
                cached_data["_cached"] = True
                return cached_data
        
        # Scrape from Brightdata
        logger.info(f"Scraping LinkedIn profile: {linkedin_url}")
        
        try:
            raw_profile = await self._call_brightdata_api(
                dataset_id=self.DATASET_IDS["profile"],
                inputs=[{"url": linkedin_url}]
            )
            
            if not raw_profile or "error" in raw_profile:
                return {"error": raw_profile.get("error", "Failed to scrape profile")}
            
            # Normalize the profile data
            normalized = self._normalize_profile_data(raw_profile)
            normalized["_scraped_at"] = datetime.utcnow().isoformat()
            normalized["_source"] = "brightdata"
            
            # Cache the result
            await self.redis.set(
                cache_key,
                json.dumps(normalized),
                ex=self.CACHE_TTL
            )
            
            logger.info(f"Successfully scraped and cached profile: {profile_id}")
            return normalized
            
        except Exception as e:
            logger.error(f"Error scraping LinkedIn profile: {e}")
            return {"error": str(e)}
    
    async def scrape_profile_posts(
        self,
        linkedin_url: str,
        max_posts: int = 10
    ) -> List[Dict]:
        """
        Scrape recent posts from a LinkedIn profile.
        
        Args:
            linkedin_url: LinkedIn profile URL
            max_posts: Maximum number of posts to retrieve
            
        Returns:
            List of post data dicts
        """
        
        linkedin_url = self._normalize_linkedin_url(linkedin_url)
        profile_id = self._extract_profile_id(linkedin_url)
        
        # Check cache
        cache_key = f"linkedin_posts:{profile_id}"
        cached = await self.redis.get(cache_key)
        
        if cached:
            return json.loads(cached)
        
        try:
            posts = await self._call_brightdata_api(
                dataset_id=self.DATASET_IDS["posts"],
                inputs=[{"url": linkedin_url}]
            )
            
            if isinstance(posts, list):
                posts = posts[:max_posts]
                await self.redis.set(
                    cache_key,
                    json.dumps(posts),
                    ex=self.CACHE_TTL
                )
            
            return posts or []
            
        except Exception as e:
            logger.error(f"Error scraping posts: {e}")
            return []
    
    async def _call_brightdata_api(
        self,
        dataset_id: str,
        inputs: List[Dict],
        timeout: int = 60
    ) -> Dict:
        """
        Make a synchronous call to Brightdata API.
        
        Uses the synchronous endpoint for immediate results.
        """
        
        if not self.api_token:
            return {"error": "Brightdata API token not configured"}
        
        url = f"{self.BRIGHTDATA_API_BASE}/trigger"
        
        params = {
            "dataset_id": dataset_id,
            "format": "json",
            "uncompressed_webhook": "true",
            "type": "discover_new",  # Synchronous
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(
                    url,
                    params=params,
                    headers=headers,
                    json=inputs
                )
                
                response.raise_for_status()
                data = response.json()
                
                # Brightdata returns a list for batch requests
                if isinstance(data, list) and len(data) > 0:
                    return data[0]
                
                return data
                
            except httpx.TimeoutException:
                logger.error("Brightdata API timeout")
                return {"error": "API timeout - profile may be private or unavailable"}
            
            except httpx.HTTPStatusError as e:
                logger.error(f"Brightdata API error: {e.response.status_code}")
                return {"error": f"API error: {e.response.status_code}"}
            
            except Exception as e:
                logger.error(f"Brightdata API exception: {e}")
                return {"error": str(e)}
    
    def _normalize_linkedin_url(self, url: str) -> Optional[str]:
        """
        Normalize LinkedIn URL to standard format.
        
        Handles various formats:
        - https://www.linkedin.com/in/username
        - https://linkedin.com/in/username/
        - www.linkedin.com/in/username
        - linkedin.com/in/username
        - /in/username
        """
        
        if not url:
            return None
        
        url = url.strip().lower()
        
        # Handle relative paths (e.g., "/in/username")
        if linkedin_url.startswith("/"):
            linkedin_url = "https://www.linkedin.com" + linkedin_url
        
        # Add protocol if missing
        if not url.startswith("http"):
            url = "https://" + url
        
        # Ensure www subdomain
        if "://linkedin.com" in url:
            url = url.replace("://linkedin.com", "://www.linkedin.com")
        
        # Validate format
        pattern = r'https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9\-_]+/?'
        if not re.match(pattern, url, re.IGNORECASE):
            return None
        
        # Remove trailing slash
        return url.rstrip("/")
    
    def _extract_profile_id(self, url: str) -> str:
        """Extract username from LinkedIn URL."""
        
        match = re.search(r'/in/([a-zA-Z0-9\-_]+)', url)
        if match:
            return match.group(1).lower()
        
        # Fallback to hash
        return hashlib.md5(url.encode()).hexdigest()[:12]
    
    def _normalize_profile_data(self, raw_data: Dict) -> Dict:
        """
        Normalize Brightdata profile data to our internal format.
        
        Maps Brightdata fields to our candidate structure.
        """
        
        # Handle case where data is in a list
        if isinstance(raw_data, list) and len(raw_data) > 0:
            raw_data = raw_data[0]
        
        # Extract experience
        experience = []
        for exp in raw_data.get("experience", []):
            experience.append({
                "title": exp.get("title", ""),
                "company": exp.get("company", {}).get("name", exp.get("company_name", "")),
                "location": exp.get("location", ""),
                "start_date": exp.get("start_date", ""),
                "end_date": exp.get("end_date"),
                "description": exp.get("description", ""),
                "duration_months": self._calculate_duration_months(
                    exp.get("start_date"),
                    exp.get("end_date")
                )
            })
        
        # Extract education
        education = []
        for edu in raw_data.get("education", raw_data.get("educations_details", [])):
            education.append({
                "school": edu.get("school", edu.get("school_name", "")),
                "degree": edu.get("degree", ""),
                "field_of_study": edu.get("field_of_study", ""),
                "start_year": edu.get("start_date", ""),
                "end_year": edu.get("end_date", "")
            })
        
        # Extract skills
        skills = raw_data.get("skills", [])
        if isinstance(skills, list) and len(skills) > 0:
            if isinstance(skills[0], dict):
                skills = [s.get("name", str(s)) for s in skills]
        
        # Build normalized profile
        normalized = {
            "linkedin_id": raw_data.get("linkedin_id", raw_data.get("id", "")),
            "linkedin_url": raw_data.get("url", raw_data.get("input_url", "")),
            "first_name": raw_data.get("first_name", raw_data.get("name", "").split()[0] if raw_data.get("name") else ""),
            "last_name": raw_data.get("last_name", " ".join(raw_data.get("name", "").split()[1:]) if raw_data.get("name") else ""),
            "full_name": raw_data.get("name", f"{raw_data.get('first_name', '')} {raw_data.get('last_name', '')}".strip()),
            "headline": raw_data.get("headline", raw_data.get("position", "")),
            "title": raw_data.get("position", raw_data.get("headline", "")),
            "location": raw_data.get("city", "") or raw_data.get("location", ""),
            "country": raw_data.get("country_code", ""),
            "summary": raw_data.get("about", raw_data.get("summary", "")),
            "current_company": raw_data.get("current_company_name", raw_data.get("current_company", "")),
            "current_company_id": raw_data.get("current_company_company_id", ""),
            "industry": raw_data.get("industry", ""),
            
            # Lists
            "experience": experience,
            "education": education,
            "skills": skills,
            "certifications": raw_data.get("certifications", []),
            "languages": raw_data.get("languages", []),
            
            # Social metrics
            "followers": raw_data.get("followers", 0),
            "connections": raw_data.get("connections", 0),
            "recommendations_count": raw_data.get("recommendations_count", 0),
            
            # Activity
            "posts": raw_data.get("posts", []),
            "activity": raw_data.get("activity", []),
        
            
            # Metadata
            "profile_updated": raw_data.get("timestamp", datetime.utcnow().isoformat())
        }
        
        # Calculate total experience
        normalized["total_experience_years"] = self._calculate_total_experience(experience)
        
        # Extract expertise string for compatibility
        normalized["expertise"] = ", ".join(skills[:20]) if skills else ""
        
        return normalized
    
    def _calculate_duration_months(self, start: str, end: Optional[str]) -> int:
        """Calculate duration in months between two dates."""
        
        if not start:
            return 0
        
        try:
            # Parse start date
            if isinstance(start, str):
                start_parts = start.split("-")
                start_year = int(start_parts[0]) if len(start_parts) > 0 else 0
                start_month = int(start_parts[1]) if len(start_parts) > 1 else 1
            else:
                return 0
            
            # Parse end date
            if end and isinstance(end, str):
                end_parts = end.split("-")
                end_year = int(end_parts[0]) if len(end_parts) > 0 else datetime.now().year
                end_month = int(end_parts[1]) if len(end_parts) > 1 else datetime.now().month
            else:
                end_year = datetime.now().year
                end_month = datetime.now().month
            
            return (end_year - start_year) * 12 + (end_month - start_month)
            
        except Exception:
            return 0
    
    def _calculate_total_experience(self, experience: List[Dict]) -> float:
        """Calculate total years of experience."""
        
        total_months = sum(exp.get("duration_months", 0) for exp in experience)
        return round(total_months / 12, 1)