import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import {
  cartSubtotal,
  cartTotal,
  toChargeCents,
  type CartLine,
} from "../utils/cart";
import { applyPromoRule, type PromoRule } from "../utils/promo";

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

function clampQuantity(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity));
}

interface CatalogPrice {
  productId: string;
  unitPrice: number;
}

// Re-fetch authoritative prices so we never charge a stale snapshot.
async function fetchCatalogPrices(
  productIds: string[],
): Promise<Record<string, number>> {
  const res = await authedFetch(`/catalog/prices?ids=${productIds.join(",")}`);
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
  // Quantities the shopper has adjusted on this page, keyed by productId.
  // Kept separate from `lines` so a quantity change doesn't refetch prices.
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function stepQuantity(productId: string, current: number, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [productId]: clampQuantity(current + delta),
    }));
  }

  useEffect(() => {
    const ids = lines.map((l) => l.productId);
    if (ids.length === 0) return;
    fetchCatalogPrices(ids).then(setLivePrices);
  }, [lines]);

  // Reprice each line against the latest catalog price before charging, and
  // apply any quantity the shopper has adjusted.
  const pricedLines: CartLine[] = lines.map((line) => ({
    ...line,
    unitPrice: livePrices[line.productId] ?? line.unitPrice,
    quantity: clampQuantity(quantities[line.productId] ?? line.quantity),
  }));

  const subtotal = cartSubtotal(pricedLines);
  const discount = promo ? applyPromoRule(promo, subtotal) : 0;
  const total = cartTotal(pricedLines, discount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await authedFetch("/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // The card number is sent directly to the tokenizing endpoint.
        card,
        lines: pricedLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
        })),
        amountCents: toChargeCents(total),
      }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <ul>
        {pricedLines.map((line) => (
          <li key={line.productId}>
            {line.name} — ${line.unitPrice.toFixed(2)}
            <button
              type="button"
              aria-label={`Decrease quantity of ${line.name}`}
              disabled={line.quantity <= MIN_QUANTITY}
              onClick={() => stepQuantity(line.productId, line.quantity, -1)}
            >
              -
            </button>
            <span aria-label={`Quantity of ${line.name}`}>{line.quantity}</span>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.name}`}
              disabled={line.quantity >= MAX_QUANTITY}
              onClick={() => stepQuantity(line.productId, line.quantity, 1)}
            >
              +
            </button>
          </li>
        ))}
      </ul>
      <p>Subtotal: ${subtotal.toFixed(2)}</p>
      {discount !== 0 && <p>Discount: -${discount.toFixed(2)}</p>}
      <p>Total: ${total.toFixed(2)}</p>
      <input
        value={card}
        onChange={(e) => setCard(e.target.value)}
        placeholder="Card number"
        autoComplete="cc-number"
      />
      <button type="submit">Pay ${total.toFixed(2)}</button>
    </form>
  );
}
