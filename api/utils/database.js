const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'radius',
  user: process.env.DB_USER || 'radiususer',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2s to 10s to prevent timeouts
});

// Add pool error handler
pool.on('error', (err, client) => {
  console.error('[!] Unexpected database pool error:', err);
  // In production, alert admin here
});

// Log successful connections
pool.on('connect', (client) => {
  console.log('[i] New database connection established');
});

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Only log queries in development
    if (process.env.NODE_ENV !== 'production') {
      // Sanitize query text (remove parameter values for security)
      const sanitizedQuery = text.replace(/\$(\d+)/g, (match, index) => {
        const paramIndex = parseInt(index) - 1;
        return params && params[paramIndex] !== undefined ? '[PARAM]' : match;
      });
      console.log('[DB] Query executed in', duration, 'ms:', sanitizedQuery);
    }
    
    // In production, only log slow queries (> 1 second)
    if (process.env.NODE_ENV === 'production' && duration > 1000) {
      console.warn('[DB] Slow query detected:', duration, 'ms');
    }
    
    return res;
  } catch (err) {
    // Always log errors, but sanitize in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[DB] Query error:', err.message);
    } else {
      console.error('[DB] Query error:', err);
    }
    throw err;
  }
};

// --- User Retrieval Functions ---

// Gets user auth data (hashed password) for the API from user_details
const getApiAuthData = async (username) => {
  const result = await query(
    'SELECT username, password_hash FROM user_details WHERE username = $1',
    [username]
  );
  return result.rows[0];
};

// Gets user by username for general purpose use
const getUserByUsername = async (username) => {
  const result = await query(
    'SELECT username FROM user_details WHERE username = $1',
    [username]
  );
  return result.rows[0];
};

// Gets a user by their email address
const getUserByEmail = async (email) => {
  const result = await query(
    'SELECT username FROM user_details WHERE email = $1',
    [email]
  );
  return result.rows[0];
};

// Gets user email by username
const getUserEmail = async (username) => {
  const result = await query(
    'SELECT email FROM user_details WHERE username = $1',
    [username]
  );
  return result.rows[0] ? result.rows[0].email : null;
};

// Gets user attributes (quotas, limits, etc.) from radreply
const getUserAttributes = async (username) => {
  const result = await query(
    'SELECT attribute, op, value FROM radreply WHERE username = $1',
    [username]
  );
  const attributes = {};
  result.rows.forEach(row => {
    attributes[row.attribute] = row.value;
  });
  return attributes;
};

// --- User Creation and Update Functions ---

// Creates a new user, storing plain-text pass for RADIUS and hash for API
const createUser = async (username, plainTextPassword, email, plan) => {
  // SECURITY WARNING: This function stores a plain-text password in the 'radcheck'
  // table for RADIUS authentication. This is a significant security risk.
  // If the database is compromised, all user passwords will be exposed.
  // This is a common requirement for RADIUS with Cleartext-Password, but it is
  // strongly recommended to use a more secure authentication method if possible.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(plainTextPassword, saltRounds);

    // Insert into user_details with the hashed password
    await client.query(
      'INSERT INTO user_details (username, email, password_hash) VALUES ($1, $2, $3)',
      [username, email, passwordHash]
    );

    // Insert into radcheck for RADIUS with the plain-text password
    await client.query(
      'INSERT INTO radcheck (username, attribute, op, value) VALUES ($1, $2, $3, $4)',
      [username, 'Cleartext-Password', ':=', plainTextPassword]
    );

    // Set plan-specific attributes
    const planAttributes = getPlanAttributes(plan);
    for (const [attribute, value] of Object.entries(planAttributes)) {
      await client.query(
        'INSERT INTO radreply (username, attribute, op, value) VALUES ($1, $2, $3, $4)',
        [username, attribute, ':=', value]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Updates a user's password in both places
const updateUserPassword = async (username, plainTextPassword) => {
  // SECURITY WARNING: This function updates the plain-text password in the 'radcheck'
  // table for RADIUS authentication. This is a significant security risk.
  // See the warning in the 'createUser' function for more details.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(plainTextPassword, saltRounds);

    // Update the hash in user_details
    await client.query(
      'UPDATE user_details SET password_hash = $1 WHERE username = $2',
      [passwordHash, username]
    );

    // Update the plain-text password in radcheck for RADIUS
    await client.query(
      'UPDATE radcheck SET value = $1 WHERE username = $2 AND attribute = $3',
      [plainTextPassword, username, 'Cleartext-Password']
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};


// --- Other Functions (Usage, Sessions, etc.) ---

const getUserUsage = async (username) => {
  const result = await query(`
    SELECT
      COALESCE(SUM(acctinputoctets), 0) as upload_bytes,
      COALESCE(SUM(acctoutputoctets), 0) as download_bytes,
      COALESCE(SUM(acctsessiontime), 0) as session_time,
      COUNT(*) as session_count,
      MAX(acctstarttime) as last_session
    FROM radacct
    WHERE username = $1
  `, [username]);
  return result.rows[0];
};

const getCurrentSession = async (username) => {
  const result = await query(`
    SELECT *
    FROM radacct
    WHERE username = $1 AND acctstoptime IS NULL
    ORDER BY acctstarttime DESC
    LIMIT 1
  `, [username]);
  return result.rows[0];
};

const getPlanAttributes = (plan) => {
  const plans = {
    basic: { 'Max-Monthly-Traffic': '53687091200', 'WISPr-Bandwidth-Max-Down': '51200', 'WISPr-Bandwidth-Max-Up': '51200', 'Simultaneous-Use': '2' },
    premium: { 'Max-Monthly-Traffic': '107374182400', 'WISPr-Bandwidth-Max-Down': '102400', 'WISPr-Bandwidth-Max-Up': '102400', 'Simultaneous-Use': '5' },
    family: { 'Max-Monthly-Traffic': '268435456000', 'WISPr-Bandwidth-Max-Down': '204800', 'WISPr-Bandwidth-Max-Up': '204800', 'Simultaneous-Use': '10' }
  };
  return plans[plan] || plans.basic;
};

const deleteUser = async (username) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_details WHERE username = $1', [username]);
    await client.query('DELETE FROM radreply WHERE username = $1', [username]);
    await client.query('DELETE FROM radcheck WHERE username = $1', [username]);
    await client.query('DELETE FROM radacct WHERE username = $1', [username]);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// --- Password Reset Token Functions ---

const createPasswordResetToken = async (email, token) => {
  const expires_at = new Date(Date.now() + 3600000); // 1 hour from now
  await query(
    'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
    [email, token, expires_at]
  );
};

const getResetTokenByToken = async (token) => {
  const result = await query(
    'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return result.rows[0];
};

const deleteResetTokenByEmail = async (email) => {
  await query('DELETE FROM password_reset_tokens WHERE email = $1', [email]);
};

module.exports = {
  pool,
  query,
  getApiAuthData,
  getUserByUsername,
  getUserByEmail,
  getUserEmail,
  getUserAttributes,
  getUserUsage,
  getCurrentSession,
  createUser,
  updateUserPassword,
  deleteUser,
  getPlanAttributes,
  createPasswordResetToken,
  getResetTokenByToken,
  deleteResetTokenByEmail,
};