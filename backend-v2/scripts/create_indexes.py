"""
Verify and create optimal indexes
=================================
"""

import os

from dotenv import load_dotenv
from pymongo import ASCENDING, MongoClient

load_dotenv()

client = MongoClient(os.getenv("PROFILES_DB_URL"))
db = client[os.getenv("PROFILES_DB_NAME")]
profiles = db["profiles"]

print("=" * 60)
print("INDEX VERIFICATION & CREATION")
print("=" * 60)

# Drop the massive text index (it's killing performance)
print("\n🗑️  Dropping text index (too slow)...")
try:
    profiles.drop_index("idx_text_search")
    print("   ✅ Dropped idx_text_search")
except:
    print("   ℹ️  Text index not found (already dropped)")

# Required indexes for fast queries
required_indexes = [
    # Single field indexes
    {
        "keys": [("location", ASCENDING)],
        "name": "idx_location",
        "background": True
    },
    {
        "keys": [("current_industry", ASCENDING)],
        "name": "idx_industry",
        "background": True
    },
    {
        "keys": [("seniority_level", ASCENDING)],
        "name": "idx_seniority",
        "background": True
    },
    {
        "keys": [("title", ASCENDING)],
        "name": "idx_title",
        "background": True
    },
    {
        "keys": [("experience_years", ASCENDING)],
        "name": "idx_experience_years",
        "background": True
    },
    
    # Compound indexes for common query patterns
    {
        "keys": [
            ("location", ASCENDING),
            ("experience_years", ASCENDING)
        ],
        "name": "idx_location_exp",
        "background": True
    },
    {
        "keys": [
            ("current_industry", ASCENDING),
            ("experience_years", ASCENDING)
        ],
        "name": "idx_industry_exp",
        "background": True
    },
    {
        "keys": [
            ("location", ASCENDING),
            ("current_industry", ASCENDING),
            ("experience_years", ASCENDING)
        ],
        "name": "idx_location_industry_exp",
        "background": True
    }
]

# Get existing indexes
existing = {idx['name'] for idx in profiles.list_indexes()}

print("\n📋 Creating missing indexes...\n")

for idx_spec in required_indexes:
    name = idx_spec['name']
    
    if name in existing:
        print(f"   ✅ {name} (already exists)")
    else:
        print(f"   🔨 Creating {name}...", end=" ")
        try:
            profiles.create_index(
                idx_spec['keys'],
                name=idx_spec['name'],
                background=idx_spec['background']
            )
            print("✅")
        except Exception as e:
            print(f"❌ {e}")

print("\n" + "=" * 60)
print("FINAL INDEX LIST")
print("=" * 60)

for idx in profiles.list_indexes():
    print(f"   - {idx['name']}")

client.close()