# OPNsense HAProxy Setup Guide

Complete guide for setting up HAProxy reverse proxy on OPNsense to make the BoldVPN API publicly accessible with HTTPS.

## 🎯 What This Does

**Architecture:**
```
Internet (Public) → OPNsense:443 (HAProxy with SSL)
                  → FreeBSD:3000 (API, plain HTTP)
```

**Result:**
- Users access: `https://api.boldvpn.net`
- OPNsense handles SSL encryption
- Proxies to FreeBSD API on port 3000
- No SSL needed on FreeBSD!

## 📋 Prerequisites

- [x] FreeBSD API running on port 3000 (`sudo service boldvpn_api status`)
- [x] DNS: `api.boldvpn.net` → Your public IP (OPNsense WAN)
- [x] OPNsense with internet access
- [x] Port 80 accessible from internet (for SSL certificate verification)

## ⚠️ Important Notes

- **No port forwarding needed!** HAProxy receives traffic, doesn't forward it
- **No firewall rules needed!** OPNsense LAN → FreeBSD LAN is allowed by default
- **FreeBSD needs NO SSL!** HAProxy handles all SSL/HTTPS
- **Click "Apply" after each major change** in HAProxy settings (orange button at top)

---

## 🚀 Step-by-Step Setup

### Step 1: Install HAProxy Plugin

**Location:** System → Firmware → Plugins

1. Search for: `haproxy`
2. Find: `os-haproxy`
3. Click: **Install**
4. Wait for installation to complete
5. Refresh page

**Verify:** You should now see "Services → HAProxy" in the menu

---

### Step 2: Configure Acme Client for SSL Certificate

#### 2.1: Check/Create Acme Account

**Location:** Services → ACME Client → Accounts

If you already have a Let's Encrypt account, skip to 2.2.

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
- Click **Issue/Renew** (button next to the certificate)
- Wait 30-60 seconds

**Verify:** Status should show "OK" and expiration date

---

### Step 3: Configure HAProxy Backend (FreeBSD API Server)

**Location:** Services → HAProxy → Settings → Real Servers

Click **"+"** to add new server:

- **Name:** `freebsd_api`
- **Description:** `BoldVPN API on FreeBSD`
- **FQDN or IP:** `192.168.50.2`
- **Port:** `3000`
- **Mode:** `active`
- **SSL:** ❌ (unchecked - FreeBSD uses HTTP)
- **Verify SSL Certificate:** ❌ (unchecked)

Click **Save**

---

### Step 4: Configure HAProxy Backend Pool

**Location:** Services → HAProxy → Settings → Virtual Services → Backend Pools

Click **"+"** to add new pool:

- **Name:** `api_backend_pool`
- **Description:** `BoldVPN API Backend Pool`
- **Mode:** `HTTP (Layer 7)`
- **Servers:** Select `freebsd_api` (from dropdown)
- **Health Checking:** 
  - **Health Check:** `HTTP`
  - **Check Interval:** `2000` (ms)
  - **HTTP Check Method:** `GET`
  - **HTTP Check Path:** `/api/health`
  - **HTTP Check Expected Status:** `200`

Click **Save**

---

### Step 5: Configure HAProxy Frontend (Public Service)

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services

Click **"+"** to add new service:

**Basic Settings:**
- **Name:** `api_frontend`
- **Description:** `BoldVPN API Public Frontend`
- **Status:** `active`

**Listen Addresses:**
- Click **"+"** to add:
  - **Listen Address:** `0.0.0.0:443` (or select WAN interface)
  - **SSL Offloading:** ✓ (checked)

**Default Backend:**
- **Default Backend Pool:** `api_backend_pool`

**SSL Offloading:**
- **Certificates:** Select `api.boldvpn.net` (from Acme dropdown)

**Type:**
- **Type:** `HTTP / HTTPS (SSL Offloading)`

**Advanced Settings (Optional):**
- **Custom Options:**
  ```
  http-request set-header X-Forwarded-Proto https
  http-request set-header X-Forwarded-For %[src]
  ```

