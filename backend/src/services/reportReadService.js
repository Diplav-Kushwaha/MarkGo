import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import { toNumber } from "../utils/money.js";
/**
 * Reports read service - the aggregation layer behind every Reports page.
 *
 * STRICTLY READ-ONLY. Every function below only reads: `findMany`, `count`,
 * `aggregate`, `groupBy` and `$queryRaw` SELECTs. There is no create, update,
 * delete or write of any kind in this file, and the database schema is only ever
 * read - never changed.
 *
 * The company comes from ONE place: the `companyId` the controller takes from
 * the verified token. Every query below is filtered by it, and no function
 * accepts a company from anything a caller can influence.
 *
 * Performance rules this file follows:
 *   - aggregation happens in the database (SUM / COUNT / GROUP BY), never by
 *     loading invoice or bill rows into Node to be summed there;
 *   - lists are paginated in the database;
 *   - the one grouping Prisma's `groupBy` cannot express - a DATETIME bucketed
 *     into a day / month / year - uses a parameterised read-only `$queryRaw`
 *     SELECT in which every caller-supplied value is a bound parameter and only
 *     fixed literals (status lists, tax-mode names, format strings) appear in
 *     the SQL text, the same technique `productService.getProductSummary`
 *     already uses;
 *   - money is converted from Prisma Decimal to a number before any arithmetic,
 *     and every amount in a response is rounded to 2 decimals.
 */

function appError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

/** A raw SQL aggregate can come back as a string or a Prisma Decimal. */
function rawMoney(value) {
  if (value === null || value === undefined) return 0;
  return round2(toNumber(value));
}

/** Raw COUNT(*) can arrive as a BigInt, which must never reach Decimal. */
function rawCount(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

// ---------------------------------------------------------------------------
// Sales accounting rule
//
// A sale is a real, issued invoice. DRAFT was never sent to the customer and
// CANCELLED is voided, so neither is a sale. This is the same rule the existing
// sales report on /admin/reports uses.
// ---------------------------------------------------------------------------

const SALES_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"];

/** The literal IN (...) list used inside raw SQL. Never contains caller input. */
const SALES_STATUS_SQL = "'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'";

/**
 * A day window applied to a date filter. "2026-10-13" must include an invoice
 * stamped at 10:00 that day, so the upper bound is the end of the day rather
 * than midnight. The frontend sends plain YYYY-MM-DD, which `new Date()` reads
 * as UTC midnight; Prisma's MySQL session is UTC too, so the boundary matches
 * what is stored.
 */
function resolveRange({ from, to } = {}) {
  const startOfDay = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };
  const endOfDay = (value) => new Date(startOfDay(value).getTime() + 24 * 60 * 60 * 1000 - 1);

  const start = from ? startOfDay(from) : null;
  const end = to ? endOfDay(to) : null;

  if (start && end && start.getTime() > end.getTime()) {
    throw appError("The 'from' date must be on or before the 'to' date.", 400);
  }

  return { start, end };
}

/** Prisma `{ gte, lte }` fragment, or undefined when no bound was given. */
function rangeFilter(range) {
  if (!range?.start && !range?.end) return undefined;
  return {
    ...(range.start ? { gte: range.start } : {}),
    ...(range.end ? { lte: range.end } : {}),
  };
}

/**
 * MySQL format string for a bucket: a day, a month or a year.
 */
const BUCKET_FORMATS = {
  day: "%Y-%m-%d",
  month: "%Y-%m",
  year: "%Y",
};

/** How long a range may be before a daily breakdown is refused. */
const MAX_DAILY_BREAKDOWN_DAYS = 730;

// ---------------------------------------------------------------------------
// Cost of goods sold
//
// A sold line item stores no cost: `invoice_items` keeps the unit price, tax
// rate and discount that were charged, not what the goods cost. The cost is read
// from the product's CURRENT purchase price, excluding tax exactly the way
// `utils/productProfitLoss.js` does - an INCLUSIVE price is divided by
// (1 + rate); EXCLUSIVE and NONE are taken as stored.
//
// A line has NO usable cost when it was never linked to a catalogue item
// (`itemId` is null - a custom text line) or when that item has no purchase
// price. Those lines are counted as "cost unknown", excluded from profit, and
// reported back so the page can say so out loud instead of counting them as
// zero-cost.
// ---------------------------------------------------------------------------

const COST_BASE_SQL = `
  CASE
    WHEN im.purchasePrice IS NULL THEN NULL
    WHEN im.purchasePriceTaxMode = 'INCLUSIVE' AND im.taxRate > 0
      THEN im.purchasePrice / (1 + im.taxRate / 100)
    ELSE im.purchasePrice
  END
`;

const UNKNOWN_COST_SQL = "(it.itemId IS NULL OR im.id IS NULL OR im.purchasePrice IS NULL)";

/**
 * PROFIT-ELIGIBLE rule - the single definition used by the Profit & Loss report,
 * the product-wise report and the Company Admin dashboard, so the numbers always
 * agree. A sold line is eligible only when it is BOTH a sold PRODUCT with units
 * greater than zero AND it has a known cost price: a linked catalogue product
 * whose current purchase price is stored (a stored 0 counts as known; null or
 * missing does not). Services and any line without a known cost are NOT eligible;
 * they are counted separately and never blank the profit result.
 */
const PROFIT_ELIGIBLE_SQL =
  "(it.itemType = 'PRODUCT' AND it.itemId IS NOT NULL AND im.id IS NOT NULL AND im.purchasePrice IS NOT NULL AND it.quantity > 0)";

/** A sold product line missing its cost price - excluded for missing cost. */
const NO_COST_PRODUCT_SQL =
  "(it.itemType = 'PRODUCT' AND it.itemId IS NOT NULL AND im.id IS NOT NULL AND im.purchasePrice IS NULL)";

/** Revenue of one line excluding tax: quantity x price less the line discount. */
const LINE_REVENUE_SQL = "(it.quantity * it.unitPrice - it.discount)";

/** Tax of one line, exactly as invoiceService.calculateTotals computes it. */
const LINE_TAX_SQL = `(${LINE_REVENUE_SQL} * it.taxRate / 100)`;

const INVOICE_ITEMS_FROM = `
  FROM invoice_items it
  INNER JOIN invoices i ON i.id = it.invoiceId
  LEFT JOIN items im ON im.id = it.itemId AND im.companyId = i.companyId
`;

/**
 * Profit figures for one period. `costUnknown` is what distinguishes "this
 * period lost money" from "this period's cost data is missing" - the latter
 * reports null profit rather than an inflated one built from absent costs.
 */
function ledgerShape({
  invoiceCount = 0,
  revenue = 0,
  tax = 0,
  eligibleRevenue = 0,
  eligibleCost = 0,
  eligibleItemCount = 0,
  totalSoldItemCount = 0,
  excludedLineCount = 0,
  excludedRevenue = 0,
} = {}) {
  const totalRevenue = round2(revenue);
  const eligRevenue = round2(eligibleRevenue);
  const eligCost = round2(eligibleCost);
  const netProfit = round2(eligRevenue - eligCost);
  const marginPercent = eligCost > 0 ? round2((netProfit / eligCost) * 100) : 0;

  return {
    invoiceCount,
    // Total sales revenue over every sold item - unchanged, and NOT the same as
    // the eligible revenue the profit is built from.
    revenue: totalRevenue,
    // Cost of goods sold now comes from eligible lines only.
    cost: eligCost,
    eligibleRevenue: eligRevenue,
    eligibleCost: eligCost,
    tax: round2(tax),
    profit: netProfit,
    grossProfit: netProfit,
    netProfit,
    marginPercent,
    eligibleItemCount,
    totalSoldItemCount,
    excludedItemCount: Math.max(0, totalSoldItemCount - eligibleItemCount),
    excludedRevenue: round2(excludedRevenue),
    excludedLineCount,
    // Retired flag: profit is never blanked by a missing cost any more.
    costUnknown: false,
    expenses: 0,
    expensesAvailable: false,
    coverage: { eligible: eligibleItemCount, total: totalSoldItemCount },
  };
}

