import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
  const stored = JSON.parse(localStorage.getItem('datadash-auth') || '{}');
  const token = stored?.state?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const stored = JSON.parse(localStorage.getItem('datadash-auth') || '{}');
      const rToken = stored?.state?.refreshToken;

      if (!rToken) {
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken: rToken });

        // Update stored auth
        const authState = JSON.parse(localStorage.getItem('datadash-auth') || '{}');
        if (authState.state) {
          authState.state.accessToken = data.accessToken;
          authState.state.refreshToken = data.refreshToken;
          localStorage.setItem('datadash-auth', JSON.stringify(authState));
        }

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (_) {
        localStorage.removeItem('datadash-auth');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Dataset API
export const datasetApi = {
  upload: (formData, onProgress) =>
    api.post('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }),
  list: (workspaceId, params) => api.get(`/datasets/workspace/${workspaceId}`, { params }),
  get: (id) => api.get(`/datasets/${id}`),
  preview: (id, rows) => api.get(`/datasets/${id}/preview`, { params: { rows } }),
  suggestions: (id) => api.get(`/datasets/${id}/suggestions`),
  chartData: (id, params) => api.get(`/datasets/${id}/chart-data`, { params }),
  delete: (id) => api.delete(`/datasets/${id}`),
};

// Dashboard API
export const dashboardApi = {
  create: (data) => api.post('/dashboards', data),
  list: (workspaceId, params) => api.get(`/dashboards/workspace/${workspaceId}`, { params }),
  get: (id) => api.get(`/dashboards/${id}`),
  getPublic: (token) => api.get(`/dashboards/share/${token}`),
  update: (id, data) => api.put(`/dashboards/${id}`, data),
  share: (id, isPublic) => api.patch(`/dashboards/${id}/share`, { isPublic }),
  delete: (id) => api.delete(`/dashboards/${id}`),
  addWidget: (dashboardId, data) => api.post(`/dashboards/${dashboardId}/widgets`, data),
  updateWidget: (dashboardId, widgetId, data) => api.put(`/dashboards/${dashboardId}/widgets/${widgetId}`, data),
  deleteWidget: (dashboardId, widgetId) => api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`),
  updatePositions: (dashboardId, positions) => api.patch(`/dashboards/${dashboardId}/widgets/positions`, { positions }),
};

// Workspace API
export const workspaceApi = {
  get: (id) => api.get(`/workspaces/${id}`),
  create: (data) => api.post('/workspaces', data),
  update: (id, data) => api.put(`/workspaces/${id}`, data),
  stats: (id) => api.get(`/workspaces/${id}/stats`),
  inviteMember: (id, data) => api.post(`/workspaces/${id}/members`, data),
  removeMember: (id, userId) => api.delete(`/workspaces/${id}/members/${userId}`),
};
