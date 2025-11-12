#!/bin/sh
# Update CA-Vancouver01 server with OPNsense WireGuard public key
# Usage: sudo ./scripts/update-vancouver01-server.sh

# Database connection details (adjust if needed)
DB_USER="radiususer"
DB_NAME="radius"

# OPNsense WireGuard public key
PUBLIC_KEY="C4P74TRgeBqAZQKFrCwpYVKUh+XakhDZpGiMSPEJovwtR3ARjeqkbEqU8np8j86lhDRXY3/+Q9TBbnW6"

echo "Updating CA-Vancouver01 server with OPNsense public key..."

# Update the server
psql -U "$DB_USER" -d "$DB_NAME" <<EOF
UPDATE vpn_servers 
SET wireguard_public_key = '$PUBLIC_KEY',
    updated_at = NOW()
WHERE name = 'CA-Vancouver01';

-- Verify the update
SELECT id, name, wireguard_public_key, wireguard_subnet, ip_range_start, ip_range_end, wireguard_endpoint
FROM vpn_servers 
WHERE name = 'CA-Vancouver01';
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully updated CA-Vancouver01 server!"
    echo ""
    echo "Next steps:"
    echo "1. Verify OPNsense WireGuard interface subnet is set to: 10.11.0.1/24"
    echo "2. Test subnet verification: curl -X POST http://localhost:3000/api/admin/servers/1/verify-subnet -H 'Authorization: Bearer \$ADMIN_TOKEN'"
else
    echo "❌ Failed to update server. Check database connection and permissions."
    exit 1
fi

