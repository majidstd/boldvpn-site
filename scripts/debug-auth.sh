#!/bin/sh
#
# Debug authentication issues
#

echo "================================================================"
echo "  BoldVPN Authentication Debug"
echo "================================================================"
echo ""

# Check if user exists in user_details
echo "[1] Checking if testuser exists in user_details..."
USER_COUNT=$(psql -U radiususer -d radius -t -c "SELECT COUNT(*) FROM user_details WHERE username='testuser';" 2>/dev/null | tr -d ' ')

if [ "$USER_COUNT" = "1" ]; then
    echo "✓ User exists in user_details"
    
    # Show user details
    echo ""
    echo "[2] User details:"
    psql -U radiususer -d radius -c "SELECT username, email, created_at FROM user_details WHERE username='testuser';"
    
    # Show password hash (first 30 chars)
    echo ""
    echo "[3] Password hash (first 30 chars):"
    psql -U radiususer -d radius -t -c "SELECT substring(password_hash, 1, 30) FROM user_details WHERE username='testuser';"
    
    # Check if hash starts with $2a$ (bcrypt)
    echo ""
    echo "[4] Checking hash format:"
    HASH_START=$(psql -U radiususer -d radius -t -c "SELECT substring(password_hash, 1, 4) FROM user_details WHERE username='testuser';" | tr -d ' ')
    if [ "$HASH_START" = "\$2a\$" ]; then
        echo "✓ Hash format is correct (bcrypt)"
    else
        echo "✗ Hash format is WRONG: $HASH_START"
        echo "  Expected: \$2a\$"
    fi
    
else
    echo "✗ User does NOT exist in user_details"
    echo ""
    echo "Run this to create the user:"
    echo "  cd /usr/local/boldvpn-site"
    echo "  sudo sh scripts/apply-migrations.sh"
    exit 1
fi

# Test bcrypt comparison using Node.js
echo ""
echo "[5] Testing password hash with Node.js..."
cd /usr/local/boldvpn-site/api

# Get the hash from database
HASH=$(psql -U radiususer -d radius -t -c "SELECT password_hash FROM user_details WHERE username='testuser';" | tr -d ' ')

# Test with Node.js
node -e "
const bcrypt = require('bcryptjs');
const hash = '$HASH';
const password = 'Test@123!';

bcrypt.compare(password, hash).then(result => {
    if (result) {
        console.log('✓ Password matches hash!');
        process.exit(0);
    } else {
        console.log('✗ Password does NOT match hash');
        console.log('  Hash: ' + hash.substring(0, 30) + '...');
        console.log('  Password: ' + password);
        process.exit(1);
    }
}).catch(err => {
    console.log('✗ Error comparing password: ' + err.message);
    process.exit(1);
});
"

if [ $? -eq 0 ]; then
    echo ""
    echo "[6] Testing API login endpoint..."
    
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"username":"testuser","password":"Test@123!"}')
    
    echo "Response: $RESPONSE"
    
    if echo "$RESPONSE" | grep -q "token"; then
        echo ""
        echo "✓ API login successful!"
    else
        echo ""
        echo "✗ API login failed"
        echo ""
        echo "Check API logs:"
        echo "  tail -50 /var/log/boldvpn-api.log"
    fi
else
    echo ""
    echo "✗ Password verification failed in Node.js"
    echo ""
    echo "The hash in the database doesn't match 'Test@123!'"
    echo "Run this to fix:"
    echo "  psql -U radiususer -d radius -c \"DELETE FROM user_details WHERE username='testuser';\""
    echo "  cd /usr/local/boldvpn-site"
    echo "  sudo sh scripts/apply-migrations.sh"
fi

echo ""
echo "================================================================"

