#!/bin/sh
# Interactive Device Management Script
# Usage: ./scripts/manage-device.sh

# Don't exit on error - handle errors explicitly
set +e

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
    echo "  2) List devices (Portal/User View - via API)"
    echo "  3) List devices (Database - direct SQL)"
    echo "  4) List devices (OPNsense - direct API)"
    echo "  5) Check device status (Database)"
    echo "  6) Remove a device"
    echo "  7) Diagnose device issues"
    echo "  8) Show guide / Help"
    echo "  9) Sync DB to OPNsense (Manual)"
    echo " 10) Exit"
    echo ""
    printf "${YELLOW}Enter your choice [1-10]: ${NC}"
}

read_input() {
    read -r input
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
    # Send all prompts to stderr (>&2) so they display even when output is captured
    echo "LOGIN REQUIRED" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2

    while true; do
        printf "Username= " >&2
        read -r username

        if [ -z "$username" ]; then
            echo "" >&2
            echo "[ERROR] Username cannot be empty. Please try again." >&2
            echo "" >&2
            continue
        fi

        break
    done

    echo "" >&2

    while true; do
        printf "Password= " >&2
        # Hide password input (no echo to terminal)
        stty -echo 2>/dev/null || true
        read -r password
        stty echo 2>/dev/null || true
        echo "" >&2

        if [ -z "$password" ]; then
            echo "" >&2
            echo "[ERROR] Password cannot be empty. Please try again." >&2
            echo "" >&2
            continue
        fi

        break
    done

    echo "" >&2
    # Only send the result to stdout (this is what gets captured in creds variable)
    echo "$username|$password"
    return 0
}

