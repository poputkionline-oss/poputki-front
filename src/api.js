import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: {
        'Content-Type': 'application/json',
        'x-mana-man': 'nasa.2006'
    }
});

// Request interceptor to add Admin Token, Carrier JWT and Security Header
api.interceptors.request.use(config => {
    // Ensure security header is ALWAYS present
    config.headers['x-mana-man'] = 'nasa.2006';

    const url = config.url || '';
    const isAdminApi =
        url === '/admin' ||
        url.startsWith('/admin/');

    if (isAdminApi) {
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken) {
            config.headers['X-Admin-Token'] = adminToken;
        }
    }

    try {
        const carrierJwt = localStorage.getItem('carrierJwt');
        if (carrierJwt) {
            config.headers['Authorization'] = `Bearer ${carrierJwt}`;
        }
    } catch (e) { }

    return config;
}, error => {
    return Promise.reject(error);
});

// Response interceptor to handle session expiration
api.interceptors.response.use(response => response, error => {
    if (error.response && error.response.status === 401) {
        const url = error.config?.url || '';
        if (url.includes('/bus-admin')) {
            localStorage.removeItem('carrierJwt');
            localStorage.removeItem('busUser');
        }
    }
    return Promise.reject(error);
});

export default api;
