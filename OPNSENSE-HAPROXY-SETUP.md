# OPNsense HAProxy Setup Guide

Complete guide for setting up HAProxy reverse proxy on OPNsense to make the BoldVPN API publicly accessible with HTTPS.

**Based on actual OPNsense HAProxy interface - Clear and simple!**

---

## 📑 Table of Contents

### Getting Started
- [What This Does](#-what-this-does)
- [Prerequisites](#-prerequisites)
- [Important Notes](#️-critical-notes)

### Step-by-Step Setup
- [Step 1: Install HAProxy Plugin](#step-1-install-haproxy-plugin)
- [Step 2: Get SSL Certificate (Acme Client)](#step-2-get-ssl-certificate-acme-client)
- [Step 3: Configure Real Server (FreeBSD API)](#step-3-configure-real-server-freebsd-api)
- [Step 4: Configure Backend Pool](#step-4-configure-backend-pool)
- [Step 5: Configure Frontend #1 - HTTP Redirect](#step-5-configure-frontend-1---http-redirect)
- [Step 6: Configure Frontend #2 - HTTPS API](#step-6-configure-frontend-2---https-api)
- [Step 7: Configure WAN Firewall Rules (CRITICAL!)](#step-7-configure-wan-firewall-rules-critical)
- [Step 8: Enable HAProxy](#step-8-enable-haproxy)
- [Step 9: Verify Everything is UP](#step-9-verify-everything-is-up)

### Testing
- [Complete Testing Guide](#-complete-testing-guide)
  - [Test 1: API Running Locally](#test-1-api-running-locally-freebsd)
  - [Test 2: From OPNsense to FreeBSD](#test-2-from-opnsense-to-freebsd)
  - [Test 3: HTTP Request (Should Redirect)](#test-3-http-request-should-redirect)
  - [Test 4: HTTPS Request (Main Test!)](#test-4-https-request-main-test)
  - [Test 5: Test Login Endpoint](#test-5-test-login-endpoint)

### Understanding the Configuration
- [Configuration Summary](#-complete-configuration-summary)
- [Understanding Key Options](#-understanding-key-options)
  - [option forwardfor](#option-forwardfor-backend)
  - [HTTP → HTTPS Redirect](#http--https-redirect-explained)
  - [X-Forwarded-Proto Header](#x-forwarded-proto-header)

### Troubleshooting
- [Troubleshooting Guide](#-troubleshooting)
  - [Apply Button Not Showing](#apply-button-not-showing)
  - [Backend Server DOWN](#backend-server-down-red)
  - [HTTPS Doesn't Work](#https-doesnt-work)
  - [Connection Timeout](#connection-timeout)

### Advanced Topics
- [Monitoring HAProxy](#-monitoring-haproxy)
- [TLS Security Hardening](#-optional-tls-security-hardening)
- [Testing with curl TLS Issues](#-testing-with-curl-tls-issues)

### Final Steps
- [After HAProxy is Working](#-after-haproxy-is-working)
- [Complete Setup Checklist](#-complete-setup-checklist)
- [What You Achieved](#-what-you-achieved)

---

## 🎯 What This Does

**Architecture:**
```
Internet → OPNsense:443 (HAProxy + SSL) → FreeBSD:3000 (API, plain HTTP)
```

**Result:**
- ✅ Users access: `https://api.boldvpn.net` (from anywhere!)
- ✅ OPNsense handles SSL encryption/decryption
- ✅ HTTP automatically redirects to HTTPS
- ✅ FreeBSD just runs API on port 3000 (no SSL needed!)

## 📋 Prerequisites

- [x] FreeBSD API running on port 3000 (`sudo service boldvpn_api status`)
- [x] DNS: `api.boldvpn.net` → Your public IP (OPNsense WAN)
- [x] OPNsense with internet access
- [x] Port 80 accessible from internet (for SSL certificate verification)

## ⚠️ Critical Notes

- ✅ **No port forwarding/NAT needed!** HAProxy receives, not forwards
- ✅ **No firewall rules needed!** LAN→LAN traffic allowed by default
- ✅ **No SSL on FreeBSD!** OPNsense handles all SSL
- 🔴 **MUST click "Apply Changes" after EACH save** (orange button at top!)

---

## 🚀 Step-by-Step Configuration

### Step 1: Install HAProxy Plugin

**Location:** System → Firmware → Plugins

1. Search for: `haproxy`
2. Find: `os-haproxy`
3. Click: **Install**
4. Wait for installation (1-2 minutes)
5. Refresh browser

**Verify:** "Services → HAProxy" appears in menu

---

### Step 2: Get SSL Certificate (Acme Client)

#### 2.1: Check Acme Account

**Location:** Services → ACME Client → Accounts

**If you have an account:** Note the name for step 2.2

**If not, create one:** Click **"+"**
- **Name:** `Let's Encrypt Production`
- **CA:** `Let's Encrypt Production ACME v2`
- **Email:** your-email@example.com
- Click **Save**

#### 2.2: Create Certificate

**Location:** Services → ACME Client → Certificates

Click **"+"**:

| Field | Value |
|-------|-------|
| Enabled | ✓ Checked |
| Common Name | `api.boldvpn.net` |
| Acme Account | `Let's Encrypt Production` |
| Description | `BoldVPN API Certificate` |
| Auto Renewal | ✓ Checked |
| Renewal Interval | `60` |
| Challenge Type | `HTTP-01` |
| HTTP Service | `OPNsense Web Service` |

Click **Save**

Click **Issue/Renew** button (next to the certificate)

**Wait 30-60 seconds**

**Verify:** Status shows "OK" (green) with expiration date

**If failed:** Check DNS points to correct IP

---

### Step 3: Configure Real Server (FreeBSD API)

**Location:** Services → HAProxy → Settings → Real Servers

Click **"+"**:

| Field | Value |
|-------|-------|
| Name | `freebsd_api` |
| Description | `BoldVPN API on FreeBSD` |
| FQDN or IP | `192.168.50.2` |
| Port | `3000` |
| Mode | `active` |
| SSL | ❌ Unchecked (FreeBSD uses HTTP!) |
| Verify SSL Certificate | ❌ Unchecked |

Click **Save** → **Apply Changes** 🔴

---

### Step 4: Configure Backend Pool

**Location:** Services → HAProxy → Settings → Virtual Services → Backend Pools

Click **"+"**:

**Basic Settings:**

| Field | Value |
|-------|-------|
| Name | `api_backend_pool` |
| Description | `BoldVPN API Backend` |
| Mode | `HTTP (Layer 7)` |
| Servers | Select `freebsd_api` |

**Health Checking:**

| Field | Value |
|-------|-------|
| Health Check | `HTTP` |
| Check Interval | `2000` |
| HTTP Check Method | `GET` |
| HTTP Check Path | `/api/health` |
| HTTP Check Expected Status | `200` |

**Advanced Settings → Option pass-through:**

Add this line:
```
option forwardfor
```

**📝 What "option forwardfor" does:**

**WITHOUT this option:**
- Your API sees all requests from: `192.168.50.1` (OPNsense IP)
- You can't identify individual users
- Can't block abusive IPs
- Can't do geographic analytics
- All requests look the same

**WITH this option:**
- Your API sees REAL client IPs in `X-Forwarded-For` header
- Can identify individual users
- Can block abusive IPs by their real IP
- Can analyze user locations
- Better security and logging

**Example API logs:**

Without forwardfor:
```
[2025-11-06] Request from 192.168.50.1 - Login: testuser
[2025-11-06] Request from 192.168.50.1 - Login: admin
[2025-11-06] Request from 192.168.50.1 - Failed login attempt
```
All from same IP → Can't identify the attacker!

With forwardfor:
```
[2025-11-06] Request from 203.45.67.89 - Login: testuser
[2025-11-06] Request from 104.28.15.32 - Login: admin  
[2025-11-06] Request from 45.76.201.99 - Failed login attempt (5 times)
```
Can identify and block 45.76.201.99 → Better security!

**Recommendation:** ✅ **Always add this for production!**

Click **Save** → **Apply Changes** 🔴

---

### Step 5: Configure Frontend #1 - HTTP Redirect

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services

Click **"+"**:

**Basic Settings:**

| Field | Value |
|-------|-------|
| Enabled | ✓ Checked |
| Name | `api_http_redirect` |
| Description | `Redirect HTTP to HTTPS` |

**Listen Addresses:**

Add one address: `0.0.0.0:80`

**Bind option pass-through:** Leave empty

**Type:**

| Field | Value |
|-------|-------|
| Type | `HTTP (Layer 7)` ← Note: HTTP, not SSL! |

**Default Backend Pool:**

Select any backend (won't be used, redirect happens first)

Or leave empty if allowed.

**Advanced settings → Option pass-through:**

Add this line:
```
redirect scheme https code 301
```

**📝 What this does:**

This frontend ONLY handles HTTP requests (port 80).

When a request comes in:
1. User visits: `http://api.boldvpn.net/api/health`
2. HAProxy receives on port 80
3. Custom rule: `redirect scheme https code 301`
4. HAProxy returns: "301 Moved Permanently → https://api.boldvpn.net/api/health"
5. Browser automatically follows redirect to HTTPS
6. Request handled by Frontend #2 (HTTPS)

**Result:** All HTTP traffic forced to HTTPS! Secure by default. ✅

**Rules:** Leave empty

**Error Messages:** Leave empty

Click **Save** → **Apply Changes** 🔴

---

### Step 6: Configure Frontend #2 - HTTPS API

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services

Click **"+"**:

**Basic Settings:**

| Field | Value |
|-------|-------|
| Enabled | ✓ Checked |
| Name | `api_https` |
| Description | `BoldVPN API HTTPS` |

**Listen Addresses:**

Add one address: `0.0.0.0:443`

**Bind option pass-through:** Leave empty

**Type:**

| Field | Value |
|-------|-------|
| Type | `HTTP / HTTPS (SSL Offloading)` ← Important! |

**Default Backend:**

| Field | Value |
|-------|-------|
| Default Backend Pool | `api_backend_pool` |

**Enable SSL offloading:**

| Field | Value |
|-------|-------|
| Enable SSL offloading | ✓ Checked |

**SSL Offloading Settings** (appears after checking):

| Field | Value |
|-------|-------|
| Certificates | Select `api.boldvpn.net` (from dropdown) |
| SSL Passthrough | ❌ Unchecked (we want offloading!) |

**📝 SSL Offloading vs Passthrough:**

**SSL Offloading (what we're using):**
```
Internet (HTTPS) → OPNsense (decrypt) → FreeBSD (HTTP)
```
- HAProxy decrypts HTTPS on OPNsense
- FreeBSD receives plain HTTP
- FreeBSD needs NO SSL certificate
- OPNsense does the encryption work
- ✅ **This is what you want!**

**SSL Passthrough (DON'T use):**
```
Internet (HTTPS) → OPNsense (forward encrypted) → FreeBSD (HTTPS)
```
- HAProxy doesn't decrypt
- Just forwards encrypted traffic
- FreeBSD needs SSL certificate
- Can't modify requests or add headers
- ❌ **Don't enable this!**

**HTTP(S) settings:**

| Field | Value |
|-------|-------|
| Enable HTTP/2 | ✓ Checked (modern, faster) |
| HTTP/2 without TLS | ❌ Unchecked |
| Advertise Protocols (ALPN) | Select both: `HTTP/2` and `HTTP/1.1` |
| X-Forwarded-For (DEPRECATED) | ❌ Skip (we added to backend) |

**Connection Mode:** Leave default

**Advanced settings → Option pass-through:**

Add this line:
```
http-request set-header X-Forwarded-Proto https
```

**📝 What this does:**

Tells your API: "The original request was HTTPS"

**Why it's needed:**
- FreeBSD API receives plain HTTP (from HAProxy)
- API can't tell if original request was HTTP or HTTPS
- This header informs API: "User connected via HTTPS"
- Useful for security logs and analytics

**Example:**

User visits: `https://api.boldvpn.net/api/auth/login`

Without header:
- API sees: `GET /api/auth/login` (HTTP)
- API thinks: "This was an insecure connection"

With header:
- API sees: `GET /api/auth/login` (HTTP) + `X-Forwarded-Proto: https`
- API knows: "Original request was secure HTTPS"

**Optional but recommended for proper logging!**

**Rules:** Leave empty

**Error Messages:** Leave empty

Click **Save** → **Apply Changes** 🔴

---

### Step 7: Configure WAN Firewall Rules (CRITICAL!)

**⚠️ This step is REQUIRED for HAProxy to work from the internet!**

HAProxy listens on OPNsense WAN interface, but OPNsense blocks WAN→self traffic by default. You must add firewall rules to allow internet traffic to reach HAProxy.

**Location:** Firewall → Rules → **WAN**

#### Rule 1: Allow HTTPS (Port 443)

Click **"+"** to add rule:

| Field | Value |
|-------|-------|
| Action | `Pass` |
| Interface | `WAN` |
| Direction | `in` |
| TCP/IP Version | `IPv4` |
| Protocol | `TCP` |
| Source | `any` |
| Destination | **`This Firewall (self)`** ← Critical! |
| Destination port range | From: `443` To: `443` |
| Description | `HAProxy HTTPS API` |

Click **Save**

#### Rule 2: Allow HTTP (Port 80) - For Redirect

Click **"+"** to add second rule:

| Field | Value |
|-------|-------|
| Action | `Pass` |
| Interface | `WAN` |
| Direction | `in` |
| TCP/IP Version | `IPv4` |
| Protocol | `TCP` |
| Source | `any` |
| Destination | **`This Firewall (self)`** ← Critical! |
| Destination port range | From: `80` To: `80` |
| Description | `HAProxy HTTP redirect` |

Click **Save**

**After adding both rules:** Click **Apply Changes** (top right)

**📝 Why these rules are needed:**

**Without these rules:**
```
Internet → OPNsense WAN:443 ✗ BLOCKED by firewall
         → HAProxy never receives traffic
         → Connection timeout
```

**With these rules:**
```
Internet → OPNsense WAN:443 ✓ ALLOWED by firewall rule
         → HAProxy receives traffic
         → Proxies to FreeBSD:3000
         → Returns response
```

**Key point:** Destination must be **"This Firewall (self)"** because HAProxy runs ON OPNsense, not behind it!

**This is different from:**
- Port forwarding (WAN → LAN device)
- NAT rules (not needed here)

**This is traffic TO OPNsense itself!**

---

### Step 8: Enable HAProxy

**Location:** Services → HAProxy → Settings → Service

| Field | Value |
|-------|-------|
| Enable HAProxy | ✓ Checked |

Click **Save** → **Apply Changes** 🔴

**Wait 5-10 seconds** for HAProxy to start.

---

### Step 9: Verify Everything is UP

**Location:** Services → HAProxy → Diagnostics → Stats

**You should see:**

**Frontend: api_http_redirect**
- Status: **UP** (green)
- Type: HTTP
- Port: 80

**Frontend: api_https**
- Status: **UP** (green)
- Type: HTTPS
- Port: 443

**Backend: api_backend_pool**
- Status: **UP** (green)
- Active: 1 server

**Server: freebsd_api**
- Status: **UP** (green circle)
- Address: 192.168.50.2:3000
- Last Check: Passed ✓

**If any component shows DOWN:**
- Review that step's configuration
- Check you clicked "Apply Changes"
- Check FreeBSD API is running
- Check logs: System → Log Files → HAProxy

---

## 🧪 Complete Testing Guide

### Test 1: API Running Locally (FreeBSD)

```bash
# On FreeBSD server
curl http://localhost:3000/api/health
```

**Expected:**
```json
{"status":"OK","timestamp":"2025-11-06T...","uptime":123.45}
```

**If fails:** API not running - check `sudo service boldvpn_api status`

---

### Test 2: From OPNsense to FreeBSD

```bash
# From OPNsense console/shell
curl http://192.168.50.2:3000/api/health
```

**Expected:** Same JSON response

**If fails:** 
- Network issue between OPNsense and FreeBSD
- API not listening on 3000
- Firewall blocking (check FreeBSD firewall)

---

### Test 3: HTTP Request (Should Redirect)

```bash
# From your Mac
curl -I http://api.boldvpn.net/api/health
```

**Expected:**
```
HTTP/1.1 301 Moved Permanently
Location: https://api.boldvpn.net/api/health
```

**If fails:**
- DNS not configured (api.boldvpn.net doesn't resolve)
- HAProxy HTTP frontend not running
- Port 80 blocked by ISP

**What's happening:**
1. Request goes to port 80
2. HAProxy frontend `api_http_redirect` receives it
3. Redirect rule: `redirect scheme https code 301`
4. Returns 301 redirect to HTTPS URL
5. Browser follows redirect

---

### Test 4: HTTPS Request (Main Test!)

```bash
# From your Mac, phone, or anywhere on internet
curl https://api.boldvpn.net/api/health
```

**Expected:**
```json
{
  "status": "OK",
  "timestamp": "2025-11-06T12:34:56.789Z",
  "uptime": 123.45
}
```

**If you get TLS/SSL protocol error:**
```
curl: (35) LibreSSL/3.3.6: error:1404B42E:SSL routines:ST_CONNECT:tlsv1 alert protocol version
```

**This is a curl/LibreSSL version issue on your Mac, NOT your API!**

**Solutions:**

```bash
# Option 1: Force TLS 1.2 (works with old curl)
curl --tlsv1.2 https://api.boldvpn.net/api/health

# Option 2: Force TLS 1.3 (if supported)
curl --tlsv1.3 https://api.boldvpn.net/api/health

# Option 3: Test in browser (recommended!)
# Open: https://api.boldvpn.net/api/health
# Browsers have modern TLS support - will work fine!

# Option 4: Update curl via Homebrew
brew install curl
/opt/homebrew/bin/curl https://api.boldvpn.net/api/health
```

**If this works: ✅ COMPLETE SUCCESS!**

**What's happening:**
1. Request goes to port 443 (HTTPS)
2. HAProxy frontend `api_https` receives it
3. SSL certificate validates: ✓
4. HAProxy decrypts HTTPS → HTTP
5. Adds headers (X-Forwarded-For, X-Forwarded-Proto)
6. Proxies to FreeBSD: `http://192.168.50.2:3000/api/health`
7. FreeBSD API processes request
8. Returns JSON to HAProxy
9. HAProxy encrypts JSON → HTTPS
10. Sends HTTPS response to client

---

### Test 5: Test Login Endpoint

```bash
# Test actual API login
curl -X POST https://api.boldvpn.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test@123!"}'
```

**Expected:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {"username":"testuser",...}
}
```

**If this works:** Your API authentication is working through HAProxy! ✅

---

## 📖 Complete Configuration Summary

### What You Configured (4 Components)

#### 1. Real Server
```
Name: freebsd_api
IP: 192.168.50.2
Port: 3000
SSL: No
```

#### 2. Backend Pool
```
Name: api_backend_pool
Mode: HTTP (Layer 7)
Servers: freebsd_api
Health Check: GET /api/health → expect 200
Option: option forwardfor
```

#### 3. Frontend #1 - HTTP Redirect
```
Name: api_http_redirect
Listen: 0.0.0.0:80
Type: HTTP
Option: redirect scheme https code 301
Purpose: Force HTTPS
```

#### 4. Frontend #2 - HTTPS API
```
Name: api_https
Listen: 0.0.0.0:443
Type: HTTP/HTTPS (SSL Offloading)
Backend: api_backend_pool
SSL: Yes
Certificate: api.boldvpn.net
Passthrough: No
Option: http-request set-header X-Forwarded-Proto https
Purpose: Handle HTTPS API traffic
```

---

## 💡 Understanding Key Options

### "option forwardfor" (Backend)

**What it does:** Adds real client IP to requests

**Without it:**
```
API log: "Request from 192.168.50.1" (OPNsense IP)
API log: "Request from 192.168.50.1" (OPNsense IP)
API log: "Request from 192.168.50.1" (OPNsense IP)
```
All requests from same IP → Can't identify users!

**With it:**
```
API log: "Request from 203.45.67.89 (France)"
API log: "Request from 104.28.15.32 (USA)"
API log: "Request from 142.250.80.46 (Canada)"
```
Real IPs → Can identify users, block abusers, analytics!

**When you need it:**
- ✅ Production (security, logging, analytics)
- ✅ User identification
- ✅ IP-based rate limiting
- ✅ Geographic analytics
- ❌ Not critical for basic testing

**Recommendation:** ✅ **Add it!** Very useful for production.

---

### HTTP → HTTPS Redirect Explained

**Why two frontends?**

**Frontend #1 (Port 80):**
- Purpose: Catch HTTP requests
- Action: Redirect to HTTPS
- Rule: `redirect scheme https code 301`

**Frontend #2 (Port 443):**
- Purpose: Handle HTTPS requests
- Action: Proxy to API
- Has: SSL certificate

**Flow:**

```
User types: http://api.boldvpn.net/api/health
    ↓
    Port 80 (Frontend #1)
    ↓
    Redirect: 301 → https://api.boldvpn.net/api/health
    ↓
    Browser follows redirect
    ↓
    Port 443 (Frontend #2)
    ↓
    SSL decrypt
    ↓
    Proxy to FreeBSD:3000
    ↓
    Get response
    ↓
    SSL encrypt
    ↓
    HTTPS response to user
```

**Alternative (not recommended):**
- Only listen on 443
- HTTP won't work at all
- Users must type `https://` manually

**Our approach:** Handle both, redirect HTTP → HTTPS automatically! ✅

---

### X-Forwarded-Proto Header

**What it does:** Tells API the original protocol

**Added in Frontend #2:**
```
http-request set-header X-Forwarded-Proto https
```

**Why it's needed:**

FreeBSD API receives plain HTTP (after SSL offloading).

Without header:
- API thinks: "This request was HTTP (insecure)"
- Logs might show: "Insecure connection from..."

With header:
- API knows: "Original request was HTTPS (secure)"
- Logs correctly show: "Secure HTTPS connection from..."

**Use case:**
- Accurate security logging
- API can enforce HTTPS-only policies
- Compliance/audit trails

**Not critical but recommended!** ✅

---

## 🔧 Troubleshooting

### Apply Button Not Showing

**Problem:** Clicked Save, no orange notification

**Solutions:**
1. Refresh the page
2. Go to: Services → HAProxy → Settings (main page)
3. Orange banner should appear at top
4. Click "Apply Changes"

### Backend Server DOWN (Red)

**Check 1:** API running on FreeBSD?
```bash
sudo service boldvpn_api status
curl http://localhost:3000/api/health
```

**Check 2:** Reachable from OPNsense?
```bash
# From OPNsense console
curl http://192.168.50.2:3000/api/health
```

**Check 3:** Correct configuration?
- IP: `192.168.50.2` (not 192.168.50.1 or wrong IP)
- Port: `3000` (not 443 or wrong port)
- SSL: Unchecked (must be unchecked!)

**Check 4:** Health check path correct?
- Must be: `/api/health` (with leading slash!)
- Expected status: `200`

### HTTPS Doesn't Work

**Check 1:** SSL certificate OK?
- Services → ACME Client → Certificates
- Status: OK (green)
- Not expired

**Check 2:** Frontend SSL settings?
- Enable SSL offloading: Checked
- Certificate: api.boldvpn.net selected
- SSL Passthrough: Unchecked

**Check 3:** HAProxy running?
- Services → HAProxy → Diagnostics → Stats
- Frontend api_https: UP

### Connection Timeout

**Check 1:** DNS resolves?
```bash
ping api.boldvpn.net
# Should show your public IP
```

**Check 2:** Port 443 accessible?
```bash
# From internet
telnet api.boldvpn.net 443
```

**Check 3:** HAProxy listening?
- Stats page should show frontend UP
- Check listen address: 0.0.0.0:443 (not 127.0.0.1)

---

## 📊 Monitoring

### HAProxy Statistics

**Location:** Services → HAProxy → Diagnostics → Stats

**What you see:**
- Request rate (requests/second)
- Current sessions
- Total sessions
- Backend server health (UP/DOWN)
- Response times
- Errors

**Refresh page** to see live updates!

### Logs

**Location:** System → Log Files → HAProxy

Shows:
- All requests
- Backend selections
- SSL handshakes
- Errors and warnings

**Useful for debugging!**

---

## 🎯 After HAProxy is Working

### 1. Update Customer Portal

**On your Mac:**

```bash
cd /Users/msotoode/Documents/GitHub/boldvpn-site
nano portal/config.js
```

**Change:**
```javascript
const Config = {
    API_URL: 'https://api.boldvpn.net/api',  // Update this line!
    // ... rest stays the same
};
```

**Commit and push:**
```bash
git add portal/config.js
git commit -m "Update API URL to use HAProxy reverse proxy"
git push
```

Wait 1-2 minutes for GitHub Pages to deploy.

---

### 2. Update API CORS (if needed)

**On FreeBSD:**

```bash
sudo nano /usr/local/boldvpn-site/api/.env
```

**Ensure this line exists:**
```
CORS_ORIGIN=https://boldvpn.net,https://www.boldvpn.net
```

**Restart API:**
```bash
sudo service boldvpn_api restart
```

---

### 3. Test End-to-End

**From any device (Mac, phone, public WiFi):**

1. Open browser
2. Visit: `https://boldvpn.net/portal/`
3. You should see login page
4. Login: `testuser` / `Test@123!`
5. Should see dashboard with:
   - Data usage
   - Connection speed
   - Connected devices
   - Current session

**If this works: 🎉 EVERYTHING IS COMPLETE!**

Users can now:
- ✅ Access portal from anywhere
- ✅ Login with their credentials
- ✅ View real-time usage data
- ✅ Manage their account
- ✅ All secure with HTTPS!

---

## ✅ Complete Setup Checklist

**OPNsense HAProxy:**
- [ ] HAProxy plugin installed
- [ ] Acme account configured
- [ ] SSL certificate for api.boldvpn.net (Status: OK)
- [ ] Real Server: 192.168.50.2:3000, SSL: No
- [ ] Backend Pool: HTTP mode, freebsd_api, option forwardfor
- [ ] Frontend #1: Port 80, HTTP redirect
- [ ] Frontend #2: Port 443, SSL offloading, api.boldvpn.net cert
- [ ] HAProxy enabled and running
- [ ] Stats show all components UP (green)

**Testing:**
- [ ] HTTP redirects to HTTPS (301)
- [ ] HTTPS returns JSON from API
- [ ] Can access from internet (not just LAN)

**Portal:**
- [ ] portal/config.js updated with HTTPS URL
- [ ] Pushed to GitHub
- [ ] Can login from https://boldvpn.net/portal/
- [ ] Dashboard shows real data

---

## 🚀 What You Achieved

With this setup, you now have:

✅ **Enterprise-Grade Reverse Proxy**
- HAProxy handles all public traffic
- SSL termination at the edge
- Health monitoring
- Auto failover (if you add more backends)

✅ **Secure Public API**
- HTTPS only (HTTP auto-redirects)
- Free SSL certificate (auto-renewing)
- Real client IP logging
- Industry-standard security headers

✅ **Simple FreeBSD Backend**
- Just runs API on port 3000
- No SSL complexity
- Easy to update and maintain

✅ **Professional Customer Portal**
- Accessible from anywhere
- Secure HTTPS connection
- Real-time usage data
- Modern user interface

**BoldVPN is now a production-ready VPN service!** 🎉

---

## 📚 Additional Resources

- **System Architecture:** [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)
- **FreeBSD Deployment:** [FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md)
- **API Documentation:** [api/README.md](api/README.md)
- **Portal Guide:** [portal/HOW-IT-WORKS.md](portal/HOW-IT-WORKS.md)
- **All Scripts:** [scripts/README.md](scripts/README.md)

---

**🎯 This is the complete, production-ready setup!** All traffic is encrypted, monitored, and secure. Your users can access the service from anywhere in the world!

---

## 🔒 Optional: TLS Security Hardening

For maximum security in production, you can harden the TLS configuration.

**See:** [HAPROXY-SECURITY-HARDENING.md](HAPROXY-SECURITY-HARDENING.md)

**Quick version:** Add to `api_https` frontend option pass-through:

```
ssl-min-ver TLSv1.2
```

This blocks insecure TLS 1.0 and 1.1, allowing only TLS 1.2 and 1.3.

**Result:** A or A+ grade on SSL Labs test!

---

## 🧪 Testing with curl TLS Issues

If you get this error:
```
curl: (35) LibreSSL/3.3.6: error:1404B42E:SSL routines:ST_CONNECT:tlsv1 alert protocol version
```

**This is your Mac's old curl, not your API!**

**Quick fixes:**

```bash
# Option 1: Force TLS 1.2
curl --tlsv1.2 https://api.boldvpn.net/api/health

# Option 2: Test in browser (always works!)
# Open: https://api.boldvpn.net/api/health

# Option 3: Update curl
brew install curl
/opt/homebrew/bin/curl https://api.boldvpn.net/api/health
```

**Browsers and modern clients will work fine!** This curl error doesn't affect real users.

---

