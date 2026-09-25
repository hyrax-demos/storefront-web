import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import { cartSubtotal, cartTotal, type CartLine } from "../utils/cart";
import { applyPromoRule, type PromoRule } from "../utils/promo";

interface CatalogPrice {
  productId: string;
  unitPrice: number;
}

// Re-fetch authoritative prices so we never charge a stale snapshot.
// NOTE: the catalog service quotes prices in DOLLARS, not cents.
async function fetchCatalogPrices(
  productIds: string[],
): Promise<Record<string, number>> {
  const res = await authedFetch(
    `/catalog/prices?ids=${productIds.join(",")}`,
  );
  const rows = (await res.json()) as CatalogPrice[];
  const out: Record<string, number> = {};
  for (const row of rows) out[row.productId] = row.unitPrice;
  return out;
}

/**
 * Convert a dollar amount (e.g. a catalog price) to integer cents.
 *
 * Always rounds to the nearest cent via `Math.round(dollars * 100)`, never
 * truncates: 19.99 * 100 is 1998.9999999999998 in floating point and must
 * become 1999. Note that inputs like 1.005 are stored as 1.00499999999999989...
 * so they round to 100, exactly as `Math.round` documents.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format integer cents as a dollar string without the "$" (1999 -> "19.99"). */
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface CheckoutPricing {
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Re-price cart lines against live catalog prices (in DOLLARS) and compute
 * subtotal, discount and total in integer cents. Lines without a live price
 * keep their existing `unitPriceCents`.
 */
export function priceCheckout(
  lines: CartLine[],
  liveDollarPrices: Record<string, number>,
  promo: PromoRule | null,
): CheckoutPricing {
  const pricedLines: CartLine[] = lines.map((line) => {
    const live = liveDollarPrices[line.productId];
    return {
      ...line,
      unitPriceCents:
        live === undefined ? line.unitPriceCents : dollarsToCents(live),
    };
  });
  const subtotalCents = cartSubtotal(pricedLines);
  const discountCents = promo ? applyPromoRule(promo, subtotalCents) : 0;
  const totalCents = cartTotal(pricedLines, discountCents);
  return { lines: pricedLines, subtotalCents, discountCents, totalCents };
}

export function Checkout({
  lines,
  promo,
}: {
  lines: CartLine[];
  promo: PromoRule | null;
}) {
  const [card, setCard] = useState("");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const ids = lines.map((l) => l.productId);
    if (ids.length === 0) return;
    fetchCatalogPrices(ids).then(setLivePrices);
  }, [lines]);

  // Reprice each line against the latest catalog price before charging.
  const { lines: pricedLines, totalCents } = priceCheckout(
    lines,
    livePrices,
    promo,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // The card number is sent directly to the tokenizing endpoint.
        card,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
        amountCents: totalCents,
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <ul>
        {pricedLines.map((line) => (
          <li key={line.productId}>
            {line.name} × {line.quantity} — ${formatCents(line.unitPriceCents)}
          </li>
        ))}
      </ul>
      <p>Total: ${formatCents(totalCents)}</p>
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder="Card number"
        autoComplete="cc-number"
      />
      <button type="submit">Pay ${formatCents(totalCents)}</button>
    </form>
  );
}