// ===========================================================================
// 1. SALES - invoices in a date range
// ===========================================================================

const SALES_SORT_MAP = {
  dateDesc: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
  dateAsc: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
  totalDesc: [{ grandTotal: "desc" }, { invoiceDate: "desc" }],
  totalAsc: [{ grandTotal: "asc" }, { invoiceDate: "asc" }],
  dueDesc: [{ amountDue: "desc" }, { invoiceDate: "desc" }],
  invoiceAsc: [{ invoiceNumber: "asc" }],
};

/**
 * "UNPAID" is not a stored invoice status - an unpaid invoice is SENT, or
 * OVERDUE once its due date has passed - so the filter maps onto both. Asking
 * for a status this report deliberately excludes (DRAFT / CANCELLED) returns no
 * rows rather than an error: those invoices are not sales.
 */
function resolvePaymentStatusFilter(paymentStatus) {
  if (!paymentStatus) return undefined;
  if (paymentStatus === "UNPAID") return ["SENT", "OVERDUE"];
  return [paymentStatus];
}

export async function getSalesReportList({
  companyId,
  customerId,
  paymentStatus,
  search,
  from,
  to,
  sort = "dateDesc",
  page = 1,
  pageSize = 10,
} = {}) {
  const range = resolveRange({ from, to });
  const statuses = resolvePaymentStatusFilter(paymentStatus);
  const rangeOnDate = rangeFilter(range);

  const where = {
    companyId,
    status: { in: statuses ?? SALES_STATUSES },
    ...(customerId ? { customerId } : {}),
    ...(search && search.trim() ? { invoiceNumber: { contains: search.trim() } } : {}),
    ...(rangeOnDate ? { invoiceDate: rangeOnDate } : {}),
  };

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);

  const [invoices, total, totals] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: SALES_SORT_MAP[sort] || SALES_SORT_MAP.dateDesc,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        grandTotal: true,
        amountPaid: true,
        amountDue: true,
        customer: { select: { id: true, name: true, companyName: true } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where,
      _sum: {
        subtotal: true,
        discountTotal: true,
        taxTotal: true,
        grandTotal: true,
        amountPaid: true,
        amountDue: true,
      },
      _count: { _all: true },
    }),
  ]);

  const sums = totals._sum || {};

  return {
    rows: invoices.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      status: row.status,
      customer: row.customer,
      subtotal: toNumber(row.subtotal),
      discountTotal: toNumber(row.discountTotal),
      taxTotal: toNumber(row.taxTotal),
      total: toNumber(row.grandTotal),
      paid: toNumber(row.amountPaid),
      due: toNumber(row.amountDue),
    })),
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    // The summary cards cover the whole filtered set, not just this page.
    summary: {
      invoiceCount: totals._count?._all || 0,
      totalSales: toNumber(sums.grandTotal),
      totalTax: toNumber(sums.taxTotal),
      totalDiscount: toNumber(sums.discountTotal),
      totalReceived: toNumber(sums.amountPaid),
      totalPending: toNumber(sums.amountDue),
      subtotal: toNumber(sums.subtotal),
    },
    meta: {
      hasTax: true,
      hasDiscount: true,
      excludes: ["Draft invoices (never sent to the customer)", "Cancelled invoices (voided)"],
    },
  };
}

// ===========================================================================
// 2. PURCHASES - bills in a date range
// ===========================================================================

const PURCHASE_SORT_MAP = {
  dateDesc: [{ billDate: "desc" }, { createdAt: "desc" }],
  dateAsc: [{ billDate: "asc" }, { createdAt: "asc" }],
  totalDesc: [{ total: "desc" }, { billDate: "desc" }],
  totalAsc: [{ total: "asc" }, { billDate: "asc" }],
  dueDesc: [{ amountDue: "desc" }, { billDate: "desc" }],
  billAsc: [{ billNumber: "asc" }],
};

export async function getPurchasesReportList({
  companyId,
  vendorId,
  paymentStatus,
  search,
  from,
  to,
  sort = "dateDesc",
  page = 1,
  pageSize = 10,
} = {}) {
  const range = resolveRange({ from, to });
  const rangeOnDate = rangeFilter(range);

  const where = {
    companyId,
    ...(paymentStatus ? { status: paymentStatus } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(search && search.trim() ? { billNumber: { contains: search.trim() } } : {}),
    ...(rangeOnDate ? { billDate: rangeOnDate } : {}),
  };

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);

  const [bills, total, totals] = await Promise.all([
    prisma.bill.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: PURCHASE_SORT_MAP[sort] || PURCHASE_SORT_MAP.dateDesc,
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        dueDate: true,
        status: true,
        category: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        vendor: { select: { id: true, name: true, companyName: true } },
      },
    }),
    prisma.bill.count({ where }),
    prisma.bill.aggregate({
      where,
      _sum: { total: true, amountPaid: true, amountDue: true },
      _count: { _all: true },
    }),
  ]);

  const sums = totals._sum || {};

  return {
    rows: bills.map((row) => ({
      id: row.id,
      billNumber: row.billNumber,
      billDate: row.billDate,
      dueDate: row.dueDate,
      status: row.status,
      category: row.category,
      vendor: row.vendor,
      // A bill stores ONE total and nothing else about its money: neither
      // `bills` nor `bill_items` has a subtotal, discount or tax column. The
      // subtotal therefore mirrors the total, and the other two are null so the
      // page shows "not recorded" instead of inventing zeros.
      subtotal: toNumber(row.total),
      discountTotal: null,
      taxTotal: null,
      total: toNumber(row.total),
      paid: toNumber(row.amountPaid),
      due: toNumber(row.amountDue),
    })),
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    summary: {
      billCount: totals._count?._all || 0,
      totalPurchases: toNumber(sums.total),
      totalPaid: toNumber(sums.amountPaid),
      totalPending: toNumber(sums.amountDue),
      // Explicitly unavailable rather than silently zero.
      totalTax: null,
      totalDiscount: null,
    },
    meta: {
      hasTax: false,
      hasDiscount: false,
    },
  };
}

// ===========================================================================
// 3. ALL TRANSACTIONS - every money movement
//
// `payments` has no status column and no bank/cash account column. It stores an
// amount, a method (CASH / BANK_TRANSFER / CARD / UPI / RAZORPAY / STRIPE /
// PAYPAL / CASHFREE / OTHER), a free-text reference and the date it was
// recorded. Direction is derived from the document it was recorded against: a
// payment on an invoice is money in, a payment on a bill is money out.
// ===========================================================================

const TRANSACTION_SORT_MAP = {
  dateDesc: [{ paymentDate: "desc" }, { createdAt: "desc" }],
  dateAsc: [{ paymentDate: "asc" }, { createdAt: "asc" }],
  amountDesc: [{ amount: "desc" }, { paymentDate: "desc" }],
  amountAsc: [{ amount: "asc" }, { paymentDate: "asc" }],
  // Party is a joined relation; its ordering falls back to the date order.
  partyAsc: [{ paymentDate: "desc" }, { createdAt: "desc" }],
};

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  method: true,
  reference: true,
  note: true,
  paymentDate: true,
  invoiceId: true,
  billId: true,
  invoice: {
    select: { invoiceNumber: true, customer: { select: { id: true, name: true } } },
  },
  bill: {
    select: { billNumber: true, vendor: { select: { id: true, name: true } } },
  },
  recordedBy: { select: { id: true, fullName: true } },
};

