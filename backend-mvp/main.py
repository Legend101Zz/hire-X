"""
Main entry point for the Neuraleap API server.
"""
import uvicorn
import redis
from api import API
from ai_model import Model
from redis_manager import RedisManager

if __name__ == "__main__":
    try:
        redis_manager = RedisManager()
        
        model = Model("openai/gpt-5-nano")
        api = API(model, redis_manager)
        
        print("Starting API server...")
        print("API will be available at: http://localhost:8000")
        print("Test endpoint: POST http://localhost:8000/parse-prompt with JSON body: {\"prompt\": \"We need a Data Scientist in New York\"}")
        print("Session status endpoint: GET http://localhost:8000/session/{session_id}/status")
        print("WebSocket endpoint: ws://localhost:8000/session/{session_id}")
        print("Health check: GET http://localhost:8000/health")
        print("CORS enabled for: http://localhost:3000, http://localhost:3001")
        
        uvicorn.run(api.app, host="0.0.0.0", port=8000)
        
    except redis.ConnectionError:
        print("❌ Failed to start server: Redis connection failed")
        print("Please make sure Redis is running on localhost:6379")
    except Exception as e:
        print(f"❌ Failed to start server: {e}")