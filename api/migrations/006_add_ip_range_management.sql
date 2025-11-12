-- IP Range Management for VPN Servers
-- Database as single source of truth for IP ranges
-- 2nd octet = country code (US=1, CA=11, rest sequential)
-- 3rd octet = city/server (0-254 sequential)

-- Add IP range fields to vpn_servers table
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS wireguard_subnet VARCHAR(20);
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS ip_range_start INET;
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS ip_range_end INET;
ALTER TABLE vpn_servers ADD COLUMN IF NOT EXISTS city_index INTEGER DEFAULT 0;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_vpn_servers_subnet ON vpn_servers(wireguard_subnet);
CREATE INDEX IF NOT EXISTS idx_vpn_servers_ip_range ON vpn_servers(ip_range_start, ip_range_end);

-- Remove old servers
DELETE FROM vpn_servers WHERE name IN ('US-Virginia', 'DE-Frankfurt');

-- Insert new servers with IP ranges
INSERT INTO vpn_servers (
    name, hostname, ip_address, country_code, country, city, flag_emoji,
    wireguard_port, wireguard_public_key, wireguard_endpoint,
    max_connections, status, bandwidth_mbps,
    wireguard_subnet, ip_range_start, ip_range_end, city_index
) VALUES
(
    'CA-Vancouver01',
    'ca-van01.boldvpn.net',
    '0.0.0.0', -- Update with actual IP
    'CA',
    'Canada',
    'Vancouver',
    '🇨🇦',
    51820,
    'REPLACE_WITH_YOUR_PUBLIC_KEY',
    'ca-van01.boldvpn.net:51820',
    1000,
    'active',
    1000,
    '10.11.0.0/24',
    '10.11.0.2',
    '10.11.0.254',
    0
),
(
    'CA-Vancouver02',
    'ca-van02.boldvpn.net',
    '0.0.0.0', -- Update with actual IP
    'CA',
    'Canada',
    'Vancouver',
    '🇨🇦',
    51820,
    'REPLACE_WITH_YOUR_PUBLIC_KEY',
    'ca-van02.boldvpn.net:51820',
    1000,
    'active',
    1000,
    '10.11.1.0/24',
    '10.11.1.2',
    '10.11.1.254',
    1
),
(
    'NL-Amsterdam',
    'nl-ams.boldvpn.net',
    '0.0.0.0', -- Update with actual IP
    'NL',
    'Netherlands',
    'Amsterdam',
    '🇳🇱',
    51820,
    'REPLACE_WITH_YOUR_PUBLIC_KEY',
    'nl-ams.boldvpn.net:51820',
    1000,
    'active',
    1000,
    '10.12.0.0/24',
    '10.12.0.2',
    '10.12.0.254',
    0
)
ON CONFLICT (name) DO UPDATE SET
    wireguard_subnet = EXCLUDED.wireguard_subnet,
    ip_range_start = EXCLUDED.ip_range_start,
    ip_range_end = EXCLUDED.ip_range_end,
    city_index = EXCLUDED.city_index;

COMMENT ON COLUMN vpn_servers.wireguard_subnet IS 'WireGuard interface subnet (e.g., 10.11.0.0/24)';
COMMENT ON COLUMN vpn_servers.ip_range_start IS 'First assignable IP address (usually .2)';
COMMENT ON COLUMN vpn_servers.ip_range_end IS 'Last assignable IP address (usually .254)';
COMMENT ON COLUMN vpn_servers.city_index IS 'City/server index for 3rd octet (0-254)';

