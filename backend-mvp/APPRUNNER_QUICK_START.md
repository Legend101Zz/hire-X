# AWS App Runner Quick Start Guide

This is a condensed guide to get your backend deployed to AWS App Runner in under 15 minutes.

## Prerequisites Checklist

- [ ] AWS Account with billing enabled
- [ ] GitHub account with code pushed
- [ ] MongoDB Atlas account (free tier is fine)
- [ ] Redis instance (Upstash free tier recommended)
- [ ] OpenRouter API key

## 1. Set Up Services (5-10 minutes)

### MongoDB Atlas
```
1. Go to mongodb.com/cloud/atlas → Sign up/Login
2. Create cluster (FREE M0 tier)
3. Database Access → Add user (username + password)
4. Network Access → Add IP: 0.0.0.0/0 (allow all)
5. Copy connection string:
   mongodb+srv://username:password@cluster.mongodb.net/
```

### Upstash Redis
```
1. Go to upstash.com → Sign up/Login
2. Create Redis database (FREE tier)
3. Copy: host, port, password
```

### OpenRouter
```
1. Go to openrouter.ai → Sign up
2. Get API key from dashboard
3. Add $5-10 credits
```

## 2. Deploy to App Runner (5 minutes)

### Via AWS Console

**Step 1: Navigate**
```
AWS Console → Search "App Runner" → Create service
```

**Step 2: Source**
```
- Repository type: Source code repository
- Click "Add new" → Authorize GitHub
- Select: Your repository
- Branch: main (or dev-deploy)
- Deployment trigger: Automatic
```

**Step 3: Build**
```
- Configuration: Use a configuration file
- Configuration file: apprunner.yaml
```

**Step 4: Service Settings**
```
Service name: neuraleap-backend
CPU: 1 vCPU
Memory: 2 GB
Port: 8080
```

**Step 5: Environment Variables** ⚠️ CRITICAL
```bash
# Generate JWT secret first:
# python -c "import secrets; print(secrets.token_urlsafe(32))"

JWT_SECRET_KEY=<paste-generated-secret>
OPENROUTER_API_KEY=sk-or-v1-xxxxx
AI_MODEL_NAME=openai/gpt-4o-mini
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DATABASE_NAME=neuraleap
PROFILES_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
PROFILES_DB_NAME=mydatabase
REDIS_HOST=<upstash-host>.upstash.io
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=<upstash-password>
PORT=8080
```

**Step 6: Create**
```
Review → Create & deploy
Wait 5-10 minutes for deployment
```

## 3. Get Your Backend URL

After deployment completes:
```
You'll see: https://abc123.us-east-1.awsapprunner.com
```

## 4. Update Frontend

Edit `frontend-mvp/.env.local`:
```bash
NEXT_PUBLIC_API_BASE_URL=https://abc123.us-east-1.awsapprunner.com
NEXT_PUBLIC_WS_BASE_URL=wss://abc123.us-east-1.awsapprunner.com
```

## 5. Test

```bash
# Health check
curl https://abc123.us-east-1.awsapprunner.com/health

# Should return: {"status":"healthy","service":"Neuraleap API"}
```

## 6. Create Test User

Use your backend URL to create a test user:
```bash
# SSH into a machine with Python or use AWS CloudShell
pip install pymongo passlib bcrypt

# Create user in MongoDB
python create_test_user.py
# Or manually add to MongoDB users collection
```

## Common Issues & Fixes

### ❌ Service Won't Start
**Check:** Logs in App Runner console
**Fix:** Usually missing environment variables

### ❌ MongoDB Connection Failed
**Fix:** 
1. Check connection string format
2. IP whitelist: 0.0.0.0/0
3. URL-encode special chars in password

### ❌ Redis Connection Failed
**Fix:**
1. Verify host, port, password
2. For Upstash: Use exact values from dashboard

### ❌ CORS Errors from Frontend
**Fix:** Update `api.py` to include your frontend domain in `allow_origins`

## Cost Estimate

- **App Runner**: ~$25-30/month (1 vCPU, 2GB, low traffic)
- **MongoDB Atlas M0**: FREE
- **Upstash Redis**: FREE (10k commands/day)
- **OpenRouter**: ~$5-20/month (depends on usage)

**Total: ~$30-50/month**

## Monitoring

```
App Runner Console → Your Service → Logs
CloudWatch → Log groups → /aws/apprunner/neuraleap-backend
```

## Redeploy

Just push to GitHub - auto-deploys! 🚀

```bash
git push origin main
# App Runner automatically detects and deploys
```

## Environment Variables Reference

| Variable | Example | Where to Get |
|----------|---------|--------------|
| JWT_SECRET_KEY | `xxx-32-chars-xxx` | Generate with Python |
| OPENROUTER_API_KEY | `sk-or-v1-xxxxx` | openrouter.ai/keys |
| AI_MODEL_NAME | `openai/gpt-4o-mini` | openrouter.ai/docs |
| MONGODB_URL | `mongodb+srv://...` | MongoDB Atlas dashboard |
| DATABASE_NAME | `neuraleap` | Your choice |
| PROFILES_DB_URL | `mongodb+srv://...` | MongoDB Atlas dashboard |
| PROFILES_DB_NAME | `mydatabase` | Your choice |
| REDIS_HOST | `xxx.upstash.io` | Upstash dashboard |
| REDIS_PORT | `6379` | Upstash dashboard |
| REDIS_PASSWORD | `xxxxx` | Upstash dashboard |
| PORT | `8080` | Keep as 8080 |

## Next Steps

1. ✅ Backend deployed and running
2. Deploy frontend to Vercel (recommended for Next.js)
3. Update frontend env with backend URL
4. Test end-to-end flow
5. Set up custom domain (optional)
6. Configure monitoring alerts

## Help

Full documentation: See `AWS_DEPLOYMENT.md`

Need help? Check logs first:
- App Runner console → Logs
- Look for error messages
- Most issues are env variables or DB connections

