# How the Customer Portal Works - Simple Guide

A beginner-friendly explanation of how the BoldVPN customer portal, API, and backend work together.

## 🎯 What You Have

**3 Simple Pieces:**

1. **Customer Portal** (Frontend) - The website users see
2. **Node.js API** (Backend) - The server that handles requests
3. **PostgreSQL Database** - Where all data is stored (same as RADIUS!)

## 📱 The Complete Flow (Step-by-Step)

### **Step 1: User Opens Portal**

```
User types in browser: https://boldvpn.net/portal/
```

**What happens:**
- Browser downloads: `index.html`, `app.js`, `styles.css`, `config.js`
- JavaScript starts and checks: "Do we have a saved token?"
- **If YES** → Try to auto-login
- **If NO** → Show login form

---

### **Step 2: User Enters Credentials**

```
User sees login form:
Username: testuser
Password: Test@123!

User clicks "Sign In"
```

---

### **Step 3: JavaScript Sends Request to API**

**app.js does this:**

```javascript
fetch('https://api.boldvpn.net/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'testuser',
        password: 'Test@123!'
    })
})
```

**Translation:** "Hey API, is this username and password correct?"

---

### **Step 4: API Checks Database**

**On your FreeBSD server, the API receives the request:**

```javascript
// routes/auth.js
1. Extract username and password from request
2. Connect to PostgreSQL database
3. Run SQL query:
   SELECT * FROM radcheck WHERE username = 'testuser'
4. Get stored password hash
5. Compare submitted password with stored hash (bcrypt)
6. If match → User is valid! ✓
```

---

### **Step 5: API Creates JWT Token**

**If password is correct:**

```javascript
const token = jwt.sign(
    { username: 'testuser', id: 123 },
    'your_secret_key',
    { expiresIn: '7d' }  // Valid for 7 days
)

// Token looks like:
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Send back to browser:
{
    "success": true,
    "token": "eyJhbGci...",
    "user": {
        "username": "testuser",
        "email": "test@example.com"
    }
}
```

**What is JWT?** Think of it like a **concert wristband**:
- You show ID once (login)
- They give you wristband (JWT token)
- Re-entry just shows wristband (no ID check again!)
- Wristband expires after concert (7 days)

---

### **Step 6: Browser Stores Token**

**app.js receives the response:**

```javascript
// Save token in browser
localStorage.setItem('boldvpn_token', token)

// Hide login form
// Show dashboard
```

**Token is now saved!** User stays logged in even after closing browser.

---

### **Step 7: Dashboard Loads Data**

**Now the fun part - showing user's actual usage!**

#### **Request 1: Get User Profile**

```javascript
GET /api/user/profile
Headers: Authorization: Bearer eyJhbGci...
```

**API does:**
```sql
SELECT * FROM radcheck WHERE username='testuser'
SELECT * FROM radreply WHERE username='testuser'
```

**Returns:**
```json
{
    "username": "testuser",
    "email": "test@example.com",
    "plan": "basic",
    "data_limit": "10 GB",
    "speed_limit": "100 Mbps",
    "devices_limit": 3
}
```

#### **Request 2: Get Usage Data**

```javascript
GET /api/user/usage
Headers: Authorization: Bearer eyJhbGci...
```

**API does:**
```sql
SELECT 
  SUM(acctinputoctets) as downloaded,
  SUM(acctoutputoctets) as uploaded,
  COUNT(*) as sessions
FROM radacct
WHERE username='testuser'
  AND acctstarttime > '2025-01-01'
```

**Returns:**
```json
{
    "data_used": 2684354560,      // 2.5 GB
    "data_limit": 10737418240,    // 10 GB
    "percentage": 25,
    "sessions_count": 15,
    "total_time": 125400          // seconds
}
```

#### **Request 3: Get Active Sessions**

```javascript
GET /api/user/sessions
Headers: Authorization: Bearer eyJhbGci...
```

**API does:**
```sql
SELECT *
FROM radacct
WHERE username='testuser'
  AND acctstoptime IS NULL  -- Still active!
```

**Returns:**
```json
{
    "active_sessions": [
        {
            "session_id": "abc123",
            "ip_address": "10.0.8.45",
            "started_at": "2025-01-06T08:02:00Z",
            "duration": 14400,         // 4 hours
            "data_used": 2500000000    // 2.5 GB
        }
    ]
}
```

---

### **Step 8: Dashboard Updates UI**

**app.js takes all this data and updates the HTML:**

```javascript
document.getElementById('data-used').textContent = '2.5 GB';
document.getElementById('data-limit').textContent = '10 GB';
document.getElementById('data-progress').style.width = '25%';
document.getElementById('devices-count').textContent = '1';
document.getElementById('session-info').textContent = 'Active since 8:02 AM (4h)';
```

