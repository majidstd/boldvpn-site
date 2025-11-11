#!/bin/sh
#
# Restore FreeRADIUS, PostgreSQL, and API configs from git backups
#

set -e

echo "================================================================"
echo "  Restore Configs from Git Backups"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] This script must be run as root"
    exit 1
fi

REPO_DIR="/usr/local/boldvpn-site"
BACKUP_DIR="$REPO_DIR/infra/freebsd"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "[X] Backup directory not found: $BACKUP_DIR"
    echo "[!] Run: git pull"
    exit 1
fi

echo "[!] WARNING: This will overwrite current configs!"
echo ""
echo "Configs to restore:"
echo "  - FreeRADIUS (sites-default, sql-module, clients.conf)"
echo "  - PostgreSQL (postgresql.conf, pg_hba.conf)"
echo "  - API (.env template)"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "[!] Restore cancelled"
    exit 0
fi

echo ""
echo "[1] Restoring FreeRADIUS configs..."
if [ -f "$BACKUP_DIR/freeradius/sites-default" ]; then
    cp "$BACKUP_DIR/freeradius/sites-default" /usr/local/etc/raddb/sites-available/default
    echo "[OK] sites-default restored"
fi

if [ -f "$BACKUP_DIR/freeradius/sql-module" ]; then
    cp "$BACKUP_DIR/freeradius/sql-module" /usr/local/etc/raddb/mods-available/sql
    echo "[OK] sql-module restored"
fi

if [ -f "$BACKUP_DIR/freeradius/clients.conf" ]; then
    cp "$BACKUP_DIR/freeradius/clients.conf" /usr/local/etc/raddb/
    echo "[OK] clients.conf restored"
fi

if [ -f "$BACKUP_DIR/freeradius/radiusd.conf" ]; then
    cp "$BACKUP_DIR/freeradius/radiusd.conf" /usr/local/etc/raddb/
    echo "[OK] radiusd.conf restored"
fi

echo ""
echo "[2] Restoring PostgreSQL configs..."
PG_VERSION=$(ls /var/db/postgres/ | grep data | head -1)

if [ -n "$PG_VERSION" ]; then
    if [ -f "$BACKUP_DIR/postgresql/postgresql.conf" ]; then
        cp "$BACKUP_DIR/postgresql/postgresql.conf" "/var/db/postgres/$PG_VERSION/"
        echo "[OK] postgresql.conf restored"
    fi
    
    if [ -f "$BACKUP_DIR/postgresql/pg_hba.conf" ]; then
        cp "$BACKUP_DIR/postgresql/pg_hba.conf" "/var/db/postgres/$PG_VERSION/"
        echo "[OK] pg_hba.conf restored"
    fi
else
    echo "[!] PostgreSQL data directory not found"
fi

echo ""
echo "[3] Restoring API config template..."
if [ -f "$BACKUP_DIR/api/env-example" ]; then
    if [ -f "$REPO_DIR/api/.env" ]; then
        echo "[!] .env already exists, creating backup..."
        cp "$REPO_DIR/api/.env" "$REPO_DIR/api/.env.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    cp "$BACKUP_DIR/api/env-example" "$REPO_DIR/api/.env"
    echo "[OK] .env template restored"
    echo ""
    echo "[!] IMPORTANT: Edit api/.env and add real passwords:"
    echo "    - JWT_SECRET"
    echo "    - DB_PASSWORD"
    echo "    - POSTGRES_PASSWORD"
fi

echo ""
echo "[4] Restarting services..."
read -p "Restart FreeRADIUS? (yes/no): " RESTART_RADIUS
if [ "$RESTART_RADIUS" = "yes" ]; then
    service radiusd restart
    echo "[OK] FreeRADIUS restarted"
fi

read -p "Restart PostgreSQL? (yes/no): " RESTART_PG
if [ "$RESTART_PG" = "yes" ]; then
    service postgresql restart
    echo "[OK] PostgreSQL restarted"
fi

read -p "Restart API? (yes/no): " RESTART_API
if [ "$RESTART_API" = "yes" ]; then
    service boldvpn_api restart
    echo "[OK] API restarted"
fi

echo ""
echo "================================================================"
echo "  Restore Complete"
echo "================================================================"
echo ""
echo "Next steps:"
echo "  1. Edit api/.env and add real passwords"
echo "  2. Test services:"
echo "     - radtest testuser Test@123! localhost 0 testing123"
echo "     - curl http://localhost:3000/api/health"
echo ""

