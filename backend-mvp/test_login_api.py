"""
Test script for the login API endpoint.
Run this script to test the login functionality.
"""
import asyncio
import requests
import json


async def test_login_api():
    """Test the login API with valid and invalid credentials."""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Login API...")
    print("=" * 50)
    
    # Test 1: Valid credentials
    print("\n1. Testing with valid credentials...")
    valid_credentials = {
        "username": "testuser",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(f"{base_url}/login", json=valid_credentials)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful!")
            print(f"Access Token: {data['access_token'][:50]}...")
            print(f"Token Type: {data['token_type']}")
            print(f"User ID: {data['user_id']}")
            print(f"Username: {data['username']}")
        else:
            print(f"❌ Login failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing valid login: {e}")
    
    # Test 2: Invalid credentials
    print("\n2. Testing with invalid credentials...")
    invalid_credentials = {
        "username": "testuser",
        "password": "wrongpassword"
    }
    
    try:
        response = requests.post(f"{base_url}/login", json=invalid_credentials)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Correctly rejected invalid credentials!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Unexpected response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing invalid login: {e}")
    
    # Test 3: Non-existent user
    print("\n3. Testing with non-existent user...")
    nonexistent_credentials = {
        "username": "nonexistentuser",
        "password": "somepassword"
    }
    
    try:
        response = requests.post(f"{base_url}/login", json=nonexistent_credentials)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Correctly rejected non-existent user!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Unexpected response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing non-existent user: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Login API testing completed!")


if __name__ == "__main__":
    asyncio.run(test_login_api())
