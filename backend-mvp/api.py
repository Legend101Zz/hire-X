"""
FastAPI application and route definitions.
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from ai_model import AIModel, HiringPromptParser
from auth import AuthManager
from fastapi import (BackgroundTasks, Depends, FastAPI, HTTPException, Query,
                     Request, WebSocket, WebSocketDisconnect, status)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from hatch_service import HatchService
from models import (HatchBulkContactRequest, HatchContactRequest,
                    HatchContactResponse, LoginRequest, LoginResponse,
                    PaginatedResultsResponse, ProfileReference,
                    PromptHistoryItem, PromptHistoryResponse, PromptRequest,
                    PromptResponse, PromptSearchItem, PromptSearchResponse,
                    SessionResponse)
from prompt_manager import PromptManager
from pymongo import MongoClient
from redis_manager import RedisManager
from scorecard_workflow import ScorecardWorkflow
from websocket_manager import WebSocketManager
from workflow import Workflow
from workflow_v2 import WorkflowV2


class API:
    """FastAPI application wrapper with session management."""
    
    def __init__(self, model: AIModel, redis_manager: RedisManager):
        self.app = FastAPI(title="Neuraleap API", version="1.0.0")
        self.parser = HiringPromptParser(model)
        self.redis_manager = redis_manager
        self.hatch_service = HatchService(redis_manager)
        self.workflow = Workflow(redis_manager)
        self.workflow_v2 = WorkflowV2(self.redis_manager)
        self.websocket_manager = WebSocketManager(redis_manager)
        self.auth_manager = AuthManager()
        self.security = HTTPBearer()
        self.scorecard_workflow = ScorecardWorkflow(redis_manager)
        self.prompt_manager = PromptManager()
        # MongoDB connection for prompts collection
        self.mongo_client = MongoClient(os.getenv("MONGODB_URL", "mongodb://localhost:27017/"))
        self.db = self.mongo_client.get_database(os.getenv("DATABASE_NAME", "neuraleap"))
        self.prompts_collection = self.db["prompts"]
        
        #MongoDB connection for profiles database
        profiles_db_url = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017")
        profiles_db_name = os.getenv("PROFILES_DB_NAME", "mydatabase")
        self.profiles_client = MongoClient(profiles_db_url)
        self.profiles_db = self.profiles_client[profiles_db_name]
        self.profiles = self.profiles_db["profiles"]  
        
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
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
            allow_headers=["*"],
            expose_headers=["*"],
            max_age=3600,  # Cache preflight requests for 1 hour
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

        @self.app.get("/session/{session_id}/results", response_model=PaginatedResultsResponse)
        async def get_session_results(
            session_id: str,
            page: int = Query(1, ge=1, description="Page number (1-indexed)"),
            page_size: int = Query(10, ge=1, le=50, description="Number of profiles per page"),
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get paginated session results with profile data fetched from mydatabase/profiles.
            
            Args:
                session_id: The session ID to get results for
                page: Page number (1-indexed, default 1)
                page_size: Number of profiles per page (default 10, max 50)
                current_user: Authenticated user information from JWT token
                
            Returns:
                PaginatedResultsResponse: Paginated session results with profile data
            """
            try:
                # Verify user owns this session
                await self._verify_session_ownership(session_id, current_user)
                
                # Get prompt document from MongoDB
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
                            "profiles": [],
                            "summary": {},
                            "total_profiles_found": 0,
                            "page": page,
                            "page_size": page_size,
                            "total_pages": 0,
                            "has_next": False,
                            "has_prev": False
                        }
                    else:
                        raise HTTPException(status_code=404, detail="No results available for this session")
                
                # Get profile references
                profile_references = mongo_result.get("profile_references", [])
                total_profiles = len(profile_references)
                
                if total_profiles == 0:
                    return {
                        "session_id": session_id,
                        "status": "completed",
                        "profiles": [],
                        "summary": mongo_result.get("summary", {}),
                        "total_profiles_found": 0,
                        "page": page,
                        "page_size": page_size,
                        "total_pages": 0,
                        "has_next": False,
                        "has_prev": False
                    }
                
                # Calculate pagination
                total_pages = (total_profiles + page_size - 1) // page_size  # Ceiling division
                if page > total_pages:
                    page = total_pages
                
                start_idx = (page - 1) * page_size
                end_idx = min(start_idx + page_size, total_profiles)
                
                # Get profile references for current page
                page_profile_refs = profile_references[start_idx:end_idx]
                
                # Extract profile IDs (convert to ObjectId for MongoDB query)
                from bson import ObjectId
                profile_ids = []
                for ref in page_profile_refs:
                    try:
                        profile_ids.append(ObjectId(ref["profile_id"]))
                    except Exception as e:
                        print(f"⚠️  Invalid profile_id: {ref.get('profile_id')} - {e}")
                        continue
                
                # Fetch actual profile data from mydatabase/profiles
                profiles_cursor = self.profiles.find({"_id": {"$in": profile_ids}})
                profiles_dict = {str(p["_id"]): p for p in profiles_cursor}
                
                # Combine profile data with match scores in the correct order
                profiles_with_scores = []
                for ref in page_profile_refs:
                    profile_id = ref["profile_id"]
                    if profile_id in profiles_dict:
                        profile = profiles_dict[profile_id]
                        # Convert ObjectId to string for JSON serialization
                        profile["_id"] = str(profile["_id"])
                        # Add match score and reasons
                        profile["followup_match_score"] = ref.get("match_score", 0)
                        profile["match_reasons"] = ref.get("match_reasons", [])
                        profiles_with_scores.append(profile)
                
                # Return paginated response
                return {
                    "session_id": session_id,
                    "status": "completed",
                    "profiles": profiles_with_scores,
                    "summary": mongo_result.get("summary", {}),
                    "total_profiles_found": total_profiles,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1
                }
                
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error retrieving session results: {str(e)}")
            
        @self.app.options("/login")
        async def login_options():
            """Handle OPTIONS preflight request for login endpoint."""
            return {}
        
        @self.app.options("/parse-prompt")
        async def parse_prompt_options():
            """Handle OPTIONS preflight request for parse-prompt endpoint."""
            return {}
        
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
        
        @self.app.get("/user/prompt-history", response_model=PromptHistoryResponse)
        async def get_user_prompt_history(
            limit: int = Query(5, ge=1, le=20, description="Number of prompts to return"),
            offset: int = Query(0, ge=0, description="Offset for pagination"),
            search: Optional[str] = Query(None, description="Search query"),
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get full prompt history for the current user with pagination and optional search.
            """
            try:
                username = current_user.get("sub")
                if not username:
                    raise HTTPException(status_code=400, detail="Invalid user information")
                
                # Get user's prompt_ids from users collection
                prompt_ids = await self.auth_manager.get_user_prompts(username)
                
                if not prompt_ids:
                    return PromptHistoryResponse(
                        prompts=[],
                        total=0,
                        limit=limit,
                        offset=offset,
                        has_more=False
                    )
                
                # Build query for prompts collection - USE prompt_id, not session_id
                query = {"prompt_id": {"$in": prompt_ids}}
                
                # Add search filter if provided
                if search:
                    query["prompt"] = {"$regex": search, "$options": "i"}
                
                # Get total count
                total = self.prompts_collection.count_documents(query)
                
                # Get paginated prompts, sorted by created_at descending
                cursor = self.prompts_collection.find(
                    query,
                    {
                        "prompt": 1, 
                        "session_id": 1, 
                        "created_at": 1, 
                        "prompt_id": 1, 
                        "query_status": 1,
                        "summary_generation": 1,
                        "_id": 0
                    }
                ).sort("created_at", -1).skip(offset).limit(limit)
                
                prompts_list = list(cursor)
                
                # Format response
                formatted_prompts = []
                for prompt_doc in prompts_list:
                    created_at = prompt_doc.get("created_at")
                    if created_at and hasattr(created_at, 'isoformat'):
                        created_at = created_at.isoformat()
                    elif created_at:
                        created_at = str(created_at)
                    
                    # Get status from query_status field
                    status = prompt_doc.get("query_status", "completed")
                    
                    formatted_prompts.append(PromptHistoryItem(
                        prompt_id=prompt_doc.get("prompt_id"),
                        session_id=prompt_doc.get("session_id"),
                        prompt=prompt_doc.get("prompt", ""),
                        created_at=created_at,
                        status=status
                    ))
                
                has_more = (offset + limit) < total
                
                return PromptHistoryResponse(
                    prompts=formatted_prompts,
                    total=total,
                    limit=limit,
                    offset=offset,
                    has_more=has_more
                )
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error retrieving prompt history: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error retrieving prompt history: {str(e)}")

        @self.app.get("/user/prompt-history/search", response_model=PromptSearchResponse)
        async def search_prompt_history(
            q: str = Query(..., min_length=1, description="Search query"),
            limit: int = Query(10, ge=1, le=20, description="Max results to return"),
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Search through user's prompt history.
            """
            try:
                username = current_user.get("sub")
                if not username:
                    raise HTTPException(status_code=400, detail="Invalid user information")
                
                # Get user's prompt_ids
                prompt_ids = await self.auth_manager.get_user_prompts(username)
                
                if not prompt_ids:
                    return PromptSearchResponse(results=[], total=0, query=q)
                
                # Search in user's prompts - USE prompt_id, not session_id
                query = {
                    "prompt_id": {"$in": prompt_ids},
                    "prompt": {"$regex": q, "$options": "i"}
                }
                
                total = self.prompts_collection.count_documents(query)
                
                cursor = self.prompts_collection.find(
                    query,
                    {
                        "prompt": 1, 
                        "session_id": 1, 
                        "created_at": 1, 
                        "prompt_id": 1, 
                        "_id": 0
                    }
                ).sort("created_at", -1).limit(limit)
                
                prompts_list = list(cursor)
                
                # Format results with highlighting
                results = []
                for prompt_doc in prompts_list:
                    created_at = prompt_doc.get("created_at")
                    if created_at and hasattr(created_at, 'isoformat'):
                        created_at = created_at.isoformat()
                    elif created_at:
                        created_at = str(created_at)
                    
                    # Add highlighting markers for frontend
                    prompt_text = prompt_doc.get("prompt", "")
                    highlight = self._highlight_search_term(prompt_text, q)
                    
                    results.append(PromptSearchItem(
                        prompt_id=prompt_doc.get("prompt_id"),
                        session_id=prompt_doc.get("session_id"),
                        prompt=prompt_text,
                        created_at=created_at,
                        highlight=highlight
                    ))
                
                return PromptSearchResponse(
                    results=results,
                    total=total,
                    query=q
                )
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error searching prompt history: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"Error searching prompt history: {str(e)}")
        @self.app.post("/api/v2/parse-prompt")
        async def parse_prompt_v2(
            request: PromptRequest,
            background_tasks: BackgroundTasks,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Enhanced prompt parsing with preflight check.
            Returns session_id immediately and runs workflow in background.
            """
            session_id = str(uuid.uuid4())
            username = current_user.get("sub")
            
            # Store in Redis
            self.redis_manager.store_prompt(session_id, request.prompt)
            self.redis_manager.store_data(session_id, "user_context", {
                "username": username,
                "user_id": current_user.get("user_id")
            })
            
            # Start workflow in background
            background_tasks.add_task(
                self.workflow_v2.execute_search_workflow,
                session_id
            )
            
            return {
                "session_id": session_id,
                "message": "Search started",
                "status": "processing"
            }
        
        @self.app.get("/api/v2/session/{session_id}/status")
        async def get_session_status_v2(
            session_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get real-time status of search workflow.
            Frontend polls this endpoint for progress updates.
            """
            # Verify ownership
            await self._verify_session_ownership(session_id, current_user)
            
            # Get progress from Redis
            progress = self.redis_manager.get_data(session_id, "progress_update")
            
            if not progress:
                return {"status": "not_found"}
            
            return progress
        
        @self.app.get("/api/v2/session/{session_id}/results")
        async def get_session_results_v2(
            session_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get search results with approved samples and criteria.
            Returns data formatted for table view.
            """
            await self._verify_session_ownership(session_id, current_user)
            
            # Get scorecard for search criteria
            scorecard = await self.redis_manager.get_data_async(session_id, "scorecard")
            
            # Get prompt document
            prompt_doc = None
            if scorecard and scorecard.get("prompt_id"):
                prompt_doc = self.prompt_manager.prompts_collection.find_one({
                    "prompt_id": scorecard["prompt_id"]
                })
            
            if not prompt_doc:
                raise HTTPException(status_code=404, detail="Results not found")
            
            # Get approved samples
            approved_samples = prompt_doc.get("approved_samples", [])
            
            if not approved_samples:
                raise HTTPException(status_code=404, detail="No approved samples found")
            
            # ✅ Format results for table view
            results = []
            scoring_criteria = scorecard.get("scoringCriteria", [])
            
            for sample in approved_samples:
                # Extract what was searched vs what candidate has
                breakdown = sample.get("score_breakdown", [])
                
                # Build column data based on scoring criteria
                criteria_matches = {}
                for criterion in scoring_criteria:
                    description = criterion.get("description", "")
                    points = criterion.get("points", 0)
                    
                    # Find matching breakdown item
                    matched = False
                    earned_points = 0
                    for breakdown_item in breakdown:
                        if breakdown_item.get("description") == description:
                            matched = breakdown_item.get("matched", False)
                            earned_points = breakdown_item.get("earned_points", 0)
                            break
                    
                    criteria_matches[description] = {
                        "matched": matched,
                        "earned_points": earned_points,
                        "max_points": points,
                        "percentage": (earned_points / points * 100) if points > 0 else 0
                    }
                
                results.append({
                    "profile_id": sample["profile_id"],
                    "profile_summary": sample["profile_summary"],
                    "total_score": sample["score"],
                    "max_score": sample["max_score"],
                    "score_percentage": (sample["score"] / sample["max_score"] * 100) if sample["max_score"] > 0 else 0,
                    "criteria_matches": criteria_matches,
                    "score_breakdown": breakdown,
                    "approved_at": sample.get("approved_at")
                })
            
            # Sort by score
            results.sort(key=lambda x: x["total_score"], reverse=True)
            
            return {
                "session_id": session_id,
                "prompt": prompt_doc["prompt"],
                "scorecard": scorecard,
                "total_matches": len(results),
                "results": results,
                "search_criteria": [c["description"] for c in scoring_criteria],
                "must_have_filters": scorecard.get("mustHaveFilters", [])
            }
        @self.app.post("/api/v2/session/{session_id}/load-more")
        async def load_more_results(
            session_id: str,
            batch_size: int = 10,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Generate AI summaries for next batch of profiles.
            Called when user clicks "Load More".
            """
            await self._verify_session_ownership(session_id, current_user)
            
            result = await self.workflow_v2.generate_more_summaries(session_id, batch_size)
            
            return result
        
        @self.app.post("/api/v2/session/{session_id}/refine")
        async def refine_query(
            session_id: str,
            refinements: Dict[str, str],
            background_tasks: BackgroundTasks,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            User provides refinements after preflight check fails.
            Restarts workflow with updated filters.
            """
            await self._verify_session_ownership(session_id, current_user)
            
            # Get original parsed data
            parsed_data = self.redis_manager.get_data(session_id, "parsed_data")
            
            # Apply refinements
            for filter_name, new_value in refinements.items():
                parsed_data["strict_params"][filter_name] = [new_value]
            
            # Store updated data
            self.redis_manager.store_data(session_id, "parsed_data", parsed_data)
            
            # Restart workflow
            background_tasks.add_task(
                self.workflow_v2.execute_search_workflow,
                session_id
            )
            
            return {"message": "Search restarted with refinements"}
        
        @self.app.get("/api/v2/profile/{profile_id}")
        async def get_full_profile(
            profile_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get full profile details including CV.
            """
            from bson import ObjectId
            
            profile = self.workflow_v2.profiles_collection.find_one({
                "_id": ObjectId(profile_id)
            })
            
            if not profile:
                raise HTTPException(status_code=404, detail="Profile not found")
            
            # Convert ObjectId to string
            profile["_id"] = str(profile["_id"])
            
            return profile
    
        @self.app.post("/api/v2/test-alternative")
        async def test_alternative_filter(
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Test an alternative filter value.
            Used during query refinement.
            """
            filter_name = request.get("filter_name")
            value = request.get("value")
            
            if not filter_name or not value:
                raise HTTPException(status_code=400, detail="filter_name and value required")
            
            # Use preflight checker to test
            count = self.workflow_v2.preflight.test_alternative(filter_name, value)
            
            return {
                "filter_name": filter_name,
                "value": value,
                "count": count,
                "viable": count > 0
            }

        @self.app.post("/api/v2/extract-filters")
        async def extract_filters(
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Extract filters from natural language query in real-time.
            """
            try:
                query = request.get("query", "")
                
                if not query or len(query) < 10:
                    return {"filters": {}}
                
                # Use the parser to extract filters
                parsed = self.workflow_v2.parser.parse_with_tiers(query)
                
                # Extract key filters for UI display
                filters = {}
                strict_params = parsed.get("strict_params", {})
                
                # Map backend filter names to user-friendly names
                filter_mapping = {
                    "location": "Location",
                    "current_industry": "Industry",
                    "title": "Role",
                    "years_of_experience": "Experience",
                    "seniority_level": "Seniority",
                    "skills": "Skills"
                }
                
                for key, values in strict_params.items():
                    if values and len(values) > 0:
                        friendly_key = filter_mapping.get(key, key.replace("_", " ").title())
                        # Take first value or join multiple
                        if isinstance(values, list):
                            filters[friendly_key] = values[0] if len(values) == 1 else ", ".join(values[:3])
                        else:
                            filters[friendly_key] = values
                
                return {"filters": filters}
                
            except Exception as e:
                print(f"Error extracting filters: {e}")
                return {"filters": {}}
            
        @self.app.post("/api/v2/extract-filters-quick")
        async def extract_filters_quick(
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Quickly extract basic filters using regex (instant).
            Then enhance with AI in background.
            """
            try:
                query = request.get("query", "").lower()
                
                if not query or len(query) < 3:
                    return {"filters": {}}
                
                # Quick extraction using regex patterns
                filters = {}
                
                # Location patterns
                indian_cities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow']
                countries = ['india', 'usa', 'uk', 'canada', 'singapore', 'australia']
                
                for city in indian_cities:
                    if city in query:
                        filters['location'] = filters.get('location', [])
                        if city.title() not in filters['location']:
                            filters['location'].append(city.title())
                
                for country in countries:
                    if country in query:
                        filters['country'] = filters.get('country', [])
                        if country.title() not in filters['country']:
                            filters['country'].append(country.title())
                
                # Industry patterns
                industries = {
                    'fintech': 'Financial Services',
                    'finance': 'Financial Services',
                    'banking': 'Banking',
                    'healthcare': 'Healthcare',
                    'pharma': 'Pharmaceuticals',
                    'it': 'Information Technology',
                    'software': 'Information Technology',
                    'tech': 'Technology',
                    'retail': 'Retail',
                    'ecommerce': 'E-commerce',
                    'marketing': 'Marketing & Advertising',
                    'consulting': 'Management Consulting',
                    'manufacturing': 'Manufacturing',
                    'education': 'Education'
                }
                
                for keyword, industry in industries.items():
                    if keyword in query:
                        filters['industry'] = filters.get('industry', [])
                        if industry not in filters['industry']:
                            filters['industry'].append(industry)
                
                # Experience patterns
                import re
                exp_patterns = [
                    r'(\d+)\+?\s*(?:years?|yrs?)',
                    r'(\d+)-(\d+)\s*(?:years?|yrs?)'
                ]
                
                for pattern in exp_patterns:
                    matches = re.findall(pattern, query)
                    if matches:
                        if isinstance(matches[0], tuple):
                            filters['experience'] = f"{matches[0][0]}-{matches[0][1]} years"
                        else:
                            filters['experience'] = f"{matches[0]}+ years"
                        break
                
                # Seniority patterns
                seniority_keywords = {
                    'senior': 'Senior',
                    'lead': 'Lead',
                    'principal': 'Principal',
                    'junior': 'Junior',
                    'mid': 'Mid-Level',
                    'entry': 'Entry Level',
                    'director': 'Director',
                    'manager': 'Manager',
                    'head': 'Head',
                    'vp': 'Vice President',
                    'cto': 'C-Level',
                    'ceo': 'C-Level',
                    'cfo': 'C-Level'
                }
                
                for keyword, level in seniority_keywords.items():
                    if keyword in query:
                        filters['seniority'] = level
                        break
                
                # Job title extraction (common roles)
                common_roles = [
                    'engineer', 'developer', 'architect', 'designer', 'analyst',
                    'manager', 'director', 'consultant', 'specialist', 'lead',
                    'scientist', 'researcher', 'coordinator', 'administrator'
                ]
                
                for role in common_roles:
                    if role in query:
                        # Extract surrounding words for context
                        words = query.split()
                        for i, word in enumerate(words):
                            if role in word:
                                # Get 1-2 words before
                                start = max(0, i-2)
                                title_words = words[start:i+1]
                                filters['title'] = ' '.join(title_words).title()
                                break
                        break
                
                # Skills extraction (common tech skills)
                skills = [
                    'python', 'java', 'javascript', 'react', 'node', 'angular', 'vue',
                    'sql', 'nosql', 'mongodb', 'postgresql', 'aws', 'azure', 'gcp',
                    'docker', 'kubernetes', 'ml', 'ai', 'data science', 'machine learning',
                    'devops', 'agile', 'scrum', 'salesforce', 'sap'
                ]
                
                found_skills = []
                for skill in skills:
                    if skill in query:
                        found_skills.append(skill.upper() if len(skill) <= 3 else skill.title())
                
                if found_skills:
                    filters['skills'] = found_skills[:5]  # Limit to 5
                
                return {"filters": filters, "source": "quick"}
                
            except Exception as e:
                print(f"Error in quick filter extraction: {e}")
                return {"filters": {}}
            
        @self.app.get("/api/v2/session/{session_id}/download")
        async def download_results(
            session_id: str,
            format: str = Query("csv", regex="^(csv|pdf|json)$"),
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Download search results in various formats.
            """
            await self._verify_session_ownership(session_id, current_user)
            
            # Get results
            prompt_doc = self.workflow_v2.prompts_collection.find_one({"session_id": session_id})
            
            if not prompt_doc:
                raise HTTPException(status_code=404, detail="Results not found")
            
            if format == "json":
                return JSONResponse(content=prompt_doc, default=str)
            
            elif format == "csv":
                # Generate CSV
                import csv
                from io import StringIO
                
                output = StringIO()
                writer = csv.writer(output)
                
                # Headers
                writer.writerow([
                    'Rank', 'Name', 'Title', 'Location', 'Industry', 
                    'Score', 'Summary', 'Skills', 'LinkedIn'
                ])
                
                # Data
                for idx, profile in enumerate(prompt_doc['matched_profiles'], 1):
                    profile_summary = profile.get('profile_summary', {})
                    ai_summary = prompt_doc.get('ai_summaries', {}).get(profile['profile_id'], {})
                    
                    writer.writerow([
                        idx,
                        profile_summary.get('name', 'N/A'),
                        profile_summary.get('title', 'N/A'),
                        profile_summary.get('location', 'N/A'),
                        profile_summary.get('industry', 'N/A'),
                        ai_summary.get('final_score', profile.get('pre_score', 0)),
                        ai_summary.get('summary', ''),
                        '',  # Skills - would need to fetch from full profile
                        ''   # LinkedIn - would need to fetch from full profile
                    ])
                
                output.seek(0)
                
                return StreamingResponse(
                    iter([output.getvalue()]),
                    media_type="text/csv",
                    headers={
                        "Content-Disposition": f"attachment; filename=search_results_{session_id}.csv"
                    }
                )
            
            else:
                raise HTTPException(status_code=400, detail=f"Format {format} not supported yet")

        @self.app.post("/api/v2/session/{session_id}/save-candidate")
        async def save_candidate(
            session_id: str,
            profile_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Save a candidate to user's saved list.
            """
            username = current_user.get("sub")
            
            # Add to user's saved candidates
            self.workflow_v2.users_collection.update_one(
                {"username": username},
                {"$addToSet": {"saved_candidates": profile_id}}
            )
            
            return {"message": "Candidate saved successfully"}

        @self.app.get("/api/v2/user/saved-candidates")
        async def get_saved_candidates(
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get user's saved candidates.
            """
            username = current_user.get("sub")
            
            user = self.workflow_v2.users_collection.find_one({"username": username})
            
            if not user:
                return {"candidates": []}
            
            saved_ids = user.get("saved_candidates", [])
            
            # Fetch full profiles
            from bson import ObjectId
            profiles = list(self.workflow_v2.profiles_collection.find({
                "_id": {"$in": [ObjectId(pid) for pid in saved_ids]}
            }))
            
            # Convert ObjectId to string
            for profile in profiles:
                profile["_id"] = str(profile["_id"])
            
            return {"candidates": profiles}
        
        
        @self.app.post("/api/scorecard/start")
        async def start_scorecard_workflow(
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Start a new scorecard building session.
            
            Body:
                {
                    "query": "Senior backend engineer with Go in Gurgaon"
                }
            
            Returns:
                {
                    "session_id": "...",
                    "scorecard": {...},
                    "message": "Initial validation message",
                    "phase": "validation"
                }
            """
            try:
                query = request.get("query", "").strip()
                if not query:
                    raise HTTPException(status_code=400, detail="Query is required")
                
                username = current_user.get("sub")
                
                # Create new session
                session_id = str(uuid.uuid4())
                
                # Initialize session in Redis
                await self.redis_manager.create_session(session_id)
                await self.redis_manager.store_data_async(session_id, "username", username)
                await self.redis_manager.store_data_async(session_id, "query", query)
                await self.redis_manager.store_data_async(session_id, "phase", "entity_extraction")
                
                
                prompt_doc = self.prompt_manager.create_prompt(
                session_id=session_id,
                username=username,
                prompt_text=query,
                scorecard_id=None  # Will link after scorecard creation
                )
                prompt_id = prompt_doc["prompt_id"]
                self.prompt_manager.add_prompt_to_user(username, prompt_id)
                
                # Store prompt_id in session
                await self.redis_manager.store_data_async(session_id, "prompt_id", prompt_id)
            
                # Start scorecard building workflow
                result = await self.scorecard_workflow.start_scorecard_building(
                    session_id=session_id,
                    username=username,
                    initial_query=query,
                    prompt_id=prompt_id 
                )
                
                scorecard_id = result["scorecard"]["scorecard_id"]
                
                # Link prompt and scorecard
                self.prompt_manager.link_scorecard(prompt_id, scorecard_id)
                # Initialize conversation history
                conversation = [
                    {"role": "user", "content": query},
                    {"role": "assistant", "content": result["message"]}
                ]
                await self.redis_manager.set_session_data(session_id, "conversation", conversation)
                
                # Broadcast via WebSocket
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "scorecard_created",
                        "data": {
                            "scorecard": result["scorecard"],
                            "message": result["message"],
                            "phase": result["phase"],
                            "prompt_id": prompt_id
                        }
                    }
                )
                
                return {
                    "session_id": session_id,
                    "prompt_id": prompt_id,
                    "scorecard": result["scorecard"],
                    "message": result["message"],
                    "phase": result["phase"]
                }
                
            except Exception as e:
                print(f"❌ Error starting scorecard workflow: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))


        @self.app.post("/api/scorecard/{session_id}/message")
        async def send_scorecard_message(
            session_id: str,
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Send a message in the scorecard refinement conversation.
            
            Body:
                {
                    "message": "Yes, include Software Engineer titles too"
                }
            
            Returns:
                {
                    "scorecard": {...},
                    "message": "Next validation question",
                    "phase": "validation" or "ready_to_search",
                    "ready": false or true
                }
            """
            try:
                user_message = request.get("message", "").strip()
                if not user_message:
                    raise HTTPException(status_code=400, detail="Message is required")
                
                # Get conversation history
                conversation = self.redis_manager.get_data(session_id, "conversation") or []
                
                # Add user message
                conversation.append({"role": "user", "content": user_message})
                
                # Process feedback
                result = await self.scorecard_workflow.process_user_feedback(
                    session_id=session_id,
                    user_message=user_message,
                    conversation_history=conversation
                )
                
                if "error" in result:
                    raise HTTPException(status_code=404, detail=result["error"])
                
                # Add assistant response
                conversation.append({"role": "assistant", "content": result["message"]})
                await self.redis_manager.store_data_async(session_id, "conversation", conversation)
                
                # Update phase
                await self.redis_manager.store_data_async(session_id, "phase", result["phase"])
                
                # Broadcast via WebSocket
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "scorecard_updated",
                        "data": {
                            "scorecard": result["scorecard"],
                            "message": result["message"],
                            "phase": result["phase"],
                            "ready": result.get("ready", False)
                        }
                    }
                )
                
                return result
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error processing scorecard message: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))


        @self.app.get("/api/scorecard/{session_id}")
        async def get_scorecard(
            session_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """Get current scorecard for a session."""
            try:
                scorecard =  await self.redis_manager.get_data_async(session_id, "scorecard")
                conversation =  await self.redis_manager.get_data_async(session_id, "conversation") or []
                phase = await self.redis_manager.get_data_async(session_id, "phase") or "unknown"
                
                if not scorecard:
                    raise HTTPException(status_code=404, detail="Scorecard not found")
                
                return {
                    "scorecard": scorecard,
                    "conversation": conversation,
                    "phase": phase
                }
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error getting scorecard: {e}")
                raise HTTPException(status_code=500, detail=str(e))


        @self.app.put("/api/scorecard/{session_id}")
        async def update_scorecard(
            session_id: str,
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Manually update scorecard (for advanced edit mode).
            
            Body:
                {
                    "scorecard": {...}
                }
            """
            try:
                updated_scorecard = request.get("scorecard")
                if not updated_scorecard:
                    raise HTTPException(status_code=400, detail="Scorecard is required")
                
                # Update in Redis
                await self.redis_manager.store_data_async(session_id, "scorecard", updated_scorecard)
                
                # Update in MongoDB
                from datetime import datetime
                updated_scorecard["updated_at"] = datetime.utcnow().isoformat()
                
                self.scorecard_workflow.scorecards_collection.update_one(
                    {"session_id": session_id},
                    {"$set": updated_scorecard}
                )
                
                # Broadcast update
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "scorecard_updated",
                        "data": {"scorecard": updated_scorecard}
                    }
                )
                
                return {"scorecard": updated_scorecard}
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error updating scorecard: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/scorecard/{session_id}/update-expansions")
        async def update_expansions(
            session_id: str,
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Manually update expansions.
            
            Body:
                {
                    "expansions": {
                        "roles": [...],
                        "skills": [...],
                        "industries": [...],
                        "locations": [...]
                    }
                }
            """
            try:
                new_expansions = request.get("expansions")
                if not new_expansions:
                    raise HTTPException(status_code=400, detail="Expansions required")
                
                scorecard = await self.redis_manager.get_data_async(session_id, "scorecard")
                if not scorecard:
                    raise HTTPException(status_code=404, detail="Scorecard not found")
                
                # Track change
                change_record = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": "user",
                    "changes": [{"section": "expansions", "field": "all", "action": "modify"}],
                    "snapshot": {
                        "mustHaveFilters": scorecard["mustHaveFilters"],
                        "scoringCriteria": scorecard["scoringCriteria"],
                        "expansions": new_expansions,
                        "threshold": scorecard["threshold"]
                    }
                }
                
                if "changeHistory" not in scorecard:
                    scorecard["changeHistory"] = []
                scorecard["changeHistory"].append(change_record)
                
                # Update expansions
                scorecard["expansions"] = new_expansions
                scorecard["updated_at"] = datetime.utcnow().isoformat()
                
                # Save
                self.scorecard_workflow.scorecards_collection.update_one(
                    {"scorecard_id": scorecard["scorecard_id"]},
                    {"$set": scorecard}
                )
                
                if "_id" in scorecard:
                    del scorecard["_id"]
                
                await self.redis_manager.store_data_async(session_id, "scorecard", scorecard)
                
                # Broadcast
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "scorecard_updated",
                        "data": {"scorecard": scorecard}
                    }
                )
                
                return {"scorecard": scorecard}
                
            except Exception as e:
                print(f"❌ Error updating expansions: {e}")
                raise HTTPException(status_code=500, detail=str(e))
        
        
        @self.app.post("/api/scorecard/{session_id}/sample-search")
        async def get_sample_candidates(
            session_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get sample candidates for preview.
            
            Returns 5 sample candidates scored and ranked.
            """
            try:
                result = await self.scorecard_workflow.get_sample_candidates(
                    session_id=session_id,
                    sample_size=5
                )
                
                if "error" in result:
                    raise HTTPException(status_code=404, detail=result["error"])
                
                # Update phase
                await self.redis_manager.store_data_async(session_id, "phase", "sample_validation")
                
                # Broadcast via WebSocket
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "samples_ready",
                        "data": {
                            "samples": result["samples"],
                            "total_matches": result.get("total_matches", 0),
                            "message": result.get("message", ""),
                            "phase": "sample_validation"
                        }
                    }
                )
                
                return result
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error getting samples: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))


        @self.app.post("/api/scorecard/{session_id}/approve-samples")
        async def approve_samples(
            session_id: str,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            User approved the sample candidates.
            Store samples and redirect to full search.
            """
            try:
                scorecard = await self.redis_manager.get_data_async(session_id, "scorecard")
                
                if not scorecard:
                    raise HTTPException(status_code=404, detail="Scorecard not found")
                
                # Get sample candidates from Redis (they were stored during sample search)
                sample_candidates = await self.redis_manager.get_data_async(session_id, "sample_candidates") or []
                
                # ✅ FINAL REFINEMENT: Optimize expansions
                conversation = await self.redis_manager.get_data_async(session_id, "conversation") or []
                
                print("🎯 Performing FINAL expansion refinement...")
                refined_scorecard = await self.scorecard_workflow.finalize_scorecard(
                    scorecard=scorecard,
                    conversation_history=conversation
                )
                
                # Update scorecard
                refined_scorecard["updated_at"] = datetime.utcnow().isoformat()
                refined_scorecard["status"] = "finalized"
                
                self.scorecard_workflow.scorecards_collection.update_one(
                    {"scorecard_id": refined_scorecard["scorecard_id"]},
                    {"$set": refined_scorecard}
                )
                
                # ✅ NEW: Store approved samples in prompt document
                prompt_id = refined_scorecard.get("prompt_id")
                
                if prompt_id and sample_candidates:
                    print(f"📝 Storing {len(sample_candidates)} approved samples in prompt document...")
                    
                    # Prepare samples for storage
                    approved_samples = []
                    for candidate in sample_candidates:
                        approved_samples.append({
                            "profile_id": str(candidate["profile"].get("_id", "")),
                            "score": candidate["score"],
                            "max_score": candidate["max_score"],
                            "score_breakdown": candidate["score_breakdown"],
                            "profile_summary": {
                                "name": f"{candidate['profile'].get('first_name', '')} {candidate['profile'].get('last_name', '')}",
                                "title": candidate['profile'].get('title', ''),
                                "location": candidate['profile'].get('location', ''),
                                "current_industry": candidate['profile'].get('current_industry', ''),
                                "expertise": candidate['profile'].get('expertise', ''),
                            },
                            "approved_at": datetime.utcnow().isoformat()
                        })
                    
                    # Update prompt document
                    self.prompt_manager.prompts_collection.update_one(
                        {"prompt_id": prompt_id},
                        {
                            "$set": {
                                "approved_samples": approved_samples,
                                "samples_approved_at": datetime.utcnow().isoformat(),
                                "status": "samples_approved"
                            }
                        }
                    )
                    
                    print(f"✅ Stored {len(approved_samples)} samples in prompt {prompt_id}")
                
                if "_id" in refined_scorecard:
                    del refined_scorecard["_id"]
                
                await self.redis_manager.store_data_async(session_id, "scorecard", refined_scorecard)
                await self.redis_manager.store_data_async(session_id, "phase", "ready_for_full_search")
                
                # Broadcast via WebSocket
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "samples_approved",
                        "data": {
                            "scorecard": refined_scorecard,
                            "phase": "ready_for_full_search",
                            "message": "Perfect! Your criteria is fully optimized. Ready to search all candidates! 🚀",
                            "redirect_to_results": True  # ✅ Signal to redirect
                        }
                    }
                )
                
                return {
                    "success": True,
                    "scorecard": refined_scorecard,
                    "phase": "ready_for_full_search",
                    "message": "Samples approved! Scorecard finalized.",
                    "redirect_to_results": True
                }
                
            except Exception as e:
                print(f"❌ Error approving samples: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/api/scorecard/{session_id}/reject-samples")
        async def reject_samples(
            session_id: str,
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            User rejected the sample candidates with feedback.
            
            Body:
                {
                    "feedback": "Too junior, need more senior candidates"
                }
            """
            try:
                feedback = request.get("feedback", "").strip()
                if not feedback:
                    raise HTTPException(status_code=400, detail="Feedback is required")
                
                result = await self.scorecard_workflow.process_sample_rejection(
                    session_id=session_id,
                    feedback=feedback
                )
                
                if "error" in result:
                    raise HTTPException(status_code=404, detail=result["error"])
                
                # Update phase
                phase = result.get("phase", "sample_iteration")
                await self.redis_manager.store_data_async(session_id, "phase", phase)
                
                # Broadcast via WebSocket
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "samples_rejected",
                        "data": {
                            "scorecard": result["scorecard"],
                            "message": result["message"],
                            "phase": phase,
                            "iteration_count": result.get("iteration_count", 0)
                        }
                    }
                )
                
                return result
                
            except HTTPException:
                raise
            except Exception as e:
                print(f"❌ Error rejecting samples: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/api/scorecard/{session_id}/apply-suggestion")
        async def apply_ai_suggestion(
            session_id: str,
            request: dict,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Apply AI's suggestion to relax filters and search again.
            
            Body:
                {
                    "suggestion": {...},  // The suggestion object from AI
                    "accepted": true
                }
            """
            try:
                suggestion = request.get("suggestion")
                accepted = request.get("accepted", False)
                
                if not accepted:
                    return {"message": "Suggestion rejected"}
                
                scorecard = await self.redis_manager.get_data_async(session_id, "scorecard")
                
                if not scorecard:
                    raise HTTPException(status_code=404, detail="Scorecard not found")
                
                # Apply suggested changes
                filters = scorecard.get("mustHaveFilters", [])
                
                # Remove suggested filters
                filters_to_remove = suggestion.get("filters_to_remove", [])
                if filters_to_remove:
                    filters = [f for f in filters if f.get("field") not in filters_to_remove]
                
                # Modify suggested filters
                filters_to_modify = suggestion.get("filters_to_modify", [])
                for mod in filters_to_modify:
                    field = mod.get("field")
                    change = mod.get("change")
                    
                    for f in filters:
                        if f.get("field") == field:
                            # Apply the change (could be updating value, operator, etc.)
                            # This is simplified - you might need more logic
                            if "value" in change:
                                f["value"] = change["value"]
                            if "operator" in change:
                                f["operator"] = change["operator"]
                
                # Update scorecard
                scorecard["mustHaveFilters"] = filters
                scorecard["updated_at"] = datetime.utcnow().isoformat()
                
                # Save
                self.scorecard_workflow.scorecards_collection.update_one(
                    {"scorecard_id": scorecard["scorecard_id"]},
                    {"$set": scorecard}
                )
                
                if "_id" in scorecard:
                    del scorecard["_id"]
                
                await self.redis_manager.store_data_async(session_id, "scorecard", scorecard)
                
                # Broadcast update
                await self.websocket_manager.broadcast_to_session(
                    session_id,
                    {
                        "action": "scorecard_updated",
                        "data": {
                            "scorecard": scorecard,
                            "message": "Criteria updated based on AI suggestion. Re-searching..."
                        }
                    }
                )
                
                # Automatically trigger new sample search
                result = await self.scorecard_workflow.get_sample_candidates(
                    session_id=session_id,
                    sample_size=5
                )
                
                return result
                
            except Exception as e:
                print(f"❌ Error applying suggestion: {e}")
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=str(e))
        
        @self.app.post("/hatch/contact", response_model=HatchContactResponse)
        async def get_hatch_contact(
            request: HatchContactRequest,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get contact information (phone or email) for a single candidate.
            
            Process:
            1. Gets profile from mydatabase/profiles using the profile_id (_id)
            2. Checks neuraleap/candidates for cached contact info
            3. If cache miss, calls Hatch API and saves result
            
            Args:
                profile_id: MongoDB _id from mydatabase/profiles
                session_id: Optional session ID for Redis caching
            """
            try:
                result = await self.hatch_service.get_contact_info_by_profile_id(
                    profile_mongo_id=request.profile_id,
                    session_id=request.session_id
                )
                return result
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.app.post("/hatch/bulk-contact")
        async def get_hatch_bulk_contact(
            request: HatchBulkContactRequest,
            current_user: dict = Depends(self.get_current_user)
        ):
            """
            Get contact information for multiple candidates (max 5).
            
            Process:
            1. For each profile_id, gets profile from mydatabase/profiles
            2. Checks neuraleap/candidates for cached contact info
            3. If cache miss, calls Hatch API and saves result
            
            Args:
                profile_ids: List of MongoDB _ids from mydatabase/profiles (max 5)
                session_id: Optional session ID for Redis caching
            """
            try:
                results = await self.hatch_service.get_bulk_contact_info(
                    profile_ids=request.profile_ids,
                    session_id=request.session_id
                )
                return {
                    "success": True,
                    "count": len(results),
                    "results": results
                }
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    
    
    async def _verify_session_ownership(self, session_id: str, current_user: dict):
        """
        Verify that the current user owns the specified session.
        Checks Redis first (for active sessions), then MongoDB (for older sessions).
        
        Args:
            session_id: Session ID to verify
            current_user: Authenticated user information from JWT token
            
        Raises:
            HTTPException: If user doesn't own the session or session doesn't exist
        """
        try:
            # Get current username from JWT token
            current_username = current_user.get("sub")
            if not current_username:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid user information in token"
                )
            
            # First, try to get user context from Redis (for active sessions)
            user_context = self.redis_manager.get_data(session_id, "user_context")
            
            if user_context:
                # Session is active in Redis - verify ownership
                session_username = user_context.get("username")
                if session_username != current_username:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: You don't have permission to access this session"
                    )
                return  # Ownership verified
            
            # If not in Redis, check MongoDB (for older/completed sessions)
            mongo_result = self.prompts_collection.find_one(
                {"session_id": session_id},
                {"username": 1, "_id": 0}  # Only fetch username field
            )
            
            if not mongo_result:
                # Session doesn't exist in Redis or MongoDB
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Session not found"
                )
            
            # Verify ownership from MongoDB data
            session_username = mongo_result.get("username")
            if session_username != current_username:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You don't have permission to access this session"
                )
            
            # Ownership verified from MongoDB
            return
                
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

    def _highlight_search_term(self, text: str, search_term: str) -> str:
        """
        Add markers around search term for frontend highlighting.
        
        Args:
            text: Original text
            search_term: Term to highlight
            
        Returns:
            str: Text with <<term>> markers for highlighting
        """
        if not search_term or not text:
            return text
        
        import re

        # Case-insensitive replacement with markers
        pattern = re.compile(re.escape(search_term), re.IGNORECASE)
        return pattern.sub(lambda m: f"<<{m.group()}>>", text)