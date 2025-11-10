#!/bin/sh
#
# FreeBSD 14 - BoldVPN API Server Setup
# Installs Node.js, sets up the API, and configures it as a service
#
# Usage: Run as root on the same FreeBSD server as FreeRADIUS
#   chmod +x freebsd-api-setup.sh
#   ./freebsd-api-setup.sh
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

echo "================================================================"
echo "  BoldVPN API Server Setup"
echo "  FreeBSD 14.0-RELEASE"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] Error: This script must be run as root"
    echo "   Run: sudo sh freebsd-api-setup.sh"
    exit 1
fi

echo "[OK] Running as root"
echo ""

# Prompt for configuration
echo "Enter configuration details:"
echo ""

read -p "API Port (default 3000): " API_PORT
API_PORT=${API_PORT:-3000}

read -p "JWT Secret (create strong random string): " JWT_SECRET
read -p "PostgreSQL radiususer password (from RADIUS setup): " DB_PASSWORD
read -p "Domain for API (e.g., api.boldvpn.net): " API_DOMAIN

echo ""
echo "Configuration saved. Starting installation..."
echo ""

# Step 0: Check Prerequisites
echo "================================================================"
echo "[STEP] Step 0/7: Checking Prerequisites..."
echo "================================================================"
echo ""

# Check if PostgreSQL is running
if ! pgrep -q postgres; then
    echo "[X] PostgreSQL is not running!"
    echo ""
    echo "You must run the PostgreSQL setup script first:"
    echo "  sudo sh scripts/freebsd-setup-postgresql.sh"
    echo ""
    exit 1
fi

# Check if radius database exists
if ! su - postgres -c "psql -lqt" 2>/dev/null | cut -d \| -f 1 | grep -qw radius; then
    echo "[X] Database 'radius' does not exist!"
    echo ""
    echo "You must run the PostgreSQL setup script first:"
    echo "  sudo sh scripts/freebsd-setup-postgresql.sh"
    echo ""
    exit 1
fi

# Check if RADIUS tables exist
RADIUS_TABLE_COUNT=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('radcheck', 'radreply', 'radacct');\"" 2>/dev/null | tr -d ' ')

if [ "$RADIUS_TABLE_COUNT" != "3" ]; then
    echo "[X] RADIUS tables not found!"
    echo ""
    echo "You must run the FreeRADIUS setup script first:"
    echo "  sudo sh scripts/freebsd-setup-radius.sh"
    echo ""
    exit 1
fi

echo "[OK] Prerequisites met (PostgreSQL running, database exists, RADIUS tables exist)"
echo ""

# Step 1: Install Node.js
echo "================================================================"
echo "[STEP] Step 1/7: Installing Node.js..."
echo "================================================================"
echo ""

if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js already installed: $(node --version)"
else
    echo "Installing Node.js 20..."
    run_cmd pkg install -y node20 npm-node20
    echo "[OK] Node.js installed"
fi

echo ""

# Step 2: Find and verify API directory
echo "================================================================"
echo "[STEP] Step 2/7: Locating API directory..."
echo "================================================================"
echo ""

# Detect where we are and find api directory
if [ -f "package.json" ] && [ -f "server.js" ]; then
    # Already in api directory
API_DIR="$(pwd)"
    echo "[OK] Running from API directory: $API_DIR"
elif [ -d "api" ] && [ -f "api/package.json" ]; then
    # In repo root, api/ subdirectory exists
    API_DIR="$(pwd)/api"
    echo "[i] Found API directory: $API_DIR"
    echo "[i] Changing to API directory..."
    cd api
else
    echo "[X] Error: Cannot find API directory!"
    echo "    Please run this script from:"
    echo "    - /usr/local/boldvpn-site/ (repo root), OR"
    echo "    - /usr/local/boldvpn-site/api/ (api directory)"
    echo "    Current directory: $(pwd)"
    exit 1
fi

echo "[OK] API directory: $API_DIR"
echo ""

# Step 3: Verify API files exist
echo "================================================================"
echo "[STEP] Step 3/7: Verifying API files..."
echo "================================================================"
echo ""

if [ ! -f "package.json" ]; then
    echo "[X] Error: package.json not found!"
    exit 1
fi

if [ ! -f "server.js" ]; then
    echo "[X] Error: server.js not found!"
    exit 1
fi

echo "[OK] Found package.json"
echo "[OK] Found server.js"

for dir in routes middleware utils; do
    if [ -d "$dir" ]; then
        echo "[OK] Found: $dir/"
    else
        echo "[!] Warning: $dir/ not found"
    fi
