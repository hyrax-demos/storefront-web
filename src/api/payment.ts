/**
 * Payment tokenization via Stripe.js.
 *
 * Card data is collected entirely inside Stripe's hosted CardElement iframe and
 * tokenized directly with Stripe's servers.  The raw PAN never enters the
 * application's JavaScript context, DOM, or backend — keeping the application
 * out of PCI DSS CDE scope (SAQ A eligible).
 *
 * Required environment variable:
 *   VITE_STRIPE_PUBLISHABLE_KEY  — Stripe publishable key (pk_live_… / pk_test_…)
 */

// Minimal type declarations for the parts of Stripe.js we use, so we can
// load it dynamically without needing the full @stripe/stripe-js package in
// every environment that hasn't installed it yet.

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

// Cache the loaded Stripe instance so we only inject the script once.
let stripePromise: Promise<StripeInstance> | null = null;

/**
 * Load Stripe.js from Stripe's CDN and return an initialised Stripe instance.
 *
 * Stripe requires their script to be loaded directly from js.stripe.com — any
 * self-hosted or bundled copy is explicitly prohibited and will cause the
 * account to fail PCI compliance checks.
 */
export function loadStripe(): Promise<StripeInstance> {
  if (stripePromise) return stripePromise;

  stripePromise = new Promise<StripeInstance>((resolve, reject) => {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
      string | undefined;

    if (!publishableKey) {
      reject(
        new Error(
          "VITE_STRIPE_PUBLISHABLE_KEY is not set. " +
            "Configure it in .env.local (see .env.example).",
        ),
      );
      return;
    }

    if (typeof window === "undefined") {
      reject(new Error("Stripe.js can only be loaded in a browser context."));
      return;
    }

    // If Stripe.js was already injected by another part of the app, reuse it.
    if ((window as unknown as Record<string, unknown>)["Stripe"]) {
      const StripeConstructor = (
        window as unknown as { Stripe: (key: string) => StripeInstance }
      ).Stripe;
      resolve(StripeConstructor(publishableKey));
      return;
    }

    const script = document.createElement("script");
    // Must be loaded from js.stripe.com — PCI DSS requirement.
    script.src = "https://js.stripe.com/v3/";
    script.async = true;

    script.onload = () => {
      const StripeConstructor = (
        window as unknown as { Stripe: (key: string) => StripeInstance }
      ).Stripe;
      if (!StripeConstructor) {
        reject(new Error("Stripe.js did not expose window.Stripe after load."));
        return;
      }
      resolve(StripeConstructor(publishableKey));
    };

    script.onerror = () => {
      stripePromise = null; // allow retry on next mount
      reject(new Error("Failed to load Stripe.js from js.stripe.com."));
    };

    document.head.appendChild(script);
  });

  return stripePromise;
}
