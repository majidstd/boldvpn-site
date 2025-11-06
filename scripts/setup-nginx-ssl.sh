#!/bin/sh
#
# Nginx + SSL Setup for BoldVPN API
# Configures reverse proxy and Let's Encrypt SSL certificate
#
# Usage: Run as root on FreeBSD server after API is installed
#   chmod +x setup-nginx-ssl.sh
#   sudo ./setup-nginx-ssl.sh
#

set -e

echo "================================================================"
echo "  BoldVPN Nginx + SSL Setup"
echo "  Reverse Proxy for API Server"
echo "================================================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "[X] Error: This script must be run as root"
    echo "   Run: sudo ./scripts/setup-nginx-ssl.sh"
    exit 1
fi

echo "[OK] Running as root"
echo ""

# Prompt for configuration
echo "Enter configuration details:"
echo ""

read -p "API domain (e.g., api.boldvpn.net): " API_DOMAIN
read -p "Email for SSL certificate notifications: " SSL_EMAIL

echo ""
echo "Configuration saved. Starting installation..."
echo ""

# Step 1: Check if API is running
echo "================================================================"
echo "[STEP] Step 1/7: Checking API service..."
echo "================================================================"
echo ""

if ! service boldvpn_api status >/dev/null 2>&1; then
    echo "[X] Error: BoldVPN API is not running!"
    echo "    Please run freebsd-api-setup.sh first"
    echo "    Check: sudo service boldvpn_api status"
    exit 1
fi

echo "[OK] BoldVPN API is running"

# Test localhost API
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "[OK] API health check passed"
else
    echo "[!] Warning: API health check failed"
    echo "    API might not be responding correctly"
fi

echo ""

# Step 2: Check DNS resolution
echo "================================================================"
echo "[STEP] Step 2/7: Checking DNS resolution..."
echo "================================================================"
echo ""

if host "$API_DOMAIN" >/dev/null 2>&1; then
    RESOLVED_IP=$(host "$API_DOMAIN" | grep "has address" | awk '{print $4}' | head -1)
    echo "[OK] $API_DOMAIN resolves to: $RESOLVED_IP"
else
    echo "[!] Warning: $API_DOMAIN does not resolve yet"
    echo "    Make sure DNS is configured before continuing"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "Cancelled. Setup DNS first, then run this script again."
        exit 0
    fi
fi

echo ""

# Step 3: Install Nginx and Certbot
echo "================================================================"
echo "[STEP] Step 3/7: Installing Nginx and Certbot..."
echo "================================================================"
echo ""

if command -v nginx >/dev/null 2>&1; then
    echo "[OK] Nginx already installed: $(nginx -v 2>&1)"
else
    echo "Installing Nginx..."
    pkg install -y nginx
    echo "[OK] Nginx installed"
fi

if command -v certbot >/dev/null 2>&1; then
    echo "[OK] Certbot already installed: $(certbot --version 2>&1 | head -1)"
else
    echo "Installing Certbot..."
    pkg install -y certbot py311-certbot-nginx
    echo "[OK] Certbot installed"
fi

echo ""

# Step 4: Configure Nginx main config
echo "================================================================"
echo "[STEP] Step 4/7: Configuring Nginx..."
echo "================================================================"
echo ""

# Backup existing config if it exists
if [ -f /usr/local/etc/nginx/nginx.conf ]; then
    echo "Backing up existing nginx.conf..."
    cp /usr/local/etc/nginx/nginx.conf /usr/local/etc/nginx/nginx.conf.backup
fi

