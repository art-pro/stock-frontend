# Stock Frontend Context Guide

This document is the authoritative context for frontend development and AI-assisted work in `stock-frontend`.

## What This Frontend Is

A Next.js App Router client UI for a probabilistic stock portfolio system.

Primary responsibilities:
- Show portfolio state from backend (not recalculate core quant formulas)
- Provide editable stock/cash/settings workflows
- Surface EV/Kelly-based decisions clearly
- Preserve unit and currency semantics from backend
- Offer AI assessment and screenshot-to-JSON ingestion UX

## Stack and Runtime

- Framework: Next.js 16 (`app/` router), React 19, TypeScript
- Styling: Tailwind CSS v4 + PostCSS
- Data layer: Axios-based client in `lib/api.ts`
- Auth state: JWT token in cookies (`js-cookie`)
- Charts/markdown: `chart.js`, `react-chartjs-2`, `react-markdown`

Scripts (`package.json`):
- `npm run dev`
- `npm run build` -> `next build --webpack`
- `npm run lint` -> `eslint .`

## Architecture and UI Subsystems

- `app/dashboard/page.tsx`  
  Main operational surface: summary, stock tables, bulk/single updates, import/export, quick tools.
- `components/PortfolioSummary.tsx`  
  Portfolio-level KPIs + sector pie chart; merges stock summary with cash.
- `components/StockTable.tsx`  
  Configurable table for portfolio and watchlist modes; sorting, filtering, inline edits, actions. Active Positions and Watchlist are grouped by sector (subtables with sector header). Active Positions show current sector % and desired exposure (target range) in each sector header. Notes column shows a (?) icon; hover or click reveals the stock’s Notes & Comments (`stock.comment`).
- `lib/sectorTargets.ts`  
  Desired sector exposure (target min–max %) from core philosophy; used in Active Positions sector headers. Case-insensitive lookup by sector name.
- `app/stocks/[id]/page.tsx`  
  Deep-dive stock details, editable fields, data-source transparency, historical chart, notes/comments.
- `components/CashManagementTable.tsx`  
  Cash CRUD and conversion display.
- `components/ExchangeRateTable.tsx`  
  FX management UI for tracked currencies/rates.
- `app/assessment/page.tsx`  
  Single-ticker AI assessment and image extraction workflow.
- `app/settings/page.tsx` + `hooks/useColumnSettings.ts`  
  User/password/portfolio settings + persistent column-visibility/order settings.
- `lib/api.ts`  
  API contracts, request methods, lightweight cache layer, cache invalidation helper.
- `lib/auth.ts`  
  Cookie token helpers for client auth state.

## Product Principles (Frontend)

1. **Backend is quantitative source of truth**
   - Frontend displays and edits inputs; backend computes EV/Kelly/assessment.
2. **Unit correctness over convenience**
   - UI must respect backend `units` metadata where provided.
3. **Decision visibility**
   - Add/Hold/Trim/Sell and EV thresholds must be legible and consistent across screens.
4. **Fast, safe interactions**
   - Client caching reduces request volume; mutations invalidate relevant cache keys.
5. **Explainability**
   - Tooltips and labels should map to actual formulas and thresholds used by backend.

## Data Flow and API Contract

Defined in `lib/api.ts`.

### Core contract
- Dashboard and primary portfolio state comes from:
  - `GET /portfolio/summary` -> `{ summary, stocks, units }`
- `summary` maps to `PortfolioMetrics`
- `stocks` maps to `Stock[]`
- `units` maps to `PortfolioUnits` (currency/semantic metadata)

### Mutations and refresh model
- Stock edits/updates/deletes call stock endpoints.
- After mutation, code generally calls:
  - `invalidateCache('portfolio')`
  - then `fetchData()` to refetch summary/stocks.

### Client cache layer
- Implemented in `SimpleCache` in `lib/api.ts`.
- TTL defaults:
  - portfolio summary: 30s
  - API status: 60s
- Invalidated on common mutations via `invalidateCache`.

## Calculations and Decision-Making Semantics in UI (Critical)

The frontend should align with backend formulas and action bands from `pkg/services/calculations.go`.

### Backend quantitative definitions (must be mirrored in text/UX)
- `EV = p*upside + (1-p)*downside`
- `b = upside / |downside|`
- `Kelly f* = ((b*p) - (1-p)) / b`
- `Half-Kelly = min(f*/2, 15%)`
- Current action bands:
  - Add: `EV > 7`
  - Hold: `3 <= EV <= 7`
  - Trim: `0 <= EV < 3`
  - Sell: `EV < 0`

