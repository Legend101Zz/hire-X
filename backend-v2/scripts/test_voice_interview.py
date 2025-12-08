#!/usr/bin/env python3
"""
Voice Interview Testing Script
==============================
Test the Vapi-powered voice interview system end-to-end.

Usage:
    python scripts/test_voice_interview.py

This script will:
1. Create a test interview session with sample candidate data
2. Prompt you for a phone number to call
3. Place the call and conduct the interview
4. Display real-time status updates
5. Show final results after completion

Author: NeuraLeap Engineering
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from dotenv import load_dotenv

load_dotenv()

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/")
AUTH_TOKEN = os.getenv("TEST_AUTH_TOKEN", "")  # Your JWT token

# Sample candidate data
SAMPLE_CANDIDATE = {
    "candidate_id": "test-candidate-001",
    "name": "Mrigesh Thakur",
    "phone_number": "",  # Will be filled from user input
    "current_title": "Senior Software Engineer",
    "current_company": "Tech Corp India",
    "experience_years": 6,
    "skills": [
        "Python", "Django", "FastAPI", "PostgreSQL", 
        "AWS", "Docker", "Kubernetes", "Redis",
        "React", "TypeScript"
    ],
    "location": "Bangalore, India",
    "education": "B.Tech in Computer Science, NIT Hamirpur",
    "linkedin_url": "https://www.linkedin.com/in/mrigesh-thakur-11new/",
    "enrichment_summary": (
        "Mrigesh Thakur is a strong backend engineer with 6 years of experience. "
        "He has led multiple projects at Tech Corp and has strong Python skills. "
        "Previously worked at a startup for 2 years. Active on GitHub with contributions "
        "to open source projects."
    ),
    "preferred_language": "en",
    "timezone": "Asia/Kolkata"
}

SAMPLE_JOB = {
    "job_id": "test-job-001",
    "job_title": "Senior Python Developer",
    "company_name": "NeuraLeap",
    "required_skills": [
        "Python", "FastAPI", "MongoDB", "Redis", "AWS"
    ],
    "nice_to_have_skills": [
        "Kubernetes", "Machine Learning", "TypeScript"
    ],
    "experience_required": "5+ years",
    "job_description_summary": (
        "We're looking for a Senior Python Developer to lead backend development "
        "for our AI-powered recruitment platform. You'll work on high-scale systems "
        "processing millions of profiles and building intelligent matching algorithms."
    ),
    "key_responsibilities": [
        "Lead backend development with Python/FastAPI",
        "Design and implement scalable APIs",
        "Work with MongoDB and Redis for data management",
        "Mentor junior developers",
        "Collaborate with AI/ML team on integration"
    ],
    "evaluation_criteria": [
        "Python proficiency and best practices",
        "System design and scalability thinking",
        "Problem-solving approach",
        "Communication skills",
        "Team collaboration"
    ],
    "deal_breakers": [
        "No experience with async programming",
        "Unable to explain past projects clearly"
    ]
}


class InterviewTester:
    """Test harness for voice interviews."""
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=60.0)
        self.session_id = None
        self.call_id = None
    
    async def close(self):
        await self.client.aclose()
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {AUTH_TOKEN}",
            "Content-Type": "application/json"
        }
    
    async def create_interview(self, phone_number: str, auto_call: bool = False):
        """Create a new interview session."""
        candidate = SAMPLE_CANDIDATE.copy()
        candidate["phone_number"] = phone_number
        
        payload = {
            "candidate": candidate,
            "job": SAMPLE_JOB,
            "auto_call": auto_call,
            "custom_questions": [
                "Can you tell me about your experience with FastAPI? - "
                "What makes it different from Django in your opinion?"
            ]
        }
        
        print("\n📝 Creating interview session...")
        print(f"   Candidate: {candidate['name']}")
        print(f"   Phone: {phone_number}")
        print(f"   Job: {SAMPLE_JOB['job_title']}")
        
        response = await self.client.post(
            f"{API_BASE_URL}/voice-interview/create",
            headers=self.get_headers(),
            json=payload
        )
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return None
        
        data = response.json()
        self.session_id = data["session_id"]
        self.call_id = data.get("call_id")
        
        print(f"✅ Session created: {self.session_id}")
        print(f"   Vapi Assistant: {data.get('vapi_assistant_id')}")
        print(f"   Questions planned: {len(data.get('plan', {}).get('questions', []))}")
        
        if data.get("plan"):
            print("\n📋 Interview Plan:")
            for q in data["plan"]["questions"]:
                print(f"   {q['order']}. [{q['question_type']}] {q['question_text'][:80]}...")
        
        return data
    
    async def start_call(self):
        """Start the outbound call."""
        if not self.session_id:
            print("❌ No session created. Create interview first.")
            return None
        
        print(f"\n📞 Starting call for session {self.session_id}...")
        
        response = await self.client.post(
            f"{API_BASE_URL}/voice-interview/{self.session_id}/start",
            headers=self.get_headers()
        )
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return None
        
        data = response.json()
        self.call_id = data["call_id"]
        
        print(f"✅ Call initiated: {self.call_id}")
        print(f"   Status: {data['status']}")
        print("\n🎤 Interview is now in progress...")
        print("   The candidate's phone should be ringing.")
        print("   Press Ctrl+C to stop monitoring.\n")
        
        return data
    
    async def monitor_status(self, interval: int = 5):
        """Monitor interview status until completion."""
        if not self.session_id:
            print("❌ No session to monitor")
            return
        
        print("📊 Monitoring interview status...")
        print("=" * 60)
        
        completed_statuses = ["completed", "failed", "no_answer", "voicemail", "cancelled"]
        
        while True:
            try:
                response = await self.client.get(
                    f"{API_BASE_URL}/voice-interview/{self.session_id}",
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data["status"]
                    
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    print(f"[{timestamp}] Status: {status}", end="")
                    
                    if data.get("call_info", {}).get("duration_minutes"):
                        print(f" | Duration: {data['call_info']['duration_minutes']:.1f} min", end="")
                    
                    if data.get("clips"):
                        print(f" | Clips: {len(data['clips'])}", end="")
                    
                    print()
                    
                    if status in completed_statuses:
                        print("\n" + "=" * 60)
                        print(f"Interview {status.upper()}")
                        return data
                
                await asyncio.sleep(interval)
                
            except KeyboardInterrupt:
                print("\n\nMonitoring stopped.")
                break
            except Exception as e:
                print(f"Error: {e}")
                await asyncio.sleep(interval)
        
        return None
    
    async def get_results(self):
        """Get final interview results."""
        if not self.session_id:
            print("❌ No session")
            return None
        
        print(f"\n📊 Fetching results for {self.session_id}...")
        
        response = await self.client.get(
            f"{API_BASE_URL}/voice-interview/{self.session_id}",
            headers=self.get_headers()
        )
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            return None
        
        data = response.json()
        
        print("\n" + "=" * 60)
        print("INTERVIEW RESULTS")
        print("=" * 60)
        
        print(f"\n👤 Candidate: {data['candidate']['name']}")
        print(f"📋 Job: {data['job']['title']}")
        print(f"📊 Status: {data['status']}")
        
        if data.get("call_info"):
            info = data["call_info"]
            if info.get("duration_minutes"):
                print(f"⏱️  Duration: {info['duration_minutes']:.1f} minutes")
            if info.get("end_reason"):
                print(f"📞 End reason: {info['end_reason']}")
        
        if data.get("recording_url"):
            print(f"\n🎙️ Recording: {data['recording_url']}")
        
        if data.get("clips"):
            print(f"\n📎 Response Clips ({len(data['clips'])} total):")
            print("-" * 40)
            for i, clip in enumerate(data["clips"], 1):
                print(f"\n{i}. [{clip['question_type']}]")
                print(f"   Q: {clip['question'][:100]}...")
                print(f"   A: {clip['response'][:150]}...")
                if clip.get("score"):
                    print(f"   Score: {clip['score']}/100")
                if clip.get("is_highlight"):
                    print("   ⭐ HIGHLIGHT")
        
        if data.get("assessment"):
            assess = data["assessment"]
            print("\n" + "=" * 60)
            print("FINAL ASSESSMENT")
            print("=" * 60)
            print(f"\n📊 Overall Score: {assess.get('overall_score', 'N/A')}/100")
            print(f"💻 Technical: {assess.get('technical_score', 'N/A')}/100")
            print(f"🗣️  Communication: {assess.get('communication_score', 'N/A')}/100")
            print(f"🤝 Culture Fit: {assess.get('culture_fit_score', 'N/A')}/100")
            print(f"\n🎯 Recommendation: {assess.get('recommendation', 'N/A').upper()}")
            print(f"   Confidence: {assess.get('recommendation_confidence', 'N/A')}")
            
            if assess.get("top_strengths"):
                print("\n💪 Strengths:")
                for s in assess["top_strengths"]:
                    print(f"   • {s}")
            
            if assess.get("concerns"):
                print("\n⚠️  Concerns:")
                for c in assess["concerns"]:
                    print(f"   • {c}")
            
            if assess.get("executive_summary"):
                print(f"\n📝 Summary: {assess['executive_summary']}")
        
        return data


async def run_standalone_test():
    """Run test without API server (direct service call)."""
    from models.vapi_interview_models import (CreateInterviewRequest,
                                              InterviewCandidateContext,
                                              InterviewJobContext)
    from services.vapi_interview_service import VapiInterviewService
    
    print("=" * 60)
    print("NEURALEAP VOICE INTERVIEW - STANDALONE TEST")
    print("=" * 60)
    
    # Get phone number
    phone = input("\n📱 Enter phone number to call (with country code, e.g., +919876543210): ").strip()
    
    if not phone.startswith("+"):
        phone = f"+91{phone}"  # Default to India
    
    print(f"\n   Will call: {phone}")
    
    # Create service
    service = VapiInterviewService()
    
    # Build request
    candidate = InterviewCandidateContext(
        candidate_id="test-001",
        name="Mrigesh Thakur",
        phone_number=phone,
        current_title="Senior Software Engineer",
        current_company="Tech Corp India",
        experience_years=6,
        skills=["Python", "Django", "FastAPI", "PostgreSQL", "AWS", "Docker"],
        location="Bangalore, India"
    )
    
    job = InterviewJobContext(
        job_title="Senior Python Developer",
        company_name="NeuraLeap",
        required_skills=["Python", "FastAPI", "MongoDB", "Redis", "AWS"],
        nice_to_have_skills=["Kubernetes", "ML"],
        experience_required="5+ years",
        key_responsibilities=[
            "Backend development",
            "API design",
            "Team mentoring"
        ]
    )
    
    request = CreateInterviewRequest(
        candidate=candidate,
        job=job,
        auto_call=True  # Start immediately
    )
    
    try:
        print("\n🚀 Creating and starting interview...")
        response = await service.create_interview(request, "test_user")
        
        print(f"\n✅ Interview created: {response.session_id}")
        print(f"   Call ID: {response.call_id}")
        print("\n📞 Call is being placed. Answer the phone!")
        print("   The AI interviewer will conduct the interview.")
        print("\n   Press Ctrl+C to stop.\n")
        
        # Monitor until complete
        while True:
            await asyncio.sleep(5)
            session = await service.get_session(response.session_id)
            if session:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Status: {session.status.value}")
                
                if session.status.value in ["completed", "failed", "no_answer", "voicemail"]:
                    break
        
        # Get final results
        print("\n" + "=" * 60)
        results = await service.get_interview_results(response.session_id)
        if results:
            print(json.dumps(results, indent=2, default=str))
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted.")
    finally:
        await service.close()


async def run_api_test():
    """Run test via API endpoints."""
    print("=" * 60)
    print("NEURALEAP VOICE INTERVIEW - API TEST")
    print("=" * 60)
    
    if not AUTH_TOKEN:
        print("\n⚠️  No AUTH_TOKEN set. Please set TEST_AUTH_TOKEN in .env")
        print("   Or run standalone test with: python test_voice_interview.py --standalone")
        return
    
    # Get phone number
    phone = input("\n📱 Enter phone number to call (with country code): ").strip()
    
    if not phone.startswith("+"):
        phone = f"+91{phone}"
    
    print(f"   Will call: {phone}")
    
    confirm = input("\n🎯 Ready to start interview? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        return
    
    tester = InterviewTester()
    
    try:
        # Create interview (without auto_call)
        await tester.create_interview(phone, auto_call=False)
        
        if tester.session_id:
            # Start the call
            start_confirm = input("\n📞 Start the call now? (y/n): ").strip().lower()
            if start_confirm == "y":
                await tester.start_call()
                
                # Monitor
                final_data = await tester.monitor_status()
                
                if final_data:
                    # Show results
                    await tester.get_results()
    
    finally:
        await tester.close()


async def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test NeuraLeap Voice Interview")
    parser.add_argument("--standalone", action="store_true", help="Run without API server")
    parser.add_argument("--phone", type=str, help="Phone number to call")
    args = parser.parse_args()
    
    if args.standalone:
        await run_standalone_test()
    else:
        await run_api_test()


if __name__ == "__main__":
    asyncio.run(main())