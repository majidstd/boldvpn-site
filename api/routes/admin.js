/**
 * Admin Dashboard API Routes
 * For system administrators to manage users, servers, and monitor system
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');
const opnsense = require('../utils/opnsense');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const { username } = req.user;
    
    // Check if user has admin role (you can add a role column to user_details)
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
 * Get system overview stats
 */
router.get('/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Total users
    const usersQuery = await pool.query('SELECT COUNT(*) as total FROM user_details');
    const totalUsers = parseInt(usersQuery.rows[0].total);

    // Active users (connected in last 24h)
    const activeUsersQuery = await pool.query(`
      SELECT COUNT(DISTINCT username) as active
      FROM radacct
      WHERE acctstarttime >= NOW() - INTERVAL '24 hours'
    `);
    const activeUsers = parseInt(activeUsersQuery.rows[0].active);

    // Total bandwidth (current month)
    const bandwidthQuery = await pool.query(`
      SELECT 
        SUM(acctinputoctets + acctoutputoctets) as total_bytes,
        SUM(acctinputoctets) as upload_bytes,
        SUM(acctoutputoctets) as download_bytes
      FROM radacct
      WHERE acctstarttime >= date_trunc('month', NOW())
    `);
    const bandwidth = bandwidthQuery.rows[0];

    // Active connections right now
    const connectionsQuery = await pool.query(`
      SELECT COUNT(*) as active FROM radacct WHERE acctstoptime IS NULL
    `);
    const activeConnections = parseInt(connectionsQuery.rows[0].active);

    // Server stats
    const serversQuery = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        AVG(load_percentage) as avg_load
      FROM vpn_servers
    `);
    const servers = serversQuery.rows[0];

    // Total devices
    const devicesQuery = await pool.query(`
      SELECT COUNT(*) as total FROM user_devices WHERE is_active = true
    `);
    const totalDevices = parseInt(devicesQuery.rows[0].total);

    res.json({
      users: {
        total: totalUsers,
        active24h: activeUsers,
        activeNow: activeConnections
      },
      bandwidth: {
        totalGB: (parseInt(bandwidth.total_bytes) / 1073741824).toFixed(2),
        uploadGB: (parseInt(bandwidth.upload_bytes) / 1073741824).toFixed(2),
        downloadGB: (parseInt(bandwidth.download_bytes) / 1073741824).toFixed(2)
      },
      servers: {
        total: parseInt(servers.total),
        active: parseInt(servers.active),
        averageLoad: parseFloat(servers.avg_load) || 0
      },
      devices: {
        total: totalDevices
      },
      connections: {
        active: activeConnections
      }
    });

  } catch (error) {
    console.error('[!] Admin overview error:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

/**
 * Get all users with stats
 */
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';

    let query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.created_at,
        COUNT(DISTINCT d.id) as device_count,
        COUNT(DISTINCT r.radacctid) as total_sessions,
        MAX(r.acctstarttime) as last_connection,
        SUM(r.acctinputoctets + r.acctoutputoctets) as total_bytes
      FROM user_details u
      LEFT JOIN user_devices d ON u.username = d.username AND d.is_active = true
      LEFT JOIN radacct r ON u.username = r.username
      WHERE 1=1
    `;

    const params = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.username ILIKE $1 OR u.email ILIKE $1)`;
    }

    query += `
      GROUP BY u.id, u.username, u.email, u.created_at
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    const users = result.rows.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      deviceCount: parseInt(user.device_count),
      totalSessions: parseInt(user.total_sessions),
      lastConnection: user.last_connection,
      totalUsageGB: user.total_bytes ? (parseInt(user.total_bytes) / 1073741824).toFixed(2) : '0.00',
      createdAt: user.created_at
    }));

    res.json(users);

  } catch (error) {
    console.error('[!] Admin users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Get specific user details
 */
router.get('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId: username } = req.params;  // ✅ Actually username, not ID

    // User info
    const userQuery = await pool.query(
      'SELECT * FROM user_details WHERE username = $1',
      [username]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userQuery.rows[0];

    // User devices
    const devicesQuery = await pool.query(
      'SELECT * FROM user_devices WHERE username = $1 AND is_active = true',
      [user.username]
    );

    // User limits
    const limitsQuery = await pool.query(
      'SELECT attribute, value FROM radreply WHERE username = $1',
      [user.username]
    );

    // Recent sessions
    const sessionsQuery = await pool.query(
      `SELECT * FROM radacct WHERE username = $1 ORDER BY acctstarttime DESC LIMIT 10`,
      [user.username]
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at
      },
      devices: devicesQuery.rows,
      limits: limitsQuery.rows,
      recentSessions: sessionsQuery.rows
    });

  } catch (error) {
    console.error('[!] Admin user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * Update user limits (change plan)
 */
router.put('/users/:userId/limits', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { monthlyTraffic, maxDevices, downloadSpeed, uploadSpeed } = req.body;

    // Get username (userId param is actually username)
    const username = userId;

    // Delete existing limits
    await pool.query('DELETE FROM radreply WHERE username = $1', [username]);

    // Insert new limits
    const limits = [];
    
    if (monthlyTraffic) {
      limits.push(['Max-Monthly-Traffic', monthlyTraffic]);
    }
    if (maxDevices) {
      limits.push(['Simultaneous-Use', maxDevices]);
    }
    if (downloadSpeed) {
      limits.push(['WISPr-Bandwidth-Max-Down', downloadSpeed]);
    }
    if (uploadSpeed) {
      limits.push(['WISPr-Bandwidth-Max-Up', uploadSpeed]);
    }

    for (const [attribute, value] of limits) {
      await pool.query(
        'INSERT INTO radreply (username, attribute, op, value) VALUES ($1, $2, $3, $4)',
        [username, attribute, ':=', value.toString()]
      );
    }

    res.json({ message: 'User limits updated successfully' });

  } catch (error) {
    console.error('[!] Update user limits error:', error);
    res.status(500).json({ error: 'Failed to update user limits' });
  }
});

/**
 * Disable/enable user
 */
router.put('/users/:userId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId: username } = req.params;  // ✅ Actually username, not ID
    const { enabled } = req.body;

    if (enabled) {
      // Remove Auth-Type := Reject
      await pool.query(
        "DELETE FROM radcheck WHERE username = $1 AND attribute = 'Auth-Type'",
        [username]
      );
    } else {
      // Add Auth-Type := Reject
      await pool.query(
        "INSERT INTO radcheck (username, attribute, op, value) VALUES ($1, 'Auth-Type', ':=', 'Reject') ON CONFLICT DO NOTHING",
        [username]
      );
    }

    res.json({ message: `User ${enabled ? 'enabled' : 'disabled'} successfully` });

  } catch (error) {
    console.error('[!] Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

/**
 * Get active connections
 */
router.get('/connections/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        r.*,
        EXTRACT(EPOCH FROM (NOW() - r.acctstarttime)) as duration_seconds
      FROM radacct r
      WHERE r.acctstoptime IS NULL
      ORDER BY r.acctstarttime DESC
    `;

    const result = await pool.query(query);

    const connections = result.rows.map(conn => ({
      sessionId: conn.radacctid,
      username: conn.username,
      ipAddress: conn.framedipaddress,
      serverIP: conn.nasipaddress,
      startTime: conn.acctstarttime,
      durationSeconds: parseInt(conn.duration_seconds),
      uploadMB: (parseInt(conn.acctinputoctets) / 1048576).toFixed(2),
      downloadMB: (parseInt(conn.acctoutputoctets) / 1048576).toFixed(2)
    }));

    res.json(connections);

  } catch (error) {
    console.error('[!] Get active connections error:', error);
    res.status(500).json({ error: 'Failed to fetch active connections' });
  }
});

/**
 * Disconnect user session
 */
router.post('/connections/:sessionId/disconnect', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await pool.query(`
      UPDATE radacct 
      SET 
        acctstoptime = NOW(),
        acctsessiontime = EXTRACT(EPOCH FROM (NOW() - acctstarttime)),
        acctterminatecause = 'Admin-Disconnect'
      WHERE radacctid = $1
    `, [sessionId]);

    res.json({ message: 'Session disconnected' });

  } catch (error) {
    console.error('[!] Disconnect session error:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

/**
 * Get server health and status
 */
router.get('/servers/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Database servers
    const serversQuery = await pool.query('SELECT * FROM vpn_servers ORDER BY name');
    
    // OPNsense status
    let opnsenseStatus = { healthy: false };
    try {
      opnsenseStatus = await opnsense.healthCheck();
    } catch (error) {
      console.error('[!] OPNsense health check failed:', error.message);
    }

    // Active peers from OPNsense
    let activePeers = [];
    try {
      activePeers = await opnsense.getActivePeers();
    } catch (error) {
      console.error('[!] Get active peers failed:', error.message);
    }

    res.json({
      servers: serversQuery.rows,
      opnsense: opnsenseStatus,
      activePeers: activePeers
    });

  } catch (error) {
    console.error('[!] Server health check error:', error);
    res.status(500).json({ error: 'Failed to check server health' });
  }
});

/**
 * Get system logs (last 100 entries)
 */
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const query = `
      SELECT 
        r.radacctid,
        r.username,
        r.acctstarttime,
        r.acctstoptime,
        r.acctterminatecause,
        r.framedipaddress,
        r.nasipaddress
      FROM radacct r
      ORDER BY r.acctstarttime DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    res.json(result.rows);

  } catch (error) {
    console.error('[!] Get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * Get revenue stats (if you add billing)
 */
router.get('/revenue/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Placeholder - implement when you add billing
    res.json({
      message: 'Revenue tracking not yet implemented',
      monthlyRevenue: 0,
      totalUsers: 0,
      paidUsers: 0
    });

  } catch (error) {
    console.error('[!] Get revenue stats error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue stats' });
  }
});

module.exports = router;

