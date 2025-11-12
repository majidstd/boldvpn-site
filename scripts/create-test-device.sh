#!/bin/sh
# Create a test device (peer) on WireGuard server
# Usage: ./scripts/create-test-device.sh [username] [password] [device_name] [server_name_or_id]

set -e

API_URL="${API_URL:-http://localhost:3000/api}"
USERNAME="${1:-testuser}"
PASSWORD="${2}"
DEVICE_NAME="${3:-TestDevice-$(date +%s)}"
SERVER_ARG="${4:-CA-Vancouver01}"

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

if [ -z "$PASSWORD" ]; then
    echo "Usage: $0 [username] [password] [device_name] [server_id]"
    echo "Example: $0 testuser mypassword MyLaptop 1"
    exit 1
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
echo "📱 Creating peer: $DEVICE_NAME on server ID $SERVER_ID..."
echo ""

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\":\"$DEVICE_NAME\",\"serverId\":$SERVER_ID}")

if echo "$CREATE_RESPONSE" | grep -q '"message":"Device added successfully"'; then
    DEVICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    ASSIGNED_IP=$(echo "$CREATE_RESPONSE" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
    PUBLIC_KEY=$(echo "$CREATE_RESPONSE" | grep -o '"publicKey":"[^"]*' | cut -d'"' -f4)
    
    echo "✅ Peer created successfully!"
    echo ""
    echo "📋 Peer Details:"
    echo "   Device ID: $DEVICE_ID"
    echo "   Device Name: $DEVICE_NAME"
    echo "   Assigned IP: $ASSIGNED_IP"
    # Use cut instead of bash substring expansion for POSIX compatibility
    PUBLIC_KEY_SHORT=$(echo "$PUBLIC_KEY" | cut -c1-50)
    echo "   Public Key: ${PUBLIC_KEY_SHORT}..."
    echo ""
    echo "🔍 Verify in OPNsense:"
    echo "   VPN → WireGuard → Clients"
    echo "   Look for peer named: $USERNAME-$DEVICE_NAME"
    echo "   IP should be: $ASSIGNED_IP"
    echo ""
    echo "📥 Download config:"
    echo "   curl -X GET \"$API_URL/devices/$DEVICE_ID/config\" -H \"Authorization: Bearer $TOKEN\" -o wireguard.conf"
    echo ""
    echo "📱 Get QR code:"
    echo "   curl -X GET \"$API_URL/devices/$DEVICE_ID/qrcode\" -H \"Authorization: Bearer $TOKEN\" -o qrcode.png"
else
    echo "❌ Peer creation failed!"
    echo ""
    echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
    exit 1
fi

