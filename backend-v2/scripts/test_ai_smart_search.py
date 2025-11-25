
"""
Test Progressive Smart Search
"""

import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.smart_search_service import ProgressiveSmartSearch

load_dotenv()

SAMPLE_JD = {
    "role_title": "Senior Full Stack Developer - React.JS applications",
    "required_skills": [
        "Next.js",
        "Node.js",
        "React",
        "WebSockets",
        "JavaScript",
        "TypeScript",
        "MongoDB",
        "Express.js"
    ],
    "experience_years": "5-8+",
    "seniority": "Senior Level",
    "industries": [
        "SaaS and enterprise software",
        "E-commerce",
        "Fintech"
    ]
}


def main():
    print("=" * 80)
    print("PROGRESSIVE SMART SEARCH TEST")
    print("=" * 80)
    
    client = MongoClient(os.getenv("PROFILES_DB_URL"))
    db = client[os.getenv("PROFILES_DB_NAME")]
    profiles = db["profiles"]
    
    print(f"\n✅ Connected to database")
    print(f"   Total profiles: {profiles.estimated_document_count():,}")
    
    search_service = ProgressiveSmartSearch(
        profiles_collection=profiles,
        openai_api_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    print("\n" + "=" * 80)
    print("EXECUTING PROGRESSIVE SEARCH")
    print("=" * 80)
    
    import time
    start = time.time()
    
    result = search_service.search(
        jd_data=SAMPLE_JD,
        limit=50
    )
    
    elapsed = time.time() - start
    
    print("\n" + "=" * 80)
    print("SEARCH RESULTS")
    print("=" * 80)
    
    print(f"\n⏱️  Total time: {elapsed:.2f}s")
    print(f"   Success: {result['success']}")
    print(f"   Total found: {result['total_found']}")
    
    print(f"\n📊 Search Progression:")
    for log in result['search_log']:
        print(f"   {log['stage']}: {log['count']} candidates ({log['time_ms']}ms)")
    
    print(f"\n🧠 AI Expanded Terms:")
    print(f"   Skills:")
    for skill in result['expanded_terms'].get('top_technical_skills', [])[:5]:
        print(f"      - {skill['name']}: {skill['variations']}")
    
    print(f"\n   Industries: {result['expanded_terms']['industries'][:5]}")
    print(f"   Seniority: {result['expanded_terms']['seniority_levels']}")
    print(f"   Title Keywords: {result['expanded_terms']['title_keywords'][:3]}")
    
    print(f"\n🏆 TOP 10 CANDIDATES:")
    print("-" * 80)
    
    for i, candidate_data in enumerate(result['candidates'][:10], 1):
        cand = candidate_data['candidate']
        score = candidate_data['score']
        matched_skills = candidate_data.get('matched_skills', [])
        matches = candidate_data['match_details']
        
        print(f"\n{i}. {cand['first_name']} {cand['last_name']} (Score: {score})")
        print(f"   Title: {cand['title']}")
        print(f"   Industry: {cand['current_industry']}")
        print(f"   Seniority: {cand['seniority_level']}")
        print(f"   Matched Skills ({len(matched_skills)}): {', '.join(matched_skills[:5])}")
        print(f"   Expertise: {cand['expertise'][:120]}...")
        print(f"   Match Details: {' | '.join(matches)}")
    
    print("\n" + "=" * 80)
    
    client.close()


if __name__ == "__main__":
    main()