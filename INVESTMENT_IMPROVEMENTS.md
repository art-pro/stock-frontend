# Suggested Improvements for Investment Decisions

This document lists **additive** ideas to help you take better investment decisions. None of these change existing functionality; they are new features or surfaces that build on your current EV/Kelly, sector targets, and LLM (Grok/Deepseek) setup.

---

## 1. Mathematics & logic

### 1.1 Portfolio-level “rebalance hint” (display only)

- **Idea:** On the dashboard or in Portfolio Summary, show a short summary: *“X sectors above target, Y at target, Z below.”* with optional list (e.g. *“Technology +26% vs target 15%; Healthcare −14% vs target 30–35%. Consider trim Tech, add Healthcare.”*).
- **Logic:** Use existing `summary.sector_weights` and `lib/sectorTargets.ts`. Compute for each sector: current % (from weights, normalised to equity if needed) vs target min/max; classify over/at/under. No trading logic—purely informational.
- **Benefit:** Quick view of where the portfolio stands vs your stated sector philosophy without changing any formulas or backend.

### 1.2 “Distance to buy zone” and “distance to sell zone” (display only)

- **Idea:** For each stock you already show Buy Zone Min/Max and Sell Zone Min/Max. Add two **derived display-only** metrics (backend can expose or frontend can compute from existing fields):
  - **Distance to buy zone:** e.g. *“Current price is 12% above Buy Zone Max”* or *“Within buy zone”* (using current_price vs buy_zone_min/max).
  - **Distance to sell zone:** *“Current price is 5% above Sell Zone Min (trim threshold)”* or *“In trim zone”* (using current_price vs sell_zone_lower_bound/upper_bound).
- **Logic:** Pure comparison of `current_price` to existing zone bounds; no new backend formulas required if you already have those bounds. Can be tooltips or extra columns.
- **Benefit:** Makes “how far am I from adding or trimming?” explicit next to existing zones.

### 1.3 Kelly utilization vs half-Kelly suggested (portfolio and per stock)

- **Idea:** You already show portfolio Kelly utilization and per-stock half-Kelly. Add a **consistency hint** where relevant (e.g. on stock detail or in a small dashboard widget): *“Portfolio Kelly utilization 0.82; sum of half-Kelly suggestions 0.75”* or *“Position size vs ½-Kelly: 0.9×”* (current weight / half_kelly_suggested for that stock).
- **Logic:** Use existing `weight`, `half_kelly_suggested`, and portfolio `kelly_utilization`. No new backend math—only ratios and labels.
- **Benefit:** Keeps position sizing and “don’t overbet” visible without altering current Kelly logic.

### 1.4 Concentration and tail risk (display only)

- **Idea:** In Portfolio Summary or a small “Risk” card: show **top-N concentration** (e.g. “Top 3 positions = 42% of equity”) and optionally **largest position %**. If backend ever exposes correlation or vol surface, a simple “portfolio volatility vs target 11–13%” could be added later.
- **Logic:** From `stocks` and `current_value_usd` (or weights), compute cumulative weight of top 1, 3, 5 positions. No new backend required.
- **Benefit:** Surfaces concentration risk in one number next to your existing sector and Kelly views.

---

## 2. LLMs (Grok & Deepseek)

### 2.1 Batch narrative assessment from dashboard

- **Idea:** Reuse the same assessment endpoint you use on the Assessment page, but from the dashboard: e.g. *“Run assessment for selected tickers”* (Grok or Deepseek). Results can open in a modal, a new tab, or a simple list (ticker → assessment text / summary).
- **Logic:** Call existing `assessmentAPI.request({ ticker, source })` in a loop or use a backend batch endpoint if you add one. No change to single-ticker assessment flow.
- **Benefit:** Get narrative context for several names (e.g. all “Add” or all in one sector) without leaving the dashboard.

### 2.2 “Explain this assessment” short summary (optional LLM call)

- **Idea:** On stock detail (or in the table), a button: *“Explain assessment (Grok/Deepseek)”* that calls the LLM with a **structured prompt** such as: *“Given EV = X%, upside = Y%, downside = Z%, probability = W%, why is the recommendation Add/Hold/Trim/Sell? One short paragraph.”*
- **Logic:** Backend (or a small backend endpoint) sends current stock metrics + assessment to Grok/Deepseek and returns a 2–3 sentence explanation. Frontend only displays it.
- **Benefit:** Bridges your quantitative bands (EV > 7 → Add, etc.) with a narrative “why” for that specific stock.

### 2.3 Compare Grok vs Deepseek assessment (same ticker)

- **Idea:** On Assessment page (or stock detail), allow *“Assess with both Grok and Deepseek”* and show two cards side by side: narrative + suggested action (if the model outputs one). No overwriting of the main assessment field—purely comparison view.
- **Logic:** Two calls to `assessmentAPI.request` with same ticker, different `source`. Display both; do not change stored `stock.assessment` unless user explicitly applies one.
- **Benefit:** Lets you see disagreement/agreement between models before committing to an action.

