"""
Intelligent Enrichment Orchestrator
====================================
A comprehensive, LLM-driven candidate enrichment system.

Architecture:
┌─────────────────────────────────────────────────────────────┐
│                    Deep Dive Flow                           │
├─────────────────────────────────────────────────────────────┤
│  1. JD Analysis (Claude) → Create role-specific plan        │
│  2. Candidate Lookup:                                       │
│     ├─ MongoDB (56M profiles) - fastest                     │
│     ├─ Brightdata LinkedIn Dataset API - structured JSON    │
│     ├─ Brightdata Web Unlocker - raw HTML + LLM parsing     │
│     └─ Perplexity Web Search - fallback                     │
│  3. Parallel Enrichment:                                    │
│     ├─ Skill Validation (Perplexity + Brightdata)           │
│     ├─ Salary Timeline (Perplexity market data)             │
│     ├─ Response Likelihood (Company news + signals)         │
│     └─ Notice Period (Industry standards)                   │
│  4. Match Analysis (Claude) → Synthesize all data           │
└─────────────────────────────────────────────────────────────┘

Data Sources:
- MongoDB: Our 56M+ profile database (fastest lookup)
- Brightdata LinkedIn Dataset API: Structured profile JSON
- Brightdata Web Unlocker: Bypass anti-bot for raw scraping
- Perplexity Sonar Pro: Web search with LLM synthesis
"""

import asyncio
import json
import re
from datetime import datetime
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


