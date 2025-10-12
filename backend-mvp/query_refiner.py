"""
Interactive query refinement - FAST version that asks user for alternatives.
"""
from typing import Any, Dict, Optional


def refine_query_interactive(
    original_query: str,
    preflight_results: Dict[str, Any],
    parsed_data: Dict[str, Any],
    preflight_checker
) -> Optional[Dict[str, Any]]:
    """
    Let user interactively refine their query.
    Instead of fetching all distinct values (slow), we ask user to suggest alternatives.
    """
    
    if preflight_results["viable"]:
        # Query is good, no refinement needed
        return parsed_data
    
    print("\n" + "=" * 80)
    print("⚠️  QUERY REFINEMENT NEEDED")
    print("=" * 80)
    print(f"\nYour query: '{original_query}'")
    print(f"Result: Found {preflight_results['results_count']} matching profiles")
    print()
    
    failed_filters = preflight_results.get("failed_filters", {})
    
    if not failed_filters:
        print("❌ No profiles match your combined criteria.")
        print("   Try relaxing some requirements.")
        return None
    
    print("❌ The following filters had no matches:")
    for filter_name, info in failed_filters.items():
        print(f"   • {filter_name}: '{info['requested']}'")
    
    print("\n" + "=" * 80)
    print("💡 SUGGESTIONS")
    print("=" * 80)
    
    # Provide helpful suggestions based on filter type
    suggestions = {
        "Industry": [
            "Try broader terms: 'Software', 'Technology', 'IT Services'",
            "Financial related: 'Financial Services', 'Banking', 'Insurance'",
            "Consulting: 'Management Consulting', 'Business Consulting'"
        ],
        "Location": [
            "Try nearby cities: If Mumbai didn't work, try 'Pune', 'Thane', 'Maharashtra'",
            "Try major cities: 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai'",
            "Try regions: 'India', 'USA', 'Europe'"
        ],
        "Role": [
            "Try simpler terms: Instead of 'Senior Software Engineer', try 'Software Engineer'",
            "Try variations: 'Developer', 'Engineer', 'Architect', 'Lead'",
            "Try broader: 'Engineer' or 'Manager'"
        ],
        "Seniority_Level": [
            "Try variations: 'Senior', 'Lead', 'Principal', 'Staff'",
            "Or try: 'Mid-level', 'Junior', 'Entry level'"
        ]
    }
    
    # Ask user to provide alternatives
    updated = False
    
    for filter_name, info in failed_filters.items():
        print(f"\n📝 {filter_name}: We couldn't find '{info['requested']}'")
        
        # Show suggestions
        if filter_name in suggestions:
            print(f"\n   Common alternatives:")
            for sugg in suggestions[filter_name]:
                print(f"   • {sugg}")
        
        print(f"\n   What would you like to try instead?")
        print(f"   (Type a new value, 'skip' to ignore this filter, or 'cancel' to quit)")
        
        while True:
            new_value = input(f"\n   Your alternative: ").strip()
            
            if not new_value or new_value.lower() == 'cancel':
                print("\n❌ Search cancelled.")
                return None
            
            if new_value.lower() == 'skip':
                print(f"   ⏭️  Skipped {filter_name}")
                # Remove this filter from strict_params
                if filter_name in parsed_data["strict_params"]:
                    parsed_data["strict_params"][filter_name] = []
                break
            
            # Test the alternative (FAST - just one count query)
            print(f"   🔍 Testing '{new_value}'...")
            count = preflight_checker.test_alternative(filter_name, new_value)
            
            if count > 0:
                print(f"   ✅ Found {count:,} profiles with '{new_value}'!")
                parsed_data["strict_params"][filter_name] = [new_value]
                updated = True
                break
            else:
                print(f"   ❌ Still no results for '{new_value}'")
                print(f"   Would you like to try another value? (y/n)")
                retry = input(f"   ").strip().lower()
                if retry != 'y':
                    print(f"   ⏭️  Skipped {filter_name}")
                    parsed_data["strict_params"][filter_name] = []
                    break
    
    if not updated:
        print("\n⚠️  No filters were updated. Search may still return 0 results.")
        proceed = input("Continue anyway? (y/n): ").strip().lower()
        if proceed != 'y':
            return None
    
    print("\n" + "=" * 80)
    print("📝 UPDATED SEARCH CRITERIA")
    print("=" * 80)
    
    for key, values in parsed_data["strict_params"].items():
        if values:
            print(f"  • {key}: {values[0]}")
    
    print()
    return parsed_data