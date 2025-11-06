# OPNsense HAProxy Setup Guide

Complete guide for setting up HAProxy reverse proxy on OPNsense to make the BoldVPN API publicly accessible with HTTPS.

**Based on actual OPNsense HAProxy interface - tested and verified!**

## 🎯 What This Does

**Architecture:**
```
Internet (Public) → OPNsense:443 (HAProxy with SSL)
                  → FreeBSD:3000 (API, plain HTTP)
```

**Result:**
- Users access: `https://api.boldvpn.net`
- OPNsense handles SSL encryption/decryption
- Proxies plain HTTP to FreeBSD API on port 3000
- No SSL needed on FreeBSD!

## 📋 Prerequisites

- [x] FreeBSD API running on port 3000 (`sudo service boldvpn_api status`)
- [x] DNS: `api.boldvpn.net` → Your public IP (OPNsense WAN)
- [x] OPNsense with internet access
- [x] Port 80 accessible from internet (for SSL certificate verification)

## ⚠️ Important Notes

- **No port forwarding/NAT needed!** HAProxy receives traffic, doesn't forward it
- **No firewall rules needed!** OPNsense LAN → FreeBSD LAN is allowed by default
- **FreeBSD needs NO SSL!** HAProxy handles all SSL/HTTPS
- **Click "Apply Changes" after EACH save** (orange button at top of page)

---

## 🚀 Step-by-Step Setup

### Step 1: Install HAProxy Plugin

**Location:** System → Firmware → Plugins

1. Search for: `haproxy`
2. Find: `os-haproxy`
3. Click: **Install**
4. Wait for installation to complete (1-2 minutes)
5. Refresh page

**Verify:** Menu should now show "Services → HAProxy"

---

### Step 2: Configure Acme Client for SSL Certificate

#### 2.1: Check/Create Acme Account

**Location:** Services → ACME Client → Accounts

**If you already have a Let's Encrypt account, skip to 2.2.**

If not, click **"+"** to add:
- **Name:** `Let's Encrypt Production`
- **CA:** `Let's Encrypt Production ACME v2`
- **Email:** Your email address
- Click **Save**

#### 2.2: Create Certificate for api.boldvpn.net

**Location:** Services → ACME Client → Certificates

Click **"+"** to add new certificate:

**General Settings:**
- **Enabled:** ✓ (checked)
- **Common Name:** `api.boldvpn.net`
- **Acme Account:** `Let's Encrypt Production`
- **Description:** `BoldVPN API Certificate`
- **Auto Renewal:** ✓ (checked)
- **Renewal Interval:** `60` (days)

**Challenge Type:**
- **Challenge Type:** `HTTP-01`
- **HTTP Service:** `OPNsense Web Service`

**Actions:**
- Click **Save**
- Click **Issue/Renew** (button next to the certificate entry)
- Wait 30-60 seconds

**Verify:** 
- Status should show "OK" (green checkmark)
- Expiration date should be ~90 days from now
- If failed, check DNS is configured correctly

---

### Step 3: Configure HAProxy Backend (FreeBSD API Server)

**Location:** Services → HAProxy → Settings → Real Servers

Click **"+"** to add new server:

- **Name:** `freebsd_api`
- **Description:** `BoldVPN API on FreeBSD`
- **FQDN or IP:** `192.168.50.2`
- **Port:** `3000`
- **Mode:** `active`
- **SSL:** ❌ (unchecked - FreeBSD uses plain HTTP!)
- **Verify SSL Certificate:** ❌ (unchecked)
- **Weight:** `1` (default)

Click **Save**

**Look for orange "Apply Changes" button at top → Click it!**

---

### Step 4: Configure HAProxy Backend Pool

**Location:** Services → HAProxy → Settings → Virtual Services → Backend Pools

Click **"+"** to add new pool:

**Basic Settings:**
- **Name:** `api_backend_pool`
- **Description:** `BoldVPN API Backend Pool`
- **Mode:** `HTTP (Layer 7)` ← Important!
- **Servers:** Select `freebsd_api` (from dropdown, add it)