class IntelligentEnrichmentOrchestrator:
    """
    Orchestrates intelligent, LLM-driven candidate enrichment.
    
    This is the brain of the single-candidate deep-dive system.
    It coordinates multiple data sources and LLM calls to build
    a comprehensive candidate profile with:
    - Validated skills with evidence
    - Salary timeline estimation
    - Response likelihood scoring
    - Notice period estimation
    - Match analysis against job requirements
    
    Usage:
        orchestrator = IntelligentEnrichmentOrchestrator(mongodb, redis, model_manager)
        result = await orchestrator.deep_dive_candidate(
            linkedin_url="https://linkedin.com/in/johndoe",
            job_description="Senior Python Developer at Fintech startup..."
        )
    """
    
    # ==========================================================================
    # API ENDPOINTS
    # ==========================================================================
    
    # OpenRouter - LLM Gateway (Claude, Perplexity, etc.)
    OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"
    
    # Brightdata APIs
    BRIGHTDATA_WEB_UNLOCKER_API = "https://api.brightdata.com/request"
    BRIGHTDATA_DATASETS_API = "https://api.brightdata.com/datasets/v3"
    
    # Brightdata Dataset IDs (pre-built scrapers)
    LINKEDIN_PROFILES_DATASET = "gd_l1viktl72bvl7bjuj0"
    LINKEDIN_POSTS_DATASET = "gd_lyy3tktm25m4avu764"
    LINKEDIN_COMPANIES_DATASET = "gd_l1vikfnt1wgvvqz95w"
    LINKEDIN_JOBS_DATASET = "gd_lpfll7v5hcqtkxl6l"
    
    # ==========================================================================
    # INITIALIZATION
    # ==========================================================================
    
    def __init__(
        self,
        mongodb: MongoDB,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager
    ):
        """
        Initialize the orchestrator with required dependencies.
        
        Args:
            mongodb: MongoDB connection for profile lookups
            redis_cache: Redis for caching scraped data
            model_config_manager: For LLM model selection
        """
        self.db = mongodb
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        # API Keys from settings
        self.openrouter_key = settings.OPENROUTER_API_KEY
        self.brightdata_key = settings.BRIGHTDATA_API_TOKEN
        
        # Brightdata zone (for Web Unlocker)
        self.brightdata_zone = getattr(settings, 'BRIGHTDATA_ZONE', 'neuraleap_web_unlocker')
        
        # Validate configuration
        if not self.openrouter_key:
            logger.warning("⚠️ OPENROUTER_API_KEY not configured - LLM calls will fail")
        
        if not self.brightdata_key:
            logger.warning("⚠️ BRIGHTDATA_API_TOKEN not configured - will use Perplexity fallback")
        
        logger.info("✅ IntelligentEnrichmentOrchestrator initialized")
        logger.info(f"   - Brightdata Zone: {self.brightdata_zone}")
        logger.info(f"   - OpenRouter: {'configured' if self.openrouter_key else 'missing'}")
        logger.info(f"   - Brightdata: {'configured' if self.brightdata_key else 'missing'}")
    
    # ==========================================================================
    # MAIN ORCHESTRATION METHOD
    # ==========================================================================
    
    async def deep_dive_candidate(
        self,
        linkedin_url: str,
        job_description: str,
        force_scrape: bool = False
    ) -> CandidateDeepDive:
        """
        Perform comprehensive candidate enrichment.
        
        This is the main entry point that orchestrates the entire flow:
        1. Analyze JD → Create role-specific enrichment plan
        2. Get candidate data from DB or scrape
        3. Run parallel enrichment tasks
        4. Synthesize into match analysis
        
        Args:
            linkedin_url: LinkedIn profile URL to analyze
            job_description: Full job description text
            force_scrape: If True, skip DB and force fresh scrape
            
        Returns:
            CandidateDeepDive with all enrichment data
            
        Raises:
            ValueError: If candidate cannot be found/scraped
        """
        logger.info(f"🔍 Starting deep dive for: {linkedin_url}")
        start_time = datetime.utcnow()
        
        # ======================================================================
        # STEP 1: Analyze JD and create enrichment plan
        # ======================================================================
        logger.info("📋 Step 1: Analyzing job description...")
        enrichment_plan = await self._create_enrichment_plan(job_description)
        logger.info(f"   ✓ Plan created for role type: {enrichment_plan.role_type}")
        
        # ======================================================================
        # STEP 2: Look up or scrape candidate
        # ======================================================================
        logger.info("🔎 Step 2: Looking up candidate data...")
        candidate_data, data_source = await self._get_candidate_data(
            linkedin_url,
            force_scrape
        )
        
        if not candidate_data:
            raise ValueError(f"Could not find or scrape candidate: {linkedin_url}")
        
        logger.info(f"   ✓ Got candidate data from: {data_source}")
        logger.info(f"   ✓ Candidate: {candidate_data.get('full_name', 'Unknown')}")
        
        # ======================================================================
        # STEP 3: Execute enrichment in parallel
        # ======================================================================
        logger.info("⚡ Step 3: Running parallel enrichment tasks...")
        enrichment_results = await self._execute_enrichment(
            candidate_data,
            enrichment_plan
        )
        logger.info("   ✓ All enrichment tasks completed")
        
        # ======================================================================
        # STEP 4: Synthesize results into match analysis
        # ======================================================================
        logger.info("🧠 Step 4: Synthesizing match analysis...")
        match_analysis = await self._analyze_match(
            candidate_data,
            enrichment_plan,
            enrichment_results
        )
        logger.info(f"   ✓ Match score: {match_analysis.overall_match_score}%")
        
        # ======================================================================
        # STEP 5: Build and return final result
        # ======================================================================
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"✅ Deep dive complete in {processing_time:.1f}s")
        
        return CandidateDeepDive(
            candidate=candidate_data,
            job_requirements=enrichment_plan.extracted_requirements,
            enrichment_plan=enrichment_plan,
            skill_validation=enrichment_results.get("skills"),
            salary_timeline=enrichment_results.get("salary"),
            response_likelihood=enrichment_results.get("response"),
            notice_period=enrichment_results.get("notice"),
            match_analysis=match_analysis,
            data_source=data_source,
            processing_time_seconds=processing_time,
            enriched_at=datetime.utcnow().isoformat()
        )
    
    # ==========================================================================
    # STEP 1: JD ANALYSIS & PLAN CREATION
    # ==========================================================================
    
    async def _create_enrichment_plan(self, job_description: str) -> EnrichmentPlan:
        """
        Use Claude to analyze JD and create a dynamic enrichment plan.
        
        The plan adapts validation strategies based on role type:
        - Software Engineer: Check GitHub, StackOverflow, tech blogs
        - Sales: Check LinkedIn activity, case studies, testimonials
        - Marketing: Check published content, campaigns, portfolio
        - Finance: Check certifications, publications, credentials
        - Executive: Check press mentions, board positions, speaking
        
        Args:
            job_description: The full JD text
            
        Returns:
            EnrichmentPlan with role-specific strategies
        """
        prompt = f"""Analyze this job description and create a detailed enrichment plan.

JOB DESCRIPTION:
{job_description}

Return a JSON object with these fields:

{{
    "role_type": "software_engineer" | "sales" | "marketing" | "product" | "finance" | "hr" | "operations" | "executive" | "data_science" | "design" | "other",
    "role_title": "The specific role title from the JD",
    "seniority_level": "entry" | "mid" | "senior" | "lead" | "director" | "vp" | "c_level",
    
    "extracted_requirements": {{
        "must_have_skills": ["skill1", "skill2", "skill3"],
        "nice_to_have_skills": ["skill4", "skill5"],
        "years_experience_min": 5,
        "years_experience_max": 10,
        "education_requirements": ["Bachelor's in CS or equivalent"],
        "industry_preferences": ["Fintech", "SaaS"],
        "location_requirements": ["Remote", "Bangalore", "Mumbai"]
    }},
    
    "skill_validation_strategy": {{
        "primary_sources": ["GitHub", "StackOverflow", "LinkedIn Posts", "Personal Blog"],
        "search_queries_template": [
            "{{name}} {{skill}} github",
            "{{name}} {{skill}} stackoverflow",
            "{{name}} {{skill}} medium blog"
        ],
        "validation_criteria": "Look for public repos, contributions, articles demonstrating hands-on usage",
        "confidence_signals": ["Stars on repos", "Accepted answers", "Recent commits", "Published articles"]
    }},
    
    "salary_estimation_strategy": {{
        "comparable_roles": ["Senior Software Engineer", "Staff Engineer", "Tech Lead"],
        "market_data_sources": ["Glassdoor", "AmbitionBox", "Levels.fyi", "LinkedIn Salary Insights"],
        "adjustment_factors": ["Company size", "Industry", "Location premium", "Funding stage", "Remote vs onsite"]
    }},
    
    "response_likelihood_factors": {{
        "positive_signals": ["Open to Work badge", "Recent profile updates", "Active posting", "Job change pattern"],
        "negative_signals": ["Long tenure at FAANG", "Recent promotion", "Founder/Co-founder", "Low LinkedIn activity"],
        "outreach_recommendations": "Personalized InMail mentioning their specific projects and growth opportunity"
    }},
    
    "notice_period_estimation": {{
        "industry_baseline_days": 30,
        "seniority_adjustment": "+30 days for senior manager and above",
        "signals_to_check": ["Company size", "Contract type", "Industry norms", "Current company policy"]
    }}
}}

IMPORTANT: Be very specific based on the role type. For example:
- Engineers: Focus on GitHub contributions, open source, tech blogs
- Sales: Focus on LinkedIn activity, quota achievement mentions, testimonials
- Executives: Focus on press coverage, board positions, conference speaking"""

        response = await self._call_llm(
            prompt,
            model="anthropic/claude-sonnet-4",
            temperature=0.3
        )
        
        try:
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
    
    # ==========================================================================
    # STEP 2: CANDIDATE DATA LOOKUP
    # ==========================================================================
    
    async def _get_candidate_data(
        self,
        linkedin_url: str,
        force_scrape: bool
    ) -> Tuple[Optional[Dict], str]:
        """
        Get candidate data using multi-source strategy.
        
        Priority order:
        1. MongoDB database (56M+ profiles) - FREE, instant
        2. Brightdata LinkedIn Dataset API - Structured JSON, ~$0.05
        3. Brightdata Web Unlocker - Raw HTML + LLM parsing, ~$0.01
        4. Perplexity Web Search - Fallback, uses API credits
        
        Args:
            linkedin_url: The LinkedIn profile URL
            force_scrape: Skip DB and force fresh scrape
            
        Returns:
            Tuple of (candidate_data, source_name)
        """
        normalized_url = self._normalize_linkedin_url(linkedin_url)
        
        # ----------------------------------------------------------------------
        # Strategy 1: Check our database first (FREE)
        # ----------------------------------------------------------------------
        if not force_scrape:
            logger.info("   📁 Checking MongoDB database...")
            db_candidate = await self._find_in_database(normalized_url)
            if db_candidate:
                logger.info("   ✓ Found in database!")
                return self._normalize_candidate(db_candidate, "database"), "database"
            logger.info("   ✗ Not found in database")
        
        # ----------------------------------------------------------------------
        # Strategy 2: Brightdata LinkedIn Dataset API (structured JSON)
        # ----------------------------------------------------------------------
        if self.brightdata_key:
            logger.info("   🔗 Trying Brightdata LinkedIn Dataset API...")
            dataset_result = await self._scrape_with_linkedin_dataset_api(normalized_url)
            if dataset_result:
                logger.info("   ✓ Got structured data from Brightdata Dataset API!")
                return self._normalize_candidate(dataset_result, "brightdata_dataset"), "brightdata_dataset"
            logger.info("   ✗ Dataset API failed or unavailable")
        
        # ----------------------------------------------------------------------
        # Strategy 3: Brightdata Web Unlocker (raw HTML + LLM parsing)
        # ----------------------------------------------------------------------
        if self.brightdata_key:
            logger.info("   🌐 Trying Brightdata Web Unlocker...")
            unlocker_result = await self._scrape_with_web_unlocker(normalized_url)
            if unlocker_result:
                logger.info("   ✓ Got data from Web Unlocker + LLM parsing!")
                return self._normalize_candidate(unlocker_result, "brightdata_unlocker"), "brightdata_unlocker"
            logger.info("   ✗ Web Unlocker failed")
        
        # ----------------------------------------------------------------------
        # Strategy 4: Perplexity Web Search (fallback)
        # ----------------------------------------------------------------------
        logger.info("   🔍 Falling back to Perplexity web search...")
        perplexity_result = await self._scrape_with_perplexity(normalized_url)
        if perplexity_result:
            logger.info("   ✓ Got data from Perplexity!")
            return self._normalize_candidate(perplexity_result, "perplexity"), "perplexity"
        
        logger.error("   ✗ All scraping methods failed")
        return None, "not_found"
    
    async def _find_in_database(self, linkedin_url: str) -> Optional[Dict]:
        """
        Search MongoDB for candidate by LinkedIn URL or username.
        
        Tries multiple query patterns to maximize hit rate:
        - Exact URL match
        - URL without trailing slash
        - Username regex match (most flexible)
        """
        # Extract username from URL
        username_match = re.search(r'/in/([^/?]+)', linkedin_url)
        if not username_match:
            return None
        
        username = username_match.group(1).lower().strip()
        
        # Try multiple query patterns
        queries = [
            {"linkedin_url": {"$regex": f"/in/{username}/?$", "$options": "i"}},
            {"linkedin_url": linkedin_url},
            {"linkedin_url": linkedin_url.rstrip("/")},
            {"linkedin_url": {"$regex": username, "$options": "i"}},
        ]
        
        for query in queries:
            try:
                candidate = await self.db.profiles_collection.find_one(query)
                if candidate:
                    return candidate
            except Exception as e:
                logger.warning(f"DB query failed: {e}")
                continue
        
        return None
    
    # ==========================================================================
    # BRIGHTDATA: LINKEDIN DATASET API (Structured JSON)
    # ==========================================================================
    
    async def _scrape_with_linkedin_dataset_api(self, linkedin_url: str) -> Optional[Dict]:
        """
        Use Brightdata's LinkedIn Profiles Dataset API.
        
        This is the BEST method when available:
        - Returns structured JSON with all profile fields
        - Pre-parsed data (name, experience, education, skills, etc.)
        - Handles anti-bot automatically
        - Cost: ~$0.05 per profile
        
        API Docs: https://docs.brightdata.com/scraping-automation/web-scraper-api/social-media/linkedin
        Dataset ID: gd_l1viktl72bvl7bjuj0
        """
        # Check cache first
        cache_key = f"linkedin_dataset:{linkedin_url}"
        cached = await self.redis.get(cache_key)
        if cached:
            logger.debug("   Using cached Brightdata Dataset result")
            return json.loads(cached)
        
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                # Trigger the dataset scrape
                response = await client.post(
                    f"{self.BRIGHTDATA_DATASETS_API}/trigger",
                    params={
                        "dataset_id": self.LINKEDIN_PROFILES_DATASET,
                        "format": "json",
                        "type": "discover_new",
                        "discover_by": "url"
                    },
                    headers={
                        "Authorization": f"Bearer {self.brightdata_key}",
                        "Content-Type": "application/json"
                    },
                    json=[{"url": linkedin_url}]
                )
                
                logger.debug(f"   Dataset API response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check if async (returns snapshot_id)
                    if isinstance(data, dict) and "snapshot_id" in data:
                        logger.info(f"   Async scrape started, polling snapshot: {data['snapshot_id']}")
                        result = await self._poll_brightdata_snapshot(data["snapshot_id"])
                        if result:
                            await self.redis.set(cache_key, json.dumps(result), ex=604800)
                            return result
                    
                    # Direct result
                    if isinstance(data, list) and len(data) > 0:
                        result = data[0]
                        await self.redis.set(cache_key, json.dumps(result), ex=604800)
                        return result
                
                elif response.status_code == 401:
                    logger.warning("   Brightdata Dataset API: Unauthorized - check API key")
                elif response.status_code == 402:
                    logger.warning("   Brightdata Dataset API: Payment required - check credits")
                elif response.status_code == 404:
                    logger.warning("   Brightdata Dataset API: Dataset not found - may need to enable")
                else:
                    logger.warning(f"   Brightdata Dataset API error: {response.status_code}")
                    
        except httpx.TimeoutException:
            logger.warning("   Brightdata Dataset API timed out")
        except Exception as e:
            logger.error(f"   Brightdata Dataset API exception: {e}")
        
        return None
    
    async def _poll_brightdata_snapshot(
        self,
        snapshot_id: str,
        max_attempts: int = 30,
        delay_seconds: int = 2
    ) -> Optional[Dict]:
        """
        Poll Brightdata for async scrape results.
        
        Some scrapes are async and return a snapshot_id.
        We poll until complete or timeout.
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
                        
                        # Check if still running
                        if isinstance(data, dict):
                            status = data.get("status", "")
                            if status in ["running", "pending"]:
                                logger.debug(f"   Snapshot polling: attempt {attempt + 1}/{max_attempts}")
                                await asyncio.sleep(delay_seconds)
                                continue
                        
                        # Got results
                        if isinstance(data, list) and len(data) > 0:
                            return data[0]
                            
                    elif response.status_code == 202:
                        # Still processing
                        await asyncio.sleep(delay_seconds)
                        continue
                    else:
                        logger.warning(f"   Snapshot poll error: {response.status_code}")
                        break
                        
            except Exception as e:
                logger.error(f"   Snapshot poll exception: {e}")
                break
        
        logger.warning("   Snapshot polling timed out or failed")
        return None
    
    # ==========================================================================
    # BRIGHTDATA: WEB UNLOCKER API (Raw HTML + LLM Parsing)
    # ==========================================================================
    
    async def _scrape_with_web_unlocker(self, linkedin_url: str) -> Optional[Dict]:
        """
        Use Brightdata's Web Unlocker API to scrape raw HTML.
        
        This method:
        1. Uses Web Unlocker to bypass LinkedIn's anti-bot
        2. Gets raw HTML of the profile page
        3. Uses Claude to parse the HTML into structured data
        
        Cost: ~$0.01 per request + LLM tokens
        
        Best for:
        - When Dataset API is unavailable
        - Custom scraping needs
        - Getting latest data (Dataset API might have cache)
        """
        # Check cache
        cache_key = f"linkedin_unlocker:{linkedin_url}"
        cached = await self.redis.get(cache_key)
        if cached:
            logger.debug("   Using cached Web Unlocker result")
            return json.loads(cached)
        
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                # Call Web Unlocker API
                response = await client.post(
                    self.BRIGHTDATA_WEB_UNLOCKER_API,
                    headers={
                        "Authorization": f"Bearer {self.brightdata_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "zone": self.brightdata_zone,
                        "url": linkedin_url,
                        "format": "raw",  # Get raw HTML
                        "country": "us"   # Use US proxy for LinkedIn
                    }
                )
                
                logger.debug(f"   Web Unlocker response: {response.status_code}")
                
                if response.status_code == 200:
                    html_content = response.text
                    
                    # Check for auth wall / blocked
                    html_lower = html_content.lower()
                    if any(block in html_lower for block in [
                        "authwall", "sign in", "login", "join now",
                        "please sign in", "you need to sign in"
                    ]):
                        logger.warning("   LinkedIn returned auth wall - blocked")
                        return None
                    
                    # Check if we got actual profile content
                    if len(html_content) < 5000:
                        logger.warning(f"   HTML too short ({len(html_content)} chars), likely blocked")
                        return None
                    
                    # Parse HTML with LLM
                    logger.info("   Parsing HTML with LLM...")
                    parsed = await self._parse_html_with_llm(html_content, linkedin_url)
                    
                    if parsed:
                        await self.redis.set(cache_key, json.dumps(parsed), ex=604800)
                        return parsed
                
                elif response.status_code == 401:
                    logger.error("   Web Unlocker: Unauthorized - check API key")
                elif response.status_code == 403:
                    logger.error("   Web Unlocker: Forbidden - check zone permissions")
                elif response.status_code == 429:
                    logger.error("   Web Unlocker: Rate limited")
                else:
                    logger.error(f"   Web Unlocker error: {response.status_code}")
                    
        except httpx.TimeoutException:
            logger.warning("   Web Unlocker timed out")
        except Exception as e:
            logger.error(f"   Web Unlocker exception: {e}")
        
        return None
    
    async def _parse_html_with_llm(self, html_content: str, url: str) -> Optional[Dict]:
        """
        Use Claude to parse LinkedIn HTML into structured data.
        
        This is needed when using Web Unlocker which returns raw HTML.
        Claude is excellent at extracting structured data from messy HTML.
        """
        # Truncate HTML to fit context window (keep most important parts)
        # LinkedIn profile info is usually in the first part of the page
        truncated_html = html_content[:20000]
        
        prompt = f"""Extract LinkedIn profile data from this HTML content.

URL: {url}

HTML CONTENT (truncated to 20k chars):
```html
{truncated_html}
```

Extract and return a JSON object with these fields (use null if not found):

{{
    "full_name": "Person's full name",
    "headline": "Their current headline/title",
    "current_company": "Current employer name",
    "current_position": "Current job title",
    "location": "City, Country",
    "about": "Summary/about section text (if visible)",
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "location": "Job location",
            "start_date": "Mon YYYY format",
            "end_date": "Mon YYYY or Present",
            "duration": "e.g., 2 yrs 3 mos",
            "description": "Role description if visible"
        }}
    ],
    "education": [
        {{
            "school": "University/School name",
            "degree": "Degree type",
            "field": "Field of study",
            "years": "Start - End years"
        }}
    ],
    "skills": ["skill1", "skill2", "skill3"],
    "certifications": ["cert1", "cert2"],
    "languages": ["English", "Hindi"],
    "connections": "Connection count as number or string",
    "followers": "Follower count as number or string"
}}

