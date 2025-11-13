#!/bin/sh
# Unified device management script
# Usage: ./scripts/manage-device.sh [command] [args...]
#
# Commands:
#   create [username] [password] [device_name] [server_name]  - Create a new device
#   list [username] [password]                                 - List all devices for user
#   check [device_id] | [username] [device_name]              - Check device status
#   remove [username] [password] [device_id]                  - Remove device (via API)
#   diagnose [username] [device_name]                         - Diagnose device visibility issues

set -e

API_URL="${API_URL:-https://api.boldvpn.net/api}"
DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"

COMMAND="${1}"
shift || true

show_usage() {
    cat <<EOF
Device Management Script
=======================

Usage: $0 [command] [args...]

Commands:
  create [username] [password] [device_name] [server_name]
    Create a new WireGuard device/peer
    Example: $0 create testuser Test@123! MyLaptop Vancouver-01

  list [username] [password]
    List all devices for a user (via API)
    Example: $0 list testuser Test@123!

  check [device_id] | [username] [device_name]
    Check device status in database
    Example: $0 check 26
    Example: $0 check testuser MyLaptop

  remove [username] [password] [device_id]
    Remove device via API (handles active/inactive devices)
    Example: $0 remove testuser Test@123! 26

  diagnose [username] [device_name]
    Diagnose why device is not showing in portal
    Example: $0 diagnose testuser MyLaptop

Environment Variables:
  API_URL      - API base URL (default: https://api.boldvpn.net/api)
  DB_USER      - Database user (default: radiususer)
  DB_NAME      - Database name (default: radius)

EOF
}

login() {
    local username="$1"
    local password="$2"
    
    echo "🔐 Logging in as $username..."
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Login failed!"
        echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
        exit 1
    fi
    
    echo "✅ Login successful"
    echo "$TOKEN"
}

cmd_create() {
    local username="${1}"
    local password="${2}"
    local device_name="${3:-TestDevice-$(date +%s)}"
    local server_arg="${4:-Vancouver-01}"
    
    if [ -z "$username" ] || [ -z "$password" ]; then
        echo "❌ Usage: $0 create [username] [password] [device_name] [server_name]"
        exit 1
    fi
    
    # Get server ID
    if echo "$server_arg" | grep -q '^[0-9]*$'; then
        server_id="$server_arg"
    else
        server_id=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM vpn_servers WHERE name = '$server_arg' LIMIT 1" | tr -d ' ')
        if [ -z "$server_id" ]; then
            echo "❌ Server '$server_arg' not found in database"
            exit 1
        fi
        echo "📋 Found server: $server_arg (ID: $server_id)"
    fi
    
    token=$(login "$username" "$password")
    
    echo ""
    echo "📱 Creating device: $device_name on server ID $server_id..."
    
    create_response=$(curl -s -X POST "$API_URL/devices" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"deviceName\":\"$device_name\",\"serverId\":$server_id}")
    
    if echo "$create_response" | grep -q '"message":"Device added successfully"'; then
        device_id=$(echo "$create_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        assigned_ip=$(echo "$create_response" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
        public_key=$(echo "$create_response" | grep -o '"publicKey":"[^"]*' | cut -d'"' -f4)
        
        echo "✅ Device created successfully!"
        echo ""
        echo "📋 Device Details:"
        echo "   Device ID: $device_id"
        echo "   Device Name: $device_name"
        echo "   Assigned IP: $assigned_ip"
        public_key_short=$(echo "$public_key" | cut -c1-50)
        echo "   Public Key: ${public_key_short}..."
        echo ""
        echo "🔍 Verify in OPNsense:"
        echo "   VPN → WireGuard → Clients"
        echo "   Look for peer: $username-$device_name"
        echo "   IP: $assigned_ip"
        echo ""
        echo "📥 Download config:"
        echo "   curl -X GET \"$API_URL/devices/$device_id/config\" -H \"Authorization: Bearer $token\" -o wireguard.conf"
        echo ""
        echo "📱 Get QR code:"
        echo "   curl -X GET \"$API_URL/devices/$device_id/qrcode\" -H \"Authorization: Bearer $token\" -o qrcode.png"
    else
        echo "❌ Device creation failed!"
        echo "$create_response" | python3 -m json.tool 2>/dev/null || echo "$create_response"
        exit 1
    fi
}

cmd_list() {
    local username="${1}"
    local password="${2}"
    
    if [ -z "$username" ] || [ -z "$password" ]; then
        echo "❌ Usage: $0 list [username] [password]"
        exit 1
    fi
    
    token=$(login "$username" "$password")
    
    echo ""
    echo "📋 Fetching devices..."
    
    devices_response=$(curl -s -X GET "$API_URL/devices?includeInactive=true" \
      -H "Authorization: Bearer $token")
    
    echo "$devices_response" | python3 -m json.tool 2>/dev/null || echo "$devices_response"
}

cmd_check() {
    local arg1="${1}"
    local arg2="${2}"
    
    if [ -z "$arg1" ]; then
        echo "❌ Usage: $0 check [device_id] | [username] [device_name]"
        exit 1
    fi
    
    if echo "$arg1" | grep -q '^[0-9]*$'; then
        # Device ID provided
        device_id="$arg1"
        echo "🔍 Checking device ID: $device_id"
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
        WHERE id = $device_id;
        "
    else
        # Username and device name provided
        username="$arg1"
        device_name="${arg2:-MyTestDevice}"
        echo "🔍 Checking device: $username / $device_name"
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
        WHERE username = '$username' AND device_name = '$device_name'
        ORDER BY created_at DESC;
        "
    fi
    
    echo ""
    echo "📋 Notes:"
    echo "  - opnsense_peer_id: UUID in OPNsense (NULL if never stored)"
    echo "  - is_active: false means device was soft-deleted"
    echo "  - Check API logs if removal failed: tail -f /var/log/boldvpn-api.log"
}

cmd_remove() {
    local username="${1}"
    local password="${2}"
    local device_id="${3}"
    
    if [ -z "$username" ] || [ -z "$password" ] || [ -z "$device_id" ]; then
        echo "❌ Usage: $0 remove [username] [password] [device_id]"
        exit 1
    fi
    
    token=$(login "$username" "$password")
    
    echo ""
    echo "🗑️  Removing device ID $device_id..."
    
    delete_response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/devices/$device_id" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
    
    http_code=$(echo "$delete_response" | tail -n1)
    response_body=$(echo "$delete_response" | sed '$d')
    
    echo "HTTP Status: $http_code"
    echo "Response:"
    echo "$response_body" | python3 -m json.tool 2>/dev/null || echo "$response_body"
    echo ""
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Device removed successfully!"
        
        if echo "$response_body" | grep -q '"opnsenseRemoved":true'; then
            echo "✅ Peer removed from OPNsense"
        elif echo "$response_body" | grep -q '"opnsenseRemoved":false'; then
            echo "⚠️  Warning: Peer may still exist in OPNsense"
            echo "   Check manually: VPN → WireGuard → Clients"
        fi
    elif [ "$http_code" = "500" ]; then
        echo "❌ Error: OPNsense removal failed"
        echo "   Check API logs: tail -f /var/log/boldvpn-api.log"
    else
        echo "❌ Failed to remove device"
    fi
}

cmd_diagnose() {
    local username="${1}"
    local device_name="${2}"
    
    if [ -z "$username" ] || [ -z "$device_name" ]; then
        echo "❌ Usage: $0 diagnose [username] [device_name]"
        exit 1
    fi
    
    echo "🔍 Device Visibility Diagnostic"
    echo "================================"
    echo ""
    echo "Checking: $username / $device_name"
    echo ""
    
    # Step 1: Check database
    echo "📊 Step 1: Database State"
    echo "-------------------------"
    db_result=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT 
        id,
        device_name,
        opnsense_peer_id,
        is_active,
        assigned_ip,
        created_at
    FROM user_devices 
    WHERE username = '$username' AND device_name = '$device_name'
    ORDER BY created_at DESC
    LIMIT 1;
    " 2>/dev/null)
    
    if [ -z "$db_result" ]; then
        echo "❌ Device NOT found in database!"
        exit 1
    fi
    
    echo "$db_result" | awk -F'|' '{print "  ID: " $1; print "  Name: " $2; print "  OPNsense Peer ID: " ($3 ? $3 : "NULL"); print "  Is Active: " $4; print "  IP: " $5; print "  Created: " $6}'
    echo ""
    
    device_id=$(echo "$db_result" | awk -F'|' '{print $1}' | tr -d ' ')
    is_active=$(echo "$db_result" | awk -F'|' '{print $4}' | tr -d ' ')
    
    # Step 2: Check if device would be returned by API
    echo "🔍 Step 2: API Query Check"
    echo "-------------------------"
    if [ "$is_active" = "t" ] || [ "$is_active" = "true" ] || [ "$is_active" = "1" ]; then
        echo "✅ Device is_active = true (will be queried by API)"
    else
        echo "❌ Device is_active = false (WILL NOT be returned by API)"
        echo ""
        echo "💡 This is why device is not showing in portal!"
        echo "   The sync check marked it inactive because peer wasn't found in OPNsense"
        echo ""
        echo "🔧 To fix:"
        echo "   1. Check if peer exists in OPNsense: VPN → WireGuard → Clients"
        echo "   2. If peer exists, check API logs for sync errors"
        echo "   3. If peer doesn't exist, remove device: $0 remove $username <password> $device_id"
        exit 0
    fi
    echo ""
    
    # Step 3: Test API endpoint
    echo "🔍 Step 3: Test API Endpoint"
    echo "---------------------------"
    echo "Testing: GET $API_URL/devices"
    echo ""
    echo "💡 Run this command to test:"
    echo "   $0 list $username <password>"
    echo ""
    echo "🔧 Check API logs for sync check errors:"
    echo "   tail -f /var/log/boldvpn-api.log | grep -E 'not found in OPNsense|Sync check failed'"
}

# Main command dispatcher
case "$COMMAND" in
    create)
        cmd_create "$@"
        ;;
    list)
        cmd_list "$@"
        ;;
    check)
        cmd_check "$@"
        ;;
    remove)
        cmd_remove "$@"
        ;;
    diagnose)
        cmd_diagnose "$@"
        ;;
    help|--help|-h|"")
        show_usage
        ;;
    *)
        echo "❌ Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac

