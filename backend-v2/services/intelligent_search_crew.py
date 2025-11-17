"""
Intelligent Search Crew - CrewAI Implementation
================================================
Multi-agent system for intelligent candidate search.
"""

import json
import os
from typing import Any, Dict, List, Optional

from crewai import LLM, Agent, Crew, Process, Task

from core.logging_config import get_logger
from services.crew_tools import (DatabaseStatsTool, QueryBuilderTool,
                                 QueryExecutorTool, QueryPerformanceTool,
                                 SampleDocumentsTool)
from services.query_builder import QueryBuilder, QueryStrategy

logger = get_logger(__name__)


class IntelligentSearchCrew:
    """
    CrewAI-based intelligent search system.
    
    Agents:
    1. JD Analyst - Understands requirements deeply
    2. Query Strategist - Builds optimal MongoDB queries
    3. Search Validator - Tests and validates results
    """
    
    def __init__(
        self,
        profiles_collection,
        openrouter_api_key: str,
        model_name: str = "anthropic/claude-sonnet-4.5"
    ):
        """Initialize the crew."""
        self.profiles = profiles_collection
        
        # Initialize LLM
        self.llm = LLM(
            model=model_name,
            provider="openai",  
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0.1,
            max_tokens=4096  
        )
        
        # ⭐ Configure tools with MongoDB connection info
        from dotenv import load_dotenv
        load_dotenv()
        
        db_url = os.getenv("PROFILES_DB_URL")
        db_name = os.getenv("PROFILES_DB_NAME")
        
        QueryExecutorTool.configure(db_url, db_name)
        SampleDocumentsTool.configure(db_url, db_name)
        QueryPerformanceTool.configure(db_url, db_name)
        
        # Initialize tools
        self.db_stats_tool = DatabaseStatsTool()
        self.query_builder_tool = QueryBuilderTool()
        self.query_executor_tool = QueryExecutorTool()
        self.sample_docs_tool = SampleDocumentsTool()
        self.query_perf_tool = QueryPerformanceTool()
        
        logger.info("✅ IntelligentSearchCrew initialized with all tools")
    
    def search(
        self,
        ideal_profile: Dict[str, Any],
        target_count: int = 5
    ) -> Dict[str, Any]:
        """Execute intelligent search using multi-agent system."""
        logger.info(f"🤖 Starting intelligent search for {target_count} candidates")
        
        # Convert ideal profile to JSON string for tools
        ideal_profile_json = json.dumps(ideal_profile)
        
        # Create agents
        jd_analyst = self._create_jd_analyst()
        query_strategist = self._create_query_strategist()
        search_validator = self._create_search_validator()
        
        # Create tasks
        analysis_task = self._create_analysis_task(jd_analyst, ideal_profile)
        query_task = self._create_query_task(
            query_strategist,
            ideal_profile,
            ideal_profile_json,
            target_count
        )
        validation_task = self._create_validation_task(
            search_validator,
            target_count
        )
        
        # Create and run crew
        crew = Crew(
            agents=[jd_analyst, query_strategist, search_validator],
            tasks=[analysis_task, query_task, validation_task],
            process=Process.sequential,
            verbose=True
        )
        
        try:
            result = crew.kickoff()
            
            # Parse result and fetch actual candidates
            final_query = self._extract_final_query(result)
            candidates = self._fetch_candidates(final_query, target_count * 2)
            
            return {
                "success": True,
                "candidates": candidates,
                "final_query": final_query,
                "crew_output": str(result),
                "iterations": self._count_iterations(result)
            }
            
        except Exception as e:
            logger.error(f"Crew execution failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "candidates": []
            }
    
    def _create_jd_analyst(self) -> Agent:
        """Create the JD Analysis agent."""
        return Agent(
            role="Senior HR Requirements Analyst",
            goal="Deeply understand job requirements and extract searchable criteria",
            backstory=(
                "You are an experienced HR professional who has reviewed thousands "
                "of job descriptions. You understand what requirements are truly "
                "essential vs. nice-to-have. You know that many database fields "
                "might be empty, so you focus on the most reliable search criteria. "
                "You think like a recruiter, not a parser."
            ),
            tools=[self.db_stats_tool],
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
    
    def _create_query_strategist(self) -> Agent:
        """Create the Query Strategy agent."""
        return Agent(
            role="MongoDB Query Optimization Expert",
            goal="Build efficient MongoDB queries that find the right candidates",
            backstory=(
                "You are a database expert who specializes in MongoDB query optimization. "
                "You understand compound indexes, query performance, and the trade-offs "
                "between precision and recall. You know that expertise field is NOT indexed "
                "and that regex OR patterns can't use indexes. You build queries that are "
                "both fast and effective. You always start with the most restrictive "
                "strategy and progressively relax constraints if needed."
            ),
            tools=[
                self.db_stats_tool,
                self.query_builder_tool,
                self.query_executor_tool,
                self.query_perf_tool  # ⭐ NEW
            ],
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
    
    def _create_search_validator(self) -> Agent:
        """Create the Search Validation agent."""
        return Agent(
            role="Search Quality Validator",
            goal="Ensure search results meet quality standards and provide feedback",
            backstory=(
                "You are a quality assurance expert for search systems. You validate "
                "that search results are relevant, diverse, and meet the minimum count "
                "requirements. If results are insufficient, you provide specific feedback "
                "on how to adjust the query. You understand the balance between being "
                "too strict (no results) and too loose (irrelevant results)."
            ),
            tools=[
                self.query_executor_tool,
                self.sample_docs_tool 
            ],
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
    
    def _create_analysis_task(
        self,
        agent: Agent,
        ideal_profile: Dict[str, Any]
    ) -> Task:
        """Create the JD analysis task."""
        return Task(
            description=(
                f"Analyze this job requirement and identify the MOST IMPORTANT "
                f"searchable criteria:\n\n"
                f"Role: {ideal_profile.get('role_title', 'Not specified')}\n"
                f"Required Skills: {ideal_profile.get('must_have_skills', [])[:5]}\n"
                f"Experience: {ideal_profile.get('experience_years', 'Not specified')}\n"
                f"Seniority: {ideal_profile.get('seniority', 'Not specified')}\n"
                f"Industries: {ideal_profile.get('industries', [])[:3]}\n\n"
                f"First, use the Database Statistics tool to understand field availability.\n\n"
                f"Then determine:\n"
                f"1. Which skills/keywords are most critical (focus on title-searchable terms)\n"
                f"2. Which fields can reliably be used for filtering (check field availability)\n"
                f"3. What trade-offs should be made (precision vs. recall)\n"
                f"4. Which criteria are deal-breakers vs. nice-to-have\n\n"
                f"Provide a strategic analysis focusing on what will work well with "
                f"the database constraints."
            ),
            agent=agent,
            expected_output=(
                "A strategic analysis identifying: (1) Critical search terms, "
                "(2) Reliable filter fields, (3) Query strategy recommendation, "
                "(4) Expected challenges"
            )
        )
    
    def _create_query_task(
        self,
        agent: Agent,
        ideal_profile: Dict[str, Any],
        ideal_profile_json: str,
        target_count: int
    ) -> Task:
        """Create the query building task."""
        return Task(
            description=(
                f"Build an optimized MongoDB query to find {target_count}+ candidates.\n\n"
                f"Ideal Profile JSON (use this with Query Builder tool):\n{ideal_profile_json}\n\n"
                f"Based on the JD analysis, create a query strategy:\n\n"
                f"1. Start with the most restrictive strategy (industry_seniority)\n"
                f"2. Use Query Builder tool with strategy and ideal_profile_json\n"
                f"3. Use Query Executor tool with the generated query_json\n"
                f"4. If results < {target_count}, progressively relax constraints:\n"
                f"   - Try industry_only\n"
                f"   - Try seniority_only\n"
                f"   - Try title_words\n"
                f"   - Finally try minimal\n\n"
                f"For each attempt:\n"
                f"- Build the query using Query Builder tool\n"
                f"- Execute using Query Executor tool\n"
                f"- Check result count\n"
                f"- Evaluate query performance (should be <2000ms)\n"
                f"- If insufficient, try next strategy\n\n"
                f"CRITICAL RULES:\n"
                f"- NEVER use expertise field (not indexed, 60% NA)\n"
                f"- NEVER use regex with OR patterns (can't use index)\n"
                f"- ALWAYS exclude 'NA' values\n"
                f"- Prefer indexed fields: title, industry, seniority, location\n\n"
                f"Stop when you find {target_count}+ candidates OR when all strategies exhausted.\n\n"
                f"Return the final successful query as JSON."
            ),
            agent=agent,
            expected_output=(
                "Final MongoDB query in JSON format that returns sufficient candidates, along with: "
                "(1) Strategy used, (2) Result count, (3) Query performance metrics, "
                "(4) Sample candidates"
            )
        )
    
    def _create_validation_task(
        self,
        agent: Agent,
        target_count: int
    ) -> Task:
        """Create the validation task."""
        return Task(
            description=(
                f"Validate the search results from the query strategist.\n\n"
                f"Check:\n"
                f"1. Are there at least {target_count} candidates?\n"
                f"2. Do the sample profiles look relevant?\n"
                f"3. Is there diversity in the results (not all same company/location)?\n"
                f"4. Was the query performant (<2000ms)?\n\n"
                f"If validation fails:\n"
                f"- Provide specific feedback on what's wrong\n"
                f"- Suggest concrete improvements\n"
                f"- Request query strategist to retry\n\n"
                f"If validation passes:\n"
                f"- Confirm the query is ready for production use\n"
                f"- Summarize the final query and result count"
            ),
            agent=agent,
            expected_output=(
                "Validation report with: (1) Pass/Fail status, (2) Result quality assessment, "
                "(3) Final approved query, (4) Any warnings or recommendations"
            )
        )
    
    def _extract_final_query(self, crew_output: Any) -> Dict[str, Any]:
        """Extract the final MongoDB query from crew output."""
        output_str = str(crew_output)
        
        # Try to find JSON query in output
        import re

        # Look for MongoDB query patterns
        query_match = re.search(r'\{[^{}]*"[\$a-z_]+"[^{}]*\}', output_str)
        if query_match:
            try:
                query_str = query_match.group()
                return json.loads(query_str)
            except:
                pass
        
        # Fallback: return a minimal query
        logger.warning("Could not extract query from crew output, using fallback")
        return {}
    
    def _fetch_candidates(
        self,
        query: Dict[str, Any],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Fetch actual candidate documents."""
        try:
            if not query:
                # Empty query - just get any candidates
                query = {"title": {"$ne": "NA"}}
            
            cursor = self.profiles.find(query).limit(limit)
            candidates = []
            
            for doc in cursor:
                candidates.append({
                    "first_name": doc.get("first_name", ""),
                    "last_name": doc.get("last_name", ""),
                    "title": doc.get("title", ""),
                    "location": doc.get("location", ""),
                    "current_industry": doc.get("current_industry", ""),
                    "seniority_level": doc.get("seniority_level", ""),
                    "experience_years": doc.get("experience_years", 0),
                    "expertise": doc.get("expertise", []),
                    "linkedin_url": doc.get("linkedin_url", "")
                })
            
            return candidates
            
        except Exception as e:
            logger.error(f"Error fetching candidates: {e}")
            return []
    
    def _count_iterations(self, crew_output: Any) -> int:
        """Count how many query iterations were performed."""
        output_str = str(crew_output).lower()
        
        # Count mentions of different strategies
        strategies = ["industry_seniority", "industry_only", "seniority_only", "title_words", "minimal"]
        count = sum(1 for s in strategies if s in output_str)
        
        return max(count, 1)