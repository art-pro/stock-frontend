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

## Dashboard layout and left menu (split pages)

The app uses a **left sidebar** for main navigation when the user is in the dashboard area.

- **Layout:** `app/dashboard/layout.tsx` wraps all routes under `/dashboard/*`. It provides:
  - **Left sidebar** with nav links: **Portfolio**, **History**, **Watchlist**, **Analysis**, **Settings**; active route is highlighted; **Logout** at bottom.
  - A thin top bar showing backend version.
  - Auth check: unauthenticated users are redirected to `/login`.
- **Routes:**
  - `/dashboard` → redirects to `/dashboard/portfolio`.
  - `/dashboard/portfolio` — Portfolio page (summary, positions, calculator, import/export, snapshots, cash/FX).
  - `/dashboard/history` — History page: table of operations (Asset | Operation | Trade date | Quantity | Price | Amount | Note) from `GET /operations`.
  - `/dashboard/watchlist` — Watchlist table and Add Operation / Import / Export.
  - `/dashboard/analysis` — Analysis page: sector rebalance hint, concentration & tail risk, suggested next actions (at top), then Request Stock Assessment and Recent Assessments.
  - `/dashboard/settings` — Settings (username, password, portfolio, column settings, Sector Targets).
  - `/assessment` → redirects to `/dashboard/analysis`.
  - `/settings` → redirects to `/dashboard/settings`.

**Portfolio page** (`app/dashboard/portfolio/page.tsx`): PortfolioSummary (Overall EV, Volatility; no Sharpe/Kelly), status bar, selection, toolbar (Add Operation, Refresh, Import, Export), Position Size Calculator, Active Positions table (with Fair Value Sync; Action column with Buy/Sell opens Add Operation prefilled), collapsible Cash Management and Exchange Rates. Rebalance hint, Risk card, and Suggested actions are **not** on this page (they live on Analysis).

**Watchlist page** (`app/dashboard/watchlist/page.tsx`): Watchlist table only; Add Operation, Import, Export.

**Analysis page** (`app/dashboard/analysis/page.tsx`): At the top, **Sector rebalance hint** (RebalanceHint), **Concentration & tail risk** (RiskCard), and **Suggested next actions** (SuggestedActions), each in equal-width panels; then **Request Stock Assessment** form and **Recent Assessments** list. Fetches portfolio summary on load to render the three widgets; when the user requests an assessment, the same hint text is still sent to the LLM (see “Request Stock Assessment and dashboard hints”).

**Settings** (`app/dashboard/settings/page.tsx`): Full settings UI; no “Back to Dashboard” button (sidebar is used for navigation).

## Architecture and UI Subsystems

- `app/dashboard/portfolio/page.tsx`  
  Main portfolio surface: summary, toolbar (add/import/export/snapshots), position size calculator, active positions table, cash/FX collapsible sections.
- `components/PortfolioSummary.tsx`
  Portfolio-level KPIs + **sector pie chart**. Pie is **stock-level**: one slice per active position (and one for Cash), with sectors in **shades of the same colour** (e.g. Healthcare = greens, Technology = blues). Clicking a sector highlights it and shows below the chart the list of stocks in that sector with their portfolio weight %. Receives optional `stocks` prop from dashboard for drill-down. Cash segment uses same 0–1 scale as sectors so proportions are correct.
- `components/StockTable.tsx`  
  Configurable table for portfolio and watchlist modes; sorting, filtering, inline edits, actions. Active Positions and Watchlist are grouped by sector (subtables with sector header). Active Positions show current sector % and desired exposure (target range) in each sector header. Notes column shows a (?) icon; hover or click reveals the stock’s Notes & Comments (`stock.comment`).
- `lib/sectorTargets.ts`
  Desired sector exposure (target min–max %) from core philosophy; used in Active Positions sector headers and rebalance logic. **Persistent**: targets are loaded from backend via `useSectorTargets` / `SectorTargetsContext`; when API returns null, built-in defaults are used. Case-insensitive lookup. `formatSectorTarget(sectorName, customTargets?)` accepts optional persisted targets. Full sector table and rationale in Settings → Sector Targets and in CLAUDE.md “Sector exposure targets and rationale”.
