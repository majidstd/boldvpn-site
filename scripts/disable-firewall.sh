#!/bin/sh
#
# Emergency: Disable FreeBSD Firewall
# Use this if you got locked out after running the setup script
#

echo "================================================================"
echo "  Disabling FreeBSD Firewall"
echo "================================================================"
echo ""

# Disable firewall
echo "[i] Disabling firewall..."
sysrc firewall_enable="NO"

# Stop firewall service
echo "[i] Stopping firewall service..."
service ipfw stop 2>/dev/null

# Verify
if service ipfw status >/dev/null 2>&1; then
    echo "[!] Firewall still running"
else
    echo "[OK] Firewall stopped"
fi

echo ""
echo "================================================================"
echo "  [OK] Firewall Disabled"
echo "================================================================"
echo ""
echo "Your SSH connection should work now."
echo ""
echo "RADIUS ports (1812, 1813) are now open without firewall."
echo "Consider setting up proper firewall rules later."
echo ""
