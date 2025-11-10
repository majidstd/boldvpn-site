#!/bin/sh
set -e

echo "Fixing API after Gemini/Copilot changes..."
echo ""

cd /usr/local/boldvpn-site/api

# Check .env
if [ ! -f .env ]; then
    echo "[!] .env missing! Create it first."
    exit 1
fi

# Validate JWT_SECRET
JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2)
if [ -z "$JWT_SECRET" ]; then
    echo "[!] Generating JWT_SECRET..."
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
elif [ ${#JWT_SECRET} -lt 32 ]; then
    echo "[!] JWT_SECRET too short! Regenerating..."
    sed -i.bak '/^JWT_SECRET=/d' .env
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
fi

# Install nodemailer
echo "[+] Installing nodemailer..."
npm install nodemailer

# Run migrations
echo "[+] Running migrations..."
cd /usr/local/boldvpn-site
sh scripts/apply-migrations.sh

# Add password_hash column if missing
echo "[+] Checking user_details table..."
psql -U radiususer -d radius -c "ALTER TABLE user_details ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"

# Restart API
echo "[+] Restarting API..."
sudo service boldvpn_api restart
sleep 2

# Test
curl -s http://localhost:3000/api/health

echo ""
echo "Done! Check output above."
