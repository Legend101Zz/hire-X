"""
Workflow processing logic for session management.
"""
import json
import os
import re
import asyncio
from typing import Dict, Any, List, Optional
from redis_manager import RedisManager
from ai_model import HiringPromptParser, Model
from pymongo import MongoClient
import re


class Workflow:
    def __init__(self, redis_manager: RedisManager):
        """
        Initialize workflow processor.
        
        Args:
            redis_manager: RedisManager instance for session data access
        """
        self.redis_manager = redis_manager
        self.model = Model()
        self.hiring_parser = HiringPromptParser(self.model)
        client = MongoClient("mongodb://localhost:27017")
        self.db = client["mydatabase"]
        self.profiles = self.db["profiles"]
        
    
    async def store_followup_answers(self, session_id: str, answers: List[str]) -> bool:
        """
        Store follow-up question answers for a session.
        
        Args:
            session_id: Unique session identifier
            answers: List of answers to follow-up questions
            
        Returns:
            bool: True if stored successfully, False otherwise
        """
        try:
            await self._store_data(session_id, "followup_answers", answers)
            print(f"✅ Stored {len(answers)} follow-up answers for session {session_id}")
            return True
        except Exception as e:
            print(f"❌ Failed to store follow-up answers for session {session_id}: {e}")
            return False

    async def resume_workflow_after_followup(self, session_id: str) -> bool:
        """
        Resume workflow after follow-up answers have been provided.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            bool: True if workflow completed successfully, False otherwise
        """
        try:
            print(f"🔄 Resuming workflow with follow-up answers for session: {session_id}")
            
            # Get existing data
            analysis_result = self._get_data(session_id, "prompt_analysis")
            profiles = self._get_data(session_id, "database_lookup")
            
            if not analysis_result or not profiles:
                print(f"❌ Missing data for resuming session {session_id}")
                await self._store_data(session_id, "workflow_status", "error: missing data for resume")
                return False
            
            # Update workflow status
            await self._store_data(session_id, "workflow_status", "resuming_after_followup")
            await self._store_data(session_id, "progress_update", {
                "step": "resuming_after_followup",
                "message": "Resuming workflow with your follow-up answers...",
                "progress": 50
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            # Step 4: Scorecard profiles based on follow-up answers
            await self._store_data(session_id, "workflow_status", "scorecarding_profiles")
            await self._store_data(session_id, "progress_update", {
                "step": "scorecarding_profiles",
                "message": "Analyzing profiles based on your follow-up answers...",
                "progress": 70
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            print("📊 Scorecarding profiles based on follow-up answers...")
            scored_profiles = await self.scorecard_profiles_with_followup(session_id, profiles, analysis_result)
            if not scored_profiles:
                print(f"❌ Scorecarding failed for session {session_id}")
                return False
            
            # Step 5: Serve scored and ranked profiles
            await self._store_data(session_id, "workflow_status", "finalizing_results")
            await self._store_data(session_id, "progress_update", {
                "step": "finalizing_results",
                "message": "Finalizing ranked results based on your criteria...",
                "progress": 90
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            print("📤 Serving scored and ranked profiles...")
            await self._serve_scored_profiles(session_id, scored_profiles, analysis_result)
            
            # Store final results
            final_results = self._get_data(session_id, "final_results")
            if final_results:
                await self._store_data(session_id, "final_results", final_results)
            
            await self._store_data(session_id, "workflow_status", "completed")
            await self._store_data(session_id, "progress_update", {
                "step": "completed",
                "message": f"✅ Workflow completed! Found {len(scored_profiles)} ranked profiles.",
                "progress": 100
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            print(f"✅ Workflow completed for session: {session_id}")
            print(f"📊 Served {len(scored_profiles)} scored and ranked profiles")
            
            return True
            
        except Exception as e:
            print(f"❌ Workflow resume failed for session {session_id}: {e}")
            await self._store_data(session_id, "workflow_status", f"error: {str(e)}")
            return False


    async def process_session(self, session_id: str) -> bool:
        """
        Process a session by executing the complete workflow.
        
        Args:
            session_id: Unique session identifier
            
        Returns:
            bool: True if workflow completed successfully, False otherwise
        """
        try:
            await self._store_data(session_id, "workflow_status", "started")
            print(f"🔄 Starting workflow for session: {session_id}")
            
            # Step 1: Analyze the prompt
            await self._store_data(session_id, "workflow_status", "analyzing_prompt")
            await self._store_data(session_id, "progress_update", {
                "step": "analyzing_prompt",
                "message": "Analyzing your prompt to extract requirements...",
                "progress": 20
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            prompt = self.redis_manager.get_prompt(session_id)
            if not prompt:
                await self._store_data(session_id, "workflow_status", "error: no prompt found")
                return False
            
            print(f"📝 Processing prompt: {prompt}")
            analysis_result = await self.analyze_prompt(session_id, prompt)
            if not analysis_result:
                await self._store_data(session_id, "workflow_status", "error: prompt analysis failed")
                return False
            
            # Step 2: Lookup database for relevant profiles
            await self._store_data(session_id, "workflow_status", "searching_database")
            await self._store_data(session_id, "progress_update", {
                "step": "searching_database",
                "message": "Searching database for matching profiles...",
                "progress": 40
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            print("🔍 Looking up profiles from database...")
            profiles = await self.lookup_database(session_id, analysis_result)
            if not profiles:
                await self._store_data(session_id, "workflow_status", "error: no profiles found")
                return False
            
            # Step 3: Serve profiles directly via websocket (skip scorecarding)
            await self._store_data(session_id, "workflow_status", "serving_profiles")
            await self._store_data(session_id, "progress_update", {
                "step": "serving_profiles",
                "message": f"Found {len(profiles)} profiles! Preparing results...",
                "progress": 60
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            print("📤 Serving profiles directly to user...")
            await self._serve_profiles_directly(session_id, profiles, analysis_result)
            
            # Step 4: Generate follow-up questions and PAUSE workflow
            await self._store_data(session_id, "workflow_status", "generating_questions")
            await self._store_data(session_id, "progress_update", {
                "step": "generating_questions",
                "message": "Generating follow-up questions to refine your search...",
                "progress": 80
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            
            print("❓ Generating follow-up questions...")
            followup_questions = self.followup_questions(session_id, analysis_result, profiles)
            
            # Store follow-up questions immediately so they're sent via WebSocket right away
            await self._store_data(session_id, "followup_questions", followup_questions)
            
            # PAUSE: Set workflow status to waiting for followup answers
            await self._store_data(session_id, "workflow_status", "waiting_for_followup_answers")
            await self._store_data(session_id, "progress_update", {
                "step": "waiting_for_followup_answers",
                "message": "Please answer the follow-up questions to refine your search results.",
                "progress": 90
            })
            await asyncio.sleep(0.5)  # Small delay for progressive display
            print(f"⏸️ Workflow PAUSED for session {session_id} - waiting for followup answers")
            
            # The workflow will be resumed by the API when all followup answers are received
            # This method now only handles the initial part up to followup questions
            return True
            
        except Exception as e:
            print(f"❌ Workflow error for session {session_id}: {e}")
            await self._store_data(session_id, "workflow_status", f"error: {str(e)}")
            return False
    
    async def analyze_prompt(self, session_id: str, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Analyze the user prompt to extract key requirements and search criteria using HiringPromptParser.
        
        Args:
            session_id: Unique session identifier
            prompt: The user's input prompt
            
        Returns:
            dict: Analysis result with extracted requirements, or None if failed
        """
        try:
            print(f"  📊 Analyzing prompt for session {session_id}")
            
            # Use HiringPromptParser to extract structured data
            structured_data = self.hiring_parser.parse(prompt)
            
            analysis_result = {
                "original_prompt": prompt,
                "structured_data": structured_data,
                "location": structured_data.get("Location", []),
                "role": structured_data.get("Role", []),
                "experience": structured_data.get("Experience", []),
                "industry": structured_data.get("Industry", []),
                "skills": structured_data.get("Skills", []),
                "analysis_confidence": 1.0  # High confidence since we're using AI parsing
            }
            
            # Store analysis result in Redis
            await self._store_data(session_id, "prompt_analysis", analysis_result)
            
            print(f"  ✅ Prompt analysis completed for session {session_id}")
            print(f"  📋 Extracted: {structured_data}")
            return analysis_result
            
        except Exception as e:
            print(f"  ❌ Prompt analysis failed for session {session_id}: {e}")
            return None
    
    async def lookup_database(self, session_id: str, analysis_result: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        """
        Lookup relevant profiles using dummy data based on structured data from analyze_prompts.
        
        Args:
            session_id: Unique session identifier
            analysis_result: Result from prompt analysis containing structured_data
            
        Returns:
            list: List of relevant profiles matching the schema, or None if failed
        """
        try:
            print(f"  🔍 Looking up database for session {session_id}")
            
            # Extract structured data from analysis result for logging purposes
            structured_data = analysis_result.get("structured_data", {})

            location_criteria = structured_data.get("location", [])
            role_criteria = structured_data.get("Role", [])
            industry_criteria = structured_data.get("industry", [])
            skills_criteria = structured_data.get("skills", [])
            education_criteria = structured_data.get("education", [])
            certifications_criteria = structured_data.get("certifications", [])
            publications_criteria = structured_data.get("publications", [])
            patents_criteria = structured_data.get("patents", [])
            awards_criteria = structured_data.get("awards", [])
            memberships_criteria = structured_data.get("memberships", [])
            prior_industries_criteria = structured_data.get("prior_industries", [])
            organization_id_criteria = structured_data.get("organization_id", [])
            profile_picture_criteria = structured_data.get("profile_picture", [])
            state_criteria = structured_data.get("state", [])
            city_criteria = structured_data.get("city", [])
            country_criteria = structured_data.get("country", [])
            seniority_level_criteria = structured_data.get("seniority_level", [])
            functional_area_criteria = structured_data.get("functional_area", [])

            # experience_criteria = structured_data.get("experience", [])
            # experience is something never mentioned in the linkedin profile directly. 
            # we have to get add the total experiences candidates had through their companies joined

            matches = self.search_profile(
                location=location_criteria,
                country=country_criteria,
                role=role_criteria,
                industry=industry_criteria,
                expertise=skills_criteria,
                education=education_criteria,
                certifications=certifications_criteria,
                publications=publications_criteria,
                patents=patents_criteria,
                awards=awards_criteria,
                memberships=memberships_criteria,
                prior_industries=prior_industries_criteria,
                organization_id=organization_id_criteria,
                profile_picture=profile_picture_criteria,
                state=state_criteria,
                city=city_criteria,
                seniority_level=seniority_level_criteria,
                functional_area=functional_area_criteria,
            )
            
            # Check if any matches found
            if not matches:
                error_msg = "No matching profiles found in database"
                print(f"  ❌ {error_msg} for session {session_id}")
                await self._store_data(session_id, "workflow_status", f"error: {error_msg}")
                return None
            
            print(f"  ✅ Database lookup completed for session {session_id}: {len(matches)} profiles found")
            
            # Store lookup results in Redis
            await self._store_data(session_id, "database_lookup", matches)
            
            # returns only 30 people in the list -> might end up being limited
            return matches[:30]
            
        except Exception as e:
            error_msg = f"Database lookup failed: {str(e)}"
            print(f"  ❌ {error_msg} for session {session_id}")
            await self._store_data(session_id, "workflow_status", f"error: {error_msg}")
            return None
    
    async def _serve_profiles_directly(self, session_id: str, profiles: List[Dict[str, Any]], analysis_result: Dict[str, Any]) -> None:
        """
        Serve profiles directly to the user via websocket without scorecarding.
        
        Args:
            session_id: Unique session identifier
            profiles: List of profiles to serve
            analysis_result: Analysis result for metadata
        """
        try:
            print(f"  📤 Serving {len(profiles)} profiles directly for session {session_id}")
            
            # Create a simple summary without scores
            summary = {
                "total_profiles_found": len(profiles),
                "profiles_returned": len(profiles),
                "average_score": 0.5,  # Neutral since we're not scoring
                "top_score": 0.5,
                "score_distribution": {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
            }
            
            # Add descriptions to profiles
            profiles_with_descriptions = []
            for profile in profiles:
                profile_with_desc = {
                    **profile,
                    "description": self._get_profile_description(profile)
                }
                profiles_with_descriptions.append(profile_with_desc)
            
            # Sort profiles by description availability (profiles with descriptions first)
            sorted_profiles = sorted(profiles_with_descriptions, key=lambda x: (
                x.get("description", "") != "No summary available for the profile",  # Profiles with descriptions first
                x.get("first_name", ""),  # Then by name for consistent ordering
                x.get("last_name", "")
            ), reverse=True)
            
            # Create results structure similar to final_results but without scoring
            direct_results = {
                "profiles": sorted_profiles,
                "summary": summary,
                "session_id": session_id,
                "analysis_metadata": {
                    "original_prompt": analysis_result.get("original_prompt", ""),
                    "extracted_keywords": analysis_result.get("extracted_keywords", []),
                    "search_criteria": analysis_result.get("search_criteria", {})
                }
            }
            
            # Store direct results in Redis (this will trigger websocket broadcast)
            await self._store_data(session_id, "direct_profiles", direct_results)
            
            print(f"  ✅ Served {len(profiles)} profiles directly for session {session_id}")
            
        except Exception as e:
            print(f"  ❌ Error serving profiles directly for session {session_id}: {e}")
            await self._store_data(session_id, "workflow_status", f"error: {str(e)}")
            raise
    
    async def scorecard_profiles_with_followup(self, session_id: str, profiles: List[Dict[str, Any]], analysis_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Score and rank profiles based on how well they match words in follow-up question answers.
        
        Args:
            session_id: Unique session identifier
            profiles: List of profiles to score
            analysis_result: Analysis result with metadata
            
        Returns:
            list: List of scored and ranked profiles
        """
        try:
            print(f"  📊 Scorecarding {len(profiles)} profiles based on follow-up answers for session {session_id}")
            
            # Get follow-up answers
            followup_answers_data = self._get_data(session_id, "followup_answers") or {}
            followup_answers = followup_answers_data.get("answers", [])
            
            if not followup_answers:
                print(f"  ⚠️ No follow-up answers found for session {session_id}, returning profiles as-is")
                return profiles
            
            scored_profiles = []
            
            for profile in profiles:
                # Calculate match score based on follow-up answers
                match_score = self._calculate_followup_match_score(profile, followup_answers)
                
                # Add description handling
                description = self._get_profile_description(profile)
                
                # Create scored profile with ranking information
                scored_profile = {
                    **profile,
                    "description": description,
                    "followup_match_score": match_score,
                    "followup_match_percentage": round(match_score * 100, 1),
                    "ranking_reason": self._generate_ranking_reason(profile, followup_answers, match_score)
                }
                
                scored_profiles.append(scored_profile)
            
            # Sort profiles by description availability (profiles with descriptions first) and then by follow-up match score
            ranked_profiles = sorted(scored_profiles, key=lambda x: (
                x.get("description", "") != "No summary available for the profile",  # Profiles with descriptions first
                x.get("followup_match_score", 0)  # Then by match score
            ), reverse=True)
            
            # Store scorecard results
            await self._store_data(session_id, "scorecard_results", ranked_profiles)
            
            print(f"  ✅ Scorecarding completed for session {session_id}")
            print(f"  🏆 Top match: {ranked_profiles[0].get('followup_match_percentage', 0)}% - {ranked_profiles[0].get('first_name', 'Unknown')} {ranked_profiles[0].get('last_name', '')}")
            
            return ranked_profiles
            
        except Exception as e:
            print(f"  ❌ Scorecarding failed for session {session_id}: {e}")
            await self._store_data(session_id, "workflow_status", f"error: {str(e)}")
            return profiles  # Return original profiles if scoring fails
    
    def _calculate_followup_match_score(self, profile: Dict[str, Any], followup_answers: List[Dict[str, Any]]) -> float:
        """
        Calculate how well a profile matches the words in follow-up question answers.
        
        Args:
            profile: Candidate profile data
            followup_answers: List of followup answer dictionaries
            
        Returns:
            float: Match score between 0.0 and 1.0
        """
        if not followup_answers:
            return 0.5  # Neutral score if no follow-up answers
        
        # Extract all words from follow-up answers
        answer_words = set()
        for answer_data in followup_answers:
            answer_text = answer_data.get("answer", "").lower()
            # Split by spaces and remove punctuation
            import re
            words = re.findall(r'\b\w+\b', answer_text)
            answer_words.update(words)
        
        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
            'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 
            'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 
            'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
            'his', 'her', 'its', 'our', 'their', 'myself', 'yourself', 'himself', 'herself',
            'itself', 'ourselves', 'yourselves', 'themselves'
        }
        
        answer_words = answer_words - stop_words
        
        if not answer_words:
            return 0.5  # Neutral score if no meaningful words in answers
        
        # Extract profile text fields to search in
        profile_text_fields = []
        
        # Add name
        if profile.get('first_name'):
            profile_text_fields.append(profile['first_name'].lower())
        if profile.get('last_name'):
            profile_text_fields.append(profile['last_name'].lower())
        
        # Add title and current industry
        if profile.get('title'):
            profile_text_fields.append(profile['title'].lower())
        if profile.get('current_industry') and profile['current_industry'] != 'NA':
            profile_text_fields.append(profile['current_industry'].lower())
        
        # Add expertise
        if profile.get('expertise') and profile['expertise'] != 'NA':
            profile_text_fields.append(profile['expertise'].lower())
        
        # Add location
        if profile.get('location'):
            profile_text_fields.append(profile['location'].lower())
        if profile.get('country'):
            profile_text_fields.append(profile['country'].lower())
        
        # Add seniority level
        if profile.get('seniority_level') and profile['seniority_level'] != 'NA':
            profile_text_fields.append(profile['seniority_level'].lower())
        
        # Add prior industries
        if profile.get('prior_industries'):
            for industry in profile['prior_industries']:
                if industry != 'NA':
                    profile_text_fields.append(industry.lower())
        
        # Add experience details
        if profile.get('experience'):
            for exp in profile['experience']:
                if exp.get('company'):
                    profile_text_fields.append(exp['company'].lower())
                if exp.get('title'):
                    profile_text_fields.append(exp['title'].lower())
                if exp.get('industry') and exp['industry'] != 'NA':
                    profile_text_fields.append(exp['industry'].lower())
        
        # Add education details
        if profile.get('education'):
            for edu in profile['education']:
                if edu.get('institution'):
                    profile_text_fields.append(edu['institution'].lower())
                if edu.get('degree'):
                    profile_text_fields.append(edu['degree'].lower())
                if edu.get('field'):
                    profile_text_fields.append(edu['field'].lower())
        
        # Add certifications
        if profile.get('certifications'):
            for cert in profile['certifications']:
                if cert != 'NA':
                    profile_text_fields.append(cert.lower())
        
        # Add publications
        if profile.get('publications'):
            for pub in profile['publications']:
                if pub.get('title'):
                    profile_text_fields.append(pub['title'].lower())
                if pub.get('journal'):
                    profile_text_fields.append(pub['journal'].lower())
        
        # Add patents
        if profile.get('patents'):
            for patent in profile['patents']:
                if patent.get('title'):
                    profile_text_fields.append(patent['title'].lower())
                if patent.get('number'):
                    profile_text_fields.append(patent['number'].lower())
        
        # Add awards
        if profile.get('awards'):
            for award in profile['awards']:
                if award != 'NA':
                    profile_text_fields.append(award.lower())
        
        # Add memberships
        if profile.get('memberships'):
            for membership in profile['memberships']:
                if membership != 'NA':
                    profile_text_fields.append(membership.lower())
        
        # Add state and city
        if profile.get('state') and profile['state'] != 'NA':
            profile_text_fields.append(profile['state'].lower())
        if profile.get('city') and profile['city'] != 'NA':
            profile_text_fields.append(profile['city'].lower())
        
        # Add functional area
        if profile.get('functional_area') and profile['functional_area'] != 'NA':
            profile_text_fields.append(profile['functional_area'].lower())
        
        # Add organization ID
        if profile.get('organization_id') and profile['organization_id'] != 'NA':
            profile_text_fields.append(str(profile['organization_id']).lower())
        
        # Combine all profile text
        profile_text = ' '.join(profile_text_fields)
        profile_words = set(re.findall(r'\b\w+\b', profile_text))
        
        # Calculate word overlap score
        if not profile_words:
            return 0.0
        
        # Calculate intersection of answer words and profile words
        matches = answer_words.intersection(profile_words)
        
        # Calculate score as percentage of answer words that match profile
        match_score = len(matches) / len(answer_words)
        
        # Boost score if there are many matches
        if len(matches) > 0:
            # Give bonus for multiple matches
            bonus = min(0.2, len(matches) * 0.05)
            match_score = min(1.0, match_score + bonus)
        
        return match_score
    
    def _generate_ranking_reason(self, profile: Dict[str, Any], followup_answers: List[Dict[str, Any]], match_score: float) -> str:
        """
        Generate a human-readable reason for the ranking.
        
        Args:
            profile: Candidate profile data
            followup_answers: List of followup answer dictionaries
            match_score: Calculated match score
            
        Returns:
            str: Ranking reason
        """
        if match_score == 0.0:
            return "No matches found with follow-up criteria"
        elif match_score < 0.2:
            return "Few matches with follow-up criteria"
        elif match_score < 0.5:
            return "Some matches with follow-up criteria"
        elif match_score < 0.8:
            return "Good matches with follow-up criteria"
        else:
            return "Excellent matches with follow-up criteria"
    
    def _get_profile_description(self, profile: Dict[str, Any]) -> str:
        """
        Get profile description from available fields or return fallback text.
        
        Args:
            profile: Candidate profile data
            
        Returns:
            str: Profile description or fallback text
        """
        # Try to find description in various possible fields
        description_fields = [
            'description',
            'summary', 
            'bio',
            'about',
            'profile_summary',
            'professional_summary',
            'headline',
            'overview'
        ]
        
        for field in description_fields:
            description = profile.get(field)
            if description and description.strip() and description != 'NA':
                return description.strip()
        
        # If no description found, return fallback text
        return "No summary available for the profile"
    
    async def _serve_scored_profiles(self, session_id: str, scored_profiles: List[Dict[str, Any]], analysis_result: Dict[str, Any]) -> None:
        """
        Serve scored and ranked profiles to the user via websocket.
        
        Args:
            session_id: Unique session identifier
            scored_profiles: List of scored and ranked profiles
            analysis_result: Analysis result for metadata
        """
        try:
            print(f"  📤 Serving {len(scored_profiles)} scored profiles for session {session_id}")
            
            # Create summary with scoring statistics
            if scored_profiles:
                avg_score = sum(p.get("followup_match_score", 0) for p in scored_profiles) / len(scored_profiles)
                top_score = scored_profiles[0].get("followup_match_score", 0) if scored_profiles else 0
                
                # Calculate score distribution
                score_distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
                for profile in scored_profiles:
                    score = profile.get("followup_match_score", 0)
                    if score >= 0.8:
                        score_distribution["excellent"] += 1
                    elif score >= 0.6:
                        score_distribution["good"] += 1
                    elif score >= 0.4:
                        score_distribution["fair"] += 1
                    else:
                        score_distribution["poor"] += 1
            else:
                avg_score = 0.0
                top_score = 0.0
                score_distribution = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
            
            summary = {
                "total_profiles_found": len(scored_profiles),
                "profiles_returned": len(scored_profiles),
                "average_score": round(avg_score, 3),
                "top_score": round(top_score, 3),
                "score_distribution": score_distribution,
                "scoring_method": "followup_word_matching"
            }
            
            # Create results structure with scored profiles
            scored_results = {
                "profiles": scored_profiles,
                "summary": summary,
                "session_id": session_id,
                "analysis_metadata": {
                    "original_prompt": analysis_result.get("original_prompt", ""),
                    "extracted_keywords": analysis_result.get("extracted_keywords", []),
                    "search_criteria": analysis_result.get("search_criteria", {}),
                    "scoring_applied": True,
                    "scoring_timestamp": str(asyncio.get_event_loop().time())
                }
            }
            
            # Store scored results in Redis (this will trigger websocket broadcast)
            await self._store_data(session_id, "final_results", scored_results)
            
            print(f"  ✅ Served {len(scored_profiles)} scored profiles for session {session_id}")
            print(f"  📊 Average match score: {avg_score:.1%}, Top score: {top_score:.1%}")
            
        except Exception as e:
            print(f"  ❌ Error serving scored profiles for session {session_id}: {e}")
            await self._store_data(session_id, "workflow_status", f"error: {str(e)}")
            raise
    
    def followup_questions(self, session_id: str, analysis_result: Dict[str, Any], profiles: List[Dict[str, Any]]) -> List[str]:
        """
        Generate contextual follow-up questions by asking the model about finding candidates in the data.
        
        Args:
            session_id: Unique session identifier
            analysis_result: Result from prompt analysis
            profiles: List of found profiles
            
        Returns:
            list: List of 3 follow-up questions from the model
        """
        try:
            print(f"  ❓ Generating follow-up questions for session {session_id}")
            
            # Create a prompt for the model to generate follow-up questions
            structured_data = analysis_result.get("structured_data", {})
            profiles_summary = f"Found {len(profiles)} profiles with data including experience, education, skills, and location information."
            
            followup_prompt = f"""
            You are asking questions to the HR based on the hiring requirements and candidate data, what 3 follow-up questions would you like to ask for more clarity on finding the right candidate?
            
            Hiring Requirements:
            - Location: {structured_data.get('Location', [])}
            - Role: {structured_data.get('Role', [])}
            - Experience: {structured_data.get('Experience', [])}
            - Industry: {structured_data.get('Industry', [])}
            - Skills: {structured_data.get('Skills', [])}
            
            Candidate Data: {profiles_summary}
            
            Please provide exactly 3 follow-up questions that would help narrow down the search for the best candidate match.
            Return only the questions, one per line, without numbering or bullet points.
            """
            
            # Use the model to generate follow-up questions
            response = self.model.generate_summary(followup_prompt)
            
            # The response should already be a string
            content = response if isinstance(response, str) else str(response)
            
            # Split by lines and clean up
            questions = [q.strip() for q in content.split('\n') if q.strip()]
            
            # Ensure we have exactly 3 questions
            if len(questions) < 3:
                # Add default questions if we don't have enough
                default_questions = [
                    "Are there any specific certifications or qualifications that are required?",
                    "What is the preferred company size or industry experience?",
                    "Are there any deal-breaker requirements that would disqualify a candidate?"
                ]
                questions.extend(default_questions[:3-len(questions)])
            elif len(questions) > 3:
                questions = questions[:3]
            
            print(f"  ✅ Generated {len(questions)} follow-up questions for session {session_id}")
            return questions
            
        except Exception as e:
            print(f"  ❌ Follow-up question generation failed for session {session_id}: {e}")
            # Return default questions as fallback
            return [
                "Are there any specific certifications or qualifications that are required?",
                "What is the preferred company size or industry experience?", 
                "Are there any deal-breaker requirements that would disqualify a candidate?"
            ]
    

    
    def search_profile(self, location=None, country=None, industry=None, expertise=None, role=None, education=None, certifications=None, publications=None, patents=None, awards=None, memberships=None, prior_industries=None, organization_id=None, profile_picture=None, state=None, city=None, seniority_level=None, functional_area=None):
        and_clauses = []

        # Helper to build regex for a field - now supports both OR and AND logic
        def build_field_regex(field_name, values, exact=False, match_all=False):
            """
            Build regex query for a field.
            
            Args:
                field_name: MongoDB field name
                values: List of values to search for
                exact: Whether to use exact match
                match_all: If True, profile must match ALL values (AND logic)
                          If False, profile must match ANY value (OR logic)
            """
            if not values:
                return None
                
            regex_list = []
            for v in values:
                if exact:
                    regex_list.append({field_name: re.compile(f"^{v}$", re.IGNORECASE)})
                else:
                    regex_list.append({field_name: re.compile(v, re.IGNORECASE)})
            
            if not regex_list:
                return None
                
            # Use AND logic if match_all is True, otherwise use OR logic
            if match_all:
                return {"$and": regex_list}
            else:
                return {"$or": regex_list}
        
        # Helper for array field matching (for fields that contain arrays of objects)
        def build_array_field_regex(field_name, values, subfield=None, match_all=False):
            """
            Build regex query for array fields.
            
            Args:
                field_name: MongoDB array field name (e.g., "education")
                values: List of values to search for
                subfield: Subfield within array objects (e.g., "degree" for education.degree)
                match_all: Whether profile must match ALL values
            """
            if not values:
                return None
                
            if subfield:
                # For nested fields like education.degree
                regex_list = []
                for v in values:
                    regex_list.append({f"{field_name}.{subfield}": re.compile(v, re.IGNORECASE)})
                
                if match_all:
                    return {"$and": regex_list}
                else:
                    return {"$or": regex_list}
            else:
                # For direct array fields
                regex_list = []
                for v in values:
                    regex_list.append({field_name: re.compile(v, re.IGNORECASE)})
                
                if match_all:
                    return {"$and": regex_list}
                else:
                    return {"$or": regex_list}

        # Location - must contain ALL specified locations
        if location:
            clause = build_field_regex("location", location, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Country - must match ALL specified countries exactly
        if country:
            clause = build_field_regex("country", country, exact=True, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Industry - must match ALL specified industries
        if industry:
            clause = build_field_regex("current_industry", industry, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Expertise - must contain ALL specified skills
        if expertise:
            clause = build_field_regex("expertise", expertise, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Role (title) - must contain ALL specified roles
        if role:
            clause = build_field_regex("title", role, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Education - must have ALL specified degrees
        if education:
            clause = build_array_field_regex("education", education, subfield="degree", match_all=True)
            if clause:
                and_clauses.append(clause)

        # Certifications - must have ALL specified certifications
        if certifications:
            clause = build_array_field_regex("certifications", certifications, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Publications - must have ALL specified publications
        if publications:
            clause = build_array_field_regex("publications", publications, subfield="title", match_all=True)
            if clause:
                and_clauses.append(clause)

        # Patents - must have ALL specified patents
        if patents:
            clause = build_array_field_regex("patents", patents, subfield="title", match_all=True)
            if clause:
                and_clauses.append(clause)

        # Awards - must have ALL specified awards
        if awards:
            clause = build_array_field_regex("awards", awards, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Memberships - must have ALL specified memberships
        if memberships:
            clause = build_array_field_regex("memberships", memberships, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Prior Industries - must have ALL specified prior industries
        if prior_industries:
            clause = build_array_field_regex("prior_industries", prior_industries, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Organization ID - must match ALL specified organization IDs exactly
        if organization_id:
            clause = build_field_regex("organization_id", organization_id, exact=True, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Profile Picture - must match ALL specified values exactly
        if profile_picture:
            clause = build_field_regex("profile_picture", profile_picture, exact=True, match_all=True)
            if clause:
                and_clauses.append(clause)

        # State - must contain ALL specified states
        if state:
            clause = build_field_regex("state", state, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # City - must contain ALL specified cities
        if city:
            clause = build_field_regex("city", city, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Seniority Level - must match ALL specified seniority levels
        if seniority_level:
            clause = build_field_regex("seniority_level", seniority_level, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Functional Area - must match ALL specified functional areas
        if functional_area:
            clause = build_field_regex("functional_area", functional_area, exact=False, match_all=True)
            if clause:
                and_clauses.append(clause)

        # Combine all clauses with AND
        query = {"$and": and_clauses} if and_clauses else {}

        # Execute query
        results = list(self.profiles.find(query))
        return results

    
    
    async def _store_data(self, session_id: str, action_tag: str, data: Any) -> bool:
        """
        Store data in Redis using the sessionID:action_tag:data structure and publish update.
        
        Args:
            session_id: Unique session identifier
            action_tag: Tag identifying the type of data
            data: Data to store (will be JSON serialized)
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            key = f"{session_id}:{action_tag}"
            json_data = json.dumps(data, default=str)
            self.redis_manager.redis_client.set(key, json_data)
            
            # Publish update via Redis pub/sub
            await self.redis_manager.publish_session_update(session_id, action_tag, data)
            
            return True
        except Exception as e:
            print(f"Error storing data for {session_id}:{action_tag}: {e}")
            return False
    
    def _get_data(self, session_id: str, action_tag: str) -> Optional[Any]:
        """
        Retrieve data from Redis using the sessionID:action_tag:data structure.
        
        Args:
            session_id: Unique session identifier
            action_tag: Tag identifying the type of data
            
        Returns:
            Any: Retrieved data or None if not found
        """
        try:
            key = f"{session_id}:{action_tag}"
            data = self.redis_manager.redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"Error retrieving data for {session_id}:{action_tag}: {e}")
            return None