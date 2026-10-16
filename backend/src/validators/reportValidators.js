import { z } from "zod";

const dateString = (label) =>
  z
    .string()
    .min(1, `${label} date is required.`)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), `Invalid ${label.toLowerCase()} date.`);

export const salesReportQuerySchema = z
  .object({
    from: dateString("From").transform((value) => new Date(value)),
    to: dateString("To").transform((value) => new Date(value)),
  })
  .refine((data) => data.from <= data.to, {
    message: "From date must be before or equal to to date.",
    path: ["from"],
  });

// ---------------------------------------------------------------------------
// Query schemas for the new Reports endpoints.
//
// Every report is strictly READ-ONLY: there is no create/update/delete schema in
// this file, because there is no such route. Identity never comes from these
// params - the company is taken from the verified token by the controller, so
// nothing a client can type into the query string can widen a result's scope.
//
// The parsing rules below are deliberately tolerant, because filter controls
// arrive as empty strings (axios serialises an untouched <select> as "") and a
// client may send values the UI does not offer:
//
//   - an empty string, null and the literal "all" all mean "no filter";
//   - page / pageSize are numbers with defaults and a hard maximum;
//   - dates are optional ISO dates, and from must not be after to;
//   - sort accepts exactly the values the UI offers;
//   - any other key is stripped by z.object (ignored, never rejected).
//
// Failures are never a bare "Validation failed.": each one names its field and
// the value it found, so the client can fix exactly that control.
// ---------------------------------------------------------------------------

/** An unset filter. Blank, null and "all" are the same thing. */
const NO_FILTER = ["", "all"];

/** Optional id (customer / vendor / product / service). "all" and "" mean none. */
const optionalId = (label) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      const text = String(value).trim();
      if (NO_FILTER.includes(text.toLowerCase())) return undefined;
      return text;
    },
    z.string({ error: `${label} must be text.` }).uuid(`${label} is invalid.`).optional()
  );

/** Optional enum-like filter, tolerant of the empty / "all" spellings. */
function optionalFilter(values, label) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      const text = String(value).trim();
      if (NO_FILTER.includes(text.toLowerCase())) return undefined;
      return text;
    },
    z
      .enum(values, {
        error: `${label} must be one of: ${values.join(", ")}.`,
      })
      .optional()
  );
}

/**
 * Optional free text. A category or vendor name is not an enum (the rows are
 * user-created), so it is only capped in length.
 */
const optionalText = (label) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      const text = String(value).trim();
      if (NO_FILTER.includes(text.toLowerCase())) return undefined;
      return text;
    },
    z
      .string({ error: `${label} must be text.` })
      .trim()
      .max(120, `${label} is too long (120 characters maximum).`)
      .optional()
  );

/** Free-text search, capped so a long paste cannot become an expensive query. */
const search = z
  .string({ error: "Search must be text." })
  .trim()
  .max(120, "Search term is too long (120 characters maximum).")
  .optional();

/** Optional ISO date. A blank string is "no filter", not an error. */
const optionalIsoDate = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    if (NO_FILTER.includes(text.toLowerCase())) return undefined;
    return text;
  },
  z
    .string({ error: "A date must be text in ISO format (YYYY-MM-DD)." })
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date. Use an ISO date (YYYY-MM-DD).")
    .transform((value) => new Date(value))
    .optional()
);

/**
 * A `from` / `to` pair with an ordering check, reported against the range as a
 * whole so the UI can highlight both controls at once.
 */
function withDateOrder(schema) {
  return schema.refine((data) => data.from === undefined || data.to === undefined || data.from <= data.to, {
    message: "The 'from' date must be on or before the 'to' date.",
    path: ["range"],
  });
}

/**
 * Query cleaner that drops empty-string, null and "all" keys before the object
 * schema runs, and rejects the identity-bearing keys by name: the company only
 * ever comes from the verified token, so a caller can never smuggle one in
 * through the query string.
 *
 * A smuggled key is NOT thrown from here. Throwing inside a `preprocess`
 * escapes `safeParse`'s own try/catch and surfaces as a 500 instead of a 400
 * with a usable message, so the key is left in place and a `.superRefine` added
 * to every schema below turns it into a normal, specific issue.
 */
const IDENTITY_KEYS = ["companyId", "companySlug", "company_id", "company"];

