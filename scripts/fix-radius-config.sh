#!/bin/sh
#
# Fix RADIUS Configuration Issues
# Addresses common FreeRADIUS configuration problems
#

echo "================================================================"
echo "  Fixing RADIUS Configuration Issues"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[!] Error: This script must be run as root"
    echo "    Run: sudo sh fix-radius-config.sh"
    exit 1
fi

echo "[i] Running as root"
echo ""

# Issue 1: SQL module configuration
echo "================================================================"
echo "FIX 1: SQL Module Configuration"
echo "================================================================"
echo ""

SQL_CONF="/usr/local/etc/raddb/mods-available/sql"

if [ ! -f "$SQL_CONF" ]; then
    echo "[!] SQL module config not found, creating..."
    
    # Get database password from user
    echo "Enter PostgreSQL radiususer password (from setup):"
    read -r DB_PASSWORD
    
    cat > "$SQL_CONF" <<'EOF'
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"
    
    server = "localhost"
    port = 5432
    login = "radiususer"
    password = "DB_PASSWORD_PLACEHOLDER"
    radius_db = "radius"
    
    read_clients = no
    
    pool {
        start = 5
        min = 4
        max = 10
        spare = 3
        uses = 0
        lifetime = 0
        idle_timeout = 60
    }
}
EOF
    
    # Replace password placeholder
    sed -i.bak "s/DB_PASSWORD_PLACEHOLDER/$DB_PASSWORD/" "$SQL_CONF"
    echo "[OK] SQL module config created"
else
    echo "[OK] SQL module config already exists"
fi

# Enable SQL module
cd /usr/local/etc/raddb/mods-enabled
if [ ! -L sql ]; then
    echo "[i] Linking SQL module..."
    ln -sf ../mods-available/sql sql
    echo "[OK] SQL module linked"
else
    echo "[OK] SQL module already linked"
fi

echo ""

# Issue 2: Create log directory
echo "================================================================"
echo "FIX 2: RADIUS Log Directory"
echo "================================================================"
echo ""

if [ ! -d "/var/log/radius" ]; then
    echo "[i] Creating RADIUS log directory..."
    mkdir -p /var/log/radius
    # FreeBSD doesn't have a 'radius' user by default, use root for now
    chown root:wheel /var/log/radius
    chmod 755 /var/log/radius
    echo "[OK] Log directory created"
else
    echo "[OK] Log directory already exists"
fi

# Create log file
if [ ! -f "/var/log/radius/radius.log" ]; then
    touch /var/log/radius/radius.log
    chown root:wheel /var/log/radius/radius.log
    chmod 644 /var/log/radius/radius.log
    echo "[OK] Log file created"
else
    echo "[OK] Log file already exists"
fi

echo ""

# Issue 3: Fix radiusd.conf for proper logging
echo "================================================================"
echo "FIX 3: RADIUS Logging Configuration"
echo "================================================================"
echo ""

RADIUSD_CONF="/usr/local/etc/raddb/radiusd.conf"

if grep -q "destination = files" "$RADIUSD_CONF"; then
    echo "[OK] Logging already configured"
else
    echo "[i] Configuring file-based logging..."
    # Backup original
    cp "$RADIUSD_CONF" "$RADIUSD_CONF.bak"
    
    # Add logging configuration
    sed -i '' '/log {/a\
\	destination = files\
\	file = /var/log/radius/radius.log
' "$RADIUSD_CONF"
    
    echo "[OK] Logging configured"
fi

echo ""

# Issue 4: Stop radiusd before testing
echo "================================================================"
echo "FIX 4: Stop RADIUS Service for Testing"
echo "================================================================"
echo ""

if service radiusd status >/dev/null 2>&1; then
    echo "[i] Stopping radiusd service..."
    service radiusd stop
    sleep 2
    echo "[OK] Service stopped"
else
    echo "[OK] Service not running"
fi

echo ""

# Issue 5: Test configuration
echo "================================================================"
echo "FIX 5: Test Configuration"
echo "================================================================"
echo ""

echo "[i] Testing RADIUS configuration..."
echo ""

# Run detailed config test to see actual errors
echo "[i] Running detailed configuration check..."
echo "================================================================"
radiusd -C -X -l stdout 2>&1 | head -100
echo "================================================================"
echo ""

if radiusd -C 2>&1 | grep -q "Configuration appears to be OK"; then
    echo ""
    echo "[OK] Configuration test PASSED"
    echo ""
    
    # Start service
    echo "[i] Starting RADIUS service..."
    service radiusd start
    sleep 2
    
    if service radiusd status >/dev/null 2>&1; then
        echo "[OK] RADIUS service is running"
    else
        echo "[!] Failed to start RADIUS service"
        echo "    Check logs: tail -20 /var/log/radius/radius.log"
    fi
else
    echo ""
    echo "[X] Configuration test FAILED"
    echo ""
    echo "Common issues:"
    echo "  1. Check SQL module: /usr/local/etc/raddb/mods-available/sql"
    echo "  2. Verify PostgreSQL is running: service postgresql status"
    echo "  3. Test DB connection: psql -U radiususer -d radius -c 'SELECT 1;'"
    echo ""
    echo "Check specific error above or run:"
    echo "  radiusd -C -X -l stdout 2>&1 | less"
    echo ""
fi

echo ""
echo "================================================================"
echo "  [OK] Configuration fixes applied!"
echo "================================================================"
echo ""
echo "Next steps:"
echo "  1. Run: ./test-radius.sh"
echo "  2. Test authentication: radtest testuser Test@123! localhost 0 testing123"
echo ""
