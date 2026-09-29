// Exchange rates from USD to each supported display currency.
const RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };

// Currency codes supported by `convertFromUsd`, in table order.
export const SUPPORTED_CURRENCIES: readonly string[] = Object.freeze(
  Object.keys(RATES),
);

// Convert a USD amount into the given currency. Throws for any currency code
// that is not in the rate table (including "") rather than returning NaN.
export function convertFromUsd(amountUsd: number, currency: string): number {
  if (!Object.prototype.hasOwnProperty.call(RATES, currency)) {
    throw new Error(
      `Unsupported currency code: "${currency}". Supported: ${SUPPORTED_CURRENCIES.join(", ")}`,
    );
  }
  return amountUsd * RATES[currency];
}

// Format an amount as money in the given currency (en-US conventions).
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}
