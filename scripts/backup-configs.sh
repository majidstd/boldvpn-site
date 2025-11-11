#!/bin/sh
#
# Backup FreeRADIUS, PostgreSQL, and API configs to git
#

set -e

echo "================================================================"
echo "  Backup Configs to Git"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] This script must be run as root"
    exit 1
fi

REPO_DIR="/usr/local/boldvpn-site"
BACKUP_DIR="$REPO_DIR/infra/freebsd"

# Create backup directory
mkdir -p "$BACKUP_DIR/freeradius"
mkdir -p "$BACKUP_DIR/postgresql"
mkdir -p "$BACKUP_DIR/api"

echo "[1] Backing up FreeRADIUS configs..."
cp /usr/local/etc/raddb/radiusd.conf "$BACKUP_DIR/freeradius/"
cp /usr/local/etc/raddb/sites-available/default "$BACKUP_DIR/freeradius/sites-default"
cp /usr/local/etc/raddb/mods-available/sql "$BACKUP_DIR/freeradius/sql-module"
cp /usr/local/etc/raddb/clients.conf "$BACKUP_DIR/freeradius/"
echo "[OK] FreeRADIUS configs backed up"

echo ""
echo "[2] Backing up PostgreSQL configs..."
PG_VERSION=$(ls /var/db/postgres/ | grep data | head -1)
if [ -n "$PG_VERSION" ]; then
    cp "/var/db/postgres/$PG_VERSION/postgresql.conf" "$BACKUP_DIR/postgresql/" 2>/dev/null || echo "[!] postgresql.conf not found"
    cp "/var/db/postgres/$PG_VERSION/pg_hba.conf" "$BACKUP_DIR/postgresql/" 2>/dev/null || echo "[!] pg_hba.conf not found"
fi
echo "[OK] PostgreSQL configs backed up"

echo ""
echo "[3] Backing up API configs..."
cp "$REPO_DIR/api/.env" "$BACKUP_DIR/api/env-example" 2>/dev/null || echo "[!] .env not found"
# Sanitize sensitive data
if [ -f "$BACKUP_DIR/api/env-example" ]; then
    sed -i.bak 's/JWT_SECRET=.*/JWT_SECRET=<REDACTED>/' "$BACKUP_DIR/api/env-example"
    sed -i.bak 's/DB_PASSWORD=.*/DB_PASSWORD=<REDACTED>/' "$BACKUP_DIR/api/env-example"
    sed -i.bak 's/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=<REDACTED>/' "$BACKUP_DIR/api/env-example"
    rm -f "$BACKUP_DIR/api/env-example.bak"
fi
echo "[OK] API configs backed up (passwords redacted)"

echo ""
echo "[4] Creating README..."
cat > "$BACKUP_DIR/README.md" <<'EOF'
# BoldVPN Configuration Backups

**Last updated:** $(date)

## Directory Structure

```
infra/freebsd/
├── freeradius/
│   ├── radiusd.conf       # Main FreeRADIUS config
│   ├── sites-default      # Default site config (auth/accounting)
│   ├── sql-module         # SQL module config (PostgreSQL)
│   └── clients.conf       # RADIUS clients (OPNsense)
├── postgresql/
│   ├── postgresql.conf    # PostgreSQL server config
│   └── pg_hba.conf        # PostgreSQL authentication config
└── api/
    └── env-example        # API environment variables (sanitized)
```

## Usage

### Restore FreeRADIUS Config
```bash
sudo cp infra/freebsd/freeradius/sites-default /usr/local/etc/raddb/sites-available/default
sudo cp infra/freebsd/freeradius/sql-module /usr/local/etc/raddb/mods-available/sql
sudo cp infra/freebsd/freeradius/clients.conf /usr/local/etc/raddb/
sudo service radiusd restart
```

### Restore PostgreSQL Config
```bash
PG_VERSION=$(ls /var/db/postgres/ | grep data | head -1)
sudo cp infra/freebsd/postgresql/postgresql.conf /var/db/postgres/$PG_VERSION/
sudo cp infra/freebsd/postgresql/pg_hba.conf /var/db/postgres/$PG_VERSION/
sudo service postgresql restart
```

### Restore API Config
```bash
cp infra/freebsd/api/env-example api/.env
# Edit api/.env and add real passwords
```

## Security Notes

- Passwords are REDACTED in backups
- Do NOT commit real passwords to git
- Keep .env file secure (not in git)
EOF

echo "[OK] README created"

echo ""
echo "[5] Committing to git..."
cd "$REPO_DIR"
git add infra/freebsd/

if git diff --cached --quiet; then
    echo "[!] No changes to commit"
else
    git commit -m "backup: Update FreeBSD configuration backups - $(date +%Y-%m-%d)"
    echo ""
    echo "[6] Pushing to GitHub..."
    git push && echo "[OK] Pushed to GitHub" || echo "[!] Push failed - check git status"
fi

echo ""
echo "================================================================"
echo "  Backup Complete"
echo "================================================================"
echo ""
echo "Configs backed up to: $BACKUP_DIR"
echo ""

