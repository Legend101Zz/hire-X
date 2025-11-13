"""
Conversation Manager
===================
Manages conversation state and flow for Donna (AI assistant).

This service:
- Tracks conversation state (greeting → skills → experience → preferences → ready)
- Decides what questions to ask next
- Determines when enough information is gathered
- Builds ideal profile progressively
- Updates sample profile as conversation progresses

This is the brain of the conversational interface!
"""

import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from models.conversation_models import (ConversationMessage, ConversationStage,
                                        ConversationState, IdealProfileCard,
                                        SampleProfile)
from services.conversation_prompts import ConversationPrompts


class ConversationManager:
    """
    Manages conversation flow and state for Donna.
    
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
        redis_cache,
        model_config_manager,
        sample_profile_generator
    ):
        """
        Initialize conversation manager.
        
        Args:
            redis_cache: Redis cache for session storage
            model_config_manager: Model configuration manager
            sample_profile_generator: Sample profile generator
        """
        self.redis = redis_cache
        self.model_config = model_config_manager
        self.sample_generator = sample_profile_generator
        self.prompts = ConversationPrompts()
    
    
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
            state.jd_uploaded = True
            state.stage = ConversationStage.REVIEW
            donna_reply = self.prompts.get_greeting_with_jd()
            
            # Generate sample profile
            if self._has_minimum_info(state.ideal_profile):
                sample_profile = await self.sample_generator.generate_sample(
                    state.ideal_profile
                )
                state.sample_profile = sample_profile
            else:
                sample_profile = None
        
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
        state.turn_csount += 1
        state.stage_turn_count += 1
        
        # Handle special actions
        if action == "ready_to_search":
            donna_reply = self.prompts.ready_to_search_confirmation()
            state.ready_to_search = True
            state.stage = ConversationStage.READY
            suggestions = []
        
        elif action == "show_sample":
            # Generate sample profile
            sample_profile = await self.sample_generator.generate_sample(
                state.ideal_profile
            )
            state.sample_profile = sample_profile
            donna_reply = self.prompts.present_sample_profile()
            suggestions = ["Yes, looks good!", "No, adjust criteria"]
        
        # Regular message processing
        else:
            # Extract info from user message
            extracted = await self._extract_info_from_message(
                user_message,
                state.ideal_profile,
                username=None
            )
            
            # Merge with existing profile
            state.ideal_profile = self._merge_profiles(
                state.ideal_profile,
                extracted
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
    # HELPER METHODS
    # ================================================================
    
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
            temperature=0.3
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
            donna_question = "Want to see a sample candidate?"
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
        
        return bool(
            profile.role_title and
            len(profile.must_have_skills) >= 3 and
            profile.seniority and
            profile.experience_years
        )
    
    
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
            ttl=3600  # 1 hour
        )
    
    
    async def _load_state(self, session_id: str) -> Optional[ConversationState]:
        """Load conversation state from Redis."""
        
        data = await self.redis.get_session_data(session_id, "conversation_state")
        
        if data:
            return ConversationState(**data)
        
        return None