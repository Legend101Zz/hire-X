#!/usr/bin/env python3
"""
Interactive Voice Interview V2 - Live Demo
===========================================
Run a REAL voice interview where YOU are the candidate!

V2 IMPROVEMENTS:
- Slower, more natural speech
- Warm acknowledgments after each response
- Better audio handling
- Proper interview flow with pauses
- Fixed JSON parsing issues

Usage:
    export CARTESIA_API_KEY="your-key"
    export OPENROUTER_API_KEY="your-key"
    python tests/interactive_voice_interview_v2.py

Author: Hire-X Engineering
"""

import asyncio
import io
import os
import struct
import sys
import time
import wave
from datetime import datetime
from pathlib import Path
from typing import Optional

# Audio libraries
try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    print("⚠️  pyaudio not installed. Install with: pip install pyaudio")

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.voice_interview_models import (CandidateContext,
                                           CartesiaVoiceConfig,
                                           InterviewStatus, JobContext,
                                           ResponseLanguage)
from services.voice_interview_service import (VOICE_PRESETS,
                                              VoiceInterviewService)

# ============================================================================
# CONFIGURATION
# ============================================================================

SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 1024
SILENCE_THRESHOLD = 400
SILENCE_DURATION = 2.0  # Seconds of silence to stop


# ============================================================================
# COLORS
# ============================================================================

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


# ============================================================================
# AUDIO UTILITIES
# ============================================================================

class AudioPlayer:
    """Play audio through speakers."""
    
    def __init__(self):
        if PYAUDIO_AVAILABLE:
            self.pyaudio = pyaudio.PyAudio()
        else:
            self.pyaudio = None
    
    def play_wav_bytes(self, audio_bytes: bytes, blocking: bool = True):
        """Play WAV audio from bytes."""
        if not PYAUDIO_AVAILABLE or not self.pyaudio:
            print(f"{Colors.YELLOW}⚠️  Cannot play audio - pyaudio not installed{Colors.ENDC}")
            return
        
        try:
            wav_io = io.BytesIO(audio_bytes)
            with wave.open(wav_io, 'rb') as wf:
                stream = self.pyaudio.open(
                    format=self.pyaudio.get_format_from_width(wf.getsampwidth()),
                    channels=wf.getnchannels(),
                    rate=wf.getframerate(),
                    output=True
                )
                
                data = wf.readframes(CHUNK_SIZE)
                while data:
                    stream.write(data)
                    data = wf.readframes(CHUNK_SIZE)
                
                stream.stop_stream()
                stream.close()
                
        except Exception as e:
            print(f"{Colors.RED}Error playing audio: {e}{Colors.ENDC}")
    
    def close(self):
        if self.pyaudio:
            self.pyaudio.terminate()


