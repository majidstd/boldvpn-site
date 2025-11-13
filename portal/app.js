// portal/app.js
import { api } from './api.js';

class BoldVPNPortal {
    constructor() {
        this.tokenKey = 'boldvpn_token';
        this.token = localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
        this.user = null;
        this.currentSection = 'overview';
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
            const data = await api.auth.verify();
            this.user = data.user;
            this.showDashboard();
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

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner"></div> Signing in...';

        try {
            const data = await api.auth.login(username, password);
            this.token = data.token;
            this.user = data.user;
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem(this.tokenKey, this.token);
            this.showDashboard();
        } catch (error) {
            errorDiv.textContent = error.message || 'Login failed';
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
                <aside class="portal-sidebar">
                    <div class="sidebar-header">
                        <div class="user-info">
                            <h3 id="sidebar-username">${this.user?.username || 'User'}</h3>
                            <p id="sidebar-plan">${this.user?.plan || 'Basic'} Plan</p>
                        </div>
                    </div>
                    <nav class="sidebar-nav">
                        <button class="nav-item active" data-section="overview"><span>📊</span> Overview</button>
                        <button class="nav-item" data-section="devices"><span>📱</span> Manage Devices</button>
                        <button class="nav-item" data-section="usage"><span>📈</span> Usage History</button>
                        <button class="nav-item" data-section="profile"><span>👤</span> Profile Settings</button>
                        <button class="nav-item" data-section="password"><span>🔒</span> Change Password</button>
                        <button class="nav-item" data-section="billing"><span>💳</span> Billing & Plans</button>
                    </nav>
                    <div class="sidebar-footer">
                        <button id="logout-btn" class="btn btn-secondary">Logout</button>
                    </div>
                </aside>
                <main class="portal-content">
                    <div id="content-area"></div>
                </main>
            </div>
        `;
    }

    bindNavigationEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => this.navigateTo(btn.dataset.section));
        });
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    navigateTo(section) {
        this.currentSection = section;
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            console.error('Content area not found!');
            return;
        }
        
        switch(section) {
            case 'overview': this.renderOverview(contentArea); break;
            case 'devices': this.renderDevices(contentArea); break;
            case 'usage': this.renderUsage(contentArea); break;
            case 'profile': this.renderProfile(contentArea); break;
            case 'password': this.renderPassword(contentArea); break;
            case 'billing': this.renderBilling(contentArea); break;
            default: console.error('Unknown section:', section);
        }
    }

    renderOverview(container) {
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header"><h2>Welcome back, ${this.user?.username || 'User'}!</h2></div>
                <div class="dashboard-grid">
                    <div class="dashboard-card"><h3>📊 Data Usage</h3><div class="usage-stats"><div class="usage-item"><span class="usage-label">Used:</span><span class="usage-value" id="data-used">Loading...</span></div><div class="usage-item"><span class="usage-label">Limit:</span><span class="usage-value" id="data-limit">Loading...</span></div><div class="usage-progress"><div class="progress-bar" id="data-progress" style="width: 0%"></div></div></div></div>
                    <div class="dashboard-card"><h3>⚡ Connection Speed</h3><div class="speed-stats"><div class="speed-item"><span class="speed-label">Download:</span><span class="speed-value" id="speed-down">Loading...</span></div><div class="speed-item"><span class="speed-label">Upload:</span><span class="speed-value" id="speed-up">Loading...</span></div></div></div>
                    <div class="dashboard-card"><h3>📱 Connected Devices</h3><div class="devices-stats"><div class="devices-count"><span class="devices-number" id="devices-count">0</span><span class="devices-label">Devices</span></div><div class="devices-limit"><span>of <span id="devices-limit">--</span> allowed</span></div></div></div>
                    <div class="dashboard-card"><h3>✓ Subscription Status</h3><div class="subscription-info"><p><strong>Status:</strong> <span id="subscription-status" class="status-active">Active</span></p><p><strong>Plan:</strong> <span id="subscription-plan">${this.user?.plan || 'Basic'}</span></p></div></div>
                </div>
            </div>
        `;
        this.loadOverviewData();
    }

    renderDevices(container) {
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header">
                    <h2>Manage Devices</h2>
                    <div style="display: flex; gap: 10px;">
                        <button id="refresh-devices-btn" class="btn btn-primary" type="button">🔄 Refresh</button>
                        <button id="add-device-btn" class="btn btn-primary" type="button">+ Add Device</button>
                    </div>
                </div>
                <div id="devices-container"><p style="text-align: center; color: var(--muted); padding: 40px;">Loading devices...</p></div>
            </div>
        `;
        document.getElementById('refresh-devices-btn').addEventListener('click', () => this.loadDevices());
        document.getElementById('add-device-btn').addEventListener('click', () => this.addDevice());
        this.loadDevices();
    }

    renderUsage(container) {
        container.innerHTML = `
            <div class="unified-container">
                <div class="section-header"><h2>Usage History</h2></div>
                <h3>Data Usage (Last 30 Days)</h3>
                <canvas id="usage-chart" style="max-height: 400px;"></canvas>
            </div>
        `;
        this.loadUsageHistory();
    }

    renderProfile(container) {
        container.innerHTML = `
            <div class="unified-container form-container">
                <div class="section-header"><h2>Profile Settings</h2></div>
                <form id="profile-form" class="auth-form">
                    <div class="form-group"><label for="profile-username">Username</label><input type="text" id="profile-username" value="${this.user?.username || ''}" disabled></div>
                    <div class="form-group"><label for="profile-email">Email</label><input type="email" id="profile-email" value="${this.user?.email || ''}" required></div>
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
                <div class="section-header"><h2>Change Password</h2></div>
                <form id="password-form" class="auth-form">
                    <div class="form-group"><label for="current-password">Current Password</label><input type="password" id="current-password" required></div>
                    <div class="form-group"><label for="new-password">New Password</label><input type="password" id="new-password" required></div>
                    <div class="form-group"><label for="confirm-password">Confirm New Password</label><input type="password" id="confirm-password" required></div>
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
                <div class="section-header"><h2>Billing & Plans</h2></div>
                <div class="dashboard-grid">
                    <div class="dashboard-card"><h3>Current Plan</h3><p><strong>Plan:</strong> ${this.user?.plan || 'Basic'}</p><p><strong>Status:</strong> <span class="status-active">Active</span></p><button class="btn btn-primary" style="margin-top: 10px;">Upgrade Plan</button></div>
                    <div class="dashboard-card"><h3>Billing History</h3><p style="color: var(--muted);">No billing history available.</p></div>
                </div>
            </div>
        `;
    }

    async loadOverviewData() {
        try {
            const data = await api.user.getProfile();
            document.getElementById('data-used').textContent = `${data.usage?.used || 0} GB`;
            document.getElementById('data-limit').textContent = `${data.limits?.maxTrafficGB || 50} GB`;
        } catch (error) {
            console.error('Failed to load overview data:', error);
        }
    }

    async loadDevices() {
        const container = document.getElementById('devices-container');
        try {
            const devices = await api.devices.getAll();
            if (devices.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 40px;">No devices yet. Click "Add Device" to get started!</p>';
                return;
            }
            container.innerHTML = `
                <div class="devices-table">
                    <div class="devices-table-header">
                        <div>Device Name</div><div>Server</div><div>IP Address</div><div>Added</div><div>Actions</div>
                    </div>
                    ${devices.map(device => `
                        <div class="device-row">
                            <div><strong>${this.escapeHtml(device.deviceName)}</strong></div>
                            <div>${device.server?.location || 'N/A'}</div>
                            <div><code>${device.assignedIP || 'N/A'}</code></div>
                            <div>${new Date(device.createdAt).toLocaleDateString()}</div>
                            <div>
                                <button class="btn btn-sm btn-primary" data-device-id="${device.id}" data-action="config">📥 Config</button>
                                <button class="btn btn-sm btn-primary" data-device-id="${device.id}" data-action="qr">📱 QR Code</button>
                                <button class="btn btn-sm btn-danger" data-device-id="${device.id}" data-device-name="${this.escapeHtml(device.deviceName)}" data-action="remove">Remove</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;
                const { deviceId, deviceName, action } = target.dataset;
                if (action === 'config') this.downloadConfig(deviceId);
                if (action === 'qr') this.downloadQRCode(deviceId);
                if (action === 'remove') this.removeDevice(deviceId, deviceName);
            });
        } catch (error) {
            container.innerHTML = `<p style="text-align: center; color: var(--error-color); padding: 40px;">Failed to load devices: ${error.message}</p>`;
        }
    }

    loadUsageHistory() {
        const ctx = document.getElementById('usage-chart');
        if (ctx && typeof Chart !== 'undefined') {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
                    datasets: [{ label: 'Data Usage (GB)', data: [2, 3, 5, 4, 6], borderColor: '#0ea5e9', tension: 0.3 }]
                },
                options: { responsive: true, maintainAspectRatio: true }
            });
        }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        const email = document.getElementById('profile-email').value;
        const messageDiv = document.getElementById('profile-message');
        try {
            await api.user.updateProfile(email);
            messageDiv.textContent = 'Profile updated successfully!';
            messageDiv.className = 'alert alert-success';
        } catch (error) {
            messageDiv.textContent = error.message || 'Failed to update profile';
            messageDiv.className = 'alert alert-error';
        }
        messageDiv.style.display = 'block';
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
            await api.user.changePassword(current, newPass);
            messageDiv.textContent = 'Password changed successfully!';
            messageDiv.className = 'alert alert-success';
            document.getElementById('password-form').reset();
        } catch (error) {
            messageDiv.textContent = error.message || 'Failed to change password';
            messageDiv.className = 'alert alert-error';
        }
        messageDiv.style.display = 'block';
    }

    addDevice() {
        this.showAddDeviceModal();
    }

    async showAddDeviceModal() {
        const existingModal = document.querySelector('.modal');
        if (existingModal) existingModal.remove();

        try {
            const servers = await api.servers.getAll();
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header"><h3 id="modal-title">Add New Device</h3><button class="modal-close" type="button" aria-label="Close modal"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
                    <form id="add-device-form" class="auth-form">
                        <div class="form-group"><label for="device-name">Device Name</label><input type="text" id="device-name" name="deviceName" required placeholder="e.g., My Laptop, iPhone, etc." autofocus></div>
                        <div class="form-group"><label for="device-server">Server Location</label><select id="device-server" name="serverId" required><option value="">Select a server</option>${servers.map(s => `<option value="${s.id}">${s.location}</option>`).join('')}</select></div>
                        <div id="add-device-error" class="alert alert-error" style="display: none;"></div>
                        <div style="display: flex; gap: 12px; margin-top: 8px;"><button id="add-device-submit" type="button" class="btn btn-primary" style="flex: 1;"><span class="btn-text">Add Device</span><div class="spinner" style="display: none;"></div></button><button type="button" class="btn btn-secondary" id="cancel-add-device">Cancel</button></div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
            modal.style.display = 'flex';

            const closeModal = () => modal.remove();
            modal.querySelector('.modal-close').addEventListener('click', closeModal);
            modal.querySelector('#cancel-add-device').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { once: true });

            document.getElementById('add-device-submit').addEventListener('click', async () => {
                const deviceName = document.getElementById('device-name').value.trim();
                const serverId = document.getElementById('device-server').value;
                const errorDiv = document.getElementById('add-device-error');
                if (!deviceName || !serverId) {
                    errorDiv.textContent = 'Please fill in all fields.';
                    errorDiv.style.display = 'block';
                    return;
                }
                try {
                    await api.devices.create(deviceName, serverId);
                    closeModal();
                    this.showAlert('Device added successfully!', 'success');
                    this.loadDevices();
                } catch (error) {
                    errorDiv.textContent = error.message || 'Failed to add device';
                    errorDiv.style.display = 'block';
                }
            });
        } catch (error) {
            this.showAlert('Failed to load server list. Please try again.', 'error');
        }
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 1001; min-width: 300px; animation: fadeIn 0.3s ease; text-align: center;';
        document.body.appendChild(alert);
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.3s';
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    async downloadConfig(deviceId) {
        try {
            const response = await api.devices.getConfig(deviceId);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'wireguard-config.conf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            this.showAlert('Configuration downloaded successfully', 'success');
        } catch (error) {
            this.showAlert('Failed to download configuration', 'error');
        }
    }

    async downloadQRCode(deviceId) {
        try {
            const response = await api.devices.getQRCode(deviceId);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wireguard-qrcode-${deviceId}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            this.showAlert('QR code downloaded successfully', 'success');
        } catch (error) {
            this.showAlert(error.message || 'Failed to download QR code', 'error');
        }
    }

    async removeDevice(deviceId, deviceName) {
        if (!confirm(`Remove device "${deviceName}"? This action cannot be undone.`)) return;
        try {
            const data = await api.devices.remove(deviceId);
            if (data.opnsenseRemoved === false) {
                this.showAlert(data.warning || data.message || 'Peer may still exist in OPNsense.', 'warning');
            } else {
                this.showAlert(data.message || 'Device removed successfully', 'success');
            }
            this.loadDevices();
        } catch (error) {
            this.showAlert(error.message || 'Failed to remove device', 'error');
            this.loadDevices();
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

window.boldVPNPortal = new BoldVPNPortal();