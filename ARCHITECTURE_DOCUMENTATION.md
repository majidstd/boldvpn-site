# BoldVPN System Architecture Documentation

## 1. High-Level Overview

The BoldVPN system is a full-stack application designed to manage VPN user accounts and WireGuard devices, integrating with an OPNsense firewall for network configuration. It consists of a Node.js API backend, a static HTML/JavaScript frontend portal, a PostgreSQL database, and various shell scripts for management and automation.

## 2. Component Breakdown and File Mapping

### 2.1. API Backend (Node.js with Express.js)

*   **Location:** `api/` directory
*   **Purpose:** Handles user authentication, device management, billing, server management, and integration with the OPNsense firewall.
*   **Key Files:**
    *   `api/server.js`: The main entry point for the Node.js Express application. Sets up middleware, routes, and starts the server.
    *   `api/routes/auth.js`: Handles user registration, login, and token authentication.
    *   `api/routes/devices.js`: Manages user VPN devices (creation, listing, deletion, configuration retrieval). This is where the logic for interacting with OPNsense for peer management resides.
    *   `api/routes/billing.js`: (Assumed) Handles subscription and payment-related logic.
    *   `api/routes/servers.js`: Manages VPN server information.
    *   `api/utils/database.js`: Contains the PostgreSQL database connection pool and utility functions for database interactions.
    *   `api/utils/opnsense.js`: Encapsulates all interactions with the OPNsense API, including adding/removing WireGuard peers, getting server information, and restarting services.
    *   `api/utils/email.js`: (Assumed) Handles sending emails (e.g., for password resets, notifications).
    *   `api/middleware/auth.js`: Middleware for authenticating JWT tokens.
    *   `api/migrations/*.sql`: SQL scripts for managing database schema changes.

### 2.2. Frontend Portal (Static HTML/JavaScript)

*   **Location:** `portal/` directory (and potentially `index.html`, `script.js`, `styles.css` in the root)
*   **Purpose:** Provides a user interface for users to manage their devices, view configurations, and interact with the VPN service.
*   **Key Files:**
    *   `portal/index.html`: The main HTML file for the user portal.
    *   `portal/app.js`: The core JavaScript application logic for the frontend, handling UI interactions and data fetching.
    *   `portal/api.js`: A JavaScript module for making API requests to the backend.
    *   `portal/styles.css`: Styling for the portal.
    *   `index.html`, `script.js`, `styles.css` (root): Potentially a marketing landing page or a simpler portal.

### 2.3. Database (PostgreSQL)

*   **Purpose:** Stores all persistent data, including user accounts, device configurations, VPN server details, and subscription information.
*   **Key Tables (from migrations):**
    *   `users`: User authentication details.
    *   `user_details`: Additional user information (e.g., `plan_tier`).
    *   `user_devices`: Stores details for each VPN device, including public/private keys, assigned IP, and OPNsense peer ID.
    *   `vpn_servers`: Information about available VPN servers.
    *   `password_reset_tokens`: For password reset functionality.
    *   `radreply`: (Assumed) For RADIUS attributes like `Simultaneous-Use` (device limits).

### 2.4. OPNsense Firewall Integration

*   **Purpose:** The OPNsense firewall acts as the WireGuard server. The API interacts with its API to dynamically add, remove, and manage WireGuard peers.
*   **Key Interaction:** The `api/utils/opnsense.js` module is responsible for all communication with the OPNsense API.

### 2.5. Management and Troubleshooting Scripts

*   **Location:** `scripts/` directory
*   **Purpose:** Automate common administrative tasks, perform diagnostics, and manage the system.
*   **Key Files:**
    *   `scripts/manage-device.sh`: An interactive shell script for managing devices, listing information from the API, database, and OPNsense, and diagnosing issues.
    *   `scripts/apply-migrations.sh`: Applies database migration scripts.
    *   `scripts/cleanup-servers.sh`: Cleans up server-related data.
    *   `scripts/test-api-endpoints.sh`: Tests API functionality.
    *   `scripts/setup-vpn-servers.sh`: Sets up VPN server configurations.
    *   `scripts/radius_diag.sh`: (Assumed) Diagnostics for RADIUS server.

### 2.6. Infrastructure Configurations

*   **Location:** `infra/` directory
*   **Purpose:** Stores configuration files and setup instructions for various infrastructure components.
*   **Key Files:**
    *   `infra/opnsense/haproxy.conf`: HAProxy configuration for OPNsense.
    *   `infra/freebsd/*`: Setup scripts and configurations for FreeBSD (e.g., PostgreSQL, FreeRADIUS).

