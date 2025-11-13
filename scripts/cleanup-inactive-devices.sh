#!/bin/sh
# Cleanup old inactive devices (migration from soft delete to hard delete)
# This removes all devices with is_active = false from the database

set -e

DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"

echo "Cleaning Up Inactive Devices"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script removes old inactive devices from the database."
echo "These are legacy devices from when we used soft delete (is_active = false)."
echo ""
echo "Running command:"
echo "DELETE FROM user_devices WHERE is_active = false;"
echo ""

# Show what will be deleted
echo "Devices to be deleted:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    id,
    username,
    device_name,
    assigned_ip,
    opnsense_peer_id,
    to_char(created_at, 'YYYY-MM-DD') as created
FROM user_devices 
WHERE is_active = false
ORDER BY created_at DESC;
"

echo ""
printf "Are you sure you want to delete these devices? (yes/no): "
read -r confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Deleting inactive devices..."

# Delete inactive devices
DELETE_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "
DELETE FROM user_devices WHERE is_active = false RETURNING id;
" | wc -l | tr -d ' ')

echo ""
echo "✅ Deleted $DELETE_COUNT inactive device(s)"
echo ""
echo "IPs from these devices are now available in the pool."
echo ""
echo "Remaining devices:"
psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT COUNT(*) as total_devices FROM user_devices;
"

echo ""
echo "Done! Old inactive devices have been cleaned up."