- `lib/portfolioInsights.ts`  
  Display-only helpers for Phase 1: sector rebalance summary (over/at/under target), concentration (top-N %, max position), distance to buy/sell zone, Kelly hint (position size vs ½-Kelly). No backend changes. Also provides **hint formatters for assessment context**: `formatRebalanceHintText(summary)`, `formatConcentrationHintText(conc)`, `formatSuggestedActionsHintText(actions)` — used by the assessment page to build the text sent to the LLM for the Sector rebalance hint, Concentration & tail risk, and Suggested next actions panes.
- `components/RebalanceHint.tsx`  
  Widget: sectors vs targets (over / at / under / no target) using `sector_weights` and `lib/sectorTargets.ts`. Rendered on **Analysis** page (not Portfolio).
- `components/RiskCard.tsx`  
  Widget: concentration and tail risk (largest position, top 3, top 5 % of equity). Rendered on **Analysis** page (not Portfolio).
- `app/stocks/[id]/page.tsx`  
  Deep-dive stock details, editable fields, data-source transparency, historical chart, notes/comments. Shows distance to buy/sell zone and Kelly hint (position vs ½-Kelly) under relevant cards.
- `components/CashManagementTable.tsx`  
  Cash CRUD and conversion display.
- `components/ExchangeRateTable.tsx`  
  FX management UI for tracked currencies/rates.
- `app/assessment/page.tsx`  
  Redirects to `/dashboard/analysis`. The actual assessment UI lives in `app/dashboard/analysis/page.tsx` (see Dashboard layout above).
- `app/dashboard/analysis/page.tsx`  
  **Analysis** page: shows RebalanceHint, RiskCard, SuggestedActions at top (equal-width panels); then Request Stock Assessment form and Recent Assessments list. When the user requests a stock assessment, the page fetches portfolio summary and sector targets, computes **dashboard hints** (sector rebalance, concentration & tail risk, suggested next actions) from `lib/portfolioInsights.ts`, and sends them as optional body fields to `POST /assessment/request` so the LLM receives the same context as the three panes above.
- `app/settings/page.tsx`  
  Redirects to `/dashboard/settings`. The actual settings UI lives in `app/dashboard/settings/page.tsx`.
- `app/dashboard/settings/page.tsx` + `hooks/useColumnSettings.ts` + **Sector Targets**
  User/password/portfolio settings; persistent column-visibility/order; **Sector Targets** tab: table of sector allocation targets (min–max %, rationale) loaded from and saved to backend (`GET/POST /settings/sector-targets`). RBAC: only admin can add, edit, delete rows and save; all users can view. Admins get Add sector, Save, Reset to defaults; inline edit sector/min/max/rationale; delete row (≥1 row). Saved targets apply to Portfolio/Watchlist tables and Analysis widgets. “Reset to defaults” persists the built-in sector table.
- `lib/api.ts`  
  API contracts, request methods, lightweight cache layer, cache invalidation helper. **Operations**: `operationsAPI.create(data, portfolioId?)`, `operationsAPI.list(portfolioId?)` for `POST/GET /operations`.
- `lib/auth.ts`  
  Cookie token helpers for client auth state.
