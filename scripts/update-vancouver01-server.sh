#!/bin/sh
# Update CA-Vancouver01 server with OPNsense WireGuard public key
# Usage: sudo ./scripts/update-vancouver01-server.sh

set -e

DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"
PUBLIC_KEY="C4P74TRgeBqAZQKFrCwpYVKUh+XakhDZpGiMSPEJovwtR3ARjeqkbEqU8np8j86lhDRXY3/+Q9TBbnW6"

echo "📝 Updating CA-Vancouver01 server with OPNsense public key..."
echo ""

psql -U "$DB_USER" -d "$DB_NAME" <<EOF
UPDATE vpn_servers 
SET wireguard_public_key = '$PUBLIC_KEY',
    updated_at = NOW()
WHERE name = 'CA-Vancouver01';

SELECT 
    id, 
    name, 
    wireguard_public_key, 
    wireguard_subnet, 
    ip_range_start, 
    ip_range_end, 
    wireguard_endpoint
FROM vpn_servers 
WHERE name = 'CA-Vancouver01';
EOF

echo ""
echo "✅ Successfully updated CA-Vancouver01 server!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure OPNsense WireGuard interface subnet to: 10.11.0.1/24"
echo "   2. Test verification: ./scripts/test-vancouver01-verification.sh testuser password 1"

