# BoldVPN Deployment Scripts

Helper scripts for deploying and managing BoldVPN on FreeBSD.

## 📜 Scripts

### `setup-github.sh`

**Purpose:** First-time setup on a new FreeBSD server

**What it does:**
- Generates SSH key for GitHub authentication
- Tests GitHub connection
- Clones repository to `/usr/local/boldvpn-site`
- Sets proper permissions

**Usage:**
```bash
# From your Mac
scp scripts/setup-github.sh admin@server-ip:~/

# On FreeBSD server
chmod +x setup-github.sh
./setup-github.sh
```

**Requirements:**
- Run as admin user (NOT root!)
- Needs sudo access for moving files to `/usr/local/`

---

### `update.sh`

**Purpose:** Quick update and service restart

**What it does:**
- Pulls latest changes from GitHub
- Checks for uncommitted changes
- Optionally restarts API service
- Optionally restarts RADIUS service
- Installs new npm dependencies

**Usage:**
```bash
# On FreeBSD server
cd /usr/local/boldvpn-site
./scripts/update.sh
```

**Requirements:**
- Must be run from `/usr/local/boldvpn-site/`
- Needs sudo for service restarts

---

## 🚀 Typical Workflow

### First Time Setup

1. **Copy setup script to server:**
   ```bash
   scp scripts/setup-github.sh admin@server-ip:~/
   ```

2. **Run setup on server:**
   ```bash
   ssh admin@server-ip
   ./setup-github.sh
   ```

3. **Deploy services:**
   ```bash
   cd /usr/local/boldvpn-site/radius-server
   sudo ./freebsd-radius-setup.sh
   
   cd ../api
   sudo ./freebsd-api-setup.sh
   ```

### Regular Updates

```bash
ssh admin@server-ip
cd /usr/local/boldvpn-site
./scripts/update.sh
```

Or manual:
```bash
git pull
cd api && sudo npm install --production
sudo service boldvpn_api restart
```

---

## 📂 Other Scripts

### RADIUS Scripts (`/radius-server/`)

- `freebsd-radius-setup.sh` - Main RADIUS installation
- `test-radius.sh` - Test RADIUS configuration
- `fix-radius-config.sh` - Fix common issues
- `setup-firewall.sh` - Configure firewall
- `reinstall-freeradius.sh` - Reinstall RADIUS only

### API Scripts (`/api/`)

- `freebsd-api-setup.sh` - Main API installation
- `test-api.sh` - Test API endpoints

---

## 🔒 Security Notes

- Always run `setup-github.sh` as admin user, never as root
- SSH keys stay on the server, never share private keys
- `.env` files are git-ignored and contain secrets
- Use sudo only when explicitly needed

---

## 📖 Full Documentation

See: [FREEBSD-DEPLOYMENT.md](../FREEBSD-DEPLOYMENT.md)

