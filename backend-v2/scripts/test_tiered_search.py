"""
Test Tiered Smart Search
"""

import asyncio
import os
import sys

from dotenv import load_dotenv
from pymongo.asynchronous.mongo_client import AsyncMongoClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.tiered_smart_search import TieredSmartSearch

load_dotenv()

# SAMPLE_JD = {
#     "role_title": "Senior Full Stack Developer - React.JS applications",
#     "required_skills": [
#         "Next.js",
#         "Node.js",
#         "React",
#         "WebSockets",
#         "JavaScript",
#         "TypeScript",
#         "MongoDB",
#         "Express.js"
#     ],
#     "experience_years": "5-8+",
#     "seniority": "Senior Level",
#     "industries": [
#         "SaaS and enterprise software",
#         "E-commerce",
#         "Fintech"
#     ]
# }

SAMPLE_JD = {
    "role_title": "Full Stack Developer (React & Node.js)",
    
    "required_skills": [
        "React.js",
        "Node.js",
        "Express.js",
        "JavaScript (ES6+)",
        "HTML5",
        "CSS3",
        "RESTful API",
        "SQL",
        "NoSQL",
        "PostgreSQL",
        "MongoDB",
        "MySQL",
        "Git",
        "GitHub",
        "Redux",
        "Context API",
        "Responsive design"
    ],

    "optional_skills": [
        "TypeScript",
        "AWS",
        "Azure",
        "Google Cloud",
        "Docker",
        "Kubernetes",
        "CI/CD",
        "DevOps",
        "GraphQL",
        "Jest",
        "Mocha",
        "Cypress",
        "React Testing Library",
        "Next.js",
        "Agile",
        "Scrum",
        "UI/UX design"
    ],

    "seniority": "Mid to Senior",
    "experience_years": "3-6",

    "industries": [
        "SaaS",
        "fintech",
        "e-commerce",
        "healthcare tech",
        "enterprise software"
    ],

    "company_size": [],
    "locations": [],

    "additional_requirements": (
        "Design and develop responsive front-end applications using React.js; "
        "Build and maintain server-side applications, RESTful APIs, and microservices using Node.js and Express.js; "
        "Collaborate with cross-functional teams; "
        "Write clean, maintainable code following best practices; "
        "Optimize applications for performance, scalability, and security; "
        "Participate in code reviews, testing, and debugging; "
        "Contribute to technical architecture decisions"
    )
}



async def main():
    print("=" * 80)
    print("TIERED SMART SEARCH TEST")
    print("=" * 80)
    
    client = AsyncMongoClient(os.getenv("PROFILES_DB_URL"))
    db = client[os.getenv("PROFILES_DB_NAME")]
    profiles = db["profiles"]
    
    print(f"\n✅ Connected to database")
    
    search_service = TieredSmartSearch(
        profiles_collection=profiles,
        openai_api_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    print("\n" + "=" * 80)
    print("EXECUTING TIERED SEARCH")
    print("=" * 80)
    
    import time
    start = time.time()
    
    result = await search_service.search(
        jd_data=SAMPLE_JD,
        limit=50
    )
    
    elapsed = time.time() - start
    
    print("\n" + "=" * 80)
    print("SEARCH RESULTS")
    print("=" * 80)
    
    print(f"\n⏱️  Total time: {elapsed:.2f}s")
    print(f"   Success: {result['success']}")
    
    print(f"\n📊 Tier Distribution:")
    for tier, count in result['tier_distribution'].items():
        print(f"   {tier}: {count} candidates")
    
    print(f"\n🧠 AI Skill Classification:")
    print(f"   Core Skills:")
    for skill in result['expanded_terms'].get('core_skills', [])[:5]:
        print(f"      - {skill['name']} (weight: {skill['weight']})")
    
    print(f"\n   Nice-to-have Skills:")
    for skill in result['expanded_terms'].get('nice_skills', [])[:3]:
        print(f"      - {skill['name']} (weight: {skill['weight']})")
    
    print(f"\n   Min skill threshold: {result['expanded_terms']['min_skill_matches']}")
    
    print(f"\n🏆 TOP 15 CANDIDATES (BY TIER):")
    print("-" * 80)
    
    for i, candidate_data in enumerate(result['candidates'][:15], 1):
        cand = candidate_data['candidate']
        score = candidate_data['score']
        skill_count = candidate_data['skill_match_count']
        matched_skills = candidate_data.get('matched_skills', [])
        matches = candidate_data['match_details']
        
        print(f"\n{i}. {cand['first_name']} {cand['last_name']} (Score: {score}, Skills: {skill_count})")
        print(f"   Title: {cand['title']}")
        print(f"   Industry: {cand['current_industry']} | Seniority: {cand['seniority_level']}")
        print(f"   Matched Skills: {', '.join(matched_skills[:5])}")
        print(f"   Details: {' | '.join(matches)}")
        
        if cand['expertise']:
            print(f"   Expertise: {cand['expertise'][:100]}...")
    
    print("\n" + "=" * 80)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main()) 
