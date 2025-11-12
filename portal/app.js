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
        this.sidebarStateKey = 'boldvpn_sidebar_collapsed';
        this.token = localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
        this.user = null;
        this.refreshInterval = null;
        this.usageChart = null;

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
            
            if (section === 'dashboard') this.loadDashboardData();
            else if (section === 'devices') this.loadDevices();
            else if (section === 'billing') this.loadBillingData();
            else if (section === 'profile') this.loadProfileData();
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
            this.bindAuthEvents(templateId);
        }
    }

    bindAuthEvents(templateId) {
        if (templateId === 'login-template') {
            document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
            document.getElementById('register-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('register-template'); });
            document.getElementById('forgot-password-link').addEventListener('click', (e) => { e.preventDefault(); this.renderAuth('forgot-password-template'); });
        } // ... other auth event bindings
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
            const response = await fetch(`${this.apiBase}/auth/verify`, { headers: { 'Authorization': `Bearer ${this.token}` } });
            if (response.ok) {
                this.user = (await response.json()).user;
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
        document.getElementById('auth-container').style.display = 'flex';
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
        
        this.setupSidebar();
        this.bindNavEvents();

        if (this.user) {
            const usernameEl = document.getElementById('sidebar-username');
            const planEl = document.getElementById('sidebar-plan');
            if(usernameEl) usernameEl.textContent = this.user.username;
            if(planEl) planEl.textContent = this.user.plan;
        }

        this.navigateTo('dashboard');
    }

    setupSidebar() {
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (!sidebarFooter || document.getElementById('sidebar-toggle')) return;

        const toggleButton = document.createElement('button');
        toggleButton.id = 'sidebar-toggle';
        toggleButton.className = 'nav-item';
        toggleButton.innerHTML = `
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path></svg>
            <span>Collapse</span>
        `;
        sidebarFooter.prepend(toggleButton);

        toggleButton.addEventListener('click', () => this.toggleSidebar());

        // Apply saved state
        if (localStorage.getItem(this.sidebarStateKey) === 'true') {
            document.getElementById('portal-container').classList.add('sidebar-collapsed');
        }
    }

    toggleSidebar() {
        const container = document.getElementById('portal-container');
        const isCollapsed = container.classList.toggle('sidebar-collapsed');
        localStorage.setItem(this.sidebarStateKey, isCollapsed);
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;
        const errorDiv = document.getElementById('login-error');

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
                this.showPortal();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
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

    // Placeholder data loading methods
    async loadDashboardData() { /* Fetch and render dashboard data */ }
    async loadDevices() { /* Fetch and render devices data */ }
    async loadBillingData() { /* Fetch and render billing data */ }
    async loadProfileData() { /* Fetch and render profile data */ }
}

document.addEventListener('DOMContentLoaded', () => {
    window.boldVPNPortal = new BoldVPNPortal();
});