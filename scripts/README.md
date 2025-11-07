# BoldVPN Scripts

All deployment and management scripts for BoldVPN on FreeBSD, organized in one place.

## 📜 Script Index

### 🚀 Main Deployment Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-github.sh` | First-time SSH setup & clone | `./setup-github.sh` |
| `freebsd-radius-setup.sh` | Install RADIUS + PostgreSQL | `sudo ./scripts/freebsd-radius-setup.sh` |
| `freebsd-api-setup.sh` | Install Node.js API | `sudo ./scripts/freebsd-api-setup.sh` |
| `update.sh` | Quick git pull & restart | `./scripts/update.sh` |

### 🧪 Testing Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `test-radius.sh` | Test RADIUS (11 tests) | `./scripts/test-radius.sh` |
| `test-api.sh` | Test API (6 tests) | `./scripts/test-api.sh` |

### 🔧 Maintenance & Fixes

| Script | Purpose | Usage |
|--------|---------|-------|
| `fix-radius-config.sh` | Fix RADIUS config issues | `sudo ./scripts/fix-radius-config.sh` |
| `reinstall-freeradius.sh` | Reinstall RADIUS only | `sudo ./scripts/reinstall-freeradius.sh` |
| `fix-api-cors.sh` | Fix API CORS for browser access | `sudo ./scripts/fix-api-cors.sh` |

### 🔥 Firewall Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-firewall.sh` | Configure firewall safely | `sudo ./scripts/setup-firewall.sh` |
| `fix-firewall.sh` | Fix broken firewall | `sudo ./scripts/fix-firewall.sh` |
| `disable-firewall.sh` | Disable firewall quickly | `sudo ./scripts/disable-firewall.sh` |
| `cleanup-firewall.sh` | Remove all firewall rules | `sudo ./scripts/cleanup-firewall.sh` |
| `emergency-restore-access.sh` | Emergency SSH restore | `sudo ./scripts/emergency-restore-access.sh` |

### 🔍 Utility Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `check-packages.sh` | Check available packages | `./scripts/check-packages.sh` |

---

## 🎯 Quick Start Workflow

### First Time Setup

```bash
# 1. Copy setup script from Mac
scp scripts/setup-github.sh admin@server-ip:~/

# 2. On FreeBSD server
ssh admin@server-ip
chmod +x setup-github.sh
./setup-github.sh

# 3. Deploy RADIUS
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-radius-setup.sh

# 4. Deploy API
sudo ./scripts/freebsd-api-setup.sh

# 5. Test
./scripts/test-radius.sh
./scripts/test-api.sh
```

### Regular Updates

```bash
cd /usr/local/boldvpn-site
./scripts/update.sh
```

---

## 📖 Script Details

### `setup-github.sh`

**Purpose:** First-time setup on new FreeBSD server

**What it does:**
1. Checks/generates SSH key
2. Shows public key to add to GitHub
3. Tests GitHub connection
4. Clones repository to `/usr/local/boldvpn-site`
5. Sets proper permissions

**Requirements:**
- Run as admin user (NOT root!)
- Needs internet access

**Example:**
```bash
./setup-github.sh
```

---

### `freebsd-radius-setup.sh`

**Purpose:** Complete FreeRADIUS + PostgreSQL installation

**What it does:**
1. Installs FreeRADIUS and PostgreSQL
2. Configures database with RADIUS schemas
3. Sets up user authentication (radcheck)
4. Configures quotas (radreply)
5. Enables accounting (radacct)
6. Creates test user
7. Starts services

**Prompts:**
- OPNsense IP
- RADIUS shared secret
- PostgreSQL passwords

**Requirements:**
- Must run as root (sudo)
- Internet access for package installation

**Example:**
```bash
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-radius-setup.sh
```

---

### `freebsd-api-setup.sh`

**Purpose:** Node.js API installation and service setup

**What it does:**
1. Installs Node.js 20
2. Creates `.env` in `api/` directory
3. Installs npm dependencies
4. Creates FreeBSD service
5. Starts API server

**Prompts:**
- API port (default: 3000)
- JWT secret
- PostgreSQL password
- API domain

**Requirements:**
- Must run as root (sudo)
- Must run from `/usr/local/boldvpn-site/`
- RADIUS should be installed first

**Example:**
```bash
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-api-setup.sh
```

---

### `test-radius.sh`

**Purpose:** Comprehensive RADIUS testing (11 tests)

**Tests:**
1. PostgreSQL service status
2. FreeRADIUS service status
3. Database connection
4. Database tables exist
5. Test user exists
6. Quota tables
7. Accounting tables
8. RADIUS configuration
9. RADIUS authentication
10. RADIUS ports listening
11. Log files exist

**Requirements:**
- RADIUS must be installed
- Can run as admin user (no sudo needed)

**Example:**
```bash
./scripts/test-radius.sh
```

---

### `test-api.sh`

**Purpose:** API endpoint testing (6 tests)

