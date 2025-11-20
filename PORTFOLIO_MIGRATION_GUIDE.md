# Portfolio Management Implementation Guide

## Version 1.7.0 - Multi-Portfolio Support

This document describes the comprehensive multi-portfolio management features added to the frontend.

## What's New

### 1. Full CRUD Operations for Portfolios

The frontend now supports all portfolio management operations documented in the backend API:

- ✅ **Create** new portfolios with name, description, and default flag
- ✅ **Read** all portfolios and individual portfolio details
- ✅ **Update** portfolio name and description
- ✅ **Delete** portfolios (with safety checks)
- ✅ **Set Default** portfolio functionality

### 2. New Components and Files

#### Created Files:
1. **`/contexts/PortfolioContext.tsx`** - Global state management for portfolios
   - Manages portfolio list
   - Tracks currently selected portfolio
   - Provides CRUD operations
   - Handles loading and error states

2. **`/app/portfolios/page.tsx`** - Portfolio management UI
   - Grid view of all portfolios
   - Live portfolio statistics (total value, EV, Sharpe ratio, volatility, stock count)
   - Create/Edit/Delete modals
   - Set default portfolio functionality
   - Visual indicators for current and default portfolios

#### Updated Files:
1. **`/lib/api.ts`** - Added portfolio API endpoints
   - `Portfolio` interface
   - Multi-portfolio CRUD endpoints
   - Portfolio-specific operations (summary, settings, alerts)
   - Maintains backward compatibility with legacy endpoints

2. **`/app/layout.tsx`** - Wrapped app with PortfolioProvider

3. **`/app/dashboard/page.tsx`** - Added "Portfolios" navigation button

4. **`/package.json`** & **`/lib/version.ts`** - Updated to version 1.7.0

### 3. API Endpoints Supported

All endpoints from `FRONTEND_API_ENDPOINTS.md` are now implemented:

#### Portfolio Management:
- `GET /api/portfolios` - Get all portfolios
- `POST /api/portfolios` - Create portfolio
- `GET /api/portfolios/default` - Get default portfolio
- `GET /api/portfolios/:portfolioId` - Get specific portfolio
- `PUT /api/portfolios/:portfolioId` - Update portfolio
- `DELETE /api/portfolios/:portfolioId` - Delete portfolio
- `POST /api/portfolios/:portfolioId/set-default` - Set default portfolio

#### Portfolio-Specific Operations:
- `GET /api/portfolios/:portfolioId/summary` - Get portfolio summary
- `GET /api/portfolios/:portfolioId/settings` - Get portfolio settings
- `PUT /api/portfolios/:portfolioId/settings` - Update portfolio settings
- `GET /api/portfolios/:portfolioId/alerts` - Get portfolio alerts
- `DELETE /api/portfolios/:portfolioId/alerts/:alertId` - Delete alert

## Features

### Portfolio Context (`PortfolioContext.tsx`)

The Portfolio Context provides global state management for portfolios throughout the app:

```typescript
const {
  portfolios,          // Array of all portfolios
  currentPortfolio,    // Currently selected portfolio
  loading,             // Loading state
  error,               // Error message
  setCurrentPortfolio, // Switch active portfolio
  refreshPortfolios,   // Reload portfolio list
  createPortfolio,     // Create new portfolio
  updatePortfolio,     // Update existing portfolio
  deletePortfolio,     // Delete portfolio
  setDefaultPortfolio, // Set default portfolio
} = usePortfolio();
```

### Portfolio Management Page (`/portfolios`)

Comprehensive UI for managing portfolios:

1. **Grid View**
   - Card-based layout showing all portfolios
   - Live statistics for each portfolio:
     - Total value (USD)
     - Expected value (EV %)
     - Sharpe ratio
     - Volatility
     - Stock count

2. **Visual Indicators**
   - ⭐ Yellow star badge for default portfolio
   - Border highlight for currently selected portfolio
   - Color-coded action buttons

3. **Create Portfolio Modal**
   - Name field (required)
   - Description field (optional)
   - Set as default checkbox
   - Form validation

4. **Edit Portfolio Modal**
   - Pre-filled with current values
   - Update name and description
   - Cannot change default status (use "Set Default" button)

5. **Delete Portfolio Modal**
   - Confirmation dialog
   - Safety checks:
     - Cannot delete default portfolio
     - Cannot delete portfolios with stocks
   - Clear warning messages

6. **Additional Actions**
   - "Select Portfolio" - Sets portfolio as current and navigates to dashboard
   - "Set Default" - Makes portfolio the default for the user
   - "Edit" - Opens edit modal
   - "Delete" - Opens delete confirmation

