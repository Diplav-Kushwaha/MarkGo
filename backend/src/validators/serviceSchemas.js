import { z } from "zod";
import { SERVICES_DEFAULT_PAGE_SIZE, SERVICES_MAX_PAGE_SIZE } from "../config/services.js";

/**
 * Service validation.
 *
 * Products and Services share one Prisma model, but only services use this
 * schema: the shared item routes pick it whenever a request does not declare
 * `type: "PRODUCT"`, and leave the Products path on the product schema.
 *
 * Field shape and ranges are enforced here; the cross-field business rules (tax
 * mode coherence, unit/category existence, the mandatory fields of a service
 * that is being edited) live in serviceService so create and update share one
 * implementation.
 *
 * Only the new service contract fields exist in these schemas. Everything the
 * old item form used to send — `sku`, `sacCode`, `barcode`, `tags`,
 * `subCategory`, `brand`, discount and stock fields, the free-text `unit` /
 * `category` strings — is neither named nor read: z.object strips unknown keys,
 * so those values are dropped before the controller ever sees them.
 */

const PRICE_TAX_MODES = ["INCLUSIVE", "EXCLUSIVE", "NONE"];

/**
 * Status is stored as ACTIVE / INACTIVE (shown to users as Available / Not
 * available). Writes keep the stored values; only the list query accepts the
 * friendly `available` / `notavailable` spellings.
 */
const STATUS_VALUES = ["ACTIVE", "INACTIVE"];

/** `""` (blank form input) and an absent key both mean "not provided". */
const blankToUndefined = (value) => (value === "" || value === null ? undefined : value);

/**
 * `null` is NOT folded into undefined: an explicit null is how a client clears
 * an optional field, while `""` and an absent key leave the stored value alone.
 */
const blankToUndefinedKeepNull = (value) => (value === "" ? undefined : value);

const optionalEnum = (values, label) =>
  z.preprocess(
    blankToUndefined,
    z.enum(values, { error: `${label} must be one of: ${values.join(", ")}.` }).optional()
  );

/** Optional text: `""` and an absent key mean "not provided". */
const optionalText = (max, label) =>
  z.preprocess(
    blankToUndefined,
    z
      .string({ error: `${label} must be text.` })
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .optional()
  );

/** Optional nullable text: also accepts an explicit `null` to clear the field. */
const clearableText = (max, label) =>
  z.preprocess(
    blankToUndefinedKeepNull,
    z
      .string({ error: `${label} must be text.` })
      .trim()
      .max(max, `${label} must be ${max} characters or fewer.`)
      .nullable()
      .optional()
  );

/**
 * Numbers arrive as JSON numbers or as form strings. Anything that is not a
 * finite number (including a blank field) becomes NaN so every failure produces
 * the same readable "must be a valid number" message.
 */
function numberSchema({ label, min, max, integer = false }) {
  let inner = z.number({ error: `${label} must be a valid number.` });
  if (integer) inner = inner.int(`${label} must be a whole number.`);
  if (min !== undefined) inner = inner.min(min, `${label} must be ${min} or greater.`);
  if (max !== undefined) inner = inner.max(max, `${label} must be ${max} or less.`);

  return z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) return NaN;
    const n = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isNaN(n) ? NaN : n;
  }, inner);
}

/** Optional number: `""` and an absent key mean "not provided". */
const optionalNumber = (opts) => z.preprocess(blankToUndefined, numberSchema(opts).optional());

/**
 * Required id (unit / category). `""` and an absent key both fail, so an empty
 * form field never slips through as a missing mandatory value.
 */
const requiredId = (label) =>
  z.preprocess(blankToUndefined, z.string({ error: `${label} is required.` }).uuid(`${label} is invalid.`));

/** Optional id: `""` and an absent key mean "not provided". */
const optionalId = (label) =>
  z.preprocess(
    blankToUndefined,
    z.string({ error: `${label} is required.` }).uuid(`${label} is invalid.`).optional()
  );

// ---------------------------------------------------------------------------
// Create — every mandatory field of the service contract is required here.
// ---------------------------------------------------------------------------

