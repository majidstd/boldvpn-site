# FreeBSD Deployment Guide

Complete guide for deploying BoldVPN on FreeBSD 14.

## 📑 Table of Contents

### Getting Started
- [Quick Start (3 Simple Steps)](#-quick-start-3-simple-steps)
- [Detailed Setup Guide](#-detailed-setup-guide)
- [Prerequisites](#prerequisites)

### Deployment
- [Step 1: Initial Server Setup](#step-1-initial-server-setup)
- [Step 2: Clone Repository](#step-2-clone-repository)
- [Step 3: Deploy RADIUS Server](#step-3-deploy-radius-server)
- [Step 4: Deploy API Server](#step-4-deploy-api-server)
- [Step 5: Testing](#step-5-testing)

### Troubleshooting
- [Comprehensive Troubleshooting](#-comprehensive-troubleshooting)
  - [SSH and Git Issues](#ssh-and-git-issues)
  - [RADIUS Server Issues](#radius-server-issues)
  - [API Server Issues](#api-server-issues)
  - [Database Issues](#database-issues)
  - [Network Issues](#network-issues)
  - [Permission Issues](#permission-issues)
- [Complete Diagnostic Checklist](#complete-diagnostic-checklist)

### Reference
- [Security Checklist](#-security-checklist)
- [Monitoring](#-monitoring)
- [Quick Reference](#-quick-reference)
- [Next Steps After Deployment](#-next-steps-after-deployment)
- [Additional Documentation](#-additional-documentation)

---

## 🎯 Quick Start (3 Simple Steps)

### 1. Copy Setup Script

From your Mac:

```bash
scp scripts/setup-github.sh admin@your-server-ip:~/
```

### 2. Run Setup on FreeBSD

```bash
ssh admin@your-server-ip
chmod +x setup-github.sh
./setup-github.sh
```

The script will:
- Generate SSH key
- Show you the key to add to GitHub
- Clone repository to `/usr/local/boldvpn-site`

### 3. Deploy Services

```bash
cd /usr/local/boldvpn-site

# Deploy RADIUS server
sudo ./scripts/freebsd-radius-setup.sh

# Deploy API server
sudo ./scripts/freebsd-api-setup.sh

# Test everything
./scripts/test-radius.sh
./scripts/test-api.sh
```

**Done!** ✅ Your BoldVPN system is running!

---

## 📋 Detailed Setup Guide

### Prerequisites

- FreeBSD 14.0-RELEASE server
- Admin user with sudo access
- SSH access to the server
- GitHub account

### Step 1: Setup SSH Key and Clone Repository

**On your Mac:**

```bash
scp scripts/setup-github.sh admin@your-server-ip:~/
```

**On FreeBSD server:**

```bash
ssh admin@your-server-ip

chmod +x setup-github.sh
./setup-github.sh
```

**The script will:**

1. Check if SSH key exists, generate if needed:
   ```
   ssh-keygen -t ed25519
   ```

2. Display your public key:
   ```
   cat ~/.ssh/id_ed25519.pub
   ```

3. Ask you to add it to GitHub:
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Title: "BoldVPN FreeBSD Server"
   - Paste the key
   - Click "Add SSH key"

4. Test GitHub connection:
   ```
   ssh -T git@github.com
   ```

5. Clone repository:
   ```
   /usr/local/boldvpn-site/
   ```

6. Set proper permissions:
   ```
   chown -R admin:wheel /usr/local/boldvpn-site
   ```

---

### Step 2: Deploy RADIUS Server

```bash
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-radius-setup.sh
```

**You'll be prompted for:**
- OPNsense IP address (e.g., 192.168.1.1)
- RADIUS shared secret (create strong password)
- PostgreSQL radiususer password
- PostgreSQL postgres password

**The script will:**
- Install FreeRADIUS and PostgreSQL
- Configure database
- Create RADIUS schemas
- Set up accounting
- Create test user (testuser/Test@123!)
- Configure quotas and limits
- Start services

**Expected time:** 5-10 minutes

---

### Step 3: Deploy API Server

```bash
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-api-setup.sh
```

**You'll be prompted for:**
- API Port (default: 3000)
- JWT Secret (strong random string)
- PostgreSQL password (same as RADIUS)
- API Domain (e.g., api.boldvpn.net)

**The script will:**
- Install Node.js 20
- Create `.env` configuration in `api/`
- Install npm dependencies
- Create FreeBSD service
- Start API server

**Expected time:** 3-5 minutes

---

### Step 4: Test Everything

```bash
cd /usr/local/boldvpn-site

# Test RADIUS server (11 tests)
./scripts/test-radius.sh

# Test API server (6 tests)
./scripts/test-api.sh
```

**Expected results:** All tests pass ✅

---

## 🔄 Updating (After Initial Setup)

### Quick Update Method

```bash
ssh admin@server-ip
cd /usr/local/boldvpn-site
./scripts/update.sh
```

The script will:
- Pull latest changes
- Ask to restart services
- Install new dependencies

### Manual Update Method

```bash
ssh admin@server-ip
cd /usr/local/boldvpn-site

# Pull latest code
git pull

# If API changed:
cd /usr/local/boldvpn-site/api
sudo npm install --production
sudo service boldvpn_api restart

# If RADIUS changed:
sudo service radiusd restart

# View logs
tail -f /var/log/boldvpn-api.log
tail -f /var/log/radius/radius.log
```

---

## 📁 File Structure on FreeBSD

```
/usr/local/boldvpn-site/          # Main repository (git clone)
├── scripts/                      # All deployment scripts
│   ├── setup-github.sh           # First-time setup
│   ├── update.sh                 # Quick updates
│   ├── freebsd-radius-setup.sh   # RADIUS deployment
│   ├── freebsd-api-setup.sh      # API deployment
│   ├── test-radius.sh            # RADIUS tests
│   ├── test-api.sh               # API tests
│   └── *.sh                      # Helper scripts
│
├── api/                          # Running API
│   ├── .env                      # Secrets (not in git!)
│   ├── node_modules/             # Dependencies (not in git!)
│   ├── server.js                 # Express server
│   ├── routes/                   # API routes
│   ├── middleware/               # Auth middleware
│   └── utils/                    # Database utils
│
├── radius-server/                # RADIUS documentation
├── portal/                       # Customer portal (reference)
└── captiveportal/                # OPNsense templates (reference)

/usr/local/etc/raddb/             # FreeRADIUS config
/var/log/radius/                  # RADIUS logs
/var/log/boldvpn-api.log          # API logs
```

---

## 🛠️ Common Commands

### Service Management

```bash
# Check status
sudo service radiusd status
sudo service boldvpn_api status

# Start/stop/restart
sudo service radiusd start|stop|restart
sudo service boldvpn_api start|stop|restart

# Enable auto-start on boot
sudo sysrc radiusd_enable="YES"
sudo sysrc boldvpn_api_enable="YES"
```

### View Logs

```bash
# RADIUS logs
tail -f /var/log/radius/radius.log
tail -100 /var/log/radius/radius.log

# API logs
tail -f /var/log/boldvpn-api.log
tail -100 /var/log/boldvpn-api.log

# Search for errors
grep "\[X\]" /var/log/radius/radius.log
grep "Error" /var/log/boldvpn-api.log
```

### Database

```bash
# Connect to database
psql -U radiususer -d radius

# View users
SELECT username FROM radcheck;

# View active sessions
SELECT username, framedipaddress, acctstarttime 
FROM radacct 
WHERE acctstoptime IS NULL;

# View usage statistics
SELECT username, 
       SUM(acctinputoctets)/1024/1024/1024 as gb_down,
       SUM(acctoutputoctets)/1024/1024/1024 as gb_up
FROM radacct 
WHERE acctstarttime > CURRENT_DATE - INTERVAL '30 days'
GROUP BY username;

# Exit
\q
```

### Git Operations

```bash
# Check status
cd /usr/local/boldvpn-site
git status
git log --oneline -10

# Pull updates
git pull

# Check current branch
git branch
```

---

## 🔧 Available Scripts

All scripts are in `/usr/local/boldvpn-site/scripts/`

### Deployment

- `setup-github.sh` - First-time SSH setup and clone
- `freebsd-radius-setup.sh` - Install RADIUS + PostgreSQL
- `freebsd-api-setup.sh` - Install Node.js API
- `update.sh` - Quick git pull and service restart

### Testing

- `test-radius.sh` - Test RADIUS configuration (11 tests)
- `test-api.sh` - Test API endpoints (6 tests)

### RADIUS Management

- `fix-radius-config.sh` - Fix common RADIUS issues
- `reinstall-freeradius.sh` - Reinstall RADIUS only

### Firewall

- `setup-firewall.sh` - Safe firewall configuration
- `fix-firewall.sh` - Fix broken firewall
- `disable-firewall.sh` - Disable firewall
- `cleanup-firewall.sh` - Remove all firewall rules
- `emergency-restore-access.sh` - Emergency SSH restore

### Utilities

- `check-packages.sh` - Check available packages

---

## 🐛 Comprehensive Troubleshooting

### SSH and Git Issues

#### SSH Key Issues

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Show public key (add to GitHub)
cat ~/.ssh/id_ed25519.pub

# Test GitHub connection
ssh -T git@github.com
# Should say: "Hi majidstd! You've successfully authenticated"
```

#### Git Pull Asks for Password

```bash
# Check remote URL
cd /usr/local/boldvpn-site
git remote -v

# Should show: git@github.com:majidstd/boldvpn-site.git
# If it shows https://, change it:
git remote set-url origin git@github.com:majidstd/boldvpn-site.git
```

---

### RADIUS Server Issues

#### RADIUS Won't Start

**Check status:**
```bash
sudo service radiusd status
```

**Check configuration syntax:**
```bash
sudo radiusd -C
```

**Run in debug mode to see errors:**
```bash
sudo service radiusd stop
sudo radiusd -X
# Watch for errors in output
# Press Ctrl+C when done
sudo service radiusd start
```

**Common errors:**

**1. Permission denied:**
```bash
# Fix all RADIUS permissions
sudo chown -R root:wheel /usr/local/etc/raddb
sudo find /usr/local/etc/raddb -type d -exec chmod 755 {} \;
sudo find /usr/local/etc/raddb -type f -exec chmod 644 {} \;
sudo mkdir -p /var/log/radius
sudo chown -R root:wheel /var/log/radius
sudo chmod 755 /var/log/radius
sudo service radiusd restart
```

**2. Port 1812 already in use:**
```bash
# Check what's using the port
sockstat -l | grep 1812

# Kill stuck RADIUS process
sudo killall radiusd

# Start fresh
sudo service radiusd start
```

**3. Configuration file errors:**
```bash
# Test configuration
sudo radiusd -C -X -l stdout

# Check for specific errors
sudo tail -50 /var/log/radius/radius.log
```

---

#### RADIUS Returns Access-Reject

**Symptom:** RADIUS receives request but rejects authentication

**Debug in real-time:**
```bash
sudo service radiusd stop
sudo radiusd -X
# In another terminal, test:
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123
# Watch debug output for errors
```

**Common causes:**

**1. User doesn't exist in database:**
```bash
# Check if user exists
sudo -u postgres psql radius -c "SELECT * FROM radcheck WHERE username = 'testuser';"

# If not found, create user
sudo -u postgres psql radius
INSERT INTO radcheck (username, attribute, op, value) 
VALUES ('testuser', 'Cleartext-Password', ':=', 'Test@123!');
\q
```

**2. SQL module not enabled:**
```bash
# Check if SQL module is linked
ls -la /usr/local/etc/raddb/mods-enabled/ | grep sql

# If not found, enable it
cd /usr/local/etc/raddb/mods-enabled
sudo ln -s ../mods-available/sql sql
sudo service radiusd restart
```

**3. queries.conf missing or wrong:**
```bash
# Check if queries.conf exists
ls -la /usr/local/etc/raddb/mods-config/sql/main/postgresql/queries.conf

# Check content (should use %{User-Name} NOT %{SQL-User-Name})
sudo cat /usr/local/etc/raddb/mods-config/sql/main/postgresql/queries.conf | grep "User-Name"

# If shows SQL-User-Name or missing, create it:
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

**4. SQL module can't connect to database:**
```bash
# Check SQL module config
sudo cat /usr/local/etc/raddb/mods-available/sql | grep -A 10 "server ="

# Verify database credentials
sudo -u postgres psql radius -c "SELECT 1;"

# Test with radiususer
psql -U radiususer -d radius -c "SELECT 1;"
# If fails, reset password
```

**5. Database returns empty result:**
```bash
# Test query manually
sudo -u postgres psql radius -c "SELECT id, username, attribute, value, op FROM radcheck WHERE username = 'testuser' ORDER BY id;"

# If returns 0 rows, user doesn't exist
# If returns data, queries.conf is wrong
```

---

#### SQL Module Errors

**Error:** `Could not link driver rlm_sql_postgresql`

**Solution:**
```bash
# Reinstall PostgreSQL driver
sudo pkg install -f freeradius3-pgsql
sudo service radiusd restart
```

**Error:** `SQL module not found`

**Solution:**
```bash
# Enable SQL module
cd /usr/local/etc/raddb/mods-enabled
sudo ln -s ../mods-available/sql sql

# Verify it's in sites-enabled/default
grep "^\s*sql" /usr/local/etc/raddb/sites-enabled/default

# If not found, add it to authorize section
sudo nano /usr/local/etc/raddb/sites-enabled/default
# Find: authorize {
# Add:  sql
# Save and restart
sudo service radiusd restart
```

---

#### Unknown Attribute Errors

**Error:** `Failed to create the pair: Unknown name "Max-Monthly-Traffic"`

**Cause:** Custom attributes not defined in RADIUS dictionary

**Solution 1: Use standard attributes only**
```bash
# Remove custom attributes
sudo -u postgres psql radius
DELETE FROM radreply WHERE attribute = 'Max-Monthly-Traffic';
\q

sudo service radiusd restart
```

**Solution 2: Define custom attributes**
```bash
# Create custom dictionary
cat << 'DICTEOF' | sudo tee /usr/local/etc/raddb/dictionary.boldvpn > /dev/null
ATTRIBUTE Max-Monthly-Traffic 3000 integer64
DICTEOF

# Include in main dictionary
echo '$INCLUDE dictionary.boldvpn' | sudo tee -a /usr/local/etc/raddb/dictionary > /dev/null

sudo service radiusd restart
```

**Error:** `Duplicate attribute name WISPr-Bandwidth-Max-Down`

**Cause:** Trying to redefine standard attributes

**Solution:**
```bash
# Remove custom dictionary
sudo rm /usr/local/etc/raddb/dictionary.boldvpn
sudo sed -i.bak '/dictionary.boldvpn/d' /usr/local/etc/raddb/dictionary
sudo service radiusd restart
```

**Standard WISPr attributes (don't redefine):**
- `WISPr-Bandwidth-Max-Down`
- `WISPr-Bandwidth-Max-Up`
- `Simultaneous-Use`

---

#### sqlippool or sql-voip Module Errors

**Error:** `Failed to find "sqlippool" as a module or policy`

**Solution:**
```bash
# Comment out unused modules
sudo sed -i.bak \
  -e 's/^\([[:space:]]*\)sqlippool/#\1sqlippool/' \
  -e 's/^\([[:space:]]*\)sql-voip/#\1sql-voip/' \
  /usr/local/etc/raddb/sites-enabled/default

sudo service radiusd restart
```

**Or enable them if needed:**
```bash
cd /usr/local/etc/raddb/mods-enabled
sudo ln -s ../mods-available/sqlippool sqlippool
sudo ln -s ../mods-available/sql-voip sql-voip
sudo service radiusd restart
```

---

#### RADIUS Configuration Test Fails

**Run configuration test:**
```bash
sudo radiusd -C -X -l stdout
```

**Common issues:**

**1. Missing queries.conf:**
- See "queries.conf missing or wrong" above

**2. SQL connection failed:**
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Test connection
psql -U radiususer -d radius -c "SELECT 1;"
```

**3. Invalid configuration syntax:**
```bash
# Check for syntax errors
sudo radiusd -C 2>&1 | grep -i error

# Fix the specific file/line mentioned
```

---

### API Server Issues

#### API Won't Start

**Check status:**
```bash
sudo service boldvpn_api status
```

**Check logs:**
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

# Or change API port
sudo nano /usr/local/boldvpn-site/api/.env
# Change: PORT=3001
sudo service boldvpn_api restart
```

**2. Module not found:**
```bash
cd /usr/local/boldvpn-site/api
sudo npm install
sudo service boldvpn_api restart
```

**3. .env file missing:**
```bash
# Check if .env exists
ls -la /usr/local/boldvpn-site/api/.env

# If missing, create it
sudo nano /usr/local/boldvpn-site/api/.env
# Add required variables (see api/DEPLOYMENT.md)
```

---

#### API Returns "Invalid username or password"

**Check database connection:**
```bash
cd /usr/local/boldvpn-site/api
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', database: 'radius', user: 'radiususer', password: 'YOUR_PASSWORD' }); pool.query('SELECT 1').then(() => console.log('DB OK')).catch(err => console.error('DB Error:', err)).finally(() => pool.end());"
```

**Check user exists:**
```bash
sudo -u postgres psql radius -c "SELECT * FROM radcheck WHERE username = 'testuser';"
```

**Check password format:**
- API supports both bcrypt and plain text
- Cleartext-Password: Direct comparison
- Bcrypt ($2a$ or $2b$): Uses bcrypt.compare()

**Verify database config:**
```bash
cat /usr/local/boldvpn-site/api/utils/database.js | grep -A 10 "Pool("
```

---

### Database Issues

#### PostgreSQL Not Running

**Check status:**
```bash
sudo service postgresql status
ps aux | grep postgres
```

**Start PostgreSQL:**
```bash
sudo service postgresql start
```

**Check version:**
```bash
ls /var/db/postgres/
# Should show data18, data17, etc.
```

**If PostgreSQL was removed:**
```bash
# Reinstall matching version
sudo pkg install postgresql18-server  # Match your data version
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

**Fix if needed:**
```bash
sudo nano /var/db/postgres/data18/pg_hba.conf

# Add:
local   all   radiususer   md5
local   all   postgres     md5

# Reload
sudo service postgresql reload
```

---

#### Password Authentication Failed

**Reset radiususer password:**
```bash
sudo -u postgres psql
ALTER USER radiususer WITH PASSWORD 'YOUR_NEW_PASSWORD';
\q
```

**Update API .env:**
```bash
sudo nano /usr/local/boldvpn-site/api/.env
# Update: DB_PASSWORD=YOUR_NEW_PASSWORD
```

**Update RADIUS SQL module:**
```bash
sudo nano /usr/local/etc/raddb/mods-available/sql
# Update: password = "YOUR_NEW_PASSWORD"
sudo service radiusd restart
```

**Restart API:**
```bash
sudo service boldvpn_api restart
```

---

### Network Issues

#### Can't Access API from Internet

**Check HAProxy status:**
```
OPNsense → Services → HAProxy → Statistics
Backend should be GREEN
```

**If RED, check:**
```bash
# 1. API running on FreeBSD
curl http://localhost:3000/api/health

# 2. From OPNsense
curl http://192.168.50.2:3000/api/health

# 3. HAProxy health check timeout (increase to 5000ms)
# 4. WAN firewall rules (allow 80, 443)
```

---

#### Intermittent Connections from LAN

**Issue:** Split-brain DNS

**Solution:** Add DNS override on OPNsense:
```
Services → Unbound DNS → Overrides → Host Overrides
Host: api
Domain: boldvpn.net
IP: 192.168.50.1
```

---

### Permission Issues

#### Permission Denied Errors

**Fix RADIUS permissions:**
```bash
sudo chown -R root:wheel /usr/local/etc/raddb
sudo find /usr/local/etc/raddb -type d -exec chmod 755 {} \;
sudo find /usr/local/etc/raddb -type f -exec chmod 644 {} \;
sudo service radiusd restart
```

**Fix API permissions:**
```bash
sudo chown -R root:wheel /usr/local/boldvpn-site/api
sudo chmod 600 /usr/local/boldvpn-site/api/.env
sudo service boldvpn_api restart
```

**Fix script permissions:**
```bash
sudo chmod +x /usr/local/boldvpn-site/scripts/*.sh
```

---

### Complete Diagnostic Checklist

**Run these commands in order to diagnose any issue:**

```bash
# 1. Check all services
sudo service postgresql status
sudo service radiusd status
sudo service boldvpn_api status

# 2. Test database connectivity
sudo -u postgres psql radius -c "SELECT 1;"
psql -U radiususer -d radius -c "SELECT 1;"

# 3. Test RADIUS authentication
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123
# Expected: Received Access-Accept

# 4. Test API locally
curl http://localhost:3000/api/health
# Expected: {"status":"OK",...}

# 5. Test API login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123!"}'
# Expected: {"message":"Login successful","token":"..."}

# 6. Test from OPNsense
curl http://192.168.50.2:3000/api/health

# 7. Test via HAProxy (HTTPS)
curl https://api.boldvpn.net/api/health

# 8. Test in browser
# Open: https://boldvpn.net/portal/
# Login: testuser / Test@123!
```

**If any step fails, check the specific section above for that component!**

---

### Quick Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| RADIUS won't start | `sudo radiusd -X` to see error, fix permissions |
| RADIUS Access-Reject | Check user exists, verify queries.conf uses `%{User-Name}` |
| SQL module not found | `cd mods-enabled && ln -s ../mods-available/sql sql` |
| Unknown attribute | Remove custom attributes or define in dictionary |
| API won't start | Check logs, `npm install`, restart service |
| API invalid credentials | Check database connection, password format |
| Database connection failed | Check PostgreSQL running, verify passwords |
| Permission denied | `chown -R root:wheel`, `chmod 755/644` |
| Port already in use | `killall radiusd` or change port |
| Git asks password | Use SSH URL: `git@github.com:...` |

---

## 🔒 Security Checklist

- [ ] SSH key generated and added to GitHub
- [ ] Server firewall configured (`./scripts/setup-firewall.sh`)
- [ ] Strong PostgreSQL passwords
- [ ] Strong RADIUS shared secret (min 16 chars)
- [ ] Strong JWT secret (min 32 chars)
- [ ] `.env` file has correct permissions (600)
- [ ] Running as admin user (not root)
- [ ] HTTPS configured for API (nginx reverse proxy)
- [ ] Regular backups enabled

---

## 📊 Monitoring

### Check System Health

```bash
# Service status
sudo service radiusd status
sudo service boldvpn_api status
service postgresql status

# Resource usage
top -a
df -h
```

### Check Database Health

```bash
# Active sessions
psql -U radiususer -d radius -c "SELECT COUNT(*) FROM radacct WHERE acctstoptime IS NULL;"

# Database size
psql -U radiususer -d radius -c "SELECT pg_size_pretty(pg_database_size('radius'));"

# Recent activity
psql -U radiususer -d radius -c "SELECT username, acctstarttime FROM radacct ORDER BY acctstarttime DESC LIMIT 10;"
```

### API Health

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Check recent requests in logs
tail -50 /var/log/boldvpn-api.log

# Check for errors
grep -i error /var/log/boldvpn-api.log | tail -20
```

---

## 📞 Quick Reference

**First time setup:**
```bash
scp scripts/setup-github.sh admin@server-ip:~/
ssh admin@server-ip
./setup-github.sh
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-radius-setup.sh
sudo ./scripts/freebsd-api-setup.sh
```

**Update:**
```bash
cd /usr/local/boldvpn-site
./scripts/update.sh
```

**Test:**
```bash
./scripts/test-radius.sh
./scripts/test-api.sh
```

**Check status:**
```bash
sudo service radiusd status
sudo service boldvpn_api status
```

**View logs:**
```bash
tail -f /var/log/radius/radius.log
tail -f /var/log/boldvpn-api.log
```

---

## 🚀 Next Steps After Deployment

1. **Configure OPNsense Captive Portal:**
   - Services → Captive Portal → Authentication
   - Set RADIUS server to FreeBSD IP:1812
   - Enter shared secret from RADIUS setup

2. **Test VPN Authentication:**
   - Connect to WireGuard VPN
   - Login with testuser/Test@123!
   - Verify internet access granted

3. **Deploy Customer Portal:**
   - Already on GitHub Pages at `boldvpn.net/portal/`
   - Configure API URL in `portal/config.js`

4. **Optional: Configure HTTPS for API:**
   - Install nginx: `sudo pkg install nginx`
   - Configure reverse proxy
   - Get SSL certificate (certbot)

---

## 📚 Additional Documentation

- **System Overview:** [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)
- **All Scripts:** [scripts/README.md](scripts/README.md)
- **API Deployment:** [api/DEPLOYMENT.md](api/DEPLOYMENT.md)
- **Portal Guide:** [portal/HOW-IT-WORKS.md](portal/HOW-IT-WORKS.md)

---

✅ **Simple, automated, production-ready!**
