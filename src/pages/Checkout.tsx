import { useEffect, useState } from "react";
import { authedFetch } from "../api/client";
import { cartTotal, toChargeCents, type CartLine } from "../utils/cart";
import { applyPromoRule, type PromoRule } from "../utils/promo";
import { useCart } from "../context/CartContext";
import { CartSummary } from "../components/CartSummary";

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

export function Checkout({ promo }: { promo: PromoRule | null }) {
  const { lines, setQuantity, removeItem } = useCart();
  const [card, setCard] = useState("");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // Key on the product ids so quantity changes don't trigger a re-fetch.
  const idsKey = lines.map((l) => l.productId).join(",");
  useEffect(() => {
    if (idsKey === "") return;
    fetchCatalogPrices(idsKey.split(",")).then(setLivePrices);
  }, [idsKey]);

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
      <ul>
        {pricedLines.map((line) => (
          <li key={line.productId}>
            {line.name} × {line.quantity} — ${line.unitPrice.toFixed(2)}{" "}
            <button
              type="button"
              aria-label={`Decrease ${line.name}`}
              onClick={() => setQuantity(line.productId, line.quantity - 1)}
            >
              −
            </button>
            <button
              type="button"
              aria-label={`Increase ${line.name}`}
              onClick={() => setQuantity(line.productId, line.quantity + 1)}
            >
              +
            </button>
            <button
              type="button"
              aria-label={`Remove ${line.name}`}
              onClick={() => removeItem(line.productId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <CartSummary lines={pricedLines} promo={promo} />
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

function sumLines(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
