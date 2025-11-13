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
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API request to ${endpoint} failed:`, error);
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
      return request('/devices');
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
