# Backend Deployment to AWS App Runner

## 📚 Documentation Overview

This backend is ready to deploy to AWS App Runner with GitHub integration. Here's your documentation:

### Quick Reference

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **APPRUNNER_QUICK_START.md** | 15-minute deployment guide | First time deploying |
| **AWS_DEPLOYMENT.md** | Comprehensive deployment guide | Full details and troubleshooting |
| **DEPLOYMENT_CHECKLIST.md** | Step-by-step checklist | Ensure nothing is missed |
| **env.example** | Environment variables template | Configure your services |

### Configuration Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Docker containerization config |
| `apprunner.yaml` | App Runner build configuration |
| `.dockerignore` | Files to exclude from Docker build |
| `requirements.txt` | Python dependencies |

## 🚀 Quick Start (Choose One Path)

### Path 1: I Want It Running NOW (15 min)
1. Read: `APPRUNNER_QUICK_START.md`
2. Follow steps 1-6
3. Done!

### Path 2: I Want to Understand Everything (30 min)
1. Read: `AWS_DEPLOYMENT.md`
2. Use: `DEPLOYMENT_CHECKLIST.md` while deploying
3. Done!

## 📋 What You Need Before Starting

1. **AWS Account** (with billing enabled)
2. **GitHub Account** (code already pushed)
3. **MongoDB Atlas** (free tier works)
4. **Redis Instance** (Upstash free tier recommended)
5. **OpenRouter API Key** (add $5-10 credits)

## 🎯 Deployment Summary

```
1. Set up MongoDB Atlas (5 min)
2. Set up Upstash Redis (2 min)
3. Get OpenRouter API key (2 min)
4. Deploy to App Runner (5 min)
   - Connect GitHub
   - Configure environment variables
   - Deploy
5. Test backend (2 min)
6. Update frontend (1 min)
```

**Total Time: ~15 minutes**

## 🔧 Architecture

```
┌─────────────┐
│   GitHub    │
│ Repository  │
└──────┬──────┘
       │ (auto-deploy on push)
       ↓
┌─────────────────┐
│  AWS App Runner │
│   (Backend API) │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐  ┌───────┐
│MongoDB │  │ Redis │
│ Atlas  │  │Upstash│
└────────┘  └───────┘
```

## 📝 Environment Variables Required

Generate JWT secret first:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Then set these in App Runner:
```bash
JWT_SECRET_KEY=<generated-secret>
OPENROUTER_API_KEY=sk-or-v1-xxxxx
AI_MODEL_NAME=openai/gpt-4o-mini
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
DATABASE_NAME=neuraleap
PROFILES_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
PROFILES_DB_NAME=mydatabase
REDIS_HOST=xxx.upstash.io
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=xxxxx
PORT=8080
```

## ✅ Verification Checklist

After deployment, verify:
- [ ] Service status: Running
- [ ] Health check: `curl https://your-url.awsapprunner.com/health`
- [ ] Login works
- [ ] Logs show no errors
- [ ] Frontend can connect

## 💰 Cost Estimate

- **App Runner**: ~$25-30/month (1 vCPU, 2GB)
- **MongoDB Atlas**: $0 (free M0 tier)
- **Redis (Upstash)**: $0 (free tier)
- **OpenRouter API**: $5-20/month (usage-based)

**Total: ~$30-50/month**

## 🔄 CI/CD Pipeline

Already configured! Just:
```bash
git push origin main
```

App Runner automatically:
1. Detects the push
2. Builds the Docker image
3. Deploys with zero downtime
4. Keeps previous version if deploy fails

## 🆘 Troubleshooting

**Service won't start?**
- Check logs in App Runner console
- Verify all environment variables are set
- Test MongoDB/Redis connectivity

**Can't connect to MongoDB?**
- IP whitelist: 0.0.0.0/0
- Check connection string format
- URL-encode special chars in password

**Frontend can't connect?**
- Update frontend .env.local
- Check CORS configuration
- Use https:// and wss:// protocols

Full troubleshooting guide in `AWS_DEPLOYMENT.md`

## 📞 Support

- Check logs first: App Runner console → Logs tab
- Full docs: See `AWS_DEPLOYMENT.md`
- AWS Support: (if you have support plan)

## 🎯 Next Steps After Deployment

1. ✅ Backend running on App Runner
2. ⬜ Update frontend environment variables
3. ⬜ Test end-to-end flow
4. ⬜ Set up monitoring alerts
5. ⬜ Configure custom domain (optional)
6. ⬜ Deploy frontend to Vercel/Netlify

## 📦 What's Included

- ✅ FastAPI backend
- ✅ WebSocket support
- ✅ JWT authentication
- ✅ MongoDB integration
- ✅ Redis caching
- ✅ Health checks
- ✅ CORS configured
- ✅ Logging enabled
- ✅ Auto-scaling ready

## 🔐 Security Notes

- Never commit .env files
- Use strong JWT secrets
- Keep API keys secure
- MongoDB: use strong passwords
- HTTPS enabled by default
- Regular security updates via auto-deploy

## 📈 Monitoring

Access logs via:
- App Runner console → Logs
- CloudWatch → Log groups → `/aws/apprunner/neuraleap-backend`

Monitor metrics:
- Request count
- Error rates (4xx, 5xx)
- CPU/Memory usage
- Active instances

## 🚀 Ready to Deploy?

Start here: **`APPRUNNER_QUICK_START.md`**

Good luck! 🎉