- **Operations and History**
  - **Add Operation** modal (`components/AddOperationModal.tsx`): Operation type (Buy, Sell, Deposit, Withdraw, Dividend), Date (DD.MM.YYYY), Ticker, ISIN, Company name, Sector, Currency, Number of shares/Amount, Price (for Buy/Sell), Comment. Data stored via `POST /operations`. Portfolio and Watchlist use “Add Operation” and open this modal; Active Positions (Portfolio only) have an Action column with Buy/Sell buttons that open the modal with prefilled stock and operation type.
  - **History page** (`app/dashboard/history/page.tsx`): Fetches `GET /operations` and shows table: Asset | Operation | Trade date | Quantity | Price | Amount | Note. Operations drive cash (Buy/Withdraw decrease, Sell/Deposit/Dividend increase) and stock positions (Buy/Sell create or update positions).

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
  - Buy zone limit columns (`Buy Zone Min`, `Buy Zone Max`) with currency-aware display and sorting; Buy Zone Status tooltip shows distance to buy zone (from `lib/portfolioInsights.ts`)
  - Sell zone columns (`Sell Zone Min`, `Sell Zone Max`, `Sell Zone Status`) for trim/sell discipline; Sell Zone Status tooltip shows distance/sell-zone text
  - Sector grouping (subtables) and, in Active Positions, sector current % and target range in header (from `lib/sectorTargets.ts`)
  - Notes column: (?) icon to show `stock.comment` (Notes & Comments) on hover or click
  - Fair Value cell tooltip: source and last updated date
  - Weight % column tooltip: portfolio % and position size vs ½-Kelly (when available)
  - tooltips for metric meaning
- `components/PortfolioSummary.tsx`
  - overall EV and volatility displays (no Sharpe or Kelly utilization)
- `app/stocks/[id]/page.tsx`
  - per-stock metrics and action interpretation text/tooltips
  - dedicated sell-zone cards (min/max/status) aligned to backend EV thresholds
- `app/dashboard/analysis/page.tsx`
  - RebalanceHint, RiskCard, SuggestedActions at top; when requesting assessment, sends optional dashboard hints (rebalance, concentration, suggested actions) to the LLM — see “Request Stock Assessment and dashboard hints”.

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

1. **Portfolio (dashboard/portfolio)**
   - View portfolio summary and active positions (grouped by sector; sector headers show current % and target range)
   - Add Operation, Import, Export; Position Size Calculator
   - Run trusted fair-value sync for selected active positions (Grok + Deepseek backend collection)
   - Review buy zone limits and distance to buy zone (tooltip on Buy Zone Status)
   - Review sell-zone thresholds and status (tooltip on Sell Zone Status)
   - View Notes & Comments per stock via the Notes column (?) icon (hover or click)
   - Inline edits for core numeric inputs
   - Collapsible Cash Management and Exchange Rates
   - (Market Data and AI Analysis bulk-update buttons are **not** on this page; use stock-level actions in the table if needed.)
2. **Watchlist (dashboard/watchlist)**
   - View watchlist table (grouped by sector); Add Operation, Import, Export
3. **Analysis (dashboard/analysis)**
   - **Sector rebalance hint**: sectors vs targets (over / at / under); consider trim/add by sector
   - **Concentration & tail risk**: largest position, top 3, top 5 % of equity
   - **Suggested next actions**: sector trim, sell/trim zone, buy zone add, etc.
   - Request Stock Assessment (single ticker; sends above hints to LLM)
   - Request Stock Assessment and Recent Assessments (no screenshot extraction)
4. **Stock detail editing**
   - granular edits with calculated-vs-editable separation
   - source transparency modal for raw provider payloads
   - view source-level fair value history table (`Date`, `Fair value`, `Source`)
   - notes/comments editing
5. **Cash and FX management**
   - maintain cash by currency (Portfolio page collapsible section)
   - refresh conversion-dependent values
6. **AI assessment** (Analysis page)
   - request narrative assessment per ticker (Request Stock Assessment sends dashboard hints: sector rebalance, concentration & tail risk, suggested next actions — see “Request Stock Assessment and dashboard hints” below)
   - parse and edit extracted JSON from screenshot pipeline
7. **Settings** (dashboard/settings)
   - auth settings and portfolio settings
   - persistent customizable table columns (includes buy zone, sell zone, and Notes column visibility/order)
   - **Sector Targets** tab: view (all users) or edit (admin) the sector allocation table; load/save via `GET/POST /settings/sector-targets`; “Reset to defaults” to persist built-in targets. Rebalance hints and sector headers use these persisted targets when available.

## Sector Grouping and Desired Exposure

