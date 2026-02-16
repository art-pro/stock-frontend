import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT = 30000;
// LLM-heavy endpoints may require substantially longer response times.
const ASSESSMENT_TIMEOUT = 180000;

// Maximum cache size to prevent memory leaks
const MAX_CACHE_SIZE = 100;

// Simple cache implementation with size limits
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 30000; // 30 seconds default
  private maxSize = MAX_CACHE_SIZE;

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
    // Enforce cache size limit by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

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

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    const keys = Array.from(this.cache.keys());
    keys.forEach((key) => {
      const entry = this.cache.get(key);
      if (entry && now - entry.timestamp > this.defaultTTL * 2) {
        this.cache.delete(key);
      }
    });
  }
}

const cache = new SimpleCache();

// Periodic cache cleanup (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

const api = axios.create({
  baseURL: API_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Type guard for Axios errors
function isAxiosError(error: unknown): error is AxiosError {
  return error !== null && typeof error === 'object' && 'isAxiosError' in error;
}

// Standardized error extraction
export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || error.message || 'An unexpected error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

// Add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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

// Handle authentication errors and network issues
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle authentication errors
    if (error.response?.status === 401) {
      Cookies.remove('token');
      // Only redirect if in browser context
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    } else if (!error.response) {
      console.error('Network error - no response received');
    }

    return Promise.reject(error);
  }
);

