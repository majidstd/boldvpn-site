#!/bin/sh
# Run migration 005: Add subscription status columns
# Usage: sudo ./scripts/run-migration-005.sh

set -e

DB_USER="${DB_USER:-radiususer}"
DB_NAME="${DB_NAME:-radius}"
MIGRATION_FILE="api/migrations/005_add_subscription_status.sql"

echo "📝 Running migration 005: Add subscription status columns..."
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

psql -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration 005 completed successfully!"
    echo ""
    echo "📋 Verifying columns were added..."
    psql -U "$DB_USER" -d "$DB_NAME" -c "\d user_details" | grep -E "subscription_status|subscription_expires|payment_provider|payment_customer"
    echo ""
    echo "✅ All subscription columns added!"
else
    echo "❌ Migration failed!"
    exit 1
fi

