# Frontend Optimization Summary

## Problem Analysis
Looking at the network traffic, the frontend was making excessive requests:
- 28+ `/stocks/[id]?_rsc=` prefetch requests
- Duplicate API calls on dashboard load
- No caching mechanism
- Each navigation triggering fresh data fetches

## Optimizations Implemented

### 1. **Disabled Next.js Link Prefetching** ✅
**File:** `components/StockTable.tsx:343`

Added `prefetch={false}` to all stock detail links:
```tsx
<Link href={`/stocks/${stock.id}`} prefetch={false} ...>
```

**Impact:** Eliminates 28+ automatic prefetch requests on page load.

---

### 2. **Removed Redundant API Call** ✅
**File:** `app/dashboard/page.tsx:76-93`

**Before:**
```tsx
const response = await portfolioAPI.getSummary();
const directStocksResponse = await stockAPI.getAll(); // Redundant!
const stocksData = response.data.stocks || directStocksResponse.data || [];
```

**After:**
```tsx
const response = await portfolioAPI.getSummary();
const stocksData = response.data.stocks || [];
```

**Impact:** Reduces 2 API calls to 1 per dashboard load.

---

### 3. **Implemented Client-Side Caching** ✅
**File:** `lib/api.ts:6-245`

Created a simple cache layer with:
- **30-second TTL** for portfolio data
- **60-second TTL** for API status
- Cache invalidation on mutations

**Cache Implementation:**
```tsx
class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 30000; // 30 seconds

  get<T>(key: string, ttl: number): T | null
  set<T>(key: string, data: T): void
  invalidate(pattern?: string): void
}
```

**Cached Endpoints:**
- `portfolioAPI.getSummary()` - 30s cache
- `portfolioAPI.getAPIStatus()` - 60s cache

**Cache Invalidation:**
- On stock update: `invalidateCache('portfolio')`
- On stock delete: `invalidateCache('portfolio')`
- On price update: `invalidateCache('portfolio')`
- On field update: `invalidateCache('portfolio')`

**Impact:**
- Dashboard refreshes within 30s use cached data (0 API calls)
- Repeat navigation uses cache instead of re-fetching
- Mutations properly invalidate stale cache

---

## Request Reduction Summary

### Before Optimization:
```
Dashboard Load:
  - portfolioAPI.getSummary()    [1 request]
  - stockAPI.getAll()            [1 request]  ← Redundant
  - 28x Link prefetch            [28 requests]
  - cashAPI.getAll()             [1 request]
  - versionAPI.getBackendVersion() [1 request]
  - portfolioAPI.getAPIStatus()  [1 request]

Total: ~33 requests on initial dashboard load
```

### After Optimization:
```
Dashboard Load (first time):
  - portfolioAPI.getSummary()    [1 request]
  - cashAPI.getAll()             [1 request]
  - versionAPI.getBackendVersion() [1 request]
  - portfolioAPI.getAPIStatus()  [1 request]

Total: 4 requests on initial dashboard load

Dashboard Load (within 30s cache window):
  - portfolioAPI.getSummary()    [0 - cached]
  - cashAPI.getAll()             [1 request]
  - versionAPI.getBackendVersion() [1 request]
  - portfolioAPI.getAPIStatus()  [0 - cached]

Total: 2 requests on cached dashboard load
```

**Reduction:** From ~33 requests → 4 requests (88% reduction)
**With cache:** From ~33 requests → 2 requests (94% reduction)

---

## Additional Optimizations to Consider

### 1. **Add SWR or React Query** (Advanced)
For more sophisticated caching with:
- Background revalidation
- Automatic retry logic
- Request deduplication
- Optimistic updates

**Installation:**
```bash
npm install swr
# or
npm install @tanstack/react-query
```

**Example with SWR:**
```tsx
import useSWR from 'swr';

function Dashboard() {
  const { data, error, mutate } = useSWR(
    '/portfolio/summary',
    () => portfolioAPI.getSummary(),
    { refreshInterval: 30000 } // Auto-refresh every 30s
  );
}
```

### 2. **Batch Stock Updates**
Instead of updating stocks one-by-one, use the backend's bulk update endpoint:
```tsx
// Instead of:
for (const id of stockIds) {
  await stockAPI.updateSingle(id, source);
}

// Use:
await stockAPI.updateBulk(stockIds, source);
```

### 3. **Implement Request Debouncing**
For real-time field updates, debounce the API calls:
```tsx
const debouncedUpdate = debounce(async (id, field, value) => {
  await stockAPI.updateField(id, field, value);
}, 500);
```

### 4. **Add Loading States with Suspense**
Convert to React Server Components where appropriate:
```tsx
// app/dashboard/page.tsx
export default async function Dashboard() {
  const data = await portfolioAPI.getSummary(); // Server-side fetch
  return <DashboardClient data={data} />;
}
```

### 5. **Implement WebSocket for Real-Time Updates**
For live stock price updates without polling:
```tsx
// Backend sends updates via WebSocket
ws.on('stockUpdate', (data) => {
  updateStockInCache(data);
});
```

---

## Testing the Optimizations

### To verify the improvements:

1. **Open Developer Tools → Network Tab**
2. **Clear cache and reload dashboard**
3. **Count requests - should see ~4 requests instead of 33**
4. **Refresh within 30 seconds - should see ~2 requests**
5. **No `/stocks/[id]?_rsc=` prefetch requests**

### Expected Results:
- ✅ No prefetch requests on hover
- ✅ Single portfolio API call per load
- ✅ Cached responses show near-instant load times
- ✅ Cache invalidation works on mutations

---

## Configuration

### Cache TTL Settings
Adjust in `lib/api.ts`:
```tsx
// Portfolio data cache duration
const cached = cache.get(cacheKey, 30000); // 30 seconds

// API status cache duration
const cached = cache.get(cacheKey, 60000); // 60 seconds
```

### Disable Caching (for debugging)
Set TTL to 0:
```tsx
const cached = cache.get(cacheKey, 0); // No caching
```

---

## Backend Considerations

The backend already supports efficient data fetching:
- `/portfolio/summary` returns stocks + metrics in one call
- `/stocks/bulk-update` endpoint for batch updates
- Proper indexing on database queries

No backend changes needed for these frontend optimizations.

---

**Last Updated:** 2025-12-04
**Related Files:**
- [lib/api.ts](fleet-file://ui1ebg2m0ls975qt32d4/Users/jetbrains/myProjects/stock-frontend/lib/api.ts?type=file&root=%252F) - Cache implementation
- [app/dashboard/page.tsx](fleet-file://ui1ebg2m0ls975qt32d4/Users/jetbrains/myProjects/stock-frontend/app/dashboard/page.tsx?type=file&root=%252F) - Cache invalidation
- [components/StockTable.tsx](fleet-file://ui1ebg2m0ls975qt32d4/Users/jetbrains/myProjects/stock-frontend/components/StockTable.tsx?type=file&root=%252F) - Disabled prefetching