**User sees:**
```
┌────────────────────────────────┐
│ Data Usage:  2.5 GB / 10 GB    │
│ [██████░░░░░░░░░] 25%          │
│                                │
│ Connected Devices: 1 / 3       │
│                                │
│ Current Session:               │
│ Active since 8:02 AM (4h)      │
└────────────────────────────────┘
```

---

### **Step 9: Auto-Refresh (Every 30 Seconds)**

**app.js sets up automatic refresh:**

```javascript
setInterval(() => {
    loadDashboardData();  // Repeat Step 7
}, 30000);  // 30 seconds
```

**Result:** Dashboard updates automatically every 30 seconds!
- New data usage
- Updated session time
- New connected devices

**All without page reload!** That's the power of a Single Page Application (SPA).

---

## 💡 Real Example: User Changes Password

Let's walk through a complete action:

1. **User clicks "Change Password" button**
   - Modal pops up

2. **User fills in form:**
   - Current Password: `Test@123!`
   - New Password: `NewPass456!`
   - Confirm: `NewPass456!`

3. **User clicks "Update Password"**
   - JavaScript validates passwords match

4. **JavaScript sends request:**
   ```javascript
   PUT /api/user/password
   Headers: Authorization: Bearer eyJhbGci...
   Body: {
       "current_password": "Test@123!",
       "new_password": "NewPass456!"
   }
   ```

5. **API processes request:**
   ```javascript
   a. Verify JWT token → Extract username
   b. Query database for current password
   c. Verify current password matches
   d. Hash new password with bcrypt
   e. Update database:
      UPDATE radcheck 
      SET value = 'new_hashed_password'
      WHERE username='testuser'
   f. Return success
   ```

6. **Browser shows success message**
   - Modal closes
   - "Password updated successfully!"

7. **Password is now changed!**
   - Next VPN login requires new password
   - Same database for VPN and portal!

---

## 🏗️ Where Everything Runs

### **Customer Portal (Frontend)**

- **Location:** GitHub Pages (free!)
- **URL:** `https://boldvpn.net/portal/`
- **Files:** HTML, CSS, JavaScript
- **Runs:** In user's browser
- **Cost:** FREE

### **Node.js API (Backend)**

- **Location:** FreeBSD server
- **Port:** 3000 (internal)
- **External URL:** `https://api.boldvpn.net` (via nginx)
- **Runs:** As FreeBSD service (`boldvpn_api`)
- **Cost:** Server cost only

### **PostgreSQL Database**

- **Location:** Same FreeBSD server
- **Port:** 5432 (localhost only)
- **Database:** `radius`
- **User:** `radiususer`
- **Tables:** `radcheck`, `radreply`, `radacct`
- **Shared with:** FreeRADIUS (same database!)

---

## 🔑 The Magic: Same Database!

**This is the KEY insight:**

### When user connects to VPN:
```
User → WireGuard → OPNsense → RADIUS → PostgreSQL
                                        ├─ radcheck (authenticate)
                                        └─ radacct (track usage)
```

### When user views portal:
```
User → Browser → API → PostgreSQL
                       ├─ radcheck (validate login)
                       └─ radacct (show usage)
```

**SAME DATA!**

So when user:
- Connects to VPN at 8:00 AM → `radacct` table updated
- Checks portal at 12:00 PM → Sees that usage from `radacct`!

**No duplicate data, no sync issues, just one source of truth!**

---

## 🎫 What is JWT (Simple Explanation)

**JWT = JSON Web Token**

Think of it like a **concert wristband**:

1. **Login (show ID):**
   - User: `testuser` / `Test@123!`
   - API checks password
   - API gives you wristband (JWT)

2. **Re-entry (show wristband):**
   - User: "Here's my wristband: `eyJhbGci...`"
   - API: "Valid! Come in!"
   - **No password check needed!**

3. **Wristband expires:**
   - After 7 days, wristband invalid
   - Must login again to get new one

### **Why it's secure:**

✅ **Signature:** Can't be faked (like hologram on wristband)  
✅ **Expiration:** Only works for 7 days  
✅ **HTTPS:** Encrypted when sent over internet  

### **What it contains:**

```json
{
  "username": "testuser",
  "id": 123,
  "exp": 1704844800  // Expiration date
}
```

### **Where it's stored:**

```javascript
// In browser's localStorage
localStorage.setItem('boldvpn_token', 'eyJhbGci...')

// When browser closes → Token stays saved
// When user returns → Auto-login!
```

---

## 🚀 Simple Deployment Steps

### **1. Deploy API to FreeBSD**

```bash
# Copy API folder to server
scp -r api/ admin@server-ip:~/boldvpn-api/

# SSH into server
ssh admin@server-ip

# Run setup script
cd boldvpn-api
chmod +x freebsd-api-setup.sh
sudo ./freebsd-api-setup.sh

# Test it works
curl http://localhost:3000/api/health
```

