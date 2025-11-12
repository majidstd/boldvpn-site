# BoldVPN Portal - Clean SPA Design

## Overview
The portal has been redesigned as a clean Single Page Application (SPA) with:
- **Left sidebar** with navigation menu
- **Right content area** showing different sections
- **No page jumps** - all content loads in the same view
- **Active state highlighting** on selected menu items

## Features

### Navigation Structure
- **Overview** - Dashboard with usage stats, devices, and subscription status
- **Manage Devices** - Add, view, and remove VPN devices
- **Usage History** - Data usage charts over time
- **Profile Settings** - Update email and account info
- **Change Password** - Update account password
- **Billing & Plans** - View current plan and billing history

### Key Improvements
1. **Unified Layout**: All sections share the same border and styling
2. **Active Navigation**: Selected menu item is highlighted in blue
3. **No Page Reloads**: Content switches instantly without jumps
4. **Consistent Design**: All cards and sections use the same visual style
5. **Responsive**: Works on mobile with collapsible sidebar

## File Structure

```
portal/
├── index.html          # Clean HTML structure
├── app.js              # SPA logic with navigation
├── styles.css          # Unified styling
├── config.js           # API configuration
└── setup-wizard.js     # Device setup wizard
```

## How It Works

### 1. Login Flow
- User enters credentials
- Token is stored in localStorage/sessionStorage
- Dashboard is rendered dynamically

### 2. Navigation
- Click any sidebar button
- Content area updates without page reload
- Active button is highlighted
- Previous section content is replaced

### 3. Content Sections
Each section is rendered dynamically:
- Overview: Real-time stats cards
- Devices: Table with device list
- Usage: Chart.js graph
- Profile: Form with user data
- Password: Change password form
- Billing: Plan and payment info

## Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary: #0ea5e9;    /* Main blue color */
    --bg: #0b1120;          /* Background */
    --card: #0b1226;        /* Card background */
    --border: #1f2a44;      /* Borders */
}
```

### API Endpoints
Configure in `config.js`:
```javascript
const Config = {
    API_URL: 'https://api.boldvpn.net/api',
    TOKEN_KEY: 'boldvpn_token'
};
```

## Backup Files
Old files are saved as:
- `index.html.old`
- `app.js.old`
- `styles.css.old`

To restore: `mv index.html.old index.html`

## Testing
1. Open `portal/index.html` in browser
2. Login with test credentials
3. Click sidebar menu items
4. Verify smooth transitions
5. Check responsive design on mobile

## Browser Support
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Mobile browsers: ✅

## Dependencies
- Chart.js (for usage graphs)
- Vanta.js (for animated background)
- Inter font (from Google Fonts)
