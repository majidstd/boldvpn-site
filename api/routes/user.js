const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { requireAuth, validatePasswordChange } = require('../middleware/auth');
const {
  getUserAttributes,
  getUserUsage,
  getCurrentSession,
  updateUserPassword
} = require('../utils/database');

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { username } = req.user;

    // Get user attributes
    const attributes = await getUserAttributes(username);

    // Get usage statistics
    const usage = await getUserUsage(username);

    // Get current session
    const currentSession = await getCurrentSession(username);

    // Convert bytes to human readable
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Convert seconds to human readable
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    res.json({
      username,
      limits: {
        maxTraffic: parseInt(attributes['Max-Monthly-Traffic']) || 0,
        maxDownSpeed: parseInt(attributes['WISPr-Bandwidth-Max-Down']) || 0,
        maxUpSpeed: parseInt(attributes['WISPr-Bandwidth-Max-Up']) || 0,
        maxDevices: parseInt(attributes['Simultaneous-Use']) || 1
      },
      usage: {
        upload: formatBytes(parseInt(usage.upload_bytes) || 0),
        download: formatBytes(parseInt(usage.download_bytes) || 0),
        total: formatBytes((parseInt(usage.upload_bytes) || 0) + (parseInt(usage.download_bytes) || 0)),
        sessionTime: formatTime(parseInt(usage.session_time) || 0),
        sessionCount: parseInt(usage.session_count) || 0,
        lastSession: usage.last_session
      },
      currentSession: currentSession ? {
        startTime: currentSession.acctstarttime,
        sessionTime: formatTime(Date.now() / 1000 - new Date(currentSession.acctstarttime).getTime() / 1000),
        nasIp: currentSession.nasipaddress,
        framedIp: currentSession.framedipaddress
      } : null
    });

  } catch (error) {
    console.error('[!] Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Change password
router.put('/password', requireAuth, validatePasswordChange, async (req, res) => {
  try {
    const { username } = req.user;
    const { currentPassword, newPassword } = req.body;

    // Get current user
    const { getUserByUsername } = require('../utils/database');
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.value);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await updateUserPassword(username, newPasswordHash);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('[!] Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// Get usage history (last 30 days)
router.get('/usage-history', requireAuth, async (req, res) => {
  try {
    const { username } = req.user;
    const days = parseInt(req.query.days, 10) || 30;

    const { query } = require('../utils/database');
    const result = await query(`
      SELECT
        DATE(acctstarttime) as date,
        SUM(acctinputoctets) as upload_bytes,
        SUM(acctoutputoctets) as download_bytes,
        SUM(acctsessiontime) as session_time,
        COUNT(*) as sessions
      FROM radacct
      WHERE username = $1
        AND acctstarttime >= CURRENT_DATE - ($2 * INTERVAL '1 day')
      GROUP BY DATE(acctstarttime)
      ORDER BY date DESC
    `, [username, days]);

    // Format the results
    const formatBytes = (bytes) => {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const history = result.rows.map(row => ({
      date: row.date,
      upload: formatBytes(parseInt(row.upload_bytes) || 0),
      download: formatBytes(parseInt(row.download_bytes) || 0),
      total: formatBytes((parseInt(row.upload_bytes) || 0) + (parseInt(row.download_bytes) || 0)),
      sessionTime: Math.round((parseInt(row.session_time) || 0) / 60), // minutes
      sessions: parseInt(row.sessions) || 0
    }));

    res.json({ history, days: parseInt(days) });

  } catch (error) {
    console.error('[!] Usage history error:', error);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

// Get connected devices
router.get('/devices', requireAuth, async (req, res) => {
  try {
    const { username } = req.user;

    const { query } = require('../utils/database');
    const result = await query(`
      SELECT
        acctsessionid,
        acctstarttime,
        nasipaddress,
        nasportid,
        callingstationid,
        framedipaddress,
        acctinputoctets,
        acctoutputoctets,
        acctsessiontime
      FROM radacct
      WHERE username = $1 AND acctstoptime IS NULL
      ORDER BY acctstarttime DESC
    `, [username]);

    const devices = result.rows.map(row => ({
      sessionId: row.acctsessionid,
      startTime: row.acctstarttime,
      nasIp: row.nasipaddress,
      port: row.nasportid,
      macAddress: row.callingstationid,
      ipAddress: row.framedipaddress,
      uploadBytes: parseInt(row.acctinputoctets) || 0,
      downloadBytes: parseInt(row.acctoutputoctets) || 0,
      sessionTime: parseInt(row.acctsessiontime) || 0
    }));

    res.json({ devices, count: devices.length });

  } catch (error) {
    console.error('[!] Devices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch connected devices' });
  }
});

module.exports = router;
