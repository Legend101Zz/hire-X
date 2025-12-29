"""
Background Scheduler Service
============================
Manages periodic background tasks for the recruitment pipeline.

Tasks:
- Trigger scheduled interviews (every 2 minutes)
- Send reminder emails (every hour)
- Mark no-response candidates (every 6 hours)
- Cleanup expired scheduling links (daily)

"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from core.logging_config import get_logger

logger = get_logger(__name__)


class BackgroundScheduler:
    """
    Manages all background periodic tasks for the recruitment system.
    
    Uses APScheduler with AsyncIO support for non-blocking task execution.
    """
    
    def __init__(self, pipeline_service=None):
        """
        Initialize scheduler.
        
        Args:
            pipeline_service: PipelineService instance for task execution
        """
        self.pipeline_service = pipeline_service
        self.scheduler = AsyncIOScheduler()
        self._running = False
        
        logger.info("📅 BackgroundScheduler initialized")
    
    def start(self):
        """Start all scheduled jobs."""
        if self._running:
            logger.warning("⚠️  Scheduler already running")
            return
        
        if not self.pipeline_service:
            logger.error("❌ Cannot start scheduler: PipelineService not configured")
            return
        
        # =================================================================
        # INTERVIEW TRIGGERING - Every 2 minutes
        # =================================================================
        self.scheduler.add_job(
            func=self._trigger_interviews_job,
            trigger=IntervalTrigger(minutes=2),
            id='trigger_interviews',
            name='Trigger scheduled interviews',
            replace_existing=True,
            max_instances=1,  # Prevent overlapping runs
            coalesce=True     # If missed, run once (not multiple times)
        )
        logger.info("   ✓ Scheduled: Interview triggering (every 2 min)")
        
        # =================================================================
        # REMINDER EMAILS - Every hour
        # =================================================================
        self.scheduler.add_job(
            func=self._send_reminders_job,
            trigger=IntervalTrigger(hours=1),
            id='send_reminders',
            name='Send reminder emails',
            replace_existing=True,
            max_instances=1
        )
        logger.info("   ✓ Scheduled: Reminder emails (hourly)")
        
        # =================================================================
        # NO-RESPONSE MARKING - Every 6 hours
        # =================================================================
        self.scheduler.add_job(
            func=self._mark_no_response_job,
            trigger=IntervalTrigger(hours=6),
            id='mark_no_response',
            name='Mark no-response candidates',
            replace_existing=True,
            max_instances=1
        )
        logger.info("   ✓ Scheduled: No-response marking (every 6h)")
        
        # =================================================================
        # CLEANUP - Daily at 3 AM
        # =================================================================
        self.scheduler.add_job(
            func=self._cleanup_job,
            trigger=CronTrigger(hour=3, minute=0),
            id='daily_cleanup',
            name='Daily cleanup tasks',
            replace_existing=True,
            max_instances=1
        )
        logger.info("   ✓ Scheduled: Daily cleanup (3 AM)")
        
        # =================================================================
        # HEALTH CHECK - Every 30 minutes
        # =================================================================
        self.scheduler.add_job(
            func=self._health_check_job,
            trigger=IntervalTrigger(minutes=30),
            id='health_check',
            name='Scheduler health check',
            replace_existing=True,
            max_instances=1
        )
        logger.info("   ✓ Scheduled: Health check (every 30 min)")
        
        # Start the scheduler
        self.scheduler.start()
        self._running = True
        
        logger.info("✅ Background scheduler started successfully")
        logger.info(f"   Active jobs: {len(self.scheduler.get_jobs())}")
    
    def shutdown(self):
        """Gracefully shutdown the scheduler."""
        if not self._running:
            return
        
        logger.info("🛑 Shutting down background scheduler...")
        
        try:
            self.scheduler.shutdown(wait=True)
            self._running = False
            logger.info("✅ Scheduler shutdown complete")
        except Exception as e:
            logger.error(f"❌ Error during scheduler shutdown: {e}")
    
    def get_status(self) -> dict:
        """Get scheduler status and job info."""
        if not self._running:
            return {"running": False}
        
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        
        return {
            "running": True,
            "jobs": jobs,
            "job_count": len(jobs)
        }
    
    # =====================================================================
    # JOB IMPLEMENTATIONS
    # =====================================================================
    
    async def _trigger_interviews_job(self):
        """
        Job: Trigger scheduled interviews.
        
        Runs every 2 minutes to check for interviews that need to be started.
        """
        logger.info("🎤 Running interview trigger job...")
        
        try:
            result = await self.pipeline_service.trigger_scheduled_interviews()
            
            triggered = result.get("triggered", 0)
            if triggered > 0:
                logger.info(f"   ✅ Triggered {triggered} interview(s)")
            else:
                logger.info("   ℹ️  No interviews to trigger")
                
        except Exception as e:
            logger.error(f"   ❌ Interview trigger job failed: {e}", exc_info=True)
    
    async def _send_reminders_job(self):
        """
        Job: Send reminder emails to non-responding candidates.
        
        Runs hourly to check all active pipelines for candidates
        who need reminder emails.
        """
        logger.info("📧 Running reminder email job...")
        
        try:
            # Get all active pipelines
            cursor = self.pipeline_service.pipelines_collection.find({
                "status": "active",
                "is_active": True
            })
            
            pipelines = await cursor.to_list(length=1000)
            
            total_reminders = 0
            
            for pipeline_doc in pipelines:
                pipeline_id = pipeline_doc.get("pipeline_id")
                if not pipeline_id:
                    continue
                
                try:
                    result = await self.pipeline_service.send_reminder_emails(pipeline_id)
                    sent = result.get("reminders_sent", 0)
                    total_reminders += sent
                    
                    if sent > 0:
                        logger.info(f"   📧 Sent {sent} reminder(s) for {pipeline_id}")
                        
                except Exception as e:
                    logger.error(f"   ❌ Reminder failed for {pipeline_id}: {e}")
            
            if total_reminders > 0:
                logger.info(f"   ✅ Total reminders sent: {total_reminders}")
            else:
                logger.info("   ℹ️  No reminders needed")
                
        except Exception as e:
            logger.error(f"   ❌ Reminder job failed: {e}", exc_info=True)
    
    async def _mark_no_response_job(self):
        """
        Job: Mark candidates as no-response after timeout.
        
        Runs every 6 hours to check for candidates who haven't
        responded within the configured timeout period.
        """
        logger.info("⏰ Running no-response marking job...")
        
        try:
            cursor = self.pipeline_service.pipelines_collection.find({
                "status": "active",
                "is_active": True
            })
            
            pipelines = await cursor.to_list(length=1000)
            
            total_marked = 0
            
            for pipeline_doc in pipelines:
                pipeline_id = pipeline_doc.get("pipeline_id")
                if not pipeline_id:
                    continue
                
                try:
                    result = await self.pipeline_service.mark_no_response_candidates(pipeline_id)
                    marked = result.get("marked_no_response", 0)
                    total_marked += marked
                    
                    if marked > 0:
                        logger.info(f"   ⏰ Marked {marked} as no-response for {pipeline_id}")
                        
                except Exception as e:
                    logger.error(f"   ❌ No-response marking failed for {pipeline_id}: {e}")
            
            if total_marked > 0:
                logger.info(f"   ✅ Total marked as no-response: {total_marked}")
            else:
                logger.info("   ℹ️  No candidates to mark")
                
        except Exception as e:
            logger.error(f"   ❌ No-response job failed: {e}", exc_info=True)
    
    async def _cleanup_job(self):
        """
        Job: Daily cleanup tasks.
        
        Runs at 3 AM daily to:
        - Clean up expired scheduling links
        - Archive old completed pipelines
        - Remove stale cache entries
        """
        logger.info("🧹 Running daily cleanup job...")
        
        try:
            # Clean up expired scheduling links
            from datetime import timezone as dt_timezone
            now = datetime.now(dt_timezone.utc)
            
            result = await self.pipeline_service.pipelines_collection.update_many(
                {
                    "candidates.outreach.scheduling_link_expires_at": {"$lt": now.isoformat()},
                    "candidates.stage": {"$nin": ["scheduled", "interview_completed"]}
                },
                {
                    "$set": {
                        "candidates.$[].outreach.scheduling_link_expired": True
                    }
                }
            )
            
            logger.info(f"   ✅ Marked {result.modified_count} expired scheduling links")
            
            # Archive old completed pipelines (older than 90 days)
            cutoff = now - timedelta(days=90)
            
            result = await self.pipeline_service.pipelines_collection.update_many(
                {
                    "status": "completed",
                    "updated_at": {"$lt": cutoff.isoformat()}
                },
                {
                    "$set": {
                        "status": "archived",
                        "is_active": False,
                        "archived_at": now.isoformat()
                    }
                }
            )
            
            logger.info(f"   ✅ Archived {result.modified_count} old pipelines")
            
            # Clear stale Redis cache (if Redis is configured)
            if self.pipeline_service.redis:
                # Implementation for Redis cleanup
                pass
            
            logger.info("   ✅ Cleanup completed")
            
        except Exception as e:
            logger.error(f"   ❌ Cleanup job failed: {e}", exc_info=True)
    
    async def _health_check_job(self):
        """
        Job: Health check.
        
        Runs every 30 minutes to verify scheduler is working
        and log system status.
        """
        try:
            job_count = len(self.scheduler.get_jobs())
            logger.info(f"💓 Scheduler health check: OK ({job_count} jobs active)")
            
        except Exception as e:
            logger.error(f"❌ Health check failed: {e}", exc_info=True)


# =============================================================================
# EXPORT
# =============================================================================

__all__ = ["BackgroundScheduler"]