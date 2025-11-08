#!/bin/bash

# This script applies database migrations to your PostgreSQL database.
# It reads connection details from the api/.env file.

# Set script to exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# Path to the .env file, relative to the project root
ENV_FILE="api/.env"

# Path to the migration files, relative to the project root
MIGRATION_DIR="api/migrations"
MIGRATION_FILES=(
  "001_add_user_details.sql"
  "002_create_password_reset_tokens.sql"
)

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

# Load environment variables from .env file
# This makes them available to sub-processes like psql
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Check for required database variables
if [ -z "$DB_USER" ] || [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_PASSWORD" ]; then
  echo "Error: One or more required database variables (DB_USER, DB_HOST, DB_NAME, DB_PASSWORD) are not set in $ENV_FILE."
  exit 1
fi

# Export the password for psql to use securely
export PGPASSWORD=$DB_PASSWORD

echo "Applying migrations to database '$DB_NAME' on host '$DB_HOST'..."

# Loop through migration files and apply them
for MIGRATION_FILE in "${MIGRATION_FILES[@]}"; do
  FILE_PATH="$MIGRATION_DIR/$MIGRATION_FILE"
  if [ -f "$FILE_PATH" ]; then
    echo "Applying migration: $MIGRATION_FILE"
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$FILE_PATH"
    echo "Successfully applied $MIGRATION_FILE."
  else
    echo "Warning: Migration file not found, skipping: $FILE_PATH"
  fi
done

# Unset the password variable for security
unset PGPASSWORD

echo "Database migration script finished successfully."
