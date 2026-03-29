# migration_fix_concerns.py
import asyncio

from pymongo.asynchronous.mongo_client import AsyncMongoClient


async def fix_concerns():
    client = AsyncMongoClient("mongodb://profiles_app:Hire-X123@localhost:27017/Hire-X?authSource=profiles_production")
    db = client.Hire-X
    pipelines = db.pipelines_collection
    
    cursor = pipelines.find({
        "candidates.enrichment.concerns.0": {"$type": "object"}
    })
    
    count = 0
    async for doc in cursor:
        for candidate in doc.get("candidates", []):
            enrichment = candidate.get("enrichment", {})
            
            # Fix concerns
            if enrichment.get("concerns"):
                concerns = enrichment["concerns"]
                enrichment["concerns"] = [
                    c.get("concern") if isinstance(c, dict) else c
                    for c in concerns
                ]
            
            # Fix strengths
            if enrichment.get("top_strengths"):
                strengths = enrichment["top_strengths"]
                enrichment["top_strengths"] = [
                    s.get("strength") if isinstance(s, dict) else s
                    for s in strengths
                ]
        
        await pipelines.update_one(
            {"_id": doc["_id"]},
            {"$set": {"candidates": doc["candidates"]}}
        )
        count += 1
        print(f"Fixed {count} pipelines")
    
    print(f"✅ Migration complete: {count} pipelines fixed")

asyncio.run(fix_concerns())