**Health Checking:**
- **Health Check:** `HTTP`
- **Check Interval:** `2000` (ms)
- **HTTP Check Method:** `GET`
- **HTTP Check Path:** `/api/health`
- **HTTP Check Expected Status:** `200`

**Advanced Settings → Option pass-through:**

Add this line:
```
option forwardfor
```

This automatically adds X-Forwarded-For header with the client's real IP.

Click **Save**

**Look for orange "Apply Changes" button at top → Click it!**

---

### Step 5: Configure HAProxy Frontend (Public Service)

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services

Click **"+"** to add new service:

**Basic Settings:**
- **Enabled:** ✓ (checked)
- **Name:** `api_frontend`
- **Description:** `BoldVPN API Public Access`

**Listen Addresses:**

Click **"+"** to add **TWO** addresses:

1. **Address 1:** `0.0.0.0:443` (HTTPS)
2. **Address 2:** `0.0.0.0:80` (HTTP - for redirect)

**Bind option pass-through:** (leave empty)

**Type:**
- **Type:** `HTTP / HTTPS (SSL Offloading)` ← Important!

**Default Backend:**
- **Default Backend Pool:** `api_backend_pool`

**Enable SSL offloading:**
- **Enable SSL offloading:** ✓ (checked)

**SSL Offloading Settings:**

After checking "Enable SSL offloading", more options appear:

- **Certificates:** Select `api.boldvpn.net` (from Acme dropdown)
- **SSL Passthrough:** ❌ (DO NOT CHECK - we want offloading!)

**HTTP(S) settings:**
- **Enable HTTP/2:** ✓ (optional, recommended)
- **HTTP/2 without TLS:** ❌ (unchecked)
- **Advertise Protocols (ALPN):** Select both:
  - `HTTP/2`
  - `HTTP/1.1`
- **X-Forwarded-For (DEPRECATED):** ❌ (skip this - we added it to backend)

**Connection Mode:**
- Leave default or select `http-keep-alive`

**Advanced settings → Option pass-through:**

Add these TWO lines (each on separate line):
```
http-request redirect scheme https code 301 if !{ ssl_fc }
http-request set-header X-Forwarded-Proto https
```

**Explanation:**
- **Line 1:** Redirects any HTTP request (port 80) to HTTPS (port 443)
- **Line 2:** Tells the API that the original request was HTTPS

**Rules:**
- **Select Rules:** (leave empty)

**Error Messages:**
- (leave empty)

Click **Save**

**Look for orange "Apply Changes" button at top → Click it!**

---

### Step 6: Enable and Start HAProxy

**Location:** Services → HAProxy → Settings → Service

- **Enable HAProxy:** ✓ (checked)
- Click **Save**

**CRITICAL:** Look for orange notification at TOP of page:
"The configuration has been changed. Click Apply to activate."

**Click "Apply Changes"** (orange button)

Wait for confirmation that HAProxy is running.

---

### Step 7: Verify HAProxy is Running

**Location:** Services → HAProxy → Diagnostics → Stats

You should see:

**Frontend:**
- Name: `api_frontend`
- Status: **UP** (green)
- Sessions: 0 (will increase with use)

**Backend:**
- Name: `api_backend_pool`
- Status: **UP** (green)
- Servers: 1

**Server:**
- Name: `freebsd_api`
- Status: **UP** (green circle)
- Address: 192.168.50.2:3000

**If server shows DOWN (red):**
- Check FreeBSD API is running: `sudo service boldvpn_api status`
- Test manually: `curl http://192.168.50.2:3000/api/health`
- Check IP/port are correct in Real Server config

---

## 🧪 Testing

### Test 1: From FreeBSD Server (Local)

```bash
# API should still work locally
curl http://localhost:3000/api/health
```

**Expected:** `{"status":"OK",...}`

### Test 2: From OPNsense Console

```bash
# Should work from OPNsense to FreeBSD
curl http://192.168.50.2:3000/api/health
```

**Expected:** `{"status":"OK",...}`

### Test 3: HTTP Redirect (From Your Mac)

```bash
# Try HTTP (should redirect to HTTPS)
curl -I http://api.boldvpn.net/api/health
```

