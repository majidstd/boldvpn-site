#!/bin/sh
# Test device creation with login
# Usage: ./scripts/test-device-creation.sh [username] [password] [device_name] [server_id]

# Default values
API_URL="${API_URL:-http://localhost:3000/api}"
USERNAME="${1:-testuser}"
PASSWORD="${2}"
DEVICE_NAME="${3:-Test-Device}"
SERVER_ID="${4:-1}"

if [ -z "$PASSWORD" ]; then
    echo "Usage: $0 [username] [password] [device_name] [server_id]"
    echo "Example: $0 testuser mypassword MyLaptop 1"
    echo ""
    echo "Or set environment variables:"
    echo "  export API_URL=http://localhost:3000/api"
    echo "  export USERNAME=testuser"
    echo "  export PASSWORD=mypassword"
    exit 1
fi

echo "🔐 Logging in as $USERNAME..."
echo ""

# Login and get token
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Login failed!"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:50}..."
echo ""
echo "📱 Creating device: $DEVICE_NAME on server ID $SERVER_ID..."
echo ""

# Create device
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\":\"$DEVICE_NAME\",\"serverId\":$SERVER_ID}")

# Check if successful
echo "$CREATE_RESPONSE" | grep -q '"message":"Device added successfully"'

if [ $? -eq 0 ]; then
    echo "✅ Device created successfully!"
    echo ""
    
    # Extract device ID and IP
    DEVICE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
    ASSIGNED_IP=$(echo "$CREATE_RESPONSE" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
    
    echo "Device ID: $DEVICE_ID"
    echo "Assigned IP: $ASSIGNED_IP"
    echo ""
    echo "📥 To download config:"
    echo "curl -X GET \"$API_URL/devices/$DEVICE_ID/config\" -H \"Authorization: Bearer $TOKEN\" -o wireguard.conf"
    echo ""
    echo "📱 To get QR code:"
    echo "curl -X GET \"$API_URL/devices/$DEVICE_ID/qrcode\" -H \"Authorization: Bearer $TOKEN\" -o qrcode.png"
else
    echo "❌ Device creation failed!"
    echo ""
fi

echo ""
echo "Full response:"
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"

