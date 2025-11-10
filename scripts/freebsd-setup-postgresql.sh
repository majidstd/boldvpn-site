#!/bin/sh
#
# FreeBSD PostgreSQL Server Setup Script for BoldVPN
# This script installs and configures PostgreSQL server for FreeRADIUS
#
# Usage: sudo sh freebsd-postgresql-setup.sh
#

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================"
echo "  BoldVPN - PostgreSQL Server Setup for FreeBSD"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "${RED}[X] This script must be run as root or with sudo${NC}"
    exit 1
fi

# Detect FreeBSD version
FREEBSD_VERSION=$(freebsd-version | cut -d'-' -f1 | cut -d'.' -f1)
echo "[i] Detected FreeBSD version: $FREEBSD_VERSION"
echo ""

# Function to run commands with error handling
run_cmd() {
    if ! "$@"; then
        echo "${RED}[X] Command failed: $*${NC}"
        exit 1
    fi
}

# Function to check if package is installed
pkg_installed() {
    pkg info "$1" >/dev/null 2>&1
}

echo "================================================================"
echo "[STEP] Step 1/6: Collecting Configuration"
echo "================================================================"
echo ""

# Get configuration from user
read -p "PostgreSQL radiususer password (create strong password): " DB_PASSWORD
read -p "PostgreSQL postgres superuser password (create strong password): " POSTGRES_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ] || [ -z "$POSTGRES_PASSWORD" ]; then
    echo "${RED}[X] Passwords cannot be empty!${NC}"
    exit 1
fi

echo "================================================================"
echo "[STEP] Step 2/6: Installing PostgreSQL Server"
echo "================================================================"
echo ""

# Check if PostgreSQL is already installed
if pkg_installed "postgresql17-server"; then
    echo "${GREEN}[OK] PostgreSQL 17 server already installed${NC}"
elif pkg_installed "postgresql16-server"; then
    echo "${GREEN}[OK] PostgreSQL 16 server already installed${NC}"
elif pkg_installed "postgresql15-server"; then
    echo "${GREEN}[OK] PostgreSQL 15 server already installed${NC}"
else
    echo "[i] Installing PostgreSQL 17 server..."
    run_cmd pkg install -y postgresql17-server postgresql17-client
    echo "${GREEN}[OK] PostgreSQL installed${NC}"
fi

echo ""
echo "================================================================"
echo "[STEP] Step 3/6: Initializing PostgreSQL"
echo "================================================================"
echo ""

# Enable PostgreSQL service
run_cmd sysrc postgresql_enable="YES"
echo "${GREEN}[OK] PostgreSQL enabled in rc.conf${NC}"

# Check if PostgreSQL is already initialized
if [ -d "/var/db/postgres/data17" ] || [ -d "/var/db/postgres/data16" ] || [ -d "/var/db/postgres/data15" ]; then
    echo "${YELLOW}[!] PostgreSQL data directory already exists${NC}"
    echo "[i] Skipping initialization"
else
    echo "[i] Initializing PostgreSQL database cluster..."
    run_cmd service postgresql initdb
    echo "${GREEN}[OK] PostgreSQL initialized${NC}"
fi

# Start PostgreSQL
echo "[i] Starting PostgreSQL service..."
if service postgresql status >/dev/null 2>&1; then
    echo "${YELLOW}[!] PostgreSQL already running${NC}"
else
    run_cmd service postgresql start
    echo "${GREEN}[OK] PostgreSQL started${NC}"
fi

# Wait for PostgreSQL to be ready
echo "[i] Waiting for PostgreSQL to be ready..."
sleep 3

# Verify PostgreSQL is running
if ! pgrep -q postgres; then
    echo "${RED}[X] PostgreSQL failed to start!${NC}"
    echo "[i] Check logs: tail -50 /var/log/postgresql/postgresql.log"
    exit 1
fi

echo "${GREEN}[OK] PostgreSQL is running${NC}"

echo ""
echo "================================================================"
echo "[STEP] Step 4/6: Setting postgres User Password"
echo "================================================================"
echo ""

# Set postgres superuser password
echo "[i] Setting postgres superuser password..."
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '$POSTGRES_PASSWORD';\"" 2>/dev/null || true
echo "${GREEN}[OK] Postgres password set${NC}"

echo ""
echo "================================================================"
echo "[STEP] Step 5/6: Creating RADIUS Database and User"
echo "================================================================"
echo ""

# Create radius database
echo "[i] Creating 'radius' database..."
su - postgres -c "createdb radius" 2>/dev/null || echo "${YELLOW}[!] Database 'radius' already exists${NC}"

# Create radiususer
echo "[i] Creating 'radiususer' database user..."
su - postgres -c "psql -c \"CREATE USER radiususer WITH PASSWORD '$DB_PASSWORD';\"" 2>/dev/null || echo "${YELLOW}[!] User 'radiususer' already exists${NC}"

# Grant privileges
echo "[i] Granting privileges to radiususer..."
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE radius TO radiususer;\""
su - postgres -c "psql -c \"ALTER DATABASE radius OWNER TO radiususer;\""

echo "${GREEN}[OK] Database and user configured${NC}"

echo ""
echo "================================================================"
echo "[STEP] Step 6/7: Creating API Tables"
echo "================================================================"
echo ""

# Create user_details and password_reset_tokens tables
echo "[i] Creating API tables (user_details, password_reset_tokens)..."
su - postgres -c "psql -U radiususer -d radius" <<'EOF'
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

echo "${GREEN}[OK] API tables created${NC}"

echo ""
echo "================================================================"
echo "[STEP] Step 7/7: Testing Database Connection"
echo "================================================================"
echo ""

# Test connection
echo "[i] Testing database connection..."
if PGPASSWORD="$DB_PASSWORD" psql -U radiususer -d radius -h localhost -c "SELECT 1" >/dev/null 2>&1; then
    echo "${GREEN}[OK] Database connection successful${NC}"
else
    echo "${RED}[X] Database connection failed!${NC}"
    echo "[i] Check PostgreSQL logs: tail -50 /var/log/postgresql/postgresql.log"
    exit 1
fi

# Verify tables exist
echo "[i] Verifying tables..."
TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -U radiususer -d radius -h localhost -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('user_details', 'password_reset_tokens');" 2>/dev/null | tr -d ' ')

if [ "$TABLE_COUNT" = "2" ]; then
    echo "${GREEN}[OK] API tables verified (user_details, password_reset_tokens)${NC}"
else
    echo "${YELLOW}[!] Warning: Expected 2 API tables, found $TABLE_COUNT${NC}"
fi

echo ""
echo "================================================================"
echo "  PostgreSQL Setup Complete!"
echo "================================================================"
echo ""
echo "${GREEN}Configuration Summary:${NC}"
echo "  Database Server: PostgreSQL $(psql --version | awk '{print $3}')"
echo "  Database Name: radius"
echo "  Database User: radiususer"
echo "  Database Password: $DB_PASSWORD"
echo "  Postgres Password: $POSTGRES_PASSWORD"
echo ""
echo "${YELLOW}Next Steps:${NC}"
echo "  1. Run the FreeRADIUS setup script:"
echo "     sudo sh scripts/freebsd-setup-radius.sh"
echo ""
echo "  2. The RADIUS setup will automatically:"
echo "     - Import the RADIUS schema (radcheck, radreply, radacct, etc.)"
echo "     - Configure FreeRADIUS to use PostgreSQL"
echo "     - Create test users in both RADIUS and API tables"
echo ""
echo "${GREEN}[OK] PostgreSQL + API tables ready!${NC}"
echo ""

