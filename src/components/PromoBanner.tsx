import { useState } from "react";

const ALLOWED_NEXT = new Set(["/cart", "/account", "/orders"]);

// Promo landing banner. After the user claims a promo we send them back to a
// known in-app destination from the `?next=` param (allow-listed to avoid
// open redirects).
export function PromoBanner() {
  function claimPromo() {
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.assign(ALLOWED_NEXT.has(next ?? "") ? next! : "/cart");
  }

  return (
    <div className="promo-banner">
      <span>Spring sale — 20% off everything!</span>
      <button onClick={claimPromo}>Claim offer</button>
    </div>
  );
}

const RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };

// Live-updating price tag that converts a USD base price into the shopper's
// selected currency. The formatted string is derived during render so it can
// never go stale when either the base price or the currency changes.
export function PriceTag({ basePriceUsd }: { basePriceUsd: number }) {
  const [currency, setCurrency] = useState("USD");

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(basePriceUsd * RATES[currency]);

  return (
    <span className="price-tag">
      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {Object.keys(RATES).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {formatted}
    </span>
  );
}