class AudioRecorder:
    """Record audio from microphone with silence detection."""
    
    def __init__(self):
        if PYAUDIO_AVAILABLE:
            self.pyaudio = pyaudio.PyAudio()
        else:
            self.pyaudio = None
        self.frames = []
    
    def record_with_silence_detection(
        self,
        max_seconds: int = 180,
        silence_threshold: int = SILENCE_THRESHOLD,
        silence_duration: float = SILENCE_DURATION,
        min_speech_duration: float = 1.0
    ) -> bytes:
        """Record audio until silence is detected."""
        if not PYAUDIO_AVAILABLE or not self.pyaudio:
            print(f"{Colors.YELLOW}⚠️  Cannot record - pyaudio not installed{Colors.ENDC}")
            return self._get_empty_wav()
        
        print(f"\n{Colors.GREEN}🎤 Recording... (speak now){Colors.ENDC}")
        print(f"   Recording will stop after {silence_duration}s of silence")
        print(f"   Max duration: {max_seconds}s\n")
        
        self.frames = []
        
        try:
            stream = self.pyaudio.open(
                format=pyaudio.paInt16,
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE
            )
            
            silent_chunks = 0
            chunks_for_silence = int(SAMPLE_RATE / CHUNK_SIZE * silence_duration)
            max_chunks = int(SAMPLE_RATE / CHUNK_SIZE * max_seconds)
            min_speech_chunks = int(SAMPLE_RATE / CHUNK_SIZE * min_speech_duration)
            
            start_time = time.time()
            has_speech = False
            speech_chunks = 0
            
            for i in range(max_chunks):
                data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                self.frames.append(data)
                
                amplitude = self._get_amplitude(data)
                
                # Visual feedback - audio level meter
                level = min(int(amplitude / 80), 40)
                bar = "▓" * level + "░" * (40 - level)
                elapsed = time.time() - start_time
                status = "🔴 Recording" if amplitude > silence_threshold else "⏸️  Silence"
                print(f"\r   [{bar}] {elapsed:.1f}s {status}   ", end="", flush=True)
                
                if amplitude > silence_threshold:
                    silent_chunks = 0
                    has_speech = True
                    speech_chunks += 1
                else:
                    silent_chunks += 1
                    # Only stop if we've had meaningful speech first
                    if has_speech and speech_chunks >= min_speech_chunks and silent_chunks >= chunks_for_silence:
                        print(f"\n{Colors.CYAN}   ⏹️  Silence detected - stopping{Colors.ENDC}")
                        break
            
            stream.stop_stream()
            stream.close()
            
            duration = len(self.frames) * CHUNK_SIZE / SAMPLE_RATE
            print(f"\n{Colors.GREEN}   ✅ Recorded {duration:.1f} seconds{Colors.ENDC}")
            
            return self._frames_to_wav()
            
        except Exception as e:
            print(f"\n{Colors.RED}Error recording: {e}{Colors.ENDC}")
            return self._get_empty_wav()
    
    def _get_amplitude(self, data: bytes) -> int:
        """Calculate amplitude of audio chunk."""
        count = len(data) // 2
        shorts = struct.unpack(f'{count}h', data)
        return int(sum(abs(s) for s in shorts) / count) if count > 0 else 0
    
    def _frames_to_wav(self) -> bytes:
        """Convert frames to WAV bytes."""
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(b''.join(self.frames))
        return wav_io.getvalue()
    
    def _get_empty_wav(self) -> bytes:
        """Return empty WAV file."""
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(b'\x00\x00' * SAMPLE_RATE)
        return wav_io.getvalue()
    
    def close(self):
        if self.pyaudio:
            self.pyaudio.terminate()


# ============================================================================
# INTERACTIVE INTERVIEW V2
# ============================================================================

