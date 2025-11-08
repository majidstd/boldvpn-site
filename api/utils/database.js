const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'radius',
  user: process.env.DB_USER || 'radiususer',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[DB] Query executed in', duration, 'ms:', text);
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err);
    throw err;
  }
};

// Get user by username
const getUserByUsername = async (username) => {
  const result = await query(
    'SELECT * FROM radcheck WHERE username = ',
    [username]
  );
  return result.rows[0];
};

// Get user by email
const getUserByEmail = async (email) => {
  const result = await query(
    'SELECT username FROM user_details WHERE email = ',
    [email]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const { username } = result.rows[0];
  return await getUserByUsername(username);
};

// Get user email by username
const getUserEmail = async (username) => {
  const result = await query(
    'SELECT email FROM user_details WHERE username = ',
    [username]
  );
  return result.rows[0] ? result.rows[0].email : null;
};

// Get user attributes (quotas, limits, etc.)
const getUserAttributes = async (username) => {
  const result = await query(
    'SELECT attribute, op, value FROM radreply WHERE username = ',
    [username]
  );

  const attributes = {};
  result.rows.forEach(row => {
    attributes[row.attribute] = row.value;
  });

  return attributes;
};

// Get user usage statistics
const getUserUsage = async (username) => {
  const result = await query(`
    SELECT
      COALESCE(SUM(acctinputoctets), 0) as upload_bytes,
      COALESCE(SUM(acctoutputoctets), 0) as download_bytes,
      COALESCE(SUM(acctsessiontime), 0) as session_time,
      COUNT(*) as session_count,
      MAX(acctstarttime) as last_session
    FROM radacct
    WHERE username = 
  `, [username]);

  return result.rows[0];
};

// Get user current session
const getCurrentSession = async (username) => {
  const result = await query(`
    SELECT *
    FROM radacct
    WHERE username =  AND acctstoptime IS NULL
    ORDER BY acctstarttime DESC
    LIMIT 1
  `, [username]);

  return result.rows[0];
};

// Create new user
const createUser = async (username, passwordHash, email, plan) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert into user_details
    await client.query(
      'INSERT INTO user_details (username, email) VALUES (, $2)',
      [username, email]
    );

    // Insert into radcheck for authentication
    await client.query(
      'INSERT INTO radcheck (username, attribute, op, value) VALUES (, $2, $3, $4)',
      [username, 'Cleartext-Password', ':=', passwordHash]
    );

    // Set plan-specific attributes
    const planAttributes = getPlanAttributes(plan);
    for (const [attribute, value] of Object.entries(planAttributes)) {
      await client.query(
        'INSERT INTO radreply (username, attribute, op, value) VALUES (, $2, $3, $4)',
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

// Update user password
const updateUserPassword = async (username, newPasswordHash) => {
  await query(
    'UPDATE radcheck SET value =  WHERE username = $2 AND attribute = $3',
    [newPasswordHash, username, 'Cleartext-Password']
  );
};

// Get plan attributes
const getPlanAttributes = (plan) => {
  const plans = {
    basic: {
      'Max-Monthly-Traffic': '53687091200', // 50GB
      'WISPr-Bandwidth-Max-Down': '51200',   // 50Mbps
      'WISPr-Bandwidth-Max-Up': '51200',     // 50Mbps
      'Simultaneous-Use': '2',               // 2 devices
    },
    premium: {
      'Max-Monthly-Traffic': '107374182400', // 100GB
      'WISPr-Bandwidth-Max-Down': '102400',  // 100Mbps
      'WISPr-Bandwidth-Max-Up': '102400',    // 100Mbps
      'Simultaneous-Use': '5',               // 5 devices
    },
    family: {
      'Max-Monthly-Traffic': '268435456000', // 250GB
      'WISPr-Bandwidth-Max-Down': '204800',  // 200Mbps
      'WISPr-Bandwidth-Max-Up': '204800',    // 200Mbps
      'Simultaneous-Use': '10',              // 10 devices
    }
  };

  return plans[plan] || plans.basic;
};

// Get all users (admin function)
const getAllUsers = async (limit = 100, offset = 0) => {
  const result = await query(`
    SELECT DISTINCT
      r.username,
      r.attribute,
      r.value as password,
      rr.attribute as attr_name,
      rr.value as attr_value
    FROM radcheck r
    LEFT JOIN radreply rr ON r.username = rr.username
    ORDER BY r.username
    LIMIT  OFFSET $2
  `, [limit, offset]);

  return result.rows;
};

// Delete user
const deleteUser = async (username) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM user_details WHERE username = ', [username]);
    await client.query('DELETE FROM radreply WHERE username = ', [username]);
    await client.query('DELETE FROM radcheck WHERE username = ', [username]);
    await client.query('DELETE FROM radacct WHERE username = ', [username]);

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
    'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (, $2, $3)',
    [email, token, expires_at]
  );
};

const getResetTokenByToken = async (token) => {
  const result = await query(
    'SELECT * FROM password_reset_tokens WHERE token =  AND expires_at > NOW()',
    [token]
  );
  return result.rows[0];
};

const deleteResetTokenByEmail = async (email) => {
  await query('DELETE FROM password_reset_tokens WHERE email = ', [email]);
};


module.exports = {
  pool,
  query,
  getUserByUsername,
  getUserByEmail,
  getUserEmail,
  getUserAttributes,
  getUserUsage,
  getCurrentSession,
  createUser,
  updateUserPassword,
  getPlanAttributes,
  getAllUsers,
  deleteUser,
  createPasswordResetToken,
  getResetTokenByToken,
  deleteResetTokenByEmail,
};

