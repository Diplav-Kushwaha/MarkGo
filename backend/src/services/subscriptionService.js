import prisma from "../prisma.js";
import { Decimal, toNumber } from "../utils/money.js";

/**
 * Read-only helpers for plans and subscriptions.
 *
 * Nothing in here writes: deciding what a company bought, confirming a payment
 * and blocking anything all live elsewhere. These helpers only read, shape and
 * do date maths, and none of them consult the ENFORCE_SUBSCRIPTION switch.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Explicit ordering so the list is Free first regardless of how the database
// happens to sort the enum.
const BILLING_CYCLE_ORDER = { FREE: 0, MONTHLY: 1, YEARLY: 2 };

/** The five plan limits. A null value means unlimited. */
function limitsOf(plan) {
  if (!plan) return { users: null, staff: null, customers: null, vendors: null, invoices: null };
  return {
    users: plan.maxUsers ?? null,
    staff: plan.maxStaff ?? null,
    customers: plan.maxCustomers ?? null,
    vendors: plan.maxVendors ?? null,
    invoices: plan.maxInvoices ?? null,
  };
}

/**
 * Public shape of a plan. Money is converted with the shared toNumber helper
 * so the API always sends a plain number, and nothing internal leaks out.
 */
export function toPlanDto(plan) {
  if (!plan) return null;

  return {
    id: plan.id,
    name: plan.name,
    price: toNumber(plan.price),
    billingCycle: plan.billingCycle,
    durationMonths: plan.durationMonths ?? null,
    limits: limitsOf(plan),
    isActive: plan.isActive,
  };
}

/** The five limit values for a plan. Used later for the Free-plan limits. */
export function getSubscriptionLimits(plan) {
  return limitsOf(plan);
}

/** Plans that can currently be shown or bought, Free first then cheapest. */
export async function getActivePlans() {
  const plans = await prisma.plan.findMany({ where: { isActive: true } });

  return plans.sort((a, b) => {
    const cycleA = BILLING_CYCLE_ORDER[a.billingCycle] ?? 9;
    const cycleB = BILLING_CYCLE_ORDER[b.billingCycle] ?? 9;
    if (cycleA !== cycleB) return cycleA - cycleB;
    // Compare with Decimal so two prices never collide through float rounding.
    return new Decimal(a.price).cmp(new Decimal(b.price));
  });
}

export async function getPlanById(id) {
  return prisma.plan.findUnique({ where: { id } });
}

/**
 * Adds whole calendar months in UTC. When the starting day does not exist in
 * the target month it clamps to that month's last day (31 Jan + 1 month is
 * 28/29 Feb). The input date is never mutated.
 */
export function addMonthsUtc(startDate, months) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;

  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));

  // Day 0 of the following month is the last day of the target month.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();

  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      Math.min(start.getUTCDate(), lastDayOfTargetMonth),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds()
    )
  );
}

/**
 * When a subscription bought on `startDate` runs out. Null means it never
 * expires, which is how the Free plan is represented.
 */
export function calculateEndDate(plan, startDate) {
  if (!plan) return null;
  if (plan.billingCycle === "FREE") return null;
  if (plan.durationMonths === null || plan.durationMonths === undefined) return null;
  return addMonthsUtc(startDate, plan.durationMonths);
}

/**
 * The company's current usable subscription: newest ACTIVE one whose endDate is
 * empty or still in the future. Always scoped to one company.
 */
export async function getCurrentSubscription(companyId) {
  if (!companyId) return null;

  const now = new Date();

  return prisma.subscription.findFirst({
    where: {
      companyId,
      status: "ACTIVE",
      OR: [{ endDate: null }, { endDate: { gt: now } }],
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    include: { plan: true },
  });
}

/** Whole days left, rounded up. Null when the subscription never expires. */
function wholeDaysLeft(endDate) {
  if (!endDate) return null;

  const remaining = new Date(endDate).getTime() - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/**
 * Where a company stands with its subscription. The stored status alone is
 * never trusted for expiry: a subscription is judged by comparing its endDate
 * with the current time, so an ACTIVE row whose endDate has passed reads as
 * EXPIRED.
 */
export async function getSubscriptionState(companyId) {
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, status: true } })
    : null;

  if (!company) {
    return { state: "NO_SUBSCRIPTION", subscription: null, plan: null, daysLeft: null };
  }

  // Company status is checked first, in this order.
  if (company.status === "SUSPENDED" || company.status === "CANCELLED") {
    return { state: "COMPANY_INACTIVE", subscription: null, plan: null, daysLeft: null };
  }

  if (company.status === "PENDING_PAYMENT") {
    return { state: "PAYMENT_PENDING", subscription: null, plan: null, daysLeft: null };
  }

  const subscription = await getCurrentSubscription(companyId);
  if (subscription) {
    return {
      state: "VALID",
      subscription,
      plan: subscription.plan,
      daysLeft: wholeDaysLeft(subscription.endDate),
    };
  }

  // No usable subscription — worked out whether there ever was one.
  const everSubscribed = await prisma.subscription.findFirst({
    where: { companyId },
    select: { id: true },
  });

  return {
    state: everSubscribed ? "EXPIRED" : "NO_SUBSCRIPTION",
    subscription: null,
    plan: null,
    daysLeft: null,
  };
}