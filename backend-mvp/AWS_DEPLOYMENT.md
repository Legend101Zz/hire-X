# AWS App Runner Deployment Guide

This guide walks you through deploying the Neuraleap backend API to AWS App Runner with GitHub integration.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **GitHub Repository** with your code pushed
3. **External Services**:
   - MongoDB instance (MongoDB Atlas recommended)
   - Redis instance (AWS ElastiCache or Upstash recommended)
   - OpenRouter API Key

## Architecture Overview

```
GitHub → AWS App Runner → Backend API
                ↓
            MongoDB (Atlas)
                ↓
            Redis (ElastiCache/Upstash)
```

## Step 1: Set Up External Services

### MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0 tier)
3. Create a database user with password
4. Whitelist IP addresses:
   - Add `0.0.0.0/0` to allow connections from anywhere (or specific App Runner IPs)
5. Get your connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/
   ```

### Redis Setup (Choose One)

**Option A: Upstash (Easiest - Serverless)**
1. Go to [Upstash](https://upstash.com/)
2. Create a free Redis database
3. Get connection details (host, port, password)

**Option B: AWS ElastiCache**
1. Go to AWS ElastiCache console
2. Create a Redis cluster (t3.micro for free tier)
3. Note: Must be in same VPC as App Runner or use VPC Connector
4. Get the endpoint URL

### Get OpenRouter API Key

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up and get your API key
3. Add credits to your account

## Step 2: Push Code to GitHub

Ensure your backend code is in a GitHub repository:

```bash
cd backend-mvp
git add .
git commit -m "Add AWS App Runner configuration"
git push origin main
```

## Step 3: Create AWS App Runner Service

### Using AWS Console

1. **Navigate to App Runner**
   - Go to AWS Console → App Runner
   - Click "Create service"

2. **Source Configuration**
   - **Repository type**: Source code repository
   - Click "Add new" to connect GitHub
   - Authorize AWS App Runner to access your GitHub account
   - Select your repository
   - Select branch (e.g., `main` or `dev-deploy`)
   - **Deployment trigger**: Automatic (deploys on every push)

3. **Build Configuration**
   - **Configuration file**: Use a configuration file
   - **Configuration file**: `apprunner.yaml`
   
   *Alternative: If you prefer Dockerfile:*
   - Select "Use Dockerfile"
   - **Dockerfile path**: `Dockerfile`

4. **Service Settings**
   - **Service name**: `neuraleap-backend` (or your choice)
   - **Virtual CPU**: 1 vCPU
   - **Memory**: 2 GB
   - **Port**: 8080
   - **Environment variables** (Click "Configure"):

   ```
   # Required Environment Variables
   JWT_SECRET_KEY=<generate-secure-key-here>
   OPENROUTER_API_KEY=<your-openrouter-key>
   AI_MODEL_NAME=openai/gpt-4o-mini
   MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
   DATABASE_NAME=neuraleap
   PROFILES_DB_URL=mongodb+srv://user:pass@cluster.mongodb.net/
   PROFILES_DB_NAME=mydatabase
   REDIS_HOST=<your-redis-host>
   REDIS_PORT=6379
   REDIS_DB=0
   REDIS_PASSWORD=<your-redis-password>
   PORT=8080
   ```

   **Generate JWT Secret Key:**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

5. **Health Check**
   - **Health check path**: `/health`
   - **Health check interval**: 10 seconds
   - **Health check timeout**: 5 seconds
   - **Healthy threshold**: 1
   - **Unhealthy threshold**: 5

6. **Auto Scaling**
   - **Min instances**: 1
   - **Max instances**: 3
   - **Max concurrency**: 100

7. **Review and Create**
   - Review all settings
   - Click "Create & deploy"

### Using AWS CLI

```bash
# Install AWS CLI if not already installed
# Configure AWS credentials: aws configure

# Create App Runner service
aws apprunner create-service \
  --service-name neuraleap-backend \
  --source-configuration '{
    "AuthenticationConfiguration": {
      "ConnectionArn": "<YOUR-GITHUB-CONNECTION-ARN>"
    },
    "AutoDeploymentsEnabled": true,
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/YOUR-USERNAME/YOUR-REPO",
      "SourceCodeVersion": {
        "Type": "BRANCH",
        "Value": "main"
      },
      "CodeConfiguration": {
        "ConfigurationSource": "API",
        "CodeConfigurationValues": {
          "Runtime": "PYTHON_3",
          "BuildCommand": "pip install -r requirements.txt",
          "StartCommand": "python main.py",
          "Port": "8080",
          "RuntimeEnvironmentVariables": {
            "PORT": "8080",
            "JWT_SECRET_KEY": "<your-secret>",
            "OPENROUTER_API_KEY": "<your-key>",
            "MONGODB_URL": "<your-mongodb-url>",
            "DATABASE_NAME": "neuraleap",
            "REDIS_HOST": "<your-redis-host>",
            "REDIS_PORT": "6379"
          }
        }
      }
    }
  }' \
  --instance-configuration '{
    "Cpu": "1024",
    "Memory": "2048"
  }' \
  --health-check-configuration '{
    "Protocol": "HTTP",
    "Path": "/health",
    "Interval": 10,
    "Timeout": 5,
    "HealthyThreshold": 1,
    "UnhealthyThreshold": 5
  }'
