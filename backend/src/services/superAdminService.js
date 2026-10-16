import prisma from "../prisma.js";
import { toNumber } from "../utils/money.js";

/**
 * Platform-wide (Super Admin) reads. These deliberately do NOT filter by
 * `req.user.companyId` — a Super Admin has no company and sees the whole
 * platform. The company being inspected always comes from the route param.
 */

// A CANCELLED invoice is not a realised sale, so it is excluded. This is the
// same rule dashboardService.getDashboardStats uses for `thisMonthSales`.
// Bills carry no CANCELLED status (BillStatus is UNPAID/PARTIALLY_PAID/PAID),
// so expenses need no such exclusion — matching `thisMonthExpenses`.
const REVENUE_STATUS_FILTER = { not: "CANCELLED" };

const DAY_MS = 24 * 60 * 60 * 1000;

function monthWindow() {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

// Every CompanyStatus value, so the dashboard always reports a zero for a
// status that has no companies yet rather than omitting the key. PENDING_PAYMENT
// must stay in this list: it is a real enum value, and the companies groupBy
// below can return it, so leaving it out would drop those companies from
// `byStatus` and make the statuses no longer add up to the total.
const COMPANY_STATUSES = ["ACTIVE", "SUSPENDED", "CANCELLED", "PENDING_PAYMENT"];

// Only these columns may be used for ordering. Guards against a caller-supplied
// field name reaching Prisma, even though the validator already whitelists it.
const COMPANY_SORT_COLUMNS = {
  name: "name",
  createdAt: "createdAt",
  email: "email",
};

/** Effectively valid = ACTIVE and (endDate empty or still in the future). */
function validSubscriptionWhere(now) {
  return { status: "ACTIVE", OR: [{ endDate: null }, { endDate: { gt: now } }] };
}

/** Company filter for the optional subscriptionState query param. */
function subscriptionStateWhere(state, now) {
  if (state === "VALID") return { subscriptions: { some: validSubscriptionWhere(now) } };
  if (state === "NO_SUBSCRIPTION") return { subscriptions: { none: {} } };
  if (state === "EXPIRED") {
    return {
      AND: [
        { subscriptions: { some: {} } },
        { subscriptions: { none: validSubscriptionWhere(now) } },
      ],
    };
  }
  return null;
}

function effectiveSubscriptionStatus(subscription, now) {
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

/**
 * The subscription shown against a company: the effectively valid ACTIVE one if
 * there is one, otherwise the most recently created, shown with its effective
 * status so an expired plan is never presented as active.
 */
function pickSubscription(subscriptions, now) {
  if (!subscriptions.length) return null;

  const valid = subscriptions.find(
    (s) =>
      s.status === "ACTIVE" &&
      (!s.endDate || new Date(s.endDate).getTime() > now.getTime())
  );
  const chosen = valid || subscriptions[0];

  return {
    id: chosen.id,
    planName: chosen.plan?.name ?? null,
    billingCycle: chosen.billingCycle,
    status: effectiveSubscriptionStatus(chosen, now),
    startDate: chosen.startDate,
    endDate: chosen.endDate,
    daysLeft: wholeDaysLeft(chosen.endDate, now),
  };
}

/** One query for every company on the page — never one query per company. */
async function subscriptionsForCompanies(companyIds, now) {
  if (!companyIds.length) return new Map();

  const subscriptions = await prisma.subscription.findMany({
    where: { companyId: { in: companyIds } },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true } } },
  });

  const byCompany = new Map();
  for (const subscription of subscriptions) {
    if (!byCompany.has(subscription.companyId)) {
      byCompany.set(subscription.companyId, []);
    }
    byCompany.get(subscription.companyId).push(subscription);
  }
  return byCompany;
}

/**
 * GET /api/superadmin/companies
 * Platform-wide company list. Pagination, search, status filter and sorting are
 * all applied in the database — no rows are loaded into memory to be filtered.
 */
export async function listCompanies({
  search = "",
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
  page = 1,
  pageSize = 20,
  subscriptionState,
} = {}) {
  const now = new Date();
  const term = typeof search === "string" ? search.trim() : "";

  const where = {};
  if (term) {
    where.OR = [
      { name: { contains: term } },
      { slug: { contains: term } },
      { email: { contains: term } },
      { gstNumber: { contains: term } },
    ];
  }
  if (status) where.status = status;

  // Optional subscription filter, applied in the database rather than in memory.
  const subscriptionClause = subscriptionState
    ? subscriptionStateWhere(subscriptionState, now)
    : null;
  if (subscriptionClause) where.AND = [subscriptionClause];

  const orderBy = { [COMPANY_SORT_COLUMNS[sortBy] || "createdAt"]: sortOrder === "asc" ? "asc" : "desc" };

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        _count: {
          select: {
            users: true,
            // Soft-deleted customers/vendors are excluded here so the list
            // agrees with getCompanyDetails.
            customers: { where: { isDeleted: false } },
            vendors: { where: { isDeleted: false } },
            invoices: true,
          },
        },
      },
    }),
    prisma.company.count({ where }),
  ]);

  // One extra query covers the whole page — never one query per company.
  const subscriptionsByCompany = await subscriptionsForCompanies(
    companies.map((company) => company.id),
    now
  );

  return {
    companies: companies.map((company) => ({
      ...company,
      subscription: pickSubscription(
        subscriptionsByCompany.get(company.id) || [],
        now
      ),
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

/**
 * GET /api/superadmin/dashboard
 * Platform-wide totals. Every figure is aggregated in the database and all
 * queries run concurrently.
 *
 * Revenue and expense use the same accrual basis as getCompanyDetails so the
 * two screens always agree.
 */
export async function getPlatformDashboard() {
  const [
    totalCompanies,
    companiesByStatus,
    totalVendors,
    totalCustomers,
    invoiceAgg,
    billAgg,
    recentCompanies,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.vendor.count({ where: { isDeleted: false } }),
    prisma.customer.count({ where: { isDeleted: false } }),
    prisma.invoice.aggregate({
      where: { status: REVENUE_STATUS_FILTER },
      _sum: { grandTotal: true },
      _count: { id: true },
    }),
    prisma.bill.aggregate({ _sum: { total: true } }),
    prisma.company.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, slug: true, email: true, createdAt: true },
    }),
  ]);

  const byStatus = Object.fromEntries(COMPANY_STATUSES.map((value) => [value, 0]));
  for (const row of companiesByStatus) {
    byStatus[row.status] = row._count._all;
  }

  const totalBilled = toNumber(invoiceAgg._sum.grandTotal);
  const totalExpense = toNumber(billAgg._sum.total);

  return {
    companies: {
      total: totalCompanies,
      byStatus,
    },
    people: {
      vendors: totalVendors,
      customers: totalCustomers,
    },
    invoices: {
      total: invoiceAgg._count.id,
      totalBilled,
      totalExpense,
      // Signed number; the frontend decides the colour and +/- sign.
      profitOrLoss: Number((totalBilled - totalExpense).toFixed(2)),
    },
    recentCompanies,
  };
}

