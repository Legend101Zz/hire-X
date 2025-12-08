"""
Recruitment Pipeline Service
============================
Central service for managing the complete recruitment pipeline.

This is the main orchestrator that handles:
- Pipeline creation (from Donna search or manual import)
- Candidate stage management
- Enrichment triggering
- Email outreach coordination
- Interview scheduling
- Dashboard data generation

Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                     PipelineService                              │
├─────────────────────────────────────────────────────────────────┤
│  create_pipeline_from_search()     → Creates from Donna results │
│  create_pipeline_from_import()     → Creates from CSV upload    │
│  shortlist_candidates()            → Move to shortlist stage    │
│  start_enrichment()                → Trigger deep analysis      │
│  start_outreach()                  → Send personalized emails   │
│  handle_scheduling_click()         → Process scheduling link    │
│  book_interview()                  → Book interview slot        │
│  trigger_interview()               → Start Vapi call            │
│  get_dashboard()                   → Visual tracking data       │
└─────────────────────────────────────────────────────────────────┘

"""

import asyncio
import csv
import io
import re
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from core.config import settings
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
# Models
from models.pipeline_models import (STAGE_METADATA, CandidateStage,
                                    ContactFetchSource, ContactInfo,
                                    EnrichmentSummary, JobContext,
                                    ManualCandidateInput, OutreachEmailRecord,
                                    OutreachRecord, OutreachStatus,
                                    OutreachType, PipelineCandidate,
                                    PipelineSettings, PipelineSource,
                                    PipelineStats, RecruitmentPipeline,
                                    generate_candidate_id,
                                    generate_pipeline_id,
                                    generate_scheduling_token,
                                    get_current_timestamp)
from models.scheduling_models import (InterviewSchedule, ScheduleStatus,
                                      SchedulingConfiguration)
from models.vapi_interview_models import (CreateInterviewRequest,
                                          InterviewCandidateContext,
                                          InterviewJobContext)

logger = get_logger(__name__)


# ============================================================================
# PIPELINE SERVICE
# ============================================================================