export const createServiceSchema = z.object({
  // Accepted so the shared route can select this schema; the service path
  // always stores type = SERVICE regardless of the value sent.
  type: z.literal("SERVICE").optional(),

  name: z
    .string({ error: "Name must be text." })
    .trim()
    .min(1, "Name is required.")
    .max(200, "Name must be 200 characters or fewer."),

  serviceCode: z
    .string({ error: "Service code must be text." })
    .trim()
    .min(1, "Service code is required.")
    .max(60, "Service code must be 60 characters or fewer."),

  unitId: requiredId("Unit"),
  categoryId: requiredId("Category"),

  sellingPrice: numberSchema({ label: "Selling price", min: 0 }),
  sellingPriceTaxMode: z.enum(PRICE_TAX_MODES, {
    error: `Selling price tax mode must be one of: ${PRICE_TAX_MODES.join(", ")}.`,
  }),

  taxRate: optionalNumber({ label: "Tax rate", min: 0, max: 100 }),

  description: optionalText(2000, "Description"),
  status: optionalEnum(STATUS_VALUES, "Status"),
});

// ---------------------------------------------------------------------------
// Update — every field is optional.
//
// Deliberately written out instead of `createServiceSchema.partial()`: a PATCH
// that sends only one field must never trip the required checks of the fields
// it does not mention. The service additionally validates the RESULTING state,
// so an older service with an empty unit, category or code can only be saved
// once the request fills it in.
// ---------------------------------------------------------------------------

export const updateServiceSchema = z.object({
  type: z.literal("SERVICE").optional(),

  name: optionalText(200, "Name"),
  serviceCode: optionalText(60, "Service code"),

  // `""`, an absent key and an explicit null all mean "not provided". A service
  // must always keep a unit and a category, so they can never be cleared that
  // way; saving a service that would end up without one is rejected by the
  // merged-state check in the service.
  unitId: optionalId("Unit"),
  categoryId: optionalId("Category"),

  sellingPrice: optionalNumber({ label: "Selling price", min: 0 }),
  sellingPriceTaxMode: optionalEnum(PRICE_TAX_MODES, "Selling price tax mode"),

  taxRate: optionalNumber({ label: "Tax rate", min: 0, max: 100 }),

  description: clearableText(2000, "Description"),
  status: optionalEnum(STATUS_VALUES, "Status"),
});

// ---------------------------------------------------------------------------
// Status toggle — the same ACTIVE / INACTIVE contract the item status route
// already validates with. Exported so the service applies it to its own writes
// (there is no quantity rule for services).
// ---------------------------------------------------------------------------

export const serviceStatusSchema = z.object({
  status: z.enum(STATUS_VALUES, {
    error: "Status must be ACTIVE or INACTIVE.",
  }),
});

// ---------------------------------------------------------------------------
// List query
//
// The new vocabulary is `status=available|notavailable`, `search` (name or
// service code) and `sort=newest|oldest|az|za|priceHigh|priceLow`.
//
// Everything the old item list accepted that services have no use for — `type`,
// `stock` / `stockLevel`, `category` — is stripped and ignored here, so it can
// never filter the service list. `sortBy` + `sortOrder` are still accepted and
// mapped onto the new sort names, because the existing pages send them.
// `validateQuery` publishes the parsed result on `req.validatedQuery`.
// ---------------------------------------------------------------------------

const STATUS_FILTERS = ["available", "notavailable", "ACTIVE", "INACTIVE"];
const SORTS = ["newest", "oldest", "az", "za", "priceHigh", "priceLow"];

export const serviceListQuerySchema = z.object({
  search: z.preprocess(
    blankToUndefined,
    z.string({ error: "Search must be text." }).trim().max(120, "Search term is too long.").optional()
  ),
  status: optionalEnum(STATUS_FILTERS, "Status filter"),
  sort: optionalEnum(SORTS, "Sort"),
  // Legacy aliases still sent by the current pages; the service maps them.
  sortBy: z.preprocess(
    blankToUndefined,
    z.string({ error: "Sort field must be text." }).trim().max(40).optional()
  ),
  sortOrder: z.preprocess(
    blankToUndefined,
    z.string({ error: "Sort order must be text." }).trim().max(10).optional()
  ),
  page: z.preprocess(
    blankToUndefined,
    numberSchema({ label: "Page", min: 1, integer: true }).default(1)
  ),
  pageSize: z.preprocess(
    blankToUndefined,
    numberSchema({
      label: "Page size",
      min: 1,
      max: SERVICES_MAX_PAGE_SIZE,
      integer: true,
    }).default(SERVICES_DEFAULT_PAGE_SIZE)
  ),
});