- **Active Positions** and **Watchlist** tables are grouped by sector: each sector is a subtable with a header row and then the stock rows. The Sector column is hidden when grouped.
- **Active Positions** sector headers show: sector name, current percentage of equity portfolio (from backend `summary.sector_weights`), and desired exposure when defined (e.g. `Healthcare (46.8%, target 30–35%)`). Targets come from `lib/sectorTargets.ts` (core philosophy). Lookup is case-insensitive.
- **Watchlist** sector headers show the sector name and, when defined, the desired exposure limit (e.g. `Technology (target 15%)`). No current percentage is shown (watchlist has no portfolio weights).

### Sector exposure targets and rationale (EV/Vol/Risk fit)

Targets are derived from core philosophy. Cash buffer 8–12% is separate (not a sector).

| Sector | Recommended % | Rationale |
|--------|----------------|------------|
| **Technology** | 15% | High-growth (AI/cloud, EPS 12–45%), but cap due to volatility (25–50%, beta 1–1.5). EV +15–20%; complements Comm Services but avoid overexposure (current ~41%—trim). |
| **Insurance** | 10–15% (under Financials) | Defensive yield (4–5%), low vol (20–25%, beta 1–1.2). EV +5–8%; group with Financials for stability; fits 10–15% total Financials target. |
| **Industrials** | 10–15% | Cyclical (equipment/defense, EPS 5–120%), moderate vol (25–35%, beta 1–1.2). EV +7–10%; diversify with Tech; monitor for drawdowns. |
| **Healthcare** | 30–35% | Resilient demand (pharma/medtech, EPS 12–25%), low vol (20–25%, beta 0.5–0.7). EV +8–10%; core defensive anchor (current 46.8%—trim to target). |
| **Financials** | 10–15% | Stable moats (insurance/conglomerates, EPS 8–16%), low vol (18–25%, beta 0.8–1). EV +6–9%; underweight currently—add high-EV like BRK.B on dips. |
| **Financial Services** | 10–15% (under Financials) | Payments/networks (EPS 16%), moderate vol (22%, beta 0.9–1). EV +7–9%; group with Financials; add V if EV >7%. |
| **Energy** | 5–10% | Dividend-focused (oil, EPS 5–8%), higher vol (25–30%, beta 0.6–0.9). EV +5–7%; cap due to commodity risks; fits as hedge. |
| **Crypto** | 2–5% | Asymmetric upside (Bitcoin proxies), extreme vol (50%, beta 1.5+). EV +5–10% but high ruin risk—cap strictly; treat as "future rocket" allocation. |
| **Consumer Defensive** | 10–15% | Stable staples (EPS 6%, yield 2–3%), low vol (15–20%, beta 0.4–0.6). EV +4–6%; defensive buffer like PG. |
| **Consumer Cyclical** | 5–10% | Growth-oriented (e.g. e-commerce, EPS 36%), moderate vol (25%, beta 1.3+). EV +10–12%; cap volatility; add AMZN on dips. |
| **Communication Services** | 10–15% | Ad/media stability (EPS 15–35%), moderate vol (25–30%, beta 1–1.2). EV +7–9%; current 11%—hold/add META if EV >7%. |
| **Basic Materials** | 5–10% | Cyclical (fertilizers/metals, EPS variable), higher vol (30–35%, beta 0.9–1). EV +3–6%; cap exposure; diversify with Energy. |

Implemented in `lib/sectorTargets.ts`. Targets are **persistent per user**: `contexts/SectorTargetsContext.tsx` and `hooks/useSectorTargets.ts` load from `GET /settings/sector-targets` and optionally save via `POST /settings/sector-targets`. Portfolio, Watchlist, Analysis (RebalanceHint, SuggestedActions), and StockTable receive `targetPctBySector` from context so rebalance logic and sector headers use saved targets when present; otherwise defaults from `lib/sectorTargets.ts` are used. Numeric ranges appear in sector headers (Active Positions and Watchlist) and in Settings → Sector Targets table.

### Sector Allocation Targets (Settings tab) — functionality

