#!/bin/sh
# Interactive Device Management Script
# Usage: ./scripts/manage-device.sh

set -e

API_URL="${API_URL:-https://api.boldvpn.net/api}"
DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"

# Colors disabled for FreeBSD compatibility
# Use plain text instead of ANSI codes
RED=''
GREEN=''
YELLOW=''
BLUE=''
NC=''

print_header() {
    clear
    echo "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo "${BLUE}║   Device Management Tool              ║${NC}"
    echo "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
}

print_menu() {
    echo "${GREEN}What would you like to do?${NC}"
    echo ""
    echo "  1) Create a new device"
    echo "  2) List all devices"
    echo "  3) Check device status"
    echo "  4) Remove a device"
    echo "  5) Diagnose device issues"
    echo "  6) Exit"
    echo ""
    printf "${YELLOW}Enter your choice [1-6]: ${NC}"
}

read_input() {
    read -r input || true
    echo "$input"
}

login() {
    local username="$1"
    local password="$2"
    
    printf "${BLUE}🔐 Logging in as $username...${NC}\n"
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo "${RED}❌ Login failed!${NC}"
        echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
        return 1
    fi
    
    echo "${GREEN}✅ Login successful${NC}"
    echo "$TOKEN"
    return 0
}

get_credentials() {
    printf "${YELLOW}Username: ${NC}"
    username=$(read_input)
    
    printf "${YELLOW}Password: ${NC}"
    stty -echo
    password=$(read_input)
    stty echo
    echo ""
    
    echo "$username|$password"
}

