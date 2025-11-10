-- Create test user for API authentication
-- Password: Test@123!
-- Bcrypt hash with 12 rounds

INSERT INTO user_details (username, email, password_hash)
VALUES (
  'testuser',
  'test@example.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqYlYqYlYq'
)
ON CONFLICT (username) DO NOTHING;

