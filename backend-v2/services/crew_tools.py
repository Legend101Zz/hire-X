"""
Custom CrewAI Tools for Intelligent Search
===========================================
"""

import json
import time
from typing import Any, ClassVar, Dict, List

from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.collection import Collection


class DatabaseStatsInput(BaseModel):
    """Input for database stats tool."""
    pass


class DatabaseStatsTool(BaseTool):
    """Tool to get database field availability statistics."""
    
    name: str = "Database Statistics"
    description: str = (
        "Get statistics about the candidate database including field availability. "
        "Use this to understand which fields are reliable for querying."
    )
    
    def _run(self, **kwargs) -> str:
        """Return database statistics."""
        stats = {
            "total_profiles": "58,918,216",
            "field_availability": {
                "title": "98.5% valid (904k NA) - HIGHLY RELIABLE",
                "seniority_level": "55% valid (26M NA) - MODERATE",
                "current_industry": "69% valid (18M NA) - MODERATE",
                "expertise": "40% valid (35M NA) - UNRELIABLE, NOT INDEXED",
                "location": "80% valid (11M NA) - RELIABLE",
                "experience_years": "85% valid - RELIABLE"
            },
            "indexed_fields": [
                "title", 
                "seniority_level", 
                "current_industry", 
                "location", 
                "experience_years"
            ],
            "compound_indexes": [
                "location + experience_years",
                "industry + experience_years",
                "location + industry + experience_years"
            ],
            "warnings": [
                "expertise field is NOT indexed - avoid using in queries",
                "Regex with OR operators (|) cannot use indexes",
                "Many fields contain 'NA' - always exclude these"
            ]
        }
        return json.dumps(stats, indent=2)


class QueryBuilderInput(BaseModel):
    """Input for query builder tool."""
    strategy: str = Field(description="Query strategy to use")
    ideal_profile_json: str = Field(description="Ideal candidate profile as JSON string")


class QueryBuilderTool(BaseTool):
    """Tool to build MongoDB queries."""
    
    name: str = "Query Builder"
    description: str = (
        "Build optimized MongoDB queries based on ideal profile and strategy. "
        "Available strategies: industry_seniority, industry_only, seniority_only, "
        "title_words, minimal. "
        "Provide ideal_profile_json as a JSON string."
    )
    args_schema: type[BaseModel] = QueryBuilderInput
    
    def _run(self, strategy: str, ideal_profile_json: str) -> str:
        """Build a query."""
        from services.query_builder import QueryBuilder, QueryStrategy
        
        try:
            # Parse ideal profile from JSON string
            ideal_profile = json.loads(ideal_profile_json)
            
            # Create query builder
            query_builder = QueryBuilder(ideal_profile)
            
            # Build query with strategy
            strategy_enum = QueryStrategy(strategy)
            query = query_builder.build(strategy_enum)
            
            return json.dumps({
                "strategy": strategy,
                "query": query,
                "estimated_docs": "Unknown - execute to find out"
            }, indent=2, default=str)
        except Exception as e:
            return f"Error building query: {str(e)}"


class QueryExecutorInput(BaseModel):
    """Input for query executor tool."""
    query_json: str = Field(description="MongoDB query as JSON string")


class QueryExecutorTool(BaseTool):
    """Tool to execute MongoDB queries and get results."""
    
    name: str = "Query Executor"
    description: str = (
        "Execute a MongoDB query against the candidate database. "
        "Returns count of matches and sample documents. Use this to test queries. "
        "Provide query_json as a JSON string."
    )
    args_schema: type[BaseModel] = QueryExecutorInput
    
    # ⭐ Store SYNCHRONOUS MongoDB client info
    db_url: ClassVar[str | None] = None
    db_name: ClassVar[str | None] = None
    
    @classmethod
    def configure(cls, db_url: str, db_name: str):
        """Configure MongoDB connection for synchronous access."""
        cls.db_url = db_url
        cls.db_name = db_name
    
    def _run(self, query_json: str) -> str:
        """Execute query using synchronous MongoDB client."""
        if self.db_url is None or self.db_name is None:
            return "Error: MongoDB not configured"
        
        try:
            # ⭐ Create synchronous client for tool execution
            client = MongoClient(self.db_url, serverSelectionTimeoutMS=5000)
            db = client[self.db_name]
            profiles = db["profiles"]
            
            # Parse query from JSON string
            query = json.loads(query_json)
            
            start = time.time()
            
            # Count documents (synchronous)
            count = profiles.count_documents(query)
            query_time_ms = int((time.time() - start) * 1000)
            
            # Get samples
            samples = []
            if count > 0:
                cursor = profiles.find(query).limit(3)
                for doc in cursor:
                    samples.append({
                        "title": doc.get("title", "N/A"),
                        "location": doc.get("location", "N/A"),
                        "industry": doc.get("current_industry", "N/A"),
                        "seniority": doc.get("seniority_level", "N/A"),
                        "experience_years": doc.get("experience_years", "N/A")
                    })
            
            result = {
                "result_count": count,
                "query_time_ms": query_time_ms,
                "samples": samples,
                "performance": "GOOD" if query_time_ms < 2000 else "SLOW"
            }
            
            # Close client
            client.close()
            
            return json.dumps(result, indent=2)
            
        except Exception as e:
            return f"Error executing query: {str(e)}"


