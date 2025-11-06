# FreeBSD Deployment Guide

Complete guide for deploying BoldVPN on FreeBSD 14.

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

## 🐛 Troubleshooting

### SSH Key Issues

```bash
# Generate new SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Show public key (add to GitHub)
cat ~/.ssh/id_ed25519.pub

# Test GitHub connection
ssh -T git@github.com
# Should say: "Hi majidstd! You've successfully authenticated"
```

### Git Pull Asks for Password

```bash
# Check remote URL
cd /usr/local/boldvpn-site
git remote -v

# Should show: git@github.com:majidstd/boldvpn-site.git
# If it shows https://, change it:
git remote set-url origin git@github.com:majidstd/boldvpn-site.git
```

### Service Won't Start

```bash
# Check detailed logs
tail -100 /var/log/boldvpn-api.log
tail -100 /var/log/radius/radius.log

# Check if port is in use
sockstat -l | grep 3000  # API
sockstat -l | grep 1812  # RADIUS

# Check service script
cat /usr/local/etc/rc.d/boldvpn_api
cat /etc/rc.conf | grep boldvpn
```

### Database Connection Failed

```bash
# Test PostgreSQL
psql -U radiususer -d radius -c "SELECT version();"

# Check if PostgreSQL is running
service postgresql status

# Check password in .env
sudo cat /usr/local/boldvpn-site/api/.env | grep DB_PASSWORD
```

### Permission Errors

```bash
# Fix ownership
sudo chown -R admin:wheel /usr/local/boldvpn-site

# Fix .env permissions
sudo chmod 600 /usr/local/boldvpn-site/api/.env

# Fix script permissions
sudo chmod +x /usr/local/boldvpn-site/scripts/*.sh
```

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
