#!/bin/sh
#
# Fix API CORS Configuration
# Allows browser access from any origin
#
# Usage: Run on FreeBSD server
#   sudo sh fix-api-cors.sh
#

set -e

echo "============================================"
echo "  Fix BoldVPN API CORS Configuration"
echo "============================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] Error: This script must be run as root"
    echo "   Run: sudo sh fix-api-cors.sh"
    exit 1
fi

echo "[OK] Running as root"
echo ""

API_DIR="/usr/local/boldvpn-site/api"
SERVER_FILE="$API_DIR/server.js"
ENV_FILE="$API_DIR/.env"

# Check if API directory exists
if [ ! -d "$API_DIR" ]; then
    echo "[X] Error: API directory not found: $API_DIR"
    echo "   Make sure BoldVPN is installed at /usr/local/boldvpn-site"
    exit 1
fi

echo "[STEP] Fixing CORS configuration..."
echo ""

# Backup server.js
echo "  Backing up server.js..."
cp "$SERVER_FILE" "$SERVER_FILE.cors.bak.$(date +%Y%m%d_%H%M%S)"
echo "  [OK] Backup created"

# Check current CORS configuration
echo ""
echo "  Current CORS configuration:"
grep -A 6 "app.use(cors" "$SERVER_FILE" | head -7
echo ""

# Update .env file to set FRONTEND_URL
if [ -f "$ENV_FILE" ]; then
    echo "  Updating .env file..."
    
    # Backup .env
    cp "$ENV_FILE" "$ENV_FILE.bak"
    
    # Check if FRONTEND_URL exists
    if grep -q "^FRONTEND_URL=" "$ENV_FILE"; then
        # Update existing - set to wildcard
        sed -i '' 's|^FRONTEND_URL=.*|# FRONTEND_URL not needed - using wildcard in server.js|' "$ENV_FILE"
        echo "  [OK] FRONTEND_URL commented out in .env"
    fi
    
    # Add note about CORS
    if ! grep -q "CORS allows all origins" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# CORS Configuration" >> "$ENV_FILE"
        echo "# CORS allows all origins (*) - configured in server.js" >> "$ENV_FILE"
        echo "  [OK] Added CORS note to .env"
    fi
fi

# Fix CORS in server.js - change origin to '*'
echo ""
echo "  Fixing CORS origin..."

# Replace the origin line
sed -i '' "s|origin: process.env.FRONTEND_URL.*|origin: '*',  // Allow all origins|" "$SERVER_FILE"

# Also change credentials to false when using wildcard
sed -i '' "s|credentials: true,|credentials: false,  // Must be false with wildcard origin|" "$SERVER_FILE"

echo "  [OK] CORS configuration updated"

# Show new configuration
echo ""
echo "  New CORS configuration:"
grep -A 6 "app.use(cors" "$SERVER_FILE" | head -7
echo ""

echo "================================================================"
echo ""
echo "[STEP] Restarting API service..."
service boldvpn_api restart

sleep 2

if service boldvpn_api status | grep -q "running"; then
    echo "  [OK] API service restarted successfully"
else
    echo "  [!] API service may not be running"
    echo "      Check logs: tail -50 /var/log/boldvpn-api.log"
    exit 1
fi

echo ""
echo "================================================================"
echo ""
echo "[TEST] Testing CORS configuration..."
echo ""

# Test API health endpoint
echo "  Testing API health..."
if curl -s http://localhost:3000/api/health | grep -q "OK"; then
    echo "  [OK] API is responding"
else
    echo "  [!] API not responding"
    echo "      Check: curl http://localhost:3000/api/health"
fi

# Test CORS headers
echo ""
echo "  Testing CORS headers..."
CORS_HEADER=$(curl -s -I http://localhost:3000/api/health | grep -i "access-control-allow-origin" || echo "")

if echo "$CORS_HEADER" | grep -q "\*"; then
    echo "  [OK] CORS allows all origins (*)"
elif [ -n "$CORS_HEADER" ]; then
    echo "  [!] CORS header found but not wildcard:"
    echo "      $CORS_HEADER"
else
    echo "  [!] No CORS header found"
    echo "      This might be OK - CORS headers only sent on actual requests"
fi

echo ""
echo "================================================================"
echo ""
echo "[OK] CORS FIX COMPLETE!"
echo ""
echo "Changes made:"
echo "  ✓ server.js: origin changed to '*' (allow all)"
echo "  ✓ server.js: credentials changed to false"
echo "  ✓ .env: FRONTEND_URL commented out (not needed)"
echo "  ✓ API service restarted"
echo ""
echo "Test from browser:"
echo "  1. Open: https://boldvpn.net/portal/"
echo "  2. Press F12 → Console"
echo "  3. Clear console (Ctrl+L)"
echo "  4. Try login: testuser / Test@123!"
echo "  5. Should work now! ✓"
echo ""
echo "If still getting CORS error:"
echo "  - Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "  - Clear browser cache"
echo "  - Try incognito/private window"
echo "  - Check: cat $SERVER_FILE | grep -A 6 'app.use(cors'"
echo ""
echo "============================================"
