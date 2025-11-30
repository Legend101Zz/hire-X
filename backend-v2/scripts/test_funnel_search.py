
"""
Test Script for Funnel Search Service
=====================================
Tests the new index-first search strategy with real JDs.

Usage:
    python scripts/test_funnel_search.py
    python scripts/test_funnel_search.py --jd 1
    python scripts/test_funnel_search.py --debug
"""

import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List

from dotenv import load_dotenv
from pymongo.asynchronous.mongo_client import AsyncMongoClient

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from services.funnel_search_service import FunnelSearchService

# ============================================================================
# SAMPLE JDs (matching conversation manager format)
# ============================================================================

SAMPLE_JDS: List[Dict[str, Any]] = [
    # JD 1: Senior React Developer in Mumbai (Tech/SaaS)
    # {
    #     "name": "Senior React Developer - Mumbai SaaS",
    #     "role_title": "Senior Full Stack Developer",
    #     "required_skills": [
    #         "React",
    #         "Node.js", 
    #         "TypeScript",
    #         "MongoDB",
    #         "REST APIs",
    #         "Git"
    #     ],
    #     "preferred_skills": [
    #         "Next.js",
    #         "GraphQL",
    #         "AWS",
    #         "Docker",
    #         "Redis"
    #     ],
    #     "seniority": "Senior",
    #     "experience_years": "5-8 years",
    #     "industries": ["SaaS", "Computer Software", "Internet"],
    #     "locations": ["Mumbai", "Bangalore"],
    #     "company_size": ["Startup", "Mid-size"],
    #     "responsibilities": "Build scalable web applications, lead frontend architecture"
    # },
    
    # # JD 2: Data Scientist in Bangalore (Fintech)
    # {
    #     "name": "Data Scientist - Bangalore Fintech",
    #     "role_title": "Senior Data Scientist",
    #     "required_skills": [
    #         "Python",
    #         "Machine Learning",
    #         "SQL",
    #         "TensorFlow",
    #         "Pandas",
    #         "Statistics"
    #     ],
    #     "preferred_skills": [
    #         "PyTorch",
    #         "Spark",
    #         "AWS SageMaker",
    #         "Deep Learning",
    #         "NLP"
    #     ],
    #     "seniority": "Senior",
    #     "experience_years": "4-7 years",
    #     "industries": ["Fintech", "Financial Services", "Banking"],
    #     "locations": ["Bangalore", "Bengaluru", "Hyderabad"],
    #     "company_size": ["Mid-size", "Enterprise"],
    #     "responsibilities": "Build ML models for credit scoring, fraud detection"
    # },
    
    # JD 3: DevOps Engineer in Delhi NCR (Any Tech)
    {
        "name": "DevOps Engineer - Delhi NCR",
        "role_title": "DevOps Engineer",
        "required_skills": [
            "AWS",
            "Docker",
            "Kubernetes",
            "Terraform",
            "CI/CD",
            "Linux"
        ],
        "preferred_skills": [
            "Azure",
            "Ansible",
            "Jenkins",
            "Prometheus",
            "Grafana"
        ],
        "seniority": "Mid-Senior",
        "experience_years": "3-6 years",
        "industries": ["Tech", "Information Technology and Services", "Computer Software"],
        "locations": ["Delhi", "Gurgaon", "Noida"],
        "company_size": ["Startup", "Mid-size", "Enterprise"],
        "responsibilities": "Manage cloud infrastructure, implement CI/CD pipelines"
    },
    
    # JD 4: Product Manager in Pune (E-commerce)
    {
        "name": "Product Manager - Pune E-commerce",
        "role_title": "Senior Product Manager",
        "required_skills": [
            "Product Management",
            "Agile",
            "User Research",
            "Data Analysis",
            "Roadmap Planning",
            "Stakeholder Management"
        ],
        "preferred_skills": [
            "SQL",
            "A/B Testing",
            "Jira",
            "Figma",
            "Analytics"
        ],
        "seniority": "Senior",
        "experience_years": "5-10 years",
        "industries": ["E-commerce", "Internet", "Retail"],
        "locations": ["Pune", "Mumbai", "Bangalore"],
        "company_size": ["Mid-size", "Enterprise"],
        "responsibilities": "Define product vision, prioritize features, work with engineering"
    },
    
    # JD 5: Backend Engineer - Pan India (Startup)
    {
        "name": "Backend Engineer - Remote India",
        "role_title": "Backend Software Engineer",
        "required_skills": [
            "Java",
            "Spring Boot",
            "Microservices",
            "PostgreSQL",
            "REST APIs",
            "Kafka"
        ],
        "preferred_skills": [
            "Kotlin",
            "Redis",
            "Elasticsearch",
            "gRPC",
            "Kubernetes"
        ],
        "seniority": "Mid",
        "experience_years": "3-5 years",
        "industries": ["SaaS", "Computer Software"],
        "locations": [],  # No location filter - Pan India
        "company_size": ["Startup"],
        "responsibilities": "Build scalable backend services, API development"
    }
]


# ============================================================================
# TEST RUNNER
# ============================================================================