export async function getTransactionsReport({
  companyId,
  type,
  mode,
  status,
  partyId,
  search,
  from,
  to,
  sort = "dateDesc",
  page = 1,
  pageSize = 10,
} = {}) {
  const range = resolveRange({ from, to });
  const rangeOnDate = rangeFilter(range);

  // "SUCCESSFUL" is the only status the data supports: there is no status
  // column, so every recorded payment is a successful one. The filter exists so
  // the UI can offer it without the backend inventing failures.
  if (status && status !== "SUCCESSFUL") {
    throw appError("Status must be ALL or SUCCESSFUL. Payment records do not store a failed status.", 400);
  }

  const direction = type === "INCOMING" ? "INCOMING" : type === "OUTGOING" ? "OUTGOING" : "ALL";

  const scopedWhere = {
    companyId,
    ...(rangeOnDate ? { paymentDate: rangeOnDate } : {}),
  };

  const where = {
    ...scopedWhere,
    ...(direction === "INCOMING" ? { invoiceId: { not: null } } : {}),
    ...(direction === "OUTGOING" ? { billId: { not: null } } : {}),
    ...(mode ? { method: mode } : {}),
    ...(partyId
      ? {
          OR: [
            { invoice: { customerId: partyId } },
            { bill: { vendorId: partyId } },
          ],
        }
      : {}),
    ...(search && search.trim()
      ? {
          OR: [
            { reference: { contains: search.trim() } },
            { note: { contains: search.trim() } },
            { invoice: { invoiceNumber: { contains: search.trim() } } },
            { bill: { billNumber: { contains: search.trim() } } },
            { invoice: { customer: { name: { contains: search.trim() } } } },
            { bill: { vendor: { name: { contains: search.trim() } } } },
          ],
        }
      : {}),
  };

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);

  const incomingWhere = { ...scopedWhere, invoiceId: { not: null } };
  const outgoingWhere = { ...scopedWhere, billId: { not: null } };

  const [payments, total, incoming, outgoing, incomingCount, outgoingCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: TRANSACTION_SORT_MAP[sort] || TRANSACTION_SORT_MAP.dateDesc,
      select: PAYMENT_SELECT,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: incomingWhere, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: outgoingWhere, _sum: { amount: true } }),
    prisma.payment.count({ where: incomingWhere }),
    prisma.payment.count({ where: outgoingWhere }),
  ]);

  const totalIncoming = toNumber(incoming._sum?.amount);
  const totalOutgoing = toNumber(outgoing._sum?.amount);

  return {
    rows: payments.map((payment) => {
      const isIncoming = Boolean(payment.invoiceId);
      const party = isIncoming ? payment.invoice?.customer : payment.bill?.vendor;

      return {
        id: payment.id,
        paymentDate: payment.paymentDate,
        direction: isIncoming ? "INCOMING" : "OUTGOING",
        type: isIncoming ? "Incoming" : "Outgoing",
        // A payment row points at exactly one document, so its reference is
        // either an invoice number or a bill number.
        reference: payment.invoice?.invoiceNumber || payment.bill?.billNumber || null,
        paymentReference: payment.reference || null,
        documentType: isIncoming ? "Invoice" : "Bill",
        partyName: party?.name || null,
        partyId: party?.id || null,
        partyType: isIncoming ? "Customer" : "Vendor",
        // There is no bank / cash account column: `method` is the only
        // settlement information the row stores.
        mode: payment.method,
        account: null,
        amount: toNumber(payment.amount),
        note: payment.note || null,
        recordedBy: payment.recordedBy?.fullName || null,
        // Always successful - no failed status is stored.
        status: "SUCCESSFUL",
      };
    }),
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    summary: {
      totalIncoming,
      totalOutgoing,
      net: round2(totalIncoming - totalOutgoing),
      // Not available in the data, so explicitly null rather than a made-up 0.
      failedCount: null,
      failedAmount: null,
      transactionCount: total,
      incomingCount,
      outgoingCount,
    },
    meta: {
      statusSupported: false,
      failedSupported: false,
      accountSupported: false,
      typeCounts: {
        all: incomingCount + outgoingCount,
        incoming: incomingCount,
        outgoing: outgoingCount,
      },
    },
  };
}

// ===========================================================================
// 4. PROFIT & LOSS - overall and per period
// ===========================================================================

/**
 * The shared predicate for every report's raw query, built with `Prisma.sql`.
 *
 * Two details are easy to get wrong here, and both produce hard-to-read
 * database errors, so they are handled in one place:
 *
 * 1. The status list is composed with `Prisma.join`, making each status its own
 *    bound parameter. Interpolating the comma list as one string would send
 *    "'SENT', 'PARTIALLY_PAID', ..." as a single value, which is invalid SQL.
 * 2. An optional bound is referenced twice — once by `IS NULL` and once by the
 *    comparison — so it must appear as two placeholders. Prisma counts
 *    placeholders rather than values, which is exactly the "Statement takes N
 *    parameters but M was supplied" failure this avoids.
 */
function reportPredicates({ companyId, range, customerId }) {
  const start = range?.start ?? null;
  const end = range?.end ?? null;
  const party = customerId ?? null;

  return Prisma.sql`
    WHERE i.companyId = ${companyId}
      AND i.status IN (${Prisma.join(SALES_STATUSES)})
      AND (${start} IS NULL OR i.invoiceDate >= ${start})
      AND (${end} IS NULL OR i.invoiceDate <= ${end})
      AND (${party} IS NULL OR i.customerId = ${party})
  `;
}

/** Sales side of the ledger over the whole range, with no grouping. */
async function aggregateSales({ companyId, range, customerId }) {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*) AS invoiceCount,
      COALESCE(SUM(i.subtotal), 0) AS subtotal,
      COALESCE(SUM(i.discountTotal), 0) AS discountTotal,
      COALESCE(SUM(i.taxTotal), 0) AS taxTotal
    FROM invoices i
    ${reportPredicates({ companyId, range, customerId })}
  `;
  return rows[0] || {};
}

/** Sales side of the ledger, bucketed by day / month / year in the database. */
async function aggregateSalesByBucket({ companyId, range, format, customerId }) {
  return prisma.$queryRaw`
    SELECT
      DATE_FORMAT(i.invoiceDate, ${format}) AS bucket,
      COUNT(*) AS invoiceCount,
      COALESCE(SUM(i.subtotal), 0) AS subtotal,
      COALESCE(SUM(i.discountTotal), 0) AS discountTotal,
      COALESCE(SUM(i.taxTotal), 0) AS taxTotal
    FROM invoices i
    ${reportPredicates({ companyId, range, customerId })}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
}

/**
 * Cost side of the ledger. One query joins the line items of every invoice in
 * the range to the catalogue rows that carry their current cost, so no invoice
 * row is ever loaded into Node.
 */
async function aggregateCost({ companyId, range, customerId, grouped, format = "%Y-%m-%d" }) {
  const bucketSql = grouped
    ? Prisma.sql`DATE_FORMAT(i.invoiceDate, ${format}) AS bucket,`
    : Prisma.sql``;
  const groupBySql = grouped
    ? Prisma.sql`GROUP BY bucket ORDER BY bucket ASC`
    : Prisma.sql``;

  return prisma.$queryRaw`
    SELECT
      ${bucketSql}
      COALESCE(SUM(CASE WHEN ${Prisma.raw(PROFIT_ELIGIBLE_SQL)} THEN ${Prisma.raw(LINE_REVENUE_SQL)} ELSE 0 END), 0) AS eligibleRevenue,
      COALESCE(SUM(CASE WHEN ${Prisma.raw(PROFIT_ELIGIBLE_SQL)} THEN ${Prisma.raw(COST_BASE_SQL)} * it.quantity ELSE 0 END), 0) AS eligibleCost,
      SUM(CASE WHEN ${Prisma.raw(PROFIT_ELIGIBLE_SQL)} THEN 1 ELSE 0 END) AS eligibleLineCount,
      SUM(CASE WHEN NOT ${Prisma.raw(PROFIT_ELIGIBLE_SQL)} THEN 1 ELSE 0 END) AS excludedLineCount,
      COALESCE(SUM(CASE WHEN ${Prisma.raw(NO_COST_PRODUCT_SQL)} THEN ${Prisma.raw(LINE_REVENUE_SQL)} ELSE 0 END), 0) AS excludedRevenue,
      COUNT(DISTINCT CASE WHEN ${Prisma.raw(PROFIT_ELIGIBLE_SQL)} THEN it.itemId END) AS eligibleItemCount,
      COUNT(DISTINCT CASE WHEN it.itemType = 'PRODUCT' AND it.itemId IS NOT NULL THEN it.itemId END) AS totalSoldItemCount
    ${Prisma.raw(INVOICE_ITEMS_FROM)}
    ${reportPredicates({ companyId, range, customerId })}
    ${groupBySql}
  `;
}

