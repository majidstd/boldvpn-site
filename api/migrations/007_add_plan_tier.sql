-- Add plan_tier column to user_details table
-- Migration: 007_add_plan_tier.sql
-- Description: Adds explicit plan_tier column for better tier management and server access control

-- Add plan_tier column
ALTER TABLE user_details ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) DEFAULT 'free';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_details_plan_tier ON user_details(plan_tier);

-- Migrate existing users based on their current radreply.Max-Monthly-Traffic limits
-- This calculates tier from bandwidth limits and sets plan_tier accordingly
DO $$
DECLARE
    user_record RECORD;
    monthly_bandwidth_gb NUMERIC;
    calculated_tier VARCHAR(20);
BEGIN
    -- Loop through all users
    FOR user_record IN SELECT username FROM user_details LOOP
        -- Get monthly bandwidth limit from radreply
        SELECT COALESCE(
            (SELECT value::NUMERIC / 1073741824.0 
             FROM radreply 
             WHERE username = user_record.username 
             AND attribute = 'Max-Monthly-Traffic'
             LIMIT 1),
            0
        ) INTO monthly_bandwidth_gb;
        
        -- Calculate tier based on bandwidth
        IF monthly_bandwidth_gb >= 100 THEN
            calculated_tier := 'premium';
        ELSIF monthly_bandwidth_gb >= 50 THEN
            calculated_tier := 'pro';
        ELSIF monthly_bandwidth_gb >= 10 THEN
            calculated_tier := 'basic';
        ELSE
            calculated_tier := 'free';
        END IF;
        
        -- Update plan_tier (only if not already set, to avoid overwriting manual changes)
        UPDATE user_details 
        SET plan_tier = calculated_tier 
        WHERE username = user_record.username 
        AND (plan_tier IS NULL OR plan_tier = 'free');
    END LOOP;
END $$;

-- Add comment to column
COMMENT ON COLUMN user_details.plan_tier IS 'User subscription tier: free, basic, pro, premium, family';


