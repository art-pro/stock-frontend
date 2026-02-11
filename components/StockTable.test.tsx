import { fireEvent, render, screen } from '@testing-library/react';
import StockTable from './StockTable';
import { Stock } from '@/lib/api';

jest.mock('next/link', () => {
  return function MockLink(props: any) {
    return <a href={props.href}>{props.children}</a>;
  };
});

jest.mock('@/hooks/useColumnSettings', () => ({
  useColumnSettings: () => ({
    getVisibleColumns: () => [
      { id: 'checkbox', order: 0 },
      { id: 'ticker', order: 1 },
      { id: 'company_name', order: 2 },
      { id: 'unrealized_pnl', order: 3 },
      { id: 'actions', order: 4 },
    ],
    isColumnVisible: () => true,
  }),
}));

const baseStock: Stock = {
  id: 1,
  ticker: 'AAPL',
  company_name: 'Apple Inc.',
  isin: '',
  sector: 'Tech',
  current_price: 100,
  currency: 'USD',
  fair_value: 120,
  upside_potential: 20,
  downside_risk: -20,
  probability_positive: 0.65,
  expected_value: 10,
  beta: 1,
  volatility: 20,
  pe_ratio: 20,
  eps_growth_rate: 10,
  debt_to_ebitda: 1,
  dividend_yield: 1,
  b_ratio: 1,
  kelly_fraction: 10,
  half_kelly_suggested: 5,
  shares_owned: 10,
  avg_price_local: 90,
  current_value_usd: 1000,
  weight: 10,
  unrealized_pnl: 100,
  buy_zone_min: 80,
  buy_zone_max: 95,
  assessment: 'Add',
  update_frequency: 'daily',
  data_source: 'Manual',
  fair_value_source: '',
  alpha_vantage_fetched_at: null,
  grok_fetched_at: null,
  alpha_vantage_raw_json: '',
  grok_raw_json: '',
  comment: '',
  last_updated: new Date().toISOString(),
};

describe('stock table subsystem', () => {
  it('calls onSelectStock when row checkbox is toggled', () => {
    const onSelectStock = jest.fn();

    render(
      <StockTable
        stocks={[baseStock]}
        onDelete={jest.fn()}
        onUpdate={jest.fn()}
        onPriceUpdate={jest.fn()}
        onFieldUpdate={jest.fn()}
        onSelectStock={onSelectStock}
        selectedStockIds={[]}
      />
    );

    const [rowCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.click(rowCheckbox);

    expect(onSelectStock).toHaveBeenCalledWith(1);
  });

  it('renders P&L column with currency unit from backend units metadata', () => {
    render(
      <StockTable
        stocks={[baseStock]}
        onDelete={jest.fn()}
        onUpdate={jest.fn()}
        onPriceUpdate={jest.fn()}
        onFieldUpdate={jest.fn()}
        units={{ stock_current_value: 'EUR' }}
      />
    );

    expect(screen.getByText('P&L (EUR)')).toBeInTheDocument();
  });
});
