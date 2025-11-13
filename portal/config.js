/**
 * Portal Configuration
 * Sets the API URL for different environments
 */
const Config = {
    // API URL - automatically detects environment
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'
        : 'https://api.boldvpn.net/api'
};

console.log('Portal Config loaded:', Config);
