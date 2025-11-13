// BoldVPN Customer Portal - Clean SPA Version
class BoldVPNPortal {
    constructor() {
        this.apiBase = (typeof Config !== 'undefined' && Config.API_URL) 
            ? Config.API_URL 
            : 'http://localhost:3000/api';
        this.tokenKey = 'boldvpn_token';
        this.token = localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
        this.user = null;
        this.currentSection = 'overview';
        // Navigation history for debugging (keeps a short trace of recent navigations)
        this._navHistory = [];

        this.init();
    }

    init() {
        this.checkAuth();
    }

    checkAuth() {
        if (this.token) {
            this.verifyToken();
        } else {
            this.showLogin();
        }
    }

    async verifyToken() {
        try {
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.showDashboard();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            this.logout();
        }
    }

    showLogin() {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('portal-container').style.display = 'none';
        this.renderLoginForm();
    }

    renderLoginForm() {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = `
            <div class="auth-section">
                <div class="auth-card">
                    <h2>Account Login</h2>
                    <p class="auth-subtitle">Access your BoldVPN account</p>

                    <form id="login-form" class="auth-form">
                        <div class="form-group">
                            <label for="username">Username</label>
                            <input type="text" id="username" name="username" required>
                        </div>

                        <div class="form-group">
                            <label for="password">Password</label>
                            <input type="password" id="password" name="password" required>
                        </div>

                        <div class="form-options">
                            <label class="checkbox-label">
                                <input type="checkbox" id="remember-me">
                                Remember me
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary">Sign In</button>
                    </form>

                    <div id="login-error" class="alert alert-error" style="display: none;"></div>
                </div>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
    }

    async handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.textContent;
        const errorDiv = document.getElementById('login-error');

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner"></div> Signing in...';

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem(this.tokenKey, this.token);
                this.showDashboard();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = btnText;
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = btnText;
        }
    }

    showDashboard() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('portal-container').style.display = 'block';
        
        this.renderDashboardStructure();
        this.bindNavigationEvents();
        this.navigateTo('overview');
    }

    renderDashboardStructure() {
        const portalContainer = document.getElementById('portal-container');
        portalContainer.innerHTML = `
            <div class="portal-wrapper">
                <!-- Sidebar -->
                <aside class="portal-sidebar">
                    <div class="sidebar-header">
                        <div class="user-info">
                            <h3 id="sidebar-username">${this.user?.username || 'User'}</h3>
                            <p id="sidebar-plan">${this.user?.plan || 'Basic'} Plan</p>
                        </div>
                    </div>
                    
                    <nav class="sidebar-nav">
                        <button class="nav-item active" data-section="overview">
                            <span>📊</span> Overview
                        </button>
                        <button class="nav-item" data-section="devices">
                            <span>📱</span> Manage Devices
                        </button>
                        <button class="nav-item" data-section="usage">
                            <span>📈</span> Usage History
                        </button>
                        <button class="nav-item" data-section="profile">
                            <span>👤</span> Profile Settings
                        </button>
                        <button class="nav-item" data-section="password">
                            <span>🔒</span> Change Password
                        </button>
                        <button class="nav-item" data-section="billing">
                            <span>💳</span> Billing & Plans
                        </button>
                    </nav>

                    <div class="sidebar-footer">
                        <button id="logout-btn" class="btn btn-secondary">Logout</button>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="portal-content">
                    <div id="content-area"></div>
                </main>
            </div>
        `;
    }

    bindNavigationEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Nav item clicked:', btn.getAttribute('data-section'), 'Current section:', this.currentSection);
                console.trace('Navigation click trace:');
                const section = btn.getAttribute('data-section');
                this.navigateTo(section);
            });
        });

        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    navigateTo(section) {
        console.log('=== navigateTo called with section:', section, '(was:', this.currentSection, ')');
        console.trace('navigateTo trace');

        // Instrumentation: keep a short history and emit an expanded trace when
        // navigating to overview so we can identify unexpected callers.
        try {
            this._navHistory = this._navHistory || [];
            this._navHistory.push({
                time: new Date().toISOString(),
                section,
                from: this.currentSection,
                justAdded: !!this._justAddedDevice,
                stack: (new Error()).stack
            });
            // keep only last 10 entries
            if (this._navHistory.length > 10) this._navHistory.shift();
        } catch (err) {
            console.warn('Failed to record nav history:', err);
        }

        if (section === 'overview') {
            console.groupCollapsed('navigateTo OVERVIEW debug');
            console.log('overview navigation requested. currentSection:', this.currentSection, ' _justAddedDevice:', !!this._justAddedDevice);
            // Print the most recent nav history (shallow)
            try { console.log('navHistory (recent):', this._navHistory.slice(-5)); } catch(e) {}
            console.trace('Stack trace for navigateTo(overview)');
            console.groupEnd();
        }
        
        // Prevent navigation to overview if we just added a device
        if (section === 'overview' && this.currentSection === 'devices' && this._justAddedDevice) {
            console.warn('BLOCKED navigation to overview - just added device, staying on devices');
            this._justAddedDevice = false;
            return;
        }
        
        this.currentSection = section;

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.querySelector(`[data-section="${section}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        } else {
            console.error('Nav item not found for section:', section);
        }

        // Render content
        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            console.error('Content area not found!');
            return;
        }
        
