#!/usr/bin/env python3
"""
Test script to verify WebSocket authentication is working properly.
"""
import asyncio
import websockets
import requests
import json

class WebSocketAuthTester:
    """Test WebSocket authentication implementation."""
    
    def __init__(self, base_url: str = "http://localhost:8000", ws_url: str = "ws://localhost:8000"):
        self.base_url = base_url
        self.ws_url = ws_url
        self.token = None
        self.session_id = None
    
    def get_auth_token(self) -> bool:
        """Get JWT token for authentication."""
        print("🔐 Getting authentication token...")
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        
        try:
            response = requests.post(f"{self.base_url}/login", json=login_data)
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                print(f"✅ Token received: {self.token[:50]}...")
                return True
            else:
                print(f"❌ Login failed: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error getting token: {e}")
            return False
    
    def create_test_session(self) -> bool:
        """Create a test session to connect to."""
        print("📝 Creating test session...")
        
        if not self.token:
            print("❌ No token available. Run get_auth_token() first.")
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
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get("session_id")
                print(f"✅ Session created: {self.session_id}")
                return True
            else:
                print(f"❌ Session creation failed: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error creating session: {e}")
            return False
    
    async def test_websocket_without_token(self) -> bool:
        """Test WebSocket connection without token."""
        print("\n🚫 Testing WebSocket connection without token...")
        
        if not self.session_id:
            print("❌ No session ID available. Run create_test_session() first.")
            return False
        
        try:
            # Try to connect without token
            uri = f"{self.ws_url}/session/{self.session_id}"
            async with websockets.connect(uri) as websocket:
                print("❌ Connection should have been rejected")
                return False
        except websockets.exceptions.InvalidStatusCode as e:
            if e.status_code == 400:  # Bad Request - missing required parameter
                print("✅ Correctly rejected connection without token")
                return True
            else:
                print(f"❌ Unexpected status code: {e.status_code}")
                return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False
    
    async def test_websocket_with_invalid_token(self) -> bool:
        """Test WebSocket connection with invalid token."""
        print("\n🔒 Testing WebSocket connection with invalid token...")
        
        if not self.session_id:
            print("❌ No session ID available. Run create_test_session() first.")
            return False
        
        try:
            # Try to connect with invalid token
            uri = f"{self.ws_url}/session/{self.session_id}?token=invalid_token_here"
            async with websockets.connect(uri) as websocket:
                print("❌ Connection should have been rejected")
                return False
        except websockets.exceptions.ConnectionClosed as e:
            if e.code == 1008:  # Policy violation - invalid token
                print("✅ Correctly rejected connection with invalid token")
                return True
            else:
                print(f"❌ Unexpected close code: {e.code}, reason: {e.reason}")
                return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False
    
    async def test_websocket_with_valid_token(self) -> bool:
        """Test WebSocket connection with valid token."""
        print("\n🔑 Testing WebSocket connection with valid token...")
        
        if not self.session_id or not self.token:
            print("❌ No session ID or token available. Run get_auth_token() and create_test_session() first.")
            return False
        
        try:
            # Try to connect with valid token
            uri = f"{self.ws_url}/session/{self.session_id}?token={self.token}"
            async with websockets.connect(uri) as websocket:
                print("✅ Successfully connected with valid token")
                
                # Wait a moment to receive any initial data
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    print(f"📨 Received message: {message[:100]}...")
                except asyncio.TimeoutError:
                    print("⏰ No initial message received (this is normal)")
                
                return True
        except websockets.exceptions.ConnectionClosed as e:
            print(f"❌ Connection closed unexpectedly: code={e.code}, reason={e.reason}")
            return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False
    
    async def test_websocket_wrong_session(self) -> bool:
        """Test WebSocket connection with valid token but wrong session."""
        print("\n🔐 Testing WebSocket connection with valid token but wrong session...")
        
        if not self.token:
            print("❌ No token available. Run get_auth_token() first.")
            return False
        
        try:
            # Try to connect to a session that doesn't exist
            fake_session_id = "00000000-0000-0000-0000-000000000000"
            uri = f"{self.ws_url}/session/{fake_session_id}?token={self.token}"
            async with websockets.connect(uri) as websocket:
                print("❌ Connection should have been rejected")
                return False
        except websockets.exceptions.ConnectionClosed as e:
            if e.code == 1008:  # Policy violation
                print("✅ Correctly rejected connection to non-existent session")
                return True
            else:
                print(f"❌ Unexpected close code: {e.code}, reason: {e.reason}")
                return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False
    
    async def run_all_tests(self) -> bool:
        """Run all WebSocket authentication tests."""
        print("🧪 Running WebSocket Authentication Tests\n")
        
        # First, get authentication token
        if not self.get_auth_token():
            print("❌ Failed to get authentication token. Cannot proceed with tests.")
            return False
        
        # Create a test session
        if not self.create_test_session():
            print("❌ Failed to create test session. Cannot proceed with tests.")
            return False
        
        # Run WebSocket tests
        tests = [
            ("WebSocket without token", self.test_websocket_without_token),
            ("WebSocket with invalid token", self.test_websocket_with_invalid_token),
            ("WebSocket with valid token", self.test_websocket_with_valid_token),
            ("WebSocket with wrong session", self.test_websocket_wrong_session),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            print(f"\n{'='*60}")
            print(f"Running: {test_name}")
            print('='*60)
            
            try:
                result = await test_func()
                results.append((test_name, result))
                print(f"Result: {'✅ PASSED' if result else '❌ FAILED'}")
            except Exception as e:
                print(f"❌ Test failed with exception: {e}")
                results.append((test_name, False))
        
        # Summary
        print(f"\n{'='*60}")
        print("TEST SUMMARY")
        print('='*60)
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All WebSocket authentication tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the implementation.")
            return False

async def main():
    tester = WebSocketAuthTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
