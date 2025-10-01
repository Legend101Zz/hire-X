# Environment Setup Guide

## Overview
This guide explains how to set up environment variables for the NeuralLeap API using the `.env` file.

## Quick Start

### 1. Create .env File
```bash
cd backend-mvp
cp env.example .env
```

### 2. Edit .env File
Open `.env` and fill in your actual values:
```bash
nano .env
# or
code .env
```

### 3. Required Variables

**Minimum required for the app to run:**
```bash
# AI Model API Key (REQUIRED)
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here

# JWT Secret (REQUIRED for production)
JWT_SECRET_KEY=your-secure-secret-key-minimum-32-chars

# MongoDB for main database (REQUIRED)
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap

# MongoDB for profiles (REQUIRED)
PROFILES_DB_URL=mongodb://localhost:27017
PROFILES_DB_NAME=mydatabase
```

## Environment Variables Reference

### JWT Authentication

#### JWT_SECRET_KEY
- **Type**: String
- **Required**: Yes (in production)
- **Default**: `your-secret-key-change-this-in-production`
- **Description**: Secret key used to sign and verify JWT tokens
- **Security**: 
  - Minimum 32 characters recommended
  - Use strong random string
  - Never commit to git
  - Change from default in production

**Generate a secure key:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### JWT_EXPIRE_MINUTES
- **Type**: Integer
- **Required**: No
- **Default**: 30
- **Description**: JWT token expiration time in minutes

### AI Model Configuration

#### OPENROUTER_API_KEY
- **Type**: String
- **Required**: Yes
- **Description**: API key for OpenRouter.ai to access AI models
- **Get Key**: https://openrouter.ai/keys
- **Format**: `sk-or-v1-xxxxxxxxxxxxx`

#### AI_MODEL_NAME
- **Type**: String
- **Required**: No
- **Default**: `openai/gpt-4o-mini`
- **Description**: AI model to use for prompt parsing
- **Options**:
  - `openai/gpt-4o-mini` (fast, cheap, good quality)
  - `openai/gpt-4o` (best quality, more expensive)
  - `anthropic/claude-3-sonnet`
  - `anthropic/claude-3-opus`
  - See: https://openrouter.ai/models

### MongoDB - NeuralLeap Database

#### MONGODB_URL
- **Type**: String
- **Required**: Yes
- **Default**: `mongodb://localhost:27017/`
- **Description**: Connection URL for main database (users, prompts, logs)
- **Formats**:
  - Local: `mongodb://localhost:27017/`
  - Remote: `mongodb+srv://username:password@cluster.mongodb.net/`
  - With auth: `mongodb://username:password@host:27017/`

#### DATABASE_NAME
- **Type**: String
- **Required**: Yes
- **Default**: `neuraleap`
- **Description**: Database name for users, prompts, and logs
- **Collections**:
  - `users` - User accounts
  - `prompts` - User prompts and results
  - `user_logs` - Activity logs
  - `incident-logs` - Security incidents

### MongoDB - Profiles Database

#### PROFILES_DB_URL
- **Type**: String
- **Required**: Yes
- **Default**: `mongodb://localhost:27017`
- **Description**: Connection URL for candidate profiles database
- **Note**: Can be the same as MONGODB_URL or a different cluster

#### PROFILES_DB_NAME
- **Type**: String
- **Required**: Yes
- **Default**: `mydatabase`
- **Description**: Database name for candidate profiles
- **Collections**:
  - `profiles` - Candidate profile data

### Redis Configuration

#### REDIS_HOST
- **Type**: String
- **Required**: No
- **Default**: `localhost`
- **Description**: Redis server hostname
- **Examples**:
  - Local: `localhost`
  - Remote: `redis.example.com`
  - IP: `192.168.1.100`

#### REDIS_PORT
- **Type**: Integer
- **Required**: No
- **Default**: `6379`
- **Description**: Redis server port

#### REDIS_DB
- **Type**: Integer
- **Required**: No
- **Default**: `0`
- **Description**: Redis database number (0-15)
- **Note**: Use different numbers for different environments

#### REDIS_PASSWORD
- **Type**: String
- **Required**: No (if Redis has auth)
- **Description**: Redis password for authenticated connections
- **Note**: Currently not implemented in code, add if needed

### Server Configuration

#### SERVER_HOST
- **Type**: String
- **Required**: No
- **Default**: `0.0.0.0`
- **Description**: Host to bind the server to
- **Options**:
  - `0.0.0.0` - All interfaces (production)
  - `127.0.0.1` - Localhost only (development)

#### SERVER_PORT
- **Type**: Integer
- **Required**: No
- **Default**: `8000`
- **Description**: Port to run the server on

## Configuration Examples

### Local Development
```bash
# .env for local development
JWT_SECRET_KEY=dev-secret-key-for-local-testing-only
OPENROUTER_API_KEY=sk-or-v1-your-key-here
AI_MODEL_NAME=openai/gpt-4o-mini

# Local MongoDB
MONGODB_URL=mongodb://localhost:27017/
DATABASE_NAME=neuraleap
PROFILES_DB_URL=mongodb://localhost:27017
PROFILES_DB_NAME=mydatabase

# Local Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### Production (MongoDB Atlas)
```bash
# .env for production
JWT_SECRET_KEY=prod-secure-key-generated-with-secrets-module-minimum-32-chars
OPENROUTER_API_KEY=sk-or-v1-your-production-key
AI_MODEL_NAME=openai/gpt-4o

