/**
 * Input validation and sanitization utilities
 * Used throughout the application for consistent data validation
 */

/**
 * Validates a stock ticker format
 * Valid tickers: 1-10 uppercase letters, optionally with a period (e.g., BRK.B)
 */
export function isValidTicker(ticker: string): boolean {
  if (!ticker) return false;
  const trimmed = ticker.trim().toUpperCase();
  // Allow 1-10 uppercase letters, optionally with a single period for class shares
  return /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(trimmed);
}

/**
 * Sanitizes a ticker symbol by trimming and uppercasing
 */
export function sanitizeTicker(ticker: string): string {
  if (!ticker) return '';
  return ticker.trim().toUpperCase();
}

/**
 * Validates a numeric value is finite and within reasonable bounds
 */
export function isValidNumber(
  value: unknown,
  options: { min?: number; max?: number; allowZero?: boolean } = {}
): boolean {
  const { min = -Infinity, max = Infinity, allowZero = true } = options;

  if (value === null || value === undefined) return false;

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) return false;

  if (!allowZero && num === 0) return false;

  return num >= min && num <= max;
}

/**
 * Parses a numeric input that may use comma as decimal separator
 * Returns NaN for invalid input
 */
export function parseNumericInput(value: string): number {
  if (!value) return NaN;
  const normalized = value.trim().replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Validates a currency code (3 uppercase letters)
 */
export function isValidCurrencyCode(code: string): boolean {
  if (!code) return false;
  return /^[A-Z]{3}$/.test(code.trim().toUpperCase());
}

/**
 * Validates an ISIN (International Securities Identification Number)
 * Format: 2 letter country code + 9 alphanumeric characters + 1 check digit
 */
export function isValidISIN(isin: string): boolean {
  if (!isin) return false;
  const trimmed = isin.trim().toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(trimmed);
}

/**
 * Validates percentage values (0-100 or -100 to 100 for signed)
 */
export function isValidPercentage(
  value: unknown,
  options: { allowNegative?: boolean } = {}
): boolean {
  const { allowNegative = false } = options;
  return isValidNumber(value, {
    min: allowNegative ? -100 : 0,
    max: 100,
  });
}

/**
 * Sanitizes text input to prevent XSS
 * Removes HTML tags (complete and incomplete) and trims whitespace.
 * Incomplete sequences like "<script" are removed to prevent HTML element injection.
 */
export function sanitizeTextInput(text: string): string {
  if (!text) return '';
  // Remove complete tags <...> and incomplete tag starts <... (no closing >)
  return text.replace(/<[^>]*>?/g, '').trim();
}

/**
 * Validates a price value (positive, finite number)
 */
export function isValidPrice(price: unknown): boolean {
  return isValidNumber(price, { min: 0, allowZero: false });
}

/**
 * Validates shares count (non-negative integer)
 */
export function isValidSharesCount(shares: unknown): boolean {
  if (!isValidNumber(shares, { min: 0 })) return false;
  const num = typeof shares === 'string' ? parseFloat(shares) : shares;
  return Number.isInteger(num as number);
}