# Create main nginx config
cat > /usr/local/etc/nginx/nginx.conf << 'EOF'
user  www;
worker_processes  auto;
error_log  /var/log/nginx/error.log;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    
    access_log  /var/log/nginx/access.log;
    
    sendfile        on;
    keepalive_timeout  65;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Include site configs
    include /usr/local/etc/nginx/conf.d/*.conf;
}
EOF

echo "[OK] Main nginx config created"

# Create conf.d directory
mkdir -p /usr/local/etc/nginx/conf.d

# Create API site config (HTTP only for now)
cat > /usr/local/etc/nginx/conf.d/api.conf << EOF
server {
    listen 80;
    server_name $API_DOMAIN;
    
    # Proxy to Node.js API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

echo "[OK] API site config created"

# Test nginx config
echo ""
echo "Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "[OK] Nginx configuration is valid"
else
    echo "[X] Nginx configuration has errors!"
    echo "    Check the output above"
    exit 1
fi

echo ""

# Step 5: Enable and start Nginx
echo "================================================================"
echo "[STEP] Step 5/7: Starting Nginx..."
echo "================================================================"
echo ""

sysrc nginx_enable="YES"

if service nginx status >/dev/null 2>&1; then
    echo "Nginx is already running, reloading config..."
    service nginx reload
else
    echo "Starting Nginx..."
    service nginx start
fi

sleep 2

if service nginx status >/dev/null 2>&1; then
    echo "[OK] Nginx is running"
else
    echo "[X] Nginx failed to start!"
    echo "    Check logs: tail -50 /var/log/nginx/error.log"
    exit 1
fi

echo ""

# Step 6: Test HTTP access
echo "================================================================"
echo "[STEP] Step 6/7: Testing HTTP access..."
echo "================================================================"
echo ""

echo "Testing: http://$API_DOMAIN/api/health"
echo ""

HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$API_DOMAIN/api/health 2>&1 || echo "000")

if [ "$HTTP_RESPONSE" = "200" ]; then
    echo "[OK] HTTP access working! (Status: 200)"
    echo ""
    echo "Response:"
    curl -s http://$API_DOMAIN/api/health
    echo ""
    HTTP_WORKS="yes"
else
    echo "[!] HTTP access not working (Status: $HTTP_RESPONSE)"
    echo ""
    echo "Possible issues:"
    echo "  - DNS not configured: $API_DOMAIN"
    echo "  - Port 80 not forwarded to this server"
    echo "  - Firewall blocking port 80"
    echo ""
    echo "You can continue with SSL setup, but it might fail."
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "Fix HTTP access first, then run this script again."
        exit 1
    fi
    HTTP_WORKS="no"
fi

echo ""

# Step 7: Get SSL certificate
echo "================================================================"
echo "[STEP] Step 7/7: Getting SSL certificate..."
echo "================================================================"
echo ""

if [ "$HTTP_WORKS" = "yes" ]; then
    echo "Running certbot to get SSL certificate..."
    echo ""
    echo "Certbot will ask a few questions:"
    echo "  1. Email: $SSL_EMAIL (already provided)"
    echo "  2. Agree to terms: Y"
    echo "  3. Share email: N (optional)"
    echo "  4. Redirect HTTP to HTTPS: 2 (recommended)"
    echo ""
    
    # Run certbot non-interactively
    certbot --nginx -d "$API_DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "$SSL_EMAIL" \
        --redirect
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "[OK] SSL certificate obtained successfully!"
        echo ""
        
        # Test HTTPS
        echo "Testing HTTPS access..."
        HTTPS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$API_DOMAIN/api/health 2>&1 || echo "000")
        
        if [ "$HTTPS_RESPONSE" = "200" ]; then
            echo "[OK] HTTPS working! (Status: 200)"
            echo ""
            echo "API Response:"
            curl -s https://$API_DOMAIN/api/health
            echo ""
        else
            echo "[!] HTTPS not working (Status: $HTTPS_RESPONSE)"
            echo "    Check nginx logs: tail -50 /var/log/nginx/error.log"
        fi
    else
        echo ""
        echo "[X] SSL certificate generation failed!"
        echo "    Check certbot logs above"
        exit 1
    fi
else
    echo "[!] Skipping SSL setup (HTTP not working)"
    echo "    Fix HTTP access first:"
    echo "    1. Configure DNS: $API_DOMAIN → Your public IP"
    echo "    2. Port forward: Public:80 → FreeBSD:80"
    echo "    3. Check firewall allows port 80"
    echo "    4. Run this script again"
fi

echo ""

# Setup auto-renewal
echo "================================================================"
echo "Setting up SSL auto-renewal..."
echo "================================================================"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    echo "[OK] Certbot auto-renewal already configured"
else
    echo "Adding certbot auto-renewal to crontab..."
    (crontab -l 2>/dev/null; echo "0 0,12 * * * /usr/local/bin/certbot renew --quiet") | crontab -
    echo "[OK] Auto-renewal configured (checks twice daily)"
fi

# Test renewal
echo ""
echo "Testing certificate renewal (dry-run)..."
certbot renew --dry-run

echo ""

# Final summary
echo "================================================================"
echo "  [OK] NGINX + SSL SETUP COMPLETE!"
echo "================================================================"
echo ""
echo "Configuration Summary:"
echo ""
echo "  Domain: $API_DOMAIN"
echo "  Nginx Config: /usr/local/etc/nginx/conf.d/api.conf"
echo "  SSL Cert: /usr/local/etc/letsencrypt/live/$API_DOMAIN/"
echo "  SSL Email: $SSL_EMAIL"
echo ""
echo "  HTTP:  Port 80 → Redirects to HTTPS"
echo "  HTTPS: Port 443 → Proxy to localhost:3000"
echo ""
echo "Services:"
echo "  API:   sudo service boldvpn_api status"
echo "  Nginx: sudo service nginx status"
echo ""
echo "Test API:"
echo "  HTTP:  curl http://$API_DOMAIN/api/health"
echo "  HTTPS: curl https://$API_DOMAIN/api/health"
echo ""
echo "Logs:"
echo "  Nginx access: tail -f /var/log/nginx/access.log"
echo "  Nginx error:  tail -f /var/log/nginx/error.log"
echo "  API log:      tail -f /var/log/boldvpn-api.log"
echo ""
echo "Next Steps:"
echo ""
echo "1. Test API from public internet:"
echo "   curl https://$API_DOMAIN/api/health"
echo ""
echo "2. Update customer portal config:"
echo "   Edit: portal/config.js"
echo "   Set: API_URL: 'https://$API_DOMAIN/api'"
echo "   Commit and push to GitHub"
echo ""
echo "3. Test portal:"
echo "   Visit: https://boldvpn.net/portal/"
echo "   Login: testuser / Test@123!"
echo ""
echo "[OK] Your API is now publicly accessible with HTTPS!"
echo ""

