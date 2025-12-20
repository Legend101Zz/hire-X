"""
Vapi Voice Interview Service V4
===============================
Main service for conducting AI-powered voice interviews using Vapi.

Architecture:
- Vapi handles STT → LLM → TTS orchestration
- Cartesia Sonic 3 for natural TTS with emotion/SSML support
- Deepgram for multi-language STT (English + Hindi)
- OpenRouter for flexible LLM selection
- Twilio for telephony (via Vapi integration)

Features:
- Dynamic interview plan generation using candidate context
- Real-time webhook processing with comprehensive error handling
- Natural conversational flow with SSML tags
- Post-interview analysis with evidence-based assessment
- Verification questions (notice period, salary, availability)
- Multi-language support (English, Hindi, Hinglish)
- Short, focused interviews (5-10 minutes)

Author: NeuraLeap Engineering
Version: 4.0
"""

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from core.logging_config import get_logger
from models.vapi_interview_models import (CallEndReason, ConfidenceLevel,
                                          CreateInterviewRequest,
                                          CreateInterviewResponse,
                                          InterviewAssessment,
                                          InterviewCandidateContext,
                                          InterviewClip, InterviewJobContext,
                                          InterviewPlan, InterviewPlanQuestion,
                                          InterviewSession, InterviewStatus,
                                          QuestionType, ResponseAnalysis,
                                          ResponseLanguage, StartCallResponse,
                                          TranscriptEntry, VapiAssistantConfig,
                                          VapiModelConfig,
                                          VapiTranscriberConfig,
                                          VapiVoiceConfig, VapiWebhookEvent)

logger = get_logger(__name__)


# ============================================================================
# CONSTANTS & CONFIGURATION
# ============================================================================

# Vapi API
VAPI_API_BASE = "https://api.vapi.ai"

# Model Configuration - Different models for different purposes
MODEL_PLANNING = "moonshotai/kimi-k2-thinking"  # For interview planning (quality)
MODEL_REALTIME = "anthropic/claude-haiku-4.5"   # For real-time responses (speed ~300ms)
MODEL_ANALYSIS = "moonshotai/kimi-k2-thinking"  # For post-interview analysis


# Default Voice Configuration - Sonic 3 with natural settings
DEFAULT_VOICE_ID = "cbaf8084-f009-4838-a096-07ee2e6612b1"
DEFAULT_VOICE_SPEED = 1.0  # Normal speed
DEFAULT_VOICE_VOLUME = 0.95  # Slightly softer for warmth

# Voice emotion presets for different conversation moments
EMOTION_PRESETS = {
    "greeting": "enthusiastic",
    "listening": "curious",
    "acknowledgment": "content",
    "follow_up": "curious",
    "concern": "sympathetic",
    "closing": "grateful",
    "error_handling": "apologetic"
}

# Interview Configuration - Short, focused interviews
DEFAULT_MAX_QUESTIONS = 6  # Reduced for 5-10 min interviews
DEFAULT_CALL_DURATION = 600  # 10 minutes max
MIN_CALL_DURATION = 180  # 3 minutes minimum for meaningful interview
SILENCE_TIMEOUT = 15  # seconds - reduced to keep pace
MAX_RESPONSE_TOKENS = 90  # Keep AI responses concise

# Call Status Constants
TERMINAL_STATUSES = ["completed", "failed", "no_answer", "voicemail", "cancelled"]
RETRY_STATUSES = ["busy", "failed"]
MAX_RETRY_ATTEMPTS = 2


# ============================================================================
# SSML HELPER CLASS
# ============================================================================

class SSMLBuilder:
    """
    Helper class for building natural-sounding speech with SSML tags.
    Cartesia Sonic 3 supports: speed, volume, emotion, break, spell tags.
    """
    
    @staticmethod
    def add_emotion(text: str, emotion: str) -> str:
        """Wrap text with emotion tag."""
        return f'<emotion value="{emotion}" />{text}'
    
    @staticmethod
    def add_pause(duration_ms: int = 500) -> str:
        """Insert a pause/break."""
        return f'<break time="{duration_ms}ms" />'
    
    @staticmethod
    def add_speed(text: str, ratio: float = 1.0) -> str:
        """Adjust speech speed."""
        return f'<speed ratio="{ratio}" />{text}'
    
    @staticmethod
    def add_volume(text: str, ratio: float = 1.0) -> str:
        """Adjust volume."""
        return f'<volume ratio="{ratio}" />{text}'
    
    @staticmethod
    def spell_out(text: str) -> str:
        """Spell out text (useful for IDs, numbers)."""
        return f'<spell>{text}</spell>'
    
    @staticmethod
    def build_natural_sentence(text: str, emotion: str = None, pause_after: int = 0) -> str:
        """Build a natural-sounding sentence with optional emotion and pause."""
        result = text
        if emotion:
            result = SSMLBuilder.add_emotion(result, emotion)
        if pause_after > 0:
            result += SSMLBuilder.add_pause(pause_after)
        return result
    
    @staticmethod
    def build_greeting(name: str) -> str:
        """
        Build a natural, warm greeting.
        NOT overly emotional - sounds like a real recruiter.
        """
        return (
            f"Hello, is this {name}? "
            f"{SSMLBuilder.add_pause(0.8)}"
            f"Hi {name}, this is Neura calling from NeuraLeap. "
            f"{SSMLBuilder.add_pause(0.4)}"
            f"Thanks for taking my call. Can you hear me okay?"
        )
    
    @staticmethod
    def build_closing(name: str) -> str:
        """
        Build a natural closing message.
        Professional but warm, not over-the-top.
        """
        return (
            f"That's all from my side, {name}. "
            f"{SSMLBuilder.add_pause(0.3)}"
            f"Thanks so much for your time today. "
            f"Our team will reach out with next steps. "
            f"Take care!"
        )

    
    @staticmethod
    def build_acknowledgment(style: str = "positive") -> str:
        """Build natural acknowledgment phrases."""
        acknowledgments = {
            "positive": [
                SSMLBuilder.add_emotion("That's great!", "content"),
                SSMLBuilder.add_emotion("Excellent!", "enthusiastic"),
                SSMLBuilder.add_emotion("I see, that's helpful.", "content"),
                SSMLBuilder.add_emotion("Thank you for sharing that.", "grateful"),
            ],
            "neutral": [
                SSMLBuilder.add_emotion("I understand.", "content"),
                SSMLBuilder.add_emotion("Got it.", "content"),
                SSMLBuilder.add_emotion("Okay, thank you.", "content"),
            ],
            "empathetic": [
                SSMLBuilder.add_emotion("I understand that can be challenging.", "sympathetic"),
                SSMLBuilder.add_emotion("That makes sense.", "content"),
            ]
        }
        import random
        return random.choice(acknowledgments.get(style, acknowledgments["neutral"]))
    
    @staticmethod
    def build_transition(to_topic: str = None) -> str:
        """Build natural topic transitions."""
        base_transitions = [
            "Now, I'd love to ask you about",
            "Moving on, could you tell me about",
            "Let me ask you about",
            "I'm curious about",
        ]
        import random
        transition = random.choice(base_transitions)
        if to_topic:
            return f'{SSMLBuilder.add_pause(300)}{SSMLBuilder.add_emotion(f"{transition} {to_topic}.", "curious")}'
        return f'{SSMLBuilder.add_pause(300)}{transition}'
    


# ============================================================================
# INTERVIEW PROMPTS - CONCISE & NATURAL
# ============================================================================