        switch(section) {
            case 'overview':
                this.renderOverview(contentArea);
                break;
            case 'devices':
                this.renderDevices(contentArea);
                break;
            case 'usage':
                this.renderUsage(contentArea);
                break;
            case 'profile':
                this.renderProfile(contentArea);
                break;
            case 'password':
                this.renderPassword(contentArea);
                break;
            case 'billing':
                this.renderBilling(contentArea);
                break;
            default:
                console.error('Unknown section:', section);
        }
        console.log('Navigation complete, currentSection:', this.currentSection);
    }

    renderOverview(container) {
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header">
                    <h2>Welcome back, ${this.user?.username || 'User'}!</h2>
                </div>

                <div class="dashboard-grid">
                        <div class="dashboard-card">
                            <h3>📊 Data Usage</h3>
                            <div class="usage-stats">
                                <div class="usage-item">
                                    <span class="usage-label">Used:</span>
                                    <span class="usage-value" id="data-used">Loading...</span>
                                </div>
                                <div class="usage-item">
                                    <span class="usage-label">Limit:</span>
                                    <span class="usage-value" id="data-limit">Loading...</span>
                                </div>
                                <div class="usage-progress">
                                    <div class="progress-bar" id="data-progress" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>

                        <div class="dashboard-card">
                            <h3>⚡ Connection Speed</h3>
                            <div class="speed-stats">
                                <div class="speed-item">
                                    <span class="speed-label">Download:</span>
                                    <span class="speed-value" id="speed-down">Loading...</span>
                                </div>
                                <div class="speed-item">
                                    <span class="speed-label">Upload:</span>
                                    <span class="speed-value" id="speed-up">Loading...</span>
                                </div>
                            </div>
                        </div>

                        <div class="dashboard-card">
                            <h3>📱 Connected Devices</h3>
                            <div class="devices-stats">
                                <div class="devices-count">
                                    <span class="devices-number" id="devices-count">0</span>
                                    <span class="devices-label">Devices</span>
                                </div>
                                <div class="devices-limit">
                                    <span>of <span id="devices-limit">--</span> allowed</span>
                                </div>
                            </div>
                        </div>

                        <div class="dashboard-card">
                            <h3>✓ Subscription Status</h3>
                            <div class="subscription-info">
                                <p><strong>Status:</strong> <span id="subscription-status" class="status-active">Active</span></p>
                                <p><strong>Plan:</strong> <span id="subscription-plan">${this.user?.plan || 'Basic'}</span></p>
                            </div>
                        </div>
                    </div>
                </div>
        `;
        
        this.loadOverviewData();
    }

    renderDevices(container) {
        // Store reference to this for use in inline handlers
        const portal = this;
        
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header">
                    <h2>Manage Devices</h2>
                    <div style="display: flex; gap: 10px;">
                        <button id="refresh-devices-btn" class="btn btn-secondary" type="button" onclick="window.boldVPNPortal.loadDevices(); return false;" title="Refresh device list">🔄 Refresh</button>
                        <button id="add-device-btn" class="btn btn-primary" type="button" onclick="window.boldVPNPortal.addDevice(); return false;">+ Add Device</button>
                    </div>
                </div>

                <div id="devices-container">
                    <p style="text-align: center; color: var(--muted); padding: 40px;">
                        Loading devices...
                    </p>
                </div>
            </div>
        `;

        // Bind event listener - use event delegation for reliability
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            // Remove old listener if exists
            contentArea.removeEventListener('click', portal.handleAddDeviceClick);
            portal.handleAddDeviceClick = (e) => {
                if (e.target && (e.target.id === 'add-device-btn' || e.target.closest('#add-device-btn'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Add Device button clicked via delegation');
                    portal.addDevice();
                }
            };
            contentArea.addEventListener('click', portal.handleAddDeviceClick);
        }
        
        // Also bind directly as fallback
        setTimeout(() => {
            const addBtn = document.getElementById('add-device-btn');
            if (addBtn) {
                console.log('Direct binding Add Device button');
                // Remove old listener
                const newBtn = addBtn.cloneNode(true);
                addBtn.parentNode.replaceChild(newBtn, addBtn);
                
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Add Device button clicked (direct)');
                    portal.addDevice();
                });
            } else {
                console.error('Add Device button not found!');
            }
        }, 100);
        
        this.loadDevices();
    }

    renderUsage(container) {
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header">
                    <h2>Usage History</h2>
                </div>

                <h3>Data Usage (Last 30 Days)</h3>
                <canvas id="usage-chart" style="max-height: 400px;"></canvas>
            </div>
        `;

        this.loadUsageHistory();
    }

    renderProfile(container) {
        container.innerHTML = `
            <div class="unified-container form-container">
                <div class="section-header">
                    <h2>Profile Settings</h2>
                </div>

                <form id="profile-form" class="auth-form">
                    <div class="form-group">
                        <label for="profile-username">Username</label>
                        <input type="text" id="profile-username" value="${this.user?.username || ''}" disabled>
                    </div>
                    <div class="form-group">
                        <label for="profile-email">Email</label>
                        <input type="email" id="profile-email" value="${this.user?.email || ''}" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Update Profile</button>
                </form>
                <div id="profile-message" class="alert" style="display: none; margin-top: 15px;"></div>
            </div>
        `;

        document.getElementById('profile-form').addEventListener('submit', (e) => this.handleProfileUpdate(e));
    }

    renderPassword(container) {
        container.innerHTML = `
            <div class="unified-container form-container">
                <div class="section-header">
                    <h2>Change Password</h2>
                </div>

                <form id="password-form" class="auth-form">
                    <div class="form-group">
                        <label for="current-password">Current Password</label>
                        <input type="password" id="current-password" required>
                    </div>
                    <div class="form-group">
                        <label for="new-password">New Password</label>
                        <input type="password" id="new-password" required>
                    </div>
                    <div class="form-group">
                        <label for="confirm-password">Confirm New Password</label>
                        <input type="password" id="confirm-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Update Password</button>
                </form>
                <div id="password-message" class="alert" style="display: none; margin-top: 15px;"></div>
            </div>
        `;

        document.getElementById('password-form').addEventListener('submit', (e) => this.handlePasswordChange(e));
    }

    renderBilling(container) {
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header">
                    <h2>Billing & Plans</h2>
                </div>

                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <h3>Current Plan</h3>
                        <p><strong>Plan:</strong> ${this.user?.plan || 'Basic'}</p>
                        <p><strong>Status:</strong> <span class="status-active">Active</span></p>
                        <button class="btn btn-primary" style="margin-top: 10px;">Upgrade Plan</button>
                    </div>

                    <div class="dashboard-card">
                        <h3>Billing History</h3>
                        <p style="color: var(--muted);">No billing history available.</p>
                    </div>
                </div>
                </div>
        `;
    }

    // Data loading methods
    async loadOverviewData() {
        try {
            const response = await fetch(`${this.apiBase}/user/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Update UI with real data
                document.getElementById('data-used').textContent = `${data.usage?.used || 0} GB`;
                document.getElementById('data-limit').textContent = `${data.limits?.maxTrafficGB || 50} GB`;
            }
        } catch (error) {
            console.error('Failed to load overview data:', error);
        }
    }

    async loadDevices() {
        try {
            const container = document.getElementById('devices-container');
            if (!container) {
                console.error('devices-container not found!');
                return;
            }

            console.log('Loading devices from:', `${this.apiBase}/devices`);
            const response = await fetch(`${this.apiBase}/devices`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const devices = await response.json();
                console.log('Devices loaded:', devices.length, devices);
                
                if (devices.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 40px;">No devices yet. Click "Add Device" to get started!</p>';
                    return;
                }

                let html = `
                    <div class="devices-table">
                        <div class="devices-table-header">
                            <div>Device Name</div>
                            <div>Server</div>
                            <div>IP Address</div>
                            <div>Added</div>
                            <div>Actions</div>
                        </div>
                        ${devices.map(device => `
                            <div class="device-row">
                                <div><strong>${this.escapeHtml(device.deviceName)}</strong></div>
                                <div>${device.server?.location || 'N/A'}</div>
                                <div><code>${device.assignedIP || 'N/A'}</code></div>
                                <div>${new Date(device.createdAt).toLocaleDateString()}</div>
                                <div>
                                    <button class="btn btn-sm btn-primary" onclick="window.boldVPNPortal.downloadConfig(${device.id})" title="Download WireGuard config file">📥 Config</button>
                                    <button class="btn btn-sm btn-primary" onclick="window.boldVPNPortal.downloadQRCode(${device.id})" title="Download QR code for mobile setup">📱 QR Code</button>
                                    <button class="btn btn-sm btn-danger" onclick="window.boldVPNPortal.removeDevice(${device.id}, '${this.escapeHtml(device.deviceName)}')" title="Remove device">Remove</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                
                container.innerHTML = html;
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Failed to load devices:', response.status, errorData);
                container.innerHTML = `<p style="text-align: center; color: var(--error-color); padding: 40px;">Failed to load devices: ${errorData.error || 'Unknown error'}</p>`;
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
            const container = document.getElementById('devices-container');
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: var(--error-color); padding: 40px;">Network error loading devices</p>';
            }
        }
    }

    loadUsageHistory() {
        // Placeholder for usage chart
        const ctx = document.getElementById('usage-chart');
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
            type: 'line',
            data: {
                    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
                datasets: [{
                        label: 'Data Usage (GB)',
                        data: [2, 3, 5, 4, 6],
                        borderColor: '#0ea5e9',
                        tension: 0.3
                }]
            },
            options: {
                responsive: true,
                    maintainAspectRatio: true
            }
        });
    }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        const email = document.getElementById('profile-email').value;
        const messageDiv = document.getElementById('profile-message');

        try {
            const response = await fetch(`${this.apiBase}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                messageDiv.textContent = 'Profile updated successfully!';
                messageDiv.className = 'alert alert-success';
                messageDiv.style.display = 'block';
            } else {
                messageDiv.textContent = 'Failed to update profile';
                messageDiv.className = 'alert alert-error';
                messageDiv.style.display = 'block';
            }
        } catch (error) {
            messageDiv.textContent = 'Network error';
            messageDiv.className = 'alert alert-error';
            messageDiv.style.display = 'block';
        }
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        const current = document.getElementById('current-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirm = document.getElementById('confirm-password').value;
        const messageDiv = document.getElementById('password-message');

        if (newPass !== confirm) {
            messageDiv.textContent = 'Passwords do not match';
            messageDiv.className = 'alert alert-error';
            messageDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/user/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ currentPassword: current, newPassword: newPass })
            });

            if (response.ok) {
                messageDiv.textContent = 'Password changed successfully!';
                messageDiv.className = 'alert alert-success';
                messageDiv.style.display = 'block';
                document.getElementById('password-form').reset();
            } else {
                messageDiv.textContent = 'Failed to change password';
                messageDiv.className = 'alert alert-error';
                messageDiv.style.display = 'block';
            }
        } catch (error) {
            messageDiv.textContent = 'Network error';
            messageDiv.className = 'alert alert-error';
            messageDiv.style.display = 'block';
        }
    }

    addDevice() {
        console.log('addDevice() called');
        // Prevent multiple modals
        const existingModal = document.querySelector('.modal');
        if (existingModal) {
            console.log('Modal already exists, removing it first');
            existingModal.remove();
        }
        // Fetch available servers first
        try {
            this.showAddDeviceModal();
        } catch (error) {
            console.error('Error in addDevice:', error);
            alert('Error opening add device dialog. Please check console for details.');
        }
    }

    async showAddDeviceModal() {
        console.log('showAddDeviceModal() called');
        try {
            // Fetch servers
            const serversResponse = await fetch(`${this.apiBase}/servers`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            let allServers = [];
            if (serversResponse.ok) {
                allServers = await serversResponse.json();
                console.log('All servers loaded:', allServers.length);
            } else {
                console.warn('Failed to load servers:', serversResponse.status);
            }

            // Filter servers based on user plan
            const userPlan = this.user?.plan || 'basic';
            const isPremium = userPlan === 'premium' || userPlan === 'family';
            
            // Filter: show only available servers, and filter premium based on plan
            const servers = allServers.filter(server => {
                // Only show available servers
                if (!server.available && server.status !== 'active') {
                    return false;
                }
                // Basic users can't see premium servers
                if (!isPremium && server.isPremium) {
                    return false;
                }
                return true;
            });

            console.log('Filtered servers for', userPlan, 'plan:', servers.length);

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'modal-title');
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Add New Device</h3>
                        <button class="modal-close" type="button" aria-label="Close modal">&times;</button>
            </div>
                    <form id="add-device-form" class="auth-form">
                        <div class="form-group">
                            <label for="device-name">Device Name</label>
                            <input type="text" id="device-name" name="deviceName" required 
                                   placeholder="e.g., My Laptop, iPhone, etc." autofocus>
                        </div>
                        ${servers.length > 0 ? `
                        <div class="form-group">
                            <label for="device-server">Server Location</label>
                            <select id="device-server" name="serverId" required>
                                <option value="">Select a server</option>
                                ${servers.map(s => {
                                    // Use consistent format: Flag Country, City (ServerName)
                                    const flag = s.flag || '';
                                    const country = s.country || '';
                                    const city = s.city || '';
                                    const name = s.name || '';

                                    // Build location string
                                    let locationStr = '';
                                    if (flag && country && city) {
                                        locationStr = `${flag} ${country}, ${city}`;
                                    } else if (country && city) {
                                        locationStr = `${country}, ${city}`;
                                    } else if (name) {
                                        locationStr = name;
            } else {
                                        locationStr = 'Unknown Server';
                                    }

                                    // Always show server name in parentheses for clarity
                                    if (name) {
                                        locationStr += ` (${name})`;
                                    }

                                    const loadInfo = s.load !== undefined ? ` - ${s.load.toFixed(0)}% load` : '';
                                    const premiumBadge = s.isPremium ? ' ⭐' : '';
                                    return `<option value="${s.id}">${locationStr}${loadInfo}${premiumBadge}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        ` : `
                        <div class="alert alert-info">
                            No servers available. Please contact support.
                        </div>
                        `}
                        <div id="add-device-error" class="alert alert-error" style="display: none;"></div>
                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <!-- Use an explicit button type="button" to avoid native form submission
                                 and ensure we control the submit flow entirely via JS. -->
                            <button id="add-device-submit" type="button" class="btn btn-primary" style="flex: 1;" data-action="submit">
                                <span class="btn-text">Add Device</span>
                                <div class="spinner" style="display: none;"></div>
                            </button>
                            <button type="button" class="btn btn-secondary" id="cancel-add-device">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);
            console.log('Modal added to DOM', modal);
            console.log('Modal computed style:', window.getComputedStyle(modal).display);
            console.log('Modal z-index:', window.getComputedStyle(modal).zIndex);
            
            // Ensure modal is visible
            modal.style.display = 'flex';
            console.log('Modal display set to flex');
            
            // Force visibility
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';

            // Close handlers
            const closeModal = () => {
                console.log('Closing modal');
                modal.remove();
            };
            
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('#cancel-add-device').addEventListener('click', closeModal);
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Handle submit via an explicit button click handler. The submit button is
            // type="button" so the browser won't perform a native form submit or
            // reload the page unexpectedly.
            const form = document.getElementById('add-device-form');
            if (!form) {
                console.error('add-device-form not found!');
                return;
            }

            const submitButton = document.getElementById('add-device-submit');
            if (!submitButton) {
                console.error('add-device-submit button not found!');
                return;
            }

            // Remove any previous click handlers by replacing the button node
            const freshSubmit = submitButton.cloneNode(true);
            submitButton.parentNode.replaceChild(freshSubmit, submitButton);

            freshSubmit.addEventListener('click', async (e) => {
                console.log('Add Device button clicked - starting process');
                e.preventDefault();
                e.stopPropagation();
                // Immediate UI feedback and client-side validation
                const btnText = freshSubmit.querySelector('.btn-text');
                const spinner = freshSubmit.querySelector('.spinner');
                try {
                    // Client-side validation
                    const deviceName = form.querySelector('#device-name')?.value?.trim();
                    const serverId = form.querySelector('#device-server')?.value;
                    const errorDiv = document.getElementById('add-device-error');
                    if (!deviceName) {
                        if (errorDiv) { errorDiv.textContent = 'Please enter a device name.'; errorDiv.style.display = 'block'; }
                        return;
                    }
                    if (!serverId) {
                        if (errorDiv) { errorDiv.textContent = 'Please select a server location.'; errorDiv.style.display = 'block'; }
                        return;
                    }

                    if (btnText) btnText.style.display = 'none';
                    if (spinner) spinner.style.display = 'inline-block';
                    freshSubmit.disabled = true;

                    await this.handleAddDevice(e, form, modal);
                } catch (err) {
                    console.error('handleAddDevice ERROR:', err);
                    this.showAlert('Error adding device: ' + (err.message || 'Unknown'), 'error');
                } finally {
                    // restore immediate UI indicator (handleAddDevice will clear spinner too)
                    try { if (btnText) btnText.style.display = 'inline'; } catch (e) {}
                    try { if (spinner) spinner.style.display = 'none'; } catch (e) {}
                    freshSubmit.disabled = false;
                    document.removeEventListener('keydown', handleEscape);
                }
            });
        } catch (error) {
            console.error('Error showing add device modal:', error);
            this.showAlert('Failed to load server list. Please try again.', 'error');
        }
    }

    async handleAddDevice(e, form, modal) {
        console.log('%c ===== handleAddDevice START =====', 'background: purple; color: white; font-size: 14px;');
        console.log('Args:', { e, form, modal });
        
        if (!form) {
            form = e.target;
        }
        // Find the submit button. We used to rely on a <button type="submit"> but
        // the modal now uses an explicit button (type="button"). Accept either.
        let submitBtn = form.querySelector('button[type="submit"]');
        if (!submitBtn) {
            submitBtn = form.querySelector('#add-device-submit') || form.querySelector('button[data-action="submit"]');
        }

        if (!submitBtn) {
            console.warn('Submit button not found in form - proceeding without UI spinner controls');
        }

        const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
        const spinner = submitBtn ? submitBtn.querySelector('.spinner') : null;
        const errorDiv = document.getElementById('add-device-error');
        
        const deviceName = document.getElementById('device-name').value.trim();
        const serverId = document.getElementById('device-server')?.value;

        console.log('Form data:', { deviceName, serverId });
        console.log('API Base:', this.apiBase);
        console.log('Token:', this.token ? 'Present' : 'MISSING!');

        // Show loading state (if UI elements exist)
        try {
            if (submitBtn) submitBtn.classList.add('loading');
            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';
        } catch (err) {
            console.warn('Failed to set loading UI state:', err);
        }
        errorDiv.style.display = 'none';

        try {
            console.log('%c Calling API...', 'color: orange;');
            const response = await fetch(`${this.apiBase}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    deviceName,
                    serverId: parseInt(serverId)
                })
            });

            console.log('%c API Response received', 'color: green;', response.status, response.ok);
            const data = await response.json();
            console.log('%c Response data:', 'color: green;', data);

            if (response.ok) {
                console.log('✅ Device added successfully! Response:', data);
                console.log('Current section BEFORE device add success:', this.currentSection);
                
                // Mark that we just added a device to prevent navigation away
                this._justAddedDevice = true;
                console.log('Set _justAddedDevice flag to true');
                
                // Close modal first
                console.log('Closing modal...');
                try {
                    modal.style.display = 'none';
                    modal.remove();
                } catch (err) {
                    console.warn('Failed to remove modal DOM node:', err);
                }
                console.log('Modal closed');
                
                // Show success message
                this.showAlert('Device added successfully!', 'success');
                console.log('Success alert shown');
                
                // Ensure we're on devices section - force navigation
                console.log('About to navigate to devices. Current section:', this.currentSection);
                this.currentSection = 'devices'; // Set it explicitly first
                console.log('Set currentSection to devices, now calling navigateTo...');
                this.navigateTo('devices');
                console.log('✅ Navigation complete. Current section:', this.currentSection);
                
                // Force reload devices list after a short delay to ensure DOM is ready
                setTimeout(() => {
                    const devicesContainer = document.getElementById('devices-container');
                    if (devicesContainer) {
                        this.loadDevices();
                    } else {
                        console.error('devices-container not found after navigation!');
                    }
                    // Clear the flag after 2 seconds to allow normal navigation
                    setTimeout(() => {
                        this._justAddedDevice = false;
                        console.log('Cleared _justAddedDevice flag');
                    }, 2000);
                }, 200);
            } else {
                errorDiv.textContent = data.error || 'Failed to add device';
                errorDiv.style.display = 'block';
                console.error('Add device API returned error:', response.status, data);
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            console.error('Network error while adding device:', error);
        } finally {
            // Reset loading state
            try {
                if (submitBtn) submitBtn.classList.remove('loading');
                if (btnText) btnText.style.display = 'inline';
                if (spinner) spinner.style.display = 'none';
            } catch (err) {
                console.warn('Failed to reset loading UI state:', err);
            }
        }
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.position = 'fixed';
        alert.style.top = '80px';
        alert.style.right = '20px';
        alert.style.zIndex = '1001';
        alert.style.minWidth = '300px';
        alert.style.animation = 'slideUp 0.3s ease';
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.3s';
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    async downloadConfig(deviceId) {
        try {
            const response = await fetch(`${this.apiBase}/devices/${deviceId}/config`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'wireguard-config.conf';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                this.showAlert('Configuration downloaded successfully', 'success');
        } else {
                this.showAlert('Failed to download configuration', 'error');
            }
        } catch (error) {
            console.error('Download error:', error);
            this.showAlert('Network error. Please try again.', 'error');
        }
    }

    async downloadQRCode(deviceId) {
        try {
            const response = await fetch(`${this.apiBase}/devices/${deviceId}/qrcode`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wireguard-qrcode-${deviceId}.png`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                this.showAlert('QR code downloaded successfully', 'success');
        } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                this.showAlert(errorData.error || 'Failed to download QR code', 'error');
            }
        } catch (error) {
            console.error('QR code download error:', error);
            this.showAlert('Network error. Please try again.', 'error');
        }
    }

    async removeDevice(deviceId, deviceName) {
        if (!confirm(`Remove device "${deviceName}"? This action cannot be undone.`)) return;

        try {
            const response = await fetch(`${this.apiBase}/devices/${deviceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();

            if (response.ok) {
                if (data.opnsenseRemoved === false) {
                    // OPNsense removal failed but device was removed from database
                    this.showAlert(`Device removed from database. ${data.warning || data.message || 'Peer may still exist in OPNsense.'}`, 'warning');
                } else {
                    this.showAlert(data.message || 'Device removed successfully', 'success');
                }
                
                this.loadDevices();
            } else {
                // API returned error (likely OPNsense removal failed)
                const errorMsg = data.message || data.error || 'Failed to remove device';
                this.showAlert(errorMsg, 'error');
                // Still refresh to show updated state
                this.loadDevices();
            }
        } catch (error) {
            console.error('Remove error:', error);
            this.showAlert('Network error. Please try again.', 'error');
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem(this.tokenKey);
        sessionStorage.removeItem(this.tokenKey);
        this.showLogin();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.boldVPNPortal = new BoldVPNPortal();
});

