#!/bin/sh
#
# GitHub SSH Setup and Clone Script for FreeBSD
# Run as admin user (not root!)
#
# Usage:
#   chmod +x setup-github.sh
#   ./setup-github.sh
#

echo "================================================================"
echo "  BoldVPN GitHub Setup Script"
echo "  FreeBSD Server - SSH Key & Clone"
echo "================================================================"
echo ""

# Check not running as root
if [ "$(id -u)" -eq 0 ]; then
    echo "[!] Warning: Don't run this as root!"
    echo "    Run as admin user without sudo"
    echo "    Example: ./setup-github.sh"
    exit 1
fi

echo "[OK] Running as user: $(whoami)"
echo ""

# Step 1: Check if SSH key exists
echo "================================================================"
echo "STEP 1: Check SSH Key"
echo "================================================================"
echo ""

if [ -f "$HOME/.ssh/id_ed25519" ]; then
    echo "[OK] SSH key already exists: $HOME/.ssh/id_ed25519"
    echo ""
else
    echo "[i] SSH key not found. Generating new key..."
    echo ""
    
    read -p "Enter your email for SSH key: " EMAIL
    
    ssh-keygen -t ed25519 -C "$EMAIL" -f "$HOME/.ssh/id_ed25519" -N ""
    
    echo ""
    echo "[OK] SSH key generated!"
    echo ""
fi

# Step 2: Display public key
echo "================================================================"
echo "STEP 2: Your Public SSH Key"
echo "================================================================"
echo ""
echo "Copy the key below and add it to GitHub:"
echo ""
echo "------- START KEY -------"
cat "$HOME/.ssh/id_ed25519.pub"
echo "------- END KEY -------"
echo ""
echo "Add this key to GitHub:"
echo "1. Go to: https://github.com/settings/keys"
echo "2. Click: 'New SSH key'"
echo "3. Title: 'BoldVPN FreeBSD Server'"
echo "4. Paste the key above"
echo "5. Click: 'Add SSH key'"
echo ""

read -p "Press ENTER after you've added the key to GitHub..."
echo ""

# Step 3: Test SSH connection
echo "================================================================"
echo "STEP 3: Test GitHub SSH Connection"
echo "================================================================"
echo ""

ssh -T git@github.com 2>&1 | grep "successfully authenticated" > /dev/null

if [ $? -eq 0 ]; then
    echo "[OK] SSH connection to GitHub successful!"
    echo ""
else
    echo "[!] Testing connection (you may see a warning, that's OK)..."
    ssh -T git@github.com
    echo ""
    read -p "Did you see 'successfully authenticated'? (y/n): " CONFIRMED
    if [ "$CONFIRMED" != "y" ]; then
        echo "[X] SSH connection failed. Please check:"
        echo "    1. Key is added to GitHub: https://github.com/settings/keys"
        echo "    2. You accepted the GitHub host key"
        exit 1
    fi
fi

# Step 4: Clone or pull repository
echo "================================================================"
echo "STEP 4: Clone/Update Repository"
echo "================================================================"
echo ""

REPO_DIR="/usr/local/boldvpn-site"

if [ -d "$REPO_DIR" ]; then
    echo "[i] Repository already exists at: $REPO_DIR"
    echo ""
    read -p "Do you want to pull latest changes? (y/n): " DO_PULL
    
    if [ "$DO_PULL" = "y" ]; then
        echo ""
        echo "Pulling latest changes..."
        cd "$REPO_DIR"
        git pull
        echo ""
        echo "[OK] Repository updated!"
    else
        echo ""
        echo "[i] Skipped git pull"
    fi
else
    echo "[i] Repository not found. Cloning..."
    echo ""
    
    # Create directory with sudo
    echo "Creating /usr/local/boldvpn-site (requires sudo)..."
    sudo mkdir -p /usr/local
    
    # Clone as current user to home first
    cd "$HOME"
    git clone git@github.com:majidstd/boldvpn-site.git
    
    if [ $? -ne 0 ]; then
        echo "[X] Git clone failed!"
        exit 1
    fi
    
    # Move to /usr/local with sudo
    echo ""
    echo "Moving to /usr/local/ (requires sudo)..."
    sudo mv boldvpn-site /usr/local/
    
    # Set ownership to current user
    echo "Setting ownership to $(whoami)..."
    sudo chown -R $(whoami):wheel /usr/local/boldvpn-site
    
    echo ""
    echo "[OK] Repository cloned to: $REPO_DIR"
fi

echo ""

# Step 5: Summary
echo "================================================================"
echo "  Setup Complete!"
echo "================================================================"
echo ""
echo "Repository location: $REPO_DIR"
echo "SSH key location: $HOME/.ssh/id_ed25519"
echo ""
echo "Next steps:"
echo ""
echo "1. Deploy RADIUS server:"
echo "   cd /usr/local/boldvpn-site"
echo "   sudo ./scripts/freebsd-radius-setup.sh"
echo ""
echo "2. Deploy API server:"
echo "   cd /usr/local/boldvpn-site"
echo "   sudo ./scripts/freebsd-api-setup.sh"
echo ""
echo "3. Test services:"
echo "   sudo service radiusd status"
echo "   sudo service boldvpn_api status"
echo ""
echo "To update in the future, just run:"
echo "   cd /usr/local/boldvpn-site"
echo "   git pull"
echo ""
echo "[OK] All done!"
echo ""

