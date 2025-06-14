import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Instance axios configurée
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 secondes timeout
  withCredentials: true // Pour les cookies CORS
});

// Services API
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  profile: () => api.get('/auth/profile'),
  register: (data) => api.post('/auth/register', data)
};

export const productService = {
  getAll: (params = {}) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  search: (query) => api.get('/products/search', { params: { q: query } })
};

export const orderService = {
  getAll: (params = {}) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  create: (data) => api.post('/orders', data),
  cancel: (id) => api.post(`/orders/${id}/cancel`)
};

export const messageService = {
  getAll: (params = {}) => api.get('/messages', { params }),
  getById: (id) => api.get(`/messages/${id}`),
  send: (data) => api.post('/messages/send', data),
  markAsRead: (id) => api.patch(`/messages/${id}/read`),
  getStats: () => api.get('/messages/stats')
};

export const dashboardService = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/activity'),
  getChartData: (period) => api.get('/dashboard/charts', { params: { period } })
};

export const userService = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role })
};

export default api;