# MongoDB Atlas
MONGODB_URL=mongodb+srv://username:password@neuraleap-cluster.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=neuraleap_production
PROFILES_DB_URL=mongodb+srv://username:password@profiles-cluster.mongodb.net/?retryWrites=true&w=majority
PROFILES_DB_NAME=profiles_production

# Remote Redis (e.g., Redis Cloud)
REDIS_HOST=redis-12345.cloud.redislabs.com
REDIS_PORT=12345
REDIS_DB=0
```

### Staging Environment
```bash
# .env for staging
JWT_SECRET_KEY=staging-secret-key-different-from-production
OPENROUTER_API_KEY=sk-or-v1-your-staging-key
AI_MODEL_NAME=openai/gpt-4o-mini

# Staging databases
MONGODB_URL=mongodb+srv://staging_user:staging_pass@staging-cluster.mongodb.net/
DATABASE_NAME=neuraleap_staging
PROFILES_DB_URL=mongodb+srv://staging_user:staging_pass@staging-cluster.mongodb.net/
PROFILES_DB_NAME=profiles_staging

REDIS_HOST=staging-redis.example.com
REDIS_PORT=6379
REDIS_DB=1
```

## Setup Instructions

### 1. Local Development Setup

```bash
# 1. Navigate to backend directory
cd backend-mvp

# 2. Copy example file
cp env.example .env

# 3. Edit .env file
nano .env

# 4. Set minimum required variables:
#    - OPENROUTER_API_KEY (get from https://openrouter.ai/keys)
#    - JWT_SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")

# 5. Start MongoDB locally (if not running)
# macOS:
brew services start mongodb-community
# Linux:
sudo systemctl start mongod

# 6. Start Redis locally (if not running)
# macOS:
brew services start redis
# Linux:
sudo systemctl start redis

# 7. Activate virtual environment
source venv/bin/activate

# 8. Install dependencies
pip install -r requirements.txt

# 9. Start the server
python main.py
```

### 2. Production Setup (MongoDB Atlas)

```bash
# 1. Create MongoDB Atlas cluster
#    - Go to: https://www.mongodb.com/cloud/atlas
#    - Create free cluster or paid cluster
#    - Get connection string

# 2. Set up environment variables
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
MONGODB_URL="mongodb+srv://username:password@cluster.mongodb.net/"

# 3. Update .env file with production values

# 4. Deploy and run
```

## Security Best Practices

### 1. Never Commit .env to Git
```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
```

### 2. Use Strong JWT Secret
```bash
# Generate secure key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Use Different Secrets for Each Environment
- Development: `dev-secret-key`
- Staging: `staging-secret-key`
- Production: Strong random key

### 4. Rotate API Keys Regularly
- Change OPENROUTER_API_KEY every 90 days
- Change JWT_SECRET_KEY if compromised
- Update MongoDB passwords quarterly

### 5. Use Environment-Specific Databases
- Development: `neuraleap_dev`
- Staging: `neuraleap_staging`
- Production: `neuraleap_production`

## Troubleshooting

### Issue: "OPENROUTER_API_KEY environment variable is required"
**Solution**: Set OPENROUTER_API_KEY in .env file
```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Issue: "Failed to connect to Redis"
**Solution**: 
1. Check Redis is running: `redis-cli ping`
2. Verify REDIS_HOST and REDIS_PORT in .env
3. Start Redis: `brew services start redis` (macOS)

### Issue: MongoDB connection timeout
**Solution**:
1. Check MongoDB is running
2. Verify MONGODB_URL format
3. For Atlas: Check IP whitelist
4. Test connection: `mongosh "YOUR_MONGODB_URL"`

### Issue: JWT authentication failing
**Solution**:
1. Ensure JWT_SECRET_KEY is set
2. Check key is not empty or default value
3. Verify key is same across all instances

## Loading Environment Variables

The application automatically loads `.env` file using Python's `os.getenv()`.

### Verification
```python
# Check if env vars are loaded
import os
print(f"MongoDB URL: {os.getenv('MONGODB_URL')}")
print(f"Database: {os.getenv('DATABASE_NAME')}")
print(f"API Key Set: {'Yes' if os.getenv('OPENROUTER_API_KEY') else 'No'}")
```

### Manual Loading (if needed)
```python
# Install python-dotenv
pip install python-dotenv

# In your code
from dotenv import load_dotenv
load_dotenv()
```

## Migration from Hardcoded Values

If you have an existing deployment with hardcoded values:

1. **Create .env file** with current values
2. **Test locally** to ensure everything works
3. **Deploy with .env** to production
4. **Remove hardcoded values** from code
5. **Restart services** to load new config

## References

- **OpenRouter**: https://openrouter.ai/
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas
- **Redis Cloud**: https://redis.com/redis-enterprise-cloud/
- **JWT**: https://jwt.io/
