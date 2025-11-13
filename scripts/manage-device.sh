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
    echo "  9) Exit"
    echo ""
    printf "${YELLOW}Enter your choice [1-9]: ${NC}"
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
    echo "\"SELECT ud.id, ud.username, ud.device_name, ud.opnsense_peer_id,"
    echo " ud.is_active, ud.assigned_ip, vs.name as server_name"
    echo " FROM user_devices ud"
    echo " LEFT JOIN vpn_servers vs ON ud.server_id = vs.id"
    echo " ORDER BY ud.created_at DESC;\""
    echo ""
    echo "What this shows:"
    echo "  • ALL devices from database (active AND inactive)"
    echo "  • OPNsense peer IDs"
    echo "  • Device status (is_active column)"
    echo "  • No API authentication needed"
    echo "  • Raw data without sync checks"
    echo ""
    echo "Fetching devices..."
    echo ""
    
    # Query database to show all peers with their metadata
    psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT 
        ud.id as device_id,
        ud.username,
        ud.device_name,
        ud.opnsense_peer_id,
        ud.is_active,
        ud.assigned_ip,
        vs.name as server_name,
        vs.country,
        vs.city
    FROM user_devices ud
    LEFT JOIN vpn_servers vs ON ud.server_id = vs.id
    ORDER BY ud.created_at DESC;
    "
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "This shows what's stored in the database."
    echo "Compare with option 4 to see what's in OPNsense."
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
    echo "Running command:"
    echo "curl -k -u \"\$OPNSENSE_API_KEY:\$OPNSENSE_API_SECRET\" \\"
    echo "  -X GET https://firewall.boldvpn.net:8443/api/wireguard/client/get"
    echo ""
    echo "What this shows:"
    echo "  • ALL WireGuard clients/peers in OPNsense"
    echo "  • Directly from firewall (not filtered by database)"
    echo "  • Shows UUID, name, tunnel address, public key"
    echo "  • This is the source of truth for active peers"
    echo ""
    
    # Check if OPNsense credentials are set
    OPNSENSE_KEY=$(grep -E '^OPNSENSE_API_KEY=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    OPNSENSE_SECRET=$(grep -E '^OPNSENSE_API_SECRET=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'")
    OPNSENSE_HOST=$(grep -E '^OPNSENSE_HOST=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "firewall.boldvpn.net")
    OPNSENSE_PORT=$(grep -E '^OPNSENSE_PORT=' /usr/local/boldvpn-site/api/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "8443")
    
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
    
    # Parse and display the response
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
    print(sys.stdin.read())
" <<< "$opnsense_response" 2>/dev/null || echo "$opnsense_response"
    
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

cmd_guide() {
    print_header
    echo "Device Management Guide"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "OVERVIEW"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "This tool helps you manage your VPN devices (WireGuard peers)."
    echo ""
    echo "OPTIONS EXPLAINED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1) Create a new device"
    echo "   • Creates a new WireGuard peer/device"
    echo "   • Assigns an IP address from the selected server"
    echo "   • Generates public/private key pair"
    echo "   • Adds peer to OPNsense firewall"
    echo "   • You can download config file or QR code"
    echo ""
    echo "2) List all devices"
    echo "   • Shows all your VPN devices"
    echo "   • Includes active and inactive devices"
    echo "   • Shows: Device ID, Name, Server, IP, Status, Created Date"
    echo "   • Requires login"
    echo ""
    echo "3) Check device status"
    echo "   • Check device details in database"
    echo "   • View OPNsense peer ID"
    echo "   • Check if device is active/inactive"
    echo "   • Can search by Device ID or Username + Device Name"
    echo ""
    echo "4) Remove a device"
    echo "   • Removes device from database"
    echo "   • Removes peer from OPNsense firewall"
    echo "   • Requires confirmation (type 'yes')"
    echo "   • Works for both active and inactive devices"
    echo ""
    echo "5) Diagnose device issues"
    echo "   • Troubleshoot why device is not showing in portal"
    echo "   • Checks database status"
    echo "   • Verifies if device is active/inactive"
    echo "   • Provides fix suggestions"
    echo ""
    echo "TERMINOLOGY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Device / Peer: A WireGuard client configuration"
    echo "• Active: Device exists in both database and OPNsense"
    echo "• Inactive: Device marked as deleted (soft-delete)"
    echo "• OPNsense Peer ID: UUID of the peer in OPNsense firewall"
    echo ""
    echo "TROUBLESHOOTING"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "• Device not showing in portal?"
    echo "  → Use option 5 (Diagnose) to check status"
    echo "  → Check if device is inactive in database"
    echo "  → Verify peer exists in OPNsense"
    echo ""
    echo "• Can't create device with same name?"
    echo "  → Check if old device exists (option 2)"
    echo "  → Remove old device if inactive (option 4)"
    echo ""
    echo "• Device removed but still in OPNsense?"
    echo "  → Use option 4 to remove again"
    echo "  → Check API logs: tail -f /var/log/boldvpn-api.log"
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
                echo ""
                echo "Goodbye!"
                echo ""
                exit 0
                ;;
            *)
                echo ""
                echo "Invalid choice. Please enter 1-9."
                echo ""
                printf "Press Enter to continue... "
                read_input > /dev/null 2>&1 || true
                ;;
        esac
    done
}

# Run main loop
main
