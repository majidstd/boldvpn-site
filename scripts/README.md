# BoldVPN FreeBSD Setup Scripts

Complete setup scripts for deploying BoldVPN infrastructure on FreeBSD.

## 🏗️ Architecture Overview

BoldVPN uses a **clean separation of concerns** architecture:

```
PostgreSQL Server
  └─ Database: radius
     ├─ RADIUS Tables (owned by FreeRADIUS)
     │  ├─ radcheck (VPN authentication - plaintext passwords)
     │  ├─ radreply (user quotas/limits)
     │  ├─ radacct (usage tracking)
     │  └─ ... (group tables)
     │
     └─ API Tables (owned by Node.js API)
        ├─ user_details (portal authentication - bcrypt hashes)
        └─ password_reset_tokens (password reset flow)
```

**Key Principle:** Each component creates and owns its own schema.

---

## 📋 Setup Order (MUST follow this order)

### 1. PostgreSQL Server Setup
**Script:** `freebsd-setup-postgresql.sh`

**What it does:**
- Installs PostgreSQL 17 server
- Initializes database cluster
- Creates `radius` database
- Creates `radiususer` with password
- **Does NOT create any tables**

```bash
sudo sh scripts/freebsd-setup-postgresql.sh
```

**Output:**
- PostgreSQL server running
- Empty `radius` database ready

---

### 2. FreeRADIUS Setup
**Script:** `freebsd-setup-radius.sh`

**What it does:**
- **Checks prerequisites** (PostgreSQL must be running)
- Installs FreeRADIUS with PostgreSQL driver
- **Creates RADIUS tables ONLY** (radcheck, radreply, radacct, etc.)
- Configures FreeRADIUS SQL module
- Creates test user in radcheck (plaintext password)
- Configures firewall rules

```bash
sudo sh scripts/freebsd-setup-radius.sh
```

**Output:**
- FreeRADIUS running and connected to PostgreSQL
- RADIUS tables created
- Test user: `testuser` / `Test@123!` (VPN login)

---

### 3. API Server Setup
**Script:** `freebsd-setup-api.sh`

**What it does:**
- **Checks prerequisites** (PostgreSQL + RADIUS tables must exist)
- Installs Node.js and dependencies
- **Runs migrations to create API tables** (user_details, password_reset_tokens)
- Creates test user in user_details (bcrypt hash)
- Starts API server

```bash
sudo sh scripts/freebsd-setup-api.sh
```

**Output:**
- Node.js API running on port 3000
- API tables created
- Test user: `testuser` / `Test@123!` (portal login)

---

## 🔐 Hybrid Authentication Architecture

BoldVPN uses **two separate authentication systems** for different purposes:

### VPN/RADIUS Authentication
- **Table:** `radcheck`
- **Password Storage:** Plaintext (`Cleartext-Password`)
- **Why:** FreeRADIUS requires plaintext to authenticate VPN connections
- **Used by:** OPNsense Captive Portal, WireGuard

### API/Portal Authentication
- **Table:** `user_details`
- **Password Storage:** bcrypt hash (`password_hash`)
- **Why:** Secure web authentication with JWT tokens
- **Used by:** Customer portal, API endpoints

### How It Works

```
User: testuser
Password: Test@123!

VPN Login (Captive Portal)
  └─ FreeRADIUS checks radcheck table
     └─ Compares plaintext password
        └─ Access-Accept ✓

Portal Login (https://portal.boldvpn.net)
  └─ Node.js API checks user_details table
     └─ Compares bcrypt hash
        └─ Returns JWT token ✓
```

**Same username, same password, two storage methods.**

---

## 🧪 Testing

### Test VPN Authentication
```bash
radtest testuser Test@123! localhost 0 testing123
```

Expected: `Access-Accept`

### Test API Authentication
```bash
curl -X POST https://api.boldvpn.net/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"Test@123!"}'
```

Expected: JWT token in response

### Verify Password Storage
```bash
# Check RADIUS (plaintext)
psql -U radiususer -d radius -c \
  "SELECT username, attribute, value FROM radcheck WHERE username='testuser';"

# Check API (bcrypt hash)
psql -U radiususer -d radius -c \
  "SELECT username, email, password_hash FROM user_details WHERE username='testuser';"
```

---

## 🔄 Migrations

Migrations are **automatically run** by `freebsd-setup-api.sh`.

### Migration Files:
- `001_add_user_details.sql` - Creates user_details table
- `002_create_password_reset_tokens.sql` - Creates password reset table
- `003_create_test_user.sql` - Creates test user with bcrypt hash

