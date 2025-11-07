# BoldVPN - Complete VPN Service Platform

Enterprise-grade VPN service with RADIUS authentication, customer portal, and API backend.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📑 Table of Contents

### Overview
- [What is BoldVPN?](#what-is-boldvpn)
- [System Architecture](#system-architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)

### Quick Start
- [Prerequisites](#prerequisites)
- [Quick Deployment](#quick-deployment)
- [Testing](#testing)

### Documentation
- [Deployment Guides](#deployment-guides)
- [System Documentation](#system-documentation)
- [Troubleshooting](#troubleshooting)

### Components
- [RADIUS AAA Server](#radius-aaa-server)
- [API Backend](#api-backend)
- [Customer Portal](#customer-portal)
- [Captive Portal](#captive-portal)
- [HAProxy Reverse Proxy](#haproxy-reverse-proxy)

### Development
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Contributing](#contributing)

---

## What is BoldVPN?

BoldVPN is a complete, production-ready VPN service platform that includes:

- **RADIUS AAA Server** - Authentication, Authorization, and Accounting for VPN clients
- **API Backend** - RESTful API for customer portal and integrations
- **Customer Portal** - Web interface for account management and usage tracking
- **Captive Portal** - Custom login interface for VPN connections
- **HAProxy Integration** - Public API access with SSL/TLS termination

**Live Demo:**
- 🌐 Marketing Site: https://boldvpn.net
- 🔐 Customer Portal: https://boldvpn.net/portal/
- 🔌 Public API: https://api.boldvpn.net

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  OPNsense Firewall   │
              │  - WireGuard VPN     │
              │  - Captive Portal    │
              │  - HAProxy (SSL)     │
              └──────┬───────┬───────┘
                     │       │
        ┌────────────┘       └────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────┐                 ┌──────────────┐
│ VPN Clients   │                 │ Web Browsers │
│ (WireGuard)   │                 │ (HTTPS)      │
└───────┬───────┘                 └──────┬───────┘
        │                                │
        │ RADIUS Auth                    │ API Calls
        │ Port 1812                      │ Port 443
        │                                │
        ▼                                ▼
┌─────────────────────────────────────────────────┐
│         FreeBSD Server (192.168.50.2)           │
│                                                 │
│  ┌─────────────────┐    ┌──────────────────┐  │
│  │ FreeRADIUS      │    │ Node.js API      │  │
│  │ Port 1812       │    │ Port 3000        │  │
│  └────────┬────────┘    └────────┬─────────┘  │
│           │                      │             │
│           └──────────┬───────────┘             │
│                      ▼                         │
│           ┌─────────────────────┐              │
│           │  PostgreSQL         │              │
│           │  Database (radius)  │              │
│           └─────────────────────┘              │
└─────────────────────────────────────────────────┘
```

**Data Flow:**

1. **VPN Client connects** → OPNsense Captive Portal → RADIUS → Database
2. **User checks portal** → Browser → HAProxy → API → Database
3. **RADIUS logs usage** → Database (radacct table)
4. **API shows usage** → Query radacct → Display in portal

---

## Features

### Authentication & Authorization
- ✅ RADIUS AAA server for VPN authentication
- ✅ SQL-based user management
- ✅ JWT-based API authentication
- ✅ Support for both bcrypt and plain text passwords
- ✅ User quotas and bandwidth limits
- ✅ Device limits (simultaneous connections)

### Customer Portal
- ✅ User registration and login
- ✅ Real-time usage statistics
- ✅ Bandwidth usage tracking
- ✅ Session history
- ✅ Account management
- ✅ Responsive modern UI

### API Backend
- ✅ RESTful API with JWT authentication
- ✅ User profile management
- ✅ Usage statistics endpoints
- ✅ Session tracking
- ✅ Billing integration ready (Stripe)
- ✅ CORS support for browser access

### Infrastructure
- ✅ HAProxy reverse proxy with SSL termination
- ✅ Let's Encrypt SSL certificates (ACME)
- ✅ PostgreSQL database for all data
- ✅ Production-ready service management
- ✅ Comprehensive logging and monitoring

### Security
- ✅ TLS 1.2+ only
- ✅ HSTS security headers
- ✅ Rate limiting (DDoS protection)
- ✅ Password hashing (bcrypt)
- ✅ JWT token-based sessions
- ✅ Firewall configuration scripts

---

## Technology Stack

**Backend:**
- FreeBSD 14.0-RELEASE
- FreeRADIUS 3.2.8 (AAA server)
- PostgreSQL 18 (Database)
- Node.js + Express (API)
- OPNsense (Firewall/Router)
- HAProxy (Reverse proxy)

**Frontend:**
- HTML5 + CSS3
- Vanilla JavaScript (no framework)
- GitHub Pages (Static hosting)

**DevOps:**
- Shell scripts (Automated deployment)
- Git (Version control & deployment)
- systemd/rc.d (Service management)

---

## Prerequisites

- **OPNsense** firewall/router with public IP
- **FreeBSD 14** server for RADIUS + API
- **GitHub account** for hosting portal
- **Domain name** with DNS control
- **Basic knowledge** of FreeBSD, PostgreSQL, and networking

---

## Quick Deployment

### 1. Clone Repository on FreeBSD

```bash
# On FreeBSD server
cd /usr/local
git clone git@github.com:majidstd/boldvpn-site.git
cd boldvpn-site
```

### 2. Deploy RADIUS Server

```bash
sudo ./scripts/freebsd-radius-setup.sh
```

**Prompts for:**
- OPNsense IP address
- RADIUS shared secret
- PostgreSQL passwords
- Optional: SQL IP Pool
- Optional: SQL VoIP accounting

### 3. Deploy API Server

```bash
sudo ./scripts/freebsd-api-setup.sh
```

**Prompts for:**
- API port (default: 3000)
- JWT secret
- PostgreSQL password

### 4. Configure OPNsense HAProxy

Follow: [OPNSENSE-HAPROXY-SETUP.md](OPNSENSE-HAPROXY-SETUP.md)

**Sets up:**
- SSL certificate (Let's Encrypt)
- Reverse proxy to API
- HTTP → HTTPS redirect
- Security headers

### 5. Deploy Customer Portal

**Already on GitHub Pages!**

```
https://boldvpn.net/portal/
```

Update `portal/config.js` with your API URL.

---

## Testing

### Quick Tests

```bash
# Test RADIUS
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123

# Test API
curl http://localhost:3000/api/health

# Test API login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123!"}'
```

### Complete Test Suite

```bash
# Run automated tests
./scripts/test-radius.sh
./scripts/test-api.sh
```

### Browser Test

1. Open: https://boldvpn.net/portal/
2. Login: `testuser` / `Test@123!`
3. Verify dashboard loads with usage stats

---

## Deployment Guides

### Complete Step-by-Step Guides

| Guide | Description |
|-------|-------------|
| [FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md) | Complete FreeBSD setup (RADIUS + API + Database) |
| [OPNSENSE-HAPROXY-SETUP.md](OPNSENSE-HAPROXY-SETUP.md) | HAProxy reverse proxy with SSL (1,300+ lines!) |
| [api/DEPLOYMENT.md](api/DEPLOYMENT.md) | API deployment and troubleshooting |

### Quick Reference

| Task | Command |
|------|---------|
| Deploy RADIUS | `sudo ./scripts/freebsd-radius-setup.sh` |
| Deploy API | `sudo ./scripts/freebsd-api-setup.sh` |
| Update system | `./scripts/update.sh` |
| Test RADIUS | `./scripts/test-radius.sh` |
| Test API | `./scripts/test-api.sh` |

---

## System Documentation

| Document | Description |
|----------|-------------|
| [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md) | High-level architecture and user journey |
| [portal/HOW-IT-WORKS.md](portal/HOW-IT-WORKS.md) | Customer portal flow explained |
| [portal/PORTAL-GUIDE.md](portal/PORTAL-GUIDE.md) | Portal user and developer guide |
| [scripts/README.md](scripts/README.md) | All 14 deployment scripts documented |

---

## Troubleshooting

### Quick Fixes

| Issue | Solution |
|-------|----------|
| RADIUS Access-Reject | Check user exists, verify queries.conf uses `%{User-Name}` |
| API invalid credentials | Check database connection, password format (bcrypt vs plain text) |
| HAProxy backend DOWN | Increase health check timeout, verify API running |
| Permission denied | `sudo chown -R root:wheel`, fix file permissions |
| CORS errors | Run `sudo sh scripts/fix-api-cors.sh` |
| Portal network error | CORS issue - run fix-api-cors.sh script |

### Complete Troubleshooting Guides

- **RADIUS Issues:** [FREEBSD-DEPLOYMENT.md#radius-server-issues](FREEBSD-DEPLOYMENT.md#radius-server-issues)
- **API Issues:** [api/DEPLOYMENT.md#api-issues](api/DEPLOYMENT.md#api-issues)
- **Database Issues:** [FREEBSD-DEPLOYMENT.md#database-issues](FREEBSD-DEPLOYMENT.md#database-issues)
- **HAProxy Issues:** [OPNSENSE-HAPROXY-SETUP.md#troubleshooting](OPNSENSE-HAPROXY-SETUP.md#-troubleshooting)

### Diagnostic Commands

**Check all services:**
```bash
sudo service postgresql status
sudo service radiusd status
sudo service boldvpn_api status
```

**Test RADIUS:**
```bash
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123
```

**Test API:**
```bash
curl http://localhost:3000/api/health
```

**Test database from Node.js:**
```bash
cd /usr/local/boldvpn-site/api
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', database: 'radius', user: 'radiususer', password: 'YOUR_PASSWORD' }); pool.query('SELECT * FROM radcheck WHERE username = \$1', ['testuser']).then(res => console.log('Found:', res.rows)).catch(err => console.error('Error:', err)).finally(() => pool.end());"
```

---

## RADIUS AAA Server

**Purpose:** Authenticate VPN connections and enforce quotas

**Features:**
- User authentication via PostgreSQL
- Bandwidth limits (WISPr attributes)
- Device limits (Simultaneous-Use)
- Session accounting (radacct table)
- Integration with OPNsense Captive Portal

**Configuration:**
```bash
Server: 192.168.50.2
Port: 1812 (auth), 1813 (accounting)
Protocol: RADIUS
Database: PostgreSQL (radius)
```

**Documentation:** [FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md)

---

## API Backend

**Purpose:** Customer portal backend and integrations

**Endpoints:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/user/profile` - User profile
- `GET /api/user/usage` - Usage statistics
- `GET /api/user/sessions` - Session history
- `GET /api/health` - Health check

**Features:**
- JWT authentication
- PostgreSQL integration
- Supports bcrypt and plain text passwords
- CORS enabled for browser access
- Rate limiting ready
- Stripe integration ready

**Documentation:** [api/README.md](api/README.md) | [api/DEPLOYMENT.md](api/DEPLOYMENT.md)

---

## Customer Portal

**Purpose:** Web interface for account management

**Features:**
- User registration and login
- Real-time usage dashboard
- Bandwidth usage graphs
- Session history
- Account settings
- Responsive design

**Live:** https://boldvpn.net/portal/

**Documentation:** [portal/PORTAL-GUIDE.md](portal/PORTAL-GUIDE.md) | [portal/HOW-IT-WORKS.md](portal/HOW-IT-WORKS.md)

### Portal Architecture

The customer portal is a single-page application (SPA) that provides complete account management functionality.

#### File Structure

```
portal/
├── index.html      # Main HTML (login, register, dashboard)
├── styles.css      # CSS (matches main site design)
├── app.js          # JavaScript (all functionality)
└── config.js       # API configuration
```

#### How It Works

**1. User Access**
```
User clicks "Account Login" on main site
  ↓
Navigates to https://boldvpn.net/portal/
  ↓
Browser loads portal/index.html
  ↓
Loads config.js, app.js, styles.css
```

**2. Login Flow**
```
User enters username/password
  ↓
app.js calls POST /api/auth/login
  ↓
API checks database (radcheck table)
  ↓
Returns JWT token
  ↓
Portal stores token in localStorage
  ↓
Portal hides login form, shows dashboard
```

**3. Dashboard Loading**
```
Portal fetches user data:
  ↓
GET /api/user/profile     → User details
GET /api/user/usage       → Data usage stats
GET /api/user/sessions    → Connection history
  ↓
Dashboard displays all data
```

#### Components

**Login Form** (`portal/index.html` lines 29-67)
- Username/password fields
- API authentication
- JWT token storage
- Error handling

**Registration Form** (`portal/index.html` lines 70-133)
- Create new account
- Plan selection
- Terms acceptance
- API integration

**Dashboard** (`portal/index.html` lines 136-223)
- Welcome message with username
- Data usage (used vs limit)
- Connection speed limits
- Connected devices count
- Current session info
- Logout button

**Password Change Modal** (`portal/index.html` lines 226-248)
- Current password verification
- New password input
- API call to update

#### JavaScript Functions (`portal/app.js`)

| Function | Purpose | API Endpoint |
|----------|---------|--------------|
| `handleLogin()` | Authenticates user | `POST /api/auth/login` |
| `handleRegister()` | Creates new account | `POST /api/auth/register` |
| `loadDashboard()` | Shows dashboard after login | - |
| `loadUserProfile()` | Fetches user data | `GET /api/user/profile` |
| `loadUsageStats()` | Fetches usage data | `GET /api/user/usage` |
| `loadSessions()` | Fetches session history | `GET /api/user/sessions` |
| `handleLogout()` | Logs out user | - |
| `handlePasswordChange()` | Updates password | `POST /api/user/password` |

#### Design System

The portal uses the **exact same design** as the main site for consistency:

**Colors:**
- Primary: `#0ea5e9` (blue)
- Background: `#0b1120` (dark)
- Panel: `#0f172a`
- Text: `#e2e8f0`
- Muted: `#94a3b8`
- Border: `#1f2a44`

**Typography:**
- Font: Inter (400, 500, 600, 700, 800)
- Loaded from Google Fonts

**Layout:**
- Responsive grid system
- Mobile-first design
- Matches main site navigation

#### API Integration

**Configuration** (`portal/config.js`):
```javascript
const Config = {
    API_URL: 'https://api.boldvpn.net/api',
    TOKEN_KEY: 'boldvpn_token',
    REFRESH_INTERVAL: 30000  // 30 seconds
};
```

**Authentication Flow:**
1. User logs in → Portal calls API
2. API validates credentials against `radcheck` table
3. API returns JWT token
4. Portal stores token in `localStorage`
5. Portal includes token in all subsequent API calls
6. Token expires after 24 hours

**Data Flow:**
```
Portal (JavaScript) → API (Node.js) → Database (PostgreSQL)
     ↓                     ↓                    ↓
  User sees data    Validates token    Queries radacct/radcheck
```

#### Future Enhancements (CMS Integration)

The portal structure is designed to easily integrate with a CMS:

**Planned Features:**
- Admin panel for user management
- Bulk user import/export
- Usage reports and analytics
- Billing integration (Stripe)
- Email notifications
- Two-factor authentication (2FA)
- API key management

**Structure Benefits:**
- ✅ Separate from marketing site (`/portal/` vs `/`)
- ✅ Clean URLs (`/portal/` not `/portal/index.html`)
- ✅ Self-contained (all files in one folder)
- ✅ Easy to extend (add new pages/features)
- ✅ API-first design (ready for mobile apps)

---

## Captive Portal

**Purpose:** Custom login interface for VPN connections

**Features:**
- Custom branded login page
- Dark/light theme support
- Responsive design
- OPNsense integration

**Location:** `captiveportal/`

**Configuration:** Upload to OPNsense via Services → Captive Portal → Templates

---

## HAProxy Reverse Proxy

**Purpose:** Public API access with SSL termination

**Features:**
- SSL/TLS termination (Let's Encrypt)
- HTTP → HTTPS redirect
- Security headers (HSTS, X-Frame-Options, etc.)
- Rate limiting
- Health checks
- Load balancing ready

**Public Access:** https://api.boldvpn.net

**Documentation:** [OPNSENSE-HAPROXY-SETUP.md](OPNSENSE-HAPROXY-SETUP.md) (1,300+ lines with TOC!)

---

## Project Structure

```
boldvpn-site/
├── api/                      # Node.js API backend
│   ├── server.js            # Express server
│   ├── routes/              # API routes (auth, user, billing)
│   ├── middleware/          # JWT authentication
│   ├── utils/               # Database utilities
│   ├── package.json         # Dependencies
│   ├── README.md            # API documentation
│   └── DEPLOYMENT.md        # Deployment + troubleshooting
│
├── portal/                   # Customer portal (frontend)
│   ├── index.html           # Single-page app
│   ├── app.js               # Portal logic
│   ├── styles.css           # Modern styling
│   ├── config.js            # Configuration
│   ├── PORTAL-GUIDE.md      # User guide
│   └── HOW-IT-WORKS.md      # Technical explanation
│
├── captiveportal/           # OPNsense captive portal template
│   ├── index.html           # Login page
│   ├── css/                 # Styles
│   └── config/              # Settings
│
├── scripts/                 # Deployment and helper scripts
│   ├── freebsd-radius-setup.sh    # RADIUS installation
│   ├── freebsd-api-setup.sh       # API installation
│   ├── setup-github.sh            # Initial GitHub setup
│   ├── update.sh                  # Update deployment
│   ├── test-radius.sh             # RADIUS tests
│   ├── test-api.sh                # API tests
│   ├── fix-radius-config.sh       # Fix RADIUS issues
│   ├── setup-firewall.sh          # Firewall configuration
│   ├── reinstall-freeradius.sh    # Quick reinstall
│   └── README.md                  # All scripts documented
│
├── docs/                    # Documentation
│   ├── FREEBSD-DEPLOYMENT.md      # Complete FreeBSD guide
│   ├── OPNSENSE-HAPROXY-SETUP.md  # HAProxy setup (with TOC)
│   ├── SYSTEM-OVERVIEW.md         # Architecture overview
│   └── README.md                  # This file
│
├── index.html               # Marketing homepage
├── login.html               # Legacy login page
├── styles.css               # Site styles
├── assets/                  # Images, logos
├── .gitignore               # Git ignore rules
└── CNAME                    # GitHub Pages domain
```

---

## Scripts

### Deployment Scripts

| Script | Purpose |
|--------|---------|
| `freebsd-radius-setup.sh` | Install and configure FreeRADIUS + PostgreSQL |
| `freebsd-api-setup.sh` | Install and configure Node.js API |
| `setup-github.sh` | Initial GitHub SSH setup and clone |
| `update.sh` | Update deployment from Git |
| `setup-firewall.sh` | Configure FreeBSD firewall (ipfw) |
| `setup-nginx-ssl.sh` | Nginx reverse proxy with SSL (optional) |

### Testing Scripts

| Script | Purpose |
|--------|---------|
| `test-radius.sh` | Test RADIUS server functionality |
| `test-api.sh` | Test API endpoints |

### Maintenance Scripts

| Script | Purpose |
|--------|---------|
| `fix-radius-config.sh` | Fix common RADIUS configuration issues |
| `fix-api-cors.sh` | Fix API CORS for browser access |
| `reinstall-freeradius.sh` | Quick FreeRADIUS reinstall |
| `emergency-restore-access.sh` | Disable firewall if locked out |

**Complete documentation:** [scripts/README.md](scripts/README.md)

---

## Prerequisites

### Hardware Requirements

- **FreeBSD Server:** 2+ CPU cores, 4GB+ RAM, 20GB+ storage
- **OPNsense:** 2+ CPU cores, 4GB+ RAM, 16GB+ storage
- **Network:** Static IP for OPNsense WAN, LAN network

### Software Requirements

- FreeBSD 14.0-RELEASE or later
- OPNsense 24.x or later
- Domain name with DNS control
- GitHub account
- SSH access to servers

---

## Quick Deployment

### Step 1: Initial Setup (5 minutes)

**On FreeBSD server:**

```bash
# Copy setup script
scp scripts/setup-github.sh admin@your-server-ip:~/

# Run setup
ssh admin@your-server-ip
chmod +x setup-github.sh
./setup-github.sh
```

**Follow prompts to:**
- Generate SSH key
- Add key to GitHub
- Clone repository to `/usr/local/boldvpn-site`

---

### Step 2: Deploy RADIUS (10 minutes)

```bash
cd /usr/local/boldvpn-site
sudo ./scripts/freebsd-radius-setup.sh
```

**Installs and configures:**
- FreeRADIUS 3.2.8
- PostgreSQL database
- SQL module
- RADIUS clients
- Test user

---

### Step 3: Deploy API (5 minutes)

```bash
sudo ./scripts/freebsd-api-setup.sh
```

**Installs and configures:**
- Node.js + npm
- Express API server
- Database connection
- JWT authentication
- Service management

---

### Step 4: Configure HAProxy (15 minutes)

**On OPNsense:**

Follow: [OPNSENSE-HAPROXY-SETUP.md](OPNSENSE-HAPROXY-SETUP.md)

**Configures:**
- SSL certificate (Let's Encrypt)
- Reverse proxy to API
- HTTP → HTTPS redirect
- Security headers
- WAN firewall rules

---

### Step 5: Test Everything (5 minutes)

```bash
# Test RADIUS
./scripts/test-radius.sh

# Test API
./scripts/test-api.sh

# Test in browser
# Open: https://boldvpn.net/portal/
# Login: testuser / Test@123!
```

**Total deployment time: ~40 minutes** ⏱️

---

## Testing

### Automated Tests

```bash
# Test RADIUS server
./scripts/test-radius.sh

# Test API server
./scripts/test-api.sh
```

### Manual Tests

**RADIUS authentication:**
```bash
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123
```

**API health:**
```bash
curl http://localhost:3000/api/health
```

**API login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123!"}'
```

**Public API (via HAProxy):**
```bash
curl https://api.boldvpn.net/api/health
```

**Customer portal:**
- Open: https://boldvpn.net/portal/
- Login: testuser / Test@123!

---

## Deployment Guides

### Primary Guides

**[FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md)**
- Complete FreeBSD setup
- RADIUS + API + PostgreSQL
- Service management
- Comprehensive troubleshooting
- With Table of Contents

**[OPNSENSE-HAPROXY-SETUP.md](OPNSENSE-HAPROXY-SETUP.md)**
- HAProxy plugin installation
- SSL certificate setup (ACME)
- Reverse proxy configuration
- Security hardening
- Complete troubleshooting
- 1,300+ lines with TOC!

**[api/DEPLOYMENT.md](api/DEPLOYMENT.md)**
- API-specific deployment
- Service management
- HTTPS configuration
- Comprehensive troubleshooting
- With Table of Contents

---

## System Documentation

**[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)**
- High-level architecture
- Component interactions
- User journey (VPN + Portal)
- Data flow diagrams

**[portal/HOW-IT-WORKS.md](portal/HOW-IT-WORKS.md)**
- Customer portal technical details
- Step-by-step flow
- API integration
- Authentication process

**[portal/PORTAL-GUIDE.md](portal/PORTAL-GUIDE.md)**
- User guide
- Developer guide
- Features overview
- Customization

**[scripts/README.md](scripts/README.md)**
- All 14 scripts documented
- Usage instructions
- What each script does

---

## Troubleshooting

### Common Issues

**RADIUS Access-Reject:**
```bash
# Check user exists
sudo -u postgres psql radius -c "SELECT * FROM radcheck WHERE username = 'testuser';"

# Check queries.conf uses correct variable
sudo cat /usr/local/etc/raddb/mods-config/sql/main/postgresql/queries.conf | grep "User-Name"
# Should show: '%{User-Name}' NOT '%{SQL-User-Name}'
```

**API Invalid Credentials:**
```bash
# Test database connection from Node.js
cd /usr/local/boldvpn-site/api
node -e "const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', database: 'radius', user: 'radiususer', password: 'YOUR_PASSWORD' }); pool.query('SELECT * FROM radcheck WHERE username = \$1', ['testuser']).then(res => console.log('Found:', res.rows)).catch(err => console.error('Error:', err)).finally(() => pool.end());"
```

**HAProxy Backend DOWN:**
```bash
# Test API is running
curl http://192.168.50.2:3000/api/health

# Increase health check timeout in HAProxy to 5000ms
```

**Complete troubleshooting:** See deployment guides above (all have comprehensive troubleshooting sections with TOCs!)

---

## Contributing

### Development Workflow

1. **Make changes locally**
2. **Test changes**
3. **Commit to Git**
4. **Push to GitHub**
5. **Pull on FreeBSD server:** `cd /usr/local/boldvpn-site && git pull`
6. **Restart services:** `./scripts/update.sh`

### Updating Deployment

```bash
# On FreeBSD server
cd /usr/local/boldvpn-site
git pull
./scripts/update.sh
```

The update script automatically:
- Pulls latest code
- Installs new npm dependencies
- Restarts API service
- Restarts RADIUS service

---

## Documentation

### 📚 Complete Documentation (3,000+ lines!)

**Deployment:**
- FREEBSD-DEPLOYMENT.md (558 lines)
- OPNSENSE-HAPROXY-SETUP.md (1,297 lines)
- api/DEPLOYMENT.md (890 lines)

**System:**
- SYSTEM-OVERVIEW.md
- portal/HOW-IT-WORKS.md
- portal/PORTAL-GUIDE.md
- scripts/README.md

**All guides include:**
- ✅ Table of Contents
- ✅ Step-by-step instructions
- ✅ Comprehensive troubleshooting
- ✅ Real-world examples
- ✅ Quick reference tables

---

## Support

### Resources

- 📖 **Documentation:** See guides above
- 🔧 **Scripts:** [scripts/README.md](scripts/README.md)
- 🐛 **Troubleshooting:** Check deployment guides
- 📊 **Monitoring:** Service logs and status commands

### Logs

```bash
# RADIUS logs
sudo tail -f /var/log/radius.log

# API logs
tail -f /var/log/boldvpn-api.log

# PostgreSQL logs
sudo tail -f /var/db/postgres/data*/pg.log
```

### Service Status

```bash
# Check all services
sudo service postgresql status
sudo service radiusd status
sudo service boldvpn_api status

# Restart services
sudo service radiusd restart
sudo service boldvpn_api restart
```

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

Built with:
- FreeRADIUS - Open source RADIUS server
- PostgreSQL - Open source database
- Node.js + Express - JavaScript runtime and framework
- OPNsense - Open source firewall
- HAProxy - High-performance load balancer

---

## Quick Links

- 🌐 **Live Site:** https://boldvpn.net
- 🔐 **Customer Portal:** https://boldvpn.net/portal/
- 🔌 **Public API:** https://api.boldvpn.net
- 📖 **Documentation:** [FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md)
- 🚀 **Quick Start:** [3 Simple Steps](#quick-deployment)

---

**✅ Production-ready, fully documented, enterprise-grade VPN service platform!**
