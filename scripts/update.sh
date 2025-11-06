#!/bin/sh
#
# BoldVPN Update Script
# Quick git pull and service restart
#
# Usage:
#   ./update.sh
#

echo "================================================================"
echo "  BoldVPN Update Script"
echo "================================================================"
echo ""

REPO_DIR="/usr/local/boldvpn-site"

# Check if repo exists
if [ ! -d "$REPO_DIR" ]; then
    echo "[X] Error: Repository not found at $REPO_DIR"
    echo "    Run setup-github.sh first!"
    exit 1
fi

# Go to repo directory
cd "$REPO_DIR"

echo "Current directory: $(pwd)"
echo "Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "[!] Warning: You have uncommitted changes!"
    git status --short
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "Cancelled."
        exit 0
    fi
    echo ""
fi

# Pull latest changes
echo "Pulling latest changes from GitHub..."
echo ""

git pull

if [ $? -ne 0 ]; then
    echo ""
    echo "[X] Git pull failed!"
    echo "    Check your SSH key and network connection"
    exit 1
fi

echo ""
echo "[OK] Repository updated!"
echo ""

# Ask about restarting services
read -p "Restart API service? (y/n): " RESTART_API
if [ "$RESTART_API" = "y" ]; then
    echo ""
    echo "Stopping API service..."
    sudo service boldvpn_api stop
    
    echo "Installing any new dependencies..."
    cd api
    sudo npm install --production
    
    echo "Starting API service..."
    sudo service boldvpn_api start
    
    sleep 2
    sudo service boldvpn_api status
    
    cd ..
    echo ""
    echo "[OK] API service restarted!"
fi

echo ""
read -p "Restart RADIUS service? (y/n): " RESTART_RADIUS
if [ "$RESTART_RADIUS" = "y" ]; then
    echo ""
    sudo service radiusd restart
    sleep 1
    sudo service radiusd status
    echo ""
    echo "[OK] RADIUS service restarted!"
fi

echo ""
echo "================================================================"
echo "  Update Complete!"
echo "================================================================"
echo ""
echo "View logs:"
echo "  API:    tail -f /var/log/boldvpn-api.log"
echo "  RADIUS: tail -f /var/log/radius/radius.log"
echo ""

