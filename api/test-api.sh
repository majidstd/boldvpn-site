#!/bin/sh
#
# BoldVPN API Test Script
# Tests API endpoints and database connectivity
#
# Usage: 
#   chmod +x test-api.sh
#   ./test-api.sh
#

echo "================================================================"
echo "  BoldVPN API Test Suite"
echo "================================================================"
echo ""

API_URL="${API_URL:-http://localhost:3000}"
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local name="$1"
    local method="${2:-GET}"
    local endpoint="$3"
    local data="$4"
    local expected_code="${5:-200}"
    
    echo "================================================================"
    echo "TEST: $name"
    echo "================================================================"
    echo ""
    echo "  >> $method $API_URL$endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "$API_URL$endpoint" 2>&1)
    fi
    
    # Extract HTTP code (last line)
    http_code=$(echo "$response" | tail -n1)
    
    # Extract body (all but last line)
    body=$(echo "$response" | sed '$d')
    
    echo ""
    echo "Response:"
    echo "$body" | python -m json.tool 2>/dev/null || echo "$body"
    echo ""
    echo "HTTP Status: $http_code"
    echo ""
    
    if [ "$http_code" = "$expected_code" ]; then
        echo "  [OK] Test passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  [X] Test failed - Expected $expected_code, got $http_code"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test 1: Health Check
test_endpoint "Health Check" "GET" "/api/health" "" "200"

# Test 2: Test user login
test_endpoint "User Login (testuser)" "POST" "/api/auth/login" \
    '{"username":"testuser","password":"Test@123!"}' "200"

# Save token for authenticated requests
if [ $TESTS_FAILED -eq 0 ]; then
    echo "================================================================"
    echo "  Extracting JWT Token..."
    echo "================================================================"
    echo ""
    
    TOKEN=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"username":"testuser","password":"Test@123!"}' \
        "$API_URL/api/auth/login" | \
        python -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)
    
    if [ -n "$TOKEN" ]; then
        echo "  [OK] Token extracted: ${TOKEN:0:50}..."
        echo ""
    else
        echo "  [!] Could not extract token"
        echo ""
    fi
fi

# Test 3: Get user profile (authenticated)
if [ -n "$TOKEN" ]; then
    echo "================================================================"
    echo "TEST: Get User Profile (Authenticated)"
    echo "================================================================"
    echo ""
    echo "  >> GET $API_URL/api/user/profile"
    
    response=$(curl -s -w "\n%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$API_URL/api/user/profile" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    echo ""
    echo "Response:"
    echo "$body" | python -m json.tool 2>/dev/null || echo "$body"
    echo ""
    echo "HTTP Status: $http_code"
    echo ""
    
    if [ "$http_code" = "200" ]; then
        echo "  [OK] Test passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  [X] Test failed - Expected 200, got $http_code"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
fi

# Test 4: Invalid login
test_endpoint "Invalid Login" "POST" "/api/auth/login" \
    '{"username":"testuser","password":"wrongpassword"}' "401"

# Test 5: Missing authentication
test_endpoint "Unauthorized Access" "GET" "/api/user/profile" "" "401"

# Test 6: Invalid endpoint
test_endpoint "404 Not Found" "GET" "/api/invalid/endpoint" "" "404"

# Summary
TESTS_TOTAL=$((TESTS_PASSED + TESTS_FAILED))

echo "================================================================"
echo "  TEST SUMMARY"
echo "================================================================"
echo ""
echo "  Total Tests:  $TESTS_TOTAL"
echo "  Passed:       $TESTS_PASSED"
echo "  Failed:       $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "================================================================"
    echo "  [OK] ALL TESTS PASSED!"
    echo "  Your API is working correctly!"
    echo "================================================================"
    echo ""
    echo "Next Steps:"
    echo "  1. Configure HTTPS (nginx reverse proxy)"
    echo "  2. Update customer portal with API URL"
    echo "  3. Add Stripe keys to .env"
    echo "  4. Test from customer portal"
    echo ""
    exit 0
else
    echo "================================================================"
    echo "  [X] SOME TESTS FAILED"
    echo "  Please review the errors above"
    echo "================================================================"
    echo ""
    echo "Common Issues:"
    echo "  - API not running: service boldvpn_api status"
    echo "  - Wrong port: Check API_URL environment variable"
    echo "  - Database issues: Check /var/log/boldvpn-api.log"
    echo ""
    exit 1
fi

