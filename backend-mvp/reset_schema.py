#!/usr/bin/env python3
"""
Reset prompts collection with new schema for lazy AI summaries.
WARNING: This will delete all existing prompts!
"""
import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

def reset_prompts_schema():
    """Reset prompts collection with new schema."""
    
    # Connect to neuraleap database
    url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
    db_name = os.getenv("DATABASE_NAME", "neuraleap")
    
    client = MongoClient(url)
    db = client[db_name]
    
    print("=" * 80)
    print("⚠️  SCHEMA RESET - This will delete all prompts!")
    print("=" * 80)
    
    # Check existing data
    existing_count = db.prompts.count_documents({})
    print(f"\nCurrent prompts in collection: {existing_count}")
    
    if existing_count > 0:
        confirm = input(f"\n❌ Delete {existing_count} existing prompts? (type 'DELETE' to confirm): ")
        if confirm != "DELETE":
            print("Cancelled.")
            return
    
    # Drop old collection
    print("\n🗑️  Dropping old prompts collection...")
    db.prompts.drop()
    
    # Create new collection with indexes
    print("📝 Creating new prompts collection...")
    
    # Create indexes
    db.prompts.create_index("prompt_id", unique=True)
    db.prompts.create_index("session_id", unique=True)
    db.prompts.create_index([("username", 1), ("created_at", -1)])
    db.prompts.create_index("query_status")
    
    print("✅ Created indexes:")
    print("   - prompt_id (unique)")
    print("   - session_id (unique)")
    print("   - username + created_at")
    print("   - query_status")
    
    # Also reset users.prompts array
    print("\n🔄 Resetting user prompt arrays...")
    result = db.users.update_many({}, {"$set": {"prompts": []}})
    print(f"   Updated {result.modified_count} users")
    
    print("\n" + "=" * 80)
    print("✅ SCHEMA RESET COMPLETE")
    print("=" * 80)
    print("\nNew schema ready for:")
    print("  • Lazy AI summaries")
    print("  • Incremental loading")
    print("  • Preflight checks")
    print("  • Query refinement")
    print()

if __name__ == "__main__":
    reset_prompts_schema()