**Tests:**
1. Health check
2. Valid login
3. User profile (authenticated)
4. Invalid login (401)
5. Unauthorized access (401)
6. 404 handling

**Requirements:**
- API must be running
- Can run as admin user

**Example:**
```bash
./scripts/test-api.sh
```

---

### `update.sh`

**Purpose:** Quick update and service restart

**What it does:**
1. Checks for uncommitted changes
2. Runs git pull
3. Asks to restart API service
4. Asks to restart RADIUS service
5. Installs new npm dependencies
6. Shows service status

**Requirements:**
- Must run from `/usr/local/boldvpn-site/`
- Needs sudo for service restarts

**Example:**
```bash
cd /usr/local/boldvpn-site
./scripts/update.sh
```

---

### `fix-api-cors.sh`

**Purpose:** Fix API CORS configuration for browser access

**What it does:**
1. Backs up server.js (timestamped)
2. Shows current CORS configuration
3. Changes origin to `*` (allow all origins)
4. Changes credentials to `false` (required with wildcard)
5. Updates .env file
6. Restarts API service
7. Tests CORS configuration
8. Provides testing instructions

**Fixes:**
- CORS policy errors in browser
- "Access-Control-Allow-Origin" mismatch
- Portal can't access API
- Preflight request failures

**When to use:**
- Portal shows "Network error"
- Browser console shows CORS error
- API works from curl but not browser

**Requirements:**
- Must run as root (sudo)
- API must be installed

**Example:**
```bash
sudo sh scripts/fix-api-cors.sh
```

**After running:**
- Test from browser: https://boldvpn.net/portal/
- Login should work: testuser / Test@123!

---

### `fix-radius-config.sh`

**Purpose:** Fix common FreeRADIUS configuration issues

**Fixes:**
- SQL module configuration
- Log directory permissions
- Config file permissions
- Database connection issues

**Example:**
```bash
sudo ./scripts/fix-radius-config.sh
```

---

### `reinstall-freeradius.sh`

**Purpose:** Reinstall FreeRADIUS without touching database

**When to use:**
- FreeRADIUS corrupted
- Need to reset config
- Want to keep user data

**Example:**
```bash
sudo ./scripts/reinstall-freeradius.sh
```

---

### Firewall Scripts

#### `setup-firewall.sh`
Safe firewall configuration with SSH protection

#### `fix-firewall.sh`
Fix broken firewall in place

#### `disable-firewall.sh`
Quickly disable firewall (useful when locked out)

#### `cleanup-firewall.sh`
Remove all firewall configuration

#### `emergency-restore-access.sh`
Emergency script to restore SSH access

**Example:**
```bash
sudo ./scripts/setup-firewall.sh
```

---

## 🔒 Security Notes

- Always run `setup-github.sh` as **admin** user, never root
- Setup scripts (`freebsd-*-setup.sh`) need **sudo**
- Test scripts (`test-*.sh`) can run as **admin** (no sudo)
- SSH keys stay on server, **never share private keys**
- `.env` files contain secrets, **never commit to git**
- All passwords should be **strong** (min 16 characters)

---

## 📂 Script Organization Philosophy

**Why all scripts in one `scripts/` folder?**

✅ **Easy to find** - All scripts in one place  
✅ **Easy to deploy** - `scp scripts/*.sh` copies everything  
✅ **Easy to update** - `git pull` updates all scripts  
✅ **Clear separation** - Scripts vs application code  
✅ **Standard practice** - Common in many projects  

---

## 🔄 Development Workflow

### On Your Mac (Development)

```bash
# Make changes to scripts
cd /Users/msotoode/Documents/GitHub/boldvpn-site

# Edit a script
nano scripts/freebsd-api-setup.sh

# Commit and push
git add scripts/
git commit -m "Update API setup script"
git push
```

### On FreeBSD Server (Production)

```bash
# Pull updates
cd /usr/local/boldvpn-site
git pull

# Script is automatically updated!
sudo ./scripts/freebsd-api-setup.sh
```

---

## 📞 Quick Command Reference

```bash
# Setup (first time)
./setup-github.sh
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-radius-setup.sh
sudo ./scripts/freebsd-api-setup.sh

# Test
./scripts/test-radius.sh
./scripts/test-api.sh

# Update
./scripts/update.sh

# Services
sudo service radiusd status|start|stop|restart
sudo service boldvpn_api status|start|stop|restart

# Logs
tail -f /var/log/radius.log
tail -f /var/log/boldvpn-api.log

# Database
psql -U radiususer -d radius
```

---

## 📚 More Documentation

- [FREEBSD-DEPLOYMENT.md](../FREEBSD-DEPLOYMENT.md) - Complete deployment guide
- [SYSTEM-OVERVIEW.md](../SYSTEM-OVERVIEW.md) - System architecture
- [api/DEPLOYMENT.md](../api/DEPLOYMENT.md) - API deployment details

---

✅ **All 14 scripts documented and ready to use!**
