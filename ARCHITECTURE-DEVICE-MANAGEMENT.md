# Architecture: User Device Management System (v1.1.0)

## Overview

The User Device Management System provides a complete solution for managing WireGuard VPN devices, integrating seamlessly with OPNsense firewall and PostgreSQL database. The system follows a **database-first architecture** where the database is the single source of truth, with OPNsense synchronized daily.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                             │
│                    (portal.boldvpn.net)                         │
└───────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Server (Node.js)                         │
│                   (api.boldvpn.net)                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Express.js Routes                            │ │
│  │  - /api/devices (GET, POST, DELETE)                       │ │
│  │  - /api/devices/:id/config                                │ │
│  │  - /api/devices/:id/qrcode                                │ │
│  │  - /api/admin/sync/opnsense                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌──────────────────────────┼──────────────────────────────┐ │
│  │                          │                               │ │
│  │  ┌──────────────────────▼──────────────────────────┐  │ │
│  │  │         Device Routes Handler                      │  │ │
│  │  │  - Generate WireGuard keys                         │  │ │
│  │  │  - Assign IP addresses                             │  │ │
│  │  │  - Validate plan tier                             │  │ │
│  │  │  - Enforce device limits                           │  │ │
│  │  └──────────────────────┬──────────────────────────┘  │  │
│  │                         │                              │  │
│  │  ┌──────────────────────▼──────────────────────────┐  │  │
│  │  │         OPNsense Integration                      │  │  │
│  │  │  - Add WireGuard peer                              │  │  │
│  │  │  - Remove WireGuard peer                           │  │  │
│  │  │  - Get server UUID                                │  │  │
│  │  │  - Service management                              │  │  │
│  │  └──────────────────────┬──────────────────────────┘  │  │
│  │                         │                              │  │
│  │  ┌──────────────────────▼──────────────────────────┐  │  │
│  │  │         Database Layer                            │  │  │
│  │  │  - Query user_devices                             │  │  │
│  │  │  - Query vpn_servers                              │  │  │
│  │  │  - Query user_details (plan_tier)                 │  │  │
│  │  └──────────────────────┬──────────────────────────┘  │  │
│  └─────────────────────────┼──────────────────────────────┘ │
└─────────────────────────────┼─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  user_devices                                             │ │
│  │  - id, username, device_name                             │ │
│  │  - server_id, assigned_ip                                 │ │
│  │  - private_key, public_key, preshared_key                 │ │
│  │  - opnsense_peer_id (UUID)                                │ │
│  │  - config_file, created_at                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  vpn_servers                                              │ │
│  │  - id, name, country, city                                │ │
│  │  - wireguard_endpoint, wireguard_public_key              │ │
│  │  - is_premium (boolean)                                   │ │
│  │  - status (active/inactive)                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  user_details                                             │ │
│  │  - username, email                                         │ │
│  │  - plan_tier (free/basic/premium/family)                  │ │
│  │  - password_hash                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  radreply                                                 │ │
│  │  - username, attribute, value                            │ │
│  │  - Simultaneous-Use (device limit)                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Daily Sync (node-cron)
                              │ Manual Sync (admin API)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              OPNsense Firewall                                 │
│            (firewall.boldvpn.net:8443)                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  WireGuard Service                                       │ │
│  │  - Server configuration                                  │ │
│  │  - Client/Peer management                                 │ │
│  │  - UUID-based peer tracking                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  OPNsense API                                            │ │
│  │  - /wireguard/server/get                                 │ │
│  │  - /wireguard/client/addClient                           │ │
│  │  - /wireguard/client/delClient/{uuid}                    │ │
│  │  - /wireguard/service/reconfigure                        │ │
│  │  - /wireguard/service/restart                            │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Device Creation Flow

```
1. User clicks "Add Device" in Portal
   ↓
2. Frontend validates:
   - Device name format (alphanumeric, dash, underscore)
   - Device name length (3-50 chars)
   - Server selection (premium check)
   ↓
3. POST /api/devices
   ↓
4. Backend validates:
   - Authentication (JWT token)
   - Device name uniqueness
   - Device limit check (from radreply)
   - Premium server access (plan_tier check)
   ↓
5. Generate WireGuard keys:
   - Private key (wg genkey)
   - Public key (wg pubkey)
   - Preshared key (wg genpsk)
   ↓
6. Assign IP address:
   - Query last assigned IP for server
   - Increment last octet
   - Validate subnet range
   ↓
7. Insert into database:
   - Save device with keys and IP
   - Return device record
   ↓
8. Add to OPNsense:
   - Get server UUID dynamically
   - Create client with public key, IP, PSK
   - Store returned UUID in database
   ↓
9. Generate WireGuard config:
   - Format config file with keys and server info
   - Save to database
   ↓
10. Return success to user
```

