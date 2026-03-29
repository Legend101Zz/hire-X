"""
Intelligent Enrichment Orchestrator V2
=======================================
A comprehensive, LLM-driven candidate enrichment system with HONEST assessment.

KEY IMPROVEMENTS FROM V1:
========================
1. Experience Classification:
   - Distinguishes professional vs volunteer vs student activities
   - Only counts REAL industry experience
   - Flags self-employed/founder roles for verification

2. Fresh Data Priority:
   - Always scrapes fresh LinkedIn data for deep dive
   - Compares with database and uses freshest
   - Extracts ALL experiences and profile links

3. Company Verification:
   - Web searches to verify companies exist
   - Checks if startup vs personal project
   - Gets actual compensation data when available

4. Enhanced Skill Validation:
   - Extracts GitHub, portfolio links from profile
   - For tech: analyzes actual code contributions
   - For non-tech: searches for role-specific evidence

5. Honest Reporting:
   - Confidence levels on every data point
   - Flags uncertain/unverifiable data
   - Never fabricates - says "unknown" when unsure

Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Deep Dive Flow V2                        │
├─────────────────────────────────────────────────────────────┤
│  1. ALWAYS scrape fresh LinkedIn data (don't trust DB)      │
│  2. Extract ALL profile data including links (GitHub, etc.) │
│  3. Classify each experience (pro/intern/volunteer/student) │
│  4. Verify companies exist via web search                   │
│  5. Validate skills using extracted profile links           │
│  6. Estimate salary ONLY for verified paid roles            │
│  7. Calculate REAL industry experience                      │
│  8. Be HONEST about uncertainties                           │
└─────────────────────────────────────────────────────────────┘

Author: Hire-X Engineering
Version: 2.0 - Honest Assessment Edition
"""

import asyncio
import json
import re
import warnings
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import httpx

from core.config import settings
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from models.deep_enrichment_models import (CandidateDeepDive, EnrichmentPlan,
                                           MatchAnalysis, NoticePeriodEstimate,
                                           ResponseLikelihoodScore,
                                           SalaryTimeline,
                                           SkillValidationResult)
from services.model_config_manager import ModelConfigManager

logger = get_logger(__name__)


# =============================================================================
# ENUMS FOR EXPERIENCE CLASSIFICATION
# =============================================================================

class ExperienceType(str, Enum):
    """
    Classification of experience types.
    
    ONLY 'professional' and 'internship' count toward industry experience.
    Others are valuable but shouldn't inflate experience years.
    """
    PROFESSIONAL = "professional"      # Full-time paid job at real company
    INTERNSHIP = "internship"          # Paid internship at real company
    FREELANCE = "freelance"            # Verified freelance work with clients
    FOUNDER = "founder"                # Founded a real company (needs verification)
    SELF_EMPLOYED = "self_employed"    # Personal projects, side hustles
    VOLUNTEER = "volunteer"            # Unpaid volunteer work
    STUDENT_ACTIVITY = "student"       # Student ambassador, clubs, etc.
    OPEN_SOURCE = "open_source"        # Open source contributions (GSoC, etc.)
    UNKNOWN = "unknown"                # Cannot determine


class CompanyVerificationStatus(str, Enum):
    """Status of company verification."""
    VERIFIED_COMPANY = "verified"      # Real company with employees
    STARTUP_UNVERIFIED = "startup"     # Claims to be startup, not verified
    PERSONAL_PROJECT = "personal"      # Likely a personal project
    STUDENT_ORG = "student_org"        # Student organization/club
    VOLUNTEER_ORG = "volunteer_org"    # Volunteer/non-profit
    UNKNOWN = "unknown"                # Could not verify
    
# =============================================================================
# NEW: ROLE-SPECIFIC EVIDENCE TYPES
# =============================================================================

class EvidenceType(str, Enum):
    """Types of professional evidence by role category."""
    # Tech
    CODE_REPOSITORY = "code_repository"
    OPEN_SOURCE_CONTRIBUTION = "open_source"
    TECH_BLOG = "tech_blog"
    STACKOVERFLOW = "stackoverflow"
    
    # Sales
    QUOTA_ACHIEVEMENT = "quota_achievement"
    DEAL_MENTION = "deal_mention"
    SALES_AWARD = "sales_award"
    CLIENT_TESTIMONIAL = "testimonial"
    
    # Marketing
    CAMPAIGN_CASE_STUDY = "campaign_case_study"
    PUBLICATION = "publication"
    SPEAKING_ENGAGEMENT = "speaking"
    THOUGHT_LEADERSHIP = "thought_leadership"
    
    # General
    NEWS_MENTION = "news_mention"
    COMPANY_ANNOUNCEMENT = "company_announcement"
    CERTIFICATION_VERIFIED = "certification"
    AWARD = "award"
    CONFERENCE_SPEAKER = "conference"
    PODCAST_APPEARANCE = "podcast"
    LINKEDIN_POST = "linkedin_post"
    PROFESSIONAL_ASSOCIATION = "association"



# =============================================================================
# MAIN ORCHESTRATOR CLASS
# =============================================================================

