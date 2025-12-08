"""
Vapi Voice Interview Service V3
===============================
Main service for conducting AI-powered voice interviews using Vapi.

Architecture:
- Vapi handles STT → LLM → TTS orchestration
- Cartesia Sonic 3 for natural TTS
- Deepgram for multi-language STT (English + Hindi)
- OpenRouter for flexible LLM selection
- Twilio for telephony (via Vapi integration)

Features:
- Dynamic interview plan generation
- Real-time webhook processing
- Recording management & clip extraction
- Post-interview analysis
- Multi-language support (English, Hindi, Hinglish)

Author: NeuraLeap Engineering
Version: 3.0
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
from pydub import AudioSegment

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

# Voice presets for Indian demographic
VOICE_PRESETS = {
    "neura_professional": {
        "id": "f786b574-daa5-4673-aa0c-cbe3e8534c02",  # Katie - stable, warm
        "name": "Neura",
        "description": "Professional female voice, clear English, warm tone"
    },
    "neura_expressive": {
        "id": "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",  # Tessa - emotive
        "name": "Neura (Expressive)",
        "description": "Expressive female voice for warmth"
    },
    "arjun_professional": {
        "id": "228fca29-3a0a-435c-8728-5cb483251068",  # Kiefer - professional male
        "name": "Arjun",
        "description": "Professional male voice, engaging"
    }
}

# Interview defaults
DEFAULT_MAX_QUESTIONS = 8
DEFAULT_CALL_DURATION = 1800  # 30 minutes
SILENCE_TIMEOUT = 30  # seconds


# ============================================================================
# INTERVIEW PROMPTS
# ============================================================================

class InterviewPrompts:
    """
    Prompt templates for the AI interviewer.
    """
    
    @staticmethod
    def get_system_prompt(
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        plan: InterviewPlan
    ) -> str:
        """Generate the main system prompt for the interviewer."""
        
        first_name = candidate.name.split()[0]
        
        return f"""You are Neura, an AI interviewer from NeuraLeap conducting a professional voice interview.

## YOUR IDENTITY
- Name: Neura
- Role: Senior Technical Recruiter at NeuraLeap
- Personality: Warm, professional, genuinely curious about candidates
- Communication: Clear, concise (under 50 words per response), natural pauses with " - "

## CANDIDATE CONTEXT
- Name: {candidate.name} (call them {first_name})
- Current Role: {candidate.current_title} at {candidate.current_company or 'their current company'}
- Experience: {candidate.experience_years} years
- Key Skills: {', '.join(candidate.skills[:8])}
- Location: {candidate.location or 'India'}

## JOB REQUIREMENTS
- Position: {job.job_title}
- Company: {job.company_name or 'our client'}
- Required Skills: {', '.join(job.required_skills[:6])}
- Experience Needed: {job.experience_required}
- Key Responsibilities: {', '.join(job.key_responsibilities[:4])}

## INTERVIEW FOCUS
{plan.interview_focus}

## INTERVIEW GUIDELINES

### Opening
{plan.opening_context}

### Question Flow
1. Start with the introduction question
2. Use the provided questions but adapt based on responses
3. Ask follow-ups when candidate gives vague answers
4. Skip redundant questions if already answered
5. Watch time - keep moving if running long

### Communication Style
- Acknowledge responses warmly: "That's great" - "I see" - "Thank you for sharing that"
- Use natural transitions: "Now - let me ask you about..." - "Moving on..."
- Add pauses with " - " for natural speech rhythm
- Keep responses under 50 words
- Don't repeat what candidate said back to them

### Handling Different Responses
- If candidate is nervous: "Take your time - no rush"
- If answer is vague: Ask a specific follow-up
- If answer is excellent: Acknowledge and move on
- If candidate asks a question: Answer briefly, then continue

### Language Handling
- Conduct interview in English
- If candidate responds in Hindi/Hinglish, acknowledge naturally
- Example: "Bahut accha - thank you. Please feel free to continue in whichever language you're comfortable with."

### Closing
{plan.closing_notes}

## TOOLS AVAILABLE
- `get_next_question`: Get the next planned question
- `record_response_quality`: Mark response as strong/weak/concerning
- `add_follow_up`: Note that you asked a follow-up
- `end_interview`: Signal interview completion

## IMPORTANT RULES
1. NEVER reveal you're reading from a script
2. NEVER mention "question 1", "question 2", etc.
3. NEVER ask more than one question at a time
4. ALWAYS acknowledge before asking the next question
5. BE NATURAL - like a friendly senior colleague, not a robot

