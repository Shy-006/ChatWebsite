import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true // Crucial for sending/receiving cookies
});

// We only need the response interceptor for automatic token refresh on 403.
api.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  const originalRequest = error.config;
  if (error.response && error.response.status === 403 && !originalRequest._retry) {
    originalRequest._retry = true;
    try {
      const res = await axios.post('http://localhost:5000/api/auth/refresh-token', {}, { withCredentials: true });
      
      if (res.status === 200) {
        // The new token is set via Set-Cookie, so we just retry the request
        return api(originalRequest);
      }
    } catch (refreshError) {
      // Refresh token failed, redirect to login
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
});

export default api;
