// USD-based exchange rates for the currencies the storefront can display.
// Keys are ISO 4217 codes (case-sensitive); values are units of that currency
// per 1 USD.
export const EXCHANGE_RATES: Readonly<Record<string, number>> = Object.freeze({
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
});

// Convert a USD amount into `currency`. Throws for any code that is not in
// the rate table (including "" and inherited names like "toString") rather
// than silently producing NaN.
export function convertFromUsd(amountUsd: number, currency: string): number {
  if (!Object.prototype.hasOwnProperty.call(EXCHANGE_RATES, currency)) {
    throw new Error(`Unsupported currency: ${JSON.stringify(currency)}`);
  }
  return amountUsd * EXCHANGE_RATES[currency];
}

// Format an amount as a currency string for display (en-US conventions).
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}
