#!/bin/bash

# Clean up VPN servers and add fresh ones
# Run this script on your FreeBSD server

set -e

# Database connection
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="radius"
DB_USER="radiususer"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Cleaning up VPN servers...${NC}"

# Check if we can connect to database
if ! psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to database${NC}"
    exit 1
fi

echo -e "${YELLOW}📊 Current servers before cleanup:${NC}"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "
SELECT id, name, country || ', ' || city as location, status 
FROM vpn_servers 
ORDER BY name;"

echo -e "${RED}🗑️  Removing all existing servers...${NC}"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "DELETE FROM vpn_servers;"

echo -e "${GREEN}➕ Adding fresh servers...${NC}"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -f scripts/cleanup-servers.sql

echo -e "${GREEN}✅ Server cleanup complete!${NC}"
echo -e "${YELLOW}📊 New servers:${NC}"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "
SELECT id, name, country || ', ' || city as location, wireguard_subnet, status 
FROM vpn_servers 
ORDER BY name;"

echo -e "${BLUE}🔑 Next steps:${NC}"
echo "1. Update public keys in the database:"
echo "   - Vancouver-01: UPDATE vpn_servers SET wireguard_public_key = '...' WHERE name = 'Vancouver-01';"
echo "   - Vancouver-02: UPDATE vpn_servers SET wireguard_public_key = '...' WHERE name = 'Vancouver-02';"
echo "   - Amsterdam: UPDATE vpn_servers SET wireguard_public_key = '...' WHERE name = 'Amsterdam';"
echo ""
echo "2. Configure OPNsense for each server"
echo "3. Test connections"
echo ""
echo -e "${GREEN}🎉 Done!${NC}"
