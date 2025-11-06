# BoldVPN API Backend

Node.js/Express API backend for BoldVPN customer portal and RADIUS server integration.

## Features

- **User Authentication**: JWT-based login/registration
- **Profile Management**: View usage, change password, manage devices
- **Billing Integration**: Stripe payment processing (planned)
- **Usage Tracking**: Real-time VPN usage statistics
- **RADIUS Integration**: Direct database access to FreeRADIUS data

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Start development server
npm run dev

# Or start production server
npm start
```

## Environment Variables

Create a `.env` file with:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=radius
DB_USER=radiususer
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=24h

# Frontend
FRONTEND_URL=http://localhost:3000

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/reset-password` - Password reset
- `GET /api/auth/verify` - Verify JWT token

### User Management
- `GET /api/user/profile` - Get user profile and usage
- `PUT /api/user/password` - Change password
- `GET /api/user/usage-history` - Get usage history
- `GET /api/user/devices` - Get connected devices

### Billing (Mock)
- `GET /api/billing/subscription` - Get subscription status
- `GET /api/billing/plans` - Get available plans
- `POST /api/billing/create-payment-intent` - Create payment
- `POST /api/billing/confirm-payment` - Confirm payment
- `GET /api/billing/history` - Get billing history
- `POST /api/billing/cancel` - Cancel subscription

### Health Check
- `GET /api/health` - Server health check

## Database Schema

The API reads from the FreeRADIUS PostgreSQL database:

- `radcheck` - User authentication
- `radreply` - User attributes/quotas
- `radacct` - Usage accounting data

## Security Features

- JWT authentication with expiration
- Password hashing with bcrypt
- Rate limiting on auth endpoints
- CORS protection
- Helmet security headers
- Input validation with express-validator

## Development

```bash
# Run tests
npm test

# Run with nodemon for auto-reload
npm run dev

# Lint code
npm run lint
```

## Production Deployment

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Or use Docker
docker build -t boldvpn-api .
docker run -p 3000:3000 boldvpn-api
```

## Integration with FreeRADIUS

The API directly queries the RADIUS database for:
- User authentication verification
- Usage statistics and quotas
- Connected device information
- Session management

## Next Steps

1. **Real Stripe Integration**: Replace mock billing with actual Stripe API
2. **Email Notifications**: Add password reset emails
3. **Admin Dashboard**: User management interface
4. **Webhooks**: Handle Stripe payment events
5. **Rate Limiting**: More sophisticated rate limiting
6. **Logging**: Structured logging with Winston
7. **Testing**: Comprehensive test coverage
8. **Documentation**: OpenAPI/Swagger docs
