// USD -> target currency exchange rates. Internal: callers go through
// `convertFromUsd` so unknown currencies fail loudly instead of yielding NaN.
const RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };

// Currency codes supported by `convertFromUsd`, in rate-table order.
export const SUPPORTED_CURRENCIES: readonly string[] = Object.freeze(
  Object.keys(RATES),
);

// Convert a USD amount into `currency` using the rate table. Throws for any
// currency code not present in the table (including the empty string).
export function convertFromUsd(amountUsd: number, currency: string): number {
  if (!Object.prototype.hasOwnProperty.call(RATES, currency)) {
    throw new Error(
      `Unsupported currency "${currency}": expected one of ${SUPPORTED_CURRENCIES.join(", ")}`,
    );
  }
  return amountUsd * RATES[currency];
}

// Format an amount as a localized (en-US) currency string, e.g. "$1,234.50".
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}
