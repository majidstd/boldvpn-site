# BoldVPN API - FreeBSD Deployment Guide

Complete guide for deploying the BoldVPN API on FreeBSD 14 alongside FreeRADIUS.

## Prerequisites

- ✅ FreeBSD 14.0-RELEASE server
- ✅ FreeRADIUS + PostgreSQL already installed (from `freebsd-radius-setup.sh`)
- ✅ Root/sudo access to the server
- ✅ SSH access to the server

## Quick Deployment

### Step 1: Copy API Files to Server

From your local machine:

```bash
# From the boldvpn-site directory
cd api

# Copy to FreeBSD server
scp -r ./ admin@YOUR_SERVER_IP:~/boldvpn-api/
```

### Step 2: Run Setup Script

SSH into your FreeBSD server and run the setup script:

```bash
# SSH into server
ssh admin@YOUR_SERVER_IP

# Navigate to API directory
cd boldvpn-api

# Make setup script executable
chmod +x freebsd-api-setup.sh

# Run as root
sudo ./freebsd-api-setup.sh
```

### Step 3: Configuration

The script will prompt you for:

1. **API Port** (default: 3000)
2. **JWT Secret** (create a strong random string, at least 32 characters)
3. **PostgreSQL Password** (use the same password from RADIUS setup)
4. **API Domain** (e.g., api.boldvpn.net)

Example:

```
API Port (default 3000): 3000
JWT Secret (create strong random string): 4f9a8b7c6d5e3f2a1b0c9d8e7f6g5h4i3j2k1l
PostgreSQL radiususer password (from RADIUS setup): YourRadiusDBPassword
Domain for API (e.g., api.boldvpn.net): api.boldvpn.net
```

### Step 4: Verify Installation

The script will automatically:

1. Install Node.js 20
2. Create `/usr/local/boldvpn-api` directory
3. Copy all API files
4. Create `.env` configuration
5. Install npm dependencies
6. Create FreeBSD service
7. Start the API server

Verify it's running:

```bash
# Check service status
service boldvpn_api status

# Should show:
# boldvpn_api is running as pid XXXX

# Test health endpoint
curl http://localhost:3000/api/health

# Should return:
# {"status":"OK","timestamp":"2024-...","uptime":123.45}
```

## Service Management

### Basic Commands

```bash
# Check status
service boldvpn_api status

# Start service
service boldvpn_api start

# Stop service
service boldvpn_api stop

# Restart service
service boldvpn_api restart
```

### View Logs

```bash
# View recent logs
tail -f /var/log/boldvpn-api.log

# View all logs
cat /var/log/boldvpn-api.log

# Search for errors
grep "\[X\]" /var/log/boldvpn-api.log
grep "Error" /var/log/boldvpn-api.log
```

### Auto-Start on Boot

The setup script automatically enables the service to start on boot.

To verify:

```bash
# Check if enabled
sysrc boldvpn_api_enable

# Should show:
# boldvpn_api_enable: YES
```

## Configuration Files

### API Directory Structure

```
/usr/local/boldvpn-api/
├── .env                    # Environment configuration
├── server.js               # Main server file
├── package.json            # Dependencies
├── node_modules/           # Installed packages
├── routes/
│   ├── auth.js            # Authentication endpoints
│   ├── user.js            # User management endpoints
│   └── billing.js         # Billing endpoints
├── middleware/
│   └── auth.js            # JWT verification
└── utils/
    └── database.js        # PostgreSQL connection
```

### Environment Variables

Located at: `/usr/local/boldvpn-api/.env`

```env
NODE_ENV=production
PORT=3000

# Database (from RADIUS setup)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=radius
DB_USER=radiususer
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# CORS (frontend domains)
CORS_ORIGIN=https://boldvpn.net,https://www.boldvpn.net

# Stripe (add later)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# API Domain
API_DOMAIN=api.boldvpn.net
```

To edit:

```bash
sudo nano /usr/local/boldvpn-api/.env
# After editing, restart service:
sudo service boldvpn_api restart
```

## HTTPS Setup (Nginx Reverse Proxy)

For production, you need HTTPS. Install and configure nginx:

### Step 1: Install Nginx

```bash
sudo pkg install -y nginx certbot py39-certbot-nginx
```