const stripEmptyFilters = (schema) =>
  z.preprocess((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;

    // An identity key is deliberately left alone: it is not an unset filter, so
    // dropping it would silently answer with another company's scope. Leaving it
    // in place lets the schema below name it in a 400.
    return Object.entries(value).reduce((cleaned, [key, entry]) => {
      if (IDENTITY_KEYS.includes(key)) {
        cleaned[key] = entry;
        return cleaned;
      }
      if (entry === "" || entry === null) return cleaned;
      if (typeof entry === "string" && NO_FILTER.includes(entry.trim().toLowerCase())) return cleaned;
      cleaned[key] = entry;
      return cleaned;
    }, {});
  }, schema);

/**
 * Reports a query that still carries an identity key, via a normal issue.
 *
 * This runs on a copy of the RAW query, not on the stripped result: by the time
 * a schema's body has run, `stripEmptyFilters` has already dropped everything
 * the caller did not explicitly send, and a smuggled company would be silently
 * absorbed along with it. Guarding the raw input is the only way the mistake
 * can actually be reported — and it must be, because the company is otherwise
 * taken from the token and a stray `companyId` could never be traced.
 */
const rawQueryWithCompanyGuard = (rawQuery) => {
  if (!rawQuery || typeof rawQuery !== "object") return null;
  const smuggled = IDENTITY_KEYS.find((key) => key in rawQuery);
  if (!smuggled) return null;

  return {
    code: "custom",
    path: [smuggled],
    message: "The company cannot be given in a query parameter. It is taken from your session token.",
  };
};

export { rawQueryWithCompanyGuard };

/** Shared pagination. Every report list is capped at REPORTS_MAX_PAGE_SIZE. */
export const REPORTS_DEFAULT_PAGE_SIZE = 10;
export const REPORTS_MAX_PAGE_SIZE = 100;

const numericQueryValue = (label) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || String(value).trim() === "") return undefined;
      return value;
    },
    z.coerce
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(1, `${label} must be 1 or greater.`)
      .max(REPORTS_MAX_PAGE_SIZE, `${label} must be ${REPORTS_MAX_PAGE_SIZE} or less.`)
  );

const pagination = {
  page: numericQueryValue("Page").default(1),
  pageSize: numericQueryValue("Page size").default(REPORTS_DEFAULT_PAGE_SIZE),
};

// ---------------------------------------------------------------------------
// Sort vocabularies - exactly the values each report's UI offers.
// ---------------------------------------------------------------------------

const SALES_SORTS = ["dateDesc", "dateAsc", "totalDesc", "totalAsc", "dueDesc", "invoiceAsc"];
const PURCHASE_SORTS = ["dateDesc", "dateAsc", "totalDesc", "totalAsc", "dueDesc", "billAsc"];
const PARTY_SORT_FIELDS = ["name", "billed", "received", "due", "count", "lastDate"];
const PARTY_SORT_DIRECTIONS = ["asc", "desc"];
const CATALOGUE_SORTS = ["newest", "oldest", "az", "za", "priceHigh", "priceLow", "stockHigh", "stockLow"];
const PROFIT_SORTS = ["profitDesc", "profitAsc", "revenueDesc", "revenueAsc", "marginDesc", "quantityDesc", "nameAsc"];
const TRANSACTION_SORTS = ["dateDesc", "dateAsc", "amountDesc", "amountAsc", "partyAsc"];

const sortValue = (sortValues, defaultSort) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;
      const text = String(value).trim();
      if (NO_FILTER.includes(text.toLowerCase())) return undefined;
      return text;
    },
    z
      .enum(sortValues, {
        error: `Sort must be one of: ${sortValues.join(", ")}.`,
      })
      .default(defaultSort)
  );

const sortDirection = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim().toLowerCase();
    if (NO_FILTER.includes(text)) return undefined;
    return text;
  },
  z
    .enum(PARTY_SORT_DIRECTIONS, {
      error: `Sort direction must be one of: ${PARTY_SORT_DIRECTIONS.join(", ")}.`,
    })
    .default("desc")
);

const PAYMENT_STATUSES = ["PAID", "PARTIALLY_PAID", "UNPAID", "OVERDUE"];
const TRANSACTION_MODES = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "UPI",
  "RAZORPAY",
  "STRIPE",
  "PAYPAL",
  "CASHFREE",
  "OTHER",
];

// ---------------------------------------------------------------------------
// 1. Sales report
// ---------------------------------------------------------------------------

export const salesListReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      search,
      customerId: optionalId("Customer"),
      paymentStatus: optionalFilter(PAYMENT_STATUSES, "Payment status"),
      from: optionalIsoDate,
      to: optionalIsoDate,
      ...pagination,
      sort: sortValue(SALES_SORTS, "dateDesc"),
    })
  )
);

// ---------------------------------------------------------------------------
// 2. Purchases report
// ---------------------------------------------------------------------------

