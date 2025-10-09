"""
Candidate pre-scoring (Tier 1) and final ranking (Tier 2).
"""
import re
from typing import Any, Dict, List

from ai_model import Model


class CandidateScorer:
    """Handles both Tier 1 pre-scoring and Tier 2 final AI ranking."""
    
    def __init__(self, model: Model = None):
        self.model = model
    
    def calculate_pre_score(self, profile: Dict[str, Any], scoring_rules: Dict[str, Dict[str, int]]) -> float:
        """
        Calculate pre-score (Tier 1) based on keyword matching.
        
        Args:
            profile: Candidate profile dict
            scoring_rules: Scoring rules from enhanced parser
            
        Returns:
            float: Score between 0-100
        """
        total_score = 0
        max_possible_score = 0
        
        # Helper to check if keyword exists in text (case-insensitive)
        def keyword_match(keyword: str, text: str) -> bool:
            if not text or text == "NA":
                return False
            return re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE) is not None
        
        # 1. Skills scoring
        skills_text = profile.get("expertise", "") or ""
        for skill, points in scoring_rules.get("skills", {}).items():
            max_possible_score += points
            if keyword_match(skill, skills_text):
                total_score += points
        
        # 2. Experience scoring
        title = profile.get("title", "") or ""
        seniority = profile.get("seniority_level", "") or ""
        experience_text = f"{title} {seniority}".lower()
        
        for exp_keyword, points in scoring_rules.get("experience", {}).items():
            max_possible_score += points
            if exp_keyword.lower() in experience_text:
                total_score += points
        
        # 3. Education scoring
        education = profile.get("education", [])
        education_text = ""
        if isinstance(education, list) and education and education != ["NA"]:
            for edu in education:
                if isinstance(edu, dict):
                    education_text += f" {edu.get('major', '')} {edu.get('specialization', '')} {edu.get('campus', '')}"
        
        for edu_keyword, points in scoring_rules.get("education", {}).items():
            max_possible_score += points
            if keyword_match(edu_keyword, education_text):
                total_score += points
        
        # 4. Industry scoring
        industry = profile.get("current_industry", "") or ""
        for ind_keyword, points in scoring_rules.get("industry", {}).items():
            max_possible_score += points
            if keyword_match(ind_keyword, industry):
                total_score += points
        
        # 5. Role keywords scoring
        role_text = f"{title} {profile.get('summary', '')}".lower()
        for role_keyword, points in scoring_rules.get("role_keywords", {}).items():
            max_possible_score += points
            if role_keyword.lower() in role_text:
                total_score += points
        
        # Normalize to 0-100 scale
        if max_possible_score > 0:
            normalized_score = (total_score / max_possible_score) * 100
        else:
            normalized_score = 50.0  # Default if no scoring rules
        
        return min(100.0, round(normalized_score, 2))
    
    def get_single_ranking(self, profile: Dict[str, Any], original_prompt: str) -> Dict[str, Any]:
        """
        Generate AI ranking for a single profile.
        Used for incremental summary generation.
        """
        if not self.model:
            return {
                "final_score": profile.get("pre_score", 50),
                "summary": "AI model not available."
            }
        
        profile_summary = self._create_profile_summary(profile)
        
        ranking_prompt = f"""
    You are an expert recruiter. Evaluate this candidate for the following job requirement:

    JOB REQUIREMENT:
    {original_prompt}

    CANDIDATE PROFILE:
    {profile_summary}

    Provide your evaluation in JSON format:
    {{
        "final_score": <number between 0-100>,
        "summary": "<2-3 sentence explanation of why this candidate is a good/poor match>"
    }}

    Consider:
    - Relevance of skills and experience
    - Industry fit
    - Education and certifications
    - Overall suitability

    Respond with ONLY the JSON object, no other text.
    """
        
        try:
            response = self.model.generate_summary(ranking_prompt)
            
            # Extract JSON
            json_start = response.index("{")
            json_end = response.rindex("}") + 1
            import json
            result = json.loads(response[json_start:json_end])
            
            return {
                "final_score": result.get("final_score", profile.get("pre_score", 50)),
                "summary": result.get("summary", "Good candidate match.")
            }
            
        except Exception as e:
            print(f"    ⚠️ AI ranking failed: {e}")
            return {
                "final_score": profile.get("pre_score", 50),
                "summary": "AI ranking unavailable. Score based on keyword matching."
            }
    
    def get_final_rankings(self, candidates: List[Dict[str, Any]], original_prompt: str, top_n: int = 20) -> List[Dict[str, Any]]:
        """
        Get final AI rankings (Tier 2) for top N candidates.
        
        Args:
            candidates: List of candidates sorted by pre_score
            original_prompt: Original user query
            top_n: Number of top candidates to re-rank with AI
            
        Returns:
            List of candidates with final_score and summary added
        """
        if not self.model:
            # If no model available, just return candidates with pre_score as final_score
            for candidate in candidates[:top_n]:
                candidate["final_score"] = candidate.get("pre_score", 50)
                candidate["summary"] = "No AI model available for detailed analysis."
            return candidates[:top_n]
        
        top_candidates = candidates[:top_n]
        
        for i, candidate in enumerate(top_candidates):
            print(f"  🤖 AI ranking candidate {i+1}/{len(top_candidates)}...")
            
            # Create concise profile summary for LLM
            profile_summary = self._create_profile_summary(candidate)
            
            ranking_prompt = f"""
            You are an expert recruiter. Evaluate this candidate for the following job requirement:
            
            JOB REQUIREMENT:
            {original_prompt}
            
            CANDIDATE PROFILE:
            {profile_summary}
            
            Provide your evaluation in JSON format:
            {{
                "final_score": <number between 0-100>,
                "summary": "<2-3 sentence explanation of why this candidate is a good/poor match>"
            }}
            
            Consider:
            - Relevance of skills and experience
            - Industry fit
            - Education and certifications
            - Overall suitability
            
            Respond with ONLY the JSON object, no other text.
            """
            
            try:
                response = self.model.generate_summary(ranking_prompt)
                
                # Extract JSON
                json_start = response.index("{")
                json_end = response.rindex("}") + 1
                import json
                result = json.loads(response[json_start:json_end])
                
                candidate["final_score"] = result.get("final_score", candidate.get("pre_score", 50))
                candidate["summary"] = result.get("summary", "Good candidate match.")
                
            except Exception as e:
                print(f"    ⚠️ AI ranking failed for candidate: {e}")
                # Fallback to pre_score
                candidate["final_score"] = candidate.get("pre_score", 50)
                candidate["summary"] = "AI ranking unavailable. Score based on keyword matching."
        
        # Sort by final_score descending
        top_candidates.sort(key=lambda x: x.get("final_score", 0), reverse=True)
        
        return top_candidates
    
    def _create_profile_summary(self, profile: Dict[str, Any]) -> str:
        """Create a concise profile summary for LLM evaluation."""
        name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
        title = profile.get("title", "N/A")
        location = profile.get("location", "N/A")
        industry = profile.get("current_industry", "N/A")
        skills = profile.get("expertise", "N/A")
        
        # Education
        education = profile.get("education", [])
        edu_str = "N/A"
        if isinstance(education, list) and education and education != ["NA"]:
            edu_list = []
            for edu in education:
                if isinstance(edu, dict):
                    major = edu.get("major", "")
                    if major:
                        edu_list.append(major)
            edu_str = ", ".join(edu_list) if edu_list else "N/A"
        
        summary = f"""
        Name: {name}
        Title: {title}
        Location: {location}
        Industry: {industry}
        Skills: {skills}
        Education: {edu_str}
        """
        
        return summary.strip()