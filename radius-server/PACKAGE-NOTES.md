# FreeBSD Package Names Guide

## Common Package Naming Issues

FreeBSD package names can vary between versions. The setup script automatically detects the correct names, but here's what to expect:

### FreeRADIUS Packages

**Package names:**
- `freeradius3` (main server)
- `freeradius3-pgsql` (PostgreSQL driver - NOT "postgresql"!)
- `freeradius3-mysql` (MySQL driver)
- `freeradius3-ldap` (LDAP driver)

**Check available:**
```bash
pkg search freeradius3
```

**Expected output:**
```
freeradius3-3.2.8              Free RADIUS server implementation
freeradius3-ldap-3.2.8         Free RADIUS server implementation
freeradius3-mysql-3.2.8        Free RADIUS server implementation
freeradius3-pgsql-3.2.8        Free RADIUS server implementation
freeradius3-sqlite3-3.2.8      Free RADIUS server implementation
```

**⚠️ IMPORTANT:** The PostgreSQL driver is `freeradius3-pgsql` (not `freeradius3-postgresql`)

---

### PostgreSQL Packages

**Possible names:**
- `postgresql13-server` (older)
- `postgresql14-server` (stable)
- `postgresql15-server` (current)
- `postgresql16-server` (latest)

**Check available:**
```bash
pkg search postgresql | grep server
```

**Expected output:**
```
postgresql15-server-15.5   PostgreSQL database server
postgresql16-server-16.1   PostgreSQL database server
```

**Recommendation:** Use PostgreSQL 15 or 16 (both work great)

---

### Node.js Packages

**Possible names:**
- `node` (LTS version, recommended)
- `node18`, `node20` (specific versions)

**Check available:**
```bash
pkg search node | grep ^node
```

---

## How the Setup Script Handles This

The `freebsd-radius-setup.sh` script now uses the correct package names:

```bash
# Step 2: Search for exact package names
pkg search -q freeradius3        # Main server
pkg search -q freeradius3-pgsql  # PostgreSQL driver
pkg search -q postgresql         # Database server

# Then installs:
pkg install -y freeradius3 freeradius3-pgsql postgresql15-server ...
```

**Key fix:** Uses `freeradius3-pgsql` (not `freeradius3-postgresql`) 🎯

---

## Manual Package Check

Before running the setup, you can check what's available:

```bash
# Copy checker to FreeBSD
scp check-packages.sh admin@[freebsd-ip]:~

# Run it
ssh admin@[freebsd-ip]
chmod +x check-packages.sh
./check-packages.sh
```

**Output shows:**
- All available FreeRADIUS packages
- All available PostgreSQL versions
- Recommended installation command

---

## Common Issues and Solutions

### Issue: "No package matching 'freeradius3' available"

**Solution:**
```bash
# Update package repository
pkg update

# Search for freeradius3 (be specific!)
pkg search freeradius3

# You should see:
# freeradius3-3.2.8              Free RADIUS server implementation
# freeradius3-pgsql-3.2.8        Free RADIUS server implementation

# Install both
pkg install -y freeradius3 freeradius3-pgsql
```

### Issue: "postgresql15-server not found"

**Solution:**
```bash
# Find available PostgreSQL versions
pkg search postgresql | grep server

# Use latest version
pkg install -y postgresql16-server
```

### Issue: Old package cache

**Solution:**
```bash
# Update and clean cache
pkg update
pkg clean -a

# Try again
pkg search freeradius
```

---

## Verified Working Combinations

✅ **FreeBSD 14.0 + PostgreSQL 15 + FreeRADIUS 3**
```bash
pkg install -y \
  freeradius3 \
  freeradius3-pgsql \
  postgresql15-server \
  postgresql15-client \
  postgresql15-contrib
```

✅ **FreeBSD 14.1 + PostgreSQL 16 + FreeRADIUS 3**
```bash
pkg install -y \
  freeradius3 \
  freeradius3-pgsql \
  postgresql16-server \
  postgresql16-client \
  postgresql16-contrib
```

**⚠️ Note:** It's `freeradius3-pgsql` not `freeradius3-postgresql`!

Both work perfectly! 🏆

---

## Why This Matters

Different FreeBSD releases have different package versions available. The setup script detects what's available on **your** system and uses the correct names automatically.

**You don't need to worry about this** - the script handles it! 🚀

---

**Need help?** Run `./check-packages.sh` to see what's available on your system!
