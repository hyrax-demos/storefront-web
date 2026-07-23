import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import { cartTotal, toChargeCents, type CartLine } from "../utils/cart";
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
  if (!res.ok) {
    throw new Error(`Failed to fetch catalog prices: ${res.status}`);
  }
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
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    const ids = lines.map((l) => l.productId);
    if (ids.length === 0) return;
    setPriceError(null);
    fetchCatalogPrices(ids)
      .then(setLivePrices)
      .catch((err: unknown) => {
        setPriceError(
          err instanceof Error ? err.message : "Unable to load current prices",
        );
      });
  }, [lines]);

  // Reprice each line against the latest catalog price before charging.
  const pricedLines: CartLine[] = lines.map((line) => ({
    ...line,
    unitPrice: livePrices[line.productId] ?? line.unitPrice,
  }));

  const discount = promo ? applyPromoRule(promo, sumLines(pricedLines)) : 0;
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
        amountCents: toChargeCents(total),
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {priceError && (
        <p role="alert" style={{ color: "red" }}>
          {priceError} — please refresh to try again.
        </p>
      )}
      <ul>
        {pricedLines.map((line) => (
          <li key={line.productId}>
            {line.name} × {line.quantity} — ${line.unitPrice.toFixed(2)}
          </li>
        ))}
      </ul>
      <p>Total: ${total.toFixed(2)}</p>
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder="Card number"
        autoComplete="cc-number"
      />
      <button type="submit" disabled={priceError !== null}>
        Pay ${total.toFixed(2)}
      </button>
    </form>
  );
}

function sumLines(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
