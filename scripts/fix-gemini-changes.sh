#!/bin/sh
set -e

echo "[+] Fixing API after Gemini/Copilot changes..."

cd /usr/local/boldvpn-site

# 1. Pull latest code
echo "[+] Pulling latest code..."
git pull

# 2. Install dependencies
echo "[+] Installing dependencies..."
cd api
npm install

# 3. Check .env
cd /usr/local/boldvpn-site/api
if [ ! -f .env ]; then
    echo "[!] .env missing! Creating from template..."
    cp env-template.txt .env
    echo "[!] Edit api/.env and set DB_PASSWORD, then run this script again!"
    exit 1
fi

# 4. Validate JWT_SECRET
JWT_SECRET=$(grep "^JWT_SECRET=" .env 2>/dev/null | cut -d'=' -f2 || echo "")
if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    echo "[+] Generating strong JWT_SECRET..."
    sed -i.bak '/^JWT_SECRET=/d' .env 2>/dev/null || true
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
fi

# 5. Run migrations
echo "[+] Running migrations..."
cd /usr/local/boldvpn-site
sh scripts/apply-migrations.sh

# 6. Restart API
echo "[+] Restarting API..."
sudo service boldvpn_api restart
sleep 2

# 7. Test
echo "[+] Testing API..."
curl -s http://localhost:3000/api/health

echo ""
echo "[OK] Done! Check output above."
