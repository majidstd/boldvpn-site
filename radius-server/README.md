# BoldVPN FreeRADIUS + API Server Setup

Complete setup scripts for FreeBSD 14 server running FreeRADIUS AAA + Node.js API backend.

## 📋 Requirements

- FreeBSD 14.0-RELEASE (fresh installation)
- 2 GB RAM minimum
- 20 GB disk space
- Static IP address
- Network access to OPNsense

## 🚀 Quick Start

### 0. (Optional) Check Available Packages

If you want to verify package names before installation:

```bash
# Copy and run package checker
scp check-packages.sh admin@[freebsd-ip]:~
ssh admin@[freebsd-ip]
chmod +x check-packages.sh
./check-packages.sh
```

This will show you all available FreeRADIUS and PostgreSQL versions.

**Note:** The main setup script automatically detects the correct package names, so this step is optional!

### 1. Copy Setup Script to FreeBSD Server

**Option A: Via SCP**
```bash
# From your Mac
scp freebsd-radius-setup.sh admin@[freebsd-ip]:~
```

**Option B: Manual Copy/Paste**
```bash
# SSH into FreeBSD
ssh admin@[freebsd-ip]

# Create script
sudo ee freebsd-radius-setup.sh
# Paste the script content
# Save (ESC, Enter, Enter)
```

### 2. Make Executable

```bash
chmod +x freebsd-radius-setup.sh
```

### 3. Run Setup Script

```bash
sudo ./freebsd-radius-setup.sh
```

**You'll be prompted for:**
- OPNsense IP address (e.g., 192.168.1.1)
- RADIUS shared secret (create strong password)
- Database passwords (create strong passwords)

**Script will:**
1. ✅ Update FreeBSD system
2. ✅ **Auto-detect correct package names** (freeradius, postgresql versions)
3. ✅ Install all packages (FreeRADIUS, PostgreSQL, Node.js, nginx)
4. ✅ Configure PostgreSQL with RADIUS database
5. ✅ Import RADIUS schema
6. ✅ Configure FreeRADIUS with SQL backend
7. ✅ Add OPNsense as RADIUS client
8. ✅ Create test user (testuser / Test@123!)
9. ✅ Configure firewall (allow RADIUS ports)
10. ✅ Start all services
11. ✅ Test RADIUS authentication

**Setup time:** 10-15 minutes

## 🧪 Testing

### Test RADIUS Locally

```bash
radtest testuser Test@123! localhost 0 testing123
```

**Expected output:**
```
Received Access-Accept
```

### View RADIUS Logs

```bash
tail -f /var/log/radius/radius.log
```

### Check Database

```bash
su - postgres
psql -U radiususer -d radius

-- View users
SELECT * FROM radcheck;

-- View quotas
SELECT * FROM radreply;

-- View accounting (after someone connects)
SELECT * FROM radacct ORDER BY acctstarttime DESC LIMIT 10;

\q
exit
```

## ⚙️ Configure OPNsense

After setup completes, configure OPNsense to use this RADIUS server:

**Services → Captive Portal → Administration → BoldVPN Zone**

```
Authentication Method: RADIUS

RADIUS Authentication:
  Primary Server: [Your FreeBSD IP]
  Primary Port: 1812
  Primary Secret: [The RADIUS secret you created]

RADIUS Accounting:
  Enable: ✅ Yes
  Accounting Server: [Your FreeBSD IP]
  Accounting Port: 1813
  Accounting Secret: [Same secret]

Interim Updates: ✅ Enable
Update Interval: 600 (seconds)
```

**Save and test!**

## 📊 Test User Credentials

**Username:** `testuser`  
**Password:** `Test@123!`  
**Quota:** 10 GB/month  
**Speed:** 100 Mbps  
**Devices:** 3 simultaneous  

## 🗂️ File Locations

### PostgreSQL
- Config: `/usr/local/etc/postgresql/`
- Data: `/var/db/postgres/data15/`
- Logs: `/var/db/postgres/data15/log/`

### FreeRADIUS
- Config: `/usr/local/etc/raddb/`
- Logs: `/var/log/radius/radius.log`
- Modules: `/usr/local/etc/raddb/mods-enabled/`

### Future API
- Location: `/usr/local/www/boldvpn-api/`
- Nginx config: `/usr/local/etc/nginx/nginx.conf`

## 🔍 Troubleshooting

### FreeRADIUS won't start

```bash
# Test configuration
radiusd -X

# Check for errors in output
# Common issues:
# - SQL connection failed (check DB password)
# - Port already in use
# - Permission issues
```

### Package not found errors

If you get "package not found" errors:

```bash
# Run the package checker first
./check-packages.sh

# Or update package repo
pkg update

# Search for packages manually
pkg search freeradius
pkg search postgresql
```

The setup script automatically detects available versions, but if you have issues, run `check-packages.sh` to see what's available.

### Can't connect from OPNsense

```bash
# Check firewall
sockstat -4l | grep 1812

# Should see radiusd listening on 0.0.0.0:1812

# Test from OPNsense
# Diagnostics → Command Prompt
echo "User-Name = testuser, User-Password = Test@123!" | radclient [freebsd-ip]:1812 auth [secret]
```

### Database connection issues

```bash
# Check PostgreSQL is running
service postgresql status

# Test connection
psql -U radiususer -d radius -h localhost

# Check pg_hba.conf allows local connections
ee /var/db/postgres/data15/pg_hba.conf
```

## 📈 Next Steps

After RADIUS is working:

1. **Create real users** (replace test user)
2. **Set up user groups** (Premium, Basic plans)
3. **Build Node.js API** (for customer portal)
4. **Create customer dashboard** (boldvpn.net/login.html)
5. **Integrate Stripe** (billing)

## 🛡️ Security Recommendations

### After Setup:

```bash
# 1. Change default passwords
# 2. Setup SSH keys (disable password auth)
# 3. Configure fail2ban
pkg install -y py39-fail2ban
sysrc fail2ban_enable="YES"

# 4. Enable automatic security updates
freebsd-update cron

# 5. Setup firewall properly
# 6. Regular backups (ZFS snapshots)
zfs snapshot zroot/postgres@$(date +%Y%m%d)
```

## 📞 Support

- FreeRADIUS docs: https://freeradius.org/documentation/
- FreeBSD handbook: https://docs.freebsd.org/en/books/handbook/
- PostgreSQL docs: https://www.postgresql.org/docs/

## 🏆 This is v1.0G Compatible

This setup works perfectly with your **BoldVPN Captive Portal v1.0G** template!

---

**Created for BoldVPN Project**  
**Last updated:** November 2025


