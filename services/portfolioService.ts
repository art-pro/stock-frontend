import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Set up axios with auth
axios.defaults.withCredentials = true;

export interface Portfolio {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePortfolioRequest {
  name: string;
  description?: string;
}

export interface UpdatePortfolioRequest {
  name: string;
  description?: string;
  is_default?: boolean;
}

class PortfolioService {
  // Get all portfolios
  async getAllPortfolios(): Promise<Portfolio[]> {
    const response = await axios.get(`${API_URL}/portfolios`);
    return response.data;
  }

  // Get portfolio by ID
  async getPortfolioById(id: number): Promise<Portfolio> {
    const response = await axios.get(`${API_URL}/portfolios/${id}`);
    return response.data;
  }

  // Create new portfolio
  async createPortfolio(portfolio: CreatePortfolioRequest): Promise<Portfolio> {
    const response = await axios.post(`${API_URL}/portfolios`, portfolio);
    return response.data;
  }

  // Update portfolio
  async updatePortfolio(id: number, portfolio: UpdatePortfolioRequest): Promise<Portfolio> {
    const response = await axios.put(`${API_URL}/portfolios/${id}`, portfolio);
    return response.data;
  }

  // Delete portfolio
  async deletePortfolio(id: number): Promise<void> {
    await axios.delete(`${API_URL}/portfolios/${id}`);
  }

  // Get stocks in a portfolio
  async getPortfolioStocks(id: number): Promise<any[]> {
    const response = await axios.get(`${API_URL}/portfolios/${id}/stocks`);
    return response.data;
  }

  // Set portfolio as default
  async setDefaultPortfolio(id: number): Promise<void> {
    await axios.post(`${API_URL}/portfolios/${id}/set-default`);
  }
}

export default new PortfolioService();