# BoldVPN API - FreeBSD Deployment Guide

Complete guide for deploying the BoldVPN API on FreeBSD 14 alongside FreeRADIUS.

## 📑 Table of Contents

### Getting Started
- [Prerequisites](#prerequisites)
- [Quick Deployment](#quick-deployment)

### Configuration
- [Step 1: Copy API Files](#step-1-copy-api-files-to-server)
- [Step 2: Run Setup Script](#step-2-run-setup-script)
- [Step 3: Configuration](#step-3-configuration)
- [Step 4: Verify Installation](#step-4-verify-installation)

### Service Management
- [Managing the API Service](#managing-the-api-service)
- [Updating the API](#updating-the-api)
- [Monitoring](#monitoring)

### Troubleshooting
- [Comprehensive Troubleshooting](#comprehensive-troubleshooting)
  - [API Issues](#api-issues)
    - [API Won't Start](#api-wont-start)
    - [Invalid Credentials](#api-returns-invalid-username-or-password)
    - [CORS Errors](#cors-errors-in-browser)
  - [Database Issues](#database-issues)
    - [Can't Connect](#cant-connect-to-postgresql)
    - [Connection Refused](#database-connection-refused)
    - [Authentication Failed](#userpassword-authentication-failed)
  - [RADIUS Issues](#radius-issues)
    - [RADIUS Not Running](#radius-not-running)
    - [Access-Reject](#radius-returns-access-reject)
    - [SQL Module Errors](#sql-module-not-found)
    - [Permission Errors](#permission-denied-errors)
    - [Unknown Attributes](#unknown-attribute-errors)
  - [HAProxy/Network Issues](#haproxynetwork-issues)
    - [API Not Accessible](#api-not-accessible-from-internet)
    - [SSL/TLS Errors](#ssltls-errors)
    - [Connection Hangs](#connection-hangs-after-first-request)
    - [Intermittent Connections](#intermittent-connections-from-lan)
    - [WAN Firewall](#wan-firewall-blocking)
- [Complete Diagnostic Checklist](#complete-diagnostic-checklist)
- [Quick Fixes Summary](#quick-fixes-summary)

### Reference
- [Support](#support)

---

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

## Comprehensive Troubleshooting

### API Issues

#### API Won't Start

**Check service status:**
```bash
sudo service boldvpn_api status
```

**Check logs for errors:**
```bash
tail -50 /var/log/boldvpn-api.log
```

**Common errors:**

**1. Port already in use:**
```bash
# Check what's using port 3000
sockstat -l | grep 3000

# Kill the process
sudo kill <PID>

# Or change API port in .env
sudo nano /usr/local/boldvpn-site/api/.env
# Change: PORT=3001
```

**2. Module not found:**
```bash
cd /usr/local/boldvpn-site/api
sudo npm install
sudo service boldvpn_api restart
```

**3. Permission denied:**
```bash
sudo chown -R root:wheel /usr/local/boldvpn-site/api
sudo chmod 600 /usr/local/boldvpn-site/api/.env
sudo service boldvpn_api restart
```

---

#### API Returns "Invalid username or password"

**Check database connection:**
```bash
# Test database connectivity
cd /usr/local/boldvpn-site/api
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', database: 'radius', user: 'radiususer', password: 'YOUR_PASSWORD' }); pool.query('SELECT 1').then(() => console.log('DB OK')).catch(err => console.error('DB Error:', err)).finally(() => pool.end());"
```

**Check if user exists:**
```bash
sudo -u postgres psql radius -c "SELECT * FROM radcheck WHERE username = 'testuser';"
```

**Check password format:**
```bash
# API supports both bcrypt and plain text
# If password in database is plain text (Cleartext-Password), API will compare directly
# If password starts with $2a$ or $2b$, API will use bcrypt
```

**Verify API database config:**
```bash
cat /usr/local/boldvpn-site/api/utils/database.js | grep -A 10 "Pool("
```

---

#### CORS Errors in Browser

**Add CORS headers to API:**

Edit `/usr/local/boldvpn-site/api/server.js`:

```javascript
// Add AFTER express.json() middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
```

Restart:
```bash
sudo service boldvpn_api restart
```

---

### Database Issues

#### Can't Connect to PostgreSQL

**Check if PostgreSQL is running:**
```bash
sudo service postgresql status
ps aux | grep postgres
```

**Start PostgreSQL:**
```bash
sudo service postgresql start
```

**Check PostgreSQL version:**
```bash
ls /var/db/postgres/
# Should show data directory like data18, data17, etc.
```

**If PostgreSQL was removed by freeradius3-pgsql:**
```bash
# Reinstall matching version
sudo pkg install postgresql18-server  # Match your data version

# Start it
sudo service postgresql start
```

---

#### Database Connection Refused

**Check pg_hba.conf:**
```bash
sudo cat /var/db/postgres/data*/pg_hba.conf | grep -A 5 "local"
```

**Should have:**
```
local   all   all   trust
# or
local   all   all   md5
```

**If missing, add:**
```bash
sudo nano /var/db/postgres/data18/pg_hba.conf

# Add:
local   all   radiususer   md5
local   all   postgres     md5

# Reload
sudo service postgresql reload
```

---

#### User/Password Authentication Failed

**Reset radiususer password:**
```bash
sudo -u postgres psql

ALTER USER radiususer WITH PASSWORD 'YOUR_NEW_PASSWORD';

\q
```

**Update API .env:**
```bash
sudo nano /usr/local/boldvpn-site/api/.env

# Update:
DB_PASSWORD=YOUR_NEW_PASSWORD
```

**Restart API:**
```bash
sudo service boldvpn_api restart
```

---

### RADIUS Issues

#### RADIUS Not Running

**Check status:**
```bash
sudo service radiusd status
```

**Check configuration:**
```bash
sudo radiusd -C
```

**Run in debug mode:**
```bash
sudo service radiusd stop
sudo radiusd -X
# Watch for errors
# Press Ctrl+C to stop
sudo service radiusd start
```

---

#### RADIUS Returns Access-Reject

**Test user exists:**
```bash
sudo -u postgres psql radius -c "SELECT * FROM radcheck WHERE username = 'testuser';"
```

**Check queries.conf:**
```bash
sudo cat /usr/local/etc/raddb/mods-config/sql/main/postgresql/queries.conf | grep "User-Name"
```

**Should show:** `'%{User-Name}'` NOT `'%{SQL-User-Name}'`

**If wrong, fix it:**
```bash
cat << 'QUERYEOF' | sudo tee /usr/local/etc/raddb/mods-config/sql/main/postgresql/queries.conf > /dev/null
safe_characters = "@abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_: /"
authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{User-Name}' ORDER BY id"
authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{User-Name}' ORDER BY id"
group_membership_query = "SELECT groupname FROM radusergroup WHERE username = '%{User-Name}' ORDER BY priority"
accounting_start_query = ""
accounting_stop_query = ""
accounting_update_query = ""
QUERYEOF

sudo service radiusd restart
```

---

#### SQL Module Not Found

**Enable SQL module:**
```bash
cd /usr/local/etc/raddb/mods-enabled
sudo ln -s ../mods-available/sql sql
sudo service radiusd restart
```

---

#### Permission Denied Errors

**Fix all RADIUS permissions:**
```bash
sudo chown -R root:wheel /usr/local/etc/raddb
sudo find /usr/local/etc/raddb -type d -exec chmod 755 {} \;
sudo find /usr/local/etc/raddb -type f -exec chmod 644 {} \;
sudo mkdir -p /var/log/radius
sudo chown -R root:wheel /var/log/radius
sudo chmod 755 /var/log/radius
sudo service radiusd restart
```

---

#### Unknown Attribute Errors

**Error:** `Failed to create the pair: Unknown name "Max-Monthly-Traffic"`

**Solution:** Use standard attributes or remove custom ones:

```bash
# Check what attributes are causing issues
sudo -u postgres psql radius -c "SELECT DISTINCT attribute FROM radreply;"

# Remove custom attributes (or use standard ones)
sudo -u postgres psql radius

DELETE FROM radreply WHERE attribute = 'Max-Monthly-Traffic';

\q
```

**Or keep standard WISPr attributes only:**
- `WISPr-Bandwidth-Max-Down` (standard)
- `WISPr-Bandwidth-Max-Up` (standard)
- `Simultaneous-Use` (standard)

---

### HAProxy/Nginx Issues

#### API Not Accessible from Internet

**Check HAProxy backend status:**
```
OPNsense → Services → HAProxy → Statistics
```

**Backend should be GREEN (UP)**

**If RED (DOWN):**

1. **Check API is running on FreeBSD:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Check from OPNsense:**
   ```bash
   curl http://192.168.50.2:3000/api/health
   ```

3. **Check HAProxy health check settings:**
   - Increase timeout to 5000ms
   - Check path is `/api/health`

4. **Check firewall between OPNsense and FreeBSD**

---

#### SSL/TLS Errors

**Error:** `curl: (35) SSL routines: tlsv1 alert protocol version`

**This is a CLIENT-SIDE issue (old curl)!**

**Workarounds:**
```bash
# Force TLS 1.2
curl --tlsv1.2 https://api.boldvpn.net/api/health

# Or test in browser (always works)
https://api.boldvpn.net/api/health

# Or update curl
brew install curl
```

**Server is fine!** Modern browsers work perfectly.

---

#### Connection Hangs After First Request

**Issue:** HAProxy keepalive connections not closing

**Fix in OPNsense HAProxy Backend Pool:**

**Tuning Options:**
- Connection Timeout: `5000`
- Server Timeout: `30000`
- HTTP reuse: `safe`

**Option pass-through:**
```
option http-server-close
option forwardfor
```

---

### Network/Connectivity Issues

#### Intermittent Connections from LAN

**Issue:** Split-brain DNS (internal clients resolve to public IP)

**Solution:** Add DNS override on OPNsense:

```
Services → Unbound DNS → Overrides → Host Overrides

Host: api
Domain: boldvpn.net
IP: 192.168.50.1 (OPNsense LAN IP)
```

**Or test with internal IP:**
```bash
curl http://192.168.50.2:3000/api/health
```

---

#### WAN Firewall Blocking

**Ensure WAN rules allow traffic to HAProxy:**

```
Firewall → Rules → WAN

Add rule:
  Action: Pass
  Protocol: TCP
  Destination: This Firewall (self)
  Destination Port: 80, 443
```

---

### Complete Diagnostic Checklist

**Run these in order to diagnose issues:**

```bash
# 1. Check all services
sudo service postgresql status
sudo service radiusd status
sudo service boldvpn_api status

# 2. Test database
sudo -u postgres psql radius -c "SELECT 1;"

# 3. Test RADIUS
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123

# 4. Test API locally
curl http://localhost:3000/api/health

# 5. Test API login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123!"}'

# 6. Test from OPNsense
curl http://192.168.50.2:3000/api/health

# 7. Test via HAProxy (HTTPS)
curl https://api.boldvpn.net/api/health

# 8. Test in browser
# Open: https://boldvpn.net/portal/
```

---

### Quick Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| API won't start | `sudo service boldvpn_api restart` |
| Database connection failed | Check `.env` password, restart PostgreSQL |
| RADIUS Access-Reject | Check queries.conf uses `%{User-Name}` |
| Permission denied | Fix ownership: `chown -R root:wheel` |
| CORS errors | Add CORS middleware to server.js |
| HAProxy backend DOWN | Increase health check timeout |
| SSL/TLS errors | Client-side issue, use `--tlsv1.2` or browser |
| Module not found | `cd api && npm install` |

---

## Support

- 📧 View logs: `/var/log/boldvpn-api.log`
- 📊 Service status: `service boldvpn_api status`
- 🔍 Database: `psql -U radiususer -d radius`
- 📖 Full docs: [FREEBSD-DEPLOYMENT.md](../FREEBSD-DEPLOYMENT.md)
- 🔧 Scripts: [scripts/README.md](../scripts/README.md)

