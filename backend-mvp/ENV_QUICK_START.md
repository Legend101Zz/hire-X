# Environment Variables - Quick Start

## 🚀 Quick Setup (2 Minutes)

### Step 1: Create .env File
```bash
cd backend-mvp
cp env.example .env
```

### Step 2: Edit .env and Set These Required Values
```bash
# Open in your editor
nano .env
```

### Step 3: Set Minimum Required Variables
```bash
# REQUIRED: Get from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-your-actual-api-key-here

# REQUIRED: Generate secure key
JWT_SECRET_KEY=your-secure-secret-key-minimum-32-chars

# REQUIRED: MongoDB connection (local or remote)
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap

# REQUIRED: Profiles database
PROFILES_DB_URL=mongodb://localhost:27017
PROFILES_DB_NAME=mydatabase
```

### Step 4: Start the Application
```bash
source venv/bin/activate
python main.py
```

## 📋 Complete .env Structure

```bash
# =================================================================
# JWT & Security
# =================================================================
JWT_SECRET_KEY=your-secure-secret-key
JWT_EXPIRE_MINUTES=30

# =================================================================
# AI Configuration
# =================================================================
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_MODEL_NAME=openai/gpt-4o-mini

# =================================================================
# MongoDB - Main Database (Users, Prompts, Logs)
# =================================================================
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap

# =================================================================
# MongoDB - Profiles Database
# =================================================================
PROFILES_DB_URL=mongodb://localhost:27017
PROFILES_DB_NAME=mydatabase

# =================================================================
# Redis
# =================================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# =================================================================
# Server
# =================================================================
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
```

## 🌍 Remote MongoDB Atlas Setup

Replace local MongoDB with Atlas:

```bash
# Instead of localhost, use your Atlas connection string:
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=neuraleap

PROFILES_DB_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
PROFILES_DB_NAME=mydatabase
```

**How to get Atlas connection string:**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create/select cluster
3. Click "Connect" → "Connect your application"
4. Copy connection string
5. Replace `<username>`, `<password>`, and `<cluster-url>`

## 🔑 Generate Secure JWT Key

```bash
python -c "import secrets; print(secrets.token_urlsec(32))"
```

Copy the output and paste it as `JWT_SECRET_KEY` in your .env file.

## ✅ Verify Setup

After creating .env, run this to verify:

```bash
cd backend-mvp
source venv/bin/activate
python -c "
import os
from dotenv import load_dotenv
load_dotenv()

print('✅ Environment Variables Check:')
print(f'  MongoDB URL: {\"✓\" if os.getenv(\"MONGODB_URL\") else \"✗\"} {os.getenv(\"MONGODB_URL\", \"NOT SET\")[:50]}')
print(f'  API Key: {\"✓\" if os.getenv(\"OPENROUTER_API_KEY\") else \"✗\"} {\"Set\" if os.getenv(\"OPENROUTER_API_KEY\") else \"NOT SET\"}')
print(f'  JWT Secret: {\"✓\" if os.getenv(\"JWT_SECRET_KEY\") else \"✗\"} {\"Set\" if os.getenv(\"JWT_SECRET_KEY\") else \"NOT SET\"}')
print(f'  Redis: {\"✓\" if os.getenv(\"REDIS_HOST\") else \"✗\"} {os.getenv(\"REDIS_HOST\", \"NOT SET\")}')
"
```

## 🔐 Security Checklist

- [ ] Changed JWT_SECRET_KEY from default
- [ ] Never committed .env to git (check .gitignore)
- [ ] Using different secrets for dev/staging/prod
- [ ] MongoDB has authentication enabled
- [ ] API keys are from your own account

## 🚨 Common Issues

### "OPENROUTER_API_KEY environment variable is required"
→ Set `OPENROUTER_API_KEY` in .env file

### "Failed to connect to Redis"
→ Start Redis: `brew services start redis` (macOS) or `sudo systemctl start redis` (Linux)

### MongoDB connection timeout
→ Check MongoDB is running: `mongosh` (local) or verify Atlas IP whitelist (remote)

## 📚 More Details

See `ENVIRONMENT_SETUP.md` for complete documentation.