## Safety Features

### Delete Protection
1. **Default Portfolio**: Cannot delete the portfolio marked as default
   - Error message: "Cannot delete the default portfolio. Set another portfolio as default first."

2. **Non-Empty Portfolio**: Cannot delete portfolios containing stocks
   - Error message: "Cannot delete portfolio with X stocks. Remove all stocks first."

### Data Integrity
- Portfolio statistics are loaded fresh each time the page is accessed
- After any CRUD operation, portfolio list is refreshed automatically
- Current portfolio selection is persisted in localStorage

## User Flow

### Creating a New Portfolio
1. Navigate to Portfolios page via dashboard button
2. Click "Create Portfolio" button
3. Enter name (required) and description (optional)
4. Optionally check "Set as default portfolio"
5. Click "Create"
6. New portfolio appears in grid with statistics

### Switching Portfolios
1. Go to Portfolios page
2. Find desired portfolio in grid
3. Click "Select Portfolio" button
4. Automatically redirected to dashboard with new portfolio

### Setting Default Portfolio
1. Find portfolio in grid
2. Click "Set Default" button
3. Yellow star badge appears on portfolio
4. This portfolio will be used by default on login

### Editing a Portfolio
1. Click "Edit" button on portfolio card
2. Modify name and/or description
3. Click "Save Changes"
4. Portfolio updates immediately

### Deleting a Portfolio
1. Ensure portfolio is not default
2. Ensure portfolio has no stocks
3. Click "Delete" button
4. Confirm in modal
5. Portfolio is removed

## Navigation

New navigation button added to dashboard header:
- **Portfolios** button (purple, with briefcase icon)
- Located between API status and Assessment button
- Always visible to authenticated users

## Backward Compatibility

The implementation maintains full backward compatibility:
- Legacy endpoints still work (use default portfolio automatically)
- Existing single-portfolio functionality remains unchanged
- No breaking changes to existing components

## Technical Implementation

### State Management
- Global state via React Context API
- Automatic loading on authentication
- Local storage for persistence
- Error handling and loading states

### API Integration
- Type-safe TypeScript interfaces
- Axios-based HTTP client
- JWT token authentication
- Error response handling

### UI/UX
- Dark mode design matching existing theme
- Responsive grid layout (1-3 columns based on screen size)
- Accessible modals with keyboard support
- Loading skeletons for async operations
- Color-coded status indicators

## Future Enhancements (Not Yet Implemented)

The following features are defined in the backend API but not yet implemented in the UI:

1. **Cash Holdings per Portfolio**
   - Currently using legacy endpoints
   - Should be updated to portfolio-specific endpoints

2. **Stock Management per Portfolio**
   - Stock operations still use legacy endpoints
   - Should be updated to `/api/portfolios/:portfolioId/stocks/*`

3. **Portfolio Import/Export**
   - CSV export/import endpoints available
   - JSON export currently uses legacy endpoint

4. **Deleted Stocks per Portfolio**
   - Backend supports portfolio-specific deleted stocks
   - Frontend still uses legacy endpoint

5. **Portfolio History**
   - Backend supports stock history per portfolio
   - Not yet integrated in frontend

## Migration Path

For developers wanting to fully migrate to portfolio-specific endpoints:

1. Update `StockTable` component to accept `portfolioId` prop
2. Modify stock API calls to use portfolio-specific endpoints
3. Update cash management to use portfolio-specific endpoints
4. Add portfolio selector dropdown to dashboard header
5. Update deleted stocks page to use portfolio-specific endpoint
6. Implement portfolio-specific import/export

## Testing

To test the implementation:

1. **Create Portfolio**: Go to Portfolios page, create new portfolio
2. **View Stats**: Verify all statistics load correctly
3. **Switch Portfolio**: Select different portfolio, verify dashboard updates
4. **Set Default**: Set a portfolio as default, verify star badge appears
5. **Edit Portfolio**: Change name/description, verify updates persist
6. **Delete Attempt (Default)**: Try to delete default portfolio, verify error
7. **Delete Attempt (With Stocks)**: Try to delete portfolio with stocks, verify error
8. **Delete Success**: Delete empty, non-default portfolio, verify removal

## Version History

- **1.7.0** (2025-11-20): Full multi-portfolio CRUD support added
  - Portfolio Context for state management
  - Portfolio management page with complete CRUD UI
  - Navigation integration
  - Safety features and validation

## Support

For issues or questions:
- Check backend API documentation: `/stock-backend/FRONTEND_API_ENDPOINTS.md`
- Review this guide for usage instructions
- Examine PortfolioContext for state management patterns
