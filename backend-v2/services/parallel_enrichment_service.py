import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from services.intelligent_enrichment_orchestrator import \
    IntelligentEnrichmentOrchestrator

logger = get_logger(__name__)


class ParallelEnrichmentService:
    """
    Service for enriching candidates in parallel using V2 Orchestrator.
    Optimized for 4-core systems with smart batching.
    """
    
    MAX_CONCURRENT = 4  # Match CPU cores
    MAX_CANDIDATES = 1 # Cap for deep analysis
    
    def __init__(
        self,
        enrichment_orchestrator: IntelligentEnrichmentOrchestrator,
        redis_cache: RedisCache,
        mongodb: Optional[MongoDB] = None
    ):
        self.orchestrator = enrichment_orchestrator
        self.redis = redis_cache
        self.mongodb = mongodb
        
        # Only log on first creation (singleton)
        logger.info(f"✅ ParallelEnrichmentService ready (max_concurrent={self.MAX_CONCURRENT}, max_candidates={self.MAX_CANDIDATES})")
    
    def _construct_jd_string(self, ideal_profile: Dict[str, Any]) -> str:
        """Convert IdealProfile dict to text description for LLM."""
        parts = []
        
        if ideal_profile.get('role_title'):
            parts.append(f"Role: {ideal_profile['role_title']}")
        if ideal_profile.get('seniority'):
            parts.append(f"Seniority: {ideal_profile['seniority']}")
        if ideal_profile.get('must_have_skills'):
            parts.append(f"Required Skills: {', '.join(ideal_profile['must_have_skills'])}")
        if ideal_profile.get('nice_to_have_skills'):
            parts.append(f"Preferred Skills: {', '.join(ideal_profile['nice_to_have_skills'])}")
        if ideal_profile.get('locations'):
            parts.append(f"Location: {', '.join(ideal_profile['locations'])}")
        if ideal_profile.get('experience_years'):
            parts.append(f"Experience: {ideal_profile['experience_years']} years")
        if ideal_profile.get('industries'):
            parts.append(f"Industry: {', '.join(ideal_profile['industries'])}")
        if ideal_profile.get('additional_requirements'):
            parts.append(f"Additional: {ideal_profile['additional_requirements']}")
        
        return "\n".join(parts)

    async def enrich_single_candidate(
        self,
        session_id: str,
        candidate: Dict[str, Any],
        ideal_profile: Dict[str, Any],
        candidate_index: int,
        total_candidates: int
    ) -> Dict[str, Any]:
        """
        Enrich a single candidate using V2 Deep Dive.
        Returns FLATTENED structure for frontend compatibility.
        """
        # Extract candidate data (handle wrapped or flat structure)
        candidate_data = candidate.get("candidate", candidate)
        candidate_id = str(
            candidate_data.get("profile_id") or 
            candidate_data.get("_id") or 
            candidate_data.get("linkedin_id") or
            f"candidate_{candidate_index}"
        )
        
        candidate_name = f"{candidate_data.get('first_name', '')} {candidate_data.get('last_name', '')}".strip() or "Unknown"
        
        # Get LinkedIn URL
        linkedin_url = (
            candidate_data.get("linkedin_url") or 
            candidate_data.get("url") or 
            candidate_data.get("public_identifier")
        )
        
        logger.info(f"🔄 [{candidate_index + 1}/{total_candidates}] Starting deep analysis for {candidate_name}")
        
        try:
            # Update progress: Starting this candidate
            await self._update_progress(
                session_id=session_id,
                candidate_id=candidate_id,
                candidate_name=candidate_name,
                status="analyzing",
                message=f"Analyzing {candidate_name}...",
                candidate_index=candidate_index,
                total_candidates=total_candidates
            )
            
            # Construct JD for matching
            jd_text = self._construct_jd_string(ideal_profile)
            
            # Call V2 Deep Dive Orchestrator
            if linkedin_url:
                logger.info(f"🔍 Calling deep_dive for {candidate_name}")
                
                deep_dive_result = await self.orchestrator.deep_dive_candidate(
                    linkedin_url=linkedin_url,
                    job_description=jd_text,
                    force_scrape=False
                )
                
                enriched_data = deep_dive_result.dict()
                logger.info(f"✅ Deep dive completed for {candidate_name}")
            else:
                logger.warning(f"⚠️ No LinkedIn URL for {candidate_name}, using basic enrichment")
                enriched_data = await self._create_basic_enrichment(candidate_data, ideal_profile)
            
            # Update progress: Completed
            await self._update_progress(
                session_id=session_id,
                candidate_id=candidate_id,
                candidate_name=candidate_name,
                status="completed",
                message=f"Completed {candidate_name}",
                candidate_index=candidate_index,
                total_candidates=total_candidates
            )
            
            logger.info(f"✅ [{candidate_index + 1}/{total_candidates}] Fully completed {candidate_name}")
            
            # ✅ FLATTEN the structure for frontend compatibility
            # Merge candidate data with enrichment data
            return self._flatten_enrichment_result(
                candidate_id=candidate_id,
                original_candidate=candidate_data,
                enriched_data=enriched_data
            )
            
        except Exception as e:
            logger.error(f"❌ Enrichment failed for {candidate_name}: {e}", exc_info=True)
            
            await self._update_progress(
                session_id=session_id,
                candidate_id=candidate_id,
                candidate_name=candidate_name,
                status="failed",
                message=f"Failed: {str(e)[:50]}",
                candidate_index=candidate_index,
                total_candidates=total_candidates,
                error=str(e)
            )
            
            # Return basic structure on failure
            return {
                "candidate_id": candidate_id,
                "profile_id": candidate_id,
                "status": "failed",
                "enrichment_status": "failed",
                "candidate": candidate_data,
                "error": str(e),
                "match_analysis": {
                    "overall_match_score": 0,
                    "match_label": "Analysis Failed",
                    "strengths": [],
                    "concerns": [{"concern": f"Enrichment failed: {str(e)[:100]}", "severity": "high"}]
                }
            }

    def _flatten_enrichment_result(
        self,
        candidate_id: str,
        original_candidate: Dict[str, Any],
        enriched_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Flatten the enrichment result for frontend compatibility.
        
        Merges original candidate data with enriched data into a single flat structure.
        """
        # Get the enriched candidate data (might have more info from scraping)
        enriched_candidate = enriched_data.get("candidate", {})
        
        # Merge candidate data - prefer enriched data, fallback to original
        merged_candidate = {
            **original_candidate,
            **{k: v for k, v in enriched_candidate.items() if v}  # Only non-empty values
        }
        
        # Ensure we have basic fields
        merged_candidate["profile_id"] = candidate_id
        merged_candidate["linkedin_id"] = candidate_id
        
        # Build the flattened structure
        result = {
            # Identifiers
            "candidate_id": candidate_id,
            "profile_id": candidate_id,
            
            # Status
            "status": "completed",
            "enrichment_status": "completed",
            "enriched_at": datetime.utcnow().isoformat(),
            
            # Candidate data (merged)
            "candidate": merged_candidate,
            
            # Match Analysis
            "match_analysis": enriched_data.get("match_analysis", {
                "overall_match_score": 0,
                "match_label": "Unknown",
                "strengths": [],
                "concerns": []
            }),
            
            # Salary - normalize field names
            "salary_estimation": self._normalize_salary_data(
                enriched_data.get("salary_timeline", {})
            ),
            
            # Skills
            "skill_validation": enriched_data.get("skill_validation", {
                "overall_confidence": 0,
                "validated_skills": [],
                "evidence": []
            }),
            
            # Response Likelihood
            "response_likelihood": enriched_data.get("response_likelihood", {
                "overall_score": 0,
                "likelihood_label": "Unknown",
                "factors": [],
                "recommended_approach": {"should_reach_out": False, "best_channel": "email"}
            }),
            
            # Availability / Notice Period
            "availability": self._normalize_availability_data(
                enriched_data.get("notice_period", {})
            ),
            
            # Professional Footprint
            "professional_footprint": enriched_data.get("professional_footprint", {
                "verified_profiles": [],
                "overall_footprint_assessment": {"presence_level": "Unknown", "notable_findings": []}
            }),
            
            # Data source indicator
            "data_source": enriched_data.get("data_source", "deep_dive")
        }
        
        return result

    def _normalize_salary_data(self, salary_data: Dict) -> Dict:
        """Normalize salary data field names for frontend compatibility."""
        if not salary_data:
            return {
                "current_estimated_ctc": {"low": 0, "most_likely": 0, "high": 0},
                "career_progression": []
            }
        
        # Handle different field names from orchestrator
        ctc = salary_data.get("current_estimated_ctc") or salary_data.get("estimated_ctc", {})
        
        return {
            "current_estimated_ctc": {
                "low": ctc.get("low", 0),
                "most_likely": ctc.get("most_likely", ctc.get("mid", 0)),
                "high": ctc.get("high", 0)
            },
            "career_progression": salary_data.get("career_progression", [])
        }

    def _normalize_availability_data(self, notice_data: Dict) -> Dict:
        """Normalize availability/notice period data for frontend compatibility."""
        if not notice_data:
            return {
                "notice_period_days": None,
                "estimated_notice_days": {"likely": None},
                "earliest_possible_start": None
            }
        
        # Handle different field structures
        estimated_days = notice_data.get("estimated_notice_days", {})
        if isinstance(estimated_days, int):
            estimated_days = {"likely": estimated_days}
        
        return {
            "notice_period_days": notice_data.get("notice_period_days") or estimated_days.get("likely"),
            "estimated_notice_days": estimated_days,
            "earliest_possible_start": notice_data.get("earliest_possible_start")
        }
    async def _create_basic_enrichment(
        self, 
        candidate_data: Dict, 
        ideal_profile: Dict
    ) -> Dict[str, Any]:
        """Create basic enrichment when LinkedIn URL is not available."""
        logger.info("📝 Creating basic enrichment (no LinkedIn URL)")
        
        # Extract skills from expertise field
        expertise = candidate_data.get("expertise", "")
        skills = [s.strip() for s in expertise.split(",") if s.strip()] if expertise else []
        
        required_skills = set(s.lower() for s in ideal_profile.get("must_have_skills", []))
        matched_skills = [s for s in skills if s.lower() in required_skills]
        
        return {
            "candidate": candidate_data,
            "match_analysis": {
                "overall_match_score": min(85, 50 + len(matched_skills) * 10),
                "match_label": "Good Match" if len(matched_skills) >= 2 else "Potential Match",
                "strengths": [{"strength": f"Has {s}", "impact": "positive"} for s in matched_skills[:3]],
                "concerns": []
            },
            "salary_timeline": {
                "current_estimated_ctc": {
                    "low": 15,
                    "most_likely": 20,
                    "high": 28
                }
            },
            "skill_validation": {
                "overall_confidence": 60,
                "validated_skills": matched_skills,
                "evidence": []
            },
            "response_likelihood": {
                "overall_score": 65,
                "likelihood_label": "Moderate",
                "factors": []
            },
            "notice_period": {
                "estimated_notice_days": {"likely": 30}
            },
            "data_source": "profile_only"
        }

    async def enrich_candidates_parallel(
        self,
        session_id: str,
        candidates: List[Dict[str, Any]],
        ideal_profile: Dict[str, Any],
        username: str
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple candidates in parallel (capped at MAX_CANDIDATES).
        Uses semaphore for controlled concurrency matching CPU cores.
        """
        # Cap candidates
        candidates_to_enrich = candidates[:self.MAX_CANDIDATES]
        total = len(candidates_to_enrich)
        
        logger.info(f"🚀 Starting parallel deep analysis for {total} candidates (session: {session_id})")
        
        # Initialize progress
        await self.redis.store_session_data(
            session_id,
            "enrichment_progress",
            {
                "status": "in_progress",
                "phase": "deep_analysis",
                "total": total,
                "completed": 0,
                "failed": 0,
                "current_candidate": "",
                "message": f"Starting deep analysis of {total} candidates...",
                "candidates": {},
                "started_at": datetime.utcnow().isoformat()
            },
            expire_seconds=3600
        )
        
        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(self.MAX_CONCURRENT)
        
        async def limited_enrich(candidate: Dict, index: int) -> Dict:
            async with semaphore:
                return await self.enrich_single_candidate(
                    session_id=session_id,
                    candidate=candidate,
                    ideal_profile=ideal_profile,
                    candidate_index=index,
                    total_candidates=total
                )
        
        # Create all tasks
        tasks = [
            limited_enrich(candidate, idx) 
            for idx, candidate in enumerate(candidates_to_enrich)
        ]
        
        logger.info(f"📋 Created {len(tasks)} enrichment tasks")
        
        # Execute all tasks
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            logger.info(f"📊 All tasks completed, processing {len(results)} results")
        except Exception as e:
            logger.error(f"❌ asyncio.gather failed: {e}", exc_info=True)
            results = []
        
        # Process results
        enriched_results = []
        completed_count = 0
        failed_count = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"❌ Task {i} raised exception: {result}")
                failed_count += 1
                enriched_results.append({
                    "status": "failed",
                    "error": str(result),
                    "candidate": candidates_to_enrich[i].get("candidate", candidates_to_enrich[i])
                })
            elif isinstance(result, dict):
                if result.get("status") == "completed":
                    completed_count += 1
                else:
                    failed_count += 1
                enriched_results.append(result)
            else:
                logger.warning(f"⚠️ Unexpected result type for task {i}: {type(result)}")
                failed_count += 1
        
        logger.info(f"📊 Results: {completed_count} completed, {failed_count} failed")
        
        # Final progress update
        final_status = {
            "status": "completed",
            "phase": "complete",
            "total": total,
            "completed": completed_count,
            "failed": failed_count,
            "progress_percentage": 100,
            "message": f"Analysis complete! {completed_count}/{total} candidates enriched.",
            "completed_at": datetime.utcnow().isoformat()
        }
        
        await self.redis.store_session_data(
            session_id,
            "enrichment_progress",
            final_status,
            expire_seconds=3600
        )
        
        logger.info(f"✅ Final progress saved: {final_status}")
        
        # Store results in MongoDB
        if self.mongodb:
            try:
                results_doc = {
                    "session_id": session_id,
                    "conversation_session_id": session_id,
                    "username": username,
                    "ideal_profile": ideal_profile,
                    "total_found": total,
                    "enriched_count": completed_count,
                    "candidates": enriched_results,
                    "created_at": datetime.utcnow().isoformat(),
                    "status": "completed"
                }
                await self.mongodb.save_enriched_results(results_doc)
                logger.info(f"✅ Results saved to MongoDB for session {session_id}")
            except Exception as e:
                logger.error(f"❌ Failed to save results to MongoDB: {e}", exc_info=True)
        
        logger.info(f"🎉 Parallel enrichment complete: {completed_count}/{total} successful")
        
        return enriched_results

    async def _update_progress(
        self,
        session_id: str,
        candidate_id: str,
        candidate_name: str,
        status: str,
        message: str,
        candidate_index: int,
        total_candidates: int,
        error: Optional[str] = None
    ):
        """Update enrichment progress in Redis."""
        try:
            current = await self.redis.get_session_data(session_id, "enrichment_progress")
            
            if not current:
                current = {
                    "status": "in_progress",
                    "phase": "deep_analysis",
                    "total": total_candidates,
                    "completed": 0,
                    "failed": 0,
                    "candidates": {}
                }
            
            # Update candidate status
            current["candidates"][candidate_id] = {
                "name": candidate_name,
                "status": status,
                "error": error,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Recalculate counts
            completed = sum(1 for c in current["candidates"].values() if c.get("status") == "completed")
            failed = sum(1 for c in current["candidates"].values() if c.get("status") == "failed")
            
            current["completed"] = completed
            current["failed"] = failed
            current["current_candidate"] = candidate_name if status == "analyzing" else ""
            current["message"] = message
            current["progress_percentage"] = int((completed + failed) / total_candidates * 100)
            
            # Update overall status if all done
            if completed + failed >= total_candidates:
                current["status"] = "completed"
                current["phase"] = "complete"
            
            await self.redis.store_session_data(
                session_id,
                "enrichment_progress",
                current,
                expire_seconds=3600
            )
            
            logger.debug(f"📊 Progress updated: {completed}/{total_candidates} completed, status={status}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update progress: {e}", exc_info=True)

    async def get_enrichment_progress(self, session_id: str) -> Dict[str, Any]:
        """Get current enrichment progress."""
        progress = await self.redis.get_session_data(session_id, "enrichment_progress")
        
        if not progress:
            return {
                "status": "not_started",
                "phase": "idle",
                "total": 0,
                "completed": 0,
                "failed": 0,
                "progress_percentage": 0,
                "message": "No enrichment in progress",
                "candidates": {}
            }
        
        return progress

    async def get_candidate_enrichment(
        self,
        session_id: str,
        candidate_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get enrichment status for a specific candidate."""
        progress = await self.get_enrichment_progress(session_id)
        return progress.get("candidates", {}).get(candidate_id)