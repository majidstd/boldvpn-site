-- Migration: Set premium status for VPN servers
-- This migration marks certain servers as premium-only
-- Premium servers are only accessible to users with 'premium' or 'family' plan_tier

-- By default, all servers are basic (is_premium = FALSE)
-- Mark Amsterdam as premium server (example)
UPDATE vpn_servers 
SET is_premium = TRUE 
WHERE name = 'Amsterdam';

-- Keep Vancouver servers as basic (free for all users)
-- Vancouver-01 and Vancouver-02 remain is_premium = FALSE (default)

-- Verify the changes
SELECT 
    id,
    name,
    country,
    city,
    is_premium,
    status,
    available
FROM vpn_servers 
ORDER BY is_premium DESC, name;

-- Expected result:
-- Amsterdam should have is_premium = TRUE
-- Vancouver-01 and Vancouver-02 should have is_premium = FALSE

