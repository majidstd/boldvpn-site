-- BoldVPN Sample Users and Plans
-- Run this after FreeRADIUS setup is complete
--
-- Usage:
--   psql -U radiususer -d radius -f create-sample-users.sql

-- Clean up existing test data
DELETE FROM radcheck WHERE username LIKE 'test%' OR username LIKE 'user%';
DELETE FROM radreply WHERE username LIKE 'test%' OR username LIKE 'user%';
DELETE FROM radgroupcheck;
DELETE FROM radgroupreply;
DELETE FROM radusergroup WHERE username LIKE 'test%' OR username LIKE 'user%';

-- ============================================
-- Create User Groups (Subscription Plans)
-- ============================================

-- Premium Plan (10GB, 100 Mbps, 3 devices)
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('premium', 'Max-Monthly-Traffic', ':=', '10737418240'),  -- 10GB in bytes
('premium', 'WISPr-Bandwidth-Max-Down', ':=', '102400'),  -- 100 Mbps (in kbps)
('premium', 'WISPr-Bandwidth-Max-Up', ':=', '102400'),
('premium', 'Simultaneous-Use', ':=', '3'),                -- 3 devices max
('premium', 'Session-Timeout', ':=', '43200');             -- 12 hours max session

-- Basic Plan (5GB, 50 Mbps, 1 device)
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('basic', 'Max-Monthly-Traffic', ':=', '5368709120'),      -- 5GB in bytes
('basic', 'WISPr-Bandwidth-Max-Down', ':=', '51200'),      -- 50 Mbps
('basic', 'WISPr-Bandwidth-Max-Up', ':=', '51200'),
('basic', 'Simultaneous-Use', ':=', '1'),                  -- 1 device only
('basic', 'Session-Timeout', ':=', '21600');               -- 6 hours max session

-- Family Plan (50GB, 200 Mbps, 10 devices)
INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('family', 'Max-Monthly-Traffic', ':=', '53687091200'),    -- 50GB in bytes
('family', 'WISPr-Bandwidth-Max-Down', ':=', '204800'),    -- 200 Mbps
('family', 'WISPr-Bandwidth-Max-Up', ':=', '204800'),
('family', 'Simultaneous-Use', ':=', '10'),                -- 10 devices
('family', 'Session-Timeout', ':=', '86400');              -- 24 hours max session

-- ============================================
-- Create Sample Users
-- ============================================

-- Test User (for testing captive portal)
INSERT INTO radcheck (username, attribute, op, value) VALUES
('testuser', 'Cleartext-Password', ':=', 'Test@123!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
('testuser', 'premium', 1);

-- Premium User Example
INSERT INTO radcheck (username, attribute, op, value) VALUES
('john@example.com', 'Cleartext-Password', ':=', 'Premium@Pass123!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
('john@example.com', 'premium', 1);

-- Basic User Example
INSERT INTO radcheck (username, attribute, op, value) VALUES
('jane@example.com', 'Cleartext-Password', ':=', 'Basic@Pass123!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
('jane@example.com', 'basic', 1);

-- Family User Example
INSERT INTO radcheck (username, attribute, op, value) VALUES
('family@example.com', 'Cleartext-Password', ':=', 'Family@Pass123!');

INSERT INTO radusergroup (username, groupname, priority) VALUES
('family@example.com', 'family', 1);

-- ============================================
-- User with Expiration Date
-- ============================================

INSERT INTO radcheck (username, attribute, op, value) VALUES
('trial@example.com', 'Cleartext-Password', ':=', 'Trial@Pass123!'),
('trial@example.com', 'Expiration', ':=', '31 Dec 2025 23:59:59');

INSERT INTO radusergroup (username, groupname, priority) VALUES
('trial@example.com', 'basic', 1);

-- ============================================
-- Verify Data
-- ============================================

\echo ''
\echo '==================================='
\echo 'Sample Users Created'
\echo '==================================='
\echo ''
\echo 'User Groups (Plans):'
SELECT DISTINCT groupname FROM radgroupreply ORDER BY groupname;

\echo ''
\echo 'Total Users:'
SELECT COUNT(DISTINCT username) as total_users FROM radcheck;

\echo ''
\echo 'User List with Plans:'
SELECT 
    rc.username,
    rug.groupname as plan,
    rc.value as password_type
FROM radcheck rc
LEFT JOIN radusergroup rug ON rc.username = rug.username
WHERE rc.attribute = 'Cleartext-Password'
ORDER BY rc.username;

\echo ''
\echo '==================================='
\echo 'Sample Users Ready!'
\echo '==================================='
\echo ''
\echo 'Test Credentials:'
\echo '  testuser / Test@123! (Premium)'
\echo '  john@example.com / Premium@Pass123!'
\echo '  jane@example.com / Basic@Pass123!'
\echo '  family@example.com / Family@Pass123!'
\echo '  trial@example.com / Trial@Pass123! (expires Dec 31)'
\echo ''


