/**
 * VPN Servers API Routes
 * Manage and list available VPN servers
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');

// Admin check middleware
const requireAdmin = async (req, res, next) => {
  try {
    const { username } = req.user;
    const result = await pool.query(
      'SELECT is_admin FROM user_details WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('[!] Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Get all available VPN servers
 * Public endpoint - no auth required
 */
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        hostname,
        country_code,
        country,
        city,
        flag_emoji,
        wireguard_port,
        wireguard_public_key,
        wireguard_endpoint,
        max_connections,
        current_connections,
        load_percentage,
        status,
        latency_ms,
        bandwidth_mbps,
        is_premium,
        last_health_check
      FROM vpn_servers
      WHERE status = 'active'
      ORDER BY country, city
    `;

    const result = await pool.query(query);

    const servers = result.rows.map(server => ({
      id: server.id,
      name: server.name,
      hostname: server.hostname,
      country: server.country,
      countryCode: server.country_code,
      city: server.city,
      flag: server.flag_emoji,
      location: `${server.flag_emoji} ${server.country}, ${server.city}`,
      endpoint: server.wireguard_endpoint,
      port: server.wireguard_port,
      publicKey: server.wireguard_public_key,
      load: parseFloat(server.load_percentage),
      latency: server.latency_ms,
      bandwidth: server.bandwidth_mbps,
      isPremium: server.is_premium,
      status: server.status,
      available: server.current_connections < server.max_connections,
      lastHealthCheck: server.last_health_check
    }));

    res.json(servers);

  } catch (error) {
    console.error('[!] Get servers error:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

/**
 * Get specific server details
 */
router.get('/:serverId', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;

    const query = `
      SELECT * FROM vpn_servers
      WHERE id = $1
    `;

    const result = await pool.query(query, [serverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = result.rows[0];

    res.json({
      id: server.id,
      name: server.name,
      hostname: server.hostname,
      ipAddress: server.ip_address,
      country: server.country,
      countryCode: server.country_code,
      city: server.city,
      flag: server.flag_emoji,
      endpoint: server.wireguard_endpoint,
      port: server.wireguard_port,
      publicKey: server.wireguard_public_key,
      maxConnections: server.max_connections,
      currentConnections: server.current_connections,
      load: parseFloat(server.load_percentage),
      latency: server.latency_ms,
      bandwidth: server.bandwidth_mbps,
      isPremium: server.is_premium,
      status: server.status,
      lastHealthCheck: server.last_health_check
    });

  } catch (error) {
    console.error('[!] Get server details error:', error);
    res.status(500).json({ error: 'Failed to fetch server details' });
  }
});

/**
 * Get server statistics
 */
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_servers,
        COUNT(*) FILTER (WHERE status = 'active') as active_servers,
        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_servers,
        COUNT(*) FILTER (WHERE status = 'offline') as offline_servers,
        SUM(current_connections) as total_connections,
        AVG(load_percentage) as avg_load,
        AVG(latency_ms) as avg_latency
      FROM vpn_servers
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    res.json({
      totalServers: parseInt(stats.total_servers),
      activeServers: parseInt(stats.active_servers),
      maintenanceServers: parseInt(stats.maintenance_servers),
      offlineServers: parseInt(stats.offline_servers),
      totalConnections: parseInt(stats.total_connections) || 0,
      averageLoad: parseFloat(stats.avg_load) || 0,
      averageLatency: parseInt(stats.avg_latency) || 0
    });

  } catch (error) {
    console.error('[!] Get server stats error:', error);
    res.status(500).json({ error: 'Failed to fetch server statistics' });
  }
});

/**
 * Update server health status (admin only)
 */
router.post('/:serverId/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { load, latency, currentConnections, status } = req.body;

    const query = `
      UPDATE vpn_servers
      SET 
        current_connections = COALESCE($1, current_connections),
        load_percentage = COALESCE($2, load_percentage),
        latency_ms = COALESCE($3, latency_ms),
        status = COALESCE($4, status),
        last_health_check = NOW()
      WHERE id = $5
      RETURNING *
    `;

    const values = [currentConnections, load, latency, status, serverId];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ 
      message: 'Server health updated',
      server: result.rows[0]
    });

  } catch (error) {
    console.error('[!] Update server health error:', error);
    res.status(500).json({ error: 'Failed to update server health' });
  }
});

/**
 * Get recommended server for user (based on location, load, latency)
 */
router.get('/recommend/best', authenticateToken, async (req, res) => {
  try {
    // Simple recommendation: lowest load active server
    // In production, you'd use GeoIP to find closest server
    const query = `
      SELECT * FROM vpn_servers
      WHERE status = 'active'
      AND current_connections < max_connections
      ORDER BY load_percentage ASC, latency_ms ASC
      LIMIT 1
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No available servers' });
    }

    const server = result.rows[0];

    res.json({
      id: server.id,
      name: server.name,
      country: server.country,
      city: server.city,
      flag: server.flag_emoji,
      endpoint: server.wireguard_endpoint,
      publicKey: server.wireguard_public_key,
      reason: 'Best performance based on current load'
    });

  } catch (error) {
    console.error('[!] Get recommended server error:', error);
    res.status(500).json({ error: 'Failed to get recommendation' });
  }
});

module.exports = router;

