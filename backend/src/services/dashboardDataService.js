import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import { toNumber } from "../utils/money.js";
import * as reports from "./reportReadService.js";

/**
 * Dashboard data service (Company Admin).
 *
 * STRICTLY READ-ONLY. Every figure is produced by REUSING the existing Reports
 * read service (`reportReadService.js`) so the dashboard numbers are the report
 * numbers by construction, never a second calculation with different rules:
 *   - Total sales        <- getSalesReportList.summary.totalSales
 *   - Total purchases    <- getPurchasesReportList.summary.totalPurchases
 *   - Profit / loss      <- getProfitLossReport.summary.netProfit (same cost rule)
 *   - Amount to receive  <- getCustomersReport.summary.totalDue (no date range)
 *   - Amount to pay      <- getVendorsReport.summary.totalDue   (no date range)
 *   - Customers/Vendors  <- the party reports' `matchingPartiesInCompany`
 *   - Products/Services  <- getProductsReport / getServicesReport cards
 *   - Top products       <- getSoldProductsReport (products actually sold)
 *
 * The one thing that has no Reports counterpart is the income/expense flow, so
 * its per-bucket series is read here with a single parameterised, read-only
 * SELECT whose direction rule is identical to the Transactions report (a payment
 * on an invoice is money in, a payment on a bill is money out).
 *
 * There is NO Bank / Cash / Account model in the schema, so no cash balance is
 * ever computed here; the summary marks that card unavailable instead of
 * inventing a number.
 */

const pad2 = (value) => String(value).padStart(2, "0");

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

// --- Date helpers ----------------------------------------------------------
// The frontend sends plain YYYY-MM-DD; the report service reads that as UTC
// midnight (the Prisma/MySQL session is UTC too), so the dashboard uses the
// exact same boundaries and its monthly bars equal the reports for that month.

const startOfUtcDay = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const endOfUtcDay = (value) => new Date(startOfUtcDay(value).getTime() + 24 * 60 * 60 * 1000 - 1);

const toUtcYmd = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

const toLocalYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function startOfWeekLocal(date) {
  const copy = new Date(date);
  const diff = (copy.getDay() + 6) % 7; // Monday-based, matching the rest of the app
  copy.setDate(copy.getDate() - diff);
  return copy;
}

/** The from/to pair a preset stands for, in the viewer's local dates. */
function presetDates(preset) {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: toLocalYmd(now), to: toLocalYmd(now) };
    case "week":
      return { from: toLocalYmd(startOfWeekLocal(now)), to: toLocalYmd(now) };
    case "month":
      return { from: toLocalYmd(new Date(now.getFullYear(), now.getMonth(), 1)), to: toLocalYmd(now) };
    case "year":
      return { from: toLocalYmd(new Date(now.getFullYear(), 0, 1)), to: toLocalYmd(now) };
    default:
      return null; // custom uses the caller's dates
  }
}

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * The effective window for a request. Explicit `from`/`to` win; otherwise the
 * preset (falling back to the month) supplies them, so a direct call with only
 * `?range=year` still returns the right period.
 */
function resolveWindow(preset, from, to) {
  const presetRange = presetDates(preset === "custom" ? "month" : preset) || presetDates("month");
  const fromStr = from ? toUtcYmd(from) : presetRange.from;
  const toStr = to ? toUtcYmd(to) : presetRange.to;

  const start = startOfUtcDay(fromStr);
  const end = endOfUtcDay(toStr);
  if (start.getTime() > end.getTime()) {
    throw appError("The 'from' date must be on or before the 'to' date.", 400);
  }
  return { fromStr, toStr, start, end };
}