IMPORTANT:
- Extract as much as possible from the HTML
- For experience, try to get all roles visible
- For skills, look for the skills section
- Use null for any field you can't find
- Dates should be in readable format"""

        try:
            response = await self._call_llm(
                prompt,
                model="anthropic/claude-sonnet-4",  # Best at HTML parsing
                temperature=0.1
            )
            
            return self._extract_json(response)
            
        except Exception as e:
            logger.error(f"   LLM HTML parsing failed: {e}")
            return None
    
    # ==========================================================================
    # PERPLEXITY WEB SEARCH (Fallback)
    # ==========================================================================
    
    async def _scrape_with_perplexity(self, linkedin_url: str) -> Optional[Dict]:
        """
        Use Perplexity Sonar Pro to search for profile information.
        
        This is our fallback when Brightdata fails.
        Perplexity can search the web and synthesize information about a person.
        
        Limitations:
        - May not get full profile details
        - Depends on what's publicly indexed
        - Better for well-known professionals
        """
        # Extract name hint from URL for better search
        username_match = re.search(r'/in/([^/?]+)', linkedin_url)
        username = username_match.group(1) if username_match else ""
        
        # Convert URL username to readable name hint
        name_hint = username.replace("-", " ").title() if username else ""
        
        prompt = f"""Search for information about this LinkedIn profile and extract key details.

