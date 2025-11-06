#!/bin/sh
#
# BoldVPN RADIUS Server - Safe Firewall Configuration
# Uses custom ipfw rules to protect the server without locking you out
#
# Usage:
#   chmod +x setup-firewall.sh
#   sudo ./setup-firewall.sh
#

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] Error: This script must be run as root"
    echo "    Run: sudo sh setup-firewall.sh"
    exit 1
fi

echo "================================================================"
echo "  BoldVPN RADIUS Server - Firewall Setup"
echo "================================================================"
echo ""

# Get current SSH port (in case it's not 22)
CURRENT_SSH_PORT=$(sockstat -l | grep sshd | grep -o ':\([0-9]*\)' | head -1 | cut -d: -f2)
if [ -z "$CURRENT_SSH_PORT" ]; then
    CURRENT_SSH_PORT="22"
fi

echo "[i] Detected SSH port: $CURRENT_SSH_PORT"
echo ""

# Step 1: Clean up old/broken firewall configuration
echo "================================================================"
echo "  Step 1: Cleaning Up Old Firewall Configuration"
echo "================================================================"
echo ""

echo "[i] Checking for existing firewall settings..."
if sysrc -a | grep -q firewall; then
    echo "[i] Found existing settings, removing..."
    sysrc -x firewall_enable 2>/dev/null
    sysrc -x firewall_type 2>/dev/null
    sysrc -x firewall_script 2>/dev/null
    sysrc -x firewall_myservices 2>/dev/null
    sysrc -x firewall_allowservices 2>/dev/null
    sysrc -x firewall_logging 2>/dev/null
    sysrc -x firewall_logif 2>/dev/null
    sysrc -x firewall_flags 2>/dev/null
    echo "[OK] Old firewall settings removed"
else
    echo "[OK] No old settings found"
fi

# Stop firewall service if running
if service ipfw status >/dev/null 2>&1; then
    echo "[i] Stopping firewall service..."
    service ipfw stop
    echo "[OK] Firewall stopped"
else
    echo "[OK] Firewall not running"
fi

# Flush all existing rules
echo "[i] Flushing all existing firewall rules..."
ipfw -q -f flush
ipfw add 100 allow ip from any to any
echo "[OK] Old rules flushed"

echo ""
echo "================================================================"
echo "  Step 2: Creating New Firewall Configuration"
echo "================================================================"
echo ""

# Prompt for OPNsense IP (to restrict RADIUS access)
read -p "Enter OPNsense IP address (or 'any' for no restriction): " OPNSENSE_IP

if [ "$OPNSENSE_IP" = "any" ]; then
    RADIUS_RULE_AUTH="allow"
    RADIUS_RULE_ACCT="allow"
else
    RADIUS_RULE_AUTH="allow from $OPNSENSE_IP"
    RADIUS_RULE_ACCT="allow from $OPNSENSE_IP"
fi

echo ""
echo "[i] Creating firewall rules..."
echo ""

# Create custom firewall rules file
cat > /etc/ipfw.rules <<EOF
#!/bin/sh
#
# BoldVPN RADIUS Server - Custom Firewall Rules
# Created by setup-firewall.sh
#

# Flush all rules
ipfw -q -f flush

# Set default rule number
cmd="ipfw -q add"

# Rule 100: Allow all on loopback
\$cmd 100 allow ip from any to any via lo0

# Rule 200: Deny traffic to loopback that doesn't come from loopback
\$cmd 200 deny ip from any to 127.0.0.0/8
\$cmd 210 deny ip from 127.0.0.0/8 to any

# Rule 300: Allow established connections
\$cmd 300 allow tcp from any to any established

# Rule 400: Allow incoming SSH (CRITICAL - DON'T LOCK YOURSELF OUT!)
\$cmd 400 allow tcp from any to me $CURRENT_SSH_PORT in keep-state

# Rule 500: Allow RADIUS authentication (port 1812/udp)
\$cmd 500 $RADIUS_RULE_AUTH udp to me 1812 in keep-state

