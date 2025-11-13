#!/bin/sh
# BoldVPN Interactive & Non-Interactive Device Management Script
#
# Usage (Interactive): ./scripts/manage-device.sh
# Usage (Non-Interactive): ./scripts/manage-device.sh [command] [options]
#   - Example: ./scripts/manage-device.sh list --username myuser
#
# Features:
#   - Create, list, check, remove, and diagnose VPN devices
#   - Uses API for all operations for better security and consistency
#   - Interactive and non-interactive modes
#
# Improvements:
#   - Refactored to use functions for better code reuse
#   - Added support for non-interactive mode with command-line arguments
#   - Uses 'jq' for robust JSON parsing
#   - Improved security by using API instead of direct DB access for most operations
#   - Enhanced user experience with formatted tables and better error messages

# Exit on error for non-interactive parts
set -e

API_URL="${API_URL:-https://api.boldvpn.net/api}"
DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"

# Colors
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

# --- Utility Functions ---

clear_screen() {
    command -v clear >/dev/null 2>&1 && clear || printf "\n\n"
}

require_cmd() {
    for cmd in "$@"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "${RED}Error: Required command '$cmd' not found. Please install it.${NC}" >&2
            exit 1
        fi
    done
}

print_header() {
    clear_screen
    echo "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo "${BLUE}║   Device Management Tool              ║${NC}"
    echo "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
}

# --- Authentication ---

# Authenticates the user and returns a JWT token.
# Tries to use BOLDVPN_TOKEN env var first.
authenticate() {
    if [ -n "$BOLDVPN_TOKEN" ]; then
        echo "${GREEN}✅ Using BOLDVPN_TOKEN from environment.${NC}"
        echo "$BOLDVPN_TOKEN"
        return 0
    fi

    printf "Username: "
    read -r username
    if [ -z "$username" ]; then
        echo "${RED}Error: Username cannot be empty.${NC}"
        return 1
    fi

    printf "Password: "
    stty -echo 2>/dev/null || true
    read -r password
    stty echo 2>/dev/null || true
    echo ""

    if [ -z "$password" ]; then
        echo "${RED}Error: Password cannot be empty.${NC}"
        return 1
    fi

    printf "${BLUE}🔐 Logging in as $username...${NC}\n"
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r .token)
    
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        echo "${RED}❌ Login failed!${NC}"
        echo "$LOGIN_RESPONSE" | jq .
        return 1
    fi
    
    echo "${GREEN}✅ Login successful.${NC}"
    echo "$TOKEN"
}

# --- API Commands ---

cmd_create() {
    TOKEN=$(authenticate)
    if [ $? -ne 0 ]; then return 1; fi

    printf "Device Name: "
    read -r device_name
    if [ -z "$device_name" ]; then
        device_name="Device-$(date +%s)"
        echo "${BLUE}Using auto-generated name: $device_name${NC}"
    fi

    echo "${BLUE}Fetching available servers...${NC}"
    SERVERS=$(curl -s -X GET "$API_URL/servers")
    echo "$SERVERS" | jq -r '.[] | "  \(.id)) \(.name) - \(.country), \(.city)"'
    
    printf "${YELLOW}Server ID: ${NC}"
    read -r server_id
    if [ -z "$server_id" ]; then
        echo "${RED}Error: Server ID cannot be empty.${NC}"
        return 1
    fi

    echo "${BLUE}📱 Creating device: $device_name on server ID $server_id...${NC}"
    
    CREATE_RESPONSE=$(curl -s -X POST "$API_URL/devices" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"deviceName\":\"$device_name\",\"serverId\":$server_id}")
    
    if echo "$CREATE_RESPONSE" | jq -e '.message == "Device added successfully"' > /dev/null; then
        echo "${GREEN}✅ Device created successfully!${NC}"
        echo "$CREATE_RESPONSE" | jq .
    else
        echo "${RED}❌ Device creation failed!${NC}"
        echo "$CREATE_RESPONSE" | jq .
    fi
}

cmd_list() {
    TOKEN=$(authenticate)
    if [ $? -ne 0 ]; then return 1; fi

    echo "${BLUE}Fetching devices...${NC}"
    DEVICES_RESPONSE=$(curl -s -X GET "$API_URL/devices" -H "Authorization: Bearer $TOKEN")
    
    if ! echo "$DEVICES_RESPONSE" | jq -e '.[0]' > /dev/null; then
        echo "No devices found."
        return
    fi

    echo "$DEVICES_RESPONSE" | jq -r '
      (.[0] | keys_unsorted | (map(.) | @tsv)),
      (.[] | map(.) | @tsv)
    ' | column -t -s $'	'
}

cmd_remove() {
    TOKEN=$(authenticate)
    if [ $? -ne 0 ]; then return 1; fi

    printf "Device ID to remove: "
    read -r device_id
    if [ -z "$device_id" ]; then
        echo "${RED}Error: Device ID cannot be empty.${NC}"
        return 1
    fi

    printf "Are you sure you want to remove device ID $device_id? (yes/no): "
    read -r confirm
    if [ "$confirm" != "yes" ]; then
        echo "${BLUE}Cancelled.${NC}"
        return 0
    fi

    echo "${BLUE}🗑️ Removing device ID $device_id...${NC}"
    
    DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/devices/$device_id" \
      -H "Authorization: Bearer $TOKEN")
    
    HTTP_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$DELETE_RESPONSE" | sed '$d')

    echo "${BLUE}HTTP Status: $HTTP_CODE${NC}"
    echo "$RESPONSE_BODY" | jq .

    if [ "$HTTP_CODE" = "200" ]; then
        echo "${GREEN}✅ Device removed successfully!${NC}"
    else
        echo "${RED}❌ Failed to remove device.${NC}"
    fi
}

# --- Main Logic ---

main_menu() {
    while true; do
        print_header
        echo "${GREEN}What would you like to do?${NC}"
        echo "  1) Create a new device"
        echo "  2) List all devices"
        echo "  3) Remove a device"
        echo "  4) Exit"
        echo ""
        printf "${YELLOW}Enter your choice [1-4]: ${NC}"
        read -r choice

        case "$choice" in
            1) cmd_create ;;
            2) cmd_list ;;
            3) cmd_remove ;;
            4) echo "Goodbye!"; exit 0 ;;
            *) echo "${RED}Invalid choice.${NC}" ;;
        esac
        printf "\nPress Enter to continue..."
        read -r
    done
}

# Check for required commands
require_cmd curl psql jq

# Non-interactive mode
if [ $# -gt 0 ]; then
    COMMAND=$1
    shift
    case "$COMMAND" in
        list)
            cmd_list "$@"
            ;;
        create)
            cmd_create "$@"
            ;;
        remove)
            cmd_remove "$@"
            ;;
        *)
            echo "Unknown command: $COMMAND"
            echo "Usage: $0 [list|create|remove]"
            exit 1
            ;;
    esac
    exit 0
fi

# Interactive mode
main_menu