export interface Stock {
  id: number;
  portfolio_id?: number;
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
  buy_zone_status?: string;
  sell_zone_lower_bound?: number;
  sell_zone_upper_bound?: number;
  sell_zone_status?: string;
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

export interface PortfolioUnits {
  summary_total_value?: string;
  summary_ev?: string;
  summary_volatility?: string;
  stock_current_value?: string;
  stock_weight?: string;
  exchange_rate_base?: string;
  exchange_rate_semantic?: string;
}

export interface PortfolioSummaryResponse {
  summary: PortfolioMetrics;
  stocks: Stock[];
  units?: PortfolioUnits;
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

export interface FairValueHistoryEntry {
  id: number;
  stock_id: number;
  portfolio_id: number;
  ticker: string;
  fair_value: number;
  source: string;
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
  getAll: (portfolioId?: number) => api.get<Stock[]>('/stocks', { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  getBatch: (ids: number[], portfolioId?: number) =>
    api.get<Stock[]>('/stocks/batch', {
      params: {
        ids: ids.join(','),
        ...(portfolioId ? { portfolio_id: portfolioId } : {}),
      },
    }),
  getById: (id: number, portfolioId?: number) => api.get<Stock>(`/stocks/${id}`, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  create: (data: Partial<Stock>) => api.post<Stock>('/stocks', data),
  update: (id: number, data: Partial<Stock>) =>
    api.put<Stock>(`/stocks/${id}`, data),
  delete: (id: number, reason?: string, portfolioId?: number) =>
    api.delete(`/stocks/${id}`, { params: { reason, ...(portfolioId ? { portfolio_id: portfolioId } : {}) } }),
  updateAll: (portfolioId?: number) => api.post('/stocks/update-all', {}, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  bulkUpdate: (stocks: Partial<Stock>[], portfolioId?: number) => api.post('/stocks/bulk-update', { stocks }, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  updateSingle: (id: number, source?: 'grok' | 'alphavantage', portfolioId?: number) =>
    api.post(`/stocks/${id}/update`, {}, { params: { ...(source ? { source } : {}), ...(portfolioId ? { portfolio_id: portfolioId } : {}) } }),
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
  getHistory: (id: number, portfolioId?: number) => api.get<StockHistory[]>(`/stocks/${id}/history`, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  getFairValueHistory: (id: number, portfolioId?: number) =>
    api.get<FairValueHistoryEntry[]>(`/stocks/${id}/fair-value-history`, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  collectFairValues: (ids: number[], portfolioId?: number, signal?: AbortSignal) =>
    api.post('/stocks/fair-value/collect', { ids }, { params: portfolioId ? { portfolio_id: portfolioId } : {}, signal }),
  exportJSON: (portfolioId?: number) => api.get('/export/json', { responseType: 'blob', params: portfolioId ? { portfolio_id: portfolioId } : {} }),
};

// Portfolio API with caching
export const portfolioAPI = {
  getSummary: async (portfolioId?: number, options?: { forceRefresh?: boolean }) => {
    const cacheKey = `portfolio:summary:${portfolioId ?? 'default'}`;
    const forceRefresh = options?.forceRefresh === true;

    if (!forceRefresh) {
      const cached = cache.get<PortfolioSummaryResponse>(
        cacheKey,
        30000 // 30 seconds
      );

      if (cached) {
        return { data: cached };
      }
    }

    const response = await api.get<PortfolioSummaryResponse>(
      '/portfolio/summary',
      { params: portfolioId ? { portfolio_id: portfolioId } : {} }
    );
    cache.set(cacheKey, response.data);
    return response;
  },
  getSettings: () => api.get('/portfolio/settings'),
  updateSettings: (data: any) => api.put('/portfolio/settings', data),
  getAlerts: (portfolioId?: number) => api.get<Alert[]>('/alerts', { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  deleteAlert: (id: number, portfolioId?: number) => api.delete(`/alerts/${id}`, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
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
  getAll: () => api.get<ExchangeRate[]>('/exchange-rates'),
  refresh: () => api.post('/exchange-rates/refresh'),
  add: (data: { currency_code: string; rate: number; is_manual: boolean }) => 
    api.post('/exchange-rates', data),
  update: (code: string, data: { rate: number; is_manual: boolean }) => 
    api.put(`/exchange-rates/${code}`, data),
  delete: (code: string) => api.delete(`/exchange-rates/${code}`),
};

// Cash Holdings API
export const cashAPI = {
  getAll: (portfolioId?: number) => api.get<CashHolding[]>('/cash', { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
  create: (data: { currency_code: string; amount: number; description?: string }) => 
    api.post<CashHolding>('/cash', data),
  update: (id: number, data: { amount: number; description?: string }) => 
    api.put<CashHolding>(`/cash/${id}`, data),
  delete: (id: number) => api.delete(`/cash/${id}`),
  refreshUSD: (portfolioId?: number) => api.post('/cash/refresh', {}, { params: portfolioId ? { portfolio_id: portfolioId } : {} }),
};

// Assessment API
export interface AssessmentRequest {
  ticker: string;
  source: 'grok' | 'deepseek';
  company_name?: string;
  current_price?: number;
  currency?: string;
  /** Dashboard pane: sector rebalance hint (over/at/under target) */
  rebalance_hint?: string;
  /** Dashboard pane: concentration & tail risk */
  concentration_hint?: string;
  /** Dashboard pane: suggested next actions */
  suggested_actions_hint?: string;
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
    api.post<{ assessment: string }>('/assessment/request', data, { timeout: ASSESSMENT_TIMEOUT }),
  extractFromImages: (images: string[], source?: 'grok' | 'deepseek') =>
    api.post<any>('/assessment/extract-from-images', { images, source }, { timeout: ASSESSMENT_TIMEOUT }),
  getRecent: () => 
    api.get<AssessmentResponse[]>('/assessment/recent'),
  getById: (id: number) => 
    api.get<AssessmentResponse>(`/assessment/${id}`),
};

// User Settings API
export const settingsAPI = {
  getColumnSettings: () => api.get<{ settings: string }>('/settings/columns'),
  saveColumnSettings: (settings: string) =>
    api.post('/settings/columns', { settings }),
  getSectorTargets: () =>
    api.get<{ rows: SectorTargetRow[] | null }>('/settings/sector-targets'),
  saveSectorTargets: (payload: { rows: SectorTargetRow[] }) =>
    api.post('/settings/sector-targets', payload),
};

export interface SectorTargetRow {
  sector: string;
  min: number;
  max: number;
  rationale: string;
}

export default api;

