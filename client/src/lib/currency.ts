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
  UGX: "USh",
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
  { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
];

export function getCurrencySymbol(currencyCode: string | undefined | null): string {
  return CURRENCY_SYMBOLS[currencyCode || "EUR"] || "€";
}

export function formatAmount(amount: number | string, currencyCode?: string | null): string {
  const symbol = getCurrencySymbol(currencyCode);
  const numAmount = typeof amount === "string" ? Number(amount) : amount;
  return `${symbol}${numAmount.toFixed(2)}`;
}

export function formatAmountWithSign(amount: number | string, currencyCode?: string | null, isExpense = true): string {
  const symbol = getCurrencySymbol(currencyCode);
  const numAmount = typeof amount === "string" ? Number(amount) : amount;
  const sign = isExpense ? "-" : "+";
  return `${sign}${symbol}${numAmount.toFixed(2)}`;
}
