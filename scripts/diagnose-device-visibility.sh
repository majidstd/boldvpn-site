#!/bin/sh
# Diagnose why device is not showing in portal
# Usage: ./scripts/diagnose-device-visibility.sh [username] [device_name]

set -e

DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"
API_URL="${API_URL:-https://api.boldvpn.net/api}"

USERNAME="${1:-testuser}"
DEVICE_NAME="${2:-MyTestDevice}"

echo "🔍 Device Visibility Diagnostic"
echo "================================"
echo ""
echo "Checking: $USERNAME / $DEVICE_NAME"
echo ""

# Step 1: Check database state
echo "📊 Step 1: Database State"
echo "-------------------------"
DB_RESULT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT 
    id,
    device_name,
    opnsense_peer_id,
    is_active,
    assigned_ip,
    created_at
FROM user_devices 
WHERE username = '$USERNAME' AND device_name = '$DEVICE_NAME'
ORDER BY created_at DESC
LIMIT 1;
" 2>/dev/null)

if [ -z "$DB_RESULT" ]; then
    echo "❌ Device NOT found in database!"
    exit 1
fi

echo "$DB_RESULT" | awk -F'|' '{print "  ID: " $1; print "  Name: " $2; print "  OPNsense Peer ID: " ($3 ? $3 : "NULL"); print "  Is Active: " $4; print "  IP: " $5; print "  Created: " $6}'
echo ""

# Extract values
DEVICE_ID=$(echo "$DB_RESULT" | awk -F'|' '{print $1}' | tr -d ' ')
IS_ACTIVE=$(echo "$DB_RESULT" | awk -F'|' '{print $4}' | tr -d ' ')
OPNSENSE_PEER_ID=$(echo "$DB_RESULT" | awk -F'|' '{print $3}' | tr -d ' ')

# Step 2: Check if device would be returned by API
echo "🔍 Step 2: API Query Check"
echo "-------------------------"
if [ "$IS_ACTIVE" = "t" ] || [ "$IS_ACTIVE" = "true" ] || [ "$IS_ACTIVE" = "1" ]; then
    echo "✅ Device is_active = true (will be queried by API)"
else
    echo "❌ Device is_active = false (WILL NOT be returned by API)"
    echo ""
    echo "💡 This is why device is not showing in portal!"
    echo "   The sync check marked it inactive because peer wasn't found in OPNsense"
    exit 0
fi
echo ""

# Step 3: Check OPNsense peer
echo "🔍 Step 3: OPNsense Peer Check"
echo "------------------------------"
PEER_NAME="${USERNAME}-${DEVICE_NAME}"
echo "Expected peer name in OPNsense: $PEER_NAME"
echo "Stored peer ID: ${OPNSENSE_PEER_ID:-NULL}"
echo ""

# Step 4: Test API endpoint directly
echo "🔍 Step 4: Test API Endpoint"
echo "---------------------------"
echo "Testing: GET $API_URL/devices"
echo ""

# Get token first
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"Test@123!\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed! Cannot test API"
    exit 1
fi

echo "✅ Logged in"
echo ""

# Get devices
API_RESPONSE=$(curl -s -X GET "$API_URL/devices" \
  -H "Authorization: Bearer $TOKEN")

echo "API Response:"
echo "$API_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$API_RESPONSE"
echo ""

# Check if device is in response
if echo "$API_RESPONSE" | grep -q "\"deviceName\":\"$DEVICE_NAME\""; then
    echo "✅ Device IS in API response"
else
    echo "❌ Device NOT in API response"
    echo ""
    echo "💡 Root Cause:"
    echo "   - Device exists in DB with is_active=true"
    echo "   - But sync check couldn't find peer in OPNsense"
    echo "   - So device was marked inactive during GET /devices call"
    echo ""
    echo "🔧 Check API logs for sync check errors:"
    echo "   tail -f /var/log/boldvpn-api.log | grep -E 'not found in OPNsense|Sync check failed'"
fi

