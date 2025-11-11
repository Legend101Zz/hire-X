"""
Enrichment Service
==================
Orchestrates all enrichment activities for candidates.

This service:
- Coordinates salary estimation, response likelihood, skills, availability
- Runs enrichments in parallel for performance
- Updates progress in real-time
- Caches results
- Handles failures gracefully

This is the main enrichment orchestrator!
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional

from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from models.enrichment_models import EnrichedCandidate, EnrichmentProgress
from services.availability_checker import AvailabilityChecker
from services.model_config_manager import ModelConfigManager
from services.response_likelihood_scorer import ResponseLikelihoodScorer
from services.salary_estimator import SalaryEstimator
from services.skill_validator import SkillValidator

logger = get_logger(__name__)


class EnrichmentService:
    """
    Main enrichment orchestrator.
    
    Coordinates all enrichment services and manages the enrichment workflow.
    """
    
    def __init__(
        self,
        salary_estimator: SalaryEstimator,
        response_scorer: ResponseLikelihoodScorer,
        skill_validator: SkillValidator,
        availability_checker: AvailabilityChecker,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize enrichment service.
        
        Args:
            salary_estimator: Salary estimation service
            response_scorer: Response likelihood scoring service
            skill_validator: Skill validation service
            availability_checker: Availability checking service
            mongodb: MongoDB for storing enriched data
            redis_cache: Redis for caching and progress tracking
            model_config_manager: For model configuration
        """
        self.salary = salary_estimator
        self.response = response_scorer
        self.skills = skill_validator
        self.availability = availability_checker
        self.db = mongodb
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        logger.info("EnrichmentService initialized")
    
    async def enrich_candidates(
        self,
        session_id: str,
        candidates: List[Dict],
        enrichment_types: List[str] = None
    ) -> List[EnrichedCandidate]:
        """
        Enrich multiple candidates in parallel.
        
        Args:
            session_id: Session ID for progress tracking
            candidates: List of candidate profiles
            enrichment_types: Types of enrichment to perform
                             Default: ["salary", "response_likelihood", "skills", "availability"]
            
        Returns:
            List of EnrichedCandidate objects
        
        Example:
            enriched = await enrichment_service.enrich_candidates(
                session_id="abc-123",
                candidates=[{...}, {...}, ...],
                enrichment_types=["salary", "response_likelihood"]
            )
        """
        
        if enrichment_types is None:
            enrichment_types = ["salary", "response_likelihood", "skills", "availability"]
        
        logger.info(f"Enriching {len(candidates)} candidates with {enrichment_types}")
        
        # Update progress
        await self._update_progress(session_id, 0, len(candidates), 0)
        
        # Process in batches to avoid overwhelming the system
        batch_size = 10
        all_enriched = []
        
        for i in range(0, len(candidates), batch_size):
            batch = candidates[i:i+batch_size]
            
            logger.info(f"Processing batch {i//batch_size + 1} ({len(batch)} candidates)")
            
            # Enrich batch in parallel
            tasks = [
                self.enrich_single_candidate(
                    candidate,
                    session_id,
                    enrichment_types
                )
                for candidate in batch
            ]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    logger.error(f"Enrichment failed for candidate: {result}")
                    # Create error result
                    error_candidate = self._create_error_candidate(
                        batch[j],
                        str(result)
                    )
                    all_enriched.append(error_candidate)
                else:
                    all_enriched.append(result)
            
            # Update progress
            enriched_count = i + len(batch)
            await self._update_progress(
                session_id,
                enriched_count,
                len(candidates),
                int((enriched_count / len(candidates)) * 100)
            )
        
        logger.info(f"Enrichment complete: {len(all_enriched)} candidates processed")
        
        # Store enriched results in MongoDB
        await self._store_enriched_results(session_id, all_enriched)
        
        return all_enriched
    
    async def enrich_single_candidate(
        self,
        candidate: Dict,
        session_id: str,
        enrichment_types: List[str]
    ) -> EnrichedCandidate:
        """
        Enrich a single candidate with all requested enrichment types.
        
        Args:
            candidate: Candidate profile
            session_id: Session ID
            enrichment_types: Types of enrichment to perform
            
        Returns:
            EnrichedCandidate object
        """
        
        candidate_id = str(candidate.get("_id", "unknown"))
        
        logger.debug(f"Enriching candidate {candidate_id}")
        
        # Build base enriched candidate
        enriched = EnrichedCandidate(
            candidate_id=candidate_id,
            first_name=candidate.get("first_name", ""),
            last_name=candidate.get("last_name", ""),
            title=candidate.get("title", ""),
            company=candidate.get("current_company"),
            location=candidate.get("location", ""),
            linkedin_url=candidate.get("linkedin_url"),
            email=candidate.get("email"),
            phone=candidate.get("phone"),
            match_label=candidate.get("match_label", ""),
            match_reason=candidate.get("match_reason", ""),
            match_score=candidate.get("match_score", 0),
            enrichment_status="in_progress"
        )
        
        try:
            # Run enrichments in parallel
            tasks = []
            
            if "salary" in enrichment_types:
                tasks.append(("salary", self.salary.estimate_career_progression(candidate, session_id)))
            
            if "response_likelihood" in enrichment_types:
                tasks.append(("response_likelihood", self.response.calculate_response_likelihood(candidate, session_id)))
            
            if "skills" in enrichment_types:
                tasks.append(("skills", self.skills.validate_skills(candidate, session_id)))
            
            if "availability" in enrichment_types:
                # Availability is synchronous, wrap it
                tasks.append(("availability", asyncio.to_thread(self.availability.check_availability, candidate)))
            
            # Execute all tasks
            if tasks:
                task_names, task_coroutines = zip(*tasks)
                results = await asyncio.gather(*task_coroutines, return_exceptions=True)
                
                # Assign results
                for task_name, result in zip(task_names, results):
                    if isinstance(result, Exception):
                        logger.error(f"Failed to enrich {task_name} for {candidate_id}: {result}")
                    else:
                        if task_name == "salary":
                            enriched.salary_enrichment = result
                        elif task_name == "response_likelihood":
                            enriched.response_likelihood = result
                        elif task_name == "skills":
                            enriched.skill_validation = result
                        elif task_name == "availability":
                            enriched.availability = result
            
            # Mark as completed
            enriched.enrichment_status = "completed"
            enriched.enriched_at = datetime.utcnow().isoformat()
            
        except Exception as e:
            logger.error(f"Enrichment failed for candidate {candidate_id}: {e}")
            enriched.enrichment_status = "failed"
            enriched.enrichment_error = str(e)
        
        return enriched
    
    async def get_enriched_candidates(
        self,
        session_id: str,
        skip: int = 0,
        limit: int = 50
    ) -> Dict:
        """
        Get enriched candidates for a session (with pagination).
        
        Args:
            session_id: Session ID
            skip: Number of results to skip
            limit: Number of results to return
            
        Returns:
            {
                "candidates": [EnrichedCandidate, ...],
                "total": int,
                "skip": int,
                "limit": int
            }
        """
        
        # Query enriched_candidates collection
        collection = self.db.db["enriched_candidates"]
        
        # Get total count
        total = await collection.count_documents({"session_id": session_id})
        
        # Get paginated results
        cursor = collection.find(
            {"session_id": session_id}
        ).skip(skip).limit(limit)
        
        candidates_data = await cursor.to_list(length=limit)
        
        # Convert to EnrichedCandidate objects
        candidates = [
            EnrichedCandidate(**self._clean_mongo_dict(c))
            for c in candidates_data
        ]
        
        return {
            "candidates": candidates,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    
    async def _update_progress(
        self,
        session_id: str,
        enriched_count: int,
        total_count: int,
        progress_percentage: int
    ):
        """Update enrichment progress in Redis."""
        
        progress = EnrichmentProgress(
            session_id=session_id,
            total_candidates=total_count,
            enriched_count=enriched_count,
            failed_count=0,  # Can track this separately if needed
            progress_percentage=progress_percentage
        )
        
        await self.redis.store_session_data(
            session_id,
            "enrichment_progress",
            progress.dict(),
            ttl=3600
        )
        
        logger.debug(f"Progress: {enriched_count}/{total_count} ({progress_percentage}%)")
    
    async def _store_enriched_results(
        self,
        session_id: str,
        enriched_candidates: List[EnrichedCandidate]
    ):
        """
        Store enriched results in MongoDB.
        
        Stores in enriched_candidates collection for efficient retrieval.
        """
        
        collection = self.db.db["enriched_candidates"]
        
        documents = []
        for candidate in enriched_candidates:
            doc = candidate.dict()
            doc["session_id"] = session_id
            doc["created_at"] = datetime.utcnow()
            documents.append(doc)
        
        if documents:
            await collection.insert_many(documents)
            logger.info(f"Stored {len(documents)} enriched candidates in MongoDB")
    
    def _create_error_candidate(
        self,
        candidate: Dict,
        error: str
    ) -> EnrichedCandidate:
        """Create error candidate result."""
        
        return EnrichedCandidate(
            candidate_id=str(candidate.get("_id", "unknown")),
            first_name=candidate.get("first_name", ""),
            last_name=candidate.get("last_name", ""),
            title=candidate.get("title", ""),
            company=candidate.get("current_company"),
            location=candidate.get("location", ""),
            match_label=candidate.get("match_label", ""),
            match_reason=candidate.get("match_reason", ""),
            match_score=candidate.get("match_score", 0),
            enrichment_status="failed",
            enrichment_error=error
        )
    
    def _clean_mongo_dict(self, doc: Dict) -> Dict:
        """Clean MongoDB document for Pydantic."""
        # Remove _id field
        if "_id" in doc:
            del doc["_id"]
        return doc