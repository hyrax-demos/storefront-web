import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import { cartSubtotal, cartTotal, type CartLine } from "../utils/cart";
import { dollarsToCents, formatCents } from "../utils/money";
import { applyPromoRule, type PromoRule } from "../utils/promo";

interface CatalogPrice {
  productId: string;
  unitPrice: number;
}

// Re-fetch authoritative prices so we never charge a stale snapshot.
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

  // Reprice each line against the latest catalog price before charging. The
  // catalog quotes dollars, so convert to integer cents right here; everything
  // downstream is integer cents.
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

  const subtotalCents = cartSubtotal(pricedLines);
  const discountCents = promo ? applyPromoRule(promo, subtotalCents) : 0;
  const totalCents = cartTotal(pricedLines, discountCents);

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
