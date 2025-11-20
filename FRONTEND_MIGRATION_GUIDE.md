# Frontend Migration Guide: Multi-Portfolio Support

This document outlines the changes needed in the frontend application to support the new multi-portfolio functionality.

## Overview

The backend has been completely restructured to support multiple portfolios per user. Each user can now create, manage, and switch between multiple portfolios. All stocks, settings, and related data are now scoped to specific portfolios.

## Database Schema Changes

### New Tables
- **portfolios**: Stores portfolio information
  - `id` (uint): Primary key
  - `user_id` (uint): Foreign key to users table
  - `name` (string): Portfolio name
  - `description` (string): Optional description
  - `is_default` (bool): Marks the default portfolio
  - `created_at`, `updated_at` (timestamps)

### Modified Tables
All these tables now have a `portfolio_id` foreign key:
- `stocks`
- `stock_histories`
- `deleted_stocks`
- `portfolio_settings`
- `assessments`
- `cash_holdings`
- `alerts`

## API Changes

### New Endpoints

#### Portfolio Management

##### GET `/api/portfolios`
Get all portfolios for the current user.

**Response:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "Default Portfolio",
    "description": "My main investment portfolio",
    "is_default": true,
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z"
  }
]
```

##### GET `/api/portfolios/:id`
Get a specific portfolio by ID.

**Response:**
```json
{
  "id": 1,
  "user_id": 1,
  "name": "Default Portfolio",
  "description": "My main investment portfolio",
  "is_default": true,
  "stocks": [...],
  "created_at": "2025-01-20T10:00:00Z",
  "updated_at": "2025-01-20T10:00:00Z"
}
```

##### POST `/api/portfolios`
Create a new portfolio.

**Request:**
```json
{
  "name": "Growth Portfolio",
  "description": "High-growth stocks"
}
```

**Response:**
```json
{
  "id": 2,
  "user_id": 1,
  "name": "Growth Portfolio",
  "description": "High-growth stocks",
  "is_default": false,
  "created_at": "2025-01-20T11:00:00Z",
  "updated_at": "2025-01-20T11:00:00Z"
}
```

##### PUT `/api/portfolios/:id`
Update an existing portfolio.

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

##### DELETE `/api/portfolios/:id`
Delete a portfolio (cannot delete default portfolio or if it has stocks).

**Response:**
```json
{
  "message": "Portfolio deleted successfully"
}
```

##### POST `/api/portfolios/:id/set-default`
Set a portfolio as the default.

**Response:**
```json
{
  "message": "Portfolio set as default successfully"
}
```

### Modified Endpoints

All stock-related endpoints now require a `portfolio_id` parameter or work with the default portfolio:

#### GET `/api/stocks`
**Query Parameters:**
- `portfolio_id` (optional): Filter stocks by portfolio. If not provided, uses the default portfolio.

**Response:**
```json
[
  {
    "id": 1,
    "portfolio_id": 1,
    "ticker": "AAPL",
    "company_name": "Apple Inc.",
    ...
  }
]
```

#### POST `/api/stocks`
**Request:**
```json
{
  "portfolio_id": 1,
  "ticker": "GOOGL",
  "company_name": "Alphabet Inc.",
  "sector": "Technology",
  "currency": "USD",
  "shares_owned": 10,
  "avg_price_local": 140.5
}
```

**Note:** If `portfolio_id` is not provided, the stock will be added to the user's default portfolio.

#### GET `/api/portfolios/:portfolio_id/stocks`
Alternative endpoint to get all stocks for a specific portfolio.

#### GET `/api/portfolios/:portfolio_id/stats`
Get portfolio statistics (total value, allocation, performance, etc.).

**Response:**
```json
{
  "portfolio_id": 1,
  "total_value_usd": 50000.00,
  "total_stocks": 15,
  "total_unrealized_pnl": 5000.00,
  "total_weight": 100.0,
  "top_holdings": [...]
}
```

### Settings Endpoints

#### GET `/api/portfolios/:portfolio_id/settings`
Get settings for a specific portfolio.

#### PUT `/api/portfolios/:portfolio_id/settings`
Update settings for a specific portfolio.

**Request:**
```json
{
  "total_portfolio_value": 100000.00,
  "update_frequency": "daily",
  "alerts_enabled": true,
  "alert_threshold_ev": 5.0
}
```

### Cash Holdings Endpoints

#### GET `/api/portfolios/:portfolio_id/cash`
Get all cash holdings for a specific portfolio.

#### POST `/api/portfolios/:portfolio_id/cash`
Add cash holding to a portfolio.

### Deleted Stocks Endpoints

#### GET `/api/portfolios/:portfolio_id/deleted-stocks`
Get deleted stocks for a specific portfolio.

### Stock History Endpoints

#### GET `/api/portfolios/:portfolio_id/stocks/:stock_id/history`
Get history for a specific stock in a portfolio.

### Assessment Endpoints

#### POST `/api/portfolios/:portfolio_id/stocks/:ticker/assessment`
Generate AI assessment for a stock in the context of a specific portfolio.

## Frontend Implementation Guide

### 1. Portfolio Context/State Management

Create a global context or state to track the currently selected portfolio:

```typescript
// portfolioContext.ts
interface Portfolio {
  id: number;
  user_id: number;
  name: string;
  description: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface PortfolioContextType {
  portfolios: Portfolio[];
  currentPortfolio: Portfolio | null;
  setCurrentPortfolio: (portfolio: Portfolio) => void;
  refreshPortfolios: () => Promise<void>;
}
```

### 2. Portfolio Selector Component

Add a dropdown or selector in the main navigation to switch between portfolios:

```typescript
function PortfolioSelector() {
  const { portfolios, currentPortfolio, setCurrentPortfolio } = usePortfolioContext();

  return (
    <select
      value={currentPortfolio?.id}
      onChange={(e) => {
        const portfolio = portfolios.find(p => p.id === parseInt(e.target.value));
        setCurrentPortfolio(portfolio);
      }}
    >
      {portfolios.map(p => (
        <option key={p.id} value={p.id}>
          {p.name} {p.is_default && '(Default)'}
        </option>
      ))}
    </select>
  );
}
```

### 3. Portfolio Management Page

Create a new page for managing portfolios:

**Features:**
- List all portfolios
- Create new portfolio
- Edit portfolio name/description
- Delete portfolio (with confirmation)
- Set default portfolio
- View portfolio statistics

### 4. Update Stock API Calls

Modify all stock-related API calls to include the portfolio_id:

```typescript
// Before
const fetchStocks = async () => {
  const response = await fetch('/api/stocks');
  return response.json();
};

// After
const fetchStocks = async (portfolioId: number) => {
  const response = await fetch(`/api/stocks?portfolio_id=${portfolioId}`);
  // OR
  const response = await fetch(`/api/portfolios/${portfolioId}/stocks`);
  return response.json();
};
```

### 5. Update Stock Addition/Edit Forms

Add portfolio selection to stock forms:

```typescript
function AddStockForm() {
  const { portfolios, currentPortfolio } = usePortfolioContext();
  const [selectedPortfolio, setSelectedPortfolio] = useState(currentPortfolio?.id);

  const handleSubmit = async (data) => {
    await fetch('/api/stocks', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        portfolio_id: selectedPortfolio
      })
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <select value={selectedPortfolio} onChange={(e) => setSelectedPortfolio(e.target.value)}>
        {portfolios.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {/* Other form fields */}
    </form>
  );
}
```

### 6. Dashboard Updates

Update the dashboard to:
- Show portfolio-specific statistics
- Allow filtering/switching between portfolios
- Display portfolio selector prominently
- Show portfolio name in page title

### 7. Settings Page Updates

Update settings page to be portfolio-specific:
- Load settings for the current portfolio
- Save settings to the current portfolio
- Option to copy settings from another portfolio

### 8. URL Routing

Consider adding portfolio ID to URL routes:

```
/portfolios/:portfolioId/stocks
/portfolios/:portfolioId/dashboard
/portfolios/:portfolioId/settings
/portfolios/manage
```

### 9. Default Behavior

When no portfolio is explicitly selected:
- Use the user's default portfolio
- After login, automatically load the default portfolio
- Show a message if user has no portfolios (shouldn't happen as backend creates default portfolio)

## Migration Strategy

### Phase 1: Backend Compatibility
- Backend is backward compatible - endpoints without `portfolio_id` will use the default portfolio
- Frontend can continue working without changes initially

### Phase 2: Add Portfolio Context
- Add portfolio context/state management
- Load portfolios on app initialization
- Set current portfolio to default

### Phase 3: Add Portfolio Selector
- Add portfolio selector to navigation
- Update all API calls to use current portfolio ID

### Phase 4: Portfolio Management
- Add portfolio management page
- Implement create/edit/delete/set-default functionality

### Phase 5: Enhanced Features
- Portfolio comparison views
- Portfolio performance analytics
- Portfolio cloning/templates

## Testing Checklist

- [ ] Can create a new portfolio
- [ ] Can switch between portfolios
- [ ] Stocks are properly filtered by portfolio
- [ ] Can add stocks to specific portfolios
- [ ] Can edit portfolio details
- [ ] Can set a portfolio as default
- [ ] Cannot delete default portfolio
- [ ] Cannot delete portfolio with stocks
- [ ] Settings are portfolio-specific
- [ ] Cash holdings are portfolio-specific
- [ ] Deleted stocks show correct portfolio
- [ ] Stock history is portfolio-specific
- [ ] AI assessments consider portfolio context
- [ ] Default portfolio is used when none selected

## Notes

1. **Backward Compatibility**: The backend maintains backward compatibility. If no `portfolio_id` is specified, the default portfolio is used.

2. **Default Portfolio**: Every user automatically has a default portfolio created during migration. This portfolio contains all their existing stocks.

3. **Portfolio Deletion**: A portfolio can only be deleted if:
   - It is not the default portfolio
   - It has no stocks
   - Use the "Empty and Delete" feature to move stocks to another portfolio first

4. **Data Isolation**: All portfolio data is strictly isolated. Users can only access their own portfolios.

5. **Performance**: Consider implementing lazy loading and caching for portfolio lists and stock data.

## Environment Variables

No new environment variables are required for the frontend. The backend handles all portfolio logic.

## Questions or Issues?

If you encounter any issues or have questions about the implementation, please refer to the backend codebase or contact the development team.
