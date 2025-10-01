"""
Migration script to add prompts field to all existing users and sync existing prompts.

This script:
1. Adds the 'prompts' field to all users who don't have it
2. Syncs existing prompts from the prompts collection to user profiles
"""
from pymongo import MongoClient
import os

# Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
DATABASE_NAME = os.getenv("DATABASE_NAME", "neuraleap")

def migrate_all_users():
    """Migrate all users to have prompts field and sync existing prompts."""
    print("\n" + "="*60)
    print("🔄 MIGRATING USER PROMPTS")
    print("="*60 + "\n")
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        users_collection = db["users"]
        prompts_collection = db["prompts"]
        
        # Get all users
        all_users = list(users_collection.find({}))
        print(f"📋 Found {len(all_users)} users to migrate\n")
        
        migrated_count = 0
        skipped_count = 0
        
        for user in all_users:
            username = user.get("username")
            
            # Get all prompts for this user
            user_prompts = list(prompts_collection.find({"username": username}))
            prompt_ids = [p.get("prompt_id") for p in user_prompts if p.get("prompt_id")]
            
            # Check if user already has prompts field with correct data
            existing_prompts = set(user.get("prompts", []))
            new_prompts = set(prompt_ids)
            
            if "prompts" not in user or existing_prompts != new_prompts:
                # Update user's prompts array
                result = users_collection.update_one(
                    {"username": username},
                    {"$set": {"prompts": prompt_ids}}
                )
                
                if result.modified_count > 0:
                    print(f"✅ {username:20} | Added {len(prompt_ids)} prompts")
                    migrated_count += 1
                else:
                    print(f"⚠️  {username:20} | No changes needed")
                    skipped_count += 1
            else:
                print(f"⏭️  {username:20} | Already up-to-date ({len(prompt_ids)} prompts)")
                skipped_count += 1
        
        print(f"\n" + "="*60)
        print(f"✅ Migration Complete!")
        print(f"   - Migrated: {migrated_count} users")
        print(f"   - Skipped: {skipped_count} users (already up-to-date)")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}\n")
        raise

if __name__ == "__main__":
    migrate_all_users()
