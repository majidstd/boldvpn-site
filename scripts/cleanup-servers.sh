#!/bin/sh

# Clean up VPN servers and add fresh ones
# Run this script on your FreeBSD server
# Compatible with FreeBSD sh/bash

set -e

# Database connection
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="radius"
DB_USER="radiususer"

# Colors for output (FreeBSD compatible)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

printf "${BLUE}🧹 Cleaning up VPN servers...${NC}\n"

# Check if we can connect to database
if ! psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "SELECT 1;" > /dev/null 2>&1; then
    printf "${RED}❌ Cannot connect to database${NC}\n"
    exit 1
fi

printf "${YELLOW}📊 Current servers before cleanup:${NC}\n"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "
SELECT id, name, country || ', ' || city as location, status 
FROM vpn_servers 
ORDER BY name;"

printf "${RED}🗑️  Removing all existing servers...${NC}\n"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "DELETE FROM vpn_servers;"

printf "${GREEN}➕ Adding fresh servers...${NC}\n"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -f scripts/cleanup-servers.sql

printf "${GREEN}✅ Server cleanup complete!${NC}\n"
printf "${YELLOW}📊 New servers:${NC}\n"
psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -c "
SELECT id, name, country || ', ' || city as location, wireguard_subnet, status 
FROM vpn_servers 
ORDER BY name;"

printf "${BLUE}🔑 Next steps:${NC}\n"
echo "1. Update public keys in the database:"
echo "   - Vancouver-01: UPDATE vpn_servers SET wireguard_public_key = '...' WHERE name = 'Vancouver-01';"
echo "   - Vancouver-02: UPDATE vpn_servers SET wireguard_public_key = '...' WHERE name = 'Vancouver-02';"
echo "   - Amsterdam: UPDATE vpn_servers SET wireguard_public_key = '...' WHERE name = 'Amsterdam';"
echo ""
echo "2. Configure OPNsense for each server"
echo "3. Test connections"
echo ""
printf "${GREEN}🎉 Done!${NC}\n"
