# CORS Fix for AWS Deployment

## Problem
Frontend deployed on AWS Amplify (`https://dev.damnuiwdbbvte.amplifyapp.com`) cannot access backend at `https://themorninglatte.com` due to CORS policy.

## Changes Made to Backend Code
1. ✅ Added `expose_headers=["*"]` to CORS middleware
2. ✅ Added `max_age=3600` to cache preflight requests
3. ✅ Added explicit OPTIONS handlers for `/login` and `/parse-prompt` endpoints
4. ✅ Amplify domain already in allowed origins list

## AWS Deployment Fixes Required

### Option 1: If Using Nginx as Reverse Proxy

SSH into your EC2 instance and edit your nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/default
```

Update your nginx configuration to properly handle CORS:

```nginx
server {
    listen 80;
    server_name themorninglatte.com;

    location / {
        # Proxy to uvicorn
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Pass through all headers including Origin
        proxy_set_header Origin $http_origin;
        
        # Don't add CORS headers here - let FastAPI handle them
        # This ensures consistent CORS behavior
    }
}
```

**Alternative: If you want nginx to handle CORS (not recommended, let FastAPI do it):**

```nginx
server {
    listen 80;
    server_name themorninglatte.com;

    location / {
        # Handle OPTIONS preflight
        if ($request_method = OPTIONS) {
            return 204;
        }

        # Proxy to uvicorn
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin $http_origin;
        
        # Hide backend CORS headers (optional, only if you want nginx to override)
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Credentials;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
    }
    
    # Add CORS headers at server level (outside location block)
    add_header 'Access-Control-Allow-Origin' 'https://dev.damnuiwdbbvte.amplifyapp.com' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
    add_header 'Access-Control-Max-Age' '3600' always;
}
```

**Recommended Approach: Use the FIRST configuration (let FastAPI handle CORS)**
- Your FastAPI backend already has proper CORS middleware configured
- Nginx just needs to pass requests through without interference
- Simpler and less error-prone

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**If nginx config test still fails**, check your complete nginx config:
```bash
sudo nginx -T | grep -A 50 "server_name themorninglatte.com"
```

### Option 2: If Using AWS Application Load Balancer (ALB)

ALBs don't handle CORS directly. Make sure:

1. **Security Group allows traffic:**
   - Inbound rules should allow HTTP (80) and HTTPS (443) from anywhere
   - Outbound rules should allow all traffic

2. **Target Group health checks:**
   - Check that your EC2 instance is healthy in the target group
   - Use `/health` endpoint for health checks

3. **Listener Rules:**
   - Make sure HTTPS listener forwards to your target group
   - All HTTP methods should be allowed (including OPTIONS)

### Option 3: If Using CloudFront

Add a custom header policy in CloudFront:

1. Go to CloudFront → Your Distribution → Behaviors
2. Edit the behavior for your origin
3. Under "Cache policy", create or edit to include:
   - **Allowed HTTP Methods:** GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - **Cache HTTP headers:** Include `Origin`, `Access-Control-Request-Method`, `Access-Control-Request-Headers`

4. Under "Origin request policy", create or edit to forward these headers:
   - Origin
   - Access-Control-Request-Method
   - Access-Control-Request-Headers

### Option 4: **CRITICAL - Verify Backend Service is Running**

⚠️ **If you get "Connection refused" errors, your backend is not running!**

SSH into your EC2 instance and check:

```bash
# Check if service is running
sudo systemctl status backend

# If not running, check why
sudo journalctl -u backend -n 50

# Check if port 8000 is listening
sudo netstat -tlnp | grep 8000
# OR
sudo lsof -i :8000
```

**Common Issue: Wrong systemd service configuration**

Your `backend.service` file has:
```
ExecStart=/home/ubuntu/backend-mvp/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

But this is **WRONG** because in your `main.py`, the app is at `api.app`, not `app`. 

**Fix the systemd service file:**

```bash
# Edit the service file on your EC2 instance
sudo nano /etc/systemd/system/backend.service
```

Change the `ExecStart` line to **ONE of these options**:

**Option A: Run main.py directly (RECOMMENDED)**
```ini
[Unit]
Description=Neuraleap Backend API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/backend-mvp
Environment="PATH=/home/ubuntu/backend-mvp/venv/bin"
ExecStart=/home/ubuntu/backend-mvp/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Option B: Use uvicorn with correct app path**
```ini
ExecStart=/home/ubuntu/backend-mvp/venv/bin/uvicorn main:api.app --host 0.0.0.0 --port 8000
```

**Option C: Create an app instance in main.py**

Add this line to `/home/ubuntu/backend-mvp/main.py` after line 22:
```python
api = API(model, redis_manager)
app = api.app  # Add this line so uvicorn can find it as 'main:app'
```

**After fixing, reload and start the service:**

```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable backend

# Start the service
sudo systemctl start backend

# Check status
sudo systemctl status backend

# View logs in real-time
sudo journalctl -u backend -f
```

**Test backend locally:**
```bash
curl -X OPTIONS http://localhost:8000/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

The OPTIONS request should return headers like:
```
< HTTP/1.1 200 OK
< access-control-allow-origin: https://dev.damnuiwdbbvte.amplifyapp.com
< access-control-allow-credentials: true
< access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH
```

## After Making Changes

1. **Deploy updated backend code:**
```bash
# On your local machine
cd backend-mvp
git add .
git commit -m "Fix CORS configuration"
git push

# On EC2 instance
cd /home/ubuntu/backend-mvp
git pull
sudo systemctl restart backend
```

2. **Test CORS from browser console:**
```javascript
fetch('https://themorninglatte.com/health', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
```

3. **Check browser developer tools:**
   - Open Network tab
   - Look for the OPTIONS request (preflight)
   - Check if response has `Access-Control-Allow-Origin` header

## Common Issues

### Issue: "No 'Access-Control-Allow-Origin' header"
**Solution:** Nginx/ALB is blocking OPTIONS requests before they reach FastAPI

### Issue: "Credentials flag is true, but Access-Control-Allow-Credentials is not"
**Solution:** Make sure `allow_credentials=True` in CORS middleware and nginx adds the header

### Issue: "CORS policy: Response to preflight request doesn't pass"
**Solution:** OPTIONS request is being blocked by firewall/security group or not handled properly

## Quick Test Commands

```bash
# Test from command line
curl -X OPTIONS https://themorninglatte.com/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v

# Test health endpoint
curl https://themorninglatte.com/health
```

## Need More Help?

1. Check nginx error logs: `sudo tail -f /var/log/nginx/error.log`
2. Check backend logs: `sudo journalctl -u backend -f`
3. Verify DNS: `nslookup themorninglatte.com`
4. Check SSL certificate: `curl -vI https://themorninglatte.com`

