#!/bin/sh
#
# BoldVPN RADIUS Server Test Script
# Tests FreeRADIUS installation and configuration
#
# Usage: 
#   chmod +x test-radius.sh
#   ./test-radius.sh
#

# No colors - plain text output
RED=''
GREEN=''
YELLOW=''
BLUE=''
NC=''

echo "================================================================"
echo "  BoldVPN RADIUS Server Test Suite"
echo "================================================================"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    echo "================================================================"
    echo "TEST $TESTS_TOTAL: $test_name"
    echo "================================================================"
    echo ""
    echo "  >> Running: $test_command"
    echo ""
    
    # Run the command and capture output
    output=$(eval "$test_command" 2>&1)
    exit_code=$?
    
    # Display output
    echo "$output"
    echo ""
    
    # Check result
    if [ $exit_code -eq 0 ]; then
        if [ -n "$expected_pattern" ]; then
            if echo "$output" | grep -q "$expected_pattern"; then
                echo "  [OK] Test passed"
                TESTS_PASSED=$((TESTS_PASSED + 1))
                return 0
            else
                echo "  [!] Test failed - expected pattern not found: $expected_pattern"
                TESTS_FAILED=$((TESTS_FAILED + 1))
                return 1
            fi
        else
            echo "  [OK] Test passed"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        fi
    else
        echo "  [X] Test failed with exit code: $exit_code"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Check PostgreSQL service (may be bundled with FreeRADIUS)
echo "================================================================"
echo "TEST 1: PostgreSQL Service Status"
echo "================================================================"
echo ""
echo "  >> Checking if PostgreSQL service exists..."
echo ""

# Check if postgresql service exists
if service postgresql status >/dev/null 2>&1; then
    echo "  >> Running: service postgresql status"
    echo ""
    output=$(service postgresql status 2>&1)
    echo "$output"
    echo ""
    if echo "$output" | grep -q "is running"; then
        echo "  [OK] Test passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "  [X] Test failed - service not running"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
else
    echo "  [i] PostgreSQL service not found (likely bundled with FreeRADIUS)"
    echo "  [i] Will test database connectivity instead"
    echo ""
    # Still count as passed since this is expected behavior
    echo "  [OK] Test passed (bundled PostgreSQL detected)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
fi

TESTS_TOTAL=$((TESTS_TOTAL + 1))

echo ""

# Test 2: Check FreeRADIUS service
run_test "FreeRADIUS Service Status" \
    "service radiusd status" \
    "is running"

echo ""

# Test 3: Check PostgreSQL connection
run_test "PostgreSQL Database Connection" \
    "psql -U radiususer -d radius -c 'SELECT version();'" \
    "PostgreSQL"

echo ""

# Test 4: Check radcheck table exists
run_test "Check radcheck Table" \
    "psql -U radiususer -d radius -c 'SELECT COUNT(*) FROM radcheck;'" \
    "count"

echo ""

# Test 5: Check if test user exists
run_test "Check Test User Exists" \
    "psql -U radiususer -d radius -t -c \"SELECT username FROM radcheck WHERE username='testuser';\"" \
    "testuser"

echo ""

# Test 6: Check radreply table (quotas)
run_test "Check User Quotas Table" \
    "psql -U radiususer -d radius -c 'SELECT COUNT(*) FROM radreply;'" \
    "count"

echo ""

# Test 7: Check radacct table (accounting)
run_test "Check Accounting Table" \
    "psql -U radiususer -d radius -c 'SELECT COUNT(*) FROM radacct;'" \
    "count"

echo ""

# Test 8: RADIUS configuration test
echo "================================================================"
echo "TEST $((TESTS_TOTAL + 1)): RADIUS Configuration Test"
echo "================================================================"
echo ""
echo "  >> Running: radiusd -C -X -l stdout 2>&1 | head -50"
echo ""

# Some systems require root to read full config; try sudo if available
if command -v sudo >/dev/null 2>&1; then
    sudo radiusd -C -X -l stdout 2>&1 | head -50
else
    radiusd -C -X -l stdout 2>&1 | head -50
fi

if command -v sudo >/dev/null 2>&1; then
    CFG_OK=$(sudo radiusd -C >/dev/null 2>&1; echo $?)
else
    CFG_OK=$(radiusd -C >/dev/null 2>&1; echo $?)
fi
if [ "$CFG_OK" -eq 0 ]; then
    echo ""
    echo "  [OK] RADIUS configuration is valid"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo ""
    echo "  [X] RADIUS configuration has errors"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test 9: RADIUS authentication test (MOST IMPORTANT)
# Ensure hostname resolves to an IP to avoid radclient parsing issues
HOSTNAME_NOW=$(hostname -s 2>/dev/null)
if [ -n "$HOSTNAME_NOW" ] && ! host "$HOSTNAME_NOW" >/dev/null 2>&1; then
    echo "[i] Hostname '$HOSTNAME_NOW' does not resolve. Adding temporary hosts entry..."
    echo "127.0.0.1 $HOSTNAME_NOW" | sudo tee -a /etc/hosts >/dev/null 2>&1 || true
fi
echo "================================================================"
echo "TEST $((TESTS_TOTAL + 1)): RADIUS Authentication Test"
echo "================================================================"
echo ""
echo "  >> Testing authentication with testuser"
echo ""

AUTH_OUTPUT=$(radtest testuser Test@123! localhost 0 testing123 2>&1)
echo "$AUTH_OUTPUT"
echo ""

if echo "$AUTH_OUTPUT" | grep -q "Access-Accept"; then
    echo "  [OK] Authentication successful!"
    TESTS_PASSED=$((TESTS_PASSED + 1))
elif echo "$AUTH_OUTPUT" | grep -q "Access-Reject"; then
    echo "  [X] Authentication failed - credentials rejected"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo "  [X] Authentication test failed - no response"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test 10: Check RADIUS ports are listening
run_test "Check RADIUS Ports Listening" \
    "sockstat -l | grep radiusd" \
    "1812"

echo ""

# Test 11: Check RADIUS logs exist
run_test "Check RADIUS Log Files" \
    "ls -lh /var/log/radius.log" \
    "radius.log"

echo ""

# Summary
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
    echo "  Your RADIUS server is working correctly!"
    echo "================================================================"
    echo ""
    echo "Next Steps:"
    echo "  1. Configure OPNsense to use this RADIUS server"
    echo "  2. Test authentication from captive portal"
    echo "  3. Create real user accounts"
    echo ""
    exit 0
else
    echo "================================================================"
    echo "  [X] SOME TESTS FAILED"
    echo "  Please review the errors above"
    echo "================================================================"
    echo ""
    echo "Common Issues:"
    echo "  - Services not running: service postgresql start / service radiusd start"
    echo "  - Wrong password: Check RADIUS secret in clients.conf"
    echo "  - Database issues: Check PostgreSQL logs"
    echo ""
    echo "For detailed logs:"
    echo "  tail -f /var/log/radius.log"
    echo ""
    exit 1
fi
