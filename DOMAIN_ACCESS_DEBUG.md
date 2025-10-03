# Domain Access Debug Guide

## ✅ Backend Works on Localhost
Your backend is running! Now we need to fix external access through `themorninglatte.com`.

## 🔍 Debug Steps (Run on EC2)

### Step 1: Check Nginx Status and Configuration

```bash
# Is nginx running?
sudo systemctl status nginx

# Test nginx configuration
sudo nginx -t

# View your current nginx configuration
sudo cat /etc/nginx/sites-enabled/default

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Step 2: Test Domain Resolution

```bash
# Check DNS resolution
nslookup themorninglatte.com

# Check what IP it resolves to
dig themorninglatte.com

# Verify it matches your EC2 public IP
curl -4 ifconfig.me  # Your public IP
```

### Step 3: Check Firewall/Security Groups

```bash
# Check if nginx is listening on port 80 and 443
sudo netstat -tlnp | grep nginx

# Check iptables (if used)
sudo iptables -L -n

# Check if port 80/443 are accessible from outside
# You should do this from your LOCAL machine:
# curl -v http://YOUR_EC2_PUBLIC_IP
# curl -v http://themorninglatte.com
```

### Step 4: Check AWS Security Group Settings

**In AWS Console:**
1. Go to EC2 → Instances → Your Instance
2. Check Security Groups
3. Verify Inbound Rules include:
   - Port 80 (HTTP) from 0.0.0.0/0
   - Port 443 (HTTPS) from 0.0.0.0/0
   - Port 22 (SSH) from your IP

### Step 5: Test Each Layer

```bash
# 1. Backend works (✅ you confirmed this)
curl http://localhost:8000/health

# 2. Nginx can reach backend
curl -H "Host: themorninglatte.com" http://localhost/health

# 3. External access from EC2 itself
curl http://themorninglatte.com/health

# 4. Check if it's an SSL issue
curl http://themorninglatte.com/health    # HTTP
curl https://themorninglatte.com/health   # HTTPS
```

## 🔧 Common Issues and Fixes

### Issue 1: Nginx Not Configured Properly

**Symptom:** `curl localhost:8000` works but `curl localhost/health` doesn't

**Fix:** Update nginx configuration

```bash
sudo nano /etc/nginx/sites-available/default
```

**Complete working configuration:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name themorninglatte.com www.themorninglatte.com;

    # Redirect HTTP to HTTPS (if you have SSL)
    # return 301 https://$server_name$request_uri;

    # OR proxy to backend (if no SSL yet)
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# If you have SSL certificate
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name themorninglatte.com www.themorninglatte.com;

    # SSL configuration (adjust paths to your certificates)
    ssl_certificate /etc/letsencrypt/live/themorninglatte.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/themorninglatte.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

After editing:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Issue 2: DNS Not Pointing to Your Server

**Symptom:** `nslookup themorninglatte.com` doesn't show your EC2 IP

**Fix:** Update DNS records (in your domain registrar/DNS provider)
- Add/Update A record: `themorninglatte.com` → Your EC2 public IP
- Add/Update A record: `www.themorninglatte.com` → Your EC2 public IP

Wait 5-10 minutes for DNS propagation.

### Issue 3: AWS Security Group Blocking Traffic

**Symptom:** `curl http://YOUR_EC2_IP` times out from your local machine

**Fix in AWS Console:**
1. EC2 → Security Groups → Your instance's security group
2. Edit Inbound Rules
3. Add these rules if missing:

| Type  | Protocol | Port Range | Source    | Description      |
|-------|----------|------------|-----------|------------------|
| HTTP  | TCP      | 80         | 0.0.0.0/0 | Allow HTTP       |
| HTTPS | TCP      | 443        | 0.0.0.0/0 | Allow HTTPS      |
| SSH   | TCP      | 22         | Your IP   | SSH access       |

### Issue 4: No SSL Certificate

**Symptom:** `https://themorninglatte.com` doesn't work but `http://` works

**Fix:** Install Let's Encrypt SSL certificate

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (nginx must be running)
sudo certbot --nginx -d themorninglatte.com -d www.themorninglatte.com

# Follow prompts and choose to redirect HTTP to HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

### Issue 5: Nginx Not Running

**Symptom:** `systemctl status nginx` shows inactive

**Fix:**
```bash
# Start nginx
sudo systemctl start nginx

# Enable on boot
sudo systemctl enable nginx

# If it fails to start, check logs
sudo journalctl -xeu nginx
```

## 🧪 Complete Test Sequence

Run these from **your local machine** (not EC2):

```bash
# 1. DNS resolution
nslookup themorninglatte.com

# 2. Can you reach the server?
ping themorninglatte.com

# 3. HTTP access
curl -v http://themorninglatte.com/health

# 4. HTTPS access
curl -v https://themorninglatte.com/health

# 5. CORS preflight
curl -X OPTIONS https://themorninglatte.com/login \
  -H "Origin: https://dev.damnuiwdbbvte.amplifyapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v
```

## 📊 Diagnostic Script

Save this as `diagnose.sh` on your EC2 server and run it:

```bash
#!/bin/bash

echo "=== System Diagnostics ==="
echo ""

echo "1. Backend Service Status:"
sudo systemctl status backend --no-pager | head -n 10
echo ""

echo "2. Backend Listening Port:"
sudo netstat -tlnp | grep :8000
echo ""

echo "3. Backend Health Check:"
curl -s http://localhost:8000/health
echo ""

echo "4. Nginx Status:"
sudo systemctl status nginx --no-pager | head -n 10
echo ""

echo "5. Nginx Listening Ports:"
sudo netstat -tlnp | grep nginx
echo ""

echo "6. Nginx Configuration Test:"
sudo nginx -t
echo ""

echo "7. Public IP Address:"
curl -s ifconfig.me
echo ""

echo "8. DNS Resolution:"
nslookup themorninglatte.com | grep Address
echo ""

echo "9. Test via Nginx:"
curl -H "Host: themorninglatte.com" http://localhost/health
echo ""

echo "10. Recent Nginx Errors:"
sudo tail -n 5 /var/log/nginx/error.log
echo ""

echo "=== Diagnostics Complete ==="
```

Run it:
```bash
chmod +x diagnose.sh
./diagnose.sh
```

## 🆘 Quick Fixes to Try

```bash
# Fix 1: Restart everything
sudo systemctl restart backend
sudo systemctl restart nginx

# Fix 2: Check default site is enabled
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Fix 3: Verify backend environment
cd /home/ubuntu/backend-mvp
cat .env  # Make sure DATABASE_NAME, MONGODB_URL, etc. are set

# Fix 4: Check firewall
sudo ufw status  # If using UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 📞 Need the Exact Error?

Run this and share the output:

```bash
curl -v https://themorninglatte.com/health 2>&1 | head -n 30
```

This will show the exact error (connection refused, SSL error, 404, 502, etc.)


