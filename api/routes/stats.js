/**
 * Enhanced Statistics API Routes
 * Detailed usage statistics with charts data
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');

/**
 * Get dashboard overview statistics
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Get current month usage
    const usageQuery = `
      SELECT 
        COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes,
        COALESCE(SUM(acctinputoctets), 0) as upload_bytes,
        COALESCE(SUM(acctoutputoctets), 0) as download_bytes,
        COUNT(*) as session_count,
        AVG(acctsessiontime) as avg_session_duration
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= date_trunc('month', NOW())
    `;

    const usageResult = await pool.query(usageQuery, [username]);
    const usage = usageResult.rows[0];

    // Get today's usage
    const todayQuery = `
      SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= date_trunc('day', NOW())
    `;

    const todayResult = await pool.query(todayQuery, [username]);
    const today = todayResult.rows[0];

    // Get user limits
    const limitsQuery = `
      SELECT attribute, value 
      FROM radreply 
      WHERE username = $1
    `;

    const limitsResult = await pool.query(limitsQuery, [username]);
    
    const limits = {};
    limitsResult.rows.forEach(row => {
      if (row.attribute === 'Max-Monthly-Traffic') {
        limits.monthlyLimit = parseInt(row.value);
      } else if (row.attribute === 'Simultaneous-Use') {
        limits.maxDevices = parseInt(row.value);
      } else if (row.attribute === 'WISPr-Bandwidth-Max-Down') {
        limits.maxDownSpeed = parseInt(row.value);
      } else if (row.attribute === 'WISPr-Bandwidth-Max-Up') {
        limits.maxUpSpeed = parseInt(row.value);
      }
    });

    // Get active connections
    const activeQuery = `
      SELECT COUNT(*) as active_count
      FROM radacct 
      WHERE username = $1 
      AND acctstoptime IS NULL
    `;

    const activeResult = await pool.query(activeQuery, [username]);
    const activeConnections = parseInt(activeResult.rows[0].active_count);

    // Get total devices
    const devicesQuery = `
      SELECT COUNT(*) as device_count
      FROM user_devices 
      WHERE username = $1
    `;

    const devicesResult = await pool.query(devicesQuery, [username]);
    const deviceCount = parseInt(devicesResult.rows[0].device_count);

    res.json({
      usage: {
        currentMonth: {
          totalBytes: parseInt(usage.total_bytes),
          totalGB: (parseInt(usage.total_bytes) / 1073741824).toFixed(2),
          uploadBytes: parseInt(usage.upload_bytes),
          uploadGB: (parseInt(usage.upload_bytes) / 1073741824).toFixed(2),
          downloadBytes: parseInt(usage.download_bytes),
          downloadGB: (parseInt(usage.download_bytes) / 1073741824).toFixed(2),
          sessionCount: parseInt(usage.session_count),
          avgSessionDuration: parseInt(usage.avg_session_duration) || 0
        },
        today: {
          totalBytes: parseInt(today.total_bytes),
          totalGB: (parseInt(today.total_bytes) / 1073741824).toFixed(2)
        },
        limits: {
          monthlyBytes: limits.monthlyLimit || 0,
          monthlyGB: limits.monthlyLimit ? (limits.monthlyLimit / 1073741824).toFixed(2) : 'Unlimited',
          percentageUsed: limits.monthlyLimit > 0 
            ? ((parseInt(usage.total_bytes) / limits.monthlyLimit) * 100).toFixed(1)
            : 0,
          maxDownSpeedMbps: limits.maxDownSpeed ? (limits.maxDownSpeed / 1024).toFixed(0) : 'Unlimited',
          maxUpSpeedMbps: limits.maxUpSpeed ? (limits.maxUpSpeed / 1024).toFixed(0) : 'Unlimited'
        }
      },
      connections: {
        active: activeConnections,
        maxAllowed: limits.maxDevices || 2
      },
      devices: {
        total: deviceCount,
        maxAllowed: limits.maxDevices || 2
      }
    });

  } catch (error) {
    console.error('[!] Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Get usage history for charts (last 30 days)
 */
router.get('/usage/chart', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const days = parseInt(req.query.days) || 30;

    const query = `
      SELECT 
        DATE(acctstarttime) as date,
        COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes,
        COALESCE(SUM(acctinputoctets), 0) as upload_bytes,
        COALESCE(SUM(acctoutputoctets), 0) as download_bytes,
        COUNT(*) as session_count
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= NOW() - INTERVAL '1 day' * $2
      GROUP BY DATE(acctstarttime)
      ORDER BY date ASC
    `;

    const result = await pool.query(query, [username, days]);

    // Fill in missing days with zero values
    const chartData = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dataMap = new Map();
    result.rows.forEach(row => {
      dataMap.set(row.date.toISOString().split('T')[0], row);
    });

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const data = dataMap.get(dateStr);

      chartData.push({
        date: dateStr,
        totalGB: data ? (parseInt(data.total_bytes) / 1073741824).toFixed(2) : '0.00',
        uploadGB: data ? (parseInt(data.upload_bytes) / 1073741824).toFixed(2) : '0.00',
        downloadGB: data ? (parseInt(data.download_bytes) / 1073741824).toFixed(2) : '0.00',
        sessions: data ? parseInt(data.session_count) : 0
      });
    }

    res.json(chartData);

  } catch (error) {
    console.error('[!] Get usage chart error:', error);
    res.status(500).json({ error: 'Failed to fetch usage chart data' });
  }
});

