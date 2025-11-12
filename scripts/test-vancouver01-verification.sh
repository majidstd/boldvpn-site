#!/bin/sh
# Test subnet verification - checks if database subnet matches OPNsense
# Usage: ./scripts/test-vancouver01-verification.sh [username] [password] [server_name_or_id]

set -e

API_URL="${API_URL:-http://localhost:3000/api}"
USERNAME="${1:-testuser}"
PASSWORD="${2}"
SERVER_ARG="${3:-CA-Vancouver01}"

if [ -z "$PASSWORD" ]; then
    echo "Usage: $0 [username] [password] [server_name_or_id]"
    echo "Example: $0 testuser mypassword CA-Vancouver01"
    echo "Example: $0 testuser mypassword 10"
    exit 1
fi

# Try to get server ID if server name provided
if echo "$SERVER_ARG" | grep -q '^[0-9]*$'; then
    SERVER_ID="$SERVER_ARG"
else
    # Look up server ID by name
    DB_USER="${DB_USER:-radiususer}"
    DB_NAME="${DB_NAME:-radius}"
    SERVER_ID=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM vpn_servers WHERE name = '$SERVER_ARG' LIMIT 1" | tr -d ' ')
    
    if [ -z "$SERVER_ID" ]; then
        echo "❌ Server '$SERVER_ARG' not found in database"
        exit 1
    fi
    echo "📋 Found server: $SERVER_ARG (ID: $SERVER_ID)"
fi

echo "🔐 Logging in as $USERNAME..."

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo ""
echo "🔍 Testing subnet verification for server ID $SERVER_ID..."
echo ""

VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/admin/servers/$SERVER_ID/verify-subnet" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

if echo "$VERIFY_RESPONSE" | grep -q '"success":true'; then
    DB_SUBNET=$(echo "$VERIFY_RESPONSE" | grep -o '"databaseSubnet":"[^"]*' | cut -d'"' -f4)
    echo "✅ Subnet verification PASSED!"
    echo "   Database Subnet: $DB_SUBNET"
    echo "   OPNsense Subnet: Matches ✓"
else
    echo "❌ Subnet verification FAILED!"
    echo ""
    echo "$VERIFY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESPONSE"
    exit 1
fi

