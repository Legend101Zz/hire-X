"""
Generate intelligent follow-up questions based on search results.
"""
from typing import Any, Dict, List


def generate_followup_questions(
    original_query: str,
    initial_profiles: List[Dict[str, Any]],
    parsed_data: Dict[str, Any]
) -> List[Dict[str, str]]:
    """
    Generate 3-5 follow-up questions to refine the search.
    """
    questions = []
    
    # Analyze initial results
    industries = set()
    locations = set()
    skills_found = set()
    
    for profile in initial_profiles[:20]:
        if profile.get('current_industry') and profile['current_industry'] != 'NA':
            industries.add(profile['current_industry'])
        if profile.get('location') and profile['location'] != 'NA':
            loc = profile['location'].split(',')[0].strip()  # Get city
            locations.add(loc)
        if profile.get('expertise'):
            skills = [s.strip() for s in profile['expertise'].split(',')[:5]]
            skills_found.update(skills)
    
    # Get strict params (mandatory criteria)
    strict_params = parsed_data.get('strict_params', {})
    
    # Question 1: Industry refinement (if results don't match)
    requested_industry = strict_params.get('Industry', [])
    if requested_industry:
        matching_industries = [i for i in industries if requested_industry[0].lower() in i.lower()]
        if not matching_industries:
            questions.append({
                'question': f"We found limited {requested_industry[0]} candidates. Would you consider related industries?",
                'options': list(industries)[:5] if industries else ['No alternatives found'],
                'type': 'industry'
            })
    
    # Question 2: Location flexibility
    requested_location = strict_params.get('Location', [])
    if requested_location:
        questions.append({
            'question': "Are you open to remote candidates or those from other cities?",
            'options': [
                'Yes - Remote OK',
                'Yes - Nearby cities only',
                f'No - Must be in {requested_location[0]}'
            ],
            'type': 'location'
        })
    
    # Question 3: Experience level
    questions.append({
        'question': "What's more important: years of experience or specific technical skills?",
        'options': ['Years of experience', 'Specific tech skills', 'Both equally'],
        'type': 'priority'
    })
    
    # Question 4: Specific skills
    if skills_found:
        questions.append({
            'question': "Which skills are MUST-HAVE? (comma-separated or 'all' or 'none')",
            'options': list(skills_found)[:8],
            'type': 'skills_priority'
        })
    
    # Question 5: Company background
    questions.append({
        'question': "Do you prefer candidates from specific company types?",
        'options': ['Startups', 'Large enterprises', 'Product companies', 'Service companies', 'No preference'],
        'type': 'company_preference'
    })
    
    return questions[:5]  # Return max 5 questions