import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Simple cache implementation
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 30000; // 30 seconds default

  get<T>(key: string, ttl: number = this.defaultTTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }
}

const cache = new SimpleCache();

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
  isin: string;
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
  data_source: string;
  fair_value_source: string;
  alpha_vantage_fetched_at: string | null;
  grok_fetched_at: string | null;
  alpha_vantage_raw_json: string;
  grok_raw_json: string;
  comment: string;
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
  changeUsername: (currentPassword: string, newUsername: string) =>
    api.post('/change-username', {
      current_password: currentPassword,
      new_username: newUsername,
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
  updateSingle: (id: number, source?: 'grok' | 'alphavantage') => 
    api.post(`/stocks/${id}/update`, {}, { params: source ? { source } : {} }),
  updatePrice: (id: number, newPrice: number) => api.patch(`/stocks/${id}/price`, { current_price: newPrice }),
  updateField: (id: number, field: string, value: number | string) => {
    const payload: any = { field };
    if (typeof value === 'string') {
      payload.string_value = value;
      payload.value = value;
    } else {
      payload.value = value;
    }
    return api.patch(`/stocks/${id}/field`, payload);
  },
  getHistory: (id: number) => api.get<StockHistory[]>(`/stocks/${id}/history`),
  exportJSON: () => api.get('/export/json', { responseType: 'blob' }),
};

// Portfolio API with caching
export const portfolioAPI = {
  getSummary: async () => {
    const cacheKey = 'portfolio:summary';
    const cached = cache.get<{ summary: PortfolioMetrics; stocks: Stock[] }>(
      cacheKey,
      30000 // 30 seconds
    );

    if (cached) {
      return { data: cached };
    }

    const response = await api.get<{ summary: PortfolioMetrics; stocks: Stock[] }>(
      '/portfolio/summary'
    );
    cache.set(cacheKey, response.data);
    return response;
  },
  getSettings: () => api.get('/portfolio/settings'),
  updateSettings: (data: any) => api.put('/portfolio/settings', data),
  getAlerts: () => api.get<Alert[]>('/alerts'),
  deleteAlert: (id: number) => api.delete(`/alerts/${id}`),
  getAPIStatus: async () => {
    const cacheKey = 'api:status';
    const cached = cache.get<any>(cacheKey, 60000); // 60 seconds for API status

    if (cached) {
      return { data: cached };
    }

    const response = await api.get('/api-status');
    cache.set(cacheKey, response.data);
    return response;
  },
};

// Cache invalidation helper - export for use in components
export const invalidateCache = (pattern?: string) => {
  cache.invalidate(pattern);
};

// Deleted stocks API
export const deletedStockAPI = {
  getAll: () => api.get('/deleted-stocks'),
  restore: (id: number) => api.post(`/deleted-stocks/${id}/restore`),
};

// Version API
export const versionAPI = {
  getBackendVersion: () => api.get('/version'),
};

// Exchange Rate API
export interface ExchangeRate {
  id: number;
  currency_code: string;
  rate: number;
  last_updated: string;
  is_active: boolean;
  is_manual: boolean;
}

export interface CashHolding {
  id: number;
  currency_code: string;
  amount: number;
  usd_value: number;
  description: string;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

export const exchangeRateAPI = {
  getAll: () => api.get('/exchange-rates'),
  refresh: () => api.post('/exchange-rates/refresh'),
  add: (data: { currency_code: string; rate: number; is_manual: boolean }) => 
    api.post('/exchange-rates', data),
  update: (code: string, data: { rate: number; is_manual: boolean }) => 
    api.put(`/exchange-rates/${code}`, data),
  delete: (code: string) => api.delete(`/exchange-rates/${code}`),
};

// Cash Holdings API
export const cashAPI = {
  getAll: () => api.get<CashHolding[]>('/cash'),
  create: (data: { currency_code: string; amount: number; description?: string }) => 
    api.post<CashHolding>('/cash', data),
  update: (id: number, data: { amount: number; description?: string }) => 
    api.put<CashHolding>(`/cash/${id}`, data),
  delete: (id: number) => api.delete(`/cash/${id}`),
  refreshUSD: () => api.post('/cash/refresh'),
};

// Assessment API
export interface AssessmentRequest {
  ticker: string;
  source: 'grok' | 'deepseek';
}

export interface AssessmentResponse {
  ticker: string;
  source: string;
  assessment: string;
  created_at: string;
  status: 'pending' | 'completed' | 'failed';
}

export const assessmentAPI = {
  request: (data: AssessmentRequest) => 
    api.post<{ assessment: string }>('/assessment/request', data),
  getRecent: () => 
    api.get<AssessmentResponse[]>('/assessment/recent'),
  getById: (id: number) => 
    api.get<AssessmentResponse>(`/assessment/${id}`),
};

export default api;

