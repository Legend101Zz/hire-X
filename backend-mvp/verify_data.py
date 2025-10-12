#!/usr/bin/env python3
"""
Simple script to verify if we have the data we're looking for.
"""
import os
import re

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

# Connect to MongoDB
url = os.getenv('PROFILES_DB_URL', 'mongodb://localhost:27017')
db_name = os.getenv('PROFILES_DB_NAME', 'mydatabase')
client = MongoClient(url)
db = client[db_name]
profiles = db.profiles

print("=" * 80)
print("🔍 DATABASE VERIFICATION")
print("=" * 80)
print(f"\nConnected to: {db_name}")
print(f"Collection: profiles")
print()

# Total profiles
total = profiles.count_documents({})
print(f"📊 Total profiles in database: {total:,}")
print()

# ============================================================================
# TEST 1: Search for "Senior Software Engineer"
# ============================================================================
print("=" * 80)
print("TEST 1: Senior Software Engineers")
print("=" * 80)

query_senior = {
    "$or": [
        {"title": re.compile("Senior Software Engineer", re.IGNORECASE)},
        {"title": re.compile("Senior.*Engineer", re.IGNORECASE)},
        {"seniority_level": re.compile("Senior", re.IGNORECASE)}
    ]
}

count_senior = profiles.count_documents(query_senior)
print(f"✅ Found {count_senior:,} Senior Software Engineers")

if count_senior > 0:
    print("\n📋 Sample titles:")
    samples = list(profiles.find(query_senior).limit(10))
    for i, s in enumerate(samples, 1):
        print(f"  {i}. {s.get('title', 'N/A')}")
        print(f"     Location: {s.get('location', 'N/A')}")
        print(f"     Industry: {s.get('current_industry', 'N/A')}")
print()

# ============================================================================
# TEST 2: Search for "Fintech" industry
# ============================================================================
print("=" * 80)
print("TEST 2: Fintech Professionals")
print("=" * 80)

query_fintech = {
    "current_industry": re.compile("Fintech", re.IGNORECASE)
}

count_fintech = profiles.count_documents(query_fintech)
print(f"✅ Found {count_fintech:,} profiles in Fintech industry")

if count_fintech > 0:
    print("\n📋 Sample Fintech profiles:")
    samples = list(profiles.find(query_fintech).limit(10))
    for i, s in enumerate(samples, 1):
        print(f"  {i}. {s.get('first_name', '')} {s.get('last_name', '')}")
        print(f"     Title: {s.get('title', 'N/A')}")
        print(f"     Location: {s.get('location', 'N/A')}")
        print(f"     Industry: {s.get('current_industry', 'N/A')}")
else:
    print("\n❌ NO FINTECH PROFILES FOUND!")
    print("\nLet's check what industries we DO have:")
    
    # Get unique industries
    industries = profiles.distinct("current_industry")
    industries = [i for i in industries if i and i != "NA"][:20]
    
    print("\n📊 Sample industries in database:")
    for ind in industries:
        count = profiles.count_documents({"current_industry": ind})
        print(f"   {ind}: {count:,} profiles")
    
    # Check for finance-related
    print("\n🔍 Searching for finance-related industries:")
    finance_keywords = ["finance", "financial", "bank", "payment", "fintech"]
    for keyword in finance_keywords:
        query = {"current_industry": re.compile(keyword, re.IGNORECASE)}
        count = profiles.count_documents(query)
        if count > 0:
            print(f"   '{keyword}': {count:,} profiles")
            # Show example industry names
            examples = profiles.distinct("current_industry", query)[:3]
            for ex in examples:
                print(f"      - {ex}")

print()

# ============================================================================
# TEST 3: Search for Mumbai location
# ============================================================================
print("=" * 80)
print("TEST 3: Mumbai Professionals")
print("=" * 80)

query_mumbai = {
    "$or": [
        {"location": re.compile("Mumbai", re.IGNORECASE)},
        {"city": re.compile("Mumbai", re.IGNORECASE)}
    ]
}

count_mumbai = profiles.count_documents(query_mumbai)
print(f"✅ Found {count_mumbai:,} profiles in Mumbai")

if count_mumbai > 0:
    print("\n📋 Sample Mumbai profiles:")
    samples = list(profiles.find(query_mumbai).limit(5))
    for i, s in enumerate(samples, 1):
        print(f"  {i}. {s.get('first_name', '')} {s.get('last_name', '')}")
        print(f"     Title: {s.get('title', 'N/A')}")
        print(f"     Location: {s.get('location', 'N/A')}")
        print(f"     Industry: {s.get('current_industry', 'N/A')}")
