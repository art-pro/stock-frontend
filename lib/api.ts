import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface Stock {
  id: number;
  ticker: string;
  company_name: string;
  sector: string;
  current_price: number;
  currency: string;
  fair_value: number;
  upside_potential: number;
  downside_risk: number;
  probability_positive: number;
  expected_value: number;
  beta: number;
  volatility: number;
  pe_ratio: number;
  eps_growth_rate: number;
  debt_to_ebitda: number;
  dividend_yield: number;
  b_ratio: number;
  kelly_fraction: number;
  half_kelly_suggested: number;
  shares_owned: number;
  avg_price_local: number;
  current_value_usd: number;
  weight: number;
  unrealized_pnl: number;
  buy_zone_min: number;
  buy_zone_max: number;
  assessment: string;
  update_frequency: string;
  last_updated: string;
}

export interface PortfolioMetrics {
  total_value: number;
  overall_ev: number;
  weighted_volatility: number;
  sharpe_ratio: number;
  kelly_utilization: number;
  sector_weights: { [key: string]: number };
}

export interface Alert {
  id: number;
  stock_id: number;
  ticker: string;
  alert_type: string;
  message: string;
  email_sent: boolean;
  created_at: string;
}

export interface StockHistory {
  id: number;
  stock_id: number;
  ticker: string;
  current_price: number;
  fair_value: number;
  upside_potential: number;
  expected_value: number;
  kelly_fraction: number;
  weight: number;
  assessment: string;
  recorded_at: string;
}

// Auth API
export const authAPI = {
  login: (username: string, password: string) =>
    api.post('/login', { username, password }),
  logout: () => api.post('/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  getCurrentUser: () => api.get('/me'),
};

// Stock API
export const stockAPI = {
  getAll: () => api.get<Stock[]>('/stocks'),
  getById: (id: number) => api.get<Stock>(`/stocks/${id}`),
  create: (data: Partial<Stock>) => api.post<Stock>('/stocks', data),
  update: (id: number, data: Partial<Stock>) =>
    api.put<Stock>(`/stocks/${id}`, data),
  delete: (id: number, reason?: string) =>
    api.delete(`/stocks/${id}`, { params: { reason } }),
  updateAll: () => api.post('/stocks/update-all'),
  updateSingle: (id: number) => api.post(`/stocks/${id}/update`),
  getHistory: (id: number) => api.get<StockHistory[]>(`/stocks/${id}/history`),
  exportCSV: () => api.get('/export/csv', { responseType: 'blob' }),
  importCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Portfolio API
export const portfolioAPI = {
  getSummary: () =>
    api.get<{ summary: PortfolioMetrics; stocks: Stock[] }>(
      '/portfolio/summary'
    ),
  getSettings: () => api.get('/portfolio/settings'),
  updateSettings: (data: any) => api.put('/portfolio/settings', data),
  getAlerts: () => api.get<Alert[]>('/alerts'),
  deleteAlert: (id: number) => api.delete(`/alerts/${id}`),
};

// Deleted stocks API
export const deletedStockAPI = {
  getAll: () => api.get('/deleted-stocks'),
  restore: (id: number) => api.post(`/deleted-stocks/${id}/restore`),
};

export default api;