## 3. Data Flow Example: User Creates a New Device

1.  **User Action (Portal):** A user logs into the `portal/index.html` and uses the UI (driven by `portal/app.js` and `portal/api.js`) to request a new VPN device with a specified `deviceName` and `serverId`.
2.  **API Request (Frontend to Backend):** `portal/api.js` sends a `POST` request to `/api/devices` on the Node.js API backend (`api/server.js`), including the `deviceName` and `serverId` in the request body. The request is authenticated via `api/middleware/auth.js`.
3.  **API Processing (Backend):**
    *   `api/routes/devices.js` receives the request.
    *   It validates the input and checks for existing devices or device limits (querying `user_devices` and `radreply` via `api/utils/database.js`).
    *   It fetches server details from `vpn_servers` via `api/utils/database.js`.
    *   It generates WireGuard key pairs (private, public, preshared keys) using `wg genkey`/`wg pubkey`/`wg genpsk` commands.
    *   It determines the next available IP address for the server's subnet.
    *   It inserts the new device's details (username, deviceName, keys, assigned IP, server ID) into the `user_devices` table via `api/utils/database.js`.
    *   **OPNsense Integration:** It calls `opnsense.addWireGuardPeer` (from `api/utils/opnsense.js`), passing the generated public key, assigned IP, preshared key, and a combined `username-deviceName` string as the peer name.
    *   `opnsense.addWireGuardPeer` makes an HTTPS request to the OPNsense API to create the WireGuard peer.
    *   If successful, the `opnsense_peer_id` returned by OPNsense is updated in the `user_devices` table.
    *   A WireGuard configuration file is generated (`generateWireGuardConfig`) and stored in the `user_devices` table.
4.  **API Response (Backend to Frontend):** The API sends a success response back to the portal, including details of the newly created device.
5.  **UI Update (Portal):** The `portal/app.js` updates the user interface to display the new device.

## 4. Troubleshooting Commands

Here are some common commands for troubleshooting various components of the BoldVPN system:

### 4.1. API Backend

*   **Check API logs:**
    ```bash
    tail -f /var/log/boldvpn-api.log
    ```
*   **Restart API service (if running as a service):**
    ```bash
    sudo service boldvpn_api restart
    ```
    (Assuming `boldvpn_api` is the service name)
*   **Manually run API (for development/debugging):**
    ```bash
    cd /path/to/boldvpn-site/api
    npm install # if dependencies changed
    npm start   # or node server.js
    ```
*   **Test API endpoints (using provided script):**
    ```bash
    ./scripts/test-api-endpoints.sh
    ```

### 4.2. Database (PostgreSQL)

*   **Connect to PostgreSQL (as radiususer):**
    ```bash
    psql -U radiususer -d radius
    ```
    (Replace `radiususer` and `radius` with actual DB user/name if different)
*   **List all devices:**
    ```bash
    psql -U radiususer -d radius -c "SELECT * FROM user_devices;"
    ```
*   **Check device count:**
    ```bash
    psql -U radiususer -d radius -c "SELECT COUNT(*) FROM user_devices;"
    ```
*   **Apply migrations (if needed):**
    ```bash
    ./scripts/apply-migrations.sh
    ```

### 4.3. OPNsense Firewall

*   **Check WireGuard service status (on OPNsense CLI):**
    ```bash
    /usr/local/etc/rc.d/wireguard status
    ```
*   **Restart WireGuard service (on OPNsense CLI):**
    ```bash
    /usr/local/etc/rc.d/wireguard restart
    ```
*   **View WireGuard peers (on OPNsense CLI):**
    ```bash
    wg show
    ```
*   **Check OPNsense API logs (if available, or general system logs):**
    (Specific log location depends on OPNsense configuration, often in `/var/log/` or accessible via GUI)
*   **Use `scripts/manage-device.sh` for OPNsense checks:**
    ```bash
    ./scripts/manage-device.sh # Then choose option 4 (List devices from OPNsense)
    ```

### 4.4. General System / Scripts

*   **Interactive Device Management:**
    ```bash
    ./scripts/manage-device.sh
    ```
*   **Check system logs:**
    ```bash
    tail -f /var/log/syslog # or /var/log/messages, depending on OS
    ```
*   **Verify network connectivity:**
    ```bash
    ping <OPNsense_IP>
    curl -v https://<OPNsense_IP>:<OPNsense_PORT>/api/
    ```

---