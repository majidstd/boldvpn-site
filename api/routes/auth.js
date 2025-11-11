const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validatePasswordChange,
  validatePasswordResetConfirm
} = require('../middleware/auth');

const {
  getApiAuthData, // New function for API login
  getUserByUsername, // Still used for checking if username exists
  getUserByEmail,
  getUserAttributes,
  createUser, // Now takes plain-text password
  updateUserPassword, // Now takes plain-text password
  createPasswordResetToken,
  getResetTokenByToken,
  deleteResetTokenByEmail,
} = require('../utils/database');

const { sendPasswordResetEmail } = require('../utils/email');

// User registration
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { username, email, password, plan } = req.body;

    // Check if user already exists
    const existingUser = await getUserByUsername(username); // Still use this to check username existence
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Create user (createUser now handles hashing internally)
    await createUser(username, password, email, plan); // Pass plain-text password

    // Generate JWT token
    const token = jwt.sign(
      { username, plan },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { username, plan }
    });

  } catch (error) {
    console.error('[!] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user's API authentication data (hashed password)
    const userAuthData = await getApiAuthData(username);
    if (!userAuthData) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password against the stored hash
    const isValidPassword = await bcrypt.compare(password, userAuthData.password_hash || '');

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Get user attributes (plan info) - still need to get from radreply
    const attributes = await getUserAttributes(username);
    const plan = getPlanFromAttributes(attributes);

    // Generate JWT token
    const token = jwt.sign(
      { username, plan },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        username,
        plan,
        limits: {
          maxTraffic: parseInt(attributes['Max-Monthly-Traffic']) || 0,
          maxDownSpeed: parseInt(attributes['WISPr-Bandwidth-Max-Down']) || 0,
          maxUpSpeed: parseInt(attributes['WISPr-Bandwidth-Max-Up']) || 0,
          maxDevices: parseInt(attributes['Simultaneous-Use']) || 1
        }
      }
    });

  } catch (error) {
    console.error('[!] Login error:', error);
    console.error('[!] Login error stack:', error.stack);
    
    // Send more descriptive error message
    if (error.message && error.message.includes('timeout')) {
      res.status(503).json({ error: 'Database timeout. Please try again.' });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Database connection failed' });
    } else {
      res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }
});

// Password reset request
router.post('/reset-password', validatePasswordReset, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await getUserByEmail(email);

    if (user) {
      // Generate a token
      const token = crypto.randomBytes(32).toString('hex');

      // Invalidate old tokens for this email
      await deleteResetTokenByEmail(email);

      // Create a new token
      await createPasswordResetToken(email, token);

      // Send the email
      await sendPasswordResetEmail(email, token);
    }

    // Always return a generic success message to prevent email enumeration attacks
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('[!] Password reset error:', error);
    // Do not send a 500 status to the client, as it could leak information.
    // Log the error and send the same generic message.
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  }
});

// Password reset confirmation
router.post('/reset-password-confirm', validatePasswordResetConfirm, async (req, res) => {
  try {
    const { token, password } = req.body; // 'password' is the new plain-text password

    const resetToken = await getResetTokenByToken(token);

    if (!resetToken) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    const user = await getUserByEmail(resetToken.email);
    if (!user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    // Update password (updateUserPassword now handles hashing internally)
    await updateUserPassword(user.username, password); // Pass plain-text password

    // Delete the token now that it's been used
    await deleteResetTokenByEmail(resetToken.email);

    res.json({ message: 'Password has been reset successfully.' });

  } catch (error) {
    console.error('[!] Password reset confirm error:', error);
    res.status(500).json({ error: 'An error occurred during password reset.' });
  }
});


// Verify JWT token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Helper function to determine plan from attributes
function getPlanFromAttributes(attributes) {
  const trafficLimit = parseInt(attributes['Max-Monthly-Traffic']) || 0;

  if (trafficLimit >= 268435456000) { // 250GB+
    return 'family';
  } else if (trafficLimit >= 107374182400) { // 100GB+
    return 'premium';
  } else {
    return 'basic';
  }
}

// Change password (requires authentication)
router.put('/change-password', validatePasswordChange, async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    // Verify current password
    const userAuthData = await getApiAuthData(username);
    if (!userAuthData) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userAuthData.password_hash || '');
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password (updateUserPassword handles hashing)
    await updateUserPassword(username, newPassword);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('[!] Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