**Expected:** 
```
HTTP/1.1 301 Moved Permanently
Location: https://api.boldvpn.net/api/health
```

### Test 4: HTTPS (Main Test!)

```bash
# From your Mac, phone, or anywhere on internet
curl https://api.boldvpn.net/api/health
```

**Expected result:**
```json
{
  "status": "OK",
  "timestamp": "2025-11-06T...",
  "uptime": 123.45
}
```

**If this works:** ✅ **SUCCESS!** Your API is publicly accessible!

---

## 🔧 Configuration Summary

### What You Configured

| Component | Setting | Value |
|-----------|---------|-------|
| **Real Server** | Name | freebsd_api |
| | IP | 192.168.50.2 |
| | Port | 3000 |
| | SSL | No |
| **Backend Pool** | Name | api_backend_pool |
| | Mode | HTTP (Layer 7) |
| | Servers | freebsd_api |
| | Options | option forwardfor |
| **Frontend** | Name | api_frontend |
| | Listen | 0.0.0.0:443, 0.0.0.0:80 |
| | Type | HTTP/HTTPS (SSL Offloading) |
| | Backend | api_backend_pool |
| | SSL Enabled | Yes |
| | Certificate | api.boldvpn.net |
| | SSL Passthrough | No |
| | Options | HTTP redirect + X-Forwarded-Proto |
| **SSL Certificate** | Domain | api.boldvpn.net |
| | Provider | Let's Encrypt |
| | Auto Renew | Yes |

---

## 📖 Understanding the Configuration

### Why Two Listen Addresses?

```
Listen Address 1: 0.0.0.0:80  (HTTP)
Listen Address 2: 0.0.0.0:443 (HTTPS)
```

**Purpose:**
- Port 80: Receives HTTP requests
- Port 443: Receives HTTPS requests
- Both handled by the SAME frontend

### How HTTP → HTTPS Redirect Works

**The custom option line does this:**
```
http-request redirect scheme https code 301 if !{ ssl_fc }
```

**Translation:**
- `if !{ ssl_fc }` = If NOT using SSL (i.e., HTTP request on port 80)
- `redirect scheme https code 301` = Redirect to HTTPS with 301 status

**Flow:**
1. User visits: `http://api.boldvpn.net/api/health`
2. HAProxy receives on port 80 (no SSL)
3. Custom rule checks: "Not SSL? Redirect!"
4. HAProxy returns: `301 Redirect to https://api.boldvpn.net/api/health`
5. Browser follows redirect to HTTPS
6. HAProxy receives on port 443 (with SSL)
7. Proxies to FreeBSD:3000

**Alternative:** Don't add port 80 listener, only use 443
- Users must manually type `https://`
- HTTP won't work at all
- Simpler but less user-friendly

**Recommendation:** Use both ports with redirect (what we configured)

### SSL Offloading vs Passthrough

