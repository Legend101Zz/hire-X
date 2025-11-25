"""
Search Refinement Service
=========================
Handles HR's iterative refinements to search criteria.
"""

from typing import Any, Dict, List, Optional

from core.logging_config import get_logger

logger = get_logger(__name__)


class SearchRefinementService:
    """
    Manages iterative search refinements based on HR feedback.
    """
    
    def __init__(self):
        """Initialize refinement service."""
        self.refinement_history = {}
        logger.info("✅ SearchRefinementService initialized")
    
    
    def apply_refinement(
        self,
        session_id: str,
        original_jd: Dict[str, Any],
        refinement_action: str,
        refinement_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply HR's refinement to search criteria.
        
        Args:
            session_id: Session identifier
            original_jd: Original JD requirements
            refinement_action: Type of refinement (add_skill, remove_skill, etc.)
            refinement_data: Refinement details
            
        Returns:
            Updated search filters
        """
        logger.info(f"🔄 Applying refinement: {refinement_action}")
        
        # Initialize session history
        if session_id not in self.refinement_history:
            self.refinement_history[session_id] = {
                "original_jd": original_jd,
                "filters": self._init_filters(original_jd),
                "history": []
            }
        
        session = self.refinement_history[session_id]
        filters = session["filters"]
        
        # Apply refinement based on action
        if refinement_action == "add_skill":
            filters["must_have_skills"].append(refinement_data["skill"])
            logger.info(f"➕ Added skill: {refinement_data['skill']}")
        
        elif refinement_action == "remove_skill":
            if refinement_data["skill"] in filters["must_have_skills"]:
                filters["must_have_skills"].remove(refinement_data["skill"])
                logger.info(f"➖ Removed skill: {refinement_data['skill']}")
        
        elif refinement_action == "add_industry":
            filters["industries"].append(refinement_data["industry"])
            logger.info(f"➕ Added industry: {refinement_data['industry']}")
        
        elif refinement_action == "remove_industry":
            if refinement_data["industry"] in filters["industries"]:
                filters["industries"].remove(refinement_data["industry"])
                logger.info(f"➖ Removed industry: {refinement_data['industry']}")
        
        elif refinement_action == "change_seniority":
            filters["seniority"] = refinement_data["seniority"]
            logger.info(f"🔄 Changed seniority to: {refinement_data['seniority']}")
        
        elif refinement_action == "broaden_title":
            # Simplify role title
            role_title = filters.get("role_title", "")
            # Remove everything after dash
            filters["role_title"] = role_title.split("-")[0].strip()
            logger.info(f"📏 Broadened title to: {filters['role_title']}")
        
        elif refinement_action == "add_location":
            if "locations" not in filters:
                filters["locations"] = []
            filters["locations"].append(refinement_data["location"])
            logger.info(f"📍 Added location: {refinement_data['location']}")
        
        elif refinement_action == "reset":
            filters = self._init_filters(original_jd)
            logger.info("🔄 Reset filters to original JD")
        
        # Record refinement in history
        session["history"].append({
            "action": refinement_action,
            "data": refinement_data,
            "timestamp": None  # Add timestamp if needed
        })
        
        session["filters"] = filters
        
        return filters
    
    
    def get_refinement_suggestions(
        self,
        session_id: str,
        current_results_count: int
    ) -> List[Dict[str, Any]]:
        """
        Generate smart suggestions for next refinement.
        
        Args:
            session_id: Session identifier
            current_results_count: Number of candidates found
            
        Returns:
            List of suggested refinements
        """
        if session_id not in self.refinement_history:
            return []
        
        session = self.refinement_history[session_id]
        filters = session["filters"]
        
        suggestions = []
        
        # Too few results
        if current_results_count < 5:
            suggestions.extend([
                {
                    "action": "broaden_title",
                    "reason": "Simplify role title to find more matches",
                    "example": "Change 'Senior Full Stack Developer - Real-Time' to 'Full Stack Developer'"
                },
                {
                    "action": "reduce_skills",
                    "reason": "Focus on top 3 critical skills only",
                    "current_skills": len(filters.get("must_have_skills", [])),
                    "suggested_count": 3
                },
                {
                    "action": "add_industry",
                    "reason": "Add related industries",
                    "examples": ["Technology", "Software", "IT Services"]
                }
            ])
        
        # Good number of results
        elif 5 <= current_results_count <= 20:
            suggestions.extend([
                {
                    "action": "add_skill",
                    "reason": "Results look good! Add more specific skills to narrow down",
                    "examples": filters["must_have_skills"][:5]
                },
                {
                    "action": "add_location",
                    "reason": "Filter by location if needed"
                }
            ])
        
        # Too many results
        else:
            suggestions.extend([
                {
                    "action": "add_skill",
                    "reason": "Add more required skills to narrow results",
                    "examples": filters["must_have_skills"]
                },
                {
                    "action": "change_seniority",
                    "reason": "Make seniority requirement more specific"
                }
            ])
        
        return suggestions
    
    
    def _init_filters(self, jd_data: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize filters from JD."""
        return {
            "role_title": jd_data.get("role_title", ""),
            "must_have_skills": jd_data.get("required_skills", [])[:5],  # Start with top 5
            "nice_to_have_skills": jd_data.get("preferred_skills", []),
            "industries": jd_data.get("industries", []),
            "seniority": jd_data.get("seniority", ""),
            "locations": []
        }