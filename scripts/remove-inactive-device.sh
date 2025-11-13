#!/bin/sh
# Remove an inactive device (clean up OPNsense peer)
# Usage: ./scripts/remove-inactive-device.sh [username] [device_id]

set -e

API_URL="${API_URL:-https://api.boldvpn.net/api}"

USERNAME="${1:-testuser}"
DEVICE_ID="${2}"

if [ -z "$DEVICE_ID" ]; then
    echo "Usage: $0 [username] [device_id]"
    echo ""
    echo "Example:"
    echo "  $0 testuser 26"
    echo ""
    echo "This script will:"
    echo "  1. Login as the user"
    echo "  2. Delete the device (even if inactive)"
    echo "  3. Remove peer from OPNsense"
    exit 1
fi

echo "🔍 Removing inactive device"
echo "=========================="
echo "Username: $USERNAME"
echo "Device ID: $DEVICE_ID"
echo ""

# Step 1: Login
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"Test@123!\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Step 2: Delete device
echo "🗑️  Deleting device ID $DEVICE_ID..."
DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/devices/$DEVICE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Device removed successfully!"
    
    # Check if OPNsense removal succeeded
    if echo "$RESPONSE_BODY" | grep -q '"opnsenseRemoved":true'; then
        echo "✅ Peer removed from OPNsense"
    elif echo "$RESPONSE_BODY" | grep -q '"opnsenseRemoved":false'; then
        echo "⚠️  Warning: Peer may still exist in OPNsense"
        echo "   Check OPNsense manually: VPN → WireGuard → Clients"
    fi
elif [ "$HTTP_CODE" = "500" ]; then
    echo "❌ Error: OPNsense removal failed"
    echo "   Device may be marked inactive, but peer still exists in OPNsense"
    echo "   Check API logs: tail -f /var/log/boldvpn-api.log"
else
    echo "❌ Failed to remove device"
fi

