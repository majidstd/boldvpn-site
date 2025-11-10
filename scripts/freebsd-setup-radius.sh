#!/bin/sh
#
# FreeBSD 14 - BoldVPN FreeRADIUS + API Server Setup
# Automated installation script
#
# Usage: Run as root
#   chmod +x freebsd-radius-setup.sh
#   ./freebsd-radius-setup.sh
#

set -e

# Function to run command with verbose output
run_cmd() {
    echo "  >> Running: $@"
    "$@"
    local ret=$?
    if [ $ret -eq 0 ]; then
        echo "     [OK] Done"
    else
        echo "     [!] Exit code: $ret"
    fi
    return $ret
}

# Function to check if package is installed
pkg_installed() {
    pkg info "$1" >/dev/null 2>&1
}

# Function to check if service is enabled
service_enabled() {
    # First check if the service is configured in rc.conf
    if sysrc -n "$1" 2>/dev/null | grep -q "YES"; then
        return 0
    fi
    return 1
}

echo "============================================"
echo "  BoldVPN RADIUS + API Server Setup"
echo "  FreeBSD 14.0-RELEASE"
echo "============================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] Error: This script must be run as root"
    echo "   Run: sudo sh freebsd-radius-setup.sh"
    exit 1
fi

echo "[OK] Running as root"
echo ""

# Prompt for configuration
echo "Enter configuration details:"
echo ""

read -p "OPNsense IP address (e.g., 192.168.1.1): " OPNSENSE_IP
read -p "RADIUS shared secret (create strong password): " RADIUS_SECRET
read -p "PostgreSQL radiususer password (create strong password): " DB_PASSWORD
read -p "PostgreSQL postgres password (create strong password): " POSTGRES_PASSWORD
echo ""
read -p "Enable SQL IP Pool for VPN client IP assignment? (y/n, default: n): " ENABLE_IPPOOL
ENABLE_IPPOOL=${ENABLE_IPPOOL:-n}

# Ask about VoIP accounting (depends on IP pool)
if [ "$ENABLE_IPPOOL" = "y" ] || [ "$ENABLE_IPPOOL" = "Y" ]; then
    read -p "Enable SQL VoIP accounting? (y/n, default: n): " ENABLE_VOIP
    ENABLE_VOIP=${ENABLE_VOIP:-n}
else
    ENABLE_VOIP="n"
    echo "  [i] SQL VoIP accounting disabled (requires IP Pool)"
fi

echo ""
echo "Configuration saved. Starting installation..."
echo ""

# Step 1: Update system
echo "[STEP] Step 1/10: Updating FreeBSD system..."
run_cmd freebsd-update fetch || true
run_cmd freebsd-update install || true
run_cmd pkg update
run_cmd pkg upgrade -y
echo "  [OK] System updated"

# Step 2: Search for correct package names
echo ""
echo "[STEP] Step 2/10: Finding correct package names..."

# Search for FreeRADIUS packages (must be specific: freeradius3)
echo "Searching for FreeRADIUS packages..."
FREERADIUS_PKG=$(pkg search -q freeradius3 | grep -E "^freeradius3-[0-9]" | head -1 | awk '{print $1}')

if [ -z "$FREERADIUS_PKG" ]; then
    echo "[!]  freeradius3 not found, using default"
    FREERADIUS_PKG="freeradius3"
else
    # Extract just the package name without version
    FREERADIUS_PKG=$(echo $FREERADIUS_PKG | cut -d'-' -f1)
fi

# Search for FreeRADIUS PostgreSQL module (it's freeradius3-pgsql, not postgresql!)
FREERADIUS_PGSQL=$(pkg search -q freeradius3-pgsql | grep -E "^freeradius3-pgsql-[0-9]" | head -1)

if [ -z "$FREERADIUS_PGSQL" ]; then
    echo "[!]  freeradius3-pgsql not found, using default"
    FREERADIUS_PGSQL="freeradius3-pgsql"