### Manual Migration (if needed):
```bash
cd /usr/local/boldvpn-site
sh scripts/apply-migrations.sh
```

---

## 📁 Database Schema

### RADIUS Tables (Created by freebsd-setup-radius.sh)
- `radcheck` - User credentials (plaintext for RADIUS)
- `radreply` - User quotas/limits
- `radacct` - Usage accounting/tracking
- `radgroupcheck` - Group policies
- `radgroupreply` - Group attributes
- `radusergroup` - User-to-group mapping

### API Tables (Created by freebsd-setup-api.sh via migrations)
- `user_details` - User accounts with bcrypt passwords
- `password_reset_tokens` - Password reset tokens

---

## 🛠️ Troubleshooting

### "PostgreSQL is not running"
```bash
# Check status
sudo service postgresql status

# Start if needed
sudo service postgresql start

# Enable on boot
sudo sysrc postgresql_enable="YES"
```

### "Database 'radius' does not exist"
```bash
# You skipped step 1!
sudo sh scripts/freebsd-setup-postgresql.sh
```

### "RADIUS tables not found"
```bash
# You skipped step 2!
sudo sh scripts/freebsd-setup-radius.sh
```

### FreeRADIUS can't connect to database
```bash
# Check PostgreSQL is running
ps aux | grep postgres

# Test connection
psql -U radiususer -d radius -h localhost

# Check FreeRADIUS logs
tail -50 /var/log/radius.log
```

### API can't connect to database
```bash
# Check .env file
cat /usr/local/boldvpn-site/api/.env

# Test connection
cd /usr/local/boldvpn-site/api
node -e "const { pool } = require('./utils/database'); pool.query('SELECT 1').then(() => console.log('OK')).catch(console.error);"

# Check API logs
tail -50 /var/log/boldvpn-api.log
```

---

## 🔒 Security Best Practices

1. **Change default passwords** in production
2. **Use strong JWT_SECRET** (32+ characters, random)
3. **Enable SSL/TLS** for PostgreSQL connections in production
4. **Restrict database access** to localhost only
5. **Regular backups** of the `radius` database
6. **Monitor failed login attempts** in both RADIUS and API logs
7. **Rotate JWT secrets** periodically
8. **Use environment-specific .env files** (never commit to git)

---

## 🚀 Production Deployment Checklist

- [ ] Run all 3 setup scripts in order
- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET
- [ ] Configure SSL certificates (Let's Encrypt)
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Test VPN authentication
- [ ] Test portal authentication
- [ ] Monitor logs for errors
- [ ] Set up log rotation
- [ ] Configure OPNsense Captive Portal
- [ ] Test from actual VPN client

---

## 📚 Additional Resources

- [FreeRADIUS Documentation](https://freeradius.org/documentation/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OPNsense Captive Portal Guide](https://docs.opnsense.org/manual/captiveportal.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🆘 Need Help?

Check the main [README.md](../README.md) or open an issue on GitHub.

---

**Last Updated:** November 2024  
**Architecture:** Clean Separation of Concerns  
**Status:** Production Ready

cd /usr/local/boldvpn-site/api
node -e "const { pool } = require('./utils/database'); pool.query('SELECT 1').then(() => console.log('OK')).catch(console.error);"

# Check API logs
tail -50 /var/log/boldvpn-api.log
```

---

## 🔒 Security Best Practices

1. **Change default passwords** in production
2. **Use strong JWT_SECRET** (32+ characters, random)
3. **Enable SSL/TLS** for PostgreSQL connections in production
4. **Restrict database access** to localhost only
5. **Regular backups** of the `radius` database
6. **Monitor failed login attempts** in both RADIUS and API logs
7. **Rotate JWT secrets** periodically
8. **Use environment-specific .env files** (never commit to git)

---

## 🚀 Production Deployment Checklist

- [ ] Run all 3 setup scripts in order
- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET
- [ ] Configure SSL certificates (Let's Encrypt)
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Test VPN authentication
- [ ] Test portal authentication
- [ ] Monitor logs for errors
- [ ] Set up log rotation
- [ ] Configure OPNsense Captive Portal
- [ ] Test from actual VPN client

---

## 📚 Additional Resources

- [FreeRADIUS Documentation](https://freeradius.org/documentation/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OPNsense Captive Portal Guide](https://docs.opnsense.org/manual/captiveportal.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## 🆘 Need Help?

Check the main [README.md](../README.md) or open an issue on GitHub.

---

**Last Updated:** November 2024  
**Architecture:** Clean Separation of Concerns  
**Status:** Production Ready
