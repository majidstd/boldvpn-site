require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./utils/database');

// Validate required environment variables
const requiredEnv = ['JWT_SECRET', 'DB_PASSWORD'];
const missing = requiredEnv.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('[X] Missing required environment variables:', missing.join(', '));
  console.error('[X] Please set these in your .env file');
  process.exit(1);
}

// Validate JWT_SECRET strength
if (process.env.JWT_SECRET.length < 32) {
  console.error('[X] JWT_SECRET must be at least 32 characters for security');
  console.error('[X] Current length:', process.env.JWT_SECRET.length);
  process.exit(1);
}

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const billingRoutes = require('./routes/billing');
const serversRoutes = require('./routes/servers');
const devicesRoutes = require('./routes/devices');
const statsRoutes = require('./routes/stats');
const adminRoutes = require('./routes/admin');
const realtimeRoutes = require('./routes/realtime');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Express is behind HAProxy
// This allows Express to see real client IP from X-Forwarded-For header
app.set('trust proxy', 1);

// Database configuration
// The database pool is now managed in ./utils/database.js

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Health check rate limiting (very lenient for HAProxy/monitoring)
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // 10000 requests per minute (allows aggressive polling from HAProxy)
  message: 'Too many health check requests',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/health', healthLimiter);

// General API rate limiting
// Note: Rate limits reset automatically after 1 minute
// OR restart API service to clear all rate limit counters
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Auth rate limiting
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 auth attempts per minute
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful logins
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// CORS configuration - whitelist allowed origins
const allowedOrigins = [
  'https://boldvpn.net',
  'https://www.boldvpn.net',
  'https://login.boldvpn.net',
  'https://www.boldvpn.net/portal',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('[!] CORS blocked origin:', origin);
      
      // In production, block unauthorized origins
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        console.warn('[!] Allowing in development mode');
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`[→] ${req.method} ${req.path} from ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[←] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Database connection test
pool.connect((err, client, release) => {
  if (err) {
    console.error('[X] Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('[OK] Database connected successfully');
  release();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/realtime', realtimeRoutes);

// Health check endpoint
// const healthCheck = require('./healthcheck'); // Removed as file does not exist
// app.get('/api/health', healthCheck); // Removed as file does not exist

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[!] Error:', err.message);
  console.error('[!] Stack:', err.stack);

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[i] SIGTERM received, shutting down gracefully');
  pool.end(() => {
    console.log('[OK] Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[i] SIGINT received, shutting down gracefully');
  pool.end(() => {
    console.log('[OK] Database pool closed');
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`[OK] BoldVPN API server running on port ${PORT}`);
  console.log(`[i] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[i] Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

module.exports = app;