/** The equal-length period immediately before `window`, for the % change. */
function previousWindow(window) {
  const spanMs = window.end.getTime() - window.start.getTime();
  if (spanMs < 0) return { fromStr: undefined, toStr: undefined };
  const prevEnd = new Date(window.start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { fromStr: toUtcYmd(prevStart), toStr: toUtcYmd(prevEnd) };
}

function percentageChange(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}

// --- Summary ---------------------------------------------------------------

/**
 * The six money cards and four count cards. Amount to receive / pay and the
 * count cards deliberately ignore the date range: they are current balances,
 * matching the All Customers / All Vendors reports with no range selected.
 */
export async function getDashboardSummary({ companyId, range = "month", from, to } = {}) {
  const window = resolveWindow(range, from, to);
  const previous = previousWindow(window);

  const [sales, salesPrev, purchases, purchasesPrev, profit, customers, vendors, products, services] =
    await Promise.all([
      reports.getSalesReportList({ companyId, from: window.fromStr, to: window.toStr, pageSize: 1 }),
      reports.getSalesReportList({ companyId, from: previous.fromStr, to: previous.toStr, pageSize: 1 }),
      reports.getPurchasesReportList({ companyId, from: window.fromStr, to: window.toStr, pageSize: 1 }),
      reports.getPurchasesReportList({ companyId, from: previous.fromStr, to: previous.toStr, pageSize: 1 }),
      reports.getProfitLossReport({ companyId, from: window.fromStr, to: window.toStr }),
      reports.getCustomersReport({ companyId }),
      reports.getVendorsReport({ companyId }),
      reports.getProductsReport({ companyId }),
      reports.getServicesReport({ companyId }),
    ]);

  const totalSales = sales.summary?.totalSales ?? 0;
  const previousSales = salesPrev.summary?.totalSales ?? 0;
  const totalPurchases = purchases.summary?.totalPurchases ?? 0;
  const previousPurchases = purchasesPrev.summary?.totalPurchases ?? 0;

  const profitSummary = profit.summary || {};
  const eligibleItems = profitSummary.eligibleItemCount ?? 0;
  const totalSoldItems = profitSummary.totalSoldItemCount ?? 0;
  const excludedItemCount = profitSummary.excludedItemCount ?? Math.max(0, totalSoldItems - eligibleItems);
  // Profit is now always a number: it is the sum over eligible lines only and
  // is never blanked by items that lack a cost price.
  const profitValue = Number(profitSummary.netProfit ?? profitSummary.profit ?? 0) || 0;
  const profitCoverageNote = `Based on ${eligibleItems} of ${totalSoldItems} sold products with a cost price`;

  let profitLabel = "neutral";
  if (profitValue > 0) profitLabel = "profit";
  else if (profitValue < 0) profitLabel = "loss";

  return {
    range: {
      preset: range,
      from: window.fromStr,
      to: window.toStr,
      previousFrom: previous.fromStr ?? null,
      previousTo: previous.toStr ?? null,
    },
    cards: {
      totalSales,
      salesChangePercent: percentageChange(totalSales, previousSales),
      totalPurchases,
      purchasesChangePercent: percentageChange(totalPurchases, previousPurchases),
      profit: profitValue,
      profitLabel,
      // Retired blockers: a missing cost never blanks the figure any more.
      costUnknown: false,
      profitNote: null,
      // Coverage of the profit figure and the values behind it, so the card can
      // explain itself and link to Products for the missing cost prices.
      profitCoverageNote,
      profitHasExcluded: excludedItemCount > 0,
      profitEligibleItems: eligibleItems,
      profitTotalSoldItems: totalSoldItems,
      profitEligibleRevenue: profitSummary.eligibleRevenue ?? 0,
      profitEligibleCost: profitSummary.eligibleCost ?? 0,
      profitTotalRevenue: profitSummary.revenue ?? 0,
      profitExcludedRevenue: profitSummary.excludedRevenue ?? 0,
      // Current balances across the whole company, NOT limited by the range.
      amountToReceive: customers.summary?.totalDue ?? 0,
      amountToPay: vendors.summary?.totalDue ?? 0,
      // There is no Bank / Cash / Account model in the schema, so this is never
      // a number - the card is rendered as disabled with that in the subtitle.
      cashBank: {
        available: false,
        amount: null,
        reason: "Available after Bank and Cash accounts are added",
      },
    },
    counts: {
      customers: customers.summary?.matchingPartiesInCompany ?? 0,
      vendors: vendors.summary?.matchingPartiesInCompany ?? 0,
      products: {
        total: products.summary?.totalProducts ?? 0,
        available: products.summary?.availableProducts ?? 0,
      },
      services: {
        total: services.summary?.totalServices ?? 0,
        available: services.summary?.availableServices ?? 0,
      },
    },
  };
}

// --- Charts ----------------------------------------------------------------

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `count` months, oldest first, ending with the current month. */
function buildMonths(count) {
  const now = new Date();
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const year = d.getUTCFullYear();
    const monthIndex = d.getUTCMonth();
    const key = `${year}-${pad2(monthIndex + 1)}`;
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    months.push({
      key,
      label: MONTH_ABBR[monthIndex],
      year,
      from: `${key}-01`,
      to: `${key}-${pad2(lastDay)}`,
    });
  }
  return months;
}