class InteractiveInterviewV2:
    """Run an interactive voice interview with warm, engaging AI."""
    
    def __init__(self):
        self.service: Optional[VoiceInterviewService] = None
        self.player: Optional[AudioPlayer] = None
        self.recorder: Optional[AudioRecorder] = None
        self.session_id: Optional[str] = None
    
    async def setup(self):
        """Initialize components."""
        print(f"\n{Colors.CYAN}🔧 Setting up interview system...{Colors.ENDC}")
        
        self.service = VoiceInterviewService(storage_path="./interview_recordings_v2")
        self.player = AudioPlayer()
        self.recorder = AudioRecorder()
        
        print(f"{Colors.GREEN}✅ Setup complete!{Colors.ENDC}")
    
    async def cleanup(self):
        """Clean up resources."""
        if self.service:
            await self.service.close()
        if self.player:
            self.player.close()
        if self.recorder:
            self.recorder.close()
    
    def print_banner(self):
        """Print welcome banner."""
        print(f"""
{Colors.HEADER}╔═══════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║           🎙️  Hire-X Interactive Voice Interview V2  🎙️               ║
║                                                                           ║
║   • The AI interviewer speaks naturally with pauses and warmth            ║
║   • Respond in English, Hindi, or Hinglish - all are welcome!            ║
║   • Take your time - the interviewer will wait for you                    ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝{Colors.ENDC}
""")
    
    def get_candidate_info(self) -> CandidateContext:
        """Get candidate information."""
        print(f"\n{Colors.CYAN}📝 Let's get to know you{Colors.ENDC}")
        print(f"   (Press Enter to use default values)\n")
        
        name = input(f"   Your name [{Colors.YELLOW}Rahul Sharma{Colors.ENDC}]: ").strip() or "Rahul Sharma"
        title = input(f"   Current title [{Colors.YELLOW}Senior Software Engineer{Colors.ENDC}]: ").strip() or "Senior Software Engineer"
        company = input(f"   Current company [{Colors.YELLOW}Tech Corp{Colors.ENDC}]: ").strip() or "Tech Corp"
        
        exp_str = input(f"   Years of experience [{Colors.YELLOW}5{Colors.ENDC}]: ").strip()
        experience = int(exp_str) if exp_str.isdigit() else 5
        
        skills_str = input(f"   Key skills [{Colors.YELLOW}Python, FastAPI, MongoDB{Colors.ENDC}]: ").strip()
        skills = [s.strip() for s in skills_str.split(",")] if skills_str else ["Python", "FastAPI", "MongoDB", "Docker", "AWS"]
        
        return CandidateContext(
            candidate_id="interactive-candidate-v2",
            name=name,
            current_title=title,
            current_company=company,
            experience_years=experience,
            skills=skills,
            location="India"
        )
    
    def get_job_context(self) -> JobContext:
        """Get job context."""
        return JobContext(
            job_title="Senior Python Developer",
            company_name="Hire-X",
            required_skills=["Python", "FastAPI", "MongoDB", "Docker"],
            nice_to_have_skills=["AWS", "Kubernetes", "React"],
            experience_required="4+ years",
            key_responsibilities=[
                "Design scalable backend services",
                "Work with large-scale data",
                "Integrate AI/ML services",
                "Mentor junior developers"
            ],
            evaluation_criteria=[
                "Technical expertise",
                "Problem-solving",
                "Communication skills",
                "Cultural fit"
            ]
        )
    
    def select_voice(self) -> CartesiaVoiceConfig:
        """Select interviewer voice with proper speed settings."""
        print(f"\n{Colors.CYAN}🗣️  Select Interviewer Voice:{Colors.ENDC}")
        print(f"   [1] Katie - Professional Female (Recommended)")
        print(f"   [2] Kiefer - Professional Male")
        print(f"   [3] Tessa - Expressive Female")
        print(f"   [4] Kyle - Expressive Male")
        
        choice = input(f"\n   Your choice [{Colors.YELLOW}1{Colors.ENDC}]: ").strip() or "1"
        
        voice_map = {
            "1": ("professional_female", "content"),
            "2": ("professional_male", "content"),
            "3": ("emotive_female", "enthusiastic"),
            "4": ("emotive_male", "enthusiastic")
        }
        
        voice_key, default_emotion = voice_map.get(choice, ("professional_female", "content"))
        voice = VOICE_PRESETS[voice_key]
        
        print(f"   Selected: {Colors.GREEN}{voice['name']}{Colors.ENDC}")
        
        return CartesiaVoiceConfig(
            voice_id=voice["id"],
            voice_name=voice["name"],
            language="en",
            speed=-0.15,  # Slower for clarity
            emotion=default_emotion,
            emotion_level="medium"
        )
    
    def select_num_questions(self) -> int:
        """Select number of questions."""
        print(f"\n{Colors.CYAN}❓ Interview Length:{Colors.ENDC}")
        print(f"   [1] Quick (3 questions) - ~5 minutes")
        print(f"   [2] Standard (5 questions) - ~12 minutes")
        print(f"   [3] Full (8 questions) - ~20 minutes")
        
        choice = input(f"\n   Your choice [{Colors.YELLOW}2{Colors.ENDC}]: ").strip() or "2"
        return {"1": 3, "2": 5, "3": 8}.get(choice, 5)
    
    async def run_interview(self):
        """Run the interactive interview."""
        self.print_banner()
        
        # Check API keys
        if not os.getenv("CARTESIA_API_KEY"):
            print(f"{Colors.RED}❌ CARTESIA_API_KEY not set!{Colors.ENDC}")
            print(f"   export CARTESIA_API_KEY='your-key'")
            return
        
        if not os.getenv("OPENROUTER_API_KEY"):
            print(f"{Colors.YELLOW}⚠️  OPENROUTER_API_KEY not set - will use fallback questions{Colors.ENDC}")
        
        await self.setup()
        
        try:
            # Configuration
            candidate = self.get_candidate_info()
            job = self.get_job_context()
            voice_config = self.select_voice()
            num_questions = self.select_num_questions()
            
            # Summary
            print(f"\n{Colors.HEADER}{'═'*65}{Colors.ENDC}")
            print(f"{Colors.BOLD}   Interview Configuration{Colors.ENDC}")
            print(f"   Candidate: {candidate.name}")
            print(f"   Position: {job.job_title} at {job.company_name}")
            print(f"   Questions: {num_questions}")
            print(f"   Voice: {voice_config.voice_name}")
            print(f"{Colors.HEADER}{'═'*65}{Colors.ENDC}")
            
            input(f"\n{Colors.GREEN}   Press Enter to start the interview...{Colors.ENDC}")
            
            # Create session
            print(f"\n{Colors.CYAN}🚀 Preparing your interview...{Colors.ENDC}")
            
            session = await self.service.create_interview(
                candidate=candidate,
                job=job,
                voice_config=voice_config,
                max_questions=num_questions
            )
            
            self.session_id = session.session_id
            print(f"   Session: {session.session_id}")
            print(f"   Questions ready: {len(session.questions)}")
            
            # Start interview
            print(f"\n{Colors.HEADER}{'═'*65}")
            print(f"           🎬 INTERVIEW BEGINS")
            print(f"{'═'*65}{Colors.ENDC}\n")
            
            await asyncio.sleep(1)  # Brief pause before starting
            
            for i, question in enumerate(session.questions):
                print(f"\n{Colors.BLUE}{'─'*65}{Colors.ENDC}")
                print(f"{Colors.BOLD}   Question {i+1} of {len(session.questions)}{Colors.ENDC} [{question.question_type.value}]")
                print(f"{Colors.BLUE}{'─'*65}{Colors.ENDC}")
                
                # Show question text
                print(f"\n{Colors.CYAN}🔊 Interviewer:{Colors.ENDC}")
                # Clean up the display text (remove pause markers)
                display_text = question.question_text.replace(" - ", " ").replace("  ", " ")
                print(f"   \"{display_text}\"\n")
                
                # Play question audio
                try:
                    print(f"   {Colors.YELLOW}[Playing audio...]{Colors.ENDC}")
                    audio_bytes, _ = await self.service.generate_question_audio(
                        session.session_id,
                        question.question_id
                    )
                    self.player.play_wav_bytes(audio_bytes)
                    print(f"   {Colors.GREEN}[Audio complete]{Colors.ENDC}")
                except Exception as e:
                    print(f"   {Colors.YELLOW}[Audio unavailable: {e}]{Colors.ENDC}")
                
                # Brief pause
                await asyncio.sleep(0.5)
                
                # Prompt for response
                print(f"\n{Colors.GREEN}   Your turn to respond!{Colors.ENDC}")
                action = input(f"   [Enter] to record | [s] to skip | [t] to type response: ").strip().lower()
                
                if action == 's':
                    print(f"   {Colors.YELLOW}Skipping...{Colors.ENDC}")
                    continue
                
                # Get response
                if action == 't':
                    # Type response
                    print(f"\n   Type your response (press Enter twice when done):")
                    lines = []
                    while True:
                        line = input("   ")
                        if line == "":
                            if lines:
                                break
                        else:
                            lines.append(line)
                    response_text = " ".join(lines)
                    response_audio = self._text_to_fake_audio(response_text)
                else:
                    # Record response
                    response_audio = self.recorder.record_with_silence_detection(
                        max_seconds=180,
                        silence_threshold=SILENCE_THRESHOLD,
                        silence_duration=SILENCE_DURATION,
                        min_speech_duration=1.5  # At least 1.5s of speech
                    )
                
                # Process response
                print(f"\n{Colors.CYAN}   Processing your response...{Colors.ENDC}")
                
                try:
                    response = await self.service.process_candidate_response(
                        session.session_id,
                        question.question_id,
                        response_audio,
                        "wav"
                    )
                    
                    # Show transcription
                    print(f"\n{Colors.GREEN}   📝 Transcription:{Colors.ENDC}")
                    text = response.transcription.text
                    if len(text) > 300:
                        print(f"   {text[:300]}...")
                    else:
                        print(f"   {text}")
                    
                    if response.transcription.detected_language != ResponseLanguage.ENGLISH:
                        lang_name = {
                            ResponseLanguage.HINDI: "Hindi",
                            ResponseLanguage.HINGLISH: "Hinglish (Hindi-English mix)"
                        }.get(response.transcription.detected_language, "Unknown")
                        print(f"   {Colors.CYAN}(Language detected: {lang_name}){Colors.ENDC}")
                    
                    # Show quick analysis
                    if response.analysis:
                        score = response.analysis.overall_score
                        score_color = Colors.GREEN if score >= 70 else (Colors.YELLOW if score >= 50 else Colors.RED)
                        print(f"\n{Colors.CYAN}   📊 Quick Analysis:{Colors.ENDC}")
                        print(f"   Score: {score_color}{score:.0f}/100{Colors.ENDC}")
                        print(f"   {response.analysis.brief_summary}")
                    
                    # Play acknowledgment (if not last question)
                    if i < len(session.questions) - 1:
                        try:
                            print(f"\n   {Colors.YELLOW}[Interviewer responding...]{Colors.ENDC}")
                            ack_audio = await self.service.generate_acknowledgment_audio(
                                session.session_id,
                                response.transcription.detected_language
                            )
                            self.player.play_wav_bytes(ack_audio)
                        except Exception:
                            pass
                        
                        await asyncio.sleep(0.5)
                    
                except Exception as e:
                    print(f"   {Colors.RED}Error: {e}{Colors.ENDC}")
            
            # Interview complete
            print(f"\n{Colors.HEADER}{'═'*65}")
            print(f"           🎬 INTERVIEW COMPLETE")
            print(f"{'═'*65}{Colors.ENDC}")
            
            # Play closing
            try:
                print(f"\n{Colors.CYAN}🔊 Interviewer (closing):{Colors.ENDC}")
                closing_audio = await self.service.generate_closing_audio(session.session_id)
                self.player.play_wav_bytes(closing_audio)
            except Exception:
                pass
            
            # Generate assessment
            print(f"\n{Colors.CYAN}📋 Generating your assessment...{Colors.ENDC}")
            
            try:
                assessment = await self.service.complete_interview(session.session_id)
                
                print(f"\n{Colors.HEADER}{'═'*65}")
                print(f"           📊 INTERVIEW ASSESSMENT")
                print(f"{'═'*65}{Colors.ENDC}")
                
                print(f"\n{Colors.BOLD}   Scores:{Colors.ENDC}")
                print(f"   Overall:        {self._score_bar(assessment.overall_score)}")
                print(f"   Technical:      {self._score_bar(assessment.technical_score)}")
                print(f"   Communication:  {self._score_bar(assessment.communication_score)}")
                print(f"   Culture Fit:    {self._score_bar(assessment.culture_fit_score)}")
                
                rec_colors = {
                    "strong_hire": Colors.GREEN,
                    "hire": Colors.GREEN,
                    "maybe": Colors.YELLOW,
                    "no_hire": Colors.RED
                }
                rec_color = rec_colors.get(assessment.recommendation, Colors.ENDC)
                
                print(f"\n{Colors.BOLD}   Recommendation:{Colors.ENDC} {rec_color}{assessment.recommendation.upper().replace('_', ' ')}{Colors.ENDC}")
                print(f"   Confidence: {assessment.recommendation_confidence.value}")
                
                if assessment.top_strengths:
                    print(f"\n{Colors.BOLD}   Top Strengths:{Colors.ENDC}")
                    for s in assessment.top_strengths[:3]:
                        print(f"   ✓ {s}")
                
                if assessment.concerns:
                    print(f"\n{Colors.BOLD}   Areas for Improvement:{Colors.ENDC}")
                    for c in assessment.concerns[:3]:
                        print(f"   △ {c}")
                
                print(f"\n{Colors.BOLD}   Summary:{Colors.ENDC}")
                print(f"   {assessment.executive_summary}")
                
            except Exception as e:
                print(f"   {Colors.RED}Error generating assessment: {e}{Colors.ENDC}")
            
            # Session info
            print(f"\n{Colors.CYAN}{'─'*65}{Colors.ENDC}")
            print(f"   Session ID: {session.session_id}")
            print(f"   Recordings: ./interview_recordings_v2/{session.session_id}/")
            print(f"{Colors.CYAN}{'─'*65}{Colors.ENDC}")
            
        except KeyboardInterrupt:
            print(f"\n\n{Colors.YELLOW}Interview interrupted.{Colors.ENDC}")
        except Exception as e:
            print(f"\n{Colors.RED}Error: {e}{Colors.ENDC}")
            import traceback
            traceback.print_exc()
        finally:
            await self.cleanup()
    
    def _score_bar(self, score: float) -> str:
        """Create visual score bar."""
        filled = int(score / 5)
        empty = 20 - filled
        
        if score >= 70:
            color = Colors.GREEN
        elif score >= 50:
            color = Colors.YELLOW
        else:
            color = Colors.RED
        
        return f"{color}{'█' * filled}{'░' * empty}{Colors.ENDC} {score:.0f}/100"
    
    def _text_to_fake_audio(self, text: str) -> bytes:
        """Create fake audio for typed responses."""
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(b'\x00\x00' * 16000)
        return wav_io.getvalue()


