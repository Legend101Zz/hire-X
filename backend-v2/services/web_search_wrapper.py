"""
Web Search Wrapper Service
==========================
Unified interface for LLM-powered web search.

This service:
- Uses configured models (Perplexity Sonar, DeepSeek, etc.)
- Caches results to prevent duplicate searches
- Handles rate limiting
- Provides clean API for other services

Usage:
    wrapper = WebSearchWrapper(redis, model_config_manager)
    results = await wrapper.search(
        "salary range for Senior Python Developer in Mumbai 2024"
    )
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

from core.config import settings
from core.logging_config import get_logger
from data.redis_cache import RedisCache
from services.model_config_manager import ModelConfigManager

logger = get_logger(__name__)


class WebSearchWrapper:
    """
    Unified web search interface using LLM models.
    
    Features:
    - Automatic model selection based on user config
    - Response caching (7 days)
    - Rate limiting
    - Clean, consistent API
    """
    
    # Cache TTL for search results
    CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days
    
    # Rate limiting
    MAX_REQUESTS_PER_MINUTE = 60
    
    def __init__(
        self,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize web search wrapper.
        
        Args:
            redis_cache: Redis cache for storing search results
            model_config_manager: For getting configured search model
        """
        self.redis = redis_cache
        self.model_manager = model_config_manager
        self.openrouter_api_key = settings.OPENROUTER_API_KEY
        
        if not self.openrouter_api_key:
            logger.warning("OPENROUTER_API_KEY not set - web search will fail")
        
        logger.info("WebSearchWrapper initialized")
    
    async def search(
        self,
        query: str,
        session_id: Optional[str] = None,
        force_refresh: bool = False
    ) -> Dict:
        """
        Perform web search using configured LLM model.
        
        Args:
            query: Search query
            session_id: Optional session ID for using session-specific model config
            force_refresh: Skip cache and force new search
            
        Returns:
            {
                "query": "...",
                "answer": "Main answer from search",
                "sources": ["url1", "url2", ...],
                "cached": True/False,
                "model_used": "perplexity/sonar-pro",
                "timestamp": "2025-01-15T10:30:00Z"
            }
        
        Example:
            result = await wrapper.search(
                "What is the average salary for Senior Python Developer in Mumbai 2024?"
            )
            print(result['answer'])
            print(result['sources'])
        """
        
        # Check cache first (unless force_refresh)
        if not force_refresh:
            cached_result = await self._get_cached_search(query)
            if cached_result:
                logger.debug(f"Cache hit for query: {query[:50]}...")
                return cached_result
        
        # Get configured model for this session
        model = await self.model_manager.get_model_for_task(
            "web_search",
            session_id=session_id
        )
        
        logger.info(f"Performing web search with {model}: {query[:50]}...")
        
        try:
            # Call OpenRouter API with the configured model
            result = await self._call_search_api(query, model)
            
            # Add metadata
            result["query"] = query
            result["cached"] = False
            result["model_used"] = model
            result["timestamp"] = datetime.utcnow().isoformat()
            
            # Cache the result
            await self._cache_search_result(query, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            
            # Return empty result instead of crashing
            return {
                "query": query,
                "answer": "Search failed - could not retrieve information",
                "sources": [],
                "cached": False,
                "model_used": model,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def search_multiple(
        self,
        queries: List[str],
        session_id: Optional[str] = None
    ) -> List[Dict]:
        """
        Perform multiple searches in parallel.
        
        Args:
            queries: List of search queries
            session_id: Optional session ID
            
        Returns:
            List of search results
        
        Example:
            results = await wrapper.search_multiple([
                "salary for Python dev in Mumbai",
                "notice period for IT companies in India",
                "average tenure at tech startups"
            ])
        """
        import asyncio
        
        tasks = [
            self.search(query, session_id=session_id)
            for query in queries
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to error results
        clean_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                clean_results.append({
                    "query": queries[i],
                    "answer": f"Search failed: {str(result)}",
                    "sources": [],
                    "cached": False,
                    "error": str(result)
                })
            else:
                clean_results.append(result)
        
        return clean_results
    
    async def _call_search_api(
        self,
        query: str,
        model: str
    ) -> Dict:
        """
        Call OpenRouter API for web search.
        
        Args:
            query: Search query
            model: Model to use (e.g., "perplexity/sonar-pro")
            
        Returns:
            {
                "answer": "Main answer",
                "sources": ["url1", "url2", ...]
            }
        """
        
        # Perplexity models are optimized for search
        # They return citations automatically
        
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://neuraleap.shop",
            "X-Title": "NeuraLeap"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": query
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.3,  # Lower temperature for factual search
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Extract answer
            answer = data["choices"][0]["message"]["content"]
            
            # Extract sources (if available in response)
            sources = self._extract_sources(answer, data)
            
            return {
                "answer": answer,
                "sources": sources
            }
    
    def _extract_sources(self, answer: str, api_response: Dict) -> List[str]:
        """
        Extract source URLs from search response.
        
        Perplexity includes citations in the text like [1], [2], etc.
        and provides sources in the response.
        
        Args:
            answer: Answer text
            api_response: Full API response
            
        Returns:
            List of source URLs
        """
        sources = []
        
        # Check if sources are in the response metadata
        # (Perplexity includes this for some models)
        if "sources" in api_response:
            sources = api_response["sources"]
        
        # Also try to extract URLs from the answer text
        import re
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        found_urls = re.findall(url_pattern, answer)
        
        # Combine and deduplicate
        all_sources = list(set(sources + found_urls))
        
        return all_sources[:10]  # Limit to top 10 sources
    
    async def _get_cached_search(self, query: str) -> Optional[Dict]:
        """
        Get cached search result if exists.
        
        Args:
            query: Search query
            
        Returns:
            Cached result or None
        """
        cache_key = self._get_cache_key(query)
        
        cached_data = await self.redis.redis.get(cache_key)
        
        if cached_data:
            result = json.loads(cached_data)
            result["cached"] = True
            return result
        
        return None
    
    async def _cache_search_result(self, query: str, result: Dict):
        """
        Cache search result.
        
        Args:
            query: Search query
            result: Search result to cache
        """
        cache_key = self._get_cache_key(query)
        
        # Don't cache the "cached" flag itself
        result_to_cache = {k: v for k, v in result.items() if k != "cached"}
        
        await self.redis.redis.set(
            cache_key,
            json.dumps(result_to_cache),
            ex=self.CACHE_TTL_SECONDS
        )
        
        logger.debug(f"Cached search result for: {query[:50]}...")
    
    def _get_cache_key(self, query: str) -> str:
        """
        Generate cache key for a query.
        
        Args:
            query: Search query
            
        Returns:
            Cache key string
        """
        # Create hash of query for consistent key
        query_hash = hashlib.md5(query.lower().strip().encode()).hexdigest()
        return f"web_search:{query_hash}"
    
    async def clear_cache(self, query: Optional[str] = None):
        """
        Clear cached search results.
        
        Args:
            query: Specific query to clear, or None to clear all
        """
        if query:
            cache_key = self._get_cache_key(query)
            await self.redis.redis.delete(cache_key)
            logger.info(f"Cleared cache for query: {query[:50]}...")
        else:
            # Clear all web search cache
            # This is expensive - use sparingly
            pattern = "web_search:*"
            cursor = 0
            count = 0
            
            while True:
                cursor, keys = await self.redis.redis.scan(
                    cursor=cursor,
                    match=pattern,
                    count=100
                )
                
                if keys:
                    await self.redis.redis.delete(*keys)
                    count += len(keys)
                
                if cursor == 0:
                    break
            
            logger.info(f"Cleared {count} cached search results")