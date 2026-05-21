import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true // Crucial for sending/receiving cookies
});

// We only need the response interceptor for automatic token refresh on 403.
api.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  const originalRequest = error.config;
  if (error.response && (error.response.status === 403 || error.response.status === 401) && !originalRequest._retry && originalRequest.url !== `${API_URL}/auth/refresh-token`) {
    originalRequest._retry = true;
    try {
      const res = await axios.post(`${API_URL}/auth/refresh-token`, {}, { withCredentials: true });
      
      if (res.status === 200) {
        // The new token is set via Set-Cookie, so we just retry the request
        return api(originalRequest);
      }
    } catch (refreshError) {
      // Refresh token failed, redirect to login if not already on login/signup page to prevent loop
      if (!window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/signup')) {
        window.location.href = '/login';
      }
    }
  }
  return Promise.reject(error);
});

export default api;
