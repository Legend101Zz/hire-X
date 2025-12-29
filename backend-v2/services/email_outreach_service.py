
"""
Email Outreach Service
======================
Comprehensive email service for candidate outreach.

Features:
- Multiple provider support (Gmail, SendGrid, SES, Resend)
- AI-powered personalized email generation
- HTML email templates with inline CSS
- Email tracking pixel support
- Retry logic and error handling
- Rate limiting

Providers Supported:
- Gmail SMTP (development)
- SendGrid (recommended for production)
- AWS SES (for scale)
- Resend (modern alternative)
- Generic SMTP

Author: NeuraLeap Engineering
Version: 2.0
"""

import asyncio
import base64
import json
import os
import re
import ssl
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional, Tuple

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

from core.config import settings
from core.logging_config import get_logger
from models.email_models import (EmailPlaceholder, EmailProviderStatus,
                                 EmailTemplate, EmailTemplateType,
                                 GeneratedEmailContent, SentEmail,
                                 get_default_templates)
from models.pipeline_models import (JobContext, OutreachEmailRecord,
                                    OutreachStatus, OutreachType,
                                    PipelineCandidate)

logger = get_logger(__name__)


# ============================================================================
# EMAIL PROVIDER ABSTRACT BASE
# ============================================================================

class EmailProvider(ABC):
    """Abstract base class for email providers."""
    
    @abstractmethod
    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Send an email.
        
        Returns:
            Dict with 'success', 'message_id', 'error' keys
        """
        pass
    
    @abstractmethod
    async def check_health(self) -> bool:
        """Check if the provider is healthy."""
        pass


# ============================================================================
# GMAIL SMTP PROVIDER
# ============================================================================

class GmailSMTPProvider(EmailProvider):
    """Gmail SMTP email provider using aiosmtplib."""
    
    def __init__(
        self,
        host: str = "smtp.gmail.com",
        port: int = 587,
        username: str = None,
        password: str = None,
        use_tls: bool = True
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_tls = use_tls
        
        if not self.username or not self.password:
            logger.warning("⚠️ Gmail SMTP credentials not configured")
    
    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send email via Gmail SMTP."""
        try:
            import aiosmtplib

            # Build message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
            msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
            
            if reply_to:
                msg["Reply-To"] = reply_to
            
            # Add custom headers
            if headers:
                for key, value in headers.items():
                    msg[key] = value
            
            # Generate message ID
            message_id = f"<{uuid.uuid4().hex}@neuraleap.co>"
            msg["Message-ID"] = message_id
            
            # Attach parts
            msg.attach(MIMEText(body_plain, "plain", "utf-8"))
            msg.attach(MIMEText(body_html, "html", "utf-8"))
            
            # Send
            await aiosmtplib.send(
                msg,
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                start_tls=self.use_tls,
                timeout=30
            )
            
            logger.info(f"✅ Email sent via Gmail SMTP to {to_email}")
            
            return {
                "success": True,
                "message_id": message_id,
                "provider": "gmail_smtp"
            }
            
        except Exception as e:
            logger.error(f"❌ Gmail SMTP send failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": "gmail_smtp"
            }
    
    async def check_health(self) -> bool:
        """Check Gmail SMTP connection."""
        try:
            import aiosmtplib
            
            smtp = aiosmtplib.SMTP(
                hostname=self.host,
                port=self.port,
                timeout=10
            )
            await smtp.connect()
            if self.use_tls:
                await smtp.starttls()
            await smtp.login(self.username, self.password)
            await smtp.quit()
            return True
        except Exception as e:
            logger.error(f"Gmail SMTP health check failed: {e}")
            return False


# ============================================================================
# SENDGRID PROVIDER
# ============================================================================

class SendGridProvider(EmailProvider):
    """SendGrid email provider."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.base_url = "https://api.sendgrid.com/v3/mail/send"
        
        if not self.api_key:
            logger.warning("⚠️ SendGrid API key not configured")
    
    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send email via SendGrid API."""
        try:
            payload = {
                "personalizations": [
                    {
                        "to": [{"email": to_email, "name": to_name}] if to_name else [{"email": to_email}]
                    }
                ],
                "from": {"email": from_email, "name": from_name} if from_name else {"email": from_email},
                "subject": subject,
                "content": [
                    {"type": "text/plain", "value": body_plain},
                    {"type": "text/html", "value": body_html}
                ]
            }
            
            if reply_to:
                payload["reply_to"] = {"email": reply_to}
            
            if headers:
                payload["headers"] = headers
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                if response.status_code in [200, 202]:
                    message_id = response.headers.get("X-Message-Id", str(uuid.uuid4()))
                    logger.info(f"✅ Email sent via SendGrid to {to_email}")
                    
                    return {
                        "success": True,
                        "message_id": message_id,
                        "provider": "sendgrid"
                    }
                else:
                    error_text = response.text
                    logger.error(f"❌ SendGrid error: {response.status_code} - {error_text}")
                    
                    return {
                        "success": False,
                        "error": f"SendGrid error: {response.status_code}",
                        "provider": "sendgrid"
                    }
                    
        except Exception as e:
            logger.error(f"❌ SendGrid send failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": "sendgrid"
            }
    
    async def check_health(self) -> bool:
        """Check SendGrid API connection."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://api.sendgrid.com/v3/scopes",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"SendGrid health check failed: {e}")
            return False


# ============================================================================
# AWS SES PROVIDER
# ============================================================================

class AWSSESProvider(EmailProvider):
    """AWS SES email provider."""
    
    def __init__(
        self,
        region: str = "ap-south-1",
        access_key_id: str = None,
        secret_access_key: str = None
    ):
        self.region = region
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self._client = None
        
        if not self.access_key_id or not self.secret_access_key:
            logger.warning("⚠️ AWS SES credentials not configured")
    
    def _get_client(self):
        """Get or create boto3 SES client."""
        if self._client is None:
            import boto3
            self._client = boto3.client(
                "ses",
                region_name=self.region,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key
            )
        return self._client
    
    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send email via AWS SES."""
        try:
            client = self._get_client()
            
            source = f"{from_name} <{from_email}>" if from_name else from_email
            
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.send_email(
                    Source=source,
                    Destination={
                        "ToAddresses": [to_email]
                    },
                    Message={
                        "Subject": {"Data": subject, "Charset": "UTF-8"},
                        "Body": {
                            "Text": {"Data": body_plain, "Charset": "UTF-8"},
                            "Html": {"Data": body_html, "Charset": "UTF-8"}
                        }
                    },
                    ReplyToAddresses=[reply_to] if reply_to else []
                )
            )
            
            message_id = response.get("MessageId", str(uuid.uuid4()))
            logger.info(f"✅ Email sent via AWS SES to {to_email}")
            
            return {
                "success": True,
                "message_id": message_id,
                "provider": "aws_ses"
            }
            
        except Exception as e:
            logger.error(f"❌ AWS SES send failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": "aws_ses"
            }
    
    async def check_health(self) -> bool:
        """Check AWS SES connection."""
        try:
            client = self._get_client()
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.get_send_quota()
            )
            return True
        except Exception as e:
            logger.error(f"AWS SES health check failed: {e}")
            return False


