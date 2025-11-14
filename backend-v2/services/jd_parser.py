"""
JD Parser
=========
Parses uploaded Job Description (JD) files.

Supports:
- PDF files
- DOCX files
- Plain text

Extracts:
- Role title
- Required skills
- Preferred skills
- Experience level
- Responsibilities
- Qualifications
"""

import base64
import io
import json
import re
from typing import Dict, List, Optional

from core.logging_config import get_logger
from services.model_config_manager import ModelConfigManager

# PDF and DOCX parsing libraries
try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

logger = get_logger(__name__)

class JDParser:
    """
    Parses Job Description files and extracts structured data.
    """
    
    def __init__(self, model_config_manager:ModelConfigManager):
        """
        Initialize JD parser.
        
        Args:
            model_config_manager: Model configuration manager for LLM calls
        """
        self.model_config = model_config_manager
    
    
    # ================================================================
    # MAIN PARSING METHOD
    # ================================================================
    
    async def parse_jd(
        self,
        file_content: str,
        file_name: str,
        username: Optional[str] = None
    ) -> Dict:
        """
        Parse JD file and extract structured data.
        
        Args:
            file_content: Base64 encoded file content
            file_name: Name of the file
            username: Username for model config
        
        Returns:
            Dict with extracted JD data:
            {
                "role_title": str,
                "required_skills": List[str],
                "preferred_skills": List[str],
                "seniority": str,
                "experience_years": str,
                "responsibilities": str,
                "qualifications": str,
                "industries": List[str],
                "company_size": List[str]
            }
        """
        
        # Decode file content
        file_bytes = base64.b64decode(file_content)
        
        # Extract text based on file type
        if file_name.lower().endswith('.pdf'):
            text = self._extract_from_pdf(file_bytes)
        elif file_name.lower().endswith('.docx'):
            text = self._extract_from_docx(file_bytes)
        else:
            # Assume plain text
            text = file_bytes.decode('utf-8', errors='ignore')
        logger.debug('decoded JD',text)
        # Use LLM to extract structured data
        structured_data = await self._llm_extract_jd_data(text, username)
        print('LLM JD',structured_data)
        return structured_data
    
    
    # ================================================================
    # FILE EXTRACTION METHODS
    # ================================================================
    
    def _extract_from_pdf(self, file_bytes: bytes) -> str:
        """
        Extract text from PDF file.
        
        Args:
            file_bytes: PDF file bytes
        
        Returns:
            Extracted text
        """
        
        if not PDF_AVAILABLE:
            raise ImportError("PyPDF2 not installed. Run: pip install PyPDF2")
        
        try:
            pdf_file = io.BytesIO(file_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            
            return text.strip()
        
        except Exception as e:
            raise ValueError(f"Failed to extract PDF: {str(e)}")
    
    
    def _extract_from_docx(self, file_bytes: bytes) -> str:
        """
        Extract text from DOCX file.
        
        Args:
            file_bytes: DOCX file bytes
        
        Returns:
            Extracted text
        """
        
        if not DOCX_AVAILABLE:
            raise ImportError("python-docx not installed. Run: pip install python-docx")
        
        try:
            docx_file = io.BytesIO(file_bytes)
            doc = docx.Document(docx_file)
            
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            
            return text.strip()
        
        except Exception as e:
            raise ValueError(f"Failed to extract DOCX: {str(e)}")
    
    
    # ================================================================
    # LLM EXTRACTION
    # ================================================================
    
    async def _llm_extract_jd_data(
        self,
        jd_text: str,
        username: Optional[str]
    ) -> Dict:
        """
        Use LLM to extract structured data from JD text.
        
        Args:
            jd_text: Raw JD text
            username: Username for model config
        
        Returns:
            Structured JD data
        """
        
        system_prompt = """You are a job description analyzer.

Extract structured information from the job description and return ONLY a JSON object.

Required JSON structure:
{
    "role_title": string (job title),
    "required_skills": array of strings (must-have technical skills),
    "preferred_skills": array of strings (nice-to-have skills),
    "seniority": string (Junior/Mid/Senior/Lead),
    "experience_years": string (e.g. "5+", "3-5"),
    "responsibilities": string (key responsibilities),
    "qualifications": string (required qualifications),
    "industries": array of strings (target industries if mentioned),
    "company_size": array of strings (if mentioned)
}

Rules:
- Extract actual skills mentioned (e.g. "React", "Python", "AWS")
- Distinguish between required vs preferred skills
- Be specific with seniority and experience
- If not mentioned, use empty string or empty array
- Return ONLY valid JSON, no explanations"""
        
        user_message = f"""Job Description:

{jd_text}

Extract structured data as JSON:"""
        logger.debug('model_config',username)
        # Get model config
        model_config = await self.model_config.get_user_config(username)
        print('calling_model_for_jd',model_config)
        # Call LLM
        response = await self.model_config.call_model(
            model_config=model_config,
            model_purpose="extraction",
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.3,
            username=username 
        )
        
        # Parse JSON response
        try:
            # Clean response (remove markdown code blocks if present)
            clean_response = response.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.startswith("```"):
                clean_response = clean_response[3:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            clean_response = clean_response.strip()
            
            extracted_data = json.loads(clean_response)
            
            # Validate structure
            required_fields = [
                "role_title", "required_skills", "preferred_skills",
                "seniority", "experience_years", "responsibilities",
                "qualifications", "industries", "company_size"
            ]
            print('extracted_data',extracted_data)
            
            for field in required_fields:
                if field not in extracted_data:
                    extracted_data[field] = "" if "skills" not in field and "industries" not in field and "company_size" not in field else []
            print('extracted_data2',extracted_data)
            return extracted_data
        
        except json.JSONDecodeError as e:
            # Fallback: use regex-based extraction
            return self._fallback_extraction(jd_text)
    
    
    # ================================================================
    # FALLBACK EXTRACTION (REGEX-BASED)
    # ================================================================
    
    def _fallback_extraction(self, jd_text: str) -> Dict:
        """
        Fallback extraction using regex patterns.
        
        Args:
            jd_text: Raw JD text
        
        Returns:
            Structured JD data (best effort)
        """
        
        extracted = {
            "role_title": "",
            "required_skills": [],
            "preferred_skills": [],
            "seniority": "",
            "experience_years": "",
            "responsibilities": "",
            "qualifications": "",
            "industries": [],
            "company_size": []
        }
        
        # Extract role title (usually in first few lines)
        lines = jd_text.split('\n')
        for line in lines[:5]:
            if any(keyword in line.lower() for keyword in ['role', 'position', 'title', 'job']):
                # Clean the line
                role = re.sub(r'(role|position|title|job)\s*:?\s*', '', line, flags=re.IGNORECASE)
                extracted["role_title"] = role.strip()
                break
        
        # Extract experience years
        exp_patterns = [
            r'(\d+\+?)\s*(?:years?|yrs?)',
            r'(\d+-\d+)\s*(?:years?|yrs?)'
        ]
        for pattern in exp_patterns:
            match = re.search(pattern, jd_text, re.IGNORECASE)
            if match:
                extracted["experience_years"] = match.group(1)
                break
        
        # Extract seniority
        seniority_keywords = {
            'junior': ['junior', 'jr', 'entry', 'associate'],
            'mid': ['mid', 'intermediate', 'mid-level'],
            'senior': ['senior', 'sr', 'lead'],
            'lead': ['lead', 'principal', 'staff']
        }
        
        for level, keywords in seniority_keywords.items():
            if any(keyword in jd_text.lower() for keyword in keywords):
                extracted["seniority"] = level.capitalize()
                break
        
        # Extract common tech skills
        common_skills = [
            'Python', 'JavaScript', 'Java', 'C++', 'React', 'Angular', 'Vue',
            'Node.js', 'Django', 'Flask', 'Spring', 'AWS', 'Azure', 'GCP',
            'Docker', 'Kubernetes', 'MongoDB', 'PostgreSQL', 'MySQL',
            'Git', 'CI/CD', 'REST', 'GraphQL', 'TypeScript', 'Go', 'Rust'
        ]
        
        found_skills = []
        for skill in common_skills:
            # Case-insensitive search with word boundaries
            if re.search(r'\b' + re.escape(skill) + r'\b', jd_text, re.IGNORECASE):
                found_skills.append(skill)
        
        extracted["required_skills"] = found_skills
        
        return extracted


# ================================================================
# HELPER FUNCTIONS
# ================================================================

def validate_jd_data(jd_data: Dict) -> bool:
    """
    Validate extracted JD data.
    
    Args:
        jd_data: Extracted JD data
    
    Returns:
        True if valid, False otherwise
    """
    
    # Must have at least role title or some skills
    has_role = bool(jd_data.get("role_title"))
    has_skills = bool(jd_data.get("required_skills"))
    
    return has_role or has_skills


def summarize_jd(jd_data: Dict) -> str:
    """
    Create human-readable summary of JD data.
    
    Args:
        jd_data: Extracted JD data
    
    Returns:
        Summary string
    """
    
    role = jd_data.get("role_title", "Unknown Role")
    skills = ", ".join(jd_data.get("required_skills", [])[:5])
    exp = jd_data.get("experience_years", "Not specified")
    seniority = jd_data.get("seniority", "Not specified")
    
    summary = f"""**{role}**
**Experience:** {seniority} ({exp} years)
**Key Skills:** {skills}"""
    
    return summary