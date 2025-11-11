#!/bin/sh
#
# Update FreeRADIUS accounting queries from git backup
#

set -e

echo "================================================================"
echo "  Update FreeRADIUS Accounting Queries"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] This script must be run as root"
    exit 1
fi

REPO_DIR="/usr/local/boldvpn-site"
QUERIES_SOURCE="$REPO_DIR/infra/freebsd/freeradius/queries.conf"
QUERIES_DEST="/usr/local/etc/raddb/mods-config/sql/main/postgresql/queries.conf"

# Check if source file exists
if [ ! -f "$QUERIES_SOURCE" ]; then
    echo "[X] Queries file not found: $QUERIES_SOURCE"
    echo "[!] Run: git pull"
    exit 1
fi

echo "[1] Backing up current queries.conf..."
cp "$QUERIES_DEST" "${QUERIES_DEST}.backup.$(date +%Y%m%d_%H%M%S)"
echo "[OK] Backup created"

echo ""
echo "[2] Copying new queries.conf..."
cp -f "$QUERIES_SOURCE" "$QUERIES_DEST"
echo "[OK] Queries updated"

echo ""
echo "[3] Verifying FreeRADIUS configuration..."
if /usr/local/sbin/radiusd -C; then
    echo "[OK] Configuration is valid"
else
    echo "[X] Configuration has errors!"
    echo "[!] Restoring backup..."
    cp "${QUERIES_DEST}.backup."* "$QUERIES_DEST"
    exit 1
fi

echo ""
echo "[4] Restarting FreeRADIUS..."
service radiusd restart
sleep 3

echo ""
echo "================================================================"
echo "  Accounting Queries Updated"
echo "================================================================"
echo ""
echo "FreeRADIUS will now write accounting data to radacct table."
echo ""
echo "Test:"
echo "  1. Connect to VPN (or wait if already connected)"
echo "  2. Wait 30 seconds for interim update"
echo "  3. Check: psql -U radiususer -d radius -c 'SELECT COUNT(*) FROM radacct;'"
echo ""

