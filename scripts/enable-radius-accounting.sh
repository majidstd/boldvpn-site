#!/bin/sh
#
# Enable FreeRADIUS accounting to PostgreSQL
#

set -e

echo "================================================================"
echo "  Enable FreeRADIUS Accounting to PostgreSQL"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] This script must be run as root"
    exit 1
fi

SITES_FILE="/usr/local/etc/raddb/sites-enabled/default"

echo "[1] Backing up current config..."
cp "$SITES_FILE" "${SITES_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "[OK] Backup created"

echo ""
echo "[2] Checking accounting section..."

# Check if sql is already in accounting section
if grep -A30 "^accounting {" "$SITES_FILE" | grep -q "^\s*sql\s*$"; then
    echo "[OK] SQL already enabled in accounting section"
else
    echo "[i] Adding SQL to accounting section..."
    
    # Add sql after the accounting { line
    sed -i.tmp '/^accounting {/a\
\	# Write accounting data to PostgreSQL\
\	sql\
' "$SITES_FILE"
    
    rm -f "${SITES_FILE}.tmp"
    echo "[OK] SQL added to accounting section"
fi

echo ""
echo "[3] Verifying configuration..."
if /usr/local/sbin/radiusd -C; then
    echo "[OK] Configuration is valid"
else
    echo "[X] Configuration has errors!"
    echo "[!] Restoring backup..."
    cp "${SITES_FILE}.backup."* "$SITES_FILE"
    exit 1
fi

echo ""
echo "[4] Restarting FreeRADIUS..."
service radiusd restart
sleep 2

echo ""
echo "================================================================"
echo "  Accounting Enabled"
echo "================================================================"
echo ""
echo "FreeRADIUS will now write accounting data to radacct table."
echo ""
echo "Test:"
echo "  1. Connect to VPN"
echo "  2. Wait 30 seconds"
echo "  3. Check: psql -U radiususer -d radius -c 'SELECT * FROM radacct;'"
echo ""

