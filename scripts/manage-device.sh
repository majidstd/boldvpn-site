#!/bin/sh
# BoldVPN Interactive Device Management Script
# Usage: ./scripts/manage-device.sh
#
# Features:
#   - Create, list, check, remove, and diagnose VPN devices
#   - Uses both API and direct DB access
#   - Interactive and (soon) non-interactive modes
#
# Improvements:
#   - Refactored repeated code into functions
#   - Added comments for clarity
#   - Improved error handling and user experience
#   - Portability checks and help option planned

# Don't exit on error - handle errors explicitly
set +e

API_URL="${API_URL:-https://api.boldvpn.net/api}"
DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"

# Colors: FreeBSD disables ANSI, Linux uses ANSI
if [ "$(uname)" = "FreeBSD" ]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
fi

# FreeBSD fallback for clear
clear_screen() {
    if command -v clear >/dev/null 2>&1; then
        clear
    else
        printf "\n\n"
    fi
}

# Utility: Check required commands
require_cmd() {
    for cmd in "$@"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "Error: Required command '$cmd' not found. Please install it." >&2
            exit 1
        fi
    done
}

# Check for required commands
require_cmd curl psql

# Pretty-print JSON without Python: use jq if available, otherwise simple sed fallback
pretty_json() {
    if command -v jq >/dev/null 2>&1; then
        jq . 2>/dev/null
    else
        # Fallback: add newlines between top-level objects to make JSON more readable
        sed -e 's/},\s*{/,\n{/g'
    fi
}

# Parse a JSON array of objects (devices) in pure sh (best-effort)
# Input: entire JSON array on stdin
parse_devices() {
    # Remove leading/trailing brackets, split on '},{' boundary
    tr -d '\n' | sed -e 's/^\s*\[//' -e 's/\]\s*$//' -e 's/},\s*{/}\n{/g' | while IFS= read -r obj; do
        # Ensure obj starts with { and ends with }
        case "$obj" in
            '{'*'}') ;;
            *) continue ;;
        esac

        # Extract fields with simple patterns
        id=$(echo "$obj" | grep -o '"id"\s*:\s*[0-9]*' | grep -o '[0-9]*' || echo 'N/A')
        deviceName=$(echo "$obj" | sed -n 's/.*"deviceName"\s*:\s*"\([^"]*\)".*/\1/p' || echo 'N/A')
        isActive=$(echo "$obj" | grep -o '"isActive"\s*:\s*\(true\|false\|"[^"]*"\|[0-9]\)' | sed -E 's/.*:\s*//g' || echo 'N/A')
        assignedIP=$(echo "$obj" | sed -n 's/.*"assignedIP"\s*:\s*"\([^"]*\)".*/\1/p' || echo 'N/A')
        createdAt=$(echo "$obj" | sed -n 's/.*"createdAt"\s*:\s*"\([^"]*\)".*/\1/p' || echo 'N/A')
        serverLoc=$(echo "$obj" | sed -n 's/.*"server"\s*:\s*{[^}]*"location"\s*:\s*"\([^"]*\)".*/\1/p' || echo '')

        # Normalize isActive
        case "$isActive" in
            "true"|true|"t"|t|1) status='Active' ;;
            "false"|false|"f"|f|0) status='Inactive' ;;
            *) status="$isActive" ;;
        esac

        echo "  Device ID: ${id:-N/A}"
        echo "  Name: ${deviceName:-N/A}"
        echo "  Status: ${status:-N/A}"
        echo "  IP: ${assignedIP:-N/A}"
        if [ -n "$serverLoc" ]; then
            echo "  Server: $serverLoc"
        fi
        echo "  Created: ${createdAt:-N/A}"
        echo ""
    done
}
print_header() {
    clear_screen
    echo "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo "${BLUE}║   Device Management Tool              ║${NC}"
    echo "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    # Show help shortcut
    echo "Type 'help' at any menu to see options."
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
    echo "  7) Help"
    echo ""
    printf "${YELLOW}Enter your choice [1-6]: ${NC}"
}

read_input() {
    # POSIX read, handle EOF gracefully
    if ! read -r input; then
        input=""
    fi
    echo "$input"
}

# Utility: Show help
show_help() {
    echo "\nHelp - Menu Options:"
    echo "  1) Create: Add a new VPN device (API + DB)"
    echo "  2) List: Show all your devices (API)"
    echo "  3) Check: Query device status (DB)"
    echo "  4) Remove: Delete a device (API)"
    echo "  5) Diagnose: Troubleshoot device issues (DB + API)"
    echo "  6) Exit: Quit the tool"
    echo "  7) Help: Show this help message\n"
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
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
        echo "$LOGIN_RESPONSE" | pretty_json 2>/dev/null || echo "$LOGIN_RESPONSE"
        return 1
    fi
    
    echo "${GREEN}✅ Login successful${NC}"
    echo "$TOKEN"
    return 0
}

