-- Add subscription status to user_details
-- This allows us to check if a user has an active paid subscription

ALTER TABLE user_details ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial';
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50);
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS payment_customer_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_details_subscription_status ON user_details(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_details_subscription_expires ON user_details(subscription_expires_at);

-- Update existing users to have 'active' status (assuming they're already paid)
-- You can change this based on your actual user base
UPDATE user_details SET subscription_status = 'active' WHERE subscription_status = 'trial';

COMMENT ON COLUMN user_details.subscription_status IS 'trial, active, expired, cancelled';
COMMENT ON COLUMN user_details.subscription_expires_at IS 'When the subscription expires (NULL for lifetime)';
COMMENT ON COLUMN user_details.payment_provider IS 'stripe, paypal, manual, etc.';
COMMENT ON COLUMN user_details.payment_customer_id IS 'Customer ID from payment provider';

