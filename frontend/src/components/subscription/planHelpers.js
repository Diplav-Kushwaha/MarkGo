/**
 * Small display helpers shared by the public plans, register and payment
 * pages. They only describe what the backend already returned — no price,
 * total or duration is ever calculated here.
 */

/** "Free", "per month", "per year", "per 3 months". */
export function billingLabel(plan) {
  if (!plan) return "";
  if (plan.billingCycle === "FREE") return "Free";
  if (plan.billingCycle === "YEARLY") return "per year";

  const months = plan.durationMonths;
  if (!months) return "per month";
  return months === 1 ? "per month" : `per ${months} months`;
}

/** True when the plan needs no payment step at all. */
export function isFreePlan(plan) {
  return plan?.billingCycle === "FREE";
}

/** One limit value as text: a number, or "Unlimited" when the API sends null. */
export function limitLabel(value) {
  return value === null || value === undefined ? "Unlimited" : String(value);
}

export const LIMIT_ROWS = [
  { key: "users", label: "Users" },
  { key: "staff", label: "Staff" },
  { key: "customers", label: "Customers" },
  { key: "vendors", label: "Vendors" },
  { key: "invoices", label: "Invoices" },
];