export async function getProfitLossReport({
  companyId,
  groupBy = "overall",
  from,
  to,
  customerId,
} = {}) {
  const range = resolveRange({ from, to });
  const isBucketed = groupBy === "day" || groupBy === "month" || groupBy === "year";
  const bucketFormat = BUCKET_FORMATS[groupBy] || BUCKET_FORMATS.year;

  if (groupBy === "day" && range.start && range.end) {
    const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
    if (days > MAX_DAILY_BREAKDOWN_DAYS) {
      const err = appError(
        "A daily breakdown covers at most 730 days. Use the monthly or yearly view, or shorten the date range.",
        400
      );
      // Carried on the error object so the response can also name the field,
      // matching the shape of a validation failure rather than being a bare
      // string with no actionable detail.
      err.errors = [{ field: "from/to", message: err.message }];
      throw err;
    }
  }

  const [salesRows, costRows] = await Promise.all([
    isBucketed
      ? aggregateSalesByBucket({ companyId, range, format: bucketFormat, customerId })
      : aggregateSales({ companyId, range, customerId }).then((row) => [row]),
    aggregateCost({ companyId, range, customerId, grouped: isBucketed, format: bucketFormat }),
  ]);

  const costByBucket = new Map(
    costRows.map((row) => [row.bucket === null || row.bucket === undefined ? null : String(row.bucket), row])
  );

  // Profit comes ONLY from eligible lines (a sold product that has a cost
  // price). Items without a cost price, services and unlinked lines are never
  // subtracted and never blank the result; they are counted as excluded.
  const toPeriod = (salesRow) => {
    const costRow = costByBucket.get(salesRow.bucket === undefined ? null : String(salesRow.bucket)) || {};

    return {
      period: salesRow.bucket === undefined ? "overall" : String(salesRow.bucket),
      label: salesRow.bucket === undefined ? "Overall" : String(salesRow.bucket),
      ...ledgerShape({
        invoiceCount: rawCount(salesRow.invoiceCount),
        revenue: rawMoney(salesRow.subtotal) - rawMoney(salesRow.discountTotal),
        tax: rawMoney(salesRow.taxTotal),
        eligibleRevenue: rawMoney(costRow.eligibleRevenue),
        eligibleCost: rawMoney(costRow.eligibleCost),
        eligibleItemCount: rawCount(costRow.eligibleItemCount),
        totalSoldItemCount: rawCount(costRow.totalSoldItemCount),
        excludedLineCount: rawCount(costRow.excludedLineCount),
        excludedRevenue: rawMoney(costRow.excludedRevenue),
      }),
    };
  };

  const periods = salesRows.map(toPeriod);

  const totals = periods.reduce(
    (accumulator, period) => ({
      invoiceCount: accumulator.invoiceCount + period.invoiceCount,
      revenue: accumulator.revenue + period.revenue,
      tax: accumulator.tax + period.tax,
      eligibleRevenue: accumulator.eligibleRevenue + period.eligibleRevenue,
      eligibleCost: accumulator.eligibleCost + period.eligibleCost,
      eligibleItemCount: accumulator.eligibleItemCount + period.eligibleItemCount,
      totalSoldItemCount: accumulator.totalSoldItemCount + period.totalSoldItemCount,
      excludedLineCount: accumulator.excludedLineCount + period.excludedLineCount,
      excludedRevenue: accumulator.excludedRevenue + period.excludedRevenue,
    }),
    {
      invoiceCount: 0,
      revenue: 0,
      tax: 0,
      eligibleRevenue: 0,
      eligibleCost: 0,
      eligibleItemCount: 0,
      totalSoldItemCount: 0,
      excludedLineCount: 0,
      excludedRevenue: 0,
    }
  );

  const overall = ledgerShape({
    invoiceCount: totals.invoiceCount,
    revenue: totals.revenue,
    tax: totals.tax,
    eligibleRevenue: totals.eligibleRevenue,
    eligibleCost: totals.eligibleCost,
    eligibleItemCount: totals.eligibleItemCount,
    totalSoldItemCount: totals.totalSoldItemCount,
    excludedLineCount: totals.excludedLineCount,
    excludedRevenue: totals.excludedRevenue,
  });

  return {
    groupBy: isBucketed ? groupBy : "overall",
    range: { from: from ?? null, to: to ?? null },
    // The summary cards always describe the selected range, never a period.
    summary: {
      invoiceCount: totals.invoiceCount,
      ...overall,
    },
    periods,
    meta: {
      // Taxes collected on sales and paid on purchases are shown separately and
      // are never counted as profit.
      taxCollected: round2(totals.tax),
      costSource: "current product purchase price",
      costAtSaleRecorded: false,
      expensesAvailable: false,
      // Profit uses eligible lines only; a missing cost never blanks the result.
      profitRule: "eligible-product-with-cost",
    },
  };
}

// ===========================================================================
// 5. / 6. PRODUCT-WISE AND SERVICE-WISE PROFIT & LOSS
// ===========================================================================

/**
 * One aggregated row per catalogue item that appears in at least one sold line.
 *
 * Same binding rules as `reportPredicates`: the status list is composed with
 * `Prisma.join` and each optional bound is given its own placeholder.
 */
async function aggregateSoldItems({ companyId, range, itemType, itemIdFilter }) {
  const start = range?.start ?? null;
  const end = range?.end ?? null;
  const item = itemIdFilter ?? null;

  return prisma.$queryRaw`
    SELECT
      it.itemId AS itemId,
      COUNT(DISTINCT it.invoiceId) AS invoiceCount,
      COALESCE(SUM(it.quantity), 0) AS unitsSold,
      COALESCE(SUM(${Prisma.raw(LINE_REVENUE_SQL)}), 0) AS revenue,
      COALESCE(SUM(${Prisma.raw(LINE_TAX_SQL)}), 0) AS taxCollected,
      COALESCE(SUM(CASE WHEN ${Prisma.raw(COST_BASE_SQL)} IS NULL THEN 0 ELSE ${Prisma.raw(COST_BASE_SQL)} * it.quantity END), 0) AS costOfGoodsSold,
      SUM(CASE WHEN ${Prisma.raw(UNKNOWN_COST_SQL)} THEN 1 ELSE 0 END) AS unknownLineCount,
      MIN(i.invoiceDate) AS firstSaleDate,
      MAX(i.invoiceDate) AS lastSaleDate
    ${Prisma.raw(INVOICE_ITEMS_FROM)}
    WHERE i.companyId = ${companyId}
      AND i.status IN (${Prisma.join(SALES_STATUSES)})
      AND it.itemType = ${itemType}
      AND it.itemId IS NOT NULL
      AND (${start} IS NULL OR i.invoiceDate >= ${start})
      AND (${end} IS NULL OR i.invoiceDate <= ${end})
      AND (${item} IS NULL OR it.itemId = ${item})
    GROUP BY it.itemId
    ORDER BY revenue DESC
  `;
}

