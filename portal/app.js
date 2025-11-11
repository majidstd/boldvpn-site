// BoldVPN Customer Portal JavaScript
// Single-page application for account management

class BoldVPNPortal {
    constructor() {
        // Use Config from config.js if available, fallback to localhost
        this.apiBase = (typeof Config !== 'undefined' && Config.API_URL) 
            ? Config.API_URL 
            : 'http://localhost:3000/api';
        this.tokenKey = (typeof Config !== 'undefined' && Config.TOKEN_KEY)
            ? Config.TOKEN_KEY
            : 'boldvpn_token';
        this.token = localStorage.getItem(this.tokenKey);
        this.user = null;
        this.refreshInterval = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
    }

    bindEvents() {
        // Auth forms
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const passwordForm = document.getElementById('password-form');

        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        if (passwordForm) passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));

        // Navigation links
        const registerLink = document.getElementById('register-link');
        const loginLink = document.getElementById('login-link');
        const forgotPasswordLink = document.getElementById('forgot-password-link');

        if (registerLink) registerLink.addEventListener('click', (e) => this.showRegister(e));
        if (loginLink) loginLink.addEventListener('click', (e) => this.showLogin(e));
        if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', (e) => this.showForgotPassword(e));

        // Dashboard buttons
        const logoutBtn = document.getElementById('logout-btn');
        const changePasswordBtn = document.getElementById('change-password-btn');
        const viewUsageBtn = document.getElementById('view-usage-btn');
        const manageDevicesBtn = document.getElementById('manage-devices-btn');
        const billingBtn = document.getElementById('billing-btn');

        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());
        if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => this.showPasswordModal());
        if (viewUsageBtn) viewUsageBtn.addEventListener('click', () => this.toggleUsageHistory());
        if (manageDevicesBtn) manageDevicesBtn.addEventListener('click', () => this.toggleDevicesList());
        if (billingBtn) billingBtn.addEventListener('click', () => this.showBilling());

        // Modal close
        const passwordModalClose = document.getElementById('password-modal-close');
        if (passwordModalClose) passwordModalClose.addEventListener('click', () => this.hidePasswordModal());

        // Close modal on outside click
        const passwordModal = document.getElementById('password-modal');
        if (passwordModal) {
            passwordModal.addEventListener('click', (e) => {
                if (e.target === passwordModal) this.hidePasswordModal();
            });
        }
    }

    checkAuth() {
        if (this.token) {
            // Verify token with server
            this.verifyToken();
        } else {
            this.showLogin();
        }
    }

    async verifyToken() {
        try {
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.showDashboard();
                this.loadDashboardData();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            this.logout();
        }
    }

    showLogin() {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'none';
    }

    showRegister() {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'block';
        document.getElementById('dashboard-section').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'block';

        if (this.user) {
            document.getElementById('user-greeting').textContent = this.user.username;
        }

        // Start auto-refresh (every 30 seconds)
        this.startAutoRefresh();
    }

    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh dashboard data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        this.setLoading('login-btn', true);
        this.clearErrors('login-form');

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                // Add timeout to prevent hanging
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;

                // Store token
                if (rememberMe) {
                    localStorage.setItem('boldvpn_token', this.token);
                } else {
                    sessionStorage.setItem('boldvpn_token', this.token);
                }

                this.showDashboard();
                this.loadDashboardData();
            } else {
                this.showError('login-error', data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            
            // More detailed error messages
            let errorMessage = 'Network error. Please try again.';
            if (error.message) {
                errorMessage = error.message;
            }
            if (error.toString().includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to server. Please check your connection.';
            }
            
            this.showError('login-error', errorMessage);
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

        // Client-side validation
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password, plan })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;

                localStorage.setItem('boldvpn_token', this.token);

                this.showDashboard();
                this.loadDashboardData();

                // Show success message
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

    async handlePasswordChange(e) {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;

        if (newPassword !== confirmPassword) {
            alert('New passwords do not match');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/user/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Password changed successfully!');
                this.hidePasswordModal();
                document.getElementById('password-form').reset();
            } else {
                alert(data.error || 'Failed to change password');
            }
        } catch (error) {
            console.error('Password change error:', error);
            alert('Network error. Please try again.');
        }
    }

    async loadDashboardData() {
        if (!this.user) return;

        try {
            // Load user profile
            const profileResponse = await fetch(`${this.apiBase}/user/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (profileResponse.ok) {
                const profile = await profileResponse.json();
                this.updateDashboardUI(profile);
            }

            // Load usage statistics
            const usageResponse = await fetch(`${this.apiBase}/user/usage`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (usageResponse.ok) {
                const usageData = await usageResponse.json();
                this.updateUsageUI(usageData);
            }

            // Load active sessions
            const sessionsResponse = await fetch(`${this.apiBase}/user/sessions/active`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                this.updateSessionsUI(sessionsData);
            }

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    updateDashboardUI(profile) {
        // Update user info
        const userGreeting = document.getElementById('user-greeting');
        if (userGreeting) {
            userGreeting.textContent = profile.user.username;
        }

        // Update plan name
        const planName = document.getElementById('plan-name');
        if (planName) {
            planName.textContent = profile.user.plan || 'Basic';
        }

        // Update speed limits
        const speedDown = document.getElementById('speed-down');
        const speedUp = document.getElementById('speed-up');
        if (speedDown && profile.limits.maxDownSpeedMbps) {
            speedDown.textContent = `${profile.limits.maxDownSpeedMbps} Mbps`;
        }
        if (speedUp && profile.limits.maxUpSpeedMbps) {
            speedUp.textContent = `${profile.limits.maxUpSpeedMbps} Mbps`;
        }

        // Update device limit
        const devicesLimit = document.getElementById('devices-limit');
        if (devicesLimit && profile.limits.maxDevices) {
            devicesLimit.textContent = profile.limits.maxDevices;
        }

        // Update session info
        if (profile.currentSession) {
            const sessionInfo = document.getElementById('session-info');
            // Use textContent to prevent XSS
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };
            sessionInfo.innerHTML = `
                <p><strong>Connected since:</strong> ${escapeHtml(new Date(profile.currentSession.startTime).toLocaleString())}</p>
                <p><strong>Session time:</strong> ${escapeHtml(profile.currentSession.sessionTime)}</p>
                <p><strong>IP Address:</strong> ${escapeHtml(profile.currentSession.ipAddress || 'N/A')}</p>
            `;
        }
    }

    updateUsageUI(usageData) {
        // Update data used
        const dataUsed = document.getElementById('data-used');
        const dataLimit = document.getElementById('data-limit');
        const dataProgress = document.getElementById('data-progress');

        if (dataUsed) {
            dataUsed.textContent = `${usageData.currentMonth.totalGB} GB`;
        }
        if (dataLimit) {
            dataLimit.textContent = `${usageData.limit.monthlyGB} GB`;
        }
        if (dataProgress) {
            dataProgress.style.width = `${usageData.limit.percentageUsed}%`;
        }

        // Update today's usage
        const todayUsage = document.getElementById('today-usage');
        if (todayUsage) {
            todayUsage.textContent = `${usageData.today.totalGB} GB today`;
        }
    }

    updateSessionsUI(sessionsData) {
        const devicesCount = document.getElementById('devices-count');
        const sessionInfo = document.getElementById('session-info');

        if (devicesCount) {
            devicesCount.textContent = sessionsData.count;
        }

        if (sessionInfo && sessionsData.sessions.length > 0) {
            const session = sessionsData.sessions[0]; // Show first active session
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };
            
            sessionInfo.innerHTML = `
                <p><strong>Connected:</strong> ${escapeHtml(session.durationFormatted)} ago</p>
                <p><strong>IP Address:</strong> ${escapeHtml(session.ipAddress || 'N/A')}</p>
                <p><strong>Upload:</strong> ${escapeHtml(session.uploadMB)} MB | <strong>Download:</strong> ${escapeHtml(session.downloadMB)} MB</p>
            `;
        } else if (sessionInfo) {
            sessionInfo.innerHTML = '<p>No active VPN sessions</p>';
        }
    }

    updateDevicesUI(devices) {
        const container = document.getElementById('devices-container');
        const countElement = document.getElementById('devices-count');

        if (countElement) {
            countElement.textContent = devices.length;
        }

        if (!container) return;

        if (devices.length === 0) {
            container.innerHTML = '<p>No devices currently connected.</p>';
            return;
        }

        // Escape function to prevent XSS
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        container.innerHTML = devices.map(device => `
            <div class="device-item">
                <div class="device-info">
                    <div class="device-name">Device ${escapeHtml(device.sessionId.toString().slice(-4))}</div>
                    <div class="device-details">
                        IP: ${escapeHtml(device.ipAddress || 'N/A')} | Connected: ${escapeHtml(device.durationFormatted)}
                    </div>
                </div>
                <div class="device-stats">
                    <span>${escapeHtml(device.uploadMB)} MB ↑ / ${escapeHtml(device.downloadMB)} MB ↓</span>
                </div>
            </div>
        `).join('');
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('boldvpn_token');
        sessionStorage.removeItem('boldvpn_token');
        this.stopAutoRefresh();
        this.showLogin();
    }

    showPasswordModal() {
        document.getElementById('password-modal').style.display = 'flex';
    }

    hidePasswordModal() {
        document.getElementById('password-modal').style.display = 'none';
    }

    toggleUsageHistory() {
        const usageHistory = document.getElementById('usage-history');
        usageHistory.style.display = usageHistory.style.display === 'none' ? 'block' : 'none';
    }

    toggleDevicesList() {
        const devicesList = document.getElementById('devices-list');
        devicesList.style.display = devicesList.style.display === 'none' ? 'block' : 'none';
    }

    showBilling() {
        alert('Billing & Plans feature coming soon!');
    }

    showForgotPassword() {
        alert('Password reset feature coming soon!');
    }

    // Utility methods
    setLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        const textSpan = button.querySelector('.btn-text');
        const spinner = button.querySelector('.btn-spinner');

        if (loading) {
            button.disabled = true;
            textSpan.style.opacity = '0.5';
            spinner.style.display = 'block';
        } else {
            button.disabled = false;
            textSpan.style.opacity = '1';
            spinner.style.display = 'none';
        }
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.style.display = 'block';
    }

    showFieldError(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
    }

    clearErrors(formId) {
        const form = document.getElementById(formId);
        const errors = form.querySelectorAll('.error-message');
        errors.forEach(error => error.textContent = '');

        const alerts = form.querySelectorAll('.alert');
        alerts.forEach(alert => alert.style.display = 'none');
    }

    showAlert(message, type = 'info') {
        // Simple alert for now - could be improved with toast notifications
        alert(message);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    parseBytes(str) {
        if (!str) return 0;
        const units = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };
        const match = str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
        if (!match) return 0;
        return parseFloat(match[1]) * units[match[2].toUpperCase()];
    }
}

// Initialize the portal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.boldVPNPortal = new BoldVPNPortal();
});
