#!/bin/sh

# This script applies database migrations to your PostgreSQL database.
# It reads connection details from the api/.env file.

# Set script to exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# Path to the .env file, relative to the project root
ENV_FILE="api/.env"

# Path to the migration files, relative to the project root
MIGRATION_DIR="api/migrations"


# --- Script Start ---
echo "Starting database migration script..."

# Navigate to the project root directory to ensure paths are correct
cd "$(dirname "$0")/.." || exit

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file not found at $ENV_FILE"
  echo "Please copy api/env-template.txt to api/.env and fill in your database credentials."
  exit 1
fi

# Load environment variables from .env file in a POSIX-compliant way
# This makes them available to sub-processes like psql
set -a
. "./$ENV_FILE"
set +a

# Check for required database variables
if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_PASSWORD" ]; then
  echo "Error: One or more required database variables (DB_USER, DB_HOST, DB_NAME, DB_PASSWORD) are not set in $ENV_FILE."
  exit 1
fi

# Export the password for psql to use securely
export PGPASSWORD=$DB_PASSWORD

echo "Applying migrations to database '$DB_NAME' on host '$DB_HOST'..."

# Loop through all .sql migration files and apply them
echo "Applying .sql migration files..."
for FILE_PATH in "$MIGRATION_DIR"/*.sql; do
  if [ -f "$FILE_PATH" ]; then
    echo "Applying migration: $(basename "$FILE_PATH")"
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$FILE_PATH"
    echo "Successfully applied $(basename "$FILE_PATH")."
  else
    echo "No .sql migration files found. Skipping."
    break
  fi
done

# Apply inline schema changes idempotently
echo "Applying inline schema changes..."

# Add password_hash column if it doesn't exist (PostgreSQL 9.6+ supports IF NOT EXISTS)
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "ALTER TABLE user_details ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);" 2>&1 | grep -v "already exists" || true

echo "Successfully applied inline schema changes."

# Unset the password variable for security
unset PGPASSWORD

echo "Database migration script finished successfully."
