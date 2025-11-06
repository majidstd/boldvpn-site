# OPNsense Configuration for FreeRADIUS

After FreeBSD RADIUS server is set up, configure OPNsense to use it.

## 📋 Information You Need

From the FreeBSD setup script output, you should have:

```
FreeBSD Server IP: [e.g., 192.168.1.100]
RADIUS Secret: [The secret you created during setup]
RADIUS Auth Port: 1812
RADIUS Acct Port: 1813
```

## ⚙️ OPNsense Configuration Steps

### Step 1: Configure Captive Portal Authentication

**Services → Captive Portal → Administration → [Your Zone]**

Click **Edit** on your BoldVPN zone

---

#### **Authentication Settings:**

```
Authentication Method: RADIUS

Primary RADIUS Server:
  Server: [FreeBSD IP address]
  Port: 1812
  Shared Secret: [Your RADIUS secret]
  
Backup RADIUS Server: (Optional)
  Leave empty for now
  
Authentication Timeout: 5 (seconds)
```

---

#### **Accounting Settings:**

```
Enable Accounting: ✅ Yes

Accounting Server:
  Server: [FreeBSD IP address]
  Port: 1813
  Shared Secret: [Same RADIUS secret]
  
Accounting Update: ✅ Enable Interim Updates
Update Interval: 600 (10 minutes)
```

---

#### **Other Settings:**

```
Template: captiveportal-v1.0G

Enable HTTPS: ✅ Yes
Certificate: login.boldvpn.net
HTTPS Port: 8001 (or 443)

Allowed Hostnames:
  login.boldvpn.net
  ipapi.co
  cdnjs.cloudflare.com
  cdn.jsdelivr.net
  fonts.googleapis.com
  fonts.gstatic.com
```

**Click Save**

---

### Step 2: Verify RADIUS Connection

**Services → Captive Portal → Administration**

Look for status indicator:
- ✅ Green = RADIUS server reachable
- ❌ Red = Can't connect to RADIUS

**If red, check:**
1. FreeBSD server is running
2. FreeRADIUS service is started
3. Firewall allows traffic from OPNsense IP
4. RADIUS secret matches on both sides

---

### Step 3: Enable the Zone

**Services → Captive Portal → Administration**

Toggle the **BoldVPN zone** to **enabled** (green)

---

## 🧪 Testing

### Test 1: RADIUS Authentication from OPNsense

**Diagnostics → Command Prompt**

```bash
echo "User-Name = testuser, User-Password = Test@123!" | \
  radclient [freebsd-ip]:1812 auth [your-secret]
```

**Expected:**
```
Received Access-Accept
```

---

### Test 2: Captive Portal Login

**From VPN client (WireGuard):**

1. Connect to WireGuard (not authenticated)
2. Open browser → Should redirect to captive portal
3. See your v1.0G template (3D globe, BoldVPN logo)
4. Login with: `testuser` / `Test@123!`
5. Should authenticate via RADIUS ✅
6. Get internet access

---

### Test 3: Verify Accounting

**On FreeBSD server:**

```bash
su - postgres
psql -U radiususer -d radius

-- Check for active session
SELECT 
    username,
    framedipaddress,
    acctstarttime,
    acctinputoctets,
    acctoutputoctets
FROM radacct 
WHERE acctstoptime IS NULL
ORDER BY acctstarttime DESC;

\q
```

**Should see:**
- Username: testuser
- IP address from VPN range
- Start time
- Data usage (bytes)

---

## 📊 View Accounting Data

### Active Sessions

```sql
SELECT 
    username,
    framedipaddress as client_ip,
    acctstarttime as connected_at,
    ROUND(acctinputoctets / 1048576.0, 2) as download_mb,
    ROUND(acctoutputoctets / 1048576.0, 2) as upload_mb
FROM radacct 
WHERE acctstoptime IS NULL
ORDER BY acctstarttime DESC;
```

### User's Monthly Usage

```sql
SELECT 
    username,
    COUNT(*) as sessions,
    ROUND(SUM(acctinputoctets + acctoutputoctets) / 1073741824.0, 2) as total_gb,
    ROUND(SUM(acctsessiontime) / 3600.0, 1) as total_hours
FROM radacct
WHERE acctstarttime >= DATE_TRUNC('month', NOW())
GROUP BY username
ORDER BY total_gb DESC;
```

### Top Bandwidth Users

```sql
SELECT 
    username,
    ROUND(SUM(acctinputoctets + acctoutputoctets) / 1073741824.0, 2) as total_gb
FROM radacct
WHERE acctstarttime >= NOW() - INTERVAL '7 days'
GROUP BY username
ORDER BY total_gb DESC
LIMIT 10;
```

---

## 🔧 Troubleshooting

### Issue: "Access-Reject" when testing

**Check:**
1. User exists in radcheck table
2. Password matches exactly (case-sensitive)
3. FreeRADIUS logs: `/var/log/radius/radius.log`

```bash
tail -f /var/log/radius/radius.log
# Try to auth, watch for errors
```

### Issue: Accounting not working

**Check:**
1. Accounting port 1813 open on firewall
2. OPNsense has accounting enabled
3. Interim updates enabled
4. Check radacct table for new entries

### Issue: Quota not enforced

**Check:**
1. Max-Monthly-Traffic attribute set in radreply or radgroupreply
2. FreeRADIUS calculating usage correctly
3. OPNsense sending interim updates

---

## 🎯 Success Criteria

After configuration, you should have:

✅ RADIUS authentication working from OPNsense  
✅ Captive portal v1.0G showing (3D globe)  
✅ Test user can authenticate  
✅ Accounting data appearing in radacct table  
✅ Usage tracked in real-time (interim updates)  
✅ Quotas enforced (disconnect at limit)  

---

**All set for production VPN service with full AAA!** 🏆


