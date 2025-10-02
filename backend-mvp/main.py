"""
Main entry point for the Neuraleap API server.
"""
import os

import redis
import uvicorn
from ai_model import Model
from api import API
from dotenv import load_dotenv
from redis_manager import RedisManager

# Load environment variables from .env file
load_dotenv()

if __name__ == "__main__":
    try:
        redis_manager = RedisManager()
        
        # Model will use OPENROUTER_API_KEY and AI_MODEL_NAME from env
        model = Model()
        api = API(model, redis_manager)

        port = int(os.getenv("PORT", 8000))

        print("Starting API server...")
        print(f"API will be available at: http://localhost:{port}")
        print(f"Test endpoint: POST http://localhost:{port}/parse-prompt with JSON body: {{\"prompt\": \"We need a Data Scientist in New York\"}}")
        print(f"Session status endpoint: GET http://localhost:{port}/session/{{session_id}}/status")
        print(f"WebSocket endpoint: ws://localhost:{port}/session/{{session_id}}")
        print(f"Health check: GET http://localhost:{port}/health")
        print("CORS enabled for: http://localhost:3000, http://localhost:3001")
        
        uvicorn.run(api.app, host="0.0.0.0", port=port)
        
    except redis.ConnectionError:
        print("❌ Failed to start server: Redis connection failed")
        print("Please make sure Redis is running on localhost:6379")
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