/** All catalogue rows for a set of ids, in one query - never one per id. */
async function loadItemMeta(ids, itemType) {
  if (!ids.length) return new Map();

  const items = await prisma.item.findMany({
    where: { id: { in: ids }, type: itemType },
    select: {
      id: true,
      name: true,
      productCode: true,
      salesPrice: true,
      purchasePrice: true,
      sellingPriceTaxMode: true,
      purchasePriceTaxMode: true,
      taxRate: true,
      unit: true,
      category: true,
      status: true,
      stockQuantity: true,
      unitRel: { select: { id: true, fullName: true, shortName: true } },
      categoryRel: { select: { id: true, name: true } },
    },
  });

  return new Map(items.map((item) => [item.id, item]));
}

// A missing profit (cost unknown) sorts as -Infinity, so an unknown cost is
// never silently ranked above a real loss.
function profitOf(row) {
  return row.profitKnown ? row.profit : Number.NEGATIVE_INFINITY;
}

function marginOf(row) {
  return row.marginPercent ?? Number.NEGATIVE_INFINITY;
}

const ITEM_PROFIT_SORT = {
  profitDesc: (a, b) => profitOf(b) - profitOf(a),
  profitAsc: (a, b) => profitOf(a) - profitOf(b),
  revenueDesc: (a, b) => b.revenue - a.revenue,
  revenueAsc: (a, b) => a.revenue - b.revenue,
  marginDesc: (a, b) => marginOf(b) - marginOf(a),
  quantityDesc: (a, b) => b.unitsSold - a.unitsSold,
  nameAsc: (a, b) => String(a.name).localeCompare(String(b.name)),
};

/**
 * Shared body of reports 5 and 6: `itemType` is the only difference between the
 * product call and the service call, so they can never drift apart.
 */
async function buildSoldItemsReport({
  companyId,
  itemType,
  itemIdFilter,
  search,
  from,
  to,
  sort = "profitDesc",
  page = 1,
  pageSize = 10,
}) {
  const range = resolveRange({ from, to });

  const rawRows = await aggregateSoldItems({ companyId, range, itemType, itemIdFilter });

  const meta = await loadItemMeta(
    rawRows.map((row) => String(row.itemId)),
    itemType
  );

  const allRows = rawRows
    .map((row) => formatItemRow(row, meta.get(String(row.itemId)), itemType))
    .filter((row) => matchesItemSearch(row, search));

  const sorted = [...allRows].sort(ITEM_PROFIT_SORT[sort] || ITEM_PROFIT_SORT.profitDesc);

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);
  const pageRows = sorted.slice((currentPage - 1) * take, currentPage * take);

  const totals = allRows.reduce(
    (accumulator, row) => ({
      revenue: accumulator.revenue + row.revenue,
      tax: accumulator.tax + row.taxCollected,
      cost: accumulator.cost + (row.cost ?? 0),
      unitsSold: accumulator.unitsSold + row.unitsSold,
      invoiceCount: accumulator.invoiceCount + row.invoiceCount,
      unknownLineCount: accumulator.unknownLineCount + row.unknownLineCount,
      eligibleRevenue: accumulator.eligibleRevenue + (row.costKnown ? row.revenue : 0),
      eligibleCost: accumulator.eligibleCost + (row.costKnown ? (row.cost ?? 0) : 0),
      eligibleItemCount: accumulator.eligibleItemCount + (row.costKnown ? 1 : 0),
      excludedItemCount:
        accumulator.excludedItemCount + (itemType === "PRODUCT" && !row.costKnown ? 1 : 0),
    }),
    {
      revenue: 0,
      tax: 0,
      cost: 0,
      unitsSold: 0,
      invoiceCount: 0,
      unknownLineCount: 0,
      eligibleRevenue: 0,
      eligibleCost: 0,
      eligibleItemCount: 0,
      excludedItemCount: 0,
    }
  );

  const selected =
    (itemIdFilter && sorted.find((row) => row.itemId === itemIdFilter)) || null;

  return {
    itemType,
    // Every sold item, so the UI can build its searchable dropdown.
    options: sorted.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      code: row.code,
    })),
    rows: pageRows,
    selected,
    pagination: {
      total: allRows.length,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(allRows.length / take) || 1,
    },
    summary: {
      soldItemCount: allRows.length,
      unitsSold: totals.unitsSold,
      revenue: round2(totals.revenue),
      taxCollected: round2(totals.tax),
      invoiceCount: totals.invoiceCount,
      // Line items that were never linked to a catalogue row cannot be
      // attributed to any item, so they are reported as a count.
      unknownLineCount: totals.unknownLineCount,
      // Eligible-only profit, the same rule as the Profit & Loss report.
      eligibleRevenue: round2(totals.eligibleRevenue),
      eligibleCost: round2(totals.eligibleCost),
      netProfit: round2(totals.eligibleRevenue - totals.eligibleCost),
      eligibleItemCount: totals.eligibleItemCount,
      excludedItemCount: totals.excludedItemCount,
      costKnown: false,
    },
    meta: {
      costAtSaleRecorded: false,
      costSource: "current product purchase price",
      // A service has no purchase price in use, so its cost is unknown by
      // construction unless a purchase price was recorded anyway.
      costExpected: itemType === "PRODUCT",
    },
  };
}

/** Shapes one aggregated sold-item row, computing cost from the current item. */
function formatItemRow(row, item, itemType) {
  const unitsSold = rawCount(row.unitsSold);
  const revenue = rawMoney(row.revenue);
  const taxCollected = rawMoney(row.taxCollected);
  const unknownLineCount = rawCount(row.unknownLineCount);

  const hasPurchasePrice = item?.purchasePrice !== null && item?.purchasePrice !== undefined;
  const cost = hasPurchasePrice ? rawMoney(row.costOfGoodsSold) : null;
  const costKnown = itemType === "SERVICE" ? false : hasPurchasePrice && unknownLineCount === 0;

  return {
    itemId: String(row.itemId),
    name: item?.name || "Unknown item",
    code: item?.productCode ?? null,
    unit: item?.unitRel?.shortName || item?.unit || null,
    category: item?.categoryRel?.name || item?.category || null,
    status: item?.status ?? null,
    unitsSold,
    revenue,
    taxCollected,
    cost,
    costKnown,
    costRecorded: hasPurchasePrice,
    unknownLineCount,
    profit: costKnown ? round2(revenue - (cost ?? 0)) : null,
    profitKnown: costKnown,
    marginPercent: !costKnown
      ? null
      : (cost ?? 0) > 0
        ? round2(((revenue - (cost ?? 0)) / cost) * 100)
        : 0,
    averageSellingPrice: unitsSold > 0 ? round2(revenue / unitsSold) : null,
    invoiceCount: rawCount(row.invoiceCount),
    firstSaleDate: row.firstSaleDate ?? null,
    lastSaleDate: row.lastSaleDate ?? null,
    purchasePrice:
      item?.purchasePrice === null || item?.purchasePrice === undefined ? null : toNumber(item.purchasePrice),
    sellingPrice: item?.salesPrice === undefined || item?.salesPrice === null ? null : toNumber(item.salesPrice),
  };
}

function matchesItemSearch(row, search) {
  const term = String(search || "").trim().toLowerCase();
  if (!term) return true;
  return (
    String(row.name || "").toLowerCase().includes(term) ||
    String(row.code || "").toLowerCase().includes(term)
  );
}

export function getSoldProductsReport({
  companyId,
  productId,
  search,
  from,
  to,
  sort,
  page,
  pageSize,
} = {}) {
  return buildSoldItemsReport({
    companyId,
    itemType: "PRODUCT",
    itemIdFilter: productId,
    search,
    from,
    to,
    sort,
    page,
    pageSize,
  });
}

export function getSoldServicesReport({
  companyId,
  serviceId,
  search,
  from,
  to,
  sort,
  page,
  pageSize,
} = {}) {
  return buildSoldItemsReport({
    companyId,
    itemType: "SERVICE",
    itemIdFilter: serviceId,
    search,
    from,
    to,
    sort,
    page,
    pageSize,
  });
}