### 2.4 Sector or theme summary (LLM)

- **Idea:** New optional action: *“Summarise sector: Technology”* (or “Summarise my Healthcare names”). Backend calls Grok/Deepseek with list of tickers and sector; returns a short narrative (outlook, risks, how it fits your targets). Shown in a modal or a dedicated small page.
- **Logic:** New backend endpoint that takes sector name + tickers (or portfolio_id + sector), builds a prompt, calls LLM, returns text. Frontend only displays.
- **Benefit:** Puts sector targets (e.g. “Technology 15%”) in context with a qualitative view of the names you hold or watch.

---

## 3. Alerts and “next best action” (logic + display)

### 3.1 Surface existing alerts in the UI

- **Idea:** You have `getAlerts` and portfolio settings `alerts_enabled` / `alert_threshold_ev`. Add a small **Alerts** widget or section on the dashboard (and optionally in header): list recent alerts (ticker, message, type, date) and “Dismiss” using `deleteAlert`. No change to how alerts are created (backend).
- **Logic:** Call `getAlerts()` on load; display list; “Dismiss” calls `deleteAlert(id)`. Respect `alerts_enabled` from settings.
- **Benefit:** Makes the existing alert system visible so EV-based (or other) alerts actually drive decisions.

### 3.2 “Suggested next actions” (read-only list)

- **Idea:** A small dashboard block: *“Suggested actions”* built only from **current data** (no new backend logic required):
  - Sectors over target → *“Consider trimming: Technology (current 41%, target 15%).”*
  - Stocks in sell zone (sell_zone_status) → *“In sell zone: TICKER.”*
  - Stocks with assessment “Add” and price in buy zone → *“In buy zone and Add: TICKER.”*
  - Optional: “EV &gt; 15% and below target weight” → *“High EV, underweight: TICKER.”*
- **Logic:** Pure frontend (or a tiny read-only backend endpoint): filter `stocks` and `summary.sector_weights` by your existing rules; produce a short list with links to stock/dashboard. No automatic orders or overwrites.
- **Benefit:** One place to see “what to look at first” without changing any existing behaviour.

### 3.3 Price alerts (if backend supports it)

- **Idea:** If the backend can create alerts for “price &lt; X” or “price enters buy zone”, expose that in the UI (e.g. on stock detail: “Alert me when price &lt; Buy Zone Max”). This is additive to current EV-based alerts.
- **Logic:** Depends on backend API (create alert with type and threshold). Frontend: form + list of price alerts.
- **Benefit:** Combines your buy/sell zones with notifications so you don’t have to watch the screen.

---

## 4. Data and transparency (no change to formulas)

### 4.1 Fair value source and date in table tooltip

- **Idea:** In the table, next to Fair Value (or in a small icon), show tooltip: *“Fair value: 412 USD (Grok, 15 Jan 2026)”* using `fair_value_source` and last updated / fair value history date.
- **Logic:** You already have `fair_value_source` and fair value history; only surface it in the table (e.g. ticker or fair value cell tooltip).
- **Benefit:** Keeps “whose number is this?” visible when scanning the table.

### 4.2 Export “decision snapshot” (CSV/JSON)

- **Idea:** Dashboard button: *“Export decision snapshot”* — one file with timestamp and, for each stock: ticker, assessment, EV, buy/sell zone status, sector, current vs target sector %, weight, half-Kelly. No new backend; frontend (or existing export) assembles from `summary` + `stocks` + sector targets.
- **Logic:** Same data you already show; different export shape (e.g. one row per stock + one row per sector summary).
- **Benefit:** Lets you review or share a single point-in-time view of the logic behind positions.

---

## 5. Summary table (additive only)

| Area              | Suggestion                              | Depends on              |
|-------------------|-----------------------------------------|-------------------------|
| Math / logic      | Rebalance hint (sectors vs target)      | Frontend + sectorTargets|
| Math / logic      | Distance to buy/sell zone (display)     | Existing zone fields    |
| Math / logic      | Kelly utilization vs ½-Kelly hint       | Existing metrics        |
| Math / logic      | Concentration (top-N, max position %)   | Existing weights        |
| LLM               | Batch assessment from dashboard         | Existing assessment API |
| LLM               | “Explain assessment” (short paragraph) | New or existing LLM API|
| LLM               | Grok vs Deepseek comparison             | Existing assessment API |
| LLM               | Sector/theme summary                    | New backend + LLM       |
| Alerts / actions | Show alerts in UI + dismiss             | Existing alerts API     |
| Alerts / actions | “Suggested next actions” list           | Frontend only           |
| Alerts / actions | Price / buy-zone alerts (if backend)    | Backend alert types     |
| Data              | Fair value source/date in table         | Existing fields         |
| Data              | Export decision snapshot                | Existing data           |

None of the above alter your current EV/Kelly formulas, sector targets, or assessment behaviour—they only add new views, prompts, or exports to support better investment decisions.