done

echo ""

# Step 4: Create .env file
echo "================================================================"
echo "[STEP] Step 4/7: Creating .env configuration..."
echo "================================================================"
echo ""

# Create .env in current directory
cat > ".env" << EOF
# BoldVPN API Configuration
NODE_ENV=production
PORT=$API_PORT

# Database Configuration (PostgreSQL from RADIUS server)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=radius
DB_USER=radiususer
DB_PASSWORD=$DB_PASSWORD

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=https://boldvpn.net,https://www.boldvpn.net

# Stripe Configuration (add your keys later)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# API Domain
API_DOMAIN=$API_DOMAIN
EOF

run_cmd chmod 600 ".env"
echo "[OK] .env file created"

echo ""

# Step 5: Install Node.js dependencies
echo "================================================================"
echo "[STEP] Step 5/7: Installing Node.js dependencies..."
echo "================================================================"
echo ""

echo "Installing npm packages in: $API_DIR"
run_cmd npm install --production
echo "[OK] Dependencies installed"

echo ""

# Step 6: Run database migrations
echo "================================================================"
echo "[STEP] Step 6/7: Running database migrations..."
echo "================================================================"
echo ""

echo "[i] Creating API tables (user_details, password_reset_tokens)..."

# Go back to repo root to run migrations
cd "$(dirname "$API_DIR")"

if [ -f "scripts/apply-migrations.sh" ]; then
    run_cmd sh scripts/apply-migrations.sh
    echo "[OK] Migrations completed"
