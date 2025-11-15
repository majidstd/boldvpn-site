/**
 * Device Management API Routes
 * Manage user's VPN devices and WireGuard configurations
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../utils/database');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const opnsense = require('../utils/opnsense');

/**
 * Generate WireGuard key pair
 */
async function generateWireGuardKeys() {
  try {
    // Generate private key
    const { stdout: privateKey } = await execPromise('wg genkey');
    // Generate public key from private key
    const { stdout: publicKey } = await execPromise(`echo "${privateKey.trim()}" | wg pubkey`);
    // Generate preshared key
    const { stdout: presharedKey } = await execPromise('wg genpsk');

    return {
      privateKey: privateKey.trim(),
      publicKey: publicKey.trim(),
      presharedKey: presharedKey.trim()
    };
  } catch (error) {
    // CRITICAL: Don't use fake keys - fail loudly
    console.error('[!] WireGuard tools not installed on FreeBSD server');
    console.error('[!] Install with: pkg install wireguard-tools');
    throw new Error('WireGuard tools not installed. Please run: pkg install wireguard-tools');
  }
}

/**
 * Get next available IP address for user
 */
async function getNextAvailableIP(serverId) {
  const query = `
    SELECT assigned_ip FROM user_devices
    WHERE server_id = $1
    ORDER BY assigned_ip DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [serverId]);
  
  if (result.rows.length === 0) {
    // Start from 10.8.0.2 (10.8.0.1 is usually the server)
    return '10.8.0.2';
  }
  
  // Increment last IP
  const lastIP = result.rows[0].assigned_ip;
  const parts = lastIP.split('.');
  const lastOctet = parseInt(parts[3]);
  
  if (lastOctet >= 254) {
    throw new Error('No available IPs in this subnet');
  }
  
  parts[3] = (lastOctet + 1).toString();
  return parts.join('.');
}

/**
 * Generate WireGuard configuration file
 */
function generateWireGuardConfig(device, server) {
  return `[Interface]
# Device: ${device.device_name}
# Server: ${server.name}
PrivateKey = ${device.private_key}
Address = ${device.assigned_ip}/32
DNS = ${device.dns_servers || '1.1.1.1, 1.0.0.1'}

[Peer]
# BoldVPN Server - ${server.name}
PublicKey = ${server.wireguard_public_key}
PresharedKey = ${device.preshared_key || ''}
Endpoint = ${server.wireguard_endpoint}
AllowedIPs = ${device.allowed_ips || '0.0.0.0/0, ::/0'}
PersistentKeepalive = ${device.persistent_keepalive || 25}
`;
}

/**
 * Get all devices for authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;

    const query = `
      SELECT 
        d.*,
        s.name as server_name,
        s.country,
        s.flag_emoji,
        s.city
      FROM user_devices d
      LEFT JOIN vpn_servers s ON d.server_id = s.id
      WHERE d.username = $1
      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query, [username]);

    const devices = result.rows.map(device => ({
      id: device.id,
      deviceName: device.device_name,
      server: device.server_name ? {
        id: device.server_id,
        name: device.server_name,
        location: `${device.flag_emoji} ${device.country}, ${device.city}`
      } : null,
      assignedIP: device.assigned_ip,
      publicKey: device.public_key,
      lastUsed: device.last_used,
      lastIPAddress: device.last_ip_address,
      createdAt: device.created_at
    }));

    res.json(devices);

  } catch (error) {
    console.error('[!] Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * Add new device
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { deviceName, serverId } = req.body;

    // Validate input
    if (!deviceName || deviceName.length < 3) {
      return res.status(400).json({ error: 'Device name must be at least 3 characters' });
    }

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID is required' });
    }

    // Check if device name already exists for this user
    const existingDevice = await pool.query(
      'SELECT id FROM user_devices WHERE username = $1 AND device_name = $2',
      [username, deviceName]
    );

    if (existingDevice.rows.length > 0) {
      return res.status(409).json({ error: 'Device name already exists' });
    }

    // Check device limit from radreply
    const limitResult = await pool.query(
      "SELECT value FROM radreply WHERE username = $1 AND attribute = 'Simultaneous-Use'",
      [username]
    );

    const deviceLimit = limitResult.rows.length > 0 ? parseInt(limitResult.rows[0].value) : 2;

    const deviceCount = await pool.query(
      'SELECT COUNT(*) FROM user_devices WHERE username = $1',
      [username]
    );

    if (parseInt(deviceCount.rows[0].count) >= deviceLimit) {
      return res.status(403).json({ 
        error: `Device limit reached. Your plan allows ${deviceLimit} device(s).` 
      });
    }

    // Get server details
    const serverResult = await pool.query(
      'SELECT * FROM vpn_servers WHERE id = $1 AND status = $2',
      [serverId, 'active']
    );

    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found or unavailable' });
    }

    const server = serverResult.rows[0];

    // Check if server is premium and user has premium access
    if (server.is_premium) {
      // Get user plan_tier from user_details
      const userTierResult = await pool.query(
        'SELECT plan_tier FROM user_details WHERE username = $1',
        [username]
      );

      if (userTierResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const planTier = userTierResult.rows[0].plan_tier || 'free';
      
      // Only premium and family tiers can access premium servers
      if (planTier !== 'premium' && planTier !== 'family') {
        return res.status(403).json({ 
          error: 'Premium servers are only available for Premium or Family plan users. Please upgrade your plan.',
          requiresUpgrade: true,
          serverName: server.name
        });
      }
    }

    // Generate WireGuard keys
    const keys = await generateWireGuardKeys();

    // Get next available IP
    const assignedIP = await getNextAvailableIP(serverId);

    // Create device
    const insertQuery = `
      INSERT INTO user_devices (
        username, device_name, server_id,
        private_key, public_key, preshared_key, assigned_ip,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const values = [
      username,
      deviceName,
      serverId,
      keys.privateKey,
      keys.publicKey,
      keys.presharedKey,
      assignedIP
    ];

    const result = await pool.query(insertQuery, values);
    const device = result.rows[0];

    // *** CRITICAL: Push peer to OPNsense firewall ***
    try {
          const peerResult = await opnsense.addWireGuardPeer(
            `${username}-${deviceName}`, // Combine username and deviceName for OPNsense peer name
            keys.publicKey,
            assignedIP,
            keys.presharedKey
          );      
      // Store OPNsense peer ID for later removal
      if (peerResult.success) {
        await pool.query(
          'UPDATE user_devices SET opnsense_peer_id = $1 WHERE id = $2',
          [peerResult.peerId, device.id]
        );
        console.log(`[OK] WireGuard peer added to OPNsense for ${username}`);
      }
    } catch (opnsenseError) {
      // Rollback database insert if OPNsense fails
      await pool.query('DELETE FROM user_devices WHERE id = $1', [device.id]);
      throw new Error('Failed to configure VPN server: ' + opnsenseError.message);
    }

    // Generate config file
    const configFile = generateWireGuardConfig(device, server);

    // Update device with config file
    await pool.query(
      'UPDATE user_devices SET config_file = $1 WHERE id = $2',
      [configFile, device.id]
    );

    res.status(201).json({
      message: 'Device added successfully',
      device: {
        id: device.id,
        deviceName: device.device_name,
        server: {
          id: server.id,
          name: server.name,
          location: `${server.flag_emoji} ${server.country}, ${server.city}`
        },
        assignedIP: device.assigned_ip,
        publicKey: device.public_key,
        createdAt: device.created_at
      }
    });

  } catch (error) {
    console.error('[!] Add device error:', error);
    res.status(500).json({ error: 'Failed to add device' });
  }
});

/**
 * Get device configuration file
 */
router.get('/:deviceId/config', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { deviceId } = req.params;

    const query = `
                SELECT d.*, s.*
                FROM user_devices d
                JOIN vpn_servers s ON d.server_id = s.id
                WHERE d.id = $1 AND d.username = $2    `;

    const result = await pool.query(query, [deviceId, username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = result.rows[0];

    // Generate fresh config if not stored
    let configFile = device.config_file;
    if (!configFile) {
      configFile = generateWireGuardConfig(device, device);
      await pool.query(
        'UPDATE user_devices SET config_file = $1 WHERE id = $2',
        [configFile, device.id]
      );
    }

    // Return as downloadable file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${device.device_name}.conf"`);
    res.send(configFile);

  } catch (error) {
    console.error('[!] Get device config error:', error);
    res.status(500).json({ error: 'Failed to get device configuration' });
  }
});

