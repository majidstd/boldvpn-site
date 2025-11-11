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
        this.usageChart = null; // To store the Chart.js instance

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
        if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', (e) => this.showForgotPasswordRequest(e));

        // New links for forgot password flow
        const forgotToLoginLink = document.getElementById('forgot-to-login-link');
        const resetToLoginLink = document.getElementById('reset-to-login-link');

        if (forgotToLoginLink) forgotToLoginLink.addEventListener('click', (e) => this.showLogin(e));
        if (resetToLoginLink) resetToLoginLink.addEventListener('click', (e) => this.showLogin(e));

        // New forms for forgot password flow
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        const resetPasswordConfirmForm = document.getElementById('reset-password-confirm-form');

        if (forgotPasswordForm) forgotPasswordForm.addEventListener('submit', (e) => this.handleForgotPasswordRequest(e));
        if (resetPasswordConfirmForm) resetPasswordConfirmForm.addEventListener('submit', (e) => this.handlePasswordResetConfirm(e));


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
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('token');

        if (resetToken) {
            this.showResetPasswordConfirm(resetToken);
            // Clear the token from the URL to prevent re-use on refresh
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (this.token) {
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
        document.getElementById('forgot-password-section').style.display = 'none';
        document.getElementById('reset-password-confirm-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'none';
    }

    showForgotPasswordRequest(e) {
        if (e) e.preventDefault();
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('forgot-password-section').style.display = 'block';
        document.getElementById('reset-password-confirm-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'none';
        this.clearErrors('forgot-password-form');
        this.hideAlert('forgot-password-message');
    }

    showResetPasswordConfirm(token) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('forgot-password-section').style.display = 'none';
        document.getElementById('reset-password-confirm-section').style.display = 'block';
        document.getElementById('dashboard-section').style.display = 'none';
        document.getElementById('reset-token').value = token; // Set the token in the hidden input
        this.clearErrors('reset-password-confirm-form');
        this.hideAlert('reset-password-confirm-message');
    }

    showDashboard() {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('forgot-password-section').style.display = 'none';
        document.getElementById('reset-password-confirm-section').style.display = 'none';
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

    async handleForgotPasswordRequest(e) {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value;

        this.setLoading('forgot-password-btn', true);
        this.clearErrors('forgot-password-form');
        this.hideAlert('forgot-password-message');

        try {
            const response = await fetch(`${this.apiBase}/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.showAlert('Your password has been reset successfully. You can now log in.', 'success', 'reset-password-confirm-message');
                document.getElementById('reset-password-confirm-form').reset();
                // Optionally, redirect to login after a short delay
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
        if (usageHistory.style.display === 'none') {
            usageHistory.style.display = 'block';
            this.loadUsageHistory();
        } else {
            usageHistory.style.display = 'none';
            if (this.usageChart) {
                this.usageChart.destroy(); // Destroy chart when hidden
                this.usageChart = null;
            }
        }
    }

    async loadUsageHistory() {
        if (!this.user) return;

        try {
            const response = await fetch(`${this.apiBase}/user/usage/history`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const historyData = await response.json();
                this.renderUsageChart(historyData);
            } else {
                console.error('Failed to load usage history:', response.statusText);
                this.showError('usage-history-error', 'Failed to load usage history.');
            }
        } catch (error) {
            console.error('Error loading usage history:', error);
            this.showError('usage-history-error', 'Network error loading usage history.');
        }
    }

    renderUsageChart(historyData) {
        const ctx = document.getElementById('usage-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.usageChart) {
            this.usageChart.destroy();
        }

        // Assuming historyData is an array of objects like { date: 'YYYY-MM-DD', totalBytes: N }
        const labels = historyData.map(item => item.date);
        const data = historyData.map(item => this.formatBytesToGB(item.totalBytes)); // Convert bytes to GB for display

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
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Data Used (GB)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        });
    }

    formatBytesToGB(bytes) {
        if (bytes === 0) return 0;
        return (bytes / (1024 * 1024 * 1024)).toFixed(2); // Convert to GB
    }

    toggleDevicesList() {
        const devicesList = document.getElementById('devices-list');
        if (devicesList.style.display === 'none') {
            devicesList.style.display = 'block';
            this.loadDevices();
        } else {
            devicesList.style.display = 'none';
        }
    }

    async loadDevices() {
        if (!this.user) return;

        try {
            const response = await fetch(`${this.apiBase}/user/devices`, { // Assuming this endpoint exists
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const devicesData = await response.json();
                this.updateDevicesUI(devicesData);
            } else {
                console.error('Failed to load devices:', response.statusText);
                this.showError('devices-list-error', 'Failed to load connected devices.');
            }
        } catch (error) {
            console.error('Error loading devices:', error);
            this.showError('devices-list-error', 'Network error loading connected devices.');
        }
    }

    updateDevicesUI(devicesData) {
        const container = document.getElementById('devices-container');
        const countElement = document.getElementById('devices-count');

        if (countElement) {
            countElement.textContent = devicesData.length;
        }

        if (!container) return;

        if (devicesData.length === 0) {
            container.innerHTML = '<p>No devices currently connected.</p>';
            return;
        }

        // Escape function to prevent XSS
        const escapeHtml = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };

        container.innerHTML = devicesData.map(device => `
            <div class="device-item">
                <div class="device-info">
                    <div class="device-name">Device ${escapeHtml(device.acctsessionid.toString().slice(-4))}</div>
                    <div class="device-details">
                        IP: ${escapeHtml(device.framedipaddress || 'N/A')} | Connected: ${escapeHtml(new Date(device.acctstarttime).toLocaleString())}
                    </div>
                </div>
                <div class="device-stats">
                    <span>${this.formatBytes(device.acctinputoctets)} ↑ / ${this.formatBytes(device.acctoutputoctets)} ↓</span>
                </div>
                <button class="btn btn-danger btn-sm disconnect-device-btn" data-session-id="${escapeHtml(device.acctsessionid)}">Disconnect</button>
            </div>
        `).join('');

        // Add event listeners for disconnect buttons
        container.querySelectorAll('.disconnect-device-btn').forEach(button => {
            button.addEventListener('click', (e) => this.handleDisconnectDevice(e.target.dataset.sessionId));
        });
    }

    async handleDisconnectDevice(sessionId) {
        if (!confirm('Are you sure you want to disconnect this device?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/user/sessions/disconnect`, { // Assuming this endpoint exists
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ sessionId })
            });

            if (response.ok) {
                this.showAlert('Device disconnected successfully.', 'success');
                this.loadDevices(); // Refresh the list
            } else {
                const data = await response.json();
                this.showAlert(data.error || 'Failed to disconnect device.', 'error');
            }
        } catch (error) {
            console.error('Error disconnecting device:', error);
            this.showAlert('Network error. Failed to disconnect device.', 'error');
        }
    }

    showBilling() {
        this.showAlert('Billing & Plans feature coming soon!', 'info');
    }

    showForgotPassword() {
        this.showAlert('Password reset feature coming soon!', 'info');
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

    showAlert(message, type = 'info', elementId = 'global-alert') {
        let alertElement = document.getElementById(elementId);
        if (!alertElement) {
            // Create a global alert element if it doesn't exist
            alertElement = document.createElement('div');
            alertElement.id = 'global-alert';
            alertElement.className = 'alert';
            document.querySelector('.container').prepend(alertElement); // Prepend to main container
        }
        alertElement.textContent = message;
        alertElement.className = `alert alert-${type}`;
        alertElement.style.display = 'block';
    }

    hideAlert(elementId = 'global-alert') {
        const alertElement = document.getElementById(elementId);
        if (alertElement) {
            alertElement.style.display = 'none';
        }
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
