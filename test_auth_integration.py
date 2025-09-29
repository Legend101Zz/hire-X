#!/usr/bin/env python3
"""
Test script to verify JWT authentication integration between frontend and backend.
"""

import requests
import json
import sys

# Configuration
BACKEND_URL = "http://localhost:8000"
TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpass123"

def test_login():
    """Test login endpoint and JWT token generation."""
    print("🔐 Testing login endpoint...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/login",
            json={
                "username": TEST_USERNAME,
                "password": TEST_PASSWORD
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful!")
            print(f"   Token: {data.get('access_token', 'N/A')[:50]}...")
            print(f"   Username: {data.get('username', 'N/A')}")
            print(f"   Token Type: {data.get('token_type', 'N/A')}")
            return data.get('access_token')
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure the server is running on localhost:8000")
        return None
    except Exception as e:
        print(f"❌ Login test failed: {e}")
        return None

def test_authenticated_request(token):
    """Test making an authenticated request to a protected endpoint."""
    if not token:
        print("❌ No token available for authenticated request test")
        return False
        
    print("\n🔒 Testing authenticated request...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/parse-prompt",
            json={"prompt": "Test prompt for authentication"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Authenticated request successful!")
            print(f"   Session ID: {data.get('session_id', 'N/A')}")
            print(f"   Message: {data.get('message', 'N/A')}")
            return True
        else:
            print(f"❌ Authenticated request failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Authenticated request test failed: {e}")
        return False

def test_unauthenticated_request():
    """Test that unauthenticated requests are rejected."""
    print("\n🚫 Testing unauthenticated request (should fail)...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/parse-prompt",
            json={"prompt": "Test prompt without authentication"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 401:
            print("✅ Unauthenticated request correctly rejected!")
            print(f"   Status: {response.status_code}")
            return True
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Unauthenticated request test failed: {e}")
        return False

def test_invalid_token():
    """Test that requests with invalid tokens are rejected."""
    print("\n🔑 Testing invalid token request (should fail)...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/parse-prompt",
            json={"prompt": "Test prompt with invalid token"},
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer invalid_token_12345"
            }
        )
        
        if response.status_code == 401:
            print("✅ Invalid token request correctly rejected!")
            print(f"   Status: {response.status_code}")
            return True
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Invalid token test failed: {e}")
        return False

def main():
    """Run all authentication tests."""
    print("🧪 JWT Authentication Integration Test")
    print("=" * 50)
    
    # Test 1: Login
    token = test_login()
    
    # Test 2: Authenticated request
    auth_success = test_authenticated_request(token)
    
    # Test 3: Unauthenticated request
    unauth_success = test_unauthenticated_request()
    
    # Test 4: Invalid token
    invalid_token_success = test_invalid_token()
    
    # Summary
    print("\n📊 Test Summary")
    print("=" * 20)
    print(f"Login: {'✅ PASS' if token else '❌ FAIL'}")
    print(f"Authenticated Request: {'✅ PASS' if auth_success else '❌ FAIL'}")
    print(f"Unauthenticated Rejection: {'✅ PASS' if unauth_success else '❌ FAIL'}")
    print(f"Invalid Token Rejection: {'✅ PASS' if invalid_token_success else '❌ FAIL'}")
    
    if token and auth_success and unauth_success and invalid_token_success:
        print("\n🎉 All tests passed! JWT authentication is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
