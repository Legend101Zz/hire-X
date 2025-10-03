# Backend Service Fix - Quick Guide

## 🎯 Root Cause
Your CORS error was actually caused by **the backend not running at all**! 
When you got "Connection refused on port 8000", it means the systemd service wasn't starting properly.

## ✅ What We Fixed

### 1. **Fixed `main.py`** 
- Added `app = create_app()` at module level so uvicorn can import it as `main:app`
- Your existing `backend.service` file will now work without changes!

### 2. **Enhanced CORS Configuration**
- Already configured in your FastAPI backend with your Amplify domain
- Added `expose_headers`, `max_age`, and explicit OPTIONS handlers

## 🚀 Deployment Steps

### Step 1: Push Code to Your Server

```bash
# On your local machine (from project root)
cd /Users/adityapatil/Projects/hire-X
git add backend-mvp/main.py backend-mvp/api.py
git commit -m "Fix: Expose app for uvicorn and enhance CORS configuration"
git push origin workflow
```

### Step 2: Update Backend on EC2

SSH into your EC2 instance and run:

```bash
# Navigate to backend directory
cd /home/ubuntu/backend-mvp

# Pull latest changes
git pull origin workflow

# Make sure .env file has all required variables
cat .env  # Check if it exists and has all keys

# Copy systemd service file if not already there
sudo cp backend.service /etc/systemd/system/backend.service

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable backend

# Start the service
sudo systemctl start backend

# Check status
sudo systemctl status backend
```

### Step 3: Verify Backend is Running

```bash
# Check if port 8000 is listening
sudo netstat -tlnp | grep 8000

# Test health endpoint
curl http://localhost:8000/health

# Test CORS preflight
curl -X OPTIONS http://localhost:8000/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected output:**
```
< HTTP/1.1 200 OK
< access-control-allow-origin: https://dev.damnuiwdbbvte.amplifyapp.com
< access-control-allow-credentials: true
< access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH
< access-control-allow-headers: *
```

### Step 4: Configure Nginx (Simple Proxy)

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/default
```

Use this simple configuration:

```nginx
server {
    listen 80;
    server_name themorninglatte.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin $http_origin;
    }
}
```

Test and reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Test from Internet

```bash
# Test from your local machine or browser
curl https://themorninglatte.com/health

# Test CORS
curl -X OPTIONS https://themorninglatte.com/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

## 🔍 Troubleshooting

### If Backend Won't Start

```bash
# Check logs for errors
sudo journalctl -u backend -n 100

# Common issues:
# 1. Redis not running
sudo systemctl status redis
sudo systemctl start redis

# 2. Missing environment variables
cd /home/ubuntu/backend-mvp
cat .env  # Check all required variables are present

# 3. Permission issues
sudo chown -R ubuntu:ubuntu /home/ubuntu/backend-mvp
```

### If Getting "Module not found" Errors

```bash
# Make sure virtual environment has dependencies
cd /home/ubuntu/backend-mvp
source venv/bin/activate
pip install -r requirements.txt
```

### View Live Logs

```bash
# Backend logs
sudo journalctl -u backend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## ✨ After These Steps

Your backend should be:
- ✅ Running on port 8000
- ✅ Handling CORS properly
- ✅ Accessible from your Amplify frontend
- ✅ Auto-restarting on crashes
- ✅ Starting on server reboot

Your CORS issue should be completely resolved!