class PipelineService:
    """
    Core service for recruitment pipeline management.
    
    This service orchestrates the entire candidate journey from sourcing
    through hiring, coordinating with enrichment, email, and interview services.
    """
    
    # =========================================================================
    # INITIALIZATION
    # =========================================================================
    
    def __init__(
        self,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        jd_parser=None,
        enrichment_orchestrator=None,
        hatch_service=None,
        email_service=None,
        vapi_service=None,
        base_url: str = None
    ):
        """
        Initialize Pipeline Service.
        
        Args:
            mongodb: MongoDB connection
            redis_cache: Redis cache connection
            jd_parser: JD parsing service
            enrichment_orchestrator: IntelligentEnrichmentOrchestrator
            hatch_service: HatchService for contact lookup
            email_service: EmailOutreachService for sending emails
            vapi_service: VapiInterviewService for interviews
            base_url: Base URL for scheduling links
        """
        self.db = mongodb
        self.redis = redis_cache
        self.jd_parser = jd_parser
        self.enrichment = enrichment_orchestrator
        self.hatch = hatch_service
        self.email_service = email_service
        self.vapi_service = vapi_service
        self.base_url = base_url or settings.APP_BASE_URL or "https://neuraleap.shop"
        
        # MongoDB collections
        self.pipelines_collection = mongodb.main_db["recruitment_pipelines"]
        self.schedules_collection = mongodb.main_db["interview_schedules"]
        self.scheduling_config_collection = mongodb.main_db["scheduling_configurations"]
        
        # Ensure indexes
        asyncio.create_task(self._ensure_indexes())
        
        logger.info("✅ PipelineService initialized")
        logger.info(f"   Base URL: {self.base_url}")
    
    async def _ensure_indexes(self):
        """Create MongoDB indexes for efficient queries."""
        try:
            # Pipelines collection
            await self.pipelines_collection.create_index("pipeline_id", unique=True)
            await self.pipelines_collection.create_index("username")
            await self.pipelines_collection.create_index("conversation_session_id")
            await self.pipelines_collection.create_index("search_session_id")
            await self.pipelines_collection.create_index([("username", 1), ("created_at", -1)])
            await self.pipelines_collection.create_index("candidates.candidate_id")
            await self.pipelines_collection.create_index("candidates.outreach.scheduling_token")
            
            # Schedules collection
            await self.schedules_collection.create_index("schedule_id", unique=True)
            await self.schedules_collection.create_index("scheduling_token", unique=True)
            await self.schedules_collection.create_index("pipeline_id")
            await self.schedules_collection.create_index("candidate_id")
            await self.schedules_collection.create_index([("status", 1), ("scheduled_datetime", 1)])
            
            logger.info("✅ Pipeline indexes created")
        except Exception as e:
            logger.warning(f"Could not create pipeline indexes: {e}")
    
    # =========================================================================
    # PIPELINE CREATION
    # =========================================================================
    
    async def create_pipeline_from_search(
        self,
        username: str,
        conversation_session_id: str,
        search_session_id: str,
        job_data: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        pipeline_name: Optional[str] = None,
        auto_shortlist: bool = False
    ) -> RecruitmentPipeline:
        """
        Create a recruitment pipeline from Donna search results.
        
        This is called when a user finalizes a search and wants to
        start the recruitment process for the found candidates.
        
        Args:
            username: User creating the pipeline
            conversation_session_id: Donna conversation session ID
            search_session_id: Search results session ID
            job_data: Ideal profile / job requirements from search
            candidates: List of candidate dictionaries from search results
            pipeline_name: Optional custom name for the pipeline
            auto_shortlist: If True, automatically shortlist all candidates
            
        Returns:
            Created RecruitmentPipeline
        """
        logger.info(f"Creating pipeline from search for user {username}")
        logger.info(f"   Conversation: {conversation_session_id}")
        logger.info(f"   Search: {search_session_id}")
        logger.info(f"   Candidates: {len(candidates)}")
        
        # Create job context from ideal profile
        job = self._create_job_context_from_search(job_data)
        
        # Convert candidates to pipeline format
        pipeline_candidates = []
        for c in candidates:
            pc = self._convert_search_candidate(c, auto_shortlist)
            pipeline_candidates.append(pc)
        
        # Generate pipeline name if not provided
        if not pipeline_name:
            pipeline_name = f"{job.job_title} - {datetime.utcnow().strftime('%b %d')}"
        
        # Create pipeline
        pipeline = RecruitmentPipeline(
            pipeline_id=generate_pipeline_id(),
            username=username,
            name=pipeline_name,
            source=PipelineSource.DONNA_SEARCH,
            conversation_session_id=conversation_session_id,
            search_session_id=search_session_id,
            job=job,
            candidates=pipeline_candidates,
            settings=PipelineSettings()
        )
        
        # Calculate initial stats
        pipeline.recalculate_stats()
        
        # Save to MongoDB
        await self._save_pipeline(pipeline)
        
        # Cache pipeline ID mapping in Redis for quick lookup
        await self._cache_pipeline_mapping(pipeline)
        
        logger.info(f"✅ Created pipeline {pipeline.pipeline_id}")
        logger.info(f"   Name: {pipeline_name}")
        logger.info(f"   Candidates: {len(pipeline_candidates)}")
        logger.info(f"   Job: {job.job_title}")
        
        return pipeline
    
    async def create_pipeline_from_import(
        self,
        username: str,
        jd_text: str,
        candidates_csv: str,
        pipeline_name: Optional[str] = None,
        resume_files: Dict[str, bytes] = None
    ) -> RecruitmentPipeline:
        """
        Create a pipeline from manual CSV import.
        
        CSV format:
        linkedin_url,expected_salary,notice_period,preferred_location,notes
        
        Args:
            username: User creating the pipeline
            jd_text: Job description text
            candidates_csv: CSV content string
            pipeline_name: Optional custom name
            resume_files: Optional dict of linkedin_url -> resume bytes
            
        Returns:
            Created RecruitmentPipeline
        """
        logger.info(f"Creating pipeline from manual import for user {username}")
        
        # Parse JD to extract requirements
        job = await self._parse_jd_to_job_context(jd_text)
        
        # Parse CSV and create candidates
        pipeline_candidates = []
        csv_errors = []
        
        try:
            reader = csv.DictReader(io.StringIO(candidates_csv))
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    linkedin_url = row.get("linkedin_url", "").strip()
                    if not linkedin_url:
                        csv_errors.append(f"Row {row_num}: Missing linkedin_url")
                        continue
                    
                    # Normalize LinkedIn URL
                    linkedin_url = self._normalize_linkedin_url(linkedin_url)
                    if not linkedin_url:
                        csv_errors.append(f"Row {row_num}: Invalid LinkedIn URL")
                        continue
                    
                    # Check for duplicate
                    if any(c.linkedin_url == linkedin_url for c in pipeline_candidates):
                        csv_errors.append(f"Row {row_num}: Duplicate LinkedIn URL")
                        continue
                    
                    # Create manual input record
                    manual_input = ManualCandidateInput(
                        linkedin_url=linkedin_url,
                        expected_salary=row.get("expected_salary", "").strip() or None,
                        notice_period=row.get("notice_period", "").strip() or None,
                        preferred_location=row.get("preferred_location", "").strip() or None,
                        source_notes=row.get("notes", "").strip() or None
                    )
                    
                    # Handle resume if provided
                    if resume_files and linkedin_url in resume_files:
                        resume_path = await self._save_resume_file(
                            resume_files[linkedin_url],
                            linkedin_url
                        )
                        manual_input.resume_file_path = resume_path
                    
                    # Create candidate
                    candidate = PipelineCandidate(
                        candidate_id=generate_candidate_id(),
                        linkedin_url=linkedin_url,
                        manual_input=manual_input,
                        stage=CandidateStage.SOURCED
                    )
                    pipeline_candidates.append(candidate)
                    
                except Exception as e:
                    csv_errors.append(f"Row {row_num}: {str(e)}")
        
        except csv.Error as e:
            raise ValueError(f"Invalid CSV format: {e}")
        
        if not pipeline_candidates:
            raise ValueError(f"No valid candidates in CSV. Errors: {csv_errors}")
        
        # Generate pipeline name
        if not pipeline_name:
            pipeline_name = f"{job.job_title} (Import) - {datetime.utcnow().strftime('%b %d')}"
        
        # Create pipeline
        pipeline = RecruitmentPipeline(
            pipeline_id=generate_pipeline_id(),
            username=username,
            name=pipeline_name,
            source=PipelineSource.MANUAL_IMPORT,
            job=job,
            candidates=pipeline_candidates,
            settings=PipelineSettings()
        )
        
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        await self._cache_pipeline_mapping(pipeline)
        
        # Trigger background scraping for imported candidates
        asyncio.create_task(self._scrape_imported_candidates(pipeline.pipeline_id))
        
        logger.info(f"✅ Created import pipeline {pipeline.pipeline_id}")
        logger.info(f"   Candidates: {len(pipeline_candidates)}")
        if csv_errors:
            logger.warning(f"   CSV Errors: {csv_errors}")
        
        return pipeline
    
    def _create_job_context_from_search(self, job_data: Dict[str, Any]) -> JobContext:
        """Convert search/ideal profile data to JobContext."""
        return JobContext(
            job_title=job_data.get("role_title", "Untitled Role"),
            company_name=job_data.get("company_name"),
            required_skills=job_data.get("must_have_skills", []),
            nice_to_have_skills=job_data.get("nice_to_have_skills", []),
            experience_required=job_data.get("experience_years"),
            location_requirements=job_data.get("locations", []),
            jd_text=job_data.get("jd_text"),
            interview_focus_areas=job_data.get("interview_focus_areas", []),
            key_evaluation_criteria=job_data.get("evaluation_criteria", [])
        )
    
    async def _parse_jd_to_job_context(self, jd_text: str) -> JobContext:
        """Parse JD text and create JobContext."""
        if self.jd_parser:
            try:
                jd_data = await self.jd_parser.parse_jd_text(jd_text)
                return JobContext(
                    job_title=jd_data.get("role_title", "Untitled Role"),
                    required_skills=jd_data.get("required_skills", []),
                    nice_to_have_skills=jd_data.get("preferred_skills", []),
                    experience_required=jd_data.get("experience_years"),
                    location_requirements=jd_data.get("locations", []),
                    education_requirements=jd_data.get("education", []),
                    jd_text=jd_text,
                    jd_parsed_at=get_current_timestamp()
                )
            except Exception as e:
                logger.error(f"JD parsing failed: {e}")
        
        # Fallback: Basic extraction
        return JobContext(
            job_title="Untitled Role",
            jd_text=jd_text
        )
    
    def _convert_search_candidate(
        self,
        c: Dict[str, Any],
        auto_shortlist: bool = False
    ) -> PipelineCandidate:
        """Convert a search result candidate to PipelineCandidate."""
        # Extract name
        name = c.get("name", "")
        if not name:
            first = c.get("first_name", "")
            last = c.get("last_name", "")
            name = f"{first} {last}".strip()
        
        # Extract skills
        skills = c.get("skills", [])
        if not skills:
            expertise = c.get("expertise", "")
            if expertise and expertise != "NA":
                skills = [s.strip() for s in expertise.split(",")][:10]
        
        # Determine initial stage
        initial_stage = CandidateStage.SHORTLISTED if auto_shortlist else CandidateStage.SOURCED
        
        return PipelineCandidate(
            candidate_id=generate_candidate_id(),
            profile_id=str(c.get("_id", c.get("profile_id", ""))),
            linkedin_url=c.get("linkedin_url", ""),
            linkedin_id=c.get("linkedin_id"),
            name=name or "Unknown",
            first_name=c.get("first_name"),
            last_name=c.get("last_name"),
            headline=c.get("headline", c.get("title")),
            current_title=c.get("title", c.get("current_title")),
            current_company=c.get("current_company"),
            location=c.get("location"),
            experience_years=c.get("experience_years", c.get("total_experience_years")),
            skills=skills,
            profile_picture_url=c.get("profile_picture_url"),
            stage=initial_stage
        )
    
    async def _scrape_imported_candidates(self, pipeline_id: str):
        """
        Background task to scrape LinkedIn profiles for manually imported candidates.
        """
        logger.info(f"Starting background scrape for pipeline {pipeline_id}")
        
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            logger.error(f"Pipeline not found for scraping: {pipeline_id}")
            return
        
        scraped_count = 0
        error_count = 0
        
        for candidate in pipeline.candidates:
            # Skip if already has name (was in our DB)
            if candidate.name and candidate.name != "Unknown":
                continue
            
            if not candidate.linkedin_url:
                continue
            
            try:
                # First, try to find in our profiles DB
                profile_data = await self._lookup_profile_in_db(candidate.linkedin_url)
                
                if not profile_data and self.enrichment:
                    # Scrape fresh from LinkedIn
                    profile_data = await self.enrichment._scrape_fresh_linkedin(
                        candidate.linkedin_url
                    )
                
                if profile_data:
                    # Update candidate with scraped data
                    candidate.name = f"{profile_data.get('first_name', '')} {profile_data.get('last_name', '')}".strip()
                    candidate.first_name = profile_data.get("first_name")
                    candidate.last_name = profile_data.get("last_name")
                    candidate.headline = profile_data.get("headline", profile_data.get("title"))
                    candidate.current_title = profile_data.get("title", profile_data.get("headline"))
                    candidate.current_company = profile_data.get("current_company")
                    candidate.location = profile_data.get("location")
                    candidate.experience_years = profile_data.get("experience_years")
                    candidate.skills = profile_data.get("skills", [])[:10]
                    candidate.profile_picture_url = profile_data.get("profile_picture_url")
                    candidate.updated_at = get_current_timestamp()
                    
                    scraped_count += 1
                    logger.info(f"   Scraped: {candidate.name}")
                    
            except Exception as e:
                logger.error(f"   Failed to scrape {candidate.linkedin_url}: {e}")
                error_count += 1
            
            # Rate limiting
            await asyncio.sleep(2)
        
        # Save updated pipeline
        await self._save_pipeline(pipeline)
        
        logger.info(f"✅ Scraping complete for {pipeline_id}")
        logger.info(f"   Scraped: {scraped_count}, Errors: {error_count}")
    
    async def _lookup_profile_in_db(self, linkedin_url: str) -> Optional[Dict[str, Any]]:
        """Look up a profile in our profiles database by LinkedIn URL."""
        try:
            # Normalize URL for matching
            normalized = self._normalize_linkedin_url(linkedin_url)
            if not normalized:
                return None
            
            # Try exact match
            profile = await self.db.profiles_collection.find_one({
                "linkedin_url": {"$regex": normalized.replace("https://www.", ""), "$options": "i"}
            })
            
            return profile
        except Exception as e:
            logger.error(f"Profile lookup failed: {e}")
            return None
    
    # =========================================================================
    # SHORTLISTING
    # =========================================================================
    
    async def shortlist_candidates(
        self,
        pipeline_id: str,
        candidate_ids: List[str],
        username: str
    ) -> Tuple[RecruitmentPipeline, int]:
        """
        Move candidates to shortlist stage.
        
        This is the gateway to Phase 2 - once shortlisted, candidates
        can be enriched and contacted.
        
        Args:
            pipeline_id: Pipeline ID
            candidate_ids: List of candidate IDs to shortlist
            username: User performing the action
            
        Returns:
            Tuple of (updated pipeline, count shortlisted)
        """
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline not found: {pipeline_id}")
        
        if pipeline.username != username:
            raise PermissionError("Access denied to this pipeline")
        
        shortlisted_count = 0
        
        for candidate in pipeline.candidates:
            if candidate.candidate_id in candidate_ids:
                if candidate.stage == CandidateStage.SOURCED:
                    candidate.update_stage(
                        CandidateStage.SHORTLISTED,
                        triggered_by="user",
                        notes=f"Shortlisted by {username}"
                    )
                    shortlisted_count += 1
        
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        logger.info(f"✅ Shortlisted {shortlisted_count} candidates in {pipeline_id}")
        
        return pipeline, shortlisted_count
    
    async def remove_from_shortlist(
        self,
        pipeline_id: str,
        candidate_ids: List[str],
        username: str
    ) -> Tuple[RecruitmentPipeline, int]:
        """Move candidates back to sourced stage."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline not found: {pipeline_id}")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        removed_count = 0
        
        for candidate in pipeline.candidates:
            if candidate.candidate_id in candidate_ids:
                if candidate.stage == CandidateStage.SHORTLISTED:
                    candidate.update_stage(
                        CandidateStage.SOURCED,
                        triggered_by="user",
                        notes="Removed from shortlist"
                    )
                    removed_count += 1
        
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        return pipeline, removed_count
    
    # =========================================================================
    # PHASE 2: ENRICHMENT
    # =========================================================================
    
    async def start_enrichment(
        self,
        pipeline_id: str,
        username: str,
        candidate_ids: Optional[List[str]] = None,
        include_contact_fetch: bool = True
    ) -> Dict[str, Any]:
        """
        Start deep enrichment for shortlisted candidates.
        
        This triggers:
        1. Contact info fetch via Hatch (email first, then phone if needed)
        2. Deep analysis via IntelligentEnrichmentOrchestrator
        
        Args:
            pipeline_id: Pipeline ID
            username: User triggering enrichment
            candidate_ids: Optional specific candidates (None = all shortlisted)
            include_contact_fetch: Whether to fetch contact info
            
        Returns:
            Dict with enrichment status
        """
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline not found: {pipeline_id}")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        # Get candidates to enrich
        to_enrich = []
        for c in pipeline.candidates:
            # Filter by IDs if provided
            if candidate_ids and c.candidate_id not in candidate_ids:
                continue
            
            # Only enrich shortlisted, non-enriched candidates
            if c.stage == CandidateStage.SHORTLISTED and not c.enrichment.is_enriched:
                to_enrich.append(c)
        
        if not to_enrich:
            return {
                "success": True,
                "message": "No candidates to enrich",
                "count": 0
            }
        
        # Update stages to ENRICHING
        for c in to_enrich:
            c.update_stage(CandidateStage.ENRICHING, triggered_by="system")
        
        await self._save_pipeline(pipeline)
        
        # Start background enrichment
        asyncio.create_task(
            self._run_enrichment_batch(
                pipeline_id=pipeline_id,
                candidate_ids=[c.candidate_id for c in to_enrich],
                include_contact_fetch=include_contact_fetch
            )
        )
        
        logger.info(f"🔍 Started enrichment for {len(to_enrich)} candidates in {pipeline_id}")
        
        return {
            "success": True,
            "message": f"Started enrichment for {len(to_enrich)} candidates",
            "count": len(to_enrich),
            "candidate_ids": [c.candidate_id for c in to_enrich]
        }
    
    async def _run_enrichment_batch(
        self,
        pipeline_id: str,
        candidate_ids: List[str],
        include_contact_fetch: bool = True
    ):
        """
        Background task to enrich candidates.
        
        For each candidate:
        1. Fetch email via Hatch (prioritize email over phone)
        2. Run deep dive analysis
        3. Update candidate record
        """
        logger.info(f"Starting enrichment batch for {pipeline_id}")
        logger.info(f"   Candidates: {len(candidate_ids)}")
        
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            logger.error(f"Pipeline not found: {pipeline_id}")
            return
        
        # Build JD text for analysis
        jd_text = pipeline.job.jd_text or pipeline.job.get_jd_summary()
        
        success_count = 0
        error_count = 0
        
        for candidate_id in candidate_ids:
            candidate = pipeline.get_candidate(candidate_id)
            if not candidate:
                continue
            
            try:
                # ===============================================
                # STEP 1: Fetch contact info (email first)
                # ===============================================
                if include_contact_fetch and not candidate.contact.email:
                    contact_result = await self._fetch_candidate_contact(candidate)
                    
                    if contact_result.get("email"):
                        candidate.contact.email = contact_result["email"]
                        candidate.contact.email_verified = True
                        candidate.contact.email_source = ContactFetchSource.HATCH_API
                        candidate.contact.email_fetched_at = get_current_timestamp()
                        logger.info(f"   ✅ Got email for {candidate.display_name}")
                    
                    if contact_result.get("phone"):
                        candidate.contact.phone = contact_result["phone"]
                        candidate.contact.phone_source = ContactFetchSource.HATCH_API
                        candidate.contact.phone_fetched_at = get_current_timestamp()
                    
                    if contact_result.get("error"):
                        candidate.contact.email_fetch_error = contact_result["error"]
                        logger.warning(f"   ⚠️ Contact fetch issue: {contact_result['error']}")
                
                # ===============================================
                # STEP 2: Deep analysis
                # ===============================================
                if self.enrichment:
                    try:
                        deep_dive_result = await self.enrichment.deep_dive_candidate(
                            linkedin_url=candidate.linkedin_url,
                            job_description=jd_text,
                            force_scrape=True
                        )
                        
                        # Update enrichment summary
                        candidate.enrichment.is_enriched = True
                        candidate.enrichment.enriched_at = get_current_timestamp()
                        candidate.enrichment.enrichment_source = "deep_dive"
                        
                        # Extract key data from deep dive
                        if deep_dive_result.match_analysis:
                            ma = deep_dive_result.match_analysis
                            candidate.enrichment.match_score = ma.overall_match_score
                            candidate.enrichment.match_label = self._score_to_label(ma.overall_match_score)
                            candidate.enrichment.top_strengths = ma.top_strengths[:5]
                            candidate.enrichment.concerns = ma.concerns[:5]
                        
                        if deep_dive_result.skill_validation:
                            sv = deep_dive_result.skill_validation
                            candidate.enrichment.verified_skills = [
                                s for s, v in sv.model_dump().get("skill_results", {}).items()
                                if v.get("validated")
                            ][:10]
                        
                        if deep_dive_result.salary_timeline:
                            candidate.enrichment.salary_estimate = deep_dive_result.salary_timeline.model_dump()
                        
                        if deep_dive_result.notice_period:
                            candidate.enrichment.notice_period_estimate = deep_dive_result.notice_period.model_dump()
                        
                        if deep_dive_result.response_likelihood:
                            candidate.enrichment.response_likelihood = deep_dive_result.response_likelihood.model_dump()
                        
                        # Store full data
                        candidate.enrichment.full_enrichment_data = deep_dive_result.model_dump()
                        
                        # Update candidate info from fresh scrape
                        if deep_dive_result.candidate:
                            cd = deep_dive_result.candidate
                            if cd.get("full_name"):
                                candidate.name = cd["full_name"]
                            if cd.get("headline"):
                                candidate.headline = cd["headline"]
                                candidate.current_title = cd["headline"]
                            if cd.get("current_company"):
                                candidate.current_company = cd["current_company"]
                            if cd.get("location"):
                                candidate.location = cd["location"]
                        
                        logger.info(f"   ✅ Enriched {candidate.display_name}: score={candidate.enrichment.match_score}")
                        
                    except Exception as e:
                        logger.error(f"   ❌ Deep dive failed for {candidate.display_name}: {e}")
                        candidate.enrichment.enrichment_error = str(e)
                else:
                    # No enrichment service - just mark as done
                    candidate.enrichment.is_enriched = True
                    candidate.enrichment.enriched_at = get_current_timestamp()
                    candidate.enrichment.enrichment_source = "basic"
                
                # ===============================================
                # STEP 3: Update stage
                # ===============================================
                if candidate.enrichment.is_enriched:
                    # Check if we have email for outreach
                    if candidate.contact.email:
                        candidate.update_stage(CandidateStage.ENRICHED, triggered_by="system")
                    else:
                        candidate.update_stage(
                            CandidateStage.ENRICHED,
                            triggered_by="system",
                            notes="No email found - manual contact needed"
                        )
                    success_count += 1
                else:
                    candidate.update_stage(
                        CandidateStage.ENRICHMENT_FAILED,
                        triggered_by="system",
                        notes=candidate.enrichment.enrichment_error
                    )
                    error_count += 1
                
                # Save progress after each candidate
                pipeline.update_candidate(candidate)
                await self._save_pipeline(pipeline)
                
            except Exception as e:
                logger.error(f"   ❌ Enrichment failed for {candidate_id}: {e}")
                candidate.enrichment.enrichment_error = str(e)
                candidate.update_stage(CandidateStage.ENRICHMENT_FAILED, triggered_by="system")
                pipeline.update_candidate(candidate)
                await self._save_pipeline(pipeline)
                error_count += 1
            
            # Rate limiting between candidates
            await asyncio.sleep(3)
        
        # Final stats recalculation
        pipeline = await self.get_pipeline(pipeline_id)
        if pipeline:
            pipeline.recalculate_stats()
            await self._save_pipeline(pipeline)
        
        logger.info(f"✅ Enrichment batch complete for {pipeline_id}")
        logger.info(f"   Success: {success_count}, Errors: {error_count}")
    
    async def _fetch_candidate_contact(self, candidate: PipelineCandidate) -> Dict[str, Any]:
        """
        Fetch contact info for a candidate.
        
        Priority: Email first (for outreach), then phone (for interview).
        """
        result = {"email": None, "phone": None, "error": None}
        
        if not self.hatch:
            result["error"] = "Hatch service not configured"
            return result
        
        try:
            # If we have a profile_id, use it
            if candidate.profile_id:
                hatch_result = await self.hatch.get_contact_info_by_profile_id(
                    profile_mongo_id=candidate.profile_id,
                    session_id=None
                )
                
                if hatch_result.get("success"):
                    result["email"] = hatch_result.get("email")
                    result["phone"] = hatch_result.get("phone")
                else:
                    result["error"] = hatch_result.get("error", "Contact fetch failed")
            else:
                # No profile_id - would need to implement LinkedIn URL lookup
                result["error"] = "No profile_id available"
                
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    def _score_to_label(self, score: float) -> str:
        """Convert match score to label."""
        if score >= 85:
            return "Excellent Match"
        elif score >= 70:
            return "Great Match"
        elif score >= 55:
            return "Good Match"
        elif score >= 40:
            return "Fair Match"
        else:
            return "Below Target"
    
    # =========================================================================
    # PHASE 2: OUTREACH
    # =========================================================================
    
    async def start_outreach(
        self,
        pipeline_id: str,
        username: str,
        candidate_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Start email outreach for enriched candidates.
        
        This:
        1. Generates personalized emails for each candidate
        2. Sends emails with scheduling links
        3. Tracks delivery and engagement
        
        Args:
            pipeline_id: Pipeline ID
            username: User triggering outreach
            candidate_ids: Optional specific candidates (None = all enriched with email)
            
        Returns:
            Dict with outreach results
        """
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline not found: {pipeline_id}")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        # Get candidates ready for outreach
        to_contact = []
        for c in pipeline.candidates:
            if candidate_ids and c.candidate_id not in candidate_ids:
                continue
            
            # Must be enriched, have email, and not already contacted
            if (c.stage == CandidateStage.ENRICHED and 
                c.contact.email and 
                not c.outreach):
                to_contact.append(c)
        
        if not to_contact:
            return {
                "success": True,
                "message": "No candidates ready for outreach",
                "count": 0
            }
        
        # Process outreach
        results = []
        success_count = 0
        
        for candidate in to_contact:
            try:
                # Generate scheduling token and link
                scheduling_token = generate_scheduling_token()
                scheduling_link = f"{self.base_url}/schedule/{scheduling_token}"
                
                # Create outreach record
                outreach = OutreachRecord(
                    scheduling_token=scheduling_token,
                    scheduling_link=scheduling_link,
                    scheduling_link_expires_at=(
                        datetime.utcnow() + timedelta(days=pipeline.settings.scheduling_link_expiry_days)
                    ).isoformat()
                )
                
                # Generate and send email
                if self.email_service:
                    email_content = await self.email_service.generate_outreach_email(
                        candidate=candidate,
                        job=pipeline.job,
                        scheduling_link=scheduling_link
                    )
                    
                    # Send email
                    await self.email_service.send_email(
                        to_email=candidate.contact.email,
                        to_name=candidate.display_name,
                        subject=email_content["subject"],
                        body_html=email_content["body_html"],
                        body_plain=email_content["body"]
                    )
                    
                    # Record email
                    email_record = OutreachEmailRecord(
                        email_type=OutreachType.INITIAL,
                        subject=email_content["subject"],
                        body_plain=email_content["body"],
                        body_html=email_content["body_html"],
                        status=OutreachStatus.SENT,
                        sent_at=get_current_timestamp()
                    )
                    outreach.add_email(email_record)
                else:
                    # No email service - just create record
                    outreach.initial_email_status = OutreachStatus.PENDING
                    logger.warning("Email service not configured - outreach not sent")
                
                # Update candidate
                candidate.outreach = outreach
                candidate.update_stage(CandidateStage.OUTREACH_SENT, triggered_by="system")
                
                pipeline.update_candidate(candidate)
                pipeline.stats.total_contacted += 1
                
                results.append({
                    "candidate_id": candidate.candidate_id,
                    "name": candidate.display_name,
                    "email": candidate.contact.email,
                    "success": True
                })
                success_count += 1
                
                logger.info(f"   ✅ Sent outreach to {candidate.display_name}")
                
            except Exception as e:
                logger.error(f"   ❌ Outreach failed for {candidate.display_name}: {e}")
                results.append({
                    "candidate_id": candidate.candidate_id,
                    "name": candidate.display_name,
                    "success": False,
                    "error": str(e)
                })
                
                candidate.update_stage(
                    CandidateStage.OUTREACH_FAILED,
                    triggered_by="system",
                    notes=str(e)
                )
                pipeline.update_candidate(candidate)
            
            # Rate limit
            await asyncio.sleep(1)
        
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        logger.info(f"✅ Outreach complete for {pipeline_id}: {success_count}/{len(to_contact)} sent")
        
        return {
            "success": True,
            "message": f"Sent outreach to {success_count} candidates",
            "total": len(to_contact),
            "sent": success_count,
            "failed": len(to_contact) - success_count,
            "results": results
        }
    
    async def send_reminder_emails(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Send reminder emails to candidates who haven't responded.
        
        Called by scheduled job after reminder_delay_hours.
        """
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return {"error": "Pipeline not found"}
        
        reminder_cutoff = datetime.utcnow() - timedelta(
            hours=pipeline.settings.reminder_delay_hours
        )
        
        sent_count = 0
        
        for candidate in pipeline.candidates:
            # Only for candidates with outreach sent
            if candidate.stage != CandidateStage.OUTREACH_SENT:
                continue
            
            if not candidate.outreach:
                continue
            
            # Skip if already clicked or responded
            if candidate.outreach.first_clicked_at:
                continue
            
            # Skip if already sent max reminders
            if candidate.outreach.reminder_count >= pipeline.settings.max_reminders:
                continue
            
            # Check if enough time has passed
            if not candidate.outreach.initial_email_sent_at:
                continue
            
            initial_sent = datetime.fromisoformat(candidate.outreach.initial_email_sent_at)
            if initial_sent > reminder_cutoff:
                continue
            
            try:
                # Send reminder
                if self.email_service:
                    await self.email_service.send_reminder(
                        candidate=candidate,
                        job=pipeline.job,
                        scheduling_link=candidate.outreach.scheduling_link
                    )
                    
                    email_record = OutreachEmailRecord(
                        email_type=OutreachType.REMINDER,
                        subject=f"Quick follow-up: {pipeline.job.job_title}",
                        body_plain="Reminder email",
                        status=OutreachStatus.SENT,
                        sent_at=get_current_timestamp()
                    )
                    candidate.outreach.add_email(email_record)
                
                candidate.update_stage(CandidateStage.OUTREACH_REMINDER, triggered_by="system")
                pipeline.update_candidate(candidate)
                sent_count += 1
                
                logger.info(f"   📧 Sent reminder to {candidate.display_name}")
                
            except Exception as e:
                logger.error(f"   ❌ Reminder failed for {candidate.display_name}: {e}")
        
        await self._save_pipeline(pipeline)
        
        return {"reminders_sent": sent_count}
    
    async def mark_no_response_candidates(self, pipeline_id: str) -> Dict[str, Any]:
        """
        Mark candidates as no-response after timeout.
        
        Called by scheduled job.
        """
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            return {"error": "Pipeline not found"}
        
        timeout_hours = pipeline.settings.no_response_timeout_hours or 72
        cutoff = datetime.utcnow() - timedelta(hours=timeout_hours)
        
        marked_count = 0
        
        for candidate in pipeline.candidates:
            # Only for candidates with reminder sent (or outreach if no reminders configured)
            if candidate.stage not in [CandidateStage.OUTREACH_SENT, CandidateStage.OUTREACH_REMINDER]:
                continue
            
            if not candidate.outreach:
                continue
            
            # Skip if responded
            if candidate.outreach.candidate_responded or candidate.outreach.first_clicked_at:
                continue
            
            # Check timeout
            last_contact = candidate.outreach.last_reminder_sent_at or candidate.outreach.initial_email_sent_at
            if not last_contact:
                continue
            
            last_contact_dt = datetime.fromisoformat(last_contact)
            if last_contact_dt > cutoff:
                continue
            
            # Mark as no response
            candidate.update_stage(
                CandidateStage.NO_RESPONSE,
                triggered_by="system",
                notes="No response after outreach timeout"
            )
            candidate.final_decision = "rejected"
            candidate.final_decision_at = get_current_timestamp()
            candidate.rejection_reason = "No response to outreach"
            
            pipeline.update_candidate(candidate)
            marked_count += 1
        
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        return {"marked_no_response": marked_count}
    
    # =========================================================================
    # SCHEDULING
    # =========================================================================
    
    async def handle_scheduling_click(
        self,
        scheduling_token: str
    ) -> Dict[str, Any]:
        """
        Handle when a candidate clicks the scheduling link.
        
        Returns candidate and job info for the scheduling page.
        """
        # Find pipeline and candidate by token
        pipeline, candidate = await self._find_by_scheduling_token(scheduling_token)
        
        if not pipeline or not candidate:
            return {
                "valid": False,
                "error": "Invalid or expired scheduling link"
            }
        
        # Check if link expired
        if candidate.outreach and candidate.outreach.scheduling_link_expires_at:
            expiry = datetime.fromisoformat(candidate.outreach.scheduling_link_expires_at)
            if datetime.utcnow() > expiry:
                return {
                    "valid": False,
                    "error": "This scheduling link has expired"
                }
        
        # Update tracking
        if candidate.outreach:
            if not candidate.outreach.first_clicked_at:
                candidate.outreach.first_clicked_at = get_current_timestamp()
            candidate.outreach.total_clicks += 1
            candidate.outreach.candidate_responded = True
            candidate.outreach.response_received_at = get_current_timestamp()
        
        # Update stage if not already scheduling/scheduled
        if candidate.stage in [CandidateStage.OUTREACH_SENT, CandidateStage.OUTREACH_REMINDER]:
            candidate.update_stage(CandidateStage.SCHEDULING, triggered_by="candidate")
            pipeline.stats.total_responded += 1
        
        pipeline.update_candidate(candidate)
        await self._save_pipeline(pipeline)
        
        # Get available time slots
        available_slots = await self._get_available_slots(pipeline.pipeline_id)
        
        return {
            "valid": True,
            "candidate_name": candidate.display_name,
            "candidate_email": candidate.contact.email,
            "job_title": pipeline.job.job_title,
            "company_name": pipeline.job.company_name,
            "pipeline_id": pipeline.pipeline_id,
            "candidate_id": candidate.candidate_id,
            "interview_duration_minutes": pipeline.job.interview_duration_minutes,
            "available_slots": [s.model_dump() for s in available_slots],
            "timezone": pipeline.settings.timezone
        }
    
    async def book_interview(
        self,
        scheduling_token: str,
        scheduled_datetime: str,
        timezone: str = "Asia/Kolkata",
        preferred_time: Optional[str] = None,
        special_requirements: Optional[str] = None,
        candidate_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Book an interview slot for a candidate.
        
        Args:
            scheduling_token: Token from outreach email
            scheduled_datetime: Selected time (ISO format)
            timezone: Candidate's timezone
            preferred_time: "morning" | "afternoon" | "evening"
            special_requirements: Any special needs
            candidate_notes: Additional notes from candidate
            
        Returns:
            Booking confirmation
        """
        # Find pipeline and candidate
        pipeline, candidate = await self._find_by_scheduling_token(scheduling_token)
        
        if not pipeline or not candidate:
            return {
                "success": False,
                "error": "Invalid scheduling token"
            }
        
        # Validate phone number for interview
        if not candidate.contact.phone:
            # Try to fetch phone now
            if self.hatch and candidate.profile_id:
                contact_result = await self._fetch_candidate_contact(candidate)
                if contact_result.get("phone"):
                    candidate.contact.phone = contact_result["phone"]
                    candidate.contact.phone_source = ContactFetchSource.HATCH_API
                    candidate.contact.phone_fetched_at = get_current_timestamp()
        
        if not candidate.contact.phone:
            return {
                "success": False,
                "error": "Phone number required for interview. Please contact support."
            }
        
        # Create interview schedule
        schedule = InterviewSchedule(
            pipeline_id=pipeline.pipeline_id,
            candidate_id=candidate.candidate_id,
            scheduling_token=scheduling_token,
            candidate_name=candidate.display_name,
            candidate_email=candidate.contact.email,
            candidate_phone=candidate.contact.phone,
            linkedin_url=candidate.linkedin_url,
            job_title=pipeline.job.job_title,
            company_name=pipeline.job.company_name,
            scheduled_datetime=scheduled_datetime,
            timezone=timezone,
            duration_minutes=pipeline.job.interview_duration_minutes,
            status=ScheduleStatus.CONFIRMED,
            candidate_preferred_time=preferred_time,
            candidate_special_requirements=special_requirements,
            candidate_notes=candidate_notes,
            confirmed_at=get_current_timestamp()
        )
        
        # Save schedule
        await self.schedules_collection.insert_one(schedule.model_dump())
        
        # Update candidate
        candidate.interview.scheduled_datetime = scheduled_datetime
        candidate.interview.timezone = timezone
        candidate.interview.duration_minutes = pipeline.job.interview_duration_minutes
        
        if candidate.outreach:
            candidate.outreach.response_type = "scheduled"
        
        candidate.update_stage(CandidateStage.SCHEDULED, triggered_by="candidate")
        
        pipeline.update_candidate(candidate)
        pipeline.stats.total_scheduled += 1
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        # Send confirmation email
        if self.email_service:
            try:
                await self.email_service.send_booking_confirmation(
                    candidate_email=candidate.contact.email,
                    candidate_name=candidate.display_name,
                    scheduled_datetime=scheduled_datetime,
                    timezone=timezone,
                    job_title=pipeline.job.job_title,
                    duration_minutes=pipeline.job.interview_duration_minutes
                )
            except Exception as e:
                logger.error(f"Failed to send confirmation email: {e}")
        
        logger.info(f"✅ Interview booked for {candidate.display_name} at {scheduled_datetime}")
        
        # Format datetime for display
        dt = datetime.fromisoformat(scheduled_datetime)
        formatted_time = dt.strftime("%A, %B %d at %I:%M %p")
        
        return {
            "success": True,
            "schedule_id": schedule.schedule_id,
            "scheduled_datetime": scheduled_datetime,
            "formatted_time": formatted_time,
            "timezone": timezone,
            "duration_minutes": pipeline.job.interview_duration_minutes,
            "message": f"Your interview is confirmed for {formatted_time}"
        }
    
    async def _get_available_slots(
        self,
        pipeline_id: str,
        days_ahead: int = 14
    ) -> List:
        """Get available time slots for booking."""
        from models.scheduling_models import TimeSlot, TimeSlotType

        # Try to get scheduling config
        config_doc = await self.scheduling_config_collection.find_one({
            "pipeline_id": pipeline_id
        })
        
        if config_doc:
            config = SchedulingConfiguration(**config_doc)
        else:
            # Use defaults
            config = SchedulingConfiguration(
                username="system",
                timezone="Asia/Kolkata"
            )
            # Add default availability: 10am-6pm weekdays
            from models.scheduling_models import AvailabilityWindow
            config.availability_windows = [
                AvailabilityWindow(
                    start_time="10:00",
                    end_time="18:00",
                    days_of_week=[0, 1, 2, 3, 4]  # Mon-Fri
                )
            ]
        
        # Get existing bookings
        existing = await self.schedules_collection.find({
            "pipeline_id": pipeline_id,
            "status": {"$nin": [ScheduleStatus.CANCELLED.value, ScheduleStatus.RESCHEDULED.value]}
        }).to_list(length=100)
        
        existing_schedules = [InterviewSchedule(**s) for s in existing]
        
        # Generate available slots
        from_date = datetime.utcnow() + timedelta(hours=config.min_notice_hours)
        to_date = datetime.utcnow() + timedelta(days=days_ahead)
        
        return config.generate_available_slots(from_date, to_date, existing_schedules)
    
    # =========================================================================
    # INTERVIEW TRIGGERING
    # =========================================================================
    
    async def trigger_scheduled_interviews(self):
        """
        Trigger interviews that are due.
        
        Called by scheduled job every 5 minutes.
        """
        now = datetime.utcnow()
        window_end = now + timedelta(minutes=5)
        
        # Find due interviews
        cursor = self.schedules_collection.find({
            "status": ScheduleStatus.CONFIRMED.value,
            "scheduled_datetime": {
                "$gte": now.isoformat(),
                "$lte": window_end.isoformat()
            },
            "interview_session_id": None
        })
        
        schedules = await cursor.to_list(length=50)
        
        for schedule_doc in schedules:
            try:
                await self._trigger_single_interview(schedule_doc)
            except Exception as e:
                logger.error(f"Failed to trigger interview {schedule_doc['schedule_id']}: {e}")
    
    async def _trigger_single_interview(self, schedule_doc: Dict[str, Any]):
        """Trigger a single interview via VapiInterviewService."""
        schedule = InterviewSchedule(**schedule_doc)
        
        # Get pipeline and candidate
        pipeline = await self.get_pipeline(schedule.pipeline_id)
        if not pipeline:
            logger.error(f"Pipeline not found for interview: {schedule.pipeline_id}")
            return
        
        candidate = pipeline.get_candidate(schedule.candidate_id)
        if not candidate:
            logger.error(f"Candidate not found for interview: {schedule.candidate_id}")
            return
        
        if not self.vapi_service:
            logger.error("Vapi service not configured")
            return
        
        # Build interview context
        candidate_context = InterviewCandidateContext(
            candidate_id=candidate.candidate_id,
            name=candidate.display_name,
            phone_number=schedule.candidate_phone,
            current_title=candidate.current_title or "Professional",
            current_company=candidate.current_company,
            experience_years=candidate.experience_years or 0,
            skills=candidate.skills,
            location=candidate.location,
            linkedin_url=candidate.linkedin_url,
            enrichment_summary=candidate.enrichment.full_enrichment_data.get(
                "match_analysis", {}
            ).get("executive_summary") if candidate.enrichment.full_enrichment_data else None
        )
        
        job_context = InterviewJobContext(
            job_id=pipeline.job.job_id,
            job_title=pipeline.job.job_title,
            company_name=pipeline.job.company_name,
            required_skills=pipeline.job.required_skills,
            nice_to_have_skills=pipeline.job.nice_to_have_skills,
            experience_required=pipeline.job.experience_required or "3+ years",
            key_responsibilities=pipeline.job.interview_focus_areas,
            evaluation_criteria=pipeline.job.key_evaluation_criteria
        )
        
        # Create interview
        request = CreateInterviewRequest(
            candidate=candidate_context,
            job=job_context,
            auto_call=True,
            custom_questions=pipeline.job.custom_interview_questions
        )
        
        try:
            interview_response = await self.vapi_service.create_interview(
                request, 
                pipeline.username
            )
            
            # Update schedule
            await self.schedules_collection.update_one(
                {"schedule_id": schedule.schedule_id},
                {
                    "$set": {
                        "interview_session_id": interview_response.session_id,
                        "call_initiated_at": get_current_timestamp(),
                        "status": ScheduleStatus.IN_PROGRESS.value,
                        "updated_at": get_current_timestamp()
                    }
                }
            )
            
            # Update candidate
            candidate.interview.interview_session_id = interview_response.session_id
            candidate.interview.call_initiated_at = get_current_timestamp()
            candidate.update_stage(CandidateStage.INTERVIEW_CALLING, triggered_by="system")
            
            pipeline.update_candidate(candidate)
            await self._save_pipeline(pipeline)
            
            logger.info(f"🎤 Triggered interview for {candidate.display_name}")
            logger.info(f"   Session: {interview_response.session_id}")
            
        except Exception as e:
            logger.error(f"Interview trigger failed: {e}")
            
            # Update schedule with error
            await self.schedules_collection.update_one(
                {"schedule_id": schedule.schedule_id},
                {
                    "$set": {
                        "status": ScheduleStatus.TECHNICAL_ISSUE.value,
                        "updated_at": get_current_timestamp()
                    }
                }
            )
            
            candidate.update_stage(
                CandidateStage.INTERVIEW_FAILED,
                triggered_by="system",
                notes=str(e)
            )
            pipeline.update_candidate(candidate)
            await self._save_pipeline(pipeline)
    
    async def handle_interview_completion(
        self,
        interview_session_id: str,
        assessment_data: Dict[str, Any]
    ):
        """
        Handle interview completion callback from VapiInterviewService.
        
        Called when an interview finishes and assessment is ready.
        """
        # Find schedule by session ID
        schedule_doc = await self.schedules_collection.find_one({
            "interview_session_id": interview_session_id
        })
        
        if not schedule_doc:
            logger.error(f"Schedule not found for session: {interview_session_id}")
            return
        
        schedule = InterviewSchedule(**schedule_doc)
        
        # Get pipeline and candidate
        pipeline = await self.get_pipeline(schedule.pipeline_id)
        if not pipeline:
            return
        
        candidate = pipeline.get_candidate(schedule.candidate_id)
        if not candidate:
            return
        
        # Update schedule
        schedule.mark_completed(
            interview_session_id=interview_session_id,
            duration_seconds=assessment_data.get("call_duration_seconds", 0),
            completion_status=assessment_data.get("call_end_reason", "completed")
        )
        
        await self.schedules_collection.update_one(
            {"schedule_id": schedule.schedule_id},
            {"$set": schedule.model_dump()}
        )
        
        # Update candidate
        candidate.interview.interview_session_id = interview_session_id
        candidate.interview.call_ended_at = get_current_timestamp()
        candidate.interview.call_duration_seconds = assessment_data.get("call_duration_seconds")
        candidate.interview.recording_url = assessment_data.get("recording_url")
        candidate.interview.transcript_available = bool(assessment_data.get("transcript"))
        
        if assessment_data.get("assessment"):
            candidate.interview.assessment_ready = True
            candidate.interview.assessment_data = assessment_data["assessment"]
            candidate.interview.overall_score = assessment_data["assessment"].get("overall_score")
            candidate.interview.recommendation = assessment_data["assessment"].get("recommendation")
        
        candidate.update_stage(CandidateStage.INTERVIEW_COMPLETED, triggered_by="system")
        
        pipeline.update_candidate(candidate)
        pipeline.stats.total_interviewed += 1
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        logger.info(f"✅ Interview completed for {candidate.display_name}")
        logger.info(f"   Score: {candidate.interview.overall_score}")
        logger.info(f"   Recommendation: {candidate.interview.recommendation}")
    
    # =========================================================================
    # PIPELINE RETRIEVAL & DASHBOARD
    # =========================================================================
    
    async def get_pipeline(self, pipeline_id: str) -> Optional[RecruitmentPipeline]:
        """Get pipeline by ID."""
        doc = await self.pipelines_collection.find_one({"pipeline_id": pipeline_id})
        if doc:
            doc.pop("_id", None)
            return RecruitmentPipeline(**doc)
        return None
    
    async def get_pipeline_by_session(
        self,
        session_id: str
    ) -> Optional[RecruitmentPipeline]:
        """Get pipeline by conversation or search session ID."""
        doc = await self.pipelines_collection.find_one({
            "$or": [
                {"conversation_session_id": session_id},
                {"search_session_id": session_id}
            ]
        })
        if doc:
            doc.pop("_id", None)
            return RecruitmentPipeline(**doc)
        return None
    
    async def list_pipelines(
        self,
        username: str,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        List pipelines for a user.
        
        Returns:
            Tuple of (pipeline summaries, total count)
        """
        query = {"username": username}
        if status:
            query["status"] = status
        
        total = await self.pipelines_collection.count_documents(query)
        
        cursor = self.pipelines_collection.find(
            query,
            {
                "pipeline_id": 1,
                "name": 1,
                "job.job_title": 1,
                "job.company_name": 1,
                "source": 1,
                "status": 1,
                "stats": 1,
                "created_at": 1,
                "updated_at": 1
            }
        ).sort("created_at", -1).skip(offset).limit(limit)
        
        pipelines = []
        async for doc in cursor:
            doc.pop("_id", None)
            pipelines.append({
                "pipeline_id": doc.get("pipeline_id"),
                "name": doc.get("name"),
                "job_title": doc.get("job", {}).get("job_title"),
                "company_name": doc.get("job", {}).get("company_name"),
                "source": doc.get("source"),
                "status": doc.get("status"),
                "stats": doc.get("stats", {}),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at")
            })
        
        return pipelines, total
    
    async def get_dashboard(
        self,
        pipeline_id: str,
        username: str
    ) -> Dict[str, Any]:
        """
        Get visual dashboard data for a pipeline.
        
        Returns structured data for the pipeline tracking UI,
        similar to order delivery status tracking.
        """
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError("Pipeline not found")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        # Build candidate status list
        candidates_data = []
        for c in pipeline.get_active_candidates():
            stage_meta = c.get_stage_metadata()
            
            candidate_data = {
                "candidate_id": c.candidate_id,
                "name": c.display_name,
                "headline": c.headline,
                "current_title": c.current_title,
                "current_company": c.current_company,
                "location": c.location,
                "linkedin_url": c.linkedin_url,
                "profile_picture_url": c.profile_picture_url,
                
                # Stage info
                "stage": c.stage.value,
                "stage_label": stage_meta.get("label", c.stage.value),
                "stage_icon": stage_meta.get("icon", "•"),
                "stage_color": stage_meta.get("color", "gray"),
                "stage_description": stage_meta.get("description", ""),
                "stage_updated_at": c.stage_updated_at,
                
                # Scores
                "match_score": c.enrichment.match_score,
                "match_label": c.enrichment.match_label,
                
                # Contact
                "has_email": bool(c.contact.email),
                "has_phone": bool(c.contact.phone),
                "email": c.contact.email,
                
                # Outreach tracking
                "outreach_sent_at": c.outreach.initial_email_sent_at if c.outreach else None,
                "outreach_opened": bool(c.outreach.total_opens > 0) if c.outreach else False,
                "outreach_clicked": bool(c.outreach.total_clicks > 0) if c.outreach else False,
                "reminder_sent": bool(c.outreach.reminder_count > 0) if c.outreach else False,
                
                # Interview tracking
                "interview_scheduled_at": c.interview.scheduled_datetime,
                "interview_session_id": c.interview.interview_session_id,
                "interview_score": c.interview.overall_score,
                "interview_recommendation": c.interview.recommendation,
                
                # Final outcome
                "final_decision": c.final_decision,
                "rejection_reason": c.rejection_reason,
                
                # Metadata
                "is_favorite": c.is_favorite,
                "priority": c.priority,
                "tags": c.tags,
                "added_at": c.added_at
            }
            candidates_data.append(candidate_data)
        
        # Stage distribution
        stage_counts = {}
        for c in pipeline.get_active_candidates():
            stage_counts[c.stage.value] = stage_counts.get(c.stage.value, 0) + 1
        
        # Pipeline stage progression for visualization
        pipeline_stages = [
            {
                "key": "sourced",
                "label": "Sourced",
                "icon": "📋",
                "count": stage_counts.get("sourced", 0),
                "color": "gray"
            },
            {
                "key": "shortlisted",
                "label": "Shortlisted",
                "icon": "⭐",
                "count": stage_counts.get("shortlisted", 0),
                "color": "blue"
            },
            {
                "key": "enriched",
                "label": "Analyzed",
                "icon": "🔍",
                "count": stage_counts.get("enriched", 0) + stage_counts.get("enriching", 0),
                "color": "green"
            },
            {
                "key": "contacted",
                "label": "Contacted",
                "icon": "📧",
                "count": (
                    stage_counts.get("outreach_sent", 0) + 
                    stage_counts.get("outreach_reminder", 0)
                ),
                "color": "purple"
            },
            {
                "key": "scheduled",
                "label": "Scheduled",
                "icon": "📅",
                "count": stage_counts.get("scheduled", 0) + stage_counts.get("scheduling", 0),
                "color": "indigo"
            },
            {
                "key": "interviewed",
                "label": "Interviewed",
                "icon": "🎤",
                "count": stage_counts.get("interview_completed", 0),
                "color": "teal"
            },
            {
                "key": "evaluated",
                "label": "Evaluated",
                "icon": "📊",
                "count": stage_counts.get("evaluated", 0),
                "color": "cyan"
            }
        ]
        
        # Conversion funnel
        funnel = {
            "sourced_to_shortlisted": self._calc_rate(
                pipeline.stats.total_shortlisted, pipeline.stats.total_sourced
            ),
            "shortlisted_to_contacted": self._calc_rate(
                pipeline.stats.total_contacted, pipeline.stats.total_shortlisted
            ),
            "contacted_to_responded": self._calc_rate(
                pipeline.stats.total_responded, pipeline.stats.total_contacted
            ),
            "responded_to_scheduled": self._calc_rate(
                pipeline.stats.total_scheduled, pipeline.stats.total_responded
            ),
            "scheduled_to_interviewed": self._calc_rate(
                pipeline.stats.total_interviewed, pipeline.stats.total_scheduled
            )
        }
        
        return {
            "pipeline_id": pipeline.pipeline_id,
            "name": pipeline.display_name,
            "job_title": pipeline.job.job_title,
            "company_name": pipeline.job.company_name,
            "source": pipeline.source.value,
            "status": pipeline.status,
            "is_active": pipeline.is_active,
            "created_at": pipeline.created_at,
            "updated_at": pipeline.updated_at,
            
            # Stats
            "stats": pipeline.stats.model_dump(),
            
            # Candidates
            "candidates": candidates_data,
            "total_candidates": len(candidates_data),
            
            # Stage distribution
            "stage_distribution": stage_counts,
            "pipeline_stages": pipeline_stages,
            
            # Funnel
            "funnel": funnel,
            
            # Settings
            "settings": pipeline.settings.model_dump()
        }
    
    def _calc_rate(self, numerator: int, denominator: int) -> float:
        """Calculate percentage rate."""
        if denominator == 0:
            return 0.0
        return round(numerator / denominator * 100, 1)
    
    # =========================================================================
    # CANDIDATE OPERATIONS
    # =========================================================================
    
    async def update_candidate_stage(
        self,
        pipeline_id: str,
        candidate_id: str,
        new_stage: CandidateStage,
        username: str,
        notes: Optional[str] = None
    ) -> PipelineCandidate:
        """Manually update a candidate's stage."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError("Pipeline not found")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        candidate = pipeline.get_candidate(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")
        
        candidate.update_stage(new_stage, triggered_by="user", notes=notes)
        pipeline.update_candidate(candidate)
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        return candidate
    
    async def add_candidate_note(
        self,
        pipeline_id: str,
        candidate_id: str,
        note: str,
        username: str
    ) -> PipelineCandidate:
        """Add a note to a candidate."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError("Pipeline not found")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        candidate = pipeline.get_candidate(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")
        
        candidate.add_note(note, username)
        pipeline.update_candidate(candidate)
        await self._save_pipeline(pipeline)
        
        return candidate
    
    async def toggle_candidate_favorite(
        self,
        pipeline_id: str,
        candidate_id: str,
        username: str
    ) -> bool:
        """Toggle favorite status for a candidate."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError("Pipeline not found")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        candidate = pipeline.get_candidate(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")
        
        candidate.is_favorite = not candidate.is_favorite
        candidate.updated_at = get_current_timestamp()
        
        pipeline.update_candidate(candidate)
        await self._save_pipeline(pipeline)
        
        return candidate.is_favorite
    
    async def reject_candidate(
        self,
        pipeline_id: str,
        candidate_id: str,
        username: str,
        reason: str,
        feedback: Optional[str] = None
    ) -> PipelineCandidate:
        """Reject a candidate."""
        pipeline = await self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError("Pipeline not found")
        
        if pipeline.username != username:
            raise PermissionError("Access denied")
        
        candidate = pipeline.get_candidate(candidate_id)
        if not candidate:
            raise ValueError("Candidate not found")
        
        candidate.update_stage(
            CandidateStage.REJECTED,
            triggered_by="user",
            notes=reason
        )
        candidate.final_decision = "rejected"
        candidate.final_decision_at = get_current_timestamp()
        candidate.final_decision_by = username
        candidate.rejection_reason = reason
        candidate.rejection_feedback = feedback
        
        pipeline.update_candidate(candidate)
        pipeline.recalculate_stats()
        await self._save_pipeline(pipeline)
        
        return candidate
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    async def _save_pipeline(self, pipeline: RecruitmentPipeline):
        """Save pipeline to MongoDB."""
        pipeline.updated_at = get_current_timestamp()
        await self.pipelines_collection.update_one(
            {"pipeline_id": pipeline.pipeline_id},
            {"$set": pipeline.model_dump()},
            upsert=True
        )
    
    async def _cache_pipeline_mapping(self, pipeline: RecruitmentPipeline):
        """Cache pipeline ID mappings in Redis for quick lookup."""
        if self.redis:
            ttl = 86400 * 7  # 7 days
            
            await self.redis.set(
                f"pipeline:session:{pipeline.conversation_session_id}",
                pipeline.pipeline_id,
                ex=ttl
            )
            
            if pipeline.search_session_id:
                await self.redis.set(
                    f"pipeline:search:{pipeline.search_session_id}",
                    pipeline.pipeline_id,
                    ex=ttl
                )
    
    async def _find_by_scheduling_token(
        self,
        scheduling_token: str
    ) -> Tuple[Optional[RecruitmentPipeline], Optional[PipelineCandidate]]:
        """Find pipeline and candidate by scheduling token."""
        doc = await self.pipelines_collection.find_one({
            "candidates.outreach.scheduling_token": scheduling_token
        })
        
        if not doc:
            return None, None
        
        doc.pop("_id", None)
        pipeline = RecruitmentPipeline(**doc)
        
        for candidate in pipeline.candidates:
            if candidate.outreach and candidate.outreach.scheduling_token == scheduling_token:
                return pipeline, candidate
        
        return pipeline, None
    
    def _normalize_linkedin_url(self, url: str) -> Optional[str]:
        """Normalize LinkedIn URL to standard format."""
        if not url:
            return None
        
        url = url.strip()
        
        # Already complete URL
        if url.startswith("http://") or url.startswith("https://"):
            url = re.sub(r"/in/--+", "/in/", url)
            url = re.sub(r"--+/", "/", url)
            if "/in/" not in url.lower():
                return None
            return url.rstrip("/") + "/"
        
        # Partial URL
        url = url.lstrip("/")
        url = re.sub(r"in/--+", "in/", url)
        url = re.sub(r"--+/", "/", url)
        
        if not url.startswith("in/"):
            if "linkedin.com/in/" in url.lower():
                url = url.split("linkedin.com/in/")[-1]
                url = f"in/{url}"
            else:
                # Assume it's just a username
                url = f"in/{url}"
        
        full_url = f"https://www.linkedin.com/{url}"
        return full_url.rstrip("/") + "/"
    
    async def _save_resume_file(
        self,
        resume_bytes: bytes,
        linkedin_url: str
    ) -> str:
        """Save resume file and return path."""
        # Generate unique filename
        filename = f"resume_{uuid.uuid4().hex[:8]}.pdf"
        
        # In production, save to S3 or similar
        # For now, save locally
        import os
        resume_dir = os.path.join(settings.UPLOAD_DIR or "./uploads", "resumes")
        os.makedirs(resume_dir, exist_ok=True)
        
        filepath = os.path.join(resume_dir, filename)
        with open(filepath, "wb") as f:
            f.write(resume_bytes)
        
        return filepath


# ============================================================================
# EXPORT
# ============================================================================

__all__ = ["PipelineService"]