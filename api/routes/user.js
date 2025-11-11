const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool, updateUserPassword, getApiAuthData } = require('../utils/database');

// Get user profile with plan details
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Get user details from user_details table
    const userResult = await pool.query(
      'SELECT username, email, created_at FROM user_details WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get user plan limits from radreply
    const limitsResult = await pool.query(
      'SELECT attribute, value FROM radreply WHERE username = $1',
      [username]
    );

    // Parse limits into readable format
    const limits = {};
    limitsResult.rows.forEach(row => {
      switch (row.attribute) {
        case 'Max-Monthly-Traffic':
          limits.monthlyBandwidth = parseInt(row.value);
          limits.monthlyBandwidthGB = (parseInt(row.value) / 1073741824).toFixed(2);
          break;
        case 'WISPr-Bandwidth-Max-Down':
          limits.maxDownSpeed = parseInt(row.value);
          limits.maxDownSpeedMbps = (parseInt(row.value) / 1024).toFixed(0);
          break;
        case 'WISPr-Bandwidth-Max-Up':
          limits.maxUpSpeed = parseInt(row.value);
          limits.maxUpSpeedMbps = (parseInt(row.value) / 1024).toFixed(0);
          break;
        case 'Simultaneous-Use':
          limits.maxDevices = parseInt(row.value);
          break;
      }
    });

    // Determine plan name based on limits
    let planName = 'Free';
    if (limits.monthlyBandwidthGB >= 100) {
      planName = 'Premium';
    } else if (limits.monthlyBandwidthGB >= 50) {
      planName = 'Pro';
    } else if (limits.monthlyBandwidthGB >= 10) {
      planName = 'Basic';
    }

    res.json({
      user: {
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        plan: planName
      },
      limits
    });

  } catch (error) {
    console.error('[!] Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get usage statistics
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    // Get current month usage
    const currentMonthResult = await pool.query(`
      SELECT 
        COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes,
        COALESCE(SUM(acctinputoctets), 0) as upload_bytes,
        COALESCE(SUM(acctoutputoctets), 0) as download_bytes,
        COUNT(*) as session_count
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= date_trunc('month', NOW())
    `, [username]);

    // Get today's usage
    const todayResult = await pool.query(`
      SELECT 
        COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes
      FROM radacct 
      WHERE username = $1 
      AND acctstarttime >= date_trunc('day', NOW())
    `, [username]);

    // Get user limits
    const limitsResult = await pool.query(
      "SELECT value FROM radreply WHERE username = $1 AND attribute = 'Max-Monthly-Traffic'",
      [username]
    );

    const monthlyLimit = limitsResult.rows.length > 0 ? parseInt(limitsResult.rows[0].value) : 0;
    const currentMonth = currentMonthResult.rows[0];
    const today = todayResult.rows[0];

    res.json({
      currentMonth: {
        totalBytes: parseInt(currentMonth.total_bytes),
        totalGB: (parseInt(currentMonth.total_bytes) / 1073741824).toFixed(2),
        uploadBytes: parseInt(currentMonth.upload_bytes),
        uploadGB: (parseInt(currentMonth.upload_bytes) / 1073741824).toFixed(2),
        downloadBytes: parseInt(currentMonth.download_bytes),
        downloadGB: (parseInt(currentMonth.download_bytes) / 1073741824).toFixed(2),
        sessionCount: parseInt(currentMonth.session_count)
      },
      today: {
        totalBytes: parseInt(today.total_bytes),
        totalGB: (parseInt(today.total_bytes) / 1073741824).toFixed(2)
      },
      limit: {
        monthlyBytes: monthlyLimit,
        monthlyGB: (monthlyLimit / 1073741824).toFixed(2),
        percentageUsed: monthlyLimit > 0 ? ((parseInt(currentMonth.total_bytes) / monthlyLimit) * 100).toFixed(1) : 0
      }
    });

  } catch (error) {
    console.error('[!] Usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Get active sessions
router.get('/sessions/active', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    const result = await pool.query(`
      SELECT 
        radacctid as session_id,
        acctsessionid,
        acctstarttime as start_time,
        framedipaddress as ip_address,
        acctinputoctets as upload_bytes,
        acctoutputoctets as download_bytes,
        EXTRACT(EPOCH FROM (NOW() - acctstarttime)) as duration_seconds
      FROM radacct 
      WHERE username = $1 
      AND acctstoptime IS NULL
      ORDER BY acctstarttime DESC
    `, [username]);

    const sessions = result.rows.map(session => ({
      sessionId: session.session_id,
      acctSessionId: session.acctsessionid,
      startTime: session.start_time,
      ipAddress: session.ip_address,
      uploadBytes: parseInt(session.upload_bytes),
      uploadMB: (parseInt(session.upload_bytes) / 1048576).toFixed(2),
      downloadBytes: parseInt(session.download_bytes),
      downloadMB: (parseInt(session.download_bytes) / 1048576).toFixed(2),
      durationSeconds: parseInt(session.duration_seconds),
      durationFormatted: formatDuration(parseInt(session.duration_seconds))
    }));

    res.json({
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('[!] Active sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// Get session history
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const limit = parseInt(req.query.limit) || 10;

    const result = await pool.query(`
      SELECT 
        radacctid as session_id,
        acctstarttime as start_time,
        acctstoptime as stop_time,
        framedipaddress as ip_address,
        acctinputoctets as upload_bytes,
        acctoutputoctets as download_bytes,
        acctsessiontime as duration_seconds
      FROM radacct 
      WHERE username = $1 
      AND acctstoptime IS NOT NULL
      ORDER BY acctstarttime DESC
      LIMIT $2
    `, [username, limit]);

    const sessions = result.rows.map(session => ({
      sessionId: session.session_id,
      startTime: session.start_time,
      stopTime: session.stop_time,
      ipAddress: session.ip_address,
      uploadBytes: parseInt(session.upload_bytes),
      uploadMB: (parseInt(session.upload_bytes) / 1048576).toFixed(2),
      downloadBytes: parseInt(session.download_bytes),
      downloadMB: (parseInt(session.download_bytes) / 1048576).toFixed(2),
      totalMB: ((parseInt(session.upload_bytes) + parseInt(session.download_bytes)) / 1048576).toFixed(2),
      durationSeconds: parseInt(session.duration_seconds),
      durationFormatted: formatDuration(parseInt(session.duration_seconds))
    }));

    res.json({
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('[!] Session history error:', error);
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
});

// Disconnect active session (admin/user can disconnect their own sessions)
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { sessionId } = req.params;

    // Verify session belongs to user
    const checkResult = await pool.query(
      'SELECT radacctid FROM radacct WHERE radacctid = $1 AND username = $2 AND acctstoptime IS NULL',
      [sessionId, username]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Update session to mark as stopped
    // Note: This won't actually disconnect the VPN, just marks it as stopped in accounting
    // For real disconnect, you'd need to send a CoA (Change of Authorization) to RADIUS
    await pool.query(`
      UPDATE radacct 
      SET 
        acctstoptime = NOW(),
        acctsessiontime = EXTRACT(EPOCH FROM (NOW() - acctstarttime))
      WHERE radacctid = $1
    `, [sessionId]);

    res.json({ 
      message: 'Session marked as disconnected',
      note: 'User may need to manually disconnect VPN client'
    });

  } catch (error) {
    console.error('[!] Disconnect session error:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

// Update user profile (email only)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Check if email already exists for another user
    const emailCheck = await pool.query(
      'SELECT username FROM user_details WHERE email = $1 AND username != $2',
      [email, username]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    // Update email
    await pool.query(
      'UPDATE user_details SET email = $1 WHERE username = $2',
      [email, username]
    );

    res.json({ 
      message: 'Profile updated successfully',
      email 
    });

  } catch (error) {
    console.error('[!] Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { currentPassword, newPassword } = req.body;

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Verify current password
    const userAuthData = await getApiAuthData(username);
    if (!userAuthData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userAuthData.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password in both tables (radcheck and user_details)
    await updateUserPassword(username, newPassword);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('[!] Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get usage history (last 30 days, grouped by day)
router.get('/usage/history', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const days = parseInt(req.query.days) || 30;

    const result = await pool.query(`
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
      ORDER BY date DESC
    `, [username, days]);

    const history = result.rows.map(row => ({
      date: row.date,
      totalBytes: parseInt(row.total_bytes),
      totalGB: (parseInt(row.total_bytes) / 1073741824).toFixed(2),
      uploadBytes: parseInt(row.upload_bytes),
      uploadGB: (parseInt(row.upload_bytes) / 1073741824).toFixed(2),
      downloadBytes: parseInt(row.download_bytes),
      downloadGB: (parseInt(row.download_bytes) / 1073741824).toFixed(2),
      sessionCount: parseInt(row.session_count)
    }));

    res.json(history);

  } catch (error) {
    console.error('[!] Usage history error:', error);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

// Get all devices (active sessions with device info)
router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    const result = await pool.query(`
      SELECT 
        radacctid,
        acctsessionid,
        acctstarttime,
        framedipaddress,
        acctinputoctets,
        acctoutputoctets,
        EXTRACT(EPOCH FROM (NOW() - acctstarttime)) as duration_seconds
      FROM radacct 
      WHERE username = $1 
      AND acctstoptime IS NULL
      ORDER BY acctstarttime DESC
    `, [username]);

    const devices = result.rows.map(device => ({
      sessionId: device.radacctid,
      acctSessionId: device.acctsessionid,
      connectedSince: device.acctstarttime,
      ipAddress: device.framedipaddress,
      uploadBytes: parseInt(device.acctinputoctets),
      uploadMB: (parseInt(device.acctinputoctets) / 1048576).toFixed(2),
      downloadBytes: parseInt(device.acctoutputoctets),
      downloadMB: (parseInt(device.acctoutputoctets) / 1048576).toFixed(2),
      durationSeconds: parseInt(device.duration_seconds),
      durationFormatted: formatDuration(parseInt(device.duration_seconds))
    }));

    res.json(devices);

  } catch (error) {
    console.error('[!] Devices list error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Disconnect session (POST endpoint to match portal expectations)
router.post('/sessions/disconnect', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify session belongs to user
    const checkResult = await pool.query(
      'SELECT radacctid FROM radacct WHERE radacctid = $1 AND username = $2 AND acctstoptime IS NULL',
      [sessionId, username]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Mark session as stopped
    await pool.query(`
      UPDATE radacct 
      SET 
        acctstoptime = NOW(),
        acctsessiontime = EXTRACT(EPOCH FROM (NOW() - acctstarttime)),
        acctterminatecause = 'User-Request'
      WHERE radacctid = $1
    `, [sessionId]);

    res.json({ 
      message: 'Device disconnected successfully',
      note: 'User may need to manually disconnect VPN client'
    });

  } catch (error) {
    console.error('[!] Disconnect session error:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

// Helper function to format duration
function formatDuration(seconds) {
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
