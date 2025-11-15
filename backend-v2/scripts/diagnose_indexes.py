"""
Diagnose MongoDB Indexes and Query Performance
===============================================
"""

import asyncio
import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

PROFILES_DB_URL = os.getenv("PROFILES_DB_URL")
PROFILES_DB_NAME = os.getenv("PROFILES_DB_NAME")


async def diagnose():
    """Diagnose indexes and test queries."""
    
    # Use sync client for simplicity
    client = MongoClient(PROFILES_DB_URL, serverSelectionTimeoutMS=5000)
    db = client[PROFILES_DB_NAME]
    profiles = db["profiles"]
    
    print("=" * 60)
    print("INDEX DIAGNOSTICS")
    print("=" * 60)
    
    # 1. List all existing indexes
    print("\n✅ Current Indexes:")
    indexes = list(profiles.list_indexes())
    for idx in indexes:
        print(f"   - {idx['name']}")
        if 'key' in idx:
            print(f"     Keys: {idx['key']}")
        if 'weights' in idx:
            print(f"     Text weights: {idx['weights']}")
    
    # 2. Count total documents
    total = profiles.estimated_document_count({})
    print(f"\n📊 Total profiles: {total:,}")
    
    # 3. Test simple queries
    print("\n" + "=" * 60)
    print("TESTING QUERIES FOR YOUR JD")
    print("=" * 60)
    
    # Test 1: Text search for "Manager Operations"
    print("\n🔍 Test 1: Text search for 'Manager Operations'")
    query1 = {"$text": {"$search": "Manager Operations"}}
    try:
        import time
        start = time.time()
        count1 = profiles.count_documents(query1)
        elapsed = time.time() - start
        print(f"   Found: {count1:,} profiles in {elapsed:.2f}s")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Experience range only
    print("\n🔍 Test 2: Experience 5-8 years")
    query2 = {"experience_years": {"$gte": 5, "$lte": 8}}
    try:
        start = time.time()
        count2 = profiles.count_documents(query2)
        elapsed = time.time() - start
        print(f"   Found: {count2:,} profiles in {elapsed:.2f}s")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Location search
    print("\n🔍 Test 3: Location contains 'Mumbai'")
    query3 = {"location": {"$regex": "Mumbai", "$options": "i"}}
    try:
        start = time.time()
        count3 = profiles.count_documents(query3)
        elapsed = time.time() - start
        print(f"   Found: {count3:,} profiles in {elapsed:.2f}s")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Combined (this is what your app does)
    print("\n🔍 Test 4: Combined query (text + experience + location)")
    query4 = {
        "$and": [
            {"$text": {"$search": "Manager Operations"}},
            {"experience_years": {"$gte": 5, "$lte": 8}},
            {"location": {"$regex": "Mumbai", "$options": "i"}}
        ]
    }
    try:
        start = time.time()
        count4 = profiles.count_documents(query4)
        elapsed = time.time() - start
        print(f"   Found: {count4:,} profiles in {elapsed:.2f}s")
        
        if count4 > 0:
            # Fetch one sample
            sample = profiles.find_one(query4)
            if sample:
                print(f"\n   📄 Sample match:")
                print(f"      Name: {sample.get('first_name', '')} {sample.get('last_name', '')}")
                print(f"      Title: {sample.get('title', 'N/A')}")
                print(f"      Experience: {sample.get('experience_years', 'N/A')} years")
                print(f"      Location: {sample.get('location', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 5: Specific AIF/Fund skills
    print("\n🔍 Test 5: Text search for 'AIF Fund Accounting'")
    query5 = {"$text": {"$search": "AIF Fund Accounting"}}
    try:
        start = time.time()
        count5 = profiles.count_documents(query5)
        elapsed = time.time() - start
        print(f"   Found: {count5:,} profiles in {elapsed:.2f}s")
        
        if count5 > 0:
            # Fetch one sample
            sample = profiles.find_one(query5)
            if sample:
                print(f"\n   📄 Sample match:")
                print(f"      Title: {sample.get('title', 'N/A')}")
                print(f"      Skills: {sample.get('expertise', 'N/A')[:200]}...")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 6: Explain query plan
    print("\n" + "=" * 60)
    print("QUERY EXECUTION PLAN")
    print("=" * 60)
    
    try:
        explain = profiles.find(query4).explain()
        print(f"\n   Stage: {explain.get('queryPlanner', {}).get('winningPlan', {}).get('stage', 'N/A')}")
        print(f"   Index used: {explain.get('queryPlanner', {}).get('winningPlan', {}).get('inputStage', {}).get('indexName', 'N/A')}")
    except Exception as e:
        print(f"   ❌ Error getting explain plan: {e}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(diagnose())