/**
 * Get device configuration as JSON (for display in portal)
 */
router.get('/:deviceId/config/json', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { deviceId } = req.params;

    const query = `
      SELECT d.*, s.name as server_name, s.country, s.flag_emoji, s.city
      FROM user_devices d
      JOIN vpn_servers s ON d.server_id = s.id
      WHERE d.id = $1 AND d.username = $2
    `;

    const result = await pool.query(query, [deviceId, username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = result.rows[0];

    res.json({
      deviceName: device.device_name,
      server: {
        name: device.server_name,
        location: `${device.flag_emoji} ${device.country}, ${device.city}`
      },
      interface: {
        privateKey: device.private_key,
        address: `${device.assigned_ip}/32`,
        dns: device.dns_servers
      },
      peer: {
        publicKey: device.public_key,
        presharedKey: device.preshared_key,
        endpoint: device.wireguard_endpoint,
        allowedIPs: device.allowed_ips,
        persistentKeepalive: device.persistent_keepalive
      },
      configFile: device.config_file
    });

  } catch (error) {
    console.error('[!] Get device config JSON error:', error);
    res.status(500).json({ error: 'Failed to get device configuration' });
  }
});

/**
 * Delete device
 */
router.delete('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { deviceId } = req.params;

    // Get device info first
    const deviceQuery = await pool.query(
      'SELECT opnsense_peer_id FROM user_devices WHERE id = $1 AND username = $2',
      [deviceId, username]
    );

    if (deviceQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const opnsensePeerId = deviceQuery.rows[0].opnsense_peer_id;

    // Remove from OPNsense first
    if (opnsensePeerId) {
      try {
        await opnsense.removeWireGuardPeer(opnsensePeerId);
        console.log(`[OK] Removed peer ${opnsensePeerId} from OPNsense`);
      } catch (opnsenseError) {
        console.error('[!] Failed to remove from OPNsense:', opnsenseError.message);
        // Continue anyway - mark as inactive in DB
      }
    }

    // Hard delete (remove row permanently)
    const query = `
      DELETE FROM user_devices
      WHERE id = $1 AND username = $2
      RETURNING *
    `;

    const result = await pool.query(query, [deviceId, username]);

    res.json({ message: 'Device removed successfully' });

  } catch (error) {
    console.error('[!] Delete device error:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

/**
 * Update device (change server or settings)
 */
router.put('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { deviceId } = req.params;
    const { serverId, deviceName, dnsServers } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (serverId) {
      updates.push(`server_id = $${paramCount++}`);
      values.push(serverId);
    }

    if (deviceName) {
      updates.push(`device_name = $${paramCount++}`);
      values.push(deviceName);
    }

    if (dnsServers) {
      updates.push(`dns_servers = $${paramCount++}`);
      values.push(dnsServers);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(deviceId, username);

    const query = `
      UPDATE user_devices
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND username = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Regenerate config if server changed
    if (serverId) {
      const serverResult = await pool.query('SELECT * FROM vpn_servers WHERE id = $1', [serverId]);
      if (serverResult.rows.length > 0) {
        const newConfig = generateWireGuardConfig(result.rows[0], serverResult.rows[0]);
        await pool.query('UPDATE user_devices SET config_file = $1 WHERE id = $2', [newConfig, deviceId]);
      }
    }

    res.json({
      message: 'Device updated successfully',
      device: result.rows[0]
    });

  } catch (error) {
    console.error('[!] Update device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

module.exports = router;

