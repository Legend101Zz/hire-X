# Troubleshooting Guide

## Issue: Prompts Not Appearing in User Profiles

### Problem
When checking the database, existing users don't have the `prompts` field or the field is empty, even after creating new prompts.

### Root Causes

#### 1. **Existing Users Created Before Feature Implementation**
Users created before we added the `prompts` field won't have it in their profile.

**Solution:** Run the migration script:
```bash
cd backend-mvp
source venv/bin/activate
python migrate_user_prompts.py
```

#### 2. **Prompts Created Before Tracking Feature**
Prompts created before we implemented the tracking feature won't be linked to user profiles.

**Solution:** Use the debug tool to sync them:
```bash
python -c "from debug_user_prompts import fix_user_prompts; fix_user_prompts('USERNAME')"
```

#### 3. **Wrong Database or Collection**
The code expects users in `neuraleap.users` but you might be checking a different database.

**Solution:** Verify you're checking the correct database:
```javascript
// MongoDB
use neuraleap
db.users.findOne({username: "YOUR_USERNAME"})
```

## Diagnostic Tools

### 1. Check User Profile and Prompts
```bash
cd backend-mvp
source venv/bin/activate
python debug_user_prompts.py USERNAME
```

This will:
- Show if the user exists
- Show if `prompts` field exists
- Show all prompts for that user
- Detect any mismatches
- Offer to fix issues

### 2. List All Users
```bash
python debug_user_prompts.py
```

Shows all users and their prompts count.

### 3. Migrate All Users
```bash
python migrate_user_prompts.py
```

Adds `prompts` field to all users and syncs existing prompts.

## How It Should Work

### For New Users (Created After Feature)
✅ Automatically get `prompts: []` field when created
✅ Prompts are automatically added when they create them

### For Existing Users (Created Before Feature)
1. Run migration script (one-time)
2. Prompts will be tracked automatically going forward

### Verification Steps

1. **Check if user has prompts field:**
```bash
python debug_user_prompts.py USERNAME
```

2. **Create a new prompt as that user**

3. **Check again:**
```bash
python debug_user_prompts.py USERNAME
```

The new prompt_id should appear in the prompts array.

## Expected Database Structure

### User Document (neuraleap.users)
```json
{
  "_id": ObjectId("..."),
  "username": "harvey",
  "email": "harvey@example.com",
  "hashed_password": "$2b$12$...",
  "created_at": "2025-09-27T13:19:21.170282",
  "last_login": "2025-09-30T07:39:07.898191",
  "prompts": [
    "80790e04-cc0d-4a49-a393-39e03ba0769c",
    "121ff067-dd54-43b9-b3cb-6ff44f20c4ad",
    "7672fc9b-9cd3-4fdd-95dd-46014b4d37d4"
  ]
}
```

### Prompt Document (neuraleap.prompts)
```json
{
  "_id": ObjectId("..."),
  "prompt_id": "80790e04-cc0d-4a49-a393-39e03ba0769c",
  "session_id": "5ed16e82-0546-47cc-bb6e-358e20f64868",
  "username": "harvey",
  "prompt": "Looking for a Data Scientist...",
  "profiles": [...],
  "summary": {...},
  "created_at": ISODate("2025-09-30T07:41:13.877Z"),
  ...
}
```

## Common Issues and Fixes

### Issue: "prompts field does NOT exist"
**Fix:** Run migration script or use debug tool to add it

### Issue: "MISMATCH: X prompt(s) NOT in user profile"
**Fix:** Run `fix_user_prompts('USERNAME')` to sync them

### Issue: New prompts not being added
**Possible causes:**
1. Username not being captured from JWT token correctly
2. User doesn't exist in database
3. MongoDB connection issue
4. Workflow not completing successfully

**Debug:**
```bash
# Check backend logs for:
✅ Added prompt_id XXX to user YYY's profile
# or
⚠️ Could not add prompt_id to user profile: username not found
```

### Issue: Wrong database being used
**Check environment variables:**
```bash
# In backend-mvp/.env (or system env)
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap
```

## Manual Verification

### Using MongoDB Shell
```javascript
// Connect to MongoDB
mongosh

// Switch to neuraleap database
use neuraleap

// Find user
db.users.findOne({username: "harvey"})

// Find user's prompts
db.prompts.find({username: "harvey"})

// Check if prompts match
const user = db.users.findOne({username: "harvey"});
const userPromptIds = user.prompts || [];
const actualPrompts = db.prompts.find({username: "harvey"}).toArray();
const actualPromptIds = actualPrompts.map(p => p.prompt_id);

// Compare
console.log("In user profile:", userPromptIds);
console.log("In prompts collection:", actualPromptIds);
```

## Prevention

### For New Deployments
1. Run migration script before going live
2. Ensure all existing users have the `prompts` field
3. Test with a sample user before production

### For Ongoing Use
The system will automatically track prompts for:
- ✅ New users (field initialized on creation)
- ✅ Existing users (after migration)
- ✅ All future prompts (tracked automatically)

## Quick Reference Commands

```bash
# Activate virtual environment
source venv/bin/activate

# Check specific user
python debug_user_prompts.py USERNAME

# Fix specific user
python -c "from debug_user_prompts import fix_user_prompts; fix_user_prompts('USERNAME')"

# Migrate all users
python migrate_user_prompts.py

# List all users
python debug_user_prompts.py
```
