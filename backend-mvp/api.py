"""
FastAPI application and route definitions.
"""
import uuid
import asyncio
import json
import os
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models import PromptRequest, SessionResponse, LoginRequest, LoginResponse
from ai_model import AIModel, HiringPromptParser
from redis_manager import RedisManager
from workflow import Workflow
from websocket_manager import WebSocketManager
from auth import AuthManager
from pymongo import MongoClient

class API:
    """FastAPI application wrapper with session management."""
    
    def __init__(self, model: AIModel, redis_manager: RedisManager):
        self.app = FastAPI(title="Neuraleap API", version="1.0.0")
        self.parser = HiringPromptParser(model)
        self.redis_manager = redis_manager
        self.workflow = Workflow(redis_manager)
        self.websocket_manager = WebSocketManager(redis_manager)
        self.auth_manager = AuthManager()
        self.security = HTTPBearer()
        
        # MongoDB connection for prompts collection
        self.mongo_client = MongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017/"))
        self.db = self.mongo_client.get_database(os.getenv("DATABASE_NAME", "neuraleap"))
        self.prompts_collection = self.db["prompts"]
        
        self._setup_cors()
        self._setup_routes()
    
    def _setup_cors(self):
        """Setup CORS middleware to allow frontend connections."""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://localhost:3000",  # React development server
                "http://127.0.0.1:3000",  # Alternative localhost
                "http://localhost:3001",  # Alternative port
                "http://127.0.0.1:3001",  # Alternative port
                "https://dev.damnuiwdbbvte.amplifyapp.com",  # AWS Amplify deployment
                "https://dev.damnuiwdbbvte.amplifyapp.com/",  # With trailing slash
            ],
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )
    
    async def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
        """
        JWT authentication dependency to verify tokens and get current user.
        
        Args:
            credentials: HTTP Bearer token credentials
            
        Returns:
            dict: JWT payload containing user information
            
        Raises:
            HTTPException: If token is invalid or expired
        """
        try:
            token = credentials.credentials
            payload = self.auth_manager.verify_token(token)
            
            if not payload:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Extract username from token payload
            username = payload.get("sub")
            if not username:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            return payload
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def _setup_routes(self):
        """Setup all API routes."""
        
        @self.app.post("/login", response_model=LoginResponse)
        async def login(request: LoginRequest, http_request: Request):
            """
            Authenticate user and return JWT token.
            
            Args:
                request: Login credentials (username and password)
                http_request: HTTP request object for IP and user agent
                
            Returns:
                LoginResponse: JWT token and user information
            """
            try:
                # Get client information
                client_ip = http_request.client.host if http_request.client else None
                user_agent = http_request.headers.get("user-agent")
                
                # Authenticate user
                user = await self.auth_manager.authenticate_user(request.username, request.password)
                
                if not user:
                    # Log failed login attempt
                    await self.auth_manager.log_incident(
                        username=request.username,
                        incident_type="failed_login",
                        ip_address=client_ip,
                        user_agent=user_agent,
                        details="Invalid username or password"
                    )
                    
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid username or password",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                
                # Create JWT token
                access_token = self.auth_manager.create_access_token(
                    data={"sub": user.username, "user_id": user.username}
                )
                
                return LoginResponse(
                    access_token=access_token,
                    token_type="bearer",
                    user_id=user.username,
                    username=user.username,
                    email=user.email
                )
                
            except HTTPException:
                raise
            except Exception as e:
                # Log any unexpected errors
                await self.auth_manager.log_incident(
                    username=request.username,
                    incident_type="login_error",
                    ip_address=client_ip,
                    user_agent=user_agent,
                    details=f"Unexpected error during login: {str(e)}"
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Internal server error during authentication"
                )
        
        @self.app.post("/parse-prompt", response_model=SessionResponse)
        async def parse_prompt(request: PromptRequest, current_user: dict = Depends(self.get_current_user)):
            """
            Create a session and trigger workflow for prompt processing.
            
            Args:
                request: JSON request containing the prompt to process
                current_user: Authenticated user information from JWT token
                
            Returns:
                SessionResponse: Session ID and confirmation message
            """
            try:
                if not request.prompt.strip():
                    raise HTTPException(status_code=400, detail="Prompt cannot be empty")
                
                session_id = str(uuid.uuid4())
                username = current_user.get("sub")
                
                # Store prompt with user context
                if not self.redis_manager.store_prompt(session_id, request.prompt):
                    raise HTTPException(status_code=500, detail="Failed to store prompt")
                
                # Store user context for this session
                await self.workflow._store_data(session_id, "user_context", {
                    "username": username,
                    "user_id": current_user.get("user_id", username),
                    "created_at": str(asyncio.get_event_loop().time())
                })
                
                # Add prompt_id to user's prompts array in MongoDB
                await self.auth_manager.add_prompt_to_user(username, session_id)
                
                # Start workflow - it will pause after followup questions
                await self.workflow.process_session(session_id)
                
                # Log initial session creation to Neural Leap database
                await self.workflow.log_user_session_data(session_id)
                
                return SessionResponse(
                    session_id=session_id,
                    message="Session created and workflow started successfully"
                )
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")
        
        @self.app.get("/session/{session_id}/status")
        async def get_session_status(session_id: str, current_user: dict = Depends(self.get_current_user)):
            """
            Get the status of a session.
            
            Args:
                session_id: The session ID to check
                current_user: Authenticated user information from JWT token
                
            Returns:
                dict: Session status and data
            """
            try:
                # Verify user owns this session
                await self._verify_session_ownership(session_id, current_user)
                
                status = self.redis_manager.get_workflow_status(session_id)
                prompt = self.redis_manager.get_prompt(session_id)
                filtered_data = self.redis_manager.get_filtered_data(session_id)
                
                return {
                    "session_id": session_id,
                    "workflow_status": status or "not_found",
                    "has_prompt": prompt is not None,
                    "has_filtered_data": filtered_data is not None,
                    "prompt": prompt,
                    "filtered_data": filtered_data
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error retrieving session: {str(e)}")
        
        @self.app.websocket("/session/{session_id}")
        async def websocket_endpoint(
            websocket: WebSocket, 
            session_id: str, 
            token: str = Query(..., description="JWT token for authentication")
        ):
            """
            WebSocket endpoint for real-time session updates.
            
            Args:
                websocket: WebSocket connection
                session_id: Session ID to monitor
                token: JWT token for authentication (required query parameter)
            """
            try:
                # Authenticate WebSocket connection
                payload = self.auth_manager.verify_token(token)
                if not payload:
                    await websocket.close(code=1008, reason="Invalid or expired token")
                    return
                
                # Verify user owns this session
                try:
                    await self._verify_session_ownership(session_id, payload)
                except HTTPException as e:
                    if e.status_code == 404:
                        await websocket.close(code=1008, reason="Session not found")
                    elif e.status_code == 403:
                        await websocket.close(code=1008, reason="Access denied: You don't have permission to access this session")
                    else:
                        await websocket.close(code=1008, reason="Authentication failed")
                    return
                
                # Connect WebSocket
                await self.websocket_manager.connect(websocket, session_id)
                
                # Keep connection alive and handle messages
                while True:
                    try:
                        # Wait for messages from client (optional)
                        message = await websocket.receive_text()
                        print(f"📨 Received message from session {session_id}: {message}")
                        
                        # Process the message
                        try:
                            message_data = json.loads(message)
                            action = message_data.get("action")
                            
                            if action == "answer":
                                # Handle follow-up question answer
                                question = message_data.get("question")
                                answer = message_data.get("answer")
                                await self._store_followup_answer(session_id, question, answer)
                                
                                # Log follow-up interaction to Neural Leap database
                                await self.workflow.log_followup_interaction(session_id, question, answer)
                                
                                print(f"✅ Stored follow-up answer for session {session_id}")
                                
                                # Check if all followup questions are answered and resume workflow
                                await self._check_and_resume_workflow(session_id)
                            else:
                                print(f"🤷 Unknown action: {action}")
                                
                        except json.JSONDecodeError:
                            print(f"❌ Invalid JSON received from session {session_id}")
                        except Exception as e:
                            print(f"❌ Error processing message from session {session_id}: {e}")
                        
                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        print(f"❌ WebSocket error for session {session_id}: {e}")
                        break
                        
            except WebSocketDisconnect:
                print(f"🔌 WebSocket disconnected for session: {session_id}")
            except Exception as e:
                print(f"❌ WebSocket connection error for session {session_id}: {e}")
            finally:
                # Cleanup connection
                await self.websocket_manager.disconnect(websocket, session_id)
        
        @self.app.get("/")
        async def root():
            """Root endpoint with API information."""
            return {"message": "Neuraleap API", "version": "1.0.0"}
        
        @self.app.post("/session/{session_id}/answer")
        async def submit_followup_answer(session_id: str, answer_data: dict, current_user: dict = Depends(self.get_current_user)):
            """
            Submit a follow-up question answer.
            
            Args:
                session_id: Session ID
                answer_data: JSON containing question and answer
                current_user: Authenticated user information from JWT token
                
            Returns:
                dict: Confirmation message
            """
            try:
                # Verify user owns this session
                await self._verify_session_ownership(session_id, current_user)
                
                question = answer_data.get("question")
                answer = answer_data.get("answer")
                
                if not question or not answer:
                    raise HTTPException(status_code=400, detail="Question and answer are required")
                
                # Store the answer
                await self._store_followup_answer(session_id, question, answer)
                
                # Log follow-up interaction to Neural Leap database
                await self.workflow.log_followup_interaction(session_id, question, answer)
                
                return {"message": "Answer submitted successfully"}
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error submitting answer: {str(e)}")
        
        @self.app.get("/session/{session_id}/results")
        async def get_session_results(session_id: str, current_user: dict = Depends(self.get_current_user)):
            """
            Get the final results/profiles for a session from MongoDB.
            
            Args:
                session_id: The session ID to get results for
                current_user: Authenticated user information from JWT token
                
            Returns:
                dict: Session results including profiles and summary (same schema as before)
            """
            try:
                # Verify user owns this session
                await self._verify_session_ownership(session_id, current_user)
                
                # Get final results from MongoDB
                mongo_result = self.prompts_collection.find_one({"session_id": session_id})
                
                if not mongo_result:
                    # Check if workflow is still in progress
                    status = self.redis_manager.get_workflow_status(session_id)
                    if status == "not_found":
                        raise HTTPException(status_code=404, detail="Session not found")
                    elif status in ["processing", "waiting_for_followup_answers"]:
                        return {
                            "session_id": session_id,
                            "status": "processing",
                            "message": "Results are still being processed",
                            "profiles": [],
                            "summary": {}
                        }
                    else:
                        raise HTTPException(status_code=404, detail="No results available for this session")
                
                # Return same schema as before (frontend compatible)
                return {
                    "session_id": session_id,
                    "status": "completed",
                    "profiles": mongo_result.get("profiles", []),
                    "summary": mongo_result.get("summary", {}),
                    "total_profiles_found": mongo_result.get("total_profiles_found", 0),
                    "profiles_returned": mongo_result.get("profiles_returned", 0)
                }
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error retrieving session results: {str(e)}")
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint for CORS testing."""
            return {"status": "healthy", "cors": "enabled"}
        
        @self.app.post("/session/{session_id}/resume")
        async def resume_workflow(session_id: str, current_user: dict = Depends(self.get_current_user)):
            """
            Manually resume workflow for a session (useful for testing or manual triggers).
            
            Args:
                session_id: Session ID to resume
                current_user: Authenticated user information from JWT token
                
            Returns:
                dict: Confirmation message
            """
            try:
                # Verify user owns this session
                await self._verify_session_ownership(session_id, current_user)
                
                # Check if workflow is waiting for followup answers
                status = self.redis_manager.get_workflow_status(session_id)
                if status != "waiting_for_followup_answers":
                    return {"message": f"Workflow is not waiting for followup answers. Current status: {status}"}
                
                # Resume the workflow
                success = await self.workflow.resume_workflow_after_followup(session_id)
                
                if success:
                    return {"message": "Workflow resumed successfully"}
                else:
                    return {"message": "Failed to resume workflow"}
                    
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error resuming workflow: {str(e)}")
        
        @self.app.get("/user/prompts")
        async def get_user_prompts(current_user: dict = Depends(self.get_current_user)):
            """
            Get all prompt_ids for the current user.
            
            Args:
                current_user: Authenticated user information from JWT token
                
            Returns:
                dict: List of prompt_ids created by the user
            """
            try:
                username = current_user.get("sub")
                if not username:
                    raise HTTPException(status_code=400, detail="Invalid user information")
                
                # Get user's prompts using the auth manager
                prompts = await self.auth_manager.get_user_prompts(username)
                
                return {
                    "username": username,
                    "prompts": prompts,
                    "total_prompts": len(prompts)
                }
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error retrieving user prompts: {str(e)}")
        
        @self.app.get("/user/prompt-history")
        async def get_user_prompt_history(current_user: dict = Depends(self.get_current_user)):
            """
            Get full prompt history for the current user with prompt text.
            
            Args:
                current_user: Authenticated user information from JWT token
                
            Returns:
                dict: List of prompts with their text, session_id, and created_at timestamp
            """
            try:
                username = current_user.get("sub")
                if not username:
                    raise HTTPException(status_code=400, detail="Invalid user information")
                
                # Get user's prompt_ids from users collection
                prompts_ids = await self.auth_manager.get_user_prompts(username)
                
                # Fetch prompt details from prompts collection
                prompt_history = []
                for prompt_id in prompts_ids:
                    prompt_doc = self.prompts_collection.find_one(
                        {"prompt_id": prompt_id},
                        {"prompt": 1, "session_id": 1, "created_at": 1, "prompt_id": 1, "_id": 0}
                    )
                    if prompt_doc:
                        # Convert datetime to ISO string if it exists
                        created_at = prompt_doc.get("created_at")
                        if created_at and hasattr(created_at, 'isoformat'):
                            created_at = created_at.isoformat()
                        elif created_at:
                            created_at = str(created_at)
                        
                        prompt_history.append({
                            "prompt_id": prompt_doc.get("prompt_id"),
                            "session_id": prompt_doc.get("session_id"),
                            "prompt": prompt_doc.get("prompt", ""),
                            "created_at": created_at
                        })
                
                # Sort by created_at descending (most recent first)
                prompt_history.sort(key=lambda x: x.get("created_at") or "", reverse=True)
                
                return {
                    "username": username,
                    "prompts": prompt_history,
                    "total_prompts": len(prompt_history)
                }
                
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error retrieving prompt history: {str(e)}")
    
    
    async def _verify_session_ownership(self, session_id: str, current_user: dict):
        """
        Verify that the current user owns the specified session.
        
        Args:
            session_id: Session ID to verify
            current_user: Authenticated user information from JWT token
            
        Raises:
            HTTPException: If user doesn't own the session or session doesn't exist
        """
        try:
            # Get user context for this session
            user_context = self.redis_manager.get_data(session_id, "user_context")
            
            if not user_context:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Session not found"
                )
            
            # Check if the current user owns this session
            session_username = user_context.get("username")
            current_username = current_user.get("sub")
            
            if session_username != current_username:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You don't have permission to access this session"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error verifying session ownership: {str(e)}"
            )
    
    async def _store_followup_answer(self, session_id: str, question: str, answer: str):
        """
        Store a follow-up question answer.
        
        Args:
            session_id: Session ID
            question: The question that was answered
            answer: The answer provided
        """
        try:
            # Get existing answers or create new list
            answers_data = self.redis_manager.get_data(session_id, "followup_answers")
            if not answers_data:
                answers_data = {"answers": []}
            
            # Check if this question was already answered
            existing_answer = None
            for i, existing in enumerate(answers_data["answers"]):
                if existing.get("question") == question:
                    existing_answer = i
                    break
            
            # Add or update answer
            answer_entry = {
                "question": question,
                "answer": answer,
                "timestamp": str(asyncio.get_event_loop().time())
            }
            
            if existing_answer is not None:
                answers_data["answers"][existing_answer] = answer_entry
            else:
                answers_data["answers"].append(answer_entry)
            
            # Store back in Redis
            await self.workflow._store_data(session_id, "followup_answers", answers_data)
            
            print(f"💾 Stored follow-up answer for session {session_id}: {question} -> {answer}")
            
        except Exception as e:
            print(f"❌ Error storing follow-up answer for session {session_id}: {e}")
    
    async def _check_and_resume_workflow(self, session_id: str):
        """
        Check if all followup questions are answered and resume workflow if so.
        
        Args:
            session_id: Session ID
        """
        try:
            # Get follow-up questions (stored directly as a list)
            questions = self.redis_manager.get_data(session_id, "followup_questions")
            if not questions:
                return
            
            # Get follow-up answers (stored as a dictionary with "answers" key)
            answers_data = self.redis_manager.get_data(session_id, "followup_answers")
            if not answers_data:
                return
            
            answers = answers_data.get("answers", [])
            
            # Check if all questions are answered
            if len(answers) >= len(questions):
                print(f"✅ All follow-up questions answered for session {session_id}, resuming workflow...")
                
                # Resume the workflow
                await self.workflow.resume_workflow_after_followup(session_id)
            else:
                print(f"⏳ Still waiting for {len(questions) - len(answers)} more follow-up answers for session {session_id}")
            
        except Exception as e:
            print(f"❌ Error checking and resuming workflow for session {session_id}: {e}")
