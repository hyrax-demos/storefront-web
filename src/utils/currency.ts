// Exchange rates from USD into each supported display currency.
const RATES: Readonly<Record<string, number>> = Object.freeze({
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
});

// Currency codes that convertFromUsd supports, in display order.
export const SUPPORTED_CURRENCIES: readonly string[] = Object.freeze(
  Object.keys(RATES),
);

// Convert a USD amount into `currency`. Throws for any code not in the rate
// table (including "") instead of silently producing NaN.
export function convertFromUsd(amountUsd: number, currency: string): number {
  if (!Object.prototype.hasOwnProperty.call(RATES, currency)) {
    throw new Error(`Unsupported currency: "${currency}"`);
  }
  return amountUsd * RATES[currency];
}

// Format an amount already expressed in `currency` for display.
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}
