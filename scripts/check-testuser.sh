#!/bin/sh
echo "Checking testuser in all tables..."
echo ""
echo "=== radcheck (VPN auth) ==="
psql -U radiususer -d radius -c "SELECT * FROM radcheck WHERE username='testuser';"
echo ""
echo "=== radreply (user attributes) ==="
psql -U radiususer -d radius -c "SELECT * FROM radreply WHERE username='testuser';"
echo ""
echo "=== user_details (API auth) ==="
psql -U radiususer -d radius -c "SELECT username, email, substring(password_hash,1,30) as hash FROM user_details WHERE username='testuser';"