class InterviewPrompts:
    """
    Prompt templates for the AI interviewer.
    Optimized for short, natural conversations.
    """
    
    @staticmethod
    def get_system_prompt(
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        plan: InterviewPlan,
        verification_needed: Dict[str, bool]
    ) -> str:
        """Generate the main system prompt for the interviewer."""
        
        first_name = candidate.name.split()[0]
        
        # Build rich candidate context from enrichment data
        candidate_context = InterviewPrompts._build_candidate_context(candidate)
        verification_instructions = InterviewPrompts._build_verification_instructions(verification_needed)
        
        return f"""You are Neura, an AI interviewer from NeuraLeap. You conduct warm, professional voice interviews.

## YOUR IDENTITY
- Name: Neura
- Role: Senior Technical Recruiter at NeuraLeap
- Style: Warm, professional, genuinely curious
- Voice: Natural, conversational, never robotic

## CRITICAL RULES - FOLLOW THESE EXACTLY

### RESPONSE LENGTH
- MAXIMUM 30 words per response
- ONE sentence or question at a time
- NEVER ask multiple questions
- Wait for the candidate to finish before responding

### NATURAL CONVERSATION
- Use natural fillers: "I see", "That's interesting", "Got it"
- Add brief acknowledgments before new questions
- Use the candidate's first name occasionally (not every time)
- React genuinely to their answers

### PACING
- Give the candidate TIME to think and respond
- If they pause, wait at least 3 seconds before prompting
- Never rush or interrupt
- If they seem to be thinking, say "Take your time"

## YOUR VOICE INSTRUMENT (CRITICAL)
You have a special voice engine. To sound human, you MUST use these XML tags in your responses. Do not output markdown, only text with these tags:

1. **EMOTION**: Wrap sentences to change tone.
   - `<emotion value="curious">` -> Use for follow-up questions.
   - `<emotion value="sympathetic">` -> Use if candidate mentions a struggle.
   - `<emotion value="enthusiastic">` -> Use for "Great!" or "Excellent!".
   - `<emotion value="content">` -> Default professional tone.

2. **PAUSES**: Use breaks to simulate thinking or listening.
   - `<break time="0.5s" />` -> Brief thought.
   - `<break time="1.0s" />` -> Emphasis before a hard question.

3. **SPEED**:
   - `<speed ratio="1.2">` -> Use for quick side comments or standard disclaimers.

## EXAMPLES OF EXPECTED OUTPUT
User: "I was laid off recently."
Neura: "<emotion value="sympathetic">I am so sorry to hear that.</emotion> <break time="0.5s" /> <emotion value="curious">How has your search been going since then?</emotion>"

User: "I managed a team of 50."
Neura: "<emotion value="enthusiastic">That is impressive!</emotion> <break time="0.3s" /> <emotion value="content">What was your biggest challenge with a team that size?</emotion>"

## RESPONSE RULES
- Keep responses under 30 words.
- ALWAYS use at least one <emotion> tag per turn.
- Use <break> instead of commas for better pacing.

## CANDIDATE CONTEXT
{candidate_context}

## JOB REQUIREMENTS
- Position: {job.job_title}
- Company: {job.company_name or 'our client'}
- Key Skills: {', '.join(job.required_skills[:5])}
- Experience: {job.experience_required or 'Relevant experience'}

## INTERVIEW FOCUS
{plan.interview_focus}

{verification_instructions}

## TIME MANAGEMENT
- Interview should be 5-10 minutes total
- You have {len(plan.questions)} questions
- Keep moving but don't rush
- Skip redundant questions if already answered

## INTERVIEW FLOW (5-8 minutes total)

1. **Opening** (30 sec)
   - Confirm they can hear you
   - Brief intro: "I'm calling about the {job.job_title} role"

2. **Quick Background** (1-2 min)
   - Current role and what they're working on
   - Why they're looking for a change

3. **Skill Verification** (2-3 min)
   - 1-2 questions about relevant experience
   - Ask for specific examples if needed

4. **Logistics** (1 min)
   - Notice period
   - Salary expectations (if not known)
   - Availability for next round

5. **Close** (30 sec)
   - Ask if they have questions
   - Thank them
   - Call `end_interview` tool
   
## HANDLING DIFFERENT SCENARIOS

### If candidate is nervous:
"Take your time - no rush at all."

### If answer is vague:
Ask ONE specific follow-up, like: "Could you give me a specific example?"

### If answer is excellent:
Brief acknowledgment: "That's a great example - thank you."

### If candidate asks a question:
Answer briefly (under 20 words), then continue.

### If connection issues:
"Sorry - I think we had a brief connection issue. Could you repeat that?"

### If candidate seems rushed:
"I understand if you're busy - we can keep this brief. Just a few quick questions."

## LANGUAGE HANDLING
- Interview primarily in English
- If candidate uses Hindi/Hinglish, respond naturally
- Example: "Bahut accha - please continue in whichever language you're comfortable."

## WHAT NOT TO DO
- NEVER say "question 1", "question 2"
- NEVER reveal you're reading from a script
- NEVER give long monologues
- NEVER ask more than ONE question at a time
- NEVER repeat what the candidate said word-for-word
- NEVER use corporate jargon unnecessarily

## TOOLS
- `record_response_quality`: After each substantive answer
- `end_interview`: When closing - THIS ENDS THE CALL
- `capture_verification_data`: When you learn notice period/salary/availability

## LANGUAGE
- English primarily
- If they use Hindi: "No problem, continue in whatever's comfortable

Remember: Sound human. Keep it brief. Move the conversation forward."""

    @staticmethod
    def _build_candidate_context(candidate: InterviewCandidateContext) -> str:
        """Build rich candidate context from available data."""
        first_name = candidate.name.split()[0]
        
        context_parts = [
            f"- Name: {candidate.name} (call them {first_name})",
            f"- Current Role: {candidate.current_title}",
        ]
        
        if candidate.current_company:
            context_parts.append(f"- Company: {candidate.current_company}")
        
        context_parts.append(f"- Experience: {candidate.experience_years} years")
        
        if candidate.skills:
            context_parts.append(f"- Key Skills: {', '.join(candidate.skills[:6])}")
        
        if candidate.location:
            context_parts.append(f"- Location: {candidate.location}")
        
        if candidate.education:
            context_parts.append(f"- Education: {candidate.education}")
        
        # Add enrichment insights if available
        if candidate.enrichment_summary:
            context_parts.append(f"\n### Background Insights\n{candidate.enrichment_summary}")
        
        if candidate.skill_validations:
            validated = candidate.skill_validations.get("validated_skills", [])
            if validated:
                context_parts.append(f"- Verified Skills: {', '.join(validated[:5])}")
        
        if candidate.response_likelihood:
            likelihood = candidate.response_likelihood
            if likelihood >= 70:
                context_parts.append("- Note: High engagement likelihood - keep conversation positive")
            elif likelihood <= 30:
                context_parts.append("- Note: May be passive candidate - be extra warm and respectful of time")
        
        return "\n".join(context_parts)
    
    @staticmethod
    def _build_verification_instructions(verification_needed: Dict[str, bool]) -> str:
        """Build instructions for what needs to be verified."""
        if not any(verification_needed.values()):
            return ""
        
        instructions = ["## MUST VERIFY IN THIS CALL"]
        
        if verification_needed.get("notice_period"):
            instructions.append("- Notice period: Ask 'What's your notice period?'")
        
        if verification_needed.get("salary_expectation"):
            instructions.append("- Salary: Ask 'What are your salary expectations for this role?'")
        
        if verification_needed.get("current_ctc"):
            instructions.append("- Current CTC: Ask 'What's your current compensation?'")
        
        if verification_needed.get("availability"):
            instructions.append("- Availability: Ask 'When could you start if selected?'")
        
        if verification_needed.get("relocation"):
            instructions.append("- Relocation: Ask 'Are you open to relocating?'")
        
        instructions.append("\nCapture these using the `capture_verification_data` tool.")
        
        return "\n".join(instructions)

    @staticmethod
    def get_first_message(candidate: InterviewCandidateContext, job: InterviewJobContext) -> str:
        """Generate the opening message with SSML for natural delivery."""
        first_name = candidate.name.split()[0]
        return SSMLBuilder.build_greeting(first_name)

    @staticmethod
    def get_end_call_message(candidate: InterviewCandidateContext) -> str:
        """Generate the closing message with SSML for natural delivery."""
        first_name = candidate.name.split()[0]
        return SSMLBuilder.build_closing(first_name)


# ============================================================================
# VAPI INTERVIEW SERVICE
# ============================================================================

