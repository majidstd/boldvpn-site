#!/bin/sh
#
# FreeBSD Package Finder - Helper Script
# Check available FreeRADIUS and PostgreSQL packages
#
# Usage:
#   chmod +x check-packages.sh
#   ./check-packages.sh
#

echo "============================================"
echo "  FreeBSD Package Availability Check"
echo "============================================"
echo ""

echo "🔍 Updating package repository..."
pkg update -q

echo ""
echo "📦 Available FreeRADIUS packages:"
echo "-------------------------------------------"
pkg search freeradius3
echo ""

echo "📦 Available PostgreSQL packages:"
echo "-------------------------------------------"
pkg search -q postgresql | grep -E "^postgresql[0-9]+-server" | sort
echo ""

echo "📦 Available Node.js packages:"
echo "-------------------------------------------"
pkg search -q node | grep -E "^node[0-9]*-[0-9]" | head -10
echo ""

echo "============================================"
echo "  Recommended Packages"
echo "============================================"
echo ""

# Find latest versions
FREERADIUS_PKG="freeradius3"
FREERADIUS_PGSQL="freeradius3-pgsql"
PGSQL_SERVER=$(pkg search -q postgresql | grep -E "^postgresql[0-9]+-server-[0-9]" | sort -V | tail -1 | awk '{print $1}' | grep -o "^postgresql[0-9]*-server")
if [ -z "$PGSQL_SERVER" ]; then
    PGSQL_SERVER="postgresql15-server"
fi
PGSQL_VER=$(echo $PGSQL_SERVER | sed 's/postgresql\([0-9]*\)-.*/\1/')
NODE_PKG="node"

echo "For installation, use:"
echo ""
echo "  pkg install -y \\"
echo "    $FREERADIUS_PKG \\"
echo "    $FREERADIUS_PGSQL \\"
echo "    $PGSQL_SERVER \\"
echo "    postgresql${PGSQL_VER}-client \\"
echo "    postgresql${PGSQL_VER}-contrib \\"
echo "    $NODE_PKG \\"
echo "    npm \\"
echo "    nginx \\"
echo "    git"
echo ""
echo "============================================"
echo ""
echo "Note: FreeRADIUS PostgreSQL module is 'freeradius3-pgsql'"
echo "      (not 'freeradius3-postgresql')"
echo ""

