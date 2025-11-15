"""
Conversation Prompts
===================
Centralized prompt templates for Donna's personality.

Donna is a helpful, friendly AI assistant who helps recruiters
build ideal candidate profiles through conversation.

Her personality:
- Warm and professional
- Asks one question at a time
- Keeps it brief and purposeful
- Visual-first (not chatty)
- Celebrates progress
"""

from typing import Dict, List

from models.conversation_models import IdealProfileCard


class ConversationPrompts:
    """
    Prompt templates for Donna's conversational interface.
    """
    
    # ================================================================
    # DONNA'S PERSONALITY
    # ================================================================
    
    SYSTEM_PROMPT = """You are Donna, a helpful AI assistant for recruiters in India.

YOUR ROLE:
You help recruiters build an "Ideal Candidate Profile" through conversation.
You ask ONE question at a time to understand what they're looking for.

YOUR PERSONALITY:
- Warm, professional, and efficient
- Brief and purposeful (NOT chatty)
- Visual-first approach
- Celebrate progress with small affirmations
- Use 1-2 emojis max per message
- NO excessive enthusiasm or verbosity

YOUR APPROACH:
1. Ask ONE focused question at a time
2. Listen carefully to their answer
3. Update the profile card
4. Show sample profiles when appropriate
5. Move to next stage when ready

CONTEXT:
- You're working with the INDIAN job market
- Focus on technical roles (developers, engineers, etc.)
- Most companies are startups to mid-size
- Locations matter (Bangalore, Mumbai, Gurgaon, etc.)

CRITICAL RULES:
- NEVER overwhelm with multiple questions
- NEVER be overly verbose or chatty
- NEVER repeat yourself
- ALWAYS keep responses under 3 sentences
- ALWAYS suggest quick reply options when appropriate
"""

    # ================================================================
    # GREETING STAGE
    # ================================================================
    
    @staticmethod
    def get_greeting_with_jd() -> str:
        """Greeting when JD is uploaded."""
        return """Perfect! I've analyzed your JD. Let me show you what I found. 

Does this match what you're looking for?"""
    
    @staticmethod
    def get_greeting_without_jd() -> str:
        """Greeting when starting fresh."""
        return """Hi! Let's find your ideal candidate. 

What role are you hiring for?"""
    
    # ================================================================
    # SKILLS STAGE
    # ================================================================
    
    @staticmethod
    def ask_about_must_have_skills(role: str) -> str:
        """Ask about must-have skills."""
        return f"""Got it - {role}! What are the must-have skills?

(I'm thinking things like React, Python, etc.)"""
    
    @staticmethod
    def ask_about_nice_to_have_skills() -> str:
        """Ask about nice-to-have skills."""
        return """Perfect! Any nice-to-have skills?

(Optional, but helps find better matches)"""
    
    @staticmethod
    def confirm_skills_and_move_on() -> str:
        """Confirm skills and transition."""
        return """Love it! ✓

Now, what experience level are we looking for?"""
    
    # ================================================================
    # EXPERIENCE STAGE
    # ================================================================
    
    @staticmethod
    def ask_about_seniority() -> str:
        """Ask about seniority level."""
        return """What seniority level?"""
    
    @staticmethod
    def ask_about_experience_years() -> str:
        """Ask about years of experience."""
        return """And how many years of experience?"""
    
    @staticmethod
    def confirm_experience_and_move_on() -> str:
        """Confirm experience and transition."""
        return """Got it! ✓

Any industry preferences?"""
    
    # ================================================================
    # PREFERENCES STAGE
    # ================================================================
    
    @staticmethod
    def ask_about_industries() -> str:
        """Ask about target industries."""
        return """What industries should they come from?"""
    
    @staticmethod
    def ask_about_locations() -> str:
        """Ask about location preferences."""
        return """And locations? (Or remote-friendly?)"""
    
    @staticmethod
    def ask_about_company_size() -> str:
        """Ask about company size."""
        return """Company size preferences?"""
    
    # ================================================================
    # REVIEW STAGE
    # ================================================================
    
    @staticmethod
    def show_summary_for_review(profile: IdealProfileCard) -> str:
        """Show summary for review."""
        
        skills = ", ".join(profile.must_have_skills[:3])
        if len(profile.must_have_skills) > 3:
            skills += f" (+{len(profile.must_have_skills) - 3} more)"
        
        return f"""Here's what we're looking for:

**{profile.role_title}**
**Skills:** {skills}
**Experience:** {profile.seniority} ({profile.experience_years} years)

Want to see a sample candidate?"""
    
    # ================================================================
    # SAMPLE PROFILE PRESENTATION
    # ================================================================
    
    @staticmethod
    def present_sample_profile() -> str:
        """Present sample profile to user."""
        return """Here's someone from our database who matches:

If we find candidates like this, would that work?"""
    
    @staticmethod
    def sample_approved() -> str:
        """User approved sample."""
        return """Perfect! Let me search for more candidates like this. 🎯"""
    
    @staticmethod
    def sample_rejected_ask_why() -> str:
        """Sample rejected, ask for feedback."""
        return """No problem! What would you like to adjust?"""
    
    # ================================================================
    # CLARIFICATION & ERROR HANDLING
    # ================================================================
    
    @staticmethod
    def ask_for_clarification(field: str) -> str:
        """Ask user to clarify."""
        return f"""Could you clarify the {field}?

(Example would help!)"""
    
    @staticmethod
    def handle_ambiguous_input() -> str:
        """Handle unclear input."""
        return """I didn't quite catch that. Could you rephrase?"""
    
    @staticmethod
    def acknowledge_and_continue() -> str:
        """Simple acknowledgment."""
        return """Got it! ✓"""
    
    # ================================================================
    # SUGGESTIONS (QUICK REPLIES)
    # ================================================================
    
    @staticmethod
    def get_role_suggestions() -> List[str]:
        """Common role suggestions."""
        return [
            "Senior React Developer",
            "Backend Engineer",
            "Full Stack Developer",
            "DevOps Engineer",
            "Product Manager"
        ]
    
    @staticmethod
    def get_seniority_suggestions() -> List[str]:
        """Seniority level suggestions."""
        return [
            "Junior (0-2 years)",
            "Mid-level (3-5 years)",
            "Senior (5-8 years)",
            "Lead (8+ years)"
        ]
    
    @staticmethod
    def get_location_suggestions() -> List[str]:
        """Location suggestions."""
        return [
            "Bangalore",
            "Mumbai",
            "Gurgaon",
            "Pune",
            "Remote-friendly"
        ]
    
    @staticmethod
    def get_industry_suggestions() -> List[str]:
        """Industry suggestions."""
        return [
            "Technology",
            "Fintech",
            "E-commerce",
            "SaaS",
            "Any industry"
        ]
    
    @staticmethod
    def get_company_size_suggestions() -> List[str]:
        """Company size suggestions."""
        return [
            "Startup (1-50)",
            "Mid-size (50-500)",
            "Large (500+)",
            "Any size"
        ]
    
    # ================================================================
    # CONTEXT-AWARE PROMPTS
    # ================================================================
    
    @staticmethod
    def generate_contextual_question(
        stage: str,
        profile: IdealProfileCard,
        turn_count: int
    ) -> str:
        """
        Generate contextual question based on what we know.
        
        This is used when we need Donna to ask something smart
        based on the current state of the profile.
        """
        
        if stage == "greeting":
            return ConversationPrompts.get_greeting_without_jd()
        
        elif stage == "skills":
            if not profile.role_title:
                return "What role are you hiring for?"
            elif not profile.must_have_skills:
                return ConversationPrompts.ask_about_must_have_skills(profile.role_title)
            else:
                return ConversationPrompts.ask_about_nice_to_have_skills()
        
        elif stage == "experience":
            if not profile.seniority:
                return ConversationPrompts.ask_about_seniority()
            elif not profile.experience_years:
                return ConversationPrompts.ask_about_experience_years()
            else:
                return ConversationPrompts.confirm_experience_and_move_on()
        
        elif stage == "preferences":
            if not profile.industries:
                return ConversationPrompts.ask_about_industries()
            elif not profile.locations:
                return ConversationPrompts.ask_about_locations()
            else:
                return "Anything else I should know?"
        
        elif stage == "review":
            return ConversationPrompts.show_summary_for_review(profile)
        
        elif stage == "ready":
            return "Ready to search! Should I find candidates?"
        
        else:
            return "What would you like to do next?"
    
    # ================================================================
    # LLM SYSTEM PROMPTS (FOR AI-POWERED RESPONSES)
    # ================================================================
    
    @staticmethod
    def get_llm_extraction_prompt() -> str:
        """Prompt for LLM to extract info from user message."""
        return """Extract structured information from the user's message.

You are analyzing a recruiter's response in a conversation about building an ideal candidate profile.

Extract and return ONLY a JSON object with these fields (use null for missing info):
{
    "role_title": string or null,
    "must_have_skills": array of strings or [],
    "nice_to_have_skills": array of strings or [],
    "seniority": string or null,
    "experience_years": string or null,
    "industries": array of strings or [],
    "locations": array of strings or [],
    "company_size": array of strings or [],
    "additional_info": string or null
}

Rules:
- Be lenient with variations (e.g. "dev" = "developer")
- Extract skills even if mentioned casually
- If unsure, use null/empty array
- No explanations, ONLY JSON"""
    
    @staticmethod
    def get_llm_response_generation_prompt() -> str:
        """Prompt for LLM to generate Donna's response."""
        return """Generate Donna's next response.

Remember Donna's personality:
- Brief and purposeful (2-3 sentences max)
- Ask ONE question at a time
- Warm but not overly chatty
- Use 1-2 emojis max

Current context will be provided. Generate ONLY Donna's response text."""


    # ================================================================
    # FINALIZATION
    # ================================================================
    
    @staticmethod
    def ready_to_search_confirmation() -> str:
        """Final confirmation before search."""
        return """Perfect! Let me search our database. 🚀

This will take about 30 seconds..."""
    
    @staticmethod
    def search_initiated() -> str:
        """Search has started."""
        return """Searching... I'll update you in real-time! ⚡"""