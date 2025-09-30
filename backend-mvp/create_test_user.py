"""
Script to create a test user for testing the login API.
Run this script to create a sample user in MongoDB.
"""
import asyncio
import os
from dotenv import load_dotenv
from auth import AuthManager

# Load environment variables from .env file
load_dotenv()


async def create_test_user():
    """Create a test user for development/testing purposes."""
    auth_manager = AuthManager()
    
    # Test user credentials
    username = "testuser"
    password = "testpassword123"
    email = "test@example.com"
    
    try:
        # Create the test user
        success = await auth_manager.create_user(username, password, email)
        
        if success:
            print(f"✅ Test user created successfully!")
            print(f"Username: {username}")
            print(f"Password: {password}")
            print(f"Email: {email}")
            print("\nYou can now test the login API with these credentials.")
        else:
            print(f"❌ Failed to create test user. User might already exist.")
            
    except Exception as e:
        print(f"❌ Error creating test user: {e}")


if __name__ == "__main__":
    print("Creating test user for login API testing...")
    asyncio.run(create_test_user())