/**
 * The sale lines of one item: the invoice table shown under the selector on
 * reports 5 and 6. Its totals are the same numbers the item row reports, from
 * the same cost rule, so the two can never disagree.
 */
export async function getSoldItemLines({
  companyId,
  itemId,
  itemType,
  from,
  to,
  sort = "dateDesc",
  page = 1,
  pageSize = 10,
} = {}) {
  if (!itemId) {
    throw appError("An item id is required to list its sales.", 400);
  }

  const range = resolveRange({ from, to });
  const rangeOnDate = rangeFilter(range);
  const sortDirection = sort === "dateAsc" ? "asc" : "desc";

  // The company is not a column on an invoice line — it lives on the invoice
  // the line hangs from — so the scope is expressed through that relation. The
  // date range is scoped to the invoice's own date, which is the sale date.
  const where = {
    itemId,
    itemType,
    invoice: {
      companyId,
      status: { in: SALES_STATUSES },
      ...(rangeOnDate ? { invoiceDate: rangeOnDate } : {}),
    },
  };

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);

  const [lines, total] = await Promise.all([
    prisma.invoiceItem.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: [{ invoice: { invoiceDate: sortDirection } }],      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        taxRate: true,
        discount: true,
        lineTotal: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            status: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.invoiceItem.count({ where }),
  ]);

  // The cost of a line is the item's current purchase price. It is loaded once
  // for all the lines on the page.
  const item = await prisma.item.findFirst({
    where: { id: itemId, companyId, type: itemType },
    select: { id: true, name: true, purchasePrice: true, purchasePriceTaxMode: true, taxRate: true },
  });

  const costPerUnit = computeCostPerUnit(item);

  const rows = lines.map((line) => {
    const quantity = toNumber(line.quantity);
    const unitPrice = toNumber(line.unitPrice);
    const discount = toNumber(line.discount);
    const revenue = round2(quantity * unitPrice - discount);
    const tax = round2((quantity * unitPrice - discount) * (toNumber(line.taxRate) / 100));
    const lineCost = costPerUnit === null ? null : round2(costPerUnit * quantity);

    return {
      id: line.id,
      invoiceId: line.invoice?.id ?? null,
      invoiceNumber: line.invoice?.invoiceNumber ?? null,
      invoiceDate: line.invoice?.invoiceDate ?? null,
      status: line.invoice?.status ?? null,
      customer: line.invoice?.customer ?? null,
      quantity,
      unitPrice,
      discount,
      revenue,
      tax,
      total: toNumber(line.lineTotal),
      costPerUnit,
      cost: lineCost,
      // A null profit means "cost not recorded", never zero.
      profit: lineCost === null ? null : round2(revenue - lineCost),
      profitKnown: lineCost !== null,
    };
  });

  return {
    item: item
      ? {
          id: item.id,
          name: item.name,
          purchasePrice: item.purchasePrice === null ? null : toNumber(item.purchasePrice),
          hasPurchasePrice: item.purchasePrice !== null,
        }
      : null,
    rows,
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    summary: {
      lineCount: total,
      revenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)),
      tax: round2(rows.reduce((sum, row) => sum + row.tax, 0)),
      cost: round2(rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)),
      profit: rows.every((row) => row.profitKnown)
        ? round2(rows.reduce((sum, row) => sum + row.profit, 0))
        : null,
      profitKnown: rows.length > 0 ? rows.every((row) => row.profitKnown) : true,
    },
    meta: {
      costAtSaleRecorded: false,
      costSource: "current product purchase price",
    },
  };
}

/** Cost of one unit excluding tax, or null when no purchase price is stored. */
function computeCostPerUnit(item) {
  if (!item || item.purchasePrice === null || item.purchasePrice === undefined) return null;

  const purchasePrice = toNumber(item.purchasePrice);
  const mode = item.purchasePriceTaxMode;
  const taxRate = toNumber(item.taxRate);

  if (mode === "INCLUSIVE" && taxRate > 0) {
    return round2(purchasePrice / (1 + taxRate / 100));
  }
  return round2(purchasePrice);
}

// ===========================================================================
// 7. ALL CUSTOMERS
// ===========================================================================

function dateValue(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

const PARTY_SORT = {
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
  billed: (a, b) => a.billed - b.billed,
  received: (a, b) => a.received - b.received,
  due: (a, b) => a.due - b.due,
  count: (a, b) => a.documentCount - b.documentCount,
  lastDate: (a, b) => dateValue(a.lastDocumentDate) - dateValue(b.lastDocumentDate),
};

export async function getCustomersReport({
  companyId,
  search,
  hasDues,
  from,
  to,
  sortField = "name",
  order = "asc",
  page = 1,
  pageSize = 10,
} = {}) {
  const range = resolveRange({ from, to });
  const rangeOnDate = rangeFilter(range);
  const searchTerm = search && search.trim() ? search.trim() : null;

  // Three queries total for the whole report, however many customers there are:
  // the invoice totals, the money received, and the company's customer count.
  const [groups, payments, matchingParties] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        companyId,
        status: { in: SALES_STATUSES },
        ...(rangeOnDate ? { invoiceDate: rangeOnDate } : {}),
      },
      _sum: { grandTotal: true, amountPaid: true, amountDue: true },
      _count: { _all: true },
      _max: { invoiceDate: true },
    }),
    // Money actually received in the range, summed per customer in the
    // database: one query for the whole report rather than one per customer.
    // Each optional bound gets its own placeholder.
    prisma.$queryRaw`
      SELECT
        i.customerId AS partyId,
        COALESCE(SUM(p.amount), 0) AS received
      FROM payments p
      INNER JOIN invoices i ON i.id = p.invoiceId
      WHERE i.companyId = ${companyId}
        AND (${range?.start ?? null} IS NULL OR p.paymentDate >= ${range?.start ?? null})
        AND (${range?.end ?? null} IS NULL OR p.paymentDate <= ${range?.end ?? null})
      GROUP BY i.customerId
    `,
    prisma.customer.count({
      where: {
        companyId,
        isDeleted: false,
        ...(searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm } },
                { companyName: { contains: searchTerm } },
                { email: { contains: searchTerm } },
                { phoneNumber: { contains: searchTerm } },
              ],
            }
          : {}),
      },
    }),
  ]);

  const receivedByParty = new Map(payments.map((row) => [String(row.partyId), rawMoney(row.received)]));

  const partyRows = groups.map((group) => ({
    id: group.customerId,
    name: "",
    documentCount: group._count?._all || 0,
    billed: toNumber(group._sum?.grandTotal),
    received: receivedByParty.get(String(group.customerId)) ?? 0,
    due: toNumber(group._sum?.amountDue),
    lastDocumentDate: group._max?.invoiceDate ?? null,
  }));

  const filtered = applyPartyFilters(partyRows, { hasDues, searchTerm });
  const sorted = sortPartyRows(filtered, { sortField, order });

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);
  const pageRows = sorted.slice((currentPage - 1) * take, currentPage * take);

  const customers = pageRows.length
    ? await prisma.customer.findMany({
        where: { id: { in: pageRows.map((row) => row.id) }, companyId, isDeleted: false },
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phoneNumber: true,
          status: true,
        },
      })
    : [];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  const rows = pageRows.map((row) => {
    const customer = customerById.get(row.id);

    return {
      id: row.id,
      name: customer?.name || "Unknown customer",
      companyName: customer?.companyName ?? null,
      email: customer?.email ?? null,
      phone: customer?.phoneNumber ?? null,
      status: customer?.status ?? null,
      invoiceCount: row.documentCount,
      billed: round2(row.billed),
      received: round2(row.received),
      due: round2(row.due),
      lastInvoiceDate: row.lastDocumentDate,
    };
  });

  const summary = sorted.reduce(
    (accumulator, row) => ({
      partyCount: accumulator.partyCount + 1,
      documentCount: accumulator.documentCount + row.documentCount,
      billed: accumulator.billed + row.billed,
      received: accumulator.received + row.received,
      due: accumulator.due + row.due,
    }),
    { partyCount: 0, documentCount: 0, billed: 0, received: 0, due: 0 }
  );

  return {
    rows,
    pagination: {
      total: sorted.length,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(sorted.length / take) || 1,
    },
    summary: {
      totalCustomers: summary.partyCount,
      totalBilled: round2(summary.billed),
      totalReceived: round2(summary.received),
      totalDue: round2(summary.due),
      totalInvoices: summary.documentCount,
      matchingPartiesInCompany: matchingParties,
    },
    meta: {
      range: { from: from ?? null, to: to ?? null },
      rangeScoped: true,
      excludes: ["Draft invoices (never sent to the customer)", "Cancelled invoices (voided)"],
    },
  };
}

