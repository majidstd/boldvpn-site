# BoldVPN Customer Portal - Complete Guide

Modern, responsive web interface for BoldVPN users to manage their accounts, view usage statistics, and control their VPN service.

## 🎯 Features

✅ **User Authentication**
- Secure login with JWT tokens
- User registration with plan selection
- Password reset functionality  
- Remember me option

✅ **Dashboard**
- Real-time usage statistics
- Data usage tracking with progress bars
- Connection speed display
- Connected devices count
- Current session information
- Auto-refresh every 30 seconds

✅ **Account Management**
- View and update profile
- Change password
- Manage connected devices
- View usage history (last 30 days)

✅ **Billing Integration**
- View current plan
- Manage subscriptions
- View billing history
- Stripe payment integration (in progress)

✅ **Responsive Design**
- Modern, clean interface
- Mobile-friendly
- Professional styling with Inter font

## 📁 Files

```
portal/
├── index.html       # Main HTML structure
├── styles.css       # All styling (responsive, modern)
├── app.js           # JavaScript SPA logic
├── config.js        # Configuration (API URL, settings)
├── README.md        # Basic info
└── PORTAL-GUIDE.md  # This comprehensive guide
```

## ⚙️ Configuration

### API Endpoint Setup

Edit `config.js` to configure your API URL:

```javascript
const Config = {
    // Auto-detect based on environment
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'  // Local development
        : 'https://api.boldvpn.net/api',  // Production
    
    // Other settings
    TOKEN_KEY: 'boldvpn_token',
    REFRESH_INTERVAL: 30000,  // 30 seconds
};
```

### Plans Configuration

Customize your VPN plans in `config.js`:

```javascript
PLANS: [
    {
        id: 'basic',
        name: 'Basic',
        price: 9.99,
        data: '50 GB',
        speed: '100 Mbps',
        devices: 2
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        data: 'Unlimited',
        speed: '500 Mbps',
        devices: 5
    },
    {
        id: 'family',
        name: 'Family',
        price: 29.99,
        data: 'Unlimited',
        speed: '1 Gbps',
        devices: 10
    }
]
```

## 🚀 Deployment Options

### Option 1: GitHub Pages (Recommended)

**Pros:** Free, HTTPS included, easy to deploy

The portal is already in your `boldvpn-site` repository:

1. **Commit portal files:**
   ```bash
   git add portal/
   git commit -m "Add customer portal"
   git push
   ```

2. **Access portal:**
   ```
   https://boldvpn.net/portal/
   ```

3. **Link from main site:**
   ```html
   <!-- Add to index.html nav -->
   <a href="/portal/">My Account</a>
   ```

**Configuration for GitHub Pages:**
- API URL should be `https://api.boldvpn.net/api`
- CORS in API must allow `https://boldvpn.net`

### Option 2: Subdomain (portal.boldvpn.net)

Host on a custom subdomain:

1. **DNS Setup:**
   ```
   CNAME portal.boldvpn.net -> your-server-ip
   ```

2. **Nginx Configuration:**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name portal.boldvpn.net;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       root /var/www/boldvpn/portal;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **Deploy files:**
   ```bash
   scp -r portal/* user@server:/var/www/boldvpn/portal/
   ```

### Option 3: Local Development

For testing locally:

```bash
# Using Python 3
cd portal
python3 -m http.server 8080

# Or using Node.js http-server
npx http-server -p 8080 -c-1

# Access at: http://localhost:8080
```

**Local development config:**
```javascript
// config.js will auto-detect localhost
API_URL: 'http://localhost:3000/api'
```

## 📖 User Guide

### For End Users

#### 1. Registration

```
1. Visit portal page
2. Click "Sign up"
3. Fill in details:
   - Username
   - Email
   - Password (strong password required)
   - Confirm password
4. Choose a plan (Basic/Premium/Family)
5. Accept Terms of Service
6. Click "Create Account"
7. Redirected to payment (Stripe)
8. After payment, access dashboard
```

#### 2. Login

```
1. Enter username
2. Enter password
3. (Optional) Check "Remember me"
4. Click "Sign In"
5. Redirected to dashboard
```

