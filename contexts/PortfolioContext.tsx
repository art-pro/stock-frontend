'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { portfolioAPI, Portfolio } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

interface PortfolioContextType {
  portfolios: Portfolio[];
  currentPortfolio: Portfolio | null;
  loading: boolean;
  error: string | null;
  setCurrentPortfolio: (portfolio: Portfolio) => void;
  refreshPortfolios: () => Promise<void>;
  createPortfolio: (data: { name: string; description?: string; is_default?: boolean }) => Promise<Portfolio>;
  updatePortfolio: (portfolioId: number, data: { name?: string; description?: string }) => Promise<Portfolio>;
  deletePortfolio: (portfolioId: number) => Promise<void>;
  setDefaultPortfolio: (portfolioId: number) => Promise<Portfolio>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentPortfolio, setCurrentPortfolioState] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load portfolios on mount
  useEffect(() => {
    if (isAuthenticated()) {
      loadPortfolios();
    } else {
      setLoading(false);
    }
  }, []);

  const loadPortfolios = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await portfolioAPI.getAll();
      const portfolioList = response.data.portfolios || [];
      setPortfolios(portfolioList);

      // Set current portfolio to default or first one
      const defaultPortfolio = portfolioList.find(p => p.is_default) || portfolioList[0] || null;
      setCurrentPortfolioState(defaultPortfolio);

      // Store current portfolio ID in localStorage
      if (defaultPortfolio) {
        localStorage.setItem('currentPortfolioId', defaultPortfolio.id.toString());
      }
    } catch (err: any) {
      console.error('Failed to load portfolios:', err);
      setError('Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  };

  const setCurrentPortfolio = (portfolio: Portfolio) => {
    setCurrentPortfolioState(portfolio);
    localStorage.setItem('currentPortfolioId', portfolio.id.toString());
  };

  const refreshPortfolios = async () => {
    await loadPortfolios();
  };

  const createPortfolio = async (data: { name: string; description?: string; is_default?: boolean }): Promise<Portfolio> => {
    try {
      const response = await portfolioAPI.create(data);
      const newPortfolio = response.data.portfolio;
      await refreshPortfolios();
      return newPortfolio;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to create portfolio');
    }
  };

  const updatePortfolio = async (portfolioId: number, data: { name?: string; description?: string }): Promise<Portfolio> => {
    try {
      const response = await portfolioAPI.update(portfolioId, data);
      const updatedPortfolio = response.data.portfolio;
      await refreshPortfolios();
      return updatedPortfolio;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to update portfolio');
    }
  };

  const deletePortfolio = async (portfolioId: number): Promise<void> => {
    try {
      await portfolioAPI.delete(portfolioId);
      await refreshPortfolios();
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to delete portfolio');
    }
  };

  const setDefaultPortfolio = async (portfolioId: number): Promise<Portfolio> => {
    try {
      const response = await portfolioAPI.setDefault(portfolioId);
      const updatedPortfolio = response.data.portfolio;
      await refreshPortfolios();
      return updatedPortfolio;
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to set default portfolio');
    }
  };

  return (
    <PortfolioContext.Provider
      value={{
        portfolios,
        currentPortfolio,
        loading,
        error,
        setCurrentPortfolio,
        refreshPortfolios,
        createPortfolio,
        updatePortfolio,
        deletePortfolio,
        setDefaultPortfolio,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