// ===========================================================================
// 8. ALL VENDORS
// ===========================================================================

export async function getVendorsReport({
  companyId,
  search,
  hasDues,
  from,
  to,
  sortField = "name",
  order = "asc",
  page = 1,
  pageSize = 10,
} = {}) {
  const range = resolveRange({ from, to });
  const rangeOnDate = rangeFilter(range);
  const searchTerm = search && search.trim() ? search.trim() : null;

  const [groups, payments, matchingParties] = await Promise.all([
    prisma.bill.groupBy({
      by: ["vendorId"],
      where: {
        companyId,
        ...(rangeOnDate ? { billDate: rangeOnDate } : {}),
      },
      _sum: { total: true, amountPaid: true, amountDue: true },
      _count: { _all: true },
      _max: { billDate: true },
    }),
    prisma.$queryRaw`
      SELECT
        b.vendorId AS partyId,
        COALESCE(SUM(p.amount), 0) AS received
      FROM payments p
      INNER JOIN bills b ON b.id = p.billId
      WHERE b.companyId = ${companyId}
        AND (${range?.start ?? null} IS NULL OR p.paymentDate >= ${range?.start ?? null})
        AND (${range?.end ?? null} IS NULL OR p.paymentDate <= ${range?.end ?? null})
      GROUP BY b.vendorId
    `,
    prisma.vendor.count({
      where: {
        companyId,
        isDeleted: false,
        ...(searchTerm
          ? {
              OR: [
                { name: { contains: searchTerm } },
                { companyName: { contains: searchTerm } },
                { email: { contains: searchTerm } },
                { phoneNumber: { contains: searchTerm } },
              ],
            }
          : {}),
      },
    }),
  ]);

  const paidByParty = new Map(payments.map((row) => [String(row.partyId), rawMoney(row.received)]));

  const partyRows = groups.map((group) => ({
    id: group.vendorId,
    name: "",
    documentCount: group._count?._all || 0,
    billed: toNumber(group._sum?.total),
    received: paidByParty.get(String(group.vendorId)) ?? 0,
    due: toNumber(group._sum?.amountDue),
    lastDocumentDate: group._max?.billDate ?? null,
  }));

  const filtered = applyPartyFilters(partyRows, { hasDues, searchTerm });
  const sorted = sortPartyRows(filtered, { sortField, order });

  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);
  const pageRows = sorted.slice((currentPage - 1) * take, currentPage * take);

  const vendors = pageRows.length
    ? await prisma.vendor.findMany({
        where: { id: { in: pageRows.map((row) => row.id) }, companyId, isDeleted: false },
        select: {
          id: true,
          name: true,
          companyName: true,
          email: true,
          phoneNumber: true,
          status: true,
        },
      })
    : [];
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));

  const rows = pageRows.map((row) => {
    const vendor = vendorById.get(row.id);

    return {
      id: row.id,
      name: vendor?.name || "Unknown vendor",
      companyName: vendor?.companyName ?? null,
      email: vendor?.email ?? null,
      phone: vendor?.phoneNumber ?? null,
      status: vendor?.status ?? null,
      billCount: row.documentCount,
      billed: round2(row.billed),
      paid: round2(row.received),
      due: round2(row.due),
      lastBillDate: row.lastDocumentDate,
    };
  });

  const summary = sorted.reduce(
    (accumulator, row) => ({
      partyCount: accumulator.partyCount + 1,
      documentCount: accumulator.documentCount + row.documentCount,
      billed: accumulator.billed + row.billed,
      received: accumulator.received + row.received,
      due: accumulator.due + row.due,
    }),
    { partyCount: 0, documentCount: 0, billed: 0, received: 0, due: 0 }
  );

  return {
    rows,
    pagination: {
      total: sorted.length,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(sorted.length / take) || 1,
    },
    summary: {
      totalVendors: summary.partyCount,
      totalBilled: round2(summary.billed),
      totalPaid: round2(summary.received),
      totalDue: round2(summary.due),
      totalBills: summary.documentCount,
      matchingPartiesInCompany: matchingParties,
    },
    meta: {
      range: { from: from ?? null, to: to ?? null },
      rangeScoped: true,
      // A bill has no CANCELLED status, so no bill is excluded from the totals.
    },
  };
}

/** The one rule both party reports share for `hasDues` and the search box. */
function applyPartyFilters(rows, { hasDues, searchTerm }) {
  let filtered = rows;

  // "Has dues" means money still owed in the selected range, which is exactly
  // what the Due column shows, so the filter and the column can never disagree.
  if (hasDues === "yes") {
    filtered = filtered.filter((row) => row.due > 0);
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter((row) => String(row.name || "").toLowerCase().includes(term));
  }

  return filtered;
}

function sortPartyRows(rows, { sortField, order }) {
  const comparator = PARTY_SORT[sortField] || PARTY_SORT.name;
  return [...rows].sort((a, b) => {
    const result = comparator(a, b);
    return order === "asc" ? result : -result;
  });
}

// ===========================================================================
// 9. ALL PRODUCTS
// ===========================================================================

const CATALOGUE_SORT_MAP = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  az: { name: "asc" },
  za: { name: "desc" },
  priceHigh: { salesPrice: "desc" },
  priceLow: { salesPrice: "asc" },
  stockHigh: { stockQuantity: "desc" },
  stockLow: { stockQuantity: "asc" },
};

/** Mirrors the low-stock threshold the Products page uses. */
const LOW_STOCK_THRESHOLD = 5;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a category filter value is a real category id or legacy free text. */
function splitCategoryFilter(category) {
  if (!category) return { categoryId: null, categoryText: null };
  if (UUID_PATTERN.test(category)) return { categoryId: category, categoryText: null };
  return { categoryId: null, categoryText: `%${category}%` };
}

/** The stored status value behind the friendly filter wording. */
function resolveStatusFilter(status) {
  if (status === "available") return "ACTIVE";
  if (status === "notavailable") return "INACTIVE";
  return null;
}

/**
 * The item `where` clause shared by reports 9 and 10. Everything is a Prisma
 * filter on a real column, so there is no string building at all.
 */
function buildItemWhere({ companyId, itemType, search, category, status, stock }) {
  const { categoryId, categoryText } = splitCategoryFilter(category);
  const statusValue = resolveStatusFilter(status);
  const searchTerm = search && search.trim() ? search.trim() : null;

  const searchFields =
    itemType === "PRODUCT"
      ? [
          { name: { contains: searchTerm } },
          { productCode: { contains: searchTerm } },
          { brand: { contains: searchTerm } },
        ]
      : [
          { name: { contains: searchTerm } },
          { productCode: { contains: searchTerm } },
        ];

  return {
    where: {
      companyId,
      type: itemType,
      isDeleted: false,
      ...(statusValue ? { status: statusValue } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(categoryText ? { category: { contains: category } } : {}),
      ...(stock === "instock" ? { stockQuantity: { gt: LOW_STOCK_THRESHOLD } } : {}),
      ...(stock === "lowstock" ? { stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } } : {}),
      ...(stock === "outofstock" ? { stockQuantity: { lte: 0 } } : {}),
      ...(searchTerm ? { OR: searchFields } : {}),
    },
    // The stock bucket predicates, as fixed literals with the threshold inlined
    // from the constant above. No caller value is ever part of this text.
    stockSql: stock === "instock"
      ? `AND stockQuantity > ${LOW_STOCK_THRESHOLD}`
      : stock === "lowstock"
        ? `AND stockQuantity > 0 AND stockQuantity <= ${LOW_STOCK_THRESHOLD}`
        : stock === "outofstock"
          ? "AND stockQuantity <= 0"
          : "",
  };
}