class IntelligentEnrichmentOrchestrator:
    """
    Orchestrates intelligent, HONEST candidate enrichment.
    
    Key Principles:
    1. FRESH DATA: Always scrape LinkedIn, don't trust stale DB
    2. CLASSIFY EXPERIENCE: Distinguish real jobs from student activities
    3. VERIFY COMPANIES: Check if companies actually exist
    4. VALIDATE SKILLS: Use GitHub, portfolio, real evidence
    5. BE HONEST: Say "unknown" when uncertain, never fabricate
    
    Usage:
        orchestrator = IntelligentEnrichmentOrchestrator(mongodb, redis, model_manager)
        result = await orchestrator.deep_dive_candidate(
            linkedin_url="https://linkedin.com/in/johndoe",
            job_description="Senior Python Developer..."
        )
    """
    
    # =========================================================================
    # API ENDPOINTS
    # =========================================================================
    
    OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"
    BRIGHTDATA_WEB_UNLOCKER_API = "https://api.brightdata.com/request"
    # FIXED: Use /scrape endpoint instead of /trigger
    BRIGHTDATA_DATASETS_API = "https://api.brightdata.com/datasets/v3"
    
    # Brightdata Dataset IDs
    LINKEDIN_PROFILES_DATASET = "gd_l1viktl72bvl7bjuj0"
    LINKEDIN_COMPANIES_DATASET = "gd_l1vikfnt1wgvvqz95w"
    
    ROLE_EVIDENCE_PRIORITIES = {
    "software_engineer": [
        EvidenceType.CODE_REPOSITORY,
        EvidenceType.OPEN_SOURCE_CONTRIBUTION,
        EvidenceType.TECH_BLOG,
        EvidenceType.STACKOVERFLOW,
        EvidenceType.CONFERENCE_SPEAKER,
    ],
    "sales": [
        EvidenceType.QUOTA_ACHIEVEMENT,
        EvidenceType.DEAL_MENTION,
        EvidenceType.SALES_AWARD,
        EvidenceType.CLIENT_TESTIMONIAL,
        EvidenceType.LINKEDIN_POST,
        EvidenceType.NEWS_MENTION,
    ],
    "marketing": [
        EvidenceType.CAMPAIGN_CASE_STUDY,
        EvidenceType.PUBLICATION,
        EvidenceType.SPEAKING_ENGAGEMENT,
        EvidenceType.THOUGHT_LEADERSHIP,
        EvidenceType.PODCAST_APPEARANCE,
    ],
    "product": [
        EvidenceType.PUBLICATION,
        EvidenceType.SPEAKING_ENGAGEMENT,
        EvidenceType.NEWS_MENTION,
        EvidenceType.LINKEDIN_POST,
        EvidenceType.PODCAST_APPEARANCE,
    ],
    "finance": [
        EvidenceType.CERTIFICATION_VERIFIED,
        EvidenceType.PUBLICATION,
        EvidenceType.NEWS_MENTION,
        EvidenceType.PROFESSIONAL_ASSOCIATION,
    ],
    "hr": [
        EvidenceType.SPEAKING_ENGAGEMENT,
        EvidenceType.THOUGHT_LEADERSHIP,
        EvidenceType.CERTIFICATION_VERIFIED,
        EvidenceType.LINKEDIN_POST,
    ],
    "data_science": [
        EvidenceType.CODE_REPOSITORY,
        EvidenceType.PUBLICATION,
        EvidenceType.CONFERENCE_SPEAKER,
        EvidenceType.TECH_BLOG,
        EvidenceType.OPEN_SOURCE_CONTRIBUTION,
    ],
    "design": [
        EvidenceType.PUBLICATION,  # Dribbble, Behance portfolios
        EvidenceType.AWARD,
        EvidenceType.SPEAKING_ENGAGEMENT,
        EvidenceType.LINKEDIN_POST,
    ],
    "executive": [
        EvidenceType.NEWS_MENTION,
        EvidenceType.COMPANY_ANNOUNCEMENT,
        EvidenceType.SPEAKING_ENGAGEMENT,
        EvidenceType.PODCAST_APPEARANCE,
        EvidenceType.PUBLICATION,
    ],
    "operations": [
        EvidenceType.CERTIFICATION_VERIFIED,
        EvidenceType.NEWS_MENTION,
        EvidenceType.LINKEDIN_POST,
        EvidenceType.PROFESSIONAL_ASSOCIATION,
    ],
    "other": [
        EvidenceType.LINKEDIN_POST,
        EvidenceType.NEWS_MENTION,
        EvidenceType.CERTIFICATION_VERIFIED,
        EvidenceType.PROFESSIONAL_ASSOCIATION,
    ],
    }

    
    # =========================================================================
    # INITIALIZATION
    # =========================================================================
    
    def __init__(
        self,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager
    ):
        """Initialize with dependencies."""
        self.db = mongodb
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        self.openrouter_key = settings.OPENROUTER_API_KEY
        self.brightdata_key = settings.BRIGHTDATA_API_TOKEN
        self.brightdata_zone = getattr(settings, 'BRIGHTDATA_ZONE', 'Hire-X_web_unlocker')
        
        # --- CENTRALIZED MODEL CONFIGURATION ---
        self.llm_config = {
            "search": "deepseek/deepseek-r1-distill-qwen-32b",           # $1/M (was $15/M)
            "analysis": "moonshotai/kimi-k2-thinking",   # Complex JSON
            "classification": "moonshotai/kimi-k2-thinking",  # Simple tasks
            "fast": "anthropic/claude-haiku-4.5",        # $0.25/M
            }
        # Validation
        if not self.openrouter_key:
            logger.warning("⚠️ OPENROUTER_API_KEY not configured")
        if not self.brightdata_key:
            logger.warning("⚠️ BRIGHTDATA_API_TOKEN not configured")
        
        logger.info("✅ IntelligentEnrichmentOrchestrator V2 initialized")
    
    # =========================================================================
    # MAIN ORCHESTRATION METHOD
    # =========================================================================
    
    async def deep_dive_candidate(
        self,
        linkedin_url: str,
        job_description: str,
        force_scrape: bool = True  # DEFAULT TO TRUE - always get fresh data
    ) -> CandidateDeepDive:
        """
        Perform comprehensive, HONEST candidate enrichment.
        
        Key Changes from V1:
        - Always scrapes fresh LinkedIn data (force_scrape=True default)
        - Classifies each experience as professional/student/volunteer
        - Verifies companies actually exist
        - Only estimates salary for verified paid roles
        - Calculates REAL industry experience
        - Flags uncertainties honestly
        """
        logger.info(f"Starting  deep dive for: {linkedin_url}")
        start_time = datetime.utcnow()
        
        # =====================================================================
        # STEP 1: Analyze JD and create enrichment plan
        # =====================================================================
        logger.info("Step 1: Analyzing job description...")
        enrichment_plan = await self._create_enrichment_plan(job_description)
        logger.debug(f"enrichment_plan : {enrichment_plan}")
        logger.info(f"Plan: {enrichment_plan.role_type} / {enrichment_plan.seniority_level}")
        
        # =====================================================================
        # STEP 2: Get FRESH candidate data (always scrape for deep dive)
        # =====================================================================
        logger.info("Step 2: Getting FRESH candidate data...")
        raw_candidate, data_source = await self._get_fresh_candidate_data(linkedin_url,force_scrape=True)
        
        if not raw_candidate:
            raise ValueError(f"Could not scrape candidate: {linkedin_url}")
        
        logger.info(f"Data source: {data_source}")
        logger.debug(f"Candidate data: {raw_candidate} \n {data_source }")
        
        # =====================================================================
        # STEP 3: Extract and classify ALL experiences
        # =====================================================================
        logger.info("Step 3: Classifying experiences...")
        classified_experiences = await self._classify_all_experiences(raw_candidate)
        logger.debug(f"\nclassified_experiences: {classified_experiences}")
        # Calculate REAL industry experience (only professional + internships)
        real_experience = self._calculate_real_experience(classified_experiences)
        logger.info(f"Real industry experience: {real_experience['total_years']} years")
        logger.info(f"Professional roles: {real_experience['professional_count']}")
        logger.info(f"Student/volunteer roles: {real_experience['non_professional_count']}")
        
        # =====================================================================
        # STEP 4: Extract profile links (GitHub, portfolio, etc.)
        # =====================================================================
        logger.info("Step 4: Extracting profile links...")
        candidate_data = self._build_honest_candidate_profile(
            raw_candidate,
            classified_experiences,
            real_experience,
            {},  # Profile links will be added from footprint
            data_source
        )
        logger.info(f"Candidate: {candidate_data.get('full_name', 'Unknown')}")
        
        # =====================================================================
        # STEP 5: Discover Professional Footprint (Web Search)
        # =====================================================================
        logger.info("Step 5: Discovering professional footprint...")
        professional_footprint = await self._discover_professional_footprint(
            candidate_data,
            enrichment_plan
        )
        # Update candidate with discovered profile links
        candidate_data["profile_links"] = {
            **professional_footprint.get("linkedin_provided_links", {}).get("social_profiles", {}),
            "websites": professional_footprint.get("linkedin_provided_links", {}).get("websites", [])
        }
        candidate_data["professional_footprint"] = {
            "digital_presence_score": professional_footprint.get("overall_footprint_assessment", {}).get("digital_presence_score", 0),
            "presence_level": professional_footprint.get("overall_footprint_assessment", {}).get("presence_level", "Unknown"),
            "verified_profiles_count": len(professional_footprint.get("verified_profiles", [])),
            "evidence_items_count": len(professional_footprint.get("evidence_found", [])),
            "identity_confidence": professional_footprint.get("identity_verification", {}).get("overall_confidence", 0)
        }
        
        logger.info(f"Digital presence: {candidate_data['professional_footprint']['presence_level']}")
        logger.info(f"Verified profiles: {candidate_data['professional_footprint']['verified_profiles_count']}")
        logger.info(f"Evidence items: {candidate_data['professional_footprint']['evidence_items_count']}")
            
        
        # =====================================================================
        # STEP 6: Run parallel enrichment with verification
        # =====================================================================
        logger.info("Step 6: Running enrichment with verification...")
        enrichment_results = await self._execute_verified_enrichment_v2(
            candidate_data,
            enrichment_plan,
            classified_experiences,
            professional_footprint 
        )
        
        # =====================================================================
        # STEP 7: Synthesize HONEST match analysis
        # =====================================================================
        logger.info("Step 7: Creating HONEST match analysis...")
        match_analysis = await self._create_honest_match_analysis_v2(
            candidate_data,
            enrichment_plan,
            enrichment_results,
            real_experience,
            professional_footprint
        )
        logger.info(f" Match score: {match_analysis.overall_match_score}%")
        
        # =====================================================================
        # STEP 8: Build final result
        # =====================================================================
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Deep dive complete in {processing_time:.1f}s")
        
        return CandidateDeepDive(
            candidate=candidate_data,
            job_requirements=enrichment_plan.extracted_requirements,
            enrichment_plan=enrichment_plan,
            skill_validation=enrichment_results.get("skills"),
            salary_timeline=enrichment_results.get("salary"),
            response_likelihood=enrichment_results.get("response"),
            notice_period=enrichment_results.get("notice"),
            match_analysis=match_analysis,
            professional_footprint=professional_footprint, 
            data_source=data_source,
            processing_time_seconds=processing_time,
            enriched_at=datetime.utcnow().isoformat()
        )
    
    # =========================================================================
    # STEP 1: JD ANALYSIS (Enhanced)
    # =========================================================================
    
    async def _create_enrichment_plan(self, job_description: str) -> EnrichmentPlan:
        """
        Analyze JD and create enrichment plan.
        
        Enhanced to explicitly define what counts as "valid experience".
        """
        prompt = f"""Analyze this job description and create a detailed enrichment plan.

JOB DESCRIPTION:
{job_description}

Return a JSON object:
{{
    "role_type": "software_engineer|sales|marketing|product|finance|hr|operations|executive|data_science|design|other",
    "role_title": "Exact title from JD",
    "seniority_level": "entry|mid|senior|lead|director|vp|c_level",
    
    "extracted_requirements": {{
        "must_have_skills": ["skill1", "skill2"],
        "nice_to_have_skills": ["skill3", "skill4"],
        "years_experience_min": 5,
        "years_experience_max": 10,
        "experience_type_required": "Must be PROFESSIONAL experience at real companies. Internships count partially. Student clubs, volunteer work, and personal projects do NOT count toward experience requirement.",
        "education_requirements": ["Bachelor's in CS or equivalent"],
        "industry_preferences": ["Fintech", "SaaS"],
        "location_requirements": ["Remote", "Bangalore"]
    }},
    
    "skill_validation_strategy": {{
        "primary_sources": ["GitHub", "StackOverflow", "Portfolio"],
        "validation_criteria": "For tech roles: Check actual code, commits, PRs. For non-tech: Check LinkedIn posts, case studies.",
        "profile_links_to_check": ["github", "portfolio", "medium", "stackoverflow"],
        "evidence_requirements": "Need concrete proof - repos, contributions, published work. Self-claims are not evidence."
    }},
    
    "salary_estimation_strategy": {{
        "market_data_sources": ["Glassdoor", "AmbitionBox", "Levels.fyi"],
        "only_estimate_for": "ONLY estimate salary for verified paid positions at real companies. Do NOT estimate for: volunteer roles, student activities, personal projects, unverified startups.",
        "verification_required": true
    }},
    
    "response_likelihood_factors": {{
        "positive_signals": ["Open to Work", "Recent profile updates", "Active job market"],
        "negative_signals": ["Student", "Recently started new role", "Founder of active company"]
    }},
    
    "notice_period_estimation": {{
        "industry_baseline_days": 30,
        "only_for_employed": "Only estimate notice period if candidate is currently employed at a REAL company. Students/unemployed have 0 notice period."
    }}
}}

IMPORTANT:
- Be STRICT about what counts as experience
- Student ambassador programs are NOT professional experience
- Personal projects/self-employed without clients are NOT experience
- Only count full-time jobs at real companies + internships"""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["analysis"], temperature=0.3)
            plan_data = self._extract_json(response)
            
            return EnrichmentPlan(
                role_type=plan_data.get("role_type", "other"),
                role_title=plan_data.get("role_title", "Unknown Role"),
                seniority_level=plan_data.get("seniority_level", "mid"),
                extracted_requirements=plan_data.get("extracted_requirements", {}),
                skill_validation_strategy=plan_data.get("skill_validation_strategy", {}),
                salary_estimation_strategy=plan_data.get("salary_estimation_strategy", {}),
                response_likelihood_factors=plan_data.get("response_likelihood_factors", {}),
                notice_period_estimation=plan_data.get("notice_period_estimation", {})
            )
        except Exception as e:
            logger.error(f"Failed to parse enrichment plan: {e}")
            return self._default_enrichment_plan(job_description)
    
    # =============================================================================
    # STEP 2: CANDIDATE DATA RETRIEVAL (Hybrid Pipeline)
    # =============================================================================

    async def _get_fresh_candidate_data(
        self,
        linkedin_url: str,
        force_scrape: bool = False
    ) -> Tuple[Optional[Dict], str]:
        """
        Retrieve candidate data using a hybrid Database + Live Scrape strategy.
        
        The goal is to return the MOST COMPLETE and MOST RECENT data possible
        by intelligently combining multiple data sources.
        
        Pipeline:
        ---------
        1. Check Database
        - If force_scrape=False: Accept data < 90 days old
        - If force_scrape=True:  Accept data < 7 days old (for deep dive)
        
        2. Attempt Live Scrape (Brightdata)
        - If DB is stale/missing, fetch fresh data
        - Brightdata is authoritative for CURRENT employment status
        
        3. Merge Strategy
        - If both sources exist: Merge them (Brightdata current + DB history)
        - Brightdata alone: Check quality, enrich if sparse
        - DB alone: Use as fallback
        
        4. Last Resort
        - Web search via Perplexity
        
        Args:
            linkedin_url: Full LinkedIn profile URL
            force_scrape: If True, requires very fresh data (< 7 days)
        
        Returns:
            Tuple of (candidate_data_dict, source_label)
        """
        normalized_url = self._normalize_linkedin_url(linkedin_url)
        
        # -------------------------------------------------------------------------
        # PHASE 1: Database Lookup
        # -------------------------------------------------------------------------
        logger.info(f"Phase 1: Checking database for {normalized_url}")
        
        db_data_raw, db_age_days = await self._get_db_candidate_with_age(normalized_url)
        db_data = None
        db_is_usable = False
        
        # Freshness threshold depends on use case
        # Deep Dive needs recent data; Browse can use older cache
        freshness_threshold_days = 7 if force_scrape else 90
        
        if db_data_raw:
            logger.info(f"  Database HIT - Age: {db_age_days} days (threshold: {freshness_threshold_days})")
            
            # Normalize DB format to standard schema
            db_data = self._normalize_db_response(db_data_raw)
            db_quality = self._assess_data_quality(db_data)
            
            logger.debug(f"  DB Quality Score: {db_quality['score']}/100, Issues: {db_quality['issues']}")
            
            # Check if DB alone is sufficient
            if db_age_days < freshness_threshold_days and db_quality["is_complete"]:
                logger.info(f"  Database is FRESH and COMPLETE - using cached data")
                return db_data, "database_fresh"
            
            # DB exists but is stale or incomplete - will try to supplement
            db_is_usable = True
            logger.info(f"  Database is {'STALE' if db_age_days >= freshness_threshold_days else 'INCOMPLETE'} - will attempt live scrape")
        else:
            logger.info("  Database MISS - no existing record")
        
        # -------------------------------------------------------------------------
        # PHASE 2: Live Scrape (Brightdata)
        # -------------------------------------------------------------------------
        brightdata_data = None
        
        if self.brightdata_key:
            logger.info("Phase 2: Attempting live scrape via Brightdata")
            
            try:
                brightdata_data = await self._scrape_linkedin_dataset_api(normalized_url)
                
                if brightdata_data:
                    bd_quality = self._assess_data_quality(brightdata_data)
                    logger.info(f"  Brightdata SUCCESS - Quality: {bd_quality['score']}/100")
                    logger.debug(f"  Brightdata Issues: {bd_quality['issues']}")
                else:
                    logger.warning("  Brightdata returned no data")
                    
            except Exception as e:
                logger.error(f"  Brightdata scrape failed: {e}")
        else:
            logger.warning("Phase 2: SKIPPED - No Brightdata API key configured")
        
        # -------------------------------------------------------------------------
        # PHASE 3: Intelligent Merge / Selection
        # -------------------------------------------------------------------------
        logger.info("Phase 3: Determining best data source")
        
        # CASE A: Both sources available - MERGE for best results
        if brightdata_data and db_data:
            logger.info("  MERGE MODE: Combining Brightdata (current) + Database (history)")
            merged = self._merge_candidate_data(brightdata_data, db_data)
            
            # Validate merge quality
            merge_quality = self._assess_data_quality(merged)
            logger.info(f"  Merged Quality: {merge_quality['score']}/100")
            
            return merged, "merged_brightdata_db"
        
        # CASE B: Only Brightdata (new profile or DB miss)
        if brightdata_data and not db_data:
            logger.info("  BRIGHTDATA ONLY: New profile discovered")
            
            bd_quality = self._assess_data_quality(brightdata_data)
            
            # Check if Brightdata data needs enrichment
            if bd_quality["needs_enrichment"]:
                logger.warning("  Brightdata data is SPARSE - triggering web enrichment")
                enriched = await self._enrich_incomplete_profile(brightdata_data, normalized_url)
                return enriched, "brightdata_enriched"
            
            return brightdata_data, "brightdata_fresh"
        
        # CASE C: Only Database (Brightdata failed)
        if db_data and not brightdata_data:
            logger.warning("  FALLBACK: Using database record (live scrape failed)")
            return db_data, "database_fallback"
        
        # -------------------------------------------------------------------------
        # PHASE 4: Last Resort - Web Search
        # -------------------------------------------------------------------------
        logger.info("Phase 4: All primary sources failed - trying web search")
        
        web_result = await self._scrape_perplexity_comprehensive(normalized_url)
        if web_result:
            logger.info("  Web search succeeded")
            return web_result, "web_search_fallback"
        
        # Complete failure
        logger.error("All data retrieval methods failed")
        return None, "not_found"


    # =============================================================================
    # DATABASE OPERATIONS
    # =============================================================================

    async def _get_db_candidate_with_age(
        self, 
        linkedin_url: str
    ) -> Tuple[Optional[Dict], int]:
        """
        Retrieve candidate from MongoDB and calculate record age.
        
        Tries multiple query patterns to handle URL format variations:
        - Regex match on username
        - Exact path match
        - Full URL match
        
        Args:
            linkedin_url: Normalized LinkedIn URL
            
        Returns:
            Tuple of (raw_document, age_in_days)
            Returns (None, 0) if not found
        """
        # Extract username from URL
        username_match = re.search(r'/in/([^/?]+)', linkedin_url)
        if not username_match:
            logger.warning(f"Could not extract username from URL: {linkedin_url}")
            return None, 0
        
        username = username_match.group(1).lower().strip()
        
        # Try multiple query patterns (LinkedIn URLs have many formats)
        query_patterns = [
            {"linkedin_url": {"$regex": f"/in/{username}/?$", "$options": "i"}},
            {"linkedin_url": f"/in/{username}/"},
            {"linkedin_url": f"/in/{username}"},
            {"linkedin_url": linkedin_url},
        ]
        
        for query in query_patterns:
            try:
                candidate = await self.db.profiles_collection.find_one(query)
                
                if candidate:
                    age_days = self._calculate_record_age_days(candidate)
                    return candidate, age_days
                    
            except Exception as e:
                logger.warning(f"DB query failed for pattern {query}: {e}")
                continue
        
        return None, 0


    def _calculate_record_age_days(self, document: Dict) -> int:
        """
        Calculate how old a database record is in days.
        
        Tries multiple timestamp sources:
        1. _scraped_at field (explicit timestamp)
        2. MongoDB ObjectId (embedded timestamp)
        
        Returns 0 if age cannot be determined (assumes fresh).
        """
        now = datetime.utcnow()
        
        # Method 1: Explicit timestamp field
        if "_scraped_at" in document:
            scraped_at = document["_scraped_at"]
            
            try:
                if isinstance(scraped_at, str):
                    # Handle ISO format with optional timezone
                    scraped_at = datetime.fromisoformat(
                        scraped_at.replace("Z", "+00:00")
                    )
                
                if isinstance(scraped_at, datetime):
                    # Remove timezone info for comparison
                    scraped_at = scraped_at.replace(tzinfo=None)
                    return (now - scraped_at).days
                    
            except (ValueError, TypeError) as e:
                logger.debug(f"Could not parse _scraped_at: {e}")
        
        # Method 2: ObjectId timestamp (MongoDB stores creation time in _id)
        if "_id" in document:
            try:
                from bson import ObjectId
                if isinstance(document["_id"], ObjectId):
                    creation_time = document["_id"].generation_time.replace(tzinfo=None)
                    return (now - creation_time).days
            except Exception as e:
                logger.debug(f"Could not extract ObjectId timestamp: {e}")
        
        # Default: Assume fresh if we can't determine age
        return 0


    # =============================================================================
    # DATA QUALITY ASSESSMENT
    # =============================================================================

    def _assess_data_quality(self, data: Dict) -> Dict:
        """
        Assess the completeness and quality of candidate data.
        
        Scoring System (100 points total):
        - Basic Info (name, headline): 20 points
        - Experience Quality: 50 points
        - Education: 15 points
        - About/Summary: 15 points
        
        Returns:
            {
                "score": 0-100,
                "is_complete": bool (score >= 60 and has valid experience),
                "needs_enrichment": bool (score < 40 or bad experience data),
                "issues": list of identified problems
            }
        """
        score = 0
        issues = []
        
        # --- BASIC INFO (20 points) ---
        has_name = bool(
            data.get("full_name") or 
            data.get("first_name") or 
            data.get("name")
        )
        if has_name:
            score += 10
        else:
            issues.append("missing_name")
        
        has_headline = bool(
            data.get("headline") or 
            data.get("title") or 
            data.get("position")
        )
        if has_headline:
            score += 10
        else:
            issues.append("missing_headline")
        
        # --- EXPERIENCE QUALITY (50 points) ---
        experiences = data.get("experience", [])
        valid_experience_count = 0
        
        if experiences:
            for exp in experiences:
                title = (exp.get("title") or "").strip()
                company = (exp.get("company") or "").strip()
                
                has_dates = bool(
                    exp.get("start_date") or 
                    exp.get("startDate") or 
                    exp.get("duration")
                )
                
                # Skip malformed Brightdata entries where title == company
                if title and company and title.lower() == company.lower():
                    continue
                
                # Valid if has both title and company
                if title and company:
                    valid_experience_count += 1
                # Partial credit if has company and dates
                elif company and has_dates:
                    valid_experience_count += 0.5
            
            # Max 50 points for 4+ valid experiences
            experience_score = min(50, valid_experience_count * 12.5)
            score += experience_score
            
            if valid_experience_count < 2:
                issues.append("insufficient_experience_data")
        else:
            issues.append("no_experience")
        
        # --- EDUCATION (15 points) ---
        education = data.get("education", [])
        if education:
            valid_edu_count = sum(
                1 for edu in education 
                if edu.get("school") or edu.get("campus") or edu.get("title")
            )
            score += min(15, valid_edu_count * 7.5)
        else:
            issues.append("no_education")
        
        # --- ABOUT/SUMMARY (15 points) ---
        about_text = data.get("about") or data.get("summary") or ""
        if about_text:
            # More text = more points (max at 300 chars)
            score += min(15, len(about_text) / 20)
        else:
            issues.append("no_summary")
        
        return {
            "score": int(score),
            "is_complete": score >= 60 and "insufficient_experience_data" not in issues,
            "needs_enrichment": score < 40 or "insufficient_experience_data" in issues,
            "issues": issues
        }


    # =============================================================================
    # BRIGHTDATA API OPERATIONS
    # =============================================================================

    async def _scrape_linkedin_dataset_api(self, linkedin_url: str) -> Optional[Dict]:
        """
        Fetch fresh LinkedIn profile data via Brightdata Dataset API.
        
        Uses the /scrape endpoint with synchronous response for single profiles.
        Results are cached in Redis for 24 hours to avoid redundant API calls.
        
        API Details:
        - Endpoint: /datasets/v3/scrape
        - Dataset: LinkedIn People Profile (gd_l1viktl72bvl7bjuj0)
        - Payload: {"input": [{"url": "..."}]}
        
        Returns:
            Normalized candidate data dict, or None on failure
        """
        cache_key = f"brightdata_scrape:{linkedin_url}"
        
        # Check Redis cache first (24 hour TTL)
        try:
            cached = await self.redis.get(cache_key)
            if cached:
                logger.debug("  Using cached Brightdata result (< 24h old)")
                return json.loads(cached)
        except Exception as e:
            logger.debug(f"  Redis cache check failed: {e}")
        
        # Make API request
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    f"{self.BRIGHTDATA_DATASETS_API}/scrape",
                    params={
                        "dataset_id": self.LINKEDIN_PROFILES_DATASET,
                        "include_errors": "true",
                        "format": "json"
                    },
                    headers={
                        "Authorization": f"Bearer {self.brightdata_key}",
                        "Content-Type": "application/json"
                    },
                    json={"input": [{"url": linkedin_url}]}
                )
                
                logger.debug(f"  Brightdata API status: {response.status_code}")
                
                # Handle different response types
                result = await self._handle_brightdata_response(response)
                
                if result:
                    # Normalize and cache
                    normalized = self._normalize_brightdata_response(result)
                    
                    try:
                        await self.redis.set(
                            cache_key, 
                            json.dumps(normalized), 
                            ex=86400  # 24 hours
                        )
                    except Exception as e:
                        logger.debug(f"  Redis cache write failed: {e}")
                    
                    return normalized
                    
        except httpx.TimeoutException:
            logger.error("  Brightdata API timeout (120s)")
        except Exception as e:
            logger.error(f"  Brightdata API error: {e}")
        
        return None


    async def _handle_brightdata_response(self, response: httpx.Response) -> Optional[Dict]:
        """
        Handle various Brightdata API response formats.
        
        Brightdata can return:
        - 200 with direct JSON result (list or dict)
        - 200/202 with snapshot_id for async polling
        - Error codes (400, 401, 402, 404)
        """
        if response.status_code == 200:
            data = response.json()
            
            # Async response - need to poll
            if isinstance(data, dict) and "snapshot_id" in data:
                logger.info(f"  Async response - polling snapshot: {data['snapshot_id']}")
                return await self._poll_brightdata_snapshot(data["snapshot_id"])
            
            # Direct list response
            if isinstance(data, list) and len(data) > 0:
                return data[0]
            
            # Direct dict response
            if isinstance(data, dict) and (data.get("name") or data.get("id")):
                return data
                
        elif response.status_code == 202:
            # Accepted for async processing
            data = response.json()
            if "snapshot_id" in data:
                logger.info(f"  Accepted (202) - polling snapshot: {data['snapshot_id']}")
                return await self._poll_brightdata_snapshot(data["snapshot_id"])
                
        elif response.status_code in [400, 401, 402, 404]:
            logger.warning(f"  Brightdata API error {response.status_code}: {response.text[:200]}")
        else:
            logger.warning(f"  Unexpected status {response.status_code}")
        
        return None


    async def _poll_brightdata_snapshot(
        self, 
        snapshot_id: str, 
        max_attempts: int = 30,
        poll_interval: float = 2.0
    ) -> Optional[Dict]:
        """
        Poll Brightdata for async scrape results.
        
        Some scrapes are processed asynchronously. This method polls
        the snapshot endpoint until results are ready or timeout.
        
        Args:
            snapshot_id: Brightdata snapshot identifier
            max_attempts: Maximum polling attempts (default 30 = ~60 seconds)
            poll_interval: Seconds between polls
            
        Returns:
            Raw profile data dict, or None on timeout/failure
        """
        for attempt in range(max_attempts):
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.get(
                        f"{self.BRIGHTDATA_DATASETS_API}/snapshot/{snapshot_id}",
                        headers={"Authorization": f"Bearer {self.brightdata_key}"},
                        params={"format": "json"}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Still processing
                        if isinstance(data, dict) and data.get("status") in ["running", "pending"]:
                            logger.debug(f"  Snapshot processing (attempt {attempt + 1}/{max_attempts})")
                            await asyncio.sleep(poll_interval)
                            continue
                        
                        # Got results
                        if isinstance(data, list) and len(data) > 0:
                            return data[0]
                        if isinstance(data, dict) and (data.get("name") or data.get("id")):
                            return data
                            
                    elif response.status_code == 202:
                        logger.debug(f"  Snapshot accepted, waiting (attempt {attempt + 1})")
                        await asyncio.sleep(poll_interval)
                        continue
                    else:
                        logger.warning(f"  Snapshot poll error: {response.status_code}")
                        break
                        
            except Exception as e:
                logger.error(f"  Snapshot poll exception: {e}")
                break
        
        logger.warning(f"  Snapshot polling exhausted after {max_attempts} attempts")
        return None


    # =============================================================================
    # DATA NORMALIZATION
    # =============================================================================

    def _normalize_brightdata_response(self, data: Dict) -> Dict:
        """
        Normalize raw Brightdata response to standard internal format.
        
        Key Transformations:
        1. Extract full_name from name or first_name + last_name
        2. Identify current company from header (authoritative source)
        3. Fix malformed experience entries (title == company bug)
        4. Calculate duration_months properly
        5. Force is_current=True for entries matching current_company header
        
        Args:
            data: Raw Brightdata API response
            
        Returns:
            Normalized candidate dict in standard schema
        """
        if not data:
            return {}
        
        # --- BASIC INFO ---
        full_name = data.get("name") or ""
        if not full_name:
            first = data.get("first_name", "") or ""
            last = data.get("last_name", "") or ""
            full_name = f"{first} {last}".strip()
        
        headline = data.get("position") or data.get("headline", "") or ""
        location = data.get("city") or data.get("location", "") or ""
        
        # --- CURRENT COMPANY (Authoritative Source) ---
        # Brightdata's current_company header is more reliable than experience entries
        current_company_name = self._extract_current_company_from_header(data)
        
        # --- EXPERIENCE NORMALIZATION ---
        experiences = self._normalize_brightdata_experiences(
            data.get("experience", []),
            current_company_name
        )
        
        # --- EDUCATION NORMALIZATION ---
        education = self._normalize_brightdata_education(
            data.get("educations_details") or data.get("education") or []
        )
        
        # --- PROFILE LINKS ---
        profile_links = self._extract_profile_links_from_bio(
            data.get("bio_links", [])
        )
        
        return {
            # Basic Info
            "full_name": full_name,
            "headline": headline,
            "current_company": current_company_name,
            "location": location,
            "country_code": data.get("country_code", ""),
            "about": data.get("about", "") or "",
            
            # Professional Data
            "experience": experiences,
            "education": education,
            "skills": data.get("skills", []) or [],
            "certifications": data.get("certifications", []) or [],
            
            # Additional Info
            "languages": data.get("languages", []) or [],
            "volunteer_experience": data.get("volunteer_experience", []) or [],
            "honors_awards": data.get("honors_and_awards", []) or [],
            "publications": data.get("publications", []) or [],
            "projects": data.get("projects", []) or [],
            "profile_links": profile_links,
            
            # LinkedIn Identifiers
            "linkedin_url": data.get("url") or data.get("input_url", ""),
            "linkedin_id": data.get("linkedin_id") or data.get("id", ""),
            
            # Social Metrics
            "connections": self._parse_number(data.get("connections", 0)),
            "followers": self._parse_number(data.get("followers", 0)),
            "open_to_work": data.get("open_to_work", False),
            
            # Visual Assets
            "avatar": data.get("avatar", ""),
            "banner_image": data.get("banner_image", ""),
            
            # Metadata
            "_source": "brightdata",
            "_scraped_at": datetime.utcnow().isoformat()
        }


    def _extract_current_company_from_header(self, data: Dict) -> str:
        """
        Extract current company name from Brightdata's header fields.
        
        This is more reliable than parsing experience entries because
        Brightdata explicitly provides current_company at the top level.
        """
        current_company_data = data.get("current_company")
        
        if isinstance(current_company_data, dict):
            return current_company_data.get("name", "") or ""
        elif isinstance(current_company_data, str):
            return current_company_data
        
        # Fallback to current_company_name field
        return data.get("current_company_name", "") or ""


    def _normalize_brightdata_experiences(
        self, 
        raw_experiences: List[Dict],
        current_company_name: str
    ) -> List[Dict]:
        """
        Normalize Brightdata experience entries.
        
        Handles common Brightdata quirks:
        1. title == company (malformed entry) - try to fix or skip
        2. Missing is_current flag - infer from current_company match
        3. Missing duration_months - calculate from dates
        4. Missing end_date for current roles - set to "Present"
        
        Args:
            raw_experiences: List of raw experience dicts from Brightdata
            current_company_name: Known current company (for is_current inference)
            
        Returns:
            List of normalized experience dicts
        """
        if not raw_experiences:
            return []
        
        normalized = []
        
        for exp in raw_experiences:
            if not isinstance(exp, dict):
                continue
            
            # Extract basic fields
            title = (exp.get("title") or "").strip()
            company = (exp.get("company") or "").strip()
            
            # Skip completely empty entries
            if not title and not company:
                continue
            
            # FIX: Brightdata sometimes puts company name in title field
            if title and company and title == company:
                # Try to get title from description
                description = self._strip_html(exp.get("description_html", ""))
                title = description[:50] if description else ""
                
                # If still no title, mark as generic
                if not title:
                    title = "Employee"
            
            # Extract dates
            start_date = (exp.get("start_date") or "").strip()
            end_date = (exp.get("end_date") or "").strip()
            
            # Determine if this is current role
            is_current = self._is_current_role(
                exp, company, current_company_name, end_date
            )
            
            # Set end_date to Present for current roles
            if is_current and not end_date:
                end_date = "Present"
            
            # Calculate duration
            duration_months = self._calculate_experience_duration(
                start_date, end_date, is_current
            )
            
            normalized.append({
                "title": title,
                "company": company,
                "company_logo_url": exp.get("company_logo_url", ""),
                "description": self._strip_html(exp.get("description_html", "") or exp.get("description", "")),
                "employment_type": exp.get("employment_type", ""),
                "location": exp.get("location", ""),
                "start_date": start_date,
                "end_date": end_date,
                "duration": exp.get("duration", ""),
                "duration_months": duration_months,
                "is_current": is_current
            })
        
        # Sort by recency (current first, then by year)
        normalized.sort(key=self._experience_sort_key, reverse=True)
        
        return normalized


    def _is_current_role(
        self, 
        exp: Dict, 
        company: str, 
        current_company_name: str,
        end_date: str
    ) -> bool:
        """
        Determine if an experience entry represents current employment.
        
        Uses multiple signals:
        1. Explicit is_current flag
        2. end_date contains "present"
        3. Company name matches current_company header
        """
        # Signal 1: Explicit flag
        if exp.get("is_current"):
            return True
        
        # Signal 2: End date indicates present
        if end_date and "present" in end_date.lower():
            return True
        
        # Signal 3: Company matches current_company header
        if current_company_name and company:
            header_lower = current_company_name.lower().strip()
            company_lower = company.lower().strip()
            
            # Fuzzy match (one contains the other)
            if header_lower in company_lower or company_lower in header_lower:
                return True
        
        return False


    def _calculate_experience_duration(
        self, 
        start_date: str, 
        end_date: str, 
        is_current: bool
    ) -> int:
        """
        Calculate experience duration in months.
        
        Handles various date formats:
        - "Sep 2022" (Month Year)
        - "2022" (Year only)
        - "Present" (use current date)
        
        Returns 0 if calculation fails.
        """
        if not start_date:
            return 0
        
        try:
            start_dt = self._parse_flexible_date(start_date)
            if not start_dt:
                return 0
            
            # End date
            if is_current or not end_date or "present" in end_date.lower():
                end_dt = datetime.utcnow()
            else:
                end_dt = self._parse_flexible_date(end_date)
                if not end_dt:
                    return 0
            
            # Calculate month difference
            months = (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month)
            
            # Minimum 1 month if dates are valid
            return max(1, months)
            
        except Exception:
            return 0


    def _parse_flexible_date(self, date_str: str) -> Optional[datetime]:
        """
        Parse various LinkedIn date formats.
        
        Supports:
        - "Sep 2022" / "September 2022"
        - "2022" (assumes January)
        - "01-09-2022" / "2022-09-01"
        """
        if not date_str:
            return None
        
        date_str = str(date_str).strip()
        
        # Skip "Present"
        if "present" in date_str.lower():
            return None
        
        # Try "Mon YYYY" format
        for fmt in ["%b %Y", "%B %Y"]:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # Try "YYYY" format
        try:
            return datetime.strptime(date_str, "%Y")
        except ValueError:
            pass
        
        # Try date with separators
        if "-" in date_str:
            parts = date_str.split("-")
            try:
                if len(parts) == 3:
                    if len(parts[0]) == 4:  # YYYY-MM-DD
                        return datetime(int(parts[0]), int(parts[1]), 1)
                    else:  # DD-MM-YYYY
                        return datetime(int(parts[2]), int(parts[1]), 1)
            except (ValueError, IndexError):
                pass
        
        return None


    def _experience_sort_key(self, exp: Dict) -> str:
        """
        Generate sort key for experience entries.
        Current roles sort first, then by start year descending.
        """
        if exp.get("is_current"):
            return "9999"
        
        start = exp.get("start_date", "") or ""
        year_match = re.search(r'(20\d{2}|19\d{2})', start)
        
        if year_match:
            return year_match.group(1)
        
        return "0000"


    def _normalize_brightdata_education(self, raw_education: List) -> List[Dict]:
        """Normalize Brightdata education entries."""
        if not raw_education or not isinstance(raw_education, list):
            return []
        
        normalized = []
        
        for edu in raw_education:
            if not isinstance(edu, dict):
                continue
            
            normalized.append({
                "school": edu.get("school") or edu.get("title") or edu.get("name", ""),
                "degree": edu.get("degree", ""),
                "field": edu.get("field_of_study") or edu.get("field", ""),
                "start_year": edu.get("start_year", ""),
                "end_year": edu.get("end_year", ""),
                "activities": edu.get("activities", "")
            })
        
        return normalized


    def _extract_profile_links_from_bio(self, bio_links: List) -> Dict:
        """Extract and categorize profile links from Brightdata bio_links."""
        if not bio_links:
            return {}
        
        links = {}
        other_links = []
        
        for link in bio_links:
            url = ""
            if isinstance(link, dict):
                url = link.get("url", "")
            elif isinstance(link, str):
                url = link
            
            if not url:
                continue
            
            # Categorize by domain
            url_lower = url.lower()
            
            if "github.com" in url_lower:
                links["github"] = url
            elif "twitter.com" in url_lower or "x.com" in url_lower:
                links["twitter"] = url
            elif "medium.com" in url_lower:
                links["medium"] = url
            elif "stackoverflow.com" in url_lower:
                links["stackoverflow"] = url
            elif "dribbble.com" in url_lower:
                links["dribbble"] = url
            elif "behance.net" in url_lower:
                links["behance"] = url
            else:
                other_links.append(url)
        
        if other_links:
            links["other"] = other_links
        
        return links


    def _normalize_db_response(self, data: Dict) -> Dict:
        """
        Normalize raw MongoDB document to standard internal format.
        
        DB documents have different field names (camelCase) and date formats
        (DD-MM-YYYY) that need to be converted to match Brightdata schema.
        """
        if not data:
            return {}
        
        # --- BASIC INFO ---
        full_name = ""
        if data.get("first_name") and data.get("last_name"):
            full_name = f"{data['first_name']} {data['last_name']}"
        elif data.get("name"):
            full_name = data["name"]
        
        # --- EXPERIENCE ---
        experiences = self._normalize_db_experiences(data.get("experience", []))
        
        # --- EDUCATION ---
        education = self._normalize_db_education(data.get("education", []))
        
        # --- SKILLS ---
        skills = []
        if isinstance(data.get("expertise"), str):
            skills = [s.strip().title() for s in data["expertise"].split(",") if s.strip()]
        elif isinstance(data.get("skills"), list):
            skills = data["skills"]
        
        return {
            # Basic Info
            "full_name": full_name,
            "headline": data.get("title", ""),
            "current_company": self._extract_current_company_from_experiences(experiences),
            "location": data.get("location", ""),
            "country_code": "IN" if "india" in str(data.get("country", "")).lower() else "",
            "about": data.get("summary", "") or "",
            
            # Professional Data
            "experience": experiences,
            "education": education,
            "skills": skills,
            "certifications": data.get("certifications", []),
            
            # Additional Info
            "languages": data.get("languages", []),
            "honors_awards": data.get("awards", []),
            "profile_links": {},
            
            # LinkedIn Identifiers
            "linkedin_url": data.get("linkedin_url", ""),
            "linkedin_id": str(data.get("_id", "")),
            
            # Defaults for fields not in DB
            "connections": 0,
            "followers": 0,
            "open_to_work": False,
            "avatar": "",
            "banner_image": "",
            
            # Metadata
            "_source": "database",
            "_scraped_at": data.get("_scraped_at", datetime.utcnow().isoformat())
        }


    def _normalize_db_experiences(self, raw_experiences: List[Dict]) -> List[Dict]:
        """Normalize database experience entries to standard format."""
        if not raw_experiences:
            return []
        
        normalized = []
        
        for exp in raw_experiences:
            if not isinstance(exp, dict):
                continue
            
            # Get dates (DB uses startDate/endDate camelCase)
            start_date_raw = exp.get("startDate") or exp.get("start_date", "")
            end_date_raw = exp.get("endDate") or exp.get("end_date", "")
            
            # Determine current status
            is_current = (
                exp.get("current") == 1 or 
                not end_date_raw or 
                str(end_date_raw).lower() == "present"
            )
            
            # Format dates to "Mon YYYY"
            start_date = self._format_db_date(start_date_raw)
            end_date = "Present" if is_current else self._format_db_date(end_date_raw)
            
            # Calculate duration
            duration_months = self._calculate_experience_duration(start_date, end_date, is_current)
            
            normalized.append({
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "company_url": exp.get("companyUrl") or exp.get("companyLinkedinUrl", ""),
                "company_logo_url": "",
                "description": exp.get("summary", ""),
                "employment_type": "",
                "location": exp.get("location", ""),
                "start_date": start_date,
                "end_date": end_date,
                "duration": "",
                "duration_months": duration_months,
                "is_current": is_current,
                "industry": exp.get("industry", "")
            })
        
        # Sort by recency
        normalized.sort(key=self._experience_sort_key, reverse=True)
        
        return normalized


    def _normalize_db_education(self, raw_education: List[Dict]) -> List[Dict]:
        """Normalize database education entries."""
        if not raw_education:
            return []
        
        normalized = []
        
        for edu in raw_education:
            if not isinstance(edu, dict):
                continue
            
            # Extract years from date strings
            start_year = ""
            end_year = ""
            
            start_date = edu.get("startDate", "")
            end_date = edu.get("endDate", "")
            
            if start_date:
                year_match = re.search(r'(19|20)\d{2}', str(start_date))
                if year_match:
                    start_year = year_match.group(0)
            
            if end_date:
                year_match = re.search(r'(19|20)\d{2}', str(end_date))
                if year_match:
                    end_year = year_match.group(0)
            
            normalized.append({
                "school": edu.get("campus") or edu.get("school", ""),
                "degree": edu.get("major") or edu.get("degree", ""),
                "field": edu.get("specialization") or edu.get("field", ""),
                "start_year": start_year,
                "end_year": end_year,
                "activities": ""
            })
        
        return normalized


    def _format_db_date(self, date_str: Any) -> str:
        """
        Convert DB date format (DD-MM-YYYY) to display format (Mon YYYY).
        Returns empty string if conversion fails.
        """
        if not date_str:
            return ""
        
        try:
            date_str = str(date_str).strip()
            
            if "-" not in date_str:
                return date_str
            
            parts = date_str.split("-")
            
            if len(parts) == 3:
                month_names = [
                    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                ]
                
                # Determine format: DD-MM-YYYY vs YYYY-MM-DD
                if len(parts[0]) == 4:  # YYYY-MM-DD
                    year = parts[0]
                    month = int(parts[1])
                else:  # DD-MM-YYYY
                    year = parts[2]
                    month = int(parts[1])
                
                if 1 <= month <= 12:
                    return f"{month_names[month]} {year}"
                    
        except (ValueError, IndexError):
            pass
        
        return str(date_str)


    def _extract_current_company_from_experiences(self, experiences: List[Dict]) -> str:
        """Extract current company from experience list."""
        for exp in experiences:
            if exp.get("is_current"):
                return exp.get("company", "")
        
        # Fallback to first entry
        if experiences:
            return experiences[0].get("company", "")
        
        return ""


    # =============================================================================
    # DATA MERGING
    # =============================================================================

    def _merge_candidate_data(self, brightdata: Dict, db_data: Dict) -> Dict:
        """
        Intelligently merge Brightdata and Database data.
        
        Merge Strategy:
        - Basic Info: Prefer Brightdata (more recent), fallback to DB
        - Current Company: Brightdata is authoritative (knows latest moves)
        - Experience: Merge both, dedupe, combine details
        - Skills: Union of both sources
        - Education: Prefer source with more entries
        - Other: Prefer non-empty values
        
        Args:
            brightdata: Normalized Brightdata data
            db_data: Normalized database data
            
        Returns:
            Merged candidate dict with best data from both sources
        """
        merged = {}
        
        # --- BASIC INFO (Brightdata wins if present) ---
        merged["full_name"] = brightdata.get("full_name") or db_data.get("full_name", "")
        merged["headline"] = brightdata.get("headline") or db_data.get("headline", "")
        merged["location"] = brightdata.get("location") or db_data.get("location", "")
        merged["country_code"] = brightdata.get("country_code") or db_data.get("country_code", "")
        merged["linkedin_url"] = brightdata.get("linkedin_url") or db_data.get("linkedin_url", "")
        merged["linkedin_id"] = brightdata.get("linkedin_id") or db_data.get("linkedin_id", "")
        
        # About: Prefer longer/more detailed version
        bd_about = brightdata.get("about", "") or ""
        db_about = db_data.get("about", "") or ""
        merged["about"] = bd_about if len(bd_about) >= len(db_about) else db_about
        
        # --- EXPERIENCE (Smart Merge) ---
        merged["experience"] = self._merge_experiences(
            brightdata.get("experience", []),
            db_data.get("experience", [])
        )
        
        # Current company: Brightdata is authoritative for current status
        merged["current_company"] = (
            brightdata.get("current_company") or 
            self._extract_current_company_from_experiences(merged["experience"])
        )
        
        # --- EDUCATION (Prefer more complete source) ---
        bd_edu = brightdata.get("education", [])
        db_edu = db_data.get("education", [])
        merged["education"] = db_edu if len(db_edu) >= len(bd_edu) else bd_edu
        
        # --- SKILLS (Union) ---
        bd_skills = set(str(s).lower() for s in brightdata.get("skills", []) if s)
        db_skills = set(str(s).lower() for s in db_data.get("skills", []) if s)
        all_skills = bd_skills | db_skills
        merged["skills"] = [s.title() for s in sorted(all_skills)]
        
        # --- OTHER FIELDS (Prefer non-empty) ---
        merged["certifications"] = brightdata.get("certifications") or db_data.get("certifications", [])
        merged["languages"] = brightdata.get("languages") or db_data.get("languages", [])
        merged["honors_awards"] = brightdata.get("honors_awards") or db_data.get("honors_awards", [])
        merged["volunteer_experience"] = brightdata.get("volunteer_experience") or db_data.get("volunteer_experience", [])
        merged["publications"] = brightdata.get("publications") or db_data.get("publications", [])
        merged["projects"] = brightdata.get("projects") or db_data.get("projects", [])
        
        # Profile links: Merge both
        merged["profile_links"] = {
            **db_data.get("profile_links", {}),
            **brightdata.get("profile_links", {})
        }
        
        # Social metrics from Brightdata (more recent)
        merged["connections"] = brightdata.get("connections") or db_data.get("connections", 0)
        merged["followers"] = brightdata.get("followers") or db_data.get("followers", 0)
        merged["open_to_work"] = brightdata.get("open_to_work", False)
        merged["avatar"] = brightdata.get("avatar", "")
        merged["banner_image"] = brightdata.get("banner_image", "")
        
        # --- METADATA ---
        merged["_source"] = "merged"
        merged["_brightdata_at"] = brightdata.get("_scraped_at")
        merged["_db_at"] = db_data.get("_scraped_at")
        merged["_scraped_at"] = datetime.utcnow().isoformat()
        
        return merged


    def _merge_experiences(
        self, 
        brightdata_exp: List[Dict], 
        db_exp: List[Dict]
    ) -> List[Dict]:
        """
        Merge experience lists from Brightdata and Database.
        
        Strategy:
        1. Match entries by company name (fuzzy matching)
        2. For matched entries: Merge fields, prefer detailed values
        3. Handle Brightdata quirks (title==company entries)
        4. Add unmatched entries from both sources
        5. Dedupe and sort by recency
        
        Args:
            brightdata_exp: Experience list from Brightdata
            db_exp: Experience list from Database
            
        Returns:
            Merged, deduplicated, sorted experience list
        """
        merged = []
        used_db_indices = set()
        
        # Process each Brightdata entry
        for bd_entry in brightdata_exp:
            bd_company = (bd_entry.get("company") or "").lower().strip()
            bd_title = (bd_entry.get("title") or "").lower().strip()
            
            # Skip completely empty entries
            if not bd_company and not bd_title:
                continue
            
            # Handle malformed entries (title == company)
            if bd_company and bd_title and bd_company == bd_title:
                # Try to find matching DB entry to get real title
                for i, db_entry in enumerate(db_exp):
                    if i in used_db_indices:
                        continue
                        
                    db_company = (db_entry.get("company") or "").lower().strip()
                    
                    if self._companies_match(bd_company, db_company):
                        # Use DB entry which has proper title
                        merged.append(db_entry)
                        used_db_indices.add(i)
                        break
                continue
            
            # Find matching DB entry
            match_found = False
            for i, db_entry in enumerate(db_exp):
                if i in used_db_indices:
                    continue
                
                db_company = (db_entry.get("company") or "").lower().strip()
                
                if self._companies_match(bd_company, db_company):
                    # Merge the two entries
                    merged_entry = self._merge_single_experience(bd_entry, db_entry)
                    merged.append(merged_entry)
                    used_db_indices.add(i)
                    match_found = True
                    break
            
            # No match - add Brightdata entry if it has valid data
            if not match_found and bd_entry.get("title") and bd_entry.get("company"):
                merged.append(bd_entry)
        
        # Add remaining unmatched DB entries
        for i, db_entry in enumerate(db_exp):
            if i not in used_db_indices:
                if db_entry.get("title") and db_entry.get("company"):
                    merged.append(db_entry)
        
        # Sort by recency (current first, then by year)
        merged.sort(key=self._experience_sort_key, reverse=True)
        
        return merged


    def _companies_match(self, company1: str, company2: str) -> bool:
        """
        Check if two company names match using fuzzy logic.
        
        Handles:
        - Exact matches
        - Substring matches (one contains the other)
        - Common suffix variations (Ltd, Inc, Pvt, etc.)
        - First word matches for compound names
        """
        if not company1 or not company2:
            return False
        
        c1 = company1.lower().strip()
        c2 = company2.lower().strip()
        
        # Exact match
        if c1 == c2:
            return True
        
        # Substring match
        if c1 in c2 or c2 in c1:
            return True
        
        # Remove common suffixes
        suffixes = [
            " ltd", " limited", " pvt", " private", 
            " inc", " llc", " llp", " corp", " corporation",
            " co", " company", " services", " technologies"
        ]
        
        c1_clean = c1
        c2_clean = c2
        
        for suffix in suffixes:
            c1_clean = c1_clean.replace(suffix, "")
            c2_clean = c2_clean.replace(suffix, "")
        
        if c1_clean == c2_clean:
            return True
        
        # First word match (for "Northern Arc Capital" vs "Northern Arc")
        c1_words = [w for w in c1.split() if len(w) > 2]
        c2_words = [w for w in c2.split() if len(w) > 2]
        
        if c1_words and c2_words:
            # Match first 1-2 significant words
            if c1_words[0] == c2_words[0]:
                return True
        
        return False


    def _merge_single_experience(self, bd_exp: Dict, db_exp: Dict) -> Dict:
        """
        Merge a single experience entry from both sources.
        
        Priority:
        - Description: DB (usually more detailed)
        - Dates/Duration: Whichever has data
        - is_current: Brightdata (more recent status)
        - Other: Prefer non-empty
        """
        return {
            "title": bd_exp.get("title") or db_exp.get("title", ""),
            "company": bd_exp.get("company") or db_exp.get("company", ""),
            "company_url": bd_exp.get("company_url") or db_exp.get("company_url", ""),
            "company_logo_url": bd_exp.get("company_logo_url", ""),
            
            # DB usually has better descriptions
            "description": db_exp.get("description") or bd_exp.get("description", ""),
            
            "employment_type": bd_exp.get("employment_type") or db_exp.get("employment_type", ""),
            "location": bd_exp.get("location") or db_exp.get("location", ""),
            
            # Dates: prefer whichever has data
            "start_date": bd_exp.get("start_date") or db_exp.get("start_date", ""),
            "end_date": bd_exp.get("end_date") or db_exp.get("end_date", ""),
            "duration": bd_exp.get("duration") or db_exp.get("duration", ""),
            "duration_months": bd_exp.get("duration_months") or db_exp.get("duration_months", 0),
            
            # Brightdata is authoritative for current status
            "is_current": bd_exp.get("is_current") or db_exp.get("is_current", False),
            
            # Industry usually only in DB
            "industry": db_exp.get("industry", "")
        }


    # =============================================================================
    # FALLBACK: WEB SEARCH ENRICHMENT
    # =============================================================================

    async def _enrich_incomplete_profile(
        self, 
        partial_data: Dict, 
        linkedin_url: str
    ) -> Dict:
        """
        Enrich sparse profile data using web search.
        
        Used when Brightdata returns incomplete data (e.g., experience entries
        without titles/companies). Searches web for complete work history.
        
        Args:
            partial_data: Incomplete candidate data dict
            linkedin_url: LinkedIn profile URL for search context
            
        Returns:
            Enriched candidate data dict
        """
        name = partial_data.get("full_name", "")
        about = partial_data.get("about", "")
        current_company = partial_data.get("current_company", "")
        
        logger.info(f"Enriching incomplete profile for: {name}")
        
        prompt = f"""Search for complete professional history of this LinkedIn profile.

    NAME: {name}
    LINKEDIN URL: {linkedin_url}
    CURRENT COMPANY: {current_company}
    ABOUT: {about[:500] if about else "Not available"}

    Find their complete work history from LinkedIn, company websites, and news.

    Return JSON:
    {{
        "experience": [
            {{
                "title": "Exact job title",
                "company": "Company name",
                "employment_type": "Full-time|Internship|Contract",
                "start_date": "Mon YYYY",
                "end_date": "Mon YYYY or Present",
                "duration_months": 12,
                "description": "Brief role description if found",
                "is_current": true|false
            }}
        ],
        "education": [
            {{
                "school": "School name",
                "degree": "Degree type",
                "field": "Field of study",
                "end_year": "YYYY"
            }}
        ],
        "headline": "Professional headline",
        "total_experience_years": 4.5,
        "sources_found": ["LinkedIn", "Company website", etc.]
    }}

    Be thorough - search LinkedIn profile, company pages, news articles."""

        try:
            response = await self._call_llm(
                prompt,
                model=self.llm_config["search"],
                temperature=0.2,
                max_tokens=3000
            )
            enriched = self._extract_json(response)
            
            # Merge enriched data into partial data
            if enriched.get("experience"):
                partial_data["experience"] = enriched["experience"]
            
            if enriched.get("education") and not partial_data.get("education"):
                partial_data["education"] = enriched["education"]
            
            if enriched.get("headline") and not partial_data.get("headline"):
                partial_data["headline"] = enriched["headline"]
            
            partial_data["_enriched"] = True
            partial_data["_enrichment_sources"] = enriched.get("sources_found", [])
            
            logger.info(f"Enrichment complete. Experience entries: {len(partial_data.get('experience', []))}")
            
        except Exception as e:
            logger.error(f"Profile enrichment failed: {e}")
        
        return partial_data


    async def _scrape_perplexity_comprehensive(self, linkedin_url: str) -> Optional[Dict]:
        """
        Use Perplexity web search as last resort for profile data.
        
        When both database and Brightdata fail, attempt to gather
        profile information from web search results.
        """
        # Extract name hint from URL
        username = re.search(r'/in/([^/?]+)', linkedin_url)
        name_hint = username.group(1).replace("-", " ").title() if username else ""
        
        prompt = f"""Search comprehensively for information about this LinkedIn profile.

    LinkedIn URL: {linkedin_url}
    Name hint: {name_hint}

    Find:
    1. Their LinkedIn profile details
    2. Current role and company
    3. Work history
    4. Education
    5. Any professional presence (GitHub, blogs, news mentions)

    Return JSON:
    {{
        "full_name": "Full name",
        "headline": "Professional headline",
        "current_company": "Current employer",
        "location": "Location",
        "about": "Professional summary",
        
        "experience": [
            {{
                "title": "Job title",
                "company": "Company",
                "start_date": "Mon YYYY",
                "end_date": "Mon YYYY or Present",
                "duration_months": 12,
                "is_current": true|false
            }}
        ],
        
        "education": [
            {{
                "school": "School",
                "degree": "Degree",
                "field": "Field"
            }}
        ],
        
        "skills": ["Skills found"],
        "data_sources": ["Sources used"],
        "data_freshness": "How recent is this data"
    }}

    Be thorough - search multiple sources."""

        try:
            response = await self._call_llm(
                prompt,
                model=self.llm_config["search"],
                temperature=0.2
            )
            result = self._extract_json(response)
            
            if result:
                result["_source"] = "web_search"
                result["_scraped_at"] = datetime.utcnow().isoformat()
            
            return result
            
        except Exception as e:
            logger.error(f"Perplexity search failed: {e}")
            return None


    # =============================================================================
    # UTILITY METHODS
    # =============================================================================

    def _strip_html(self, html_str: str) -> str:
        """Remove HTML tags and clean whitespace."""
        if not html_str:
            return ""
        
        # Remove HTML tags
        clean = re.sub(r'<[^>]+>', ' ', str(html_str))
        
        # Normalize whitespace
        clean = re.sub(r'\s+', ' ', clean).strip()
        
        return clean


    def _parse_number(self, value: Any) -> int:
        """Parse numeric value from various formats."""
        if isinstance(value, int):
            return value
        
        if isinstance(value, str):
            # Remove non-digits
            digits = re.sub(r'[^\d]', '', value)
            return int(digits) if digits else 0
        
        return 0


    def _normalize_linkedin_url(self, url: str) -> str:
        """Normalize LinkedIn URL to consistent format."""
        url = str(url).strip()
        
        # Add https if missing
        if not url.startswith("http"):
            url = "https://" + url
        
        # Ensure www subdomain
        if "://linkedin.com" in url:
            url = url.replace("://linkedin.com", "://www.linkedin.com")
        
        # Remove trailing slash
        url = url.rstrip("/")
        
        # Remove query parameters
        if "?" in url:
            url = url.split("?")[0]
        
        return url

    # =========================================================================
    # STEP 3: CLASSIFY EXPERIENCES
    # =========================================================================
    
    async def _classify_all_experiences(self, raw_candidate: Dict) -> List[Dict]:
        """
        Classify EACH experience as professional/intern/volunteer/student/etc.
        
        This is CRITICAL for accurate experience calculation.
        """
        experiences = raw_candidate.get("experience", [])
        
        if not experiences:
            return []
        
        # Build experience list for LLM
        exp_list = []
        for i, exp in enumerate(experiences):
            exp_list.append({
                "index": i,
                "title": exp.get("title", ""),
                "company": exp.get("company", ""),
                "employment_type": exp.get("employment_type", ""),
                "duration": exp.get("duration", exp.get("duration_months", "")),
                "start_date": exp.get("start_date", ""),
                "end_date": exp.get("end_date", ""),
                "description": exp.get("description", "")[:200] if exp.get("description") else ""
            })
        
        prompt = f"""Classify each of these experiences into the correct category.

EXPERIENCES:
{json.dumps(exp_list, indent=2)}

For EACH experience, determine:
1. experience_type: One of:
   - "professional": Full-time paid job at a REAL company
   - "internship": Paid internship at a REAL company
   - "freelance": Verified freelance work with actual clients
   - "founder": Founded a REAL company (not just a personal project)
   - "self_employed": Personal projects, side hustles without verifiable clients
   - "volunteer": Unpaid volunteer work at any organization
   - "student": Student ambassador, student club, student organization activity
   - "open_source": Open source contributions (GSoC, Outreachy, etc.) - valuable but not employment

2. company_status: One of:
   - "verified_company": Real company with employees and operations
   - "startup_unverified": Claims to be a startup but cannot verify
   - "personal_project": Likely a personal project, not a real company
   - "student_org": Student organization (like Microsoft Student Ambassador, Google DSC)
   - "volunteer_org": Volunteer/non-profit organization
   - "open_source_program": Like Google Summer of Code, etc.

3. is_paid: true if likely paid position, false if unpaid
4. counts_as_experience: true ONLY for professional/internship roles at real companies
5. experience_weight: 
   - 1.0 for professional full-time
   - 0.5 for internships
   - 0.25 for relevant freelance
   - 0.0 for student/volunteer/personal projects
6. duration_months: Estimate the number of months (as integer). If duration says "1 yr 2 mos", return 14. If unclear, estimate conservatively.

CLASSIFICATION RULES:
- "Microsoft Learn Student Ambassador" = student activity, NOT professional
- "Self-employed" or building personal project = self_employed, NOT professional
- "Google Summer of Code" = open_source program, valuable but NOT employment
- "Volunteer" roles = volunteer, NOT professional
- "Founder" of something without funding/employees = likely self_employed/personal_project
- Actual jobs at TCS, Infosys, Google, startups with funding = professional

Return JSON array:
[
    {{
        "index": 0,
        "title": "Job title",
        "company": "Company",
        "experience_type": "professional|internship|freelance|founder|self_employed|volunteer|student|open_source",
        "company_status": "verified_company|startup_unverified|personal_project|student_org|volunteer_org|open_source_program",
        "is_paid": true|false,
        "counts_as_experience": true|false,
        "experience_weight": 1.0|0.5|0.25|0.0,
        "duration_months": 12,
        "reasoning": "Why this classification"
    }}
]"""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["classification"], temperature=0.2)
            classifications = self._extract_json(response)
            
            # Merge classifications back with original data
            classified = []
            for i, orig_exp in enumerate(experiences):
                classification = next(
                    (c for c in classifications if c.get("index") == i),
                    {
                        "experience_type": "unknown", 
                        "counts_as_experience": False, 
                        "experience_weight": 0,
                        "duration_months": 0
                    }
                )
                
                merged = {**orig_exp, **classification}
                classified.append(merged)
            
            return classified
            
        except Exception as e:
            logger.error(f"Experience classification failed: {e}")
            # Return original with unknown classification
            return [
                {
                    **exp, 
                    "experience_type": "unknown", 
                    "counts_as_experience": False,
                    "experience_weight": 0,
                    "duration_months": 0
                } 
                for exp in experiences
            ]
    
    def _calculate_real_experience(self, classified_experiences: List[Dict]) -> Dict:
        """
        Calculate REAL industry experience.
        
        Only counts:
        - Professional full-time: 100%
        - Internships: 50%
        - Freelance (if verified): 25%
        
        Does NOT count:
        - Student activities
        - Volunteer work
        - Personal projects
        - Self-employed without clients
        """
        total_months = 0
        professional_count = 0
        internship_count = 0
        non_professional_count = 0
        
        for exp in classified_experiences:
            # FIXED: Handle None values for weight and duration
            weight = exp.get("experience_weight")
            if weight is None:
                weight = 0.0
            
            duration = exp.get("duration_months")
            
            # FIXED: Handle None or string duration
            if duration is None:
                # Try to parse from duration string
                duration_str = exp.get("duration", "")
                duration = self._parse_duration_to_months(duration_str)
            elif isinstance(duration, str):
                duration = self._parse_duration_to_months(duration)
            
            # Ensure both are numbers
            try:
                weight = float(weight)
                duration = int(duration) if duration else 0
            except (ValueError, TypeError):
                weight = 0.0
                duration = 0
            
            # Apply weight
            weighted_months = duration * weight
            total_months += weighted_months
            
            # Count by type
            exp_type = exp.get("experience_type", "unknown")
            if exp_type == "professional":
                professional_count += 1
            elif exp_type == "internship":
                internship_count += 1
            else:
                non_professional_count += 1
        
        return {
            "total_months": total_months,
            "total_years": round(total_months / 12, 1) if total_months > 0 else 0,
            "professional_count": professional_count,
            "internship_count": internship_count,
            "non_professional_count": non_professional_count,
            "has_real_experience": professional_count > 0 or internship_count > 0
        }
    
    # =========================================================================
    # STEP 4: EXTRACT PROFILE LINKS
    # =========================================================================
    
    @warnings.deprecated("use _discover_professional_footprint instead")
    def _extract_profile_links(self, raw_candidate: Dict) -> Dict[str, str]:
        """
        Extract all profile links (GitHub, portfolio, etc.).
        
        These are crucial for skill validation.
        """
        links = {}
        
        # Check profile_links field
        profile_links = raw_candidate.get("profile_links", {})
        if isinstance(profile_links, dict):
            for key, value in profile_links.items():
                if value and value != "null":
                    links[key] = value
        
        # Check for common patterns in about/summary
        about = raw_candidate.get("about", "") or raw_candidate.get("summary", "") or ""
        
        # GitHub pattern
        github_match = re.search(r'github\.com/([a-zA-Z0-9_-]+)', about)
        if github_match and "github" not in links:
            links["github"] = f"https://github.com/{github_match.group(1)}"
        
        # Portfolio/website pattern
        website_match = re.search(r'https?://(?:www\.)?([a-zA-Z0-9_-]+\.[a-zA-Z]{2,})', about)
        if website_match and "portfolio" not in links:
            links["portfolio"] = website_match.group(0)
        
        # LinkedIn URL
        links["linkedin"] = raw_candidate.get("linkedin_url", raw_candidate.get("url", ""))
        
        return links
    
    async def _discover_professional_footprint(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> Dict[str, Any]:
        """
        Discover comprehensive professional footprint using web search.
        
        This is role-aware and searches for different evidence types
        based on the target role.
        
        Returns:
            {
                "verified_profiles": [...],  # Confirmed same person
                "possible_profiles": [...],  # Might be same person
                "evidence_found": [...],     # Role-specific evidence
                "news_mentions": [...],
                "publications": [...],
                "identity_confidence": 0-100
            }
        """
        name = candidate.get("full_name", "")
        current_company = candidate.get("current_company", "")
        location = candidate.get("location", "")
        headline = candidate.get("headline", "")
        linkedin_url = candidate.get("linkedin_url", "")
        role_type = plan.role_type
        
        # Get LinkedIn-provided links first
        linkedin_links = self._extract_linkedin_provided_links(candidate)
        
        # Build search context for identity verification
        identity_context = {
            "name": name,
            "current_company": current_company,
            "location": location,
            "headline": headline,
            "linkedin_url": linkedin_url,
            "past_companies": [
                exp.get("company", "") 
                for exp in candidate.get("experience", [])[:3]
            ],
            "education": [
                edu.get("school", "") 
                for edu in candidate.get("education", [])[:2]
            ]
        }
        
        # Get role-specific evidence priorities
        evidence_priorities = self.ROLE_EVIDENCE_PRIORITIES.get(
            role_type, 
            self.ROLE_EVIDENCE_PRIORITIES["other"]
        )
        
        # Run comprehensive web search
        prompt = f"""Search comprehensively for professional information about this person.

    IDENTITY CONTEXT (use this to verify it's the same person):
    {json.dumps(identity_context, indent=2)}

    LINKEDIN-PROVIDED LINKS (already known):
    {json.dumps(linkedin_links, indent=2)}

    TARGET ROLE TYPE: {role_type}
    EVIDENCE TYPES TO PRIORITIZE: {[e.value for e in evidence_priorities]}

    SEARCH STRATEGY:
    1. Search for "{name}" + "{current_company}" to find news/mentions
    2. Search for "{name}" + specific platforms based on role:
    - Tech: GitHub, StackOverflow, dev.to, Medium tech
    - Sales: LinkedIn posts about deals, President's Club, quota
    - Marketing: Case studies, AdWeek, MarketingWeek, campaigns
    - Product: Product Hunt, ProductBoard, conferences
    - Finance: CFA verification, publications, regulatory
    - HR: SHRM, speaking engagements, HR publications
    - Design: Dribbble, Behance, Awwwards
    3. Search for publications, patents, speaking engagements
    4. Search for news mentions, company announcements
    5. Search for certifications, awards

    For EACH result found, assess:
    - Is this definitely the same person? (compare company, education, location)
    - What evidence does this provide?
    - How recent is this information?

    Return JSON:
    {{
        "verified_profiles": [
            {{
                "platform": "GitHub",
                "url": "https://github.com/username",
                "username": "username",
                "identity_confidence": 95,
                "identity_match_reasons": ["Same company in bio", "Location matches"],
                "profile_quality": "Active contributor with real projects",
                "last_activity": "2024-12",
                "key_data": {{
                    "repos": 25,
                    "followers": 100,
                    "top_languages": ["Python", "JavaScript"]
                }}
            }}
        ],
        
        "possible_profiles": [
            {{
                "platform": "Medium",
                "url": "https://medium.com/@username",
                "identity_confidence": 60,
                "uncertainty_reason": "Common name, couldn't verify company"
            }}
        ],
        
        "evidence_found": [
            {{
                "evidence_type": "quota_achievement|campaign_case_study|open_source|etc",
                "source": "LinkedIn post|News article|Company blog|etc",
                "url": "URL to evidence",
                "description": "What was found",
                "relevance_to_role": "How this relates to the target role",
                "date": "When this occurred",
                "identity_confidence": 90,
                "strength": "strong|moderate|weak"
            }}
        ],
        
        "news_mentions": [
            {{
                "title": "Article title",
                "source": "Publication name",
                "url": "URL",
                "date": "Publication date",
                "context": "What the mention was about",
                "sentiment": "positive|neutral|negative"
            }}
        ],
        
        "publications": [
            {{
                "title": "Publication/patent/paper title",
                "type": "blog|paper|patent|book",
                "url": "URL",
                "date": "Date",
                "relevance": "How relevant to the role"
            }}
        ],
        
        "certifications_verified": [
            {{
                "certification": "AWS Solutions Architect",
                "issuer": "Amazon",
                "verification_url": "URL if verifiable",
                "verified": true|false,
                "verification_method": "How verified"
            }}
        ],
        
        "speaking_engagements": [
            {{
                "event": "Event name",
                "topic": "Talk topic",
                "date": "Date",
                "url": "Recording/slides URL if available"
            }}
        ],
        
        "overall_footprint_assessment": {{
            "digital_presence_score": 75,
            "presence_level": "Strong|Moderate|Limited|Minimal",
            "key_platforms": ["GitHub", "LinkedIn"],
            "evidence_strength_for_role": "How well evidence supports the role fit",
            "notable_findings": ["Key interesting findings"],
            "red_flags": ["Any concerns found"],
            "data_freshness": "Most recent evidence from X"
        }},
        
        "identity_verification": {{
            "overall_confidence": 85,
            "verification_method": "How identity was verified across sources",
            "matching_data_points": ["Company", "Education", "Location"],
            "potential_issues": ["Any identity uncertainty"]
        }},
        
        "search_coverage": {{
            "searches_performed": ["List of searches done"],
            "platforms_checked": ["List of platforms checked"],
            "limitations": ["Any limitations in the search"]
        }}
    }}

    BE THOROUGH: Search multiple sources. For sales roles, look for quota achievements, deals, awards.
    For marketing, look for campaigns, case studies. For tech, look for code and contributions.
    VERIFY IDENTITY: Don't just find profiles - confirm they belong to this person."""

        try:
            response = await self._call_llm(
                prompt, 
                model=self.llm_config["search"],  # Best for web search
                temperature=0.2,
                max_tokens=6000
            )
            footprint_data = self._extract_json(response)
            
            # Merge with LinkedIn-provided links
            footprint_data["linkedin_provided_links"] = linkedin_links
            
            return footprint_data
            
        except Exception as e:
            logger.error(f"Professional footprint discovery failed: {e}")
            return {
                "verified_profiles": [],
                "possible_profiles": [],
                "evidence_found": [],
                "news_mentions": [],
                "publications": [],
                "overall_footprint_assessment": {
                    "digital_presence_score": 0,
                    "presence_level": "Unknown",
                    "error": str(e)
                },
                "linkedin_provided_links": linkedin_links
            }


    def _extract_linkedin_provided_links(self, candidate: Dict) -> Dict[str, Any]:
        """
        Extract links that LinkedIn itself provides.
        
        LinkedIn has structured fields for:
        - Website URLs (bio_links)
        - Contact info
        - Projects with URLs
        - Publications with URLs
        - Certifications (some have verification URLs)
        """
        links = {
            "websites": [],
            "social_profiles": {},
            "project_links": [],
            "publication_links": [],
            "certification_links": []
        }
        
        # Bio links (LinkedIn's structured external links)
        bio_links = candidate.get("bio_links", []) or candidate.get("profile_links", {})
        if isinstance(bio_links, list):
            for link in bio_links:
                url = link.get("url", "") if isinstance(link, dict) else str(link)
                if not url:
                    continue
                
                # Categorize
                if "github.com" in url:
                    links["social_profiles"]["github"] = url
                elif "twitter.com" in url or "x.com" in url:
                    links["social_profiles"]["twitter"] = url
                elif "medium.com" in url:
                    links["social_profiles"]["medium"] = url
                elif "stackoverflow.com" in url:
                    links["social_profiles"]["stackoverflow"] = url
                elif "dribbble.com" in url:
                    links["social_profiles"]["dribbble"] = url
                elif "behance.net" in url:
                    links["social_profiles"]["behance"] = url
                else:
                    links["websites"].append(url)
        
        elif isinstance(bio_links, dict):
            links["social_profiles"] = bio_links
        
        # Projects with URLs
        projects = candidate.get("projects", []) or []
        for project in projects:
            if isinstance(project, dict) and project.get("url"):
                links["project_links"].append({
                    "name": project.get("name", ""),
                    "url": project.get("url", ""),
                    "description": project.get("description", "")
                })
        
        # Publications
        publications = candidate.get("publications", []) or []
        for pub in publications:
            if isinstance(pub, dict) and pub.get("url"):
                links["publication_links"].append({
                    "title": pub.get("title", ""),
                    "url": pub.get("url", ""),
                    "publisher": pub.get("publisher", "")
                })
        
        # Extract from about section
        about = candidate.get("about", "") or ""
        
        # Common patterns in about
        url_patterns = [
            (r'github\.com/([a-zA-Z0-9_-]+)', "github"),
            (r'linkedin\.com/in/([a-zA-Z0-9_-]+)', "linkedin"),
            (r'twitter\.com/([a-zA-Z0-9_]+)', "twitter"),
            (r'medium\.com/@?([a-zA-Z0-9_.-]+)', "medium"),
            (r'dribbble\.com/([a-zA-Z0-9_-]+)', "dribbble"),
            (r'behance\.net/([a-zA-Z0-9_-]+)', "behance"),
            (r'stackoverflow\.com/users/(\d+)', "stackoverflow"),
        ]
        
        for pattern, platform in url_patterns:
            match = re.search(pattern, about, re.IGNORECASE)
            if match and platform not in links["social_profiles"]:
                if platform == "stackoverflow":
                    links["social_profiles"][platform] = f"https://stackoverflow.com/users/{match.group(1)}"
                else:
                    links["social_profiles"][platform] = f"https://{platform}.com/{match.group(1)}"
        
        # General URL extraction from about
        general_urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', about)
        for url in general_urls:
            url = url.rstrip('.,;:')
            if url not in links["websites"] and not any(url in str(v) for v in links["social_profiles"].values()):
                links["websites"].append(url)
        
        return links
    
    
    # =========================================================================
    # STEP 5: BUILD HONEST CANDIDATE PROFILE
    # =========================================================================
    
    def _build_honest_candidate_profile(
        self,
        raw: Dict,
        classified_experiences: List[Dict],
        real_experience: Dict,
        profile_links: Dict,
        data_source: str
    ) -> Dict:
        """
        Build normalized candidate profile with HONEST data.
        
        Key differences from V1:
        - Includes experience classification
        - Shows REAL vs total experience
        - Flags data quality/freshness
        """
        return {
            "full_name": raw.get("full_name") or raw.get("name") or "Unknown",
            "headline": raw.get("headline") or raw.get("title") or "",
            "current_company": raw.get("current_company") or "",
            "location": raw.get("location") or "",
            "about": raw.get("about") or raw.get("summary") or "",
            
            # Experience with classifications
            "experience": classified_experiences,
            "experience_summary": {
                "total_roles": len(classified_experiences),
                "professional_roles": real_experience["professional_count"],
                "internships": real_experience["internship_count"],
                "other_activities": real_experience["non_professional_count"],
                "real_experience_years": real_experience["total_years"],
                "has_industry_experience": real_experience["has_real_experience"]
            },
            
            "education": raw.get("education", []),
            "skills": raw.get("skills", []),
            "certifications": raw.get("certifications", []),
            
            # Profile links for skill validation
            "profile_links": profile_links,
            
            # Metadata
            "linkedin_url": raw.get("linkedin_url") or raw.get("url") or "",
            "connections": self._parse_number(raw.get("connections", 0)),
            "open_to_work": raw.get("open_to_work", False),
            
            # Data quality flags
            "_data_source": data_source,
            "_data_freshness": "fresh" if "fresh" in data_source else "potentially_stale",
            "_scraped_at": datetime.utcnow().isoformat()
        }
    
    # =========================================================================
    # STEP 6: VERIFIED ENRICHMENT
    # =========================================================================
    
    @warnings.deprecated("Use _execute_verified_enrichment_v2 instead")
    async def _execute_verified_enrichment(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        classified_experiences: List[Dict],
        profile_links: Dict
    ) -> Dict[str, Any]:
        """
        Execute enrichment with VERIFICATION.
        
        Key changes:
        - Skills: Check actual GitHub, portfolio
        - Salary: Only estimate for VERIFIED paid roles
        - Response: Consider if student/employed
        """
        tasks = {
            "skills": self._validate_skills_with_evidence(candidate, plan, profile_links),
            "salary": self._estimate_salary_verified(candidate, plan, classified_experiences),
            "response": self._calculate_response_likelihood_honest(candidate, plan),
            "notice": self._estimate_notice_period_honest(candidate, plan, classified_experiences)
        }
        
        results = {}
        task_list = list(tasks.items())
        completed = await asyncio.gather(*[t[1] for t in task_list], return_exceptions=True)
        
        for (name, _), result in zip(task_list, completed):
            if isinstance(result, Exception):
                logger.error(f"   Enrichment '{name}' failed: {result}")
                results[name] = None
            else:
                results[name] = result
        
        return results
    
    async def _execute_verified_enrichment_v2(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        classified_experiences: List[Dict],
        professional_footprint: Dict  # Changed from profile_links
    ) -> Dict[str, Any]:
        """
        Execute enrichment with professional footprint data.
        
        V2 Changes:
        - Uses comprehensive footprint data for all enrichment
        - Role-aware skill validation
        - Better evidence integration
        """
        tasks = {
            "skills": self._validate_skills_with_evidence(
                candidate, plan, professional_footprint
            ),
            "salary": self._estimate_salary_verified(
                candidate, plan, classified_experiences
            ),
            "response": self._calculate_response_likelihood_v2(
                candidate, plan, professional_footprint
            ),
            "notice": self._estimate_notice_period_honest(
                candidate, plan, classified_experiences
            )
        }
        
        results = {}
        task_list = list(tasks.items())
        completed = await asyncio.gather(*[t[1] for t in task_list], return_exceptions=True)
        
        for (name, _), result in zip(task_list, completed):
            if isinstance(result, Exception):
                logger.error(f"Enrichment '{name}' failed: {result}")
                results[name] = None
            else:
                logger.info(f"Enrichment '{name}' complete")
                results[name] = result
        
        return results
    # =========================================================================
    # SKILL VALIDATION (With Actual Evidence)
    # =========================================================================
    
    async def _validate_skills_with_evidence(
    self,
    candidate: Dict,
    plan: EnrichmentPlan,
    professional_footprint: Dict  # Changed from profile_links
) -> SkillValidationResult:
        """
        Validate skills using ROLE-APPROPRIATE evidence.
        
        Different validation approaches for different roles:
        - Tech: Code repos, StackOverflow, technical blogs
        - Sales: Quota achievements, deal mentions, awards
        - Marketing: Campaign results, publications, case studies
        - Product: Product launches, user growth, roadmap execution
        - Finance: Certifications, regulatory filings, publications
        - HR: Policies implemented, retention metrics, certifications
        - Design: Portfolio work, awards, client work
        """
        requirements = plan.extracted_requirements
        role_type = plan.role_type
        
        name = candidate.get("full_name", "Unknown")
        headline = candidate.get("headline", "")
        skills_to_validate = requirements.get("must_have_skills", [])[:12]
        nice_to_have = requirements.get("nice_to_have_skills", [])[:8]
        
        if not skills_to_validate:
            return self._empty_skill_validation()
        
        # Get evidence already found
        verified_profiles = professional_footprint.get("verified_profiles", [])
        evidence_found = professional_footprint.get("evidence_found", [])
        publications = professional_footprint.get("publications", [])
        
        # Build role-specific validation prompt
        validation_approach = self._get_role_validation_approach(role_type)
        
        prompt = f"""Validate these skills for {name} using ROLE-APPROPRIATE evidence.

    CANDIDATE: {name}
    HEADLINE: {headline}
    TARGET ROLE: {plan.role_title} ({role_type})
    REAL EXPERIENCE: {candidate.get('experience_summary', {}).get('real_experience_years', 0)} years

    MUST-HAVE SKILLS TO VALIDATE: {json.dumps(skills_to_validate)}
    NICE-TO-HAVE SKILLS: {json.dumps(nice_to_have)}

    PROFESSIONAL FOOTPRINT ALREADY DISCOVERED:
    Verified Profiles: {json.dumps(verified_profiles, indent=2)}
    Evidence Found: {json.dumps(evidence_found, indent=2)}
    Publications: {json.dumps(publications, indent=2)}

    ROLE-SPECIFIC VALIDATION APPROACH FOR {role_type.upper()}:
    {validation_approach}

    VALIDATION RULES:
    1. Use the professional footprint data already gathered
    2. If needed, search for ADDITIONAL evidence specific to each skill
    3. Consider the CONTEXT of the role - different evidence matters for different roles
    4. Self-claims on LinkedIn are NOT evidence - need external validation
    5. Look for QUANTIFIABLE achievements where possible

    For each skill, determine:
    - Is there concrete evidence of this skill?
    - How strong is the evidence?
    - How recent is the evidence?
    - Is the evidence appropriate for the seniority level required?

    Return JSON:
    {{
        "validated_skills": [
            {{
                "skill": "Skill name",
                "confidence": 1-10,
                "evidence_type": "What type of evidence found",
                "evidence_sources": ["List of sources"],
                "evidence_description": "Detailed description of evidence",
                "evidence_strength": "strong|moderate|weak",
                "quantifiable_proof": "Any numbers/metrics found",
                "recency": "How recent is the evidence",
                "seniority_appropriate": true|false,
                "notes": "Any additional context"
            }}
        ],
        
        "partially_validated_skills": [
            {{
                "skill": "Skill name",
                "confidence": 1-10,
                "partial_evidence": "What was found",
                "missing": "What's missing for full validation",
                "notes": "Context"
            }}
        ],
        
        "unvalidated_skills": [
            {{
                "skill": "Skill name",
                "confidence": 1-10,
                "searches_attempted": ["What was searched"],
                "reason": "Why no evidence found",
                "alternative_interpretation": "Could they have this skill without public evidence?"
            }}
        ],
        
        "bonus_skills_discovered": [
            {{
                "skill": "Skill not in requirements but found",
                "evidence": "How discovered",
                "relevance_to_role": "Why this matters"
            }}
        ],
        
        "skill_gaps_analysis": {{
            "critical_gaps": ["Must-have skills with no evidence"],
            "concerning_gaps": ["Important skills with weak evidence"],
            "acceptable_gaps": ["Nice-to-have skills missing"],
            "gap_severity": "none|minor|moderate|significant|critical"
        }},
        
        "experience_vs_skills_alignment": {{
            "alignment_score": 75,
            "assessment": "Do their experiences support the claimed skills?",
            "inconsistencies": ["Any mismatches between experience and skills"]
        }},
        
        "overall_assessment": "Comprehensive summary of skill validation",
        "confidence_in_assessment": 70,
        "limitations": ["Any limitations in the validation process"]
    }}

    BE ROLE-APPROPRIATE: For sales, look for revenue/quota evidence. For marketing, look for campaign results.
    Don't just look for tech evidence for non-tech roles.
    
    CRITICAL: You MUST respond with ONLY a valid JSON object. 
    No markdown, no explanations, no text before or after the JSON.
    Start your response with {{ and end with }}
    """

        try:
            response = await self._call_llm(
                prompt, 
                model=self.llm_config["search"],
                temperature=0.2,
                max_tokens=5000
            )
            data = self._extract_json(response)
            
            validated = data.get("validated_skills", [])
            partial = data.get("partially_validated_skills", [])
            unvalidated = data.get("unvalidated_skills", [])
            
            # Calculate overall confidence
            total_skills = len(skills_to_validate)
            validated_count = len(validated)
            partial_count = len(partial)
            
            if validated:
                avg_conf = sum(v.get("confidence", 5) for v in validated) / len(validated)
            else:
                avg_conf = 0
            
            # Score: full validation = 1, partial = 0.5, none = 0
            skill_coverage = (validated_count + partial_count * 0.5) / total_skills if total_skills > 0 else 0
            overall = int(skill_coverage * avg_conf * 10)
            
            return SkillValidationResult(
                validated_skills=[v.get("skill") for v in validated],
                unvalidated_skills=[u.get("skill") for u in unvalidated],
                evidence=validated + partial,  # Include partial evidence
                overall_confidence=min(overall, 100),
                validation_strategy_used={
                    "role_type": role_type,
                    "approach": validation_approach[:200],
                    "profiles_checked": [p.get("platform") for p in verified_profiles],
                    "evidence_items_used": len(evidence_found)
                },
                assessment=data.get("overall_assessment", ""),
                skill_gaps=data.get("skill_gaps_analysis", {}),
                bonus_skills=data.get("bonus_skills_discovered", [])
            )
            
        except Exception as e:
            logger.error(f"Skill validation failed: {e}")
            return self._empty_skill_validation()


    def _get_role_validation_approach(self, role_type: str) -> str:
        """Get role-specific validation approach instructions."""
        
        approaches = {
            "software_engineer": """
    FOR SOFTWARE/TECH ROLES:
    - GitHub: Check repos, stars, commits, PRs, code quality
    - StackOverflow: Questions asked/answered, reputation
    - Technical blogs: Articles written, depth of content
    - Open source: Contributions to major projects
    - Patents: Technical patents filed
    - Conference talks: Technical presentations
    - Certifications: AWS, GCP, Azure, etc. (verify if possible)
    QUANTIFIABLE: Lines of code, repo stars, SO reputation, years using tech""",

            "sales": """
    FOR SALES ROLES:
    - Quota achievement: Look for "President's Club", "Top Performer", "% of quota"
    - Deal mentions: Press releases about major deals closed
    - Revenue numbers: Any public mentions of revenue generated
    - Awards: Sales awards, recognition programs
    - LinkedIn posts: Posts about wins, deals, achievements
    - Testimonials: Client testimonials, recommendations
    - Sales methodology: Evidence of using specific methodologies (MEDDIC, Challenger, etc.)
    QUANTIFIABLE: Revenue generated, quota %, deals closed, team size managed""",

            "marketing": """
    FOR MARKETING ROLES:
    - Campaign results: Case studies with metrics (CTR, conversion, ROI)
    - Publications: Articles in marketing publications
    - Speaking: Conference talks, webinars hosted
    - Awards: Marketing awards (Cannes, Effie, etc.)
    - Portfolio: Campaign examples, creative work
    - Certifications: Google Ads, HubSpot, etc.
    - Growth metrics: User acquisition, brand awareness numbers
    QUANTIFIABLE: Campaign ROI, leads generated, conversion rates, budget managed""",

            "product": """
    FOR PRODUCT ROLES:
    - Product launches: Products shipped, features launched
    - User metrics: DAU/MAU growth, retention improvements
    - Publications: Product thinking articles, frameworks shared
    - Speaking: Product conferences (ProductCon, etc.)
    - Roadmap execution: Evidence of strategic planning
    - User research: Studies conducted, insights generated
    QUANTIFIABLE: User growth, feature adoption, NPS improvements, revenue impact""",

            "finance": """
    FOR FINANCE ROLES:
    - Certifications: CFA, CPA, FRM verification
    - Publications: Financial analysis, research papers
    - Regulatory: Clean regulatory record
    - Transactions: M&A deals, IPOs involved in
    - Awards: Finance industry recognition
    - Professional bodies: Membership in CFA Institute, etc.
    QUANTIFIABLE: Deal values, portfolio size, returns generated""",

            "hr": """
    FOR HR ROLES:
    - Certifications: SHRM-CP/SCP, PHR/SPHR verification
    - Speaking: HR conferences, webinars
    - Publications: HR thought leadership
    - Policies: Evidence of policies implemented
    - Retention metrics: If publicly mentioned
    - Awards: HR excellence awards
    - Professional bodies: SHRM membership, etc.
    QUANTIFIABLE: Team size managed, retention rates, hiring numbers""",

            "design": """
    FOR DESIGN ROLES:
    - Portfolio: Dribbble, Behance profiles
    - Awards: Design awards (Red Dot, iF, etc.)
    - Case studies: Design process documentation
    - Publications: Design articles, tutorials
    - Speaking: Design conferences
    - Client work: Recognizable brands worked with
    QUANTIFIABLE: Projects completed, awards won, user metrics impacted""",

            "data_science": """
    FOR DATA SCIENCE ROLES:
    - Kaggle: Competitions, notebooks, ranking
    - GitHub: ML/DS repos, model implementations
    - Publications: Research papers, patents
    - Conferences: NeurIPS, ICML presentations
    - Blogs: Technical DS/ML content
    - Open source: Contributions to ML libraries
    QUANTIFIABLE: Kaggle ranking, paper citations, model accuracy improvements""",

            "executive": """
    FOR EXECUTIVE ROLES:
    - News mentions: Leadership announcements, interviews
    - Board positions: Public board memberships
    - Speaking: Keynotes, panel discussions
    - Publications: Thought leadership, books
    - Company results: Public company performance under their leadership
    - Awards: Industry leadership awards
    QUANTIFIABLE: Company revenue/growth, team size, market cap impact""",
        }
        
        return approaches.get(role_type, """
    FOR THIS ROLE:
    - Professional certifications relevant to the field
    - Publications and thought leadership
    - Speaking engagements and industry presence
    - Awards and recognition
    - Quantifiable achievements in the field
    - Professional association memberships
    Look for evidence that demonstrates expertise and impact in their specific domain.""")
    # =========================================================================
    # SALARY ESTIMATION (Verified Only)
    # =========================================================================
    
    async def _estimate_salary_verified(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        classified_experiences: List[Dict]
    ) -> SalaryTimeline:
        """
        Estimate salary ONLY for verified paid positions.
        
        Key rules:
        - DO NOT estimate salary for unpaid roles
        - Verify companies exist before estimating
        - Be honest about uncertainty
        """
        strategy = plan.salary_estimation_strategy
        location = candidate.get("location", "India")
        
        # Filter to only paid positions at real companies
        paid_experiences = [
            exp for exp in classified_experiences
            if exp.get("is_paid", False) and exp.get("company_status") in ["verified_company", "startup_unverified"]
        ]
        
        if not paid_experiences:
            return SalaryTimeline(
                career_progression=[],
                current_estimated_ctc={"low": 0, "high": 0, "most_likely": 0, "note": "No verified paid employment found"},
                growth_analysis={"note": "Cannot calculate - no paid employment history"},
                next_role_expectation={},
                confidence_score=0,
                confidence_factors=["No verified paid employment to base estimates on"],
                estimation_strategy_used=strategy
            )
        
        # Build experience summary for ONLY paid roles
        exp_summary = []
        for exp in paid_experiences:
            exp_summary.append({
                "title": exp.get("title", "Unknown"),
                "company": exp.get("company", "Unknown"),
                "type": exp.get("experience_type", "unknown"),
                "company_status": exp.get("company_status", "unknown"),
                "duration": exp.get("duration", ""),
                "start_date": exp.get("start_date", "")
            })
        
        prompt = f"""Estimate salary for VERIFIED PAID positions only.

PAID EXPERIENCES (already filtered - these are real jobs):
{json.dumps(exp_summary, indent=2)}

LOCATION: {location}
ROLE TYPE: {plan.role_type}

RULES:
1. ONLY estimate for roles listed above
2. Search for ACTUAL salary data for these companies
3. If company is "startup_unverified", note uncertainty
4. Do NOT inflate estimates - be conservative

For each role, search for:
- Glassdoor/AmbitionBox salary data for that company
- Industry standards for that role/seniority
- Location-based adjustments

Return JSON:
{{
    "career_progression": [
        {{
            "role": "Role title",
            "company": "Company name",
            "company_verified": true|false,
            "duration": "Duration",
            "start_year": 2020,
            "estimated_ctc_low": 5.0,
            "estimated_ctc_high": 8.0,
            "rationale": "Based on Glassdoor data for this company",
            "confidence": "high|medium|low",
            "sources": ["Glassdoor", "AmbitionBox"]
        }}
    ],
    "current_estimated_ctc": {{
        "low": 10.0,
        "high": 15.0,
        "most_likely": 12.0,
        "confidence": "medium",
        "basis": "Based on last verified role"
    }},
    "growth_analysis": {{
        "average_annual_growth_percent": 15,
        "trajectory": "Description"
    }},
    "confidence_score": 60,
    "confidence_factors": ["Reasons for confidence level"],
    "warnings": ["Any data quality warnings"]
}}

BE CONSERVATIVE. If unsure, give wide ranges and note uncertainty."""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["search"], temperature=0.3)
            data = self._extract_json(response)
            
            return SalaryTimeline(
                career_progression=data.get("career_progression", []),
                current_estimated_ctc=data.get("current_estimated_ctc", {}),
                growth_analysis=data.get("growth_analysis", {}),
                next_role_expectation=data.get("next_role_expectation", {}),
                confidence_score=data.get("confidence_score", 50),
                confidence_factors=data.get("confidence_factors", []),
                estimation_strategy_used=strategy
            )
            
        except Exception as e:
            logger.error(f"Salary estimation failed: {e}")
            return self._empty_salary_timeline()
    
    # =========================================================================
    # RESPONSE LIKELIHOOD (Honest Assessment)
    # =========================================================================
    
    @warnings.deprecated("Use _calculate_response_likelihood_v2 instead")
    async def _calculate_response_likelihood_honest(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> ResponseLikelihoodScore:
        """
        Calculate response likelihood with HONEST assessment.
        
        Key considerations:
        - Is this person a student? (Different approach needed)
        - Are they currently employed? (Notice period relevant)
        - Are they actively job searching?
        """
        exp_summary = candidate.get("experience_summary", {})
        
        prompt = f"""Calculate response likelihood with HONEST assessment.

CANDIDATE:
- Name: {candidate.get('full_name', 'Unknown')}
- Headline: {candidate.get('headline', 'Unknown')}
- Location: {candidate.get('location', 'Unknown')}
- Open to Work: {candidate.get('open_to_work', False)}

EXPERIENCE STATUS:
- Has Industry Experience: {exp_summary.get('has_industry_experience', False)}
- Real Experience Years: {exp_summary.get('real_experience_years', 0)}
- Professional Roles: {exp_summary.get('professional_roles', 0)}
- Is Likely Student: {exp_summary.get('real_experience_years', 0) < 1 and exp_summary.get('other_activities', 0) > 0}

TARGET ROLE: {plan.role_title}
REQUIRED EXPERIENCE: {plan.extracted_requirements.get('years_experience_min', 0)}-{plan.extracted_requirements.get('years_experience_max', 0)} years

KEY QUESTIONS TO ANSWER:
1. Is this person likely QUALIFIED for the role?
2. Are they likely INTERESTED in the role?
3. Are they likely to RESPOND to outreach?
4. What's the best approach to reach them?

Return JSON:
{{
    "overall_score": 35,
    "likelihood_label": "Low|Low-Moderate|Moderate|Moderate-High|High|Very High",
    
    "qualification_assessment": {{
        "meets_experience_requirement": true|false,
        "experience_gap_years": 3,
        "note": "Candidate has X years but role requires Y"
    }},
    
    "factors": [
        {{
            "factor_name": "Experience Match",
            "weight_percent": 30,
            "score": 3,
            "raw_data": "0 years real experience vs 5 required",
            "interpretation": "Significantly underqualified",
            "impact": "very_negative"
        }},
        {{
            "factor_name": "Current Status",
            "weight_percent": 25,
            "score": 5,
            "raw_data": "Appears to be a student",
            "interpretation": "May be open to opportunities but not qualified for senior role",
            "impact": "neutral"
        }}
    ],
    
    "recommended_approach": {{
        "should_reach_out": true|false,
        "reasoning": "Why or why not",
        "if_reaching_out": {{
            "channel": "LinkedIn",
            "message_focus": "What to emphasize",
            "timing": "When to reach out",
            "alternative_roles": ["Junior roles they might qualify for"]
        }}
    }},
    
    "honest_assessment": "Direct, honest summary of the situation",
    "confidence_in_estimate": 70,
    "data_quality_notes": "Any caveats about the assessment"
}}

BE HONEST: If the candidate doesn't qualify, say so. Don't inflate scores."""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["search"], temperature=0.3)
            data = self._extract_json(response)
            
            return ResponseLikelihoodScore(
                overall_score=data.get("overall_score", 50),
                likelihood_label=data.get("likelihood_label", "Unknown"),
                factors=data.get("factors", []),
                recommended_approach=data.get("recommended_approach", {}),
                confidence_in_estimate=data.get("confidence_in_estimate", 50),
                data_quality_notes=data.get("honest_assessment", "")
            )
            
        except Exception as e:
            logger.error(f"Response likelihood failed: {e}")
            return self._empty_response_likelihood()
    
    async def _calculate_response_likelihood_v2(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        professional_footprint: Dict
    ) -> ResponseLikelihoodScore:
        """
        Calculate response likelihood using professional footprint insights.
        
        V2 Enhancements:
        - Uses digital presence to gauge activity level
        - Considers verified profiles for contact methods
        - Looks for job-seeking signals across platforms
        """
        exp_summary = candidate.get("experience_summary", {})
        footprint_assessment = professional_footprint.get("overall_footprint_assessment", {})
        verified_profiles = professional_footprint.get("verified_profiles", [])
        news_mentions = professional_footprint.get("news_mentions", [])
        
        prompt = f"""Calculate response likelihood with comprehensive assessment.

    CANDIDATE:
    - Name: {candidate.get('full_name', 'Unknown')}
    - Headline: {candidate.get('headline', 'Unknown')}
    - Location: {candidate.get('location', 'Unknown')}
    - Open to Work: {candidate.get('open_to_work', False)}

    EXPERIENCE STATUS:
    - Has Industry Experience: {exp_summary.get('has_industry_experience', False)}
    - Real Experience Years: {exp_summary.get('real_experience_years', 0)}
    - Professional Roles: {exp_summary.get('professional_roles', 0)}

    PROFESSIONAL FOOTPRINT:
    - Digital Presence Score: {footprint_assessment.get('digital_presence_score', 0)}
    - Presence Level: {footprint_assessment.get('presence_level', 'Unknown')}
    - Verified Profiles: {[p.get('platform') for p in verified_profiles]}
    - Recent News Mentions: {len(news_mentions)}
    - Key Platforms: {footprint_assessment.get('key_platforms', [])}

    TARGET ROLE: {plan.role_title}
    REQUIRED EXPERIENCE: {plan.extracted_requirements.get('years_experience_min', 0)}-{plan.extracted_requirements.get('years_experience_max', 0)} years

    ANALYSIS FACTORS:
    1. QUALIFICATION FIT: Do they meet the requirements?
    2. ACTIVITY SIGNALS: Are they active online? (recent posts, updates)
    3. JOB SEEKING SIGNALS: Open to work, recent profile updates, networking activity
    4. REACHABILITY: Can we find good contact channels?
    5. TIMING: Are they likely in a good position to move?

    Return JSON:
    {{
        "overall_score": 35,
        "likelihood_label": "Low|Low-Moderate|Moderate|Moderate-High|High|Very High",
        
        "qualification_assessment": {{
            "meets_experience_requirement": true|false,
            "experience_gap_years": 0,
            "skill_alignment": "How well skills match",
            "seniority_fit": "underqualified|good_fit|overqualified"
        }},
        
        "activity_signals": {{
            "overall_activity": "Active|Moderate|Inactive",
            "recent_linkedin_activity": "Description of recent LinkedIn activity if found",
            "platform_activity": {{"platform": "activity level"}},
            "content_creation": "Do they post/write content?"
        }},
        
        "job_seeking_signals": {{
            "open_to_work_explicit": true|false,
            "implicit_signals": ["List of signals suggesting job search"],
            "timing_indicators": ["Recent role change", "tenure at current job", etc.]
        }},
        
        "reachability_assessment": {{
            "best_channels": ["LinkedIn", "Email", "Twitter"],
            "channel_reasoning": {{"channel": "why this channel"}},
            "contact_info_availability": "What contact options exist"
        }},
        
        "factors": [
            {{
                "factor_name": "Factor name",
                "weight_percent": 25,
                "score": 7,
                "raw_data": "What data this is based on",
                "interpretation": "What this means",
                "impact": "positive|neutral|negative"
            }}
        ],
        
        "recommended_approach": {{
            "should_reach_out": true|false,
            "reasoning": "Why or why not",
            "primary_channel": "Best way to reach",
            "message_focus": "What to emphasize",
            "timing": "When to reach out",
            "personalization_hooks": ["Things to mention based on their profile/activity"]
        }},
        
        "honest_assessment": "Direct, honest summary",
        "confidence_in_estimate": 70
    }}"""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["analysis"], temperature=0.3)
            data = self._extract_json(response)
            
            return ResponseLikelihoodScore(
                overall_score=data.get("overall_score", 50),
                likelihood_label=data.get("likelihood_label", "Unknown"),
                factors=data.get("factors", []),
                recommended_approach=data.get("recommended_approach", {}),
                confidence_in_estimate=data.get("confidence_in_estimate", 50),
                data_quality_notes=data.get("honest_assessment", ""),
                activity_signals=data.get("activity_signals", {}),
                reachability=data.get("reachability_assessment", {})
            )
            
        except Exception as e:
            logger.error(f"Response likelihood failed: {e}")
            return self._empty_response_likelihood()
    
    
    # =========================================================================
    # NOTICE PERIOD (Honest)
    # =========================================================================
    
    async def _estimate_notice_period_honest(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        classified_experiences: List[Dict]
    ) -> NoticePeriodEstimate:
        """
        Estimate notice period HONESTLY.
        
        Key rules:
        - Students/unemployed: 0 notice period
        - Only estimate for currently employed
        - Verify the company is real
        """
        # Find current role
        current_roles = [
            exp for exp in classified_experiences
            if exp.get("is_current", False) or str(exp.get("end_date", "")).lower() == "present"
        ]
        
        # Filter to real jobs
        current_paid_roles = [
            exp for exp in current_roles
            if exp.get("is_paid", False) and exp.get("company_status") in ["verified_company", "startup_unverified"]
        ]
        
        if not current_paid_roles:
            return NoticePeriodEstimate(
                estimated_notice_days={"minimum": 0, "likely": 0, "maximum": 0},
                confidence=90,
                factors_considered=[{"factor": "Employment Status", "finding": "Not currently employed at a verified company", "impact_on_estimate": "0 days"}],
                buyout_possibility={"likely": False, "notes": "No notice period to buy out"},
                earliest_possible_start="Immediately available",
                most_likely_start="Within 2 weeks",
                negotiation_tips=["Candidate appears available to start quickly"]
            )
        
        current = current_paid_roles[0]
        
        prompt = f"""Estimate notice period for this employed candidate.

CURRENT ROLE:
- Title: {current.get('title', 'Unknown')}
- Company: {current.get('company', 'Unknown')}
- Company Status: {current.get('company_status', 'unknown')}
- Location: {candidate.get('location', 'India')}

Search for:
1. Notice period policies at {current.get('company', 'this company')}
2. Industry standards for this role level
3. Location-based norms (India typically has longer notice periods)

Return JSON:
{{
    "estimated_notice_days": {{
        "minimum": 30,
        "likely": 60,
        "maximum": 90
    }},
    "confidence": 70,
    "factors_considered": [
        {{
            "factor": "Company Policy",
            "finding": "What you found about their notice period policy",
            "impact_on_estimate": "+/- X days"
        }}
    ],
    "buyout_possibility": {{
        "likely": true|false,
        "typical_buyout": "X months salary",
        "notes": "Notes on buyout"
    }},
    "earliest_possible_start": "X days from offer acceptance",
    "most_likely_start": "Y days from offer acceptance",
    "negotiation_tips": ["Tips for negotiating notice period"]
}}"""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["search"], temperature=0.3)
            data = self._extract_json(response)
            
            return NoticePeriodEstimate(
                estimated_notice_days=data.get("estimated_notice_days", {"minimum": 30, "likely": 30, "maximum": 60}),
                confidence=data.get("confidence", 50),
                factors_considered=data.get("factors_considered", []),
                buyout_possibility=data.get("buyout_possibility", {}),
                earliest_possible_start=data.get("earliest_possible_start", "Unknown"),
                most_likely_start=data.get("most_likely_start", "Unknown"),
                negotiation_tips=data.get("negotiation_tips", [])
            )
            
        except Exception as e:
            logger.error(f"Notice period estimation failed: {e}")
            return NoticePeriodEstimate(
                estimated_notice_days={"minimum": 30, "likely": 30, "maximum": 60},
                confidence=30,
                factors_considered=[],
                buyout_possibility={},
                earliest_possible_start="Unknown",
                most_likely_start="Unknown",
                negotiation_tips=[]
            )
    
    # =========================================================================
    # STEP 7: HONEST MATCH ANALYSIS
    # =========================================================================
    
    @warnings.deprecated("Use _create_honest_match_analysis_v2 instead")
    async def _create_honest_match_analysis(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        enrichment_results: Dict,
        real_experience: Dict
    ) -> MatchAnalysis:
        """
        Create HONEST match analysis.
        
        Key principles:
        - Don't inflate scores for unqualified candidates
        - Clearly state experience gaps
        - Be honest about concerns
        - Suggest alternative actions if not a fit
        """
        skills_result = enrichment_results.get("skills")
        salary_result = enrichment_results.get("salary")
        response_result = enrichment_results.get("response")
        
        requirements = plan.extracted_requirements
        min_exp = requirements.get("years_experience_min", 0)
        max_exp = requirements.get("years_experience_max", 99)
        
        prompt = f"""Create an HONEST match analysis for this candidate.

CANDIDATE:
- Name: {candidate.get('full_name', 'Unknown')}
- Headline: {candidate.get('headline', 'Unknown')}
- Location: {candidate.get('location', 'Unknown')}

EXPERIENCE REALITY:
- Real Industry Experience: {real_experience['total_years']} years
- Professional Roles: {real_experience['professional_count']}
- Internships: {real_experience['internship_count']}
- Student/Volunteer Activities: {real_experience['non_professional_count']}
- Has Industry Experience: {real_experience['has_real_experience']}

JOB REQUIREMENTS:
- Role: {plan.role_title}
- Seniority: {plan.seniority_level}
- Required Experience: {min_exp}-{max_exp} years
- Must-have Skills: {requirements.get('must_have_skills', [])}

ENRICHMENT RESULTS:
- Skills Validated: {skills_result.validated_skills if skills_result else []}
- Skills Confidence: {skills_result.overall_confidence if skills_result else 0}%
- Has Verified Paid Experience: {salary_result.career_progression if salary_result else 'None'}

HONEST ANALYSIS REQUIRED:
1. Does this candidate meet the experience requirement? (Real industry experience only)
2. What are the genuine strengths?
3. What are the critical gaps?
4. Should we interview this candidate for THIS role?
5. If not a fit, what alternative might work?

Return JSON:
{{
    "overall_match_score": 25,
    "match_label": "Poor Match|Fair Match|Good Match|Great Match|Excellent Match",
    
    "experience_assessment": {{
        "required_years": {min_exp},
        "actual_years": {real_experience['total_years']},
        "meets_requirement": false,
        "gap_years": {max(0, min_exp - real_experience['total_years'])},
        "note": "Explanation of experience assessment"
    }},
    
    "strengths": [
        "List genuine strengths"
    ],
    
    "concerns": [
        "List honest concerns"
    ],
    
    "gaps": [
        "List critical gaps"
    ],
    
    "hiring_recommendation": {{
        "action": "Pass|Consider for Junior Role|Interview with Caution|Interview|Strong Interview",
        "reasoning": "Detailed reasoning",
        "interview_focus_areas": ["If interviewing, what to focus on"],
        "alternative_suggestion": "If not a fit, suggest alternative"
    }},
    
    "recruiter_summary": {{
        "one_liner": "Honest one-line summary",
        "key_talking_points": ["If reaching out, what to mention"],
        "salary_negotiation_range": "Based on their actual experience level",
        "timeline_expectation": "Based on their actual situation"
    }},
    
    "honest_verdict": "Direct, honest assessment of this candidate for this role"
}}

BE BRUTALLY HONEST: If this is a poor match, say so clearly. Don't waste HR's time with false positives."""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["analysis"], temperature=0.3)
            data = self._extract_json(response)
            
            return MatchAnalysis(
                overall_match_score=data.get("overall_match_score", 50),
                match_label=data.get("match_label", "Review Required"),
                strengths=data.get("strengths", []),
                concerns=data.get("concerns", []),
                gaps=data.get("gaps", []),
                hiring_recommendation=data.get("hiring_recommendation", {}),
                recruiter_summary=data.get("recruiter_summary", {})
            )
            
        except Exception as e:
            logger.error(f"Match analysis failed: {e}")
            return MatchAnalysis(
                overall_match_score=0,
                match_label="Analysis Failed",
                strengths=[],
                concerns=["Unable to complete analysis"],
                gaps=[],
                hiring_recommendation={"action": "Review Manually", "reasoning": "Automated analysis failed"},
                recruiter_summary={}
            )
    
    async def _create_honest_match_analysis_v2(
    self,
    candidate: Dict,
    plan: EnrichmentPlan,
    enrichment_results: Dict,
    real_experience: Dict,
    professional_footprint: Dict
    ) -> MatchAnalysis:
        """
        Create HONEST match analysis using all available data.
        
        V2 Enhancements:
        - Incorporates professional footprint evidence
        - Role-specific scoring adjustments
        - More nuanced gap analysis
        """
        skills_result = enrichment_results.get("skills")
        salary_result = enrichment_results.get("salary")
        response_result = enrichment_results.get("response")
        
        requirements = plan.extracted_requirements
        min_exp = requirements.get("years_experience_min", 0)
        max_exp = requirements.get("years_experience_max", 99)
        
        footprint_assessment = professional_footprint.get("overall_footprint_assessment", {})
        evidence_found = professional_footprint.get("evidence_found", [])
        
        prompt = f"""Create an HONEST, COMPREHENSIVE match analysis.

    CANDIDATE:
    - Name: {candidate.get('full_name', 'Unknown')}
    - Headline: {candidate.get('headline', 'Unknown')}
    - Location: {candidate.get('location', 'Unknown')}

    EXPERIENCE REALITY:
    - Real Industry Experience: {real_experience['total_years']} years
    - Professional Roles: {real_experience['professional_count']}
    - Internships: {real_experience['internship_count']}
    - Other Activities: {real_experience['non_professional_count']}
    - Has Industry Experience: {real_experience['has_real_experience']}

    JOB REQUIREMENTS:
    - Role: {plan.role_title}
    - Type: {plan.role_type}
    - Seniority: {plan.seniority_level}
    - Required Experience: {min_exp}-{max_exp} years
    - Must-have Skills: {requirements.get('must_have_skills', [])}
    - Nice-to-have Skills: {requirements.get('nice_to_have_skills', [])}

    PROFESSIONAL FOOTPRINT:
    - Digital Presence: {footprint_assessment.get('presence_level', 'Unknown')} ({footprint_assessment.get('digital_presence_score', 0)}/100)
    - Evidence Items Found: {len(evidence_found)}
    - Key Evidence: {json.dumps(evidence_found[:5], indent=2) if evidence_found else 'None'}
    - Notable Findings: {footprint_assessment.get('notable_findings', [])}
    - Red Flags: {footprint_assessment.get('red_flags', [])}

    SKILL VALIDATION RESULTS:
    - Validated Skills: {skills_result.validated_skills if skills_result else []}
    - Unvalidated Skills: {skills_result.unvalidated_skills if skills_result else []}
    - Overall Confidence: {skills_result.overall_confidence if skills_result else 0}%
    - Skill Gaps: {skills_result.skill_gaps if skills_result and hasattr(skills_result, 'skill_gaps') else {}}

    RESPONSE LIKELIHOOD: {response_result.overall_score if response_result else 'Unknown'}%

    SCORING CRITERIA:
    1. Experience Match (30%): Does real experience meet requirements?
    2. Skill Match (30%): Are must-have skills validated with evidence?
    3. Role-Specific Evidence (20%): Does footprint show relevant achievements?
    4. Reachability & Interest (10%): Likelihood to respond and be interested
    5. Cultural/Location Fit (10%): Location, company size fit

    Return JSON:
    {{
        "overall_match_score": 45,
        "match_label": "Poor Match|Fair Match|Good Match|Great Match|Excellent Match",
        
        "score_breakdown": {{
            "experience_match": {{
                "score": 40,
                "weight": 30,
                "weighted_score": 12,
                "reasoning": "Has X years vs Y required"
            }},
            "skill_match": {{
                "score": 60,
                "weight": 30,
                "weighted_score": 18,
                "reasoning": "X of Y skills validated"
            }},
            "role_evidence": {{
                "score": 50,
                "weight": 20,
                "weighted_score": 10,
                "reasoning": "Found relevant evidence for..."
            }},
            "reachability": {{
                "score": 70,
                "weight": 10,
                "weighted_score": 7,
                "reasoning": "Active on LinkedIn, Open to Work"
            }},
            "fit_factors": {{
                "score": 60,
                "weight": 10,
                "weighted_score": 6,
                "reasoning": "Location matches, company size fit"
            }}
        }},
        
        "experience_assessment": {{
            "required_years": {min_exp},
            "actual_years": {real_experience['total_years']},
            "meets_requirement": true|false,
            "gap_years": 0,
            "experience_quality": "Assessment of experience quality, not just quantity"
        }},
        
        "strengths": [
            {{
                "strength": "Clear strength",
                "evidence": "What proves this",
                "relevance": "Why this matters for the role"
            }}
        ],
        
        "concerns": [
            {{
                "concern": "Specific concern",
                "severity": "minor|moderate|significant|critical",
                "evidence": "What raises this concern",
                "mitigation": "How it could be addressed"
            }}
        ],
        
        "gaps": [
            {{
                "gap": "Specific gap",
                "importance": "must_have|nice_to_have",
                "can_be_trained": true|false,
                "time_to_close": "Estimated time to close this gap"
            }}
        ],
        
        "hiring_recommendation": {{
            "action": "Pass|Consider for Different Role|Interview with Caution|Interview|Strong Interview|Fast Track",
            "confidence": 75,
            "reasoning": "Detailed reasoning",
            "interview_focus_areas": ["If interviewing, focus on..."],
            "questions_to_ask": ["Specific questions to clarify concerns"],
            "alternative_roles": ["If not a fit, could be good for..."]
        }},
        
        "recruiter_summary": {{
            "one_liner": "Concise summary for quick scanning",
            "elevator_pitch": "If reaching out, how to pitch the opportunity",
            "talking_points": ["Key points to mention"],
            "avoid_mentioning": ["Things to avoid in outreach"],
            "expected_compensation": "Based on their level and market",
            "timeline_expectation": "When they could potentially join"
        }},
        
        "honest_verdict": "Direct, honest assessment without sugarcoating"
    }}

    SCORING GUIDE:
    - 85-100: Excellent Match - Fast track, strong interview
    - 70-84: Great Match - Definitely interview
    - 55-69: Good Match - Interview, but have concerns
    - 40-54: Fair Match - Consider if talent pool is limited
    - Below 40: Poor Match - Pass or consider for different role

    BE BRUTALLY HONEST. If this is not a good match, say so clearly."""

        try:
            response = await self._call_llm(prompt, model=self.llm_config["analysis"], temperature=0.3)
            data = self._extract_json(response)
            
            return MatchAnalysis(
                overall_match_score=data.get("overall_match_score", 50),
                match_label=data.get("match_label", "Review Required"),
                score_breakdown=data.get("score_breakdown", {}),
                strengths=data.get("strengths", []),
                concerns=data.get("concerns", []),
                gaps=data.get("gaps", []),
                hiring_recommendation=data.get("hiring_recommendation", {}),
                recruiter_summary=data.get("recruiter_summary", {}),
                experience_assessment=data.get("experience_assessment", {})
            )
            
        except Exception as e:
            logger.error(f"Match analysis failed: {e}")
            return MatchAnalysis(
                overall_match_score=0,
                match_label="Analysis Failed",
                strengths=[],
                concerns=[{"concern": "Analysis failed", "severity": "critical"}],
                gaps=[],
                hiring_recommendation={"action": "Review Manually", "reasoning": str(e)},
                recruiter_summary={}
            )
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    async def _call_llm(
        self,
        prompt: str,
        model: str = "moonshotai/kimi-k2-thinking",
        temperature: float = 0.3,
        max_tokens: int = 4000
    ) -> str:
        """Call LLM via OpenRouter."""
        timeout = 300 if ":online" in model else 120
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                self.OPENROUTER_API,
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://Hire-X.hire",
                    "X-Title": "Hire-X Hire"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "max_tokens": max_tokens
                }
            )
            
            if response.status_code != 200:
                logger.error(f"LLM API error: {response.status_code} - {response.text[:500]}")
                raise Exception(f"LLM API error: {response.status_code}")
            
            content = response.json()["choices"][0]["message"]["content"]
            logger.debug(f"LLM response ({model}): {content[:500]}...")  # Add this
            return content
    
    def _extract_json(self, text: str) -> Dict:
        """Extract JSON from LLM response."""
        # Try code block first
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError as e:
                logger.warning(f"JSON in code block invalid: {e}")
        
        # Try raw JSON object
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError as e:
                logger.warning(f"Raw JSON invalid: {e}")
        
        # Log what we got for debugging
        logger.error(f"No valid JSON found. Response preview: {text[:1000]}")
        raise ValueError("No JSON found in response")
    
    def _normalize_linkedin_url(self, url: str) -> str:
        """Normalize LinkedIn URL."""
        url = url.strip()
        if not url.startswith("http"):
            url = "https://" + url
        if "://linkedin.com" in url:
            url = url.replace("://linkedin.com", "://www.linkedin.com")
        url = url.rstrip("/")
        if "?" in url:
            url = url.split("?")[0]
        return url
    
    def _parse_duration_to_months(self, duration_str: str) -> int:
        """Parse duration string to months."""
        if not duration_str:
            return 0
        
        months = 0
        duration_lower = str(duration_str).lower()
        
        year_match = re.search(r'(\d+)\s*(?:yr|year)', duration_lower)
        if year_match:
            months += int(year_match.group(1)) * 12
        
        month_match = re.search(r'(\d+)\s*(?:mo|month)', duration_lower)
        if month_match:
            months += int(month_match.group(1))
        
        return months
    
    def _parse_number(self, value) -> int:
        """Parse number from various formats."""
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            cleaned = re.sub(r'[^\d]', '', value)
            return int(cleaned) if cleaned else 0
        return 0
    
    def _default_enrichment_plan(self, jd: str) -> EnrichmentPlan:
        """Return default plan."""
        return EnrichmentPlan(
            role_type="other",
            role_title="Unknown Role",
            seniority_level="mid",
            extracted_requirements={"must_have_skills": [], "years_experience_min": 0},
            skill_validation_strategy={},
            salary_estimation_strategy={},
            response_likelihood_factors={},
            notice_period_estimation={}
        )
    
    def _empty_skill_validation(self) -> SkillValidationResult:
        """Return empty skill validation."""
        return SkillValidationResult(
            validated_skills=[],
            unvalidated_skills=[],
            evidence=[],
            overall_confidence=0,
            validation_strategy_used={},
            assessment="No skills to validate"
        )
    
    def _empty_salary_timeline(self) -> SalaryTimeline:
        """Return empty salary timeline."""
        return SalaryTimeline(
            career_progression=[],
            current_estimated_ctc={"low": 0, "high": 0, "most_likely": 0},
            growth_analysis={},
            next_role_expectation={},
            confidence_score=0,
            confidence_factors=["Insufficient data"],
            estimation_strategy_used={}
        )
    
    def _empty_response_likelihood(self) -> ResponseLikelihoodScore:
        """Return empty response likelihood."""
        return ResponseLikelihoodScore(
            overall_score=50,
            likelihood_label="Unknown",
            factors=[],
            recommended_approach={},
            confidence_in_estimate=0,
            data_quality_notes="Unable to analyze"
        )