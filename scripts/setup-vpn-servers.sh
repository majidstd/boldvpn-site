#!/bin/sh
# Setup VPN Servers Configuration
# Get WireGuard public keys from OPNsense and update database

echo "=== BoldVPN Server Setup ==="
echo ""

# Check if running on FreeBSD/OPNsense
if [ ! -f /usr/local/etc/wireguard/wg0.conf ]; then
    echo "[!] WireGuard not found. Run this on OPNsense/FreeBSD with WireGuard installed."
    exit 1
fi

# Get WireGuard public key
echo "[1/3] Getting WireGuard public key..."
WG_PUBLIC_KEY=$(wg show wg0 public-key 2>/dev/null)

if [ -z "$WG_PUBLIC_KEY" ]; then
    echo "[!] Could not get WireGuard public key. Is wg0 interface up?"
    echo "    Try: wg show"
    exit 1
fi

echo "[OK] Public Key: $WG_PUBLIC_KEY"
echo ""

# Get server IP
echo "[2/3] Getting server IP address..."
SERVER_IP=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}')

if [ -z "$SERVER_IP" ]; then
    echo "[!] Could not detect server IP"
    echo "    Enter manually:"
    read SERVER_IP
fi

echo "[OK] Server IP: $SERVER_IP"
echo ""

# Get server location
echo "[3/3] Enter server location details:"
read -p "Server Name (e.g. US-Virginia): " SERVER_NAME
read -p "Hostname (e.g. vpn-us-east.boldvpn.net): " SERVER_HOSTNAME
read -p "Country Code (e.g. US): " COUNTRY_CODE
read -p "Country (e.g. United States): " COUNTRY
read -p "City (e.g. Virginia): " CITY
read -p "Flag Emoji (e.g. 🇺🇸): " FLAG_EMOJI

echo ""
echo "=== Configuration ==="
echo "Name:       $SERVER_NAME"
echo "Hostname:   $SERVER_HOSTNAME"
echo "IP:         $SERVER_IP"
echo "Location:   $FLAG_EMOJI $COUNTRY, $CITY"
echo "Public Key: $WG_PUBLIC_KEY"
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
    51820,
    '$WG_PUBLIC_KEY',
    '$SERVER_HOSTNAME:51820',
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

