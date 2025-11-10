# BoldVPN FreeBSD Setup Scripts

This directory contains automated setup scripts for deploying BoldVPN infrastructure on FreeBSD.

## 📋 Setup Order

Follow these scripts in order for a fresh installation:

### 1. PostgreSQL Server Setup
**Script:** `freebsd-setup-postgresql.sh`

Installs and configures PostgreSQL server for RADIUS and API database.

```bash
sudo sh scripts/freebsd-setup-postgresql.sh
```

**What it does:**
- Installs PostgreSQL 17 server
- Initializes database cluster
- Creates `radius` database
- Creates `radiususer` with password
- Sets up postgres superuser password
- **Creates ALL RADIUS tables** (radcheck, radreply, radacct, etc.)
- **Creates ALL API tables** (user_details, password_reset_tokens)
- Tests database connectivity

**Output:**
- Database: `radius`
- User: `radiususer`
- Passwords: (you provide during setup)
- **8 tables ready** (6 RADIUS + 2 API)

---

### 2. FreeRADIUS Setup
**Script:** `freebsd-setup-radius.sh`

Installs FreeRADIUS with PostgreSQL integration and creates all necessary tables.

```bash
sudo sh scripts/freebsd-setup-radius.sh
```

**What it does:**
- Installs `freeradius3-pgsql` package
- Configures FreeRADIUS SQL module to use existing database
- Creates test user in both radcheck (plaintext) and user_details (bcrypt)
- Configures firewall rules
- Starts FreeRADIUS service

**Important:** This script uses the tables already created by the PostgreSQL setup, so you don't need to run migrations separately.

---

### 3. API Server Setup
**Script:** `freebsd-setup-api.sh`

Deploys the Node.js API server for the customer portal.

```bash
sudo sh scripts/freebsd-setup-api.sh
```

**What it does:**
- Clones/updates BoldVPN repository
- Installs Node.js dependencies
- Creates `.env` configuration
- Sets up systemd service
- Starts API server on port 3000

---

## 🔐 Password Storage Architecture

BoldVPN uses a **hybrid authentication system**:

### For VPN/RADIUS Authentication
- **Table:** `radcheck`
- **Storage:** `Cleartext-Password` (plaintext)
- **Why:** FreeRADIUS requires plaintext to authenticate VPN connections
- **Used by:** OPNsense Captive Portal, WireGuard authentication

### For API/Portal Authentication
- **Table:** `user_details`
- **Storage:** `password_hash` (bcrypt with 12 rounds)
- **Why:** Secure web authentication with JWT tokens
- **Used by:** Customer portal login, API endpoints

### How It Works

```
User Registration/Creation
    │
    ├─► radcheck table
    │   └─ Cleartext-Password: "Test@123!"
    │      (for VPN auth)
    │
    └─► user_details table
        └─ password_hash: "$2a$12$..."
           (for portal login)
```

**Same username, same password, two storage methods.**

---

## 🧪 Testing

After running all scripts, test both authentication methods:

### Test RADIUS Authentication (VPN)
```bash
radtest testuser Test@123! localhost 0 testing123
```

Expected: `Access-Accept`

### Test API Authentication (Portal)
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

**You don't need to run migrations manually!**

The `freebsd-setup-postgresql.sh` script creates **ALL tables** from the start:
- RADIUS tables: `radcheck`, `radreply`, `radacct`, `radgroupcheck`, `radgroupreply`, `radusergroup`
- API tables: `user_details` (with `password_hash` column), `password_reset_tokens`

The migration scripts in `api/migrations/` are only needed if:
1. You're updating an existing installation that doesn't have the API tables
2. You need to add new columns/tables in the future

To apply migrations to an existing installation:
```bash
cd /usr/local/boldvpn-site
git pull
sudo sh scripts/apply-migrations.sh
```

---

## 📁 Database Schema

### RADIUS Tables (for VPN)
- `radcheck` - User credentials
- `radreply` - User quotas/limits
- `radacct` - Usage accounting
- `radgroupcheck` - Group policies
- `radgroupreply` - Group attributes
- `radusergroup` - User-to-group mapping

### API Tables (for Portal)
- `user_details` - User accounts with bcrypt passwords
- `password_reset_tokens` - Password reset tokens

---

## 🛠️ Troubleshooting

### PostgreSQL won't start
```bash
# Check logs
tail -50 /var/log/postgresql/postgresql.log

# Reinitialize if needed
sudo service postgresql stop
sudo rm -rf /var/db/postgres/data17
sudo service postgresql initdb
sudo service postgresql start
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
```

---

## 🔒 Security Notes

1. **Change default passwords** in production
2. **Use strong JWT_SECRET** (32+ characters)
3. **Enable SSL/TLS** for PostgreSQL connections in production
4. **Restrict database access** to localhost only
5. **Regular backups** of the `radius` database
6. **Monitor failed login attempts** in both RADIUS and API logs

---

## 📚 Additional Resources

- [FreeRADIUS Documentation](https://freeradius.org/documentation/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OPNsense Captive Portal Guide](https://docs.opnsense.org/manual/captiveportal.html)

---

**Need help?** Check the main [README.md](../README.md) or open an issue on GitHub.