### Where frontend reflects decisions
- `components/StockTable.tsx`
  - EV color coding and action badge rendering
  - Buy zone limit columns (`Buy Zone Min`, `Buy Zone Max`) with currency-aware display and sorting
  - Sell zone columns (`Sell Zone Min`, `Sell Zone Max`, `Sell Zone Status`) for trim/sell discipline
  - Sector grouping (subtables) and, in Active Positions, sector current % and target range in header (from `lib/sectorTargets.ts`)
  - Notes column: (?) icon to show `stock.comment` (Notes & Comments) on hover or click
  - tooltips for metric meaning
- `components/PortfolioSummary.tsx`
  - overall EV, Sharpe, volatility, Kelly utilization displays
- `app/stocks/[id]/page.tsx`
  - per-stock metrics and action interpretation text/tooltips
  - dedicated sell-zone cards (min/max/status) aligned to backend EV thresholds
- `app/assessment/page.tsx`
  - user-facing strategy description

### Unit and currency display rules
- Backend rates semantics: `rate = currency units per 1 EUR`.
- Portfolio total in summary is EUR (unless backend units later changed).
- Stock value/PnL fields often displayed in USD due to `current_value_usd` / `unrealized_pnl`.
- `StockTable` uses `units?.stock_current_value` for P&L header/formatting.
- `PortfolioSummary` uses `units?.summary_total_value` for total value formatting.

## Multi-Currency Handling in Frontend

### Portfolio + cash display
- `PortfolioSummary` loads cash + exchange rates and converts non-EUR cash from USD to EUR:
  - `eur = usd_value / usdPerEurRate`
- `CashManagementTable` performs the same display-side conversion for EUR-equivalent totals.

### Operational expectation
- Conversion semantics must remain consistent with backend:
  - local -> EUR via division by rate
  - EUR -> USD via multiplication by USD rate

## Key User Workflows

1. **Dashboard operations**
   - View active positions + watchlist, each grouped by sector (subtables; sector name in header; Active Positions also show current % and target range per sector)
   - select subset and update from Alpha Vantage or Grok
   - run trusted fair-value sync for selected active positions (Grok + Deepseek backend collection)
   - review buy zone limits directly in table columns (`Buy Zone Min`, `Buy Zone Max`)
   - review sell-zone thresholds directly in table columns (`Sell Zone Min`, `Sell Zone Max`, `Sell Zone Status`)
   - view Notes & Comments per stock via the Notes column (?) icon (hover or click)
   - inline edits for core numeric inputs
   - import/export JSON
2. **Stock detail editing**
   - granular edits with calculated-vs-editable separation
   - source transparency modal for raw provider payloads
   - view source-level fair value history table (`Date`, `Fair value`, `Source`)
   - notes/comments editing
3. **Cash and FX management**
   - maintain cash by currency
   - refresh conversion-dependent values
4. **AI assessment**
   - request narrative assessment per ticker
   - parse and edit extracted JSON from screenshot pipeline
5. **Settings**
   - auth settings and portfolio settings
   - persistent customizable table columns (includes buy zone, sell zone, and Notes column visibility/order)

## Sector Grouping and Desired Exposure (v2.7.0)

- **Active Positions** and **Watchlist** tables are grouped by sector: each sector is a subtable with a header row and then the stock rows. The Sector column is hidden when grouped.
- **Active Positions** sector headers show: sector name, current percentage of equity portfolio (from backend `summary.sector_weights`), and desired exposure when defined (e.g. `Healthcare (46.8%, target 30–35%)`). Targets come from `lib/sectorTargets.ts` (core philosophy).
- **Target ranges** (equity only; cash buffer 8–12% is separate): Healthcare 30–35%, Technology 15%, Communication Services 10–15%, Financials 10–15%, Industrials 10–15%, Energy 5–10%. Lookup is case-insensitive.
- **Watchlist** sector headers show only the sector name (no percentages; no targets).

## Sell Zone Discipline

Frontend must present sell-zone outputs exactly as computed by backend from EV thresholds:
- `Sell Zone Min` = trim threshold price where EV reaches 3%.
- `Sell Zone Max` = sell threshold price where EV reaches 0%.
- `Sell Zone Status` is derived from current EV:
  - `Below sell zone`
  - `In trim zone`
  - `In sell zone`
  - `no sell zone` (invalid/unsolved thresholds)

