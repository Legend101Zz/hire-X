# backend-v2/scripts/test_pipeline_api.py
"""
Test Pipeline API
Run: python -m scripts.test_pipeline_api
"""

import asyncio

import httpx

BASE_URL = "http://localhost:8000/"

# Get your auth token first
AUTH_TOKEN = "your-jwt-token"

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

async def test_pipeline_flow():
    async with httpx.AsyncClient(timeout=30) as client:
        
        # 1. Create pipeline
        print("\n1️⃣ Creating pipeline...")
        response = await client.post(
            f"{BASE_URL}/pipeline/create/from-search",
            headers=HEADERS,
            json={
                "conversation_session_id": "test-conv-123",
                "search_session_id": "test-search-456",
                "job_data": {
                    "role_title": "Senior Backend Engineer",
                    "must_have_skills": ["Python", "FastAPI"],
                    "experience_years": "5+ years"
                },
                "candidates": [
                    {
                        "linkedin_url": "https://linkedin.com/in/testuser1",
                        "name": "Test User 1",
                        "title": "Backend Engineer",
                        "current_company": "Google",
                        "experience_years": 6,
                        "skills": ["Python", "Django"]
                    },
                    {
                        "linkedin_url": "https://linkedin.com/in/testuser2",
                        "name": "Test User 2",
                        "title": "Software Engineer",
                        "current_company": "Meta",
                        "experience_years": 4,
                        "skills": ["Python", "FastAPI"]
                    }
                ],
                "pipeline_name": "Test Pipeline",
                "auto_shortlist": False
            }
        )
        print(f"   Status: {response.status_code}")
        data = response.json()
        print(f"   Response: {data}")
        
        if not data.get("success"):
            print("   ❌ Failed to create pipeline")
            return
        
        pipeline_id = data["pipeline_id"]
        print(f"   ✅ Pipeline created: {pipeline_id}")
        
        # 2. List pipelines
        print("\n2️⃣ Listing pipelines...")
        response = await client.get(
            f"{BASE_URL}/pipeline/list",
            headers=HEADERS
        )
        print(f"   Total pipelines: {response.json().get('total')}")
        
        # 3. Get dashboard
        print("\n3️⃣ Getting dashboard...")
        response = await client.get(
            f"{BASE_URL}/pipeline/{pipeline_id}/dashboard",
            headers=HEADERS
        )
        dashboard = response.json()
        print(f"   Total candidates: {dashboard.get('total_candidates')}")
        print(f"   Stats: {dashboard.get('stats', {})}")
        
        # 4. List candidates
        print("\n4️⃣ Listing candidates...")
        response = await client.get(
            f"{BASE_URL}/pipeline/{pipeline_id}/candidates",
            headers=HEADERS
        )
        candidates = response.json().get("candidates", [])
        print(f"   Found {len(candidates)} candidates")
        
        if candidates:
            candidate_ids = [c["candidate_id"] for c in candidates]
            
            # 5. Shortlist candidates
            print("\n5️⃣ Shortlisting candidates...")
            response = await client.post(
                f"{BASE_URL}/pipeline/{pipeline_id}/shortlist",
                headers=HEADERS,
                json={"candidate_ids": candidate_ids}
            )
            print(f"   Shortlisted: {response.json().get('shortlisted_count')}")
            
            # 6. Start enrichment
            print("\n6️⃣ Starting enrichment...")
            response = await client.post(
                f"{BASE_URL}/pipeline/{pipeline_id}/enrich",
                headers=HEADERS,
                json={"include_contact_fetch": False}  # Skip Hatch for testing
            )
            print(f"   Enrichment started for: {response.json().get('count')} candidates")
            
            # 7. Get analytics
            print("\n7️⃣ Getting analytics...")
            response = await client.get(
                f"{BASE_URL}/pipeline/{pipeline_id}/analytics",
                headers=HEADERS
            )
            analytics = response.json()
            print(f"   Stage distribution: {analytics.get('stage_distribution')}")
        
        print("\n✅ Pipeline API test complete!")

if __name__ == "__main__":
    asyncio.run(test_pipeline_flow())