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
from redis_manager import RedisManager


class ScorecardWorkflow:
    """Manages the collaborative scorecard building process."""
    
    def __init__(self, redis_manager: RedisManager):
        self.redis_manager = redis_manager
        self.model = Model()
        
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
        initial_query: str
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
    
    async def _extract_entities(self, query: str) -> Dict[str, Any]:
        """Extract key entities from the user's initial query."""
        
        system_prompt = """You are an expert HR recruiter. Extract structured information from job search queries.

Extract these fields:
- role: Job title or function (e.g., "Backend Engineer", "Sales Manager")
- location: City/region/country mentioned
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
        
        system_prompt = """You are an expert at understanding job market terminology. 
Given extracted entities from a job search, expand each concept into variations that should be considered equivalent when searching a candidate database.

For roles: Include synonymous titles, related positions, and common variations
For skills: Include alternative names, related technologies, common abbreviations
For industries: Include specific well-known companies in that industry, related sectors
For locations: Include alternative spellings, nearby cities that might be acceptable

Return ONLY a JSON object with this structure:
{
  "roles": ["variation1", "variation2", ...],
  "skills": ["variation1", "variation2", ...],
  "industries": ["company1", "company2", ...],
  "locations": ["location1", "location2", ...]
}

Be comprehensive but relevant. Do not include unrelated terms."""

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
            }
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
        """Generate the first validation question for the user."""
        
        system_prompt = """You are a friendly HR assistant helping refine a candidate search. 
You've created a draft search criteria (scorecard) and need to validate it with the user.

Generate a conversational message that:
1. Briefly summarizes what you understood from their request
2. Shows the key criteria you'll use to find candidates
3. Asks 1-2 specific validation questions about the most important or ambiguous aspects

Keep it friendly, concise, and focused. Don't overwhelm with too many questions at once."""

        scorecard_summary = {
            "filters": draft_scorecard.get("mustHaveFilters", []),
            "scoring": [
                {
                    "description": sc["description"],
                    "points": sc["points"]
                }
                for sc in draft_scorecard.get("scoringCriteria", [])
            ],
            "expansions": draft_scorecard.get("expansions", {})
        }
        
        user_message = f"""Original query: {original_query}

Draft scorecard: {json.dumps(scorecard_summary, indent=2)}

Generate a validation message:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.7
        )
        
        return response.strip()
    
    async def process_user_feedback(
        self,
        session_id: str,
        user_message: str,
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Process user's feedback and update scorecard accordingly.
        
        Returns:
            Dict with updated scorecard and next message
        """
        # Get current scorecard from Redis
        current_scorecard = self.redis_manager.get_data(
            session_id,
            "scorecard"
        )
        
        if not current_scorecard:
            return {
                "error": "No scorecard found for this session"
            }
        
        # Ask LLM to interpret the feedback and suggest scorecard updates
        system_prompt = """You are an HR assistant helping refine candidate search criteria.

The user is providing feedback on the draft search criteria (scorecard). 
Analyze their message and determine:
1. What changes they want to make (add criteria, remove criteria, adjust weights)
2. Whether they're satisfied and ready to proceed
3. What the next validation question should be (if needed)

Return a JSON object with this structure:
{
  "changes": [
    {
      "action": "add_filter|remove_filter|add_scoring|remove_scoring|modify_scoring",
      "details": "description of the change"
    }
  ],
  "ready_to_search": true/false,
  "next_question": "The next question to ask, or null if ready"
}"""

        # Build context
        scorecard_summary = json.dumps({
            "filters": current_scorecard.get("mustHaveFilters", []),
            "scoring": current_scorecard.get("scoringCriteria", []),
            "threshold": current_scorecard.get("threshold", 50)
        }, indent=2)
        
        conversation_context = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in conversation_history[-6:]  # Last 3 exchanges
        ])
        
        user_message_full = f"""Current scorecard:
{scorecard_summary}

Recent conversation:
{conversation_context}

User's latest message: {user_message}

Analyze and respond with JSON:"""
        
        response = await self._call_llm(
            system_prompt=system_prompt,
            user_message=user_message_full,
            temperature=0.2
        )
        
        # Parse response
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
            
            analysis = json.loads(response_text)
            
            # Apply changes to scorecard
            updated_scorecard = await self._apply_scorecard_changes(
                current_scorecard,
                analysis.get("changes", [])
            )
            
            # Save updated scorecard
            updated_scorecard["updated_at"] = datetime.utcnow().isoformat()
            
            self.scorecards_collection.update_one(
                {"scorecard_id": updated_scorecard["scorecard_id"]},
                {"$set": updated_scorecard}
            )
            
            # Remove MongoDB's _id field if it exists (not JSON serializable)
            if "_id" in updated_scorecard:
                del updated_scorecard["_id"]
            
            self.redis_manager.store_data(
                session_id,
                "scorecard",
                updated_scorecard
            )
            
            # Check if ready to proceed
            if analysis.get("ready_to_search", False):
                updated_scorecard["status"] = "finalized"
                self.scorecards_collection.update_one(
                    {"scorecard_id": updated_scorecard["scorecard_id"]},
                    {"$set": {"status": "finalized"}}
                )
                
                return {
                    "scorecard": updated_scorecard,
                    "message": "Great! Your search criteria is ready. Would you like to proceed with finding candidates?",
                    "phase": "ready_to_search",
                    "ready": True
                }
            else:
                return {
                    "scorecard": updated_scorecard,
                    "message": analysis.get("next_question", "Is there anything else you'd like to adjust?"),
                    "phase": "validation",
                    "ready": False
                }
                
        except Exception as e:
            print(f"❌ Error processing feedback: {e}")
            return {
                "scorecard": current_scorecard,
                "message": "I understood your feedback. Anything else you'd like to adjust?",
                "phase": "validation",
                "ready": False
            }
    
    async def _apply_scorecard_changes(
        self,
        scorecard: Dict[str, Any],
        changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply requested changes to the scorecard."""
        
        # For Phase 1, we'll keep this simple
        # In practice, you'd parse the changes and modify the scorecard accordingly
        # For now, just return the scorecard as-is
        # TODO: Implement actual change application logic
        
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