"""
Preflight check service - Smart version with required vs optional filters.
"""
import re
from typing import Any, Dict, List

from pymongo.collection import Collection


class PreflightChecker:
    """Check if critical query criteria exist in database before searching."""
    
    # Define which filters are REQUIRED for the combined test
    REQUIRED_FILTERS = ["Industry", "Location"]  # Only these MUST match
    SCORING_FILTERS = ["Role", "Seniority_Level", "Skills", "Experience"]  # These are for scoring only
    
    def __init__(self, profiles_collection: Collection):
        self.profiles = profiles_collection
    
    def check_query_viability(
        self, 
        critical_filters: Dict[str, List[str]],
        min_required_results: int = 10
    ) -> Dict[str, Any]:
        """
        Check if critical filters will return any results.
        
        Only REQUIRED_FILTERS are used in combined AND test.
        Other filters are tested individually but not required for combined query.
        
        Args:
            critical_filters: All filters from strict_params
            min_required_results: Minimum number of results needed
            
        Returns:
            {
                "viable": bool,
                "results_count": int,
                "failed_filters": {},
                "filter_details": {}
            }
        """
        
        print("\n🔍 PREFLIGHT CHECK: Testing filters...")
        print("=" * 80)
        
        results = {
            "viable": True,
            "results_count": 0,
            "failed_filters": {},
            "filter_details": {}
        }
        
        # Test each filter individually
        print(f"\n📋 Testing individual filters:")
        print(f"   (✅ = Required, 💡 = For scoring only)")
        print()
        
        # 1. Test Industry (REQUIRED)
        industries = critical_filters.get("Industry", [])
        if industries:
            is_required = "Industry" in self.REQUIRED_FILTERS
            icon = "✅" if is_required else "💡"
            print(f"{icon} 📊 Industry: {industries[0]} {'(REQUIRED)' if is_required else '(scoring)'}")
            
            count = self._count_industry(industries[0])
            print(f"      Found {count:,} profiles")
            
            results["filter_details"]["Industry"] = {
                "requested": industries[0],
                "count": count,
                "required": is_required
            }
            
            if count == 0 and is_required:
                results["failed_filters"]["Industry"] = {
                    "requested": industries[0],
                    "count": count
                }
        
        # 2. Test Location (REQUIRED)
        locations = critical_filters.get("Location", [])
        if locations:
            is_required = "Location" in self.REQUIRED_FILTERS
            icon = "✅" if is_required else "💡"
            print(f"\n{icon} 📍 Location: {locations[0]} {'(REQUIRED)' if is_required else '(scoring)'}")
            
            count = self._count_location(locations[0])
            print(f"      Found {count:,} profiles")
            
            results["filter_details"]["Location"] = {
                "requested": locations[0],
                "count": count,
                "required": is_required
            }
            
            if count == 0 and is_required:
                results["failed_filters"]["Location"] = {
                    "requested": locations[0],
                    "count": count
                }
        
        # 3. Test Role (FOR SCORING)
        roles = critical_filters.get("Role", [])
        if roles:
            is_required = "Role" in self.REQUIRED_FILTERS
            icon = "✅" if is_required else "💡"
            print(f"\n{icon} 👔 Role: {roles[0]} {'(REQUIRED)' if is_required else '(scoring)'}")
            
            count = self._count_role(roles[0])
            print(f"      Found {count:,} profiles")
            
            results["filter_details"]["Role"] = {
                "requested": roles[0],
                "count": count,
                "required": is_required
            }
            
            if count == 0 and is_required:
                results["failed_filters"]["Role"] = {
                    "requested": roles[0],
                    "count": count
                }
        
        # 4. Test Seniority (FOR SCORING - redundant with Role)
        seniority = critical_filters.get("Seniority_Level", [])
        if seniority:
            is_required = "Seniority_Level" in self.REQUIRED_FILTERS
            icon = "✅" if is_required else "💡"
            
            # Check if role already contains seniority
            role_has_seniority = False
            if roles and any(sen.lower() in roles[0].lower() for sen in ["senior", "lead", "principal", "staff", "junior"]):
                role_has_seniority = True
                print(f"\n{icon} 🎖️  Seniority: {seniority[0]} (SKIP - already in Role)")
            else:
                print(f"\n{icon} 🎖️  Seniority: {seniority[0]} {'(REQUIRED)' if is_required else '(scoring)'}")
                count = self._count_seniority(seniority[0])
                print(f"      Found {count:,} profiles")
                
                results["filter_details"]["Seniority_Level"] = {
                    "requested": seniority[0],
                    "count": count,
                    "required": is_required,
                    "redundant": role_has_seniority
                }
        
        # 5. Test COMBINED (AND logic) - ONLY REQUIRED FILTERS
        print(f"\n" + "=" * 80)
        print(f"🎯 Testing COMBINED (using only REQUIRED filters)...")
        
        # Build combined query with only required filters
        required_filters_to_test = {
            k: v for k, v in critical_filters.items() 
            if k in self.REQUIRED_FILTERS and v
        }
        
        if required_filters_to_test:
            print(f"   Testing: {', '.join(required_filters_to_test.keys())}")
            combined_count = self._count_combined(required_filters_to_test)
            results["results_count"] = combined_count
            
            if combined_count < min_required_results:
                print(f"   ❌ Found only {combined_count} profiles (need at least {min_required_results})")
                results["viable"] = False
            else:
                print(f"   ✅ Found {combined_count:,} profiles with required filters")
                print(f"      (Other filters like Role, Seniority will boost ranking)")
                results["viable"] = True
        else:
            print(f"   ⚠️  No required filters specified")
            results["viable"] = True
            results["results_count"] = 0
        
        print("=" * 80)
        return results
    
    def _count_industry(self, industry: str) -> int:
        """Fast count of profiles in industry."""
        query = {"current_industry": re.compile(re.escape(industry), re.IGNORECASE)}
        return self.profiles.count_documents(query)
    
    def _count_location(self, location: str) -> int:
        """Fast count of profiles in location."""
        query = {
            "$or": [
                {"location": re.compile(re.escape(location), re.IGNORECASE)},
                {"city": re.compile(re.escape(location), re.IGNORECASE)}
            ]
        }
        return self.profiles.count_documents(query)
    
    def _count_role(self, role: str) -> int:
        """Fast count of profiles with role."""
        query = {"title": re.compile(re.escape(role), re.IGNORECASE)}
        return self.profiles.count_documents(query)
    
    def _count_seniority(self, seniority: str) -> int:
        """Fast count of profiles with seniority level."""
        query = {
            "$or": [
                {"seniority_level": re.compile(re.escape(seniority), re.IGNORECASE)},
                {"title": re.compile(re.escape(seniority), re.IGNORECASE)}
            ]
        }
        return self.profiles.count_documents(query)
    
    def _count_combined(self, filters: Dict[str, List[str]]) -> int:
        """Fast count with combined REQUIRED filters using AND logic."""
        and_clauses = []
        
        # Only include filters that are in REQUIRED_FILTERS
        
        # Industry
        if filters.get("Industry"):
            industry = filters["Industry"][0]
            and_clauses.append({
                "current_industry": re.compile(re.escape(industry), re.IGNORECASE)
            })
        
        # Location
        if filters.get("Location"):
            location = filters["Location"][0]
            and_clauses.append({
                "$or": [
                    {"location": re.compile(re.escape(location), re.IGNORECASE)},
                    {"city": re.compile(re.escape(location), re.IGNORECASE)}
                ]
            })
        
        # Don't include Role or Seniority in combined query
        # They'll be used for scoring instead
        
        if and_clauses:
            query = {"$and": and_clauses}
            return self.profiles.count_documents(query)
        return 0
    
    def test_alternative(self, filter_name: str, value: str) -> int:
        """Test a user-suggested alternative value."""
        if filter_name == "Industry":
            return self._count_industry(value)
        elif filter_name == "Location":
            return self._count_location(value)
        elif filter_name == "Role":
            return self._count_role(value)
        elif filter_name == "Seniority_Level":
            return self._count_seniority(value)
        return 0