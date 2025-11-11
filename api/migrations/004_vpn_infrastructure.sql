-- VPN Infrastructure Tables
-- For managing servers, user devices, and enhanced portal features

-- VPN Servers table
CREATE TABLE IF NOT EXISTS vpn_servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    hostname VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    flag_emoji VARCHAR(10),
    wireguard_port INTEGER NOT NULL DEFAULT 51820,
    wireguard_public_key TEXT NOT NULL,
    wireguard_endpoint VARCHAR(255) NOT NULL,
    max_connections INTEGER NOT NULL DEFAULT 1000,
    current_connections INTEGER NOT NULL DEFAULT 0,
    load_percentage DECIMAL(5, 2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    latency_ms INTEGER DEFAULT 0,
    bandwidth_mbps INTEGER DEFAULT 1000,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_health_check TIMESTAMP
);

-- User devices/configs table (FIXED: removed user_id)
CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    server_id INTEGER REFERENCES vpn_servers(id) ON DELETE SET NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    preshared_key TEXT,
    assigned_ip INET NOT NULL,
    dns_servers VARCHAR(255) DEFAULT '1.1.1.1, 1.0.0.1',
    allowed_ips VARCHAR(255) DEFAULT '0.0.0.0/0, ::/0',
    persistent_keepalive INTEGER DEFAULT 25,
    opnsense_peer_id VARCHAR(255),
    config_file TEXT,
    last_used TIMESTAMP,
    last_ip_address INET,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(username, device_name)
);

-- User preferences table (FIXED: removed user_id)
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    preferred_server_id INTEGER REFERENCES vpn_servers(id) ON DELETE SET NULL,
    auto_connect BOOLEAN DEFAULT FALSE,
    killswitch_enabled BOOLEAN DEFAULT TRUE,
    dns_leak_protection BOOLEAN DEFAULT TRUE,
    ipv6_enabled BOOLEAN DEFAULT FALSE,
    theme VARCHAR(20) DEFAULT 'dark',
    language VARCHAR(10) DEFAULT 'en',
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Connection logs (for better analytics)
CREATE TABLE IF NOT EXISTS connection_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    server_id INTEGER REFERENCES vpn_servers(id) ON DELETE SET NULL,
    device_id INTEGER REFERENCES user_devices(id) ON DELETE SET NULL,
    connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMP,
    duration_seconds INTEGER,
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    connection_quality VARCHAR(20),
    disconnect_reason VARCHAR(100)
);

-- Notifications table (FIXED: removed user_id)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- System announcements
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP NOT NULL DEFAULT NOW(),
    end_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vpn_servers_status ON vpn_servers(status);
CREATE INDEX IF NOT EXISTS idx_vpn_servers_country ON vpn_servers(country_code);
CREATE INDEX IF NOT EXISTS idx_user_devices_username ON user_devices(username);
CREATE INDEX IF NOT EXISTS idx_user_devices_active ON user_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_user_preferences_username ON user_preferences(username);
CREATE INDEX IF NOT EXISTS idx_connection_logs_username ON connection_logs(username);
CREATE INDEX IF NOT EXISTS idx_connection_logs_connected_at ON connection_logs(connected_at);
CREATE INDEX IF NOT EXISTS idx_notifications_username ON notifications(username);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_vpn_servers_updated_at ON vpn_servers;
CREATE TRIGGER update_vpn_servers_updated_at 
    BEFORE UPDATE ON vpn_servers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default VPN servers (update with your actual server info)
INSERT INTO vpn_servers (
    name, hostname, ip_address, country_code, country, city, flag_emoji,
    wireguard_port, wireguard_public_key, wireguard_endpoint, 
    max_connections, status, bandwidth_mbps
) VALUES
(
    'US-Virginia',
    'us-va.boldvpn.net',
    '192.168.1.1',
    'US',
    'United States',
    'Virginia',
    '🇺🇸',
    51820,
    'REPLACE_WITH_YOUR_PUBLIC_KEY',
    'us-va.boldvpn.net:51820',
    1000,
    'active',
    1000
),
(
    'DE-Frankfurt',
    'de-fra.boldvpn.net',
    '192.168.1.2',
    'DE',
    'Germany',
    'Frankfurt',
    '🇩🇪',
    51820,
    'REPLACE_WITH_YOUR_PUBLIC_KEY',
    'de-fra.boldvpn.net:51820',
    1000,
    'active',
    1000
)
ON CONFLICT (name) DO NOTHING;

-- Create default preferences for existing users (FIXED: removed user_id and id)
INSERT INTO user_preferences (username)
SELECT username FROM user_details
ON CONFLICT (username) DO NOTHING;

-- Add admin flag to user_details
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Make first user admin (update with your actual admin username)
UPDATE user_details SET is_admin = TRUE WHERE username = 'testuser';

-- Grant permissions to radiususer
GRANT SELECT, INSERT, UPDATE, DELETE ON vpn_servers TO radiususer;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_devices TO radiususer;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO radiususer;
GRANT SELECT, INSERT, UPDATE, DELETE ON connection_logs TO radiususer;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO radiususer;
GRANT SELECT ON announcements TO radiususer;

GRANT USAGE, SELECT ON SEQUENCE vpn_servers_id_seq TO radiususer;
GRANT USAGE, SELECT ON SEQUENCE user_devices_id_seq TO radiususer;
GRANT USAGE, SELECT ON SEQUENCE user_preferences_id_seq TO radiususer;
GRANT USAGE, SELECT ON SEQUENCE connection_logs_id_seq TO radiususer;
GRANT USAGE, SELECT ON SEQUENCE notifications_id_seq TO radiususer;
GRANT USAGE, SELECT ON SEQUENCE announcements_id_seq TO radiususer;