**SSL Offloading (what we're using):**
```
Internet (HTTPS) → OPNsense (decrypt) → FreeBSD (HTTP)
```
- HAProxy decrypts HTTPS
- Sees actual request content
- Can modify headers, redirect, etc.
- Forwards plain HTTP to backend
- ✅ **This is what you want!**

**SSL Passthrough (NOT using):**
```
Internet (HTTPS) → OPNsense (don't decrypt) → FreeBSD (HTTPS)
```
- HAProxy doesn't decrypt
- Just forwards encrypted traffic
- Can't see or modify content
- Backend needs SSL certificate
- ❌ **Don't use this!**

### Option pass-through Explained

**What is "Option pass-through"?**

This is a text field where you add **raw HAProxy configuration directives**.

Think of it as: "Advanced users can add custom HAProxy config here"

**Where it appears:**
- Frontend → Advanced settings → Option pass-through
- Backend Pool → Advanced settings → Option pass-through

**What we're adding:**

**Frontend options:**
```
http-request redirect scheme https code 301 if !{ ssl_fc }
http-request set-header X-Forwarded-Proto https
```
These are HAProxy directives that:
- Handle HTTP→HTTPS redirect
- Add protocol header

**Backend options:**
```
option forwardfor
```
This is a HAProxy directive that:
- Adds X-Forwarded-For header automatically

---

## 🎯 Simplified Configuration (Step-by-Step)

### Configuration Order (Important!)

**Configure in this order:**
1. Real Server (backend server definition)
2. Backend Pool (group of servers)
3. Frontend (public-facing service)
4. Enable HAProxy service

**After EACH step:** Save → Click "Apply Changes" at top!

---

### Step 1: Real Server

**Location:** Services → HAProxy → Settings → Real Servers

Click **"+"**:

| Field | Value |
|-------|-------|
| Name | `freebsd_api` |
| Description | `BoldVPN API on FreeBSD` |
| FQDN or IP | `192.168.50.2` |
| Port | `3000` |
| Mode | `active` |
| SSL | ❌ Unchecked |
| Verify SSL Certificate | ❌ Unchecked |

Click **Save** → **Apply Changes** (top of page)

---

### Step 2: Backend Pool

**Location:** Services → HAProxy → Settings → Virtual Services → Backend Pools

Click **"+"**:

**Basic Settings:**

| Field | Value |
|-------|-------|
| Name | `api_backend_pool` |
| Description | `BoldVPN API Backend Pool` |
| Mode | `HTTP (Layer 7)` |
| Servers | Select `freebsd_api` and add it |

**Health Checking:**

| Field | Value |
|-------|-------|
| Health Check | `HTTP` |
| Check Interval | `2000` |
| HTTP Check Method | `GET` |
| HTTP Check Path | `/api/health` |
| HTTP Check Expected Status | `200` |

**Advanced Settings:**

| Field | Value |
|-------|-------|
| Option pass-through | `option forwardfor` |

This adds X-Forwarded-For header for client IP logging.

Click **Save** → **Apply Changes** (top of page)

---

### Step 3: Frontend (Public Service)

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services

Click **"+"**:

**Basic Settings:**

| Field | Value |
|-------|-------|
| Enabled | ✓ Checked |
| Name | `api_frontend` |
| Description | `BoldVPN API Public Access` |

**Listen Addresses:**

Add **TWO** addresses (click "+" to add each):

1. `0.0.0.0:443` (HTTPS)
2. `0.0.0.0:80` (HTTP)

**Bind option pass-through:** Leave empty

**Type:**

| Field | Value |
|-------|-------|
| Type | `HTTP / HTTPS (SSL Offloading)` |

**Default Backend:**

| Field | Value |
|-------|-------|
| Default Backend Pool | `api_backend_pool` |

**Enable SSL offloading:**

| Field | Value |
|-------|-------|
| Enable SSL offloading | ✓ Checked |

**SSL Offloading Settings** (appears after enabling SSL):

| Field | Value |
|-------|-------|
| Certificates | Select `api.boldvpn.net` |
| SSL Passthrough | ❌ Unchecked (important!) |

**HTTP(S) settings:**

| Field | Value |
|-------|-------|
| Enable HTTP/2 | ✓ Checked (recommended) |
| HTTP/2 without TLS | ❌ Unchecked |
| Advertise Protocols (ALPN) | Select both: `HTTP/2` and `HTTP/1.1` |
| X-Forwarded-For (DEPRECATED) | ❌ Skip (we added it to backend) |

**Connection Mode:**
- Leave default

**Advanced settings → Option pass-through:**

Add these **TWO** lines (each on a separate line):

```
http-request redirect scheme https code 301 if !{ ssl_fc }
http-request set-header X-Forwarded-Proto https
```

**What these do:**
- **Line 1:** If request is HTTP (port 80), redirect to HTTPS
- **Line 2:** Add header telling API the original protocol was HTTPS

**Rules:**
- Leave empty

**Error Messages:**
- Leave empty

Click **Save** → **Apply Changes** (top of page)

---

### Step 4: Enable HAProxy Service

**Location:** Services → HAProxy → Settings → Service

| Field | Value |
|-------|-------|
| Enable HAProxy | ✓ Checked |

Click **Save** → **Apply Changes** (top of page)

**Wait 5-10 seconds for HAProxy to start.**

---

### Step 5: Verify Configuration

**Location:** Services → HAProxy → Diagnostics → Stats

**You should see:**

**Frontend: api_frontend**
- Status: **UP** (green)
- Sessions Current: 0

**Backend: api_backend_pool**
- Status: **UP** (green)
- Active Servers: 1

**Server: freebsd_api (192.168.50.2:3000)**
- Status: **UP** (green circle/checkmark)
- Last Check: Passed

**If server shows DOWN (red):**
1. Check API is running on FreeBSD: `sudo service boldvpn_api status`
2. Test from OPNsense console: `curl http://192.168.50.2:3000/api/health`
3. Check Real Server IP/port are correct
4. Check health check path is correct: `/api/health`

---

## 🧪 Complete Testing

### Test 1: Local API (FreeBSD)

```bash
# On FreeBSD server
curl http://localhost:3000/api/health
```

**Expected:** `{"status":"OK","timestamp":"...","uptime":...}`

### Test 2: From OPNsense to FreeBSD

```bash
# On OPNsense console/shell
curl http://192.168.50.2:3000/api/health
```

**Expected:** `{"status":"OK",...}`

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

### Test 4: HTTPS Request (Main Test!)

```bash
# From your Mac, phone, or anywhere
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

**If this works: ✅ SUCCESS!** Your API is publicly accessible with HTTPS!

---

## 🔧 Troubleshooting

### "Apply Changes" Button Not Showing

**Problem:** You clicked Save but no Apply button appears

**Solution:**
1. Go back to: Services → HAProxy → Settings
2. The orange notification should appear at top
3. Click "Apply Changes"
4. Or try: Services → HAProxy → Diagnostics → Stats (this sometimes triggers it)

### Backend Server Shows DOWN (Red)

**Problem:** HAProxy can't reach FreeBSD API

**Solutions:**
1. Check API is running:
   ```bash
   # On FreeBSD
   sudo service boldvpn_api status
   curl http://localhost:3000/api/health
   ```

2. Check from OPNsense:
   ```bash
   # From OPNsense console
   curl http://192.168.50.2:3000/api/health
   ```

3. Verify Real Server settings:
   - IP: `192.168.50.2` (correct?)
   - Port: `3000` (correct?)
   - SSL: Unchecked (must be unchecked!)

4. Check health check path: `/api/health` (with leading slash!)

### HTTP Works But HTTPS Doesn't

**Problem:** Port 80 works, but port 443 fails

**Solutions:**
1. Check SSL certificate was issued:
   - Services → ACME Client → Certificates
   - Status should be "OK"

2. Check Frontend SSL settings:
   - Enable SSL offloading: Checked
   - Certificate: api.boldvpn.net selected
   - SSL Passthrough: UNCHECKED

3. Check Frontend Type:
   - Must be: "HTTP / HTTPS (SSL Offloading)"

4. Check you clicked Apply after changing Frontend

### Connection Refused / Timeout

**Problem:** Can't reach api.boldvpn.net at all

**Solutions:**
1. Check DNS:
   ```bash
   ping api.boldvpn.net
   # Should show your public IP
   ```

2. Check HAProxy is listening:
   - Services → HAProxy → Diagnostics → Stats
   - Frontend should show UP

3. Check from OPNsense:
   ```bash
   # From OPNsense console
   curl http://localhost:443
   # Should get response from HAProxy
   ```

4. Check ISP doesn't block port 443

### 502 Bad Gateway

**Problem:** HAProxy is working but can't reach backend

**Solutions:**
- Backend server is DOWN (check Stats page)
- API not running on FreeBSD
- Wrong IP or port in Real Server config
- Network issue between OPNsense and FreeBSD

---

## 📊 Monitoring HAProxy

### Real-Time Statistics

**Location:** Services → HAProxy → Diagnostics → Stats

Shows:
- Request rate
- Active connections
- Backend server health
- Response times
- Errors

**Refresh to see live data**

### Logs

**Location:** System → Log Files → HAProxy

Shows:
- All requests
- Backend selections
- Errors
- SSL handshakes

---

## 🔄 HTTP to HTTPS Redirect - Clarification

**You have TWO ways to handle HTTP→HTTPS redirect:**

### Method 1: Using Frontend Custom Option (Recommended)

**What we configured:**
- Listen on BOTH ports: 80 and 443
- Add custom option: `http-request redirect scheme https code 301 if !{ ssl_fc }`

**How it works:**
- Single frontend handles both HTTP and HTTPS
- If request comes on port 80 (HTTP), redirect rule triggers
- If request comes on port 443 (HTTPS), redirect rule doesn't trigger
- Simple and efficient!

### Method 2: Separate HTTP Frontend (Alternative)

**Create TWO frontends:**

Frontend 1: api_http (port 80 only)
- Only for redirect
- Custom option: `redirect scheme https code 301`

Frontend 2: api_https (port 443 only)
- For actual API traffic
- SSL enabled

**When to use:**
- If you want clearer separation
- If single frontend method doesn't work

**For your setup:** Method 1 (single frontend) is simpler! ✓

---

## 🎯 Next Steps After HAProxy Setup

### 1. Update Customer Portal Config

Edit `portal/config.js` on your Mac:

```javascript
const Config = {
    API_URL: 'https://api.boldvpn.net/api',  // Update this!
    // ... rest stays the same
};
```

### 2. Commit and Push

```bash
cd /Users/msotoode/Documents/GitHub/boldvpn-site
git add portal/config.js
git commit -m "Update API URL to use HAProxy reverse proxy with HTTPS"
git push
```

GitHub Pages will auto-deploy in 1-2 minutes.

### 3. Test End-to-End

From any device:

1. Visit: `https://boldvpn.net/portal/`
2. You should see the login page
3. Login: `testuser` / `Test@123!`
4. Should see dashboard with usage data!

**If all works:** 🎉 **COMPLETE SUCCESS!**

Users can now access the portal from anywhere in the world!

---

## ✅ Final Checklist

- [ ] HAProxy plugin installed on OPNsense
- [ ] Acme account configured
- [ ] SSL certificate obtained for api.boldvpn.net (Status: OK)
- [ ] Real Server configured (192.168.50.2:3000, SSL: No)
- [ ] Backend Pool configured (HTTP mode, option forwardfor)
- [ ] Frontend configured (ports 80 & 443, SSL offloading enabled)
- [ ] Custom options added (HTTP redirect + X-Forwarded-Proto)
- [ ] HAProxy enabled and running
- [ ] Backend server status: UP (green)
- [ ] HTTP test: Redirects to HTTPS ✓
- [ ] HTTPS test: Returns JSON ✓
- [ ] Portal config.js updated with HTTPS URL
- [ ] End-to-end test: Portal login works ✓

---

## 🔒 Security Features

✅ **SSL/TLS Encryption** - All public traffic encrypted  
✅ **HTTP → HTTPS Redirect** - Forces secure connections  
✅ **SSL Offloading** - Reduces load on FreeBSD  
✅ **Health Checks** - Auto-detects API failures  
✅ **Auto SSL Renewal** - Certificate renews automatically  
✅ **Rate Limiting** - Built into API (100 req/15min)  
✅ **Client IP Logging** - Via X-Forwarded-For header  

---

## 📝 Quick Reference Card

**Configuration Summary:**

```
Real Server: freebsd_api
  ├─ IP: 192.168.50.2:3000
  └─ SSL: No

Backend Pool: api_backend_pool
  ├─ Mode: HTTP
  ├─ Server: freebsd_api
  └─ Options: option forwardfor

Frontend: api_frontend
  ├─ Listen: 0.0.0.0:80, 0.0.0.0:443
  ├─ Type: HTTP/HTTPS (SSL Offloading)
  ├─ Backend: api_backend_pool
  ├─ SSL: Yes, Certificate: api.boldvpn.net, Passthrough: No
  └─ Options:
      ├─ http-request redirect scheme https code 301 if !{ ssl_fc }
      └─ http-request set-header X-Forwarded-Proto https

Service: Enable HAProxy
```

**Test Command:**
```bash
curl https://api.boldvpn.net/api/health
```

**Expected:** `{"status":"OK",...}`

---

**That's it!** HAProxy provides enterprise-grade reverse proxy and SSL termination for your API! 🚀
