# Portal Troubleshooting Guide

## Issue: Can't see the login page

### Solution 1: Hard Refresh Browser
The browser may be caching old files. Try:

**Chrome/Edge/Firefox:**
- Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**Safari:**
- Mac: `Cmd + Option + R`

### Solution 2: Clear Browser Cache
1. Open Browser DevTools: `F12` or `Cmd + Option + I`
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### Solution 3: Check Console for Errors
1. Open DevTools (F12)
2. Go to Console tab
3. Look for any red errors
4. Common issues:
   - `404 Not Found` → File path issue
   - `CORS error` → API connection issue
   - `Syntax error` → JavaScript issue

### Solution 4: Verify Files Are Correct
```bash
cd portal
ls -lh index.html app.js styles.css config.js
```

Should show:
- index.html (2.3K)
- app.js (24K)
- styles.css (9.7K)
- config.js (1.7K)

### Solution 5: Check File Contents
```bash
# Verify CSS is linked correctly
grep "styles.css" index.html

# Verify JS is linked correctly
grep "app.js" index.html

# Should NOT show:
# - styles-new.css
# - app-new.js
```

### Solution 6: Test Locally
1. Open portal folder
2. Right-click `index.html`
3. Open with browser
4. You should see:
   - Header with BoldVPN logo
   - Animated background
   - Login form in center

### Solution 7: Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Check if all files load (green status codes)
5. Look for:
   - index.html (200)
   - styles.css (200)
   - app.js (200)
   - config.js (200)

### Solution 8: View Page Source
1. Right-click page → "View Page Source"
2. Check that it shows:
   ```html
   <link rel="stylesheet" href="styles.css">
   <script src="app.js"></script>
   ```
3. NOT:
   ```html
   <link rel="stylesheet" href="styles-new.css">
   <script src="app-new.js"></script>
   ```

### Solution 9: Check JavaScript Console
Open console and type:
```javascript
typeof BoldVPNPortal
```

Should return: `"function"` or see if there's a `boldVPNPortal` instance

### Solution 10: Fresh Pull from Git
If using GitHub Pages or deployment:
```bash
cd boldvpn-site
git pull origin main
# Force refresh deployment
```

## Expected Behavior When Working

1. **Initial Load:**
   - See animated background
   - See header with logo
   - See login card in center

2. **After Login:**
   - Sidebar appears on left
   - Dashboard content on right
   - 4 stat cards visible

3. **Clicking Menu:**
   - Sidebar item turns blue
   - Content changes instantly
   - No page reload

## Common Issues

### Black/Blank Screen
- JavaScript not loading
- Check browser console
- Hard refresh browser

### Login Form Not Showing
- CSS not loading
- Check styles.css loads
- View Network tab

### "Config is not defined" Error
- config.js not loading first
- Check script order in HTML
- Should be: config.js, then app.js

### Nothing Happens After Login
- API connection issue
- Check config.js API_URL
- Check browser console

## Quick Test Commands

```bash
# Check if files exist
ls portal/*.{html,js,css}

# Check file references
grep -E "href=|src=" portal/index.html

# View any JavaScript errors
# (Open browser console)
```

## Still Not Working?

1. Delete browser cache completely
2. Try incognito/private window
3. Try different browser
4. Check if using latest git commit
5. Look at browser console errors
6. Share the exact error message
