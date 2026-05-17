export const DISCLAIMER =
  "\n\n---\n*Educational information only — not regulated financial advice. Numbers were computed by the app's deterministic engines.*";

const SAFE_CAPS = new Set([
  "EUR", "USD", "GBP", "CHF", "JPY", "AUD", "CAD", "NZD",
  "ETA", "GDP", "API", "MTD", "YTD", "ROI", "APR", "APY",
  "ISA", "ETF", "LTV", "AUM", "NAV", "FX", "UK", "US",
  "IE", "EU", "OK", "ID", "AI", "HR", "PR", "IT",
]);

const TICKER_RE = /\b[A-Z]{2,5}\b/g;
const TOKEN_LIMIT = 4000;

export interface FilterResult {
  ok: boolean;
  flaggedTicker?: string;
  text?: string;
}

export function applyOutputFilter(text: string): FilterResult {
  const approxTokens = Math.ceil(text.length / 4);
  if (approxTokens > TOKEN_LIMIT) {
    return { ok: false };
  }

  const matches = text.match(TICKER_RE) ?? [];
  for (const match of matches) {
    if (!SAFE_CAPS.has(match)) {
      return { ok: false, flaggedTicker: match };
    }
  }

  return { ok: true, text: text + DISCLAIMER };
}