LinkedIn URL: {linkedin_url}
Name hint (from URL): {name_hint}

Search the web for information about this person's professional background.
Look for:
1. Their LinkedIn profile information
2. Company websites mentioning them
3. Press releases or news articles
4. Conference speaker bios
5. GitHub profiles or portfolios

Return a JSON object with:
{{
    "full_name": "Person's full name",
    "headline": "Their professional title/headline",
    "current_company": "Current employer",
    "current_position": "Current job title",
    "location": "City, Country",
    "about": "Brief professional summary",
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "start_date": "Approximate start",
            "end_date": "End date or Present",
            "duration_months": 24
        }}
    ],
    "education": [
        {{
            "school": "University name",
            "degree": "Degree",
            "field": "Field of study"
        }}
    ],
    "skills": ["skill1", "skill2", "skill3"],
    "data_sources": ["List of sources you found information from"]
}}

Be thorough in your web search. If you can't find something, use null."""

        try:
            response = await self._call_llm(
                prompt,
                model="perplexity/sonar-pro",  # Web search enabled
                temperature=0.2
            )
            
            return self._extract_json(response)
            
        except Exception as e:
            logger.error(f"   Perplexity search failed: {e}")
            return None
    
    # ==========================================================================
    # STEP 3: PARALLEL ENRICHMENT EXECUTION
    # ==========================================================================
    
    async def _execute_enrichment(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> Dict[str, Any]:
        """
        Execute all enrichment tasks in parallel.
        
        Runs these concurrently for speed:
        - Skill validation (web search for evidence)
        - Salary timeline estimation
        - Response likelihood calculation
        - Notice period estimation
        """
        tasks = {
            "skills": self._validate_skills(candidate, plan),
            "salary": self._estimate_salary_timeline(candidate, plan),
            "response": self._calculate_response_likelihood(candidate, plan),
            "notice": self._estimate_notice_period(candidate, plan)
        }
        
        results = {}
        task_list = list(tasks.items())
        coro_list = [t[1] for t in task_list]
        
        # Run all tasks concurrently
        completed = await asyncio.gather(*coro_list, return_exceptions=True)
        
        # Process results
        for (name, _), result in zip(task_list, completed):
            if isinstance(result, Exception):
                logger.error(f"   Enrichment task '{name}' failed: {result}")
                results[name] = None
            else:
                results[name] = result
                logger.debug(f"   ✓ {name} completed")
        
        return results
    
    # ==========================================================================
    # SKILL VALIDATION
    # ==========================================================================
    
    async def _validate_skills(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> SkillValidationResult:
        """
        Validate candidate skills using web search.
        
        Uses Perplexity to search for public evidence of skills:
        - GitHub repositories and contributions
        - StackOverflow answers
        - Blog posts and articles
        - Conference talks
        - Certifications
        
        The search strategy adapts based on role type from the plan.
        """
        strategy = plan.skill_validation_strategy
        requirements = plan.extracted_requirements
        
        name = candidate.get("full_name", "Unknown")
        skills_to_validate = requirements.get("must_have_skills", [])[:10]
        
        if not skills_to_validate:
            return SkillValidationResult(
                validated_skills=[],
                unvalidated_skills=[],
                evidence=[],
                overall_confidence=0,
                validation_strategy_used=strategy,
                assessment="No skills to validate"
            )
        
        primary_sources = strategy.get("primary_sources", ["LinkedIn", "Google"])
        validation_criteria = strategy.get("validation_criteria", "Look for public evidence")
        
        prompt = f"""Validate these skills for {name} by searching for public evidence.

CANDIDATE: {name}
CURRENT ROLE: {candidate.get('title', 'Unknown')}
CURRENT COMPANY: {candidate.get('current_company', 'Unknown')}

SKILLS TO VALIDATE: {json.dumps(skills_to_validate)}

VALIDATION STRATEGY:
- Primary Sources: {', '.join(primary_sources)}
- Criteria: {validation_criteria}
- Role Type: {plan.role_type}

For each skill, search the web for evidence such as:
- GitHub repositories showing the skill in use
- StackOverflow answers demonstrating expertise
- Blog posts or articles they've written
- Conference talks or presentations
- Open source contributions
- Certifications or courses completed
- LinkedIn posts discussing the topic

Return a JSON object:
{{
    "validated_skills": [
        {{
            "skill": "Python",
            "confidence": 9,
            "evidence_type": "GitHub",
            "evidence_url": "https://github.com/username/repo",
            "evidence_description": "Maintains a Python library with 500+ stars",
            "last_activity": "2024-12"
        }}
    ],
    "unvalidated_skills": [
        {{
            "skill": "Kubernetes",
            "reason": "No public evidence found",
            "search_attempted": ["GitHub", "StackOverflow", "LinkedIn"]
        }}
    ],
    "overall_assessment": "Strong evidence for 7/10 skills with recent activity"
}}"""

        try:
            response = await self._call_llm(
                prompt,
                model="perplexity/sonar-pro",
                temperature=0.2
            )
            
            data = self._extract_json(response)
            
            validated = data.get("validated_skills", [])
            unvalidated = data.get("unvalidated_skills", [])
            
            # Calculate overall confidence
            if validated:
                avg_conf = sum(v.get("confidence", 5) for v in validated) / len(validated)
                overall = int((len(validated) / len(skills_to_validate)) * avg_conf * 10)
            else:
                overall = 0
            
            return SkillValidationResult(
                validated_skills=[v.get("skill") for v in validated],
                unvalidated_skills=[u.get("skill") for u in unvalidated],
                evidence=validated,
                overall_confidence=min(overall, 100),
                validation_strategy_used=strategy,
                assessment=data.get("overall_assessment", "")
            )
            
        except Exception as e:
            logger.error(f"Skill validation failed: {e}")
            return SkillValidationResult(
                validated_skills=[],
                unvalidated_skills=skills_to_validate,
                evidence=[],
                overall_confidence=0,
                validation_strategy_used=strategy,
                assessment=f"Validation failed: {str(e)}"
            )
    
    # ==========================================================================
    # SALARY TIMELINE ESTIMATION
    # ==========================================================================
    
    async def _estimate_salary_timeline(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> SalaryTimeline:
        """
        Estimate salary timeline based on experience history.
        
        Uses Perplexity to search for market salary data and estimates
        CTC (Cost to Company) for each role in the candidate's history.
        """
        experience = candidate.get("experience", [])
        strategy = plan.salary_estimation_strategy
        location = candidate.get("location", "India")
        
        if not experience:
            return self._empty_salary_timeline()
        
        # Build experience summary
        exp_summary = []
        for i, exp in enumerate(experience[:10]):  # Limit to recent 10 roles
            title = exp.get("title", "Unknown")
            company = exp.get("company", "Unknown")
            duration = exp.get("duration_months", exp.get("duration", 12))
            start = exp.get("start_date", "")
            
            exp_summary.append(f"{i+1}. {title} at {company} (duration: {duration}, started: {start})")
        
        prompt = f"""Estimate salary timeline for this candidate based on their experience.

CANDIDATE EXPERIENCE (most recent first):
{chr(10).join(exp_summary)}

LOCATION: {location}
ROLE TYPE: {plan.role_type}
CURRENT SENIORITY: {plan.seniority_level}

ESTIMATION STRATEGY:
- Market Data Sources: {strategy.get('market_data_sources', ['Glassdoor', 'AmbitionBox'])}
- Adjustment Factors: {strategy.get('adjustment_factors', ['Company size', 'Industry'])}

For each role, estimate CTC (Cost to Company) in Lakhs INR per annum.
Consider:
1. Role title and level
2. Company type (startup, MNC, product company)
3. Industry (IT, Fintech, E-commerce, etc.)
4. Location premium (Bangalore > Mumbai > Other metros)
5. Year (adjust for ~6-8% annual inflation)

Return a JSON object:
{{
    "career_progression": [
        {{
            "role": "Software Engineer",
            "company": "TCS",
            "company_type": "IT Services MNC",
            "duration": "24 months",
            "start_year": 2018,
            "experience_level": "Entry (0-2 yrs)",
            "estimated_ctc_low": 4.5,
            "estimated_ctc_high": 6.0,
            "rationale": "Entry-level engineer at TCS in 2018. Standard package for freshers.",
            "sources_referenced": ["Glassdoor TCS salary data", "AmbitionBox reviews"]
        }}
    ],
    "current_estimated_ctc": {{
        "low": 25.0,
        "high": 35.0,
        "most_likely": 30.0
    }},
    "growth_analysis": {{
        "total_growth_multiplier": 6.5,
        "average_annual_growth_percent": 18.5,
        "trajectory": "Aggressive - above market average"
    }},
    "next_role_expectation": {{
        "expected_ctc_low": 35.0,
        "expected_ctc_high": 45.0,
        "reasoning": "Next move likely to senior leadership at larger company"
    }},
    "confidence_score": 75,
    "confidence_factors": ["Good experience data", "Well-known companies"]
}}"""

        try:
            response = await self._call_llm(
                prompt,
                model="perplexity/sonar-pro",
                temperature=0.3
            )
            
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
    
    # ==========================================================================
    # RESPONSE LIKELIHOOD
    # ==========================================================================
    
    async def _calculate_response_likelihood(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> ResponseLikelihoodScore:
        """
        Calculate likelihood of candidate responding to outreach.
        
        Analyzes multiple factors:
        - LinkedIn activity level
        - Current company stability (layoffs, funding)
        - Seniority and tenure patterns
        - Market demand for their role
        - Profile signals (Open to Work, etc.)
        """
        factors_config = plan.response_likelihood_factors
        
        prompt = f"""Calculate the likelihood this candidate will respond to recruiter outreach.

CANDIDATE DATA:
- Name: {candidate.get('full_name', 'Unknown')}
- Current Role: {candidate.get('title', 'Unknown')}
- Company: {candidate.get('current_company', 'Unknown')}
- Location: {candidate.get('location', 'Unknown')}
- LinkedIn Activity: {candidate.get('recent_activity', 'Unknown')}
- Profile Last Updated: {candidate.get('profile_updated', 'Unknown')}
- Connections: {candidate.get('connections', 'Unknown')}
- Open to Work: {candidate.get('open_to_work', False)}
- Estimated Tenure: {self._calculate_tenure(candidate)} months

TARGET ROLE: {plan.role_title}
SENIORITY: {plan.seniority_level}

FACTORS TO CONSIDER:
- Positive Signals: {factors_config.get('positive_signals', [])}
- Negative Signals: {factors_config.get('negative_signals', [])}

Search for additional context:
1. Is their current company stable? Any layoff news?
2. What's the job market like for this role?
3. Have they recently changed jobs or been promoted?
4. Are they actively posting on LinkedIn?

Return a JSON object with TRANSPARENT SCORING:
{{
    "overall_score": 65,
    "likelihood_label": "Moderate-High",
    "factors": [
        {{
            "factor_name": "LinkedIn Activity",
            "weight_percent": 25,
            "score": 7,
            "raw_data": "Posted 3 times in past month",
            "interpretation": "Moderately active, likely checks messages",
            "impact": "positive"
        }},
        {{
            "factor_name": "Company Stability",
            "weight_percent": 20,
            "score": 8,
            "raw_data": "Company announced layoffs in Q1",
            "interpretation": "May be open to exploring options",
            "impact": "positive"
        }},
        {{
            "factor_name": "Seniority Level",
            "weight_percent": 20,
            "score": 5,
            "raw_data": "Senior Manager level",
            "interpretation": "Selective but reachable with right pitch",
            "impact": "neutral"
        }},
        {{
            "factor_name": "Market Demand",
            "weight_percent": 15,
            "score": 8,
            "raw_data": "High demand for this skillset",
            "interpretation": "Likely receives many inbound messages",
            "impact": "mixed"
        }},
        {{
            "factor_name": "Tenure Pattern",
            "weight_percent": 10,
            "score": 7,
            "raw_data": "18 months in role, typical tenure 2-3 years",
            "interpretation": "Approaching natural transition point",
            "impact": "positive"
        }},
        {{
            "factor_name": "Profile Signals",
            "weight_percent": 10,
            "score": 6,
            "raw_data": "No Open to Work badge, 500+ connections",
            "interpretation": "Passive but networked",
            "impact": "neutral"
        }}
    ],
    "recommended_approach": {{
        "channel": "LinkedIn InMail",
        "timing": "Tuesday-Thursday, 10-11am IST",
        "message_style": "Personalized, mention specific projects",
        "key_hooks": ["Growth opportunity", "Technical challenges", "Team culture"],
        "expected_response_time": "3-5 days if interested"
    }},
    "confidence_in_estimate": 72,
    "data_quality_notes": "Good activity data, company news verified"
}}"""

        try:
            response = await self._call_llm(
                prompt,
                model="perplexity/sonar-pro",
                temperature=0.3
            )
            
            data = self._extract_json(response)
            
            return ResponseLikelihoodScore(
                overall_score=data.get("overall_score", 50),
                likelihood_label=data.get("likelihood_label", "Moderate"),
                factors=data.get("factors", []),
                recommended_approach=data.get("recommended_approach", {}),
                confidence_in_estimate=data.get("confidence_in_estimate", 50),
                data_quality_notes=data.get("data_quality_notes", "")
            )
            
        except Exception as e:
            logger.error(f"Response likelihood failed: {e}")
            return self._empty_response_likelihood()
    
    # ==========================================================================
    # NOTICE PERIOD ESTIMATION
    # ==========================================================================
    
    async def _estimate_notice_period(
        self,
        candidate: Dict,
        plan: EnrichmentPlan
    ) -> NoticePeriodEstimate:
        """
        Estimate notice period based on company, industry, and seniority.
        """
        estimation_config = plan.notice_period_estimation
        
        prompt = f"""Estimate the notice period for this candidate.

CANDIDATE:
- Name: {candidate.get('full_name', 'Unknown')}
- Current Role: {candidate.get('title', 'Unknown')}
- Company: {candidate.get('current_company', 'Unknown')}
- Location: {candidate.get('location', 'Unknown')}
- Industry: {candidate.get('industry', 'Unknown')}
- Seniority: {plan.seniority_level}

BASELINE:
- Industry default: {estimation_config.get('industry_baseline_days', 30)} days
- Seniority adjustment: {estimation_config.get('seniority_adjustment', '+30 days for director+')}

Search for:
1. Typical notice periods at {candidate.get('current_company', 'this company')}
2. Industry standards in India
3. Seniority-based variations

Return JSON:
{{
    "estimated_notice_days": {{
        "minimum": 30,
        "likely": 60,
        "maximum": 90
    }},
    "confidence": 75,
    "factors_considered": [
        {{
            "factor": "Company Policy",
            "finding": "MNCs typically have 60-90 day notice for seniors",
            "impact_on_estimate": "+30 days"
        }}
    ],
    "buyout_possibility": {{
        "likely": true,
        "typical_buyout": "1-2 months salary",
        "notes": "Common for urgent hires"
    }},
    "earliest_possible_start": "45 days from acceptance",
    "most_likely_start": "75 days from acceptance",
    "negotiation_tips": ["Offer sign-on bonus", "Cover buyout cost"]
}}"""

        try:
            response = await self._call_llm(
                prompt,
                model="perplexity/sonar-pro",
                temperature=0.3
            )
            
            data = self._extract_json(response)
            
            return NoticePeriodEstimate(
                estimated_notice_days=data.get("estimated_notice_days", {"minimum": 30, "likely": 30, "maximum": 60}),
                confidence=data.get("confidence", 50),
                factors_considered=data.get("factors_considered", []),
                buyout_possibility=data.get("buyout_possibility", {}),
                earliest_possible_start=data.get("earliest_possible_start", "30 days"),
                most_likely_start=data.get("most_likely_start", "45 days"),
                negotiation_tips=data.get("negotiation_tips", [])
            )
            
        except Exception as e:
            logger.error(f"Notice period estimation failed: {e}")
            return NoticePeriodEstimate(
                estimated_notice_days={"minimum": 30, "likely": 30, "maximum": 60},
                confidence=30,
                factors_considered=[],
                buyout_possibility={},
                earliest_possible_start="30 days",
                most_likely_start="45 days",
                negotiation_tips=[]
            )
    
    # ==========================================================================
    # STEP 4: MATCH ANALYSIS
    # ==========================================================================
    
    async def _analyze_match(
        self,
        candidate: Dict,
        plan: EnrichmentPlan,
        enrichment_results: Dict
    ) -> MatchAnalysis:
        """
        Synthesize all enrichment data into a match analysis.
        
        Provides:
        - Overall match score
        - Strengths and concerns
        - Hiring recommendation
        - Recruiter talking points
        """
        skills_result = enrichment_results.get("skills")
        salary_result = enrichment_results.get("salary")
        response_result = enrichment_results.get("response")
        
        prompt = f"""Analyze how well this candidate matches the job requirements.

CANDIDATE:
- Name: {candidate.get('full_name', 'Unknown')}
- Current Role: {candidate.get('title', 'Unknown')}
- Company: {candidate.get('current_company', 'Unknown')}
- Experience: {candidate.get('total_experience_years', 0)} years

JOB REQUIREMENTS:
- Role: {plan.role_title}
- Seniority: {plan.seniority_level}
- Must-have Skills: {plan.extracted_requirements.get('must_have_skills', [])}
- Experience: {plan.extracted_requirements.get('years_experience_min', 0)}-{plan.extracted_requirements.get('years_experience_max', 0)} years

ENRICHMENT DATA:
- Skills Validated: {skills_result.validated_skills if skills_result else 'N/A'}
- Skills Confidence: {skills_result.overall_confidence if skills_result else 'N/A'}%
- Response Likelihood: {response_result.overall_score if response_result else 'N/A'}%
- Current CTC Estimate: {salary_result.current_estimated_ctc if salary_result else 'N/A'}

Return comprehensive analysis as JSON:
{{
    "overall_match_score": 78,
    "match_label": "Great Match",
    "strengths": [
        "Strong technical skills with evidence",
        "Relevant industry experience"
    ],
    "concerns": [
        "Slightly under experience requirement",
        "May have high salary expectations"
    ],
    "gaps": [
        "No Kubernetes experience found"
    ],
    "hiring_recommendation": {{
        "action": "Strong Interview",
        "reasoning": "Strong skill match outweighs minor experience gap",
        "interview_focus_areas": ["System design", "Leadership"]
    }},
    "recruiter_summary": {{
        "one_liner": "Strong candidate with proven track record, worth pursuing",
        "key_talking_points": ["Their open source work", "Growth opportunity"],
        "salary_negotiation_range": "28-35L based on market",
        "timeline_expectation": "60-75 days to onboard"
    }}
}}"""

        try:
            response = await self._call_llm(
                prompt,
                model="anthropic/claude-sonnet-4",
                temperature=0.3
            )
            
            data = self._extract_json(response)
            
            return MatchAnalysis(
                overall_match_score=data.get("overall_match_score", 50),
                match_label=data.get("match_label", "Fair Match"),
                strengths=data.get("strengths", []),
                concerns=data.get("concerns", []),
                gaps=data.get("gaps", []),
                hiring_recommendation=data.get("hiring_recommendation", {}),
                recruiter_summary=data.get("recruiter_summary", {})
            )
            
        except Exception as e:
            logger.error(f"Match analysis failed: {e}")
            return MatchAnalysis(
                overall_match_score=50,
                match_label="Review Required",
                strengths=[],
                concerns=["Unable to complete analysis"],
                gaps=[],
                hiring_recommendation={"action": "Review", "reasoning": "Analysis incomplete"},
                recruiter_summary={}
            )
    
    # ==========================================================================
    # HELPER METHODS
    # ==========================================================================
    
    async def _call_llm(
        self,
        prompt: str,
        model: str = "anthropic/claude-sonnet-4",
        temperature: float = 0.3,
        max_tokens: int = 4000
    ) -> str:
        """
        Call LLM via OpenRouter API.
        
        Supports any model available on OpenRouter:
        - anthropic/claude-sonnet-4 (best for analysis)
        - perplexity/sonar-pro (web search enabled)
        - etc.
        """
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                self.OPENROUTER_API,
                headers={
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://neuraleap.hire",
                    "X-Title": "NeuraLeap Hire"
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
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    def _extract_json(self, text: str) -> Dict:
        """Extract JSON from LLM response (handles markdown code blocks)."""
        # Try JSON in code block first
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if json_match:
            return json.loads(json_match.group(1))
        
        # Try raw JSON object
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group(0))
        
        raise ValueError("No JSON found in response")
    
    def _normalize_linkedin_url(self, url: str) -> str:
        """Normalize LinkedIn URL to standard format."""
        url = url.strip()
        
        # Add https if missing
        if not url.startswith("http"):
            url = "https://" + url
        
        # Ensure www prefix
        if "://linkedin.com" in url:
            url = url.replace("://linkedin.com", "://www.linkedin.com")
        
        # Remove trailing slash
        url = url.rstrip("/")
        
        # Remove query params (they often break matching)
        if "?" in url:
            url = url.split("?")[0]
        
        return url
    
    def _normalize_candidate(self, raw: Dict, source: str) -> Dict:
        """
        Normalize candidate data to standard format.
        
        Different sources return data in different formats.
        This normalizes to our standard schema.
        """
        experience = raw.get("experience", [])
        
        # Calculate total experience in months
        total_months = 0
        for exp in experience if isinstance(experience, list) else []:
            if isinstance(exp, dict):
                # Try different duration field names
                duration = exp.get("duration_months") or exp.get("duration") or 12
                if isinstance(duration, str):
                    duration = self._parse_duration_to_months(duration)
                total_months += int(duration)
        
        return {
            "full_name": (
                raw.get("full_name") or 
                raw.get("name") or 
                f"{raw.get('first_name', '')} {raw.get('last_name', '')}".strip() or
                "Unknown"
            ),
            "title": (
                raw.get("title") or 
                raw.get("headline") or 
                raw.get("position") or 
                raw.get("current_position") or
                ""
            ),
            "current_company": (
                raw.get("current_company") or 
                raw.get("company") or 
                raw.get("current_company_name") or
                ""
            ),
            "location": (
                raw.get("location") or 
                raw.get("city") or 
                ""
            ),
            "industry": (
                raw.get("industry") or 
                raw.get("current_industry") or 
                ""
            ),
            "summary": (
                raw.get("summary") or 
                raw.get("about") or 
                ""
            ),
            "experience": experience,
            "education": raw.get("education", raw.get("educations_details", [])),
            "skills": raw.get("skills", []),
            "linkedin_url": (
                raw.get("linkedin_url") or 
                raw.get("url") or 
                raw.get("input_url") or
                ""
            ),
            "connections": self._parse_number(raw.get("connections", 0)),
            "followers": self._parse_number(raw.get("followers", 0)),
            "open_to_work": (
                raw.get("has_open_to_work", False) or
                "open to work" in str(raw.get("headline", "")).lower()
            ),
            "recent_activity": raw.get("activity", raw.get("posts", [])),
            "profile_updated": raw.get("profile_updated", raw.get("timestamp", "")),
            "total_experience_years": round(total_months / 12, 1),
            "_source": source,
            "_raw_id": str(raw.get("_id", ""))
        }
    
    def _parse_duration_to_months(self, duration_str: str) -> int:
        """Parse duration string like '2 yrs 3 mos' to total months."""
        if not duration_str:
            return 12
        
        months = 0
        duration_lower = str(duration_str).lower()
        
        # Parse years
        year_match = re.search(r'(\d+)\s*(?:yr|year)', duration_lower)
        if year_match:
            months += int(year_match.group(1)) * 12
        
        # Parse months
        month_match = re.search(r'(\d+)\s*(?:mo|month)', duration_lower)
        if month_match:
            months += int(month_match.group(1))
        
        return months if months > 0 else 12
    
    def _parse_number(self, value) -> int:
        """Parse various number formats to int."""
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            # Remove commas and non-numeric chars except digits
            cleaned = re.sub(r'[^\d]', '', value)
            return int(cleaned) if cleaned else 0
        return 0
    
    def _calculate_tenure(self, candidate: Dict) -> int:
        """Calculate tenure at current company in months."""
        experience = candidate.get("experience", [])
        if experience and isinstance(experience, list) and len(experience) > 0:
            first_exp = experience[0]
            if isinstance(first_exp, dict):
                duration = first_exp.get("duration_months") or first_exp.get("duration", 0)
                if isinstance(duration, str):
                    return self._parse_duration_to_months(duration)
                return int(duration)
        return 0
    
    def _default_enrichment_plan(self, jd: str) -> EnrichmentPlan:
        """Return default plan if LLM fails."""
        return EnrichmentPlan(
            role_type="other",
            role_title="Unknown Role",
            seniority_level="mid",
            extracted_requirements={
                "must_have_skills": [],
                "nice_to_have_skills": [],
                "years_experience_min": 0,
                "years_experience_max": 10
            },
            skill_validation_strategy={
                "primary_sources": ["LinkedIn", "Google"],
                "validation_criteria": "General web search"
            },
            salary_estimation_strategy={
                "market_data_sources": ["Glassdoor", "AmbitionBox"]
            },
            response_likelihood_factors={},
            notice_period_estimation={"industry_baseline_days": 30}
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