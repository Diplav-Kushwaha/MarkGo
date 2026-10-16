import { z } from "zod";

/**
 * Query/param schemas for the customer dashboard endpoints.
 *
 * Every value here is a *read* filter — there is no create/update/delete schema
 * because the customer dashboard is strictly read-only. Identity (which
 * customer, which company) never comes from these params: it is taken from the
 * verified token by `authenticateCustomerToken`, so nothing a client can type
 * into the query string can widen the scope of a result.
 */

/** Shared pagination. `limit` is the read-only page size; capped like the admin lists. */
const pagination = {
  page: z.coerce.number().int("Page must be a whole number.").min(1).default(1),
  limit: z.coerce.number().int("Limit must be a whole number.").min(1).max(100).default(10),
};

/** Reusable free-text search. */
const search = z.string().trim().max(120, "Search term is too long.").optional();

const dateString = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
  .optional();

/**
 * Query cleaner for the customer list routes. Filter controls arrive as empty
 * strings ("") when nothing is chosen (axios serialises ""), and Zod
 * `.optional()` only accepts `undefined` — so an empty status / availability /
 * date would otherwise fail an enum/date check. This drops empty-string and
 * null keys before parsing, so an empty filter simply means "no filter". Any
 * further unknown keys are then stripped by z.object (never rejected). No
 * identity/company data is ever read from these params — that stays in the token.
 */
const stripEmptyFilters = (schema) =>
  z.preprocess((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const cleaned = {};
      for (const key of Object.keys(value)) {
        const entry = value[key];
        if (entry === "" || entry === null) continue;
        cleaned[key] = entry;
      }
      return cleaned;
    }
    return value;
  }, schema);

/** 1. Purchased products — aggregated from the customer's own invoice line items. */
export const purchasedProductsQuerySchema = stripEmptyFilters(z.object({
  search,
  sort: z.enum(["recent", "az", "quantity"]).default("recent"),
  ...pagination,
}));

/** 2. Invoices list — only the customer's own invoices. */
export const customerInvoicesQuerySchema = stripEmptyFilters(z.object({
  search,
  status: z
    .enum(["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"])
    .optional(),
  from: dateString,
  to: dateString,
  sort: z.enum(["newest", "oldest", "amountHigh", "amountLow"]).default("newest"),
  ...pagination,
}));

/** 4./5. Products & services of the customer's company (customer-safe fields). */
export const companyCatalogQuerySchema = stripEmptyFilters(z.object({
  search,
  category: z.string().trim().max(100, "Category is too long.").optional(),
  availability: z.enum(["available", "notavailable"]).optional(),
  sort: z.enum(["newest", "oldest", "az", "za", "priceHigh", "priceLow"]).default("newest"),
  ...pagination,
}));

/** 3. Invoice details — the id is validated as a uuid, then ownership is enforced
 *  in the service (a non-owned id resolves to 404, not 403). */
export const customerInvoiceIdParamSchema = z.object({
  id: z.string().uuid("Invalid invoice id."),
});
