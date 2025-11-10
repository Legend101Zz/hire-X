"""
Scorecard Workflow V3
====================
MODIFIED FOR V3: Integrates conversation, search, and enrichment.

This is the MODIFIED version of scorecard_workflow.py that:
1. Works with conversation-built ideal profiles
2. Integrates enrichment services after scoring
3. Supports both old prompt-based and new conversation-based flows
4. Provides progress tracking throughout

INSTRUCTIONS:
Replace your existing backend-v2/services/scorecard_workflow.py with this file.
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from services.ai_parser import AIParser
from services.candidate_scorer import CandidateScorer
from services.conversation_manager import ConversationManager
from services.enrichment_service import EnrichmentService
from services.model_config_manager import ModelConfigManager
from services.search_engine import SearchEngine

logger = get_logger(__name__)


class ScorecardWorkflow:
    """
    V3 Scorecard Workflow with conversation and enrichment integration.
    
    Supports two modes:
    1. Legacy mode: Direct prompt → search (backward compatible)
    2. V3 mode: Conversation → ideal profile → search → enrich
    """
    
    def __init__(
        self,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        search_engine: SearchEngine,
        candidate_scorer: CandidateScorer,
        ai_parser: AIParser,
        model_config_manager: ModelConfigManager,
        enrichment_service: Optional[EnrichmentService] = None,
        conversation_manager: Optional[ConversationManager] = None
    ):
        """Initialize workflow with all services."""
        self.mongodb = mongodb
        self.redis = redis_cache
        self.search = search_engine
        self.scorer = candidate_scorer
        self.ai = ai_parser
        self.model_config = model_config_manager
        self.enrichment = enrichment_service
        self.conversation = conversation_manager
        
        logger.info("✅ ScorecardWorkflow V3 initialized")
    
    
    # ================================================================
    # LEGACY MODE (BACKWARD COMPATIBLE)
    # ================================================================
    
    async def execute_legacy(
        self,
        session_id: str,
        prompt: str,
        username: str
    ) -> Dict[str, Any]:
        """
        Legacy execution mode (backward compatible with V2).
        
        Flow: Prompt → Parse → Search → Score → Return
        """
        
        logger.info(f"Executing LEGACY workflow for session {session_id}")
        
        try:
            # Update progress
            await self._update_progress(session_id, "parsing", 10, "Parsing requirements...")
            
            # Step 1: Parse prompt
            model_config = await self.model_config.get_session_config(session_id)
            requirements = await self.ai.parse_prompt(
                prompt,
                model=model_config.get('jd_parsing', 'claude-sonnet-4-20250514')
            )
            
            # Update progress
            await self._update_progress(session_id, "searching", 30, "Searching database...")
            
            # Step 2: Search
            candidates = await self.search.search_with_fallback(requirements)
            
            # Update progress
            await self._update_progress(session_id, "scoring", 60, "Scoring candidates...")
            
            # Step 3: Score
            scored_candidates = await self.scorer.score_candidates(
                candidates,
                requirements=requirements,
                model=model_config.get('match_scoring', 'claude-sonnet-4-20250514')
            )
            
            # Update progress
            await self._update_progress(session_id, "completed", 100, "Done!")
            
            # Return results
            return {
                "session_id": session_id,
                "status": "completed",
                "candidates": scored_candidates[:50],  # Top 50
                "total_found": len(candidates),
                "mode": "legacy"
            }
        
        except Exception as e:
            logger.error(f"Legacy workflow error: {e}")
            await self._update_progress(session_id, "error", 0, str(e))
            raise
    
    
    # ================================================================
    # V3 MODE (NEW CONVERSATION-BASED FLOW)
    # ================================================================
    
    async def execute_v3(
        self,
        session_id: str,
        conversation_session_id: str,
        username: str
    ) -> Dict[str, Any]:
        """
        V3 execution mode with conversation and enrichment.
        
        Flow: Conversation → Ideal Profile → Search → Score → Enrich → Return
        """
        
        logger.info(f"Executing V3 workflow for session {session_id}")
        
        if not self.conversation or not self.enrichment:
            raise ValueError("V3 mode requires conversation and enrichment services")
        
        try:
            # Step 1: Get ideal profile from conversation
            await self._update_progress(session_id, "loading", 5, "Loading ideal profile...")
            
            conversation_state = await self.conversation._load_state(conversation_session_id)
            if not conversation_state:
                raise ValueError(f"Conversation {conversation_session_id} not found")
            
            ideal_profile = conversation_state.ideal_profile
            
            # Step 2: Convert to search requirements
            await self._update_progress(session_id, "preparing", 10, "Preparing search...")
            
            requirements = self._ideal_profile_to_requirements(ideal_profile)
            
            # Step 3: Search
            await self._update_progress(session_id, "searching", 20, "Searching 56M profiles...")
            
            candidates = await self.search.search_with_fallback(requirements)
            
            logger.info(f"Found {len(candidates)} candidates")
            
            # Step 4: Score
            await self._update_progress(session_id, "scoring", 40, f"Scoring {len(candidates)} candidates...")
            
            model_config = await self.model_config.get_session_config(session_id)
            scored_candidates = await self.scorer.score_candidates(
                candidates,
                requirements=requirements,
                model=model_config.get('match_scoring', 'claude-sonnet-4-20250514')
            )
            
            # Take top 50 for enrichment
            top_50 = scored_candidates[:50]
            
            # Step 5: Enrich (parallel)
            await self._update_progress(session_id, "enriching", 50, "Enriching top 50 candidates...")
            
            enriched_candidates = await self._enrich_candidates(
                candidates=top_50,
                ideal_profile=ideal_profile,
                model_config=model_config,
                session_id=session_id
            )
            
            # Step 6: Save results
            await self._update_progress(session_id, "saving", 95, "Saving results...")
            
            await self._save_enriched_results(
                session_id=session_id,
                conversation_session_id=conversation_session_id,
                username=username,
                ideal_profile=ideal_profile,
                enriched_candidates=enriched_candidates,
                total_found=len(candidates)
            )
            
            # Step 7: Done
            await self._update_progress(session_id, "completed", 100, "Done!")
            
            return {
                "session_id": session_id,
                "conversation_session_id": conversation_session_id,
                "status": "completed",
                "candidates": enriched_candidates,
                "total_found": len(candidates),
                "enriched_count": len(enriched_candidates),
                "mode": "v3"
            }
        
        except Exception as e:
            logger.error(f"V3 workflow error: {e}")
            await self._update_progress(session_id, "error", 0, str(e))
            raise
    
    
    # ================================================================
    # ENRICHMENT
    # ================================================================
    
    async def _enrich_candidates(
        self,
        candidates: List[Dict],
        ideal_profile: Any,
        model_config: Dict[str, str],
        session_id: str
    ) -> List[Dict]:
        """
        Enrich candidates in parallel batches.
        
        Args:
            candidates: List of scored candidates
            ideal_profile: Ideal profile from conversation
            model_config: Model configuration
            session_id: Session ID for progress tracking
        
        Returns:
            List of enriched candidates
        """
        
        logger.info(f"Enriching {len(candidates)} candidates...")
        
        # Prepare enrichment tasks
        enrichment_tasks = []
        
        for candidate in candidates:
            task = self.enrichment.enrich_candidate(
                candidate=candidate,
                ideal_profile=ideal_profile,
                model_config=model_config
            )
            enrichment_tasks.append(task)
        
        # Process in batches of 10 to avoid rate limits
        batch_size = 10
        enriched = []
        
        for i in range(0, len(enrichment_tasks), batch_size):
            batch = enrichment_tasks[i:i+batch_size]
            
            # Run batch in parallel
            batch_results = await asyncio.gather(*batch, return_exceptions=True)
            
            # Filter out errors
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Enrichment error: {result}")
                else:
                    enriched.append(result)
            
            # Update progress
            progress = 50 + int((i + batch_size) / len(candidates) * 45)
            await self._update_progress(
                session_id,
                "enriching",
                progress,
                f"Enriched {min(i+batch_size, len(candidates))}/{len(candidates)} candidates"
            )
            
            # Small delay to avoid rate limits
            if i + batch_size < len(enrichment_tasks):
                await asyncio.sleep(0.5)
        
        logger.info(f"Successfully enriched {len(enriched)}/{len(candidates)} candidates")
        
        return enriched
    
    
    # ================================================================
    # HELPER METHODS
    # ================================================================
    
    def _ideal_profile_to_requirements(self, ideal_profile: Any) -> Dict[str, Any]:
        """
        Convert ideal profile card to search requirements.
        
        Args:
            ideal_profile: IdealProfileCard from conversation
        
        Returns:
            Dict compatible with search engine
        """
        
        requirements = {
            "role": ideal_profile.role_title,
            "must_have_skills": ideal_profile.must_have_skills,
            "nice_to_have_skills": ideal_profile.nice_to_have_skills,
            "seniority": ideal_profile.seniority,
            "experience_years": ideal_profile.experience_years,
            "industries": ideal_profile.industries,
            "locations": ideal_profile.locations,
            "company_size": ideal_profile.company_size,
            "additional_requirements": ideal_profile.additional_requirements
        }
        
        return requirements
    
    
    async def _save_enriched_results(
        self,
        session_id: str,
        conversation_session_id: str,
        username: str,
        ideal_profile: Any,
        enriched_candidates: List[Dict],
        total_found: int
    ):
        """
        Save enriched results to MongoDB.
        
        Args:
            session_id: Search session ID
            conversation_session_id: Conversation session ID
            username: Username
            ideal_profile: Ideal profile card
            enriched_candidates: List of enriched candidates
            total_found: Total candidates found before filtering
        """
        
        # Save to enriched_results collection
        result_doc = {
            "session_id": session_id,
            "conversation_session_id": conversation_session_id,
            "username": username,
            "ideal_profile": ideal_profile.dict(),
            "candidates": enriched_candidates,
            "total_found": total_found,
            "enriched_count": len(enriched_candidates),
            "created_at": datetime.utcnow().isoformat(),
            "status": "completed"
        }
        
        await self.mongodb.save_enriched_results(result_doc)
        
        logger.info(f"Saved enriched results for session {session_id}")
    
    
    async def _update_progress(
        self,
        session_id: str,
        status: str,
        progress: int,
        message: str
    ):
        """
        Update progress in Redis for real-time tracking.
        
        Args:
            session_id: Session ID
            status: Status (parsing, searching, scoring, enriching, completed, error)
            progress: Progress percentage (0-100)
            message: Progress message
        """
        
        progress_data = {
            "status": status,
            "progress": progress,
            "message": message,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        await self.redis.store_session_data(
            session_id,
            "workflow_progress",
            progress_data,
            ttl=3600
        )
        
        logger.info(f"[{session_id}] {status} - {progress}% - {message}")
    
    
    # ================================================================
    # PUBLIC METHODS
    # ================================================================
    
    async def execute(
        self,
        session_id: str,
        username: str,
        prompt: Optional[str] = None,
        conversation_session_id: Optional[str] = None,
        mode: str = "auto"
    ) -> Dict[str, Any]:
        """
        Execute workflow in appropriate mode.
        
        Args:
            session_id: Workflow session ID
            username: Username
            prompt: Legacy prompt (for legacy mode)
            conversation_session_id: Conversation session ID (for V3 mode)
            mode: "auto", "legacy", or "v3"
        
        Returns:
            Results dict
        """
        
        # Determine mode
        if mode == "auto":
            if conversation_session_id:
                mode = "v3"
            elif prompt:
                mode = "legacy"
            else:
                raise ValueError("Must provide either prompt or conversation_session_id")
        
        # Execute
        if mode == "legacy":
            if not prompt:
                raise ValueError("Legacy mode requires prompt")
            return await self.execute_legacy(session_id, prompt, username)
        
        elif mode == "v3":
            if not conversation_session_id:
                raise ValueError("V3 mode requires conversation_session_id")
            return await self.execute_v3(session_id, conversation_session_id, username)
        
        else:
            raise ValueError(f"Invalid mode: {mode}")