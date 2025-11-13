#!/bin/sh
# Test device creation and verify it appears in portal
# Usage: ./scripts/test-device-creation.sh [username] [password] [device_name] [server_name]

set -e

# Use production API URL
API_URL="${API_URL:-https://api.boldvpn.net/api}"
USERNAME="${1:-testuser}"
PASSWORD="${2:-Test@123!}"
DEVICE_NAME="${3:-CLI-Test-$(date +%s)}"
SERVER_ARG="${4:-Vancouver-01}"

echo "🧪 Testing Device Creation and Portal Integration"
echo "=================================================="
echo ""
echo "📋 Test Parameters:"
echo "   API URL: $API_URL"
echo "   Username: $USERNAME"
echo "   Device Name: $DEVICE_NAME"
echo "   Server: $SERVER_ARG"
echo ""

if [ -z "$PASSWORD" ]; then
    echo "❌ Password is required!"
    echo "Usage: $0 [username] [password] [device_name] [server_name]"
    echo "Example: $0 testuser 'Test@123!' MyLaptop Vancouver-01"
    exit 1
fi

# Step 1: Login
echo "🔐 Step 1: Logging in..."
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

# Step 2: Get server ID
echo "🔍 Step 2: Looking up server..."
DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"
SERVER_ID=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM vpn_servers WHERE name = '$SERVER_ARG' LIMIT 1" | tr -d ' ')

if [ -z "$SERVER_ID" ]; then
    echo "❌ Server '$SERVER_ARG' not found in database"
    echo "Available servers:"
    psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT id, name, country, city FROM vpn_servers WHERE status = 'active' ORDER BY name;" 2>/dev/null || echo "Could not query database"
    exit 1
fi

echo "✅ Found server: $SERVER_ARG (ID: $SERVER_ID)"
echo ""

# Step 3: Create device
echo "📱 Step 3: Creating device..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\":\"$DEVICE_NAME\",\"serverId\":$SERVER_ID}")

if echo "$CREATE_RESPONSE" | grep -q '"message":"Device added successfully"'; then
    DEVICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    ASSIGNED_IP=$(echo "$CREATE_RESPONSE" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
    
    echo "✅ Device created successfully!"
    echo ""
    echo "📋 Device Details:"
    echo "   Device ID: $DEVICE_ID"
    echo "   Device Name: $DEVICE_NAME"
    echo "   Assigned IP: $ASSIGNED_IP"
    echo "   Server: $SERVER_ARG"
    echo ""
    
    # Step 4: Verify device appears in GET /devices
    echo "🔍 Step 4: Verifying device appears in API..."
    DEVICES_RESPONSE=$(curl -s -X GET "$API_URL/devices" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$DEVICES_RESPONSE" | grep -q "\"deviceName\":\"$DEVICE_NAME\""; then
        echo "✅ Device found in API device list!"
        echo ""
        echo "📋 Full API Response:"
        echo "$DEVICES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DEVICES_RESPONSE"
        echo ""
        echo "✅✅✅ SUCCESS! Device creation is working!"
        echo ""
        echo "🌐 Next Steps:"
        echo "   1. Open portal: https://portal.boldvpn.net/"
        echo "   2. Login with: $USERNAME"
        echo "   3. Go to 'Manage Devices' section"
        echo "   4. Verify device '$DEVICE_NAME' appears in the list"
        echo ""
        echo "📥 Download config:"
        echo "   curl -X GET \"$API_URL/devices/$DEVICE_ID/config\" -H \"Authorization: Bearer $TOKEN\" -o wireguard.conf"
        echo ""
        echo "📱 Get QR code:"
        echo "   curl -X GET \"$API_URL/devices/$DEVICE_ID/qrcode\" -H \"Authorization: Bearer $TOKEN\" -o qrcode.png"
    else
        echo "❌ Device NOT found in API device list!"
        echo "API Response:"
        echo "$DEVICES_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DEVICES_RESPONSE"
        exit 1
    fi
else
    echo "❌ Device creation failed!"
    echo ""
    echo "API Response:"
    echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
    exit 1
fi

