"""
Test LinkedIn URL normalization.
"""
import re


def normalize_linkedin_url(linkedin_url):
    """Normalize LinkedIn URL to proper format."""
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

# Test cases
test_cases = [
    "/in/--vikash-kumar/",
    "/in/--deepsengupta--/",
    "in/--vikash-kumar/",
    "https://www.linkedin.com/in/nanduvijay/",
    "in/johndoe",
    "/in/janedoe/",
    "linkedin.com/in/someone",
    "www.linkedin.com/in/someone",
]

print("=== LinkedIn URL Normalization Tests ===\n")
for test_url in test_cases:
    normalized = normalize_linkedin_url(test_url)
    print(f"Input:  {test_url}")
    print(f"Output: {normalized}")
    print()