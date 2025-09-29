#!/usr/bin/env python3
"""
Test script to demonstrate the new followup question flow.

This script shows how the workflow now pauses after generating followup questions
and waits for answers before proceeding to score and rank profiles.
"""

import asyncio
import json
import requests
import websockets
import time

# Configuration
API_BASE_URL = "http://localhost:8000"
WS_BASE_URL = "ws://localhost:8000"

async def test_followup_flow():
    """Test the complete followup question flow."""
    
    print("🧪 Testing Followup Question Flow")
    print("=" * 50)
    
    # Step 1: Submit a prompt to start the workflow
    print("\n1️⃣ Submitting prompt to start workflow...")
    prompt_data = {
        "prompt": "I need a senior software engineer with 5+ years of experience in Python and React, located in San Francisco, for a fintech startup."
    }
    
    response = requests.post(f"{API_BASE_URL}/parse-prompt", json=prompt_data)
    if response.status_code != 200:
        print(f"❌ Failed to submit prompt: {response.text}")
        return
    
    session_data = response.json()
    session_id = session_data["session_id"]
    print(f"✅ Session created: {session_id}")
    
    # Step 2: Connect to WebSocket to receive real-time updates
    print(f"\n2️⃣ Connecting to WebSocket for session {session_id}...")
    
    async def websocket_listener():
        uri = f"{WS_BASE_URL}/session/{session_id}"
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected")
            
            # Listen for messages
            while True:
                try:
                    message = await websocket.recv()
                    data = json.loads(message)
                    action = data.get("action")
                    action_data = data.get("data")
                    
                    print(f"📨 Received: {action}")
                    
                    if action == "followup_questions":
                        print(f"❓ Followup questions received:")
                        for i, question in enumerate(action_data, 1):
                            print(f"   {i}. {question}")
                        
                        # Step 3: Answer the followup questions
                        print(f"\n3️⃣ Answering followup questions...")
                        await answer_followup_questions(websocket, action_data)
                        
                    elif action == "final_results":
                        print(f"🎉 Final results received!")
                        profiles = action_data.get("profiles", [])
                        print(f"📊 Found {len(profiles)} curated profiles")
                        
                        # Show top 3 profiles
                        for i, profile in enumerate(profiles[:3], 1):
                            name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}"
                            title = profile.get('title', 'No title')
                            score = profile.get('scores', {}).get('overall', 0)
                            print(f"   {i}. {name} - {title} (Score: {score:.2f})")
                        
                        break
                        
                    elif action == "workflow_status":
                        print(f"📊 Workflow status: {action_data}")
                        
                except websockets.exceptions.ConnectionClosed:
                    print("🔌 WebSocket connection closed")
                    break
                except Exception as e:
                    print(f"❌ WebSocket error: {e}")
                    break
    
    # Start the WebSocket listener
    await websocket_listener()
    
    print(f"\n✅ Test completed for session {session_id}")

async def answer_followup_questions(websocket, questions):
    """Answer the followup questions via WebSocket."""
    
    # Sample answers for demonstration
    sample_answers = [
        "Yes, AWS certification is preferred but not required",
        "We prefer candidates with experience in companies with 50-500 employees",
        "Remote work is acceptable, but we prefer candidates who can work in the office at least 2 days per week"
    ]
    
    for i, question in enumerate(questions):
        answer = sample_answers[i] if i < len(sample_answers) else "No specific requirements"
        
        # Send answer via WebSocket
        answer_message = {
            "action": "answer",
            "question": question,
            "answer": answer
        }
        
        await websocket.send(json.dumps(answer_message))
        print(f"   ✅ Answered: {question[:50]}... -> {answer[:30]}...")
        
        # Small delay between answers
        await asyncio.sleep(1)
    
    print("✅ All followup questions answered!")

def test_manual_resume():
    """Test manual workflow resume functionality."""
    
    print("\n🔧 Testing Manual Resume Functionality")
    print("=" * 50)
    
    # This would be used if you want to manually resume a workflow
    # that's waiting for followup answers
    session_id = "test-session-id"  # Replace with actual session ID
    
    response = requests.post(f"{API_BASE_URL}/session/{session_id}/resume")
    if response.status_code == 200:
        print("✅ Manual resume successful")
        print(response.json())
    else:
        print(f"❌ Manual resume failed: {response.text}")

if __name__ == "__main__":
    print("🚀 Starting Followup Flow Test")
    print("Make sure the backend server is running on http://localhost:8000")
    print()
    
    # Run the async test
    asyncio.run(test_followup_flow())
    
    # Uncomment to test manual resume
    # test_manual_resume()
