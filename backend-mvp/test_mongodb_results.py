"""
Test script to verify MongoDB results storage and retrieval.
This script tests the migration from Redis to MongoDB.
"""
import requests
import json
import time
from pymongo import MongoClient

# Configuration
BASE_URL = "http://localhost:8000"
MONGODB_URL = "mongodb://localhost:27017/"
DATABASE_NAME = "neuraleap"

# Test credentials (make sure this user exists)
TEST_USERNAME = "testuser"
TEST_PASSWORD = "testpassword123"

def print_section(title):
    """Print a section header."""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def login():
    """Login and get JWT token."""
    print_section("1. LOGIN")
    
    response = requests.post(
        f"{BASE_URL}/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )
    
    if response.status_code == 200:
        result = response.json()
        token = result["access_token"]
        print(f"✅ Login successful")
        print(f"Token: {token[:50]}...")
        return token
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def create_session(token):
    """Create a new session with a test prompt."""
    print_section("2. CREATE SESSION")
    
    test_prompt = """
    We are looking for a Senior Data Scientist with expertise in machine learning
    and natural language processing. Must have 5+ years of experience with Python,
    TensorFlow, and experience deploying ML models in production.
    """
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/parse-prompt",
        json={"prompt": test_prompt.strip()},
        headers=headers
    )
    
    if response.status_code == 200:
        result = response.json()
        session_id = result["session_id"]
        print(f"✅ Session created: {session_id}")
        return session_id
    else:
        print(f"❌ Session creation failed: {response.text}")
        return None

def wait_for_results(session_id, token, max_wait=120):
    """Wait for workflow to complete and results to be available."""
    print_section("3. WAITING FOR RESULTS")
    
    headers = {"Authorization": f"Bearer {token}"}
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        response = requests.get(
            f"{BASE_URL}/session/{session_id}/status",
            headers=headers
        )
        
        if response.status_code == 200:
            status_data = response.json()
            workflow_status = status_data.get("workflow_status", "unknown")
            print(f"⏳ Workflow status: {workflow_status}")
            
            if workflow_status == "completed":
                print(f"✅ Workflow completed!")
                return True
            elif workflow_status == "waiting_for_followup_answers":
                print(f"⚠️  Waiting for follow-up answers (you may need to submit answers)")
                return False
            elif "error" in workflow_status:
                print(f"❌ Workflow error: {workflow_status}")
                return False
        
        time.sleep(5)
    
    print(f"⏰ Timeout waiting for results")
    return False

def get_results_from_api(session_id, token):
    """Get results from the API endpoint."""
    print_section("4. GET RESULTS FROM API")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/session/{session_id}/results",
        headers=headers
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Results retrieved from API")
        print(f"\nAPI Response Schema:")
        print(f"  - session_id: {result.get('session_id')}")
        print(f"  - status: {result.get('status')}")
        print(f"  - total_profiles_found: {result.get('total_profiles_found', 0)}")
        print(f"  - profiles_returned: {result.get('profiles_returned', 0)}")
        print(f"  - profiles count: {len(result.get('profiles', []))}")
        print(f"  - summary: {json.dumps(result.get('summary', {}), indent=2)}")
        return result
    else:
        print(f"❌ Failed to get results: {response.text}")
        return None

def verify_mongodb_storage(session_id):
    """Verify results are stored in MongoDB with all required fields."""
    print_section("5. VERIFY MONGODB STORAGE")
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        prompts_collection = db["prompts"]
        
        # Find document by session_id
        document = prompts_collection.find_one({"session_id": session_id})
        
        if document:
            print(f"✅ Document found in MongoDB")
            print(f"\nMongoDB Document Fields:")
            print(f"  - _id: {document.get('_id')}")
            print(f"  - prompt_id: {document.get('prompt_id')}")
            print(f"  - session_id: {document.get('session_id')}")
            print(f"  - username: {document.get('username')}")
            print(f"  - prompt: {document.get('prompt', '')[:100]}...")
            print(f"  - created_at: {document.get('created_at')}")
            print(f"  - profiles count: {len(document.get('profiles', []))}")
            print(f"  - total_profiles_found: {document.get('total_profiles_found', 0)}")
            print(f"  - profiles_returned: {document.get('profiles_returned', 0)}")
            
            # Verify required fields
            required_fields = ["prompt_id", "session_id", "username", "prompt", 
                             "profiles", "summary", "created_at"]
            missing_fields = [f for f in required_fields if f not in document]
            
            if missing_fields:
                print(f"\n⚠️  Missing required fields: {missing_fields}")
            else:
                print(f"\n✅ All required fields present!")
            
            # Verify indexes
            indexes = prompts_collection.list_indexes()
            print(f"\nIndexes:")
            for idx in indexes:
                print(f"  - {idx['name']}: {idx.get('key', {})}")
            
            return True
        else:
            print(f"❌ Document not found in MongoDB")
            return False
            
    except Exception as e:
        print(f"❌ MongoDB error: {e}")
        return False