get_credentials() {
    while true; do
        printf "Username: "
        username=$(read_input)
        
        choice=$(read_input)
        # Allow 'help' at any menu
        if [ "$choice" = "help" ] || [ "$choice" = "7" ]; then
            show_help
            continue
        fi
            echo "Error: Username cannot be empty. Please try again."
            echo ""
            continue
        fi
        
        break
    done
    
    while true; do
        printf "Password: "
        # Try to hide password input, but don't fail if stty doesn't work
        stty -echo 2>/dev/null || true
        password=$(read_input)
        stty echo 2>/dev/null || true
        echo ""
        
        if [ -z "$password" ]; then
            echo "Error: Password cannot be empty. Please try again."
            echo ""
            continue
        fi
        
        break
    done
    
    echo "$username|$password"
            *)
                echo ""
                echo "Invalid choice. Please enter 1-7 or type 'help'."
                echo ""
                printf "Press Enter to continue... "
                read_input > /dev/null 2>&1 || true
                ;;
    echo ""
    echo "Please provide the following information:"
    echo ""
    
    creds=$(get_credentials)
    if [ $? -ne 0 ] || [ -z "$creds" ]; then
        echo ""
        echo "Failed to get credentials"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    username=$(echo "$creds" | cut -d'|' -f1)
    password=$(echo "$creds" | cut -d'|' -f2)
    
    echo ""
    echo "Device Information:"
    echo ""
    
    while true; do
        printf "Device Name (or press Enter for auto-generated): "
        device_name=$(read_input)
        
        if [ -z "$device_name" ]; then
            device_name="Device-$(date +%s)"
            echo "Using auto-generated name: $device_name"
            break
        fi
        
        break
    done
    
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
        echo "$create_response" | pretty_json 2>/dev/null || echo "$create_response"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_list() {
    print_header
    echo "List All Devices"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Please login to view your devices:"
    echo ""
    
    creds=$(get_credentials)
    if [ $? -ne 0 ] || [ -z "$creds" ]; then
        echo ""
        echo "Failed to get credentials"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    username=$(echo "$creds" | cut -d'|' -f1)
    password=$(echo "$creds" | cut -d'|' -f2)
    
    if [ -z "$username" ] || [ -z "$password" ]; then
        echo "Error: Invalid credentials"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    token=$(login "$username" "$password")
    if [ $? -ne 0 ] || [ -z "$token" ]; then
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    echo ""
    echo "Fetching devices..."
    echo ""
    
    devices_response=$(curl -s -X GET "$API_URL/devices?includeInactive=true" \
      -H "Authorization: Bearer $token")
    
    # Check if response is valid JSON and has devices
    if echo "$devices_response" | grep -q '^\['; then
        device_count=$(echo "$devices_response" | tr -d '\n' | sed -e 's/^\s*\[//' -e 's/\]\s*$//' -e 's/},\s*{/}\n{/g' | grep -c '^{' 2>/dev/null || echo "0")

        if [ "$device_count" = "0" ]; then
            echo "No devices found."
        else
            echo "Found $device_count device(s):"
            echo ""
            # Parse devices in pure shell (best-effort)
            echo "$devices_response" | parse_devices 2>/dev/null || echo "$devices_response"
        fi
    else
        echo "Response:"
        echo "$devices_response" | pretty_json 2>/dev/null || echo "$devices_response"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_check() {
    print_header
    echo "Check Device Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "How would you like to check the device?"
    echo "  1) By Device ID"
    echo "  2) By Username and Device Name"
    echo ""
    
    while true; do
        printf "Enter your choice [1-2]: "
        choice=$(read_input)
        
        if [ "$choice" != "1" ] && [ "$choice" != "2" ]; then
            echo "Error: Please enter 1 or 2"
            echo ""
            continue
        fi
        
        break
    done
    
    echo ""
    
    if [ "$choice" = "1" ]; then
        while true; do
            printf "Device ID: "
            device_id=$(read_input)
            
            if [ -z "$device_id" ]; then
                echo "Error: Device ID cannot be empty. Please try again."
                echo ""
                continue
            fi
            
            # Check if it's a number
            if ! echo "$device_id" | grep -q '^[0-9][0-9]*$'; then
                echo "Error: Device ID must be a number. Please try again."
                echo ""
                continue
            fi
            
            break
        done
        
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
        while true; do
            printf "Username: "
            username=$(read_input)
            
            if [ -z "$username" ]; then
                echo "Error: Username cannot be empty. Please try again."
                echo ""
                continue
            fi
            
            break
        done
        
        echo ""
        
        while true; do
            printf "Device Name: "
            device_name=$(read_input)
            
            if [ -z "$device_name" ]; then
                echo "Error: Device name cannot be empty. Please try again."
                echo ""
                continue
            fi
            
            break
        done
        
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
    echo "Remove Device"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Please login:"
    echo ""
    
    creds=$(get_credentials)
    if [ $? -ne 0 ] || [ -z "$creds" ]; then
        echo ""
        echo "Failed to get credentials"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    username=$(echo "$creds" | cut -d'|' -f1)
    password=$(echo "$creds" | cut -d'|' -f2)
    
    if [ -z "$username" ] || [ -z "$password" ]; then
        echo "Error: Invalid credentials"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    echo ""
    while true; do
        printf "Device ID to remove: "
        device_id=$(read_input)
        
        if [ -z "$device_id" ]; then
            echo "Error: Device ID cannot be empty. Please try again."
            echo ""
            continue
        fi
        
        # Check if it's a number
        if ! echo "$device_id" | grep -q '^[0-9][0-9]*$'; then
            echo "Error: Device ID must be a number. Please try again."
            echo ""
            continue
        fi
        
        break
    done
    
    echo ""
    printf "Are you sure you want to remove device ID $device_id? (yes/no): "
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
    echo "$response_body" | pretty_json 2>/dev/null || echo "$response_body"
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
    echo "Diagnose Device Issues"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Please provide the following information:"
    echo ""
    
    while true; do
        printf "Username: "
        username=$(read_input)
        
        if [ -z "$username" ]; then
            echo "Error: Username cannot be empty. Please try again."
            echo ""
            continue
        fi
        
        break
    done
    
    echo ""
    
    while true; do
        printf "Device Name: "
        device_name=$(read_input)
        
        if [ -z "$device_name" ]; then
            echo "Error: Device name cannot be empty. Please try again."
            echo ""
            continue
        fi
        
        break
    done
    
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
