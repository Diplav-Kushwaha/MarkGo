/**
 * Display helpers for Super Admin plan and subscription screens.
 *
 * These only describe values the backend already computed — no price, total,
 * count, date or day count is calculated here.
 */

/** "Free", "per month", "per year", or a generic "per 3 months". */
export function planBillingLabel(plan) {
  if (!plan) return "";
  if (plan.billingCycle === "FREE") return "Free";
  if (plan.billingCycle === "YEARLY") return "per year";

  const months = plan.durationMonths;
  if (!months) return "per month";
  return months === 1 ? "per month" : `per ${months} months`;
}

/** Billing label from a bare cycle, for rows that carry no plan object. */
export function billingLabelFor(cycle) {
  if (!cycle) return "";
  if (cycle === "FREE") return "Free";
  if (cycle === "YEARLY") return "per year";
  return "per month";
}

/** True when a plan or subscription never expires (the API sent null). */
export function neverExpires(endDate) {
  return endDate === null || endDate === undefined;
}

/** A limit value as text: a number, or "Unlimited" when null. */
export function limitText(value) {
  return value === null || value === undefined ? "Unlimited" : String(value);
}

export function isUnlimited(value) {
  return value === null || value === undefined;
}

/** "1 Jan 2026 – 31 Dec 2026", or the start plus "Never expires". */
export function subscriptionPeriod(startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const fmt = (d) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (start && Number.isNaN(start.getTime())) return "—";
  const from = start ? fmt(start) : "—";
  return `${from} – ${end ? fmt(end) : "Never expires"}`;
}

/** Who set the subscription up, in words the console can show. */
export function createdByLabel(value) {
  switch (value) {
    case "SELF":
      return "Company";
    case "SUPERADMIN":
      return "Platform";
    case "SYSTEM":
      return "System";
    default:
      return value || "—";
  }
}

/** Friendly name for a payment method code. */
export function paymentMethodLabel(value) {
  switch (value) {
    case "DUMMY":
      return "Online (demo)";
    case "MANUAL":
      return "Manual";
    default:
      return value || "—";
  }
}

/**
 * The five plan limits.
 *
 * `key` is the form/body field name the API expects (maxUsers, …).
 * `dtoKey` is the SHORT name the API returns inside a plan's `limits` object
 * (users, staff, …) — reading `limits.maxUsers` always yields undefined, which
 * is why limits must be compared with `dtoKey`.
 */
export const PLAN_LIMIT_ROWS = [
  { key: "maxUsers", dtoKey: "users", label: "Users" },
  { key: "maxStaff", dtoKey: "staff", label: "Staff" },
  { key: "maxCustomers", dtoKey: "customers", label: "Customers" },
  { key: "maxVendors", dtoKey: "vendors", label: "Vendors" },
  { key: "maxInvoices", dtoKey: "invoices", label: "Invoices" },
];
