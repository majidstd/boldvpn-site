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
        document.getElementById('portal-container').style.display = 'grid';
        
        this.renderDashboardStructure();
        this.bindNavigationEvents();
        this.navigateTo('overview');
    }

    renderDashboardStructure() {
        const portalContainer = document.getElementById('portal-container');
        portalContainer.innerHTML = `
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
        `;
    }

    bindNavigationEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.getAttribute('data-section');
                this.navigateTo(section);
            });
        });

        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    navigateTo(section) {
        this.currentSection = section;

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Render content
        const contentArea = document.getElementById('content-area');
        
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
        }
    }

    renderOverview(container) {
        container.innerHTML = `
            <div class="content-section">
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
        container.innerHTML = `
            <div class="content-section">
                <div class="section-header">
                    <h2>Manage Devices</h2>
                    <button id="add-device-btn" class="btn btn-primary">+ Add Device</button>
                </div>

                <div class="content-container">
                    <div id="devices-container">
                        <p style="text-align: center; color: var(--muted); padding: 40px;">
                            Loading devices...
                        </p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('add-device-btn').addEventListener('click', () => this.addDevice());
        this.loadDevices();
    }

    renderUsage(container) {
        container.innerHTML = `
            <div class="content-section">
                <div class="section-header">
                    <h2>Usage History</h2>
                </div>

                <div class="content-container">
                    <h3>Data Usage (Last 30 Days)</h3>
                    <canvas id="usage-chart" style="max-height: 400px;"></canvas>
                </div>
            </div>
        `;

        this.loadUsageHistory();
    }

    renderProfile(container) {
        container.innerHTML = `
            <div class="content-section">
                <div class="section-header">
                    <h2>Profile Settings</h2>
                </div>

                <div class="content-container form-container">
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
            </div>
        `;

        document.getElementById('profile-form').addEventListener('submit', (e) => this.handleProfileUpdate(e));
    }

    renderPassword(container) {
        container.innerHTML = `
            <div class="content-section">
                <div class="section-header">
                    <h2>Change Password</h2>
                </div>

                <div class="content-container form-container">
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
            </div>
        `;

        document.getElementById('password-form').addEventListener('submit', (e) => this.handlePasswordChange(e));
    }

    renderBilling(container) {
        container.innerHTML = `
            <div class="content-section">
                <div class="section-header">
                    <h2>Billing & Plans</h2>
                </div>

                <div class="content-container">
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
            const response = await fetch(`${this.apiBase}/devices`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            const container = document.getElementById('devices-container');
            
            if (response.ok) {
                const devices = await response.json();
                
                if (devices.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 40px;">No devices yet. Click "Add Device" to get started!</p>';
                    return;
                }

                container.innerHTML = `
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
                                    <button class="btn btn-sm btn-primary" onclick="boldVPNPortal.downloadConfig(${device.id})">Download</button>
                                    <button class="btn btn-sm btn-danger" onclick="boldVPNPortal.removeDevice(${device.id}, '${this.escapeHtml(device.deviceName)}')">Remove</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = '<p style="text-align: center; color: var(--error-color); padding: 40px;">Failed to load devices</p>';
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
            document.getElementById('devices-container').innerHTML = '<p style="text-align: center; color: var(--error-color); padding: 40px;">Network error loading devices</p>';
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
        // Fetch available servers first
        this.showAddDeviceModal();
    }

    async showAddDeviceModal() {
        try {
            // Fetch servers
            const serversResponse = await fetch(`${this.apiBase}/servers`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            let servers = [];
            if (serversResponse.ok) {
                servers = await serversResponse.json();
            }

            // Create modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Add New Device</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <form id="add-device-form" class="auth-form">
                        <div class="form-group">
                            <label for="device-name">Device Name</label>
                            <input type="text" id="device-name" name="deviceName" required 
                                   placeholder="e.g., My Laptop, iPhone, etc.">
                        </div>
                        ${servers.length > 0 ? `
                        <div class="form-group">
                            <label for="device-server">Server Location</label>
                            <select id="device-server" name="serverId" required>
                                <option value="">Select a server</option>
                                ${servers.map(s => `
                                    <option value="${s.id}">${s.location || s.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        ` : ''}
                        <div id="add-device-error" class="alert alert-error" style="display: none;"></div>
                        <div style="display: flex; gap: 12px; margin-top: 8px;">
                            <button type="submit" class="btn btn-primary" style="flex: 1;">
                                <span class="btn-text">Add Device</span>
                                <div class="spinner" style="display: none;"></div>
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            // Handle form submission
            document.getElementById('add-device-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleAddDevice(e, modal);
            });
        } catch (error) {
            console.error('Error showing add device modal:', error);
            this.showAlert('Failed to load server list. Please try again.', 'error');
        }
    }

    async handleAddDevice(e, modal) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const spinner = submitBtn.querySelector('.spinner');
        const errorDiv = document.getElementById('add-device-error');
        
        const deviceName = document.getElementById('device-name').value.trim();
        const serverId = document.getElementById('device-server')?.value;

        // Show loading state
        submitBtn.classList.add('loading');
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';
        errorDiv.style.display = 'none';

        try {
            const response = await fetch(`${this.apiBase}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    deviceName,
                    serverId: serverId || undefined
                })
            });

            const data = await response.json();

            if (response.ok) {
                modal.remove();
                // Show success message
                this.showAlert('Device added successfully!', 'success');
                // Reload devices list
                if (this.currentSection === 'devices') {
                    this.loadDevices();
                } else {
                    this.navigateTo('devices');
                }
            } else {
                errorDiv.textContent = data.error || 'Failed to add device';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        } finally {
            // Reset loading state
            submitBtn.classList.remove('loading');
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
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

    async removeDevice(deviceId, deviceName) {
        if (!confirm(`Remove device "${deviceName}"? This action cannot be undone.`)) return;

        try {
            const response = await fetch(`${this.apiBase}/devices/${deviceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.showAlert('Device removed successfully', 'success');
                this.loadDevices();
            } else {
                const data = await response.json();
                this.showAlert(data.error || 'Failed to remove device', 'error');
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
