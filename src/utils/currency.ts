// Exchange rates from USD into each supported display currency.
export const RATES: Readonly<Record<string, number>> = Object.freeze({
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
});

// Converts a USD amount into `currency`. Throws for any code that is not an
// own key of RATES (including "" and prototype names like "toString"), so an
// unknown currency can never silently produce NaN.
export function convertFromUsd(amountUsd: number, currency: string): number {
  if (!Object.prototype.hasOwnProperty.call(RATES, currency)) {
    throw new Error(`Unsupported currency code: "${currency}"`);
  }
  return amountUsd * RATES[currency];
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}