else
    echo "[!] Migration script not found, running migrations manually..."
    
    # Run migrations manually
    export PGPASSWORD="$DB_PASSWORD"
    
    for migration_file in "$API_DIR/migrations"/*.sql; do
        if [ -f "$migration_file" ]; then
            echo "[i] Applying: $(basename "$migration_file")"
            psql -h localhost -U radiususer -d radius -f "$migration_file"
        fi
    done
    
    unset PGPASSWORD
    echo "[OK] Migrations completed manually"
fi

# Go back to API directory
cd "$API_DIR"

echo ""

# Step 7: Create rc.d service script
echo "================================================================"
echo "[STEP] Step 7/7: Creating system service..."
echo "================================================================"
echo ""

cat > /usr/local/etc/rc.d/boldvpn_api << 'RCSCRIPT'
#!/bin/sh

# PROVIDE: boldvpn_api
# REQUIRE: LOGIN postgresql radiusd
# KEYWORD: shutdown

. /etc/rc.subr

name="boldvpn_api"
rcvar="boldvpn_api_enable"

load_rc_config $name

: ${boldvpn_api_enable:="NO"}
: ${boldvpn_api_user:="root"}
: ${boldvpn_api_dir:="/usr/local/boldvpn-site/api"}
: ${boldvpn_api_log:="/var/log/boldvpn-api.log"}

command="/usr/local/bin/node"
command_args="${boldvpn_api_dir}/server.js >> ${boldvpn_api_log} 2>&1 &"

pidfile="/var/run/${name}.pid"

start_cmd="${name}_start"
stop_cmd="${name}_stop"
status_cmd="${name}_status"

boldvpn_api_start() {
    if [ -f "${pidfile}" ]; then
        pid=$(cat "${pidfile}")
        if kill -0 "$pid" 2>/dev/null; then
            echo "${name} is already running as pid $pid"
            return 0
        else
            rm -f "${pidfile}"
        fi
    fi
    
    echo "Starting ${name}..."
    cd "${boldvpn_api_dir}"
    /usr/local/bin/node server.js >> "${boldvpn_api_log}" 2>&1 &
    echo $! > "${pidfile}"
    echo "${name} started"
}

boldvpn_api_stop() {
    if [ -f "${pidfile}" ]; then
        pid=$(cat "${pidfile}")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping ${name}..."
            kill "$pid"
            rm -f "${pidfile}"
            echo "${name} stopped"
        else
            echo "${name} not running"
            rm -f "${pidfile}"
        fi
    else
        echo "${name} not running"
    fi
}

boldvpn_api_status() {
    if [ -f "${pidfile}" ]; then
        pid=$(cat "${pidfile}")
        if kill -0 "$pid" 2>/dev/null; then
            echo "${name} is running as pid $pid"
            return 0
        else
            echo "${name} is not running but pid file exists"
            return 1
        fi
    else
        echo "${name} is not running"
        return 1
    fi
}

run_rc_command "$1"
RCSCRIPT

run_cmd chmod +x /usr/local/etc/rc.d/boldvpn_api

echo "[OK] Service script created"
echo ""

# Enable the service
echo "Enabling BoldVPN API service..."
run_cmd sysrc boldvpn_api_enable="YES"

echo ""

# Create log file
echo "Creating log file..."
run_cmd touch /var/log/boldvpn-api.log
run_cmd chmod 644 /var/log/boldvpn-api.log

echo ""

# Start the service
echo "Starting BoldVPN API service..."
run_cmd service boldvpn_api start

sleep 2

# Check if service is running
echo ""
echo "Checking service status..."
service boldvpn_api status

echo ""
echo "================================================================"
echo "  [OK] API SETUP COMPLETE!"
echo "================================================================"
echo ""
echo "[STEP] Configuration Summary:"
echo ""
echo "  API Server:"
echo "    Directory: /usr/local/boldvpn-site/api/"
echo "    Port: $API_PORT"
echo "    Domain: $API_DOMAIN"
echo "    Log: /var/log/boldvpn-api.log"
echo ""
echo "  Database:"
echo "    Host: localhost"
echo "    Database: radius"
echo "    User: radiususer"
echo ""
echo "  Service:"
echo "    Status: service boldvpn_api status"
echo "    Start: service boldvpn_api start"
echo "    Stop: service boldvpn_api stop"
echo "    Restart: service boldvpn_api restart"
echo ""
echo "================================================================"
echo "  Next Steps:"
echo "================================================================"
echo ""
echo "1. Test API endpoint:"
echo "   curl http://localhost:$API_PORT/health"
echo ""
echo "2. Check logs:"
echo "   tail -f /var/log/boldvpn-api.log"
echo ""
echo "3. Configure nginx/reverse proxy for HTTPS:"
echo "   Location: https://$API_DOMAIN"
echo "   Proxy to: http://localhost:$API_PORT"
echo ""
echo "4. Update customer portal API endpoint:"
echo "   Edit portal/app.js:"
echo "   const API_URL = 'https://$API_DOMAIN';"
echo ""
echo "5. Add Stripe keys to .env:"
echo "   Edit: $API_DIR/.env"
echo "   Update: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET"
echo ""
echo "[OK] BoldVPN API is ready!"
echo ""


echo "[OK] Service script created"
echo ""

# Enable the service
echo "Enabling BoldVPN API service..."
run_cmd sysrc boldvpn_api_enable="YES"

echo ""

# Create log file
echo "Creating log file..."
run_cmd touch /var/log/boldvpn-api.log
run_cmd chmod 644 /var/log/boldvpn-api.log

echo ""

# Start the service
echo "Starting BoldVPN API service..."
run_cmd service boldvpn_api start

sleep 2

# Check if service is running
echo ""
echo "Checking service status..."
service boldvpn_api status

echo ""
echo "================================================================"
echo "  [OK] API SETUP COMPLETE!"
echo "================================================================"
echo ""
echo "[STEP] Configuration Summary:"
echo ""
echo "  API Server:"
echo "    Directory: /usr/local/boldvpn-site/api/"
echo "    Port: $API_PORT"
echo "    Domain: $API_DOMAIN"
echo "    Log: /var/log/boldvpn-api.log"
echo ""
echo "  Database:"
echo "    Host: localhost"
echo "    Database: radius"
echo "    User: radiususer"
echo ""
echo "  Service:"
echo "    Status: service boldvpn_api status"
echo "    Start: service boldvpn_api start"
echo "    Stop: service boldvpn_api stop"
echo "    Restart: service boldvpn_api restart"
echo ""
echo "================================================================"
echo "  Next Steps:"
echo "================================================================"
echo ""
echo "1. Test API endpoint:"
echo "   curl http://localhost:$API_PORT/health"
echo ""
echo "2. Check logs:"
echo "   tail -f /var/log/boldvpn-api.log"
echo ""
echo "3. Configure nginx/reverse proxy for HTTPS:"
echo "   Location: https://$API_DOMAIN"
echo "   Proxy to: http://localhost:$API_PORT"
echo ""
echo "4. Update customer portal API endpoint:"
echo "   Edit portal/app.js:"
echo "   const API_URL = 'https://$API_DOMAIN';"
echo ""
echo "5. Add Stripe keys to .env:"
echo "   Edit: $API_DIR/.env"
echo "   Update: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET"
echo ""
echo "[OK] BoldVPN API is ready!"
echo ""

