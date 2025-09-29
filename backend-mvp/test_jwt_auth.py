#!/usr/bin/env python3
"""
Test script to verify JWT authentication is working properly.
"""
import requests
import json

class JWTAuthTester:
    """Test JWT authentication implementation."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.token = None
    
    def test_login(self) -> bool:
        """Test login endpoint to get JWT token."""
        print("🔐 Testing login endpoint...")
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        
        try:
            response = requests.post(f"{self.base_url}/login", json=login_data)
            print(f"Login Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print(f"✅ Login successful! Token received: {self.token[:50]}...")
                return True
            else:
                print(f"❌ Login failed: {response.text}")
                return False
                
        except requests.exceptions.ConnectionError:
            print("❌ API server is not running. Please start it with: python main.py")
            return False
        except Exception as e:
            print(f"❌ Login error: {e}")
            return False
    
    def test_protected_endpoint_without_token(self) -> bool:
        """Test protected endpoint without JWT token."""
        print("\n🚫 Testing protected endpoint without token...")
        
        try:
            response = requests.post(f"{self.base_url}/parse-prompt", json={"prompt": "test prompt"})
            print(f"Status without token: {response.status_code}")
            
            if response.status_code == 401:
                print("✅ Correctly rejected request without token")
                return True
            else:
                print(f"❌ Should have been rejected. Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing without token: {e}")
            return False
    
    def test_protected_endpoint_with_token(self) -> bool:
        """Test protected endpoint with valid JWT token."""
        print("\n🔑 Testing protected endpoint with valid token...")
        
        if not self.token:
            print("❌ No token available. Run test_login() first.")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/parse-prompt", 
                json={"prompt": "Find me a senior developer with React experience"},
                headers=headers
            )
            print(f"Status with token: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Request successful! Session ID: {data.get('session_id')}")
                return True
            else:
                print(f"❌ Request failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing with token: {e}")
            return False
    
    def test_invalid_token(self) -> bool:
        """Test protected endpoint with invalid JWT token."""
        print("\n🔒 Testing protected endpoint with invalid token...")
        
        headers = {
            "Authorization": "Bearer invalid_token_here",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/parse-prompt", 
                json={"prompt": "test prompt"},
                headers=headers
            )
            print(f"Status with invalid token: {response.status_code}")
            
            if response.status_code == 401:
                print("✅ Correctly rejected request with invalid token")
                return True
            else:
                print(f"❌ Should have been rejected. Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error testing invalid token: {e}")
            return False
    
    def test_public_endpoints(self) -> bool:
        """Test that public endpoints still work without authentication."""
        print("\n🌐 Testing public endpoints...")
        
        public_endpoints = [
            ("/", "GET"),
            ("/health", "GET"),
        ]
        
        all_passed = True
        
        for endpoint, method in public_endpoints:
            try:
                if method == "GET":
                    response = requests.get(f"{self.base_url}{endpoint}")
                else:
                    response = requests.post(f"{self.base_url}{endpoint}")
                
                print(f"{endpoint} ({method}): {response.status_code}")
                
                if response.status_code == 200:
                    print(f"✅ {endpoint} accessible without authentication")
                else:
                    print(f"❌ {endpoint} should be accessible without authentication")
                    all_passed = False
                    
            except Exception as e:
                print(f"❌ Error testing {endpoint}: {e}")
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self) -> bool:
        """Run all JWT authentication tests."""
        print("🧪 Running JWT Authentication Tests\n")
        
        tests = [
            ("Login", self.test_login),
            ("Protected endpoint without token", self.test_protected_endpoint_without_token),
            ("Protected endpoint with valid token", self.test_protected_endpoint_with_token),
            ("Protected endpoint with invalid token", self.test_invalid_token),
            ("Public endpoints", self.test_public_endpoints),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            print(f"\n{'='*50}")
            print(f"Running: {test_name}")
            print('='*50)
            
            try:
                result = test_func()
                results.append((test_name, result))
                print(f"Result: {'✅ PASSED' if result else '❌ FAILED'}")
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
                results.append((test_name, False))
        
        # Summary
        print(f"\n{'='*50}")
        print("TEST SUMMARY")
        print('='*50)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All JWT authentication tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the implementation.")
            return False

if __name__ == "__main__":
    tester = JWTAuthTester()
    tester.run_all_tests()
