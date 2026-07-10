import { useEffect, useRef, useState } from "react";
import { authedFetch } from "../api/client";
import {
  loadStripe,
  type StripeCardElement,
  type StripeInstance,
} from "../api/payment";
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
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // References to the Stripe instance and hosted CardElement.
  // The CardElement is an iframe owned entirely by Stripe — raw card data
  // (PAN, CVV, expiry) never enters our JavaScript context, DOM, or backend.
  const stripeRef = useRef<StripeInstance | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);
  const cardMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ids = lines.map((l) => l.productId);
    if (ids.length === 0) return;
    fetchCatalogPrices(ids).then(setLivePrices);
  }, [lines]);

  // Mount the Stripe CardElement into the dedicated container div.
  // The element is an iframe served by Stripe; no card data touches our code.
  useEffect(() => {
    let cancelled = false;

    loadStripe()
      .then((stripe) => {
        if (cancelled || !cardMountRef.current) return;
        stripeRef.current = stripe;
        const elements = stripe.elements();
        const card = elements.create("card");
        // The `card` object has a `.mount(container)` method on the real Stripe
        // CardElement.  We cast through `unknown` because our lightweight type
        // declaration above is intentionally minimal.
        (card as unknown as { mount(el: HTMLDivElement): void }).mount(
          cardMountRef.current,
        );
        cardElementRef.current = card;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStripeError(
            err instanceof Error ? err.message : "Payment unavailable.",
          );
        }
      });

    return () => {
      cancelled = true;
      // Unmount the CardElement to avoid memory/DOM leaks on re-renders.
      if (cardElementRef.current) {
        (cardElementRef.current as unknown as { unmount(): void }).unmount();
        cardElementRef.current = null;
      }
    };
  }, []);

  // Reprice each line against the latest catalog price before charging.
  const pricedLines: CartLine[] = lines.map((line) => ({
    ...line,
    unitPrice: livePrices[line.productId] ?? line.unitPrice,
  }));

  const discount = promo ? applyPromoRule(promo, sumLines(pricedLines)) : 0;
  const total = cartTotal(pricedLines, discount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStripeError(null);

    const stripe = stripeRef.current;
    const cardElement = cardElementRef.current;
    if (!stripe || !cardElement) {
      setStripeError("Payment form is not ready. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      // Tokenize the card data entirely within Stripe's infrastructure.
      // createPaymentMethod() contacts Stripe's servers directly from the
      // browser; the raw PAN never reaches our application backend.
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (error) {
        setStripeError(
          error.message ?? "Card error. Please check your details.",
        );
        return;
      }

      if (!paymentMethod?.id) {
        setStripeError("Could not tokenize card. Please try again.");
        return;
      }

      // Only the opaque payment method token is sent to our backend — never
      // the raw PAN, CVV, or expiry. This keeps our server outside PCI CDE.
      await authedFetch("/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
          amountCents: toChargeCents(total),
        }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <ul>
        {pricedLines.map((line) => (
          <li key={line.productId}>
            {line.name} × {line.quantity} — ${line.unitPrice.toFixed(2)}
          </li>
        ))}
      </ul>
      <p>Total: ${total.toFixed(2)}</p>

      {/*
       * Stripe CardElement mounts here as a sandboxed iframe.
       * Card data (PAN, CVV, expiry) is collected and tokenized by Stripe
       * directly — it never enters this application's JavaScript or backend.
       */}
      <div ref={cardMountRef} id="stripe-card-element" />

      {stripeError && (
        <p role="alert" style={{ color: "red" }}>
          {stripeError}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? "Processing…" : `Pay $${total.toFixed(2)}`}
      </button>
    </form>
  );
}

function sumLines(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