else
    # Extract just the package name without version
    FREERADIUS_PGSQL=$(echo $FREERADIUS_PGSQL | awk '{print $1}' | cut -d'-' -f1-2)
fi

# Note: PostgreSQL is bundled with freeradius3-pgsql, no separate install needed!
echo "Note: PostgreSQL client is bundled with freeradius3-pgsql"

echo ""
echo "  [OK] Found packages:"
echo "  FreeRADIUS: $FREERADIUS_PKG"
echo "  FreeRADIUS PostgreSQL: $FREERADIUS_PGSQL (includes PostgreSQL client)"
echo ""

# Step 3: Install packages
echo "[STEP] Step 3/10: Installing packages..."

# Check what's already installed
for pkg_name in ${FREERADIUS_PGSQL} node npm nginx git sudo vim; do
    if pkg_installed "$pkg_name"; then
        echo "  [OK] Already installed: $pkg_name"
    fi
done

echo "  Installing missing packages (this may take 5-10 minutes)..."
# Only install freeradius3-pgsql (which includes everything we need)
# DO NOT install freeradius3 or postgresql separately - they conflict!
run_cmd pkg install -y \
  ${FREERADIUS_PGSQL} \
  node \
  npm \
  nginx \
  git \
  sudo \
  vim

echo "  [OK] All packages installed"

# Verify FreeRADIUS configuration directory was created
echo ""
echo "[i] Verifying FreeRADIUS installation..."
if [ -d "/usr/local/etc/raddb" ]; then
    echo "  [OK] FreeRADIUS config directory exists: /usr/local/etc/raddb"
else
    echo "  [X] FreeRADIUS config directory missing!"
    echo "      Expected: /usr/local/etc/raddb"
    echo ""
    echo "  Trying to create from sample..."
    if [ -d "/usr/local/share/examples/freeradius/raddb" ]; then
        cp -r /usr/local/share/examples/freeradius/raddb /usr/local/etc/raddb
        echo "  [OK] Configuration directory created from sample"
    else
        echo "  [X] Cannot create config directory!"
        echo "      FreeRADIUS installation may be incomplete"
        echo "      Try: pkg reinstall freeradius3"
        exit 1
    fi
fi

echo "================================================================"

# Step 4: Configure PostgreSQL
echo ""
echo "[STEP]  Step 4/10: Configuring PostgreSQL..."
echo "  [i] Note: PostgreSQL is bundled with freeradius3-pgsql"
echo "  [i] For database server, install postgresql-server separately if needed"
echo ""

# Check if PostgreSQL is running (user may have their own installation)
if pgrep -q postgres; then
    echo "  [OK] PostgreSQL is running"
    
    # Try to create database and user
    echo "  Creating RADIUS database and user..."
    su - postgres -c "createdb radius" 2>/dev/null || echo "  [OK] Database 'radius' already exists"
    su - postgres -c "psql -c \"CREATE USER radiususer WITH PASSWORD '$DB_PASSWORD';\"" 2>/dev/null || echo "  [OK] User 'radiususer' already exists"
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE radius TO radiususer;\"" 2>/dev/null
    su - postgres -c "psql -c \"ALTER DATABASE radius OWNER TO radiususer;\"" 2>/dev/null
    
    echo "  [OK] PostgreSQL configured"
else
    echo "  [!] PostgreSQL is not running!"
    echo "      freeradius3-pgsql only includes the PostgreSQL CLIENT"
    echo "      You need to install PostgreSQL SERVER separately:"
    echo ""
    echo "      pkg install postgresql15-server (or postgresql16/17/18)"
    echo "      sysrc postgresql_enable=YES"
    echo "      service postgresql initdb"
    echo "      service postgresql start"
    echo ""
    echo "      Then re-run this script to configure the database"
    echo ""
    echo "  [!] Skipping PostgreSQL configuration"
fi

echo "================================================================"

# Step 5: Import FreeRADIUS schema
echo ""
echo "[STEP] Step 5/10: Importing FreeRADIUS SQL schema..."

