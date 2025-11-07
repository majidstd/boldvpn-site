#!/bin/sh
#
# Reinstall FreeRADIUS with proper configuration
# Fixes missing /usr/local/etc/raddb directory issue
#

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] Error: This script must be run as root"
    echo "    Run: sudo sh reinstall-freeradius.sh"
    exit 1
fi

echo "================================================================"
echo "  Reinstalling FreeRADIUS"
echo "================================================================"
echo ""

# Get database password
printf "Enter PostgreSQL radiususer password (from initial setup): "
read DB_PASSWORD

# Get RADIUS secret
printf "Enter RADIUS shared secret for OPNsense: "
read RADIUS_SECRET

printf "Enter OPNsense IP address: "
read OPNSENSE_IP
echo ""

echo "================================================================"
echo "  Step 1: Removing Broken FreeRADIUS Installation"
echo "================================================================"
echo ""

# Stop service if running
echo "[i] Stopping radiusd service..."
service radiusd stop 2>/dev/null || echo "[i] Service not running"

# Remove packages
echo "[i] Removing FreeRADIUS packages..."
pkg delete -y freeradius3 freeradius3-pgsql 2>/dev/null || echo "[i] Packages not installed"

# Remove old config
echo "[i] Removing old configuration..."
rm -rf /usr/local/etc/raddb
rm -rf /var/log/radius

echo "[OK] Old installation removed"
echo ""

echo "================================================================"
echo "  Step 2: Installing FreeRADIUS Fresh"
echo "================================================================"
echo ""

# Update package repository
echo "[i] Updating package repository..."
pkg update -f

# Install FreeRADIUS
echo "[i] Installing FreeRADIUS packages..."
pkg install -y freeradius3 freeradius3-pgsql

echo "[OK] FreeRADIUS installed"
echo ""

# Verify raddb directory was created
if [ -d "/usr/local/etc/raddb" ]; then
    echo "[OK] Configuration directory created: /usr/local/etc/raddb"
else
    echo "[X] Configuration directory still missing!"
    echo "    Check: ls -la /usr/local/etc/ | grep rad"
    exit 1
fi

echo ""
echo "================================================================"
echo "  Step 3: Configuring FreeRADIUS"
echo "================================================================"
echo ""

# Configure SQL module
echo "[i] Configuring SQL module..."

# Check if queries.conf exists
QUERIES_CONF="/usr/local/share/freeradius/mods-config/sql/main/postgresql/queries.conf"
if [ -f "$QUERIES_CONF" ]; then
    echo "[OK] Found queries.conf"
    # Full configuration
    cat > /usr/local/etc/raddb/mods-available/sql <<SQLEOF
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"
    
    server = "localhost"
    port = 5432
    login = "radiususer"
    password = "$DB_PASSWORD"
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
    
    \$INCLUDE \${modconfdir}/\${.:name}/main/\${dialect}/queries.conf
}
SQLEOF
else
    echo "[!] queries.conf not found, using minimal config"
    # Minimal configuration
    cat > /usr/local/etc/raddb/mods-available/sql <<SQLEOF
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"
    
    server = "localhost"
    port = 5432
    login = "radiususer"
    password = "$DB_PASSWORD"
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
SQLEOF
fi

echo "[OK] SQL module configured"

# Enable SQL module
cd /usr/local/etc/raddb/mods-enabled
if [ ! -L sql ]; then
    ln -sf ../mods-available/sql sql
    echo "[OK] SQL module linked"
else
    echo "[OK] SQL module already linked"
fi

# Configure RADIUS clients
echo "[i] Configuring RADIUS clients..."
cat >> /usr/local/etc/raddb/clients.conf <<CLIENTEOF

# BoldVPN OPNsense Captive Portal
client opnsense {
    ipaddr = $OPNSENSE_IP
    secret = $RADIUS_SECRET
    require_message_authenticator = no
    nas_type = other
    shortname = opnsense-captiveportal
}

# Localhost for testing
client localhost {
    ipaddr = 127.0.0.1
    secret = testing123
    nas_type = other
}
CLIENTEOF

echo "[OK] RADIUS clients configured"

# Create log directory
echo "[i] Creating log directory..."
mkdir -p /var/log/radius
chown root:wheel /var/log/radius
chmod 755 /var/log/radius
touch /var/log/radius.log
chown root:wheel /var/log/radius.log
chmod 644 /var/log/radius.log

echo "[OK] Log directory created"
echo ""

echo "================================================================"
echo "  Step 4: Testing Configuration"
echo "================================================================"
echo ""

echo "[i] Testing RADIUS configuration..."
if radiusd -C; then
    echo ""
    echo "[OK] Configuration test PASSED"
else
    echo ""
    echo "[X] Configuration test FAILED"
    echo "    Run: radiusd -C -X -l stdout"
    exit 1
fi

echo ""
echo "================================================================"
echo "  Step 5: Starting FreeRADIUS"
echo "================================================================"
echo ""

# Enable and start service
sysrc radiusd_enable="YES"
service radiusd start

sleep 2

if service radiusd status >/dev/null 2>&1; then
    echo "[OK] FreeRADIUS is running"
else
    echo "[X] FreeRADIUS failed to start"
        echo "    Check logs: tail -20 /var/log/radius.log"
    exit 1
fi

echo ""
echo "================================================================"
echo "  Step 6: Testing Authentication"
echo "================================================================"
echo ""

echo "[i] Testing with testuser..."
radtest testuser Test@123! localhost 0 testing123

echo ""
echo "================================================================"
echo "  [OK] FreeRADIUS Reinstall Complete!"
echo "================================================================"
echo ""
echo "Summary:"
echo "  [OK] FreeRADIUS 3 installed"
echo "  [OK] PostgreSQL driver loaded"
echo "  [OK] Configuration created"
echo "  [OK] SQL module enabled"
echo "  [OK] RADIUS clients configured"
echo "  [OK] Service running"
echo ""
echo "Next steps:"
echo "  1. Run: ./test-radius.sh (verify all tests pass)"
echo "  2. Configure OPNsense to use this RADIUS server"
echo "  3. Test from captive portal"
echo ""

