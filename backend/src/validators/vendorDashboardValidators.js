import { z } from "zod";

/**
 * Query/param schemas for the vendor dashboard endpoints.
 *
 * Every value here is a *read* filter — there is no create/update/delete schema
 * because the vendor dashboard is strictly read-only. Identity (which vendor,
 * which company) never comes from these params: it is taken from the verified
 * token by `authenticateVendorToken`, so nothing a client can type into the
 * query string can widen the scope of a result to another vendor or company.
 */

/** Shared pagination. `limit` is the read-only page size; capped like the other lists. */
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
 * Query cleaner for the vendor list routes. Filter controls arrive as empty
 * strings ("") when nothing is chosen (axios serialises ""), and an "All"
 * option arrives as the literal "all"; Zod `.optional()` only accepts
 * `undefined` — so an empty status / type / availability / date / category
 * would otherwise fail an enum/date check. This drops empty-string, null and
 * "all" (any case) keys before parsing, so those simply mean "no filter". Any
 * further unknown keys are then stripped by z.object (never rejected). No
 * identity/company data is ever read from these params — that stays in the
 * token.
 */
const stripEmptyFilters = (schema) =>
  z.preprocess((value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const cleaned = {};
      for (const key of Object.keys(value)) {
        const entry = value[key];
        if (entry === "" || entry === null) continue;
        if (typeof entry === "string" && entry.trim().toLowerCase() === "all") continue;
        cleaned[key] = entry;
      }
      return cleaned;
    }
    return value;
  }, schema);

/** 1. Sold products & services — aggregated from the vendor's own bill line items. */
export const soldProductsQuerySchema = stripEmptyFilters(
  z.object({
    search,
    type: z.enum(["product", "service"]).optional(),
    sort: z.enum(["recent", "az", "quantity"]).default("recent"),
    ...pagination,
  })
);

/** 2. Bills list — only the vendor's own bills. */
export const vendorBillsQuerySchema = stripEmptyFilters(
  z.object({
    search,
    status: z.enum(["UNPAID", "PARTIALLY_PAID", "PAID"]).optional(),
    from: dateString,
    to: dateString,
    sort: z.enum(["newest", "oldest", "amountHigh", "amountLow"]).default("newest"),
    ...pagination,
  })
);

/** 3. Bill details — the id is validated as a uuid, then ownership is enforced
 *  in the service (a non-owned id resolves to 404, not 403). */
export const vendorBillIdParamSchema = z.object({
  id: z.string().uuid("Invalid bill id."),
});

/** 4./5. Products & services of the vendor's company (vendor-safe fields). */
export const vendorCatalogQuerySchema = stripEmptyFilters(
  z.object({
    search,
    category: z.string().trim().max(100, "Category is too long.").optional(),
    availability: z.enum(["available", "notavailable"]).optional(),
    sort: z.enum(["newest", "oldest", "az", "za"]).default("newest"),
    ...pagination,
  })
);
