// Enhanced health check with database connectivity
const { pool } = require('./utils/database');

const healthCheck = async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'unknown'
  };

  try {
    // Test database connection
    const result = await pool.query('SELECT 1 as test');
    health.database = 'connected';
    
    // Check pool status
    health.pool = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };
    
    res.status(200).json(health);
  } catch (error) {
    console.error('[!] Health check failed:', error);
    health.status = 'ERROR';
    health.database = 'disconnected';
    health.error = error.message;
    
    res.status(503).json(health);
  }
};

module.exports = healthCheck;
