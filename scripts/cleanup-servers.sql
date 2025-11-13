-- Clean up and add fresh VPN servers
-- Remove all existing servers
DELETE FROM vpn_servers;

-- Insert fresh servers
INSERT INTO vpn_servers (
    name, hostname, ip_address, country_code, country, city, flag_emoji,
    wireguard_port, wireguard_public_key, wireguard_endpoint,
    max_connections, status, bandwidth_mbps,
    wireguard_subnet, ip_range_start, ip_range_end, city_index
) VALUES
(
    'Vancouver-01',
    'ca-van01.boldvpn.net',
    '0.0.0.0',
    'CA',
    'Canada',
    'Vancouver',
    '🇨🇦',
    51820,
    'REPLACE_WITH_VANCOUVER01_PUBLIC_KEY',
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
    'Vancouver-02', 
    'ca-van02.boldvpn.net',
    '0.0.0.0',
    'CA',
    'Canada',
    'Vancouver',
    '🇨🇦',
    51820,
    'REPLACE_WITH_VANCOUVER02_PUBLIC_KEY',
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
    'Amsterdam',
    'nl-ams.boldvpn.net', 
    '0.0.0.0',
    'NL',
    'Netherlands',
    'Amsterdam',
    '🇳🇱',
    51820,
    'REPLACE_WITH_AMSTERDAM_PUBLIC_KEY',
    'nl-ams.boldvpn.net:51820',
    1000,
    'active',
    1000,
    '10.12.0.0/24',
    '10.12.0.2',
    '10.12.0.254',
    0
);

-- Verify the inserts
SELECT id, name, country, city, flag_emoji, status, wireguard_subnet 
FROM vpn_servers 
ORDER BY name;
