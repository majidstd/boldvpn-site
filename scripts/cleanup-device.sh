#!/bin/sh
# Clean up a device by name (mark as inactive or delete)
# Usage: sudo ./scripts/cleanup-device.sh [username] [device_name] [delete|inactive]

set -e

DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"
USERNAME="${1}"
DEVICE_NAME="${2}"
ACTION="${3:-inactive}"

if [ -z "$USERNAME" ] || [ -z "$DEVICE_NAME" ]; then
    echo "Usage: $0 [username] [device_name] [delete|inactive]"
    echo "Example: $0 testuser MyLaptop delete"
    echo "Example: $0 testuser MyLaptop inactive"
    exit 1
fi

echo "🔍 Looking for device: $DEVICE_NAME for user: $USERNAME..."
echo ""

# Check if device exists
DEVICE_INFO=$(psql -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' <<EOF
SELECT id, device_name, is_active, opnsense_peer_id, assigned_ip
FROM user_devices 
WHERE username = '$USERNAME' AND device_name = '$DEVICE_NAME';
EOF
)

if [ -z "$DEVICE_INFO" ]; then
    echo "❌ Device not found in database"
    exit 1
fi

DEVICE_ID=$(echo "$DEVICE_INFO" | cut -d'|' -f1)
IS_ACTIVE=$(echo "$DEVICE_INFO" | cut -d'|' -f3)
OPNSENSE_PEER_ID=$(echo "$DEVICE_INFO" | cut -d'|' -f4)
ASSIGNED_IP=$(echo "$DEVICE_INFO" | cut -d'|' -f5)

echo "📋 Device Info:"
echo "   ID: $DEVICE_ID"
echo "   Name: $DEVICE_NAME"
echo "   Active: $IS_ACTIVE"
echo "   Assigned IP: $ASSIGNED_IP"
echo "   OPNsense Peer ID: $OPNSENSE_PEER_ID"
echo ""

if [ "$ACTION" = "delete" ]; then
    echo "🗑️  Deleting device from database..."
    psql -U "$DB_USER" -d "$DB_NAME" <<EOF
DELETE FROM user_devices WHERE id = $DEVICE_ID;
EOF
    echo "✅ Device deleted!"
elif [ "$ACTION" = "inactive" ]; then
    echo "🔒 Marking device as inactive..."
    psql -U "$DB_USER" -d "$DB_NAME" <<EOF
UPDATE user_devices SET is_active = false WHERE id = $DEVICE_ID;
EOF
    echo "✅ Device marked as inactive!"
else
    echo "❌ Invalid action: $ACTION (use 'delete' or 'inactive')"
    exit 1
fi