Click **Save**

---

### Step 6: Add HTTP to HTTPS Redirect (Optional)

For redirecting HTTP → HTTPS, add another frontend:

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services

Click **"+"**:

- **Name:** `api_http_redirect`
- **Description:** `Redirect HTTP to HTTPS`
- **Status:** `active`
- **Listen Addresses:** `0.0.0.0:80`
- **Type:** `HTTP (Layer 7)`
- **Custom Options:**
  ```
  redirect scheme https code 301
  ```

Click **Save**

---

### Step 7: Enable and Start HAProxy

**Location:** Services → HAProxy → Settings → Service

- **Enable HAProxy:** ✓ (checked)
- Click **Save**

**IMPORTANT:** After saving, you must click **Apply Changes**!

Look for the orange "Apply" button or notification at the top of the page.

**Common issue:** If you don't see Apply button:
1. Go back to: Services → HAProxy → Settings
2. The Apply notification should appear at the top
3. Click **Apply** to activate the configuration

**Verify HAProxy started:**
- Services → HAProxy → Diagnostics → Stats (should show data)
- Or check: Services → HAProxy → Settings → Service (should show running)

---

### Step 8: Verify HAProxy is Running

**Location:** Services → HAProxy → Diagnostics → Stats

You should see:
- Frontend: `api_frontend` - Status: UP
- Backend: `api_backend_pool` - Status: UP
- Server: `freebsd_api` - Status: UP (green)

If server shows UP (green), HAProxy can reach your API! ✓

---

## 🧪 Testing

### Test 1: From FreeBSD Server

```bash
# API should still work locally
curl http://localhost:3000/api/health
```

### Test 2: From OPNsense

```bash
# Should work from OPNsense
curl http://192.168.50.2:3000/api/health
```

### Test 3: From Internet (HTTP - if you added redirect frontend)

```bash
# From your Mac
curl http://api.boldvpn.net/api/health

# Should redirect to HTTPS or return error (depending on config)
```

### Test 4: From Internet (HTTPS - Main Test!)

```bash
# From your Mac or phone
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

**If this works:** ✅ Your API is publicly accessible with HTTPS!

---

## 🔧 Troubleshooting

### SSL Certificate Not Working

**Check certificate status:**
- Services → ACME Client → Certificates
- Status should be "OK"
- Expiration date should be shown

**If certificate failed:**
1. Check DNS: `api.boldvpn.net` points to OPNsense WAN IP
2. Port 80 must be accessible from internet (for HTTP-01 challenge)
3. Check Acme logs: Services → ACME Client → Log File

### HAProxy Backend Shows Down (Red)

**Check:**
1. FreeBSD API is running: `sudo service boldvpn_api status`
2. API responds: `curl http://192.168.50.2:3000/api/health`
3. Firewall allows OPNsense → FreeBSD (should be allowed by default)
4. Health check path is correct: `/api/health`

### Connection Refused from Internet

**Check:**
1. DNS resolves: `ping api.boldvpn.net` (should show your public IP)
2. HAProxy is running: Services → HAProxy → Diagnostics → Stats
3. Listen address includes WAN: `0.0.0.0:443` or WAN IP
4. ISP doesn't block port 443

### 502 Bad Gateway

**Means:** HAProxy is working, but can't reach FreeBSD API

**Check:**
1. API is running on FreeBSD
2. Correct backend IP: `192.168.50.2`
3. Correct backend port: `3000`
4. Backend pool has the server selected

---

## 📊 HAProxy Statistics

**View real-time stats:**

Services → HAProxy → Diagnostics → Stats

You'll see:
- Request rate
- Active connections
- Backend server status
- Response times

Useful for monitoring!

---

## 🔄 SSL Certificate Auto-Renewal

**Already configured!** Acme client auto-renews:
- Checks daily
- Renews 30 days before expiration
- Updates HAProxy automatically

