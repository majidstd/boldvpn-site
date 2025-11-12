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
    
    const headers = {
      'Authorization': `Basic ${auth}`
    };
    
    // Only add Content-Type for requests with body
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    
    const options = {
      hostname: OPNSENSE_CONFIG.host,
      port: OPNSENSE_CONFIG.port,
      path: `/api${path}`,
      method: method,
      headers: headers,
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
 * Get WireGuard server UUID and configuration
 */
async function getWireGuardServerUUID() {
  try {
    const response = await makeRequest('GET', '/wireguard/server/get');
    
    console.log('[DEBUG] Server response:', JSON.stringify(response).substring(0, 200));
    
    // Find first enabled server
    if (response && response.server && response.server.servers && response.server.servers.server) {
      const servers = response.server.servers.server;
      const serverUUIDs = Object.keys(servers);
      
      if (serverUUIDs.length === 0) {
        throw new Error('No WireGuard servers configured in OPNsense');
      }
      
      const serverUUID = serverUUIDs[0];
      console.log('[OK] Found WireGuard server UUID:', serverUUID);
      return serverUUID;
    }
    
    console.error('[!] Unexpected server response structure:', response);
    throw new Error('No WireGuard server found in OPNsense');
  } catch (error) {
    console.error('[!] Failed to get server UUID:', error.message);
    throw error;
  }
}

/**
 * Get WireGuard server subnet from OPNsense
 * Returns the tunneladdress subnet (e.g., "10.11.0.1/24")
 */
async function getWireGuardServerSubnet() {
  try {
    console.log('[DEBUG] Getting WireGuard server subnet from OPNsense...');
    const response = await makeRequest('GET', '/wireguard/server/get');
    
    console.log('[DEBUG] OPNsense response structure:', JSON.stringify(response).substring(0, 500));
    
    if (response && response.server && response.server.servers && response.server.servers.server) {
      const servers = response.server.servers.server;
      const serverUUIDs = Object.keys(servers);
      
      console.log('[DEBUG] Found server UUIDs:', serverUUIDs);
      
      if (serverUUIDs.length === 0) {
        throw new Error('No WireGuard servers configured in OPNsense');
      }
      
      // Get first enabled server
      const serverUUID = serverUUIDs[0];
      const serverConfig = servers[serverUUID];
      
      console.log('[DEBUG] Server UUID:', serverUUID);
      console.log('[DEBUG] Server config keys:', Object.keys(serverConfig));
      console.log('[DEBUG] Server config tunneladdress:', JSON.stringify(serverConfig.tunneladdress));
      console.log('[DEBUG] Tunneladdress type:', typeof serverConfig.tunneladdress);
      console.log('[DEBUG] Tunneladdress value:', serverConfig.tunneladdress);
      
      // Extract tunneladdress - handle different formats
      let tunnelAddress = null;
      
      if (serverConfig.tunneladdress) {
        // Handle object format: {"value": "10.11.0.1/24", "selected": 1}
        if (typeof serverConfig.tunneladdress === 'object') {
          // Check if it's an object with value property
          if (serverConfig.tunneladdress.value) {
            tunnelAddress = serverConfig.tunneladdress.value;
          } else {
            // Try to get first value if it's an object with keys
            const keys = Object.keys(serverConfig.tunneladdress);
            if (keys.length > 0) {
              const firstKey = keys[0];
              const firstValue = serverConfig.tunneladdress[firstKey];
              if (typeof firstValue === 'object' && firstValue.value) {
                tunnelAddress = firstValue.value;
              } else if (typeof firstValue === 'string') {
                tunnelAddress = firstValue;
              }
            }
          }
        } else if (typeof serverConfig.tunneladdress === 'string') {
          tunnelAddress = serverConfig.tunneladdress;
        }
      }
      
      if (!tunnelAddress) {
        console.error('[!] Tunnel address structure:', JSON.stringify(serverConfig.tunneladdress));
        throw new Error('WireGuard server tunneladdress not found or invalid format in OPNsense');
      }
      
      // Convert to subnet format (e.g., "10.11.0.1/24" -> "10.11.0.0/24")
      const parts = tunnelAddress.split('/');
      if (parts.length === 2) {
        const ipParts = parts[0].split('.');
        const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/${parts[1]}`;
        console.log(`[OK] OPNsense WireGuard subnet: ${subnet} (from tunneladdress: ${tunnelAddress})`);
        return subnet;
      }
      
      throw new Error(`Invalid tunneladdress format: ${tunnelAddress}`);
    }
    
    throw new Error('No WireGuard server found in OPNsense');
  } catch (error) {
    console.error('[!] Failed to get WireGuard subnet:', error.message);
    throw error;
  }
}

/**
 * Verify database subnet matches OPNsense subnet
 * Throws error if mismatch
 */
async function verifySubnetMatch(dbSubnet) {
  try {
    const opnsenseSubnet = await getWireGuardServerSubnet();
    
    if (opnsenseSubnet !== dbSubnet) {
      throw new Error(
        `Subnet mismatch! Database: ${dbSubnet}, OPNsense: ${opnsenseSubnet}. ` +
        `Please update OPNsense WireGuard interface subnet to match database configuration.`
      );
    }
    
    console.log(`[OK] Subnet verification passed: ${dbSubnet}`);
    return true;
  } catch (error) {
    console.error('[!] Subnet verification failed:', error.message);
    throw error;
  }
}

/**
 * Add WireGuard peer to OPNsense
 * @param {string} peerName - Name for the peer (usually device name or username)
 * @param {string} publicKey - Public key of the peer
 * @param {string} assignedIP - Assigned IP address
 * @param {string} presharedKey - Preshared key (optional)
 */
async function addWireGuardPeer(peerName, publicKey, assignedIP, presharedKey = null) {
  try {
    // Get server UUID dynamically
    const serverUUID = await getWireGuardServerUUID();
    
    // OPNsense WireGuard uses "client" not "peer"
    const clientData = {
      client: {
        enabled: '1',
        name: peerName, // Use peerName (device name) instead of username
        pubkey: publicKey,
        psk: presharedKey || '',
        tunneladdress: `${assignedIP}/32`,
        keepalive: '25',
        servers: serverUUID
      }
    };

    // Add client via OPNsense API
    const response = await makeRequest('POST', '/wireguard/client/addClient', clientData);

    if (response.result === 'saved' || response.uuid) {
      console.log(`[OK] WireGuard client added for ${username}, UUID: ${response.uuid}`);
      
      // Apply configuration changes
      await makeRequest('POST', '/wireguard/service/reconfigure');
      
      return {
        success: true,
        peerId: response.uuid
      };
    } else {
      throw new Error('Failed to add client: ' + JSON.stringify(response));
    }

  } catch (error) {
    console.error('[!] OPNsense add client error:', error.message);
    console.error('[!] Response:', error);
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
    
    // OPNsense returns peers in different formats, normalize it
    if (response.client && response.client.clients && response.client.clients.client) {
      const clients = response.client.clients.client;
      // If it's an object with UUIDs as keys, convert to array
      if (typeof clients === 'object' && !Array.isArray(clients)) {
        return Object.keys(clients).map(uuid => ({
          uuid,
          ...clients[uuid]
        }));
      }
      return Array.isArray(clients) ? clients : [];
    }
    
    return response.peers || [];
  } catch (error) {
    console.error('[!] OPNsense get peers error:', error.message);
    return [];
  }
}

/**
 * Find WireGuard peer by name (searches for username-deviceName pattern)
 * Returns peer info if found, null otherwise
 */
async function findPeerByName(peerName) {
  try {
    const peers = await getWireGuardPeers();
    
    // Search for peer with matching name
    for (const peer of peers) {
      // Handle different response formats
      const pName = peer.name || peer.client?.name || peer.client_name;
      if (pName === peerName) {
        return {
          uuid: peer.uuid || peer.client?.uuid,
          name: pName,
          enabled: peer.enabled || peer.client?.enabled,
          tunneladdress: peer.tunneladdress || peer.client?.tunneladdress,
          pubkey: peer.pubkey || peer.client?.pubkey
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[!] Find peer by name error:', error.message);
    return null;
  }
}

/**
 * Find WireGuard peer by username (searches for peers starting with username-)
 * Returns array of matching peers
 */
async function findPeersByUsername(username) {
  try {
    const peers = await getWireGuardPeers();
    const matchingPeers = [];
    
    // Search for peers with name starting with username-
    for (const peer of peers) {
      const pName = peer.name || peer.client?.name || peer.client_name;
      if (pName && pName.startsWith(`${username}-`)) {
        matchingPeers.push({
          uuid: peer.uuid || peer.client?.uuid,
          name: pName,
          enabled: peer.enabled || peer.client?.enabled,
          tunneladdress: peer.tunneladdress || peer.client?.tunneladdress,
          pubkey: peer.pubkey || peer.client?.pubkey
        });
      }
    }
    
    return matchingPeers;
  } catch (error) {
    console.error('[!] Find peers by username error:', error.message);
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
  getWireGuardServerSubnet,
  verifySubnetMatch,
  addWireGuardPeer,
  removeWireGuardPeer,
  getWireGuardPeers,
  findPeerByName,
  findPeersByUsername,
  getWireGuardStatus,
  getActivePeers,
  updateWireGuardPeer,
  restartWireGuard,
  healthCheck
};