cmd_create() {
    print_header
    echo "Create New Device"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Step 1: Login"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    printf "${YELLOW}Press Enter to continue to device setup...${NC} "
    read_input > /dev/null 2>&1 || true
    echo ""
    echo "Step 2: Device Information"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Creating Device: $device_name on Server: $server_id"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Running command:"
    echo "TOKEN=\$(curl -s -X POST \"$API_URL/auth/login\" -H \"Content-Type: application/json\" -d '{\"username\":\"$username\",\"password\":\"$password\"}' | grep -o '\"token\":\"[^\"]*' | cut -d'\"' -f4) && curl -X POST \"$API_URL/devices\" -H \"Authorization: Bearer \$TOKEN\" -H \"Content-Type: application/json\" -d '{\"deviceName\":\"$device_name\",\"serverId\":$server_id}'"
    echo ""
    
    # Execute the one-liner command
    create_response=$(TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
      | grep -o '"token":"[^"]*' | cut -d'"' -f4) && \
    curl -s -X POST "$API_URL/devices" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"deviceName\":\"$device_name\",\"serverId\":$server_id}")
    
    if echo "$create_response" | grep -q '"message":"Device added successfully"'; then
        device_id=$(echo "$create_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
        assigned_ip=$(echo "$create_response" | grep -o '"assignedIP":"[^"]*' | cut -d'"' -f4)
        public_key=$(echo "$create_response" | grep -o '"publicKey":"[^"]*' | cut -d'"' -f4)
        
        echo "✅ Device created successfully!"
        echo ""
        echo "  Device ID: $device_id"
        echo "  Device Name: $device_name"
        echo "  Assigned IP: $assigned_ip"
        public_key_short=$(echo "$public_key" | cut -c1-50)
        echo "  Public Key: ${public_key_short}..."
        echo ""
        echo "Verify in OPNsense:"
        echo "  VPN → WireGuard → Clients → Look for: $username-$device_name"
    else
        echo "❌ Device creation failed!"
        echo ""
        echo "Response:"
        echo "$create_response"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_list() {
    print_header
    echo "List All Devices"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Data Source: API → Database (with OPNsense sync check)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Running command:"
    echo "  1. Login: POST $API_URL/auth/login"
    echo "     Username: $username"
    echo "     Password: ********"
    echo ""
    echo "  2. Get Devices: GET $API_URL/devices?includeInactive=true"
    echo "     Authorization: Bearer <token>"
    echo ""
    echo "What this does:"
    echo "  • Queries devices from database where is_active=true"
    echo "  • Verifies each device exists in OPNsense"
    echo "  • Marks as inactive if peer deleted from OPNsense"
    echo "  • Returns only devices that exist in OPNsense"
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
        print('  Device ID: ' + str(d.get('id', 'N/A')))
        print('  Name: ' + str(d.get('deviceName', 'N/A')))
        print('  Status: ' + status)
        print('  IP: ' + str(d.get('assignedIP', 'N/A')))
        if d.get('server'):
            server_loc = d.get('server', {}).get('location', 'N/A')
            print('  Server: ' + str(server_loc))
        print('  Created: ' + str(d.get('createdAt', 'N/A')))
        print('')
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

cmd_list_database() {
    print_header
    echo "List Devices from Database (Direct Query)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Data Source: Database (Direct SQL Query)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Running command:"
    echo "psql -U $DB_USER -d $DB_NAME -c \\"
    echo "\"SELECT ud.id, ud.username, ud.device_name,"
    echo " ud.opnsense_peer_id, ud.assigned_ip,"
    echo " vs.name as server, vs.country, vs.city,"
    echo " ud.created_at"
    echo " FROM user_devices ud"
    echo " LEFT JOIN vpn_servers vs ON ud.server_id = vs.id"
    echo " ORDER BY ud.created_at DESC;\""
    echo ""
    echo "What this shows:"
    echo "  • ALL devices in database (hard delete - no inactive devices)"
    echo "  • OPNsense peer UUIDs"
    echo "  • Assigned IP addresses"
    echo "  • Server assignments"
    echo "  • No API authentication needed"
    echo "  • Raw data - useful for troubleshooting"
    echo ""
    echo "Note: is_active column still exists in schema but is no longer used"
    echo "      All devices shown are active (deleted devices are removed)"
    echo ""
    echo "Fetching devices..."
    echo ""
    
    # Query database to show all peers with their metadata
    psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        ud.id,
        ud.username,
        ud.device_name,
        ud.opnsense_peer_id,
        ud.assigned_ip,
        vs.name as server,
        vs.country || ', ' || vs.city as location,
        to_char(ud.created_at, 'YYYY-MM-DD HH24:MI') as created
    FROM user_devices ud
    LEFT JOIN vpn_servers vs ON ud.server_id = vs.id
    ORDER BY ud.created_at DESC;
    "
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Database State:"
    echo "  • Rows shown = Active devices"
    echo "  • Deleted devices are removed from database (hard delete)"
    echo "  • Compare with option 4 (OPNsense) to find sync issues"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_list_opnsense() {
    print_header
    echo "List Devices from OPNsense (Direct API)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Data Source: OPNsense Firewall (Direct API Call)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Read OPNsense credentials from .env first
    OPNSENSE_KEY=$(grep -E '^OPNSENSE_API_KEY=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    OPNSENSE_SECRET=$(grep -E '^OPNSENSE_API_SECRET=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    OPNSENSE_HOST=$(grep -E '^OPNSENSE_HOST=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "firewall.boldvpn.net")
    OPNSENSE_PORT=$(grep -E '^OPNSENSE_PORT=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "8443")
    
    echo "OPNsense Configuration:"
    echo "  Host: $OPNSENSE_HOST"
    echo "  Port: $OPNSENSE_PORT"
    echo "  Source: /usr/local/boldvpn-site/api/.env"
    echo ""
    echo "Running command:"
    echo "curl -k -u \"\$OPNSENSE_API_KEY:\$OPNSENSE_API_SECRET\" \\"
    echo "  -X GET https://${OPNSENSE_HOST}:${OPNSENSE_PORT}/api/wireguard/client/get"
    echo ""
    echo "What this shows:"
    echo "  • ALL WireGuard clients/peers in OPNsense"
    echo "  • Directly from firewall (not filtered by database)"
    echo "  • Shows UUID, name, tunnel address, public key"
    echo "  • This is the source of truth for active peers"
    echo ""
    
    if [ -z "$OPNSENSE_KEY" ] || [ -z "$OPNSENSE_SECRET" ]; then
        echo "Error: OPNsense API credentials not found in /usr/local/boldvpn-site/api/.env"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    echo "Fetching WireGuard clients from OPNsense..."
    echo ""
    
    # Call OPNsense API
    opnsense_response=$(curl -s -k -u "${OPNSENSE_KEY}:${OPNSENSE_SECRET}" \
      -X GET "https://${OPNSENSE_HOST}:${OPNSENSE_PORT}/api/wireguard/client/get")
    
    # Parse and display the response (using pipe instead of here-string for FreeBSD compatibility)
    echo "$opnsense_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'client' in data and 'clients' in data['client'] and 'client' in data['client']['clients']:
        clients = data['client']['clients']['client']
        if isinstance(clients, dict):
            print('Found ' + str(len(clients)) + ' peer(s) in OPNsense:')
            print('')
            for uuid, client in clients.items():
                print('  UUID: ' + str(uuid))
                print('  Name: ' + str(client.get('name', 'N/A')))
                print('  Tunnel Address: ' + str(client.get('tunneladdress', 'N/A')))
                print('  Public Key: ' + str(client.get('pubkey', 'N/A'))[:50] + '...')
                print('  Enabled: ' + str(client.get('enabled', 'N/A')))
                print('')
        else:
            print('No peers found in OPNsense')
    else:
        print('Response:')
        print(json.dumps(data, indent=2))
except Exception as e:
    print('Error parsing response: ' + str(e))
    print('Raw response:')
    print(data)
" 2>/dev/null || echo "$opnsense_response"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "This shows actual peers in OPNsense firewall."
    echo "Compare with option 3 (Database) to find sync issues."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    printf "${YELLOW}Press Enter to login and continue...${NC} "
    read_input > /dev/null 2>&1 || true
    echo ""
    echo "Step 1: Login"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Removing Device ID: $device_id"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Running command:"
    echo "TOKEN=\$(curl -s -X POST \"$API_URL/auth/login\" -H \"Content-Type: application/json\" -d '{\"username\":\"$username\",\"password\":\"...\"}' | grep -o '\"token\":\"[^\"]*' | cut -d'\"' -f4) && curl -X DELETE \"$API_URL/devices/$device_id\" -H \"Authorization: Bearer \$TOKEN\""
    echo ""
    
    # Execute using one-liner approach
    delete_response=$(TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
      | grep -o '"token":"[^"]*' | cut -d'"' -f4) && \
    curl -s -X DELETE "$API_URL/devices/$device_id" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$delete_response" | grep -q '"message"'; then
        echo "✅ Device removed successfully!"
        echo ""
        echo "Response:"
        echo "$delete_response" | python3 -m json.tool 2>/dev/null || echo "$delete_response"
        echo ""
        
        if echo "$delete_response" | grep -q '"ipFreed"'; then
            ip_freed=$(echo "$delete_response" | grep -o '"ipFreed":"[^"]*' | cut -d'"' -f4)
            echo "IP Address $ip_freed has been returned to the pool"
        fi
    else
        echo "❌ Device removal failed!"
        echo ""
        echo "Response:"
        echo "$delete_response"
    fi
    
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
}

cmd_guide() {
    print_header
    echo "Device Management Guide"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "OVERVIEW"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Manage your VPN devices (WireGuard peers) via API, Database, or OPNsense."
    echo ""
    echo "OPTIONS EXPLAINED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1) Create a new device"
    echo "   • Creates WireGuard peer via API (authenticates user)"
    echo "   • Assigns next available IP from server pool"
    echo "   • Generates keypair and adds peer to OPNsense"
    echo "   • Command: Login + POST /devices"
    echo ""
    echo "2) List devices (Portal/User View - via API)"
    echo "   • Shows devices as they appear in portal"
    echo "   • Requires login (username + password)"
    echo "   • Syncs with OPNsense (deletes if peer not found)"
    echo "   • Command: Login + GET /devices"
    echo ""
    echo "3) List devices (Database - direct SQL)"
    echo "   • Shows ALL devices in database"
    echo "   • No authentication required"
    echo "   • Raw data for troubleshooting"
    echo "   • Command: SELECT FROM user_devices"
    echo ""
    echo "4) List devices (OPNsense - direct API)"
    echo "   • Shows actual peers in OPNsense firewall"
    echo "   • No authentication required (uses .env credentials)"
    echo "   • Source of truth for active peers"
    echo "   • Command: GET /wireguard/client/get"
    echo ""
    echo "5) Check device status (Database)"
    echo "   • Query specific device by ID or name"
    echo "   • Shows peer UUID, IP, server"
    echo "   • Direct database access"
    echo ""
    echo "6) Remove a device"
    echo "   • HARD DELETE from database (row removed permanently)"
    echo "   • Removes peer from OPNsense"
    echo "   • IP automatically returned to pool"
    echo "   • Requires confirmation (type 'yes')"
    echo "   • Command: Login + DELETE /devices/:id"
    echo ""
    echo "7) Diagnose device issues"
    echo "   • Troubleshoot visibility problems"
    echo "   • Check database vs OPNsense sync"
    echo "   • Provides fix suggestions"
    echo ""
    echo "DATA FLOW"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Portal → API → Database ← Sync → OPNsense"
    echo ""
    echo "• Option 2: API (syncs Database ↔ OPNsense)"
    echo "• Option 3: Database (raw SQL query)"
    echo "• Option 4: OPNsense (direct firewall API)"
    echo ""
    echo "TERMINOLOGY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Device/Peer: WireGuard client configuration"
    echo "• Hard Delete: Row removed from database (vs soft delete)"
    echo "• Sync Check: Verify database matches OPNsense state"
    echo "• OPNsense Peer ID: UUID of peer in firewall"
    echo "• IP Pool: Available IP addresses from server subnet"
    echo ""
    echo "HARD DELETE IMPLEMENTATION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Deleted devices are REMOVED from database (not marked inactive)"
    echo "• IPs automatically return to pool when device deleted"
    echo "• No garbage data in database"
    echo "• Sync checks auto-delete orphaned devices"
    echo "• is_active column still exists in schema but is unused"
    echo ""
    echo "TROUBLESHOOTING"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "• Device limit reached error?"
    echo "  → Check option 3 (Database) for device count"
    echo "  → Check option 4 (OPNsense) for actual peers"
    echo "  → Delete from OPNsense manually triggers auto-sync"
    echo "  → Restart API: sudo service boldvpn_api restart"
    echo ""
    echo "• Device not showing in portal?"
    echo "  → Use option 7 (Diagnose)"
    echo "  → Compare option 3 (DB) vs option 4 (OPNsense)"
    echo "  → Check if peer exists in OPNsense"
    echo ""
    echo "• Can't create device with same name?"
    echo "  → Check option 3 to see if it exists"
    echo "  → Remove old device first (option 6)"
    echo ""
    echo "• Device deleted but peer still in OPNsense?"
    echo "  → Remove again using option 6"
    echo "  → Check logs: tail -f /var/log/boldvpn-api.log"
    echo ""
    echo "USEFUL COMMANDS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Restart API: sudo service boldvpn_api restart"
    echo "• View logs: tail -f /var/log/boldvpn-api.log"
    echo "• Count devices: psql -U radiususer -d radius -c 'SELECT COUNT(*) FROM user_devices;'"
    echo "• Check limit: psql -U radiususer -d radius -c \"SELECT value FROM radreply WHERE username='testuser' AND attribute='Simultaneous-Use';\""
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

cmd_sync() {
    print_header
    echo "${BLUE}Sync DB to OPNsense${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This will synchronize the database to OPNsense:"
    echo "  • Add missing devices from DB to OPNsense"
    echo "  • Remove orphaned peers from OPNsense (not in DB)"
    echo "  • Sync peer IDs in database"
    echo ""
    echo "${YELLOW}Note: Database is the source of truth.${NC}"
    echo "      OPNsense will be updated to match the database."
    echo ""
    echo "${BLUE}Using OPNsense API key from .env file${NC}"
    echo ""
    printf "Press Enter to continue... "
    read_input > /dev/null 2>&1 || true
    
    echo ""
    echo "${BLUE}🔄 Running sync...${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Get script directory and project root
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    ENV_FILE="$PROJECT_ROOT/api/.env"
    
    if [ ! -f "$ENV_FILE" ]; then
        echo "${RED}❌ .env file not found: $ENV_FILE${NC}"
        echo ""
        printf "Press Enter to continue... "
        read_input > /dev/null 2>&1 || true
        return 1
    fi
    
    echo "Running command:"
    echo "cd $PROJECT_ROOT/api && node -e \"require('dotenv').config(); require('./utils/syncOpnsense').syncOpnsensePeers().then(() => process.exit(0)).catch(e => { console.error('Sync failed:', e.message); process.exit(1); });\""
    echo ""
    
    # Run sync directly using Node.js inline
    cd "$PROJECT_ROOT/api" || exit 1
    node -e "require('dotenv').config(); require('./utils/syncOpnsense').syncOpnsensePeers().then(() => process.exit(0)).catch(e => { console.error('Sync failed:', e.message); process.exit(1); });"
    SYNC_EXIT_CODE=$?
    
    echo ""
    if [ $SYNC_EXIT_CODE -eq 0 ]; then
        echo "${GREEN}✅ Sync completed successfully!${NC}"
    else
        echo "${RED}❌ Sync failed (exit code: $SYNC_EXIT_CODE)${NC}"
    fi
    
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
                cmd_list_database
                ;;
            4)
                cmd_list_opnsense
                ;;
            5)
                cmd_check
                ;;
            6)
                cmd_remove
                ;;
            7)
                cmd_diagnose
                ;;
            8)
                cmd_guide
                ;;
            9)
                cmd_sync
                ;;
            10)
                echo ""
                echo "Goodbye!"
                echo ""
                exit 0
                ;;
            *)
                echo ""
                echo "Invalid choice. Please enter 1-10."
                echo ""
                printf "Press Enter to continue... "
                read_input > /dev/null 2>&1 || true
                ;;
        esac
    done
}

# Run main loop
main
