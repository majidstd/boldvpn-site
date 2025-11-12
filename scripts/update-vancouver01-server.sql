-- Update CA-Vancouver01 server with OPNsense WireGuard public key
-- Run this script: psql -U radiususer -d radius -f scripts/update-vancouver01-server.sql

UPDATE vpn_servers 
SET wireguard_public_key = 'C4P74TRgeBqAZQKFrCwpYVKUh+XakhDZpGiMSPEJovwtR3ARjeqkbEqU8np8j86lhDRXY3/+Q9TBbnW6',
    updated_at = NOW()
WHERE name = 'CA-Vancouver01';

-- Verify the update
SELECT id, name, wireguard_public_key, wireguard_subnet, ip_range_start, ip_range_end
FROM vpn_servers 
WHERE name = 'CA-Vancouver01';