/** The list of day or month buckets for a window, in chronological order. */
function buildBuckets(bucket, start, end) {
  const buckets = [];
  if (bucket === "month") {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor.getTime() <= end.getTime()) {
      const year = cursor.getUTCFullYear();
      const monthIndex = cursor.getUTCMonth();
      buckets.push({ key: `${year}-${pad2(monthIndex + 1)}`, label: MONTH_ABBR[monthIndex], year });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return buckets;
  }
  const cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cursor.getTime() <= last.getTime()) {
    buckets.push({ key: toUtcYmd(cursor), label: String(cursor.getUTCDate()), year: cursor.getUTCFullYear() });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

/** Today / week / month break down by day; year and long customs by month. */
function bucketFor(preset, start, end) {
  if (preset === "year") return "month";
  const spanDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return spanDays > 62 ? "month" : "day";
}

/**
 * Income (payments against invoices) and expense (payments against bills) per
 * bucket, in one read-only SELECT. Same direction rule as the Transactions
 * report. Every caller value is bound; the DATE_FORMAT string is a fixed
 * literal.
 */
async function paymentFlowByBucket(companyId, start, end, bucket) {
  const bucketExpr =
    bucket === "day"
      ? Prisma.raw("DATE_FORMAT(p.paymentDate, '%Y-%m-%d')")
      : Prisma.raw("DATE_FORMAT(p.paymentDate, '%Y-%m')");

  return prisma.$queryRaw`
    SELECT
      ${bucketExpr} AS bucket,
      COALESCE(SUM(CASE WHEN p.invoiceId IS NOT NULL THEN p.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN p.billId IS NOT NULL THEN p.amount ELSE 0 END), 0) AS expense
    FROM payments p
    WHERE p.companyId = ${companyId}
      AND p.paymentDate >= ${start}
      AND p.paymentDate <= ${end}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
}

/** Sales / purchases per bucket by reusing the Reports functions (fallback). */
async function salesPurchasesByBucket(companyId, buckets) {
  return Promise.all(
    buckets.map(async (bucketEntry) => {
      const [from, to] =
        /^\d{4}-\d{2}$/.test(bucketEntry.key)
          ? [monthsBounds(bucketEntry.key).from, monthsBounds(bucketEntry.key).to]
          : [bucketEntry.key, bucketEntry.key];
      const [sales, purchases] = await Promise.all([
        reports.getSalesReportList({ companyId, from, to, pageSize: 1 }),
        reports.getPurchasesReportList({ companyId, from, to, pageSize: 1 }),
      ]);
      return {
        key: bucketEntry.key,
        label: bucketEntry.label,
        income: sales.summary?.totalSales ?? 0,
        expense: purchases.summary?.totalPurchases ?? 0,
      };
    })
  );
}

function monthsBounds(key) {
  const [year, monthIndex] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${key}-01`, to: `${key}-${pad2(lastDay)}` };
}

/**
 * All four chart datasets in one call, so the dashboard fires a single request.
 * The monthly charts follow `months`; the income/expense chart follows the
 * selected `range`.
 */