#### 3. Dashboard

**Data Usage Card:**
- Shows current month's data usage
- Progress bar visualization
- Quota limit display

**Connection Speed Card:**
- Current download speed
- Current upload speed
- Real-time updates

**Connected Devices Card:**
- Number of active devices
- Maximum devices allowed for plan
- Click to manage devices

**Current Session Card:**
- Connection status
- Session start time
- IP address
- Server location

#### 4. Account Actions

**Change Password:**
```
1. Click "Change Password" button
2. Enter current password
3. Enter new password
4. Confirm new password
5. Click "Update Password"
```

**View Usage History:**
```
1. Click "View Usage History"
2. See last 30 days of usage
3. Data visualized in chart
```

**Manage Devices:**
```
1. Click "Manage Devices"
2. See list of connected devices
3. Option to disconnect devices
4. See device details (IP, OS, last seen)
```

**Billing & Plans:**
```
1. Click "Billing & Plans"
2. View current subscription
3. Upgrade/downgrade plan
4. View payment history
5. Update payment method
```

#### 5. Logout

```
1. Click "Logout" button
2. Session cleared
3. Redirected to login page
```

## 💻 Developer Guide

### Architecture

**Single Page Application (SPA):**
- No page reloads
- Dynamic content updates
- Client-side routing
- JWT token-based auth

### Class Structure

```javascript
class BoldVPNPortal {
    constructor()           // Initialize portal
    init()                  // Setup and check auth
    bindEvents()            // Attach event listeners
    checkAuth()             // Verify authentication
    verifyToken()           // Validate JWT
    showDashboard()         // Display dashboard
    loadDashboardData()     // Fetch user data
    handleLogin(e)          // Process login
    handleRegister(e)       // Process registration
    logout()                // Clear session
    // ...more methods
}
```

### API Integration

**Authentication Flow:**

```javascript
// 1. Login
POST /api/auth/login
{
    "username": "testuser",
    "password": "Test@123!"
}
Response:
{
    "token": "eyJhbGci...",
    "user": { "username": "testuser", ... }
}

// 2. Store token
localStorage.setItem('boldvpn_token', token);

// 3. Verify token
GET /api/auth/verify
Headers: { Authorization: "Bearer <token>" }

// 4. Get user data
GET /api/user/profile
Headers: { Authorization: "Bearer <token>" }
```

**Dashboard Data Flow:**

```
1. showDashboard()
   ├─> Display dashboard section
   └─> Call loadDashboardData()

2. loadDashboardData()
   ├─> GET /api/user/profile
   ├─> GET /api/user/usage
   ├─> GET /api/user/sessions
   └─> Update UI elements

3. Auto-refresh
   ├─> setInterval(loadDashboardData, 30000)
   └─> Updates every 30 seconds
```

### Required API Endpoints