# Rule 510: Allow RADIUS accounting (port 1813/udp)
\$cmd 510 $RADIUS_RULE_ACCT udp to me 1813 in keep-state

# Rule 600: Allow API port (3000/tcp) - for future use
\$cmd 600 allow tcp from any to me 3000 in keep-state

# Rule 610: Allow HTTP (80/tcp) - for future web services
\$cmd 610 allow tcp from any to me 80 in keep-state

# Rule 620: Allow HTTPS (443/tcp) - for future web services
\$cmd 620 allow tcp from any to me 443 in keep-state

# Rule 700: Allow all outgoing traffic
\$cmd 700 allow ip from me to any out keep-state

# Rule 800: Allow ICMP (ping)
\$cmd 800 allow icmp from any to any

# Rule 900: Deny and log everything else
\$cmd 900 deny log ip from any to any

EOF

chmod 755 /etc/ipfw.rules

echo "[OK] Firewall rules created at /etc/ipfw.rules"
echo ""

# Show the rules
echo "================================================================"
echo "  Firewall Rules Preview"
echo "================================================================"
echo ""
cat /etc/ipfw.rules | grep "^\$cmd" | sed 's/\$cmd /  Rule: ipfw add /'
echo ""

# Configure rc.conf to use custom firewall
echo "[i] Configuring rc.conf..."
sysrc firewall_enable="YES"
sysrc firewall_script="/etc/ipfw.rules"
sysrc firewall_logging="YES"

echo "[OK] Firewall configured in rc.conf"
echo ""

# Ask before enabling
echo "================================================================"
echo "  READY TO ENABLE FIREWALL"
echo "================================================================"
echo ""
echo "[!] WARNING: About to enable firewall with the rules above"
echo ""
echo "    SSH port $CURRENT_SSH_PORT will be allowed"
echo "    RADIUS ports 1812/1813 will be allowed"
if [ "$OPNSENSE_IP" != "any" ]; then
    echo "    RADIUS restricted to: $OPNSENSE_IP"
else
    echo "    RADIUS accessible from: any IP"
fi
echo ""
read -p "Continue and enable firewall? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo ""
    echo "[!] Firewall not enabled - rules saved but not activated"
    echo "    To enable later: service ipfw start"
    echo ""
    exit 0
fi

echo ""
echo "[i] Enabling firewall..."

# Load the firewall rules
/etc/ipfw.rules

# Start the firewall service
service ipfw start

echo ""
echo "================================================================"
echo "  [OK] Firewall Enabled Successfully!"
echo "================================================================"
echo ""

# Show active rules
echo "Active firewall rules:"
echo ""
ipfw list | head -20

echo ""
echo "================================================================"
echo "  Testing SSH Connection"
echo "================================================================"
echo ""
echo "[i] Your SSH session should still be working"
echo "[i] Test by opening a NEW SSH connection in another terminal"
echo ""
echo "If you can connect: [OK] Firewall is working correctly!"
echo "If you cannot connect: [X] Something is wrong!"
echo ""
echo "To disable firewall if needed:"
echo "  sudo service ipfw stop"
echo "  sudo sysrc firewall_enable=\"NO\""
echo ""

echo "================================================================"
echo "  Firewall Summary"
echo "================================================================"
echo ""
echo "Allowed Ports:"
echo "  - $CURRENT_SSH_PORT/tcp   (SSH)"
echo "  - 1812/udp  (RADIUS auth)"
echo "  - 1813/udp  (RADIUS accounting)"
echo "  - 3000/tcp  (API backend)"
echo "  - 80/tcp    (HTTP)"
echo "  - 443/tcp   (HTTPS)"
echo ""

if [ "$OPNSENSE_IP" != "any" ]; then
    echo "RADIUS Access:"
    echo "  - Restricted to: $OPNSENSE_IP"
else
    echo "RADIUS Access:"
    echo "  - Open to: any IP (consider restricting!)"
fi

echo ""
echo "To view rules:    ipfw list"
echo "To disable:       service ipfw stop"
echo "To restart:       service ipfw restart"
echo ""
echo "[OK] Firewall setup complete!"
echo ""