### Step 2: Configure Nginx

Create `/usr/local/etc/nginx/conf.d/boldvpn-api.conf`:

```nginx
server {
    listen 80;
    server_name api.boldvpn.net;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.boldvpn.net;

    # SSL certificates (will be added by certbot)
    ssl_certificate /usr/local/etc/letsencrypt/live/api.boldvpn.net/fullchain.pem;
    ssl_certificate_key /usr/local/etc/letsencrypt/live/api.boldvpn.net/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Node.js API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check (bypass rate limiting)
    location /api/health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
```

### Step 3: Get SSL Certificate

```bash
# Enable nginx
sudo sysrc nginx_enable="YES"
sudo service nginx start

# Get SSL certificate
sudo certbot --nginx -d api.boldvpn.net

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 4: Test HTTPS

```bash
curl https://api.boldvpn.net/api/health
```

## Firewall Configuration

If using the firewall from `setup-firewall.sh`, add API ports:

```bash
# Edit firewall rules
sudo nano /etc/ipfw.rules

# Add after SSH rules:
# API Server (if exposing directly)
$cmd 00200 allow tcp from any to me 3000 in via $iif setup $ks

# Or just allow nginx (ports 80, 443)
$cmd 00200 allow tcp from any to me 80 in via $iif setup $ks
$cmd 00210 allow tcp from any to me 443 in via $iif setup $ks

# Reload firewall
sudo service ipfw restart
```

## Testing the API

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Test with Real Request (Login)

```bash
# Login as testuser
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123!"}'

# Should return JWT token:
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","user":{...}}
```

### Test Database Connection

```bash
# View API logs
tail -f /var/log/boldvpn-api.log

# Look for:
# [OK] Database connected successfully
# [OK] BoldVPN API server running on port 3000
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
tail -100 /var/log/boldvpn-api.log

# Common issues:
# 1. Port already in use
sudo sockstat -l | grep 3000

# 2. Database connection failed
psql -U radiususer -d radius -c "SELECT version();"

# 3. Missing dependencies
cd /usr/local/boldvpn-api
npm install
```

### Database Connection Errors

```bash
# Test PostgreSQL connection
psql -U radiususer -d radius

# Check password in .env
sudo cat /usr/local/boldvpn-api/.env | grep DB_PASSWORD

# Verify it matches RADIUS setup
```

### Permission Errors

```bash
# Fix ownership
sudo chown -R root:wheel /usr/local/boldvpn-api

# Fix .env permissions
sudo chmod 600 /usr/local/boldvpn-api/.env
```

## Updating the API

To update the API code:

```bash
# Stop service
sudo service boldvpn_api stop

# Backup current version
sudo cp -r /usr/local/boldvpn-api /usr/local/boldvpn-api.backup

# Copy new files
scp -r api/* admin@YOUR_SERVER_IP:~/boldvpn-api-new/

# On server, copy new files
sudo cp -r ~/boldvpn-api-new/* /usr/local/boldvpn-api/

# Install any new dependencies
cd /usr/local/boldvpn-api
sudo npm install --production

# Start service
sudo service boldvpn_api start

# Check logs
tail -f /var/log/boldvpn-api.log
```

## Monitoring

### Check Service Status Regularly

```bash
# Add to crontab for monitoring
crontab -e

# Add line:
*/5 * * * * service boldvpn_api status || service boldvpn_api start
```

### Log Rotation

Create `/usr/local/etc/newsyslog.conf.d/boldvpn-api.conf`:

```
# logfilename          [owner:group]    mode count size when  flags
/var/log/boldvpn-api.log  root:wheel      644  7     1024 *     J
```

Apply:

```bash
sudo newsyslog -v
```

## Next Steps

1. ✅ API server deployed and running
2. ⏳ Configure HTTPS with nginx
3. ⏳ Add Stripe API keys to `.env`
4. ⏳ Update customer portal to use API domain
5. ⏳ Test all API endpoints
6. ⏳ Set up monitoring and alerts

## Support

- 📧 View logs: `/var/log/boldvpn-api.log`
- 📊 Service status: `service boldvpn_api status`
- 🔍 Database: `psql -U radiususer -d radius`

