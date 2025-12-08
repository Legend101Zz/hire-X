# backend-v2/scripts/test_email.py
"""
Test email service
Run: python -m scripts.test_email
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from models.pipeline_models import ContactInfo, JobContext, PipelineCandidate
from services.email_outreach_service import EmailOutreachService


async def test_email():
    """Test email sending."""
    
    # Initialize service
    service = EmailOutreachService()
    
    # Check health
    print("\n🔍 Checking email service health...")
    health = await service.check_health()
    print(f"   Provider: {health['provider']}")
    print(f"   Healthy: {health['healthy']}")
    print(f"   AI Available: {health['ai_available']}")
    
    # Create test candidate
    candidate = PipelineCandidate(
        candidate_id="test-123",
        linkedin_url="https://linkedin.com/in/test",
        name="John Doe",
        current_title="Senior Software Engineer",
        current_company="Google",
        experience_years=8,
        skills=["Python", "FastAPI", "MongoDB", "AWS"],
        contact=ContactInfo(
            email="your-test-email@gmail.com"  # Change this!
        )
    )
    
    # Create test job
    job = JobContext(
        job_title="Lead Backend Engineer",
        company_name="NeuraLeap",
        required_skills=["Python", "FastAPI", "MongoDB"],
        experience_required="5+ years"
    )
    
    # Generate email (without sending)
    print("\n📧 Generating outreach email...")
    email_content = await service.generate_outreach_email(
        candidate=candidate,
        job=job,
        scheduling_link="https://neuraleap.shop/schedule/test-token"
    )
    
    print(f"\n   Subject: {email_content['subject']}")
    print(f"\n   Body:\n{email_content['body']}")
    
    # Uncomment to actually send
    # print("\n📤 Sending email...")
    # result = await service.send_email(
    #     to_email="your-test-email@gmail.com",  # Change this!
    #     to_name="Test User",
    #     subject=email_content["subject"],
    #     body_html=email_content["body_html"],
    #     body_plain=email_content["body"]
    # )
    # print(f"   Success: {result['success']}")
    # if result.get('message_id'):
    #     print(f"   Message ID: {result['message_id']}")
    # if result.get('error'):
    #     print(f"   Error: {result['error']}")

if __name__ == "__main__":
    asyncio.run(test_email())