# ⭐ NEW TOOL: Sample Documents Tool
class SampleDocumentsInput(BaseModel):
    """Input for sample documents tool."""
    query_json: str = Field(description="MongoDB query as JSON string")
    limit: int = Field(default=5, description="Number of documents to return")


class SampleDocumentsTool(BaseTool):
    """Tool to fetch sample documents from database."""
    
    name: str = "Sample Documents"
    description: str = (
        "Fetch sample candidate documents from the database. "
        "Use this to examine actual candidate profiles that match your criteria. "
        "Returns full document details including skills, experience, etc."
    )
    args_schema: type[BaseModel] = SampleDocumentsInput
    
    db_url: ClassVar[str | None] = None
    db_name: ClassVar[str | None] = None
    
    @classmethod
    def configure(cls, db_url: str, db_name: str):
        """Configure MongoDB connection."""
        cls.db_url = db_url
        cls.db_name = db_name
    
    def _run(self, query_json: str, limit: int = 5) -> str:
        """Fetch sample documents."""
        if self.db_url is None or self.db_name is None:
            return "Error: MongoDB not configured"
        
        try:
            # Create synchronous client
            client = MongoClient(self.db_url, serverSelectionTimeoutMS=5000)
            db = client[self.db_name]
            profiles = db["profiles"]
            
            # Parse query
            query = json.loads(query_json)
            
            # Fetch documents
            cursor = profiles.find(query).limit(min(limit, 10))  # Max 10
            samples = []
            
            for doc in cursor:
                samples.append({
                    "name": f"{doc.get('first_name', '')} {doc.get('last_name', '')}".strip(),
                    "title": doc.get("title", "N/A"),
                    "location": doc.get("location", "N/A"),
                    "industry": doc.get("current_industry", "N/A"),
                    "seniority": doc.get("seniority_level", "N/A"),
                    "experience_years": doc.get("experience_years", 0),
                    "expertise": doc.get("expertise", [])[:10],  # First 10 skills
                    "current_company": doc.get("current_company", "N/A"),
                    "linkedin_url": doc.get("linkedin_url", "")
                })
            
            result = {
                "count": len(samples),
                "samples": samples
            }
            
            client.close()
            
            return json.dumps(result, indent=2)
            
        except Exception as e:
            return f"Error fetching samples: {str(e)}"


# ⭐ NEW TOOL: Query Performance Analyzer
class QueryPerformanceInput(BaseModel):
    """Input for query performance tool."""
    query_json: str = Field(description="MongoDB query as JSON string")


class QueryPerformanceTool(BaseTool):
    """Tool to analyze query performance."""
    
    name: str = "Query Performance Analyzer"
    description: str = (
        "Analyze the performance of a MongoDB query. "
        "Returns execution time, index usage, and performance recommendations. "
        "Use this to optimize slow queries."
    )
    args_schema: type[BaseModel] = QueryPerformanceInput
    
    db_url: ClassVar[str | None] = None
    db_name: ClassVar[str | None] = None
    
    @classmethod
    def configure(cls, db_url: str, db_name: str):
        """Configure MongoDB connection."""
        cls.db_url = db_url
        cls.db_name = db_name
    
    def _run(self, query_json: str) -> str:
        """Analyze query performance."""
        if self.db_url is None or self.db_name is None:
            return "Error: MongoDB not configured"
        
        try:
            # Create synchronous client
            client = MongoClient(self.db_url, serverSelectionTimeoutMS=5000)
            db = client[self.db_name]
            profiles = db["profiles"]
            
            # Parse query
            query = json.loads(query_json)
            
            # Get explain plan
            start = time.time()
            explain = profiles.find(query).explain()
            explain_time = int((time.time() - start) * 1000)
            
            # Analyze execution stats
            execution_stats = explain.get("executionStats", {})
            
            result = {
                "execution_time_ms": execution_stats.get("executionTimeMillis", 0),
                "documents_examined": execution_stats.get("totalDocsExamined", 0),
                "documents_returned": execution_stats.get("nReturned", 0),
                "index_used": "Yes" if "IXSCAN" in str(explain) else "No",
                "performance_rating": self._rate_performance(execution_stats),
                "recommendations": self._get_recommendations(query, execution_stats)
            }
            
            client.close()
            
            return json.dumps(result, indent=2)
            
        except Exception as e:
            return f"Error analyzing query: {str(e)}"
    
    def _rate_performance(self, stats: Dict) -> str:
        """Rate query performance."""
        exec_time = stats.get("executionTimeMillis", 0)
        docs_examined = stats.get("totalDocsExamined", 0)
        docs_returned = stats.get("nReturned", 1)
        
        if exec_time < 100:
            return "EXCELLENT"
        elif exec_time < 1000:
            return "GOOD"
        elif exec_time < 5000:
            return "ACCEPTABLE"
        else:
            return "POOR"
    
    def _get_recommendations(self, query: Dict, stats: Dict) -> List[str]:
        """Generate performance recommendations."""
        recommendations = []
        
        exec_time = stats.get("executionTimeMillis", 0)
        docs_examined = stats.get("totalDocsExamined", 0)
        
        if exec_time > 2000:
            recommendations.append("Query is slow - consider adding indexes or simplifying criteria")
        
        if docs_examined > 100000:
            recommendations.append("Too many documents scanned - use more restrictive filters")
        
        if "$regex" in str(query) and "$or" in str(query):
            recommendations.append("Avoid OR with regex - use separate indexed queries instead")
        
        if not recommendations:
            recommendations.append("Query performance is acceptable")
        
        return recommendations