/** Bound filter values for the summary raw query, matching buildItemWhere. */
function itemSummaryParams({ search, category, status, stock }) {
  const { categoryId, categoryText } = splitCategoryFilter(category);
  const searchLike = search && search.trim() ? `%${search.trim()}%` : null;

  return {
    searchLike,
    categoryId: categoryId ?? null,
    categoryText: categoryText ?? null,
    statusValue: resolveStatusFilter(status) ?? null,
    stockValue: stock || null,
  };
}

const ITEM_SELECT = {
  id: true,
  name: true,
  productCode: true,
  salesPrice: true,
  sellingPriceTaxMode: true,
  taxRate: true,
  status: true,
  unit: true,
  category: true,
  stockQuantity: true,
  purchasePrice: true,
  purchasePriceTaxMode: true,
  discountPercent: true,
  description: true,
  unitRel: { select: { id: true, fullName: true, shortName: true } },
  categoryRel: { select: { id: true, name: true } },
};

export async function getProductsReport({
  companyId,
  search,
  category,
  status,
  stock,
  sort = "newest",
  page = 1,
  pageSize = 10,
} = {}) {
  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);

  const { where, stockSql } = buildItemWhere({
    companyId,
    itemType: "PRODUCT",
    search,
    category,
    status,
    stock,
  });
  const params = itemSummaryParams({ search, category, status, stock });

  const [items, total, cards] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: CATALOGUE_SORT_MAP[sort] || CATALOGUE_SORT_MAP.newest,
      select: ITEM_SELECT,
    }),
    prisma.item.count({ where }),
    // Summary cards over the filtered set. Every caller value is bound; the
    // threshold and the bucket names are fixed text.
    prisma.$queryRaw`
      SELECT
        COUNT(*) AS totalProducts,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS availableProducts,
        SUM(CASE WHEN stockQuantity > 0 AND stockQuantity <= ${LOW_STOCK_THRESHOLD} THEN 1 ELSE 0 END) AS lowStockProducts,
        COALESCE(SUM(salesPrice * stockQuantity), 0) AS totalSellingValue,
        COALESCE(SUM(CASE WHEN purchasePrice IS NOT NULL THEN purchasePrice * stockQuantity ELSE 0 END), 0) AS totalCostValue
      FROM items
      WHERE companyId = ${companyId}
        AND type = 'PRODUCT'
        AND isDeleted = 0
        AND (${params.statusValue} IS NULL OR status = ${params.statusValue})
        AND (${params.categoryId} IS NULL OR categoryId = ${params.categoryId})
        AND (${params.categoryText} IS NULL OR category LIKE ${params.categoryText})
        AND (${params.searchLike} IS NULL OR name LIKE ${params.searchLike} OR productCode LIKE ${params.searchLike} OR brand LIKE ${params.searchLike})
        ${Prisma.raw(stockSql)}
    `,
  ]);

  const card = cards[0] || {};
  const sellingValue = rawMoney(card.totalSellingValue);
  const costValue = rawMoney(card.totalCostValue);

  return {
    rows: items.map((item) => {
      const quantity = toNumber(item.stockQuantity);
      const sellingPrice = toNumber(item.salesPrice);
      const purchasePrice =
        item.purchasePrice === null || item.purchasePrice === undefined ? null : toNumber(item.purchasePrice);

      return {
        id: item.id,
        name: item.name,
        productCode: item.productCode ?? null,
        category: item.categoryRel?.name || item.category || null,
        unit: item.unitRel?.shortName || item.unit || null,
        sellingPrice,
        sellingPriceTaxMode: item.sellingPriceTaxMode || "NONE",
        taxRate: item.taxRate === null || item.taxRate === undefined ? null : toNumber(item.taxRate),
        purchasePrice,
        purchasePriceTaxMode: item.purchasePriceTaxMode ?? null,
        discountPercent: item.discountPercent === null ? null : toNumber(item.discountPercent),
        quantity,
        // Stock value is the selling price on hand; the cost value only exists
        // where a purchase price is recorded.
        stockValue: round2(sellingPrice * quantity),
        costValue: purchasePrice === null ? null : round2(purchasePrice * quantity),
        status: item.status,
        isLowStock: quantity > 0 && quantity <= LOW_STOCK_THRESHOLD,
        isOutOfStock: quantity <= 0,
      };
    }),
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    summary: {
      totalProducts: rawCount(card.totalProducts),
      availableProducts: rawCount(card.availableProducts),
      lowStockProducts: rawCount(card.lowStockProducts),
      totalSellingValue: sellingValue,
      totalCostValue: costValue,
    },
    meta: {
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      // The cards describe the filtered set, so they move with the filters.
      cardsAreFiltered: true,
      costAvailable: costValue > 0,
    },
  };
}

// ===========================================================================
// 10. ALL SERVICES
// ===========================================================================

export async function getServicesReport({
  companyId,
  search,
  category,
  status,
  sort = "newest",
  page = 1,
  pageSize = 10,
} = {}) {
  const take = Math.min(Number(pageSize) || 10, 100);
  const currentPage = Math.max(1, Number(page) || 1);

  const { where } = buildItemWhere({ companyId, itemType: "SERVICE", search, category, status });
  const params = itemSummaryParams({ search, category, status });

  const [items, total, cards] = await Promise.all([
    prisma.item.findMany({
      where,
      skip: (currentPage - 1) * take,
      take,
      orderBy: CATALOGUE_SORT_MAP[sort] || CATALOGUE_SORT_MAP.newest,
      select: ITEM_SELECT,
    }),
    prisma.item.count({ where }),
    prisma.$queryRaw`
      SELECT
        COUNT(*) AS totalServices,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS availableServices,
        SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS unavailableServices
      FROM items
      WHERE companyId = ${companyId}
        AND type = 'SERVICE'
        AND isDeleted = 0
        AND (${params.statusValue} IS NULL OR status = ${params.statusValue})
        AND (${params.categoryId} IS NULL OR categoryId = ${params.categoryId})
        AND (${params.categoryText} IS NULL OR category LIKE ${params.categoryText})
        AND (${params.searchLike} IS NULL OR name LIKE ${params.searchLike} OR productCode LIKE ${params.searchLike})
    `,
  ]);

  const card = cards[0] || {};

  return {
    rows: items.map((item) => ({
      id: item.id,
      name: item.name,
      serviceCode: item.productCode ?? null,
      category: item.categoryRel?.name || item.category || null,
      unit: item.unitRel?.shortName || item.unit || null,
      sellingPrice: toNumber(item.salesPrice),
      sellingPriceTaxMode: item.sellingPriceTaxMode || "NONE",
      taxRate: item.taxRate === null || item.taxRate === undefined ? null : toNumber(item.taxRate),
      status: item.status,
      description: item.description ?? null,
    })),
    pagination: {
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    },
    summary: {
      totalServices: rawCount(card.totalServices),
      availableServices: rawCount(card.availableServices),
      unavailableServices: rawCount(card.unavailableServices),
    },
    meta: {
      cardsAreFiltered: true,
      // A service has no purchase price and no stock, so it has no cost value.
      hasCost: false,
      hasStock: false,
    },
  };
}
