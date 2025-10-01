# User Prompt Tracking Feature

## Overview
This feature automatically tracks all prompts created by each user by storing `prompt_id` references in the user's profile. This enables user history tracking, analytics, and the ability to reference previous prompts.

## Implementation

### 1. User Schema Enhancement

The `users` collection in the `neuraleap` database now includes a `prompts` field:

```json
{
  "_id": ObjectId("..."),
  "username": "testuser",
  "email": "test@example.com",
  "hashed_password": "$2b$12$...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "last_login": "2024-01-01T12:00:00.000Z",
  "prompts": [
    "prompt-uuid-1",
    "prompt-uuid-2",
    "prompt-uuid-3"
  ]
}
```

### 2. Automatic Tracking Flow

```
User creates prompt → Workflow processes → Results generated
                                               ↓
                            Generate unique prompt_id (UUID)
                                               ↓
                         Store in prompts collection (MongoDB)
                                               ↓
                         Add prompt_id to user's prompts array
```

### 3. Code Changes

#### models.py
Updated the `User` model to include the `prompts` field:

```python
class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    hashed_password: str
    created_at: Optional[str] = None
    last_login: Optional[str] = None
    prompts: Optional[List[str]] = []  # Array of prompt_ids created by this user
```

#### workflow.py

**Added:**
- Reference to `users_collection` in `__init__`
- Method `_add_prompt_to_user_profile(username, prompt_id)` to update user's prompts array
- Call to this method in `_serve_scored_profiles()` after storing results

**Key Method:**
```python
async def _add_prompt_to_user_profile(self, username: str, prompt_id: str) -> bool:
    """
    Add a prompt_id to user's prompts array in their profile.
    Uses $addToSet to avoid duplicates.
    """
    result = self.users_collection.update_one(
        {"username": username},
        {"$addToSet": {"prompts": prompt_id}},
        upsert=False
    )
    return result.matched_count > 0
```

#### auth.py
Updated `create_user()` to initialize the `prompts` field as an empty array:

```python
user_data = {
    "username": username,
    "email": email,
    "hashed_password": hashed_password,
    "created_at": datetime.datetime.utcnow().isoformat(),
    "last_login": None,
    "prompts": []  # Initialize empty prompts array
}
```

## MongoDB Operations

### Adding a Prompt ID
Uses MongoDB's `$addToSet` operator to:
- Add the prompt_id to the array
- Prevent duplicates automatically
- Create the array if it doesn't exist

```javascript
db.users.update_one(
  { "username": "testuser" },
  { "$addToSet": { "prompts": "new-prompt-uuid" } }
)
```

### Querying User's Prompts
Retrieve all prompts created by a user:

```javascript
// Get user's prompt IDs
const user = db.users.findOne({ "username": "testuser" });
const promptIds = user.prompts;

// Get all prompt details
db.prompts.find({ "prompt_id": { "$in": promptIds } });
```

## Use Cases

### 1. User History Dashboard
```javascript
// Get all prompts for a user with full details
const user = db.users.findOne({ "username": "testuser" });
const userPrompts = db.prompts.find(
  { "prompt_id": { "$in": user.prompts } }
).sort({ "created_at": -1 });
```

### 2. User Analytics
```javascript
// Count prompts per user
db.users.aggregate([
  {
    $project: {
      username: 1,
      promptCount: { $size: "$prompts" }
    }
  },
  { $sort: { promptCount: -1 } }
]);
```

### 3. Cross-Reference Prompts
```javascript
// Find prompt details from prompt_id in user's array
const promptId = user.prompts[0];
const promptDetails = db.prompts.findOne({ "prompt_id": promptId });
```

## API Integration

No changes to existing API endpoints. The tracking happens automatically in the background when results are generated.

### Workflow
1. User calls `POST /parse-prompt` with JWT token
2. Session is created with user context
3. Workflow processes the prompt
4. When results are ready:
   - `_serve_scored_profiles()` is called
   - Generates unique `prompt_id`
   - Stores prompt with results in `prompts` collection
   - **Automatically adds `prompt_id` to user's `prompts` array**
   - User profile is now linked to this prompt

## Benefits

1. **User History**: Track all prompts created by each user
2. **No Duplicates**: `$addToSet` ensures no duplicate prompt_ids
3. **Automatic**: No manual intervention required
4. **Scalable**: Array-based storage is efficient for querying
5. **Bi-directional**: Can query:
   - User → All their prompts
   - Prompt → Which user created it
6. **Analytics Ready**: Easy to build dashboards and reports
7. **Future-proof**: Foundation for features like:
   - "My Prompts" page
   - Prompt templates from history
   - Usage statistics
   - Billing/quota management

## Migration Notes

### For Existing Users
Existing users without a `prompts` field will:
- Have the field automatically added when they create their next prompt
- The `$addToSet` operation initializes the array if it doesn't exist
- No migration script needed

### For New Users
New users created via `create_user()` will have an empty `prompts` array initialized automatically.

## Testing

To verify the feature is working:

1. **Create a prompt as a user:**
   ```bash
   curl -X POST http://localhost:8000/parse-prompt \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Looking for a Data Scientist"}'
   ```

2. **Wait for results to be generated**

3. **Check user's profile in MongoDB:**
   ```javascript
   db.users.findOne({ "username": "testuser" })
   ```
   
   You should see the `prompt_id` in the `prompts` array.

4. **Verify prompt details:**
   ```javascript
   const user = db.users.findOne({ "username": "testuser" });
   const promptId = user.prompts[user.prompts.length - 1]; // Latest prompt
   db.prompts.findOne({ "prompt_id": promptId });
   ```

## Error Handling

The system gracefully handles errors:
- If user is not found: Logs warning but doesn't fail the workflow
- If MongoDB update fails: Logs error but doesn't fail the workflow
- Results are still stored even if user profile update fails
- Duplicate prompt_ids are automatically prevented by `$addToSet`

## Console Output

When a prompt is successfully added to a user's profile:
```
✅ Added prompt_id abc-123-def to user testuser's profile
```

If there's an issue:
```
⚠️  User testuser not found when trying to add prompt_id
```
or
```
❌ Error adding prompt_id to user profile: <error message>
```

## Future Enhancements

Potential future features that can leverage this:
1. **Prompt History API**: `GET /users/{username}/prompts`
2. **Prompt Templates**: Save and reuse successful prompts
3. **Usage Analytics**: Track user engagement and patterns
4. **Quota Management**: Limit prompts per user per time period
5. **Sharing**: Allow users to share prompts with others
6. **Favorites**: Mark certain prompts as favorites
7. **Search**: Search through user's prompt history
