-- Create test user for API authentication
-- Password: Test@123!
-- Bcrypt hash with 12 rounds (generated with bcryptjs)

INSERT INTO user_details (username, email, password_hash)
VALUES (
  'testuser',
  'test@example.com',
  '$2a$12$Wrh8J8GtvOxhi4xfC1T9fucmBY/m4fzQlOGf4ExcIcdghBS3.OfUe'
)
ON CONFLICT (username) DO NOTHING;


-- Bcrypt hash with 12 rounds (generated with bcryptjs)

INSERT INTO user_details (username, email, password_hash)
VALUES (
  'testuser',
  'test@example.com',
  '$2a$12$Wrh8J8GtvOxhi4xfC1T9fucmBY/m4fzQlOGf4ExcIcdghBS3.OfUe'
)
ON CONFLICT (username) DO NOTHING;

