#!/bin/sh
# Setup VPN Servers Configuration
# Run this on FreeBSD server to add WireGuard server info to database
# Get public key from OPNsense: VPN → WireGuard → Instances → copy Public Key

echo "=================================================="
echo "  BoldVPN Server Setup - Add WireGuard Server"
echo "=================================================="
echo ""
echo "[i] Run this script on FreeBSD server (192.168.50.2)"
echo "[i] Get WireGuard public key from OPNsense GUI:"
echo "    VPN → WireGuard → Instances → [Your Instance] → Public Key"
echo ""

# Check if running on correct server
if ! command -v psql >/dev/null 2>&1; then
    echo "[X] psql not found. Run this on FreeBSD server with PostgreSQL."
    exit 1
fi

if ! pgrep -q postgres; then
    echo "[X] PostgreSQL not running. Start it first:"
    echo "    service postgresql start"
    exit 1
fi

echo "[OK] Running on FreeBSD with PostgreSQL"
echo ""

# Get server details from user
echo "=================================================="
echo "  Enter OPNsense WireGuard Server Details"
echo "=================================================="
echo ""
read -p "Server Name (e.g. US-Virginia): " SERVER_NAME
read -p "Hostname (e.g. vpn.boldvpn.net or OPNsense public IP): " SERVER_HOSTNAME
read -p "OPNsense Public IP (e.g. 1.2.3.4): " SERVER_IP
read -p "WireGuard Public Key (from OPNsense GUI): " WG_PUBLIC_KEY
echo ""
read -p "Country Code (e.g. US): " COUNTRY_CODE
read -p "Country (e.g. United States): " COUNTRY
read -p "City (e.g. Virginia): " CITY
read -p "Flag Emoji (e.g. 🇺🇸): " FLAG_EMOJI
read -p "WireGuard Port (default 51820): " WG_PORT
WG_PORT=${WG_PORT:-51820}

echo ""
echo "=================================================="
echo "  Configuration Summary"
echo "=================================================="
echo "Name:       $SERVER_NAME"
echo "Hostname:   $SERVER_HOSTNAME"
echo "IP:         $SERVER_IP"
echo "Port:       $WG_PORT"
echo "Location:   $FLAG_EMOJI $COUNTRY, $CITY"
echo "Public Key: ${WG_PUBLIC_KEY:0:20}...${WG_PUBLIC_KEY: -10}"
echo ""

read -p "Update database with this config? [y/N] " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

# Update database
echo ""
echo "[OK] Updating database..."

psql -U radiususer -d radius <<EOF
-- Update or insert server configuration
INSERT INTO vpn_servers (
    name, hostname, ip_address, country_code, country, city, flag_emoji,
    wireguard_port, wireguard_public_key, wireguard_endpoint,
    max_connections, status, bandwidth_mbps
) VALUES (
    '$SERVER_NAME',
    '$SERVER_HOSTNAME',
    '$SERVER_IP',
    '$COUNTRY_CODE',
    '$COUNTRY',
    '$CITY',
    '$FLAG_EMOJI',
    $WG_PORT,
    '$WG_PUBLIC_KEY',
    '$SERVER_HOSTNAME:$WG_PORT',
    1000,
    'active',
    1000
)
ON CONFLICT (name) DO UPDATE SET
    hostname = EXCLUDED.hostname,
    ip_address = EXCLUDED.ip_address,
    country_code = EXCLUDED.country_code,
    country = EXCLUDED.country,
    city = EXCLUDED.city,
    flag_emoji = EXCLUDED.flag_emoji,
    wireguard_public_key = EXCLUDED.wireguard_public_key,
    wireguard_endpoint = EXCLUDED.wireguard_endpoint,
    updated_at = NOW();

-- Show current servers
SELECT name, hostname, ip_address, country, status FROM vpn_servers ORDER BY name;
EOF

echo ""
echo "[OK] Server configured successfully!"
echo ""
echo "Next steps:"
echo "1. Restart API: service boldvpn_api restart"
echo "2. Test: curl http://localhost:3000/api/servers"
echo ""