/**
 * Get usage by server (where user connects most)
 */
router.get('/usage/by-server', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    const query = `
      SELECT 
        r.nasipaddress as server_ip,
        COUNT(*) as connection_count,
        SUM(r.acctinputoctets + r.acctoutputoctets) as total_bytes,
        AVG(r.acctsessiontime) as avg_duration
      FROM radacct r
      WHERE r.username = $1
      AND r.acctstarttime >= NOW() - INTERVAL '30 days'
      GROUP BY r.nasipaddress
      ORDER BY connection_count DESC
    `;

    const result = await pool.query(query, [username]);

    const serverStats = result.rows.map(row => ({
      serverIP: row.server_ip,
      connectionCount: parseInt(row.connection_count),
      totalGB: (parseInt(row.total_bytes) / 1073741824).toFixed(2),
      avgDurationMinutes: Math.round(parseInt(row.avg_duration) / 60)
    }));

    res.json(serverStats);

  } catch (error) {
    console.error('[!] Get usage by server error:', error);
    res.status(500).json({ error: 'Failed to fetch server usage statistics' });
  }
});

/**
 * Get connection timeline (last 10 sessions)
 */
router.get('/connections/timeline', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const limit = parseInt(req.query.limit) || 10;

    const query = `
      SELECT 
        radacctid,
        acctstarttime,
        acctstoptime,
        acctsessiontime,
        acctinputoctets,
        acctoutputoctets,
        framedipaddress,
        nasipaddress
      FROM radacct 
      WHERE username = $1 
      ORDER BY acctstarttime DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [username, limit]);

    const timeline = result.rows.map(row => ({
      id: row.radacctid,
      startTime: row.acctstarttime,
      endTime: row.acctstoptime,
      duration: row.acctsessiontime,
      durationFormatted: formatDuration(row.acctsessiontime),
      uploadMB: (parseInt(row.acctinputoctets) / 1048576).toFixed(2),
      downloadMB: (parseInt(row.acctoutputoctets) / 1048576).toFixed(2),
      totalMB: ((parseInt(row.acctinputoctets) + parseInt(row.acctoutputoctets)) / 1048576).toFixed(2),
      userIP: row.framedipaddress,
      serverIP: row.nasipaddress,
      isActive: !row.acctstoptime
    }));

    res.json(timeline);

  } catch (error) {
    console.error('[!] Get connection timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch connection timeline' });
  }
});

/**
 * Get peak usage hours (when user uses VPN most)
 */
router.get('/usage/peak-hours', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    const query = `
      SELECT 
        EXTRACT(HOUR FROM acctstarttime) as hour,
        COUNT(*) as connection_count,
        SUM(acctinputoctets + acctoutputoctets) as total_bytes
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM acctstarttime)
      ORDER BY hour
    `;

    const result = await pool.query(query, [username]);

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      hourLabel: `${i.toString().padStart(2, '0')}:00`,
      connections: 0,
      totalGB: '0.00'
    }));

    result.rows.forEach(row => {
      const hour = parseInt(row.hour);
      hourlyData[hour].connections = parseInt(row.connection_count);
      hourlyData[hour].totalGB = (parseInt(row.total_bytes) / 1073741824).toFixed(2);
    });

    res.json(hourlyData);

  } catch (error) {
    console.error('[!] Get peak hours error:', error);
    res.status(500).json({ error: 'Failed to fetch peak hours data' });
  }
});

/**
 * Get monthly summary comparison (compare months)
 */
router.get('/usage/monthly-comparison', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const months = parseInt(req.query.months) || 6;

    const query = `
      SELECT 
        DATE_TRUNC('month', acctstarttime) as month,
        SUM(acctinputoctets + acctoutputoctets) as total_bytes,
        COUNT(*) as session_count,
        AVG(acctsessiontime) as avg_duration
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= NOW() - INTERVAL '1 month' * $2
      GROUP BY DATE_TRUNC('month', acctstarttime)
      ORDER BY month DESC
    `;

    const result = await pool.query(query, [username, months]);

    const monthlyData = result.rows.map(row => ({
      month: row.month,
      monthName: new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      totalGB: (parseInt(row.total_bytes) / 1073741824).toFixed(2),
      sessions: parseInt(row.session_count),
      avgDurationMinutes: Math.round(parseInt(row.avg_duration) / 60)
    }));

    res.json(monthlyData);

  } catch (error) {
    console.error('[!] Get monthly comparison error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly comparison data' });
  }
});

/**
 * Helper function to format duration
 */
function formatDuration(seconds) {
  if (!seconds) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

module.exports = router;


