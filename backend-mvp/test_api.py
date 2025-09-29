#!/usr/bin/env python3
"""
Test script for the Hiring Prompt Parser API with WebSocket support
"""
import requests
import json
import asyncio
import websockets
import time
from typing import Optional

class APITester:
    """Test client for the Neural Leap API with WebSocket support."""
    
    def __init__(self, base_url: str = "http://localhost:8000", ws_url: str = "ws://localhost:8000"):
        self.base_url = base_url
        self.ws_url = ws_url
        self.session_id: Optional[str] = None
        self.websocket = None
    
    def test_api_connection(self) -> bool:
        """Test basic API connectivity."""
        print("🔍 Testing API connection...")
        try:
            response = requests.get(f"{self.base_url}/")
            print(f"✅ API Status: {response.status_code}")
            print(f"Response: {response.json()}")
            return True
        except requests.exceptions.ConnectionError:
            print("❌ API server is not running. Please start it with: python main.py")
            return False
    
    def create_test_prompt(self) -> str:
        """Create a comprehensive test prompt."""
        return """
        We are looking for a Senior Full Stack Developer to join our growing team in San Francisco. 
        
        Requirements:
        - 5+ years of experience in web development
        - Strong proficiency in React, Node.js, and TypeScript
        - Experience with cloud platforms (AWS, GCP, or Azure)
        - Knowledge of modern databases (PostgreSQL, MongoDB)
        - Experience with CI/CD pipelines and DevOps practices
        - Strong problem-solving skills and ability to work in agile environments
        - Previous experience in fintech or e-commerce preferred
        - Bachelor's degree in Computer Science or related field
        
        Responsibilities:
        - Develop and maintain scalable web applications
        - Collaborate with cross-functional teams
        - Lead technical architecture decisions
        - Mentor junior developers
        - Participate in code reviews and technical discussions
        
        We offer competitive salary, equity, health benefits, and flexible work arrangements.
        """
    
    def parse_prompt(self) -> bool:
        """Call the parse-prompt endpoint and get session ID."""
        print("\n🚀 Testing parse-prompt endpoint...")
        test_prompt = self.create_test_prompt()
        
        try:
            response = requests.post(
                f"{self.base_url}/parse-prompt", 
                json={"prompt": test_prompt.strip()},
                headers={"Content-Type": "application/json"}
            )
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                self.session_id = result.get("session_id")
                print("✅ Success! Session created:")
                print(json.dumps(result, indent=2))
                print(f"📋 Session ID: {self.session_id}")
                return True
            else:
                print(f"❌ Error: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    
    def check_session_status(self) -> bool:
        """Check session status via REST API."""
        if not self.session_id:
            print("❌ No session ID available")
            return False
            
        print(f"\n📊 Checking session status for: {self.session_id}")
        try:
            response = requests.get(f"{self.base_url}/session/{self.session_id}/status")
            if response.status_code == 200:
                status_result = response.json()
                print("✅ Session status:")
                print(json.dumps(status_result, indent=2))
                return True
            else:
                print(f"❌ Error getting session status: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error: {e}")
            return False
    
    async def connect_websocket(self) -> bool:
        """Connect to WebSocket for real-time updates."""
        if not self.session_id:
            print("❌ No session ID available for WebSocket connection")
            return False
            
        ws_endpoint = f"{self.ws_url}/session/{self.session_id}"
        print(f"\n🔌 Connecting to WebSocket: {ws_endpoint}")
        
        try:
            self.websocket = await websockets.connect(ws_endpoint)
            print("✅ WebSocket connected successfully!")
            
            # Send a test message
            test_message = "Hello from test client!"
            await self.websocket.send(test_message)
            print(f"📤 Sent test message: {test_message}")
            
            return True
            
        except Exception as e:
            print(f"❌ WebSocket connection failed: {e}")
            return False
    
    async def listen_for_updates(self, duration: int = 30):
        """Listen for WebSocket updates for specified duration."""
        if not self.websocket:
            print("❌ No WebSocket connection available")
            return
            
        print(f"\n👂 Listening for updates for {duration} seconds...")
        print("Press Ctrl+C to stop early")
        
        try:
            timeout = duration
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                try:
                    # Wait for message with timeout
                    message = await asyncio.wait_for(
                        self.websocket.recv(), 
                        timeout=1.0
                    )
                    
                    print(f"📨 Received WebSocket message:")
                    try:
                        # Try to parse as JSON
                        parsed_message = json.loads(message)
                        print(json.dumps(parsed_message, indent=2))
                    except json.JSONDecodeError:
                        # If not JSON, print as text
                        print(f"Raw message: {message}")
                        
                except asyncio.TimeoutError:
                    # No message received in timeout, continue listening
                    continue
                except websockets.exceptions.ConnectionClosed:
                    print("🔌 WebSocket connection closed by server")
                    break
                    
        except KeyboardInterrupt:
            print("\n⏹️  Stopped listening (Ctrl+C pressed)")
        except Exception as e:
            print(f"❌ Error while listening: {e}")
    
    async def close_websocket(self):
        """Close WebSocket connection."""
        if self.websocket:
            await self.websocket.close()
            print("🔌 WebSocket connection closed")
    
    async def run_full_test(self):
        """Run the complete test suite."""
        print("🧪 Starting Neural Leap API Test Suite")
        print("=" * 50)
        
        # Test 1: API Connection
        if not self.test_api_connection():
            return
        
        # Test 2: Parse Prompt
        if not self.parse_prompt():
            return
        
        # Test 3: Check Session Status
        self.check_session_status()
        
        # Test 4: Connect WebSocket
        if not await self.connect_websocket():
            return
        
        # Test 5: Listen for Updates
        await self.listen_for_updates(duration=30)
        
        # Cleanup
        await self.close_websocket()
        
        print("\n✅ Test suite completed!")

def test_api_sync():
    """Synchronous version of the API test."""
    base_url = "http://localhost:8000"
    
    print("🧪 Running Synchronous API Tests")
    print("=" * 40)
    
    # Test the root endpoint
    print("Testing root endpoint...")
    try:
        response = requests.get(f"{base_url}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except requests.exceptions.ConnectionError:
        print("❌ API server is not running. Please start it with: python main.py")
        return
    
    # Test the parse-prompt endpoint
    print("\nTesting parse-prompt endpoint...")
    test_prompt = "We need a Senior Python Developer with 7 years of experience in machine learning, AI, and cloud computing. Must have experience with TensorFlow, PyTorch, and AWS."
    
    try:
        response = requests.post(
            f"{base_url}/parse-prompt", 
            json={"prompt": test_prompt},
            headers={"Content-Type": "application/json"}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            session_id = result.get("session_id")
            print("✅ Success! Session created:")
            print(json.dumps(result, indent=2))
            
            # Test session status endpoint
            if session_id:
                print(f"\nTesting session status for: {session_id}")
                status_response = requests.get(f"{base_url}/session/{session_id}/status")
                if status_response.status_code == 200:
                    status_result = status_response.json()
                    print("✅ Session status:")
                    print(json.dumps(status_result, indent=2))
                else:
                    print(f"❌ Error getting session status: {status_response.text}")
        else:
            print(f"❌ Error: {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")

async def main():
    """Main entry point."""
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--sync":
        # Run synchronous tests only
        test_api_sync()
    else:
        # Run full async test suite
        tester = APITester()
        await tester.run_full_test()

if __name__ == "__main__":
    """
    Usage examples:
    
    # Run full test suite (includes WebSocket testing)
    python test_api.py
    
    # Run synchronous tests only (no WebSocket)
    python test_api.py --sync
    
    Make sure to:
    1. Install dependencies: pip install -r requirements.txt
    2. Start the API server: python main.py
    3. Start Redis server if not already running
    """
    asyncio.run(main())
