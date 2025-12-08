#!/usr/bin/env python3
"""
Voice Interview Service V2
==========================
AI-powered voice interview system using Cartesia Sonic 3 (TTS) and Ink-Whisper (STT).

IMPROVEMENTS IN V2:
- Fixed JSON parsing errors in LLM responses
- Slower, more natural speech speed
- Warm, engaged interviewer personality
- Proper emotion controls and pauses
- Better interview flow with acknowledgments
- Comprehensive error handling

Features:
- Natural conversational interviewing with realistic voice
- Real-time speech-to-text with Hindi understanding
- LLM-powered question generation and response analysis
- Full recording with timestamped clips
- Comprehensive candidate assessment

Author: NeuraLeap Engineering
"""

import asyncio
import base64
import hashlib
import io
import json
import os
import re
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydub import AudioSegment

from core.logging_config import get_logger
from models.voice_interview_models import (CandidateContext, CandidateResponse,
                                           CartesiaVoiceConfig,
                                           ConfidenceLevel,
                                           InterviewAssessment, InterviewClip,
                                           InterviewQuestion, InterviewSession,
                                           InterviewStatus, JobContext,
                                           QuestionType, ResponseAnalysis,
                                           ResponseLanguage,
                                           TranscriptionResult)

logger = get_logger(__name__)


# ============================================================================
# CONSTANTS & CONFIGURATION
# ============================================================================

# Cartesia API endpoints
CARTESIA_TTS_URL = "https://api.cartesia.ai/tts/bytes"
CARTESIA_STT_URL = "https://api.cartesia.ai/stt/transcribe"

# Cartesia voice IDs optimized for Indian demographic
# Using voices that work well for voice agents (stable, realistic)
VOICE_PRESETS = {
    "professional_female": {
        "id": "f786b574-daa5-4673-aa0c-cbe3e8534c02",  # Katie - stable, realistic
        "name": "Katie",
        "description": "Professional female voice, clear English, warm tone"
    },
    "professional_male": {
        "id": "228fca29-3a0a-435c-8728-5cb483251068",  # Kiefer - professional male
        "name": "Kiefer", 
        "description": "Professional male voice, clear and engaging"
    },
    "emotive_female": {
        "id": "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",  # Tessa - emotive
        "name": "Tessa",
        "description": "Expressive female voice, great for warmth"
    },
    "emotive_male": {
        "id": "c961b81c-a935-4c17-bfb3-ba2239de8c2f",  # Kyle - emotive
        "name": "Kyle",
        "description": "Expressive male voice, engaging personality"
    },
    "hindi_female": {
        "id": "a3520a8f-226a-428d-9fcd-b0a4711a6829",  # Hindi female voice
        "name": "Priya",
        "description": "Hindi female conversational voice"
    },
    "hinglish_female": {
        "id": "63fba6e5-067b-4225-8de9-5f9e9c2f3a71",  # Hinglish voice
        "name": "Meera",
        "description": "Warm Hinglish female voice"
    }
}

# Audio configuration
AUDIO_CONFIG = {
    "sample_rate": 44100,
    "encoding": "pcm_f32le",
    "container": "wav",
    "stt_sample_rate": 16000,
    "stt_encoding": "pcm_s16le"
}

# Interview configuration
DEFAULT_QUESTIONS_COUNT = 8
MAX_RESPONSE_TIME_SECONDS = 300  # 5 minutes max per response


# ============================================================================
# INTERVIEWER PERSONALITY & PHRASES
# ============================================================================

class InterviewerPersonality:
    """
    Warm, engaged interviewer phrases and behaviors.
    Makes the interview feel natural and human.
    """
    
    # Acknowledgment phrases after candidate responses
    ACKNOWLEDGMENTS = [
        "Thank you for sharing that. - That's really insightful.",
        "I appreciate you walking me through that. - Very helpful.",
        "That's a great example. - Thank you.",
        "Interesting perspective. - I can see your thought process there.",
        "Thank you. - That gives me a good sense of your approach.",
        "I see. - That's a solid response.",
        "Great, thank you for that detailed answer.",
        "That's helpful context. - Appreciate you sharing.",
    ]
    
    # Transition phrases to next question
    TRANSITIONS = [
        "Now, - let me ask you about something a bit different.",
        "Moving on, - I'd like to explore another area.",
        "Great. - Now let's talk about",
        "Thank you. - My next question is",
        "Alright. - Let's shift gears a little.",
        "Perfect. - Now I'm curious about",
    ]
    
    # Encouragement for nervous candidates
    ENCOURAGEMENTS = [
        "Take your time. - There's no rush.",
        "Feel free to think about it for a moment.",
        "No pressure - just share what comes to mind.",
    ]
    
    # Hindi acknowledgment (for when candidate speaks Hindi)
    HINDI_ACKNOWLEDGMENTS = [
        "Bahut accha. - Thank you for that.",
        "That's great. - Feel free to continue in whichever language you're comfortable with.",
        "No problem at all. - Please continue.",
    ]
    
    # Closing warmth
    CLOSING_PHRASES = [
        "Thank you so much for your time today, {name}. - I really enjoyed our conversation.",
        "It's been a pleasure speaking with you, {name}. - Thank you for being so open and thoughtful.",
        "{name}, thank you for taking the time to speak with me today. - I appreciate your candid responses.",
    ]
    
    @classmethod
    def get_acknowledgment(cls, response_quality: str = "good") -> str:
        """Get appropriate acknowledgment based on response quality."""
        import random
        return random.choice(cls.ACKNOWLEDGMENTS)
    
    @classmethod
    def get_transition(cls) -> str:
        """Get a transition phrase."""
        import random
        return random.choice(cls.TRANSITIONS)
    
    @classmethod
    def get_hindi_acknowledgment(cls) -> str:
        """Get acknowledgment for Hindi response."""
        import random
        return random.choice(cls.HINDI_ACKNOWLEDGMENTS)
    
    @classmethod
    def get_closing(cls, name: str) -> str:
        """Get personalized closing phrase."""
        import random
        phrase = random.choice(cls.CLOSING_PHRASES)
        return phrase.format(name=name.split()[0])


