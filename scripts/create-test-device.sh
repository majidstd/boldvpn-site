#!/bin/sh
# Create a test device and show where it appears in WireGuard
# Usage: ./scripts/create-test-device.sh [username] [password] [device_name]

API_URL="${API_URL:-http://localhost:3000/api}"
USERNAME="${1:-testuser}"
PASSWORD="${2}"
DEVICE_NAME="${3:-TestDevice-$(date +%s)}"

if [ -z "$PASSWORD" ]; then
    echo "Usage: $0 [username] [password] [device_name]"
    echo "Example: $0 testuser mypassword MyTestDevice"
    exit 1
fi

echo "🔐 Logging in as $USERNAME..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo ""
echo "📱 Creating device: $DEVICE_NAME..."
echo ""

# Create device
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\":\"$DEVICE_NAME\",\"serverId\":1}")

echo "=== API Response ==="
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Check if successful
if echo "$CREATE_RESPONSE" | grep -q '"message":"Device added successfully"'; then
    DEVICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    ASSIGNED_IP=$(echo "$CREATE_RESPONSE" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
    PUBLIC_KEY=$(echo "$CREATE_RESPONSE" | grep -o '"publicKey":"[^"]*' | cut -d'"' -f4)
    
    echo "✅ Device created successfully!"
    echo ""
    echo "📋 Device Details:"
    echo "   Device ID: $DEVICE_ID"
    echo "   Device Name: $DEVICE_NAME"
    echo "   Assigned IP: $ASSIGNED_IP"
    echo "   Public Key: $PUBLIC_KEY"
    echo ""
    echo "🔍 Now check OPNsense WireGuard:"
    echo "   1. Go to VPN → WireGuard → Clients"
    echo "   2. Look for peer/client with name: $USERNAME"
    echo "   3. Check if it has IP: $ASSIGNED_IP"
    echo "   4. Check if public key matches: $PUBLIC_KEY"
    echo ""
    echo "📥 To download config:"
    echo "   curl -X GET \"$API_URL/devices/$DEVICE_ID/config\" -H \"Authorization: Bearer $TOKEN\" -o wireguard.conf"
    echo ""
    echo "📱 To get QR code:"
    echo "   curl -X GET \"$API_URL/devices/$DEVICE_ID/qrcode\" -H \"Authorization: Bearer $TOKEN\" -o qrcode.png"
else
    echo "❌ Device creation failed!"
    echo ""
    echo "Check the error message above."
fi

