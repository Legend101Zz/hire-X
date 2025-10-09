"""
Improved search with mandatory filters for critical requirements.
"""
import re
from typing import Any, Dict, List

from pymongo.collection import Collection


class ImprovedSearcher:
    """Search with mandatory + optional criteria."""
    
    def __init__(self, profiles_collection: Collection):
        self.profiles = profiles_collection
    
    def search_with_mandatory_filters(
        self, 
        mandatory: Dict[str, List[str]], 
        optional: Dict[str, List[str]],
        min_results: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Search with MANDATORY filters (Industry + Location only).
        Other filters like Role, Seniority are used for scoring.
        """
        
        # Only use Industry and Location as mandatory
        MANDATORY_FIELDS = ["Industry", "Location"]
        
        and_clauses = []
        
        # Industry
        if mandatory.get("Industry"):
            industries = mandatory["Industry"]
            if industries:
                industry_or = []
                for ind in industries:
                    if ind and ind != "NA":
                        industry_or.append({"current_industry": re.compile(re.escape(ind), re.IGNORECASE)})
                if industry_or:
                    and_clauses.append({"$or": industry_or})
        
        # Location
        if mandatory.get("Location"):
            locations = mandatory["Location"]
            if locations:
                location_or = []
                for loc in locations:
                    if loc and loc != "NA":
                        location_or.append({"location": re.compile(re.escape(loc), re.IGNORECASE)})
                if location_or:
                    and_clauses.append({"$or": location_or})
        
        # Execute mandatory search (Industry + Location only)
        if and_clauses:
            mandatory_query = {"$and": and_clauses}
            print(f"  🔒 Searching with {len(and_clauses)} MANDATORY filters (Industry + Location)...")
            mandatory_results = list(self.profiles.find(mandatory_query).limit(200))
            print(f"  📊 Found {len(mandatory_results)} with mandatory criteria")
            print(f"  💡 Role, Seniority, Skills will be used for ranking")
            
            return mandatory_results
        else:
            # No mandatory filters, use optional
            print(f"  ⚠️ No mandatory filters, using optional criteria...")
            optional_query = self._build_optional_query(optional)
            optional_results = list(self.profiles.find(optional_query).limit(200))
            return optional_results
        
    def _build_optional_query(self, optional: Dict[str, List[str]]) -> Dict[str, Any]:
        """Build OR query for optional criteria."""
        or_clauses = []
        
        # Location
        for loc in optional.get("Location", []):
            if loc and loc != "NA":
                or_clauses.append({"location": re.compile(re.escape(loc), re.IGNORECASE)})
        
        # Industry
        for ind in optional.get("Industry", []):
            if ind and ind != "NA":
                or_clauses.append({"current_industry": re.compile(re.escape(ind), re.IGNORECASE)})
        
        # Skills
        for skill in optional.get("Skills", []):
            if skill and skill != "NA":
                or_clauses.append({"expertise": re.compile(re.escape(skill), re.IGNORECASE)})
        
        # Role
        for role in optional.get("Role", []):
            if role and role != "NA":
                or_clauses.append({"title": re.compile(re.escape(role), re.IGNORECASE)})
        
        if or_clauses:
            return {"$or": or_clauses}
        return {}
    
    def _add_optional_matches(self, profiles: List[Dict], optional: Dict) -> List[Dict]:
        """Add optional match flags to profiles for scoring."""
        # For now, just return profiles as-is
        # Optional criteria will be used in scoring
        return profiles