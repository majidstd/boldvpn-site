#!/bin/sh
# Test CA-Vancouver01 subnet verification with login
# Usage: ./scripts/test-vancouver01-verification.sh [username] [password] [server_id]

# Default values
API_URL="${API_URL:-http://localhost:3000/api}"
USERNAME="${1:-testuser}"
PASSWORD="${2}"
SERVER_ID="${3:-1}"

if [ -z "$PASSWORD" ]; then
    echo "Usage: $0 [username] [password] [server_id]"
    echo "Example: $0 testuser mypassword 1"
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
echo "🔍 Testing subnet verification for server ID $SERVER_ID..."
echo ""

# Test subnet verification
VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/admin/servers/$SERVER_ID/verify-subnet" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

# Pretty print JSON response
echo "$VERIFY_RESPONSE" | grep -q '"success":true'

if [ $? -eq 0 ]; then
    echo "✅ Subnet verification PASSED!"
    echo ""
    echo "$VERIFY_RESPONSE" | grep -o '"databaseSubnet":"[^"]*' | cut -d'"' -f4 | sed 's/^/Database Subnet: /'
else
    echo "❌ Subnet verification FAILED!"
    echo ""
fi

echo ""
echo "Full response:"
echo "$VERIFY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESPONSE"

