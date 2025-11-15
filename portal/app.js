// portal/app.js
import { api } from './api.js';

class BoldVPNPortal {
    constructor() {
        this.tokenKey = 'boldvpn_token';
        this.token = localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
        this.user = null;
        this.currentSection = 'overview';
        this._navHistory = [];

        this._lastActionTime = {};
        this._actionDebounceMs = 500; // 500ms debounce

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
        authContainer.innerHTML = ''; // Clear previous content
        const template = document.getElementById('login-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            authContainer.appendChild(clonedContent);
            document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        } else {
            console.error('Login template not found!');
        }
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
        document.getElementById('portal-container').style.display = 'grid'; // Use grid for portal layout

        this.bindNavigationEvents();
        this.navigateTo('overview');
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

        switch (section) {
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
        container.innerHTML = ''; // Clear previous content
        const template = document.getElementById('overview-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            // Update dynamic content before appending
            const usernameSpan = clonedContent.querySelector('#overview-username');
            if (usernameSpan) usernameSpan.textContent = this.user?.username || 'User';
            const planSpan = clonedContent.querySelector('#subscription-plan');
            if (planSpan) planSpan.textContent = this.user?.plan || 'Basic';

            container.appendChild(clonedContent);
            this.loadOverviewData();
        } else {
            console.error('Overview template not found!');
        }
    }

    renderDevices(container) {
        container.innerHTML = ''; // Clear previous content
        const template = document.getElementById('devices-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            container.appendChild(clonedContent);

            // Bind button events
            const refreshBtn = document.getElementById('refresh-devices-btn');
            const addBtn = document.getElementById('add-device-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.loadDevices());
            }
            if (addBtn) {
                addBtn.addEventListener('click', () => this.addDevice());
            }

            // Setup device action event listener on the container
            const devicesContainer = document.getElementById('devices-container');
            if (devicesContainer) {
                // Remove old listener if it exists
                if (this._deviceActionListener) {
                    devicesContainer.removeEventListener('click', this._deviceActionListener);
                }
                this._deviceActionListener = (e) => {
                    const target = e.target.closest('button[data-action]');
                    if (!target) return;
                    const { deviceId, deviceName, action } = target.dataset;
                    if (!deviceId || !action) return;
                    // Debounce rapid clicks
                    const actionKey = `${deviceId}-${action}`;
                    const now = Date.now();
                    if (this._lastActionTime[actionKey] && (now - this._lastActionTime[actionKey]) < this._actionDebounceMs) {
                        return; // Ignore rapid clicks
                    }
                    this._lastActionTime[actionKey] = now;
                    if (action === 'config') {
                        this.downloadConfig(deviceId);
                    } else if (action === 'qr') {
                        this.downloadQRCode(deviceId);
                    } else if (action === 'remove') {
                        this.removeDevice(deviceId, deviceName);
                    }
                };
                devicesContainer.addEventListener('click', this._deviceActionListener);
            }

            this.loadDevices();
        } else {
            console.error('Devices template not found!');
        }
    }

    renderUsage(container) {
        container.innerHTML = ''; // Clear previous content
        const template = document.getElementById('usage-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            container.appendChild(clonedContent);
            this.loadUsageHistory();
        } else {
            console.error('Usage template not found!');
        }
    }

    renderProfile(container) {
        container.innerHTML = ''; // Clear previous content
        const template = document.getElementById('profile-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            // Update dynamic content before appending
            const usernameInput = clonedContent.querySelector('#profile-username');
            if (usernameInput) usernameInput.value = this.user?.username || '';
            const emailInput = clonedContent.querySelector('#profile-email');
            if (emailInput) emailInput.value = this.user?.email || '';

            container.appendChild(clonedContent);
            document.getElementById('profile-form').addEventListener('submit', (e) => this.handleProfileUpdate(e));
        } else {
            console.error('Profile template not found!');
        }
    }

    renderPassword(container) {
        container.innerHTML = ''; // Clear previous content
        const template = document.getElementById('password-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            container.appendChild(clonedContent);
            document.getElementById('password-form').addEventListener('submit', (e) => this.handlePasswordChange(e));
        } else {
            console.error('Password template not found!');
        }
    }

    renderBilling(container) {
        container.innerHTML = ''; // Clear previous content
        const template = document.getElementById('billing-template');
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            // Update dynamic content before appending
            const planSpan = clonedContent.querySelector('#billing-plan');
            if (planSpan) planSpan.textContent = this.user?.plan || 'Basic';

            container.appendChild(clonedContent);
        } else {
            console.error('Billing template not found!');
        }
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
        if (!container) return;

        // Show loading state
        container.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 40px;">Loading devices...</p>';

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

            // Re-attach listener after innerHTML update
            if (this._deviceActionListener) {
                container.removeEventListener('click', this._deviceActionListener);
                container.addEventListener('click', this._deviceActionListener);
            }
        } catch (error) {
            let errorMessage = 'Failed to load devices. ';
            if (error.message.includes('Network')) {
                errorMessage += 'Please check your internet connection.';
            } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage += 'Your session has expired. Please log in again.';
                setTimeout(() => this.logout(), 2000);
            } else if (error.message.includes('500')) {
                errorMessage += 'Server error. Please try again later.';
            } else {
                errorMessage += error.message || 'Please try again.';
            }
            container.innerHTML = `<p style="text-align: center; color: var(--error-color); padding: 40px;">${this.escapeHtml(errorMessage)}</p>`;
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
            // Get user profile to check plan_tier
            const profile = await api.user.getProfile();
            const planTier = profile.user.planTier || profile.user.plan?.toLowerCase() || 'free';
            const isPremium = planTier === 'premium' || planTier === 'family';

