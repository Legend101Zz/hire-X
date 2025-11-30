import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.logging_config import get_logger
from data.redis_cache import RedisCache
from services.intelligent_enrichment_orchestrator import \
    IntelligentEnrichmentOrchestrator

logger = get_logger(__name__)

class ParallelEnrichmentService:
    """
    Service for enriching candidates in parallel using V2 Orchestrator.
    """
    
    MAX_CONCURRENT = 3
    
    def __init__(
        self,
        enrichment_orchestrator: IntelligentEnrichmentOrchestrator,
        redis_cache: RedisCache
    ):
        self.orchestrator = enrichment_orchestrator
        self.redis = redis_cache
        # We don't strictly need ThreadPoolExecutor for async-to-async, 
        # but useful if you have CPU bound tasks later.
        self._executor = ThreadPoolExecutor(max_workers=self.MAX_CONCURRENT)
        
        logger.info(f"✅ ParallelEnrichmentService V2 initialized")
    
    def _construct_jd_string(self, ideal_profile: Dict[str, Any]) -> str:
        """Helper to convert IdealProfile dict back into a text description for the LLM."""
        return f"""
        Role: {ideal_profile.get('role_title', 'Unknown')}
        Seniority: {ideal_profile.get('seniority', 'Mid-Senior')}
        Required Skills: {', '.join(ideal_profile.get('must_have_skills', []))}
        Preferred Skills: {', '.join(ideal_profile.get('nice_to_have_skills', []))}
        Location: {', '.join(ideal_profile.get('locations', []))}
        Experience: {ideal_profile.get('experience_years', '5+')} years
        Industry: {', '.join(ideal_profile.get('industries', []))}
        Description: {ideal_profile.get('additional_requirements', '')}
        """

    async def enrich_single_candidate(
        self,
        session_id: str,
        candidate: Dict[str, Any],
        ideal_profile: Dict[str, Any],
        enrichment_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Adapter method: Transforms Candidate Dict -> Orchestrator Input.
        """
        # 1. Extract the ID and URL
        # Handle cases where candidate is wrapped in 'candidate' key or flat
        candidate_data = candidate.get("candidate", candidate)
        candidate_id = candidate_data.get("profile_id", candidate_data.get("_id", "unknown"))
        
        # 2. Get the LinkedIn URL (CRITICAL for V2)
        linkedin_url = candidate_data.get("linkedin_url") or candidate_data.get("url") or candidate_data.get("public_identifier")
        
        if not linkedin_url:
            logger.error(f"❌ Skipping {candidate_id}: No LinkedIn URL found")
            await self._update_candidate_progress(session_id, candidate_id, "failed", 0, "No LinkedIn URL")
            return {
                "candidate_id": candidate_id,
                "status": "failed",
                "error": "Missing LinkedIn URL"
            }

        logger.info(f"🔄 Starting V2 Deep Dive for {candidate_id}")
        
        try:
            # Update progress
            await self._update_candidate_progress(session_id, candidate_id, "enriching", 10)
            
            # 3. Construct inputs for V2 Orchestrator
            jd_text = self._construct_jd_string(ideal_profile)
            
            # 4. Call the V2 Orchestrator
            # Note: deep_dive_candidate is an ALL-IN-ONE method. 
            # It ignores 'enrichment_types' because V2 does everything by design.
            deep_dive_result = await self.orchestrator.deep_dive_candidate(
                linkedin_url=linkedin_url,
                job_description=jd_text,
                force_scrape=True  # As requested, force fresh data
            )
            
            # 5. Convert Pydantic model to Dict for frontend
            enriched_data = deep_dive_result.dict()
            
            # Update progress to complete
            await self._update_candidate_progress(session_id, candidate_id, "completed", 100)
            
            logger.info(f"✅ V2 Enrichment completed for {candidate_id}")
            
            return {
                "candidate_id": candidate_id,
                "status": "completed",
                "enriched_data": enriched_data,
                # Merge original ID back in case deep dive scraped a slightly different structure
                "original_candidate": candidate,
                "enriched_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ V2 Enrichment failed for {candidate_id}: {e}", exc_info=True)
            
            await self._update_candidate_progress(
                session_id, 
                candidate_id, 
                "failed",
                0,
                str(e)
            )
            
            return {
                "candidate_id": candidate_id,
                "status": "failed",
                "error": str(e),
                "original_candidate": candidate
            }
    
    async def enrich_candidates_parallel(
        self,
        session_id: str,
        candidates: List[Dict[str, Any]],
        ideal_profile: Dict[str, Any],
        enrichment_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple candidates in parallel.
        """
        logger.info(f"🚀 Starting parallel V2 enrichment for {len(candidates)} candidates")
        
        # Initialize overall progress
        await self.redis.store_session_data(
            session_id,
            "parallel_enrichment_progress",
            {
                "status": "in_progress",
                "total": len(candidates),
                "completed": 0,
                "failed": 0,
                "candidates": {}
            },
            expire_seconds=3600
        )
        
        # Create tasks
        tasks = []
        for candidate in candidates:
            task = self.enrich_single_candidate(
                session_id=session_id,
                candidate=candidate,
                ideal_profile=ideal_profile,
                enrichment_types=enrichment_types
            )
            tasks.append(task)
        
        # Run with concurrency limit
        semaphore = asyncio.Semaphore(self.MAX_CONCURRENT)
        
        async def limited_task(task):
            async with semaphore:
                return await task
        
        limited_tasks = [limited_task(task) for task in tasks]
        
        # Execute
        results = await asyncio.gather(*limited_tasks, return_exceptions=True)
        
        # Process results
        enriched_results = []
        completed_count = 0
        failed_count = 0
        
        for result in results:
            if isinstance(result, Exception):
                failed_count += 1
                enriched_results.append({
                    "status": "failed",
                    "error": str(result)
                })
            else:
                if result.get("status") == "completed":
                    completed_count += 1
                else:
                    failed_count += 1
                enriched_results.append(result)
        
        # Update final progress
        await self.redis.store_session_data(
            session_id,
            "parallel_enrichment_progress",
            {
                "status": "completed",
                "total": len(candidates),
                "completed": completed_count,
                "failed": failed_count,
                "completed_at": datetime.utcnow().isoformat()
            },
            expire_seconds=3600
        )
        
        logger.info(f"✅ Parallel enrichment complete: {completed_count}/{len(candidates)} successful")
        
        return enriched_results

    async def _update_candidate_progress(
        self,
        session_id: str,
        candidate_id: str,
        status: str,
        progress: int,
        error: Optional[str] = None
    ):
        """Update progress for a specific candidate."""
        current = await self.redis.get_session_data(
            session_id,
            "parallel_enrichment_progress"
        ) or {"candidates": {}}
        
        current["candidates"][candidate_id] = {
            "status": status,
            "progress": progress,
            "error": error,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        completed = sum(1 for c in current["candidates"].values() if c.get("status") == "completed")
        failed = sum(1 for c in current["candidates"].values() if c.get("status") == "failed")
        
        current["completed"] = completed
        current["failed"] = failed
        
        await self.redis.store_session_data(
            session_id,
            "parallel_enrichment_progress",
            current,
            expire_seconds=3600
        )

    async def get_enrichment_progress(self, session_id: str) -> Dict[str, Any]:
        return await self.redis.get_session_data(session_id, "parallel_enrichment_progress") or {
            "status": "not_started", "total": 0, "completed": 0, "failed": 0, "candidates": {}
        }
    
    async def get_candidate_enrichment(
        self,
        session_id: str,
        candidate_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get enrichment result for a specific candidate."""
        
        key = f"enriched_candidate:{candidate_id}"
        return await self.redis.get_session_data(session_id, key)