### **2. Configure Portal**

```bash
# Edit config
cd portal
nano config.js

# Set API URL
API_URL: 'https://api.boldvpn.net/api'
```

### **3. Push to GitHub**

```bash
# From boldvpn-site directory
git add portal/
git commit -m "Add customer portal"
git push

# Automatically available at:
# https://boldvpn.net/portal/
```

### **4. Test End-to-End**

```bash
# Open browser
https://boldvpn.net/portal/

# Login
Username: testuser
Password: Test@123!

# Should see dashboard!
```

---

## 🎯 What Your Portal Can Do

✅ **User Login/Registration**
- Secure JWT authentication
- Remember me functionality
- Password validation

✅ **Dashboard**
- Real-time usage statistics
- Data usage with progress bar
- Connection speed display
- Active device count
- Current session info

✅ **Account Management**
- Change password
- View usage history (30 days)
- Manage connected devices
- View billing info

✅ **Auto-Refresh**
- Updates every 30 seconds
- No page reload needed
- Always shows latest data

---

## 🔧 Technology Stack

**Frontend:**
- HTML5 (structure)
- CSS3 (styling, responsive design)
- Vanilla JavaScript (no frameworks!)
- SPA (Single Page Application)

**Backend:**
- Node.js 20
- Express.js (web framework)
- JWT for authentication
- bcrypt for password hashing

**Database:**
- PostgreSQL
- Shared with FreeRADIUS
- Three main tables

**Security:**
- HTTPS only
- JWT tokens (7-day expiration)
- Rate limiting (100 req/15min)
- CORS protection
- Helmet security headers
- Input validation

---

## 📊 Complete User Journey

### **Morning (8:00 AM):**

1. User opens WireGuard app
2. Connects to VPN
3. Redirected to captive portal
4. Enters: `testuser` / `Test@123!`
5. RADIUS validates → Access granted
6. Starts browsing internet
7. Usage tracked in `radacct` table

### **Afternoon (2:00 PM):**

1. User visits `https://boldvpn.net/portal/`
2. Enters same credentials
3. API validates → JWT token issued
4. Dashboard loads
5. Shows:
   - Data used: 2.5 GB / 10 GB (from `radacct`)
   - Active session: 6 hours (from `radacct`)
   - Current IP: 10.0.8.45 (from `radacct`)

### **Evening (6:00 PM):**

1. User disconnects VPN
2. RADIUS updates `radacct`:
   - Session end time
   - Total data: 8.2 GB
   - Total time: 10 hours

### **Later (8:00 PM):**

1. User opens portal again
2. Auto-login (token still valid!)
3. Clicks "View Usage History"
4. Sees chart of last 30 days
5. All from same `radacct` table

---

## 🎉 Summary

**The customer portal is:**
- ✅ Simple (just HTML/CSS/JS)
- ✅ Fast (no page reloads)
- ✅ Secure (JWT + HTTPS)
- ✅ Smart (same database as VPN!)
- ✅ Automatic (30-second refresh)
- ✅ Free to host (GitHub Pages)

**The API is:**
- ✅ Lightweight (Node.js)
- ✅ Stateless (no session storage)
- ✅ Fast (no unnecessary DB queries)
- ✅ Secure (JWT verification)
- ✅ Auto-deployed (FreeBSD service)

**The magic:**
- ✅ **ONE database for everything!**
- ✅ VPN usage → Automatically in portal
- ✅ Password change → Updates VPN login
- ✅ Real-time sync, no duplicates!

---

## 🤔 Common Questions

**Q: Why use JWT instead of sessions?**  
A: Faster (no database lookup), simpler (no storage), scalable (multiple servers can verify).

**Q: Is the token secure?**  
A: Yes! It's signed (can't be faked), expires (7 days), and sent over HTTPS (encrypted).

**Q: What if I want to revoke a token immediately?**  
A: User can change password, or you can add a "token blacklist" (more complex).

**Q: Can I use React/Vue instead?**  
A: Yes! But vanilla JavaScript is simpler and loads faster.

**Q: Why GitHub Pages for portal?**  
A: Free, fast CDN, automatic HTTPS, no server needed!

**Q: Can API and RADIUS be on different servers?**  
A: Yes, but they need access to same PostgreSQL database.

---

## 📚 Next Steps

1. ✅ Understanding complete (this guide)
2. ⏳ Deploy API to FreeBSD
3. ⏳ Test API endpoints
4. ⏳ Push portal to GitHub
5. ⏳ Test end-to-end
6. ⏳ Add Stripe payments (optional)
7. ⏳ Add email notifications (optional)

---

**That's it!** You now understand exactly how the customer portal, API, and backend work together. Simple, secure, and effective! 🚀

