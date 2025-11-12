/**
 * OPNsense API Integration
 * Manage WireGuard peers on OPNsense firewall
 * Using native Node.js https module - no external dependencies
 */

const https = require('https');

// OPNsense API configuration
const OPNSENSE_CONFIG = {
  host: process.env.OPNSENSE_HOST || 'firewall.boldvpn.net',
  port: process.env.OPNSENSE_PORT || 8443,
  apiKey: process.env.OPNSENSE_API_KEY,
  apiSecret: process.env.OPNSENSE_API_SECRET,
  wireguardInterface: process.env.WIREGUARD_INTERFACE || 'wg0'
};

/**
 * Make HTTPS request to OPNsense API
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${OPNSENSE_CONFIG.apiKey}:${OPNSENSE_CONFIG.apiSecret}`).toString('base64');
    
    const options = {
      hostname: OPNSENSE_CONFIG.host,
      port: OPNSENSE_CONFIG.port,
      path: `/api${path}`,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false // For self-signed certs
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body);
          resolve(jsonData);
        } catch (error) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Add WireGuard peer to OPNsense
 */
async function addWireGuardPeer(username, publicKey, assignedIP, presharedKey = null) {
  try {
    const peerData = {
      peer: {
        enabled: '1',
        name: username,
        pubkey: publicKey,
        psk: presharedKey || '',
        tunneladdress: assignedIP,
        keepalive: '25',
        comment: `BoldVPN user: ${username}`
      }
    };

    // Add peer via OPNsense API
    const response = await makeRequest('POST', '/wireguard/client/addPeer', peerData);

    if (response.result === 'saved') {
      console.log(`[OK] WireGuard peer added for ${username}`);
      
      // Restart WireGuard service to apply changes
      await restartWireGuard();
      
      return {
        success: true,
        peerId: response.uuid
      };
    } else {
      throw new Error('Failed to add peer: ' + JSON.stringify(response));
    }

  } catch (error) {
    console.error('[!] OPNsense add peer error:', error.message);
    throw new Error('Failed to add WireGuard peer to firewall');
  }
}

/**
 * Remove WireGuard peer from OPNsense
 */
async function removeWireGuardPeer(peerId) {
  try {
    const response = await makeRequest('POST', `/wireguard/client/delPeer/${peerId}`);

    if (response.result === 'deleted') {
      console.log(`[OK] WireGuard peer ${peerId} removed`);
      
      // Restart WireGuard service
      await restartWireGuard();
      
      return { success: true };
    } else {
      throw new Error('Failed to delete peer');
    }

  } catch (error) {
    console.error('[!] OPNsense remove peer error:', error.message);
    throw new Error('Failed to remove WireGuard peer from firewall');
  }
}

/**
 * Get all WireGuard peers
 */
async function getWireGuardPeers() {
  try {
    const response = await makeRequest('GET', '/wireguard/client/get');
    return response.peers || [];
  } catch (error) {
    console.error('[!] OPNsense get peers error:', error.message);
    return [];
  }
}

/**
 * Get WireGuard interface status
 */
async function getWireGuardStatus() {
  try {
    const response = await makeRequest('GET', '/wireguard/service/show');
    return {
      running: response.running === '1',
      peers: response.peers || [],
      interface: response.interface || 'wg0'
    };
  } catch (error) {
    console.error('[!] OPNsense status error:', error.message);
    return { running: false, peers: [] };
  }
}

/**
 * Restart WireGuard service
 */
async function restartWireGuard() {
  try {
    await makeRequest('POST', '/wireguard/service/restart');
    console.log('[OK] WireGuard service restarted');
    return { success: true };
  } catch (error) {
    console.error('[!] WireGuard restart error:', error.message);
    // Don't throw - service might already be running
    return { success: false };
  }
}

/**
 * Update peer (enable/disable)
 */
async function updateWireGuardPeer(peerId, enabled) {
  try {
    const response = await makeRequest('POST', `/wireguard/client/setPeer/${peerId}`, {
      peer: { enabled: enabled ? '1' : '0' }
    });

    if (response.result === 'saved') {
      await restartWireGuard();
      return { success: true };
    }
    return { success: false };

  } catch (error) {
    console.error('[!] Update peer error:', error.message);
    return { success: false };
  }
}

/**
 * Get connected peers (active connections)
 */
async function getActivePeers() {
  try {
    const response = await makeRequest('GET', '/wireguard/service/showconf');
    
    // Parse active connections
    const activePeers = [];
    const peers = response.peers || [];
    
    peers.forEach(peer => {
      if (peer.latest_handshake && peer.latest_handshake > 0) {
        activePeers.push({
          publicKey: peer.public_key,
          endpoint: peer.endpoint,
          lastHandshake: peer.latest_handshake,
          transferRx: peer.transfer_rx,
          transferTx: peer.transfer_tx,
          isActive: (Date.now() / 1000 - peer.latest_handshake) < 180 // Active if handshake within 3 min
        });
      }
    });

    return activePeers;

  } catch (error) {
    console.error('[!] Get active peers error:', error.message);
    return [];
  }
}

/**
 * Check if OPNsense API is accessible
 */
async function healthCheck() {
  try {
    const response = await makeRequest('GET', '/core/firmware/status');
    return {
      healthy: true,
      version: response.product_version || 'unknown'
    };
  } catch (error) {
    console.error('[!] OPNsense health check failed:', error.message);
    return {
      healthy: false,
      error: error.message
    };
  }
}

module.exports = {
  addWireGuardPeer,
  removeWireGuardPeer,
  getWireGuardPeers,
  getWireGuardStatus,
  getActivePeers,
  updateWireGuardPeer,
  restartWireGuard,
  healthCheck
};


