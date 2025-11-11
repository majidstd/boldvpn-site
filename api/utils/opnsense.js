/**
 * OPNsense API Integration
 * Manage WireGuard peers on OPNsense firewall
 */

const https = require('https');
const axios = require('axios');

// OPNsense API configuration
const OPNSENSE_CONFIG = {
  host: process.env.OPNSENSE_HOST || 'firewall.boldvpn.net',
  port: process.env.OPNSENSE_PORT || 443,
  apiKey: process.env.OPNSENSE_API_KEY,
  apiSecret: process.env.OPNSENSE_API_SECRET,
  wireguardInterface: process.env.WIREGUARD_INTERFACE || 'wg0'
};

// Create axios instance with authentication
const opnsenseClient = axios.create({
  baseURL: `https://${OPNSENSE_CONFIG.host}:${OPNSENSE_CONFIG.port}/api`,
  auth: {
    username: OPNSENSE_CONFIG.apiKey,
    password: OPNSENSE_CONFIG.apiSecret
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false // For self-signed certs
  }),
  timeout: 10000
});

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
    // Endpoint: /api/wireguard/client/addPeer
    const response = await opnsenseClient.post('/wireguard/client/addPeer', peerData);

    if (response.data.result === 'saved') {
      console.log(`[OK] WireGuard peer added for ${username}`);
      
      // Restart WireGuard service to apply changes
      await restartWireGuard();
      
      return {
        success: true,
        peerId: response.data.uuid
      };
    } else {
      throw new Error('Failed to add peer: ' + JSON.stringify(response.data));
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
    const response = await opnsenseClient.post(`/wireguard/client/delPeer/${peerId}`);

    if (response.data.result === 'deleted') {
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
    const response = await opnsenseClient.get('/wireguard/client/get');
    return response.data.peers || [];
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
    const response = await opnsenseClient.get('/wireguard/service/show');
    return {
      running: response.data.running === '1',
      peers: response.data.peers || [],
      interface: response.data.interface || 'wg0'
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
    await opnsenseClient.post('/wireguard/service/restart');
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
    const response = await opnsenseClient.post(`/wireguard/client/setPeer/${peerId}`, {
      peer: { enabled: enabled ? '1' : '0' }
    });

    if (response.data.result === 'saved') {
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
    const response = await opnsenseClient.get('/wireguard/service/showconf');
    
    // Parse active connections
    const activePeers = [];
    const peers = response.data.peers || [];
    
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
    const response = await opnsenseClient.get('/core/firmware/status');
    return {
      healthy: true,
      version: response.data.product_version || 'unknown'
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

