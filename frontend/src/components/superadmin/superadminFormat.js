/**
 * Safe display formatters for the Super Admin console.
 *
 * The backend always returns numbers, but a defensive layer here guarantees the
 * UI can never render "NaN", "undefined" or "null" if a field is ever missing.
 * Super Admin only — the shared app formatters are left untouched.
 */

export const DASH = "—";

/** Coerces anything to a finite number, falling back to 0. */
export function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Thousands-separated integer, e.g. 12345 -> "12,345". */
export function formatCount(value) {
  return safeNumber(value).toLocaleString("en-IN");
}

const compactFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 2,
});

/**
 * Compact currency for stat cards, e.g. 120000 -> "1.2L".
 * Returns "-" for null/undefined/NaN so a card never shows a broken value.
 */
export function formatCompactCurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DASH;
  return compactFormatter.format(parsed);
}

const fullFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** Full currency, used in the financial summary and tooltips. */
export function formatFullCurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DASH;
  return fullFormatter.format(parsed);
}

/** "12 Aug 2026". Returns "-" for missing or unparseable dates. */
export function formatDateLabel(value) {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Joins the parts of an address, skipping blanks. Returns "-" when empty. */
export function joinLocation({ address, city, country } = {}) {
  const parts = [address, city, country].map((part) => (part || "").trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : DASH;
}

/** Formats a value that may legitimately be missing, e.g. GST number. */
export function orDash(value) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || DASH;
}
