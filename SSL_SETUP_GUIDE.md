# SSL Setup with Certbot (HTTPS + CORS)

## 🔐 Step-by-Step SSL Setup

### Step 1: Prepare Nginx Configuration (Before SSL)

First, make sure nginx is configured to proxy to your backend on HTTP (port 80).

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/default
```

Use this configuration (certbot will modify it):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name themorninglatte.com www.themorninglatte.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save and test:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2: Install Certbot

```bash
# Update package list
sudo apt update

# Install certbot and nginx plugin
sudo apt install certbot python3-certbot-nginx -y

# Verify installation
certbot --version
```

### Step 3: Get SSL Certificate

**Option A: Automatic (Recommended) - Certbot configures everything**

```bash
# This will:
# 1. Get SSL certificate
# 2. Update nginx config automatically
# 3. Set up HTTP to HTTPS redirect
sudo certbot --nginx -d themorninglatte.com -d www.themorninglatte.com
```

**Follow the prompts:**
1. Enter email address (for renewal notifications)
2. Agree to terms of service: `Y`
3. Share email with EFF (optional): `Y` or `N`
4. **IMPORTANT:** When asked "Please choose whether or not to redirect HTTP traffic to HTTPS":
   - Choose `2` (Redirect - Redirect all HTTP traffic to HTTPS)

**Option B: Manual (if you want more control)**

```bash
# Just get the certificate, don't modify nginx
sudo certbot certonly --nginx -d themorninglatte.com -d www.themorninglatte.com
```

### Step 4: Verify SSL Certificate

```bash
# Check certificate details
sudo certbot certificates

# Test from your local machine
curl -v https://themorninglatte.com/health
```

### Step 5: Test Auto-Renewal

```bash
# Dry run of certificate renewal
sudo certbot renew --dry-run

# If successful, certbot will auto-renew before expiration
```

## 🔧 Post-SSL Nginx Configuration (CORS-Friendly)

After certbot runs, your nginx config should look like this. If not, manually edit it:

```bash
sudo nano /etc/nginx/sites-available/default
```

**Complete HTTPS + CORS Configuration:**

```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name themorninglatte.com www.themorninglatte.com;

    # Certbot will add this redirect automatically
    return 301 https://$server_name$request_uri;
}

# HTTPS server - main configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name themorninglatte.com www.themorninglatte.com;

    # SSL configuration (certbot adds these)
    ssl_certificate /etc/letsencrypt/live/themorninglatte.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/themorninglatte.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers (don't interfere with CORS from FastAPI)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to FastAPI backend
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Forward headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # IMPORTANT: Forward Origin header so FastAPI CORS middleware works
        proxy_set_header Origin $http_origin;
        
        # Don't cache
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Key CORS settings:**
- `proxy_set_header Origin $http_origin;` - Passes Origin header to FastAPI
- NO `add_header Access-Control-*` directives - Let FastAPI handle CORS
- FastAPI CORS middleware will work transparently

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Verification Steps

### Test 1: HTTPS Works
```bash
# From your local machine
curl https://themorninglatte.com/health
```

**Expected:** `{"status": "healthy", "cors": "enabled"}`

### Test 2: HTTP Redirects to HTTPS
```bash
curl -I http://themorninglatte.com/health
```

**Expected:** `301 Moved Permanently` with `Location: https://...`

### Test 3: CORS Works with HTTPS
```bash
curl -X OPTIONS https://themorninglatte.com/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v
```

**Expected response headers:**
```
< HTTP/2 200
< access-control-allow-origin: https://dev.damnuiwdbbvte.amplifyapp.com
< access-control-allow-credentials: true
< access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH
< access-control-allow-headers: *
```

### Test 4: Frontend Can Connect

Open browser console on your Amplify frontend and run:

```javascript
fetch('https://themorninglatte.com/health', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(response => response.json())
.then(data => console.log('✅ Success:', data))
.catch(error => console.error('❌ Error:', error));
```

## 🔄 Auto-Renewal Setup

Certbot automatically sets up renewal. Verify it's configured:

```bash
# Check systemd timer
sudo systemctl status certbot.timer

# Check renewal configuration
sudo cat /etc/cron.d/certbot
# OR
sudo systemctl list-timers | grep certbot
```

**Manual renewal (if needed):**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

## 🚨 Troubleshooting

### Issue: Certbot fails with "Connection refused"

**Cause:** Port 80 not accessible from internet

**Fix:**
```bash
# Check AWS Security Group allows port 80
# Temporarily disable nginx if something else is using port 80
sudo lsof -i :80
```

### Issue: Certbot fails with "DNS problem"

**Cause:** Domain doesn't point to your server

**Fix:**
```bash
# Verify DNS
nslookup themorninglatte.com

# Make sure A record points to your EC2 public IP
curl ifconfig.me  # Your public IP
```

### Issue: CORS stops working after SSL

**Cause:** nginx adding conflicting CORS headers

**Fix:** Remove any `add_header Access-Control-*` lines from nginx config, let FastAPI handle it

### Issue: "Mixed Content" errors in browser

**Cause:** Frontend on HTTPS trying to reach HTTP backend

**Fix:** Make sure you're using `https://themorninglatte.com` (not http://)

## 📝 Update Frontend Configuration

After SSL is working, update your frontend to use HTTPS:

In your frontend code (`src/utils/api.ts` or similar):

```typescript
// Change this:
const API_BASE_URL = 'http://themorninglatte.com';

// To this:
const API_BASE_URL = 'https://themorninglatte.com';
```

## 🎯 Complete Command Sequence

**Run these commands in order on your EC2 instance:**

```bash
# 1. Update system
sudo apt update

# 2. Install certbot
sudo apt install certbot python3-certbot-nginx -y

# 3. Make sure nginx is running
sudo systemctl status nginx

# 4. Get SSL certificate (interactive)
sudo certbot --nginx -d themorninglatte.com -d www.themorninglatte.com

# 5. Verify certificate
sudo certbot certificates

# 6. Test HTTPS
curl https://themorninglatte.com/health

# 7. Test CORS
curl -X OPTIONS https://themorninglatte.com/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -v

# 8. Test auto-renewal
sudo certbot renew --dry-run

# Done! ✅
```

## 🔒 Security Best Practices

After SSL is set up, your connection is encrypted and secure:
- ✅ Traffic encrypted between browser and server
- ✅ HTTPS prevents man-in-the-middle attacks
- ✅ Auto-renewal prevents certificate expiration
- ✅ CORS still works properly via FastAPI
- ✅ Credentials sent securely

Your CORS configuration in FastAPI already includes `https://dev.damnuiwdbbvte.amplifyapp.com`, so everything will work seamlessly!