```

## Step 4: Configure CORS

After deployment, you'll get an App Runner URL like:
```
https://abc123def456.us-east-1.awsapprunner.com
```

Update your backend's CORS configuration in `api.py`:

```python
allow_origins=[
    "http://localhost:3000",
    "https://your-frontend-domain.com",
    "https://*.awsapprunner.com",  # If frontend is also on App Runner
]
```

## Step 5: Update Frontend Environment Variables

Update your frontend `.env.local` or deployment environment:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.awsapprunner.com
NEXT_PUBLIC_WS_BASE_URL=wss://your-backend-url.awsapprunner.com
```

## Step 6: Test the Deployment

1. **Check Service Status**
   - In App Runner console, wait for status to show "Running"
   - This may take 5-10 minutes for first deployment

2. **Test Health Endpoint**
   ```bash
   curl https://your-backend-url.awsapprunner.com/health
   ```

3. **Test Login Endpoint**
   ```bash
   curl -X POST https://your-backend-url.awsapprunner.com/login \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","password":"testpass"}'
   ```

4. **View Logs**
   - Go to App Runner console → Your service → Logs
   - Or use CloudWatch Logs

## Monitoring and Maintenance

### View Logs

**AWS Console:**
- App Runner → Your service → Logs tab
- Or CloudWatch → Log groups → `/aws/apprunner/neuraleap-backend`

**AWS CLI:**
```bash
aws logs tail /aws/apprunner/neuraleap-backend/application --follow
```

### Metrics

Monitor these in CloudWatch:
- `2xxStatusCode` - Successful requests
- `4xxStatusCode` - Client errors  
- `5xxStatusCode` - Server errors
- `RequestCount` - Total requests
- `ActiveInstances` - Number of running instances
- `CPUUtilization` - CPU usage
- `MemoryUtilization` - Memory usage

### Update Environment Variables

1. Go to App Runner → Your service → Configuration → Edit
2. Update environment variables
3. Click "Deploy" to restart with new variables

### Redeploy

**Automatic:** Push to your GitHub branch (if auto-deploy enabled)

**Manual:**
1. App Runner console → Your service
2. Click "Deploy" → "Redeploy from source"

## Cost Estimation

### App Runner Pricing (us-east-1)

- **Compute**: 
  - 1 vCPU, 2 GB: $0.064/hour ($46/month if always running)
  - Per request: $0.000002 per request
  
- **Memory**:
  - Provisioned: included in compute
  
- **Build**:
  - $0.005 per build minute

**Estimated Monthly Cost (Low Traffic):**
- Compute (1 instance, 50% utilization): ~$25
- Requests (100k/month): ~$0.20
- Builds (10 builds/month, 5 min each): ~$0.25
- **Total: ~$25-50/month**

### External Services

- MongoDB Atlas (M0): Free (shared)
- Upstash Redis: Free tier (10k commands/day)
- OpenRouter API: Pay per token

## Troubleshooting

### Service Fails to Start

1. **Check logs** in App Runner console
2. Common issues:
   - Missing environment variables
   - MongoDB/Redis connection failures
   - Port mismatch (ensure PORT=8080)

### MongoDB Connection Issues

- Verify connection string format
- Check IP whitelist (0.0.0.0/0 for all IPs)
- Ensure username/password are URL-encoded

### Redis Connection Issues

- Verify host, port, and password
- For ElastiCache: Ensure VPC connectivity
- For Upstash: Use the REST API if needed

### WebSocket Connection Issues

- App Runner supports WebSockets
- Ensure frontend uses `wss://` protocol
- Check CORS configuration includes WebSocket origin

### High Memory/CPU Usage

1. Check for memory leaks in logs
2. Increase instance size if needed
3. Enable auto-scaling to handle spikes

## Security Best Practices

1. **Secrets Management**
   - Use AWS Secrets Manager for sensitive values
   - Rotate JWT secret periodically

2. **Network Security**
   - Use VPC Connector for private resources
   - Enable AWS WAF for DDoS protection

3. **Monitoring**
   - Set up CloudWatch alarms for errors
   - Enable AWS X-Ray for request tracing

4. **HTTPS**
   - App Runner provides HTTPS by default
   - No additional SSL setup needed

## CI/CD Pipeline

Your deployment is already set up for CI/CD:
1. Push code to GitHub
2. App Runner automatically detects changes
3. Builds and deploys new version
4. Zero-downtime rolling deployment

## Rollback

If deployment fails:
1. App Runner automatically keeps previous version running
2. Or manually trigger rollback:
   - App Runner console → Deployments → Previous deployment → Redeploy

## Custom Domain

1. Go to App Runner → Your service → Custom domains
2. Click "Link domain"
3. Add your domain (e.g., `api.yourapp.com`)
4. Add CNAME records to your DNS provider
5. Wait for validation (5-10 minutes)

## Scaling

**Vertical Scaling:**
- Increase CPU/Memory in service settings

**Horizontal Scaling:**
- Adjust min/max instances
- App Runner auto-scales based on traffic

## Support and Resources

- [AWS App Runner Documentation](https://docs.aws.amazon.com/apprunner/)
- [FastAPI on App Runner Guide](https://aws.amazon.com/blogs/containers/deploy-python-fastapi-on-aws-app-runner/)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- AWS Support (if you have support plan)

## Next Steps

1. ✅ Deploy backend to App Runner
2. ⬜ Set up custom domain
3. ⬜ Configure monitoring and alarms
4. ⬜ Deploy frontend (Vercel/Netlify recommended for Next.js)
5. ⬜ Update frontend to use App Runner backend URL
6. ⬜ Set up CI/CD for frontend
7. ⬜ Configure production-grade Redis and MongoDB
8. ⬜ Set up backup strategy for databases

