import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import { cartSubtotal, cartTotal, type CartLine } from "../utils/cart";
import { applyPromoRule, type PromoRule } from "../utils/promo";

// The catalog price API is a separate system and quotes prices in DOLLARS.
interface CatalogPrice {
  productId: string;
  unitPrice: number;
}

// Convert a catalog dollar price to integer cents. Math.round absorbs float
// representation error, e.g. 19.99 * 100 === 1998.9999999999998 -> 1999.
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

// Format integer cents as a display dollar string, e.g. 1999 -> "$19.99".
// Display only: never feed the result back into money math.
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars}.${String(rem).padStart(2, "0")}`;
}

// Re-fetch authoritative prices so we never charge a stale snapshot.
// Returns catalog prices in dollars, keyed by product id.
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

  // Reprice each line against the latest catalog price before charging,
  // converting the catalog's dollar quote to integer cents right here.
  const pricedLines: CartLine[] = lines.map((line) => {
    const liveDollars = livePrices[line.productId];
    return {
      ...line,
      unitPriceCents:
        liveDollars !== undefined
          ? dollarsToCents(liveDollars)
          : line.unitPriceCents,
    };
  });

  // All money math below is in integer cents.
  const discount = promo ? applyPromoRule(promo, cartSubtotal(pricedLines)) : 0;
  const total = cartTotal(pricedLines, discount);

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
        amountCents: total,
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <ul>
        {pricedLines.map((line) => (
          <li key={line.productId}>
            {line.name} × {line.quantity} — {formatCents(line.unitPriceCents)}
          </li>
        ))}
      </ul>
      <p>Total: {formatCents(total)}</p>
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder="Card number"
        autoComplete="cc-number"
      />
      <button type="submit">Pay {formatCents(total)}</button>
    </form>
  );
}