### Device Deletion Flow

```
1. User clicks "Remove" on device
   ↓
2. DELETE /api/devices/:deviceId
   ↓
3. Backend validates:
   - Authentication
   - Device ownership (username match)
   ↓
4. Get device info:
   - Retrieve opnsense_peer_id
   ↓
5. Remove from OPNsense:
   - Call delClient/{uuid} endpoint
   - Restart WireGuard service
   ↓
6. Hard delete from database:
   - DELETE FROM user_devices WHERE id = $1
   ↓
7. Return success
```

### Synchronization Flow (Daily)

```
Daily Cron Job (node-cron, 2:00 AM)
   ↓
1. Get all devices from database:
   - SELECT * FROM user_devices
   - Map by opnsense_peer_id
   - Map by peer name (username-deviceName)
   ↓
2. Get all peers from OPNsense:
   - GET /wireguard/client/get
   - Normalize response format
   ↓
3. Compare and reconcile:
   
   For each DB device:
   - If no opnsense_peer_id:
     → Add to OPNsense
     → Update DB with UUID
   - If opnsense_peer_id exists:
     → Verify peer exists in OPNsense
     → If missing, re-add
   
   For each OPNsense peer:
   - If not in database:
     → Remove from OPNsense (orphan cleanup)
   ↓
4. Log sync results
```

---

## Database Schema

### user_devices Table

```sql
CREATE TABLE user_devices (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    server_id INTEGER NOT NULL REFERENCES vpn_servers(id),
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    preshared_key TEXT,
    assigned_ip INET NOT NULL,
    opnsense_peer_id VARCHAR(36),  -- OPNsense UUID
    config_file TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(username, device_name)
);
```

**Key Points:**
- `opnsense_peer_id` stores OPNsense UUID for tracking
- `assigned_ip` uses PostgreSQL INET type
- Unique constraint on (username, device_name)
- Hard delete (no soft delete/is_active column)

### vpn_servers Table

```sql
CREATE TABLE vpn_servers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    wireguard_endpoint VARCHAR(255),
    wireguard_public_key TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active'
);
```

**Key Points:**
- `is_premium` flag for premium server access control
- `status` field for server availability

### user_details Table (plan_tier)

```sql
ALTER TABLE user_details ADD COLUMN plan_tier VARCHAR(20) DEFAULT 'free';
```

**Plan Tiers:**
- `free` - Free tier (limited devices, no premium servers)
- `basic` - Basic plan (2 devices, standard servers)
- `premium` - Premium plan (5 devices, premium servers)
- `family` - Family plan (10 devices, premium servers)

---

## API Endpoints

### Device Management

#### `POST /api/devices`
Create a new device.

**Request:**
```json
{
  "deviceName": "my-laptop",
  "serverId": 13
}
```

**Response (201):**
```json
{
  "message": "Device added successfully",
  "device": {
    "id": 123,
    "deviceName": "my-laptop",
    "server": {
      "id": 13,
      "name": "Vancouver-01",
      "location": "🇨🇦 Canada, Vancouver"
    },
    "assignedIP": "10.8.0.5",
    "publicKey": "...",
    "createdAt": "2024-12-01T10:00:00Z"
  }
}
```

#### `GET /api/devices`
List all user devices.

**Response (200):**
```json
[
  {
    "id": 123,
    "deviceName": "my-laptop",
    "server": {
      "id": 13,
      "name": "Vancouver-01",
      "location": "🇨🇦 Canada, Vancouver"
    },
    "assignedIP": "10.8.0.5",
    "createdAt": "2024-12-01T10:00:00Z"
  }
]
```

#### `DELETE /api/devices/:deviceId`
Remove a device.

**Response (200):**
```json
{
  "message": "Device removed successfully",
  "opnsenseRemoved": true
}
```

#### `GET /api/devices/:deviceId/config`
Download WireGuard configuration file.

**Response:** `text/plain` WireGuard config file

#### `GET /api/devices/:deviceId/qrcode`
Get QR code image for mobile setup.

**Response:** `image/png` QR code image

### Admin Endpoints

#### `POST /api/admin/sync/opnsense`
Manually trigger OPNsense synchronization.

**Headers:**
```
X-OPNSENSE-API-KEY: <key>
X-OPNSENSE-API-SECRET: <secret>
```

**Response (200):**
```json
{
  "message": "Sync completed",
  "added": 2,
  "removed": 1,
  "updated": 0
}
```

---

## Security Architecture

### Authentication & Authorization

1. **JWT Token Authentication**
   - All device endpoints require valid JWT token
   - Token contains username and plan information
   - Expires after 24 hours (configurable)

2. **User Isolation**
   - All queries filtered by `username` from JWT
   - Users can only access their own devices
   - Server-side validation prevents privilege escalation

