import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: {
        'Content-Type': 'application/json',
        'x-mana-man': 'nasa.2006'
    }
});

// Request interceptor to add Admin Token, Carrier JWT, Passenger Bearer Token, and Security Header
api.interceptors.request.use(config => {
    // Ensure security header is ALWAYS present
    config.headers['x-mana-man'] = 'nasa.2006';

    const url = config.url || '';

    // Prevent token leakage to external third-party URLs
    const isAbsolute = url.startsWith('http://') || url.startsWith('https://');
    const isInternalApi = !isAbsolute || (config.baseURL && url.startsWith(config.baseURL));

    if (!isInternalApi) {
        return config;
    }

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
        const passengerToken = localStorage.getItem('token');

        // Carrier routes strictly require carrierJwt
        const isCarrierRoute =
            url.startsWith('/bus-admin') ||
            url.startsWith('/claims/carrier');

        if (isCarrierRoute) {
            if (carrierJwt) {
                config.headers['Authorization'] = `Bearer ${carrierJwt}`;
            }
        } else if (passengerToken) {
            // Passenger/user endpoints (e.g. /users, /bookings) use passenger Bearer token
            config.headers['Authorization'] = `Bearer ${passengerToken}`;
        } else if (carrierJwt) {
            // Carrier navigating general views
            config.headers['Authorization'] = `Bearer ${carrierJwt}`;
        }
    } catch (e) { }

    return config;
}, error => {
    return Promise.reject(error);
});

// Response interceptor to handle session expiration cleanly without cross-session corruption
api.interceptors.response.use(response => response, error => {
    if (error.response && error.response.status === 401) {
        const url = error.config?.url || '';
        if (url.includes('/bus-admin') || url.includes('/claims/carrier')) {
            localStorage.removeItem('carrierJwt');
            localStorage.removeItem('busUser');
        } else {
            // Clear expired/stale passenger token so user can smoothly re-authenticate
            const passengerToken = localStorage.getItem('token');
            if (passengerToken) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    }
    return Promise.reject(error);
});

export default api;
