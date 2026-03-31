export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CHF: "CHF",
  CNY: "¥",
  INR: "₹",
  MXN: "MX$",
  UGX: "UGX",
  KES: "KSh",
  TZS: "TSh",
};

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "UGX", symbol: "UGX", name: "Ugandan Shilling" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
];

const ZERO_DECIMAL_CURRENCIES = new Set(["UGX", "KES", "TZS", "JPY", "KRW", "VND", "BIF", "GNF", "MGA", "PYG", "RWF", "XAF", "XOF"]);

export function isZeroDecimalCurrency(currencyCode?: string | null): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currencyCode || "");
}

export function getCurrencySymbol(currencyCode: string | undefined | null): string {
  if (!currencyCode) return "";
  return CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
}

/**
 * Format a number consistently with the en-US locale so that thousand
 * separators are always commas and decimal separators are always dots,
 * regardless of the user's system/browser locale.
 */
function formatNumber(num: number, currencyCode?: string | null): string {
  if (isZeroDecimalCurrency(currencyCode)) {
    return Math.round(num).toLocaleString("en-US");
  }
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatAmount(amount: number | string, currencyCode?: string | null): string {
  const symbol = getCurrencySymbol(currencyCode);
  const numAmount = typeof amount === "string" ? Number(amount) : amount;
  return `${symbol}${formatNumber(numAmount, currencyCode)}`;
}

export function formatAmountWithSign(amount: number | string, currencyCode?: string | null, isExpense = true): string {
  const symbol = getCurrencySymbol(currencyCode);
  const numAmount = typeof amount === "string" ? Number(amount) : amount;
  const sign = isExpense ? "-" : "+";
  return `${sign}${symbol}${formatNumber(numAmount, currencyCode)}`;
}

export function toFixedAmount(amount: number, currencyCode?: string | null): string {
  return formatNumber(amount, currencyCode);
}
