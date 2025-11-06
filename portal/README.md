# BoldVPN Customer Portal

Modern, responsive web interface for BoldVPN account management and usage tracking.

## Features

- **User Authentication**: Login and registration forms
- **Dashboard**: Real-time usage statistics and device management
- **Profile Management**: Change password, view account details
- **Usage Tracking**: Data usage, session history, connected devices
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Consistent with BoldVPN branding

## Quick Start

1. **Start the API Backend** (from `../boldvpn-radius-server/api/`):
   ```bash
   npm install
   npm start
   ```

2. **Open the Portal**:
   - Open `index.html` in your browser
   - Or serve via a web server for full functionality

3. **Configure API URL** (in `app.js`):
   ```javascript
   this.apiBase = 'http://localhost:3000/api'; // Change to your API server
   ```

## File Structure

```
portal/
├── index.html          # Main HTML file
├── styles.css          # CSS styles (matches login.html design)
├── app.js             # JavaScript application logic
└── README.md          # This file
```

## Features Overview

### Authentication
- **Login**: Username/password authentication
- **Registration**: New account creation with plan selection
- **Password Reset**: Forgot password functionality (UI ready)
- **JWT Tokens**: Secure session management

### Dashboard
- **Usage Statistics**: Data used vs. limit with progress bars
- **Speed Limits**: Download/upload speed indicators
- **Device Management**: Connected devices list and limits
- **Session Info**: Current VPN session details

### Account Management
- **Change Password**: Secure password updates
- **Usage History**: 30-day usage trends (expandable)
- **Billing Integration**: Subscription management (UI ready)
- **Device Control**: View and manage connected devices

## API Integration

The portal communicates with the BoldVPN API backend:

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Token verification

### User Management
- `GET /api/user/profile` - User profile and usage
- `PUT /api/user/password` - Change password
- `GET /api/user/usage-history` - Usage history
- `GET /api/user/devices` - Connected devices

### Billing (Mock)
- `GET /api/billing/plans` - Available plans
- `GET /api/billing/subscription` - User subscription

## Styling

The portal uses the same dark theme and design language as the original `login.html`:

- **Primary Color**: Orange (#ff6b35)
- **Background**: Dark gradient (#0a0a0a to #1a1a1a)
- **Cards**: Dark gray (#2a2a2a) with subtle borders
- **Typography**: Inter font family
- **Responsive**: Mobile-first design

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

### Local Development
```bash
# Serve with a local web server
python3 -m http.server 8080
# Open http://localhost:8080/portal/
```

### API Configuration
Update the API base URL in `app.js`:
```javascript
this.apiBase = 'https://api.boldvpn.net'; // Production URL
```

### Testing
- Test with the API backend running
- Use browser developer tools for debugging
- Check network tab for API calls

## Security Features

- **Input Validation**: Client-side form validation
- **XSS Protection**: Sanitized user inputs
- **CSRF Protection**: JWT-based authentication
- **Secure Storage**: Local/session storage for tokens

## Future Enhancements

1. **Real-time Updates**: WebSocket connections for live usage data
2. **Payment Integration**: Stripe integration for billing
3. **Email Notifications**: Password reset emails
4. **Advanced Charts**: Interactive usage graphs
5. **Multi-language**: Internationalization support
6. **PWA Features**: Offline support and push notifications

## Deployment

1. **Build Process**: Minify CSS/JS for production
2. **CDN**: Serve static assets from CDN
3. **HTTPS**: Always serve over HTTPS
4. **Caching**: Implement proper cache headers
5. **Monitoring**: Add error tracking and analytics

## Troubleshooting

### API Connection Issues
- Check that the API server is running
- Verify the `apiBase` URL in `app.js`
- Check browser console for CORS errors

### Authentication Problems
- Clear browser localStorage/sessionStorage
- Check JWT token expiration
- Verify API credentials

### Styling Issues
- Ensure all CSS files are loaded
- Check for CSS conflicts
- Test responsive breakpoints

## Contributing

1. Follow the existing code style
2. Test on multiple browsers
3. Ensure responsive design works
4. Add comments for complex logic
5. Update this README for new features

## License

MIT License - see LICENSE file for details.
