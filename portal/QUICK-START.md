# BoldVPN Portal - Quick Start Guide

## ✅ What's New

Your portal now has a **clean, unified single-page design**:

```
┌─────────────────────────────────────────┐
│  Header: BoldVPN Logo                   │
├───────────┬─────────────────────────────┤
│           │                             │
│ SIDEBAR   │   CONTENT AREA             │
│           │                             │
│ Overview  │   [Dashboard Cards]        │
│ Devices   │   - Data Usage             │
│ Usage     │   - Connection Speed       │
│ Profile   │   - Active Devices         │
│ Password  │   - Subscription           │
│ Billing   │                            │
│           │                            │
│ [Logout]  │                            │
│           │                             │
└───────────┴─────────────────────────────┘
```

## 🎯 Key Features

### ✨ Single Page Experience
- Click sidebar items → content changes **instantly**
- No page jumps or reloads
- Smooth, modern experience

### 🎨 Visual Feedback
- **Active menu item** highlighted in blue
- **Consistent card borders** across all sections
- **Unified design** throughout

### 📱 Responsive
- Desktop: Sidebar on left
- Mobile: Sidebar collapses to top
- All sections adapt perfectly

## 🚀 How to Use

### 1. Login
- Enter username and password
- Click "Sign In"
- Dashboard loads automatically

### 2. Navigate
Click any sidebar button:
- **Overview** → See your stats
- **Manage Devices** → Add/remove VPN devices
- **Usage History** → View data usage charts
- **Profile Settings** → Update email
- **Change Password** → Update password
- **Billing & Plans** → Manage subscription

### 3. Each Section Shows In-Place
- Content updates in the right panel
- Same border styling
- Active button stays highlighted
- No page navigation

## 🎨 Visual Design

### Colors
- **Blue (#0ea5e9)**: Primary actions & active states
- **Dark panels**: Cards and sidebar
- **Subtle borders**: Consistent throughout
- **Muted text**: Secondary information

### Layout
- **260px sidebar**: Fixed width with menu
- **Fluid content**: Adapts to screen size
- **Consistent spacing**: 20-32px gaps
- **Card-based**: All content in bordered cards

## 📊 Sections Explained

### Overview (Default)
Shows 4 cards:
1. Data Usage (with progress bar)
2. Connection Speed (up/down)
3. Connected Devices (count)
4. Subscription Status

### Manage Devices
- Table view of all devices
- Add new device button
- Download config per device
- Remove device option

### Usage History
- Chart.js line graph
- Last 30 days data
- Visual trend analysis

### Profile Settings
- Update email address
- Username (read-only)
- Save changes button

### Change Password
- Current password field
- New password field
- Confirmation field

### Billing & Plans
- Current plan info
- Available upgrades
- Billing history

## 🔧 Configuration

### API Connection
Edit `config.js`:
```javascript
const Config = {
    API_URL: 'https://api.boldvpn.net/api',
    TOKEN_KEY: 'boldvpn_token'
};
```

### Styling
Edit `styles.css` variables:
```css
:root {
    --primary: #0ea5e9;
    --bg: #0b1120;
}
```

## 📝 Testing

1. Open browser dev tools (F12)
2. Navigate to portal URL
3. Login with test account
4. Click each sidebar menu item
5. Verify:
   - ✅ Content changes instantly
   - ✅ Active state updates
   - ✅ Same border on all cards
   - ✅ No console errors

## 🐛 Troubleshooting

### Login doesn't work
- Check `config.js` has correct API URL
- Verify API is running
- Check browser console for errors

### Content doesn't update
- Clear browser cache
- Check JavaScript console
- Verify app.js is loaded

### Styling looks wrong
- Hard refresh: Ctrl+Shift+R
- Check styles.css is loaded
- Verify no CSS conflicts

## 📦 Files Changed

- ✅ `index.html` - Simplified HTML structure
- ✅ `app.js` - Clean SPA logic
- ✅ `styles.css` - Unified styling

## 🔄 Rollback (if needed)

```bash
cd portal
mv index.html index.html.new
mv index.html.old index.html
mv app.js app.js.new
mv app.js.old app.js
mv styles.css styles.css.new
mv styles.css.old styles.css
```

## 🎉 Success Indicators

You know it's working when:
1. ✅ Login shows a clean auth card
2. ✅ Dashboard appears with sidebar + content
3. ✅ Clicking menu items changes content instantly
4. ✅ Active menu item is blue
5. ✅ All cards have consistent borders
6. ✅ No page jumps or scrolling to top

## 📚 Learn More

See `PORTAL-REDESIGN.md` for detailed technical info.
