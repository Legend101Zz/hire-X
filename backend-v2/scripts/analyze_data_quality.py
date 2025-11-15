"""
Analyze data quality and field availability
===========================================
"""

import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

client = MongoClient(os.getenv("PROFILES_DB_URL"))
db = client[os.getenv("PROFILES_DB_NAME")]
profiles = db["profiles"]

print("=" * 60)
print("DATA QUALITY ANALYSIS")
print("=" * 60)

total = profiles.estimated_document_count({})
print(f"\nTotal profiles: {total:,}\n")

# Check field availability
fields_to_check = [
    "experience_years",
    "title", 
    "location",
    "current_industry",
    "seniority_level",
    "expertise",
    "experience",
    "education"
]

print("Field Availability:")
print("-" * 60)

for field in fields_to_check:
    # Count non-empty, non-NA values
    if field in ["experience", "education"]:
        # Array fields
        count = profiles.count_documents({
            field: {"$exists": True, "$ne": ['NA'], "$ne": []}
        })
    else:
        # String/number fields
        count = profiles.count_documents({
            field: {"$exists": True, "$ne": 'NA', "$ne": None, "$ne": ""}
        })
    
    percentage = (count / total) * 100
    print(f"{field:20s}: {count:12,} ({percentage:5.1f}%)")

# Check location distribution (top 10)
print("\n" + "=" * 60)
print("TOP 10 LOCATIONS")
print("-" * 60)

pipeline = [
    {"$match": {"location": {"$ne": "NA"}}},
    {"$group": {"_id": "$location", "count": {"$sum": 1}}},
    {"$sort": {"count": -1}},
    {"$limit": 10}
]

for result in profiles.aggregate(pipeline):
    print(f"{result['_id']:40s}: {result['count']:,}")

# Check industry distribution (top 10)
print("\n" + "=" * 60)
print("TOP 10 INDUSTRIES")
print("-" * 60)

pipeline = [
    {"$match": {"current_industry": {"$ne": "NA"}}},
    {"$group": {"_id": "$current_industry", "count": {"$sum": 1}}},
    {"$sort": {"count": -1}},
    {"$limit": 10}
]

for result in profiles.aggregate(pipeline):
    print(f"{result['_id']:40s}: {result['count']:,}")

# Check title keywords
print("\n" + "=" * 60)
print("TOP 10 TITLE KEYWORDS")
print("-" * 60)

pipeline = [
    {"$match": {"title": {"$ne": "NA", "$exists": True}}},
    {"$project": {
        "words": {"$split": ["$title", " "]}
    }},
    {"$unwind": "$words"},
    {"$group": {"_id": "$words", "count": {"$sum": 1}}},
    {"$sort": {"count": -1}},
    {"$limit": 10}
]

for result in profiles.aggregate(pipeline):
    print(f"{result['_id']:40s}: {result['count']:,}")

client.close()