**Verify auto-renewal works:**
- Services → ACME Client → Certificates
- Check "Auto Renewal" is enabled
- Check "Last Renewal" date

---

## ⚙️ Advanced Configuration (Optional)

### Enable Compression

**Location:** Services → HAProxy → Settings → Virtual Services → Public Services → `api_frontend`

Add to Custom Options:
```
compression algo gzip
compression type application/json text/plain text/css text/javascript
```

### Add Rate Limiting

Add to Custom Options:
```
stick-table type ip size 100k expire 30s store http_req_rate(10s)
http-request track-sc0 src
http-request deny if { sc_http_req_rate(0) gt 100 }
```

This limits to 100 requests per 10 seconds per IP.

### Add Access Logs

**Location:** Services → HAProxy → Settings → Global Parameters

- **Enable:** ✓
- **Log Level:** `info`
- **Syslog:** Select appropriate facility

View logs: System → Log Files → HAProxy

---

## 📝 Configuration Summary

**What you configured:**

| Component | Setting | Value |
|-----------|---------|-------|
| **Real Server** | IP | 192.168.50.2 |
| | Port | 3000 |
| | SSL | No |
| **Backend Pool** | Name | api_backend_pool |
| | Mode | HTTP |
| | Health Check | /api/health |
| **Frontend** | Name | api_frontend |
| | Listen | 0.0.0.0:443 |
| | SSL | Yes |
| | Certificate | api.boldvpn.net |
| | Backend | api_backend_pool |
| **SSL** | Domain | api.boldvpn.net |
| | Provider | Let's Encrypt |
| | Auto Renew | Yes |

---

## 🎯 Next Steps After HAProxy Setup

### 1. Update Customer Portal

Edit `portal/config.js` on your Mac:

```javascript
const Config = {
    API_URL: 'https://api.boldvpn.net/api',  // Update this!
    // ... rest of config
};
```

Commit and push:
```bash
cd /Users/msotoode/Documents/GitHub/boldvpn-site
git add portal/config.js
git commit -m "Update API URL to use HAProxy reverse proxy"
git push
```

### 2. Update API CORS Settings

Edit `.env` on FreeBSD to allow portal domain:

```bash
sudo nano /usr/local/boldvpn-site/api/.env
```

Ensure this line exists:
```
CORS_ORIGIN=https://boldvpn.net,https://www.boldvpn.net
```

Restart API:
```bash
sudo service boldvpn_api restart
```

### 3. Test End-to-End

From any device:

1. Visit: `https://boldvpn.net/portal/`
2. Login: `testuser` / `Test@123!`
3. Should see dashboard! ✅

---

## 📖 Quick Reference

**Access API:**
```bash
# Test from anywhere
curl https://api.boldvpn.net/api/health
```

**View HAProxy stats:**
- Services → HAProxy → Diagnostics → Stats

**Check SSL certificate:**
- Services → ACME Client → Certificates

**Restart HAProxy:**
- Services → HAProxy → Settings → Service → Apply

**View logs:**
- System → Log Files → HAProxy

---

## 🔒 Security Features

✅ **SSL/TLS Encryption** - All traffic encrypted  
✅ **Rate Limiting** - Prevent abuse (optional)  
✅ **Health Checks** - Auto-detects API failures  
✅ **SSL Offloading** - OPNsense handles encryption overhead  
✅ **Auto-Renewal** - Certificates auto-renew  

---

## ✅ Checklist

- [ ] HAProxy plugin installed
- [ ] Acme account configured
- [ ] SSL certificate obtained for api.boldvpn.net
- [ ] Real server configured (192.168.50.2:3000)
- [ ] Backend pool configured
- [ ] Frontend configured (port 443)
- [ ] HAProxy enabled and running
- [ ] Backend status shows UP (green)
- [ ] HTTPS test passes from internet
- [ ] Portal config.js updated
- [ ] End-to-end test passes

---

**That's it!** HAProxy on OPNsense provides enterprise-grade reverse proxy and SSL termination for your API! 🚀

