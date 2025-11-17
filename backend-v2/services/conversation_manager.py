"""
Conversation Manager V3
=======================
Manages conversation state and flow for Donna (AI assistant).

UPDATED FOR V3: Integrates with IntelligentSearchCrew for multi-agent search.

This service:
- Tracks conversation state (greeting → skills → experience → preferences → ready)
- Decides what questions to ask next
- Determines when enough information is gathered
- Builds ideal profile progressively
- Uses CrewAI multi-agent system for intelligent candidate search
- Updates sample profile as conversation progresses

This is the brain of the conversational interface!
"""

import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from core.logging_config import get_logger
from data.redis_cache import RedisCache
from models.conversation_models import (ConversationMessage, ConversationStage,
                                        ConversationState, IdealProfileCard,
                                        SampleProfile)
from services.conversation_prompts import ConversationPrompts
from services.model_config_manager import ModelConfigManager
from services.sample_profile_generator_v3 import SampleProfileGeneratorV3

logger = get_logger(__name__)


class ConversationManager:
    """
    Manages conversation flow and state for Donna.
    
    V3 Enhancement: Integrates with CrewAI intelligent search system.
    
    State Machine:
    greeting → skills → experience → preferences → review → ready
    """
    
    # Conversation stages
    STAGES = [
        ConversationStage.GREETING,
        ConversationStage.SKILLS,
        ConversationStage.EXPERIENCE,
        ConversationStage.PREFERENCES,
        ConversationStage.REVIEW,
        ConversationStage.READY
    ]
    
    # Minimum required fields for each stage
    STAGE_REQUIREMENTS = {
        ConversationStage.GREETING: [],
        ConversationStage.SKILLS: ["role_title", "must_have_skills"],
        ConversationStage.EXPERIENCE: ["seniority", "experience_years"],
        ConversationStage.PREFERENCES: ["industries"],
        ConversationStage.REVIEW: [],  # All previous stages complete
        ConversationStage.READY: []  # User confirmed
    }
    
    # Maximum turns per stage (prevent infinite loops)
    MAX_TURNS_PER_STAGE = 5
    
    def __init__(
        self,
        redis_cache: RedisCache,
        model_config_manager: ModelConfigManager,
        sample_profile_generator: SampleProfileGeneratorV3  # ⭐ V3 generator
    ):
        """
        Initialize conversation manager.
        
        Args:
            redis_cache: Redis cache for session storage
            model_config_manager: Model configuration manager
            sample_profile_generator: V3 Sample profile generator with CrewAI
        """
        self.redis = redis_cache
        self.model_config = model_config_manager
        self.sample_generator = sample_profile_generator  # V3 with CrewAI
        self.prompts = ConversationPrompts()
        
        logger.info("✅ ConversationManager initialized with CrewAI V3 generator")
    
    
    # ================================================================
    # START CONVERSATION
    # ================================================================
    
    async def start_conversation(
        self,
        session_id: str,
        username: str,
        initial_message: Optional[str] = None,
        jd_data: Optional[Dict] = None
    ) -> Tuple[str, IdealProfileCard, Optional[SampleProfile], str]:
        """
        Start a new conversation with Donna.
        
        Args:
            session_id: Unique session identifier
            username: Logged-in user
            initial_message: Optional initial user message
            jd_data: Optional parsed JD data
        
        Returns:
            Tuple of (donna_reply, ideal_profile, sample_profile, stage)
        """
        
        # Initialize conversation state
        state = ConversationState(
            session_id=session_id,
            username=username,
            stage=ConversationStage.GREETING
        )
        
        # If JD provided, pre-fill profile
        if jd_data:
            state.ideal_profile = self._jd_to_profile(jd_data)
            logger.info(f'JD to profile: {state.ideal_profile}')
            state.jd_uploaded = True
            state.stage = ConversationStage.REVIEW
            
            # ✅ Generate sample using CrewAI V3
            sample_profile = None
            donna_reply = ""
            
            if self._has_minimum_info(state.ideal_profile):
                try:
                    # ⭐ Call V3 generator with CrewAI
                    logger.info("🤖 Starting CrewAI intelligent search...")
                    result = await self.sample_generator.generate_samples(
                        ideal_profile=state.ideal_profile.dict(),
                        count=1
                    )
                    
                    if result.get("success"):
                        candidates = result.get("candidates", [])
                        
                        if candidates:
                            # Convert first candidate to SampleProfile
                            sample_profile = self._candidate_to_sample(candidates[0])
                            state.sample_profile = sample_profile
                            
                            # Store metadata for frontend
                            state.last_search_metadata = {
                                "iterations": result.get("metadata", {}).get("iterations", 0),
                                "final_query": result.get("metadata", {}).get("final_query", {}),
                                "agent_mode": True
                            }
                            
                            donna_reply = self.prompts.get_greeting_with_jd()
                            logger.info(f'✅ CrewAI found candidate in {result["metadata"]["iterations"]} iterations')
                        else:
                            # No candidates found
                            logger.warning("⚠️ CrewAI couldn't find matching candidates")
                            donna_reply = """I've analyzed your JD and extracted the requirements. 

However, I couldn't find matching candidates with the current criteria. Let's refine the search together!

Could you tell me:
- What alternative job titles should I search for?
- Are there specific companies or industries you're targeting?
- What locations are you open to?"""
                    else:
                        # Search failed
                        error = result.get("error", "Unknown error")
                        logger.error(f"❌ CrewAI search failed: {error}")
                        donna_reply = """I've analyzed your JD but encountered some difficulty finding matching candidates. 

Could you tell me more about what you're looking for? For example:
- What alternative job titles should I search for?
- Are there specific companies or industries you're targeting?
- What locations are you open to?"""
                        
                except Exception as e:
                    logger.error(f"Failed to generate sample profile: {e}")
                    sample_profile = None
                    donna_reply = """I've analyzed your JD but encountered some difficulty finding matching candidates. 

Could you tell me more about what you're looking for?"""
            else:
                # Not enough info in JD
                sample_profile = None
                donna_reply = """I've analyzed your JD, but I need a bit more information to find great matches.

What role are you looking to fill?"""
        
        # If initial message provided, process it
        elif initial_message:
            # Extract info from initial message
            extracted = await self._extract_info_from_message(
                initial_message,
                state.ideal_profile,
                username=username 
            )
            state.ideal_profile = extracted
            
            # Decide next question
            donna_reply, new_stage = await self._decide_next_question(state)
            state.stage = new_stage
            sample_profile = None
        
        # Otherwise, start fresh
        else:
            donna_reply = self.prompts.get_greeting_without_jd()
            sample_profile = None
        
        # Add initial messages
        if initial_message:
            state.messages.append(ConversationMessage(
                role="user",
                content=initial_message
            ))
        
        state.messages.append(ConversationMessage(
            role="assistant",
            content=donna_reply
        ))
        
        # Save state
        await self._save_state(state)
        
        return donna_reply, state.ideal_profile, sample_profile, state.stage
    
    
    # ================================================================
    # PROCESS USER MESSAGE
    # ================================================================
    
    async def process_message(
        self,
        session_id: str,
        user_message: str,
        action: Optional[str] = None
    ) -> Tuple[str, IdealProfileCard, Optional[SampleProfile], str, bool, List[str]]:
        """
        Process user's message and generate Donna's response.
        
        Args:
            session_id: Session identifier
            user_message: User's message
            action: Optional action ('update_card', 'ready_to_search', 'show_sample')
        
        Returns:
            Tuple of (donna_reply, updated_profile, sample_profile, stage, ready, suggestions)
        """
        
        # Load conversation state
        state = await self._load_state(session_id)
        if not state:
            raise ValueError(f"No conversation found for session {session_id}")
        
        # Add user message
        state.messages.append(ConversationMessage(
            role="user",
            content=user_message
        ))
        state.turn_count += 1
        state.stage_turn_count += 1
        
        # Handle special actions
        if action == "ready_to_search":
            donna_reply = self.prompts.ready_to_search_confirmation()
            state.ready_to_search = True
            state.stage = ConversationStage.READY
            suggestions = []
        
        elif action == "show_sample":
            # ⭐ Generate sample using CrewAI V3
            donna_reply, suggestions = await self._generate_sample_with_crew(state)
        
        # Regular message processing
        else:
            # Extract info from user message
            extracted = await self._extract_info_from_message(
                user_message,
                state.ideal_profile,
                username=state.username
            )
            
            # Detect if user wants to see sample
            user_wants_sample = self._detect_sample_request(user_message, state.stage)
            
            # Check what changed BEFORE merging
            significant_changes = self._detect_significant_changes(
                state.ideal_profile, 
                extracted
            )
            
            # Merge with existing profile
            state.ideal_profile = self._merge_profiles(
                state.ideal_profile,
                extracted
            )
            
            # ✅ Auto-regenerate sample if significant changes or user requested
            if (user_wants_sample or significant_changes) and self._has_minimum_info(state.ideal_profile):
                if user_wants_sample:
                    logger.info("🎯 User requested sample generation")
                else:
                    logger.info(f"🔄 Significant changes detected: {significant_changes}")
                
                # Generate sample using CrewAI
                donna_reply, suggestions = await self._generate_sample_with_crew(state)
                
                # Early return after sample generation
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
            
            # Decide next question and stage
            donna_reply, new_stage = await self._decide_next_question(state)
            
            # Check if stage changed
            if new_stage != state.stage:
                state.stage = new_stage
                state.stage_turn_count = 0
            
            # Get suggestions for quick replies
            suggestions = self._get_suggestions(state.stage, state.ideal_profile)
            
            # Check if ready to search
            state.ready_to_search = self._check_if_ready(state)
        
        # Add Donna's response
        state.messages.append(ConversationMessage(
            role="assistant",
            content=donna_reply
        ))
        
        # Update timestamp
        state.updated_at = datetime.utcnow().isoformat()
        
        # Save state
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
    # CREWAI INTEGRATION METHODS
    # ================================================================
    
    async def _generate_sample_with_crew(
        self,
        state: ConversationState
    ) -> Tuple[str, List[str]]:
        """
        Generate sample using CrewAI intelligent search.
        
        Args:
            state: Current conversation state
            
        Returns:
            Tuple of (donna_reply, suggestions)
        """
        logger.info("🤖 Starting CrewAI intelligent search...")
        
        try:
            # Call CrewAI V3 generator
            result = await self.sample_generator.generate_samples(
                ideal_profile=state.ideal_profile.dict(),
                count=1
            )
            
            if result.get("success"):
                candidates = result.get("candidates", [])
                metadata = result.get("metadata", {})
                
                if candidates:
                    # Success! Convert to SampleProfile
                    sample_profile = self._candidate_to_sample(candidates[0])
                    state.sample_profile = sample_profile
                    
                    # Store search metadata
                    state.last_search_metadata = {
                        "iterations": metadata.get("iterations", 0),
                        "final_query": metadata.get("final_query", {}),
                        "crew_output": metadata.get("crew_output", ""),
                        "agent_mode": True
                    }
                    
                    donna_reply = f"""Great news! I found a matching candidate. 

This search used our intelligent AI agent system, which analyzed your requirements through {metadata.get('iterations', 0)} iterations to find the best match.

{self.prompts.present_sample_profile()}"""
                    
                    suggestions = ["Yes, looks good!", "No, adjust criteria", "Show more like this"]
                    logger.info(f"✅ CrewAI found candidate in {metadata.get('iterations', 0)} iterations")
                    
                else:
                    # No candidates found
                    state.sample_profile = None
                    donna_reply = """I couldn't find matching candidates with the current criteria. 

The AI agents tried multiple query strategies but didn't find good matches. Let's refine the search:

Could you tell me:
- Should I broaden the search criteria?
- Are there alternative job titles to consider?
- What other industries or locations should I include?"""
                    
                    suggestions = ["Broaden criteria", "Try different keywords", "Adjust requirements"]
                    logger.warning("⚠️ CrewAI couldn't find candidates")
                    
            else:
                # Search failed
                error = result.get("error", "Unknown error")
                logger.error(f"❌ CrewAI search failed: {error}")
                
                state.sample_profile = None
                donna_reply = """I encountered an issue while searching for candidates.

Let me try with simpler criteria. Could you tell me more about:
- The most critical skills required?
- Alternative job titles that might work?
- Any flexibility on experience level or location?"""
                
                suggestions = ["Tell me more", "Simplify criteria"]
                
        except Exception as e:
            logger.error(f"Failed to generate sample with CrewAI: {e}")
            
            state.sample_profile = None
            donna_reply = """I encountered an issue while searching. Let me ask you directly:

What are the absolute must-have requirements for this role?"""
            
            suggestions = ["Tell me more", "Try again"]
        
        return donna_reply, suggestions
    
    
    async def refine_sample_with_feedback(
        self,
        session_id: str,
        feedback: str
    ) -> Tuple[str, Optional[SampleProfile]]:
        """
        Refine sample search based on user feedback.
        
        Uses CrewAI's refine_search capability.
        
        Args:
            session_id: Session identifier
            feedback: User's feedback on why previous sample wasn't good
            
        Returns:
            Tuple of (donna_reply, new_sample_profile)
        """
        state = await self._load_state(session_id)
        if not state:
            raise ValueError(f"No conversation found for session {session_id}")
        
        logger.info(f"🔄 Refining search with feedback: {feedback}")
        
        try:
            # Get previous query from metadata
            previous_query = state.last_search_metadata.get("final_query", {})
            
            # Call V3 refine_search
            result = await self.sample_generator.refine_search(
                ideal_profile=state.ideal_profile.dict(),
                user_feedback=feedback,
                previous_query=previous_query,
                count=1
            )
            
            if result.get("success"):
                candidates = result.get("candidates", [])
                
                if candidates:
                    sample_profile = self._candidate_to_sample(candidates[0])
                    state.sample_profile = sample_profile
                    
                    # Update metadata
                    state.last_search_metadata = {
                        "iterations": result.get("metadata", {}).get("iterations", 0),
                        "refinement_applied": True,
                        "agent_mode": True
                    }
                    
                    donna_reply = f"""I've refined the search based on your feedback!

Here's a new candidate that better matches what you're looking for.

Is this closer to what you need?"""
                    
                    await self._save_state(state)
                    return donna_reply, sample_profile
                    
            # If we get here, refinement didn't work
            donna_reply = """I'm still having trouble finding the right match.

Could you be more specific about what's missing or what needs to change?"""
            
            return donna_reply, None
            
        except Exception as e:
            logger.error(f"Failed to refine search: {e}")
            return "I encountered an issue refining the search. Let's try a different approach.", None
    
    
    def _candidate_to_sample(self, candidate: Dict) -> SampleProfile:
        """
        Convert candidate dict from CrewAI to SampleProfile.
        
        Args:
            candidate: Candidate dictionary from search
            
        Returns:
            SampleProfile object
        """
        return SampleProfile(
            name=f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
            title=candidate.get("title", "Not specified"),
            location=candidate.get("location", "Not specified"),
            experience_years=candidate.get("experience_years", 0),
            current_company=candidate.get("current_company", "Not specified"),
            skills=candidate.get("expertise", [])[:5] if candidate.get("expertise") else [],
            match_score=85,  # You can calculate this based on match criteria
            match_reasoning="Found via intelligent AI agent search",
            linkedin_url=candidate.get("linkedin_url", ""),
            summary=self._generate_candidate_summary(candidate)
        )
    
    
    def _generate_candidate_summary(self, candidate: Dict) -> str:
        """Generate a short summary for the candidate."""
        title = candidate.get("title", "Professional")
        years = candidate.get("experience_years", 0)
        industry = candidate.get("current_industry", "their field")
        
        return f"{title} with {years}+ years of experience in {industry}."
    
    
    # ================================================================
    # HELPER METHODS
    # ================================================================
    
    def _detect_sample_request(self, user_message: str, current_stage: str) -> bool:
        """
        Detect if user is requesting to see a sample candidate.
        
        Args:
            user_message: User's message
            current_stage: Current conversation stage
        
        Returns:
            True if user wants to see sample
        """
        # Only check in REVIEW stage
        if current_stage != ConversationStage.REVIEW:
            return False
        
        message_lower = user_message.lower().strip()
        
        # Positive indicators
        positive_phrases = [
            "yes",
            "yeah",
            "sure",
            "okay",
            "ok",
            "show me",
            "let's see",
            "lets see",
            "show sample",
            "see sample",
            "show candidate",
            "see candidate",
            "show profile",
            "view sample",
            "view profile",
            "i want to see",
            "i'd like to see",
            "can i see",
            "please show",
            "go ahead",
            "proceed",
            "continue"
        ]
        
        # Check if message contains positive indicators
        for phrase in positive_phrases:
            if phrase in message_lower:
                return True
        
        return False
    
    
    async def _extract_info_from_message(
        self,
        message: str,
        current_profile: IdealProfileCard,
        username: str = None 
    ) -> IdealProfileCard:
        """
        Extract structured info from user's message.
        
        Uses LLM to parse natural language into profile fields.
        
        Args:
            message: User's message
            current_profile: Current profile state
            username: Username for model config
        
        Returns:
            Updated IdealProfileCard with extracted info
        """
        
        # Build prompt for LLM
        system_prompt = self.prompts.get_llm_extraction_prompt()
        
        user_prompt = f"""Current Profile State:
{json.dumps(current_profile.dict(), indent=2)}

User's Message:
"{message}"

Extract new information and return updated fields as JSON."""
        
        # Call LLM via model config manager
        model_config = await self.model_config.get_user_config(username)
        
        # Get extraction model
        extraction_response = await self.model_config.call_model(
            model_config=model_config,
            model_purpose="extraction",
            system_prompt=system_prompt,
            user_message=user_prompt,
            temperature=0.3,
            username=username 
        )
        
        # Parse JSON response
        try:
            extracted_data = json.loads(extraction_response)
            
            # Create updated profile
            updated_profile = current_profile.copy()
            
            # Update fields that were extracted
            for field, value in extracted_data.items():
                if value:  # Only update if not null/empty
                    setattr(updated_profile, field, value)
            
            return updated_profile
        
        except json.JSONDecodeError:
            # If LLM didn't return valid JSON, return unchanged profile
            return current_profile
    
    
    def _detect_significant_changes(
        self,
        old_profile: IdealProfileCard,
        new_profile: IdealProfileCard
    ) -> List[str]:
        """
        Detect significant changes that warrant sample regeneration.
        
        Returns:
            List of changed fields
        """
        changes = []
        
        # Fields that trigger sample regeneration
        significant_fields = [
            "role_title",
            "must_have_skills", 
            "seniority",
            "experience_years",
            "industries",
            "locations"
        ]
        
        for field in significant_fields:
            old_value = getattr(old_profile, field, None)
            new_value = getattr(new_profile, field, None)
            
            # Handle lists vs strings
            if isinstance(old_value, list) and isinstance(new_value, list):
                if set(old_value) != set(new_value) and new_value:
                    changes.append(field)
            elif old_value != new_value and new_value:
                changes.append(field)
        
        return changes
    
    
    async def _decide_next_question(
        self,
        state: ConversationState
    ) -> Tuple[str, str]:
        """
        Decide what Donna should ask next.
        
        Based on:
        - Current stage
        - What info we have
        - What info we're missing
        - How many turns in this stage
        
        Args:
            state: Current conversation state
        
        Returns:
            Tuple of (donna_question, new_stage)
        """
        
        profile = state.ideal_profile
        current_stage = state.stage
        
        # GREETING STAGE
        if current_stage == ConversationStage.GREETING:
            if profile.role_title:
                # Move to skills
                donna_question = self.prompts.ask_about_must_have_skills(profile.role_title)
                new_stage = ConversationStage.SKILLS
            else:
                donna_question = "What role are you hiring for?"
                new_stage = ConversationStage.GREETING
        
        # SKILLS STAGE
        elif current_stage == ConversationStage.SKILLS:
            if not profile.role_title:
                donna_question = "What role are you hiring for?"
                new_stage = ConversationStage.SKILLS
            elif not profile.must_have_skills:
                donna_question = self.prompts.ask_about_must_have_skills(profile.role_title)
                new_stage = ConversationStage.SKILLS
            elif len(profile.must_have_skills) >= 2 and not profile.nice_to_have_skills:
                donna_question = self.prompts.ask_about_nice_to_have_skills()
                new_stage = ConversationStage.SKILLS
            else:
                # Move to experience
                donna_question = self.prompts.confirm_skills_and_move_on()
                new_stage = ConversationStage.EXPERIENCE
        
        # EXPERIENCE STAGE
        elif current_stage == ConversationStage.EXPERIENCE:
            if not profile.seniority:
                donna_question = self.prompts.ask_about_seniority()
                new_stage = ConversationStage.EXPERIENCE
            elif not profile.experience_years:
                donna_question = self.prompts.ask_about_experience_years()
                new_stage = ConversationStage.EXPERIENCE
            else:
                # Move to preferences
                donna_question = self.prompts.confirm_experience_and_move_on()
                new_stage = ConversationStage.PREFERENCES
        
        # PREFERENCES STAGE
        elif current_stage == ConversationStage.PREFERENCES:
            if not profile.industries:
                donna_question = self.prompts.ask_about_industries()
                new_stage = ConversationStage.PREFERENCES
            elif not profile.locations:
                donna_question = self.prompts.ask_about_locations()
                new_stage = ConversationStage.PREFERENCES
            else:
                # Move to review
                donna_question = self.prompts.show_summary_for_review(profile)
                new_stage = ConversationStage.REVIEW
        
        # REVIEW STAGE
        elif current_stage == ConversationStage.REVIEW:
            # Check if we already have a sample
            if state.sample_profile:
                donna_question = "Is this the kind of candidate you're looking for?"
            else:
                # Don't have sample yet - ask if they want to see one
                donna_question = "Want to see a sample candidate matching this profile?"
            new_stage = ConversationStage.REVIEW
        
        # READY STAGE
        else:
            donna_question = self.prompts.ready_to_search_confirmation()
            new_stage = ConversationStage.READY
        
        return donna_question, new_stage
    
    
    def _merge_profiles(
        self,
        current: IdealProfileCard,
        extracted: IdealProfileCard
    ) -> IdealProfileCard:
        """
        Merge extracted info with current profile.
        
        Rules:
        - Lists get appended (deduplicated)
        - Strings get replaced if extracted is not empty
        - Preserve existing if extracted is empty
        """
        
        merged = current.copy()
        
        # Merge lists
        if extracted.must_have_skills:
            merged.must_have_skills = list(set(
                merged.must_have_skills + extracted.must_have_skills
            ))
        
        if extracted.nice_to_have_skills:
            merged.nice_to_have_skills = list(set(
                merged.nice_to_have_skills + extracted.nice_to_have_skills
            ))
        
        if extracted.industries:
            merged.industries = list(set(
                merged.industries + extracted.industries
            ))
        
        if extracted.locations:
            merged.locations = list(set(
                merged.locations + extracted.locations
            ))
        
        if extracted.company_size:
            merged.company_size = list(set(
                merged.company_size + extracted.company_size
            ))
        
        # Replace strings
        if extracted.role_title:
            merged.role_title = extracted.role_title
        
        if extracted.seniority:
            merged.seniority = extracted.seniority
        
        if extracted.experience_years:
            merged.experience_years = extracted.experience_years
        
        if extracted.additional_requirements:
            merged.additional_requirements = extracted.additional_requirements
        
        # Update timestamp
        merged.updated_at = datetime.utcnow().isoformat()
        
        return merged
    
    
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
        """Check if profile has minimum info for sample generation."""
        return bool(
            profile.role_title and
            len(profile.must_have_skills) >= 2
        )
    
    
    def _check_if_ready(self, state: ConversationState) -> bool:
        """Check if conversation has enough info to search."""
        
        profile = state.ideal_profile
        
        # Minimum requirements for a basic search
        has_minimum = bool(
            profile.role_title and 
            len(profile.must_have_skills) >= 1
        )
        
        # Good-to-have but not required for simple searches
        has_context = bool(
            profile.seniority or 
            profile.experience_years or
            profile.industries or
            profile.locations
        )
        
        # If user provided comprehensive initial query, allow immediate search
        # Otherwise, gather at least some context
        if state.turn_count == 1 and has_minimum:
            # First message with basics = allow search
            return True
        
        # For multi-turn conversations, require some additional context
        return has_minimum and has_context

    
    def _get_suggestions(self, stage: str, profile: IdealProfileCard) -> List[str]:
        """Get suggestions based on current stage."""
        
        if stage == ConversationStage.GREETING:
            return self.prompts.get_role_suggestions()
        elif stage == ConversationStage.SKILLS:
            return ["That's all for must-haves", "Show sample profile"]
        elif stage == ConversationStage.EXPERIENCE:
            return self.prompts.get_seniority_suggestions()
        elif stage == ConversationStage.PREFERENCES:
            return self.prompts.get_industry_suggestions()
        elif stage == ConversationStage.REVIEW:
            return ["Yes, looks good!", "Make changes", "Show sample"]
        else:
            return []
    
    
    async def _save_state(self, state: ConversationState):
        """Save conversation state to Redis."""
        
        await self.redis.store_session_data(
            state.session_id,
            "conversation_state",
            state.dict(),
            expire_seconds=3600  # 1 hour
        )
    
    
    async def _load_state(self, session_id: str) -> Optional[ConversationState]:
        """Load conversation state from Redis."""
        
        data = await self.redis.get_session_data(session_id, "conversation_state")
        
        if data:
            return ConversationState(**data)
        
        return None