# ============================================================================
# RESEND PROVIDER
# ============================================================================

class ResendProvider(EmailProvider):
    """Resend email provider."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.base_url = "https://api.resend.com/emails"
        
        if not self.api_key:
            logger.warning("⚠️ Resend API key not configured")
    
    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send email via Resend API."""
        try:
            from_address = f"{from_name} <{from_email}>" if from_name else from_email
            
            payload = {
                "from": from_address,
                "to": [to_email],
                "subject": subject,
                "html": body_html,
                "text": body_plain
            }
            
            if reply_to:
                payload["reply_to"] = reply_to
            
            if headers:
                payload["headers"] = headers
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    message_id = data.get("id", str(uuid.uuid4()))
                    logger.info(f"✅ Email sent via Resend to {to_email}")
                    
                    return {
                        "success": True,
                        "message_id": message_id,
                        "provider": "resend"
                    }
                else:
                    error_text = response.text
                    logger.error(f"❌ Resend error: {response.status_code} - {error_text}")
                    
                    return {
                        "success": False,
                        "error": f"Resend error: {response.status_code}",
                        "provider": "resend"
                    }
                    
        except Exception as e:
            logger.error(f"❌ Resend send failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": "resend"
            }
    
    async def check_health(self) -> bool:
        """Check Resend API connection."""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://api.resend.com/domains",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Resend health check failed: {e}")
            return False


# ============================================================================
# MOCK PROVIDER (For Development/Testing)
# ============================================================================