Display principle:
- Frontend shows thresholds and status, but does not re-implement threshold math.
- All labels and tooltip wording should stay synchronized with backend status semantics.

## Security and Input Handling

- JWT cookie token added in axios request interceptor.
- Response interceptor handles `401` by removing token and redirecting to `/login`.
- **Cookie Security** (`lib/auth.ts`):
  - `secure` flag enabled in production (HTTPS only)
  - `sameSite: 'strict'` to prevent CSRF attacks
  - Centralized cookie name constant for consistency
  - Server-side rendering safety checks
- **Input Validation** (`lib/validation.ts`):
  - Ticker symbol validation and sanitization
  - Numeric input parsing with comma/dot decimal support
  - Currency code validation (ISO 4217 format)
  - ISIN validation
  - Percentage and price validation utilities
  - Text input sanitization to prevent XSS
- Assessment image workflow includes:
  - file extension + MIME checks
  - magic number validation
  - canvas-based image sanitization for preview path
- JSON extraction supports validation before bulk update apply.

## Performance Characteristics

Implemented optimizations:
- disabled stock-link prefetch to reduce noisy RSC traffic
- consolidated dashboard source of truth around summary endpoint
- simple in-memory cache with explicit invalidation

**API Layer Improvements** (`lib/api.ts`):
- Request timeout of 30 seconds (prevents hanging requests)
- Cache size limit of 100 entries (prevents memory leaks)
- Automatic cache cleanup every 5 minutes
- Standardized error extraction with `getErrorMessage()` utility
- Network error and timeout handling in response interceptor

**Component Stability**:
- `ErrorBoundary` component (`components/ErrorBoundary.tsx`) for graceful error handling
- `isMountedRef` pattern in `PortfolioSummary` and `useColumnSettings` to prevent state updates after unmount
- Proper timer cleanup in `useColumnSettings` hook

Reference: `OPTIMIZATION.md`

## Trusted Fair Value Sync (v2.6.0)

Frontend integration points:
- Dashboard active positions section has a `Fair Value Sync (N)` action for selected rows.
- The action calls backend collection endpoint via `stockAPI.collectFairValues(ids)`.
- After completion, frontend invalidates portfolio cache and force-refreshes summary data.

Stock detail page:
- Fetches source-level records via `stockAPI.getFairValueHistory(id)`.
- Renders audit table with required columns:
  - `Date`
  - `Fair value`
  - `Source`

API methods added in `lib/api.ts`:
- `collectFairValues(ids: number[])` -> `POST /stocks/fair-value/collect`
- `getFairValueHistory(id: number)` -> `GET /stocks/:id/fair-value-history`

## Known Consistency Risks / Caveats

1. **Threshold text drift risk**
   - Some explanatory text in UI can drift from backend action bands.
   - Always verify labels/tooltips/strategy text against backend constants.
2. **`portfolio_id` propagation incomplete in UI**
   - API methods support optional `portfolio_id`, but many page calls still use default scope.
3. **Mixed source of truth for some UI math**
   - Some presentation-level conversions happen client-side; keep semantics aligned with backend.
4. **Assessment context visibility vs scope**
   - UI requests assessment without explicit portfolio scoping control.

## Engineering Guardrails for Future Work

1. Do not re-implement quant logic in frontend beyond display helpers.
2. Treat backend `units` metadata as authoritative for formatting.
3. Keep all decision text/tooltips synced with backend thresholds/formulas.
4. Invalidate cache after any mutation that impacts summary/stocks.
5. Prefer explicit `portfolio_id` plumbing end-to-end as multi-portfolio matures.
6. Preserve safe input behavior in Notes/comments and extraction flows.
7. Use `isMountedRef` pattern in components with async operations to prevent state updates after unmount.
8. Wrap critical UI sections with `ErrorBoundary` to prevent full-page crashes.
9. Use validation utilities from `lib/validation.ts` for user input validation.
10. Use `getErrorMessage()` from `lib/api.ts` for consistent error handling.

## Quick Runbook

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Versioning

- **Frontend version** is set in `lib/version.ts` (`FRONTEND_VERSION`) and `package.json` (`version`). Bump both for releases.
- **Backend version** is reported by the API (`versionAPI.getBackendVersion()`); bump the backend version in the backend repository when releasing the backend.

---

Last updated: 2026-02-15