**Authentication:**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/verify`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

**User Management:**
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `GET /api/user/usage`
- `GET /api/user/sessions`
- `PUT /api/user/password`

**Billing:**
- `GET /api/billing/subscription`
- `POST /api/billing/create-checkout`
- `GET /api/billing/invoices`
- `POST /api/billing/cancel`

### Event Handling

```javascript
// Example: Login form submission
async handleLogin(e) {
    e.preventDefault();
    
    // Get form data
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Call API
    const response = await fetch(`${this.apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    // Handle response
    if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        localStorage.setItem(this.tokenKey, this.token);
        this.showDashboard();
    } else {
        // Show error
    }
}
```

## 🔒 Security Features

✅ **JWT Token Authentication**
- Secure, stateless authentication
- 7-day expiration (configurable)
- Auto-logout on expiration

✅ **LocalStorage Security**
- Tokens stored in localStorage
- Auto-clear on logout
- XSS protection via Content Security Policy

✅ **HTTPS Only**
- All production traffic over HTTPS
- Secure cookies
- HSTS headers

✅ **Input Validation**
- Client-side validation
- Server-side validation (API)
- XSS/SQL injection protection

✅ **CORS Protection**
- API restricts origins
- Only whitelisted domains allowed

## 🎨 Customization

### Brand Colors

Edit `styles.css`:

```css
:root {
    --primary-color: #0ea5e9;      /* Main brand color */
    --secondary-color: #8b5cf6;    /* Secondary accent */
    --success-color: #10b981;      /* Success messages */
    --danger-color: #ef4444;       /* Error messages */
    --warning-color: #f59e0b;      /* Warnings */
    
    /* Change these to match your brand */
}
```

### Typography

```css
:root {
    --font-family: 'Inter', sans-serif;
    --font-size-base: 16px;
}

/* Or use a different font */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

:root {
    --font-family: 'Roboto', sans-serif;
}
```

### Auto-Refresh Interval

Edit `config.js`:

```javascript
REFRESH_INTERVAL: 60000,  // 60 seconds (instead of 30)
```

## 🐛 Troubleshooting

### "Cannot connect to API"

**Symptoms:** Login fails, dashboard won't load

**Solutions:**

1. Check API URL in `config.js`
2. Verify API is running:
   ```bash
   curl https://api.boldvpn.net/api/health
   ```
3. Check CORS settings in API `server.js`:
   ```javascript
   cors({
       origin: 'https://boldvpn.net',  // Must match portal domain
       credentials: true
   })
   ```
4. Check browser console for errors (F12 → Console)

### "Login failed" / "Invalid credentials"

**Solutions:**

1. Verify user exists in database:
   ```bash
   psql -U radiususer -d radius -c "SELECT username FROM radcheck WHERE username='testuser';"
   ```

2. Check API logs:
   ```bash
   tail -f /var/log/boldvpn-api.log
   ```

3. Test API directly:
   ```bash
   curl -X POST https://api.boldvpn.net/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","password":"Test@123!"}'
   ```

### "Token expired" / Auto-logout

**Cause:** JWT tokens expire after 7 days (default)

**Solutions:**

1. User needs to login again (expected behavior)
2. Increase token expiration in API `.env`:
   ```env
   JWT_EXPIRES_IN=30d  # 30 days instead of 7
   ```

### Dashboard data not updating

**Solutions:**

1. Check browser console for errors
2. Verify auto-refresh is running:
   ```javascript
   // In browser console:
   portal.refreshInterval  // Should show interval ID
   ```
3. Check API endpoints are responding:
   ```bash
   curl -H "Authorization: Bearer <token>" \
     https://api.boldvpn.net/api/user/profile
   ```

### Styling issues / Layout broken

**Solutions:**

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check `styles.css` loaded correctly (Network tab in DevTools)
4. Verify CDN fonts are loading:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet">
   ```

## 📊 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✅ Fully supported |
| Firefox | Latest | ✅ Fully supported |
| Safari | Latest | ✅ Fully supported |
| Edge | Latest | ✅ Fully supported |
| Mobile Safari | iOS 12+ | ✅ Fully supported |
| Mobile Chrome | Android 8+ | ✅ Fully supported |

## ✅ Testing Checklist

Before deploying to production:

- [ ] API URL configured correctly in `config.js`
- [ ] CORS allows portal domain in API
- [ ] SSL/HTTPS working
- [ ] Test login with valid credentials
- [ ] Test registration flow
- [ ] Dashboard loads correctly
- [ ] Usage data displays
- [ ] Password change works
- [ ] Logout clears session
- [ ] Mobile responsive design works
- [ ] All links functional
- [ ] Error messages display correctly
- [ ] Auto-refresh working

## 🎯 Next Steps

1. ✅ Portal created and configured
2. ⏳ Deploy to production
3. ⏳ Connect to live API
4. ⏳ Test all features end-to-end
5. ⏳ Add Stripe payment integration
6. ⏳ Add email notifications
7. ⏳ Add 2FA support
8. ⏳ Add admin dashboard

## 📞 Support

- 📁 **Portal files:** `boldvpn-site/portal/`
- 🔗 **API docs:** `boldvpn-site/api/README.md`
- 🔧 **Config:** `portal/config.js`
- 📋 **RADIUS setup:** `boldvpn-site/radius-server/`

## License

MIT

