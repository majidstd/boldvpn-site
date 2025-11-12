// BoldVPN Customer Portal JavaScript
// Single-page application for account management

class BoldVPNPortal {
    constructor() {
        this.apiBase = (typeof Config !== 'undefined' && Config.API_URL) 
            ? Config.API_URL 
            : 'http://localhost:3000/api';
        this.tokenKey = (typeof Config !== 'undefined' && Config.TOKEN_KEY)
            ? Config.TOKEN_KEY
            : 'boldvpn_token';
        this.token = localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
        this.user = null;
        this.refreshInterval = null;
        this.usageChart = null; // To store the Chart.js instance

        this.init();
    }

    init() {
        this.checkAuth();
    }

    // === Core Navigation and Rendering ===
    bindNavEvents() {
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (link.id === 'nav-logout') {
                    this.logout();
                    return;
                }
                const section = link.dataset.section;
                this.navigateTo(section);
            });
        });
    }

    navigateTo(section) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const activeLink = document.querySelector(`a[data-section="${section}"]`);
        if (activeLink) activeLink.classList.add('active');

        this.renderSection(section);
    }

    renderSection(section) {
        const contentArea = document.getElementById('portal-content');
        contentArea.innerHTML = ''; // Clear previous content
        const templateId = `${section}-template`;
        const template = document.getElementById(templateId);
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            contentArea.appendChild(clonedContent);
            
            // Call load functions for the specific section
            if (section === 'dashboard') {
                this.loadDashboardData();
            } else if (section === 'devices') {
                this.loadDevices();
            } else if (section === 'billing') {
                this.loadBillingData();
            } else if (section === 'profile') {
                this.loadProfileData();
            }
        } else {
            contentArea.innerHTML = `<div class="dashboard-card"><h2>Section not found</h2><p>The section "${section}" does not have a valid template.</p></div>`;
        }
    }

    renderAuth(templateId) {
        const authContainer = document.getElementById('auth-container');
        authContainer.innerHTML = '';
        const template = document.getElementById(templateId);
        if (template) {
            const clonedContent = template.content.cloneNode(true);
            authContainer.appendChild(clonedContent);
            this.bindAuthEvents(templateId); // Bind events for the newly rendered auth form
        }
    }

    bindAuthEvents(templateId) {
        if (templateId === 'login-template') {
            document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
            document.getElementById('register-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('register-template'); });
            document.getElementById('forgot-password-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('forgot-password-template'); });
        } else if (templateId === 'register-template') {
            document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
            document.getElementById('login-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('login-template'); });
        } else if (templateId === 'forgot-password-template') {
            document.getElementById('forgot-password-form').addEventListener('submit', (e) => this.handleForgotPasswordRequest(e));
            document.getElementById('forgot-to-login-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('login-template'); });
        } else if (templateId === 'reset-password-confirm-template') {
            document.getElementById('reset-password-confirm-form').addEventListener('submit', (e) => this.handlePasswordResetConfirm(e));
            document.getElementById('reset-to-login-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('login-template'); });
        }
    }

    checkAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('token');

        if (resetToken) {
            this.renderAuth('reset-password-confirm-template');
            document.getElementById('reset-token').value = resetToken;
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (this.token) {
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
                this.showPortal();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            this.logout();
        }
    }

    showLogin() {
        document.getElementById('portal-container').style.display = 'none';
        document.getElementById('auth-header').style.display = 'block';
        const authContainer = document.getElementById('auth-container');
        authContainer.style.display = 'flex';
        this.renderAuth('login-template');
        document.body.classList.add('auth');
        document.body.classList.remove('portal-page');
    }

    showPortal() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('auth-header').style.display = 'none';
        document.getElementById('portal-container').style.display = 'grid';
        document.body.classList.remove('auth');
        document.body.classList.add('portal-page');
        
        this.bindNavEvents();

        if (this.user) {
            const usernameEl = document.getElementById('sidebar-username');
            const planEl = document.getElementById('sidebar-plan');
            if(usernameEl) usernameEl.textContent = this.user.username;
            if(planEl) planEl.textContent = this.user.plan;
        }

        this.navigateTo('dashboard');
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        const errorDiv = document.getElementById('login-error');

        this.setLoading('login-btn', true);
        this.clearErrors('login-form');

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                signal: AbortSignal.timeout(30000)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem(this.tokenKey, this.token);
                this.showPortal();
            } else {
                this.showError('login-error', data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('login-error', 'Network error. Please try again.');
        } finally {
            this.setLoading('login-btn', false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const plan = document.getElementById('reg-plan').value;
        const termsAccepted = document.getElementById('reg-terms').checked;

        this.setLoading('register-btn', true);
        this.clearErrors('register-form');

        if (password !== confirmPassword) {
            this.showFieldError('reg-confirm-password-error', 'Passwords do not match');
            this.setLoading('register-btn', false);
            return;
        }

        if (!termsAccepted) {
            this.showFieldError('reg-terms-error', 'You must accept the terms and conditions');
            this.setLoading('register-btn', false);
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, plan })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem(this.tokenKey, this.token);
                this.showPortal();
                this.showAlert('Registration successful! Welcome to BoldVPN.', 'success');
            } else {
                this.showError('register-error', data.error || 'Registration failed');
                if (data.details) {
                    data.details.forEach(detail => {
                        const fieldId = `reg-${detail.path}-error`;
                        this.showFieldError(fieldId, detail.msg);
                    });
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('register-error', 'Network error. Please try again.');
        } finally {
            this.setLoading('register-btn', false);
        }
    }

    async handleForgotPasswordRequest(e) {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value;

        this.setLoading('forgot-password-btn', true);
        this.clearErrors('forgot-password-form');
        this.hideAlert('forgot-password-message');

        try {
            const response = await fetch(`${this.apiBase}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('If an account with that email exists, a password reset link has been sent.', 'info', 'forgot-password-message');
                document.getElementById('forgot-password-form').reset();
            } else {
                this.showError('forgot-password-error', data.error || 'Failed to send reset link');
            }
        } catch (error) {
            console.error('Forgot password request error:', error);
            this.showError('forgot-password-error', 'Network error. Please try again.');
        } finally {
            this.setLoading('forgot-password-btn', false);
        }
    }

    async handlePasswordResetConfirm(e) {
        e.preventDefault();

        const token = document.getElementById('reset-token').value;
        const password = document.getElementById('reset-new-password').value;
        const confirmPassword = document.getElementById('reset-confirm-new-password').value;

        this.setLoading('reset-password-confirm-btn', true);
        this.clearErrors('reset-password-confirm-form');
        this.hideAlert('reset-password-confirm-message');

        if (password !== confirmPassword) {
            this.showFieldError('reset-confirm-new-password-error', 'Passwords do not match');
            this.setLoading('reset-password-confirm-btn', false);
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/reset-password-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('Your password has been reset successfully. You can now log in.', 'success', 'reset-password-confirm-message');
                document.getElementById('reset-password-confirm-form').reset();
                setTimeout(() => this.showLogin(), 3000);
            } else {
                this.showError('reset-password-confirm-error', data.error || 'Failed to reset password');
            }
        } catch (error) {
            console.error('Password reset confirmation error:', error);
            this.showError('reset-password-confirm-error', 'Network error. Please try again.');
        } finally {
            this.setLoading('reset-password-confirm-btn', false);
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem(this.tokenKey);
        sessionStorage.removeItem(this.tokenKey);
        if(this.refreshInterval) clearInterval(this.refreshInterval);
        this.showLogin();
    }

    // === Dashboard Section ===
    async loadDashboardData() {
        if (!this.user) return;

        const userGreeting = document.getElementById('user-greeting');
        if (userGreeting) userGreeting.textContent = this.user.username;

        try {
            const [profileResponse, usageResponse, sessionsResponse] = await Promise.all([
                fetch(`${this.apiBase}/user/profile`, { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch(`${this.apiBase}/stats/overview`, { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch(`${this.apiBase}/realtime/status`, { headers: { 'Authorization': `Bearer ${this.token}` } })
            ]);

            const profile = await profileResponse.json();
            const usageData = await usageResponse.json();
            const sessionsData = await sessionsResponse.json();

            this.updateDashboardUI(profile, usageData, sessionsData);
            this.loadUsageHistory(); // Load chart data
            this.startAutoRefresh();

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showAlert('Failed to load dashboard data. Please try again.', 'error');
        }
    }

    updateDashboardUI(profile, usageData, sessionsData) {
        // Update user info in sidebar header (already done in showPortal)
        // Update dashboard cards
        const dashboardGrid = document.querySelector('#dashboard-section .dashboard-grid');
        if (!dashboardGrid) return;

        dashboardGrid.innerHTML = `
            <!-- Usage Stats -->
            <div class="dashboard-card">
                <h3>Data Usage</h3>
                <div class="usage-stats">
                    <div class="usage-item">
                        <span class="usage-label">Used:</span>
                        <span class="usage-value" id="data-used">${usageData.usage.currentGB} GB</span>
                    </div>
                    <div class="usage-item">
                        <span class="usage-label">Limit:</span>
                        <span class="usage-value" id="data-limit">${usageData.usage.limitGB} GB</span>
                    </div>
                    <div class="usage-progress">
                        <div class="progress-bar" id="data-progress" style="width: ${usageData.usage.percentage}%"></div>
                    </div>
                </div>
            </div>

            <!-- Speed Stats -->
            <div class="dashboard-card">
                <h3>Connection Speed</h3>
                <div class="speed-stats">
                    <div class="speed-item">
                        <span class="speed-label">Download:</span>
                        <span class="speed-value" id="speed-down">${profile.limits.maxDownSpeedMbps || 'N/A'} Mbps</span>
                    </div>
                    <div class="speed-item">
                        <span class="speed-label">Upload:</span>
                        <span class="speed-value" id="speed-up">${profile.limits.maxUpSpeedMbps || 'N/A'} Mbps</span>
                    </div>
                </div>
            </div>

            <!-- Connected Devices -->
            <div class="dashboard-card">
                <h3>Connected Devices</h3>
                <div class="devices-stats">
                    <div class="devices-count">
                        <span class="devices-number" id="devices-count">${sessionsData.connections.count}</span>
                        <span class="devices-label">Devices</span>
                    </div>
                    <div class="devices-limit">
                        <span>of <span id="devices-limit">${sessionsData.connections.maxAllowed}</span> allowed</span>
                    </div>
                </div>
            </div>

            <!-- Current Session -->
            <div class="dashboard-card">
                <h3>Current Session</h3>
                <div class="session-info" id="session-info">
                    ${sessionsData.connections.active.length > 0 ? `
                        <p><strong>Connected:</strong> ${this.formatDuration(sessionsData.connections.active[0].durationSeconds)} ago</p>
                        <p><strong>IP Address:</strong> ${sessionsData.connections.active[0].ipAddress || 'N/A'}</p>
                        <p><strong>Upload:</strong> ${sessionsData.connections.active[0].uploadMB} MB | <strong>Download:</strong> ${sessionsData.connections.active[0].downloadMB} MB</p>
                    ` : '<p>No active VPN sessions</p>'}
                </div>
            </div>

            <!-- Subscription Status -->
            <div class="dashboard-card">
                <h3>Subscription Status</h3>
                <div class="subscription-info" id="subscription-info">
                    <p><strong>Status:</strong> <span id="subscription-status">${profile.user.subscriptionStatus}</span></p>
                    <p><strong>Plan:</strong> <span id="subscription-plan">${profile.user.plan}</span></p>
                    <p id="subscription-expires" style="${profile.user.subscriptionExpiresAt ? 'display: block;' : 'display: none;'} "><strong>Expires:</strong> <span id="subscription-expires-date">${profile.user.subscriptionExpiresAt ? new Date(profile.user.subscriptionExpiresAt).toLocaleDateString() : ''}</span></p>
                </div>
            </div>
        `;
    }

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = null;
    }

    async loadUsageHistory() {
        if (!this.user) return;
        try {
            const response = await fetch(`${this.apiBase}/stats/usage/chart`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const historyData = await response.json();
                this.renderUsageChart(historyData);
            } else {
                console.error('Failed to load usage history:', response.statusText);
            }
        } catch (error) {
            console.error('Error loading usage history:', error);
        }
    }

    renderUsageChart(historyData) {
        const ctx = document.getElementById('usage-chart');
        if (!ctx) return;

        if (this.usageChart) this.usageChart.destroy();

        const labels = historyData.map(item => item.date);
        const data = historyData.map(item => parseFloat(item.totalGB));

        this.usageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Data Usage (GB)',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Data Used (GB)' } },
                    x: { title: { display: true, text: 'Date' } }
                }
            }
        });
    }

    // === Devices Section ===
    async loadDevices() {
        if (!this.user) return;
        try {
            const response = await fetch(`${this.apiBase}/devices`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const devices = await response.json();
                this.renderDevices(devices);
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('Failed to load devices:', errorData.error || 'Unknown error');
                document.getElementById('devices-container').innerHTML = `<p class="alert alert-error">Failed to load devices: ${errorData.error || 'Unknown error'}</p>`;
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
            document.getElementById('devices-container').innerHTML = '<p class="alert alert-error">Network error. Please check your connection and try again.</p>';
        }
        this.bindDevicesEvents();
    }

    renderDevices(devices) {
        const container = document.getElementById('devices-container');
        if (!container) return;

        if (!devices || devices.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--muted);">No devices configured. Click "Add Device" to create your first VPN device!</p>';
            return;
        }

        container.innerHTML = `
            <div class="devices-table-header">
                <div class="device-col-name">Device Name</div>
                <div class="device-col-server">Server</div>
                <div class="device-col-ip">IP Address</div>
                <div class="device-col-date">Added</div>
                <div class="device-col-actions">Actions</div>
            </div>
            ${devices.map(device => {
                if (!device || !device.id || !device.deviceName) {
                    console.warn('Invalid device data:', device);
                    return '';
                }
                const deviceName = this.escapeHtml(device.deviceName);
                const serverInfo = device.server ? this.escapeHtml(device.server.location) : '<span style="color: var(--muted);">N/A</span>';
                const assignedIP = device.assignedIP || '<span style="color: var(--muted);">N/A</span>';
                const createdAt = device.createdAt ? new Date(device.createdAt).toLocaleDateString() : 'Unknown';
                
                return `
                <div class="device-row">
                    <div class="device-col-name">
                        <strong>${deviceName}</strong>
                    </div>
                    <div class="device-col-server">${serverInfo}</div>
                    <div class="device-col-ip"><code style="background: var(--card); padding: 2px 6px; border-radius: 4px; font-size: 0.9em;">${assignedIP}</code></div>
                    <div class="device-col-date">${createdAt}</div>
                    <div class="device-col-actions">
                        <button class="btn btn-sm btn-primary" data-action="show-qr" data-device-id="${device.id}" data-device-name="${deviceName}">QR</button>
                        <button class="btn btn-sm btn-secondary" data-action="download-config" data-device-id="${device.id}">Download</button>
                        <button class="btn btn-sm btn-danger" data-action="remove-device" data-device-id="${device.id}" data-device-name="${deviceName}">Remove</button>
                    </div>
                </div>
                `;
            }).filter(html => html).join('')}
        `;
    }

    bindDevicesEvents() {
        const addDeviceBtn = document.getElementById('add-device-btn');
        if (addDeviceBtn) addDeviceBtn.addEventListener('click', () => this.addDevice());

        document.querySelectorAll('[data-action="show-qr"]').forEach(btn => {
            btn.addEventListener('click', (e) => this.showQRCode(e.target.dataset.deviceId, e.target.dataset.deviceName));
        });
        document.querySelectorAll('[data-action="download-config"]').forEach(btn => {
            btn.addEventListener('click', (e) => this.downloadConfig(e.target.dataset.deviceId));
        });
        document.querySelectorAll('[data-action="remove-device"]').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeDevice(e.target.dataset.deviceId, e.target.dataset.deviceName));
        });
    }

    async addDevice() {
        const servers = await this.loadServers();
        if (servers.length === 0) {
            alert('No servers available. Please contact support.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Add New Device</h3>
                    <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <form id="add-device-form" class="modal-form">
                    <div class="form-group">
                        <label for="new-device-name">Device Name</label>
                        <input type="text" id="new-device-name" name="deviceName" 
                               placeholder="e.g., My iPhone, Work Laptop" required>
                        <small style="color: #666;">Choose a name to identify this device</small>
                    </div>
                    <div class="form-group">
                        <label for="new-device-server">VPN Server</label>
                        <select id="new-device-server" name="serverId" required>
                            <option value="">Select a server...</option>
                            ${servers.map(server => `
                                <option value="${server.id}">
                                    ${server.location} ${server.flag || ''} 
                                    ${server.status === 'active' ? '' : '(Unavailable)'}
                                </option>
                            `).join('')}
                        </select>
                        <small style="color: #666;">Choose the VPN server location</small>
                    </div>
                    <div id="add-device-error" class="alert alert-error" style="display: none; margin-top: 15px;"></div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()" style="flex: 1;">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">
                            Create Device
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const form = modal.querySelector('#add-device-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const deviceName = modal.querySelector('#new-device-name').value.trim();
            const serverId = parseInt(modal.querySelector('#new-device-server').value);
            const errorDiv = modal.querySelector('#add-device-error');
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (!deviceName || !serverId) {
                errorDiv.textContent = 'Please fill in all fields';
                errorDiv.style.display = 'block';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
            errorDiv.style.display = 'none';

            try {
                const response = await fetch(`${this.apiBase}/devices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ deviceName, serverId })
                });
                const data = await response.json();

                if (response.ok) {
                    modal.remove();
                    this.showAlert(`Device "${deviceName}" added successfully!`, 'success');
                    await this.loadDevices();
                } else {
                    let errorMsg = data.error || 'Failed to add device';
                    if (data.details) errorMsg += `: ${data.details}`;
                    if (data.message) errorMsg = data.message;
                    errorDiv.textContent = errorMsg;
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Add device error:', error);
                errorDiv.textContent = 'Network error. Please check your connection and try again.';
                errorDiv.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Device';
            }
        });
    }

    async loadServers() {
        try {
            const response = await fetch(`${this.apiBase}/servers`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to load servers:', error);
            return [];
        }
    }

    async showQRCode(deviceId, deviceName) {
        try {
            const qrCodeUrl = `${this.apiBase}/devices/${deviceId}/qrcode`;
            const token = this.token;
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>QR Code - ${this.escapeHtml(deviceName)}</h3>
                        <span class="modal-close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div style="text-align: center; padding: 20px;">
                        <p style="margin-bottom: 15px;">Scan this QR code with WireGuard mobile app:</p>
                        <img src="" alt="QR Code" style="max-width: 100%; border: 2px solid #ddd; border-radius: 8px;">
                        <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                            Or download the config file below
                        </p>
                        <button class="btn btn-primary" onclick="boldVPNPortal.downloadConfig(${deviceId}); this.closest('.modal').remove();" style="margin-top: 10px;">
                            Download Config File
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            
            const img = modal.querySelector('img');
            fetch(qrCodeUrl, { headers: { 'Authorization': `Bearer ${token}` } })
            .then(response => {
                if (response.ok) return response.blob();
                throw new Error('Failed to load QR code');
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                img.src = url;
                modal.addEventListener('remove', () => { window.URL.revokeObjectURL(url); });
            })
            .catch(error => {
                console.error('QR code load error:', error);
                img.alt = 'Failed to load QR code';
                img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Ctext x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\'%3EFailed to load QR code%3C/text%3E%3C/svg%3E';
                alert('Failed to load QR code. Please try downloading the config file instead.');
            });
            
        } catch (error) {
            console.error('Show QR code error:', error);
            alert('Failed to load QR code. Please try downloading the config file instead.');
        }
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
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to download configuration');
            }
        } catch (error) {
            console.error('Download config error:', error);
            alert('Network error. Please try again.');
        }
    }

    async removeDevice(deviceId, deviceName) {
        if (!confirm(`Remove device "${deviceName}"? This will delete it from OPNsense and cannot be undone.`)) return;

        try {
            const response = await fetch(`${this.apiBase}/devices/${deviceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.showAlert(`Device "${deviceName}" removed successfully`, 'success');
                await this.loadDevices();
            } else {
                const data = await response.json();
                this.showAlert(data.error || 'Failed to remove device', 'error');
            }
        } catch (error) {
            console.error('Remove device error:', error);
            this.showAlert('Network error. Please check your connection and try again.', 'error');
        }
    }

    // === Billing Section ===
    async loadBillingData() {
        if (!this.user) return;

        try {
            const [profileResponse, plansResponse, historyResponse] = await Promise.all([
                fetch(`${this.apiBase}/user/profile`, { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch(`${this.apiBase}/billing/plans`, { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch(`${this.apiBase}/billing/history`, { headers: { 'Authorization': `Bearer ${this.token}` } })
            ]);

            const profile = await profileResponse.json();
            const plans = await plansResponse.json();
            const history = await historyResponse.json();

            this.updateBillingUI(profile);
            this.renderPlanOptions(plans.plans);
            this.renderBillingHistory(history.history);

            document.getElementById('change-plan-btn').addEventListener('click', () => this.togglePlanOptions());

        } catch (error) {
            console.error('Error loading billing data:', error);
            this.showAlert('Failed to load billing information.', 'error');
        }
    }

    updateBillingUI(profile) {
        document.getElementById('current-plan-name').textContent = profile.user.plan || 'Basic';
        document.getElementById('current-plan-traffic').textContent = `${profile.limits.maxTrafficGB} GB`;
        document.getElementById('current-plan-devices').textContent = profile.limits.maxDevices;
    }

    renderPlanOptions(plans) {
        const container = document.getElementById('plan-options-container');
        if (!container) return;

        container.innerHTML = plans.map(plan => `
            <div class="plan-option-card">
                <h4>${plan.name}</h4>
                <p>${plan.description}</p>
                <p>Price: $${plan.price}/month</p>
                <button class="btn btn-primary btn-sm select-plan-btn" data-plan-id="${plan.id}" data-plan-name="${plan.name}">Select Plan</button>
            </div>
        `).join('');

        container.querySelectorAll('.select-plan-btn').forEach(button => {
            button.addEventListener('click', (e) => this.handleChangePlan(e.target.dataset.planId, e.target.dataset.planName));
        });
    }

    async handleChangePlan(planId, planName) {
        if (!confirm(`Are you sure you want to change your plan to ${planName}?`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/billing/change-plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ planId })
            });

            if (response.ok) {
                this.showAlert(`Plan successfully changed to ${planName}.`, 'success');
                this.loadBillingData();
                this.loadDashboardData();
                this.togglePlanOptions();
            } else {
                const data = await response.json();
                this.showAlert(data.error || 'Failed to change plan.', 'error');
            }
        } catch (error) {
            console.error('Error changing plan:', error);
            this.showAlert('Network error. Failed to change plan.', 'error');
        }
    }

    renderBillingHistory(history) {
        const container = document.getElementById('billing-history-container');
        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<p>No billing history available.</p>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.map(item => `
                        <tr>
                            <td>${new Date(item.date).toLocaleDateString()}</td>
                            <td>${item.planName}</td>
                            <td>$${item.amount.toFixed(2)}</td>
                            <td>${item.status}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    togglePlanOptions() {
        const planOptionsCard = document.getElementById('plan-options-card');
        planOptionsCard.style.display = planOptionsCard.style.display === 'none' ? 'block' : 'none';
    }

    // === Profile Section ===
    async loadProfileData() {
        if (!this.user) return;

        try {
            const response = await fetch(`${this.apiBase}/user/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const profile = await response.json();
                document.getElementById('profile-username').value = profile.user.username;
                document.getElementById('profile-email').value = profile.user.email;
            } else {
                console.error('Failed to load profile data:', response.statusText);
                this.showAlert('Failed to load profile data.', 'error', 'profile-error');
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showAlert('Network error loading profile data.', 'error', 'profile-error');
        }
        this.bindProfileEvents();
    }

    bindProfileEvents() {
        document.getElementById('profile-form').addEventListener('submit', (e) => this.handleProfileUpdate(e));
        document.getElementById('change-password-btn').addEventListener('click', () => this.showPasswordModal());
    }

    async handleProfileUpdate(e) {
        e.preventDefault();

        const email = document.getElementById('profile-email').value;

        this.setLoading('update-profile-btn', true);
        this.clearErrors('profile-form');
        this.hideAlert('profile-message');

        try {
            const response = await fetch(`${this.apiBase}/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('Profile updated successfully!', 'success', 'profile-message');
                this.user.email = email; // Update local user object
            } else {
                this.showError('profile-error', data.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.showError('profile-error', 'Network error. Please try again.');
        } finally {
            this.setLoading('update-profile-btn', false);
        }
    }

    // === Modals ===
    showPasswordModal() {
        const modalTemplate = document.getElementById('password-modal-template');
        const clonedModal = modalTemplate.content.cloneNode(true);
        document.body.appendChild(clonedModal);

        const passwordModal = document.getElementById('password-modal');
        passwordModal.style.display = 'flex';

        document.getElementById('password-modal-close').addEventListener('click', () => this.hidePasswordModal());
        passwordModal.addEventListener('click', (e) => { if (e.target === passwordModal) this.hidePasswordModal(); });
        document.getElementById('password-form').addEventListener('submit', (e) => this.handlePasswordChange(e));
    }

    hidePasswordModal() {
        const passwordModal = document.getElementById('password-modal');
        if (passwordModal) passwordModal.remove();
    }

    async handlePasswordChange(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmNewPassword = document.getElementById('confirm-new-password').value;

        if (newPassword !== confirmNewPassword) {
            alert('New passwords do not match'); // Replace with proper error display
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/user/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (response.ok) {
                this.showAlert('Password changed successfully!', 'success');
                this.hidePasswordModal();
            } else {
                const data = await response.json();
                this.showAlert(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Password change error:', error);
            this.showAlert('Network error. Failed to change password.', 'error');
        }
    }

    // === Utility Methods ===
    setLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        const textSpan = button.querySelector('.btn-text');
        const spinner = button.querySelector('.btn-spinner');

        if (loading) {
            button.disabled = true;
            if (textSpan) textSpan.style.opacity = '0.5';
            if (spinner) spinner.style.display = 'block';
        } else {
            button.disabled = false;
            if (textSpan) textSpan.style.opacity = '1';
            if (spinner) spinner.style.display = 'none';
        }
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    showFieldError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = message;
    }

    clearErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.querySelectorAll('.error-message').forEach(error => error.textContent = '');
        form.querySelectorAll('.alert').forEach(alert => alert.style.display = 'none');
    }

    showAlert(message, type = 'info', elementId = 'global-alert') {
        let alertElement = document.getElementById(elementId);
        if (!alertElement) {
            alertElement = document.createElement('div');
            alertElement.id = 'global-alert';
            alertElement.className = 'alert';
            document.getElementById('portal-content').prepend(alertElement);
        }
        alertElement.textContent = message;
        alertElement.className = `alert alert-${type}`;
        alertElement.style.display = 'block';
    }

    hideAlert(elementId = 'global-alert') {
        const alertElement = document.getElementById(elementId);
        if (alertElement) alertElement.style.display = 'none';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    formatBytesToGB(bytes) {
        if (bytes === 0) return 0;
        return (bytes / (1024 * 1024 * 1024)).toFixed(2);
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