class VapiInterviewService:
    """
    Main service for conducting voice interviews via Vapi.
    
    Features:
    - Natural conversation with SSML support
    - Comprehensive error handling
    - Short, focused interviews (5-10 min)
    - Rich candidate context utilization
    """
    
    def __init__(
        self,
        mongodb=None,
        redis_cache=None,
        model_config_manager=None,
        vapi_api_key: Optional[str] = None,
        vapi_phone_number_id: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
        webhook_base_url: Optional[str] = None
    ):
        """Initialize the Vapi Interview Service."""
        self.db = mongodb
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        # API Keys
        self.vapi_api_key = vapi_api_key or os.getenv("VAPI_API_KEY")
        self.vapi_phone_number_id = vapi_phone_number_id or os.getenv("VAPI_PHONE_NUMBER_ID")
        self.openrouter_api_key = openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
        self.webhook_base_url = webhook_base_url or os.getenv("WEBHOOK_BASE_URL", "https://neuraleap.shop")
        
        # Validate configuration
        if not self.vapi_api_key:
            logger.warning("⚠️ VAPI_API_KEY not set - interviews will fail")
        if not self.vapi_phone_number_id:
            logger.warning("⚠️ VAPI_PHONE_NUMBER_ID not set - outbound calls will fail")
        
        # In-memory session cache (for standalone testing)
        self._sessions: Dict[str, InterviewSession] = {}
        
        # HTTP client
        self._http_client: Optional[httpx.AsyncClient] = None
        
        # Retry tracking
        self._retry_counts: Dict[str, int] = {}
        
        # Verification data cache
        self._verification_data: Dict[str, Dict[str, Any]] = {}
        
        logger.info("✅ VapiInterviewService V4 initialized")
        logger.info(f"   Webhook URL: {self.webhook_base_url}")
        logger.info(f"   Default Voice ID: {DEFAULT_VOICE_ID}")
        logger.info(f"   Planning Model: {MODEL_PLANNING}")
        logger.info(f"   Real-time Model: {MODEL_REALTIME}")
        logger.info(f"   Max Duration: {DEFAULT_CALL_DURATION}s ({DEFAULT_CALL_DURATION//60} min)")
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with appropriate timeouts."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(60.0, connect=10.0)
            )
        return self._http_client
    
    async def close(self):
        """Clean up resources."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
    
    # =========================================================================
    # SESSION MANAGEMENT
    # =========================================================================
    
    async def create_interview(
        self,
        request: CreateInterviewRequest,
        username: str
    ) -> CreateInterviewResponse:
        """
        Create a new interview session.
        
        Steps:
        1. Generate interview plan based on candidate context + job
        2. Create Vapi assistant with natural voice settings
        3. Optionally start the call immediately
        """
        session_id = f"interview-{uuid.uuid4().hex[:12]}"
        
        logger.info(f"Creating interview session: {session_id}")
        logger.info(f"  Candidate: {request.candidate.name}")
        logger.info(f"  Job: {request.job.job_title}")
        logger.info(f"  Experience: {request.candidate.experience_years} years")
        
        # 1. Determine what verification data we need
        verification_needed = self._determine_verification_needs(request.candidate)
        logger.info(f"  Verification needed: {verification_needed}")
        
         # 2. Generate interview plan using analysis model (quality matters here)
        plan = await self._generate_interview_plan(
            request.candidate,
            request.job,
            request.custom_questions,
            verification_needed
        )
        
         # 3. Configure voice (minimal settings for natural sound)
        voice_config = request.voice_config or VapiVoiceConfig(
            provider="cartesia",
            voice_id=DEFAULT_VOICE_ID,
            model="sonic-3",
            speed=DEFAULT_VOICE_SPEED,
            volume=DEFAULT_VOICE_VOLUME
        )
        
        # 4. Build assistant configuration with fast LLM model for real-time (speed)
        assistant_config = VapiAssistantConfig(
            name=f"Neura - Interview {session_id}",
            first_message=InterviewPrompts.get_first_message(request.candidate, request.job),
            voice=voice_config,
            transcriber=VapiTranscriberConfig(
                provider="deepgram",
                model="nova-2",
                language="multi",  # Auto-detect English/Hindi
                endpointing=350,  # Slightly longer to let candidate finish
                smart_format=True
            ),
            model=VapiModelConfig(
                provider="openrouter",
                model=MODEL_REALTIME, 
                temperature=0.6,
                max_tokens=MAX_RESPONSE_TOKENS,  # Keep responses concise
                system_prompt=InterviewPrompts.get_system_prompt(
                    request.candidate, request.job, plan, verification_needed
                ),
                tools=self._get_interview_tools()
            ),
            silence_timeout_seconds=SILENCE_TIMEOUT,
            max_duration_seconds=DEFAULT_CALL_DURATION,
            end_call_message=InterviewPrompts.get_end_call_message(request.candidate),
            server_url=f"{self.webhook_base_url}/voice-interview/webhook",
            recording_enabled=True,
            background_sound="office",
            barge_in_enabled=True  # Allow candidate to interrupt
        )
        
        # 5. Create Vapi assistant
        try:
            vapi_assistant_id = await self._create_vapi_assistant(assistant_config)
        except Exception as e:
            logger.error(f"Failed to create Vapi assistant: {e}")
            raise ValueError(f"Could not create interview assistant: {str(e)}")
        
        # 6. Create session
        session = InterviewSession(
            session_id=session_id,
            candidate=request.candidate,
            job=request.job,
            plan=plan,
            vapi_assistant_id=vapi_assistant_id,
            vapi_assistant_config=assistant_config,
            vapi_phone_number_id=self.vapi_phone_number_id,
            phone_number_called=request.candidate.phone_number,
            status=InterviewStatus.PENDING,
            scheduled_at=request.scheduled_at,
            created_by=username
        )
        
        # 7. Store session
        await self._store_session(session)
        
        # 8. Store verification needs
        self._verification_data[session_id] = {
            "needed": verification_needed,
            "captured": {}
        }
        
        # 9. Map call_id to session for webhook lookups
        if self.redis:
            await self.redis.set(
                f"assistant_to_session:{vapi_assistant_id}",
                session_id,
                ex=86400  # 24 hours
            )
        
        # 10. Optionally start the call
        call_id = None
        if request.auto_call:
            try:
                call_response = await self.start_call(session_id)
                call_id = call_response.call_id
            except Exception as e:
                logger.error(f"Auto-call failed: {e}")
                session.status = InterviewStatus.FAILED
                await self._store_session(session)
                raise
        
        logger.info(f"✅ Created interview: {session_id}")
        logger.info(f"   Assistant ID: {vapi_assistant_id}")
        logger.info(f"   Questions: {len(plan.questions)}")
        logger.info(f"   Model: {MODEL_REALTIME} (for speed)")
        logger.info(f"   Max Duration: {DEFAULT_CALL_DURATION//60} minutes")
        
        return CreateInterviewResponse(
            session_id=session_id,
            status=session.status,
            vapi_assistant_id=vapi_assistant_id,
            plan=plan,
            message="Interview session created successfully",
            call_id=call_id
        )
    
    def _determine_verification_needs(
        self,
        candidate: InterviewCandidateContext
    ) -> Dict[str, bool]:
        """Determine what verification data we need from the call."""
        needs = {
            "notice_period": True,  # Always verify
            "salary_expectation": True,  # Always ask
            "current_ctc": False,
            "availability": True,  # When can they start
            "relocation": False
        }
        
        # Check what we already have from enrichment
        if candidate.salary_estimate:
            # If we have salary data, still verify but it's lower priority
            if candidate.salary_estimate.get("current_ctc"):
                needs["current_ctc"] = False
        
        # Check location requirements
        if candidate.location:
            # If they're not in the target location, ask about relocation
            # This could be enhanced with job location data
            pass
        
        return needs
    
    async def start_call(self, session_id: str) -> StartCallResponse:
        """Start the outbound call for an interview session."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        if session.status not in [InterviewStatus.PENDING, InterviewStatus.SCHEDULED]:
            raise ValueError(f"Cannot start call - session status is {session.status}")
        
        # Validate phone number
        phone = session.phone_number_called
        if not phone or not phone.startswith("+"):
            raise ValueError(f"Invalid phone number format: {phone}")
        
        logger.info(f"📞 Initiating call for {session_id} to {phone}")
        
        try:
            # Place outbound call via Vapi
            call_data = await self._create_vapi_call(
                assistant_id=session.vapi_assistant_id,
                phone_number=phone,
                phone_number_id=session.vapi_phone_number_id
            )
            
            call_id = call_data.get("id")
            
            # Update session
            session.vapi_call_id = call_id
            session.status = InterviewStatus.CALLING
            session.call_start_time = datetime.utcnow().isoformat()
            await self._store_session(session)
            
            # Map call_id to session for webhook lookups
            if self.redis:
                await self.redis.set(
                    f"call_to_session:{call_id}",
                    session_id,
                    ex=86400  # 24 hours
                )
            
            logger.info(f"✅ Call initiated: {call_id}")
            
            return StartCallResponse(
                session_id=session_id,
                call_id=call_id,
                status=InterviewStatus.CALLING,
                message="Call initiated successfully"
            )
            
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            logger.error(f"Vapi call failed: {error_detail}")
            
            # Update session status
            session.status = InterviewStatus.FAILED
            session.call_end_reason = CallEndReason.TECHNICAL_ERROR
            await self._store_session(session)
            raise ValueError(f"Failed to initiate call: {error_detail}")
        
        except Exception as e:
            logger.error(f"Call initiation error: {e}")
            session.status = InterviewStatus.FAILED
            await self._store_session(session)
            raise
    
    async def get_session(self, session_id: str) -> Optional[InterviewSession]:
        """Retrieve interview session."""
        # Try MongoDB first
        if self.db and hasattr(self.db, 'main_db'):
            collection = self.db.main_db["interview_sessions"]
            doc = await collection.find_one({"session_id": session_id})
            if doc:
                doc.pop('_id', None)
                return InterviewSession(**doc)
        
        # Fall back to in-memory
        return self._sessions.get(session_id)
    
    async def _store_session(self, session: InterviewSession):
        """Store session in MongoDB or in-memory."""
        session.updated_at = datetime.utcnow().isoformat()
        
        if self.db and hasattr(self.db, 'main_db'):
            collection = self.db.main_db["interview_sessions"]
            await collection.update_one(
                {"session_id": session.session_id},
                {"$set": session.model_dump()},
                upsert=True
            )
        else:
            self._sessions[session.session_id] = session
        
        # Also cache in Redis for fast access
        if self.redis:
            await self.redis.store_session_data(
                session.session_id,
                "interview_state",
                {
                    "status": session.status.value,
                    "call_id": session.vapi_call_id,
                    "assistant_id": session.vapi_assistant_id,
                    "candidate_name": session.candidate.name,
                    "start_time": session.call_start_time
                },
                expire_seconds=86400  # 24 hours
            )
    
    # =========================================================================
    # VAPI API CALLS
    # =========================================================================
    
    async def _create_vapi_assistant(self, config: VapiAssistantConfig) -> str:
        """Create a Vapi assistant and return its ID."""
        client = await self._get_http_client()
        
        # Build assistant payload with proper voice configuration
        payload = {
            "name": config.name,
            "firstMessage": config.first_message,
            "transcriber": {
                "provider": config.transcriber.provider,
                "model": config.transcriber.model,
                "language": config.transcriber.language,
                "smartFormat": config.transcriber.smart_format,
                "endpointing": config.transcriber.endpointing
            },
            "model": {
                "provider": config.model.provider,
                "model": config.model.model,
                "temperature": config.model.temperature,
                "maxTokens": config.model.max_tokens,
                "messages": [
                    {"role": "system", "content": config.model.system_prompt}
                ]
            },
            "voice": {
                "provider": config.voice.provider,
                "voiceId": config.voice.voice_id,
                "model": config.voice.model
            },
            "silenceTimeoutSeconds": config.silence_timeout_seconds,
            "maxDurationSeconds": config.max_duration_seconds,
            "endCallMessage": config.end_call_message,
            "serverUrl": config.server_url,
            "recordingEnabled": config.recording_enabled,
            "backgroundSound": config.background_sound,
            "backchannelingEnabled": True,  # Natural "uh-huh", "I see" sounds
            "hipaaEnabled": False,
            # Additional settings for better conversation flow
            "serverMessages": [
                "status-update",
                "end-of-call-report",
                "tool-calls",
                "transcript",
                "hang",
                "speech-update"
            ],
            "clientMessages": [
                "transcript",
                "hang",
                "speech-update"
            ]
        }
        
        # Add tools if defined
        if config.model.tools:
            payload["model"]["tools"] = config.model.tools
        
        # Cartesia Sonic 3 voice configuration with volume and speed
        if config.voice.provider == "cartesia":
            payload["voice"]["generationConfig"] = {}
            if config.voice.speed:
                payload["voice"]["generationConfig"]["speed"] = config.voice.speed
            if config.voice.volume:
                payload["voice"]["generationConfig"]["volume"] = config.voice.volume
        
        headers = {
            "Authorization": f"Bearer {self.vapi_api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = await client.post(
                f"{VAPI_API_BASE}/assistant",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            return result["id"]
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Vapi assistant creation failed: {e.response.status_code}")
            logger.error(f"Response: {e.response.text}")
            raise
    
    async def _create_vapi_call(
        self,
        assistant_id: str,
        phone_number: str,
        phone_number_id: str
    ) -> Dict[str, Any]:
        """Create an outbound call via Vapi."""
        client = await self._get_http_client()
        
        payload = {
            "assistantId": assistant_id,
            "phoneNumberId": phone_number_id,
            "customer": {
                "number": phone_number
            }
        }
        
        headers = {
            "Authorization": f"Bearer {self.vapi_api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = await client.post(
                f"{VAPI_API_BASE}/call",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Vapi call creation failed: {e.response.status_code}")
            logger.error(f"Response: {e.response.text}")
            raise
    
    async def _end_vapi_call(self, call_id: str) -> bool:
        """End a Vapi call programmatically."""
        if not call_id:
            return False
        
        client = await self._get_http_client()
        headers = {
            "Authorization": f"Bearer {self.vapi_api_key}",
            "Content-Type": "application/json"
        }
        
        try:
            response = await client.patch(
                f"{VAPI_API_BASE}/call/{call_id}",
                headers=headers,
                json={"status": "ended"}
            )
            response.raise_for_status()
            logger.info(f"Call {call_id} ended programmatically")
            return True
        except Exception as e:
            logger.error(f"Failed to end call {call_id}: {e}")
            return False
    
    def _get_interview_tools(self) -> List[Dict[str, Any]]:
        """Get tool definitions for the interview assistant."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "record_response_quality",
                    "description": "Record the quality of the candidate's response for analysis. Call this after each substantive answer.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question_topic": {
                                "type": "string",
                                "description": "Brief topic of the question (e.g., 'technical skills', 'teamwork')"
                            },
                            "quality": {
                                "type": "string",
                                "enum": ["excellent", "good", "adequate", "weak", "concerning"],
                                "description": "Quality assessment"
                            },
                            "key_points": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Key points from the response"
                            },
                            "follow_up_needed": {
                                "type": "boolean",
                                "description": "Whether a follow-up question is warranted"
                            }
                        },
                        "required": ["question_topic", "quality"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "capture_verification_data",
                    "description": "Capture verification data like notice period, salary, availability.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "data_type": {
                                "type": "string",
                                "enum": ["notice_period", "salary_expectation", "current_ctc", "availability", "relocation"],
                                "description": "Type of data being captured"
                            },
                            "value": {
                                "type": "string",
                                "description": "The value (e.g., '30 days', '25 LPA', 'immediately')"
                            },
                            "notes": {
                                "type": "string",
                                "description": "Any additional context"
                            }
                        },
                        "required": ["data_type", "value"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "end_interview",
                    "description": "Signal that the interview should end. Use when: all questions completed, time is up, or candidate needs to go.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reason": {
                                "type": "string",
                                "enum": ["completed", "time_constraint", "candidate_request", "technical_issue", "poor_connection"],
                                "description": "Why the interview is ending"
                            },
                            "questions_completed": {
                                "type": "integer",
                                "description": "How many questions were covered"
                            },
                            "overall_impression": {
                                "type": "string",
                                "enum": ["positive", "neutral", "negative"],
                                "description": "Quick overall impression"
                            }
                        },
                        "required": ["reason"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "handle_issue",
                    "description": "Report an issue during the call for logging.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "issue_type": {
                                "type": "string",
                                "enum": ["connection_problem", "audio_quality", "candidate_distracted", "language_barrier", "candidate_confused"],
                                "description": "Type of issue encountered"
                            },
                            "resolved": {
                                "type": "boolean",
                                "description": "Whether the issue was resolved"
                            }
                        },
                        "required": ["issue_type"]
                    }
                }
            }
        ]
    
    # =========================================================================
    # INTERVIEW PLAN GENERATION
    # =========================================================================
    
    async def _generate_interview_plan(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        custom_questions: List[str],
        verification_needed: Dict[str, bool]
    ) -> InterviewPlan:
        """Generate interview plan using ANALYSIS MODEL for quality."""
        plan_id = f"plan-{uuid.uuid4().hex[:8]}"
        
        questions = []
        first_name = candidate.name.split()[0]
        
        # 1. Opening question
        questions.append(InterviewPlanQuestion(
            question_id=f"q-{uuid.uuid4().hex[:8]}",
            question_text=self._build_opening_question(candidate, job),
            question_type=QuestionType.INTRODUCTION,
            order=1,
            expected_topics=["current role", "interest"],
            time_limit_seconds=60,
            weight=0.5
        ))
        
        # 2. Add custom question if provided
        if custom_questions:
            questions.append(InterviewPlanQuestion(
                question_id=f"q-custom-{uuid.uuid4().hex[:8]}",
                question_text=custom_questions[0],
                question_type=QuestionType.TECHNICAL,
                order=2,
                weight=1.5,
                time_limit_seconds=90
            ))
        
        # 3. Generate AI questions (uses SONNET)
        remaining = DEFAULT_MAX_QUESTIONS - len(questions) - 2  # Reserve for verification + closing
        if remaining > 0:
            ai_questions = await self._generate_contextual_questions(
                candidate, job, min(remaining, 2)
            )
            for q in ai_questions:
                q.order = len(questions) + 1
                questions.append(q)
        
        # 4. Verification questions
        if any(verification_needed.values()):
            questions.append(InterviewPlanQuestion(
                question_id=f"q-verify-{uuid.uuid4().hex[:8]}",
                question_text="Quick verification questions - what's your notice period and salary expectations?",
                question_type=QuestionType.EXPERIENCE,
                order=len(questions) + 1,
                expected_topics=["notice period", "salary", "availability"],
                time_limit_seconds=60,
                weight=0.8
            ))
        
        # 5. Closing
        questions.append(InterviewPlanQuestion(
            question_id=f"q-close-{uuid.uuid4().hex[:8]}",
            question_text=f"That's all from me, {first_name}. Any quick questions?",
            question_type=QuestionType.CLOSING,
            order=len(questions) + 1,
            expected_topics=["questions", "interest"],
            time_limit_seconds=45,
            weight=0.3
        ))
        
        interview_focus = self._build_interview_focus(candidate, job)
        
        return InterviewPlan(
            plan_id=plan_id,
            candidate_id=candidate.candidate_id,
            job_id=job.job_id if hasattr(job, 'job_id') else None,
            interview_focus=interview_focus,
            questions=questions,
            interviewer_personality="warm_professional",
            opening_context=f"Quick screening call for {first_name}, {candidate.experience_years}y exp",
            closing_notes="Thank warmly, mention next steps, call end_interview tool"
        )

    def _build_opening_question(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext
    ) -> str:
        """Build contextual opening question."""
        first_name = candidate.name.split()[0]
        
        # Use enrichment data to personalize if available
        if candidate.enrichment_summary:
            return (
                f"Great, thank you {first_name}. - "
                f"I've seen you're currently at {candidate.current_company or 'your company'} "
                f"as a {candidate.current_title}. - "
                f"What's got you interested in exploring new opportunities?"
            )
        
        return (
            f"Great, thank you {first_name}. - "
            f"Could you give me a quick overview of what you're currently working on "
            f"and what excites you about the {job.job_title} role?"
        )
    
    def _build_closing_question(self, first_name: str) -> str:
        """Build closing question."""
        return (
            f"Alright {first_name}, - that's all from my side. - "
            f"Do you have any quick questions for me about the role or team?"
        )
    
    def _build_interview_focus(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext
    ) -> str:
        """Build interview focus based on candidate-job fit analysis."""
        focus_areas = []
        
        # Analyze skill gaps and overlaps
        candidate_skills = set(s.lower() for s in candidate.skills)
        required_skills = set(s.lower() for s in job.required_skills)
        
        matched = candidate_skills & required_skills
        missing = required_skills - candidate_skills
        
        if matched:
            focus_areas.append(f"Validate depth in: {', '.join(list(matched)[:3])}")
        
        if missing:
            focus_areas.append(f"Explore experience with: {', '.join(list(missing)[:2])}")
        
        # Use enrichment insights
        if candidate.skill_validations:
            validated = candidate.skill_validations.get("validated_skills", [])
            gaps = candidate.skill_validations.get("skill_gaps", [])
            if gaps:
                focus_areas.append(f"Address gaps: {', '.join(gaps[:2])}")
        
        # Experience level alignment
        years = candidate.experience_years
        if "senior" in job.job_title.lower() and years < 5:
            focus_areas.append("Assess readiness for senior responsibilities")
        elif years > 10:
            focus_areas.append("Explore leadership and mentoring experience")
        
        return " | ".join(focus_areas) if focus_areas else "General technical and cultural fit assessment"
    
    def _build_opening_context(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext
    ) -> str:
        """Build context for the interview opening."""
        first_name = candidate.name.split()[0]
        
        context_parts = [
            f"Interviewing {first_name} for {job.job_title}.",
            f"They have {candidate.experience_years} years experience."
        ]
        
        if candidate.response_likelihood:
            if candidate.response_likelihood >= 70:
                context_parts.append("High engagement likelihood - be enthusiastic.")
            elif candidate.response_likelihood <= 30:
                context_parts.append("Passive candidate - respect their time.")
        
        return " ".join(context_parts)
    
    async def _generate_contextual_questions(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        count: int
    ) -> List[InterviewPlanQuestion]:
        """Generate questions tailored to candidate context."""
        
        # Build rich context for question generation
        candidate_context = self._build_question_generation_context(candidate)
        
        prompt = f"""Generate {count} SHORT interview questions for a 5-10 minute phone interview.

CANDIDATE:
{candidate_context}

JOB:
- Title: {job.job_title}
- Required: {', '.join(job.required_skills[:5])}
- Nice to have: {', '.join(job.nice_to_have_skills[:3])}

RULES:
1. Questions must be CONCISE - under 25 words each
2. Use natural pauses with " - " 
3. Focus on verifiable skills and real experiences
4. Include the candidate's first name occasionally
5. Mix: 1 technical/skill question, 1-2 behavioral/experience questions

Return ONLY JSON array:
[
  {{
    "question_text": "Short question with - for pauses",
    "question_type": "technical|behavioral|experience",
    "focus_area": "What skill/trait this evaluates",
    "expected_duration_seconds": 90
  }}
]"""

        try:
            response = await self._call_llm(prompt, temperature=0.7, max_tokens=800)
            
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                questions_data = json.loads(json_match.group())
            else:
                return self._get_fallback_questions(candidate, job, count)
            
            questions = []
            q_type_map = {
                "technical": QuestionType.TECHNICAL,
                "behavioral": QuestionType.BEHAVIORAL,
                "experience": QuestionType.EXPERIENCE,
                "situational": QuestionType.SITUATIONAL
            }
            
            for q_data in questions_data[:count]:
                questions.append(InterviewPlanQuestion(
                    question_id=f"q-ai-{uuid.uuid4().hex[:8]}",
                    question_text=q_data.get("question_text", ""),
                    question_type=q_type_map.get(
                        q_data.get("question_type", "technical").lower(),
                        QuestionType.TECHNICAL
                    ),
                    order=0,
                    expected_topics=[q_data.get("focus_area", "")],
                    time_limit_seconds=q_data.get("expected_duration_seconds", 90),
                    weight=1.0
                ))
            
            return questions if questions else self._get_fallback_questions(candidate, job, count)
            
        except Exception as e:
            logger.error(f"AI question generation failed: {e}")
            return self._get_fallback_questions(candidate, job, count)
    
    def _build_question_generation_context(self, candidate: InterviewCandidateContext) -> str:
        """Build rich context for question generation."""
        parts = [
            f"- Name: {candidate.name}",
            f"- Current: {candidate.current_title} at {candidate.current_company or 'current company'}",
            f"- Experience: {candidate.experience_years} years",
            f"- Skills: {', '.join(candidate.skills[:8])}"
        ]
        
        if candidate.enrichment_summary:
            parts.append(f"- Background: {candidate.enrichment_summary[:200]}")
        
        if candidate.skill_validations:
            validated = candidate.skill_validations.get("validated_skills", [])
            if validated:
                parts.append(f"- Verified skills: {', '.join(validated[:5])}")
            
            gaps = candidate.skill_validations.get("skill_gaps", [])
            if gaps:
                parts.append(f"- Potential gaps: {', '.join(gaps[:3])}")
        
        return "\n".join(parts)
    
    def _get_fallback_questions(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        count: int
    ) -> List[InterviewPlanQuestion]:
        """Fallback questions if LLM fails."""
        first_name = candidate.name.split()[0]
        skill = candidate.skills[0] if candidate.skills else "your work"
        
        fallback = [
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    f"Tell me about a challenging project you've worked on - "
                    f"ideally something involving {skill}."
                ),
                question_type=QuestionType.TECHNICAL,
                order=1,
                expected_topics=["problem", "approach", "outcome"],
                time_limit_seconds=120,
                weight=1.5
            ),
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    f"What's motivated you to explore new opportunities, {first_name}?"
                ),
                question_type=QuestionType.BEHAVIORAL,
                order=1,
                expected_topics=["motivation", "goals"],
                time_limit_seconds=90,
                weight=1.0
            ),
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    "How do you typically approach learning new technologies?"
                ),
                question_type=QuestionType.CULTURE_FIT,
                order=1,
                expected_topics=["learning", "growth"],
                time_limit_seconds=90,
                weight=0.8
            )
        ]
        return fallback[:count]
    
    # =========================================================================
    # WEBHOOK HANDLING - COMPREHENSIVE
    # =========================================================================
    
    async def handle_webhook(
        self,
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle incoming Vapi webhook events.
        
        Handles all event types:
        - function-call / tool-calls: Tool invocations
        - status-update: Call status changes
        - end-of-call-report: Final report
        - transcript: Real-time transcripts
        - hang: Connection issues
        - speech-update: Speaking turns
        """
        event_type = event.type
        call_data = event.call or {}
        call_id = call_data.get("id")
        
        logger.info(f"Webhook: {event_type} for call {call_id}")
        
        # Find session by call_id
        session = await self._get_session_by_call_id(call_id)
        
        # Handle different event types
        handlers = {
            "tool-calls": self._handle_tool_calls,
            "function-call": self._handle_tool_calls,  # Legacy name
            "status-update": self._handle_status_update,
            "end-of-call-report": self._handle_end_of_call,
            "transcript": self._handle_transcript_update,
            "hang": self._handle_hang_notification,
            "speech-update": self._handle_speech_update,
            "conversation-update": self._handle_conversation_update,
        }
        
        handler = handlers.get(event_type)
        if handler:
            return await handler(session, event, raw_body)
        
        logger.debug(f"Unhandled event type: {event_type}")
        return {"status": "ignored"}
    
    async def _handle_tool_calls(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle tool/function calls from the LLM."""
        
        message = raw_body.get("message", {})
        tool_calls = message.get("toolCalls", []) or message.get("toolCallList", [])
        
        results = []
        
        for tool_call in tool_calls:
            # Handle both formats
            if "function" in tool_call:
                func_name = tool_call["function"].get("name")
                func_args = tool_call["function"].get("arguments", {})
            else:
                func_name = tool_call.get("name")
                func_args = tool_call.get("parameters", {})
            
            tool_call_id = tool_call.get("id") or tool_call.get("toolCallId")
            
            logger.info(f"Tool call: {func_name}")
            
            # Route to appropriate handler
            if func_name == "record_response_quality":
                result = await self._tool_record_quality(session, func_args)
            elif func_name == "capture_verification_data":
                result = await self._tool_capture_verification(session, func_args)
            elif func_name == "end_interview":
                result = await self._tool_end_interview(session, func_args)
            elif func_name == "handle_issue":
                result = await self._tool_handle_issue(session, func_args)
            else:
                result = {"status": "unknown_function", "function": func_name}
            
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps(result) if isinstance(result, dict) else str(result)
            })
        
        return {"results": results}
    
    async def _tool_record_quality(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Record response quality for later analysis."""
        quality_data = {
            "question_topic": args.get("question_topic", "unknown"),
            "quality": args.get("quality", "adequate"),
            "key_points": args.get("key_points", []),
            "follow_up_needed": args.get("follow_up_needed", False),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if session and self.redis:
            # Store in Redis list for this session
            await self.redis.redis.rpush(
                f"interview:{session.session_id}:quality_log",
                json.dumps(quality_data)
            )
        
        logger.info(f"Recorded: {quality_data['question_topic']} = {quality_data['quality']}")
        return {"status": "recorded", "acknowledged": True}
    
    async def _tool_capture_verification(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Capture verification data."""
        data_type = args.get("data_type", "unknown")
        value = args.get("value", "")
        notes = args.get("notes", "")
        
        verification_entry = {
            "type": data_type,
            "value": value,
            "notes": notes,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if session:
            session_id = session.session_id
            if session_id in self._verification_data:
                self._verification_data[session_id]["captured"][data_type] = verification_entry
            
            if self.redis:
                await self.redis.redis.hset(
                    f"interview:{session_id}:verification",
                    data_type,
                    json.dumps(verification_entry)
                )
        
        logger.info(f"✅ Captured {data_type}: {value}")
        return {"status": "captured", "data_type": data_type}
    
    async def _tool_end_interview(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Signal interview completion."""
        reason = args.get("reason", "completed")
        
        logger.info(f"Interview ending: {reason}")
        
        if session:
            # Store end metadata
            end_data = {
                "reason": reason,
                "questions_completed": args.get("questions_completed", 0),
                "overall_impression": args.get("overall_impression", "neutral"),
                "ended_at": datetime.utcnow().isoformat()
            }
            
            if self.redis:
                await self.redis.store_session_data(
                    session.session_id,
                    "interview_end_data",
                    end_data,
                    expire_seconds=86400
                )
                
            # ACTUALLY END THE CALL via Vapi API
            if session.vapi_call_id:
                logger.info(f"Terminating call {session.vapi_call_id}")
                # Schedule call termination after a brief delay (let closing message play)
                asyncio.create_task(self._delayed_call_end(session.vapi_call_id, delay=3.0))
        
        
        return {
            "status": "ending",
            "action": "deliver_closing_message",
            "message": "Thank the candidate and end the call."
        }
        
    async def _delayed_call_end(self, call_id: str, delay: float = 3.0):
        """End call after a delay to let closing message play."""
        await asyncio.sleep(delay)
        await self._end_vapi_call(call_id)
    
    async def _tool_handle_issue(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle reported issues during the call."""
        issue_type = args.get("issue_type", "unknown")
        resolved = args.get("resolved", False)
        
        logger.warning(f"⚠️ Issue reported: {issue_type}, resolved: {resolved}")
        
        if session and self.redis:
            issue_data = {
                "issue_type": issue_type,
                "resolved": resolved,
                "timestamp": datetime.utcnow().isoformat()
            }
            await self.redis.redis.rpush(
                f"interview:{session.session_id}:issues",
                json.dumps(issue_data)
            )
        
        # Provide guidance based on issue type
        guidance = {
            "connection_problem": "If persistent, apologize and offer to reschedule.",
            "audio_quality": "Ask candidate to move to a quieter location if possible.",
            "candidate_distracted": "Offer to continue at a better time.",
            "language_barrier": "Slow down and use simpler language.",
            "candidate_confused": "Rephrase the question more simply."
        }
        
        return {
            "status": "logged",
            "guidance": guidance.get(issue_type, "Continue as best as possible.")
        }
    
    async def _handle_status_update(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle call status changes."""
        status = event.status
        call_data = event.call or {}
        
        logger.info(f"Status update: {status}")
        
        if not session:
            logger.warning("No session found for status update")
            return {"status": "acknowledged"}
        
        # Map Vapi statuses to our statuses
        status_map = {
            "ringing": InterviewStatus.RINGING,
            "in-progress": InterviewStatus.IN_PROGRESS,
            "forwarding": InterviewStatus.IN_PROGRESS,
            "ended": InterviewStatus.COMPLETED,
            "queued": InterviewStatus.CALLING,
        }
        
        if status in status_map:
            old_status = session.status
            session.status = status_map[status]
            
            # Record call start time
            if status == "in-progress" and not session.call_start_time:
                session.call_start_time = datetime.utcnow().isoformat()
                logger.info(f"📞 Call started for {session.session_id}")
            
            await self._store_session(session)
            logger.info(f"   {old_status.value} → {session.status.value}")
        
        return {"status": "acknowledged"}
    
    async def _handle_end_of_call(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle end-of-call report with recordings and transcript."""
        logger.info("📞 Call ended - processing report")
        
        if not session:
            logger.warning("No session found for end-of-call report")
            return {"status": "acknowledged"}
        
        message = raw_body.get("message", {})
        
        # Extract recording URLs (Vapi handles storage)
        session.recording_url = message.get("recordingUrl")
        session.stereo_recording_url = message.get("stereoRecordingUrl")
        session.call_end_time = datetime.utcnow().isoformat()
        
        # Calculate duration
        if session.call_start_time:
            try:
                start = datetime.fromisoformat(session.call_start_time.replace('Z', '+00:00'))
                end = datetime.fromisoformat(session.call_end_time)
                session.call_duration_seconds = (end - start).total_seconds()
            except Exception as e:
                logger.warning(f"Could not calculate duration: {e}")
        
        # Extract transcript
        transcript_text = message.get("transcript", "")
        session.full_transcript = self._parse_transcript(transcript_text)
        
        # Determine end reason
        ended_reason = message.get("endedReason", "unknown")
        session.call_end_reason = self._map_end_reason(ended_reason)
        
        # Set final status based on end reason
        session.status = self._determine_final_status(session.call_end_reason, session.call_duration_seconds)
        
        await self._store_session(session)
        
        logger.info(f"   Duration: {session.call_duration_seconds:.1f}s")
        logger.info(f"   End reason: {session.call_end_reason.value}")
        logger.info(f"   Status: {session.status.value}")
        logger.info(f"   Recording: {'Yes' if session.recording_url else 'No'}")
        
        # Trigger async analysis if call was meaningful
        if session.call_duration_seconds and session.call_duration_seconds > 60:
            asyncio.create_task(self._run_post_interview_analysis(session.session_id))
        else:
            logger.info("Call too short for analysis")
        
        return {"status": "acknowledged"}
    
    async def _handle_hang_notification(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle hang/delay notifications."""
        logger.warning("Hang notification received - potential delay or issue")
        
        if session:
            # Log the hang event
            if self.redis:
                await self.redis.redis.rpush(
                    f"interview:{session.session_id}:events",
                    json.dumps({
                        "event": "hang",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                )
        
        return {"status": "acknowledged"}
    
    async def _handle_speech_update(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle speech turn updates."""
        message = raw_body.get("message", {})
        speech_status = message.get("status")  # "started" or "stopped"
        role = message.get("role")  # "assistant" or "user"
        
        # This can be used for real-time UI updates
        if session and self.redis:
            await self.redis.store_session_data(
                session.session_id,
                "speech_status",
                {"status": speech_status, "role": role},
                expire_seconds=60
            )
        
        return {"status": "acknowledged"}
    
    async def _handle_conversation_update(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle conversation history updates."""
        message = raw_body.get("message", {})
        messages = message.get("messages", [])
        
        if session:
            # Update transcript in real-time
            session.full_transcript = [
                {"role": m.get("role"), "content": m.get("message", m.get("content", ""))}
                for m in messages
            ]
            # Don't save to DB on every update - too frequent
            # Just update Redis for real-time access
            if self.redis:
                await self.redis.store_session_data(
                    session.session_id,
                    "live_transcript",
                    session.full_transcript,
                    expire_seconds=3600
                )
        
        return {"status": "acknowledged"}
    
    async def _handle_transcript_update(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle real-time transcript updates."""
        message = raw_body.get("message", {})
        
        if session and self.redis:
            transcript_entry = {
                "role": message.get("role", "unknown"),
                "transcript": message.get("transcript", ""),
                "type": message.get("transcriptType", "partial"),  # partial or final
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Only store final transcripts
            if transcript_entry["type"] == "final":
                await self.redis.redis.rpush(
                    f"interview:{session.session_id}:transcript_stream",
                    json.dumps(transcript_entry)
                )
        
        return {"status": "acknowledged"}
    
    def _map_end_reason(self, vapi_reason: str) -> CallEndReason:
        """Map Vapi end reason to our CallEndReason enum."""
        reason_map = {
            "customer-ended-call": CallEndReason.HANGUP_CANDIDATE,
            "assistant-ended-call": CallEndReason.COMPLETED,
            "silence-timed-out": CallEndReason.SILENCE_TIMEOUT,
            "max-duration-reached": CallEndReason.MAX_DURATION,
            "voicemail": CallEndReason.VOICEMAIL,
            "no-answer": CallEndReason.NO_ANSWER,
            "busy": CallEndReason.BUSY,
            "failed": CallEndReason.TECHNICAL_ERROR,
            "error": CallEndReason.TECHNICAL_ERROR,
            "machine-detected": CallEndReason.VOICEMAIL,
            "customer-busy": CallEndReason.BUSY,
            "customer-did-not-answer": CallEndReason.NO_ANSWER,
        }
        return reason_map.get(vapi_reason, CallEndReason.COMPLETED)
    
    def _determine_final_status(
        self,
        end_reason: CallEndReason,
        duration: Optional[float]
    ) -> InterviewStatus:
        """Determine final interview status based on end reason and duration."""
        
        # Successful completions
        if end_reason == CallEndReason.COMPLETED:
            return InterviewStatus.COMPLETED
        
        if end_reason == CallEndReason.HANGUP_CANDIDATE:
            # If they talked for a while, consider it completed
            if duration and duration > 90:  # More than 1:30 minutes
                return InterviewStatus.COMPLETED
            return InterviewStatus.CANCELLED
        
        # Unsuccessful attempts
        if end_reason == CallEndReason.NO_ANSWER:
            return InterviewStatus.NO_ANSWER
        
        if end_reason == CallEndReason.VOICEMAIL:
            return InterviewStatus.VOICEMAIL
        
        if end_reason == CallEndReason.BUSY:
            return InterviewStatus.FAILED
        
        if end_reason in [CallEndReason.TECHNICAL_ERROR, CallEndReason.NETWORK_ERROR]:
            return InterviewStatus.FAILED
        
        if end_reason == CallEndReason.MAX_DURATION:
            return InterviewStatus.COMPLETED  # They talked the whole time
        
        if end_reason == CallEndReason.SILENCE_TIMEOUT:
            if duration and duration > 60:
                return InterviewStatus.COMPLETED
            return InterviewStatus.FAILED
        
        return InterviewStatus.COMPLETED
    
    def _parse_transcript(self, transcript: str) -> List[Dict[str, Any]]:
        """Parse transcript string into structured format."""
        entries = []
        if not transcript:
            return entries
        
        lines = transcript.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith("AI:") or line.startswith("Assistant:"):
                content = line.split(":", 1)[1].strip() if ":" in line else line
                entries.append({
                    "role": "assistant",
                    "content": content,
                    "timestamp": None
                })
            elif line.startswith("User:") or line.startswith("Human:"):
                content = line.split(":", 1)[1].strip() if ":" in line else line
                entries.append({
                    "role": "user",
                    "content": content,
                    "timestamp": None
                })
        
        return entries
    
    async def _get_session_by_call_id(self, call_id: str) -> Optional[InterviewSession]:
        """Find session by Vapi call ID."""
        if not call_id:
            return None
        
        # Try Redis first for speed
        if self.redis:
            session_id = await self.redis.get(f"call_to_session:{call_id}")
            if session_id:
                return await self.get_session(session_id)
        
        # Fall back to DB search
        if self.db and hasattr(self.db, 'main_db'):
            collection = self.db.main_db["interview_sessions"]
            doc = await collection.find_one({"vapi_call_id": call_id})
            if doc:
                doc.pop('_id', None)
                return InterviewSession(**doc)
        
        # Check in-memory
        for session in self._sessions.values():
            if session.vapi_call_id == call_id:
                return session
        
        return None
    
    # =========================================================================
    # POST-INTERVIEW ANALYSIS
    # =========================================================================
    
    async def _run_post_interview_analysis(self, session_id: str):
        """Run comprehensive analysis after interview completes."""
        logger.info(f"Starting post-interview analysis for {session_id}")
        
        try:
            session = await self.get_session(session_id)
            if not session:
                logger.error(f"Session not found for analysis: {session_id}")
                return
            
            # 1. Gather quality logs from Redis
            quality_logs = await self._get_quality_logs(session_id)
            verification_data = self._verification_data.get(session_id, {}).get("captured", {})
            
            # 2. Generate clips from transcript
            clips = await self._generate_clips(session, quality_logs)
            session.clips = clips
            
            # 3. Generate final assessment
            assessment = await self._generate_final_assessment(session, quality_logs, verification_data)
            session.final_assessment = assessment
            
            # 4. Save everything
            await self._store_session(session)
            
            logger.info(f"✅ Analysis complete for {session_id}")
            logger.info(f"   Score: {assessment.overall_score}")
            logger.info(f"   Recommendation: {assessment.recommendation}")
            
        except Exception as e:
            logger.error(f"Post-interview analysis failed: {e}", exc_info=True)
    
    async def _get_quality_logs(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve quality logs from Redis."""
        if not self.redis:
            return []
        
        try:
            logs = []
            raw_logs = self.redis.redis.lrange(f"interview:{session_id}:quality_log", 0, -1)
            for log in raw_logs:
                if isinstance(log, str):
                    logs.append(json.loads(log))
                elif isinstance(log, bytes):
                    logs.append(json.loads(log.decode()))
            return logs
        except Exception as e:
            logger.error(f"Failed to get quality logs: {e}")
            return []
    
    async def _generate_clips(
        self,
        session: InterviewSession,
        quality_logs: List[Dict[str, Any]]
    ) -> List[InterviewClip]:
        """Generate clips from transcript with quality annotations."""
        clips = []
        
        if not session.full_transcript:
            return clips
        
        # Group transcript by Q&A exchanges
        current_question = None
        current_response_parts = []
        clip_index = 0
        
        for entry in session.full_transcript:
            role = entry.get("role", "")
            content = entry.get("content", "")
            
            if role == "assistant" and "?" in content:
                # Save previous Q&A
                if current_question and current_response_parts:
                    clip = self._create_clip(
                        session,
                        current_question,
                        current_response_parts,
                        clip_index,
                        quality_logs
                    )
                    if clip:
                        clips.append(clip)
                    clip_index += 1
                
                current_question = content
                current_response_parts = []
            
            elif role == "user" and content:
                current_response_parts.append(content)
        
        # Don't forget last Q&A
        if current_question and current_response_parts:
            clip = self._create_clip(
                session,
                current_question,
                current_response_parts,
                clip_index,
                quality_logs
            )
            if clip:
                clips.append(clip)
        
        return clips
    
    def _create_clip(
        self,
        session: InterviewSession,
        question: str,
        response_parts: List[str],
        index: int,
        quality_logs: List[Dict[str, Any]]
    ) -> Optional[InterviewClip]:
        """Create a clip from a Q&A pair."""
        response_text = " ".join(response_parts)
        if len(response_text) < 10:
            return None
        
        # Find matching quality log
        quality_data = {}
        if index < len(quality_logs):
            quality_data = quality_logs[index]
        
        # Determine question type
        q_type = QuestionType.TECHNICAL
        if session.plan and index < len(session.plan.questions):
            q_type = session.plan.questions[index].question_type
        
        return InterviewClip(
            clip_id=f"clip-{uuid.uuid4().hex[:12]}",
            session_id=session.session_id,
            start_time_seconds=0,
            end_time_seconds=0,
            duration_seconds=0,
            question_asked=question,
            question_type=q_type,
            candidate_response=response_text,
            is_highlight=quality_data.get("quality") == "excellent",
            analysis=ResponseAnalysis(
                key_points_covered=quality_data.get("key_points", []),
                topics_mentioned=[quality_data.get("question_topic", "")],
                skills_demonstrated=[],
                relevance_score=self._quality_to_score(quality_data.get("quality", "adequate")),
                depth_score=self._quality_to_score(quality_data.get("quality", "adequate")),
                clarity_score=self._quality_to_score(quality_data.get("quality", "adequate")),
                overall_score=self._quality_to_score(quality_data.get("quality", "adequate")),
                confidence_assessment=ConfidenceLevel.MEDIUM,
                strengths=[],
                areas_for_improvement=[],
                red_flags=[],
                brief_summary=f"Response quality: {quality_data.get('quality', 'not recorded')}"
            ) if quality_data else None
        )
    
    def _quality_to_score(self, quality: str) -> float:
        """Convert quality label to numeric score."""
        scores = {
            "excellent": 90,
            "good": 75,
            "adequate": 60,
            "weak": 40,
            "concerning": 25
        }
        return scores.get(quality, 50)
    
    async def _generate_final_assessment(
        self,
        session: InterviewSession,
        quality_logs: List[Dict[str, Any]],
          verification_data: Dict[str, Any]
    ) -> InterviewAssessment:
        """Generate comprehensive final assessment."""
        
        # Calculate scores from quality logs
        scores = [self._quality_to_score(q.get("quality", "adequate")) for q in quality_logs]
        avg_score = sum(scores) / max(len(scores), 1) if scores else 50
        verification_summary = {k: v.get("value") for k, v in verification_data.items()}
        # Build context for assessment
        quality_summary = []
        for log in quality_logs:
            quality_summary.append({
                "topic": log.get("question_topic", "unknown"),
                "quality": log.get("quality", "adequate"),
                "key_points": log.get("key_points", [])
            })
        
        prompt = f"""Generate a brief interview assessment.

CANDIDATE: {session.candidate.name}
ROLE: {session.candidate.current_title}
EXPERIENCE: {session.candidate.experience_years} years

TARGET ROLE: {session.job.job_title}
REQUIRED SKILLS: {', '.join(session.job.required_skills[:5])}
VERIFICATION: {json.dumps(verification_summary)}
CALL DURATION: {session.call_duration_seconds:.0f} seconds
QUALITY SUMMARY: {json.dumps(quality_summary)}
AVERAGE SCORE: {avg_score:.0f}/100

Generate JSON:
{{
    "overall_score": 0-100,
    "technical_score": 0-100,
    "communication_score": 0-100,
    "culture_fit_score": 0-100,
    "recommendation": "strong_hire|hire|maybe|no_hire",
    "recommendation_confidence": "high|medium|low",
    "top_strengths": ["strength1", "strength2"],
    "concerns": ["concern1"] or [],
    "executive_summary": "One sentence summary"
}}

SCORING: 80-100=Excellent, 60-79=Good, 40-59=Adequate, <40=Weak"""

        try:
            response = await self._call_llm(prompt, temperature=0.3, max_tokens=500)
            
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                data = json.loads(json_match.group())
                
                highlight_clips = [c.clip_id for c in session.clips if c.is_highlight]
                
                return InterviewAssessment(
                    overall_score=float(data.get("overall_score", avg_score)),
                    technical_score=float(data.get("technical_score", avg_score)),
                    communication_score=float(data.get("communication_score", avg_score)),
                    culture_fit_score=float(data.get("culture_fit_score", avg_score)),
                    recommendation=data.get("recommendation", "maybe"),
                    recommendation_confidence=ConfidenceLevel(
                        data.get("recommendation_confidence", "medium")
                    ),
                    skill_scores={},
                    question_scores={
                        c.clip_id: c.analysis.overall_score
                        for c in session.clips if c.analysis
                    },
                    top_strengths=data.get("top_strengths", []),
                    concerns=data.get("concerns", []),
                    notable_moments=[],
                    highlight_clips=highlight_clips,
                    red_flag_clips=[],
                    executive_summary=data.get("executive_summary", "Interview completed."),
                    detailed_report="",
                    language_proficiency={"english": "good"}
                )
                
        except Exception as e:
            logger.error(f"Assessment generation failed: {e}")
        
        # Fallback assessment
        return InterviewAssessment(
            overall_score=avg_score,
            technical_score=avg_score,
            communication_score=avg_score,
            culture_fit_score=avg_score,
            recommendation="maybe",
            recommendation_confidence=ConfidenceLevel.LOW,
            skill_scores={},
            question_scores={},
            top_strengths=["Completed interview"],
            concerns=["Manual review recommended"],
            notable_moments=[],
            highlight_clips=[],
            red_flag_clips=[],
            executive_summary="Interview completed. Manual review recommended.",
            detailed_report="",
            language_proficiency={"english": "unknown"}
        )
    
    # =========================================================================
    # LLM HELPER
    # =========================================================================
    
    async def _call_llm(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        model: str = MODEL_PLANNING
    ) -> str:
        """Call LLM via OpenRouter."""
        if not self.openrouter_api_key:
            raise ValueError("OpenRouter API key not configured")
        
        client = await self._get_http_client()
        
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://neuraleap.shop",
            "X-Title": "NeuraLeap Voice Interview"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Always respond with valid JSON when asked."
                },
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload
            )
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"OpenRouter error {response.status_code}: {error_text}")
                raise httpx.HTTPStatusError(
                    f"OpenRouter API error: {error_text}",
                    request=response.request,
                    response=response
                )
            result = response.json()
            return result["choices"][0]["message"]["content"]
            
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise
    
    # =========================================================================
    # PUBLIC API METHODS
    # =========================================================================
    
  # =========================================================================
    # PUBLIC API
    # =========================================================================
    
    async def get_interview_results(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get interview results."""
        session = await self.get_session(session_id)
        if not session:
            return None
        
        verification = self._verification_data.get(session_id, {}).get("captured", {})
        
        return {
            "session_id": session.session_id,
            "status": session.status.value,
            "candidate": {
                "name": session.candidate.name,
                "title": session.candidate.current_title,
                "company": session.candidate.current_company,
                "experience_years": session.candidate.experience_years
            },
            "job": {
                "title": session.job.job_title,
                "company": session.job.company_name
            },
            "call_info": {
                "duration_seconds": session.call_duration_seconds,
                "duration_minutes": session.call_duration_seconds / 60 if session.call_duration_seconds else None,
                "end_reason": session.call_end_reason.value if session.call_end_reason else None
            },
            "verification_data": {k: v.get("value") for k, v in verification.items()},
            "recording_url": session.recording_url,
            "assessment": session.final_assessment.model_dump() if session.final_assessment else None,
            "clips": [
                {
                    "clip_id": c.clip_id,
                    "question": c.question_asked,
                    "response": c.candidate_response,
                    "score": c.analysis.overall_score if c.analysis else None,
                    "is_highlight": c.is_highlight
                }
                for c in session.clips
            ],
            "transcript": session.full_transcript
        }
    
    async def list_interviews(
        self,
        username: str,
        status: Optional[InterviewStatus] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List interviews."""
        if self.db and hasattr(self.db, 'main_db'):
            collection = self.db.main_db["interview_sessions"]
            
            query = {"created_by": username}
            if status:
                query["status"] = status.value
            
            total = await collection.count_documents(query)
            cursor = collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
            
            interviews = []
            async for doc in cursor:
                doc.pop('_id', None)
                interviews.append({
                    "session_id": doc.get("session_id"),
                    "candidate_name": doc.get("candidate", {}).get("name"),
                    "job_title": doc.get("job", {}).get("job_title"),
                    "status": doc.get("status"),
                    "duration_seconds": doc.get("call_duration_seconds"),
                    "created_at": doc.get("created_at"),
                    "score": doc.get("final_assessment", {}).get("overall_score") if doc.get("final_assessment") else None
                })
            
            return interviews, total
        
        all_sessions = list(self._sessions.values())
        filtered = [s for s in all_sessions if s.created_by == username]
        if status:
            filtered = [s for s in filtered if s.status == status]
        
        return [
            {
                "session_id": s.session_id,
                "candidate_name": s.candidate.name,
                "job_title": s.job.job_title,
                "status": s.status.value,
                "score": s.final_assessment.overall_score if s.final_assessment else None
            }
            for s in filtered[offset:offset+limit]
        ], len(filtered)
    
    async def retry_failed_call(self, session_id: str) -> StartCallResponse:
        """Retry failed call."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        retry_count = self._retry_counts.get(session_id, 0)
        if retry_count >= MAX_RETRY_ATTEMPTS:
            raise ValueError(f"Max retries exceeded")
        
        if session.status not in [InterviewStatus.FAILED, InterviewStatus.NO_ANSWER]:
            raise ValueError(f"Cannot retry - status is {session.status.value}")
        
        session.status = InterviewStatus.PENDING
        session.vapi_call_id = None
        session.call_start_time = None
        await self._store_session(session)
        
        self._retry_counts[session_id] = retry_count + 1
        
        return await self.start_call(session_id)