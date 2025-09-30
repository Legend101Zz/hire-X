"""
Debug script to check why prompts aren't being added to user profiles.
"""
from pymongo import MongoClient
import json

# Configuration
MONGODB_URL = "mongodb://localhost:27017/"
DATABASE_NAME = "neuraleap"

def check_user_profile(username):
    """Check a specific user's profile."""
    print(f"\n{'='*60}")
    print(f"Checking user profile for: {username}")
    print('='*60)
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        users_collection = db["users"]
        
        user = users_collection.find_one({"username": username})
        
        if user:
            print(f"\n✅ User found!")
            print(f"\nUser document:")
            # Remove sensitive data for display
            user_display = user.copy()
            if 'hashed_password' in user_display:
                user_display['hashed_password'] = "***HIDDEN***"
            if '_id' in user_display:
                user_display['_id'] = str(user_display['_id'])
            
            print(json.dumps(user_display, indent=2, default=str))
            
            # Check if prompts field exists
            if 'prompts' in user:
                print(f"\n✅ 'prompts' field exists")
                print(f"   Number of prompts: {len(user.get('prompts', []))}")
                if user.get('prompts'):
                    print(f"   Prompt IDs:")
                    for i, pid in enumerate(user['prompts'], 1):
                        print(f"     {i}. {pid}")
            else:
                print(f"\n❌ 'prompts' field does NOT exist")
                print(f"   This user was created before the prompts field was added")
                
                # Try to update it manually
                print(f"\n🔧 Attempting to add 'prompts' field...")
                result = users_collection.update_one(
                    {"username": username},
                    {"$set": {"prompts": []}}
                )
                if result.modified_count > 0:
                    print(f"   ✅ Successfully added empty 'prompts' array")
                else:
                    print(f"   ⚠️  Update didn't modify document (might already exist)")
        else:
            print(f"\n❌ User '{username}' not found in database")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

def check_recent_prompts():
    """Check recent prompts in the prompts collection."""
    print(f"\n{'='*60}")
    print("Checking recent prompts")
    print('='*60)
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        prompts_collection = db["prompts"]
        
        # Get 5 most recent prompts
        recent_prompts = list(prompts_collection.find().sort("created_at", -1).limit(5))
        
        if recent_prompts:
            print(f"\n✅ Found {len(recent_prompts)} recent prompts")
            for i, prompt in enumerate(recent_prompts, 1):
                print(f"\n{i}. Prompt:")
                print(f"   - prompt_id: {prompt.get('prompt_id')}")
                print(f"   - session_id: {prompt.get('session_id')}")
                print(f"   - username: {prompt.get('username')}")
                print(f"   - created_at: {prompt.get('created_at')}")
                print(f"   - profiles_found: {prompt.get('total_profiles_found', 0)}")
        else:
            print(f"\n⚠️  No prompts found in database")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

def check_username_in_prompts(username):
    """Check if username appears in any prompts."""
    print(f"\n{'='*60}")
    print(f"Checking prompts for username: {username}")
    print('='*60)
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        prompts_collection = db["prompts"]
        
        user_prompts = list(prompts_collection.find({"username": username}).sort("created_at", -1))
        
        if user_prompts:
            print(f"\n✅ Found {len(user_prompts)} prompts for user '{username}'")
            print(f"\nPrompt IDs that should be in user's profile:")
            for i, prompt in enumerate(user_prompts, 1):
                print(f"   {i}. {prompt.get('prompt_id')}")
            
            # Now check if these are in the user's profile
            users_collection = db["users"]
            user = users_collection.find_one({"username": username})
            
            if user:
                user_prompt_ids = set(user.get('prompts', []))
                prompt_ids_in_db = set(p.get('prompt_id') for p in user_prompts)
                
                missing = prompt_ids_in_db - user_prompt_ids
                if missing:
                    print(f"\n❌ MISMATCH: {len(missing)} prompt(s) NOT in user profile:")
                    for pid in missing:
                        print(f"   - {pid}")
                    
                    print(f"\n🔧 Would you like to fix this? Run:")
                    print(f'   python -c "from debug_user_prompts import fix_user_prompts; fix_user_prompts(\'{username}\')"')
                else:
                    print(f"\n✅ All prompts correctly linked to user profile")
        else:
            print(f"\n⚠️  No prompts found for username '{username}'")
            print(f"   This could mean:")
            print(f"   1. User hasn't created any prompts yet")
            print(f"   2. Prompts were created with a different username")
            print(f"   3. Username field is not being set correctly")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

def fix_user_prompts(username):
    """Fix user's prompts array by syncing with prompts collection."""
    print(f"\n{'='*60}")
    print(f"Fixing prompts for username: {username}")
    print('='*60)
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        prompts_collection = db["prompts"]
        users_collection = db["users"]
        
        # Get all prompts for this user
        user_prompts = list(prompts_collection.find({"username": username}))
        prompt_ids = [p.get('prompt_id') for p in user_prompts if p.get('prompt_id')]
        
        print(f"\n📋 Found {len(prompt_ids)} prompts for user '{username}'")
        
        # Update user's prompts array
        result = users_collection.update_one(
            {"username": username},
            {"$set": {"prompts": prompt_ids}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Successfully updated user's prompts array")
            print(f"   Added {len(prompt_ids)} prompt IDs")
        else:
            print(f"⚠️  No changes made (user might not exist or already up-to-date)")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def list_all_users():
    """List all users in the database."""
    print(f"\n{'='*60}")
    print("All users in database")
    print('='*60)
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        users_collection = db["users"]
        
        users = list(users_collection.find({}, {"username": 1, "email": 1, "prompts": 1}))
        
        if users:
            print(f"\n✅ Found {len(users)} users:\n")
            for i, user in enumerate(users, 1):
                prompts_count = len(user.get('prompts', []))
                has_field = 'prompts' in user
                print(f"{i}. {user.get('username'):20} | prompts field: {'✓' if has_field else '✗'} | count: {prompts_count}")
        else:
            print(f"\n⚠️  No users found")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Run diagnostic checks."""
    import sys
    
    print("\n" + "🔍 USER PROMPTS DIAGNOSTIC TOOL")
    print("="*60)
    
    # List all users
    list_all_users()
    
    # Check recent prompts
    check_recent_prompts()
    
    # If username provided, check specific user
    if len(sys.argv) > 1:
        username = sys.argv[1]
        check_user_profile(username)
        check_username_in_prompts(username)
    else:
        print("\n💡 Usage: python debug_user_prompts.py <username>")
        print("   Example: python debug_user_prompts.py testuser")

if __name__ == "__main__":
    main()