print()

# ============================================================================
# TEST 4: Combined - Senior + Fintech + Mumbai (AND logic)
# ============================================================================
print("=" * 80)
print("TEST 4: COMBINED - Senior Engineers in Fintech in Mumbai")
print("=" * 80)

query_combined = {
    "$and": [
        {
            "$or": [
                {"title": re.compile("Senior.*Engineer", re.IGNORECASE)},
                {"seniority_level": re.compile("Senior", re.IGNORECASE)}
            ]
        },
        {
            "current_industry": re.compile("Fintech", re.IGNORECASE)
        },
        {
            "$or": [
                {"location": re.compile("Mumbai", re.IGNORECASE)},
                {"city": re.compile("Mumbai", re.IGNORECASE)}
            ]
        }
    ]
}

count_combined = profiles.count_documents(query_combined)
print(f"🎯 Found {count_combined} Senior Engineers in Fintech in Mumbai")

if count_combined > 0:
    print("\n🏆 PERFECT MATCHES:")
    perfect_matches = list(profiles.find(query_combined).limit(10))
    for i, p in enumerate(perfect_matches, 1):
        print(f"\n{i}. {p.get('first_name', '')} {p.get('last_name', '')}")
        print(f"   Title: {p.get('title', 'N/A')}")
        print(f"   Location: {p.get('location', 'N/A')}")
        print(f"   Industry: {p.get('current_industry', 'N/A')}")
        print(f"   Seniority: {p.get('seniority_level', 'N/A')}")
        print(f"   Skills: {p.get('expertise', 'N/A')[:80]}...")
else:
    print("\n❌ NO EXACT MATCHES FOUND!")
    print("\nLet's try relaxing requirements:")
    
    # Try without Fintech requirement
    print("\n1️⃣ Senior Engineers in Mumbai (any industry):")
    query_no_fintech = {
        "$and": [
            {
                "$or": [
                    {"title": re.compile("Senior.*Engineer", re.IGNORECASE)},
                    {"seniority_level": re.compile("Senior", re.IGNORECASE)}
                ]
            },
            {
                "$or": [
                    {"location": re.compile("Mumbai", re.IGNORECASE)},
                    {"city": re.compile("Mumbai", re.IGNORECASE)}
                ]
            }
        ]
    }
    count_no_fintech = profiles.count_documents(query_no_fintech)
    print(f"   Found {count_no_fintech} profiles")
    
    if count_no_fintech > 0:
        print("\n   Top 5 by industry:")
        samples = list(profiles.find(query_no_fintech).limit(5))
        for s in samples:
            print(f"   - {s.get('title', 'N/A')[:50]}")
            print(f"     Industry: {s.get('current_industry', 'N/A')}")
    
    # Try Fintech anywhere in India
    print("\n2️⃣ Fintech Engineers anywhere in India:")
    query_fintech_india = {
        "$and": [
            {"title": re.compile("Engineer", re.IGNORECASE)},
            {"current_industry": re.compile("Fintech", re.IGNORECASE)}
        ]
    }
    count_fintech_india = profiles.count_documents(query_fintech_india)
    print(f"   Found {count_fintech_india} profiles")
    
    if count_fintech_india > 0:
        print("\n   Sample locations:")
        samples = list(profiles.find(query_fintech_india).limit(5))
        for s in samples:
            print(f"   - {s.get('location', 'N/A')}")

print()
print("=" * 80)
print("🎬 SUMMARY")
print("=" * 80)
print(f"Total profiles: {total:,}")
print(f"Senior Engineers: {count_senior:,}")
print(f"Fintech profiles: {count_fintech:,}")
print(f"Mumbai profiles: {count_mumbai:,}")
print(f"✨ PERFECT MATCHES (Senior + Fintech + Mumbai): {count_combined}")
print()

if count_combined == 0:
    print("⚠️  RECOMMENDATION:")
    print("   Your database doesn't have profiles that match ALL criteria.")
    print("   You may need to:")
    print("   1. Relax the Fintech requirement (use 'Financial Services', 'Banking')")
    print("   2. Expand location to nearby cities (Pune, Thane, Navi Mumbai)")
    print("   3. Consider mid-level engineers (not just Senior)")
print("=" * 80)