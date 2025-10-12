"""
Enhanced database search with strict/broad query logic.
"""
import re
from typing import Any, Dict, List, Optional

from pymongo.collection import Collection


class EnhancedSearcher:
    """Handles smart database searching with fallback logic."""
    
    def __init__(self, profiles_collection: Collection, min_results_threshold: int = 10):
        self.profiles = profiles_collection
        self.min_threshold = min_results_threshold
    
    def search_with_fallback(self, strict_params: Dict[str, List[str]], broad_params: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """
        Search database using strict params first, fallback to broad if needed.
        
        Returns:
            List of 50-100 candidate profiles
        """
        print(f"  🔍 Searching with strict params...")
        strict_query = self._build_safe_query(strict_params)
        
        if strict_query:
            print(f"  📋 Strict query has {len(strict_query.get('$or', []))} OR conditions")
            strict_results = list(self.profiles.find(strict_query).limit(100))
            print(f"  📊 Strict search found {len(strict_results)} profiles")
        else:
            print(f"  ⚠️ Strict query is empty, skipping...")
            strict_results = []
        
        if len(strict_results) >= self.min_threshold:
            print(f"  ✅ Sufficient results from strict search")
            return strict_results
        
        # Fallback to broad search
        print(f"  ⚠️ Only {len(strict_results)} results, using broad search...")
        broad_query = self._build_safe_query(broad_params)
        
        if broad_query:
            print(f"  📋 Broad query has {len(broad_query.get('$or', []))} OR conditions")
            broad_results = list(self.profiles.find(broad_query).limit(100))
            print(f"  📊 Broad search found {len(broad_results)} profiles")
        else:
            print(f"  ⚠️ Broad query is empty too!")
            broad_results = []
        
        return broad_results
    
    def _build_safe_query(self, params: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Build MongoDB query from structured params.
        NEVER executes raw query strings.
        Uses OR logic for flexibility - profile must match ANY of the criteria.
        
        IMPORTANT: This handles the real data structure where:
        - location field contains full address (e.g., "Mumbai, Maharashtra, India")
        - city field is often "NA"
        - We search primarily in location, title, expertise, current_industry fields
        """
        or_clauses = []
        
        # Helper to clean location strings
        def clean_location(loc: str) -> str:
            """Remove 'near' and other non-location words."""
            cleaned = loc.lower()
            cleaned = re.sub(r'\b(near|around|in|at)\b', '', cleaned).strip()
            return cleaned
        
        # LOCATION - Search in 'location' field (most reliable)
        # This field typically contains: "City, State, Country"
        locations = params.get("Location", [])
        for loc in locations:
            if loc and loc != "NA":
                cleaned_loc = clean_location(loc)
                if cleaned_loc:
                    # Search in full location field
                    or_clauses.append({"location": re.compile(re.escape(cleaned_loc), re.IGNORECASE)})
        
        # CITY - Also try the city field (even though it's often NA)
        cities = params.get("City", [])
        for city in cities:
            if city and city != "NA":
                # Search in both city field and location field
                or_clauses.append({"city": re.compile(re.escape(city), re.IGNORECASE)})
                or_clauses.append({"location": re.compile(re.escape(city), re.IGNORECASE)})
        
        # STATE - Search in both state field and location field
        states = params.get("State", [])
        for state in states:
            if state and state != "NA":
                or_clauses.append({"state": re.compile(re.escape(state), re.IGNORECASE)})
                or_clauses.append({"location": re.compile(re.escape(state), re.IGNORECASE)})
        
        # COUNTRY - Search in both country field and location field
        countries = params.get("Country", [])
        for country in countries:
            if country and country != "NA":
                or_clauses.append({"country": re.compile(re.escape(country), re.IGNORECASE)})
                or_clauses.append({"location": re.compile(re.escape(country), re.IGNORECASE)})
        
        # INDUSTRY - Search in current_industry field
        industries = params.get("Industry", [])
        for industry in industries:
            if industry and industry != "NA":
                or_clauses.append({"current_industry": re.compile(re.escape(industry), re.IGNORECASE)})
        
        # SKILLS - Search in expertise field
        skills = params.get("Skills", [])
        for skill in skills:
            if skill and skill != "NA":
                or_clauses.append({"expertise": re.compile(re.escape(skill), re.IGNORECASE)})
        
        # ROLE - Search in title field
        roles = params.get("Role", [])
        for role in roles:
            if role and role != "NA":
                or_clauses.append({"title": re.compile(re.escape(role), re.IGNORECASE)})
        
        # SENIORITY LEVEL - Search in seniority_level field
        seniority_levels = params.get("Seniority_Level", [])
        for level in seniority_levels:
            if level and level != "NA":
                or_clauses.append({"seniority_level": re.compile(re.escape(level), re.IGNORECASE)})
        
        # FUNCTIONAL AREA - Search in functional_area field
        functional_areas = params.get("Functional_Area", [])
        for area in functional_areas:
            if area and area != "NA":
                or_clauses.append({"functional_area": re.compile(re.escape(area), re.IGNORECASE)})
        
        # EDUCATION - Search in education array (for broad params)
        educations = params.get("Education", [])
        for edu in educations:
            if edu and edu != "NA":
                # Search in education.major field
                or_clauses.append({"education.major": re.compile(re.escape(edu), re.IGNORECASE)})
                or_clauses.append({"education.specialization": re.compile(re.escape(edu), re.IGNORECASE)})
        
        # Combine all clauses with OR logic
        if or_clauses:
            return {"$or": or_clauses}
        else:
            # If no criteria specified, return a basic query to get some profiles
            # Get profiles from India (since most of your data seems to be from India)
            return {"country": re.compile("India", re.IGNORECASE)}