/**
 * GET /api/superadmin/companies/:id
 * Read-only company profile, profit/loss and headcount. Exposes no customer,
 * invoice, bill or payment rows — only totals — so no company-internal data
 * leaks through this endpoint.
 */
export async function getCompanyDetails({ companyId }) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      address: true,
      city: true,
      country: true,
      gstNumber: true,
      status: true,
      createdAt: true,
      plan: { select: { id: true, name: true, price: true } },
      // The primary admin is the first COMPANY_ADMIN row for the company.
      users: {
        where: { role: "COMPANY_ADMIN" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!company) {
    const err = new Error("Company not found.");
    err.status = 404;
    throw err;
  }

  const window = monthWindow();

  // All counts and aggregates for the single company in the route param.
  const [revenueAgg, expenseAgg, monthRevenueAgg, monthExpenseAgg, customerCount, vendorCount, adminCount] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { companyId, status: REVENUE_STATUS_FILTER },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      prisma.bill.aggregate({
        where: { companyId },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: { companyId, status: REVENUE_STATUS_FILTER, invoiceDate: window },
        _sum: { grandTotal: true },
      }),
      prisma.bill.aggregate({
        where: { companyId, billDate: window },
        _sum: { total: true },
      }),
      prisma.customer.count({ where: { companyId, isDeleted: false } }),
      prisma.vendor.count({ where: { companyId, isDeleted: false } }),
      prisma.user.count({ where: { companyId, role: "COMPANY_ADMIN" } }),
    ]);

const totalRevenue = toNumber(revenueAgg._sum.grandTotal);
  const totalExpense = toNumber(expenseAgg._sum.total);
  // Returned as a signed number; the frontend decides the colour and +/- sign.
  const profitOrLoss = Number((totalRevenue - totalExpense).toFixed(2));

  // Subscription state for this one company, plus a short history.
  const now = new Date();
  const [subscriptions, activeSubscriptions] = await Promise.all([
    prisma.subscription.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { plan: { select: { name: true } } },
    }),
    prisma.subscription.findMany({
      where: { companyId, ...validSubscriptionWhere(now) },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { name: true } } },
    }),
  ]);

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      email: company.email,
      address: company.address,
      city: company.city,
      country: company.country,
      gstNumber: company.gstNumber,
      status: company.status,
      createdAt: company.createdAt,
      plan: company.plan
        ? { id: company.plan.id, name: company.plan.name, price: toNumber(company.plan.price) }
        : null,
      admin: company.users[0]
        ? {
            id: company.users[0].id,
            fullName: company.users[0].fullName,
            email: company.users[0].email,
            phoneNumber: company.users[0].phoneNumber,
            isActive: company.users[0].isActive,
            lastLoginAt: company.users[0].lastLoginAt,
            createdAt: company.users[0].createdAt,
          }
        : null,
    },
    subscription: pickSubscription(activeSubscriptions.length ? activeSubscriptions : subscriptions, now),
    subscriptionHistory: subscriptions.map((subscription) => ({
      id: subscription.id,
      planName: subscription.plan?.name ?? null,
      billingCycle: subscription.billingCycle,
      priceAtPurchase: toNumber(subscription.priceAtPurchase),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      createdBy: subscription.createdBy,
      status: subscription.status,
      effectiveStatus: effectiveSubscriptionStatus(subscription, now),
      daysLeft: wholeDaysLeft(subscription.endDate, now),
    })),
    finance: {
      totalRevenue,
      totalExpense,
      profitOrLoss,
      // Same figures, scoped to the current calendar month, so this view lines up
      // with the company's own dashboard cards.
      thisMonth: {
        revenue: toNumber(monthRevenueAgg._sum.grandTotal),
        expense: toNumber(monthExpenseAgg._sum.total),
      },
      invoiceCount: revenueAgg._count.id,
      billCount: expenseAgg._count.id,
    },
    counts: {
      customers: customerCount,
      vendors: vendorCount,
      companyAdmins: adminCount,
    },
  };
}
