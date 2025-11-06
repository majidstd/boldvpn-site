const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

const {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validatePasswordChange
} = require('../middleware/auth');

const {
  getUserByUsername,
  getUserAttributes,
  createUser,
  updateUserPassword
} = require('../utils/database');

// User registration
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { username, email, password, plan } = req.body;

    // Check if user already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    await createUser(username, passwordHash, email, plan);

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

    // Get user from database
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.value);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Get user attributes (plan info)
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
    res.status(500).json({ error: 'Login failed' });
  }
});

// Password reset request
router.post('/reset-password', validatePasswordReset, async (req, res) => {
  try {
    const { email } = req.body;

    // For now, we'll treat email as username
    const user = await getUserByUsername(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If the email exists, a reset link has been sent' });
    }

    // TODO: Generate reset token and send email
    // For now, just return success
    res.json({ message: 'If the email exists, a reset link has been sent' });

  } catch (error) {
    console.error('[!] Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
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

module.exports = router;
