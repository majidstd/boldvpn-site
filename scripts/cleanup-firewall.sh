#!/bin/sh
#
# Cleanup Broken Firewall Configuration
# Removes old/broken firewall settings from rc.conf
#

echo "================================================================"
echo "  Cleaning Up Broken Firewall Configuration"
echo "================================================================"
echo ""

# Show current firewall settings
echo "[i] Current firewall settings in rc.conf:"
echo ""
sysrc -a | grep firewall
echo ""

# Remove all firewall-related settings
echo "[i] Removing old firewall configuration..."
sysrc -x firewall_enable
sysrc -x firewall_type
sysrc -x firewall_script
sysrc -x firewall_myservices
sysrc -x firewall_allowservices
sysrc -x firewall_logging
sysrc -x firewall_logif
sysrc -x firewall_flags

echo "[OK] Old firewall settings removed"
echo ""

# Stop firewall service
echo "[i] Stopping firewall service..."
service ipfw stop 2>/dev/null || echo "[i] Service already stopped"

# Flush all rules
echo "[i] Flushing all firewall rules..."
ipfw -q -f flush

# Add temporary allow-all rule (so nothing breaks)
echo "[i] Adding temporary allow-all rule..."
ipfw add 100 allow ip from any to any

echo "[OK] Firewall rules flushed"
echo ""

# Verify no firewall settings remain
echo "[i] Verifying cleanup..."
if sysrc -a | grep -q firewall; then
    echo "[!] Some firewall settings still present:"
    sysrc -a | grep firewall
else
    echo "[OK] All firewall settings removed"
fi

echo ""
echo "================================================================"
echo "  [OK] Cleanup Complete!"
echo "================================================================"
echo ""
echo "Current state:"
echo "  - All firewall rules flushed"
echo "  - Temporary allow-all rule active"
echo "  - Firewall service stopped"
echo "  - rc.conf cleaned up"
echo ""
echo "Next steps:"
echo "  1. Continue with RADIUS setup"
echo "  2. Add proper firewall later with: ./setup-firewall.sh"
echo ""
