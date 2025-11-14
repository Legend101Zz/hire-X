"""
Search Engine Service
=====================================
Optimized search for 56M profiles using async MongoDB operations.
"""

import time
from typing import Any, Dict, List, Optional

from pymongo.collection import Collection

from core.logging_config import get_logger

# Get the logger for this module
logger = get_logger(__name__)

class SearchEngine:
    """
    High-performance search engine for 56M candidate profiles.
    
    This uses MongoDB compound indexes to dramatically speed up search.
    The key insight: reduce the search space BEFORE doing expensive operations!
    """
    
    def __init__(self, profiles_collection: Collection):
        """
        Initialize search engine.
        
        Args:
            profiles_collection: MongoDB collection with candidate profiles
        """
        self.profiles = profiles_collection # Note: index verification can be done during startup
        
        # Note: Index verification skipped for async compatibility
        # Run scripts/create_indexes.py manually to ensure indexes exist
        # self._verify_indexes()  # Commented out - can't call async from __init__
    
    async def verify_indexes(self):
        """
        Check if required indexes exist.
        
        This doesn't create indexes (run scripts/create_indexes.py for that),
        but warns if they're missing.
        """
        try:
            indexes = await self.profiles.index_information()
            
            # Check for key indexes
            has_industry_seniority = any(
                'current_industry' in str(idx.get('key', []))
                for idx in indexes.values()
            )
            
            if not has_industry_seniority:
                logger.warning("WARNING: Compound indexes not found!")
                logger.warning("Run: python scripts/create_indexes.py")
                logger.warning("Search will be SLOW without indexes!")
            
        except Exception as e:
            logger.error(f"Could not verify indexes: {e}")
    
    async def search(
        self,
        industries: List[str] = None,
        seniority_levels: List[str] = None,
        locations: List[str] = None,
        keywords: str = "",
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """
        Main search method - optimized for 56M profiles.
        
        This is the core search function that your workflow uses.
        
        Args:
            industries: List of industries to filter by (e.g., ["Technology", "Finance"])
            seniority_levels: List of seniority levels (e.g., ["Senior", "Lead"])
            locations: List of locations (e.g., ["San Francisco", "New York"])
            keywords: Free text search keywords (e.g., "python developer")
            limit: Maximum results to return (default: 500)
            
        Returns:
            List of matching candidate profiles (dictionaries)
            
        Example:
            results = search_engine.search(
                industries=["Technology"],
                seniority_levels=["Senior"],
                locations=["San Francisco"],
                keywords="python machine learning",
                limit=100
            )
        """
        
        start_time = time.time()
        
        # Step 1: Build pre-filter query using indexed fields
        # This is FAST because it uses compound indexes
        query = self._build_prefilter_query(industries, seniority_levels, locations)
        
        # Step 2: Execute search
        # MongoDB will use indexes to quickly reduce 56M → ~10K candidates
        cursor = self.profiles.find(query) # this is not async as no database ops yet , just a pointer to function that would do it
        
        # Step 3: Apply keyword filtering if provided
        if keywords and keywords.strip():
            # Get a larger set for filtering
            pre_filtered = await cursor.limit(limit * 2).to_list(length=limit * 2)
            
            # Filter by keywords in Python (fast on small set)
            results = self._filter_by_keywords(pre_filtered, keywords)
            
            # Limit to requested size
            results = results[:limit]
        else:
            # No keywords, just use the pre-filtered results
            results = await cursor.limit(limit).to_list(length=limit)
        
        # Calculate search time
        search_time = time.time() - start_time
        
        logger.info(f"earch completed in {search_time:.2f}s - Found {len(results)} candidates")
        
        return results
    
    def _build_prefilter_query(
        self,
        industries: List[str],
        seniority_levels: List[str],
        locations: List[str]
    ) -> Dict[str, Any]:
        """
        Build MongoDB query using indexed fields.
        
        This creates a query that MongoDB can execute using compound indexes,
        which is MUCH faster than full collection scans.
        
        The query uses $in operators on indexed fields to quickly narrow down
        from 56M profiles to ~10K candidates.
        """
        
        query = {}
        
        # Industry filter (uses idx_industry_seniority index)
        if industries and len(industries) > 0:
            # Filter out None and empty strings
            valid_industries = [i for i in industries if i]
            if valid_industries:
                query["current_industry"] = {"$in": valid_industries}
        
        # Seniority filter (uses idx_industry_seniority index)
        if seniority_levels and len(seniority_levels) > 0:
            valid_seniority = [s for s in seniority_levels if s]
            if valid_seniority:
                query["seniority_level"] = {"$in": valid_seniority}
        
        # Location filter (uses idx_country_location index)
        if locations and len(locations) > 0:
            valid_locations = [loc for loc in locations if loc]
            if valid_locations:
                # Try to extract countries for exact match (faster)
                countries = []
                location_patterns = []
                
                for loc in valid_locations:
                    # Extract country (last part after comma)
                    parts = loc.split(",")
                    if len(parts) >= 2:
                        country = parts[-1].strip()
                        countries.append(country)
                    
                    # Also keep full location for regex
                    location_patterns.append(loc)
                
                # Build location query
                # Try exact country match first (faster), fallback to location text
                location_queries = []
                
                if countries:
                    location_queries.append({"country": {"$in": countries}})
                
                if location_patterns:
                    # Create regex pattern for all locations
                    pattern = "|".join(location_patterns)
                    location_queries.append({
                        "location": {"$regex": pattern, "$options": "i"}
                    })
                
                if location_queries:
                    query["$or"] = location_queries
        
        return query
    
    def _filter_by_keywords(
        self,
        results: List[Dict[str, Any]],
        keywords: str
    ) -> List[Dict[str, Any]]:
        """
        Filter results by keywords in Python.
        
        This is done in Python (not MongoDB) because:
        1. We're filtering a small set (~1000 profiles)
        2. It's fast enough on small sets
        3. Gives us more flexibility in matching logic
        
        Args:
            results: Pre-filtered candidate profiles
            keywords: Keywords to search for
            
        Returns:
            Filtered list of candidates
        """
        
        keywords_lower = keywords.lower()
        filtered = []
        
        for profile in results:
            # Create searchable text from key fields
            searchable = " ".join([
                profile.get("title", ""),
                profile.get("expertise", ""),
                profile.get("current_industry", "")
            ]).lower()
            
            # Check if keywords appear in searchable text
            if keywords_lower in searchable:
                filtered.append(profile)
        
        return filtered
    
    def search_with_fallback(
        self,
        strict_industries: List[str],
        strict_seniority: List[str],
        broad_industries: List[str],
        broad_seniority: List[str],
        locations: List[str],
        keywords: str,
        min_results: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Search with automatic fallback to broader criteria.
        
        This tries strict criteria first, then falls back to broader criteria
        if not enough results are found.
        
        Args:
            strict_industries: Strict industry filters
            strict_seniority: Strict seniority filters
            broad_industries: Broader industry filters (fallback)
            broad_seniority: Broader seniority filters (fallback)
            locations: Location filters
            keywords: Search keywords
            min_results: Minimum results needed before fallback
            
        Returns:
            List of matching candidates
            
        Example:
            results = search_engine.search_with_fallback(
                strict_industries=["Technology"],
                strict_seniority=["Senior"],
                broad_industries=["Technology", "Finance", "Consulting"],
                broad_seniority=["Senior", "Mid-level"],
                locations=["San Francisco"],
                keywords="python"
            )
        """
        
        # Try strict search first
        logger.info("Trying strict criteria...")
        strict_results = self.search(
            industries=strict_industries,
            seniority_levels=strict_seniority,
            locations=locations,
            keywords=keywords,
            limit=500
        )
        
        # Check if we have enough results
        if len(strict_results) >= min_results:
            logger.info(f"Strict search found {len(strict_results)} candidates (sufficient)")
            return strict_results
        
        # Fallback to broad search
        logger.critical(f"Only {len(strict_results)} with strict criteria")
        logger.critical("Falling back to broader criteria...")
        
        broad_results = self.search(
            industries=broad_industries,
            seniority_levels=broad_seniority,
            locations=locations,
            keywords=keywords,
            limit=500
        )
        
        logger.info(f"Broad search found {len(broad_results)} candidates")
        
        return broad_results