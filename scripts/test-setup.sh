#!/bin/sh
#
# Test script to verify BoldVPN setup
#

echo "================================================================"
echo "  BoldVPN Setup Test Script"
echo "================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: PostgreSQL running
echo "[TEST 1] PostgreSQL Server"
if pgrep -q postgres; then
    echo "${GREEN}✓${NC} PostgreSQL is running"
else
    echo "${RED}✗${NC} PostgreSQL is NOT running"
    exit 1
fi

# Test 2: Database exists
echo ""
echo "[TEST 2] Database 'radius' exists"
if su - postgres -c "psql -lqt" 2>/dev/null | cut -d \| -f 1 | grep -qw radius; then
    echo "${GREEN}✓${NC} Database 'radius' exists"
else
    echo "${RED}✗${NC} Database 'radius' does NOT exist"
    exit 1
fi

# Test 3: RADIUS tables exist
echo ""
echo "[TEST 3] RADIUS Tables"
RADIUS_TABLES=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('radcheck', 'radreply', 'radacct', 'radgroupcheck', 'radgroupreply', 'radusergroup');\"" 2>/dev/null | tr -d ' ')

if [ "$RADIUS_TABLES" = "6" ]; then
    echo "${GREEN}✓${NC} All 6 RADIUS tables exist"
else
    echo "${RED}✗${NC} RADIUS tables missing (found $RADIUS_TABLES/6)"
    exit 1
fi

# Test 4: API tables exist
echo ""
echo "[TEST 4] API Tables"
API_TABLES=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('user_details', 'password_reset_tokens');\"" 2>/dev/null | tr -d ' ')

if [ "$API_TABLES" = "2" ]; then
    echo "${GREEN}✓${NC} All 2 API tables exist"
else
    echo "${RED}✗${NC} API tables missing (found $API_TABLES/2)"
    exit 1
fi

# Test 5: Test user in radcheck
echo ""
echo "[TEST 5] Test User in radcheck (RADIUS)"
RADCHECK_USER=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM radcheck WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')

if [ "$RADCHECK_USER" = "1" ]; then
    echo "${GREEN}✓${NC} Test user exists in radcheck"
    # Show password storage
    PASSWORD_TYPE=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT attribute FROM radcheck WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')
    echo "  Password type: $PASSWORD_TYPE"
else
    echo "${YELLOW}⚠${NC} Test user NOT found in radcheck"
fi

# Test 6: Test user in user_details
echo ""
echo "[TEST 6] Test User in user_details (API)"
API_USER=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM user_details WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')

if [ "$API_USER" = "1" ]; then
    echo "${GREEN}✓${NC} Test user exists in user_details"
    # Show password hash
    HASH=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT substring(password_hash, 1, 20) FROM user_details WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')
    echo "  Password hash: ${HASH}..."
else
    echo "${YELLOW}⚠${NC} Test user NOT found in user_details"
fi

# Test 7: FreeRADIUS running
echo ""
echo "[TEST 7] FreeRADIUS Service"
if pgrep -q radiusd; then
    echo "${GREEN}✓${NC} FreeRADIUS is running"
else
    echo "${YELLOW}⚠${NC} FreeRADIUS is NOT running"
fi

# Test 8: API server running
echo ""
echo "[TEST 8] API Server"
if pgrep -f "node.*server.js" >/dev/null; then
    echo "${GREEN}✓${NC} API server is running"
else
    echo "${YELLOW}⚠${NC} API server is NOT running"
fi

# Test 9: RADIUS authentication
echo ""
echo "[TEST 9] RADIUS Authentication"
if command -v radtest >/dev/null 2>&1; then
    if radtest testuser Test@123! localhost 0 testing123 2>&1 | grep -q "Access-Accept"; then
        echo "${GREEN}✓${NC} RADIUS authentication successful"
    else
        echo "${YELLOW}⚠${NC} RADIUS authentication failed (may need to wait for service to start)"
    fi
else
    echo "${YELLOW}⚠${NC} radtest command not found (skip)"
fi

# Test 10: API health check
echo ""
echo "[TEST 10] API Health Check"
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:3000/api/health)
    echo "${GREEN}✓${NC} API health check passed"
    echo "  Response: $HEALTH"
else
    echo "${YELLOW}⚠${NC} API health check failed (server may not be running)"
fi

echo ""
echo "================================================================"
echo "  Test Summary"
echo "================================================================"
echo ""
echo "${GREEN}✓${NC} PostgreSQL: Running"
echo "${GREEN}✓${NC} Database: Exists"
echo "${GREEN}✓${NC} RADIUS Tables: $RADIUS_TABLES/6"
echo "${GREEN}✓${NC} API Tables: $API_TABLES/2"
echo ""
echo "All critical tests passed!"
echo ""

#
# Test script to verify BoldVPN setup
#