            const allServers = await api.servers.getAll();

            // Filter only by availability and status - show ALL servers
            const servers = allServers.filter(server => {
                return server.available && server.status === 'active';
            });

            if (servers.length === 0) {
                this.showAlert('No servers available. Please contact support.', 'error');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header"><h3 id="modal-title">Add New Device</h3><button class="modal-close" type="button" aria-label="Close modal"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
                    <form id="add-device-form" class="auth-form">
                        <div class="form-group"><label for="device-name">Device Name</label><input type="text" id="device-name" name="deviceName" required placeholder="e.g., My Laptop, iPhone, etc." autofocus></div>
                        <div class="form-group"><label for="device-server">Server Location</label><select id="device-server" name="serverId" required><option value="">Select a server</option>${servers.map(s => {
                const premiumBadge = s.isPremium ? ' ⭐' : '';
                const displayName = `${s.location}, ${s.name}${premiumBadge}`;
                // Disable premium servers for non-premium users
                const disabled = !isPremium && s.isPremium ? 'disabled' : '';
                const premiumText = !isPremium && s.isPremium ? ' (Premium Only)' : '';
                return `<option value="${s.id}" ${disabled}>${displayName}${premiumText}</option>`;
            }).join('')}</select></div>
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
                const serverSelect = document.getElementById('device-server');
                const serverId = serverSelect.value;
                const selectedOption = serverSelect.options[serverSelect.selectedIndex];
                const errorDiv = document.getElementById('add-device-error');

                if (!deviceName || !serverId) {
                    errorDiv.textContent = 'Please fill in all fields.';
                    errorDiv.style.display = 'block';
                    return;
                }

                // Validate device name
                if (deviceName.length < 3 || deviceName.length > 50) {
                    errorDiv.textContent = 'Device name must be between 3 and 50 characters.';
                    errorDiv.style.display = 'block';
                    return;
                }
                // Allow only alphanumeric, dash, underscore
                if (!/^[a-zA-Z0-9_-]+$/.test(deviceName)) {
                    errorDiv.textContent = 'Device name can only contain letters, numbers, dashes, and underscores.';
                    errorDiv.style.display = 'block';
                    return;
                }

                // Client-side validation: prevent selecting disabled premium servers
                if (selectedOption.disabled) {
                    errorDiv.textContent = 'Premium servers are only available for Premium or Family plan users. Please upgrade your plan.';
                    errorDiv.style.display = 'block';
                    return;
                }

                try {
                    await api.devices.create(deviceName, serverId);
                    closeModal();
                    this.showAlert('Device added successfully!', 'success');
                    this.loadDevices();
                } catch (error) {
                    console.error('Device creation error:', error);
                    errorDiv.textContent = error.message || 'Failed to add device. Please try again.';
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
        if (!confirm(`Remove device "${deviceName}"? This action cannot be undone.`)) {
            return;
        }

        // Find and disable the remove button
        const removeBtn = document.querySelector(`button[data-device-id="${deviceId}"][data-action="remove"]`);
        if (removeBtn) {
            removeBtn.disabled = true;
            removeBtn.textContent = 'Removing...';
        }

        try {
            const data = await api.devices.remove(deviceId);
            if (data.opnsenseRemoved === false) {
                this.showAlert(data.warning || data.message || 'Peer may still exist in OPNsense.', 'warning');
            } else {
                this.showAlert(data.message || 'Device removed successfully', 'success');
            }
            this.loadDevices();
        } catch (error) {
            console.error('Remove device error:', error);
            this.showAlert(error.message || 'Failed to remove device', 'error');
            this.loadDevices();
        } finally {
            // Re-enable button if still exists (device wasn't removed from DOM yet)
            if (removeBtn && removeBtn.parentElement) {
                removeBtn.disabled = false;
                removeBtn.textContent = 'Remove';
            }
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

new BoldVPNPortal();

















