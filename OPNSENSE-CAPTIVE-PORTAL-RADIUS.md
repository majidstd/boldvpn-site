# OPNsense Captive Portal with RADIUS Authentication

Complete guide for configuring OPNsense Captive Portal to use BoldVPN RADIUS server for VPN authentication.

## 📑 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step-by-Step Configuration](#step-by-step-configuration)
  - [Step 1: Add RADIUS Authentication Server](#step-1-add-radius-authentication-server)
  - [Step 2: Configure Captive Portal Zone](#step-2-configure-captive-portal-zone)
  - [Step 3: Configure Zone Settings](#step-3-configure-zone-settings)
  - [Step 4: Apply Changes](#step-4-apply-changes)
- [Testing](#testing)
  - [Test VPN Connection](#test-vpn-connection)
  - [Verify RADIUS Logs](#verify-radius-logs)
  - [Check Accounting Data](#check-accounting-data)
- [Troubleshooting](#troubleshooting)
  - [Can't Select RADIUS Server](#cant-select-radius-server)
  - [Authentication Fails](#authentication-fails)
  - [Accounting Not Working](#accounting-not-working)
  - [Bandwidth Limits Not Enforced](#bandwidth-limits-not-enforced)
- [Advanced Configuration](#advanced-configuration)
- [Monitoring](#monitoring)

---

## Overview

This guide configures OPNsense Captive Portal to authenticate VPN users against your FreeBSD RADIUS server.

**What this does:**
```
VPN Client → OPNsense Captive Portal → RADIUS Server (192.168.50.2) → PostgreSQL Database
```

**Result:**
- ✅ Users authenticate with RADIUS credentials
- ✅ Bandwidth limits enforced (WISPr attributes)
- ✅ Device limits enforced (Simultaneous-Use)
- ✅ Session accounting tracked in database
- ✅ Usage visible in customer portal

---

## Prerequisites

- ✅ OPNsense firewall configured
- ✅ FreeBSD RADIUS server running (192.168.50.2)
- ✅ RADIUS server tested and working
- ✅ Test user created (testuser / Test@123!)
- ✅ Network connectivity between OPNsense and FreeBSD

**Verify RADIUS is working:**
```bash
# On FreeBSD
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x localhost:1812 auth testing123
# Expected: Received Access-Accept
```

---

## Step-by-Step Configuration

### Step 1: Add RADIUS Authentication Server

**Location:** System → Access → Servers

**Click:** [+] Add

**Configure:**

| Field | Value |
|-------|-------|
| **Descriptive name** | `BoldVPN RADIUS` |
| **Type** | `RADIUS` |
| **Hostname or IP** | `192.168.50.2` |
| **Authentication port** | `1812` |
| **Accounting port** | `1813` |
| **Shared Secret** | `RadiusSecret@#` (use your secret from RADIUS setup) |
| **Services offered** | `Authentication and Accounting` |
| **Authentication timeout** | `5` (seconds) |

**Click:** Save

**Verify:** You should see "BoldVPN RADIUS" in the servers list

---

### Step 2: Configure Captive Portal Zone

**Location:** Services → Captive Portal → Zones

**Select your zone** (or click [+] Add to create new one)

#### Authentication Tab

| Field | Value |
|-------|-------|
| **Authentication backend** | `BoldVPN RADIUS` (select from dropdown) |
| **Authentication method** | `RADIUS` |
| **Enable accounting** | ✅ Checked |
| **Reauthenticate connected users** | ✅ Checked (optional - forces re-login periodically) |

#### Session Tab

| Field | Value |
|-------|-------|
| **Idle timeout** | `0` (no timeout) or set your preference (minutes) |
| **Hard timeout** | `0` (no timeout) or set your preference (minutes) |
| **Session timeout** | `0` (no timeout) or set your preference (minutes) |

**💡 Timeout recommendations:**
- **No timeouts (0):** Users stay connected until they disconnect
- **Idle timeout (30 min):** Disconnect if no traffic for 30 minutes
- **Hard timeout (24 hours):** Force re-authentication every 24 hours

---

### Step 3: Configure Zone Settings

#### Basic Settings

| Field | Value |
|-------|-------|
| **Enable** | ✅ Checked |
| **Zone name** | `boldvpn` (or your preference) |
| **Interfaces** | Select your VPN interface (WireGuard, OpenVPN, etc.) |
| **Description** | `BoldVPN Captive Portal with RADIUS` |

#### Allowed Addresses

**Usually leave empty for VPN**

Add addresses only if you want to bypass captive portal for specific IPs/networks.

#### Transparent Proxy

**Disabled** (for VPN use case)

---

### Step 4: Apply Changes

**Click:** Save

**Click:** Apply Changes (orange button at top)

**Wait:** 5-10 seconds for changes to apply

**Verify:** 
- Services → Captive Portal → Zones
- Your zone should show as "Enabled"

---

## Testing

### Test VPN Connection

**Step 1: Connect VPN client**
- Connect your WireGuard/OpenVPN client
- You should see captive portal login page

**Step 2: Login**
- Username: `testuser`
- Password: `Test@123!`
- Click Login

**Step 3: Verify access**
- Should get "Authentication successful" or similar
- Internet access should be granted
- Try browsing: `curl https://google.com`

**Expected result:** ✅ Access granted, internet works!

---

### Verify RADIUS Logs

**On FreeBSD, watch RADIUS logs in real-time:**

```bash
sudo tail -f /var/log/radius.log
```

**When user connects, you should see:**

```
Received Access-Request from 192.168.50.1:xxxxx
  User-Name = "testuser"
  User-Password = "Test@123!"

Sending Access-Accept
  WISPr-Bandwidth-Max-Down = 102400
  WISPr-Bandwidth-Max-Up = 102400

Received Accounting-Request (Start)
  User-Name = "testuser"
  Acct-Session-Id = "..."
```

**This confirms:**
- ✅ OPNsense is sending requests to RADIUS
- ✅ RADIUS is authenticating users
- ✅ Bandwidth limits are being sent
- ✅ Accounting is working

---

### Check Accounting Data

**On FreeBSD, query the radacct table:**

```bash
sudo -u postgres psql radius -c "SELECT username, acctstarttime, acctinputoctets, acctoutputoctets, acctsessiontime FROM radacct WHERE username = 'testuser' ORDER BY acctstarttime DESC LIMIT 5;"
```

**Expected output:**
```
 username |      acctstarttime      | acctinputoctets | acctoutputoctets | acctsessiontime 
----------+-------------------------+-----------------+------------------+-----------------
 testuser | 2025-11-07 10:30:15     | 1048576         | 2097152          | 3600
```

**This shows:**
- Start time of session
- Upload bytes (acctinputoctets)
- Download bytes (acctoutputoctets)
- Session duration in seconds

**This data is used by:**
- Customer portal (to show usage)
- Quota enforcement (to track limits)
- Billing (for usage-based pricing)

---

## Troubleshooting

### Can't Select RADIUS Server

**Symptom:** RADIUS server doesn't appear in Captive Portal dropdown

**Solution:**

1. **Verify server was saved:**
   ```
   System → Access → Servers
   ```
   Should see "BoldVPN RADIUS" in list

2. **If not there, add it again** (see Step 1)

3. **Refresh browser** (Ctrl+F5)

4. **Check OPNsense logs:**
   ```
   System → Log Files → General
   ```
   Look for RADIUS-related errors

---

### Authentication Fails

**Symptom:** User enters correct credentials but gets "Authentication failed"

**Diagnosis:**

**1. Test RADIUS from OPNsense CLI:**

```bash
# On OPNsense (Diagnostics → Command Prompt)
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x 192.168.50.2:1812 auth RadiusSecret@#
```

**Expected:** `Received Access-Accept`

**If fails:**
- Check RADIUS is running on FreeBSD: `sudo service radiusd status`
- **Check FreeBSD firewall (MOST COMMON!)** - see below
- Check firewall between OPNsense and FreeBSD
- Verify shared secret matches

**2. Check RADIUS logs on FreeBSD:**

```bash
sudo tail -50 /var/log/radius.log
```

**Look for:**
- Access-Request from OPNsense IP (192.168.50.1)
- Access-Reject (if authentication failed)
- Reason for rejection

**3. Test RADIUS in debug mode:**

```bash
# On FreeBSD
sudo service radiusd stop
sudo radiusd -X

# In another terminal or from OPNsense, test login
# Watch debug output for errors
```

**Common issues:**
- User doesn't exist in database
- Wrong password in database
- SQL module not finding user
- queries.conf has wrong variable (SQL-User-Name vs User-Name)
- **FreeBSD firewall blocking RADIUS traffic** (see below)

**Fix:** See [FREEBSD-DEPLOYMENT.md#radius-returns-access-reject](FREEBSD-DEPLOYMENT.md#radius-returns-access-reject)

---

### FreeBSD Firewall Blocking RADIUS (VERY COMMON!)

**Symptom:** 
- `radclient` from OPNsense times out (no reply)
- `radclient` from FreeBSD localhost works fine
- `tcpdump` on FreeBSD shows packets arriving
- RADIUS logs show NO requests

**Diagnosis:**

**1. Test localhost vs LAN IP on FreeBSD:**

```bash
# Test localhost (should work)
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x 127.0.0.1:1812 auth testing123

# Test LAN IP (might fail if firewall blocking)
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x 192.168.50.2:1812 auth RadiusSecret@#
```

**If localhost works but LAN IP fails:** FreeBSD firewall is blocking!

**2. Check if RADIUS is listening on all interfaces:**

```bash
sockstat -l | grep radiusd
```

**Expected:** `radiusd ... udp4 *:1812` (asterisk means all interfaces)

**If shows `127.0.0.1:1812`:** RADIUS only listening on localhost (config issue)

**Fix:**

**Option 1: Disable firewall temporarily (for testing):**

```bash
sudo sysrc firewall_enable="NO"
sudo service ipfw stop

# Test again
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x 192.168.50.2:1812 auth RadiusSecret@#
```

**If it works now:** Firewall was the problem!

**Option 2: Configure firewall properly:**

```bash
cd /usr/local/boldvpn-site
git pull
cd scripts
sudo ./setup-firewall.sh

# Enter OPNsense IP: 192.168.50.1
# Confirm: yes
```

This will add proper rules for RADIUS, API, and SSH.

**Option 3: Manual firewall rules:**

```bash
# Allow RADIUS from OPNsense
sudo ipfw add 500 allow udp from 192.168.50.1 to me 1812 in keep-state
sudo ipfw add 510 allow udp from 192.168.50.1 to me 1813 in keep-state
sudo ipfw add 520 allow udp from me 1812 to 192.168.50.1 out keep-state
sudo ipfw add 530 allow udp from me 1813 to 192.168.50.1 out keep-state
```

---

### Accounting Not Working

**Symptom:** User can login but no data in radacct table

**Check:**

**1. Accounting enabled in Captive Portal:**
```
Services → Captive Portal → Zones → [Your Zone]
Authentication tab → Enable accounting: ✅ Checked
```

**2. Accounting port configured in RADIUS server:**
```
System → Access → Servers → BoldVPN RADIUS
Accounting port: 1813
```

**3. RADIUS receiving accounting packets:**

```bash
# On FreeBSD, watch logs
sudo tail -f /var/log/radius.log

# Should see when user connects:
Received Accounting-Request (Start)
Received Accounting-Request (Interim-Update)
Received Accounting-Request (Stop)
```

**4. Check radacct table:**

```bash
sudo -u postgres psql radius -c "SELECT * FROM radacct ORDER BY acctstarttime DESC LIMIT 5;"
```

**If empty:**
- RADIUS not receiving accounting packets
- Check OPNsense accounting is enabled
- Check firewall allows port 1813

---

### Bandwidth Limits Not Enforced

**Symptom:** User can exceed bandwidth limits set in radreply

**Check:**

**1. Attributes are in database:**

```bash
sudo -u postgres psql radius -c "SELECT attribute, value FROM radreply WHERE username = 'testuser';"
```

**Should show:**
```
         attribute         |  value  
--------------------------+---------
 WISPr-Bandwidth-Max-Down | 102400
 WISPr-Bandwidth-Max-Up   | 102400
```

**2. RADIUS is sending attributes:**

```bash
# On FreeBSD, run in debug mode
sudo service radiusd stop
sudo radiusd -X

# Test login from VPN
# Watch for Access-Accept message
# Should include WISPr-Bandwidth-Max-Down and WISPr-Bandwidth-Max-Up
```

**3. OPNsense is receiving attributes:**

Check OPNsense Captive Portal logs:
```
Status → System Logs → Captive Portal
```

Look for bandwidth attributes in authentication logs

**4. OPNsense traffic shaper configured:**

OPNsense needs traffic shaper to enforce bandwidth limits!

```
Firewall → Shaper → Pipes
```

Configure pipes for bandwidth limiting based on RADIUS attributes

**Note:** Bandwidth enforcement requires additional OPNsense configuration beyond just RADIUS!

---

## Advanced Configuration

### Custom Captive Portal Template

**Upload your custom template:**

```
Services → Captive Portal → Templates → [+] Add
```

**Upload files from:** `captiveportal/` directory

**Features:**
- Custom branding
- Dark/light theme
- Responsive design

**Documentation:** See `captiveportal/README.md` (if exists)

---

### Multiple RADIUS Servers (Failover)

**Add backup RADIUS server:**

```
System → Access → Servers → [+] Add

Name: BoldVPN RADIUS Backup
Type: RADIUS
Hostname: 192.168.50.3 (backup server)
...
```

**In Captive Portal:**
- Primary: BoldVPN RADIUS
- Fallback: BoldVPN RADIUS Backup

OPNsense will try backup if primary fails!

---

### RADIUS Attributes Supported

**Standard attributes OPNsense understands:**

| Attribute | Purpose | Example Value |
|-----------|---------|---------------|
| `WISPr-Bandwidth-Max-Down` | Download speed limit | `102400` (100 Mbps) |
| `WISPr-Bandwidth-Max-Up` | Upload speed limit | `102400` (100 Mbps) |
| `Simultaneous-Use` | Max concurrent sessions | `3` (3 devices) |
| `Session-Timeout` | Max session duration | `86400` (24 hours) |
| `Idle-Timeout` | Idle timeout | `1800` (30 minutes) |

**Set in database:**
```sql
INSERT INTO radreply (username, attribute, op, value) 
VALUES 
  ('testuser', 'WISPr-Bandwidth-Max-Down', ':=', '102400'),
  ('testuser', 'WISPr-Bandwidth-Max-Up', ':=', '102400'),
  ('testuser', 'Simultaneous-Use', ':=', '3');
```

---

## Monitoring

### Active Sessions

**On OPNsense:**
```
Services → Captive Portal → Sessions
```

Shows currently connected users

---

### RADIUS Statistics

**On FreeBSD:**

```bash
# Active sessions
sudo -u postgres psql radius -c "SELECT COUNT(*) FROM radacct WHERE acctstoptime IS NULL;"

# Total sessions today
sudo -u postgres psql radius -c "SELECT COUNT(*) FROM radacct WHERE acctstarttime > CURRENT_DATE;"

# Bandwidth usage today
sudo -u postgres psql radius -c "SELECT username, SUM(acctinputoctets) as upload, SUM(acctoutputoctets) as download FROM radacct WHERE acctstarttime > CURRENT_DATE GROUP BY username;"
```

---

### Real-time Monitoring

**Watch RADIUS logs:**
```bash
sudo tail -f /var/log/radius.log
```

**Watch accounting updates:**
```bash
watch -n 5 'sudo -u postgres psql radius -t -c "SELECT username, acctinputoctets, acctoutputoctets FROM radacct WHERE acctstoptime IS NULL;"'
```

---

## Troubleshooting

### Can't Select RADIUS Server

**Check server is saved:**
```
System → Access → Servers
```

**Should see:** "BoldVPN RADIUS" in list

**If not there:**
1. Add server again (Step 1)
2. Make sure you clicked Save
3. Refresh browser

---

### Authentication Fails

**Test RADIUS from OPNsense:**

```bash
# Diagnostics → Command Prompt
echo "User-Name=testuser,User-Password=Test@123!" | \
  radclient -x 192.168.50.2:1812 auth RadiusSecret@#
```

**Expected:** `Received Access-Accept`

**If Access-Reject:**

1. **Check user exists in database:**
   ```bash
   # On FreeBSD
   sudo -u postgres psql radius -c "SELECT * FROM radcheck WHERE username = 'testuser';"
   ```

2. **Check RADIUS logs:**
   ```bash
   sudo tail -50 /var/log/radius.log
   ```

3. **Run RADIUS in debug mode:**
   ```bash
   sudo service radiusd stop
   sudo radiusd -X
   # Test login, watch output
   ```

**Common fixes:**
- User doesn't exist: Create in database
- Wrong password: Update in radcheck table
- SQL module issue: Check queries.conf
- See: [FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md) for complete RADIUS troubleshooting

---

### Accounting Not Working

**Check accounting is enabled:**

```
Services → Captive Portal → Zones → [Your Zone]
Authentication tab → Enable accounting: ✅
```

**Check RADIUS logs:**

```bash
sudo tail -f /var/log/radius.log
```

**Should see:**
```
Received Accounting-Request (Start)
Received Accounting-Request (Interim-Update)
Received Accounting-Request (Stop)
```

**If not seeing accounting packets:**

1. **Verify accounting port:**
   ```
   System → Access → Servers → BoldVPN RADIUS
   Accounting port: 1813
   ```

2. **Check firewall:**
   - OPNsense can reach FreeBSD on port 1813 (UDP)

3. **Test accounting manually:**
   ```bash
   # From OPNsense
   echo "User-Name=testuser,Acct-Status-Type=Start" | \
     radclient -x 192.168.50.2:1813 acct RadiusSecret@#
   ```

---

### Bandwidth Limits Not Enforced

**Symptom:** User exceeds bandwidth limits

**Check attributes are sent:**

```bash
# On FreeBSD, debug mode
sudo service radiusd stop
sudo radiusd -X

# Test login from VPN
# Look for Access-Accept message
# Should include:
#   WISPr-Bandwidth-Max-Down = 102400
#   WISPr-Bandwidth-Max-Up = 102400
```

**If attributes are sent but not enforced:**

OPNsense Captive Portal **does NOT automatically enforce bandwidth limits!**

**You need:**
1. **Traffic Shaper configured** (Firewall → Shaper)
2. **Or use pfSense/OPNsense plugins** for bandwidth management
3. **Or external bandwidth management** (on router/switch)

**RADIUS provides the limits, but enforcement requires additional configuration!**

**Alternative:** Use WireGuard/OpenVPN built-in bandwidth limiting

---

## Advanced Configuration

### Per-User Bandwidth Limits

**Set different limits for different users:**

```sql
-- Premium user (200 Mbps)
INSERT INTO radreply (username, attribute, op, value) 
VALUES 
  ('premiumuser', 'WISPr-Bandwidth-Max-Down', ':=', '204800'),
  ('premiumuser', 'WISPr-Bandwidth-Max-Up', ':=', '204800');

-- Basic user (50 Mbps)
INSERT INTO radreply (username, attribute, op, value) 
VALUES 
  ('basicuser', 'WISPr-Bandwidth-Max-Down', ':=', '51200'),
  ('basicuser', 'WISPr-Bandwidth-Max-Up', ':=', '51200');
```

---

### Session Timeouts

**Force re-authentication every 24 hours:**

```sql
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('testuser', 'Session-Timeout', ':=', '86400');
```

**Disconnect idle users after 30 minutes:**

```sql
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('testuser', 'Idle-Timeout', ':=', '1800');
```

---

### Device Limits

**Limit concurrent connections:**

```sql
INSERT INTO radreply (username, attribute, op, value) 
VALUES ('testuser', 'Simultaneous-Use', ':=', '3');
```

**This limits user to 3 simultaneous VPN connections**

---

## Monitoring

### Check Active Sessions

**On OPNsense:**
```
Services → Captive Portal → Sessions
```

**On FreeBSD (database):**
```bash
sudo -u postgres psql radius -c "SELECT username, framedipaddress, acctstarttime FROM radacct WHERE acctstoptime IS NULL;"
```

---

### Usage Statistics

**Total bandwidth by user:**
```bash
sudo -u postgres psql radius -c "
SELECT 
  username,
  COUNT(*) as sessions,
  SUM(acctinputoctets) as total_upload,
  SUM(acctoutputoctets) as total_download,
  SUM(acctsessiontime) as total_time
FROM radacct
WHERE acctstarttime > CURRENT_DATE - INTERVAL '30 days'
GROUP BY username
ORDER BY total_download DESC;
"
```

---

### Top Users

**Users by bandwidth:**
```bash
sudo -u postgres psql radius -c "
SELECT 
  username,
  SUM(acctinputoctets + acctoutputoctets) as total_bytes
FROM radacct
WHERE acctstarttime > CURRENT_DATE - INTERVAL '7 days'
GROUP BY username
ORDER BY total_bytes DESC
LIMIT 10;
"
```

---

## Complete Configuration Summary

### OPNsense Configuration

**System → Access → Servers:**
- ✅ RADIUS server: 192.168.50.2
- ✅ Auth port: 1812
- ✅ Acct port: 1813
- ✅ Shared secret: RadiusSecret@#

**Services → Captive Portal → Zones:**
- ✅ Authentication: RADIUS (BoldVPN RADIUS)
- ✅ Accounting: Enabled
- ✅ Interface: VPN interface selected

---

### FreeBSD RADIUS Server

**Services:**
- ✅ radiusd running (port 1812, 1813)
- ✅ PostgreSQL running
- ✅ SQL module enabled

**Database:**
- ✅ Users in radcheck table
- ✅ Attributes in radreply table
- ✅ Accounting in radacct table

---

### Test Checklist

- [ ] RADIUS server responds to test (radclient)
- [ ] OPNsense can reach RADIUS server
- [ ] Captive portal shows login page
- [ ] User can login with RADIUS credentials
- [ ] Internet access granted after login
- [ ] RADIUS logs show Access-Accept
- [ ] Accounting data appears in radacct table
- [ ] Customer portal shows usage statistics

---

## Next Steps

1. ✅ **Test VPN connection** with RADIUS authentication
2. ✅ **Verify accounting** data in database
3. ⏳ **Configure additional users** in database
4. ⏳ **Set up monitoring** and alerts
5. ⏳ **Configure traffic shaper** for bandwidth enforcement (optional)
6. ⏳ **Integrate with customer portal** for self-service

---

## Additional Resources

- **RADIUS Setup:** [FREEBSD-DEPLOYMENT.md](FREEBSD-DEPLOYMENT.md)
- **RADIUS Troubleshooting:** [FREEBSD-DEPLOYMENT.md#radius-server-issues](FREEBSD-DEPLOYMENT.md#radius-server-issues)
- **API Setup:** [api/DEPLOYMENT.md](api/DEPLOYMENT.md)
- **HAProxy Setup:** [OPNSENSE-HAPROXY-SETUP.md](OPNSENSE-HAPROXY-SETUP.md)
- **System Overview:** [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)
- **All Scripts:** [scripts/README.md](scripts/README.md)

---

**✅ Your OPNsense Captive Portal is now integrated with RADIUS for enterprise-grade VPN authentication!**

