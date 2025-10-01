"""
Check which databases the backend is connected to.
"""
import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables
load_dotenv()

def check_connections():
    """Display all database connection information."""
    print("\n" + "="*70)
    print("🔍 BACKEND DATABASE CONNECTIONS CHECK")
    print("="*70 + "\n")
    
    # Get environment variables
    mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
    database_name = os.getenv("DATABASE_NAME", "neuraleap")
    profiles_db_url = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017")
    profiles_db_name = os.getenv("PROFILES_DB_NAME", "mydatabase")
    
    # Main Database (Users, Prompts, Logs)
    print("📊 MAIN DATABASE (Users, Prompts, Logs)")
    print("-" * 70)
    print(f"  URL: {mongodb_url}")
    print(f"  Database Name: {database_name}")
    
    try:
        client = MongoClient(mongodb_url, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        
        db = client[database_name]
        collections = db.list_collection_names()
        
        print(f"  Status: ✅ CONNECTED")
        print(f"  Server Info: {client.server_info()['version']}")
        
        # Check if it's local or remote
        if "localhost" in mongodb_url or "127.0.0.1" in mongodb_url:
            print(f"  Type: 🏠 LOCAL")
        elif "mongodb.net" in mongodb_url or "mongodb+srv" in mongodb_url:
            print(f"  Type: ☁️  REMOTE (MongoDB Atlas)")
        else:
            print(f"  Type: 🌐 REMOTE")
        
        print(f"  Collections: {', '.join(collections) if collections else 'None'}")
        
        # Count documents in key collections
        if 'users' in collections:
            user_count = db.users.count_documents({})
            print(f"    - users: {user_count} documents")
        if 'prompts' in collections:
            prompts_count = db.prompts.count_documents({})
            print(f"    - prompts: {prompts_count} documents")
        if 'user_logs' in collections:
            logs_count = db.user_logs.count_documents({})
            print(f"    - user_logs: {logs_count} documents")
            
    except Exception as e:
        print(f"  Status: ❌ CONNECTION FAILED")
        print(f"  Error: {str(e)}")
    
    print()
    
    # Profiles Database
    print("👤 PROFILES DATABASE (Candidate Profiles)")
    print("-" * 70)
    print(f"  URL: {profiles_db_url}")
    print(f"  Database Name: {profiles_db_name}")
    
    try:
        profiles_client = MongoClient(profiles_db_url, serverSelectionTimeoutMS=5000)
        profiles_client.admin.command('ping')
        
        profiles_db = profiles_client[profiles_db_name]
        collections = profiles_db.list_collection_names()
        
        print(f"  Status: ✅ CONNECTED")
        print(f"  Server Info: {profiles_client.server_info()['version']}")
        
        # Check if it's local or remote
        if "localhost" in profiles_db_url or "127.0.0.1" in profiles_db_url:
            print(f"  Type: 🏠 LOCAL")
        elif "mongodb.net" in profiles_db_url or "mongodb+srv" in profiles_db_url:
            print(f"  Type: ☁️  REMOTE (MongoDB Atlas)")
        else:
            print(f"  Type: 🌐 REMOTE")
        
        print(f"  Collections: {', '.join(collections) if collections else 'None'}")
        
        # Count profiles
        if 'profiles' in collections:
            profiles_count = profiles_db.profiles.count_documents({})
            print(f"    - profiles: {profiles_count} documents")
            
    except Exception as e:
        print(f"  Status: ❌ CONNECTION FAILED")
        print(f"  Error: {str(e)}")
    
    print()
    
    # Redis Connection
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = os.getenv("REDIS_PORT", "6379")
    redis_db = os.getenv("REDIS_DB", "0")
    
    print("⚡ REDIS CONNECTION")
    print("-" * 70)
    print(f"  Host: {redis_host}")
    print(f"  Port: {redis_port}")
    print(f"  DB: {redis_db}")
    
    try:
        import redis
        r = redis.Redis(host=redis_host, port=int(redis_port), db=int(redis_db), 
                       socket_connect_timeout=5, decode_responses=True)
        r.ping()
        
        print(f"  Status: ✅ CONNECTED")
        
        if redis_host == "localhost" or redis_host == "127.0.0.1":
            print(f"  Type: 🏠 LOCAL")
        else:
            print(f"  Type: 🌐 REMOTE")
            
        info = r.info()
        print(f"  Redis Version: {info.get('redis_version', 'Unknown')}")
        
        # Count keys
        key_count = r.dbsize()
        print(f"  Keys in DB: {key_count}")
        
    except Exception as e:
        print(f"  Status: ❌ CONNECTION FAILED")
        print(f"  Error: {str(e)}")
    
    print()
    print("="*70)
    print("✅ Connection check complete!")
    print("="*70 + "\n")

if __name__ == "__main__":
    check_connections()