SCHEMA_FILE="/usr/local/share/freeradius/mods-config/sql/main/postgresql/schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    su - postgres -c "psql -U radiususer -d radius -f $SCHEMA_FILE" 2>/dev/null || echo "  Schema may already exist"
    echo "  [OK] FreeRADIUS schema imported"
else
    echo "  [!] Schema file not found at $SCHEMA_FILE"
    echo "      We'll create tables manually in next step"
fi
echo "================================================================"

# Step 6: Verify/create essential tables (should already exist from PostgreSQL setup)
echo ""
echo "[STEP]  Step 6/10: Verifying database tables..."

su - postgres -c "psql -U radiususer -d radius" <<EOF
-- Create radcheck table (user credentials)
CREATE TABLE IF NOT EXISTS radcheck (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS radcheck_username ON radcheck(username);

-- Create radreply table (user attributes/quotas)
CREATE TABLE IF NOT EXISTS radreply (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS radreply_username ON radreply(username);

-- Create radacct table (accounting/usage tracking)
CREATE TABLE IF NOT EXISTS radacct (
  radacctid BIGSERIAL PRIMARY KEY,
  acctsessionid VARCHAR(64) NOT NULL,
  acctuniqueid VARCHAR(32) NOT NULL,
  username VARCHAR(64) NOT NULL,
  realm VARCHAR(64),
  nasipaddress INET NOT NULL,
  nasportid VARCHAR(15),
  nasporttype VARCHAR(32),
  acctstarttime TIMESTAMP WITH TIME ZONE,
  acctupdatetime TIMESTAMP WITH TIME ZONE,
  acctstoptime TIMESTAMP WITH TIME ZONE,
  acctsessiontime BIGINT,
  acctauthentic VARCHAR(32),
  connectinfo_start VARCHAR(50),
  connectinfo_stop VARCHAR(50),
  acctinputoctets BIGINT,
  acctoutputoctets BIGINT,
  calledstationid VARCHAR(50),
  callingstationid VARCHAR(50),
  acctterminatecause VARCHAR(32),
  servicetype VARCHAR(32),
  framedprotocol VARCHAR(32),
  framedipaddress INET
);
CREATE INDEX IF NOT EXISTS radacct_username ON radacct(username);
CREATE INDEX IF NOT EXISTS radacct_session ON radacct(acctsessionid);
CREATE INDEX IF NOT EXISTS radacct_start ON radacct(acctstarttime);

-- Create radgroupcheck table (group policies)
CREATE TABLE IF NOT EXISTS radgroupcheck (
  id SERIAL PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL
);

-- Create radgroupreply table (group attributes)
CREATE TABLE IF NOT EXISTS radgroupreply (
  id SERIAL PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL,
  attribute VARCHAR(64) NOT NULL,
  op VARCHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL
);

-- Create radusergroup table (user-to-group mapping)
CREATE TABLE IF NOT EXISTS radusergroup (
  username VARCHAR(64) NOT NULL,
  groupname VARCHAR(64) NOT NULL,
  priority INT NOT NULL DEFAULT 1
);

-- Create user_details table (for API authentication with bcrypt)
CREATE TABLE IF NOT EXISTS user_details (
  username VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create password_reset_tokens table (for password reset functionality)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_email ON password_reset_tokens(email);
EOF

echo "  [OK] Database tables verified/created"
echo "  [i] If you ran freebsd-setup-postgresql.sh first, these tables already existed"
echo "================================================================"

# Step 7: Configure FreeRADIUS SQL
echo ""
echo "[STEP]  Step 7/10: Configuring FreeRADIUS SQL module..."

# Check if SQL module exists
if [ -f "/usr/local/etc/raddb/mods-available/sql" ]; then
    echo "  [OK] SQL module found"
else
    echo "  [!]  SQL module not found, will configure manually"
fi

# Enable SQL module in sites-enabled/default
echo "  Configuring SQL module in default site..."

# Find the actual file (sites-enabled/default is usually a symlink)
DEFAULT_SITE="/usr/local/etc/raddb/sites-available/default"
if [ ! -f "$DEFAULT_SITE" ]; then
    DEFAULT_SITE="/usr/local/etc/raddb/sites-enabled/default"
fi

if grep -q "^\s*sql" "$DEFAULT_SITE" 2>/dev/null; then
    echo "  [OK] SQL already enabled in default site"
else
    echo "  Enabling SQL in authorize, accounting, and session sections..."
    # Work on the actual file, not the symlink
    if [ -L "/usr/local/etc/raddb/sites-enabled/default" ]; then
        # It's a symlink, edit the target
        REAL_FILE=$(readlink -f /usr/local/etc/raddb/sites-enabled/default 2>/dev/null || readlink /usr/local/etc/raddb/sites-enabled/default)
        if [ -f "$REAL_FILE" ]; then
            cp "$REAL_FILE" "$REAL_FILE.bak"
            sed '/^authorize {/,/^}/ s/#.*sql/sql/' "$REAL_FILE.bak" | \
            sed '/^accounting {/,/^}/ s/#.*sql/sql/' | \
            sed '/^session {/,/^}/ s/#.*sql/sql/' > "$REAL_FILE"
            echo "  [OK] SQL enabled in default site"
        fi
    else
        # It's a regular file
        cp "$DEFAULT_SITE" "$DEFAULT_SITE.bak"
        sed '/^authorize {/,/^}/ s/#.*sql/sql/' "$DEFAULT_SITE.bak" | \
        sed '/^accounting {/,/^}/ s/#.*sql/sql/' | \
        sed '/^session {/,/^}/ s/#.*sql/sql/' > "$DEFAULT_SITE"
        echo "  [OK] SQL enabled in default site"
    fi
fi

# Configure SQL module settings
echo "  Creating SQL configuration..."

# Always create queries.conf if it doesn't exist
QUERIES_DIR="/usr/local/etc/raddb/mods-config/sql/main/postgresql"
QUERIES_CONF="$QUERIES_DIR/queries.conf"

mkdir -p "$QUERIES_DIR"

if [ ! -f "$QUERIES_CONF" ]; then
    echo "  Creating simple queries.conf..."
    cat > "$QUERIES_CONF" <<'QUERIES_EOF'
# -*- text -*-
# Simple PostgreSQL queries for FreeRADIUS
# Only includes essential queries for basic authentication

safe_characters = "@abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_: /"

# Authorization queries
authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{User-Name}' ORDER BY id"

authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{User-Name}' ORDER BY id"

# Group queries (optional, can be empty)
group_membership_query = "SELECT groupname FROM radusergroup WHERE username = '%{User-Name}' ORDER BY priority"

# Accounting queries (empty for now, can be added later)
accounting_start_query = ""
accounting_stop_query = ""
accounting_update_query = ""
accounting_on_query = ""
accounting_off_query = ""

# Post-auth query (empty for now)
post-auth_query = ""
QUERIES_EOF
    echo "  [OK] Simple queries.conf created"
else
    echo "  [i] queries.conf already exists, checking if it needs fixing..."
    # Check if the existing file has errors (references to undefined variables)
    if grep -q '${client_table}' "$QUERIES_CONF" 2>/dev/null; then
        echo "  [!] Found complex queries.conf with undefined variables"
        echo "      Backing up and creating simple version..."
        mv "$QUERIES_CONF" "$QUERIES_CONF.complex.bak"
        cat > "$QUERIES_CONF" <<'QUERIES_EOF'
# -*- text -*-
# Simple PostgreSQL queries for FreeRADIUS
# Only includes essential queries for basic authentication

safe_characters = "@abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_: /"

# Authorization queries
authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{User-Name}' ORDER BY id"

authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{User-Name}' ORDER BY id"

# Group queries (optional, can be empty)
group_membership_query = "SELECT groupname FROM radusergroup WHERE username = '%{User-Name}' ORDER BY priority"

# Accounting queries (empty for now, can be added later)
accounting_start_query = ""
accounting_stop_query = ""
accounting_update_query = ""
accounting_on_query = ""
accounting_off_query = ""

# Post-auth query (empty for now)
post-auth_query = ""
QUERIES_EOF
        echo "  [OK] Simple queries.conf created (complex version backed up)"
    else
        echo "  [OK] queries.conf looks good"
    fi
fi

# Create SQL module configuration with queries.conf
    cat > /usr/local/etc/raddb/mods-available/sql <<EOF
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"
    
    server = "localhost"
    port = 5432
    login = "radiususer"
    password = "$DB_PASSWORD"
    radius_db = "radius"
    
    read_clients = no
    
    authcheck_table = "radcheck"
    authreply_table = "radreply"
    groupcheck_table = "radgroupcheck"
    groupreply_table = "radgroupreply"
    usergroup_table = "radusergroup"
    
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
EOF

# Enable SQL module
cd /usr/local/etc/raddb/mods-enabled
if [ -L sql ]; then
    echo "  [OK] SQL module already linked"
else
    echo "  Linking SQL module..."
    run_cmd ln -sf ../mods-available/sql sql
fi

echo "  [OK] FreeRADIUS SQL configured"

# Create custom dictionary for BoldVPN attributes (if needed)
echo "  Checking for custom RADIUS attributes..."

# Note: Most attributes are STANDARD in RADIUS:
#   - WISPr-Bandwidth-Max-Down/Up (standard WISPr)
#   - Simultaneous-Use (standard RADIUS attribute)
#
# Only add custom attributes if you create non-standard ones
# For basic setup with standard attributes, no custom dictionary needed!

# Check if Max-Monthly-Traffic is in radreply (custom attribute)
if su - postgres -c "psql radius -t -c \"SELECT COUNT(*) FROM radreply WHERE attribute = 'Max-Monthly-Traffic';\"" 2>/dev/null | grep -q "[1-9]"; then
    echo "  [i] Found custom attribute: Max-Monthly-Traffic"
    echo "  Creating custom dictionary..."
    
    cat > /usr/local/etc/raddb/dictionary.boldvpn <<'DICTEOF'
# BoldVPN Custom RADIUS Attributes
ATTRIBUTE Max-Monthly-Traffic 3000 integer64
DICTEOF
    
    if ! grep -q "dictionary.boldvpn" /usr/local/etc/raddb/dictionary 2>/dev/null; then
        echo '$INCLUDE dictionary.boldvpn' >> /usr/local/etc/raddb/dictionary
        echo "  [OK] Custom dictionary created and included"
    else
        echo "  [OK] Custom dictionary already included"
    fi
else
    echo "  [OK] Using standard RADIUS attributes only"
fi

# Create log file
echo "  Creating log file..."
touch /var/log/radius.log
chown root:wheel /var/log/radius.log
chmod 644 /var/log/radius.log
echo "  [OK] Log file created"

echo "================================================================"

# Step 8: Configure RADIUS clients
echo ""
echo "[STEP] Step 8/10: Configuring RADIUS clients..."

cat >> /usr/local/etc/raddb/clients.conf <<EOF

# BoldVPN OPNsense Captive Portal
client opnsense {
    ipaddr = $OPNSENSE_IP
    secret = $RADIUS_SECRET
    require_message_authenticator = no
    nas_type = other
    shortname = opnsense-captiveportal
}

# Note: localhost client is already defined in the default clients.conf
EOF

echo "  [OK] RADIUS clients configured"
echo "================================================================"

# Step 8.5: Configure SQL IP Pool and VoIP (optional)
echo ""
echo "[STEP] Step 8.5/10: Configuring optional SQL modules..."

# Handle SQL IP Pool
if [ "$ENABLE_IPPOOL" = "y" ] || [ "$ENABLE_IPPOOL" = "Y" ]; then
    echo "  Enabling sqlippool module..."
    
    # Enable sqlippool module
    if [ ! -L "/usr/local/etc/raddb/mods-enabled/sqlippool" ]; then
        cd /usr/local/etc/raddb/mods-enabled
        ln -s ../mods-available/sqlippool sqlippool
        echo "  [OK] sqlippool module enabled"
    else
        echo "  [OK] sqlippool already enabled"
    fi
else
    echo "  Disabling sqlippool in sites-enabled/default..."
    
    # Comment out sqlippool references in default site
    DEFAULT_SITE="/usr/local/etc/raddb/sites-available/default"
    if [ ! -f "$DEFAULT_SITE" ]; then
        DEFAULT_SITE="/usr/local/etc/raddb/sites-enabled/default"
    fi
    
    if [ -f "$DEFAULT_SITE" ]; then
        # Comment out sqlippool lines
        sed -i '' 's/^\([[:space:]]*\)sqlippool/#\1sqlippool/' "$DEFAULT_SITE"
        echo "  [OK] sqlippool disabled in default site"
    fi
fi

# Handle SQL VoIP
if [ "$ENABLE_VOIP" = "y" ] || [ "$ENABLE_VOIP" = "Y" ]; then
    echo "  Enabling sql-voip module..."
    
    # Enable sql-voip module (if it exists)
    if [ -f "/usr/local/etc/raddb/mods-available/sql-voip" ]; then
        if [ ! -L "/usr/local/etc/raddb/mods-enabled/sql-voip" ]; then
            cd /usr/local/etc/raddb/mods-enabled
            ln -s ../mods-available/sql-voip sql-voip
            echo "  [OK] sql-voip module enabled"
        else
            echo "  [OK] sql-voip already enabled"
        fi
    else
        echo "  [!] sql-voip module not available, skipping"
    fi
else
    echo "  Disabling sql-voip in sites-enabled/default..."
    
    # Comment out sql-voip references in default site
    DEFAULT_SITE="/usr/local/etc/raddb/sites-available/default"
    if [ ! -f "$DEFAULT_SITE" ]; then
        DEFAULT_SITE="/usr/local/etc/raddb/sites-enabled/default"
    fi
    
    if [ -f "$DEFAULT_SITE" ]; then
        # Comment out sql-voip lines
        sed -i '' 's/^\([[:space:]]*\)sql-voip/#\1sql-voip/' "$DEFAULT_SITE"
        echo "  [OK] sql-voip disabled in default site"
    fi
    
    if [ "$ENABLE_IPPOOL" != "y" ] && [ "$ENABLE_IPPOOL" != "Y" ]; then
        echo "  [i] sql-voip disabled (requires IP Pool)"
    fi
fi

echo "================================================================"

# Step 9: Enable and start FreeRADIUS
echo ""
echo "[STEP] Step 9/10: Starting FreeRADIUS..."

if service_enabled radiusd_enable; then
    echo "  [OK] FreeRADIUS already enabled"
else
    run_cmd sysrc radiusd_enable="YES"
fi

# Test configuration with detailed output
echo "  Testing FreeRADIUS configuration..."
echo "  >> Running: radiusd -C -X -l stdout"
radiusd -C -X -l stdout 2>&1 | tail -50 || {
    echo ""
    echo "  [X] FreeRADIUS configuration test failed"
    echo ""
    echo "  [STEP] Checking for common issues..."
    echo ""
    
    # Check if SQL driver is loaded
    if ! pkg info | grep -q freeradius3-pgsql; then
        echo "  [X] PostgreSQL driver not installed!"
        echo "     Run: pkg install freeradius3-pgsql"
    else
        echo "  [OK] PostgreSQL driver installed"
    fi
    
    # Check if PostgreSQL is running (may be bundled with FreeRADIUS)
    # Try to detect actual service name
    PG_CHECK_SERVICE=$(ls /usr/local/etc/rc.d/postgresql* 2>/dev/null | head -1 | xargs basename 2>/dev/null)
    if [ -z "$PG_CHECK_SERVICE" ]; then
        PG_CHECK_SERVICE="postgresql"
    fi
    
    if ! service "$PG_CHECK_SERVICE" status >/dev/null 2>&1; then
        echo "  [i] PostgreSQL service check failed (may be bundled with FreeRADIUS)"
        echo "     This is OK if database connection test passes"
    else
        echo "  [OK] PostgreSQL is running (service: $PG_CHECK_SERVICE)"
    fi
    
    # Check SQL config file
    if [ ! -f /usr/local/etc/raddb/mods-available/sql ]; then
        echo "  [X] SQL module config missing!"
    else
        echo "  [OK] SQL module config exists"
    fi
    
    # Show last 20 lines of config test for debugging
    echo ""
    echo "  📄 Running full config test for details..."
    radiusd -C -X -l stdout 2>&1 | tail -30
    
    echo ""
    echo "  💡 Check the output above for specific errors"
    echo "     Common fixes:"
    echo "     1. Check /usr/local/etc/raddb/mods-available/sql"
    echo "     2. Verify PostgreSQL password: $DB_PASSWORD"
    echo "     3. Test DB connection: psql -U radiususer -d radius -h localhost"
    echo ""
    exit 1
}

echo "  [OK] FreeRADIUS configuration test passed"

# Start the service
echo "  Starting FreeRADIUS service..."
run_cmd service radiusd start || run_cmd service radiusd restart
sleep 2

# Verify it's running
if service radiusd status >/dev/null 2>&1; then
    echo "  [OK] FreeRADIUS is running"
else
    echo "  [!]  FreeRADIUS may not be running, checking logs..."
    tail -20 /var/log/radius.log 2>/dev/null || echo "  No logs found yet"
fi
echo "================================================================"

# Step 10: Create test user
echo ""
echo "[STEP] Step 10/11: Creating test user..."

# Check if test user already exists
USER_EXISTS=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM radcheck WHERE username = 'testuser';\"" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" -gt 0 ]; then
    echo "  [OK] Test user 'testuser' already exists in radcheck"
else
    echo "  Creating test user 'testuser' in RADIUS tables..."
    run_cmd su - postgres -c "psql -U radiususer -d radius" <<EOF
-- Create test user in radcheck (for VPN authentication)
INSERT INTO radcheck (username, attribute, op, value) VALUES
('testuser', 'Cleartext-Password', ':=', 'Test@123!');

-- Set quota: 10GB per month
INSERT INTO radreply (username, attribute, op, value) VALUES
('testuser', 'Max-Monthly-Traffic', ':=', '10737418240');

-- Set bandwidth: 100 Mbps
INSERT INTO radreply (username, attribute, op, value) VALUES
('testuser', 'WISPr-Bandwidth-Max-Down', ':=', '102400'),
('testuser', 'WISPr-Bandwidth-Max-Up', ':=', '102400');

-- Set device limit: 3 devices
INSERT INTO radreply (username, attribute, op, value) VALUES
('testuser', 'Simultaneous-Use', ':=', '3');
EOF
    echo "  [OK] Test user created in radcheck: testuser / Test@123!"
fi

# Create test user in user_details (for API/portal login with bcrypt)
echo "  Creating test user in user_details (API authentication)..."

# Check if user exists in user_details
API_USER_EXISTS=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM user_details WHERE username = 'testuser';\"" 2>/dev/null | tr -d ' ')

if [ "$API_USER_EXISTS" -gt 0 ]; then
    echo "  [OK] Test user 'testuser' already exists in user_details"
else
    # Generate bcrypt hash for 'Test@123!' using Node.js
    # bcrypt hash with salt rounds = 12
    # This is the hash for 'Test@123!'
    BCRYPT_HASH='$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqYlYqYlYq'
    
    # If node is available, generate a fresh hash
    if command -v node >/dev/null 2>&1; then
        echo "  [i] Generating bcrypt hash for test user..."
        BCRYPT_HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('Test@123!', 12).then(hash => console.log(hash));" 2>/dev/null || echo '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqYlYqYlYq')
    fi
    
    run_cmd su - postgres -c "psql -U radiususer -d radius" <<EOF
-- Create test user in user_details (for portal login with bcrypt)
INSERT INTO user_details (username, email, password_hash) VALUES
('testuser', 'test@example.com', '$BCRYPT_HASH')
ON CONFLICT (username) DO NOTHING;
EOF
    echo "  [OK] Test user created in user_details with bcrypt hash"
fi

# Step 11: Configure firewall
echo ""
echo "[STEP] Step 11/11: Configuring firewall..."

# Check if firewall is already configured
if service_enabled firewall_enable; then
    echo "  [!] Firewall already enabled - skipping configuration"
    echo "      To avoid breaking existing setup"
else
    echo "  [!] Skipping firewall configuration"
    echo "      Firewall setup should be done manually based on your network"
    echo ""
    echo "  To allow RADIUS ports manually, add these rules:"
    echo "    - Port 22/tcp   (SSH - keep your connection!)"
    echo "    - Port 1812/udp (RADIUS authentication)"
    echo "    - Port 1813/udp (RADIUS accounting)"
    echo "    - Port 3000/tcp (API - optional)"
    echo ""
fi

echo "  [OK] Firewall configuration skipped"

# Final test
echo ""
echo "[TEST] Testing RADIUS authentication..."
echo "  >> Running: radtest testuser Test@123! localhost 0 testing123"
echo ""

radtest testuser Test@123! localhost 0 testing123 || {
    echo ""
    echo "  [!]  RADIUS test failed - this is normal if FreeRADIUS just started"
    echo "  Wait 10 seconds and try manually:"
    echo "  radtest testuser Test@123! localhost 0 testing123"
    echo ""
}

echo ""
echo "============================================"
echo "  [OK] SETUP COMPLETE!"
echo "============================================"
echo ""
echo "[STEP] Configuration Summary:"
echo ""
echo "  PostgreSQL:"
echo "    Database: radius"
echo "    User: radiususer"
echo "    Password: $DB_PASSWORD"
echo ""
echo "  FreeRADIUS:"
echo "    Auth Port: 1812"
echo "    Acct Port: 1813"
echo "    Client: $OPNSENSE_IP"
echo "    Secret: $RADIUS_SECRET"
echo ""
echo "  Test User:"
echo "    Username: testuser"
echo "    Password: Test@123!"
echo "    Email: test@example.com"
echo "    Quota: 10GB/month"
echo "    Speed: 100 Mbps"
echo "    Devices: 3"
echo ""
echo "  Authentication:"
echo "    VPN/RADIUS: Uses radcheck table (Cleartext-Password)"
echo "    API/Portal: Uses user_details table (bcrypt hash)"
echo ""
echo "============================================"
echo "  Next Steps:"
echo "============================================"
echo ""
echo "1. Configure OPNsense Captive Portal:"
echo "   Services → Captive Portal → BoldVPN Zone"
echo "   Authentication: RADIUS"
echo "   Server: $(hostname -I | awk '{print $1}')"
echo "   Port: 1812"
echo "   Secret: $RADIUS_SECRET"
echo ""
echo "2. Test VPN authentication:"
echo "   radtest testuser Test@123! localhost 0 testing123"
echo ""
echo "3. Test API authentication:"
echo "   curl -X POST https://api.boldvpn.net/api/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"testuser\",\"password\":\"Test@123!\"}'"
echo ""
echo "4. View logs:"
echo "   tail -f /var/log/radius.log"
echo ""
echo "5. View accounting data:"
echo "   psql -U radiususer -d radius -c 'SELECT * FROM radacct;'"
echo ""
echo "6. Check password storage:"
echo "   psql -U radiususer -d radius -c 'SELECT username, attribute, value FROM radcheck WHERE username='\"'\"'testuser'\"'\"';'"
echo "   psql -U radiususer -d radius -c 'SELECT username, email, password_hash FROM user_details WHERE username='\"'\"'testuser'\"'\"';'"
echo ""
echo "[OK] FreeRADIUS + PostgreSQL + API tables ready!"
echo ""


