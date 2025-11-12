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
const QRCode = require('qrcode');

/**
 * Country code to IP octet mapping
 * US = 1, CA = 11, rest sequential starting from 12
 */
const COUNTRY_CODE_MAP = {
  'US': 1,
  'CA': 11
  // Rest will be sequential: NL=12, DE=13, etc.
};

let countryCodeCounter = 12; // Start after CA

function getCountryOctet(countryCode) {
  if (COUNTRY_CODE_MAP[countryCode]) {
    return COUNTRY_CODE_MAP[countryCode];
  }
  // For new countries, assign sequentially
  if (!COUNTRY_CODE_MAP[countryCode]) {
    COUNTRY_CODE_MAP[countryCode] = countryCodeCounter++;
  }
  return COUNTRY_CODE_MAP[countryCode];
}

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
 * Uses SELECT FOR UPDATE to prevent race conditions
 */
async function getNextAvailableIP(serverId, client) {
  // Get server IP range configuration
  const serverQuery = await client.query(
    `SELECT ip_range_start, ip_range_end, wireguard_subnet 
     FROM vpn_servers 
     WHERE id = $1`,
    [serverId]
  );
  
  if (serverQuery.rows.length === 0) {
    throw new Error('Server not found');
  }
  
  const server = serverQuery.rows[0];
  
  if (!server.ip_range_start || !server.ip_range_end) {
    throw new Error('Server IP range not configured. Please configure IP range via admin panel.');
  }
  
  const rangeStart = server.ip_range_start;
  const rangeEnd = server.ip_range_end;
  
  // Parse IP addresses
  const startParts = rangeStart.split('.');
  const endParts = rangeEnd.split('.');
  const startOctet = parseInt(startParts[3]);
  const endOctet = parseInt(endParts[3]);
  
  // Use transaction lock to prevent concurrent IP assignment
  const query = `
    SELECT assigned_ip FROM user_devices
    WHERE server_id = $1 AND is_active = true
    ORDER BY assigned_ip DESC
    LIMIT 1
    FOR UPDATE
  `;
  
  const result = await client.query(query, [serverId]);
  
  if (result.rows.length === 0) {
    // Start from configured range start
    return rangeStart;
  }
  
  // Increment last IP
  const lastIP = result.rows[0].assigned_ip;
  const parts = lastIP.split('.');
  const lastOctet = parseInt(parts[3]);
  
  if (lastOctet >= endOctet) {
    throw new Error(`No available IPs in subnet ${server.wireguard_subnet}. Range exhausted (${rangeStart} - ${rangeEnd})`);
  }
  
  parts[3] = (lastOctet + 1).toString();
  const nextIP = parts.join('.');
  
  // Verify IP is within range
  const nextOctet = parseInt(parts[3]);
  if (nextOctet < startOctet || nextOctet > endOctet) {
    throw new Error(`IP ${nextIP} is outside configured range (${rangeStart} - ${rangeEnd})`);
  }
  
  return nextIP;
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
      AND d.is_active = true
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

    // *** CRITICAL: Check if user has active paid subscription ***
    const userStatusResult = await pool.query(
      `SELECT subscription_status, subscription_expires_at 
       FROM user_details 
       WHERE username = $1`,
      [username]
    );

    if (userStatusResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userStatus = userStatusResult.rows[0];
    const subscriptionStatus = userStatus.subscription_status;
    const expiresAt = userStatus.subscription_expires_at;

    // Check if subscription is active
    if (subscriptionStatus !== 'active') {
      return res.status(403).json({ 
        error: 'Active subscription required. Please upgrade your plan to add devices.',
        subscriptionStatus,
        requiresPayment: true
      });
    }

    // Check if subscription has expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return res.status(403).json({ 
        error: 'Your subscription has expired. Please renew to continue using VPN services.',
        subscriptionStatus: 'expired',
        expiresAt,
        requiresPayment: true
      });
    }

    // *** CRITICAL: Sync with OPNsense before creating device ***
    // Check if peer exists in OPNsense for this username
    const opnsensePeer = await opnsense.findPeerByUsername(username);
    
    if (!opnsensePeer) {
      // Peer doesn't exist in OPNsense - mark all DB devices for this user as inactive
      // This handles the case where user deleted peer from OPNsense manually
      const inactiveCount = await pool.query(
        'UPDATE user_devices SET is_active = false WHERE username = $1 AND is_active = true',
        [username]
      );
      if (inactiveCount.rowCount > 0) {
        console.log(`[OK] Synced database: marked ${inactiveCount.rowCount} device(s) as inactive (peer deleted from OPNsense)`);
      }
    } else {
      // Peer exists in OPNsense - sync database
      console.log(`[i] Found peer in OPNsense for ${username} (UUID: ${opnsensePeer.uuid}), syncing database...`);
      
      // Update any devices with matching peer ID to active
      await pool.query(
        'UPDATE user_devices SET is_active = true, opnsense_peer_id = $1 WHERE username = $2 AND opnsense_peer_id = $1',
        [opnsensePeer.uuid, username]
      );
      
      // Mark devices with different peer IDs as inactive (peer was recreated)
      await pool.query(
        'UPDATE user_devices SET is_active = false WHERE username = $1 AND opnsense_peer_id IS NOT NULL AND opnsense_peer_id != $2',
        [username, opnsensePeer.uuid]
      );
    }
    
    // Check if device name already exists for this user (only check active devices)
    const existingDevice = await pool.query(
      'SELECT id FROM user_devices WHERE username = $1 AND device_name = $2 AND is_active = true',
      [username, deviceName]
    );

    if (existingDevice.rows.length > 0) {
      return res.status(409).json({ error: 'Device name already exists' });
    }

    // If there's an inactive device with the same name, clean it up
    const inactiveDevice = await pool.query(
      'SELECT id, opnsense_peer_id FROM user_devices WHERE username = $1 AND device_name = $2 AND is_active = false',
      [username, deviceName]
    );

    if (inactiveDevice.rows.length > 0) {
      // Clean up any remaining OPNsense peer if it exists
      const inactiveDev = inactiveDevice.rows[0];
      if (inactiveDev.opnsense_peer_id) {
        try {
          // Check if peer still exists in OPNsense
          const peerExists = await opnsense.findPeerByUsername(username);
          if (peerExists && peerExists.uuid === inactiveDev.opnsense_peer_id) {
            await opnsense.removeWireGuardPeer(inactiveDev.opnsense_peer_id);
            console.log(`[OK] Cleaned up inactive device's OPNsense peer: ${inactiveDev.opnsense_peer_id}`);
          }
        } catch (error) {
          // Peer might already be deleted, that's okay
          console.log(`[i] Could not remove OPNsense peer (may already be deleted): ${error.message}`);
        }
      }
      // Delete the inactive device record so we can create a fresh one
      await pool.query(
        'DELETE FROM user_devices WHERE id = $1',
        [inactiveDev.id]
      );
      console.log(`[OK] Removed inactive device record: ${inactiveDev.id}`);
    }

    // Check device limit from radreply
    const limitResult = await pool.query(
      "SELECT value FROM radreply WHERE username = $1 AND attribute = 'Simultaneous-Use'",
      [username]
    );

    const deviceLimit = limitResult.rows.length > 0 ? parseInt(limitResult.rows[0].value) : 2;

    const deviceCount = await pool.query(
      'SELECT COUNT(*) FROM user_devices WHERE username = $1 AND is_active = true',
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

    // *** CRITICAL: Verify server has IP range configured ***
    if (!server.wireguard_subnet || !server.ip_range_start || !server.ip_range_end) {
      return res.status(400).json({ 
        error: 'Server IP range not configured. Please contact administrator.',
        serverId: serverId,
        serverName: server.name
      });
    }

    // *** CRITICAL: Verify database subnet matches OPNsense subnet ***
    try {
      await opnsense.verifySubnetMatch(server.wireguard_subnet);
    } catch (verifyError) {
      console.error('[!] Subnet verification failed:', verifyError.message);
      return res.status(500).json({ 
        error: 'Subnet configuration mismatch with firewall',
        details: verifyError.message,
        databaseSubnet: server.wireguard_subnet
      });
    }

    // Use database transaction to prevent race conditions
    const client = await pool.connect();
    let device;
    let keys;
    let assignedIP;

    try {
      await client.query('BEGIN');

      // Generate WireGuard keys
      keys = await generateWireGuardKeys();

      // Get next available IP with row lock
      assignedIP = await getNextAvailableIP(serverId, client);

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

      const result = await client.query(insertQuery, values);
      device = result.rows[0];

      // *** CRITICAL: Push peer to OPNsense BEFORE committing transaction ***
      // This prevents garbage data if OPNsense fails
      const peerResult = await opnsense.addWireGuardPeer(
        username,
        keys.publicKey,
        assignedIP,
        keys.presharedKey
      );
      
      if (!peerResult.success) {
        throw new Error('OPNsense did not return success');
      }

      // Store OPNsense peer ID
      await client.query(
        'UPDATE user_devices SET opnsense_peer_id = $1 WHERE id = $2',
        [peerResult.peerId, device.id]
      );

      // Only commit if everything succeeded
      await client.query('COMMIT');
      console.log(`[OK] Device created and peer added to OPNsense for ${username}`);

    } catch (error) {
      // Rollback transaction on any failure
      await client.query('ROLLBACK');
      console.error('[!] Device creation failed:', error.message);
      throw error;
    } finally {
      client.release();
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
    res.status(500).json({ 
      error: 'Failed to add device',
      details: error.message 
    });
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
      WHERE d.id = $1 AND d.username = $2 AND d.is_active = true
    `;

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
      WHERE d.id = $1 AND d.username = $2 AND d.is_active = true
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
 * Get QR code for device configuration
 * Returns QR code image (PNG) that can be scanned by WireGuard mobile apps
 */
router.get('/:deviceId/qrcode', authenticateToken, async (req, res) => {
  try {
    const { username } = req.user;
    const { deviceId } = req.params;

    const query = `
      SELECT d.*, s.*
      FROM user_devices d
      JOIN vpn_servers s ON d.server_id = s.id
      WHERE d.id = $1 AND d.username = $2 AND d.is_active = true
    `;

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

    // Generate QR code from config
    try {
      const qrCodeDataURL = await QRCode.toDataURL(configFile, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 512,
        margin: 2
      });

      // Convert data URL to buffer
      const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `inline; filename="${device.device_name}-qrcode.png"`);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
      res.send(imageBuffer);

    } catch (qrError) {
      console.error('[!] QR code generation error:', qrError);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }

  } catch (error) {
    console.error('[!] Get QR code error:', error);
    res.status(500).json({ error: 'Failed to get QR code' });
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

    // Soft delete (mark as inactive)
    const query = `
      UPDATE user_devices
      SET is_active = false
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

