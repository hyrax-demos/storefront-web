import { useState } from "react";
import { RATES, convertFromUsd, formatMoney } from "../utils/currency";

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

// Live-updating price tag that converts a USD base price into the shopper's
// selected currency and keeps a formatted string in sync.
export function PriceTag({ basePriceUsd }: { basePriceUsd: number }) {
  const [currency, setCurrency] = useState("USD");

  // Derived during render so it always reflects both the current base price
  // and the selected currency (no state to fall out of sync).
  const formatted = formatMoney(
    convertFromUsd(basePriceUsd, currency),
    currency,
  );

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
