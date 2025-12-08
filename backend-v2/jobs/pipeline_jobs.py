
"""
Pipeline Background Jobs
========================
Scheduled tasks for automated pipeline operations.

Jobs:
1. check_due_interviews - Trigger interviews at scheduled time
2. send_reminder_emails - Send outreach follow-ups
3. mark_no_responses - Mark stale candidates as no-response
4. send_interview_reminders - Send reminders before interviews
5. cleanup_expired_tokens - Clean up old scheduling tokens

How to Use:
-----------
1. Import and start the scheduler in main.py:
   
   from jobs.pipeline_jobs import start_scheduler, shutdown_scheduler
   
   @app.on_event("startup")
   async def startup():
       await start_scheduler()
   
   @app.on_event("shutdown") 
   async def shutdown():
       await shutdown_scheduler()

2. Jobs run automatically on schedule
3. Can also trigger manually via API endpoints

Author: NeuraLeap Engineering
Version: 2.0
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from core.config import settings
from core.logging_config import get_logger
from models.pipeline_models import CandidateStage, get_current_timestamp
from models.scheduling_models import ScheduleStatus

logger = get_logger(__name__)

# Global scheduler instance
scheduler: Optional[AsyncIOScheduler] = None

# Service references (set during initialization)
_pipeline_service = None
_email_service = None
_vapi_service = None


# ============================================================================
# SCHEDULER SETUP
# ============================================================================

async def start_scheduler():
    """
    Initialize and start the background job scheduler.
    
    Call this in your FastAPI startup event:
    
        @app.on_event("startup")
        async def startup():
            await start_scheduler()
    """
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already running")
        return
    
    scheduler = AsyncIOScheduler(
        timezone="Asia/Kolkata",
        job_defaults={
            'coalesce': True,  # Combine missed runs into one
            'max_instances': 1,  # Only one instance of each job
            'misfire_grace_time': 300  # 5 min grace period
        }
    )
    
    # =========================================================================
    # JOB 1: Check Due Interviews (Every 5 minutes)
    # =========================================================================
    # Triggers Vapi calls for interviews that are scheduled to start
    scheduler.add_job(
        job_check_due_interviews,
        trigger=IntervalTrigger(minutes=5),
        id='check_due_interviews',
        name='Check and trigger due interviews',
        replace_existing=True
    )
    
    # =========================================================================
    # JOB 2: Send Outreach Reminders (Every 1 hour)
    # =========================================================================
    # Sends follow-up emails to candidates who haven't responded
    scheduler.add_job(
        job_send_outreach_reminders,
        trigger=IntervalTrigger(hours=1),
        id='send_outreach_reminders',
        name='Send outreach reminder emails',
        replace_existing=True
    )
    
    # =========================================================================
    # JOB 3: Mark No-Response Candidates (Every 6 hours)
    # =========================================================================
    # Marks candidates as "no response" after timeout period
    scheduler.add_job(
        job_mark_no_responses,
        trigger=IntervalTrigger(hours=6),
        id='mark_no_responses',
        name='Mark no-response candidates',
        replace_existing=True
    )
    
    # =========================================================================
    # JOB 4: Send Interview Reminders (Every 30 minutes)
    # =========================================================================
    # Sends reminders 24h and 2h before scheduled interviews
    scheduler.add_job(
        job_send_interview_reminders,
        trigger=IntervalTrigger(minutes=30),
        id='send_interview_reminders',
        name='Send interview reminders',
        replace_existing=True
    )
    
    # =========================================================================
    # JOB 5: Cleanup Expired Tokens (Daily at 3 AM)
    # =========================================================================
    # Cleans up expired scheduling tokens and old data
    scheduler.add_job(
        job_cleanup_expired,
        trigger=CronTrigger(hour=3, minute=0),
        id='cleanup_expired',
        name='Cleanup expired tokens and data',
        replace_existing=True
    )
    
    # =========================================================================
    # JOB 6: Recalculate Pipeline Stats (Every 2 hours)
    # =========================================================================
    # Ensures pipeline statistics are accurate
    scheduler.add_job(
        job_recalculate_stats,
        trigger=IntervalTrigger(hours=2),
        id='recalculate_stats',
        name='Recalculate pipeline statistics',
        replace_existing=True
    )
    
    # Start the scheduler
    scheduler.start()
    
    logger.info("✅ Background job scheduler started")
    logger.info("   Jobs registered:")
    for job in scheduler.get_jobs():
        logger.info(f"   - {job.name} ({job.trigger})")


async def shutdown_scheduler():
    """
    Gracefully shutdown the scheduler.
    
    Call this in your FastAPI shutdown event:
    
        @app.on_event("shutdown")
        async def shutdown():
            await shutdown_scheduler()
    """
    global scheduler
    
    if scheduler:
        scheduler.shutdown(wait=True)
        scheduler = None
        logger.info("✅ Background job scheduler stopped")


def set_services(pipeline_service, email_service=None, vapi_service=None):
    """
    Set service references for jobs to use.
    
    Call this during app initialization:
    
        from jobs.pipeline_jobs import set_services
        set_services(pipeline_service, email_service, vapi_service)
    """
    global _pipeline_service, _email_service, _vapi_service
    _pipeline_service = pipeline_service
    _email_service = email_service
    _vapi_service = vapi_service
    logger.info("✅ Background job services configured")


# ============================================================================
# JOB 1: CHECK DUE INTERVIEWS
# ============================================================================

async def job_check_due_interviews():
    """
    Check for interviews that should start now and trigger them.
    
    This job:
    1. Finds all confirmed interviews scheduled for the next 5 minutes
    2. Triggers Vapi calls for each
    3. Updates interview status to IN_PROGRESS
    4. Updates candidate stage to INTERVIEW_CALLING
    
    Runs every 5 minutes.
    """
    logger.info("🔍 [JOB] Checking for due interviews...")
    
    if not _pipeline_service:
        logger.warning("Pipeline service not configured")
        return
    
    try:
        await _pipeline_service.trigger_scheduled_interviews()
        logger.info("✅ [JOB] Due interviews check complete")
    except Exception as e:
        logger.error(f"❌ [JOB] Due interviews check failed: {e}")


# ============================================================================
# JOB 2: SEND OUTREACH REMINDERS
# ============================================================================

async def job_send_outreach_reminders():
    """
    Send reminder emails to candidates who haven't responded.
    
    This job:
    1. Finds all active pipelines
    2. For each pipeline, finds candidates who:
       - Have been contacted but haven't clicked
       - Haven't received max reminders yet
       - Enough time has passed since last contact
    3. Sends personalized reminder emails
    4. Updates candidate stage to OUTREACH_REMINDER
    
    Runs every 1 hour.
    """
    logger.info("📧 [JOB] Sending outreach reminders...")
    
    if not _pipeline_service:
        logger.warning("Pipeline service not configured")
        return
    
    try:
        # Get all active pipelines
        cursor = _pipeline_service.pipelines_collection.find({
            "status": "active",
            "is_active": True
        })
        
        total_reminders_sent = 0
        
        async for pipeline_doc in cursor:
            pipeline_id = pipeline_doc.get("pipeline_id")
            
            try:
                result = await _pipeline_service.send_reminder_emails(pipeline_id)
                reminders_sent = result.get("reminders_sent", 0)
                total_reminders_sent += reminders_sent
                
                if reminders_sent > 0:
                    logger.info(f"   Pipeline {pipeline_id}: {reminders_sent} reminders sent")
                    
            except Exception as e:
                logger.error(f"   Pipeline {pipeline_id} failed: {e}")
        
        logger.info(f"✅ [JOB] Outreach reminders complete: {total_reminders_sent} sent")
        
    except Exception as e:
        logger.error(f"❌ [JOB] Outreach reminders failed: {e}")


# ============================================================================
# JOB 3: MARK NO-RESPONSE CANDIDATES
# ============================================================================

async def job_mark_no_responses():
    """
    Mark candidates as "no response" after timeout period.
    
    This job:
    1. Finds candidates who:
       - Were contacted (email sent)
       - Haven't clicked or responded
       - Timeout period has passed (default 72 hours)
    2. Updates their stage to NO_RESPONSE
    3. Sets final_decision to "rejected"
    
    Runs every 6 hours.
    """
    logger.info("⏰ [JOB] Marking no-response candidates...")
    
    if not _pipeline_service:
        logger.warning("Pipeline service not configured")
        return
    
    try:
        cursor = _pipeline_service.pipelines_collection.find({
            "status": "active",
            "is_active": True
        })
        
        total_marked = 0
        
        async for pipeline_doc in cursor:
            pipeline_id = pipeline_doc.get("pipeline_id")
            
            try:
                result = await _pipeline_service.mark_no_response_candidates(pipeline_id)
                marked = result.get("marked_no_response", 0)
                total_marked += marked
                
                if marked > 0:
                    logger.info(f"   Pipeline {pipeline_id}: {marked} marked as no-response")
                    
            except Exception as e:
                logger.error(f"   Pipeline {pipeline_id} failed: {e}")
        
        logger.info(f"✅ [JOB] No-response marking complete: {total_marked} candidates")
        
    except Exception as e:
        logger.error(f"❌ [JOB] No-response marking failed: {e}")


# ============================================================================
# JOB 4: SEND INTERVIEW REMINDERS
# ============================================================================

async def job_send_interview_reminders():
    """
    Send reminders to candidates before their scheduled interviews.
    
    This job:
    1. Finds interviews scheduled in the next 24 hours and 2 hours
    2. Sends reminder emails if not already sent
    3. Updates reminder tracking
    
    Reminder schedule:
    - 24 hours before: "Your interview is tomorrow"
    - 2 hours before: "Your interview is in 2 hours"
    
    Runs every 30 minutes.
    """
    logger.info("🔔 [JOB] Sending interview reminders...")
    
    if not _pipeline_service or not _email_service:
        logger.warning("Services not configured")
        return
    
    try:
        now = datetime.utcnow()
        
        # Define reminder windows
        reminder_windows = [
            {"hours_before": 24, "window_start": 23, "window_end": 25},  # 24h reminder
            {"hours_before": 2, "window_start": 1.5, "window_end": 2.5},   # 2h reminder
        ]
        
        total_reminders_sent = 0
        
        for window in reminder_windows:
            window_start = now + timedelta(hours=window["window_start"])
            window_end = now + timedelta(hours=window["window_end"])
            
            # Find interviews in this window
            cursor = _pipeline_service.schedules_collection.find({
                "status": ScheduleStatus.CONFIRMED.value,
                "scheduled_datetime": {
                    "$gte": window_start.isoformat(),
                    "$lte": window_end.isoformat()
                }
            })
            
            async for schedule_doc in cursor:
                try:
                    # Check if reminder already sent
                    reminders_sent = schedule_doc.get("reminders_sent", [])
                    hours_before = window["hours_before"]
                    
                    already_sent = any(
                        r.get("hours_before") == hours_before 
                        for r in reminders_sent
                    )
                    
                    if already_sent:
                        continue
                    
                    # Send reminder
                    candidate_email = schedule_doc.get("candidate_email")
                    candidate_name = schedule_doc.get("candidate_name")
                    scheduled_datetime = schedule_doc.get("scheduled_datetime")
                    job_title = schedule_doc.get("job_title")
                    timezone = schedule_doc.get("timezone", "Asia/Kolkata")
                    
                    if not candidate_email:
                        continue
                    
                    await _email_service.send_interview_reminder(
                        candidate_email=candidate_email,
                        candidate_name=candidate_name,
                        scheduled_datetime=scheduled_datetime,
                        timezone=timezone,
                        job_title=job_title,
                        hours_until=hours_before
                    )
                    
                    # Record reminder sent
                    reminder_record = {
                        "reminder_type": "email",
                        "hours_before": hours_before,
                        "sent_at": get_current_timestamp()
                    }
                    
                    await _pipeline_service.schedules_collection.update_one(
                        {"schedule_id": schedule_doc["schedule_id"]},
                        {
                            "$push": {"reminders_sent": reminder_record},
                            "$set": {"status": ScheduleStatus.REMINDER_SENT.value}
                        }
                    )
                    
                    total_reminders_sent += 1
                    logger.info(f"   Sent {hours_before}h reminder to {candidate_name}")
                    
                except Exception as e:
                    logger.error(f"   Failed to send reminder: {e}")
        
        logger.info(f"✅ [JOB] Interview reminders complete: {total_reminders_sent} sent")
        
    except Exception as e:
        logger.error(f"❌ [JOB] Interview reminders failed: {e}")


# ============================================================================
# JOB 5: CLEANUP EXPIRED DATA
# ============================================================================

async def job_cleanup_expired():
    """
    Clean up expired scheduling tokens and old data.
    
    This job:
    1. Marks expired scheduling links as invalid
    2. Cleans up old completed/cancelled schedules
    3. Removes old enrichment cache data
    
    Runs daily at 3 AM.
    """
    logger.info("🧹 [JOB] Cleaning up expired data...")
    
    if not _pipeline_service:
        logger.warning("Pipeline service not configured")
        return
    
    try:
        now = datetime.utcnow()
        
        # 1. Mark expired scheduling tokens
        expired_count = 0
        cursor = _pipeline_service.pipelines_collection.find({
            "candidates.outreach.scheduling_link_expires_at": {"$lt": now.isoformat()}
        })
        
        async for pipeline_doc in cursor:
            # This would need more complex logic to update nested documents
            # For now, we just log
            expired_count += 1
        
        logger.info(f"   Found {expired_count} pipelines with expired tokens")
        
        # 2. Archive old completed schedules (older than 90 days)
        archive_cutoff = now - timedelta(days=90)
        
        old_schedules = await _pipeline_service.schedules_collection.count_documents({
            "status": {"$in": [
                ScheduleStatus.COMPLETED.value,
                ScheduleStatus.CANCELLED.value,
                ScheduleStatus.NO_SHOW.value
            ]},
            "updated_at": {"$lt": archive_cutoff.isoformat()}
        })
        
        logger.info(f"   Found {old_schedules} old schedules (>90 days)")
        
        # 3. Archive old inactive pipelines (older than 180 days)
        archive_pipeline_cutoff = now - timedelta(days=180)
        
        old_pipelines = await _pipeline_service.pipelines_collection.update_many(
            {
                "status": {"$in": ["completed", "archived"]},
                "updated_at": {"$lt": archive_pipeline_cutoff.isoformat()}
            },
            {
                "$set": {"status": "archived_old"}
            }
        )
        
        logger.info(f"   Archived {old_pipelines.modified_count} old pipelines")
        
        logger.info("✅ [JOB] Cleanup complete")
        
    except Exception as e:
        logger.error(f"❌ [JOB] Cleanup failed: {e}")


# ============================================================================
# JOB 6: RECALCULATE PIPELINE STATS
# ============================================================================

async def job_recalculate_stats():
    """
    Recalculate statistics for all active pipelines.
    
    This ensures stats are accurate even if some updates were missed.
    
    Runs every 2 hours.
    """
    logger.info("📊 [JOB] Recalculating pipeline stats...")
    
    if not _pipeline_service:
        logger.warning("Pipeline service not configured")
        return
    
    try:
        cursor = _pipeline_service.pipelines_collection.find({
            "status": "active",
            "is_active": True
        })
        
        updated_count = 0
        
        async for pipeline_doc in cursor:
            try:
                pipeline_id = pipeline_doc.get("pipeline_id")
                pipeline = await _pipeline_service.get_pipeline(pipeline_id)
                
                if pipeline:
                    pipeline.recalculate_stats()
                    await _pipeline_service._save_pipeline(pipeline)
                    updated_count += 1
                    
            except Exception as e:
                logger.error(f"   Failed to update {pipeline_doc.get('pipeline_id')}: {e}")
        
        logger.info(f"✅ [JOB] Stats recalculation complete: {updated_count} pipelines")
        
    except Exception as e:
        logger.error(f"❌ [JOB] Stats recalculation failed: {e}")


# ============================================================================
# MANUAL JOB TRIGGERS (For API/Testing)
# ============================================================================

async def trigger_job(job_name: str) -> Dict[str, Any]:
    """
    Manually trigger a background job.
    
    Usage:
        from jobs.pipeline_jobs import trigger_job
        result = await trigger_job("check_due_interviews")
    
    Args:
        job_name: One of:
            - check_due_interviews
            - send_outreach_reminders
            - mark_no_responses
            - send_interview_reminders
            - cleanup_expired
            - recalculate_stats
            
    Returns:
        Dict with execution status
    """
    job_functions = {
        "check_due_interviews": job_check_due_interviews,
        "send_outreach_reminders": job_send_outreach_reminders,
        "mark_no_responses": job_mark_no_responses,
        "send_interview_reminders": job_send_interview_reminders,
        "cleanup_expired": job_cleanup_expired,
        "recalculate_stats": job_recalculate_stats,
    }
    
    if job_name not in job_functions:
        return {
            "success": False,
            "error": f"Unknown job: {job_name}",
            "available_jobs": list(job_functions.keys())
        }
    
    try:
        start_time = datetime.utcnow()
        await job_functions[job_name]()
        end_time = datetime.utcnow()
        
        return {
            "success": True,
            "job": job_name,
            "executed_at": start_time.isoformat(),
            "duration_seconds": (end_time - start_time).total_seconds()
        }
    except Exception as e:
        return {
            "success": False,
            "job": job_name,
            "error": str(e)
        }


def get_scheduler_status() -> Dict[str, Any]:
    """
    Get current scheduler status and job information.
    
    Usage:
        from jobs.pipeline_jobs import get_scheduler_status
        status = get_scheduler_status()
    """
    if not scheduler:
        return {
            "running": False,
            "jobs": []
        }
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "trigger": str(job.trigger),
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "pending": job.pending
        })
    
    return {
        "running": scheduler.running,
        "jobs": jobs,
        "timezone": str(scheduler.timezone)
    }


# ============================================================================
# EXPORT
# ============================================================================

__all__ = [
    "start_scheduler",
    "shutdown_scheduler",
    "set_services",
    "trigger_job",
    "get_scheduler_status",
    
    # Individual jobs (for direct calling)
    "job_check_due_interviews",
    "job_send_outreach_reminders",
    "job_mark_no_responses",
    "job_send_interview_reminders",
    "job_cleanup_expired",
    "job_recalculate_stats",
]