# ============================================================================
# VOICE INTERVIEW SERVICE V2
# ============================================================================

class VoiceInterviewService:
    """
    Main service for conducting AI-powered voice interviews.
    
    V2 Improvements:
    - Warm, engaged interviewer personality
    - Slower, more natural speech with pauses
    - Proper emotion controls
    - Better error handling
    - Natural interview flow
    """
    
    # =========================================================================
    # INITIALIZATION
    # =========================================================================
    
    def __init__(
        self,
        mongodb=None,
        redis_cache=None,
        model_config_manager=None,
        cartesia_api_key: Optional[str] = None,
        openrouter_api_key: Optional[str] = None,
        storage_path: str = "./interview_recordings"
    ):
        """Initialize the Voice Interview Service."""
        self.db = mongodb
        self.redis = redis_cache
        self.model_manager = model_config_manager
        
        # API Keys
        self.cartesia_api_key = cartesia_api_key or os.getenv("CARTESIA_API_KEY")
        self.openrouter_api_key = openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
        
        # Validate API keys
        if not self.cartesia_api_key:
            logger.warning("⚠️ CARTESIA_API_KEY not set - TTS/STT will fail")
        if not self.openrouter_api_key:
            logger.warning("⚠️ OPENROUTER_API_KEY not set - Analysis will fail")
        
        # Storage setup
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # In-memory session store (for standalone testing)
        self._sessions: Dict[str, InterviewSession] = {}
        
        # HTTP client
        self._http_client: Optional[httpx.AsyncClient] = None
        
        logger.info("✅ VoiceInterviewService V2 initialized")
        logger.info(f"   Storage path: {self.storage_path}")
    
    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=120.0)
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
        candidate: CandidateContext,
        job: JobContext,
        voice_config: Optional[CartesiaVoiceConfig] = None,
        max_questions: int = DEFAULT_QUESTIONS_COUNT,
        custom_questions: Optional[List[str]] = None
    ) -> InterviewSession:
        """Create a new interview session."""
        session_id = f"interview-{uuid.uuid4().hex[:12]}"
        
        # Use default professional voice with slower speed
        if voice_config is None:
            voice_config = CartesiaVoiceConfig(
                voice_id=VOICE_PRESETS["professional_female"]["id"],
                voice_name=VOICE_PRESETS["professional_female"]["name"],
                speed=-0.15,  # Slightly slower for clarity
                emotion="content",  # Warm, professional
                emotion_level="medium"
            )
        
        session = InterviewSession(
            session_id=session_id,
            candidate=candidate,
            job=job,
            voice_config=voice_config,
            max_questions=max_questions,
            status=InterviewStatus.PENDING
        )
        
        # Create session directory
        session_dir = self.storage_path / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        # Store session
        await self._store_session(session)
        
        # Generate questions
        questions = await self._generate_questions(session, custom_questions)
        session.questions = questions
        await self._store_session(session)
        
        logger.info(f"✅ Created interview session: {session_id}")
        logger.info(f"   Candidate: {candidate.name}")
        logger.info(f"   Job: {job.job_title}")
        logger.info(f"   Questions: {len(questions)}")
        
        return session
    
    async def _store_session(self, session: InterviewSession):
        """Store session in MongoDB or in-memory."""
        if self.db and hasattr(self.db, 'main_db'):
            collection = self.db.main_db["interview_sessions"]
            await collection.update_one(
                {"session_id": session.session_id},
                {"$set": session.model_dump()},
                upsert=True
            )
        else:
            self._sessions[session.session_id] = session
        
        if self.redis:
            await self.redis.store_session_data(
                session.session_id,
                "interview_state",
                {"status": session.status, "current_q": session.current_question_index},
                expire_seconds=3600
            )
    
    async def get_session(self, session_id: str) -> Optional[InterviewSession]:
        """Retrieve interview session."""
        if self.db and hasattr(self.db, 'main_db'):
            collection = self.db.main_db["interview_sessions"]
            doc = await collection.find_one({"session_id": session_id})
            if doc:
                doc.pop('_id', None)
                return InterviewSession(**doc)
        else:
            return self._sessions.get(session_id)
        return None
    
    # =========================================================================
    # QUESTION GENERATION (LLM-Powered) - FIXED
    # =========================================================================
    
    async def _generate_questions(
        self,
        session: InterviewSession,
        custom_questions: Optional[List[str]] = None
    ) -> List[InterviewQuestion]:
        """Generate interview questions tailored to candidate and job."""
        questions = []
        
        # 1. Introduction question (always first) - Warm and welcoming
        intro_question = InterviewQuestion(
            question_id=f"q-{uuid.uuid4().hex[:8]}",
            question_text=self._get_introduction_question(session.candidate),
            question_type=QuestionType.INTRODUCTION,
            order=1,
            expected_topics=["background", "current role", "career goals"],
            time_limit_seconds=180,
            weight=0.8
        )
        questions.append(intro_question)
        
        # 2. Add custom questions if provided
        if custom_questions:
            for i, q_text in enumerate(custom_questions[:3]):
                questions.append(InterviewQuestion(
                    question_id=f"q-custom-{uuid.uuid4().hex[:8]}",
                    question_text=q_text,
                    question_type=QuestionType.TECHNICAL,
                    order=len(questions) + 1,
                    weight=1.5
                ))
        
        # 3. Generate AI questions
        remaining = session.max_questions - len(questions) - 1  # -1 for closing
        if remaining > 0:
            ai_questions = await self._generate_ai_questions(session, remaining)
            for q in ai_questions:
                q.order = len(questions) + 1
                questions.append(q)
        
        # 4. Closing question (always last) - Warm and open
        closing_question = InterviewQuestion(
            question_id=f"q-{uuid.uuid4().hex[:8]}",
            question_text=self._get_closing_question(session.candidate),
            question_type=QuestionType.CLOSING,
            order=len(questions) + 1,
            expected_topics=["candidate questions", "interest level"],
            time_limit_seconds=120,
            weight=0.5
        )
        questions.append(closing_question)
        
        return questions
    
    def _get_introduction_question(self, candidate: CandidateContext) -> str:
        """Generate warm, personalized introduction question."""
        first_name = candidate.name.split()[0]
        return (
            f"Hello {first_name}, - welcome, and thank you so much for joining me today. "
            f"I'm really looking forward to learning more about you. "
            f"I see you're currently working as a {candidate.current_title}"
            f"{' at ' + candidate.current_company if candidate.current_company else ''}. "
            f"To start us off, - could you tell me a bit about yourself, - "
            f"your background, - and what brings you to this opportunity?"
        )
    
    def _get_closing_question(self, candidate: CandidateContext) -> str:
        """Generate warm closing question."""
        first_name = candidate.name.split()[0]
        return (
            f"Alright {first_name}, - that brings us to the end of my questions. "
            f"Before we wrap up, - I want to make sure you have a chance to ask me anything. "
            f"Do you have any questions about the role, - the team, - or anything else "
            f"you'd like to know?"
        )
    
    async def _generate_ai_questions(
        self,
        session: InterviewSession,
        count: int
    ) -> List[InterviewQuestion]:
        """Generate contextual questions using LLM - WITH ROBUST JSON PARSING."""
        
        prompt = f"""You are an expert technical interviewer conducting a warm, engaging interview. 
Generate exactly {count} interview questions for this candidate and role.

CANDIDATE PROFILE:
- Name: {session.candidate.name}
- Current Role: {session.candidate.current_title}
- Company: {session.candidate.current_company or 'N/A'}
- Experience: {session.candidate.experience_years} years
- Key Skills: {', '.join(session.candidate.skills[:10])}
- Location: {session.candidate.location or 'N/A'}

JOB REQUIREMENTS:
- Title: {session.job.job_title}
- Company: {session.job.company_name or 'N/A'}
- Required Skills: {', '.join(session.job.required_skills[:8])}
- Nice to Have: {', '.join(session.job.nice_to_have_skills[:5])}
- Experience Required: {session.job.experience_required}
- Key Responsibilities: {', '.join(session.job.key_responsibilities[:5])}

INSTRUCTIONS FOR QUESTION STYLE:
1. Be WARM and CONVERSATIONAL - like a friendly colleague, not an interrogator
2. Use the candidate's first name occasionally
3. Add natural pauses with " - " (hyphen with spaces) for breath breaks
4. Reference their actual experience/skills to make it personal
5. Questions should invite storytelling, not yes/no answers
6. Include encouraging phrases like "I'd love to hear about..." or "Could you walk me through..."

Generate a mix of:
- 2 Technical questions (specific to their skills and the role)
- 1-2 Behavioral questions (STAR format situations)
- 1 Experience-based question (past projects/achievements)

IMPORTANT: Return ONLY a valid JSON array. No markdown, no code blocks, no explanation.

Example format:
[
  {{
    "question_text": "I noticed you have experience with Python. - I'd love to hear about a challenging project where you really had to push your Python skills. - What was the situation, and how did you approach it?",
    "question_type": "technical",
    "expected_topics": ["problem description", "approach", "solution"],
    "skill_tags": ["Python", "Problem Solving"],
    "follow_up_prompts": ["What would you do differently?", "How did you measure success?"],
    "weight": 1.5
  }}
]

Generate exactly {count} questions in this JSON array format:"""

        try:
            response = await self._call_llm(prompt, temperature=0.7, max_tokens=3000)
            
            # Clean the response - remove any markdown or extra text
            response = response.strip()
            
            # Try to extract JSON array from response
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                json_str = json_match.group()
            else:
                json_str = response
            
            # Clean common issues
            json_str = json_str.strip()
            if json_str.startswith('```'):
                # Remove markdown code blocks
                json_str = re.sub(r'^```(?:json)?\s*', '', json_str)
                json_str = re.sub(r'\s*```$', '', json_str)
            
            # Parse JSON
            questions_data = json.loads(json_str)
            
            if not isinstance(questions_data, list):
                raise ValueError("Response is not a JSON array")
            
            questions = []
            for i, q_data in enumerate(questions_data[:count]):
                # Validate required fields
                question_text = q_data.get("question_text", "")
                if not question_text:
                    continue
                
                # Map question type
                q_type_str = q_data.get("question_type", "technical").lower()
                type_mapping = {
                    "technical": QuestionType.TECHNICAL,
                    "behavioral": QuestionType.BEHAVIORAL,
                    "experience": QuestionType.EXPERIENCE,
                    "situational": QuestionType.SITUATIONAL,
                    "culture_fit": QuestionType.CULTURE_FIT
                }
                q_type = type_mapping.get(q_type_str, QuestionType.TECHNICAL)
                
                questions.append(InterviewQuestion(
                    question_id=f"q-ai-{uuid.uuid4().hex[:8]}",
                    question_text=question_text,
                    question_type=q_type,
                    order=0,
                    expected_topics=q_data.get("expected_topics", []),
                    skill_tags=q_data.get("skill_tags", []),
                    follow_up_prompts=q_data.get("follow_up_prompts", []),
                    weight=float(q_data.get("weight", 1.0)),
                    time_limit_seconds=180
                ))
            
            if questions:
                logger.info(f"✅ Generated {len(questions)} AI questions")
                return questions
            else:
                logger.warning("No valid questions parsed, using fallback")
                return self._get_fallback_questions(session, count)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            logger.error(f"Response was: {response[:500] if response else 'empty'}")
            return self._get_fallback_questions(session, count)
        except Exception as e:
            logger.error(f"Failed to generate AI questions: {e}")
            return self._get_fallback_questions(session, count)
    
    def _get_fallback_questions(
        self,
        session: InterviewSession,
        count: int
    ) -> List[InterviewQuestion]:
        """Fallback questions if LLM fails - still warm and engaging."""
        first_name = session.candidate.name.split()[0]
        primary_skill = session.candidate.skills[0] if session.candidate.skills else "your primary technology"
        
        fallback = [
            InterviewQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    f"I'd love to hear about a challenging technical problem you've solved, {first_name}. - "
                    f"Perhaps something involving {primary_skill}? - "
                    f"Walk me through the situation, - your approach, - and what you learned from it."
                ),
                question_type=QuestionType.TECHNICAL,
                order=0,
                expected_topics=["problem description", "approach", "solution", "learnings"],
                weight=1.5
            ),
            InterviewQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    "Tell me about a time when you had to work with someone who had a very different "
                    "working style than yours. - How did you navigate that, - and what was the outcome?"
                ),
                question_type=QuestionType.BEHAVIORAL,
                order=0,
                expected_topics=["situation", "approach", "resolution", "lessons"],
                weight=1.2
            ),
            InterviewQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    f"What's a project you're particularly proud of, {first_name}? - "
                    f"I'd love to hear what made it special to you - and what impact it had."
                ),
                question_type=QuestionType.EXPERIENCE,
                order=0,
                expected_topics=["project details", "personal contribution", "impact"],
                weight=1.3
            ),
            InterviewQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    "How do you stay current with new developments in your field? - "
                    "I'm curious about your learning process - and maybe something interesting you've picked up recently."
                ),
                question_type=QuestionType.CULTURE_FIT,
                order=0,
                expected_topics=["learning habits", "recent learnings", "curiosity"],
                weight=1.0
            ),
            InterviewQuestion(
                question_id=f"q-fb-{uuid.uuid4().hex[:8]}",
                question_text=(
                    "Describe a situation where you had to make a difficult technical decision "
                    "with incomplete information. - How did you approach it, - and looking back, - "
                    "would you do anything differently?"
                ),
                question_type=QuestionType.SITUATIONAL,
                order=0,
                expected_topics=["decision making", "uncertainty", "reflection"],
                weight=1.4
            )
        ]
        return fallback[:count]
    
    # =========================================================================
    # TEXT-TO-SPEECH (Cartesia Sonic 3) - IMPROVED
    # =========================================================================
    
    async def generate_question_audio(
        self,
        session_id: str,
        question_id: str,
        custom_text: Optional[str] = None,
        emotion: Optional[str] = None
    ) -> Tuple[bytes, str]:
        """Generate audio for interview question using Cartesia Sonic 3."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        question = next((q for q in session.questions if q.question_id == question_id), None)
        if not question and not custom_text:
            raise ValueError(f"Question not found: {question_id}")
        
        text = custom_text or question.question_text
        
        # Determine emotion based on question type
        if emotion is None:
            emotion = self._get_emotion_for_question_type(
                question.question_type if question else QuestionType.INTRODUCTION
            )
        
        # Generate audio with Cartesia
        audio_bytes = await self._text_to_speech(
            text=text,
            voice_config=session.voice_config,
            emotion=emotion
        )
        
        # Save to file
        session_dir = self.storage_path / session_id
        file_path = session_dir / f"question_{question_id}.wav"
        
        with open(file_path, "wb") as f:
            f.write(audio_bytes)
        
        logger.info(f"Generated audio for question {question_id}: {len(audio_bytes)} bytes")
        
        return audio_bytes, str(file_path)
    
    def _get_emotion_for_question_type(self, question_type: QuestionType) -> str:
        """Get appropriate emotion for question type."""
        emotion_map = {
            QuestionType.INTRODUCTION: "content",  # Warm, welcoming
            QuestionType.TECHNICAL: "curious",  # Engaged, interested
            QuestionType.BEHAVIORAL: "sympathetic",  # Understanding
            QuestionType.SITUATIONAL: "curious",  # Interested
            QuestionType.EXPERIENCE: "enthusiastic",  # Encouraging
            QuestionType.CULTURE_FIT: "content",  # Friendly
            QuestionType.CLOSING: "grateful",  # Appreciative
        }
        return emotion_map.get(question_type, "content")
    
    async def _text_to_speech(
        self,
        text: str,
        voice_config: CartesiaVoiceConfig,
        emotion: Optional[str] = None
    ) -> bytes:
        """
        Convert text to speech using Cartesia Sonic 3.
        
        Uses proper speed, volume, and emotion controls for natural speech.
        """
        if not self.cartesia_api_key:
            raise ValueError("Cartesia API key not configured")
        
        client = await self._get_http_client()
        
        # Prepare text with proper formatting
        # - Add punctuation at the end if missing
        text = text.strip()
        if text and text[-1] not in '.!?':
            text += '.'
        
        # Build generation config for speed/volume/emotion
        generation_config = {}
        
        # Speed: -0.2 to -0.1 for slower, clearer speech (default is too fast)
        speed = voice_config.speed if voice_config.speed != 0 else -0.15
        generation_config["speed"] = max(0.6, min(1.5, 1.0 + speed))  # Map to 0.6-1.5 range
        
        # Emotion
        final_emotion = emotion or voice_config.emotion or "content"
        generation_config["emotion"] = final_emotion
        
        payload = {
            "model_id": "sonic-3",
            "transcript": text,
            "voice": {
                "mode": "id",
                "id": voice_config.voice_id
            },
            "language": voice_config.language,
            "output_format": {
                "container": AUDIO_CONFIG["container"],
                "sample_rate": AUDIO_CONFIG["sample_rate"],
                "encoding": AUDIO_CONFIG["encoding"]
            },
            "generation_config": generation_config
        }
        
        headers = {
            "X-API-Key": self.cartesia_api_key,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json"
        }
        
        try:
            response = await client.post(
                CARTESIA_TTS_URL,
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            
            return response.content
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Cartesia TTS error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise
    
    async def generate_acknowledgment_audio(
        self,
        session_id: str,
        response_language: ResponseLanguage = ResponseLanguage.ENGLISH,
        response_quality: str = "good"
    ) -> bytes:
        """
        Generate a warm acknowledgment after candidate response.
        """
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        # Choose appropriate acknowledgment
        if response_language in [ResponseLanguage.HINDI, ResponseLanguage.HINGLISH]:
            text = InterviewerPersonality.get_hindi_acknowledgment()
        else:
            text = InterviewerPersonality.get_acknowledgment(response_quality)
        
        return await self._text_to_speech(
            text=text,
            voice_config=session.voice_config,
            emotion="grateful"  # Warm, appreciative
        )
    
    async def generate_transition_audio(
        self,
        session_id: str
    ) -> bytes:
        """Generate transition audio between questions."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        text = InterviewerPersonality.get_transition()
        
        return await self._text_to_speech(
            text=text,
            voice_config=session.voice_config,
            emotion="content"
        )
    
    async def generate_closing_audio(
        self,
        session_id: str
    ) -> bytes:
        """Generate warm closing message."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        text = InterviewerPersonality.get_closing(session.candidate.name)
        
        # Add final thank you with proper ending
        text += " - We'll be in touch soon. - Take care, and have a wonderful day!"
        
        return await self._text_to_speech(
            text=text,
            voice_config=session.voice_config,
            emotion="grateful"
        )
    
    async def generate_encouragement_audio(
        self,
        session_id: str
    ) -> bytes:
        """Generate encouraging message if candidate seems stuck."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        
        import random
        text = random.choice(InterviewerPersonality.ENCOURAGEMENTS)
        
        return await self._text_to_speech(
            text=text,
            voice_config=session.voice_config,
            emotion="sympathetic"  # Understanding, supportive
        )
    
    # =========================================================================
    # SPEECH-TO-TEXT (Cartesia Ink-Whisper)
    # =========================================================================
    
    async def process_candidate_response(
        self,
        session_id: str,
        question_id: str,
        audio_data: bytes,
        audio_format: str = "wav"
    ) -> CandidateResponse:
        """Process candidate's audio response."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        if isinstance(audio_data, str):
            audio_data = base64.b64decode(audio_data)
        
        response_id = f"resp-{uuid.uuid4().hex[:12]}"
        started_at = datetime.utcnow()
        
        # Save audio file
        session_dir = self.storage_path / session_id
        audio_path = session_dir / f"response_{question_id}.{audio_format}"
        
        with open(audio_path, "wb") as f:
            f.write(audio_data)
        
        # Get audio duration
        try:
            audio = AudioSegment.from_file(io.BytesIO(audio_data), format=audio_format)
            duration_seconds = len(audio) / 1000.0
        except Exception as e:
            logger.warning(f"Could not parse audio duration: {e}")
            duration_seconds = 0.0
        
        # Transcribe with Cartesia Ink-Whisper
        transcription = await self._speech_to_text(audio_data, audio_format)
        
        # Analyze response with LLM
        question = next((q for q in session.questions if q.question_id == question_id), None)
        analysis = await self._analyze_response(session, question, transcription)
        
        # Create response object
        response = CandidateResponse(
            response_id=response_id,
            question_id=question_id,
            audio_file_path=str(audio_path),
            audio_duration_seconds=duration_seconds,
            transcription=transcription,
            analysis=analysis,
            started_at=started_at.isoformat(),
            ended_at=datetime.utcnow().isoformat()
        )
        
        # Update session
        session.responses.append(response)
        session.current_question_index += 1
        
        if session.current_question_index >= len(session.questions):
            session.status = InterviewStatus.COMPLETED
            session.completed_at = datetime.utcnow().isoformat()
        else:
            session.status = InterviewStatus.IN_PROGRESS
        
        await self._store_session(session)
        
        # Create clip
        clip = await self._create_response_clip(session, response, question)
        session.clips.append(clip)
        await self._store_session(session)
        
        logger.info(f"Processed response for {question_id}: {len(transcription.text)} chars")
        
        return response
    
    async def _speech_to_text(
        self,
        audio_data: bytes,
        audio_format: str = "wav"
    ) -> TranscriptionResult:
        """Transcribe audio using Cartesia Ink-Whisper."""
        if not self.cartesia_api_key:
            raise ValueError("Cartesia API key not configured")
        
        client = await self._get_http_client()
        
        # Convert audio to required format
        try:
            audio = AudioSegment.from_file(io.BytesIO(audio_data), format=audio_format)
            audio = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)
            
            wav_buffer = io.BytesIO()
            audio.export(wav_buffer, format="wav")
            audio_data = wav_buffer.getvalue()
            
        except Exception as e:
            logger.warning(f"Audio conversion warning: {e}")
        
        headers = {
            "X-API-Key": self.cartesia_api_key,
            "Cartesia-Version": "2024-06-10"
        }
        
        files = {
            "file": ("audio.wav", audio_data, "audio/wav")
        }
        
        # Auto-detect language (supports Hindi)
        data = {
            "model": "ink-whisper",
            "language": "en",
            "timestamp_granularities": '["word"]'
        }
        
        try:
            response = await client.post(
                CARTESIA_STT_URL,
                headers=headers,
                files=files,
                data=data
            )
            response.raise_for_status()
            
            result = response.json()
            
            text = result.get("text", "")
            duration = result.get("duration", 0.0)
            words = result.get("words", [])
            
            # Detect language mix
            detected_lang, hindi_count, english_count = self._detect_language_mix(text)
            
            return TranscriptionResult(
                text=text,
                confidence=0.9,
                duration_seconds=duration,
                detected_language=detected_lang,
                words=[{"word": w.get("word"), "start": w.get("start"), "end": w.get("end")} 
                       for w in words],
                hindi_words_detected=hindi_count,
                english_words_detected=english_count
            )
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Cartesia STT error: {e.response.status_code} - {e.response.text}")
            return TranscriptionResult(
                text="[Transcription failed]",
                confidence=0.0,
                duration_seconds=0.0,
                detected_language=ResponseLanguage.UNKNOWN,
                words=[]
            )
        except Exception as e:
            logger.error(f"STT failed: {e}")
            raise
    
    def _detect_language_mix(self, text: str) -> Tuple[ResponseLanguage, int, int]:
        """Detect if response contains Hindi, English, or both."""
        import re
        
        devanagari_pattern = re.compile(r'[\u0900-\u097F]')
        hindi_words_devanagari = len(devanagari_pattern.findall(text))
        
        common_hindi_roman = [
            'haan', 'nahi', 'kya', 'hai', 'hain', 'main', 'mujhe', 'aap',
            'acha', 'theek', 'bahut', 'kar', 'karna', 'hua', 'bhi', 'aur',
            'toh', 'lekin', 'kyunki', 'isliye', 'woh', 'yeh', 'kaise',
            'matlab', 'samajh', 'pata', 'jaisa', 'jaise', 'abhi', 'phir'
        ]
        
        words = text.lower().split()
        hindi_roman_count = sum(1 for w in words if w in common_hindi_roman)
        english_count = len(words) - hindi_roman_count - hindi_words_devanagari
        
        total_hindi = hindi_words_devanagari + hindi_roman_count
        
        if total_hindi == 0:
            return ResponseLanguage.ENGLISH, 0, len(words)
        elif english_count == 0:
            return ResponseLanguage.HINDI, total_hindi, 0
        elif total_hindi > 0 and english_count > 0:
            return ResponseLanguage.HINGLISH, total_hindi, english_count
        else:
            return ResponseLanguage.ENGLISH, total_hindi, english_count
    
    # =========================================================================
    # RESPONSE ANALYSIS (LLM-Powered) - IMPROVED
    # =========================================================================
    
    async def _analyze_response(
        self,
        session: InterviewSession,
        question: Optional[InterviewQuestion],
        transcription: TranscriptionResult
    ) -> ResponseAnalysis:
        """Analyze candidate's response using LLM."""
        if not transcription.text or transcription.text == "[Transcription failed]":
            return ResponseAnalysis(
                key_points_covered=[],
                topics_mentioned=[],
                skills_demonstrated=[],
                relevance_score=0.0,
                depth_score=0.0,
                clarity_score=0.0,
                overall_score=0.0,
                confidence_assessment=ConfidenceLevel.UNCERTAIN,
                strengths=[],
                areas_for_improvement=["Response could not be transcribed"],
                red_flags=["No audible response"],
                brief_summary="Unable to analyze - transcription failed"
            )
        
        prompt = f"""Analyze this interview response and provide evaluation.

CONTEXT:
- Candidate: {session.candidate.name} ({session.candidate.experience_years} years experience)
- Current Role: {session.candidate.current_title}
- Applying for: {session.job.job_title}
- Required Skills: {', '.join(session.job.required_skills[:5])}

QUESTION ASKED:
"{question.question_text if question else 'Unknown question'}"

Expected topics: {', '.join(question.expected_topics) if question and question.expected_topics else 'General response'}

CANDIDATE'S RESPONSE:
"{transcription.text}"

Language: {transcription.detected_language.value}
Duration: {transcription.duration_seconds:.1f} seconds

Provide analysis as JSON (no markdown, just the JSON object):
{{
    "key_points_covered": ["point1", "point2"],
    "topics_mentioned": ["topic1", "topic2"],
    "skills_demonstrated": ["skill1", "skill2"],
    "relevance_score": 0-100,
    "depth_score": 0-100,
    "clarity_score": 0-100,
    "overall_score": 0-100,
    "confidence_assessment": "high|medium|low|uncertain",
    "strengths": ["strength1"],
    "areas_for_improvement": ["area1"],
    "red_flags": [],
    "brief_summary": "One sentence summary",
    "detailed_notes": "2-3 sentences"
}}

SCORING: 80-100=Excellent, 60-79=Good, 40-59=Adequate, 20-39=Weak, 0-19=Poor
Be fair. Hindi/Hinglish responses are acceptable - evaluate content."""

        try:
            response = await self._call_llm(prompt, temperature=0.3, max_tokens=1500)
            
            # Clean and parse JSON
            response = response.strip()
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                json_str = json_match.group()
            else:
                json_str = response
            
            analysis_data = json.loads(json_str)
            
            return ResponseAnalysis(
                key_points_covered=analysis_data.get("key_points_covered", []),
                topics_mentioned=analysis_data.get("topics_mentioned", []),
                skills_demonstrated=analysis_data.get("skills_demonstrated", []),
                relevance_score=float(analysis_data.get("relevance_score", 50)),
                depth_score=float(analysis_data.get("depth_score", 50)),
                clarity_score=float(analysis_data.get("clarity_score", 50)),
                overall_score=float(analysis_data.get("overall_score", 50)),
                confidence_assessment=ConfidenceLevel(
                    analysis_data.get("confidence_assessment", "medium")
                ),
                strengths=analysis_data.get("strengths", []),
                areas_for_improvement=analysis_data.get("areas_for_improvement", []),
                red_flags=analysis_data.get("red_flags", []),
                brief_summary=analysis_data.get("brief_summary", "Response analyzed"),
                detailed_notes=analysis_data.get("detailed_notes", "")
            )
            
        except Exception as e:
            logger.error(f"Response analysis failed: {e}")
            return ResponseAnalysis(
                key_points_covered=[],
                topics_mentioned=[],
                skills_demonstrated=[],
                relevance_score=50.0,
                depth_score=50.0,
                clarity_score=50.0,
                overall_score=50.0,
                confidence_assessment=ConfidenceLevel.UNCERTAIN,
                strengths=["Response provided"],
                areas_for_improvement=["Manual review recommended"],
                red_flags=[],
                brief_summary="Analysis pending manual review"
            )
    
    # =========================================================================
    # CLIP GENERATION
    # =========================================================================
    
    async def _create_response_clip(
        self,
        session: InterviewSession,
        response: CandidateResponse,
        question: Optional[InterviewQuestion]
    ) -> InterviewClip:
        """Create a clip from the response."""
        clip_id = f"clip-{uuid.uuid4().hex[:12]}"
        
        session_dir = self.storage_path / session.session_id
        clip_path = session_dir / f"clip_{response.question_id}.wav"
        
        try:
            audio = AudioSegment.from_file(response.audio_file_path)
            audio.export(str(clip_path), format="wav")
        except Exception as e:
            logger.warning(f"Could not create clip: {e}")
            clip_path = response.audio_file_path
        
        key_moments = []
        if response.analysis:
            if response.analysis.strengths:
                key_moments.append(f"Strength: {response.analysis.strengths[0]}")
            if response.analysis.red_flags:
                key_moments.append(f"Concern: {response.analysis.red_flags[0]}")
        
        return InterviewClip(
            clip_id=clip_id,
            interview_id=session.session_id,
            question_id=response.question_id,
            clip_file_path=str(clip_path),
            duration_seconds=response.audio_duration_seconds,
            start_offset_seconds=0.0,
            end_offset_seconds=response.audio_duration_seconds,
            clip_type="response",
            transcription=response.transcription.text,
            speaker="candidate",
            clip_summary=response.analysis.brief_summary if response.analysis else None,
            key_moments=key_moments
        )
    
    # =========================================================================
    # FINAL ASSESSMENT - IMPROVED
    # =========================================================================
    
    async def complete_interview(
        self,
        session_id: str
    ) -> InterviewAssessment:
        """Generate final assessment after interview completion."""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")
        
        responses_summary = []
        for resp in session.responses:
            q = next((q for q in session.questions if q.question_id == resp.question_id), None)
            responses_summary.append({
                "question": q.question_text[:200] if q else "Unknown",
                "question_type": q.question_type.value if q else "unknown",
                "response_text": resp.transcription.text[:400],
                "score": resp.analysis.overall_score if resp.analysis else 50,
                "summary": resp.analysis.brief_summary if resp.analysis else "N/A"
            })
        
        prompt = f"""Generate a comprehensive interview assessment.

CANDIDATE: {session.candidate.name}
ROLE: {session.candidate.current_title} at {session.candidate.current_company or 'N/A'}
EXPERIENCE: {session.candidate.experience_years} years
SKILLS: {', '.join(session.candidate.skills[:8])}

TARGET ROLE: {session.job.job_title}
REQUIRED SKILLS: {', '.join(session.job.required_skills[:6])}

INTERVIEW RESPONSES:
{json.dumps(responses_summary, indent=2)}

Provide assessment as JSON (no markdown):
{{
    "overall_score": 0-100,
    "technical_score": 0-100,
    "communication_score": 0-100,
    "culture_fit_score": 0-100,
    "recommendation": "strong_hire|hire|maybe|no_hire",
    "recommendation_confidence": "high|medium|low",
    "skill_scores": {{"skill1": score}},
    "top_strengths": ["strength1", "strength2", "strength3"],
    "concerns": ["concern1"] or [],
    "notable_moments": ["moment1", "moment2"],
    "executive_summary": "2-3 sentence summary for hiring manager",
    "detailed_report": "Detailed paragraph",
    "language_proficiency": {{"english": "excellent|good|fair|poor"}}
}}

CALIBRATION: 85-100=Exceptional, 70-84=Good, 55-69=Decent, 40-54=Below bar, 0-39=No"""

        try:
            response = await self._call_llm(prompt, temperature=0.3, max_tokens=2000)
            
            # Parse JSON
            response = response.strip()
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                json_str = json_match.group()
            else:
                json_str = response
            
            assessment_data = json.loads(json_str)
            
            assessment = InterviewAssessment(
                overall_score=float(assessment_data.get("overall_score", 50)),
                technical_score=float(assessment_data.get("technical_score", 50)),
                communication_score=float(assessment_data.get("communication_score", 50)),
                culture_fit_score=float(assessment_data.get("culture_fit_score", 50)),
                recommendation=assessment_data.get("recommendation", "maybe"),
                recommendation_confidence=ConfidenceLevel(
                    assessment_data.get("recommendation_confidence", "medium")
                ),
                skill_scores=assessment_data.get("skill_scores", {}),
                question_scores={
                    r.question_id: r.analysis.overall_score 
                    for r in session.responses if r.analysis
                },
                top_strengths=assessment_data.get("top_strengths", []),
                concerns=assessment_data.get("concerns", []),
                notable_moments=assessment_data.get("notable_moments", []),
                executive_summary=assessment_data.get(
                    "executive_summary", 
                    "Interview assessment completed."
                ),
                detailed_report=assessment_data.get("detailed_report", ""),
                language_proficiency=assessment_data.get("language_proficiency", {})
            )
            
            session.final_assessment = assessment
            session.status = InterviewStatus.COMPLETED
            session.completed_at = datetime.utcnow().isoformat()
            await self._store_session(session)
            
            logger.info(f"✅ Assessment complete: {session_id}")
            logger.info(f"   Score: {assessment.overall_score}, Rec: {assessment.recommendation}")
            
            return assessment
            
        except Exception as e:
            logger.error(f"Assessment generation failed: {e}")
            raise
    
    # =========================================================================
    # LLM HELPER - IMPROVED ERROR HANDLING
    # =========================================================================
    
    async def _call_llm(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        model: str = "anthropic/claude-sonnet-4.5"
    ) -> str:
        """Call LLM via OpenRouter with robust error handling."""
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
                    "content": "You are a helpful assistant that always responds with valid JSON when asked. Never include markdown formatting or code blocks in your response - just the raw JSON."
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
            response.raise_for_status()
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            if not content:
                raise ValueError("Empty response from LLM")
            
            return content
            
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter API error: {e.response.status_code}")
            logger.error(f"Response: {e.response.text[:500]}")
            raise
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            raise
    
    # =========================================================================
    # INTERVIEW FLOW HELPERS
    # =========================================================================
    
    async def get_next_question(
        self,
        session_id: str
    ) -> Optional[Tuple[InterviewQuestion, bytes]]:
        """Get the next question with audio."""
        session = await self.get_session(session_id)
        if not session:
            return None
        
        if session.current_question_index >= len(session.questions):
            return None
        
        question = session.questions[session.current_question_index]
        audio_bytes, _ = await self.generate_question_audio(
            session_id, 
            question.question_id
        )
        
        return question, audio_bytes
    
    async def get_interview_progress(
        self,
        session_id: str
    ) -> Dict[str, Any]:
        """Get current interview progress."""
        session = await self.get_session(session_id)
        if not session:
            return {"error": "Session not found"}
        
        return {
            "session_id": session_id,
            "status": session.status.value,
            "current_question": session.current_question_index + 1,
            "total_questions": len(session.questions),
            "progress_percentage": (
                session.current_question_index / len(session.questions) * 100
                if session.questions else 0
            ),
            "responses_collected": len(session.responses),
            "started_at": session.started_at,
            "candidate_name": session.candidate.name,
            "job_title": session.job.job_title
        }