Begin the interview when the candidate answers the call."""

    @staticmethod
    def get_first_message(candidate: InterviewCandidateContext, job: InterviewJobContext) -> str:
        """Generate the opening message."""
        first_name = candidate.name.split()[0]
        return (
            f"Hello! - Is this {first_name}? - "
            f"Hi {first_name}, this is Neura calling from NeuraLeap. - "
            f"Thank you so much for taking the time to speak with me today. - "
            f"I'm really looking forward to learning more about you and your experience. - "
            f"Before we begin, - can you hear me clearly?"
        )

    @staticmethod
    def get_end_call_message(candidate: InterviewCandidateContext) -> str:
        """Generate the closing message."""
        first_name = candidate.name.split()[0]
        return (
            f"Thank you so much for your time today, {first_name}. - "
            f"It was a pleasure speaking with you. - "
            f"Our team will be in touch soon with next steps. - "
            f"Take care, and have a wonderful day!"
        )


# ============================================================================
# VAPI INTERVIEW SERVICE
# ============================================================================

class VapiInterviewService:
    """
    Main service for conducting voice interviews via Vapi.
    """
    
    def __init__(
        self,
        mongodb=None,
        redis_cache=None,
        model_config_manager=None,
        vapi_api_key: Optional[str] = None,
        vapi_phone_number_id: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
        webhook_base_url: Optional[str] = None,
        storage_path: str = "./interview_recordings"
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
        
        # Validate
        if not self.vapi_api_key:
            logger.warning("⚠️ VAPI_API_KEY not set - interviews will fail")
        if not self.vapi_phone_number_id:
            logger.warning("⚠️ VAPI_PHONE_NUMBER_ID not set - outbound calls will fail")
        
        # Storage
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # In-memory session cache (for standalone testing)
        self._sessions: Dict[str, InterviewSession] = {}
        
        # HTTP client
        self._http_client: Optional[httpx.AsyncClient] = None
        
        logger.info("✅ VapiInterviewService initialized")
        logger.info(f"   Webhook URL: {self.webhook_base_url}")
        logger.info(f"   Storage: {self.storage_path}")
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=60.0)
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
        
        1. Generate interview plan based on candidate + job
        2. Create Vapi assistant with custom prompts
        3. Optionally start the call
        """
        session_id = f"interview-{uuid.uuid4().hex[:12]}"
        
        logger.info(f"Creating interview session: {session_id}")
        logger.info(f"  Candidate: {request.candidate.name}")
        logger.info(f"  Job: {request.job.job_title}")
        
        # 1. Generate interview plan
        plan = await self._generate_interview_plan(
            request.candidate,
            request.job,
            request.custom_questions
        )
        
        # 2. Create Vapi assistant config
        voice_config = request.voice_config or VapiVoiceConfig(
            provider="cartesia",
            voice_id=VOICE_PRESETS["neura_professional"]["id"],
            model="sonic-3",
            speed=0.9
        )
        
        assistant_config = VapiAssistantConfig(
            name=f"Neura - Interview {session_id}",
            first_message=InterviewPrompts.get_first_message(request.candidate, request.job),
            voice=voice_config,
            transcriber=VapiTranscriberConfig(
                provider="deepgram",
                model="nova-2",
                language="multi",  # Auto-detect English/Hindi
                endpointing=300
            ),
            model=VapiModelConfig(
                provider="openrouter",
                model="anthropic/claude-sonnet-4.5",
                temperature=0.7,
                max_tokens=500,
                system_prompt=InterviewPrompts.get_system_prompt(
                    request.candidate, request.job, plan
                ),
                tools=self._get_interview_tools()
            ),
            silence_timeout_seconds=SILENCE_TIMEOUT,
            max_duration_seconds=DEFAULT_CALL_DURATION,
            end_call_message=InterviewPrompts.get_end_call_message(request.candidate),
            server_url=f"{self.webhook_base_url}/voice-interview/webhook",
            recording_enabled=True,
            background_sound="office",
            barge_in_enabled=True
        )
        
        # 3. Create Vapi assistant
        vapi_assistant_id = await self._create_vapi_assistant(assistant_config)
        
        # 4. Create session
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
        
        # 5. Store session
        await self._store_session(session)
        
        # 6. Create storage directory
        session_dir = self.storage_path / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        # 7. Optionally start the call
        call_id = None
        if request.auto_call:
            call_response = await self.start_call(session_id)
            call_id = call_response.call_id
            session.status = InterviewStatus.CALLING
            await self._store_session(session)
        
        logger.info(f"✅ Created interview: {session_id}")
        logger.info(f"   Assistant ID: {vapi_assistant_id}")
        logger.info(f"   Questions: {len(plan.questions)}")
        
        return CreateInterviewResponse(
            session_id=session_id,
            status=session.status,
            vapi_assistant_id=vapi_assistant_id,
            plan=plan,
            message="Interview session created successfully",
            call_id=call_id
        )
    
    async def start_call(self, session_id: str) -> StartCallResponse:
        """Start the outbound call for an interview session."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        if session.status not in [InterviewStatus.PENDING, InterviewStatus.SCHEDULED]:
            raise ValueError(f"Cannot start call - session status is {session.status}")
        
        # Place outbound call via Vapi
        call_data = await self._create_vapi_call(
            assistant_id=session.vapi_assistant_id,
            phone_number=session.phone_number_called,
            phone_number_id=session.vapi_phone_number_id
        )
        
        # Update session
        session.vapi_call_id = call_data.get("id")
        session.status = InterviewStatus.CALLING
        session.call_start_time = datetime.utcnow().isoformat()
        await self._store_session(session)
        
        logger.info(f"📞 Started call for {session_id}: {session.vapi_call_id}")
        
        return StartCallResponse(
            session_id=session_id,
            call_id=session.vapi_call_id,
            status=InterviewStatus.CALLING,
            message="Call initiated successfully"
        )
    
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
                    "assistant_id": session.vapi_assistant_id
                },
                expire_seconds=3600 * 24  # 24 hours
            )
    
    # =========================================================================
    # VAPI API CALLS
    # =========================================================================
    
    async def _create_vapi_assistant(self, config: VapiAssistantConfig) -> str:
        """Create a Vapi assistant and return its ID."""
        client = await self._get_http_client()
        
        # Build assistant payload
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
            "backchannelingEnabled": True,
            "hipaaEnabled": False
        }
        
        # Add tools if defined
        if config.model.tools:
            payload["model"]["tools"] = config.model.tools
        
        # Cartesia speed goes in generationConfig
        if config.voice.provider == "cartesia" and config.voice.speed:
            payload["voice"]["generationConfig"] = {
                "speed": config.voice.speed
            }
        
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
    
    def _get_interview_tools(self) -> List[Dict[str, Any]]:
        """Get tool definitions for the interview assistant."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "get_next_question",
                    "description": "Get the next planned interview question. Call this when transitioning to a new topic.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "current_question_index": {
                                "type": "integer",
                                "description": "The index of the question just completed (0-based)"
                            },
                            "skip_reason": {
                                "type": "string",
                                "description": "Optional reason for skipping to next question"
                            }
                        },
                        "required": ["current_question_index"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "record_response_quality",
                    "description": "Record the quality of the candidate's response for analysis.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question_index": {
                                "type": "integer",
                                "description": "Which question this response was for"
                            },
                            "quality": {
                                "type": "string",
                                "enum": ["excellent", "good", "adequate", "weak", "concerning"],
                                "description": "Quality assessment"
                            },
                            "notes": {
                                "type": "string",
                                "description": "Brief notes about the response"
                            }
                        },
                        "required": ["question_index", "quality"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "end_interview",
                    "description": "Signal that the interview should end. Call this after the closing question or if needed.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reason": {
                                "type": "string",
                                "description": "Why the interview is ending"
                            },
                            "completed_questions": {
                                "type": "integer",
                                "description": "How many questions were completed"
                            }
                        },
                        "required": ["reason"]
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
        custom_questions: List[str]
    ) -> InterviewPlan:
        """Generate a comprehensive interview plan."""
        plan_id = f"plan-{uuid.uuid4().hex[:8]}"
        
        questions = []
        
        # 1. Introduction question (always first)
        first_name = candidate.name.split()[0]
        questions.append(InterviewPlanQuestion(
            question_id=f"q-{uuid.uuid4().hex[:8]}",
            question_text=(
                f"Great, thank you {first_name}. - "
                f"So, I see you're currently working as a {candidate.current_title}"
                f"{' at ' + candidate.current_company if candidate.current_company else ''}. - "
                f"To start us off, could you tell me a bit about yourself - "
                f"your background and what brings you to this opportunity?"
            ),
            question_type=QuestionType.INTRODUCTION,
            order=1,
            expected_topics=["background", "current role", "motivation"],
            time_limit_seconds=180,
            weight=0.8
        ))
        
        # 2. Add custom questions
        for i, q_text in enumerate(custom_questions[:3]):
            questions.append(InterviewPlanQuestion(
                question_id=f"q-custom-{uuid.uuid4().hex[:8]}",
                question_text=q_text,
                question_type=QuestionType.TECHNICAL,
                order=len(questions) + 1,
                weight=1.5
            ))
        
        # 3. Generate AI questions
        remaining = DEFAULT_MAX_QUESTIONS - len(questions) - 1  # -1 for closing
        if remaining > 0:
            ai_questions = await self._generate_ai_questions(
                candidate, job, remaining
            )
            for q in ai_questions:
                q.order = len(questions) + 1
                questions.append(q)
        
        # 4. Closing question (always last)
        questions.append(InterviewPlanQuestion(
            question_id=f"q-{uuid.uuid4().hex[:8]}",
            question_text=(
                f"Alright {first_name}, - those are all the questions I had. - "
                f"Before we wrap up, - is there anything you'd like to ask me "
                f"about the role or the company?"
            ),
            question_type=QuestionType.CLOSING,
            order=len(questions) + 1,
            expected_topics=["candidate questions", "interest level"],
            time_limit_seconds=120,
            weight=0.5
        ))
        
        # Build interview focus summary
        interview_focus = await self._generate_interview_focus(candidate, job)
        
        return InterviewPlan(
            plan_id=plan_id,
            candidate_id=candidate.candidate_id,
            job_id=job.job_id,
            interview_focus=interview_focus,
            questions=questions,
            interviewer_personality="warm_professional",
            opening_context=(
                f"This interview focuses on assessing {first_name}'s fit for the "
                f"{job.job_title} role. Key areas to evaluate: {', '.join(job.required_skills[:4])}. "
                f"The candidate has {candidate.experience_years} years of experience."
            ),
            closing_notes=(
                "End on a positive note. Thank the candidate warmly. "
                "Mention that the team will be in touch with next steps."
            )
        )
    
    async def _generate_ai_questions(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        count: int
    ) -> List[InterviewPlanQuestion]:
        """Generate questions using LLM."""
        
        prompt = f"""Generate {count} interview questions for this candidate and role.

CANDIDATE:
- Name: {candidate.name}
- Current Role: {candidate.current_title}
- Company: {candidate.current_company or 'N/A'}
- Experience: {candidate.experience_years} years
- Skills: {', '.join(candidate.skills[:10])}

JOB REQUIREMENTS:
- Title: {job.job_title}
- Required Skills: {', '.join(job.required_skills[:8])}
- Nice to Have: {', '.join(job.nice_to_have_skills[:5])}
- Experience Required: {job.experience_required}
- Responsibilities: {', '.join(job.key_responsibilities[:5])}

INSTRUCTIONS:
1. Be WARM and CONVERSATIONAL
2. Use candidate's first name occasionally
3. Add pauses with " - " for natural speech
4. Questions should invite storytelling
5. Mix: 2 technical, 1-2 behavioral, 1 experience-based

Return ONLY a JSON array:
[
  {{
    "question_text": "The question with - for pauses",
    "question_type": "technical|behavioral|experience|situational",
    "expected_topics": ["topic1", "topic2"],
    "skill_tags": ["skill1"],
    "weight": 1.0
  }}
]"""

        try:
            response = await self._call_llm(prompt, temperature=0.7)
            
            # Parse JSON
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                questions_data = json.loads(json_match.group())
            else:
                return self._get_fallback_questions(candidate, job, count)
            
            questions = []
            for q_data in questions_data[:count]:
                q_type_map = {
                    "technical": QuestionType.TECHNICAL,
                    "behavioral": QuestionType.BEHAVIORAL,
                    "experience": QuestionType.EXPERIENCE,
                    "situational": QuestionType.SITUATIONAL
                }
                
                questions.append(InterviewPlanQuestion(
                    question_id=f"q-ai-{uuid.uuid4().hex[:8]}",
                    question_text=q_data.get("question_text", ""),
                    question_type=q_type_map.get(
                        q_data.get("question_type", "technical").lower(),
                        QuestionType.TECHNICAL
                    ),
                    order=0,
                    expected_topics=q_data.get("expected_topics", []),
                    skill_tags=q_data.get("skill_tags", []),
                    weight=float(q_data.get("weight", 1.0)),
                    time_limit_seconds=180
                ))
            
            return questions if questions else self._get_fallback_questions(candidate, job, count)
            
        except Exception as e:
            logger.error(f"AI question generation failed: {e}")
            return self._get_fallback_questions(candidate, job, count)
    
    def _get_fallback_questions(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext,
        count: int
    ) -> List[InterviewPlanQuestion]:
        """Fallback questions if LLM fails."""
        first_name = candidate.name.split()[0]
        skill = candidate.skills[0] if candidate.skills else "your primary skill"
        
        fallback = [
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    f"I'd love to hear about a challenging project you've worked on, {first_name}. - "
                    f"Perhaps something involving {skill}? - "
                    f"Walk me through the situation and how you approached it."
                ),
                question_type=QuestionType.TECHNICAL,
                order=1,
                expected_topics=["problem", "approach", "outcome"],
                weight=1.5
            ),
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    "Tell me about a time you had to work with someone "
                    "who had a very different working style. - "
                    "How did you handle that?"
                ),
                question_type=QuestionType.BEHAVIORAL,
                order=1,
                expected_topics=["situation", "approach", "resolution"],
                weight=1.2
            ),
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    f"What's a project you're particularly proud of, {first_name}? - "
                    f"What made it special to you?"
                ),
                question_type=QuestionType.EXPERIENCE,
                order=1,
                expected_topics=["achievement", "impact", "learnings"],
                weight=1.3
            ),
            InterviewPlanQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    "How do you stay current with new developments in your field? - "
                    "What's something interesting you've learned recently?"
                ),
                question_type=QuestionType.CULTURE_FIT,
                order=1,
                expected_topics=["learning habits", "curiosity"],
                weight=1.0
            )
        ]
        return fallback[:count]
    
    async def _generate_interview_focus(
        self,
        candidate: InterviewCandidateContext,
        job: InterviewJobContext
    ) -> str:
        """Generate a summary of what to focus on."""
        # Find skill gaps and overlaps
        candidate_skills = set(s.lower() for s in candidate.skills)
        required_skills = set(s.lower() for s in job.required_skills)
        
        matched = candidate_skills & required_skills
        missing = required_skills - candidate_skills
        
        focus_areas = []
        
        if matched:
            focus_areas.append(f"Validate depth in: {', '.join(list(matched)[:4])}")
        
        if missing:
            focus_areas.append(f"Probe for experience in: {', '.join(list(missing)[:3])}")
        
        # Experience alignment
        years = candidate.experience_years
        if "senior" in job.job_title.lower() and years < 5:
            focus_areas.append("Assess readiness for senior-level responsibilities")
        elif "lead" in job.job_title.lower() or "manager" in job.job_title.lower():
            focus_areas.append("Evaluate leadership and mentoring experience")
        
        return " | ".join(focus_areas) or "General technical and behavioral assessment"
    
    # =========================================================================
    # WEBHOOK HANDLING
    # =========================================================================
    
    async def handle_webhook(
        self,
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle incoming Vapi webhook events.
        
        Event types:
        - assistant-request: Vapi asking for assistant config (not used - we pre-create)
        - function-call: Tool invocation from the LLM
        - status-update: Call status changes
        - end-of-call-report: Final report with recording URLs
        - transcript: Real-time transcript updates
        """
        event_type = event.type
        call_data = event.call or {}
        call_id = call_data.get("id")
        
        logger.info(f"📥 Webhook: {event_type} for call {call_id}")
        
        # Find session by call_id
        session = await self._get_session_by_call_id(call_id)
        
        if event_type == "function-call":
            return await self._handle_function_call(session, event, raw_body)
        
        elif event_type == "status-update":
            await self._handle_status_update(session, event)
            return {"status": "acknowledged"}
        
        elif event_type == "end-of-call-report":
            await self._handle_end_of_call(session, event, raw_body)
            return {"status": "acknowledged"}
        
        elif event_type == "transcript":
            await self._handle_transcript_update(session, event)
            return {"status": "acknowledged"}
        
        else:
            logger.debug(f"Unhandled event type: {event_type}")
            return {"status": "ignored"}
    
    async def _handle_function_call(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle tool/function calls from the LLM."""
        
        # Extract function call details
        message = raw_body.get("message", {})
        tool_calls = message.get("toolCalls", [])
        
        results = []
        
        for tool_call in tool_calls:
            func_name = tool_call.get("function", {}).get("name")
            func_args = tool_call.get("function", {}).get("arguments", {})
            tool_call_id = tool_call.get("id")
            
            logger.info(f"🔧 Function call: {func_name}")
            
            if func_name == "get_next_question":
                result = await self._tool_get_next_question(session, func_args)
            elif func_name == "record_response_quality":
                result = await self._tool_record_quality(session, func_args)
            elif func_name == "end_interview":
                result = await self._tool_end_interview(session, func_args)
            else:
                result = {"error": f"Unknown function: {func_name}"}
            
            results.append({
                "toolCallId": tool_call_id,
                "result": json.dumps(result) if isinstance(result, dict) else str(result)
            })
        
        return {"results": results}
    
    async def _tool_get_next_question(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get the next planned question."""
        if not session or not session.plan:
            return {"next_question": "Tell me about your experience.", "index": 0}
        
        current_idx = args.get("current_question_index", 0)
        next_idx = current_idx + 1
        
        if next_idx >= len(session.plan.questions):
            return {
                "message": "All questions completed. Proceed to closing.",
                "is_last": True
            }
        
        next_q = session.plan.questions[next_idx]
        return {
            "next_question": next_q.question_text,
            "question_type": next_q.question_type.value,
            "index": next_idx,
            "is_last": next_idx == len(session.plan.questions) - 1
        }
    
    async def _tool_record_quality(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Record response quality for later analysis."""
        if session:
            # Store in Redis for quick access during call
            if self.redis:
                quality_data = {
                    "question_index": args.get("question_index"),
                    "quality": args.get("quality"),
                    "notes": args.get("notes", ""),
                    "timestamp": datetime.utcnow().isoformat()
                }
                await self.redis.rpush(
                    f"interview:{session.session_id}:quality",
                    json.dumps(quality_data)
                )
        
        return {"status": "recorded"}
    
    async def _tool_end_interview(
        self,
        session: Optional[InterviewSession],
        args: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Signal interview completion."""
        logger.info(f"Interview ending: {args.get('reason')}")
        return {
            "message": "Interview complete. Delivering closing message.",
            "action": "end_call"
        }
    
    async def _handle_status_update(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent
    ):
        """Handle call status changes."""
        status = event.status
        call_data = event.call or {}
        
        logger.info(f"📊 Status update: {status}")
        
        if not session:
            return
        
        status_map = {
            "ringing": InterviewStatus.RINGING,
            "in-progress": InterviewStatus.IN_PROGRESS,
            "forwarding": InterviewStatus.IN_PROGRESS,
            "ended": InterviewStatus.COMPLETED
        }
        
        if status in status_map:
            session.status = status_map[status]
            
            if status == "in-progress" and not session.call_start_time:
                session.call_start_time = datetime.utcnow().isoformat()
            
            await self._store_session(session)
    
    async def _handle_end_of_call(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent,
        raw_body: Dict[str, Any]
    ):
        """Handle end-of-call report with recordings."""
        logger.info("📞 Call ended - processing report")
        
        if not session:
            logger.warning("No session found for end-of-call report")
            return
        
        # Extract data from report
        message = raw_body.get("message", {})
        
        # Update session with recording URLs
        session.recording_url = message.get("recordingUrl")
        session.stereo_recording_url = message.get("stereoRecordingUrl")
        session.call_end_time = datetime.utcnow().isoformat()
        
        # Calculate duration
        if session.call_start_time:
            start = datetime.fromisoformat(session.call_start_time)
            end = datetime.fromisoformat(session.call_end_time)
            session.call_duration_seconds = (end - start).total_seconds()
        
        # Extract transcript
        transcript = message.get("transcript", "")
        session.full_transcript = self._parse_transcript(transcript)
        
        # Set end reason
        ended_reason = message.get("endedReason", "completed")
        reason_map = {
            "customer-ended-call": CallEndReason.HANGUP_CANDIDATE,
            "assistant-ended-call": CallEndReason.COMPLETED,
            "silence-timed-out": CallEndReason.SILENCE_TIMEOUT,
            "max-duration-reached": CallEndReason.MAX_DURATION,
            "voicemail": CallEndReason.VOICEMAIL,
            "no-answer": CallEndReason.NO_ANSWER
        }
        session.call_end_reason = reason_map.get(ended_reason, CallEndReason.COMPLETED)
        
        # Set final status
        if session.call_end_reason in [CallEndReason.COMPLETED, CallEndReason.HANGUP_CANDIDATE]:
            session.status = InterviewStatus.COMPLETED
        elif session.call_end_reason == CallEndReason.NO_ANSWER:
            session.status = InterviewStatus.NO_ANSWER
        elif session.call_end_reason == CallEndReason.VOICEMAIL:
            session.status = InterviewStatus.VOICEMAIL
        else:
            session.status = InterviewStatus.FAILED
        
        await self._store_session(session)
        
        # Trigger async analysis
        asyncio.create_task(self._run_post_interview_analysis(session.session_id))
    
    async def _handle_transcript_update(
        self,
        session: Optional[InterviewSession],
        event: VapiWebhookEvent
    ):
        """Handle real-time transcript updates."""
        if not session:
            return
        
        # Store transcript chunks for real-time display
        if self.redis and event.transcript:
            for entry in event.transcript:
                await self.redis.rpush(
                    f"interview:{session.session_id}:transcript",
                    json.dumps(entry)
                )
    
    def _parse_transcript(self, transcript: str) -> List[Dict[str, Any]]:
        """Parse transcript string into structured format."""
        entries = []
        lines = transcript.split('\n')
        
        for line in lines:
            if line.startswith("AI:") or line.startswith("Assistant:"):
                entries.append({
                    "role": "assistant",
                    "content": line.split(":", 1)[1].strip() if ":" in line else line,
                    "timestamp": 0
                })
            elif line.startswith("User:") or line.startswith("Human:"):
                entries.append({
                    "role": "user",
                    "content": line.split(":", 1)[1].strip() if ":" in line else line,
                    "timestamp": 0
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
        logger.info(f"🔍 Starting post-interview analysis for {session_id}")
        
        try:
            session = await self.get_session(session_id)
            if not session:
                logger.error(f"Session not found for analysis: {session_id}")
                return
            
            # 1. Download recording if available
            if session.recording_url:
                await self._download_recording(session)
            
            # 2. Generate clips from transcript
            clips = await self._generate_clips(session)
            session.clips = clips
            
            # 3. Analyze each clip/response
            for clip in clips:
                clip.analysis = await self._analyze_response(session, clip)
            
            # 4. Generate final assessment
            assessment = await self._generate_final_assessment(session)
            session.final_assessment = assessment
            
            # 5. Save everything
            await self._store_session(session)
            
            logger.info(f"✅ Analysis complete for {session_id}")
            logger.info(f"   Score: {assessment.overall_score}")
            logger.info(f"   Recommendation: {assessment.recommendation}")
            
        except Exception as e:
            logger.error(f"Post-interview analysis failed: {e}")
    
    async def _download_recording(self, session: InterviewSession):
        """Download and save the recording locally."""
        if not session.recording_url:
            return
        
        try:
            client = await self._get_http_client()
            response = await client.get(session.recording_url)
            response.raise_for_status()
            
            session_dir = self.storage_path / session.session_id
            recording_path = session_dir / "full_recording.wav"
            
            with open(recording_path, "wb") as f:
                f.write(response.content)
            
            session.recording_local_path = str(recording_path)
            logger.info(f"Downloaded recording to {recording_path}")
            
        except Exception as e:
            logger.error(f"Failed to download recording: {e}")
    
    async def _generate_clips(self, session: InterviewSession) -> List[InterviewClip]:
        """Generate clips from transcript, one per Q&A pair."""
        clips = []
        
        if not session.full_transcript or not session.plan:
            return clips
        
        # Group transcript by Q&A exchanges
        current_question = None
        current_response_parts = []
        question_idx = 0
        
        for entry in session.full_transcript:
            role = entry.get("role", "")
            content = entry.get("content", "")
            
            if role == "assistant" and "?" in content:
                # This is likely a question
                if current_question and current_response_parts:
                    # Save previous Q&A as clip
                    clips.append(self._create_clip_from_qa(
                        session,
                        current_question,
                        current_response_parts,
                        question_idx
                    ))
                    question_idx += 1
                
                current_question = content
                current_response_parts = []
            
            elif role == "user":
                current_response_parts.append(content)
        
        # Don't forget the last Q&A
        if current_question and current_response_parts:
            clips.append(self._create_clip_from_qa(
                session,
                current_question,
                current_response_parts,
                question_idx
            ))
        
        return clips
    
    def _create_clip_from_qa(
        self,
        session: InterviewSession,
        question: str,
        response_parts: List[str],
        idx: int
    ) -> InterviewClip:
        """Create a clip from a Q&A pair."""
        response_text = " ".join(response_parts)
        
        # Determine question type
        q_type = QuestionType.TECHNICAL
        if session.plan and idx < len(session.plan.questions):
            q_type = session.plan.questions[idx].question_type
        
        return InterviewClip(
            clip_id=f"clip-{uuid.uuid4().hex[:12]}",
            session_id=session.session_id,
            start_time_seconds=0,  # Would need audio processing for accurate timing
            end_time_seconds=0,
            duration_seconds=0,
            question_asked=question,
            question_type=q_type,
            candidate_response=response_text
        )
    
    async def _analyze_response(
        self,
        session: InterviewSession,
        clip: InterviewClip
    ) -> ResponseAnalysis:
        """Analyze a single response."""
        
        if not clip.candidate_response or len(clip.candidate_response) < 10:
            return ResponseAnalysis(
                key_points_covered=[],
                topics_mentioned=[],
                skills_demonstrated=[],
                relevance_score=0,
                depth_score=0,
                clarity_score=0,
                overall_score=0,
                confidence_assessment=ConfidenceLevel.UNCERTAIN,
                strengths=[],
                areas_for_improvement=["No substantive response"],
                red_flags=["Minimal response"],
                brief_summary="Response too brief to analyze"
            )
        
        prompt = f"""Analyze this interview response.

CONTEXT:
- Candidate: {session.candidate.name} ({session.candidate.experience_years} yrs exp)
- Role: {session.candidate.current_title}
- Applying for: {session.job.job_title}

QUESTION: "{clip.question_asked[:300]}"
RESPONSE: "{clip.candidate_response[:800]}"

Analyze and return JSON:
{{
    "key_points_covered": ["point1", "point2"],
    "topics_mentioned": ["topic1"],
    "skills_demonstrated": ["skill1"],
    "relevance_score": 0-100,
    "depth_score": 0-100,
    "clarity_score": 0-100,
    "overall_score": 0-100,
    "confidence_assessment": "high|medium|low|uncertain",
    "strengths": ["strength1"],
    "areas_for_improvement": ["area1"],
    "red_flags": [],
    "brief_summary": "One sentence summary"
}}

SCORING: 80-100=Excellent, 60-79=Good, 40-59=Adequate, 20-39=Weak"""

        try:
            response = await self._call_llm(prompt, temperature=0.3)
            
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                data = json.loads(json_match.group())
                return ResponseAnalysis(
                    key_points_covered=data.get("key_points_covered", []),
                    topics_mentioned=data.get("topics_mentioned", []),
                    skills_demonstrated=data.get("skills_demonstrated", []),
                    relevance_score=float(data.get("relevance_score", 50)),
                    depth_score=float(data.get("depth_score", 50)),
                    clarity_score=float(data.get("clarity_score", 50)),
                    overall_score=float(data.get("overall_score", 50)),
                    confidence_assessment=ConfidenceLevel(
                        data.get("confidence_assessment", "medium")
                    ),
                    strengths=data.get("strengths", []),
                    areas_for_improvement=data.get("areas_for_improvement", []),
                    red_flags=data.get("red_flags", []),
                    brief_summary=data.get("brief_summary", "Response analyzed")
                )
        except Exception as e:
            logger.error(f"Response analysis failed: {e}")
        
        return ResponseAnalysis(
            key_points_covered=[],
            topics_mentioned=[],
            skills_demonstrated=[],
            relevance_score=50,
            depth_score=50,
            clarity_score=50,
            overall_score=50,
            confidence_assessment=ConfidenceLevel.UNCERTAIN,
            strengths=["Response provided"],
            areas_for_improvement=["Manual review needed"],
            red_flags=[],
            brief_summary="Analysis pending review"
        )
    
    async def _generate_final_assessment(
        self,
        session: InterviewSession
    ) -> InterviewAssessment:
        """Generate comprehensive final assessment."""
        
        # Gather clip analyses
        clip_summaries = []
        total_score = 0
        score_count = 0
        
        for clip in session.clips:
            if clip.analysis:
                clip_summaries.append({
                    "question": clip.question_asked[:200],
                    "type": clip.question_type.value,
                    "score": clip.analysis.overall_score,
                    "summary": clip.analysis.brief_summary
                })
                total_score += clip.analysis.overall_score
                score_count += 1
        
        avg_score = total_score / max(score_count, 1)
        
        prompt = f"""Generate a comprehensive interview assessment.

CANDIDATE: {session.candidate.name}
ROLE: {session.candidate.current_title} at {session.candidate.current_company or 'N/A'}
EXPERIENCE: {session.candidate.experience_years} years
SKILLS: {', '.join(session.candidate.skills[:8])}

TARGET ROLE: {session.job.job_title}
REQUIRED SKILLS: {', '.join(session.job.required_skills[:6])}

RESPONSE SUMMARIES:
{json.dumps(clip_summaries, indent=2)}

AVERAGE SCORE: {avg_score:.1f}

Generate assessment JSON:
{{
    "overall_score": 0-100,
    "technical_score": 0-100,
    "communication_score": 0-100,
    "culture_fit_score": 0-100,
    "recommendation": "strong_hire|hire|maybe|no_hire",
    "recommendation_confidence": "high|medium|low",
    "top_strengths": ["strength1", "strength2", "strength3"],
    "concerns": ["concern1"] or [],
    "notable_moments": ["moment1"],
    "executive_summary": "2-3 sentence summary for hiring manager",
    "language_proficiency": {{"english": "excellent|good|fair|poor"}}
}}

CALIBRATION: 85-100=Exceptional, 70-84=Strong, 55-69=Decent, 40-54=Below bar"""

        try:
            response = await self._call_llm(prompt, temperature=0.3)
            
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                data = json.loads(json_match.group())
                
                # Identify highlight clips
                highlight_clips = []
                red_flag_clips = []
                for clip in session.clips:
                    if clip.analysis:
                        if clip.analysis.overall_score >= 80:
                            highlight_clips.append(clip.clip_id)
                        if clip.analysis.red_flags:
                            red_flag_clips.append(clip.clip_id)
                
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
                        clip.clip_id: clip.analysis.overall_score
                        for clip in session.clips if clip.analysis
                    },
                    top_strengths=data.get("top_strengths", []),
                    concerns=data.get("concerns", []),
                    notable_moments=data.get("notable_moments", []),
                    highlight_clips=highlight_clips,
                    red_flag_clips=red_flag_clips,
                    executive_summary=data.get("executive_summary", "Interview completed."),
                    detailed_report="",
                    language_proficiency=data.get("language_proficiency", {"english": "good"})
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
        max_tokens: int = 2000,
        model: str = "anthropic/claude-sonnet-4.5"
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
    
    async def get_interview_results(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get complete interview results for frontend display."""
        session = await self.get_session(session_id)
        if not session:
            return None
        
        return {
            "session_id": session.session_id,
            "status": session.status.value,
            "candidate": {
                "name": session.candidate.name,
                "title": session.candidate.current_title,
                "company": session.candidate.current_company,
                "phone": session.phone_number_called
            },
            "job": {
                "title": session.job.job_title,
                "company": session.job.company_name
            },
            "call_info": {
                "duration_minutes": session.call_duration_seconds / 60 if session.call_duration_seconds else None,
                "start_time": session.call_start_time,
                "end_time": session.call_end_time,
                "end_reason": session.call_end_reason.value if session.call_end_reason else None
            },
            "recording_url": session.recording_url,
            "clips": [
                {
                    "clip_id": clip.clip_id,
                    "question": clip.question_asked,
                    "question_type": clip.question_type.value,
                    "response": clip.candidate_response,
                    "score": clip.analysis.overall_score if clip.analysis else None,
                    "summary": clip.analysis.brief_summary if clip.analysis else None,
                    "is_highlight": clip.is_highlight,
                    "strengths": clip.analysis.strengths if clip.analysis else [],
                    "concerns": clip.analysis.red_flags if clip.analysis else []
                }
                for clip in session.clips
            ],
            "assessment": session.final_assessment.model_dump() if session.final_assessment else None,
            "transcript": session.full_transcript,
            "created_at": session.created_at,
            "completed_at": session.call_end_time
}
        
    async def list_interviews(
        self,
        username: str,
        status: Optional[InterviewStatus] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List interviews with filtering."""
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
                    "created_at": doc.get("created_at"),
                    "score": doc.get("final_assessment", {}).get("overall_score") if doc.get("final_assessment") else None
                })
            
            return interviews, total
        
        # In-memory fallback
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
                "created_at": s.created_at
            }
            for s in filtered[offset:offset+limit]
        ], len(filtered)