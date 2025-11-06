# FreeBSD Server - Quick Deployment Guide

Simple step-by-step guide for deploying BoldVPN on FreeBSD.

## 🚀 First Time Setup (New Server)

### Step 1: Copy Setup Script to Server

From your Mac:

```bash
# Copy the setup script to your FreeBSD server
scp scripts/setup-github.sh admin@your-server-ip:~/
```

### Step 2: Run Setup Script on FreeBSD

SSH into your FreeBSD server:

```bash
ssh admin@your-server-ip

# Make script executable
chmod +x setup-github.sh

# Run the script (as admin user, NOT root!)
./setup-github.sh
```

The script will:
1. ✅ Generate SSH key (if needed)
2. ✅ Show you the public key to add to GitHub
3. ✅ Test GitHub connection
4. ✅ Clone repository to `/usr/local/boldvpn-site`
5. ✅ Set proper permissions

### Step 3: Deploy RADIUS Server

```bash
cd /usr/local/boldvpn-site/radius-server
sudo ./freebsd-radius-setup.sh
```

Follow the prompts:
- OPNsense IP address
- RADIUS shared secret
- PostgreSQL passwords

### Step 4: Deploy API Server

```bash
cd /usr/local/boldvpn-site/api
sudo ./freebsd-api-setup.sh
```

Follow the prompts:
- API port (default: 3000)
- JWT secret (strong random string)
- PostgreSQL password (same as RADIUS)
- API domain (e.g., api.boldvpn.net)

### Step 5: Verify Everything Works

```bash
# Check RADIUS
sudo service radiusd status
cd /usr/local/boldvpn-site/radius-server
./test-radius.sh

# Check API
sudo service boldvpn_api status
cd /usr/local/boldvpn-site/api
./test-api.sh

# View logs
tail -f /var/log/radius/radius.log
tail -f /var/log/boldvpn-api.log
```

---

## 🔄 Updating (After Initial Setup)

### Method 1: Quick Update Script

```bash
ssh admin@your-server-ip

cd /usr/local/boldvpn-site
./update.sh
```

The script will:
- Pull latest changes
- Ask to restart services
- Install new dependencies if needed

### Method 2: Manual Update

```bash
ssh admin@your-server-ip

# Pull latest code
cd /usr/local/boldvpn-site
git pull

# If API changed, restart it:
cd api
sudo npm install --production
sudo service boldvpn_api restart

# If RADIUS changed, restart it:
sudo service radiusd restart
```

---

## 📋 Common Commands

### Service Management

```bash
# Check status
sudo service radiusd status
sudo service boldvpn_api status

# Start/stop/restart
sudo service radiusd start|stop|restart
sudo service boldvpn_api start|stop|restart

# View logs
tail -f /var/log/radius/radius.log
tail -f /var/log/boldvpn-api.log
```

### Git Operations

```bash
# Check current status
cd /usr/local/boldvpn-site
git status
git log --oneline -5

# Pull latest changes
git pull

# Check which branch
git branch
```

### Database

```bash
# Connect to database
psql -U radiususer -d radius

# View users
SELECT username FROM radcheck;

# View active sessions
SELECT username, framedipaddress, acctstarttime 
FROM radacct 
WHERE acctstoptime IS NULL;

# Exit psql
\q
```

---

## 🔧 Troubleshooting

### SSH Key Issues

If git pull asks for password:

```bash
# Check SSH key exists
ls -la ~/.ssh/id_ed25519*

# Test GitHub connection
ssh -T git@github.com

# Should say: "Hi majidstd! You've successfully authenticated"

# If not, regenerate key
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# Add to: https://github.com/settings/keys
```

### Service Won't Start

```bash
# Check detailed logs
tail -100 /var/log/boldvpn-api.log
tail -100 /var/log/radius/radius.log

# Check if port is in use
sockstat -l | grep 3000  # API
sockstat -l | grep 1812  # RADIUS

# Restart service with debug
sudo service boldvpn_api stop
cd /usr/local/boldvpn-site/api
node server.js  # Run manually to see errors
```

### Permission Issues

```bash
# Fix ownership of git directory
sudo chown -R admin:wheel /usr/local/boldvpn-site

# Fix .env permissions
sudo chmod 600 /usr/local/boldvpn-site/api/.env
```

---

## 📁 File Locations

```
/usr/local/boldvpn-site/          # Main repository
├── scripts/                      # Deployment helper scripts
│   ├── setup-github.sh           # First-time setup
│   └── update.sh                 # Quick update script
├── api/                          # Running API
│   ├── .env                      # API config (secrets)
│   ├── node_modules/             # Dependencies
│   ├── freebsd-api-setup.sh      # API deployment script
│   └── test-api.sh               # API test script
├── radius-server/                # RADIUS setup scripts
│   ├── freebsd-radius-setup.sh   # RADIUS deployment
│   ├── test-radius.sh            # RADIUS test script
│   └── *.sh                      # Various helper scripts
├── portal/                       # Customer portal
└── captiveportal/                # OPNsense templates

/usr/local/etc/raddb/             # FreeRADIUS config
/var/log/radius/                  # RADIUS logs
/var/log/boldvpn-api.log          # API logs

~/.ssh/id_ed25519                 # SSH private key
~/.ssh/id_ed25519.pub             # SSH public key
```

---

## 🔐 Security Checklist

- [ ] SSH key generated and added to GitHub
- [ ] Server firewall configured
- [ ] Strong PostgreSQL passwords
- [ ] Strong RADIUS shared secret
- [ ] Strong JWT secret
- [ ] `.env` file has correct permissions (600)
- [ ] Services running as appropriate user
- [ ] HTTPS configured for API (nginx reverse proxy)

---

## 📞 Quick Reference

**First time setup:**
```bash
./setup-github.sh  # Run from ~/ after scp from scripts/
cd /usr/local/boldvpn-site/radius-server && sudo ./freebsd-radius-setup.sh
cd /usr/local/boldvpn-site/api && sudo ./freebsd-api-setup.sh
```

**Update:**
```bash
cd /usr/local/boldvpn-site && ./scripts/update.sh
```

**Check status:**
```bash
sudo service radiusd status
sudo service boldvpn_api status
```

**View logs:**
```bash
tail -f /var/log/radius/radius.log
tail -f /var/log/boldvpn-api.log
```

---

✅ **That's it!** Simple deployment and easy updates.

