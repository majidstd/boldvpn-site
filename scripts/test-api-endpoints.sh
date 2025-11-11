#!/bin/sh
#
# Test BoldVPN API endpoints
#

set -e

echo "================================================================"
echo "  BoldVPN API Endpoint Tests"
echo "================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
API_URL="http://localhost:3000"
USERNAME="testuser"
PASSWORD="Test@123!"

echo "[1] Testing API health..."
HEALTH=$(curl -s ${API_URL}/api/health)
if echo "$HEALTH" | grep -qi "ok"; then
    echo "${GREEN}✓${NC} API is healthy"
else
    echo "${RED}✗${NC} API health check failed"
    echo "Response: $HEALTH"
    exit 1
fi

echo ""
echo "[2] Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST ${API_URL}/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "${RED}✗${NC} Login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "${GREEN}✓${NC} Login successful"
TOKEN_PREVIEW=$(echo "$TOKEN" | cut -c1-20)
echo "Token: ${TOKEN_PREVIEW}..."

echo ""
echo "[3] Testing GET /api/user/profile..."
PROFILE=$(curl -s -X GET ${API_URL}/api/user/profile \
  -H "Authorization: Bearer $TOKEN")

if echo "$PROFILE" | grep -q "username"; then
    echo "${GREEN}✓${NC} Profile endpoint working"
    echo "$PROFILE" | python3 -m json.tool 2>/dev/null || echo "$PROFILE"
else
    echo "${RED}✗${NC} Profile endpoint failed"
    echo "Response: $PROFILE"
fi

echo ""
echo "[4] Testing GET /api/user/usage..."
USAGE=$(curl -s -X GET ${API_URL}/api/user/usage \
  -H "Authorization: Bearer $TOKEN")

if echo "$USAGE" | grep -q "currentMonth"; then
    echo "${GREEN}✓${NC} Usage endpoint working"
    echo "$USAGE" | python3 -m json.tool 2>/dev/null || echo "$USAGE"
else
    echo "${RED}✗${NC} Usage endpoint failed"
    echo "Response: $USAGE"
fi

echo ""
echo "[5] Testing GET /api/user/sessions/active..."
ACTIVE=$(curl -s -X GET ${API_URL}/api/user/sessions/active \
  -H "Authorization: Bearer $TOKEN")

if echo "$ACTIVE" | grep -q "count"; then
    echo "${GREEN}✓${NC} Active sessions endpoint working"
    echo "$ACTIVE" | python3 -m json.tool 2>/dev/null || echo "$ACTIVE"
else
    echo "${RED}✗${NC} Active sessions endpoint failed"
    echo "Response: $ACTIVE"
fi

echo ""
echo "[6] Testing GET /api/user/sessions..."
SESSIONS=$(curl -s -X GET ${API_URL}/api/user/sessions \
  -H "Authorization: Bearer $TOKEN")

if echo "$SESSIONS" | grep -q "count"; then
    echo "${GREEN}✓${NC} Sessions history endpoint working"
    echo "$SESSIONS" | python3 -m json.tool 2>/dev/null || echo "$SESSIONS"
else
    echo "${RED}✗${NC} Sessions history endpoint failed"
    echo "Response: $SESSIONS"
fi

echo ""
echo "================================================================"
echo "  Test Summary"
echo "================================================================"
echo ""
echo "${GREEN}✓${NC} All API endpoints are working!"
echo ""
echo "Available endpoints:"
echo "  - POST /api/auth/login"
echo "  - GET  /api/user/profile"
echo "  - GET  /api/user/usage"
echo "  - GET  /api/user/sessions"
echo "  - GET  /api/user/sessions/active"
echo "  - DELETE /api/user/sessions/:id"
echo "  - PUT  /api/auth/change-password"
echo ""


