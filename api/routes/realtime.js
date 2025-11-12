/**
 * Real-time Connection Monitoring
 * Provides live connection status updates
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');
const opnsense = require('../utils/opnsense');

/**
 * Get real-time connection status for user
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Get active sessions from RADIUS
    const sessionsQuery = await pool.query(`
      SELECT 
        r.radacctid,
        r.acctsessionid,
        r.framedipaddress,
        r.nasipaddress,
        r.acctstarttime,
        r.acctinputoctets,
        r.acctoutputoctets,
        EXTRACT(EPOCH FROM (NOW() - r.acctstarttime)) as duration_seconds,
        d.device_name,
        d.public_key,
        s.name as server_name,
        s.country,
        s.city,
        s.flag_emoji
      FROM radacct r
      LEFT JOIN user_devices d ON r.username = d.username
      LEFT JOIN vpn_servers s ON d.server_id = s.id
      WHERE r.username = $1
      AND r.acctstoptime IS NULL
      ORDER BY r.acctstarttime DESC
    `, [username]);

    // Get active peers from OPNsense (real-time handshake data)
    let activePeers = [];
    try {
      activePeers = await opnsense.getActivePeers();
    } catch (error) {
      console.error('[!] Failed to get active peers from OPNsense:', error.message);
    }

    const connections = sessionsQuery.rows.map(session => {
      // Find matching peer in OPNsense
      const peer = activePeers.find(p => p.publicKey === session.public_key);

      return {
        sessionId: session.radacctid,
        deviceName: session.device_name || 'Unknown Device',
        server: {
          name: session.server_name,
          location: `${session.flag_emoji} ${session.country}, ${session.city}`
        },
        ipAddress: session.framedipaddress,
        connectedAt: session.acctstarttime,
        durationSeconds: parseInt(session.duration_seconds),
        uploadBytes: parseInt(session.acctinputoctets),
        downloadBytes: parseInt(session.acctoutputoctets),
        uploadMB: (parseInt(session.acctinputoctets) / 1048576).toFixed(2),
        downloadMB: (parseInt(session.acctoutputoctets) / 1048576).toFixed(2),
        isActive: peer ? peer.isActive : false,
        lastHandshake: peer ? peer.lastHandshake : null
      };
    });

    // Get user's data usage for current month
    const usageQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes
      FROM radacct
      WHERE username = $1
      AND acctstarttime >= date_trunc('month', NOW())
    `, [username]);

    const totalBytes = parseInt(usageQuery.rows[0].total_bytes);

    // Get user limits
    const limitsQuery = await pool.query(`
      SELECT attribute, value FROM radreply WHERE username = $1
    `, [username]);

    let monthlyLimit = 0;
    let maxDevices = 2;

    limitsQuery.rows.forEach(row => {
      if (row.attribute === 'Max-Monthly-Traffic') {
        monthlyLimit = parseInt(row.value);
      } else if (row.attribute === 'Simultaneous-Use') {
        maxDevices = parseInt(row.value);
      }
    });

    const usagePercentage = monthlyLimit > 0 ? ((totalBytes / monthlyLimit) * 100).toFixed(1) : 0;

    res.json({
      timestamp: new Date().toISOString(),
      connections: {
        active: connections,
        count: connections.length,
        maxAllowed: maxDevices
      },
      usage: {
        currentBytes: totalBytes,
        currentGB: (totalBytes / 1073741824).toFixed(2),
        limitGB: monthlyLimit > 0 ? (monthlyLimit / 1073741824).toFixed(2) : 'Unlimited',
        percentage: usagePercentage,
        warningThreshold: usagePercentage >= 80
      }
    });

  } catch (error) {
    console.error('[!] Real-time status error:', error);
    res.status(500).json({ error: 'Failed to fetch real-time status' });
  }
});

/**
 * Get connection speed estimate (based on recent transfer)
 */
router.get('/speed', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Get bytes transferred in last 10 seconds for each active session
    const query = await pool.query(`
      SELECT 
        radacctid,
        acctinputoctets,
        acctoutputoctets,
        acctstarttime
      FROM radacct
      WHERE username = $1
      AND acctstoptime IS NULL
    `, [username]);

    // This is a simplified speed calculation
    // In production, you'd query at intervals and calculate delta
    const speeds = query.rows.map(session => {
      const durationSeconds = (Date.now() / 1000) - (new Date(session.acctstarttime).getTime() / 1000);
      const avgDownloadSpeed = durationSeconds > 0 ? (parseInt(session.acctoutputoctets) * 8 / durationSeconds / 1024 / 1024) : 0;
      const avgUploadSpeed = durationSeconds > 0 ? (parseInt(session.acctinputoctets) * 8 / durationSeconds / 1024 / 1024) : 0;

      return {
        sessionId: session.radacctid,
        downloadSpeedMbps: avgDownloadSpeed.toFixed(2),
        uploadSpeedMbps: avgUploadSpeed.toFixed(2)
      };
    });

    res.json(speeds);

  } catch (error) {
    console.error('[!] Speed check error:', error);
    res.status(500).json({ error: 'Failed to check connection speed' });
  }
});

/**
 * Health check - verify VPN connectivity
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Check if user has any active connections
    const activeQuery = await pool.query(`
      SELECT COUNT(*) as count FROM radacct
      WHERE username = $1 AND acctstoptime IS NULL
    `, [username]);

    const isConnected = parseInt(activeQuery.rows[0].count) > 0;

    // Check if user has devices configured
    const devicesQuery = await pool.query(`
      SELECT COUNT(*) as count FROM user_devices
      WHERE username = $1 AND is_active = true
    `, [username]);

    const hasDevices = parseInt(devicesQuery.rows[0].count) > 0;

    // Check OPNsense connectivity
    let opnsenseHealthy = false;
    try {
      const opnsenseHealth = await opnsense.healthCheck();
      opnsenseHealthy = opnsenseHealth.healthy;
    } catch (error) {
      console.error('[!] OPNsense health check failed');
    }

    res.json({
      user: {
        isConnected,
        hasDevices,
        canConnect: hasDevices && opnsenseHealthy
      },
      system: {
        opnsenseHealthy,
        databaseHealthy: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[!] Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;


