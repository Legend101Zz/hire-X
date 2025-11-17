"""
Test Sample Profile Queries Manually
====================================
"""

import asyncio
import json
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
from pymongo.asynchronous.mongo_client import AsyncMongoClient

from services.query_builder import QueryBuilder, QueryStrategy

load_dotenv()

async def test_queries():
    """Test queries against your profile."""
    
    # Connect to MongoDB
    client = AsyncMongoClient(
        os.getenv("PROFILES_DB_URL"),
        serverSelectionTimeoutMS=5000
    )
    db = client[os.getenv("PROFILES_DB_NAME")]
    profiles = db["profiles"]
    
    # Your test profile
    ideal_profile = {
        "role_title": "Senior Full Stack Developer - Real-Time Applications",
        "must_have_skills": ["Next.js", "Node.js", "WebSockets", "Socket.io"],
        "seniority": "Senior",
        "industries": ["SaaS", "Enterprise software"],
        "locations": []
    }
    
    print("=" * 70)
    print("TESTING SAMPLE PROFILE QUERIES")
    print("=" * 70)
    print(f"\nProfile Requirements:")
    print(f"  Role: {ideal_profile['role_title']}")
    print(f"  Must-have skills: {ideal_profile['must_have_skills']}")
    print(f"  Seniority: {ideal_profile['seniority']}")
    print(f"  Industries: {ideal_profile['industries']}")
    
    builder = QueryBuilder(ideal_profile)
    
    # ✅ Updated to use new enum values
    strategies = [
        QueryStrategy.INDUSTRY_SENIORITY,  # Best: uses compound index
        QueryStrategy.INDUSTRY_ONLY,
        QueryStrategy.SENIORITY_ONLY,
        QueryStrategy.TITLE_WORDS,
        QueryStrategy.MINIMAL
    ]
    
    for strategy in strategies:
        print(f"\n{'=' * 70}")
        print(f"Strategy: {strategy.value}")
        print('=' * 70)
        
        query = builder.build(strategy)
        print(f"\nMongoDB Query:")
        print(json.dumps(query, indent=2, default=str))
        
        try:
            import time
            start = time.time()
            
            # Add timeout
            cursor = profiles.find(query).limit(20).max_time_ms(2000)
            candidates = await cursor.to_list(length=20)
            
            elapsed = time.time() - start
            
            print(f"\n✅ Found {len(candidates)} candidates in {elapsed:.2f}s")
            
            if len(candidates) > 0:
                print(f"\nTop 3 Results:")
                for i, c in enumerate(candidates[:3], 1):
                    print(f"\n{i}. {c.get('title', 'N/A')}")
                    print(f"   Company: {c.get('current_company', 'N/A')}")
                    print(f"   Location: {c.get('location', 'N/A')}")
                    print(f"   Industry: {c.get('current_industry', 'N/A')}")
                    print(f"   Seniority: {c.get('seniority_level', 'N/A')}")
                    
                    # Check for must-have skills
                    expertise = c.get('expertise', '').lower()
                    matched_skills = []
                    for skill in ideal_profile["must_have_skills"]:
                        # Check variations
                        skill_lower = skill.lower()
                        skill_no_dot = skill_lower.replace('.', '')
                        
                        if skill_lower in expertise or skill_no_dot in expertise:
                            matched_skills.append(skill)
                    
                    print(f"   Matched Skills: {matched_skills if matched_skills else '❌ NONE'}")
                    
                    # Show first 100 chars of expertise
                    if c.get('expertise'):
                        print(f"   Expertise: {c.get('expertise', '')[:100]}...")
            
            # If this works well, stop testing
            if len(candidates) >= 5:
                # Check how many have at least 1 must-have skill
                with_skills = 0
                for c in candidates:
                    expertise = c.get('expertise', '').lower()
                    for skill in ideal_profile["must_have_skills"]:
                        if skill.lower().replace('.', '') in expertise:
                            with_skills += 1
                            break
                
                print(f"\n📊 Stats: {with_skills}/{len(candidates)} have at least 1 must-have skill")
                
                if with_skills >= 2:
                    print("\n✅ This strategy works well - stopping here!")
                    break
                else:
                    print("\n⚠️ Not enough candidates with must-have skills - trying next strategy")
                
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(test_queries())