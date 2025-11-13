// BoldVPN Portal Configuration
// Configure this based on your deployment environment

const Config = {
    // API URL - Update this based on your environment
    // Production: Use your API domain (e.g., 'https://api.boldvpn.net/api')
    // Development: Use localhost (e.g., 'http://localhost:3000/api')
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'
        : 'https://api.boldvpn.net/api',
    
    // Token storage key
    TOKEN_KEY: 'boldvpn_token',
    
    // User storage key
    USER_KEY: 'boldvpn_user',
    
    // Auto-refresh interval for dashboard data (milliseconds)
    REFRESH_INTERVAL: 30000, // 30 seconds
    
    // Usage chart colors
    CHART_COLORS: {
        primary: '#0ea5e9',
        secondary: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        background: '#f3f4f6'
    },
    
    // Plans configuration (for registration)
    PLANS: [
        {
            id: 'basic',
            name: 'Basic',
            price: 9.99,
            data: '50 GB',
            speed: '100 Mbps',
            devices: 2
        },
        {
            id: 'premium',
            name: 'Premium',
            price: 19.99,
            data: 'Unlimited',
            speed: '500 Mbps',
            devices: 5
        },
        {
            id: 'family',
            name: 'Family',
            price: 29.99,
            data: 'Unlimited',
            speed: '1 Gbps',
            devices: 10
        }
    ]
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}

