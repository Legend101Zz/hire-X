# MongoDB Results Migration

## Overview
Migrated the results storage from Redis to MongoDB for persistent storage while maintaining frontend compatibility.

## Database Schema

### Database: `neuraleap`
### Collection: `prompts`

Each document in the `prompts` collection contains:

```json
{
  "_id": ObjectId("..."),
  "prompt_id": "uuid-v4-string",           // Unique random ID for this prompt
  "session_id": "uuid-v4-string",          // Session identifier (unique index)
  "username": "string",                     // User who created the prompt
  "prompt": "string",                       // Original prompt text
  "profiles": [                             // Array of scored candidate profiles
    {
      "first_name": "string",
      "last_name": "string",
      "title": "string",
      "location": "string",
      "country": "string",
      "seniority_level": "string",
      "current_industry": "string",
      "experience": [...],
      "education": [...],
      "linkedin_url": "string",
      "summary": "string",
      "expertise": "string",
      "followup_match_score": 0.85,         // Match score (0-1)
      "match_reasons": [...]
    }
  ],
  "summary": {                              // Scoring statistics
    "total_profiles_found": 50,
    "profiles_returned": 50,
    "average_score": 0.75,
    "top_score": 0.95,
    "score_distribution": {
      "excellent": 10,
      "good": 25,
      "fair": 10,
      "poor": 5
    },
    "scoring_method": "followup_word_matching"
  },
  "analysis_metadata": {                    // Analysis metadata
    "original_prompt": "string",
    "extracted_keywords": [...],
    "search_criteria": {...},
    "scoring_applied": true,
    "scoring_timestamp": "string"
  },
  "created_at": ISODate("2025-09-30T..."),  // Document creation timestamp
  "total_profiles_found": 50,
  "profiles_returned": 50
}
```

## Indexes

The following indexes are automatically created for efficient querying:

1. **session_id** (unique) - Primary query key for retrieving results
2. **prompt_id** (unique) - Alternative unique identifier
3. **username + created_at** (compound) - For user-specific queries sorted by date

## API Response Schema

The `/session/{session_id}/results` endpoint returns the **same schema** as before for frontend compatibility:

```json
{
  "session_id": "string",
  "status": "completed",
  "profiles": [...],                        // Same as MongoDB document
  "summary": {...},                         // Same as MongoDB document
  "total_profiles_found": 50,
  "profiles_returned": 50
}
```

### Additional Fields in MongoDB (not returned to frontend)
- `prompt_id` - Unique identifier for the prompt
- `username` - User who created the prompt
- `prompt` - Original prompt text
- `created_at` - Document creation timestamp
- `analysis_metadata` - Full analysis metadata

## Changes Made

### 1. workflow.py
- Added `prompts_collection` reference to MongoDB `neuraleap.prompts`
- Added `_create_prompts_indexes()` method to create necessary indexes
- Updated `_serve_scored_profiles()` to:
  - Store results in MongoDB with all required fields
  - Generate unique `prompt_id` using UUID
  - Include username and prompt text
  - Still store in Redis for WebSocket real-time updates

### 2. api.py
- Added MongoDB connection in `__init__` method
- Added `prompts_collection` reference
- Updated `get_session_results()` endpoint to:
  - Fetch results from MongoDB using `session_id`
  - Maintain same API response schema
  - Handle processing/not-found states
  - Verify session ownership

## Data Flow

### Storage (Workflow)
1. User submits prompt → Session created
2. Workflow processes → Scores profiles
3. `_serve_scored_profiles()` is called:
   - Stores in **MongoDB** (persistent) with all metadata
   - Stores in **Redis** (temporary) for WebSocket notifications

### Retrieval (API)
1. Frontend calls `/session/{session_id}/results`
2. API verifies session ownership
3. API fetches from **MongoDB** using `session_id`
4. Returns frontend-compatible schema (excludes MongoDB-only fields)

## User Profile Tracking

### User Schema Update
When results are generated, the `prompt_id` is automatically added to the user's profile:

```json
{
  "_id": ObjectId("..."),
  "username": "testuser",
  "email": "test@example.com",
  "hashed_password": "$2b$12$...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "last_login": "2024-01-01T12:00:00.000Z",
  "prompts": [                              // NEW: Array of prompt_ids created by user
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

This allows you to:
- Track all prompts created by a specific user
- Query user's prompt history
- Link prompts back to users for analytics
- Build user-specific dashboards

## Benefits

1. **Persistent Storage**: Results are permanently stored in MongoDB
2. **Rich Metadata**: Additional fields (username, prompt, prompt_id) for analytics
3. **Frontend Compatible**: API response unchanged, no frontend modifications needed
4. **Efficient Querying**: Indexes on session_id, prompt_id, and username
5. **Real-time Updates**: Still uses Redis for WebSocket notifications
6. **Audit Trail**: Timestamps and user information for tracking
7. **User History**: Users can access all their previous prompts via prompt_ids array

## Environment Variables

Uses existing MongoDB configuration:
```bash
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap
```

## Testing

To test the migration:
1. Ensure MongoDB is running
2. Create a new session with a prompt
3. Wait for workflow to complete
4. Call `/session/{session_id}/results`
5. Verify results are returned correctly
6. Check MongoDB to see the full document with all fields
