/**
 * Currency configuration.
 * Change these values to switch the app's currency display globally.
 */
export const CURRENCY_CODE = "PHP";
export const CURRENCY_LOCALE = "en-US";

/**
 * Format a numeric amount as currency using the configured locale and code.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
  }).format(amount);
}