3. **Input Validation**
   - Device name: alphanumeric, dash, underscore only
   - Length validation: 3-50 characters
   - Server ID: must exist and be active
   - Plan tier validation for premium servers

### SQL Injection Prevention

- **Parameterized Queries**: All database queries use `$1, $2, ...` placeholders
- **No String Concatenation**: Never build SQL with string concatenation
- **Input Sanitization**: All user input validated before database operations

### XSS Protection

- **HTML Escaping**: All user-generated content escaped before rendering
- **Template System**: Uses DOM manipulation instead of innerHTML where possible
- **Content Security Policy**: Helmet.js CSP headers configured

### CORS Configuration

- **Whitelist Origins**: Only allowed origins can access API
- **Subdomain Support**: All `*.boldvpn.net` subdomains allowed
- **Credentials**: CORS credentials enabled for cookie/token support

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message here",
  "details": "Stack trace (development only)"
}
```

### Error Categories

1. **Validation Errors (400)**
   - Invalid device name format
   - Missing required fields
   - Invalid server ID

2. **Authentication Errors (401)**
   - Missing or invalid JWT token
   - Token expired

3. **Authorization Errors (403)**
   - Device limit reached
   - Premium server access denied
   - Device ownership mismatch

4. **Not Found Errors (404)**
   - Device not found
   - Server not found
   - User not found

5. **Server Errors (500)**
   - Database connection failure
   - OPNsense API failure
   - WireGuard key generation failure

### Error Logging

- **Development**: Full error details with stack traces
- **Production**: Sanitized error messages (no sensitive data)
- **Database Queries**: Parameter values replaced with `[PARAM]` in logs
- **Slow Query Detection**: Queries > 1 second logged in production

---

## Performance Optimizations

### Database-First Architecture

- **No Per-Request OPNsense Calls**: All device listing uses database
- **Daily Sync**: OPNsense synchronized once per day via cron
- **Manual Sync**: Available via admin API when needed
- **Performance Impact**: Reduced from ~500ms to ~50ms per request

### Query Optimization

- **Indexed Columns**: `username`, `device_name`, `server_id` indexed
- **Efficient Joins**: Server information joined efficiently
- **Connection Pooling**: PostgreSQL connection pool (max 20 connections)

### Caching Strategy

- **Server List**: Cached in frontend (refreshed on page load)
- **User Profile**: Cached in frontend session
- **No Database Caching**: Real-time data always fresh

---

## Deployment Architecture

### Production Environment

```
┌─────────────────────────────────────────────────────────┐
│              HAProxy Load Balancer                      │
│         (SSL Termination, Rate Limiting)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Node.js API Server (FreeBSD)                    │
│         - Express.js application                        │
│         - PM2 process manager                          │
│         - Port 3000                                     │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  PostgreSQL     │    │  OPNsense       │
│  Database       │    │  Firewall       │
│  (FreeBSD)       │    │  (Internal)     │
└─────────────────┘    └─────────────────┘
```

### Frontend Deployment

```
┌─────────────────────────────────────────────────────────┐
│         Static File Server (Nginx/CDN)                  │
│         - portal.boldvpn.net                             │
│         - Static HTML/CSS/JS files                       │
└─────────────────────────────────────────────────────────┘
```

---

## Monitoring & Logging

### Application Logs

- **Location**: `/var/log/boldvpn-api.log`
- **Format**: Structured logging with timestamps
- **Levels**: INFO, WARN, ERROR
- **Rotation**: Daily log rotation

### Key Log Events

- Device creation/deletion
- OPNsense API calls
- Synchronization job execution
- Error conditions
- Slow queries (>1 second)

### Health Checks

- **Endpoint**: `GET /api/health`
- **Checks**: Database connectivity, OPNsense connectivity
- **Response**: Status of all components

---

## Future Enhancements

### Planned Features

1. **Device Rename**
   - Update device name without recreating
   - Update OPNsense peer name

2. **Device Transfer**
   - Move device between servers
   - Update IP address and endpoint

3. **Bulk Operations**
   - Create multiple devices at once
   - Bulk delete with confirmation

4. **Usage Statistics**
   - Track device connection time
   - Data transfer per device
   - Connection history

5. **Connection Monitoring**
   - Real-time connection status
   - Last handshake time
   - Active peer detection

6. **Automated Cleanup**
   - Remove inactive devices after X days
   - Cleanup orphaned OPNsense peers

---

## Version History

- **v1.1.0** (December 2024) - User Device Management System
  - Complete device CRUD operations
  - OPNsense integration
  - Daily synchronization
  - Premium server access control
  - Production-ready security

- **v1.0.0** (November 2024) - Authentication System
  - User authentication
  - JWT token management
  - Portal login

---

**Document Version:** 1.1.0  
**Last Updated:** December 2024  
**Status:** Production Ready