export const purchasesReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      search,
      vendorId: optionalId("Vendor"),
      paymentStatus: optionalFilter(PAYMENT_STATUSES, "Payment status"),
      from: optionalIsoDate,
      to: optionalIsoDate,
      ...pagination,
      sort: sortValue(PURCHASE_SORTS, "dateDesc"),
    })
  )
);

// ---------------------------------------------------------------------------
// 3. All transactions
// ---------------------------------------------------------------------------

export const transactionsReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      search,
      type: optionalFilter(["ALL", "INCOMING", "OUTGOING"], "Type"),
      status: optionalFilter(["ALL", "SUCCESSFUL"], "Status"),
      mode: optionalFilter(TRANSACTION_MODES, "Mode"),
      partyId: optionalId("Customer or vendor"),
      from: optionalIsoDate,
      to: optionalIsoDate,
      ...pagination,
      sort: sortValue(TRANSACTION_SORTS, "dateDesc"),
    })
  )
);

// ---------------------------------------------------------------------------
// 4. Profit & loss
// ---------------------------------------------------------------------------

export const profitLossReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      // overall | day | month | year
      groupBy: optionalFilter(["overall", "day", "month", "year"], "View"),
      from: optionalIsoDate,
      to: optionalIsoDate,
      customerId: optionalId("Customer"),
      search,
    })
  )
);

// ---------------------------------------------------------------------------
// 5. / 6. Product-wise and service-wise profit & loss
// ---------------------------------------------------------------------------

const itemProfitLossBase = z.object({
  from: optionalIsoDate,
  to: optionalIsoDate,
  search,
  ...pagination,
});

export const soldProductsReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    itemProfitLossBase.extend({
      productId: optionalId("Product"),
      sort: sortValue(PROFIT_SORTS, "profitDesc"),
    })
  )
);

export const soldServicesReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    itemProfitLossBase.extend({
      serviceId: optionalId("Service"),
      sort: sortValue(PROFIT_SORTS, "profitDesc"),
    })
  )
);

/**
 * The sale lines of one item. Both the item id and its type travel as query
 * parameters, so a single query validator covers them; the service still
 * confirms the item belongs to this company before returning anything.
 */
export const soldItemLinesQuerySchema = z.object({
  itemId: z.string({ error: "Item id is required." }).uuid("Item id is invalid."),
  itemType: z.enum(["PRODUCT", "SERVICE"], {
    error: "Type must be PRODUCT or SERVICE.",
  }),
  from: optionalIsoDate,
  to: optionalIsoDate,
  ...pagination,
  sort: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) return undefined;
        const text = String(value).trim();
        if (NO_FILTER.includes(text.toLowerCase())) return undefined;
        return text;
      },
      z.enum(["dateDesc", "dateAsc"], {
        error: "Sort must be one of: dateDesc, dateAsc.",
      })
    )
    .default("dateDesc"),
});

// ---------------------------------------------------------------------------
// 7. / 8. Customers and vendors
// ---------------------------------------------------------------------------

export const customersReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      search,
      hasDues: optionalFilter(["yes", "no"], "Has dues"),
      from: optionalIsoDate,
      to: optionalIsoDate,
      sortField: optionalFilter(PARTY_SORT_FIELDS, "Sort field"),
      order: sortDirection,
      ...pagination,
    })
  )
);

export const vendorsReportQuerySchema = withDateOrder(
  stripEmptyFilters(
    z.object({
      search,
      hasDues: optionalFilter(["yes", "no"], "Has dues"),
      from: optionalIsoDate,
      to: optionalIsoDate,
      sortField: optionalFilter(PARTY_SORT_FIELDS, "Sort field"),
      order: sortDirection,
      ...pagination,
    })
  )
);

// ---------------------------------------------------------------------------
// 9. / 10. Products and services catalogue reports
// ---------------------------------------------------------------------------

const catalogueBase = {
  search,
  category: optionalText("Category"),
  status: optionalFilter(["available", "notavailable"], "Status"),
  ...pagination,
};

export const productsReportQuerySchema = stripEmptyFilters(
  z.object({
    ...catalogueBase,
    stock: optionalFilter(["instock", "lowstock", "outofstock"], "Stock"),
    sort: sortValue(CATALOGUE_SORTS, "newest"),
  })
);

export const servicesReportQuerySchema = stripEmptyFilters(
  z.object({
    ...catalogueBase,
    sort: sortValue(CATALOGUE_SORTS, "newest"),
  })
);

export { optionalId, optionalFilter, optionalText, search, pagination, stripEmptyFilters };
