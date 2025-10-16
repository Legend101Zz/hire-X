"""
Scorecard-based collaborative search workflow.
Handles Phase 1: Building and refining scorecards through conversation.
"""
import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ai_model import Model
from pymongo import MongoClient
from query_builder import IntelligentQueryBuilder
from redis_manager import RedisManager


class ScorecardWorkflow:
    """Manages the collaborative scorecard building process."""
    
    def __init__(self, redis_manager: RedisManager):
        self.redis_manager = redis_manager
        self.model = Model()
        self.query_builder = IntelligentQueryBuilder()
        
        # Connect to neuraleap database for scorecard storage
        neuraleap_db_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
        neuraleap_db_name = os.getenv("DATABASE_NAME", "neuraleap")
        client = MongoClient(neuraleap_db_url)
        self.db = client[neuraleap_db_name]
        self.scorecards_collection = self.db["scorecards"]
        
        # Create indexes
        self.scorecards_collection.create_index("scorecard_id", unique=True)
        self.scorecards_collection.create_index("session_id")
        self.scorecards_collection.create_index([("username", 1), ("created_at", -1)])
    
    async def start_scorecard_building(
        self, 
        session_id: str, 
        username: str,
        initial_query: str,
        prompt_id: str
    ) -> Dict[str, Any]:
        """
        Phase 1: Extract entities and create draft scorecard.
        
        Returns:
            Dict with draft scorecard and initial LLM message
        """
        print(f"\n{'='*80}")
        print(f"🎯 Phase 1: Entity Extraction & Draft Scorecard")
        print(f"{'='*80}")
        print(f"Session: {session_id}")
        print(f"Query: {initial_query}")
        
        # Step 1: Extract entities from initial query
        entities = await self._extract_entities(initial_query)
        print(f"\n✅ Extracted entities: {json.dumps(entities, indent=2)}")
        
        # Step 2: Expand concepts using LLM
        expansions = await self._expand_concepts(entities, initial_query)
        print(f"\n✅ Generated expansions")
        
        # Step 3: Build draft scorecard
        draft_scorecard = self._build_draft_scorecard(
            entities=entities,
            expansions=expansions,
            original_query=initial_query
        )
        
        # Step 4: Generate initial validation question
        validation_message = await self._generate_initial_validation_question(
            draft_scorecard,
            initial_query
        )
        
        # Save draft scorecard to session
        scorecard_id = str(uuid.uuid4())
        draft_scorecard["scorecard_id"] = scorecard_id
        draft_scorecard["session_id"] = session_id
        draft_scorecard["username"] = username
        draft_scorecard["prompt_id"] = prompt_id 
        draft_scorecard["status"] = "draft"
        draft_scorecard["created_at"] = datetime.utcnow().isoformat()
        draft_scorecard["updated_at"] = datetime.utcnow().isoformat()
        
        # Store in MongoDB
        self.scorecards_collection.insert_one(draft_scorecard.copy()) 
        
        # Remove MongoDB's _id field if it exists (not JSON serializable)        
        if "_id" in draft_scorecard:
            del draft_scorecard["_id"]
        
        # Also cache in Redis for quick access
        self.redis_manager.store_data(
            session_id,
            "scorecard",
            draft_scorecard
        )
        
        print(f"\n✅ Draft scorecard created: {scorecard_id}")
        
        return {
            "scorecard": draft_scorecard,
            "message": validation_message,
            "phase": "validation"
        }
        
    async def finalize_scorecard(
        self,
        scorecard: Dict[str, Any],
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Final refinement of scorecard based on entire conversation.
        This is called ONCE when user approves samples.
        
        Args:
            scorecard: Current scorecard
            conversation_history: Full conversation for context
            
        Returns:
            Finalized scorecard with optimized expansions
        """
        
        print(f"\n{'='*80}")
        print(f"🎯 FINAL SCORECARD REFINEMENT")
        print(f"{'='*80}")
        
        # Extract key insights from conversation
        conversation_summary = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in conversation_history[-10:]  # Last 10 messages
        ])
        
        system_prompt = """You are finalizing a search scorecard. Based on the entire conversation, optimize the expansions for maximum precision.

    TASK: Review must-have filters and scoring criteria. Refine expansions to be:
    1. Highly relevant to user's stated preferences
    2. Contextually appropriate for the Indian market
    3. Neither too broad nor too narrow

    Consider the conversation:
    - What did the user emphasize?
    - What did they reject or de-emphasize?
    - Any specific companies/industries mentioned?

    Return ONLY optimized expansions as JSON:
    {
    "roles": [...],
    "skills": [...],
    "industries": [...],
    "locations": [...]
    }

    Rules:
    - If must-have filter exists, only include variations (not alternatives)
    - Include Indian-specific terminology
    - Remove any terms user seemed uninterested in
    - Add any specific terms user mentioned positively
    """

        user_message = f"""Scorecard to finalize:
    {json.dumps(scorecard, indent=2)}

    Full conversation context:
    {conversation_summary}

    Generate final optimized expansions:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.3
        )
        
        try:
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            final_expansions = json.loads(response_text)
            
            # Update scorecard
            finalized_scorecard = scorecard.copy()
            finalized_scorecard["expansions"] = final_expansions
            
            # Add finalization record
            if "changeHistory" not in finalized_scorecard:
                finalized_scorecard["changeHistory"] = []
            
            finalized_scorecard["changeHistory"].append({
                "timestamp": datetime.utcnow().isoformat(),
                "source": "ai_finalization",
                "changes": [{"section": "expansions", "field": "all", "action": "finalize"}],
                "snapshot": {
                    "mustHaveFilters": finalized_scorecard["mustHaveFilters"],
                    "scoringCriteria": finalized_scorecard["scoringCriteria"],
                    "expansions": final_expansions,
                    "threshold": finalized_scorecard["threshold"]
                }
            })
            
            print(f"✅ Scorecard finalized with optimized expansions")
            return finalized_scorecard
            
        except Exception as e:
            print(f"❌ Error finalizing scorecard: {e}")
            # Return scorecard as-is if finalization fails
            return scorecard
    
    
    async def get_sample_candidates(
        self,
        session_id: str,
        sample_size: int = 5
    ) -> Dict[str, Any]:
        """
        Get sample candidates using 2-strategy search.
        
        Strategy:
        1. Try STRICT search (all filters must match)
        2. If no results, try RELAXED search (location mandatory + broad keywords)
        3. If still no results, ask AI for suggestions
        """
        
        scorecard = self.redis_manager.get_data(session_id, "scorecard")
        
        if not scorecard:
            return {"error": "No scorecard found"}
        
        print(f"\n{'='*80}")
        print(f"🔍 INTELLIGENT SEARCH")
        print(f"{'='*80}")
        
        filters = scorecard.get("mustHaveFilters", [])
        expansions = scorecard.get("expansions", {})
        scoring_criteria = scorecard.get("scoringCriteria", [])
        threshold = scorecard.get("threshold", 0)
        
        # Connect to profiles database
        profiles_db_url = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017/")
        profiles_db_name = os.getenv("PROFILES_DB_NAME", "profiles")
        client = MongoClient(profiles_db_url)
        profiles_db = client[profiles_db_name]
        profiles_collection = profiles_db["profiles"]
        
        # ===================================================================
        # STRATEGY 1: STRICT SEARCH (AI-Assisted)
        # ===================================================================
        print("\n📍 STRATEGY 1: Strict search (ALL criteria must match)...")
        
        try:
            strict_query = await self.query_builder.build_query_with_strategy(
                filters, expansions, strategy="strict"
            )
            
            print(f"Query: {json.dumps(strict_query, indent=2)}")
            
            candidates_cursor = profiles_collection.find(strict_query).limit(sample_size * 10)
            candidates = list(candidates_cursor)
            
            print(f"✅ Found {len(candidates)} candidates")
            
            if len(candidates) >= 10:  # Good number of results
                result = await self._score_and_return_samples(
                    candidates, scoring_criteria, expansions, threshold, sample_size,
                    message=f"Found {len(candidates)} candidates matching all your criteria! 🎯"
                )
                
                # ✅ STORE IN REDIS
                if result.get("samples"):
                    self.redis_manager.store_data(session_id, "sample_candidates", result["samples"])
                    print(f"✅ Stored {len(result['samples'])} samples in Redis (strict search)")
                
                return result
        
        except Exception as e:
            print(f"❌ Strict search failed: {e}")
        
        # ===================================================================
        # STRATEGY 2: RELAXED SEARCH (AI-Assisted)
        # ===================================================================
        print("\n📍 STRATEGY 2: Relaxed search (location mandatory + broad keyword matching)...")
        
        try:
            relaxed_query = await self.query_builder.build_query_with_strategy(
                filters, expansions, strategy="relaxed"
            )
            
            print(f"Query: {json.dumps(relaxed_query, indent=2)}")
            
            candidates_cursor = profiles_collection.find(relaxed_query).limit(sample_size * 20)
            candidates = list(candidates_cursor)
            
            print(f"✅ Found {len(candidates)} candidates")
            
            if len(candidates) > 0:
                # Score them all
                scored_candidates = []
                for candidate in candidates:
                    score_data = self._score_candidate(candidate, scoring_criteria, expansions)
                    clean_candidate = self._convert_objectid_to_string(candidate)
                    
                    scored_candidates.append({
                        "profile": clean_candidate,
                        "score": score_data["total_score"],
                        "max_score": score_data["max_score"],
                        "score_breakdown": score_data["breakdown"]
                    })
                
                # Sort by score
                scored_candidates.sort(key=lambda x: x["score"], reverse=True)
                
                # Check if any meet threshold
                above_threshold = [c for c in scored_candidates if c["score"] >= threshold]
                
                if len(above_threshold) >= sample_size:
                    result = {
                        "samples": above_threshold[:sample_size],
                        "total_matches": len(above_threshold),
                        "message": f"Found {len(above_threshold)} candidates! Used relaxed criteria to cast a wider net. 🔍"
                    }
                    
                    # ✅ STORE IN REDIS
                    self.redis_manager.store_data(session_id, "sample_candidates", result["samples"])
                    print(f"✅ Stored {len(result['samples'])} samples in Redis (relaxed search - above threshold)")
                    
                    return result
                else:
                    # Return best matches even if below threshold
                    top_candidates = scored_candidates[:sample_size]
                    highest_score = top_candidates[0]["score"] if top_candidates else 0
                    
                    result = {
                        "samples": top_candidates,
                        "total_matches": len(scored_candidates),
                        "below_threshold": True,
                        "highest_score": highest_score,
                        "threshold": threshold,
                        "message": f"⚠️ Found {len(candidates)} candidates, but highest score is {highest_score}/{threshold}. Here are the best matches. Consider lowering your threshold."
                    }
                    
                    # ✅ STORE IN REDIS (even if below threshold)
                    self.redis_manager.store_data(session_id, "sample_candidates", result["samples"])
                    print(f"✅ Stored {len(result['samples'])} samples in Redis (relaxed search - below threshold)")
                    
                    return result
        
        except Exception as e:
            print(f"❌ Relaxed search failed: {e}")
        
        
        except Exception as e:
            print(f"❌ AI suggestion failed: {e}")
            return {
                "samples": [],
                "total_matches": 0,
                "no_results": True,
                "message": "😔 No candidates found. Try:\n• Broadening location\n• Relaxing skill requirements\n• Lowering experience needs"
            }
        
    # At the end of _score_and_return_samples, before return:
    async def _score_and_return_samples(
        self,
        candidates: List[Dict[str, Any]],
        scoring_criteria: List[Dict[str, Any]],
        expansions: Dict[str, List[str]],
        threshold: int,
        sample_size: int,
        message: str
    ) -> Dict[str, Any]:
        """
        Score candidates and return top samples.
        """
        scored_candidates = []
        
        for candidate in candidates:
            score_data = self._score_candidate(candidate, scoring_criteria, expansions)
            clean_candidate = self._convert_objectid_to_string(candidate)
            
            if score_data["total_score"] >= threshold:
                scored_candidates.append({
                    "profile": clean_candidate,
                    "score": score_data["total_score"],
                    "max_score": score_data["max_score"],
                    "score_breakdown": score_data["breakdown"]
                })
        
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = scored_candidates[:sample_size]
        
        print(f"✅ {len(scored_candidates)} candidates above threshold of {threshold}")
        print(f"✅ Returning top {len(top_candidates)} samples")
        
        print(f"✅ {len(scored_candidates)} candidates above threshold of {threshold}")
        print(f"✅ Returning top {len(top_candidates)} samples")
        
        return {
            "samples": top_candidates,
            "total_matches": len(scored_candidates),
            "message": message
        }
        
    async def _extract_entities(self, query: str) -> Dict[str, Any]:
        """Extract key entities from the user's initial query."""
        
        system_prompt = """You are an expert HR recruiter specializing in the Indian job market. Extract structured information from job search queries.

IMPORTANT - INDIAN CONTEXT:
- For locations: Only suggest cities/states in India (Mumbai, Delhi, Bangalore, Gurgaon, Pune, Hyderabad, Chennai, Kolkata, etc.)
- For industries: Consider Indian market sectors (IT Services, BFSI, E-commerce, Pharmaceuticals, Manufacturing, etc.)
- For companies: Include major Indian companies (TCS, Infosys, Wipro, Reliance, HDFC, Flipkart, etc.)

Extract these fields:
- role: Job title or function (e.g., "Backend Engineer", "Sales Manager")
- location: City/state in India
- skills: Technical or domain skills mentioned
- experience_level: Seniority mentioned (junior, mid, senior, lead, etc.)
- industry: Industry or domain (e.g., "fintech", "e-commerce", "jewelry retail")
- education: Education requirements if mentioned
- company_preferences: Specific companies or company types mentioned

Return ONLY a JSON object with these fields. Use null for missing information.
Do not include any explanation or markdown formatting."""

        user_message = f"Query: {query}\n\nExtract entities as JSON:"
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.1
        )
        
        # Parse JSON from response
        try:
            # Try to find JSON in response
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            entities = json.loads(response_text)
            return entities
        except Exception as e:
            print(f"❌ Error parsing entities: {e}")
            print(f"Response was: {response}")
            # Return empty dict if parsing fails
            return {}
    
    async def _expand_concepts(
        self, 
        entities: Dict[str, Any],
        original_query: str
    ) -> Dict[str, List[str]]:
        """Use LLM to expand concepts into searchable variations."""
        
        system_prompt = """You are an expert at understanding the Indian job market and terminology. 
Given extracted entities from a job search, expand each concept into variations relevant to India.

INDIAN MARKET CONTEXT:
- For roles: Include Indian job title variations and local terminology
- For skills: Include tools/technologies popular in India
- For industries: Suggest specific Indian companies in that sector
- For locations: Suggest nearby Indian cities in the same region (e.g., Gurgaon → Delhi NCR, Noida, Faridabad)

For roles: Include synonymous titles, related positions, and common variations in Indian companies
For skills: Include alternative names, related technologies, common abbreviations
For industries: Include specific well-known INDIAN companies in that industry, related sectors
For locations: Include alternative spellings of Indian cities, nearby cities in same region

Return ONLY a JSON object with this structure:
{
  "roles": ["variation1", "variation2", ...],
  "skills": ["variation1", "variation2", ...],
  "industries": ["Indian Company 1", "Indian Company 2", ...],
  "locations": ["location1", "location2", ...]
}

Be comprehensive but relevant to the Indian market. Do not include international companies unless specifically asked."""

        user_message = f"""Original query: {original_query}

Extracted entities: {json.dumps(entities, indent=2)}

Generate expansions as JSON:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.3
        )
        
        # Parse JSON
        try:
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            expansions = json.loads(response_text)
            return expansions
        except Exception as e:
            print(f"❌ Error parsing expansions: {e}")
            return {"roles": [], "skills": [], "industries": [], "locations": []}
    
    def _build_draft_scorecard(
        self,
        entities: Dict[str, Any],
        expansions: Dict[str, List[str]],
        original_query: str
    ) -> Dict[str, Any]:
        """Build initial scorecard structure from entities and expansions."""
        
        scorecard = {
            "mustHaveFilters": [],
            "scoringCriteria": [],
            "expansions": expansions,
            "threshold": 50,  # Default threshold
            "metadata": {
                "originalQuery": original_query,
                "entities": entities
            },
            "changeHistory": []   # Track all changes for audit/rollback
        }
        
        # Build must-have filters (location is usually must-have)
        if entities.get("location"):
            scorecard["mustHaveFilters"].append({
                "field": "location",
                "operator": "contains",
                "value": entities["location"],
                "description": f"Located in {entities['location']}"
            })
        
        # Build scoring criteria
        # Role/Title scoring
        if entities.get("role") or expansions.get("roles"):
            role_keywords = [entities.get("role")] if entities.get("role") else []
            role_keywords.extend(expansions.get("roles", []))
            role_keywords = [r for r in role_keywords if r]  # Remove None/empty
            
            if role_keywords:
                scorecard["scoringCriteria"].append({
                    "description": "Relevant job title/role",
                    "fields": ["title"],
                    "keywords": role_keywords,
                    "points": 30
                })
        
        # Skills scoring
        if entities.get("skills") or expansions.get("skills"):
            skill_keywords = []
            if entities.get("skills"):
                if isinstance(entities["skills"], list):
                    skill_keywords.extend(entities["skills"])
                else:
                    skill_keywords.append(entities["skills"])
            skill_keywords.extend(expansions.get("skills", []))
            skill_keywords = [s for s in skill_keywords if s]
            
            if skill_keywords:
                scorecard["scoringCriteria"].append({
                    "description": "Required technical skills",
                    "fields": ["expertise", "title"],
                    "keywords": skill_keywords,
                    "points": 30
                })
        
        # Industry scoring
        if entities.get("industry") or expansions.get("industries"):
            industry_keywords = [entities.get("industry")] if entities.get("industry") else []
            industry_keywords.extend(expansions.get("industries", []))
            industry_keywords = [i for i in industry_keywords if i]
            
            if industry_keywords:
                scorecard["scoringCriteria"].append({
                    "description": "Industry experience",
                    "fields": ["current_industry"],
                    "keywords": industry_keywords,
                    "points": 20
                })
        
        # Experience level scoring (if mentioned)
        if entities.get("experience_level"):
            scorecard["scoringCriteria"].append({
                "description": f"{entities['experience_level']} level experience",
                "fields": ["title", "seniority_level"],
                "keywords": [entities["experience_level"]],
                "points": 20
            })
        
        return scorecard
    
    async def _generate_initial_validation_question(
        self,
        draft_scorecard: Dict[str, Any],
        original_query: str
    ) -> str:
        """Generate a friendly, conversational first question."""
        
        system_prompt = """You are a helpful friend who happens to be amazing at recruiting. You're chatting with a colleague who needs to find some great candidates.

    Your personality:
    - Warm, friendly, and enthusiastic
    - Use casual language (like "awesome", "great", "perfect")
    - Occasionally use relevant emojis (but don't overdo it - 1-2 max)
    - Sound excited to help
    - Make this feel like a coffee chat, not a formal interview

    Your job right now:
    1. Show genuine excitement about helping them
    2. Quickly summarize what you understood in a friendly way (2-3 sentences max)
    3. Ask ONE specific question to clarify the most important thing
    4. Keep it light and conversational

    Format tips:
    - Use markdown for emphasis (**bold**)
    - Keep paragraphs short and punchy
    - Use friendly transitions like "So...", "By the way...", "Quick question..."
    - Avoid corporate jargon

    Example tone: "Hey! So you're looking for a Senior Backend Engineer - that's awesome! 🎯 I'm thinking someone with Go experience in Gurgaon, right? Quick question - are we talking about someone who's a Go expert, or is it okay if they're strong in another backend language and willing to pick up Go?"

    Keep it SHORT and friendly. This is a conversation, not a report."""

        entities = draft_scorecard.get("metadata", {}).get("entities", {})
        
        # Extract key info in a simple way
        role = entities.get("role", "the role")
        location_filter = next((f for f in draft_scorecard.get("mustHaveFilters", []) if f.get("field") == "location"), None)
        location = location_filter.get("value") if location_filter else "any location"
        
        # Get top skills mentioned
        skills_criteria = [sc for sc in draft_scorecard.get("scoringCriteria", []) if "skill" in sc.get("description", "").lower()]
        top_skills = []
        if skills_criteria:
            top_skills = skills_criteria[0].get("keywords", [])[:3]
        
        user_message = f"""Original request: "{original_query}"

    What I understood:
    - Role: {role}
    - Location: {location}
    - Key skills: {', '.join(top_skills) if top_skills else 'not specified yet'}

    Generate your friendly, conversational first message with ONE key validation question:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.9  # Higher temperature for more personality
        )
        
        return response.strip()


    async def process_user_feedback(
        self,
        session_id: str,
        user_message: str,
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Process feedback with a friendly, conversational flow."""
        
        current_scorecard = self.redis_manager.get_data(session_id, "scorecard")
        user_wants_samples = self._detect_sample_intent(user_message)
        
        if not current_scorecard:
            return {"error": "No scorecard found for this session"}
        
        if user_wants_samples:
            return {
                "scorecard": current_scorecard,
                "message": "Awesome! Let me find some sample candidates for you. 🎯",
                "phase": "ready_for_samples",
                "ready": True
            }
        
        system_prompt = """You are a helpful friend who's great at recruiting in India, having a casual conversation with a colleague.

YOUR CONTEXT: You're helping them find candidates in the INDIAN job market.

Your personality:
- Warm, enthusiastic, and supportive
- Use casual, friendly language
- Occasionally use emojis (1-2 max per message)
- Show you're listening and understanding
- Celebrate progress ("Nice!", "Love it!", "Perfect!")
- Keep things light and conversational

IMPORTANT: NEVER say you're ready to search or that the criteria is finalized. ALWAYS ask another clarifying question unless they explicitly say they want to see sample candidates.

Based on what they just told you:
1. Acknowledge their response warmly (like "Got it!", "Makes sense!", "Nice!")
2. Maybe add a brief friendly comment if relevant
3. Ask the NEXT important question to refine the search further

Response format (JSON):
{
  "understanding": "One casual sentence about what they told you",
  "changes": ["technical list of changes to make to the scorecard"],
  "wants_samples": false,  // Set to true if they want to see samples
  "next_message": "Your friendly response in markdown. Keep it SHORT and conversational. ALWAYS ask another question. Add 1-2 emojis if it feels natural."
}

Questions to explore (in order of priority):
1. Location specifics (exact city, willing to relocate, remote work)
2. Experience level requirements (years, seniority)
3. Must-have vs nice-to-have skills
4. Industry/company type preferences
5. Education requirements
6. Salary expectations (if relevant)
7. Specific certifications or qualifications
8. Team size or company stage preferences

If they say things like:
- "Looks good, show me some candidates"
- "I think we're ready"
- "Let's see some samples"
- "Find me some people"
- "Good to go" or anything else that indicates they wany to see samples 

Then set wants_samples to true and say something like:
"Perfect! Let me find some great candidates for you. 🚀"

Otherwise, keep asking clarifying questions.

Guidelines for your message:
- Start with a warm acknowledgment ("Perfect!", "Got it!", "Awesome!")
- Keep paragraphs short (1-3 sentences max)
- Use "we" and "us" (collaborative feel)
- Ask questions naturally, like you would to a friend
- NEVER say "Ready to search" - keep the conversation going!
- Avoid: formal language, long explanations, multiple questions at once

Example responses:

User says: "Senior level, 5+ years"
You say: "Perfect! So we're targeting folks with solid experience. 👍

Quick question - for the location in Mumbai, are you open to candidates from the surrounding areas like Navi Mumbai or Thane? Or strictly Mumbai city?"

User says: "Mumbai only"
You say: "Got it, keeping it to Mumbai city! 

What about their current industry - any preference? Like are fintech folks better than e-commerce, or doesn't really matter as long as they have the skills?"

Keep it friendly, SHORT, and natural!"""

        # Build context
        scorecard_summary = {
            "current_filters": [f["description"] for f in current_scorecard.get("mustHaveFilters", [])],
            "scoring_focus": [{"what": sc["description"], "weight": sc["points"]} 
                            for sc in current_scorecard.get("scoringCriteria", [])[:3]],  # Top 3
        }
        
        # Get recent conversation (last 2 exchanges)
        recent_messages = conversation_history[-4:] if len(conversation_history) > 4 else conversation_history
        conversation_context = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in recent_messages
        ])
        
        user_message_full = f"""Current search criteria:
    {json.dumps(scorecard_summary, indent=2)}

    Recent conversation:
    {conversation_context}

    What they just said: "{user_message}"

    Generate your friendly response (remember: warm, brief, ONE question or confirmation):"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message_full,
            temperature=0.7
        )
        
        try:
            # Parse JSON response
            response_text = response.strip()
            
            # Handle code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            analysis = json.loads(response_text)
            
            # Apply changes to scorecard
            updated_scorecard = await self._apply_scorecard_changes(
                current_scorecard,
                analysis.get("changes", []),
                    refine_expansions=False 
            )
            
            updated_scorecard["updated_at"] = datetime.utcnow().isoformat()
            
            # Save to database
            self.scorecards_collection.update_one(
                {"scorecard_id": updated_scorecard["scorecard_id"]},
                {"$set": updated_scorecard}
            )
            
            # Remove MongoDB _id
            if "_id" in updated_scorecard:
                del updated_scorecard["_id"]
            
            # Cache in Redis
            self.redis_manager.store_data(session_id, "scorecard", updated_scorecard)
            
            if analysis.get("wants_samples", False):
                return {
                    "scorecard": current_scorecard,
                    "message": analysis.get("next_message", "Awesome! Let me find some sample candidates for you. 🎯"),
                    "phase": "ready_for_samples",
                    "ready": True
                }
            
            return {
                "scorecard": updated_scorecard,
                "message": analysis.get("next_message", "What else should we fine-tune?"),
                "phase": "validation",
                "ready": False # Never auto-ready
            }
                
        except Exception as e:
            print(f"❌ Error processing feedback: {e}")
            print(f"Response was: {response}")
            
            # Friendly fallback
            return {
                "scorecard": current_scorecard,
                "message": "Got it! Anything else you'd like me to adjust? 😊",
                "phase": "validation",
                "ready": False
            }
            
    async def _apply_scorecard_changes(
        self,
        scorecard: Dict[str, Any],
        changes: List[str] , # List of natural language change descriptions
        refine_expansions: bool = False 
    ) -> Dict[str, Any]:
        """
        Apply requested changes to the scorecard using LLM to parse changes.
        Returns updated scorecard with change details for animation.
        
        Args:
        refine_expansions: If True, refine expansions after applying changes
        """
        
        if not changes or len(changes) == 0:
            return scorecard
        
        # Use LLM to convert natural language changes to structured updates
        system_prompt = """You are a scorecard update parser. Given a current scorecard and list of requested changes, output the exact updates needed.

    INDIAN CONTEXT: When suggesting values, use Indian cities, companies, and market context.

    Current scorecard structure:
    - mustHaveFilters: [{field, operator, value, description}]
    - scoringCriteria: [{description, keywords, fields, points}]
    - expansions: {roles: [], skills: [], industries: [], locations: []}
    - threshold: number

    For each change, determine:
    1. Which section to update (filters, scoring, expansions, threshold)
    2. What operation (add, modify, remove)
    3. Exact values to use

    Return JSON:
    {
    "updates": [
        {
        "section": "mustHaveFilters" | "scoringCriteria" | "expansions" | "threshold",
        "action": "add" | "modify" | "remove",
        "target": "index or field name",
        "value": "new value or object",
        "field_changed": "specific field name for animation"
        }
    ]
    }

    Examples:

    Change: "Set minimum experience to 5 years"
    Output: {
    "updates": [{
        "section": "mustHaveFilters",
        "action": "add",
        "value": {
        "field": "experience_years",
        "operator": ">=",
        "value": 5,
        "description": "Minimum 5 years experience"
        },
        "field_changed": "experience_years"
    }]
    }

    Change: "Increase Go skill points to 40"
    Output: {
    "updates": [{
        "section": "scoringCriteria",
        "action": "modify",
        "target": 0,  // index of criteria with Go
        "value": {"points": 40},
        "field_changed": "points"
    }]
    }"""

        user_message = f"""Current scorecard:
    {json.dumps(scorecard, indent=2)}

    Requested changes:
    {json.dumps(changes, indent=2)}

    Parse these changes into structured updates:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.1
        )
        
        try:
            # Parse JSON response
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            updates_data = json.loads(response_text)
            updates = updates_data.get("updates", [])
            
            # Apply updates
            updated_scorecard = scorecard.copy()
            changed_fields = []  # Track for animation
            
            for update in updates:
                section = update.get("section")
                action = update.get("action")
                value = update.get("value")
                target = update.get("target")
                field_changed = update.get("field_changed")
                
                if field_changed:
                    changed_fields.append({
                        "section": section,
                        "field": field_changed,
                        "action": action
                    })
                
                if section == "mustHaveFilters":
                    if action == "add":
                        updated_scorecard["mustHaveFilters"].append(value)
                    elif action == "modify" and target is not None:
                        updated_scorecard["mustHaveFilters"][target].update(value)
                    elif action == "remove" and target is not None:
                        updated_scorecard["mustHaveFilters"].pop(target)
                
                elif section == "scoringCriteria":
                    if action == "add":
                        updated_scorecard["scoringCriteria"].append(value)
                    elif action == "modify" and target is not None:
                        updated_scorecard["scoringCriteria"][target].update(value)
                    elif action == "remove" and target is not None:
                        updated_scorecard["scoringCriteria"].pop(target)
                
                elif section == "expansions":
                    if action == "add" or action == "modify":
                        updated_scorecard["expansions"].update(value)
                
                elif section == "threshold":
                    if action == "modify":
                        updated_scorecard["threshold"] = value
                        
            change_record = {
                "timestamp": datetime.utcnow().isoformat(),
                "source": "ai",  # or "user" when user makes direct edits
                "changes": changed_fields,
                "snapshot": {
                    "mustHaveFilters": updated_scorecard["mustHaveFilters"],
                    "scoringCriteria": updated_scorecard["scoringCriteria"],
                    "expansions": updated_scorecard["expansions"],
                    "threshold": updated_scorecard["threshold"]
                }
            }

            if "changeHistory" not in updated_scorecard:
                updated_scorecard["changeHistory"] = []

            updated_scorecard["changeHistory"].append(change_record)

            # Keep only last 10 changes to avoid bloat
            if len(updated_scorecard["changeHistory"]) > 10:
                updated_scorecard["changeHistory"] = updated_scorecard["changeHistory"][-10:]
            
            if refine_expansions:
                print("🔄 Refining expansions based on changes...")
                refined_expansions = await self._refine_expansions_based_on_filters(updated_scorecard)
                updated_scorecard["expansions"] = refined_expansions
            
            # Store changed fields for frontend animation
            updated_scorecard["_changes"] = changed_fields
            
            return updated_scorecard
            
        except Exception as e:
            print(f"❌ Error applying changes: {e}")
            print(f"Response was: {response}")
            return scorecard
    
    async def _call_llm(
        self,
        system_prompt: str,
        user_message: str,
        temperature: float = 0.7
    ) -> str:
        """Call OpenRouter API via the Model class."""
        
        # Use the existing Model class but with a custom prompt
        import requests
        
        url = "https://openrouter.ai/api/v1/chat/completions"
        api_key = os.getenv("OPENROUTER_API_KEY")
        model_name = os.getenv("AI_MODEL_NAME", "openai/gpt-4o-mini")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
        }
        
        data = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            "temperature": temperature
        }
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"❌ LLM API error: {e}")
            return ""
        
        
    def _detect_sample_intent(self, user_message: str) -> bool:
        """
        Detect if user wants to see sample candidates.
        
        Args:
            user_message: User's message
            
        Returns:
            True if user wants samples
        """
        # Keywords that indicate user wants to proceed
        sample_keywords = [
            'show me', 'find some', 'see samples', 'see candidates',
            'looks good', 'sounds good', 'good to go', 'ready',
            'proceed', 'search', 'find candidates', 'get candidates',
            'show candidates', 'start search', "let's go", "let's start"
        ]
        
        user_lower = user_message.lower()
        
        # Check for any matching keywords
        return any(keyword in user_lower for keyword in sample_keywords)
    
    async def _refine_expansions_based_on_filters(
        self,
        scorecard: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """
        Refine expansions based on must-have filters.
        If something is a must-have, we should only expand to variations, not alternatives.
        
        Example:
        - Must-have: location = "Delhi" → Expand to: Delhi, NCR, New Delhi, DEL
        - Must-have: skill = "Go" → Expand to: Golang, Go Programming, Go Lang (NOT Java, Python)
        
        Returns:
            Refined expansions dictionary
        """
        
        must_have_filters = scorecard.get("mustHaveFilters", [])
        current_expansions = scorecard.get("expansions", {})
        
        # If no must-have filters, return current expansions
        if not must_have_filters:
            return current_expansions
        
        # Build context for LLM
        filter_context = []
        for f in must_have_filters:
            filter_context.append(f"{f.get('field')}: {f.get('value')} ({f.get('operator')})")
        
        system_prompt = """You are an expansion refiner. Given must-have filters, refine expansions to ONLY include variations of the required values, NOT alternatives.

    RULES:
    1. If location is must-have → only expand to spelling variations, abbreviations, nearby areas
    2. If skill is must-have → only expand to different names for SAME skill (e.g., Go → Golang, Go Programming)
    3. If industry is must-have → only expand to sub-sectors within that industry
    4. DO NOT expand to alternatives (if they want "Delhi", don't suggest "Mumbai")

    INDIAN CONTEXT: Use Indian cities, companies, and terminology.

    Return ONLY refined expansions as JSON:
    {
    "roles": [...],
    "skills": [...],
    "industries": [...],
    "locations": [...]
    }"""

        user_message = f"""Must-have requirements (non-negotiable):
    {chr(10).join(filter_context)}

    Current expansions:
    {json.dumps(current_expansions, indent=2)}

    Refine expansions to ONLY include variations of must-have values, not alternatives:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.3
        )
        
        try:
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            refined_expansions = json.loads(response_text)
            print(f"✅ Refined expansions based on must-have filters")
            return refined_expansions
            
        except Exception as e:
            print(f"❌ Error refining expansions: {e}")
            return current_expansions
        
    def _build_mongo_query_from_filters(
            self,
            filters: List[Dict[str, Any]],
            expansions: Dict[str, List[str]]
        ) -> Dict[str, Any]:
            """
            Build MongoDB query from must-have filters with proper expansion mapping.
            
            Args:
                filters: List of filter objects
                expansions: Expansion mappings (with plural keys like "locations", "skills", etc.)
                
            Returns:
                MongoDB query dict
            """
            import re
            
            query_parts = []
            
            # Map singular field names to plural expansion keys
            field_to_expansion_key = {
                "location": "locations",
                "skill": "skills",
                "role": "roles",
                "title": "roles",
                "industry": "industries",
                "current_industry": "industries"
            }
            
            for filter_obj in filters:
                field = filter_obj.get("field")
                operator = filter_obj.get("operator")
                value = filter_obj.get("value")
                
                if not field or not operator or not value:
                    continue
                
                # Get expansions for this field if available
                expanded_values = [value]
                
                # Look up the expansion key (handle singular -> plural mapping)
                expansion_key = field_to_expansion_key.get(field, field)
                if expansion_key in expansions and expansions[expansion_key]:
                    expanded_values.extend(expansions[expansion_key])
                
                # Remove duplicates and empty values
                expanded_values = list(set([v for v in expanded_values if v]))
                
                print(f"🔍 Field '{field}' expanded to: {expanded_values}")
                
                # Build query based on operator
                if operator == "contains":
                    # Case-insensitive regex matching ANY of the expanded values
                    # Match partial strings (e.g., "Mumbai" matches "Mumbai, India")
                    if len(expanded_values) == 1:
                        # Single value - simple regex
                        query_parts.append({
                            field: {
                                "$regex": re.escape(expanded_values[0]),
                                "$options": "i"  # case-insensitive
                            }
                        })
                    else:
                        # Multiple values - OR regex
                        or_conditions = []
                        for v in expanded_values:
                            or_conditions.append({
                                field: {
                                    "$regex": re.escape(v),
                                    "$options": "i"
                                }
                            })
                        query_parts.append({"$or": or_conditions})
                    
                elif operator == "equals":
                    # Exact match (case-insensitive) for any expanded value
                    if len(expanded_values) == 1:
                        query_parts.append({
                            field: {
                                "$regex": f"^{re.escape(expanded_values[0])}$",
                                "$options": "i"
                            }
                        })
                    else:
                        or_conditions = []
                        for v in expanded_values:
                            or_conditions.append({
                                field: {
                                    "$regex": f"^{re.escape(v)}$",
                                    "$options": "i"
                                }
                            })
                        query_parts.append({"$or": or_conditions})
                    
                elif operator == "not_contains":
                    # Does NOT contain any of the values
                    for v in expanded_values:
                        query_parts.append({
                            field: {
                                "$not": {
                                    "$regex": re.escape(v),
                                    "$options": "i"
                                }
                            }
                        })
                    
                elif operator == "in":
                    # Value is comma-separated list
                    if isinstance(value, str):
                        values_list = [v.strip() for v in value.split(",")]
                    else:
                        values_list = [value]
                    
                    or_conditions = []
                    for v in values_list:
                        or_conditions.append({
                            field: {
                                "$regex": re.escape(v),
                                "$options": "i"
                            }
                        })
                    query_parts.append({"$or": or_conditions})
                    
                elif operator == "not_in":
                    # Does NOT match any from comma-separated list
                    if isinstance(value, str):
                        values_list = [v.strip() for v in value.split(",")]
                    else:
                        values_list = [value]
                    
                    for v in values_list:
                        query_parts.append({
                            field: {
                                "$not": {
                                    "$regex": re.escape(v),
                                    "$options": "i"
                                }
                            }
                        })
                    
                elif operator in [">=", "<=", "==", ">", "<"]:
                    # Numeric comparisons
                    try:
                        numeric_value = float(value)
                        if operator == ">=":
                            query_parts.append({field: {"$gte": numeric_value}})
                        elif operator == "<=":
                            query_parts.append({field: {"$lte": numeric_value}})
                        elif operator == ">":
                            query_parts.append({field: {"$gt": numeric_value}})
                        elif operator == "<":
                            query_parts.append({field: {"$lt": numeric_value}})
                        else:  # ==
                            query_parts.append({field: numeric_value})
                    except ValueError:
                        print(f"⚠️ Could not convert {value} to number for {field}")
            
            # Combine all parts with AND
            if len(query_parts) == 0:
                return {}
            elif len(query_parts) == 1:
                return query_parts[0]
            else:
                return {"$and": query_parts}
            
    def _score_candidate(
        self,
        candidate: Dict[str, Any],
        scoring_criteria: List[Dict[str, Any]],
        expansions: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Score a candidate based on scoring criteria.
        
        Args:
            candidate: Candidate profile
            scoring_criteria: List of scoring criteria
            expansions: Expansion mappings
            
        Returns:
            Dict with total_score, max_score, and breakdown
        """
        
        total_score = 0
        max_score = 0
        breakdown = []
        
        for criterion in scoring_criteria:
            description = criterion.get("description", "")
            keywords = criterion.get("keywords", [])
            fields = criterion.get("fields", [])
            points = criterion.get("points", 0)
            
            max_score += points
            
            # Check if any keyword matches any field
            matched = False
            for field in fields:
                field_value = candidate.get(field, "")
                
                if isinstance(field_value, list):
                    field_value = " ".join(field_value)
                else:
                    field_value = str(field_value)
                
                field_value_lower = field_value.lower()
                
                for keyword in keywords:
                    if keyword.lower() in field_value_lower:
                        matched = True
                        break
                
                if matched:
                    break
            
            if matched:
                total_score += points
                breakdown.append({
                    "description": description,
                    "max_points": points,
                    "earned_points": points,
                    "matched": True
                })
            else:
                breakdown.append({
                    "description": description,
                    "max_points": points,
                    "earned_points": 0,
                    "matched": False
                })
        
        return {
            "total_score": total_score,
            "max_score": max_score,
            "breakdown": breakdown
        }


    async def process_sample_rejection(
        self,
        session_id: str,
        feedback: str
    ) -> Dict[str, Any]:
        """
        Process rejection of sample candidates and adjust scorecard.
        
        Args:
            session_id: Session ID
            feedback: User's feedback on why samples were rejected
            
        Returns:
            Updated scorecard and next steps
        """
        
        current_scorecard = self.redis_manager.get_data(session_id, "scorecard")
        iteration_count = self.redis_manager.get_data(session_id, "sample_iteration_count") or 0
        
        if not current_scorecard:
            return {"error": "No scorecard found"}
        
        # Increment iteration count
        iteration_count += 1
        self.redis_manager.store_data(session_id, "sample_iteration_count", iteration_count)
        
        print(f"\n{'='*80}")
        print(f"🔄 Sample Rejection - Iteration {iteration_count}/2")
        print(f"{'='*80}")
        print(f"Feedback: {feedback}")
        
        # Check if we've hit max iterations
        if iteration_count >= 2:
            return {
                "scorecard": current_scorecard,
                "message": "I've tried my best to adjust the criteria, but we don't seem to have candidates that match exactly what you're looking for in our database right now. Would you like to:\n\n1. **Relax some requirements** - Remove or adjust some must-have filters\n2. **Lower the scoring threshold** - Accept candidates with lower scores\n3. **Try a different search** - Start fresh with new criteria\n\nWhat would you prefer? 🤔",
                "phase": "max_iterations_reached",
                "iteration_count": iteration_count
            }
        
        # Use LLM to understand feedback and adjust scorecard
        system_prompt = """You are helping adjust search criteria based on user feedback about sample candidates.

    Your task:
    1. Understand what the user didn't like about the samples
    2. Suggest specific changes to the scorecard to address their concerns
    3. Be conservative - don't remove requirements unless explicitly asked

    Common feedback patterns:
    - "Too junior" → increase seniority requirements or points
    - "Wrong skills" → adjust skill keywords or weights
    - "Too senior" → decrease seniority requirements
    - "Different industry" → adjust industry filters or scoring
    - "Not enough X experience" → add/increase points for X

    Return JSON:
    {
    "understanding": "What I understood from feedback",
    "changes": ["list of specific changes to make"],
    "explanation": "Friendly explanation of changes to user"
    }"""

        user_message = f"""Current scorecard:
    {json.dumps(current_scorecard, indent=2)}

    User feedback about samples: "{feedback}"

    What changes should we make? (Iteration {iteration_count}/2)"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.7
        )
        
        try:
            # Parse response
            response_text = response.strip()
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            analysis = json.loads(response_text)
            
            # Apply changes
            updated_scorecard = await self._apply_scorecard_changes(
                current_scorecard,
                analysis.get("changes", [])
            )
            
            updated_scorecard["updated_at"] = datetime.utcnow().isoformat()
            
            # Save to database
            self.scorecards_collection.update_one(
                {"scorecard_id": updated_scorecard["scorecard_id"]},
                {"$set": updated_scorecard}
            )
            
            # Remove MongoDB _id
            if "_id" in updated_scorecard:
                del updated_scorecard["_id"]
            
            # Cache in Redis
            self.redis_manager.store_data(session_id, "scorecard", updated_scorecard)
            
            message = f"{analysis.get('explanation', 'I adjusted the criteria based on your feedback.')} Let me find new samples for you! 🔍"
            
            return {
                "scorecard": updated_scorecard,
                "message": message,
                "phase": "sample_iteration",
                "iteration_count": iteration_count
            }
            
        except Exception as e:
            print(f"❌ Error processing sample rejection: {e}")
            return {
                "scorecard": current_scorecard,
                "message": "I understand you're not satisfied with these samples. Can you be more specific about what's missing? 🤔",
                "phase": "sample_iteration",
                "iteration_count": iteration_count
            }
            
    def _convert_objectid_to_string(self, data: Any) -> Any:
        """
        Recursively convert MongoDB ObjectId to string for JSON serialization.
        """
        from bson import ObjectId
        
        if isinstance(data, ObjectId):
            return str(data)
        elif isinstance(data, dict):
            return {key: self._convert_objectid_to_string(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._convert_objectid_to_string(item) for item in data]
        else:
            return data