export async function getDashboardCharts({ companyId, range = "month", from, to, months = 6 } = {}) {
  const window = resolveWindow(range, from, to);
  const monthList = buildMonths(months === 12 ? 12 : 6);

  // Sales vs purchases per month. Reused per month so each bar equals that
  // month's Sales / Purchases report total.
  const salesPurchases = await Promise.all(
    monthList.map(async (m) => {
      const [sales, purchases] = await Promise.all([
        reports.getSalesReportList({ companyId, from: m.from, to: m.to, pageSize: 1 }),
        reports.getPurchasesReportList({ companyId, from: m.from, to: m.to, pageSize: 1 }),
      ]);
      return {
        month: m.key,
        label: m.label,
        year: m.year,
        sales: sales.summary?.totalSales ?? 0,
        purchases: purchases.summary?.totalPurchases ?? 0,
      };
    })
  );

  // Profit trend: the same monthly profit as the Profit & Loss report, from
  // eligible lines only. Months with no eligible lines show 0.
  const profitReport = await reports.getProfitLossReport({
    companyId,
    from: monthList[0].from,
    to: monthList[monthList.length - 1].to,
    groupBy: "month",
  });
  const profitByMonth = new Map((profitReport.periods || []).map((period) => [period.period, period]));
  const profitTrend = monthList.map((m) => {
    const period = profitByMonth.get(m.key);
    return {
      month: m.key,
      label: m.label,
      year: m.year,
      revenue: period ? period.revenue : 0,
      cost: period ? period.cost : 0,
      profit: period ? Number(period.profit) || 0 : 0,
      eligibleItems: period ? period.eligibleItemCount ?? 0 : 0,
      totalSoldItems: period ? period.totalSoldItemCount ?? 0 : 0,
    };
  });

  // Top 5 selling products by revenue, with units available for the toggle.
  const soldProducts = await reports.getSoldProductsReport({
    companyId,
    from: window.fromStr,
    to: window.toStr,
    sort: "revenueDesc",
    pageSize: 5,
  });
  const topProducts = (soldProducts.rows || []).slice(0, 5).map((row) => ({
    itemId: row.itemId,
    name: row.name,
    revenue: row.revenue,
    unitsSold: row.unitsSold,
  }));

  // Income vs expense for the selected range.
  const bucket = bucketFor(range, window.start, window.end);
  const bucketSkeleton = buildBuckets(bucket, window.start, window.end);
  const paymentCount = await prisma.payment.count({
    where: { companyId, paymentDate: { gte: window.start, lte: window.end } },
  });

  let incomeExpense;
  if (paymentCount > 0) {
    const rows = await paymentFlowByBucket(companyId, window.start, window.end, bucket);
    const byKey = new Map(rows.map((row) => [String(row.bucket), row]));
    incomeExpense = {
      basis: "payments",
      basisNote:
        "Based on recorded payments: money received against invoices and money paid against bills in this period.",
      points: bucketSkeleton.map((entry) => {
        const row = byKey.get(entry.key);
        return {
          key: entry.key,
          label: entry.label,
          year: entry.year,
          income: row ? round2(toNumber(row.income)) : 0,
          expense: row ? round2(toNumber(row.expense)) : 0,
        };
      }),
    };
  } else {
    const points = await salesPurchasesByBucket(companyId, bucketSkeleton);
    incomeExpense = {
      basis: "sales-purchases",
      basisNote:
        "Based on sales and purchases: no payments are recorded in this period, so income uses invoice totals and expense uses bill totals.",
      points,
    };
  }

  const totalIncome = round2(incomeExpense.points.reduce((sum, point) => sum + point.income, 0));
  const totalExpense = round2(incomeExpense.points.reduce((sum, point) => sum + point.expense, 0));

  return {
    range: {
      preset: range,
      from: window.fromStr,
      to: window.toStr,
      bucket,
    },
    months: months === 12 ? 12 : 6,
    salesPurchases,
    profitTrend,
    topProducts: {
      items: topProducts,
      soldItemCount: soldProducts.summary?.soldItemCount ?? 0,
      // Sold lines never linked to a product cannot be attributed, so the page
      // can say so instead of under-counting.
      unknownLineCount: soldProducts.summary?.unknownLineCount ?? 0,
    },
    incomeExpense: {
      ...incomeExpense,
      totalIncome,
      totalExpense,
      net: round2(totalIncome - totalExpense),
    },
  };
}
