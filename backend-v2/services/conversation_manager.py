
import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from core.config import settings
from core.logging_config import get_logger
from data.mongodb import MongoDB
from data.redis_cache import RedisCache
from models.conversation_models import (ConversationMessage, ConversationStage,
                                        ConversationState, IdealProfileCard,
                                        SampleProfile)
from services.conversation_prompts import ConversationPrompts
from services.funnel_search_service import FunnelSearchService
from services.model_config_manager import ModelConfigManager

logger = get_logger(__name__)


class ConversationManager:
    """
    Manages conversation flow and state for Donna.
    
    V3.1 Enhancement: Full conversational context for LLM responses.
    """
    
    STAGES = [
        ConversationStage.GREETING,
        ConversationStage.SKILLS,
        ConversationStage.EXPERIENCE,
        ConversationStage.PREFERENCES,
        ConversationStage.REVIEW,
        ConversationStage.READY
    ]
    
    STAGE_REQUIREMENTS = {
        ConversationStage.GREETING: [],
        ConversationStage.SKILLS: ["role_title", "must_have_skills"],
        ConversationStage.EXPERIENCE: ["seniority", "experience_years"],
        ConversationStage.PREFERENCES: ["industries"],
        ConversationStage.REVIEW: [],
        ConversationStage.READY: []
    }
    
    MAX_TURNS_PER_STAGE = 5
    
    def __init__(
        self,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager,
        funnel_search: FunnelSearchService ,
        mongodb: MongoDB,
    ):
        self.redis = redis_cache
        self.model_config = model_config_manager
        self.funnel_search = funnel_search 
        self.mongodb = mongodb
        self.prompts = ConversationPrompts()
        
        # Sessions collection
        if mongodb:
            self.conversation_sessions = mongodb.conversation_sessions_collection
        else:
            raise Exception("Need MongoDB")
        
        logger.info("✅ ConversationManager initialized")
    
    
    # ================================================================
    # PROCESS USER MESSAGE - UPDATED FOR FULL CONTEXT
    # ================================================================

    async def process_message(
        self,
        session_id: str,
        user_message: str,
        action: Optional[str] = None
    ) -> Tuple[str, IdealProfileCard, Optional[SampleProfile], str, bool, List[str]]:
        """Process user's message with FULL conversation context."""
        
        state = await self._load_state(session_id)
        if not state:
            raise ValueError(f"No conversation found for session {session_id}")
        
        # Add user message to history
        state.messages.append(ConversationMessage(
            role="user",
            content=user_message
        ))
        state.turn_count += 1
        state.stage_turn_count += 1
        
        # Handle explicit actions
        if action == "ready_to_search":
            donna_reply = self.prompts.ready_to_search_confirmation()
            state.ready_to_search = True
            state.stage = ConversationStage.READY
            suggestions = []
            
            state.messages.append(ConversationMessage(
                role="assistant",
                content=donna_reply
            ))
            await self._save_state(state)
            
            return (
                donna_reply,
                state.ideal_profile,
                state.sample_profile,
                state.stage,
                state.ready_to_search,
                suggestions
            )
        
        # ================================================================
        # NEW: Use LLM to understand message in FULL context
        # ================================================================
        
        extraction_result = await self._extract_and_respond_with_context(
            user_message=user_message,
            state=state
        )
        
        # Update profile with extracted info
        if extraction_result["profile_updates"]:
            old_profile = state.ideal_profile.copy()
            
            for key, value in extraction_result["profile_updates"].items():
                if value:  # Only update non-empty values
                    if isinstance(value, list) and hasattr(state.ideal_profile, key):
                        # Merge lists
                        current = getattr(state.ideal_profile, key, [])
                        merged = list(set(current + value))
                        setattr(state.ideal_profile, key, merged)
                    else:
                        setattr(state.ideal_profile, key, value)
            
            # Detect if we need to re-search
            should_research = self._should_trigger_new_search(
                old_profile, 
                state.ideal_profile,
                extraction_result.get("intent", "")
            )
        else:
            should_research = False
        
        # Get Donna's response
        donna_reply = extraction_result["donna_response"]
        suggestions = extraction_result.get("suggestions", [])
        
        # ================================================================
        # Trigger new search if criteria changed significantly
        # ================================================================
        
        if should_research and self._has_minimum_info(state.ideal_profile):
            logger.info("🔄 Criteria changed - triggering new search...")
            
            search_reply, search_suggestions = await self._generate_sample_with_funnel_search(state)
            
            # Combine responses
            donna_reply = f"{donna_reply}\n\n{search_reply}"
            suggestions = search_suggestions
        
        # Update stage if needed
        new_stage = extraction_result.get("suggested_stage", state.stage)
        if new_stage != state.stage:
            state.stage = new_stage
            state.stage_turn_count = 0
        
        state.ready_to_search = self._check_if_ready(state)
        
        # Save assistant response
        state.messages.append(ConversationMessage(
            role="assistant",
            content=donna_reply
        ))
        
        state.updated_at = datetime.utcnow().isoformat()
        await self._save_state(state)
        
        return (
            donna_reply,
            state.ideal_profile,
            state.sample_profile,
            state.stage,
            state.ready_to_search,
            suggestions
        )
    
    
    # ================================================================
    # NEW: CONTEXTUAL EXTRACTION AND RESPONSE
    # ================================================================
    
    async def _extract_and_respond_with_context(
        self,
        user_message: str,
        state: ConversationState
    ) -> Dict[str, Any]:
        """
        Use LLM to understand message with FULL conversation context.
        
        Returns:
            - profile_updates: Dict of fields to update
            - donna_response: Natural conversational response
            - intent: What the user wants (add_criteria, refine, question, etc.)
            - suggestions: Quick action buttons
        """
        
        # Build conversation history (last 10 messages)
        recent_messages = state.messages[-10:] if state.messages else []
        conversation_history = "\n".join([
            f"{'User' if m.role == 'user' else 'Donna'}: {m.content}"
            for m in recent_messages
        ])
        
        # Current profile state
        profile_json = json.dumps(state.ideal_profile.dict(), indent=2)
        
        # Sample candidates info (if any)
        sample_info = ""
        if hasattr(state, 'sample_candidates') and state.sample_candidates:
            sample_info = f"""
Current Sample Candidates ({len(state.sample_candidates)} found):
{json.dumps([{
    'name': f"{c['candidate'].get('first_name', '')} {c['candidate'].get('last_name', '')}",
    'title': c['candidate'].get('title', ''),
    'location': c['candidate'].get('location', ''),
    'skills': c.get('matched_skills', [])[:5],
    'score': c.get('score', 0)
} for c in state.sample_candidates[:3]], indent=2)}
"""
        
        system_prompt = """You are Donna, an AI recruiting assistant. You're having a conversation with a recruiter to help them find candidates.

YOUR PERSONALITY:
- Friendly, professional, and helpful
- Acknowledge what you understood
- Ask clarifying questions when needed
- Be concise but warm

IMPORTANT CONTEXT RULES:
1. The user may be ADDING to an existing search (e.g., "add Bangalore location")
2. The user may be REFINING criteria (e.g., "make it more senior")
3. The user may be asking a QUESTION about the candidates
4. The user may be giving FEEDBACK (e.g., "these are too junior")

You must EXTRACT any new/updated criteria AND generate a natural response.

RESPOND IN THIS EXACT JSON FORMAT:
{
    "intent": "add_criteria|refine|question|feedback|confirm|other",
    "profile_updates": {
        "role_title": null or "string",
        "must_have_skills": [] or ["skill1", "skill2"],
        "nice_to_have_skills": [] or ["skill1"],
        "seniority": null or "senior|mid|junior|lead|principal",
        "experience_years": null or "5+|3-5|7+|etc",
        "industries": [] or ["Industry1", "Industry2"],
        "locations": [] or ["Location1", "Location2"],
        "company_size": [] or ["startup", "enterprise"],
        "additional_requirements": null or "string"
    },
    "donna_response": "Your natural conversational response here",
    "suggestions": ["Suggestion 1", "Suggestion 2"],
    "should_search": true or false,
    "suggested_stage": "review|preferences|skills|experience"
}

RULES FOR profile_updates:
- Only include fields that the user EXPLICITLY mentioned or implied
- For locations: Extract city names like "Bangalore", "Mumbai", "San Francisco"
- For skills: Extract technical skills mentioned
- Use null for fields not mentioned
- Use empty [] for list fields not mentioned

RULES FOR donna_response:
- Acknowledge what you understood
- If adding criteria, confirm what was added
- If no sample candidates exist yet, offer to search
- Be conversational, not robotic"""

        user_prompt = f"""CURRENT CONVERSATION STATE:
- Stage: {state.stage}
- Turn count: {state.turn_count}

CURRENT IDEAL PROFILE:
{profile_json}

{sample_info}

CONVERSATION HISTORY:
{conversation_history}

USER'S LATEST MESSAGE:
"{user_message}"

Understand this message in context and respond appropriately. Extract any criteria updates."""

        try:
            model_config = await self.model_config.get_user_config(state.username)
            
            response = await self.model_config.call_model(
                model_config=model_config,
                model_purpose="conversation",  # Use conversation model
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.4,
                username=state.username
            )
            
            # Parse JSON response
            response_text = response.strip()
            
            # Handle markdown code blocks
            if "```" in response_text:
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.split("```")[0]
            
            result = json.loads(response_text)
            
            logger.info(f"✅ LLM understood intent: {result.get('intent')}")
            logger.info(f"   Profile updates: {result.get('profile_updates')}")
            
            return {
                "profile_updates": result.get("profile_updates", {}),
                "donna_response": result.get("donna_response", "I'm not sure I understood. Could you clarify?"),
                "intent": result.get("intent", "other"),
                "suggestions": result.get("suggestions", []),
                "should_search": result.get("should_search", False),
                "suggested_stage": result.get("suggested_stage", state.stage)
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse LLM response: {e}")
            logger.error(f"   Raw response: {response[:500]}")
            
            # Fallback: Try to extract intent from raw response
            return {
                "profile_updates": {},
                "donna_response": "I understood you want to make some changes. Could you be more specific about what you'd like to adjust?",
                "intent": "other",
                "suggestions": ["Add location", "Change seniority", "Show more candidates"],
                "should_search": False,
                "suggested_stage": state.stage
            }
            
        except Exception as e:
            logger.error(f"❌ LLM extraction failed: {e}", exc_info=True)
            return {
                "profile_updates": {},
                "donna_response": "Sorry, I had trouble understanding that. Could you rephrase?",
                "intent": "error",
                "suggestions": [],
                "should_search": False,
                "suggested_stage": state.stage
            }
    
    
    def _should_trigger_new_search(
        self,
        old_profile: IdealProfileCard,
        new_profile: IdealProfileCard,
        intent: str
    ) -> bool:
        """Determine if we should trigger a new search based on profile changes."""
        
        # Always search if intent is to add/refine criteria
        if intent in ["add_criteria", "refine"]:
            return True
        
        # Check for significant field changes
        significant_fields = ["locations", "industries", "seniority", "must_have_skills"]
        
        for field in significant_fields:
            old_value = getattr(old_profile, field, None)
            new_value = getattr(new_profile, field, None)
            
            if isinstance(old_value, list) and isinstance(new_value, list):
                if set(new_value) - set(old_value):  # New items added
                    logger.info(f"🔄 New {field} added: {set(new_value) - set(old_value)}")
                    return True
            elif old_value != new_value and new_value:
                logger.info(f"🔄 {field} changed: {old_value} → {new_value}")
                return True
        
        return False
    
    
    # ================================================================
    # FEEDBACK PROCESSING - UPDATED
    # ================================================================
    
    async def process_feedback(
        self,
        session_id: str,
        feedback_type: str,
        feedback_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """Process user feedback and regenerate samples."""
        logger.info(f"Processing feedback: {feedback_type}")
        
        state = await self._load_state(session_id)
        
        if not state:
            raise ValueError("Session not found")
        
        if state.feedback is None:
            state.feedback = {}
        
        if feedback_type == "too_junior":
            state.feedback["min_years"] = 5
            state.feedback["excluded_titles"] = ["student", "intern", "junior", "trainee"]
            donna_reply = "Got it! I'll focus on more experienced candidates with 5+ years. Searching now... ⚡"
            
        elif feedback_type == "need_more_skill":
            skill = feedback_data.get("skill") if feedback_data else None
            if skill:
                if "skill_weights" not in state.feedback:
                    state.feedback["skill_weights"] = {}
                state.feedback["skill_weights"][skill] = 2.5
                donna_reply = f"Understood! I'll prioritize candidates stronger in {skill}. Let me find better matches... ⚡"
            else:
                donna_reply = "Which specific skill should I prioritize? (e.g., 'React', 'Python', 'AWS')"
                await self._save_state(state)
                return donna_reply, []
        
        elif feedback_type == "wrong_industry":
            industries = feedback_data.get("industries", []) if feedback_data else []
            if industries:
                state.ideal_profile.industries = industries
                donna_reply = f"Switching focus to {', '.join(industries[:2])} industry. Refreshing results... ⚡"
            else:
                donna_reply = "Which industries should I focus on? (e.g., 'SaaS', 'Fintech', 'Healthcare')"
                await self._save_state(state)
                return donna_reply, []
        
        elif feedback_type == "perfect":
            state.ready_to_search = True
            state.stage = ConversationStage.READY
            donna_reply = "Excellent! These matches look great. Ready to run the full search and enrich the top candidates? 🎯"
            await self._save_state(state)
            return donna_reply, []
        
        else:
            donna_reply = "I didn't quite catch that. Could you tell me what you'd like to adjust?"
            await self._save_state(state)
            return donna_reply, []
        
        # Re-generate samples with updated criteria
        try:
            samples = await self._generate_sample_candidates(state)
            
            if hasattr(state, 'sample_candidates'):
                state.sample_candidates = samples
            else:
                state.__dict__['sample_candidates'] = samples
            
            await self._save_state(state)
            
            if samples:
                donna_reply += f"\n\nFound {len(samples)} better matches!"
            else:
                donna_reply = "Hmm, those criteria are quite specific. Let me try broadening the search a bit..."
            
            return donna_reply, samples
            
        except Exception as e:
            logger.error(f"Error regenerating samples: {e}", exc_info=True)
            return "Had some trouble finding new matches. Let's try adjusting the criteria differently?", []
    
    
    async def _generate_sample_candidates(
        self,
        state: ConversationState
    ) -> List[Dict[str, Any]]:
        """Generate sample candidates using FunnelSearchService."""
        logger.info("🔎 Generating sample candidates (funnel search)...")
        
        jd_data = {
            "role_title": state.ideal_profile.role_title,
            "required_skills": state.ideal_profile.must_have_skills,
            "preferred_skills": state.ideal_profile.nice_to_have_skills,
            "seniority": state.ideal_profile.seniority,
            "experience_years": state.ideal_profile.experience_years,
            "industries": state.ideal_profile.industries,
            "locations": state.ideal_profile.locations,  
        }
        
        user_filters = {
            "industries": state.ideal_profile.industries,
            "seniority": state.ideal_profile.seniority,
            "locations": state.ideal_profile.locations,
        }
        
        if state.feedback:
            if state.feedback.get("min_years"):
                user_filters["experience_min"] = state.feedback["min_years"]
        
        result = await self.funnel_search.search(
            jd_data=jd_data,
            limit=5,
            user_filters=user_filters
        )
        
        if result["success"] and result["candidates"]:
            logger.info(f"✅ Found {len(result['candidates'])} sample candidates")
            return result["candidates"][:5]
        else:
            logger.warning("⚠️ No sample candidates found")
            return []
    
    
    async def _generate_sample_with_funnel_search(
        self,
        state: ConversationState
    ) -> Tuple[str, List[str]]:
        """Generate sample using FunnelSearchService with natural response."""
        logger.info("Starting funnel search...")
        
        try:
            jd_data = {
                "role_title": state.ideal_profile.role_title,
                "required_skills": state.ideal_profile.must_have_skills,
                "preferred_skills": state.ideal_profile.nice_to_have_skills,
                "seniority": state.ideal_profile.seniority,
                "experience_years": state.ideal_profile.experience_years,
                "industries": state.ideal_profile.industries,
                "locations": state.ideal_profile.locations,
            }
            
            user_filters = {
                "industries": state.ideal_profile.industries,
                "seniority": state.ideal_profile.seniority,
                "locations": state.ideal_profile.locations,
            }
            
            if hasattr(state, 'feedback') and state.feedback:
                if state.feedback.get("min_years"):
                    user_filters["experience_min"] = state.feedback["min_years"]
            
            result = await self.funnel_search.search(
                jd_data=jd_data,
                limit=5,
                user_filters=user_filters
            )
            
            if result["success"] and result["candidates"]:
                top_candidate = result["candidates"][0]
                
                sample_profile = self._candidate_to_sample(top_candidate["candidate"])
                state.sample_profile = sample_profile
                
                state.last_search_metadata = {
                    "total_found": result["total_found"],
                    "filters_used": result.get("filters_used", {}),
                    "search_log": result.get("search_log", [])
                }
                state.sample_candidates = result["candidates"][:5]
                
                # Build natural response
                location_info = ""
                if state.ideal_profile.locations:
                    location_info = f" in {', '.join(state.ideal_profile.locations[:2])}"
                
                match_highlights = top_candidate.get("match_reasons", [])[:3]
                if not match_highlights:
                    matched_skills = top_candidate.get("matched_skills", [])
                    if matched_skills:
                        match_highlights.append(f"Skills: {', '.join(matched_skills[:3])}")
                
                donna_reply = f"""Found {result['total_found']} candidates{location_info}! 🎯

Here's the top match (Score: {top_candidate['score']}/100):
- {top_candidate['candidate'].get('first_name', '')} {top_candidate['candidate'].get('last_name', '')}
- {top_candidate['candidate'].get('title', 'N/A')}
- {top_candidate['candidate'].get('location', 'N/A')}

{chr(10).join(['• ' + detail for detail in match_highlights])}

Swipe through the candidates to review them!"""
                
                suggestions = ["These look good!", "Too junior", "Wrong location", "Need more skills"]
                
                logger.info(f"✅ FunnelSearch found {result['total_found']} candidates")
                
            else:
                state.sample_profile = None
                state.sample_candidates = []
                
                # Build helpful response for no results
                criteria_summary = []
                if state.ideal_profile.role_title:
                    criteria_summary.append(f"Role: {state.ideal_profile.role_title}")
                if state.ideal_profile.locations:
                    criteria_summary.append(f"Location: {', '.join(state.ideal_profile.locations)}")
                if state.ideal_profile.must_have_skills:
                    criteria_summary.append(f"Skills: {', '.join(state.ideal_profile.must_have_skills[:3])}")
                
                donna_reply = f"""Hmm, I couldn't find candidates matching all these criteria:
{chr(10).join(['• ' + c for c in criteria_summary])}

Would you like to:
- Broaden the location (try "India" instead of specific cities)
- Reduce required skills
- Try different industries"""
                
                suggestions = ["Broaden location", "Reduce skills", "Try different industries"]
                
                logger.warning("⚠️ FunnelSearch found no candidates")
                
        except Exception as e:
            logger.error(f"FunnelSearch failed: {e}", exc_info=True)
            donna_reply = "I ran into an issue while searching. Could you try rephrasing your criteria?"
            suggestions = ["Start over", "Simplify criteria"]
        
        return donna_reply, suggestions

    
    # ================================================================
    # START CONVERSATION - Keep existing implementation
    # ================================================================
    
    async def start_conversation(
        self,
        session_id: str,
        username: str,
        initial_message: Optional[str] = None,
        jd_data: Optional[Dict] = None
    ) -> Tuple[str, IdealProfileCard, Optional[SampleProfile], str]:
        """Start a new conversation with Donna."""
        
        state = ConversationState(
            session_id=session_id,
            username=username,
            stage=ConversationStage.GREETING
        )
        
        if jd_data:
            state.ideal_profile = self._jd_to_profile(jd_data)
            state.jd_uploaded = True
            state.stage = ConversationStage.REVIEW
            
            sample_profile = None
            donna_reply = ""
            
            if self._has_minimum_info(state.ideal_profile):
                try:
                    logger.info("🚀 Starting FunnelSearch...")
                    donna_reply, suggestions = await self._generate_sample_with_funnel_search(state)
                    sample_profile = state.sample_profile
                    
                except Exception as e:
                    logger.error(f"Failed to generate sample profile: {e}")
                    sample_profile = None
                    donna_reply = """I've analyzed your JD but had some trouble finding matches.

Could you tell me more about the specific skills or location you're targeting?"""
            else:
                sample_profile = None
                donna_reply = """I've analyzed your JD, but I need a bit more detail.

What's the main role you're hiring for, and what are the must-have skills?"""
        
        elif initial_message:
            # Use contextual extraction for initial message too
            extraction_result = await self._extract_and_respond_with_context(
                user_message=initial_message,
                state=state
            )
            
            # Apply updates
            if extraction_result["profile_updates"]:
                for key, value in extraction_result["profile_updates"].items():
                    if value:
                        setattr(state.ideal_profile, key, value)
            
            donna_reply = extraction_result["donna_response"]
            new_stage = extraction_result.get("suggested_stage", ConversationStage.SKILLS)
            state.stage = new_stage
            sample_profile = None
            
            # If we have enough info, search
            if self._has_minimum_info(state.ideal_profile):
                search_reply, _ = await self._generate_sample_with_funnel_search(state)
                donna_reply = f"{donna_reply}\n\n{search_reply}"
                sample_profile = state.sample_profile
        
        else:
            donna_reply = """Hey there! 👋 I'm Donna, your AI recruiting assistant.

Tell me about the role you're hiring for - what position and what skills are must-haves?

Or if you have a job description, you can paste it and I'll extract the key requirements!"""
            sample_profile = None
        
        if initial_message:
            state.messages.append(ConversationMessage(
                role="user",
                content=initial_message
            ))
        
        state.messages.append(ConversationMessage(
            role="assistant",
            content=donna_reply
        ))
        
        await self._save_state(state)
        
        return donna_reply, state.ideal_profile, sample_profile, state.stage
    
    async def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session document from MongoDB."""
        if self.conversation_sessions is None:
            return None
        return await self.conversation_sessions.find_one({"session_id": session_id})
    
    # ================================================================
    # MANUAL IMPORT METHODS
    # ================================================================
    
    async def create_manual_import(
        self,
        username: str,
        jd_text: Optional[str],
        ideal_profile: Optional[Dict],
        candidates: List[Dict],
        pipeline_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a search session from manually imported candidates.
        
        Flow:
        1. User provides JD text or ideal profile
        2. User provides list of candidates (LinkedIn URL + extra info)
        3. We create a session that goes directly to results page
        4. User can shortlist and create pipeline from there
        """
        session_id = f"manual-{uuid.uuid4().hex[:12]}"
        
        logger.info(f"Creating manual import session: {session_id}")
        logger.info(f"  Candidates provided: {len(candidates)}")
        
        # Parse JD if provided to get job requirements
        job_data = ideal_profile or {}
        if jd_text and not ideal_profile:
            # You can use JD parser here if needed
            job_data = {
                "jd_text": jd_text,
                "role_title": "Imported Position",
            }
        
        # Create candidate entries
        sample_candidates = []
        for idx, c in enumerate(candidates):
            candidate_id = f"manual-{uuid.uuid4().hex[:8]}"
            
            candidate_entry = {
                "candidate_id": candidate_id,
                "linkedin_url": c.get("linkedin_url", ""),
                "name": c.get("name", f"Candidate {idx + 1}"),
                "headline": None,
                "current_company": None,
                "current_title": None,
                "location": c.get("preferred_location"),
                "experience_years": None,
                "skills": [],
                "profile_picture_url": None,
                "match_score": None,
                "manual_data": {
                    "expected_salary": c.get("expected_salary"),
                    "current_salary": c.get("current_salary"),
                    "notice_period": c.get("notice_period"),
                    "preferred_location": c.get("preferred_location"),
                    "notes": c.get("notes"),
                    "has_resume": bool(c.get("resume_base64")),
                },
                "source": "manual_import",
                "is_preview": True,
                "added_at": datetime.utcnow().isoformat(),
            }
            
            # Save resume if provided
            if c.get("resume_base64"):
                resume_path = await self._save_resume(
                    candidate_id,
                    c["resume_base64"],
                    c.get("resume_filename", "resume.pdf")
                )
                candidate_entry["manual_data"]["resume_path"] = resume_path
            
            sample_candidates.append(candidate_entry)
        
        # Create session document
        session_doc = {
            "session_id": session_id,
            "username": username,
            "source": "manual_import",
            "status": "pending_scrape",  # Will scrape LinkedIn data
            "stage": "results",
            "ideal_profile": job_data,
            "jd_text": jd_text,
            "sample_candidates": sample_candidates,
            "search_results": sample_candidates,
            "total_candidates": len(sample_candidates),
            "pipeline_name": pipeline_name,
            "pipeline_id": None,
            "selected_candidate_ids": [],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_manual_import": True,
        }
        
        # Save to database
        if self.conversation_sessions is not None:
            await self.conversation_sessions.insert_one(session_doc)
        
        logger.info(f"Created manual import session {session_id} with {len(sample_candidates)} candidates")
        
        return {
            "session_id": session_id,
            "candidates_count": len(sample_candidates)
        }
        
    def _normalize_linkedin_url_for_db(self, url: str) -> List[str]:
            """
            Converts full URL to the relative path format stored in DB.
            Returns a list of potential formats to try against the index.
            Example: 'https://www.linkedin.com/in/abeer-rizvi' -> ['/in/abeer-rizvi/', '/in/abeer-rizvi']
            """
            if not url:
                return []
                
            # 1. Extract the username part
            import re

            # Matches /in/username and captures username
            match = re.search(r'/in/([^/?]+)', url, re.IGNORECASE)
            
            if not match:
                # Handle case where user just provides "abeer-rizvi"
                if "linkedin.com" not in url and "/" not in url:
                    username = url.strip()
                else:
                    return []
            else:
                username = match.group(1)
                
            # 2. Return formats that match your DB storage patterns
            # Your DB seems to store trailing slashes: '/in/--abeerrizvi/'
            return [
                f"/in/{username}/",  # Most likely match based on your sample
                f"/in/{username}"    # Fallback
            ]

    async def _lookup_profile_in_db(self, linkedin_url: str) -> Optional[dict]:
            """
            Ultra-fast lookup using the 'idx_linkedin_url' index.
            Zero regex, zero collection scans.
            """
            try:
                potential_keys = self._normalize_linkedin_url_for_db(linkedin_url)
                
                if not potential_keys:
                    return None
                
                # Try to find exactly one match using the normalized keys
                # $in operator works well with indexes
                profile = await self.mongodb.profiles_collection.find_one({
                    "linkedin_url": {"$in": potential_keys}
                })
                
                return profile
            except Exception as e:
                logger.error(f"Profile lookup failed: {e}")
                return None

    async def scrape_manual_candidates(self, session_id: str):
            """
            Enrich candidates using local 56M profile database.
            """
            logger.info(f"DB lookup for manual import {session_id}")
            
            session = await self.get_session(session_id)
            if not session:
                logger.error(f"Session not found: {session_id}")
                return
            
            candidates = session.get("sample_candidates", [])
            updated_candidates = []
            db_hit_count = 0
            
            for candidate in candidates:
                linkedin_url = candidate.get("linkedin_url")
                
                # Skip if no URL
                if not linkedin_url:
                    updated_candidates.append(candidate)
                    continue
                
                try:
                    profile = await self._lookup_profile_in_db(linkedin_url)
                    
                    if profile:
                        db_hit_count += 1
                        
                        # Parse 'expertise' string into a list (DB format is comma-separated)
                        db_skills = []
                        if "expertise" in profile and isinstance(profile["expertise"], str):
                            db_skills = [s.strip() for s in profile["expertise"].split(",") if s.strip() != 'NA']
                        
                        # Map DB fields to Application fields
                        candidate.update({
                            "name": f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip(),
                            "first_name": profile.get("first_name"),
                            "last_name": profile.get("last_name"),
                            
                            # DB has 'title', App uses 'headline'/'title'
                            "headline": profile.get("title", "NA"), 
                            "title": profile.get("title", "NA"),
                            
                            # Parsing location
                            "location": profile.get("location") if profile.get("location") != 'NA' else candidate.get("preferred_location"),
                            
                            "skills": db_skills[:15], # Top 15 skills
                            
                            # Handle images (DB has 'profile_picture': 'NA')
                            "profile_picture_url": profile.get("profile_picture") if profile.get("profile_picture") != 'NA' else None,
                            
                            # Education mapping (if useful for you)
                            "education": profile.get("education", []),
                            
                            "profile_id": str(profile.get("_id", "")),
                            "data_source": "database",
                            "needs_enrichment": False
                        })
                        logger.info(f"Found in DB: {candidate['name']}")
                    else:
                        logger.info(f"Not in DB: {linkedin_url}")
                        candidate["data_source"] = "manual_only"
                        candidate["needs_enrichment"] = True
                    
                    updated_candidates.append(candidate)
                    
                except Exception as e:
                    logger.error(f"Error processing {linkedin_url}: {e}")
                    candidate["lookup_error"] = str(e)
                    candidate["data_source"] = "manual_only"
                    updated_candidates.append(candidate)
            
            # Batch update the session
            await self.conversation_sessions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "sample_candidates": updated_candidates,
                        "search_results": updated_candidates,
                        "status": "ready",
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            logger.info(f"✅ Completed: {db_hit_count}/{len(updated_candidates)} found in DB")
        
    async def link_session_to_pipeline(self, session_id: str, pipeline_id: str):
        """Link a conversation session to a created pipeline."""
        await self.conversation_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "pipeline_id": pipeline_id,
                    "pipeline_created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        logger.info(f"✅ Linked session {session_id} to pipeline {pipeline_id}")

    
    def _score_to_label(self, score: Optional[float]) -> str:
        """Convert numeric score to label."""
        if score is None:
            return "Not Scored"
        if score >= 85:
            return "Excellent Match"
        if score >= 70:
            return "Great Match"
        if score >= 55:
            return "Good Match"
        if score >= 40:
            return "Fair Match"
        return "Below Target"
    
    async def _save_resume(self, candidate_id: str, base64_data: str, filename: str) -> str:
        """Save resume file and return path."""
        import base64
        import os

        # Create resumes directory
        resume_dir = os.path.join(
            getattr(settings, 'UPLOAD_DIR', './uploads'),
            "resumes"
        )
        os.makedirs(resume_dir, exist_ok=True)
        
        # Generate filename
        ext = os.path.splitext(filename)[1] or '.pdf'
        saved_filename = f"{candidate_id}{ext}"
        filepath = os.path.join(resume_dir, saved_filename)
        
        # Decode and save
        try:
            file_data = base64.b64decode(base64_data)
            with open(filepath, 'wb') as f:
                f.write(file_data)
            return filepath
        except Exception as e:
            logger.error(f"Failed to save resume: {e}")
            return ""
        
    async def get_session_results(self, session_id: str) -> Optional[Dict]:
        """Get session results for results page."""
        if self.conversation_sessions is None:
            return None
        
        session = await self.conversation_sessions.find_one({"session_id": session_id})
        if not session:
            return None
        
        return {
            "session_id": session["session_id"],
            "source": session.get("source", "donna_search"),
            "status": session.get("status", "ready"),
            "candidates": session.get("sample_candidates", []),
            "total_candidates": session.get("total_candidates", 0),
            "ideal_profile": session.get("ideal_profile", {}),
            "pipeline_id": session.get("pipeline_id"),
            "pipeline_created_at": session.get("pipeline_created_at"),
            "created_at": session.get("created_at"),
            "is_manual_import": session.get("is_manual_import", False),
        }
    
    async def create_pipeline_batch(
    self,
    session_id: str,
    pipeline_ids: List[str],
    candidate_pipeline_mapping: Dict[str, str]  # {candidate_id: pipeline_id}
):
        """Link conversation session to created pipelines."""
        batch_id = f"batch-{uuid.uuid4().hex[:12]}"
        
        await self.conversation_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "pipeline_batch_id": batch_id,
                    "pipelines_created": True,
                    "pipeline_ids": pipeline_ids,
                    "pipeline_created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        # Update each candidate with their pipeline reference
        for candidate_id, pipeline_id in candidate_pipeline_mapping.items():
            await self.conversation_sessions.update_one(
                {
                    "session_id": session_id,
                    "$or": [
                        {"sample_candidates.candidate_id": candidate_id},
                        {"search_results.candidate_id": candidate_id}
                    ]
                },
                {
                    "$set": {
                        "sample_candidates.$[elem].pipeline_id": pipeline_id,
                        "sample_candidates.$[elem].pipeline_created_at": datetime.utcnow().isoformat(),
                        "sample_candidates.$[elem].enrichment_status": "pending",
                        "search_results.$[elem].pipeline_id": pipeline_id,
                        "search_results.$[elem].pipeline_created_at": datetime.utcnow().isoformat(),
                        "search_results.$[elem].enrichment_status": "pending"
                    }
                },
                array_filters=[{"elem.candidate_id": candidate_id}]
            )
        
        logger.info(f"✅ Created pipeline batch {batch_id} with {len(pipeline_ids)} pipelines")
        return batch_id
    
    async def mark_candidates_selected(
        self,
        session_id: str,
        candidate_ids: List[str],
        selected: bool = True
    ) -> Dict[str, Any]:
        """Mark candidates as selected/unselected in DB."""
        if self.conversation_sessions is None:
            return {"success": False, "error": "DB not available"}
        
        # Build correct update operation
        if selected:
            update_op = {
                "$addToSet": {
                    "selected_candidate_ids": {"$each": candidate_ids}
                },
                "$set": {"updated_at": datetime.utcnow().isoformat()}
            }
        else:
            update_op = {
                "$pull": {
                    "selected_candidate_ids": {"$in": candidate_ids}
                },
                "$set": {"updated_at": datetime.utcnow().isoformat()}
            }
        
        result = await self.conversation_sessions.update_one(
            {"session_id": session_id},
            update_op
        )
        
        return {
            "success": result.modified_count > 0,
            "modified_count": result.modified_count
        }

    async def get_selected_candidates(self, session_id: str) -> List[str]:
        """Get list of selected candidate IDs."""
        if self.conversation_sessions is None:
            return []
        
        session = await self.conversation_sessions.find_one(
            {"session_id": session_id},
            {"selected_candidate_ids": 1}
        )
        
        return session.get("selected_candidate_ids", []) if session else []    

    # ================================================================
    # HELPER METHODS - Keep existing implementations
    # ================================================================
    
    def _candidate_to_sample(self, candidate: Dict) -> SampleProfile:
        """Convert candidate dict to SampleProfile."""
        expertise_str = candidate.get("expertise", "")
        skills = []
        if expertise_str and expertise_str != "NA":
            skills = [s.strip() for s in expertise_str.split(",")][:5]
        
        if not skills:
            skills = ["Skills not specified"]
        
        return SampleProfile(
            profile_id=str(candidate.get("_id", candidate.get("profile_id", ""))),
            name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
            title=candidate.get("title", "Not specified"),
            skills=skills,
            experience_years=candidate.get("experience_years", 0) or 0,
            current_company="Not specified",
            location=candidate.get("location", "Not specified"),
            industry=candidate.get("current_industry", "Not specified"),
            match_score=85,
            match_reasoning="Found via intelligent funnel search",
            linkedin_url=candidate.get("linkedin_url", ""),
            summary=candidate.get("summary", "")[:200] if candidate.get("summary") else ""
        )
    
    
    def _jd_to_profile(self, jd_data: Dict) -> IdealProfileCard:
        """Convert JD data to ideal profile card."""
        return IdealProfileCard(
            role_title=jd_data.get("role_title", ""),
            must_have_skills=jd_data.get("required_skills", []),
            nice_to_have_skills=jd_data.get("preferred_skills", []),
            seniority=jd_data.get("seniority", ""),
            experience_years=jd_data.get("experience_years", ""),
            industries=jd_data.get("industries", []),
            company_size=jd_data.get("company_size", []),
            additional_requirements=jd_data.get("responsibilities", "")
        )
    
    
    def _has_minimum_info(self, profile: IdealProfileCard) -> bool:
        """Check if profile has minimum info for search."""
        return bool(
            profile.role_title and
            len(profile.must_have_skills) >= 1
        )
    
    
    def _check_if_ready(self, state: ConversationState) -> bool:
        """Check if conversation is ready for full search."""
        profile = state.ideal_profile
        
        has_minimum = bool(
            profile.role_title and
            len(profile.must_have_skills) >= 1
        )
        
        has_context = bool(
            profile.seniority or
            profile.experience_years or
            profile.industries or
            profile.locations
        )
        
        if state.turn_count == 1 and has_minimum:
            return True
        
        return has_minimum and has_context
    
    
    def _get_suggestions(self, stage: str, profile: IdealProfileCard) -> List[str]:
        """Get suggestions based on current stage."""
        if stage == ConversationStage.GREETING:
            return ["Senior Developer", "Product Manager", "Data Scientist"]
        elif stage == ConversationStage.SKILLS:
            return ["That's all for skills", "Show sample candidates"]
        elif stage == ConversationStage.EXPERIENCE:
            return ["Senior (5+ years)", "Mid-level (3-5 years)", "Lead/Principal"]
        elif stage == ConversationStage.PREFERENCES:
            return ["SaaS/Tech", "Fintech", "Any industry"]
        elif stage == ConversationStage.REVIEW:
            return ["These look good!", "Need adjustments", "Add more criteria"]
        else:
            return []
    
    
    async def _save_state(self, state: ConversationState):
        """Save conversation state to Redis."""
        await self.redis.store_session_data(
            state.session_id,
            "conversation_state",
            state.dict(),
            expire_seconds=3600
        )
    
    
    async def _load_state(self, session_id: str) -> Optional[ConversationState]:
        """Load conversation state from Redis."""
        data = await self.redis.get_session_data(session_id, "conversation_state")
        
        if data:
            return ConversationState(**data)
        
        return None
    
    async def _process_rejection_with_llm(
        self,
        state: ConversationState,
        rejected_candidate: Dict[str, Any],
        rejection_reason: str,
        detailed_feedback: str = ""
    ) -> Dict[str, Any]:
        """
        Use LLM to understand rejection and suggest search refinements.
        """
        
        # Build context
        candidate_info = f"""
    Rejected Candidate:
    - Name: {rejected_candidate.get('first_name', '')} {rejected_candidate.get('last_name', '')}
    - Title: {rejected_candidate.get('title', 'N/A')}
    - Location: {rejected_candidate.get('location', 'N/A')}
    - Industry: {rejected_candidate.get('current_industry', 'N/A')}
    - Skills: {rejected_candidate.get('expertise', 'N/A')[:200]}
    - Experience: {rejected_candidate.get('experience_years', 'N/A')} years
    """
        
        profile_json = json.dumps(state.ideal_profile.dict(), indent=2)
        
        system_prompt = """You are Donna, an AI recruiting assistant analyzing why a recruiter rejected a candidate.

    Your job is to understand the rejection reason and suggest how to refine the search criteria.

    ANALYZE the rejection and return JSON:
    {
        "understood_issue": "What you understood from the rejection",
        "donna_response": "Friendly message acknowledging feedback and explaining adjustments",
        "refinements_applied": ["List of changes being made"],
        "profile_updates": {
            "must_have_skills": null or ["skill1", "skill2"],
            "nice_to_have_skills": null or [],
            "seniority": null or "senior|lead|principal",
            "experience_years": null or "5+|7+|10+",
            "industries": null or ["Industry1"],
            "locations": null or ["Location1"]
        },
        "feedback_adjustments": {
            "min_years": null or 5,
            "excluded_titles": null or ["junior", "intern"],
            "required_skills_boost": null or {"skill": 2.0},
            "excluded_industries": null or ["Industry1"]
        }
    }

    RULES:
    - Only update fields relevant to the rejection reason
    - Be specific about what you're changing
    - Explain changes in donna_response
    - Use feedback_adjustments for search filter tweaks"""

        user_prompt = f"""CURRENT IDEAL PROFILE:
    {profile_json}

    {candidate_info}

    REJECTION REASON: {rejection_reason}
    ADDITIONAL FEEDBACK: {detailed_feedback or "None provided"}

    Analyze this rejection and suggest refinements."""

        try:
            model_config = await self.model_config.get_user_config(state.username)
            
            response = await self.model_config.call_model(
                model_config=model_config,
                model_purpose="conversation",
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3,
                username=state.username
            )
            
            # Parse response
            response_text = response.strip()
            if "```" in response_text:
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.split("```")[0]
            
            result = json.loads(response_text)
            
            logger.info(f"✅ LLM rejection analysis: {result.get('understood_issue')}")
            logger.info(f"   Refinements: {result.get('refinements_applied')}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ LLM rejection analysis failed: {e}")
            
            # Fallback based on common rejection reasons
            return self._fallback_rejection_handling(rejection_reason)


    async def rank_and_save_candidates(
        self,
        session_id: str,  # Use original session_id
        username: str,
        ideal_profile: Dict,
        candidates: List[Dict],
        mongodb: MongoDB
    ):
        """Rank candidates and update SAME session."""
        
        try:
            logger.info(f"🚀 Starting LLM ranking for {session_id}")
            
            # Rank candidates
            ranked = await self._rank_candidates_with_llm(
                candidates=candidates,
                ideal_profile=ideal_profile,
                username=username
            )
            
            # Update EXISTING session (don't create new one)
            await mongodb.main_db["conversation_sessions"].update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "username": username, 
                        "candidates": ranked,
                        "search_results": ranked,  # For get_session_results
                        "status": "ready",
                        "ranked_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                },
                upsert=True  # Create if doesn't exist
            )
            
            logger.info(f"✅ Ranking completed for {session_id}")
            
        except Exception as e:
            logger.error(f"❌ Ranking failed: {e}", exc_info=True)
            
            await mongodb.main_db["conversation_sessions"].update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "status": "failed",
                        "error": str(e),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                }
            )

    async def _rank_candidates_with_llm(
        self,
        candidates: List[Dict],
        ideal_profile: Dict,
        username: str
    ) -> List[Dict]:
        """Rank candidates using LLM (moved from routes for reusability)."""
        
        import json

        # Prepare summaries
        candidate_summaries = []
        for idx, c in enumerate(candidates):
            summary = {
                "id": idx,
                "name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
                "title": c.get("title", "Unknown"),
                "location": c.get("location", "Unknown"),
                "company": c.get("current_company", "Unknown"),
                "experience_years": c.get("experience_years", 0),
                "skills": c.get("expertise", "").split(",")[:10] if c.get("expertise") else [],
                "industry": c.get("current_industry", "Unknown")
            }
            candidate_summaries.append(summary)
        
        system_prompt = """You are an expert recruiter analyzing candidate fit for a job position.

    Your task is to rank candidates from best to worst based on how well they match the ideal profile.

    Consider:
    1. **Skills Match**: Do they have the required technical skills?
    2. **Experience Level**: Does their seniority match the requirement?
    3. **Industry Fit**: Do they have relevant industry experience?
    4. **Location**: Are they in preferred locations?

    For each candidate, provide:
    - overall_match_score: 0-100 (higher = better fit)
    - match_label: "Excellent Match" | "Great Match" | "Good Match" | "Fair Match" | "Below Target"
    - strengths: List of 2-3 key strengths
    - concerns: List of 1-2 concerns (if any)
    - summary: 1-2 sentence explanation of fit

    Return JSON array sorted by match score (highest first):
    [
    {
        "id": 0,
        "overall_match_score": 85,
        "match_label": "Excellent Match",
        "summary": "Strong skills in React and Node.js with 7+ years experience",
        "strengths": ["Expert in React", "7 years experience", "SaaS background"],
        "concerns": ["Location not ideal"]
    },
    ...
    ]

    Be objective and specific. Only give high scores (80+) to truly excellent matches."""

        user_prompt = f"""IDEAL PROFILE:
    Role: {ideal_profile.get('role_title', 'Unknown')}
    Required Skills: {', '.join(ideal_profile.get('must_have_skills', []))}
    Preferred Skills: {', '.join(ideal_profile.get('nice_to_have_skills', []))}
    Seniority: {ideal_profile.get('seniority', 'Not specified')}
    Experience: {ideal_profile.get('experience_years', 'Not specified')}
    Industries: {', '.join(ideal_profile.get('industries', []))}
    Locations: {', '.join(ideal_profile.get('locations', []))}

    CANDIDATES TO RANK:
    {json.dumps(candidate_summaries, indent=2)}

    Rank these candidates from best to worst fit. Return ONLY the JSON array."""

        try:
            model_config = await self.model_config.get_user_config(username)
            
            response = await self.model_config.call_model(
                model_config=model_config,
                model_purpose="json_extraction",
                system_prompt=system_prompt,
                user_message=user_prompt,
                temperature=0.3,
                username=username
            )
            
            # Parse JSON
            response_text = response.strip()
            if "```" in response_text:
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.split("```")[0]
            
            rankings = json.loads(response_text)
            
            # Apply rankings to original candidates
            ranked_candidates = []
            for rank in rankings:
                candidate_idx = rank["id"]
                if candidate_idx < len(candidates):
                    candidate = candidates[candidate_idx].copy()
                    
                    # Add match analysis
                    candidate["match_analysis"] = {
                        "overall_match_score": rank["overall_match_score"],
                        "match_label": rank["match_label"],
                        "summary": rank["summary"],
                        "strengths": [{"strength": s} for s in rank.get("strengths", [])],
                        "concerns": [{"concern": c} for c in rank.get("concerns", [])]
                    }
                    
                    candidate["match_score"] = rank["overall_match_score"]
                    candidate["score"] = rank["overall_match_score"]
                    
                    # Wrap in expected structure for results page
                    ranked_candidates.append({
                        "candidate": candidate,
                        "match_analysis": candidate["match_analysis"],
                        "match_score": rank["overall_match_score"]
                    })
            
            logger.info(f"✅ LLM ranked {len(ranked_candidates)} candidates")
            return ranked_candidates
            
        except Exception as e:
            logger.error(f"❌ LLM ranking failed: {e}", exc_info=True)
            # Return candidates with default structure
            return [
                {
                    "candidate": c,
                    "match_score": 50,
                    "match_analysis": {
                        "overall_match_score": 50,
                        "match_label": "Needs Review",
                        "summary": "Unable to rank automatically.",
                        "strengths": [],
                        "concerns": []
                    }
                }
                for c in candidates
            ]

    def _fallback_rejection_handling(self, reason: str) -> Dict[str, Any]:
        """Fallback rejection handling without LLM."""
        
        reason_lower = reason.lower()
        
        result = {
            "understood_issue": reason,
            "donna_response": "Got it! Let me adjust the search.",
            "refinements_applied": [],
            "profile_updates": {},
            "feedback_adjustments": {}
        }
        
        if "junior" in reason_lower or "experience" in reason_lower or "senior" in reason_lower:
            result["feedback_adjustments"]["min_years"] = 5
            result["feedback_adjustments"]["excluded_titles"] = ["junior", "intern", "trainee", "graduate"]
            result["refinements_applied"].append("Filtering for 5+ years experience")
            result["donna_response"] = "Got it! I'll look for more experienced candidates with 5+ years."
        
        elif "location" in reason_lower or "remote" in reason_lower:
            result["refinements_applied"].append("Adjusting location preferences")
            result["donna_response"] = "I understand the location isn't right. Could you tell me which locations work best?"
        
        elif "skill" in reason_lower:
            result["refinements_applied"].append("Adjusting skill requirements")
            result["donna_response"] = "I see - which specific skills are most important for this role?"
        
        elif "industry" in reason_lower:
            result["refinements_applied"].append("Filtering industry")
            result["donna_response"] = "Got it! Which industries should I focus on?"
        
        else:
            result["donna_response"] = f"Understood - '{reason}'. Let me refine the search based on that."
        
        return result