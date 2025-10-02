"""
Test script for Hatch API integration.
Make sure to replace the profile_ids with actual MongoDB _ids from your mydatabase/profiles collection.
"""
import json

import requests

# Configuration
BASE_URL = "http://localhost:8080"

def test_login():
    """First, login to get JWT token."""
    response = requests.post(
        f"{BASE_URL}/login",
        json={
            "username": "Mrigesh",
            "password": "Neura@123"
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

def test_single_contact(token, profile_id):
    """Test single contact lookup."""
    print("\n--- Testing Single Contact Lookup ---")
    print(f"Profile ID: {profile_id}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "profile_id": profile_id,  # MongoDB _id from mydatabase/profiles
        "session_id": "test-session-123"
    }
    
    response = requests.post(
        f"{BASE_URL}/hatch/contact",
        headers=headers,
        json=payload
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Success: {result.get('success')}")
        print(f"Name: {result.get('first_name')} {result.get('last_name')}")
        print(f"Phone: {result.get('phone')}")
        print(f"Email: {result.get('email')}")
        print(f"Source: {result.get('source')} (cache or api)")
        print(f"Message: {result.get('message')}")
    else:
        print(f"Error: {response.text}")
    
    return response.status_code == 200

def test_bulk_contact(token, profile_ids):
    """Test bulk contact lookup (max 5)."""
    print("\n--- Testing Bulk Contact Lookup ---")
    print(f"Profile IDs: {profile_ids}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "session_id": "test-session-bulk-123",
        "profile_ids": profile_ids  # List of MongoDB _ids from mydatabase/profiles
    }
    
    response = requests.post(
        f"{BASE_URL}/hatch/bulk-contact",
        headers=headers,
        json=payload
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Total Results: {data.get('count')}")
        print("\nResults:")
        for i, result in enumerate(data.get('results', []), 1):
            print(f"\n{i}. {result.get('first_name')} {result.get('last_name')}")
            print(f"   Phone: {result.get('phone')}")
            print(f"   Email: {result.get('email')}")
            print(f"   Source: {result.get('source')}")
    else:
        print(f"Error: {response.text}")
    
    return response.status_code == 200

def test_cache_hit(token, profile_id):
    """Test that second request hits cache."""
    print("\n--- Testing Cache Hit ---")
    print(f"Profile ID: {profile_id}")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "profile_id": profile_id
    }
    
    # First request (should hit API or return existing cache)
    print("\nFirst request:")
    response1 = requests.post(f"{BASE_URL}/hatch/contact", headers=headers, json=payload)
    if response1.status_code == 200:
        result1 = response1.json()
        print(f"Source: {result1.get('source')}")
        print(f"Name: {result1.get('first_name')} {result1.get('last_name')}")
    
    # Second request (should definitely hit cache)
    print("\nSecond request:")
    response2 = requests.post(f"{BASE_URL}/hatch/contact", headers=headers, json=payload)
    if response2.status_code == 200:
        result2 = response2.json()
        print(f"Source: {result2.get('source')}")
        print(f"Name: {result2.get('first_name')} {result2.get('last_name')}")
        return result2.get('source') == 'cache'
    
    return False

if __name__ == "__main__":
    print("=== Hatch API Integration Tests ===\n")
    
    SAMPLE_PROFILE_ID = "68dc08f0b39318ee3cbeaa2d"  # Replace with real _id
    SAMPLE_PROFILE_IDS = [
        "68dc08f0b39318ee3cbeaa2e",  
        "68dc08f0b39318ee3cbeaa2f",  
    ]
    
    print("⚠️ Make sure to replace the profile IDs with actual MongoDB _ids from mydatabase/profiles")
    print(f"Using profile ID: {SAMPLE_PROFILE_ID}")
    print(f"Using bulk profile IDs: {SAMPLE_PROFILE_IDS}\n")
    
    # Step 1: Login
    token = test_login()
    if not token:
        print("\n❌ Cannot proceed without valid token")
        exit(1)
    
    # Step 2: Test single contact
    single_success = test_single_contact(token, SAMPLE_PROFILE_ID)
    
    # Step 3: Test bulk contact
    bulk_success = test_bulk_contact(token, SAMPLE_PROFILE_IDS)
    
    # Step 4: Test caching
    cache_success = test_cache_hit(token, SAMPLE_PROFILE_ID)
    
    # Summary
    print("\n=== Test Summary ===")
    print(f"Single Contact: {'✅ PASS' if single_success else '❌ FAIL'}")
    print(f"Bulk Contact: {'✅ PASS' if bulk_success else '❌ FAIL'}")
    print(f"Cache Hit: {'✅ PASS' if cache_success else '❌ FAIL'}")