class MockEmailProvider(EmailProvider):
    """Mock email provider for development/testing."""
    
    def __init__(self):
        self.sent_emails: List[Dict] = []
    
    async def send(
        self,
        to_email: str,
        to_name: Optional[str],
        from_email: str,
        from_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Mock send - just logs and stores."""
        message_id = f"mock-{uuid.uuid4().hex[:12]}"
        
        email_record = {
            "message_id": message_id,
            "to_email": to_email,
            "to_name": to_name,
            "from_email": from_email,
            "subject": subject,
            "body_plain": body_plain[:200],
            "sent_at": datetime.utcnow().isoformat()
        }
        
        self.sent_emails.append(email_record)
        
        logger.info(f"📧 [MOCK] Email to {to_email}")
        logger.info(f"   Subject: {subject}")
        logger.info(f"   Body preview: {body_plain[:100]}...")
        
        return {
            "success": True,
            "message_id": message_id,
            "provider": "mock"
        }
    
    async def check_health(self) -> bool:
        return True


# ============================================================================
# EMAIL TEMPLATE ENGINE
# ============================================================================

class EmailTemplateEngine:
    """
    Template engine for rendering email templates.
    Supports Jinja2 templates with inline CSS conversion.
    """
    
    # Default CSS styles for emails
    DEFAULT_STYLES = """
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .card {
            background: #ffffff;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .header {
            text-align: center;
            margin-bottom: 24px;
        }
        .logo {
            font-size: 24px;
            font-weight: 700;
            color: #6366f1;
        }
        h1, h2, h3 {
            color: #111827;
            margin-top: 0;
        }
        p {
            margin: 16px 0;
            color: #4b5563;
        }
        .cta-button {
            display: inline-block;
            padding: 14px 28px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 24px 0;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .cta-button:hover {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }
        .highlight-box {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
            text-align: center;
        }
        .highlight-box h2 {
            margin: 0;
            color: #0369a1;
        }
        .tips-box {
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
        }
        .tips-box ul {
            margin: 12px 0 0 0;
            padding-left: 20px;
        }
        .tips-box li {
            margin: 8px 0;
            color: #4b5563;
        }
        .footer {
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #9ca3af;
        }
        .footer a {
            color: #6366f1;
            text-decoration: none;
        }
        .unsubscribe {
            font-size: 12px;
            color: #9ca3af;
            margin-top: 16px;
        }
    """
    
    def __init__(self, templates_dir: str = None):
        """Initialize template engine."""
        self.templates_dir = templates_dir or os.path.join(
            os.path.dirname(__file__), "..", "templates", "emails"
        )
        
        # Ensure templates directory exists
        os.makedirs(self.templates_dir, exist_ok=True)
        
        # Initialize Jinja2
        self.jinja_env = Environment(
            loader=FileSystemLoader(self.templates_dir),
            autoescape=select_autoescape(["html", "xml"])
        )
        
        # Create default templates if they don't exist
        self._create_default_templates()
    
    def _create_default_templates(self):
        """Create default email templates if they don't exist."""
        templates = {
            "base.html": self._get_base_template(),
            "outreach_initial.html": self._get_initial_outreach_template(),
            "outreach_reminder.html": self._get_reminder_template(),
            "booking_confirmation.html": self._get_confirmation_template(),
            "interview_reminder.html": self._get_interview_reminder_template(),
        }
        
        for filename, content in templates.items():
            filepath = os.path.join(self.templates_dir, filename)
            if not os.path.exists(filepath):
                with open(filepath, "w") as f:
                    f.write(content)
                logger.info(f"Created email template: {filename}")
    
    def _get_base_template(self) -> str:
        """Get base HTML template."""
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{{{ subject }}}}</title>
    <style>
        {self.DEFAULT_STYLES}
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <div class="logo">🚀 NeuraLeap</div>
            </div>
            
            {{% block content %}}{{% endblock %}}
            
            <div class="footer">
                <p>Sent with ❤️ by NeuraLeap</p>
                <p class="unsubscribe">
                    If you're not interested, no worries at all - just ignore this email.
                </p>
            </div>
        </div>
    </div>
</body>
</html>"""

    def _get_initial_outreach_template(self) -> str:
        """Get initial outreach template."""
        return """{% extends "base.html" %}

{% block content %}
<p>Hi {{ candidate_first_name }},</p>

<p>{{ opening_line }}</p>

<p>We're looking for a <strong>{{ job_title }}</strong>{% if company_name %} at {{ company_name }}{% endif %} and I think you could be a great fit.</p>

{% if fit_reasons %}
<p>Here's why I reached out to you specifically:</p>
<ul>
{% for reason in fit_reasons %}
    <li>{{ reason }}</li>
{% endfor %}
</ul>
{% endif %}

<p>Would you be open to a quick chat? No pressure - just wanted to see if there might be mutual interest.</p>

<p style="text-align: center;">
    <a href="{{ scheduling_link }}" class="cta-button">Schedule a Chat →</a>
</p>

<p>{{ closing_line }}</p>

<p>Best,<br>
{{ sender_name }}<br>
<span style="color: #9ca3af;">{{ sender_title }}</span></p>
{% endblock %}"""

    def _get_reminder_template(self) -> str:
        """Get reminder template."""
        return """{% extends "base.html" %}

{% block content %}
<p>Hi {{ candidate_first_name }},</p>

<p>Just wanted to follow up on my earlier email about the <strong>{{ job_title }}</strong> role.</p>

<p>I know you're probably busy, but if you're at all interested in exploring this opportunity, I'd love to chat.</p>

<p style="text-align: center;">
    <a href="{{ scheduling_link }}" class="cta-button">Schedule a Chat →</a>
</p>

<p>Either way, hope you're doing well!</p>

<p>Best,<br>
{{ sender_name }}</p>
{% endblock %}"""

    def _get_confirmation_template(self) -> str:
        """Get booking confirmation template."""
        return """{% extends "base.html" %}

{% block content %}
<p>Hi {{ candidate_first_name }},</p>

<p>Great news - your interview is confirmed! 🎉</p>

<div class="highlight-box">
    <h2>📅 {{ formatted_datetime }}</h2>
    <p style="margin: 8px 0 0 0; color: #64748b;">{{ timezone }}</p>
</div>

<p>You'll receive a call from our AI interviewer, <strong>Neura</strong>, at the scheduled time. The interview typically takes about {{ duration_minutes }} minutes.</p>

<div class="tips-box">
    <strong>A few tips to prepare:</strong>
    <ul>
        <li>Find a quiet place with good phone reception</li>
        <li>Have your resume handy for reference</li>
        <li>Relax and be yourself!</li>
    </ul>
</div>

<p>If you need to reschedule, just reply to this email.</p>

<p>Looking forward to speaking with you!</p>

<p>Best,<br>
{{ sender_name }}<br>
<span style="color: #9ca3af;">NeuraLeap Team</span></p>
{% endblock %}"""

    def _get_interview_reminder_template(self) -> str:
        """Get interview reminder template."""
        return """{% extends "base.html" %}

{% block content %}
<p>Hi {{ candidate_first_name }},</p>

<p>Just a friendly reminder that your interview for the <strong>{{ job_title }}</strong> role is coming up! ⏰</p>

<div class="highlight-box" style="background: #fef3c7; border-color: #f59e0b;">
    <h2 style="color: #b45309;">📅 {{ formatted_datetime }}</h2>
    <p style="margin: 8px 0 0 0; color: #92400e;">That's in {{ hours_until }} hours!</p>
</div>

<p>Make sure you're in a quiet place with good phone reception. You'll receive a call from <strong>Neura</strong>, our AI interviewer.</p>

<p>See you soon!</p>

<p>Best,<br>
{{ sender_name }}</p>
{% endblock %}"""

    def render(
        self,
        template_name: str,
        context: Dict[str, Any]
    ) -> Tuple[str, str]:
        """
        Render an email template.
        
        Args:
            template_name: Name of the template file
            context: Template context variables
            
        Returns:
            Tuple of (html_content, plain_text_content)
        """
        try:
            template = self.jinja_env.get_template(template_name)
            html_content = template.render(**context)
            
            # Generate plain text from HTML
            plain_text = self._html_to_plain(html_content)
            
            # Inline CSS for email clients
            try:
                from premailer import transform
                html_content = transform(html_content)
            except ImportError:
                pass  # premailer not installed
            
            return html_content, plain_text
            
        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            raise
    
    def _html_to_plain(self, html: str) -> str:
        """Convert HTML to plain text."""
        # Remove style and script tags
        text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
        
        # Convert links
        text = re.sub(r'<a[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*)</a>', r'\2 (\1)', text)
        
        # Convert line breaks
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'</p>', '\n\n', text)
        text = re.sub(r'</div>', '\n', text)
        text = re.sub(r'<li[^>]*>', '• ', text)
        text = re.sub(r'</li>', '\n', text)
        
        # Remove remaining tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Clean up whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = text.strip()
        
        # Decode HTML entities
        import html
        text = html.unescape(text)
        
        return text


# ============================================================================
# AI EMAIL GENERATOR
# ============================================================================

class AIEmailGenerator:
    """
    AI-powered email content generator.
    Uses LLM to create personalized, human-sounding emails.
    """
    
    def __init__(self, openrouter_api_key: str = None):
        self.openrouter_key = openrouter_api_key
        self.model = "anthropic/claude-sonnet-4.5"  # Fast and cheap
        
        if not self.openrouter_key:
            logger.warning("⚠️ OpenRouter API key not configured - using templates only")
    
    async def generate_outreach_email(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str,
        tone: str = "professional"
    ) -> Dict[str, str]:
        """
        Generate a highly personalized outreach email using full enrichment data.
        
        Args:
            candidate: Full candidate object with enrichment data
            job: Job context
            scheduling_link: Scheduling URL
            tone: "professional" | "friendly" | "casual"
        
        Returns:
            Dict with 'subject', 'body', 'opening_line', 'fit_reasons', 'confidence'
        """
        if not self.openrouter_key:
            return self._get_fallback_content(candidate, job, scheduling_link, tone)
        
        # Extract rich enrichment data
        enrichment = candidate.enrichment.full_enrichment_data or {}
        candidate_data = enrichment.get('candidate', {})
        match_analysis = enrichment.get('match_analysis', {})
        skill_validation = enrichment.get('skill_validation', {})
        response_likelihood = enrichment.get('response_likelihood', {})
        professional_footprint = enrichment.get('professional_footprint', {})
        
        # Build comprehensive context
        candidate_profile = self._build_rich_candidate_profile(
            candidate=candidate,
            candidate_data=candidate_data,
            professional_footprint=professional_footprint,
            skill_validation=skill_validation
        )
        
        job_details = self._build_rich_job_details(job)
        
        # Extract personalization hooks
        personalization_hooks = response_likelihood.get('recommended_approach', {}).get('personalization_hooks', [])
        
        # Match insights
        match_score = match_analysis.get('overall_match_score', candidate.enrichment.match_score or 0)
        strengths = match_analysis.get('strengths', candidate.enrichment.top_strengths or [])[:3]
        
        # Tone-specific instructions
        tone_guidelines = self._get_tone_guidelines(tone)
        
        # Build AI prompt with full context
        prompt = f"""You are a top-tier tech recruiter writing a highly personalized outreach email.

CANDIDATE PROFILE:
{candidate_profile}

PERSONALIZATION OPPORTUNITIES (USE THESE!):
{chr(10).join(f"• {hook}" for hook in personalization_hooks[:5]) if personalization_hooks else "• Strong technical background and career trajectory"}

WHY THIS IS A GREAT MATCH:
- Match Score: {match_score}/100
- Key Strengths: {', '.join(strengths) if strengths else 'Technical skills align well with requirements'}
- Fit Level: {"Excellent" if match_score >= 80 else "Strong" if match_score >= 60 else "Good"}

JOB OPPORTUNITY:
{job_details}

TONE & STYLE:
{tone_guidelines}

EMAIL PSYCHOLOGY PRINCIPLES:
1. SOCIAL PROOF: Reference their GitHub contributions, hackathon wins, certifications, or company achievements
2. RECIPROCITY: Acknowledge their accomplishments genuinely before asking for time
3. SPECIFICITY: Mention exact projects, repos, or achievements (not generic praise)
4. CURIOSITY GAP: Tease interesting role aspects without revealing everything
5. LOW BARRIER: Make scheduling feel effortless and low-commitment

STRICT STRUCTURE (FOLLOW THIS):
1. HOOK (1 sentence): Attention-grabbing opener referencing specific achievement
   Good: "I came across your e-commerce project on GitHub - the React architecture is really clean!"
   Bad: "I came across your profile and was impressed by your background"

2. CONTEXT (2-3 sentences): Why you're reaching out + why they're specifically a fit
   - Connect their actual experience to the role requirements
   - Show you've done homework (mention specific skills, projects, or achievements)
   
3. VALUE PROP (1-2 sentences): What's in it for them beyond "opportunity"
   - Focus on growth, interesting problems, or career advancement
   - Avoid generic "great company culture" claims
   
4. SOFT CTA (1 sentence): Low-pressure invitation
   - "Would you be open to a quick 15-min chat?"
   - NOT "Apply now" or "Send your resume"

CRITICAL RULES:
✅ DO:
- Use SPECIFIC details from their profile (project names, companies, achievements)
- Reference at least ONE concrete thing (GitHub repo, hackathon, certification, blog post)
- Keep body to 80-120 words MAXIMUM (shorter = higher response rates)
- Sound like a human colleague, not a recruiter robot
- Use simple, conversational language
- Make it feel like a 1:1 message, not a mass email

❌ DON'T:
- Use buzzwords: "synergy", "leverage", "rockstar", "ninja", "fast-paced environment"
- Generic openers: "I hope this email finds you well"
- Vague praise: "impressive background", "great experience"
- Corporate jargon or formal language (unless tone is professional)
- Mention salary, benefits, or compensation
- Create false urgency or pressure
- Use emojis in subject line

SUBJECT LINE FORMULAS (Pick based on tone):
Professional: "Quick question about [specific skill/project]"
Friendly: "[Their achievement] caught my attention"
Casual: "Loved your [specific project/work]"

BAD SUBJECTS TO AVOID:
❌ "Exciting Career Opportunity!"
❌ "We're Hiring - Great Role!"
❌ "Amazing Opportunity at [Company]"

SCHEDULING LINK: {scheduling_link}
(Include naturally in closing, not as a big button)

OUTPUT FORMAT (STRICT JSON):
{{
    "subject": "Your compelling subject here (max 50 chars, no emojis)",
    "opening_line": "Personalized hook that shows you know them",
    "fit_reasons": ["Specific reason 1 with details", "Specific reason 2 with details"],
    "body": "Complete email body (80-120 words, starts with opening_line, includes context, value prop, and CTA)",
    "closing_line": "Natural sign-off (1 sentence)",
    "confidence": 0.88,
    "personalization_used": ["specific thing you referenced from their profile"]
}}

IMPORTANT: The 'body' should be the COMPLETE email content (opening + context + value + CTA), ready to send.
Do NOT include "Hi [name]," or signature - those are added automatically.
Start directly with your opening line.

Generate the perfect {tone} outreach email now:"""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openrouter_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://neuraleap.shop"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert recruiter who writes personalized, human-sounding outreach emails that get responses. You always respond with valid JSON and use specific details from candidates' profiles to show genuine interest."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.7,  # Balanced creativity
                        "max_tokens": 600
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    
                    # Parse JSON from response
                    # Sometimes AI wraps in ```json, so clean it
                    content = content.strip()
                    if content.startswith("```json"):
                        content = content[7:]
                    if content.startswith("```"):
                        content = content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()
                    
                    json_match = re.search(r'\{[\s\S]*\}', content)
                    if json_match:
                        email_data = json.loads(json_match.group())
                        
                        # Validate required fields
                        if email_data.get('subject') and email_data.get('body'):
                            logger.info(f"✅ AI generated {tone} email for {candidate.display_name} (confidence: {email_data.get('confidence', 0.75)})")
                            return email_data
                
                logger.warning("AI email generation failed, using fallback")
                
        except Exception as e:
            logger.error(f"AI email generation error: {e}", exc_info=True)
        
        return self._get_fallback_content(candidate, job, scheduling_link, tone)
    
    def _build_rich_candidate_profile(
        self,
        candidate: PipelineCandidate,
        candidate_data: dict,
        professional_footprint: dict,
        skill_validation: dict
    ) -> str:
        """Build comprehensive candidate profile using all enrichment data."""
        
        profile_parts = []
        
        # Basic Info
        profile_parts.append(f"Name: {candidate.name}")
        
        if candidate.current_title:
            profile_parts.append(f"Current Role: {candidate.current_title}")
        elif candidate.headline:
            profile_parts.append(f"Status: {candidate.headline}")
        
        if candidate.current_company:
            profile_parts.append(f"Company: {candidate.current_company}")
        
        profile_parts.append(f"Location: {candidate.location or 'Not specified'}")
        
        # Experience
        if candidate.experience_years:
            profile_parts.append(f"Experience: {candidate.experience_years} years")
        
        exp_summary = candidate_data.get('experience_summary', {})
        if exp_summary:
            profile_parts.append(f"Professional Roles: {exp_summary.get('professional_roles', 0)}")
            profile_parts.append(f"Internships: {exp_summary.get('internships', 0)}")
        
        # Validated Skills (from enrichment)
        validated_skills = skill_validation.get('validated_skills', [])[:7]
        if validated_skills:
            profile_parts.append(f"✓ Verified Skills: {', '.join(validated_skills)}")
        elif candidate.skills:
            profile_parts.append(f"Skills: {', '.join(candidate.skills[:7])}")
        
        # Education
        education = candidate_data.get('education', [])
        if education:
            edu = education[0]
            school = edu.get('school', '')
            degree = edu.get('degree', '')
            if school or degree:
                profile_parts.append(f"Education: {degree} from {school}".strip())
        
        # Professional Footprint Highlights
        verified_profiles = professional_footprint.get('verified_profiles', [])
        evidence_found = professional_footprint.get('evidence_found', [])
        news_mentions = professional_footprint.get('news_mentions', [])
        
        # GitHub
        github = next((p for p in verified_profiles if p.get('platform') == 'GitHub'), None)
        if github:
            key_data = github.get('key_data', {})
            repos = key_data.get('repos', 0)
            followers = key_data.get('followers', 0)
            languages = key_data.get('top_languages', [])
            profile_parts.append(f"GitHub: {repos} repos, {followers} followers, languages: {', '.join(languages[:3])}")
        
        # Achievements/Evidence
        if evidence_found:
            profile_parts.append("\nNotable Achievements:")
            for evidence in evidence_found[:3]:
                desc = evidence.get('description', '')
                evidence_type = evidence.get('evidence_type', '')
                if desc:
                    profile_parts.append(f"  • {desc} ({evidence_type})")
        
        # News/Recognition
        if news_mentions:
            profile_parts.append("\nPublic Recognition:")
            for mention in news_mentions[:2]:
                title = mention.get('title', '')
                if title:
                    profile_parts.append(f"  • {title}")
        
        # About/Bio (if available and meaningful)
        about = candidate_data.get('about', '')
        if about and len(about) > 50:
            # Extract first meaningful sentence or 200 chars
            bio_preview = about[:250].strip()
            if len(about) > 250:
                bio_preview += "..."
            profile_parts.append(f"\nBio: {bio_preview}")
        
        # Digital Presence Score
        footprint_score = professional_footprint.get('overall_footprint_assessment', {}).get('digital_presence_score', 0)
        if footprint_score:
            profile_parts.append(f"\nDigital Presence: {footprint_score}/100 ({professional_footprint.get('overall_footprint_assessment', {}).get('presence_level', 'Unknown')})")
        
        return '\n'.join(profile_parts)
    
    def _build_rich_job_details(self, job: JobContext) -> str:
        """Build compelling job details."""
        
        details = []
        details.append(f"Position: {job.job_title}")
        details.append(f"Company: {job.company_name or 'A fast-growing tech company'}")
        
        if job.department:
            details.append(f"Department: {job.department}")
        
        if job.required_skills:
            details.append(f"Key Technologies: {', '.join(job.required_skills[:7])}")
        
        if job.nice_to_have_skills:
            details.append(f"Nice-to-Have: {', '.join(job.nice_to_have_skills[:5])}")
        
        if job.experience_required:
            details.append(f"Experience Level: {job.experience_required}")
        
        # Work setup
        location_text = ', '.join(job.location_requirements) if job.location_requirements else job.remote_policy.capitalize()
        details.append(f"Work Setup: {location_text}")
        
        # REMOVED: Industry preferences (field doesn't exist in JobContext model)
        # if job.industry_preferences:
        #     details.append(f"Industry Focus: {', '.join(job.industry_preferences[:3])}")
        
        # JD highlights (if available)
        if job.jd_text and len(job.jd_text) > 100:
            # Extract first meaningful paragraph
            paragraphs = [p.strip() for p in job.jd_text.split('\n\n') if len(p.strip()) > 50]
            if paragraphs:
                details.append(f"\nRole Highlights: {paragraphs[0][:300]}")
        
        # Evaluation criteria (shows what matters)
        if job.key_evaluation_criteria:
            details.append(f"\nWhat We Value: {', '.join(job.key_evaluation_criteria[:4])}")
        
        return '\n'.join(details)

    def _get_tone_guidelines(self, tone: str) -> str:
        """Get detailed tone guidelines for AI."""
        
        guidelines = {
            "professional": """
TONE: Corporate Professional
- Use polished, formal language with proper grammar
- Address candidate respectfully and professionally
- Focus on career growth, professional development, and opportunity
- Think: Senior recruiter at Google, Microsoft, or Goldman Sachs
- Vocabulary: "I noticed", "would like to discuss", "opportunity to explore", "delighted to connect"
- Structure: Formal but warm, clear and direct
- Sign-off will be added automatically
""",
            
            "friendly": """
TONE: Warm & Approachable Professional
- Conversational but professional - like talking to a respected colleague
- Show genuine enthusiasm about their work and achievements
- Balance professionalism with personality and authenticity
- Think: Friendly team lead or colleague making an introduction
- Vocabulary: "I came across", "really impressed by", "would love to chat", "thought you'd be great"
- Structure: Relaxed but respectful, engaging and personal
- Sign-off will be added automatically
""",
            
            "casual": """
TONE: Relaxed & Authentic
- Write like texting a friend (but a professional friend)
- Short sentences, simple words, natural flow
- Be real, human, and down-to-earth - avoid corporate speak entirely
- Think: Startup founder or tech lead reaching out directly
- Vocabulary: "Saw your", "loved your", "thought you'd be perfect", "up for a chat?"
- Structure: Punchy and direct, like a message not a letter
- Sign-off will be added automatically
"""
        }
        
        return guidelines.get(tone, guidelines["professional"])
    
    def _get_fallback_content(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str,
        tone: str = "professional"
    ) -> Dict[str, str]:
        """Enhanced fallback templates using enrichment data."""
        
        first_name = candidate.first_name or candidate.name.split()[0] if candidate.name else "there"
        
        # Try to extract specific achievement from enrichment
        enrichment = candidate.enrichment.full_enrichment_data or {}
        evidence = enrichment.get('professional_footprint', {}).get('evidence_found', [])
        news = enrichment.get('professional_footprint', {}).get('news_mentions', [])
        github = next(
            (p for p in enrichment.get('professional_footprint', {}).get('verified_profiles', []) 
             if p.get('platform') == 'GitHub'),
            None
        )
        
        achievement = None
        if news:
            achievement = news[0].get('title', '')
        elif evidence:
            achievement = evidence[0].get('description', '')
        elif github:
            repos = github.get('key_data', {}).get('repos', 0)
            if repos > 5:
                achievement = f"{repos} GitHub repositories"
        
        # Get verified skills
        skills = enrichment.get('skill_validation', {}).get('validated_skills', candidate.skills)[:2]
        skills_text = ' and '.join(skills) if skills else 'your technical background'
        
        # Get current status
        status = candidate.current_title or candidate.headline or "your professional background"
        company_text = f" at {candidate.current_company}" if candidate.current_company else ""
        
        templates = {
            "professional": {
                "subject": f"{job.job_title} opportunity",
                "body": f"""{"I came across " + achievement + " and was" if achievement else "I was"} impressed by your expertise in {skills_text}.

We're seeking a {job.job_title} at {job.company_name or 'our organization'}, and your background{company_text} aligns well with our requirements.

I would appreciate the opportunity to discuss this role with you at your convenience. Would you be open to a brief conversation?""",
                "opening_line": f"{"I noticed " + achievement if achievement else "Your work in " + skills_text + " caught my attention"}",
                "fit_reasons": [
                    f"Your experience with {skills_text}",
                    f"Your background{company_text}"
                ],
                "closing_line": "Looking forward to the possibility of speaking with you.",
                "confidence": 0.6
            },
            
            "friendly": {
                "subject": f"Great fit for {job.job_title}",
                "body": f"""{"I saw " + achievement + " - really impressive work!" if achievement else "Your background in " + skills_text + " caught my attention!"}

We're hiring a {job.job_title}{" at " + job.company_name if job.company_name else ""} and I think you'd be a great fit. The role involves working with {skills_text} and building some really interesting things.

Would you be up for a quick 15-min chat to learn more? No pressure at all!""",
                "opening_line": f"{"I saw " + achievement + " - impressive!" if achievement else "Your " + skills_text + " work really stood out to me"}",
                "fit_reasons": [
                    f"Your {skills_text} experience",
                    f"Your work{company_text} shows great potential"
                ],
                "closing_line": "Would love to connect if you're interested!",
                "confidence": 0.65
            },
            
            "casual": {
                "subject": f"Quick question about {job.job_title}",
                "body": f"""{"Saw " + achievement + " and" if achievement else "Your"} {skills_text} work is exactly what we need for our {job.job_title} role.

We're {"building something cool at " + job.company_name if job.company_name else "a growing team"} and think you'd be perfect for it{company_text and " given your experience" + company_text or ""}.

Up for a quick call this week?""",
                "opening_line": f"{"Saw " + achievement if achievement else "Your " + skills_text + " work is spot on"}",
                "fit_reasons": [
                    f"{skills_text} - exactly what we need",
                    f"Your background{company_text} is a great match"
                ],
                "closing_line": "Let me know if you're interested!",
                "confidence": 0.65
            }
        }
        
        template = templates.get(tone, templates["professional"])
        
        return {
            **template,
            "personalization_used": ["template-based", achievement or skills_text]
        }


    def _build_candidate_context(self, candidate: PipelineCandidate) -> str:
        """Build candidate context string for prompt."""
        parts = [f"Name: {candidate.display_name}"]
        
        if candidate.current_title:
            parts.append(f"Current role: {candidate.current_title}")
        if candidate.current_company:
            parts.append(f"Company: {candidate.current_company}")
        if candidate.experience_years:
            parts.append(f"Experience: {candidate.experience_years} years")
        if candidate.skills:
            parts.append(f"Key skills: {', '.join(candidate.skills[:5])}")
        if candidate.location:
            parts.append(f"Location: {candidate.location}")
        
        # Add enrichment insights if available
        if candidate.enrichment.top_strengths:
            parts.append(f"Strengths: {', '.join(candidate.enrichment.top_strengths[:3])}")
        if candidate.enrichment.match_score:
            parts.append(f"Match score: {candidate.enrichment.match_score}%")
        
        return "\n".join(parts)
    
    def _build_job_context(self, job: JobContext) -> str:
        """Build job context string for prompt."""
        parts = [f"Title: {job.job_title}"]
        
        if job.company_name:
            parts.append(f"Company: {job.company_name}")
        if job.required_skills:
            parts.append(f"Required skills: {', '.join(job.required_skills[:5])}")
        if job.experience_required:
            parts.append(f"Experience needed: {job.experience_required}")
        if job.location_requirements:
            parts.append(f"Location: {', '.join(job.location_requirements)}")
        
        return "\n".join(parts)
    
    def _get_fallback_content(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str
    ) -> Dict[str, str]:
        """Get fallback email content when AI is unavailable."""
        first_name = candidate.display_name.split()[0] if candidate.display_name else "there"
        
        opening = f"I noticed your work"
        if candidate.current_company:
            opening += f" at {candidate.current_company}"
        opening += " and thought you might be a great fit for a role I'm hiring for."
        
        fit_reasons = []
        if candidate.skills:
            fit_reasons.append(f"Your experience with {candidate.skills[0]}")
        if candidate.experience_years:
            fit_reasons.append(f"Your {candidate.experience_years}+ years of experience")
        
        return {
            "subject": f"Quick question about {job.job_title}",
            "opening_line": opening,
            "fit_reasons": fit_reasons or ["Your professional background looks impressive"],
            "body": f"We're looking for a {job.job_title}{' at ' + job.company_name if job.company_name else ''} and I think you could be a great fit. Would you be open to a quick chat? No pressure - just wanted to see if there might be mutual interest.",
            "closing_line": "Looking forward to hearing from you!"
        }


# ============================================================================
# MAIN EMAIL OUTREACH SERVICE
# ============================================================================

class EmailOutreachService:
    """
    Main email service for candidate outreach.
    
    Combines:
    - Multiple email providers
    - AI-powered email generation
    - Template rendering
    - Tracking and analytics
    """
    
    def __init__(
        self,
        provider: str = None,
        openrouter_api_key: str = None,
        templates_dir: str = None,
        **provider_config
    ):
        """
        Initialize email service.
        
        Args:
            provider: Email provider ('gmail', 'sendgrid', 'ses', 'resend', 'mock')
            openrouter_api_key: For AI email generation
            templates_dir: Custom templates directory
            **provider_config: Provider-specific configuration
        """
        # Determine provider
        provider = provider or os.getenv("EMAIL_PROVIDER", "mock")
        
        # Initialize email provider
        self.provider = self._create_provider(provider, provider_config)
        
        # Initialize AI generator
        self.ai_generator = AIEmailGenerator(
            openrouter_api_key=openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
        )
        
        # Initialize template engine
        self.template_engine = EmailTemplateEngine(templates_dir)
        
        # Default sender info
        self.from_email = os.getenv("SMTP_FROM_EMAIL", "careers@neuraleap.co")
        self.from_name = os.getenv("SMTP_FROM_NAME", "NeuraLeap Careers")
        
        logger.info(f"✅ EmailOutreachService initialized")
        logger.info(f"   Provider: {provider}")
        logger.info(f"   From: {self.from_name} <{self.from_email}>")
    
    def _create_provider(self, provider: str, config: Dict) -> EmailProvider:
        """Create email provider instance."""
        if provider == "gmail":
            return GmailSMTPProvider(
                host=config.get("host") or os.getenv("SMTP_HOST", "smtp.gmail.com"),
                port=int(config.get("port") or os.getenv("SMTP_PORT", "587")),
                username=config.get("username") or os.getenv("SMTP_USERNAME"),
                password=config.get("password") or os.getenv("SMTP_PASSWORD"),
                use_tls=config.get("use_tls", True)
            )
        
        elif provider == "sendgrid":
            return SendGridProvider(
                api_key=config.get("api_key") or os.getenv("SENDGRID_API_KEY")
            )
        
        elif provider == "ses":
            return AWSSESProvider(
                region=config.get("region") or os.getenv("AWS_SES_REGION", "ap-south-1"),
                access_key_id=config.get("access_key_id") or os.getenv("AWS_ACCESS_KEY_ID"),
                secret_access_key=config.get("secret_access_key") or os.getenv("AWS_SECRET_ACCESS_KEY")
            )
        
        elif provider == "resend":
            return ResendProvider(
                api_key=config.get("api_key") or os.getenv("RESEND_API_KEY")
            )
        
        else:
            logger.warning(f"Unknown provider '{provider}', using mock")
            return MockEmailProvider()
    
    # =========================================================================
    # OUTREACH EMAILS
    # =========================================================================
    
    async def generate_outreach_email(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str,
        tone: str = "professional"
    ) -> Dict[str, str]:
        """
        Generate a personalized outreach email (doesn't store, just generates).
        
        Returns:
            Dict with 'subject', 'body', 'body_html'
        """
        # Generate AI content
        ai_content = await self.ai_generator.generate_outreach_email(
            candidate=candidate,
            job=job,
            scheduling_link=scheduling_link,
            tone=tone
        )
        
        # Build template context
        first_name = candidate.display_name.split()[0] if candidate.display_name else "there"
        
        context = {
            "subject": ai_content.get("subject", f"Quick question about {job.job_title}"),
            "candidate_first_name": first_name,
            "candidate_name": candidate.display_name,
            "job_title": job.job_title,
            "company_name": job.company_name,
            "opening_line": ai_content.get("opening_line", ""),
            "fit_reasons": ai_content.get("fit_reasons", []),
            "closing_line": ai_content.get("closing_line", "Looking forward to hearing from you!"),
            "scheduling_link": scheduling_link,
            "sender_name": self.from_name.replace(" Careers", ""),
            "sender_title": "Recruitment Team"
        }
        
        # Render template
        body_html, body_plain_template = self.template_engine.render(
            "outreach_initial.html",
            context
        )
        
        # Use AI-generated body if available
        if ai_content.get("body"):
            body_plain = self._build_plain_email(
                first_name=first_name,
                body=ai_content["body"],
                scheduling_link=scheduling_link,
                closing=ai_content.get("closing_line", "")
            )
        else:
            body_plain = body_plain_template
            
        return {
            "subject": context["subject"],
            "body": body_plain,
            "body_html": body_html,
            "scheduling_link": scheduling_link,
            "tone": tone,
            "ai_confidence": ai_content.get("confidence", 0.75)
        }
    
    def _build_plain_email(
        self,
        first_name: str,
        body: str,
        scheduling_link: str,
        closing: str
    ) -> str:
        """Build plain text email."""
        return f"""Hi {first_name},

{body}

Schedule a chat: {scheduling_link}

{closing}

Best,
{self.from_name.replace(" Careers", "")}
NeuraLeap Team

---
If you're not interested, no worries - just ignore this email."""
    
    async def send_outreach(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str
    ) -> Dict[str, Any]:
        """
        Generate and send outreach email to a candidate.
        
        Returns:
            Dict with send result and email content
        """
        if not candidate.contact.email:
            return {
                "success": False,
                "error": "No email address for candidate"
            }
        
        # Generate email
        email_content = await self.generate_outreach_email(
            candidate=candidate,
            job=job,
            scheduling_link=scheduling_link
        )
        
        # Send email
        result = await self.send_email(
            to_email=candidate.contact.email,
            to_name=candidate.display_name,
            subject=email_content["subject"],
            body_html=email_content["body_html"],
            body_plain=email_content["body"]
        )
        
        return {
            **result,
            "email_content": email_content
        }
    
    async def generate_and_store_draft(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str,
        tone: str = "professional"
    ) -> Dict[str, str]:
        """
        Generate email draft and store in candidate's outreach record.
        This is called by the preview endpoint.
        
        Returns:
            Dict with subject, body_html, body_plain, scheduling_link
        """
        # Generate AI content
        email_content = await self.generate_outreach_email(
            candidate=candidate,
            job=job,
            scheduling_link=scheduling_link,
            tone=tone
        )
        
        # Create or update outreach record
        if not candidate.outreach:
            from models.pipeline_models import (OutreachRecord,
                                                generate_scheduling_token)
            candidate.outreach = OutreachRecord(
                scheduling_token=generate_scheduling_token(),
                scheduling_link=scheduling_link
            )
        
        # Store as draft email (clear any existing draft)
        draft_emails = [e for e in candidate.outreach.emails if e.status != OutreachStatus.PENDING]
        
        # Create new draft
        from models.pipeline_models import OutreachEmailRecord, OutreachType
        draft = OutreachEmailRecord(
            email_type=OutreachType.INITIAL,
            subject=email_content["subject"],
            body_plain=email_content["body"],
            body_html=email_content.get("body_html", ""),
            status=OutreachStatus.PENDING  # PENDING = draft
        )
        
        # Replace drafts
        candidate.outreach.emails = draft_emails + [draft]
        
        logger.info(f"📧 Generated and stored draft email for {candidate.display_name}")
        
        return email_content
    
    
    # =========================================================================
    # REMINDER EMAILS
    # =========================================================================
    
    async def send_reminder(
        self,
        candidate: PipelineCandidate,
        job: JobContext,
        scheduling_link: str
    ) -> Dict[str, Any]:
        """Send a reminder email to a candidate."""
        if not candidate.contact.email:
            return {"success": False, "error": "No email"}
        
        first_name = candidate.display_name.split()[0] if candidate.display_name else "there"
        
        context = {
            "subject": f"Quick follow-up: {job.job_title}",
            "candidate_first_name": first_name,
            "job_title": job.job_title,
            "scheduling_link": scheduling_link,
            "sender_name": self.from_name.replace(" Careers", "")
        }
        
        body_html, body_plain = self.template_engine.render(
            "outreach_reminder.html",
            context
        )
        
        return await self.send_email(
            to_email=candidate.contact.email,
            to_name=candidate.display_name,
            subject=context["subject"],
            body_html=body_html,
            body_plain=body_plain
        )
    
    # =========================================================================
    # BOOKING CONFIRMATION
    # =========================================================================
    
    async def send_booking_confirmation(
        self,
        candidate_email: str,
        candidate_name: str,
        scheduled_datetime: str,
        timezone: str,
        job_title: str,
        duration_minutes: int = 30
    ) -> Dict[str, Any]:
        """Send interview booking confirmation."""
        first_name = candidate_name.split()[0] if candidate_name else "there"
        
        # Parse datetime for formatting
        dt = datetime.fromisoformat(scheduled_datetime.replace("Z", "+00:00"))
        formatted_datetime = dt.strftime("%A, %B %d at %I:%M %p")
        
        context = {
            "subject": f"Interview Confirmed: {job_title}",
            "candidate_first_name": first_name,
            "job_title": job_title,
            "formatted_datetime": formatted_datetime,
            "timezone": timezone,
            "duration_minutes": duration_minutes,
            "sender_name": self.from_name.replace(" Careers", "")
        }
        
        body_html, body_plain = self.template_engine.render(
            "booking_confirmation.html",
            context
        )
        
        return await self.send_email(
            to_email=candidate_email,
            to_name=candidate_name,
            subject=context["subject"],
            body_html=body_html,
            body_plain=body_plain
        )
    
    # =========================================================================
    # INTERVIEW REMINDER
    # =========================================================================
    
    async def send_interview_reminder(
        self,
        candidate_email: str,
        candidate_name: str,
        scheduled_datetime: str,
        timezone: str,
        job_title: str,
        hours_until: int
    ) -> Dict[str, Any]:
        """Send interview reminder."""
        first_name = candidate_name.split()[0] if candidate_name else "there"
        
        dt = datetime.fromisoformat(scheduled_datetime.replace("Z", "+00:00"))
        formatted_datetime = dt.strftime("%A, %B %d at %I:%M %p")
        
        context = {
            "subject": f"Reminder: Interview in {hours_until} hours",
            "candidate_first_name": first_name,
            "job_title": job_title,
            "formatted_datetime": formatted_datetime,
            "timezone": timezone,
            "hours_until": hours_until,
            "sender_name": self.from_name.replace(" Careers", "")
        }
        
        body_html, body_plain = self.template_engine.render(
            "interview_reminder.html",
            context
        )
        
        return await self.send_email(
            to_email=candidate_email,
            to_name=candidate_name,
            subject=context["subject"],
            body_html=body_html,
            body_plain=body_plain
        )
    
    # =========================================================================
    # CORE SEND METHOD
    # =========================================================================
    
    async def send_email(
        self,
        to_email: str,
        to_name: Optional[str],
        subject: str,
        body_html: str,
        body_plain: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Send an email with retry logic.
        
        Args:
            to_email: Recipient email
            to_name: Recipient name
            subject: Email subject
            body_html: HTML content
            body_plain: Plain text content
            from_email: Override from email
            from_name: Override from name
            reply_to: Reply-to address
            headers: Additional headers
            max_retries: Number of retry attempts
            
        Returns:
            Dict with success status and message_id
        """
        from_email = from_email or self.from_email
        from_name = from_name or self.from_name
        
        last_error = None
        
        for attempt in range(max_retries):
            try:
                result = await self.provider.send(
                    to_email=to_email,
                    to_name=to_name,
                    from_email=from_email,
                    from_name=from_name,
                    subject=subject,
                    body_html=body_html,
                    body_plain=body_plain,
                    reply_to=reply_to,
                    headers=headers
                )
                
                if result.get("success"):
                    return result
                
                last_error = result.get("error", "Unknown error")
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Email send attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        return {
            "success": False,
            "error": last_error,
            "attempts": max_retries
        }
    
    # =========================================================================
    # HEALTH CHECK
    # =========================================================================
    
    async def check_health(self) -> Dict[str, Any]:
        """Check email service health."""
        provider_healthy = await self.provider.check_health()
        
        return {
            "healthy": provider_healthy,
            "provider": self.provider.__class__.__name__,
            "from_email": self.from_email,
            "ai_available": bool(self.ai_generator.openrouter_key)
        }


# ============================================================================
# EXPORT
# ============================================================================

__all__ = [
    "EmailOutreachService",
    "EmailProvider",
    "GmailSMTPProvider",
    "SendGridProvider", 
    "AWSSESProvider",
    "ResendProvider",
    "MockEmailProvider",
    "EmailTemplateEngine",
    "AIEmailGenerator",
]