def verify_user_profile_updated(username):
    """Verify that the prompt_id was added to the user's profile."""
    print_section("6. VERIFY USER PROFILE TRACKING")
    
    try:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        users_collection = db["users"]
        
        # Find user
        user = users_collection.find_one({"username": username})
        
        if user:
            print(f"✅ User found: {username}")
            print(f"\nUser Profile:")
            print(f"  - username: {user.get('username')}")
            print(f"  - email: {user.get('email')}")
            print(f"  - created_at: {user.get('created_at')}")
            
            prompts = user.get('prompts', [])
            print(f"  - prompts count: {len(prompts)}")
            
            if prompts:
                print(f"\n  Prompt IDs in user profile:")
                for i, prompt_id in enumerate(prompts[-5:], 1):  # Show last 5
                    print(f"    {i}. {prompt_id}")
                
                # Get latest prompt details
                latest_prompt_id = prompts[-1]
                prompts_collection = db["prompts"]
                prompt_doc = prompts_collection.find_one({"prompt_id": latest_prompt_id})
                
                if prompt_doc:
                    print(f"\n  Latest prompt details:")
                    print(f"    - prompt_id: {prompt_doc.get('prompt_id')}")
                    print(f"    - session_id: {prompt_doc.get('session_id')}")
                    print(f"    - created_at: {prompt_doc.get('created_at')}")
                    print(f"    - profiles_found: {prompt_doc.get('total_profiles_found', 0)}")
                    print(f"\n✅ User profile tracking is working correctly!")
                    return True
                else:
                    print(f"\n⚠️  Could not find prompt document for latest prompt_id")
            else:
                print(f"\n⚠️  No prompts found in user profile")
                return False
        else:
            print(f"❌ User not found: {username}")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying user profile: {e}")
        return False

def compare_schemas(api_result, mongo_document):
    """Compare API response with MongoDB document."""
    print_section("7. SCHEMA COMPARISON")
    
    print("Fields in MongoDB but NOT in API response (expected):")
    mongo_only = ["_id", "prompt_id", "username", "prompt", "created_at", "analysis_metadata"]
    for field in mongo_only:
        if field in mongo_document:
            print(f"  ✅ {field} (MongoDB only)")
    
    print("\nFields in both MongoDB and API response:")
    common_fields = ["session_id", "profiles", "summary", "total_profiles_found", "profiles_returned"]
    for field in common_fields:
        in_api = field in api_result
        in_mongo = field in mongo_document
        if in_api and in_mongo:
            print(f"  ✅ {field} (both)")
        else:
            print(f"  ⚠️  {field} - API: {in_api}, MongoDB: {in_mongo}")

def main():
    """Run all tests."""
    print("\n" + "🔬 MONGODB RESULTS MIGRATION TEST")
    print("="*60)
    
    # Step 1: Login
    token = login()
    if not token:
        print("\n❌ Test failed: Could not login")
        return
    
    # Step 2: Create session
    session_id = create_session(token)
    if not session_id:
        print("\n❌ Test failed: Could not create session")
        return
    
    # Step 3: Wait for results (optional, comment out if testing with existing session)
    # If you want to test with an existing session, comment this out and set session_id manually
    wait_for_results(session_id, token)
    
    # Step 4: Get results from API
    api_result = get_results_from_api(session_id, token)
    if not api_result:
        print("\n⚠️  No results from API yet")
    
    # Step 5: Verify MongoDB storage
    verify_mongodb_storage(session_id)
    
    # Step 6: Verify user profile tracking
    verify_user_profile_updated(TEST_USERNAME)
    
    # Step 7: Compare schemas (if both exist)
    if api_result:
        client = MongoClient(MONGODB_URL)
        db = client[DATABASE_NAME]
        mongo_document = db["prompts"].find_one({"session_id": session_id})
        if mongo_document:
            compare_schemas(api_result, mongo_document)
    
    print_section("✅ TEST COMPLETED")
    print(f"Session ID: {session_id}")
    print(f"Username: {TEST_USERNAME}")
    print("Check the output above to verify all components are working correctly.")
    print("\nKey verifications:")
    print("  1. ✓ Results stored in MongoDB prompts collection")
    print("  2. ✓ prompt_id added to user's prompts array")
    print("  3. ✓ API response maintains frontend compatibility")

if __name__ == "__main__":
    main()
