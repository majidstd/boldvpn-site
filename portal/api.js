// portal/api.js

const API_BASE_URL = (typeof Config !== 'undefined' && Config.API_URL)
  ? Config.API_URL
  : 'http://localhost:3000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('boldvpn_token') || sessionStorage.getItem('boldvpn_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));

      // Handle rate limiting
      if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '15';
          throw new Error(`Too many requests. Please try again in ${retryAfter} seconds.`);
      }

      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API request to ${endpoint} failed:`, error);
    
    // Handle network errors specifically
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      // Check error message or stack for specific error codes
      const errorString = error.message + (error.stack || '');
      
      if (errorString.includes('ERR_ADDRESS_UNREACHABLE') || 
          errorString.includes('ERR_NAME_NOT_RESOLVED') ||
          errorString.includes('net::ERR_ADDRESS_UNREACHABLE') ||
          errorString.includes('net::ERR_NAME_NOT_RESOLVED')) {
        throw new Error('Cannot connect to server. Please check your internet connection and try again. If the problem persists, the API server may be temporarily unavailable.');
      } else if (errorString.includes('ERR_CONNECTION_REFUSED') || 
                 errorString.includes('net::ERR_CONNECTION_REFUSED')) {
        throw new Error('Connection refused. The API server may be down. Please try again later.');
      } else if (errorString.includes('ERR_NETWORK') || 
                 errorString.includes('net::ERR_NETWORK')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else {
        // Generic network error for any "Failed to fetch" that doesn't match above
        throw new Error('Cannot connect to server. Please check your internet connection and try again. If the problem persists, the API server may be temporarily unavailable.');
      }
    }
    
    // Re-throw the original error if it's already been processed
    throw error;
  }
}

export const api = {
  auth: {
    login(username, password) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    verify() {
      return request('/auth/verify');
    },
  },
  devices: {
    getAll() {
      return request(`/devices?_=${new Date().getTime()}`);
    },
    create(deviceName, serverId) {
      return request('/devices', {
        method: 'POST',
        body: JSON.stringify({ deviceName, serverId: parseInt(serverId) }),
      });
    },
    remove(deviceId) {
      return request(`/devices/${deviceId}`, {
        method: 'DELETE',
      });
    },
    getConfig(deviceId) {
        return fetch(`${API_BASE_URL}/devices/${deviceId}/config`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('boldvpn_token') || sessionStorage.getItem('boldvpn_token')}` }
        });
    },
    getQRCode(deviceId) {
        return fetch(`${API_BASE_URL}/devices/${deviceId}/qrcode`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('boldvpn_token') || sessionStorage.getItem('boldvpn_token')}` }
        });
    }
  },
  servers: {
    getAll() {
      return request('/servers');
    },
  },
  user: {
    getProfile() {
        return request('/user/profile');
    },
    updateProfile(email) {
        return request('/user/profile', {
            method: 'PUT',
            body: JSON.stringify({ email }),
        });
    },
    changePassword(currentPassword, newPassword) {
        return request('/user/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }
  },
  stats: {
    getOverview() {
        return request('/stats/overview');
    }
  }
};
