# 🚀 AWS App Runner Deployment Checklist

Use this checklist to ensure a smooth deployment to AWS App Runner.

## Pre-Deployment Setup

### 1. External Services Setup
- [ ] **MongoDB Atlas**
  - [ ] Account created at mongodb.com/cloud/atlas
  - [ ] Free M0 cluster created
  - [ ] Database user created with strong password
  - [ ] IP whitelist set to `0.0.0.0/0`
  - [ ] Connection string copied (format: `mongodb+srv://user:pass@cluster.mongodb.net/`)
  
- [ ] **Redis (Upstash)**
  - [ ] Account created at upstash.com
  - [ ] Free Redis database created
  - [ ] Host, port, and password copied
  
- [ ] **OpenRouter API**
  - [ ] Account created at openrouter.ai
  - [ ] API key generated
  - [ ] Credits added to account ($5-10 recommended)

### 2. Environment Variables Prepared
- [ ] JWT_SECRET_KEY generated (run: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- [ ] All required variables documented (see table below)

### 3. Code Repository
- [ ] Latest code pushed to GitHub
- [ ] Correct branch selected (main or dev-deploy)
- [ ] `apprunner.yaml` file present in backend-mvp/
- [ ] `Dockerfile` file present in backend-mvp/
- [ ] `requirements.txt` up to date

## AWS App Runner Deployment

### 4. GitHub Connection
- [ ] AWS App Runner authorized to access GitHub account
- [ ] Repository connected to App Runner

### 5. Service Configuration
- [ ] Service name: `neuraleap-backend`
- [ ] Source: GitHub repository selected
- [ ] Branch: main (or dev-deploy) selected
- [ ] Auto-deploy: Enabled
- [ ] Build config: `apprunner.yaml` selected
- [ ] CPU: 1 vCPU
- [ ] Memory: 2 GB
- [ ] Port: 8080

### 6. Environment Variables Set
Copy these into App Runner configuration:

```bash
JWT_SECRET_KEY=<your-generated-secret-32-chars>
OPENROUTER_API_KEY=sk-or-v1-<your-key>
AI_MODEL_NAME=openai/gpt-4o-mini
MONGODB_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
DATABASE_NAME=neuraleap
PROFILES_DB_URL=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
PROFILES_DB_NAME=mydatabase
REDIS_HOST=<your-host>.upstash.io
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=<your-redis-password>
PORT=8080
```

- [ ] JWT_SECRET_KEY set
- [ ] OPENROUTER_API_KEY set
- [ ] AI_MODEL_NAME set
- [ ] MONGODB_URL set (both main and profiles)
- [ ] DATABASE_NAME set
- [ ] PROFILES_DB_URL set
- [ ] PROFILES_DB_NAME set
- [ ] REDIS_HOST set
- [ ] REDIS_PORT set
- [ ] REDIS_DB set
- [ ] REDIS_PASSWORD set
- [ ] PORT set to 8080

### 7. Health Check Configuration
- [ ] Path: `/health`
- [ ] Interval: 10 seconds
- [ ] Timeout: 5 seconds
- [ ] Healthy threshold: 1
- [ ] Unhealthy threshold: 5

### 8. Deploy
- [ ] Service created and deployed
- [ ] Wait for deployment to complete (5-10 minutes)
- [ ] Service status shows "Running"

## Post-Deployment Verification

### 9. Test Backend
- [ ] Health check works:
  ```bash
  curl https://<your-url>.awsapprunner.com/health
  # Expected: {"status":"healthy","service":"Neuraleap API"}
  ```

- [ ] Root endpoint works:
  ```bash
  curl https://<your-url>.awsapprunner.com/
  # Expected: {"message":"Neuraleap API","status":"running"}
  ```

### 10. Create Test User
- [ ] Test user created in MongoDB users collection
- [ ] Login endpoint tested:
  ```bash
  curl -X POST https://<your-url>.awsapprunner.com/login \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"testpass"}'
  ```

### 11. Check Logs
- [ ] Logs accessible in App Runner console
- [ ] No error messages in startup logs
- [ ] Server started successfully message visible

### 12. Update Frontend
- [ ] Frontend `.env.local` updated:
  ```bash
  NEXT_PUBLIC_API_BASE_URL=https://<your-url>.awsapprunner.com
  NEXT_PUBLIC_WS_BASE_URL=wss://<your-url>.awsapprunner.com
  ```

- [ ] Frontend development server restarted
- [ ] Frontend can connect to backend

### 13. Update CORS (if needed)
- [ ] Backend `api.py` includes frontend domain in allowed origins
- [ ] If using custom frontend domain, add to CORS config
- [ ] Redeploy backend if CORS updated

### 14. End-to-End Testing
- [ ] User can log in from frontend
- [ ] Prompt submission works
- [ ] WebSocket connection establishes
- [ ] Results are returned
- [ ] All features working

## Monitoring & Maintenance

### 15. Set Up Monitoring
- [ ] CloudWatch logs accessible
- [ ] Error rate monitoring enabled
- [ ] Cost alerts configured

### 16. Documentation
- [ ] Backend URL documented for team
- [ ] Environment variables backed up securely
- [ ] Deployment process documented

## Optional Enhancements

### 17. Custom Domain (Optional)
- [ ] Domain purchased
- [ ] Custom domain linked in App Runner
- [ ] DNS CNAME records added
- [ ] SSL certificate validated
- [ ] Frontend updated to use custom domain

### 18. Enhanced Monitoring (Optional)
- [ ] CloudWatch alarms for errors
- [ ] CloudWatch alarms for high latency
- [ ] SNS notifications configured
- [ ] AWS X-Ray enabled for tracing

### 19. Security Enhancements (Optional)
- [ ] AWS Secrets Manager for secrets
- [ ] VPC Connector for private resources
- [ ] AWS WAF for DDoS protection
- [ ] IAM roles properly configured

## Troubleshooting

If something goes wrong, check:

1. **Service won't start**
   - [ ] Check logs in App Runner console
   - [ ] Verify all environment variables are set
   - [ ] Check MongoDB and Redis connectivity

2. **MongoDB connection fails**
   - [ ] Connection string format correct
   - [ ] Password URL-encoded if contains special chars
   - [ ] IP whitelist includes 0.0.0.0/0
   - [ ] Database user has correct permissions

3. **Redis connection fails**
   - [ ] Host, port, password correct
   - [ ] Redis instance is running
   - [ ] Network connectivity allowed

4. **Deployment fails**
   - [ ] Check build logs in App Runner
   - [ ] Verify requirements.txt is correct
   - [ ] Check Python version compatibility

5. **Frontend can't connect**
   - [ ] Frontend env variables updated
   - [ ] CORS configured correctly
   - [ ] Backend URL is correct (https/wss)
   - [ ] Frontend restarted after env changes

## Success Criteria

Your deployment is successful when:

✅ Backend service status is "Running"  
✅ Health check returns 200 OK  
✅ User can log in from frontend  
✅ Prompts can be submitted  
✅ Results are returned  
✅ WebSocket connections work  
✅ No errors in logs  

## Cost Tracking

Current estimated costs:
- App Runner: ~$25-30/month
- MongoDB Atlas M0: $0 (free)
- Upstash Redis: $0 (free tier)
- OpenRouter API: $5-20/month (usage-based)
- **Total: ~$30-50/month**

Monitor costs in AWS Cost Explorer regularly.

## Support Resources

- 📖 Full guide: `AWS_DEPLOYMENT.md`
- 🚀 Quick start: `APPRUNNER_QUICK_START.md`
- 💬 AWS Support: (if you have support plan)
- 📧 App Runner docs: https://docs.aws.amazon.com/apprunner/

---

**Deployment Date:** __________  
**Deployed By:** __________  
**Backend URL:** __________  
**Notes:** __________

