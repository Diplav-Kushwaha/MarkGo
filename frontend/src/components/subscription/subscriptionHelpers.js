/**
 * Display helpers for the company subscription screens.
 *
 * These only describe values the backend already computed. Nothing here
 * calculates a price, a date or a number of days — daysLeft and endDate
 * always come straight from the API.
 */

/** "Free", "per month", "per year", or a generic "per 3 months". */
export function billingLabel(plan) {
  if (!plan) return "";
  if (plan.billingCycle === "FREE") return "Free";
  if (plan.billingCycle === "YEARLY") return "per year";

  const months = plan.durationMonths;
  if (!months) return "per month";
  return months === 1 ? "per month" : `per ${months} months`;
}

/** Billing label from a bare cycle, for history rows that carry no plan object. */
export function billingLabelFor(cycle) {
  if (!cycle) return "";
  if (cycle === "FREE") return "Free";
  if (cycle === "YEARLY") return "per year";
  return "per month";
}

/** True when the plan never expires, i.e. the backend sent a null endDate. */
export function neverExpires(endDate) {
  return endDate === null || endDate === undefined;
}

/** "Never expires", or the backend's daysLeft as plain text. */
export function daysLeftLabel(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return "Never expires";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/** "1 Jan 2026 – 31 Dec 2026", or the start plus "Never expires". */
export function periodText(startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const fmt = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (start && Number.isNaN(start.getTime())) return "—";
  const from = start ? fmt(start) : "—";
  return `${from} – ${end ? fmt(end) : "Never expires"}`;
}

/** Who set the subscription up, in words the UI can show. */
export function createdByLabel(value) {
  switch (value) {
    case "SELF":
      return "You";
    case "SUPERADMIN":
      return "Platform";
    case "SYSTEM":
      return "System";
    default:
      return value || "—";
  }
}

/** A limit value as text: a number, or "Unlimited" when the API sent null. */
export function limitLabel(value) {
  return value === null || value === undefined ? "Unlimited" : String(value);
}

/** True when the backend sent no numeric limit for this row. */
export function isUnlimited(limit) {
  return limit === null || limit === undefined;
}

export const LIMIT_ROWS = [
  { key: "users", label: "Users" },
  { key: "staff", label: "Staff" },
  { key: "customers", label: "Customers" },
  { key: "vendors", label: "Vendors" },
  { key: "invoices", label: "Invoices" },
];