echo "================================================================"
echo "  BoldVPN Setup Test Script"
echo "================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: PostgreSQL running
echo "[TEST 1] PostgreSQL Server"
if pgrep -q postgres; then
    echo "${GREEN}✓${NC} PostgreSQL is running"
else
    echo "${RED}✗${NC} PostgreSQL is NOT running"
    exit 1
fi

# Test 2: Database exists
echo ""
echo "[TEST 2] Database 'radius' exists"
if su - postgres -c "psql -lqt" 2>/dev/null | cut -d \| -f 1 | grep -qw radius; then
    echo "${GREEN}✓${NC} Database 'radius' exists"
else
    echo "${RED}✗${NC} Database 'radius' does NOT exist"
    exit 1
fi

# Test 3: RADIUS tables exist
echo ""
echo "[TEST 3] RADIUS Tables"
RADIUS_TABLES=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('radcheck', 'radreply', 'radacct', 'radgroupcheck', 'radgroupreply', 'radusergroup');\"" 2>/dev/null | tr -d ' ')

if [ "$RADIUS_TABLES" = "6" ]; then
    echo "${GREEN}✓${NC} All 6 RADIUS tables exist"
else
    echo "${RED}✗${NC} RADIUS tables missing (found $RADIUS_TABLES/6)"
    exit 1
fi

# Test 4: API tables exist
echo ""
echo "[TEST 4] API Tables"
API_TABLES=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('user_details', 'password_reset_tokens');\"" 2>/dev/null | tr -d ' ')

if [ "$API_TABLES" = "2" ]; then
    echo "${GREEN}✓${NC} All 2 API tables exist"
else
    echo "${RED}✗${NC} API tables missing (found $API_TABLES/2)"
    exit 1
fi

# Test 5: Test user in radcheck
echo ""
echo "[TEST 5] Test User in radcheck (RADIUS)"
RADCHECK_USER=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM radcheck WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')

if [ "$RADCHECK_USER" = "1" ]; then
    echo "${GREEN}✓${NC} Test user exists in radcheck"
    # Show password storage
    PASSWORD_TYPE=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT attribute FROM radcheck WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')
    echo "  Password type: $PASSWORD_TYPE"
else
    echo "${YELLOW}⚠${NC} Test user NOT found in radcheck"
fi

# Test 6: Test user in user_details
echo ""
echo "[TEST 6] Test User in user_details (API)"
API_USER=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT COUNT(*) FROM user_details WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')

if [ "$API_USER" = "1" ]; then
    echo "${GREEN}✓${NC} Test user exists in user_details"
    # Show password hash
    HASH=$(su - postgres -c "psql -U radiususer -d radius -t -c \"SELECT substring(password_hash, 1, 20) FROM user_details WHERE username='testuser';\"" 2>/dev/null | tr -d ' ')
    echo "  Password hash: ${HASH}..."
else
    echo "${YELLOW}⚠${NC} Test user NOT found in user_details"
fi

# Test 7: FreeRADIUS running
echo ""
echo "[TEST 7] FreeRADIUS Service"
if pgrep -q radiusd; then
    echo "${GREEN}✓${NC} FreeRADIUS is running"
else
    echo "${YELLOW}⚠${NC} FreeRADIUS is NOT running"
fi

# Test 8: API server running
echo ""
echo "[TEST 8] API Server"
if pgrep -f "node.*server.js" >/dev/null; then
    echo "${GREEN}✓${NC} API server is running"
else
    echo "${YELLOW}⚠${NC} API server is NOT running"
fi

# Test 9: RADIUS authentication
echo ""
echo "[TEST 9] RADIUS Authentication"
if command -v radtest >/dev/null 2>&1; then
    if radtest testuser Test@123! localhost 0 testing123 2>&1 | grep -q "Access-Accept"; then
        echo "${GREEN}✓${NC} RADIUS authentication successful"
    else
        echo "${YELLOW}⚠${NC} RADIUS authentication failed (may need to wait for service to start)"
    fi
else
    echo "${YELLOW}⚠${NC} radtest command not found (skip)"
fi

# Test 10: API health check
echo ""
echo "[TEST 10] API Health Check"
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:3000/api/health)
    echo "${GREEN}✓${NC} API health check passed"
    echo "  Response: $HEALTH"
else
    echo "${YELLOW}⚠${NC} API health check failed (server may not be running)"
fi

echo ""
echo "================================================================"
echo "  Test Summary"
echo "================================================================"
echo ""
echo "${GREEN}✓${NC} PostgreSQL: Running"
echo "${GREEN}✓${NC} Database: Exists"
echo "${GREEN}✓${NC} RADIUS Tables: $RADIUS_TABLES/6"
echo "${GREEN}✓${NC} API Tables: $API_TABLES/2"
echo ""
echo "All critical tests passed!"
echo ""