# ============================================================================
# MAIN
# ============================================================================

async def main():
    """Main entry point."""
    print(f"""
{Colors.HEADER}Select Mode:{Colors.ENDC}

   [1] 🎙️  Full Voice Interview (microphone + speakers)
   [2] 🔧 Test Audio Setup
   [3] ❌ Exit

""")
    
    choice = input(f"Your choice [{Colors.YELLOW}1{Colors.ENDC}]: ").strip() or "1"
    
    if choice == "2":
        await test_audio()
    elif choice == "3":
        print("Goodbye!")
    else:
        interview = InteractiveInterviewV2()
        await interview.run_interview()


async def test_audio():
    """Test audio setup."""
    print(f"\n{Colors.CYAN}🔧 Testing Audio{Colors.ENDC}\n")
    
    if not PYAUDIO_AVAILABLE:
        print(f"{Colors.RED}❌ pyaudio not installed{Colors.ENDC}")
        print(f"   pip install pyaudio")
        print(f"   # On Ubuntu: sudo apt-get install python3-pyaudio")
        print(f"   # On macOS: brew install portaudio && pip install pyaudio")
        return
    
    recorder = AudioRecorder()
    player = AudioPlayer()
    
    print(f"Recording 3 seconds - say something!")
    
    audio = recorder.record_with_silence_detection(max_seconds=3, silence_duration=1.0)
    
    print(f"\nPlaying back...")
    player.play_wav_bytes(audio)
    
    print(f"\n{Colors.GREEN}✅ Audio working!{Colors.ENDC}")
    
    recorder.close()
    player.close()


if __name__ == "__main__":
    asyncio.run(main())