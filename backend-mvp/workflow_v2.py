"""
Workflow with preflight check and incremental AI summaries.
"""
import datetime
import os
import uuid
from typing import Any, Dict, List, Optional

from ai_model import Model
from enhanced_parser import EnhancedPromptParser
from improved_search import ImprovedSearcher
from preflight_check import PreflightChecker
from pymongo import MongoClient
from redis_manager import RedisManager
from scoring import CandidateScorer


class WorkflowV2:
    """Enhanced workflow with smart search and lazy AI summaries."""
    
    def __init__(self, redis_manager: RedisManager):
        self.redis_manager = redis_manager
        self.model = Model()
        
        # Setup components
        self.parser = EnhancedPromptParser(self.model)
        self.scorer = CandidateScorer(self.model)
        
        # Profiles database
        profiles_db_url = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017")
        profiles_db_name = os.getenv("PROFILES_DB_NAME", "mydatabase")
        profiles_client = MongoClient(profiles_db_url)
        self.profiles_db = profiles_client[profiles_db_name]
        self.profiles_collection = self.profiles_db["profiles"]
        
        # Initialize search components
        self.preflight = PreflightChecker(self.profiles_collection)
        self.searcher = ImprovedSearcher(self.profiles_collection)
        
        # Neuraleap database for results
        neuraleap_db_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
        neuraleap_db_name = os.getenv("DATABASE_NAME", "neuraleap")
        neuraleap_client = MongoClient(neuraleap_db_url)
        self.neuraleap_db = neuraleap_client[neuraleap_db_name]
        self.prompts_collection = self.neuraleap_db["prompts"]
        self.users_collection = self.neuraleap_db["users"]
    
    async def execute_search_workflow(self, session_id: str) -> bool:
        """
        Execute the complete search workflow.
        
        Steps:
        1. Parse query with LLM
        2. Run preflight check
        3. Search database (mandatory filters)
        4. Pre-score all profiles (Tier 1)
        5. Generate AI summaries for top 10 (Tier 2)
        6. Store results in MongoDB
        """
        try:
            # Get prompt from Redis
            prompt = self.redis_manager.get_prompt(session_id)
            user_context = self.redis_manager.get_data(session_id, "user_context")
            username = user_context.get("username") if user_context else "unknown"
            
            print(f"🔄 Starting workflow for session: {session_id}")
            
            # Step 1: Parse query
            await self._update_status(session_id, "parsing", "Analyzing your requirements...", 10)
            
            parsed_data = self.parser.parse_with_tiers(prompt)
            await self.redis_manager.store_data(session_id, "parsed_data", parsed_data)
            
            # Step 2: Preflight check
            await self._update_status(session_id, "preflight", "Checking data availability...", 20)
            
            preflight_results = self.preflight.check_query_viability(
                parsed_data["strict_params"]
            )
            
            await self.redis_manager.store_data(session_id, "preflight_results", preflight_results)
            
            # If not viable, pause for user input
            if not preflight_results["viable"]:
                await self._update_status(
                    session_id, 
                    "needs_refinement", 
                    "No results found. Please refine your query.", 
                    25,
                    preflight_results
                )
                return False
            
            # Step 3: Search database
            await self._update_status(session_id, "searching", "Searching candidate database...", 40)
            
            profiles = self.searcher.search_with_mandatory_filters(
                mandatory=parsed_data["strict_params"],
                optional=parsed_data["broad_params"],
                min_results=50
            )
            
            if not profiles:
                await self._update_status(session_id, "error", "No profiles found", 0)
                return False
            
            # Step 4: Pre-score all profiles (FAST)
            await self._update_status(session_id, "scoring", f"Scoring {len(profiles)} candidates...", 60)
            
            for profile in profiles:
                pre_score = self.scorer.calculate_pre_score(profile, parsed_data["scoring_rules"])
                profile["pre_score"] = pre_score
            
            # Sort by pre_score
            profiles.sort(key=lambda x: x.get("pre_score", 0), reverse=True)
            
            # Step 5: Generate AI summaries for top 10 ONLY
            await self._update_status(session_id, "ai_ranking", "AI analyzing top candidates...", 80)
            
            top_10 = profiles[:10]
            ai_summaries = {}
            
            for i, profile in enumerate(top_10):
                print(f"  🤖 Generating AI summary {i+1}/10...")
                summary_data = self.scorer.get_single_ranking(profile, prompt)
                
                profile_id = str(profile.get("_id"))
                ai_summaries[profile_id] = {
                    "final_score": summary_data.get("final_score", profile.get("pre_score", 50)),
                    "summary": summary_data.get("summary", "Good candidate match."),
                    "generated_at": datetime.datetime.utcnow()
                }
                
                # Update profile with AI data
                profile["final_score"] = ai_summaries[profile_id]["final_score"]
                profile["summary"] = ai_summaries[profile_id]["summary"]
            
            # Sort top 10 by final_score
            top_10.sort(key=lambda x: x.get("final_score", 0), reverse=True)
            
            # Step 6: Store in MongoDB
            await self._update_status(session_id, "saving", "Saving results...", 95)
            
            prompt_id = str(uuid.uuid4())
            
            # Prepare matched_profiles (lightweight - just IDs and scores)
            matched_profiles = []
            for profile in profiles:
                matched_profiles.append({
                    "profile_id": str(profile.get("_id")),
                    "pre_score": profile.get("pre_score", 0),
                    "profile_summary": {
                        "name": f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip(),
                        "title": profile.get("title", "N/A"),
                        "location": profile.get("location", "N/A"),
                        "industry": profile.get("current_industry", "N/A")
                    }
                })
            
            # Store in prompts collection
            mongo_document = {
                "prompt_id": prompt_id,
                "session_id": session_id,
                "username": username,
                "prompt": prompt,
                "query_status": "completed",
                
                "preflight_check": {
                    "viable": preflight_results["viable"],
                    "failed_filters": preflight_results.get("failed_filters", {}),
                    "refined_filters": parsed_data["strict_params"]
                },
                
                "matched_profiles": matched_profiles,
                "ai_summaries": ai_summaries,
                
                "summary_generation": {
                    "total_profiles": len(profiles),
                    "summaries_generated": len(ai_summaries),
                    "last_batch_size": 10,
                    "last_generated_at": datetime.datetime.utcnow()
                },
                
                "created_at": datetime.datetime.utcnow(),
                "updated_at": datetime.datetime.utcnow()
            }
            
            self.prompts_collection.insert_one(mongo_document)
            
            # Add prompt_id to user's profile
            self.users_collection.update_one(
                {"username": username},
                {"$push": {"prompts": prompt_id}}
            )
            
            # Store in Redis for quick access
            await self.redis_manager.store_data(session_id, "prompt_id", prompt_id)
            await self.redis_manager.store_data(session_id, "top_results", top_10[:10])
            
            # Step 7: Complete
            await self._update_status(session_id, "completed", "Search completed!", 100)
            
            print(f"✅ Workflow completed for session {session_id}")
            return True
            
        except Exception as e:
            print(f"❌ Workflow error: {e}")
            await self._update_status(session_id, "error", str(e), 0)
            return False
    
    async def generate_more_summaries(self, session_id: str, batch_size: int = 10) -> Dict[str, Any]:
        """
        Generate AI summaries for next batch of profiles.
        Called when user clicks "Load More".
        """
        try:
            # Get prompt document
            prompt_doc = self.prompts_collection.find_one({"session_id": session_id})
            
            if not prompt_doc:
                return {"error": "Session not found"}
            
            # Get profiles that don't have AI summaries yet
            matched_profiles = prompt_doc["matched_profiles"]
            existing_summaries = prompt_doc.get("ai_summaries", {})
            current_count = len(existing_summaries)
            
            # Get next batch
            profiles_to_summarize = matched_profiles[current_count:current_count + batch_size]
            
            if not profiles_to_summarize:
                return {"message": "No more profiles to summarize", "summaries": []}
            
            # Fetch full profile data from profiles DB
            profile_ids = [p["profile_id"] for p in profiles_to_summarize]
            from bson import ObjectId
            full_profiles = list(self.profiles_collection.find({
                "_id": {"$in": [ObjectId(pid) for pid in profile_ids]}
            }))
            
            # Generate AI summaries
            new_summaries = {}
            prompt = prompt_doc["prompt"]
            
            for profile in full_profiles:
                profile_id = str(profile.get("_id"))
                summary_data = self.scorer.get_single_ranking(profile, prompt)
                
                new_summaries[profile_id] = {
                    "final_score": summary_data.get("final_score", 50),
                    "summary": summary_data.get("summary", "Good candidate match."),
                    "generated_at": datetime.datetime.utcnow()
                }
            
            # Update MongoDB with new summaries
            self.prompts_collection.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        f"ai_summaries.{pid}": summary 
                        for pid, summary in new_summaries.items()
                    },
                    "$set": {
                        "summary_generation.summaries_generated": current_count + len(new_summaries),
                        "summary_generation.last_generated_at": datetime.datetime.utcnow(),
                        "updated_at": datetime.datetime.utcnow()
                    }
                }
            )
            
            return {
                "summaries": new_summaries,
                "total_generated": current_count + len(new_summaries),
                "total_profiles": len(matched_profiles)
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    async def _update_status(self, session_id: str, status: str, message: str, progress: int, data: Any = None):
        """Update workflow status in Redis for real-time UI updates."""
        await self.redis_manager.store_data(session_id, "workflow_status", status)
        await self.redis_manager.store_data(session_id, "progress_update", {
            "status": status,
            "message": message,
            "progress": progress,
            "data": data,
            "timestamp": datetime.datetime.utcnow().isoformat()
        })