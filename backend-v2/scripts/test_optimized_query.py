"""Test optimized query for AIF Manager"""

import os
import time

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

client = MongoClient(os.getenv("PROFILES_DB_URL"))
db = client[os.getenv("PROFILES_DB_NAME")]
profiles = db["profiles"]

print("=" * 60)
print("TESTING OPTIMIZED QUERY FOR AIF MANAGER")
print("=" * 60)

# Build query step by step
print("\n1️⃣ Step 1: Experience 5-8 years")
query1 = {
    "experience_years": {
        "$exists": True,
        "$ne": None,
        "$gte": 5,
        "$lte": 8
    }
}

start = time.time()
count1 = profiles.count_documents(query1)
elapsed = time.time() - start
print(f"   Found: {count1:,} profiles in {elapsed:.2f}s")

# Step 2: Add location
print("\n2️⃣ Step 2: + Location (Mumbai)")
query2 = {
    "$and": [
        {"experience_years": {"$exists": True, "$gte": 5, "$lte": 8}},
        {"location": {"$regex": "Mumbai", "$options": "i", "$ne": "NA"}}
    ]
}

start = time.time()
count2 = profiles.count_documents(query2)
elapsed = time.time() - start
print(f"   Found: {count2:,} profiles in {elapsed:.2f}s")

# Step 3: Add industry
print("\n3️⃣ Step 3: + Industry (Financial Services)")
query3 = {
    "$and": [
        {"experience_years": {"$exists": True, "$gte": 5, "$lte": 8}},
        {"location": {"$regex": "Mumbai", "$options": "i", "$ne": "NA"}},
        {"current_industry": {"$regex": "financial|banking|investment", "$options": "i", "$ne": "NA"}}
    ]
}

start = time.time()
count3 = profiles.count_documents(query3)
elapsed = time.time() - start
print(f"   Found: {count3:,} profiles in {elapsed:.2f}s")

# Step 4: Add title
print("\n4️⃣ Step 4: + Title (Manager|Operations)")
query4 = {
    "$and": [
        {"experience_years": {"$exists": True, "$gte": 5, "$lte": 8}},
        {"location": {"$regex": "Mumbai", "$options": "i", "$ne": "NA"}},
        {"current_industry": {"$regex": "financial|banking|investment", "$options": "i", "$ne": "NA"}},
        {"title": {"$regex": "manager|operations|senior", "$options": "i", "$ne": "NA"}}
    ]
}

start = time.time()
count4 = profiles.count_documents(query4)
elapsed = time.time() - start
print(f"   Found: {count4:,} profiles in {elapsed:.2f}s")

if count4 > 0:
    print("\n   📄 Sample matches:")
    cursor = profiles.find(query4).limit(3)
    for i, doc in enumerate(cursor, 1):
        print(f"\n   {i}. {doc.get('title', 'N/A')}")
        print(f"      Experience: {doc.get('experience_years', 'N/A')} years")
        print(f"      Location: {doc.get('location', 'N/A')}")
        print(f"      Industry: {doc.get('current_industry', 'N/A')}")
        print(f"      Skills: {doc.get('expertise', 'N/A')[:100]}...")

# Step 5: Add skills (careful - no index!)
print("\n5️⃣ Step 5: + Skills (fund|accounting|aif)")
query5 = {
    "$and": [
        {"experience_years": {"$exists": True, "$gte": 5, "$lte": 8}},
        {"location": {"$regex": "Mumbai", "$options": "i", "$ne": "NA"}},
        {"current_industry": {"$regex": "financial|banking|investment", "$options": "i", "$ne": "NA"}},
        {"title": {"$regex": "manager|operations", "$options": "i", "$ne": "NA"}},
        {"expertise": {"$regex": "fund|accounting|aif", "$options": "i", "$ne": "NA"}}
    ]
}

start = time.time()
count5 = profiles.count_documents(query5, maxTimeMS=30000)
elapsed = time.time() - start
print(f"   Found: {count5:,} profiles in {elapsed:.2f}s")

print("\n" + "=" * 60)
print("QUERY PERFORMANCE ANALYSIS")
print("=" * 60)

print(f"\nExperience only:          {count1:,} results")
print(f"+ Location:               {count2:,} results")
print(f"+ Industry:               {count3:,} results") 
print(f"+ Title:                  {count4:,} results")
print(f"+ Skills:                 {count5:,} results")

print("\n💡 Recommendations:")
if count4 > 10:
    print("   ✅ Stop at Step 4 (don't add skills filter - too slow)")
    print("   ✅ Use LLM to rank by skills after fetching results")
elif count3 > 50:
    print("   ⚠️  Broaden title keywords or skip title filter")
elif count2 > 100:
    print("   ⚠️  Industry filter too strict - try broader keywords")
else:
    print("   ❌ Database lacks this profile type")

client.close()