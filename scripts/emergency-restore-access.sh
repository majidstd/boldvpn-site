#!/bin/sh
#
# Emergency: Restore SSH Access
# Completely disables firewall and clears all rules
#

echo "================================================================"
echo "  Emergency: Restoring SSH Access"
echo "================================================================"
echo ""

# Flush all firewall rules immediately
echo "[i] Flushing all firewall rules..."
ipfw -q -f flush

# Add a temporary rule to allow everything
echo "[i] Adding temporary allow-all rule..."
ipfw add 100 allow ip from any to any

echo "[OK] All traffic now allowed"
echo ""

# Disable firewall in rc.conf
echo "[i] Disabling firewall in rc.conf..."
sysrc firewall_enable="NO"
sysrc firewall_type=""
sysrc firewall_script=""
sysrc firewall_myservices=""
sysrc firewall_allowservices=""
sysrc firewall_logging="NO"

echo "[OK] Firewall disabled in configuration"
echo ""

# Stop the firewall service
echo "[i] Stopping firewall service..."
service ipfw stop 2>/dev/null || echo "[i] Service already stopped"

echo ""
echo "================================================================"
echo "  [OK] SSH Access Restored!"
echo "================================================================"
echo ""
echo "Your SSH connection should work now."
echo "Firewall is completely disabled."
echo ""
echo "Next steps:"
echo "  1. Verify SSH works from another terminal"
echo "  2. Continue with RADIUS setup"
echo "  3. Add firewall later with setup-firewall.sh (optional)"
echo ""