cmd_create() {
    print_header
    echo "${GREEN}Create New Device${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    creds=$(get_credentials)
    username=$(echo "$creds" | cut -d'|' -f1)
    password=$(echo "$creds" | cut -d'|' -f2)
    
    printf "${YELLOW}Device Name: ${NC}"
    device_name=$(read_input)
    
    if [ -z "$device_name" ]; then
        device_name="Device-$(date +%s)"
        echo "${BLUE}Using default name: $device_name${NC}"
    fi
    
    echo ""
    echo "${BLUE}Available Servers:${NC}"
    psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id, name, country, city FROM vpn_servers ORDER BY name;" | while IFS='|' read -r id name country city; do
        id=$(echo "$id" | tr -d ' ')
        name=$(echo "$name" | tr -d ' ')
        country=$(echo "$country" | tr -d ' ')
        city=$(echo "$city" | tr -d ' ')
        if [ -n "$id" ]; then
            echo "  $id) $name - $country, $city"
        fi
    done
    echo ""
    
    printf "${YELLOW}Server ID or Name: ${NC}"
    server_arg=$(read_input)
    
    if [ -z "$server_arg" ]; then
        server_arg="Vancouver-01"
        echo "${BLUE}Using default: $server_arg${NC}"
    fi
    
    # Get server ID
    if echo "$server_arg" | grep -q '^[0-9]*$'; then
        server_id="$server_arg"
    else
        server_id=$(psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT id FROM vpn_servers WHERE name = '$server_arg' LIMIT 1" | tr -d ' ')
        if [ -z "$server_id" ]; then
            echo "${RED}❌ Server '$server_arg' not found${NC}"
            echo ""
            printf "${YELLOW}Press Enter to continue...${NC}"
            read_input > /dev/null
            return 1
        fi
        echo "${GREEN}📋 Found server: $server_arg (ID: $server_id)${NC}"
    fi
    
    token=$(login "$username" "$password")
    if [ $? -ne 0 ]; then
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 1
    fi
    
    echo ""
    echo "${BLUE}📱 Creating device: $device_name on server ID $server_id...${NC}"
    
    create_response=$(curl -s -X POST "$API_URL/devices" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"deviceName\":\"$device_name\",\"serverId\":$server_id}")
    
    if echo "$create_response" | grep -q '"message":"Device added successfully"'; then
        device_id=$(echo "$create_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        assigned_ip=$(echo "$create_response" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
        public_key=$(echo "$create_response" | grep -o '"publicKey":"[^"]*' | cut -d'"' -f4)
        
        echo "${GREEN}✅ Device created successfully!${NC}"
        echo ""
        echo "${BLUE}📋 Device Details:${NC}"
        echo "   Device ID: $device_id"
        echo "   Device Name: $device_name"
        echo "   Assigned IP: $assigned_ip"
        public_key_short=$(echo "$public_key" | cut -c1-50)
        echo "   Public Key: ${public_key_short}..."
        echo ""
        echo "${BLUE}🔍 Verify in OPNsense:${NC}"
        echo "   VPN → WireGuard → Clients"
        echo "   Look for peer: $username-$device_name"
        echo "   IP: $assigned_ip"
    else
        echo "${RED}❌ Device creation failed!${NC}"
        echo "$create_response" | python3 -m json.tool 2>/dev/null || echo "$create_response"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_list() {
    print_header
    echo "${GREEN}List All Devices${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    creds=$(get_credentials)
    username=$(echo "$creds" | cut -d'|' -f1)
    password=$(echo "$creds" | cut -d'|' -f2)
    
    token=$(login "$username" "$password")
    if [ $? -ne 0 ]; then
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 1
    fi
    
    echo ""
    echo "Fetching devices..."
    echo ""
    
    devices_response=$(curl -s -X GET "$API_URL/devices?includeInactive=true" \
      -H "Authorization: Bearer $token")
    
    # Check if response is valid JSON and has devices
    if echo "$devices_response" | grep -q '^\['; then
        device_count=$(echo "$devices_response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null || echo "0")
        
        if [ "$device_count" = "0" ]; then
            echo "No devices found."
        else
            echo "Found $device_count device(s):"
            echo ""
            echo "$devices_response" | python3 -c "
import sys, json
try:
    devices = json.load(sys.stdin)
    for d in devices:
        status = 'Active' if d.get('isActive', True) else 'Inactive'
        print(f\"  Device ID: {d.get('id', 'N/A')}\")
        print(f\"  Name: {d.get('deviceName', 'N/A')}\")
        print(f\"  Status: {status}\")
        print(f\"  IP: {d.get('assignedIP', 'N/A')}\")
        if d.get('server'):
            print(f\"  Server: {d.get('server', {}).get('location', 'N/A')}\")
        print(f\"  Created: {d.get('createdAt', 'N/A')}\")
        print(\"\")
except Exception as e:
    print(json.dumps(devices, indent=2))
" 2>/dev/null || echo "$devices_response"
        fi
    else
        echo "Response:"
        echo "$devices_response" | python3 -m json.tool 2>/dev/null || echo "$devices_response"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_check() {
    print_header
    echo "${GREEN}Check Device Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "Check by:"
    echo "  1) Device ID"
    echo "  2) Username and Device Name"
    echo ""
    printf "${YELLOW}Enter your choice [1-2]: ${NC}"
    choice=$(read_input)
    
    if [ "$choice" = "1" ]; then
        printf "${YELLOW}Device ID: ${NC}"
        device_id=$(read_input)
        
        if [ -z "$device_id" ]; then
            echo "${RED}❌ Device ID required${NC}"
            echo ""
            printf "${YELLOW}Press Enter to continue...${NC}"
            read_input > /dev/null
            return 1
        fi
        
        echo ""
        echo "${BLUE}🔍 Checking device ID: $device_id${NC}"
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
        printf "${YELLOW}Username: ${NC}"
        username=$(read_input)
        
        printf "${YELLOW}Device Name: ${NC}"
        device_name=$(read_input)
        
        if [ -z "$username" ] || [ -z "$device_name" ]; then
            echo "${RED}❌ Username and device name required${NC}"
            echo ""
            printf "${YELLOW}Press Enter to continue...${NC}"
            read_input > /dev/null
            return 1
        fi
        
        echo ""
        echo "${BLUE}🔍 Checking device: $username / $device_name${NC}"
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
    echo "${BLUE}📋 Notes:${NC}"
    echo "  - opnsense_peer_id: UUID in OPNsense (NULL if never stored)"
    echo "  - is_active: false means device was soft-deleted"
    echo "  - Check API logs if removal failed: tail -f /var/log/boldvpn-api.log"
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_remove() {
    print_header
    echo "${GREEN}Remove Device${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    creds=$(get_credentials)
    username=$(echo "$creds" | cut -d'|' -f1)
    password=$(echo "$creds" | cut -d'|' -f2)
    
    printf "${YELLOW}Device ID: ${NC}"
    device_id=$(read_input)
    
    if [ -z "$device_id" ]; then
        echo "${RED}❌ Device ID required${NC}"
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 1
    fi
    
    echo ""
    printf "${RED}⚠️  Are you sure you want to remove device ID $device_id? (yes/no): ${NC}"
    confirm=$(read_input)
    
    if [ "$confirm" != "yes" ]; then
        echo "${BLUE}Cancelled${NC}"
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 0
    fi
    
    token=$(login "$username" "$password")
    if [ $? -ne 0 ]; then
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 1
    fi
    
    echo ""
    echo "${BLUE}🗑️  Removing device ID $device_id...${NC}"
    
    delete_response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/devices/$device_id" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json")
    
    http_code=$(echo "$delete_response" | tail -n1)
    response_body=$(echo "$delete_response" | sed '$d')
    
    echo ""
    echo "${BLUE}HTTP Status: $http_code${NC}"
    echo "${BLUE}Response:${NC}"
    echo "$response_body" | python3 -m json.tool 2>/dev/null || echo "$response_body"
    echo ""
    
    if [ "$http_code" = "200" ]; then
        echo "${GREEN}✅ Device removed successfully!${NC}"
        
        if echo "$response_body" | grep -q '"opnsenseRemoved":true'; then
            echo "${GREEN}✅ Peer removed from OPNsense${NC}"
        elif echo "$response_body" | grep -q '"opnsenseRemoved":false'; then
            echo "${YELLOW}⚠️  Warning: Peer may still exist in OPNsense${NC}"
            echo "   Check manually: VPN → WireGuard → Clients"
        fi
    elif [ "$http_code" = "500" ]; then
        echo "${RED}❌ Error: OPNsense removal failed${NC}"
        echo "   Check API logs: tail -f /var/log/boldvpn-api.log"
    else
        echo "${RED}❌ Failed to remove device${NC}"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_diagnose() {
    print_header
    echo "${GREEN}Diagnose Device Issues${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    printf "${YELLOW}Username: ${NC}"
    username=$(read_input)
    
    printf "${YELLOW}Device Name: ${NC}"
    device_name=$(read_input)
    
    if [ -z "$username" ] || [ -z "$device_name" ]; then
        echo "${RED}❌ Username and device name required${NC}"
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 1
    fi
    
    echo ""
    echo "${BLUE}🔍 Device Visibility Diagnostic${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Checking: $username / $device_name"
    echo ""
    
    # Step 1: Check database
    echo "${BLUE}📊 Step 1: Database State${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
        echo "${RED}❌ Device NOT found in database!${NC}"
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 1
    fi
    
    echo "$db_result" | awk -F'|' '{print "  ID: " $1; print "  Name: " $2; print "  OPNsense Peer ID: " ($3 ? $3 : "NULL"); print "  Is Active: " $4; print "  IP: " $5; print "  Created: " $6}'
    echo ""
    
    device_id=$(echo "$db_result" | awk -F'|' '{print $1}' | tr -d ' ')
    is_active=$(echo "$db_result" | awk -F'|' '{print $4}' | tr -d ' ')
    
    # Step 2: Check if device would be returned by API
    echo "${BLUE}🔍 Step 2: API Query Check${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ "$is_active" = "t" ] || [ "$is_active" = "true" ] || [ "$is_active" = "1" ]; then
        echo "${GREEN}✅ Device is_active = true (will be queried by API)${NC}"
    else
        echo "${RED}❌ Device is_active = false (WILL NOT be returned by API)${NC}"
        echo ""
        echo "${YELLOW}💡 This is why device is not showing in portal!${NC}"
        echo "   The sync check marked it inactive because peer wasn't found in OPNsense"
        echo ""
        echo "${BLUE}🔧 To fix:${NC}"
        echo "   1. Check if peer exists in OPNsense: VPN → WireGuard → Clients"
        echo "   2. If peer exists, check API logs for sync errors"
        echo "   3. If peer doesn't exist, remove device using option 4"
        echo ""
        printf "${YELLOW}Press Enter to continue...${NC}"
        read_input > /dev/null
        return 0
    fi
    echo ""
    
    # Step 3: Test API endpoint
    echo "${BLUE}🔍 Step 3: Test API Endpoint${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing: GET $API_URL/devices"
    echo ""
    echo "${BLUE}💡 Run 'List all devices' (option 2) to test API${NC}"
    echo ""
    echo "${BLUE}🔧 Check API logs for sync check errors:${NC}"
    echo "   tail -f /var/log/boldvpn-api.log | grep -E 'not found in OPNsense|Sync check failed'"
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

# Main loop
main() {
    while true; do
        print_header
        print_menu
        
        choice=$(read_input)
        
        # Handle empty input (just pressing Enter)
        if [ -z "$choice" ]; then
            continue
        fi
        
        case "$choice" in
            1)
                cmd_create
                ;;
            2)
                cmd_list
                ;;
            3)
                cmd_check
                ;;
            4)
                cmd_remove
                ;;
            5)
                cmd_diagnose
                ;;
            6)
                echo ""
                echo "Goodbye!"
                echo ""
                exit 0
                ;;
            *)
                echo ""
                echo "Invalid choice. Please enter 1-6."
                echo ""
                printf "Press Enter to continue... "
                read_input > /dev/null 2>&1 || true
                ;;
        esac
    done
}

# Run main loop
main
