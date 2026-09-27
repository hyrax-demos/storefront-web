// Exchange rates from USD into each supported currency.
export const RATES: Readonly<Record<string, number>> = Object.freeze({
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
});

export const SUPPORTED_CURRENCIES: readonly string[] = Object.freeze(
  Object.keys(RATES),
);

// Converts a USD amount into `currency`. Throws for unknown currency codes
// (lookup is case-sensitive and ignores prototype keys).
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
