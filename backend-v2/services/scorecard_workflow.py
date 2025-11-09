"""
Scorecard Workflow Service
==========================
This is the main orchestrator for the scorecard generation workflow.

It coordinates:
1. AI parsing of the job requirement
2. Database search for candidates
3. Scoring and ranking
4. Storing results

This is a clean, simplified version of the old workflow.py
"""

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List

from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from services.ai_parser import AIParser
from services.candidate_scorer import CandidateScorer
from services.search_engine import SearchEngine

# Get the logger for this module
logger = get_logger(__name__)

class ScorecardWorkflow:
    """
    Main workflow orchestrator for scorecard generation.
    
    This class replaces the old workflow.py with a cleaner design:
    - Clear separation of concerns
    - Each step is a simple method
    - Easy to test and modify
    - Good error handling
    """
    
    def __init__(
        self,
        search_engine: SearchEngine,
        scorer: CandidateScorer,
        ai_parser: AIParser,
        mongodb: MongoDB,
        redis_cache: RedisCache
    ):
        """
        Initialize workflow with all required services.
        
        Args:
            search_engine: For searching candidate database
            scorer: For scoring and ranking candidates
            ai_parser: For parsing job requirements
            mongodb: For storing results
            redis_cache: For caching and progress tracking
        """
        self.search = search_engine
        self.scorer = scorer
        self.ai = ai_parser
        self.db = mongodb
        self.cache = redis_cache
    
    async def execute(
        self,
        session_id: str,
        prompt: str,
        username: str
    ) -> Dict[str, Any]:
        """
        Execute the complete scorecard workflow.
        
        This is the main entry point that your API calls.
        
        Steps:
        1. Parse prompt with AI (~2s)
        2. Search database (~0.5s with indexes)
        3. Score candidates (~1s with parallel processing)
        4. Store results (~0.2s)
        
        Total: ~3.7s (vs 95s without optimization!)
        
        Args:
            session_id: Unique identifier for this workflow run
            prompt: User's job requirements (natural language)
            username: Username for tracking and storage
            
        Returns:
            Dictionary with scorecard results:
            {
                "session_id": "abc-123",
                "status": "completed",
                "candidates": [...],  # Top 50 scored candidates
                "summary": {...},     # Statistics
                "created_at": "2025-01-01T00:00:00"
            }
            
        Example:
            result = await workflow.execute(
                session_id="abc-123",
                prompt="Find Senior Python Developer in SF",
                username="john@company.com"
            )
        """
        
        logger.debug("\n" + "=" * 80)
        logger.debug(f"STARTING SCORECARD WORKFLOW")
        logger.debug(f"   Session: {session_id}")
        logger.debug(f"   User: {username}")
        logger.debug("=" * 80)
        
        try:
            # ================================================================
            # STEP 1: Parse Prompt (AI extracts structured requirements)
            # ================================================================
            await self._update_progress(session_id, "parsing", 10, "Analyzing your requirements...")
            
            parsed_requirements = await self.ai.parse_prompt(prompt)
            
            # Store parsed data in cache (for later use)
            await self.cache.store_session_data(
                session_id, "parsed_requirements", parsed_requirements
            )
            
            # Store original prompt
            await self.cache.store_prompt(session_id, prompt)
            
            # Store user context
            await self.cache.store_user_context(session_id, username)
            
            # ================================================================
            # STEP 2: Search Database (find matching candidates)
            # ================================================================
            await self._update_progress(session_id, "searching", 30, "Searching our database...")
            
            candidates = self.search.search_with_fallback(
                strict_industries=parsed_requirements.get("strict_industries", []),
                strict_seniority=parsed_requirements.get("strict_seniority", []),
                broad_industries=parsed_requirements.get("broad_industries", []),
                broad_seniority=parsed_requirements.get("broad_seniority", []),
                locations=parsed_requirements.get("locations", []),
                keywords=parsed_requirements.get("keywords", "")
            )
            
            if not candidates or len(candidates) == 0:
                # No candidates found
                return await self._handle_no_candidates_found(session_id, username, prompt)
            
            logger.info(f"Found {len(candidates)} candidates")
            
            # Store candidates in cache
            await self.cache.store_session_data(session_id, "candidates", candidates)
            
            # ================================================================
            # STEP 3: Score and Rank Candidates (parallel processing)
            # ================================================================
            await self._update_progress(session_id, "scoring", 60, "Scoring and ranking candidates...")
            
            scored_candidates = await self.scorer.score_batch(
                candidates=candidates,
                criteria=parsed_requirements
            )
            
            # ================================================================
            # STEP 4: Store Results (save to MongoDB)
            # ================================================================
            await self._update_progress(session_id, "storing", 85, "Saving results...")
            
            scorecard = await self._create_and_store_scorecard(
                session_id=session_id,
                username=username,
                prompt=prompt,
                parsed_requirements=parsed_requirements,
                scored_candidates=scored_candidates
            )
            
            # ================================================================
            # STEP 5: Complete
            # ================================================================
            await self._update_progress(session_id, "completed", 100, "Done!")
            
            logger.info("=" * 80)
            logger.info(f"WORKFLOW COMPLETED")
            logger.info(f"   Total candidates: {scorecard['summary']['total_candidates']}")
            logger.info(f"   Top score: {scorecard['summary']['top_score']:.1f}")
            logger.info("=" * 80)
            logger.info()
            
            # Log this action
            await self.db.log_user_action(
                username=username,
                action="scorecard_created",
                details={"session_id": session_id, "candidates_found": len(scored_candidates)}
            )
            
            return scorecard
            
        except Exception as e:
            # Handle any errors
            logger.error(f"\nWORKFLOW ERROR: {e}")
            import traceback
            traceback.print_exc()
            
            return await self._handle_error(session_id, username, prompt, str(e))
    
    async def _create_and_store_scorecard(
        self,
        session_id: str,
        username: str,
        prompt: str,
        parsed_requirements: Dict[str, Any],
        scored_candidates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create scorecard document and store in MongoDB.
        
        This creates the final scorecard with all results and metadata.
        """
        
        # Generate unique prompt ID
        prompt_id = str(uuid.uuid4())
        
        # Take only top 50 candidates for storage
        top_candidates = scored_candidates[:50]
        
        # Calculate summary statistics
        summary = self._generate_summary(scored_candidates)
        
        # Create scorecard document
        scorecard = {
            "prompt_id": prompt_id,
            "session_id": session_id,
            "username": username,
            "prompt": prompt,
            "parsed_requirements": parsed_requirements,
            "candidates": top_candidates,
            "summary": summary,
            "created_at": datetime.utcnow(),
            "status": "completed"
        }
        
        # Store in MongoDB
        doc_id = await self.db.save_scorecard(scorecard)
        scorecard["_id"] = doc_id
        
        # Also cache for quick access
        await self.cache.store_session_data(session_id, "scorecard", scorecard)
        
        return scorecard
    
    def _generate_summary(self, scored_candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate summary statistics for the scorecard.
        
        Returns:
            Dictionary with statistics like average score, distribution, etc.
        """
        
        if not scored_candidates:
            return {
                "total_candidates": 0,
                "average_score": 0,
                "top_score": 0,
                "distribution": {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
            }
        
        scores = [c.get("score", 0) for c in scored_candidates]
        
        # Calculate score distribution
        distribution = {
            "excellent": len([s for s in scores if s >= 80]),   # 80-100
            "good": len([s for s in scores if 60 <= s < 80]),    # 60-79
            "fair": len([s for s in scores if 40 <= s < 60]),    # 40-59
            "poor": len([s for s in scores if s < 40])           # 0-39
        }
        
        return {
            "total_candidates": len(scored_candidates),
            "average_score": round(sum(scores) / len(scores), 2),
            "top_score": round(max(scores), 2),
            "distribution": distribution
        }
    
    async def _update_progress(
        self,
        session_id: str,
        status: str,
        progress: int,
        message: str
    ):
        """
        Update workflow progress for real-time UI updates.
        
        This stores progress in Redis so the frontend can poll for updates.
        """
        
        await self.cache.set_workflow_status(
            session_id=session_id,
            status=status,
            progress=progress,
            message=message
        )
        
        logger.info(f"Progress: {progress}% - {status} - {message}")
    
    async def _handle_no_candidates_found(
        self,
        session_id: str,
        username: str,
        prompt: str
    ) -> Dict[str, Any]:
        """
        Handle the case when no candidates are found.
        """
        
        logger.warning("No candidates found matching the criteria")
        
        await self._update_progress(
            session_id, "completed", 100,
            "No candidates found matching your criteria"
        )
        
        # Create empty scorecard
        scorecard = {
            "session_id": session_id,
            "username": username,
            "prompt": prompt,
            "candidates": [],
            "summary": {
                "total_candidates": 0,
                "average_score": 0,
                "top_score": 0,
                "message": "No candidates found. Try broader search criteria."
            },
            "created_at": datetime.utcnow(),
            "status": "completed"
        }
        
        # Store it anyway (for user history)
        await self.db.save_scorecard(scorecard)
        
        return scorecard
    
    async def _handle_error(
        self,
        session_id: str,
        username: str,
        prompt: str,
        error_message: str
    ) -> Dict[str, Any]:
        """
        Handle workflow errors gracefully.
        """
        
        await self._update_progress(
            session_id, "error", 0,
            f"An error occurred: {error_message}"
        )
        
        # Log the error
        await self.db.log_user_action(
            username=username,
            action="workflow_error",
            details={"session_id": session_id, "error": error_message}
        )
        
        return {
            "session_id": session_id,
            "status": "error",
            "error": error_message,
            "candidates": [],
            "message": "Something went wrong. Please try again."
        }
    
    # ========================================================================
    # Additional Methods (for future features)
    # ========================================================================
    
    async def get_scorecard_by_session(self, session_id: str) -> Dict[str, Any]:
        """
        Get a scorecard by session ID.
        
        Tries cache first (fast), then database.
        """
        
        # Try cache first
        scorecard = await self.cache.get_session_data(session_id, "scorecard")
        
        if scorecard:
            return scorecard
        
        # Fallback to database
        scorecard = await self.db.get_scorecard_by_session(session_id)
        
        return scorecard
    
    async def resume_after_followup(
        self,
        session_id: str,
        followup_answers: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Resume workflow after user provides follow-up answers.
        
        This re-scores candidates based on additional user preferences.
        """
        logger.info(f"\nResuming workflow with follow-up answers: {session_id}")
        
        try:
            # Get existing data from cache
            candidates = await self.cache.get_session_data(session_id, "candidates")
            parsed_requirements = await self.cache.get_session_data(session_id, "parsed_requirements")
            user_context = await self.cache.get_user_context(session_id)
            
            if not candidates or not parsed_requirements or not user_context:
                return {"error": "Session data not found or expired"}
            
            username = user_context.get("username", "unknown")
            prompt = await self.cache.get_prompt(session_id)
            
            # Update progress
            await self._update_progress(
                session_id, "rescoring", 50,
                "Re-scoring based on your preferences..."
            )
            
            # First score with original criteria
            scored_candidates = await self.scorer.score_batch(candidates, parsed_requirements)
            
            # Then adjust with follow-up answers
            scored_candidates = await self.scorer.rescore_with_followup(
                scored_candidates, followup_answers
            )
            
            # Create and store updated scorecard
            scorecard = await self._create_and_store_scorecard(
                session_id=session_id,
                username=username,
                prompt=prompt,
                parsed_requirements=parsed_requirements,
                scored_candidates=scored_candidates
            )
            
            await self._update_progress(session_id, "completed", 100, "Done!")
            
            return scorecard
            
        except Exception as e:
            logger.error(f"Resume failed: {e}")
            return {"error": str(e)}