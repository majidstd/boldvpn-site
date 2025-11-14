const cron = require('node-cron');
const { pool } = require('../utils/database');
const opnsense = require('../utils/opnsense');

/**
 * Synchronizes user devices from the database to OPNsense.
 * Ensures that OPNsense only contains peers that are present in our database.
 * Any peers in OPNsense not found in the database will be removed.
 * Any devices in the database not found in OPNsense will be added to OPNsense.
 */
async function syncOpnsensePeers() {
    console.log('[SYNC] Starting OPNsense peer synchronization...');
    try {
        // 1. Get all active devices from the database
        const dbDevicesResult = await pool.query(
            `SELECT id, username, device_name, public_key, assigned_ip, preshared_key, opnsense_peer_id, server_id
             FROM user_devices`
        );
        const dbDevices = dbDevicesResult.rows;
        const dbDeviceMap = new Map(); // Map: opnsense_peer_id -> dbDevice
        const dbDeviceNameMap = new Map(); // Map: peerName -> dbDevice

        for (const device of dbDevices) {
            const peerName = `${device.username}-${device.device_name}`;
            dbDeviceNameMap.set(peerName, device);
            if (device.opnsense_peer_id) {
                dbDeviceMap.set(device.opnsense_peer_id, device);
            }
        }

        // 2. Get all peers from OPNsense
        const opnsensePeers = await opnsense.getWireGuardPeers();
        const opnsensePeerMap = new Map(); // Map: uuid -> opnsensePeer
        const opnsensePeerNameMap = new Map(); // Map: peerName -> opnsensePeer

        for (const peer of opnsensePeers) {
            const uuid = peer.uuid || peer.client?.uuid;
            const name = peer.name || peer.client?.name || peer.client_name;
            if (uuid) opnsensePeerMap.set(uuid, peer);
            if (name) opnsensePeerNameMap.set(name, peer);
        }

        // 3. Reconcile: Database -> OPNsense (Ensure DB devices exist in OPNsense)
        for (const dbDevice of dbDevices) {
            const peerName = `${dbDevice.username}-${dbDevice.device_name}`;
            let opnsensePeer = null;

            if (dbDevice.opnsense_peer_id) {
                opnsensePeer = opnsensePeerMap.get(dbDevice.opnsense_peer_id);
            }

            // If not found by ID, try by name (in case ID was lost or changed)
            if (!opnsensePeer) {
                opnsensePeer = opnsensePeerNameMap.get(peerName);
            }

            if (!opnsensePeer) {
                // Device exists in DB but not in OPNsense, ADD it to OPNsense
                console.log(`[SYNC] Adding DB device '${peerName}' to OPNsense...`);
                try {
                    const addResult = await opnsense.addWireGuardPeer(
                        peerName,
                        dbDevice.public_key,
                        dbDevice.assigned_ip,
                        dbDevice.preshared_key
                    );
                    if (addResult.success && addResult.peerId) {
                        // Update DB with new OPNsense peer ID
                        await pool.query(
                            'UPDATE user_devices SET opnsense_peer_id = $1 WHERE id = $2',
                            [addResult.peerId, dbDevice.id]
                        );
                        console.log(`[SYNC] Successfully added '${peerName}' to OPNsense. Peer ID: ${addResult.peerId}`);
                    } else {
                        console.error(`[SYNC] Failed to add '${peerName}' to OPNsense: No peerId returned.`);
                    }
                } catch (addError) {
                    console.error(`[SYNC] Error adding '${peerName}' to OPNsense:`, addError.message);
                }
            } else {
                // Device exists in both, ensure opnsense_peer_id is correct in DB
                const opnsensePeerUuid = opnsensePeer.uuid || opnsensePeer.client?.uuid;
                if (opnsensePeerUuid && dbDevice.opnsense_peer_id !== opnsensePeerUuid) {
                    console.log(`[SYNC] Updating opnsense_peer_id for DB device '${peerName}' from ${dbDevice.opnsense_peer_id} to ${opnsensePeerUuid}`);
                    await pool.query(
                        'UPDATE user_devices SET opnsense_peer_id = $1 WHERE id = $2',
                        [opnsensePeerUuid, dbDevice.id]
                    );
                }
                // TODO: Potentially check for public_key, assigned_ip, preshared_key consistency
                // For now, just ensuring existence and correct peer_id
            }
        }

        // 4. Reconcile: OPNsense -> Database (Remove OPNsense peers not in DB)
        for (const opnsensePeer of opnsensePeers) {
            const uuid = opnsensePeer.uuid || opnsensePeer.client?.uuid;
            const name = opnsensePeer.name || opnsensePeer.client?.name || opnsensePeer.client_name;

            // Skip if it's a system-managed peer (e.g., the server itself, if it appears in this list)
            // Assuming client list only returns client peers, not server interfaces.
            // If server interface appears, we'd need a more robust check here.

            let foundInDb = false;
            if (uuid && dbDeviceMap.has(uuid)) {
                foundInDb = true;
            } else if (name && dbDeviceNameMap.has(name)) {
                foundInDb = true;
            }

            if (!foundInDb) {
                // Peer exists in OPNsense but not in DB, REMOVE it from OPNsense
                console.log(`[SYNC] Removing OPNsense peer '${name}' (UUID: ${uuid}) not found in DB...`);
                try {
                    if (uuid) {
                        await opnsense.removeWireGuardPeer(uuid);
                        console.log(`[SYNC] Successfully removed OPNsense peer '${name}' (UUID: ${uuid}).`);
                    } else {
                        console.warn(`[SYNC] Cannot remove OPNsense peer '${name}': No UUID found.`);
                    }
                } catch (removeError) {
                    console.error(`[SYNC] Error removing OPNsense peer '${name}' (UUID: ${uuid}):`, removeError.message);
                }
            }
        }

        console.log('[SYNC] OPNsense peer synchronization completed.');
    } catch (error) {
        console.error('[SYNC] Error during OPNsense peer synchronization:', error.message);
    }
}

// Schedule the sync job to run once a day (e.g., at 3:00 AM)
// The user requested "once a day for now", so a specific time is better than every 24 hours from startup.
// This can be adjusted later if a different time or frequency is needed.
function startOpnsenseSyncJob() {
    cron.schedule('0 3 * * *', () => { // Runs at 03:00 AM every day
        syncOpnsensePeers();
    }, {
        scheduled: true,
        timezone: "America/Los_Angeles" // Assuming a common timezone for server operations
    });
    console.log('[SYNC] OPNsense daily sync job scheduled for 03:00 AM (America/Los_Angeles).');
    // Run once immediately on startup for initial consistency
    syncOpnsensePeers();
}

module.exports = {
    syncOpnsensePeers,
    startOpnsenseSyncJob
};
