-- Drop the is_active column from the user_devices table
ALTER TABLE user_devices
DROP COLUMN is_active;

-- Drop the index on the is_active column if it exists
DROP INDEX IF EXISTS idx_user_devices_active;
