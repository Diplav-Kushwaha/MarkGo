import prisma from "../prisma.js";
import { toNumber } from "../utils/money.js";

/**
 * Super Admin subscription reporting: the platform-wide list and the dashboard
 * summary. Everything is aggregated in the database and run in parallel; no
 * subscription or payment rows are loaded wholesale just to be counted.
 *
 * Only PAID payments count as money collected — PENDING and FAILED never do.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EXPIRING_DAYS = 7;

/** Stored ACTIVE with a past endDate reads as EXPIRED. */
function effectiveStatusOf(subscription, now) {
  if (subscription.status === "ACTIVE" && subscription.endDate) {
    if (new Date(subscription.endDate).getTime() <= now.getTime()) return "EXPIRED";
  }
  return subscription.status;
}

function wholeDaysLeft(endDate, now) {
  if (!endDate) return null;
  const remaining = new Date(endDate).getTime() - now.getTime();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/** Effectively valid = ACTIVE and (endDate empty or still in the future). */
function validWhere(now) {
  return { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] };
}

/** Turns one of the requested state filters into a Prisma where clause. */
function stateWhere(state, now, expiringDays) {
  const valid = validWhere(now);
  const past = { endDate: { lte: now } };

  switch (state) {
    case "ACTIVE":
      return valid;
    case "EXPIRED":
      return {
        OR: [
          { status: "EXPIRED" },
          { AND: [{ status: "ACTIVE" }, past] },
        ],
      };
    case "PENDING":
      return { status: "PENDING" };
    case "CANCELLED":
      return { status: "CANCELLED" };
    case "EXPIRING":
      return {
        AND: [
          valid,
          {
            endDate: {
              gt: now,
              lte: new Date(now.getTime() + expiringDays * DAY_MS),
            },
          },
        ],
      };
    default:
      return null;
  }
}

/** GET /api/superadmin/subscriptions */
export async function listSubscriptions({
  page = 1,
  pageSize = 20,
  state,
  planId,
  companyId,
  search,
  days = DEFAULT_EXPIRING_DAYS,
} = {}) {
  const now = new Date();

  const where = {};
  const stateClause = stateWhere(state, now, days);
  if (stateClause) where.AND = [stateClause];
  if (planId) where.planId = planId;
  if (companyId) where.companyId = companyId;

  const term = typeof search === "string" ? search.trim() : "";
  if (term) {
    where.company = {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    };
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true, slug: true, status: true } },
        plan: { select: { id: true, name: true, billingCycle: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    items: subscriptions.map((subscription) => ({
      id: subscription.id,
      company: subscription.company,
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      priceAtPurchase: toNumber(subscription.priceAtPurchase),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      createdBy: subscription.createdBy,
      status: subscription.status,
      effectiveStatus: effectiveStatusOf(subscription, now),
      daysLeft: wholeDaysLeft(subscription.endDate, now),
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/** GET /api/superadmin/subscriptions/summary */
export async function getSubscriptionSummary() {
  const now = new Date();
  const valid = validWhere(now);
  const past = { endDate: { lte: now } };
  const soon = { gt: now, lte: new Date(now.getTime() + DEFAULT_EXPIRING_DAYS * DAY_MS) };

  const [
    plans,
    collectedAgg,
    paidCount,
    paidByPlan,
    paidByMethod,
    subActive,
    subExpired,
    subPending,
    subCancelled,
    subExpiring,
    companiesTotal,
    companiesValid,
    companiesPendingPayment,
    recentPayments,
  ] = await Promise.all([
    prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      select: { id: true, name: true, billingCycle: true },
    }),
    prisma.subscriptionPayment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.subscriptionPayment.count({ where: { status: "PAID" } }),
    prisma.subscriptionPayment.groupBy({
      by: ["planId"],
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.subscriptionPayment.groupBy({
      by: ["paymentMethod"],
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.subscription.count({ where: valid }),
    prisma.subscription.count({
      where: { OR: [{ status: "EXPIRED" }, { AND: [{ status: "ACTIVE" }, past] }] },
    }),
    prisma.subscription.count({ where: { status: "PENDING" } }),
    prisma.subscription.count({ where: { status: "CANCELLED" } }),
    prisma.subscription.count({ where: { AND: [valid, { endDate: soon }] } }),
    prisma.company.count(),
    prisma.company.count({
      where: { subscriptions: { some: valid } },
    }),
    prisma.company.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.subscriptionPayment.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 10,
      include: {
        company: { select: { name: true } },
        plan: { select: { name: true } },
      },
    }),
  ]);

  // Active/expired per plan, so every plan reports even with no activity.
  const activeByPlan = await prisma.subscription.groupBy({
    by: ["planId"],
    where: valid,
    _count: { _all: true },
  });
  const expiredByPlan = await prisma.subscription.groupBy({
    by: ["planId"],
    where: { OR: [{ status: "EXPIRED" }, { AND: [{ status: "ACTIVE" }, past] }] },
    _count: { _all: true },
  });

  const activeMap = new Map(activeByPlan.map((r) => [r.planId, r._count._all]));
  const expiredMap = new Map(expiredByPlan.map((r) => [r.planId, r._count._all]));
  const paidMap = new Map(paidByPlan.map((r) => [r.planId, r]));

  return {
    totals: {
      totalCollected: toNumber(collectedAgg._sum.amount),
      paidPaymentsCount: paidCount,
    },
    byPlan: plans.map((plan) => {
      const paid = paidMap.get(plan.id);
      return {
        planId: plan.id,
        planName: plan.name,
        billingCycle: plan.billingCycle,
        activeSubscriptions: activeMap.get(plan.id) ?? 0,
        expiredSubscriptions: expiredMap.get(plan.id) ?? 0,
        paymentsCount: paid?._count._all ?? 0,
        collected: paid ? toNumber(paid._sum.amount) : 0,
      };
    }),
    byMethod: paidByMethod.map((row) => ({
      method: row.paymentMethod ?? "UNKNOWN",
      paymentsCount: row._count._all,
      collected: toNumber(row._sum.amount),
    })),
    subscriptions: {
      active: subActive,
      expired: subExpired,
      pending: subPending,
      cancelled: subCancelled,
      expiringIn7Days: subExpiring,
    },
    companies: {
      total: companiesTotal,
      withValidSubscription: companiesValid,
      withoutValidSubscription: Math.max(0, companiesTotal - companiesValid),
      pendingPayment: companiesPendingPayment,
    },
    recentPayments: recentPayments.map((payment) => ({
      companyName: payment.company?.name ?? null,
      planName: payment.plan?.name ?? null,
      amount: toNumber(payment.amount),
      method: payment.paymentMethod ?? null,
      paidAt: payment.paidAt,
    })),
  };
}