- **Location:** Settings → Sector Targets tab. Table columns: Sector, Target Range (min–max %), Key Rationale; for admin, an Actions column (delete per row).
- **RBAC:** Admin can add, edit, delete rows and save; non-admin users see the table as read-only. Admin is determined by: `currentUser.username === (process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin')`. Set admin in `.env.local` (gitignored), e.g. `NEXT_PUBLIC_ADMIN_USERNAME=YourUsername`. Restart dev server after changing env.
- **CRUD (admin only):** **Add sector** — append a row (any sector name, custom min/max/rationale). **Edit** — inline inputs for sector name, min %, max %, rationale. **Delete** — trash icon per row; at least one row must remain. **Save** — validates then `POST /settings/sector-targets` with full `rows` array; success refetches and updates context so Dashboard uses new targets immediately. **Reset to defaults** — replaces draft with built-in table from `lib/sectorTargets.ts` and saves.
- **Import / Export:** **Export** (all users): **Copy JSON** copies current table as `{ "rows": [ { "sector", "min", "max", "rationale" }, ... ] }` to clipboard; **Download file** saves the same JSON as `sector-targets.json`. **Import** (admin only): paste JSON into the text area and click **Load from text**, or use **Load from file** to pick a `.json` file; parsed rows are validated (same rules as Save) and loaded into the table as draft — click **Save** to persist. Accepted format: `{ "rows": [ ... ] }` or a top-level array of row objects.
- **Validation before save:** Sector name required (non-empty); min and max in 0–100; min ≤ max. Invalid rows produce an amber message and block save.
- **Persistence:** Backend stores JSON per user under key `sector_targets`. Analysis page (rebalance hint, suggested actions), Portfolio/Watchlist, and sector headers in StockTable all read `targetPctBySector` from `SectorTargetsContext`, so saved targets apply site-wide without further wiring.

## Phase 1: Math/Logic and Data (Core Enhancements)

Additive display-only features to support EV optimization, sector targets, and risk visibility. No new backend logic.

- **Rebalance hint**: Uses `summary.sector_weights` and `lib/sectorTargets.ts` to classify sectors over / at / under target. Rendered by `RebalanceHint` on the **Analysis** page; lists sectors and current % vs target range.
- **Distance to buy/sell zone**: Helpers in `lib/portfolioInsights.ts` (`getDistanceToBuyZone`, `getDistanceToSellZone`). Shown in StockTable as tooltips on Buy Zone Status and Sell Zone Status; on stock detail under the status cards.
- **Kelly utilization vs half-Kelly hint**: Portfolio Summary shows “Target 75–85%” on Kelly card. Per-stock: `getKellyHint(stock)` in `lib/portfolioInsights.ts` (e.g. “0.92× ½-Kelly”); Weight % column tooltip in table; stock detail under Portfolio Weight.
- **Concentration and tail risk**: `getConcentration(stocks)` in `lib/portfolioInsights.ts`; `RiskCard` on the **Analysis** page shows largest position, top 3, top 5 % of equity.
- **Suggested next actions**: Rendered by `SuggestedActions` on the **Analysis** page (sector trim, sell/trim zone, buy zone add, etc.).
- **Fair value source/date**: StockTable Fair Value cell tooltip shows `fair_value_source` and `last_updated`.
- (Export decision snapshot was removed in v2.12.0.)

## Request Stock Assessment and dashboard hints

When the user clicks **Generate Assessment** on the **Request Stock Assessment** section (Analysis page), the frontend sends the same information as the three Analysis panes (rebalance hint, concentration, suggested actions) to the LLM so recommendations can consider current portfolio state.

- **Data flow:** Before calling `POST /assessment/request`, the page fetches `GET /portfolio/summary` and `GET /settings/sector-targets` (in parallel). From `summary.sector_weights`, `stocks`, and optional sector targets it computes:
  - **Sector rebalance hint** — `getSectorRebalanceSummary` + `formatRebalanceHintText` (over/at/under/no target sectors).
  - **Concentration & tail risk** — `getConcentration(stocks)` + `formatConcentrationHintText` (largest position, top 3, top 5 %).
  - **Suggested next actions** — `getSuggestedActions(sector_weights, stocks, sectorTargets)` + `formatSuggestedActionsHintText` (sector trim, sell/trim zone, buy zone add, high EV underweight).
