# `fetchCatalogPrices` errors are silently swallowed in `useEffect`

**Tool:** `mini_audit`
**Severity:** high
**Category:** correctness
**Location:** `src/pages/Checkout.tsx:37`

## What's wrong

The `.then(setLivePrices)` call has no `.catch()` handler. If `fetchCatalogPrices` rejects (network error, HTTP error, JSON parse failure), the Promise rejection is silently dropped. The component continues to render with `livePrices = {}`, falling back to the potentially stale `line.unitPrice` values from the cart — meaning the user could be charged a stale price. Add error handling:
```ts
fetchCatalogPrices(ids)
  .then(setLivePrices)
  .catch((err) => { /* set an error state, block submit */ });
```
