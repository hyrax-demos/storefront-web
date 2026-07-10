/**
 * Payment tokenization via Stripe.js.
 *
 * Card data is collected entirely inside Stripe's hosted CardElement iframe and
 * tokenized directly with Stripe's servers.  The raw PAN never enters the
 * application's JavaScript context, DOM, or backend — keeping the application
 * out of PCI DSS CDE scope (SAQ A eligible).
 *
 * Stripe.js is loaded as a static pinned literal <script> tag in index.html
 * (not via dynamic injection here) so the source URL is statically auditable
 * and cannot be altered at runtime.
 *
 * Required environment variable:
 *   VITE_STRIPE_PUBLISHABLE_KEY  — Stripe publishable key (pk_live_… / pk_test_…)
 */

// Minimal type declarations for the parts of Stripe.js we use, so we can
// reference it without needing the full @stripe/stripe-js package.

export interface StripeCardElement {
  // Stripe CardElement instance (opaque to us — we only pass it back to Stripe).
  _brand: "StripeCardElement";
}

export interface StripeInstance {
  elements(): { create(type: "card"): StripeCardElement };
  createPaymentMethod(params: {
    type: "card";
    card: StripeCardElement;
  }): Promise<{ paymentMethod?: { id: string }; error?: { message: string } }>;
}

// Cache the initialised Stripe instance so we only construct it once.
let stripePromise: Promise<StripeInstance> | null = null;

/**
 * Return an initialised Stripe instance.
 *
 * Stripe.js is expected to already be present on window.Stripe, loaded by the
 * static <script src="https://js.stripe.com/v3/"> tag in index.html.
 * No dynamic script injection is performed here — the URL is a pinned literal
 * in HTML and cannot be overridden by application code.
 */
export function loadStripe(): Promise<StripeInstance> {
  if (stripePromise) return stripePromise;

  stripePromise = new Promise<StripeInstance>((resolve, reject) => {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
      string | undefined;

    if (!publishableKey) {
      stripePromise = null;
      reject(
        new Error(
          "VITE_STRIPE_PUBLISHABLE_KEY is not set. " +
            "Configure it in .env.local (see .env.example).",
        ),
      );
      return;
    }

    if (typeof window === "undefined") {
      stripePromise = null;
      reject(new Error("Stripe.js can only be used in a browser context."));
      return;
    }

    // Stripe.js is loaded via the static <script> tag in index.html.
    // By the time React mounts, window.Stripe is guaranteed to be present.
    const StripeConstructor = (
      window as unknown as { Stripe?: (key: string) => StripeInstance }
    ).Stripe;

    if (!StripeConstructor) {
      stripePromise = null;
      reject(
        new Error(
          "window.Stripe is not defined. " +
            "Ensure the Stripe.js <script> tag is present in index.html.",
        ),
      );
      return;
    }

    resolve(StripeConstructor(publishableKey));
  });

  return stripePromise;
}
