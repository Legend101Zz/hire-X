# Environment Variables Migration - Summary

## ✅ What Was Changed

All hardcoded database URLs and API keys have been moved to environment variables for security and flexibility.

### Files Modified

1. **`ai_model.py`** ✅
   - Moved API key to `OPENROUTER_API_KEY` env var
   - Moved model name to `AI_MODEL_NAME` env var
   - Added validation to ensure API key is set

2. **`workflow.py`** ✅
   - Changed hardcoded MongoDB URLs to env vars
   - `PROFILES_DB_URL` and `PROFILES_DB_NAME` for profiles database
   - `MONGODB_URL` and `DATABASE_NAME` for main database

3. **`search.py`** ✅
   - Updated to use `PROFILES_DB_URL` and `PROFILES_DB_NAME`

4. **`redis_manager.py`** ✅
   - Added support for `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`

5. **`main.py`** ✅
   - Removed hardcoded model name
   - Now uses environment variables

6. **`auth.py`** ✅ (Already using env vars)
   - Already uses `MONGODB_URL` and `DATABASE_NAME`
   - Already uses `JWT_SECRET_KEY`

7. **`api.py`** ✅ (Already using env vars)
   - Already uses `MONGODB_URL` and `DATABASE_NAME`

### Files Created

1. **`env.example`** - Complete environment variables template
2. **`ENVIRONMENT_SETUP.md`** - Comprehensive setup guide
3. **`ENV_QUICK_START.md`** - Quick 2-minute setup guide
4. **`ENV_MIGRATION_SUMMARY.md`** - This file

## 📋 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | AI model API key | `sk-or-v1-xxxxx` |
| `JWT_SECRET_KEY` | JWT signing secret | `your-32-char-key` |
| `MONGODB_URL` | Main database URL | `mongodb://localhost:27017/` |
| `DATABASE_NAME` | Main database name | `neuraleap` |
| `PROFILES_DB_URL` | Profiles database URL | `mongodb://localhost:27017` |
| `PROFILES_DB_NAME` | Profiles database name | `mydatabase` |

### Optional Variables (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MODEL_NAME` | `openai/gpt-4o-mini` | AI model to use |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_DB` | `0` | Redis database number |
| `JWT_EXPIRE_MINUTES` | `30` | Token expiration |
| `SERVER_HOST` | `0.0.0.0` | Server bind host |
| `SERVER_PORT` | `8000` | Server port |

## 🚀 Quick Setup

### 1. Create .env File
```bash
cd backend-mvp
cp env.example .env
```

### 2. Edit .env
```bash
# Minimum required:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap
PROFILES_DB_URL=mongodb://localhost:27017
PROFILES_DB_NAME=mydatabase
```

### 3. For Remote MongoDB Atlas
```bash
# Replace local URLs with Atlas connection string:
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
PROFILES_DB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

## 🔄 Migration Checklist

- [x] Removed hardcoded API keys from code
- [x] Removed hardcoded database URLs
- [x] Created env.example template
- [x] Created setup documentation
- [x] All connections use environment variables
- [ ] Create your .env file (copy from env.example)
- [ ] Set OPENROUTER_API_KEY
- [ ] Set JWT_SECRET_KEY  
- [ ] Set MongoDB URLs (local or Atlas)
- [ ] Test the application

## 🔐 Security Improvements

### Before (❌ Insecure)
```python
# ai_model.py - EXPOSED API KEY!
headers = {
    "Authorization": "Bearer sk-or-v1-6f2a5356b7fe1d177b22d8bccd7441ed..."
}

# workflow.py - HARDCODED URLS
client = MongoClient("mongodb://localhost:27017")
```

### After (✅ Secure)
```python
# ai_model.py - API KEY FROM ENV
api_key = os.getenv("OPENROUTER_API_KEY")
headers = {
    "Authorization": f"Bearer {api_key}"
}

# workflow.py - URLS FROM ENV
url = os.getenv("PROFILES_DB_URL", "mongodb://localhost:27017")
client = MongoClient(url)
```

## 📦 What's in Each File

### env.example
Complete template with:
- All environment variables
- Descriptions for each
- Example values
- Local and remote configurations

### ENVIRONMENT_SETUP.md
Comprehensive guide with:
- Detailed explanations of each variable
- Setup instructions for local/production
- Security best practices
- Troubleshooting guide
- Migration instructions

### ENV_QUICK_START.md
Quick reference with:
- 2-minute setup steps
- Minimum required variables
- Common configurations
- Quick verification script

## 🧪 Testing Your Setup

### 1. Verify Environment Variables
```bash
cd backend-mvp
source venv/bin/activate

python -c "
import os
print('MongoDB URL:', os.getenv('MONGODB_URL'))
print('API Key Set:', 'Yes' if os.getenv('OPENROUTER_API_KEY') else 'No')
print('JWT Secret Set:', 'Yes' if os.getenv('JWT_SECRET_KEY') else 'No')
"
```

### 2. Start the Server
```bash
python main.py
```

### 3. Expected Output
```
✅ Connected to Redis successfully
✅ Created indexes for prompts collection
Starting API server...
API will be available at: http://localhost:8000
```

## 🌍 Remote Database Setup

### MongoDB Atlas
1. Create cluster at https://cloud.mongodb.com
2. Get connection string
3. Update .env:
   ```bash
   MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
   PROFILES_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
   ```

### Redis Cloud
1. Create database at https://redis.com
2. Get connection details
3. Update .env:
   ```bash
   REDIS_HOST=your-redis-host.cloud.redislabs.com
   REDIS_PORT=12345
   ```

## 📝 Next Steps

1. **Copy env.example to .env**
   ```bash
   cp env.example .env
   ```

2. **Set your API key**
   - Get from: https://openrouter.ai/keys
   - Add to .env: `OPENROUTER_API_KEY=sk-or-v1-your-key`

3. **Generate JWT secret**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   - Add to .env: `JWT_SECRET_KEY=<generated-key>`

4. **Configure databases**
   - Local: Use default values
   - Remote: Update with Atlas URLs

5. **Test the application**
   ```bash
   source venv/bin/activate
   python main.py
   ```

## ⚠️ Important Notes

- **Never commit .env to git** - It's in .gitignore
- **Use different secrets for each environment** (dev/staging/prod)
- **Rotate API keys regularly** (every 90 days)
- **Use strong JWT secrets** (minimum 32 characters)

## 📚 Documentation Files

1. **env.example** - Copy this to create .env
2. **ENV_QUICK_START.md** - 2-minute setup guide
3. **ENVIRONMENT_SETUP.md** - Complete documentation
4. **ENV_MIGRATION_SUMMARY.md** - This summary