- **API contract** (`lib/api.ts`): `AssessmentRequest` may include optional `rebalance_hint`, `concentration_hint`, `suggested_actions_hint` (strings). If hint fetch fails (e.g. not authenticated), the request is still sent without hints.
- **Backend:** The assessment handler accepts these optional fields and appends a “DASHBOARD HINTS” block to the prompt after the existing portfolio/cash context, so the LLM sees both the current hint (portfolio table + cash) and the three pane summaries.

## Tests

- **`lib/sectorTargets.test.ts`** – `formatSectorTarget` (default/custom targets, case-insensitive, single-value range); default table and Cash row.
- **`lib/portfolioInsights.test.ts`** – `getSectorRebalanceSummary` (over/at/under, 0–1 vs 0–100 weights, custom targets, noTarget); `getSuggestedActions` (sector_over, custom targets, sell/trim zone); `getConcentration`.
- **`hooks/useSectorTargets.test.tsx`** – load defaults when API returns null; use persisted rows when API returns data; save() calls API and reloads; when not authenticated, no API call.

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
- **RBAC (Sector Targets):** Admin is the user whose username equals `NEXT_PUBLIC_ADMIN_USERNAME` (or `'admin'` if unset). Configure in `.env.local`, e.g. `NEXT_PUBLIC_ADMIN_USERNAME=YourUsername`; only that user can edit Sector Allocation Targets in Settings.

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
- **Portfolio** page active positions section has a `Fair Value Sync (N)` action for selected rows.
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
   - UI requests assessment without explicit portfolio scoping control. The Analysis page (Request Stock Assessment) does send dashboard hints (rebalance, concentration, suggested actions) when summary and sector targets are available, so the LLM receives current pane-style context.

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

- **Frontend version** is set in `lib/version.ts` (`FRONTEND_VERSION`) and `package.json` (`version`). Bump both for releases. Current: **2.12.0**.
- **Backend version** is reported by the API (`versionAPI.getBackendVersion()`); bump the backend version in the backend repository when releasing the backend.

## Suggested improvements (additive only)

See **`INVESTMENT_IMPROVEMENTS.md`** for the full list. **Phase 1 (math/logic and data)** is implemented: rebalance hint, distance to buy/sell zone, Kelly hint, concentration/Risk card, fair value source/date in table. Sector targets (persistent, Settings tab, RBAC) and stock-level sector pie with shades/click-to-highlight are in place; tests cover sectorTargets, portfolioInsights, useSectorTargets. Remaining ideas: LLMs (batch assessment, explain assessment, Grok vs Deepseek comparison, sector summary); alerts and “suggested next actions”; price/buy-zone alerts if backend supports them. **Backend:** See **`BACKEND_IMPROVEMENTS.md`** for more. Sector targets and LLM endpoints are implemented.

## Changelog (recent)

- **v2.12.0:** Sidebar shows frontend and backend versions (e.g. v2.12.0 · v2.10.0); Exit menu item in left nav (logs out). Portfolio page: removed Sharpe Ratio and Kelly Utilization from summary; removed Snapshot (JSON) and Snapshot (CSV) buttons. Analysis page: removed Single Ticker Analysis / Extract from Screenshots tabs; page shows only Request Stock Assessment and Recent Assessments. Sector rebalance hint and Concentration & tail risk panels use equal width (2-column grid). History page: Delete and Modify operations with asset recalculation (see Operations and History in Architecture).
- **Dashboard layout and split pages:** Left sidebar: Portfolio, History, Watchlist, Analysis, Settings, Exit. Portfolio: summary (Overall EV, Volatility), toolbar (Add Operation, Refresh, Import, Export), Position Size Calculator, Active Positions, Cash/FX. Analysis: RebalanceHint, RiskCard, SuggestedActions (equal-width top panels), then Request Stock Assessment form and Recent Assessments list.

---

Last updated: 2026-02-18