class FunnelSearchTester:
    """Test runner for Funnel Search Service."""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.search_service = None
        
    async def setup(self):
        """Initialize connections."""
        print("=" * 70)
        print("🔧 FUNNEL SEARCH SERVICE - TEST SUITE")
        print("=" * 70)
        
        # MongoDB connection
        mongo_url = os.getenv("PROFILES_DB_URL")
        db_name = os.getenv("PROFILES_DB_NAME", "profiles_production")
        
        if not mongo_url:
            raise ValueError("PROFILES_DB_URL not set in environment")
        
        print(f"\n📡 Connecting to MongoDB...")
        self.client = AsyncMongoClient(mongo_url)
        self.db = self.client[db_name]
        profiles_collection = self.db["profiles"]
        
        # Count docs
        count = await profiles_collection.estimated_document_count()
        print(f"   ✅ Connected! {count:,} profiles in database")
        
        # Initialize search service
        openai_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise ValueError("OPENROUTER_API_KEY or OPENAI_API_KEY not set")
        
        self.search_service = FunnelSearchService(
            profiles_collection=profiles_collection,
            openai_api_key=openai_key,
            openai_base_url=os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
        )
        
        print("   ✅ FunnelSearchService initialized")
        
    async def cleanup(self):
        """Close connections."""
        if self.client:
            self.client.close()
            print("\n📡 MongoDB connection closed")
    
    async def test_single_jd(self, jd_index: int, debug: bool = False):
        """Test a single JD."""
        
        if jd_index < 0 or jd_index >= len(SAMPLE_JDS):
            print(f"❌ Invalid JD index. Choose 0-{len(SAMPLE_JDS)-1}")
            return
        
        jd = SAMPLE_JDS[jd_index]
        await self._run_search(jd, debug)
    
    async def test_all_jds(self, debug: bool = False):
        """Test all sample JDs."""
        
        results_summary = []
        
        for i, jd in enumerate(SAMPLE_JDS):
            print(f"\n{'=' * 70}")
            print(f"TEST {i+1}/{len(SAMPLE_JDS)}: {jd['name']}")
            print("=" * 70)
            
            result = await self._run_search(jd, debug)
            results_summary.append({
                "name": jd["name"],
                "success": result["success"],
                "count": result["total_found"],
                "time_ms": result.get("total_time_ms", 0)
            })
        
        # Print summary
        print("\n" + "=" * 70)
        print("📊 RESULTS SUMMARY")
        print("=" * 70)
        
        for r in results_summary:
            status = "✅" if r["success"] else "❌"
            print(f"   {status} {r['name']}: {r['count']} candidates in {r['time_ms']}ms")
        
        total_success = sum(1 for r in results_summary if r["success"])
        print(f"\n   Total: {total_success}/{len(results_summary)} successful")
    
    async def _run_search(self, jd: Dict[str, Any], debug: bool = False) -> Dict[str, Any]:
        """Run search for a single JD."""
        
        print(f"\n📋 JD: {jd['name']}")
        print(f"   Role: {jd['role_title']}")
        print(f"   Skills: {jd['required_skills'][:5]}")
        print(f"   Seniority: {jd['seniority']}")
        print(f"   Industries: {jd.get('industries', [])[:3]}")
        print(f"   Locations: {jd.get('locations', ['Any'])[:3]}")
        
        # Run search
        print(f"\n🔍 Executing funnel search...")
        start_time = time.time()
        
        try:
            result = await self.search_service.search(
                jd_data=jd,
                limit=10,
                user_filters={
                    "industries": jd.get("industries", []),
                    "seniority": jd.get("seniority", ""),
                    "locations": jd.get("locations", [])
                }
            )
            
            total_time = int((time.time() - start_time) * 1000)
            result["total_time_ms"] = total_time
            
            # Print results
            print(f"\n📊 RESULTS:")
            print(f"   Success: {'✅' if result['success'] else '❌'}")
            print(f"   Total Found: {result['total_found']}")
            print(f"   Time: {total_time}ms")
            
            # Print search log
            if result.get("search_log"):
                print(f"\n   Search Pipeline:")
                for stage in result["search_log"]:
                    stage_name = stage.get("stage", "unknown")
                    if stage_name == "parse_jd":
                        print(f"      1. Parse JD:")
                        print(f"         Industries: {stage.get('industries', [])[:3]}")
                        print(f"         Skills: {stage.get('core_skills', [])[:5]}")
                    elif stage_name == "index_query":
                        print(f"      2. Index Query: {stage.get('count', 0)} candidates in {stage.get('time_ms', 0)}ms")
                    elif stage_name == "skill_matching":
                        print(f"      3. Skill Match: {stage.get('input_count', 0)} → {stage.get('matched_count', 0)} in {stage.get('time_ms', 0)}ms")
                    elif stage_name == "final":
                        print(f"      4. Final: {stage.get('total_candidates', 0)} candidates")
            
            # Print top candidates
            if result.get("candidates"):
                print(f"\n   🏆 Top {min(5, len(result['candidates']))} Candidates:")
                
                for i, candidate in enumerate(result["candidates"][:5], 1):
                    c = candidate["candidate"]
                    score = candidate["score"]
                    skills = candidate.get("matched_skills", [])[:3]
                    
                    print(f"\n      {i}. {c.get('first_name', '')} {c.get('last_name', '')} (Score: {score})")
                    print(f"         Title: {c.get('title', 'N/A')}")
                    print(f"         Location: {c.get('location', 'N/A')}")
                    print(f"         Industry: {c.get('current_industry', 'N/A')}")
                    print(f"         Seniority: {c.get('seniority_level', 'N/A')}")
                    print(f"         Matched Skills: {', '.join(skills) if skills else 'N/A'}")
                    
                    if debug:
                        print(f"         Expertise: {c.get('expertise', 'N/A')[:100]}...")
                        print(f"         LinkedIn: {c.get('linkedin_url', 'N/A')}")
            else:
                print(f"\n   ⚠️ No candidates found")
                
                # Show filters used
                if result.get("filters_used"):
                    print(f"\n   Filters used:")
                    print(f"      Industries: {result['filters_used'].get('industries', [])}")
                    print(f"      Seniority: {result['filters_used'].get('seniority_levels', [])}")
                    print(f"      Locations: {result['filters_used'].get('locations', [])}")
                    print(f"      Title patterns: {result['filters_used'].get('title_patterns', [])}")
            
            # Debug: Show index usage
            if debug and hasattr(self.search_service, 'debug_index_usage'):
                print(f"\n   🐛 DEBUG INFO:")
                # This would require passing filters, simplified for now
                print(f"      Run with --debug to see index analysis")
            
            return result
            
        except Exception as e:
            print(f"\n   ❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "total_found": 0, "error": str(e)}
    
    async def debug_database(self):
        """Debug database to understand data distribution."""
        
        print("\n" + "=" * 70)
        print("🐛 DATABASE DEBUG INFO")
        print("=" * 70)
        
        profiles = self.db["profiles"]
        
        # Total count
        total = await profiles.estimated_document_count()
        print(f"\n   Total profiles: {total:,}")
        
        # Sample some expertise values
        print(f"\n   Sample expertise values:")
        cursor = profiles.find(
            {"expertise": {"$ne": "NA", "$ne": ""}},
            {"expertise": 1}
        ).limit(5)
        
        async for doc in cursor:
            expertise = doc.get("expertise", "")[:100]
            print(f"      - {expertise}...")
        
        # Industry distribution
        print(f"\n   Top industries:")
        pipeline = [
            {"$match": {"current_industry": {"$ne": "NA"}}},
            {"$group": {"_id": "$current_industry", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        
        cursor = profiles.aggregate(pipeline)
        async for doc in cursor:
            print(f"      - {doc['_id']}: {doc['count']:,}")
        
        # Seniority distribution
        print(f"\n   Seniority distribution:")
        pipeline = [
            {"$match": {"seniority_level": {"$ne": "NA"}}},
            {"$group": {"_id": "$seniority_level", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        
        cursor = profiles.aggregate(pipeline)
        async for doc in cursor:
            print(f"      - {doc['_id']}: {doc['count']:,}")
        
        # Location sample (India)
        print(f"\n   Sample locations (India):")
        cursor = profiles.find(
            {"country": "India", "location": {"$ne": "NA"}},
            {"location": 1}
        ).limit(10)
        
        async for doc in cursor:
            print(f"      - {doc.get('location', 'N/A')}")
        
        # Check skill patterns
        print(f"\n   Checking skill patterns in expertise:")
        test_skills = ["react", "python", "java", "node", "aws", "docker"]
        
        for skill in test_skills:
            count = await profiles.count_documents({
                "expertise": {"$regex": skill, "$options": "i"}
            })
            print(f"      - '{skill}': {count:,} profiles")


async def main():
    """Main entry point."""
    
    parser = argparse.ArgumentParser(description="Test Funnel Search Service")
    parser.add_argument("--jd", type=int, help="Test specific JD (0-4)", default=None)
    parser.add_argument("--debug", action="store_true", help="Show debug info")
    parser.add_argument("--db-debug", action="store_true", help="Debug database distribution")
    parser.add_argument("--list", action="store_true", help="List available JDs")
    
    args = parser.parse_args()
    
    # List JDs
    if args.list:
        print("\nAvailable Test JDs:")
        for i, jd in enumerate(SAMPLE_JDS):
            print(f"   {i}: {jd['name']}")
            print(f"      Role: {jd['role_title']}")
            print(f"      Skills: {jd['required_skills'][:3]}")
            print()
        return
    
    # Run tests
    tester = FunnelSearchTester()
    
    try:
        await tester.setup()
        
        if args.db_debug:
            await tester.debug_database()
        elif args.jd is not None:
            await tester.test_single_jd(args.jd, debug=args.debug)
        else:
            await tester.test_all_jds(debug=args.debug)
            
    finally:
        await tester.cleanup()


if __name__ == "__main__":
    asyncio.run(main())