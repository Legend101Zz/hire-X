#!/usr/bin/env python3
"""
Voice Interview Testing Script V2
=================================
Test the Vapi-powered voice interview system end-to-end.

Updated for V4 service with:
- Shorter interviews (5-10 min)
- Natural voice with SSML
- Better candidate context
- Comprehensive error handling

Usage:
    python scripts/test_voice_interview.py
    python scripts/test_voice_interview.py --standalone
    python scripts/test_voice_interview.py --phone +919876543210

Author: NeuraLeap Engineering
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from dotenv import load_dotenv

# Import service for standalone testing
try:
    from models.vapi_interview_models import (CreateInterviewRequest,
                                              InterviewCandidateContext,
                                              InterviewJobContext)
    from services.vapi_interview_service import VapiInterviewService
except ImportError:
    print("⚠️  Service imports failed. Standalone mode might not work.")

load_dotenv()

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
AUTH_TOKEN = os.getenv("TEST_AUTH_TOKEN", "")

# Rich sample candidate data with enrichment context
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
        "React", "TypeScript", "MongoDB", "GraphQL"
    ],
    "location": "Bangalore, India",
    "education": "B.Tech in Computer Science, NIT Hamirpur",
    "linkedin_url": "https://www.linkedin.com/in/mrigesh-thakur-11new/",
    # Enrichment data - this is what makes the interview contextual
    "enrichment_summary": (
        "Mrigesh is a strong backend engineer with 6 years of experience, "
        "specializing in Python and distributed systems. He led the migration "
        "of a monolithic system to microservices at Tech Corp, reducing latency by 40%. "
        "Previously worked at a fintech startup where he built real-time payment processing. "
        "Active GitHub contributor with 500+ contributions in the last year. "
        "Known for clean code practices and mentoring junior developers."
    ),
    "skill_validations": {
        "validated_skills": ["Python", "FastAPI", "AWS", "Docker"],
        "unvalidated_skills": ["Kubernetes"],
        "skill_gaps": ["Machine Learning"],
        "overall_confidence": 85
    },
    "response_likelihood": 75,  # High - likely to engage
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
        "Looking for a Senior Python Developer to lead backend development "
        "for our AI-powered recruitment platform. Work on high-scale systems "
        "processing millions of profiles."
    ),
    "key_responsibilities": [
        "Lead backend development with Python/FastAPI",
        "Design scalable APIs",
        "Mentor junior developers"
    ],
    "evaluation_criteria": [
        "Python proficiency",
        "System design",
        "Communication skills"
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
            "custom_questions": []  # Let AI generate contextual questions
        }
        
        print("\n📝 Creating interview session...")
        print(f"   Candidate: {candidate['name']}")
        print(f"   Experience: {candidate['experience_years']} years")
        print(f"   Phone: {phone_number}")
        print(f"   Job: {SAMPLE_JOB['job_title']}")
        print(f"   Response Likelihood: {candidate.get('response_likelihood', 'N/A')}%")
        
        try:
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
            
            print(f"\n✅ Session created: {self.session_id}")
            print(f"   Vapi Assistant: {data.get('vapi_assistant_id')}")
            
            if data.get("plan"):
                plan = data["plan"]
                print(f"\n📋 Interview Plan ({len(plan.get('questions', []))} questions):")
                print(f"   Focus: {plan.get('interview_focus', 'N/A')}")
                print(f"   Duration: ~5-10 minutes")
                for q in plan.get("questions", [])[:3]:  # Show first 3
                    print(f"   • [{q['question_type']}] {q['question_text'][:60]}...")
            
            return data
            
        except httpx.RequestError as e:
            print(f"❌ Connection error: {e}")
            return None
    
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
        print("   📱 The candidate's phone should be ringing.")
        print("   ⏱️  Interview duration: 5-10 minutes")
        print("   🗣️  AI will keep responses short and natural")
        print("\n   Press Ctrl+C to stop monitoring.\n")
        
        return data

    async def retry_call(self):
        """Retry a failed call."""
        if not self.session_id:
            print("❌ No session to retry.")
            return None
            
        print(f"\n🔄 Retrying call for session {self.session_id}...")
        
        response = await self.client.post(
            f"{API_BASE_URL}/voice-interview/{self.session_id}/retry",
            headers=self.get_headers()
        )
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return None
            
        data = response.json()
        self.call_id = data["call_id"]
        print(f"✅ Retry initiated: {self.call_id}")
        return data

    async def get_results(self):
        """Fetch analysis results."""
        if not self.session_id:
            return
            
        print(f"\n📊 Fetching results for {self.session_id}...")
        
        response = await self.client.get(
            f"{API_BASE_URL}/voice-interview/{self.session_id}/results",
            headers=self.get_headers()
        )
        
        if response.status_code != 200:
            print(f"❌ Error fetching results: {response.status_code}")
            return
            
        data = response.json()
        
        # Display formatted results
        print("\n" + "="*50)
        print("       INTERVIEW RESULTS REPORT       ")
        print("="*50)
        print(f"Status: {data.get('status')}")
        print(f"Duration: {data.get('call_info', {}).get('duration_seconds', 0):.0f}s")
        print(f"Recording: {'Yes' if data.get('recording_url') else 'No'}")
        
        if data.get('assessment'):
            a = data['assessment']
            print("\n🏆 ASSESSMENT")
            print(f"   Overall Score: {a.get('overall_score', 0)}/100")
            print(f"   Recommendation: {a.get('recommendation', 'N/A').upper()}")
            print(f"   Summary: {a.get('executive_summary')}")
            
            print("\n💪 Strengths:")
            for s in a.get('top_strengths', []):
                print(f"   - {s}")
                
            print("\n🚩 Concerns:")
            for c in a.get('concerns', []):
                print(f"   - {c}")
        
        if data.get('clips'):
            print(f"\n🎬 Clips Generated: {len(data['clips'])}")
            for i, clip in enumerate(data['clips'][:3]):
                print(f"   {i+1}. {clip.get('question_type', 'Q')}: {clip.get('score', 'N/A')}/100")
                
        print("="*50 + "\n")
    
    async def monitor_status(self, interval: int = 3):
        """Monitor interview status until completion."""
        if not self.session_id:
            print("❌ No session to monitor")
            return None
            
        print("📡 Monitoring status... (Ctrl+C to stop)")
        last_status = None
        
        try:
            while True:
                response = await self.client.get(
                    f"{API_BASE_URL}/voice-interview/{self.session_id}/results",
                    headers=self.get_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status")
                    
                    if status != last_status:
                        print(f"   Status changed: {last_status} -> {status}")
                        last_status = status
                        
                    if status in ["completed", "failed", "no_answer", "voicemail", "cancelled"]:
                        print(f"\n🏁 Interview reached terminal status: {status}")
                        return data
                
                await asyncio.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped.")
            return None
        except Exception as e:
            print(f"\n❌ Error during monitoring: {e}")
            return None

# ============================================================================
# STANDALONE TESTING (NO API SERVER NEEDED)
# ============================================================================

async def run_standalone_test(phone_number: str = None):
    """Run test directly using service class (bypassing API)."""
    print("=" * 60)
    print("🎙️ NEURALEAP VOICE INTERVIEW - STANDALONE MODE")
    print("=" * 60)
    
    # 1. Setup
    if not phone_number:
        phone_number = input("\n📱 Enter phone number (with country code): ").strip()
        if not phone_number.startswith("+"):
            phone_number = f"+91{phone_number}"
            
    # Initialize service
    service = VapiInterviewService()
    
    try:
        # 2. Create Request Objects
        candidate = InterviewCandidateContext(**SAMPLE_CANDIDATE)
        candidate.phone_number = phone_number
        job = InterviewJobContext(**SAMPLE_JOB)
        
        request = CreateInterviewRequest(
            candidate=candidate,
            job=job,
            auto_call=False,
            custom_questions=[]
        )
        
        # 3. Create Interview
        print(f"\n📝 Creating interview for {candidate.name}...")
        result = await service.create_interview(request, username="tester")
        
        print(f"✅ Session created: {result.session_id}")
        print(f"   Assistant ID: {result.vapi_assistant_id}")
        
        # 4. Start Call
        confirm = input("\n📞 Start call now? (y/n): ").strip().lower()
        if confirm == "y":
            call_res = await service.start_call(result.session_id)
            print(f"✅ Call started: {call_res.call_id}")
            print("\n📡 Use the Vapi Dashboard to monitor the call.")
            print("   This script will exit as it cannot receive webhooks in standalone mode.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await service.close()

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

async def run_api_test():
    """Run test via API endpoints."""
    print("=" * 60)
    print("🎙️ NEURALEAP VOICE INTERVIEW - API TEST")
    print("=" * 60)
    
    if not AUTH_TOKEN:
        print("\n⚠️  No AUTH_TOKEN set.")
        print("   Set TEST_AUTH_TOKEN in .env")
        print("   Or run: python test_voice_interview.py --standalone")
        # Proceeding anyway as some local dev setups might not need auth
    
    # Get phone number
    phone = input("\n📱 Enter phone number (with country code): ").strip()
    
    if not phone.startswith("+"):
        phone = f"+91{phone}"
        
    print(f"   Will call: {phone}")
    
    confirm = input("\n🎯 Ready to start? (y/n): ").strip().lower()
    if confirm != "y":
        print("Cancelled.")
        return

    tester = InterviewTester()
    
    try:
        # Create interview
        result = await tester.create_interview(phone, auto_call=False)
        
        if result and tester.session_id:
            start_confirm = input("\n📞 Start call now? (y/n): ").strip().lower()
            if start_confirm == "y":
                await tester.start_call()
                
                # Monitor
                final_data = await tester.monitor_status()
                
                if final_data:
                    # Wait for analysis
                    print("\n⏳ Waiting for analysis...")
                    await asyncio.sleep(5)
                    
                    # Show results
                    await tester.get_results()
                    
                    # Offer retry if failed
                    if final_data.get("status") in ["failed", "no_answer", "busy"]:
                        retry = input("\n🔄 Retry the call? (y/n): ").strip().lower()
                        if retry == "y":
                            await tester.retry_call()
                            await tester.monitor_status()
                            await tester.get_results()
                            
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
    finally:
        await tester.close()

async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Test NeuraLeap Voice Interview V4")
    parser.add_argument("--standalone", action="store_true", help="Run without API server")
    parser.add_argument("--phone", type=str, help="Phone number to call")
    parser.add_argument("--api-url", type=str, help="API base URL")
    args = parser.parse_args()

    if args.api_url:
        global API_BASE_URL
        API_BASE_URL = args.api_url

    if args.standalone:
        await run_standalone_test(args.phone)
    else:
        # If phone is provided via arg, simulate input or modify run_api_test to accept it
        # For simplicity, just running standard interactive mode
        await run_api_test()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Exiting...")