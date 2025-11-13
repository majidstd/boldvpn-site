#!/bin/sh
# Check device state in database
# Usage: ./scripts/check-device-db.sh [device_id] or [username] [device_name]

set -e

DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"

if [ -z "$1" ]; then
    echo "Usage: $0 [device_id]"
    echo "   or: $0 [username] [device_name]"
    exit 1
fi

# Check if first arg is numeric (device ID) or string (username)
if echo "$1" | grep -q '^[0-9]*$'; then
    DEVICE_ID="$1"
    echo "🔍 Checking device ID: $DEVICE_ID"
    echo ""
    
    psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        id,
        username,
        device_name,
        opnsense_peer_id,
        is_active,
        assigned_ip,
        created_at
    FROM user_devices 
    WHERE id = $DEVICE_ID;
    "
else
    USERNAME="$1"
    DEVICE_NAME="${2:-MyTestDevice}"
    echo "🔍 Checking device: $USERNAME / $DEVICE_NAME"
    echo ""
    
    psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        id,
        username,
        device_name,
        opnsense_peer_id,
        is_active,
        assigned_ip,
        created_at
    FROM user_devices 
    WHERE username = '$USERNAME' AND device_name = '$DEVICE_NAME'
    ORDER BY created_at DESC;
    "
fi

echo ""
echo "📋 Summary:"
echo "  - If opnsense_peer_id is NULL, the peer ID was never stored"
echo "  - If is_active is false, device was soft-deleted"
echo "  - Check API logs for removal attempts"

