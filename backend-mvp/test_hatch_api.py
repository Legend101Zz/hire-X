"""
Test script for Hatch API integration.
Run this to test the endpoint without hitting the actual Hatch API (uses mock data).
"""
import json

import requests

# Configuration
BASE_URL = "http://localhost:8000"
# Get your JWT token from login first
JWT_TOKEN = "your-jwt-token-here"  # Replace with actual token after login

def test_login():
    """First, login to get JWT token."""
    response = requests.post(
        f"{BASE_URL}/login",
        json={
            "username": "testuser",
            "password": "testpassword123"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Login successful!")
        print(f"Token: {data['access_token'][:50]}...")
        return data['access_token']
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def test_single_contact(token):
    """Test single contact lookup."""
    print("\n--- Testing Single Contact Lookup ---")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "profile_id": "507f1f77bcf86cd799439011",  # Example MongoDB ObjectId
        "linkedin_url": "https://www.linkedin.com/in/nanduvijay/",
        "first_name": "Nandu",
        "last_name": "Vijay",
        "company_domain": "aabasoft.com",
        "session_id": "test-session-123"
    }
    
    response = requests.post(
        f"{BASE_URL}/hatch/contact",
        headers=headers,
        json=payload
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    return response.status_code == 200

def test_bulk_contact(token):
    """Test bulk contact lookup (max 5)."""
    print("\n--- Testing Bulk Contact Lookup ---")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "session_id": "test-session-bulk-123",
        "profiles": [
            {
                "profile_id": "507f1f77bcf86cd799439011",
                "linkedin_url": "https://www.linkedin.com/in/nanduvijay/",
                "first_name": "Nandu",
                "last_name": "Vijay",
                "company_domain": "aabasoft.com"
            },
            {
                "profile_id": "507f1f77bcf86cd799439012",
                "linkedin_url": "https://www.linkedin.com/in/example2/",
                "first_name": "John",
                "last_name": "Doe",
                "company_domain": "example.com"
            }
        ]
    }
    
    response = requests.post(
        f"{BASE_URL}/hatch/bulk-contact",
        headers=headers,
        json=payload
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    return response.status_code == 200

def test_cache_hit(token):
    """Test that second request hits cache."""
    print("\n--- Testing Cache Hit ---")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "profile_id": "507f1f77bcf86cd799439011",
        "linkedin_url": "https://www.linkedin.com/in/nanduvijay/"
    }
    
    # First request (should hit API)
    print("First request (should call API):")
    response1 = requests.post(f"{BASE_URL}/hatch/contact", headers=headers, json=payload)
    result1 = response1.json()
    print(f"Source: {result1.get('source')}")
    
    # Second request (should hit cache)
    print("\nSecond request (should hit cache):")
    response2 = requests.post(f"{BASE_URL}/hatch/contact", headers=headers, json=payload)
    result2 = response2.json()
    print(f"Source: {result2.get('source')}")
    
    return result2.get('source') == 'cache'

if __name__ == "__main__":
    print("=== Hatch API Integration Tests ===\n")
    
    # Step 1: Login
    token = test_login()
    if not token:
        print("\n❌ Cannot proceed without valid token")
        exit(1)
    
    # Step 2: Test single contact
    single_success = test_single_contact(token)
    
    # Step 3: Test bulk contact
    bulk_success = test_bulk_contact(token)
    
    # Step 4: Test caching
    cache_success = test_cache_hit(token)
    
    # Summary
    print("\n=== Test Summary ===")
    print(f"Single Contact: {'✅ PASS' if single_success else '❌ FAIL'}")
    print(f"Bulk Contact: {'✅ PASS' if bulk_success else '❌ FAIL'}")
    print(f"Cache Hit: {'✅ PASS' if cache_success else '❌ FAIL'}")